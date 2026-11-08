import { app, ipcMain } from "electron";
import { execFileSync } from "child_process";
import { randomBytes } from "crypto";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { hostname, networkInterfaces } from "os";
import { join } from "path";
import QRCode from "qrcode";
import { WebSocketServer, type WebSocket } from "ws";
import {
  parseClientMessage,
  type ClientMessage,
  type ServerMessage,
} from "@blueberry/protocol";
import type { Window } from "../Window";
import type { Tab } from "../Tab";
import { Agent } from "./agent";
import { CompanionStore } from "./store";

const PORT = 47800;
const HELLO_TIMEOUT_MS = 3000;
const FRAME_INTERVAL_MS = 1000;
const FRAME_WIDTH = 480;
const FRAME_QUALITY = 60;
// Skip a frame rather than queue it behind a slow connection
const MAX_BUFFERED_BYTES = 1_000_000;

// What the desktop UI shows in its "Connect your phone" panel
export interface PairingInfo {
  url: string;
  qrDataUrl: string;
  desktopName: string;
  devices: { name: string; connectedAt: number }[];
}

export interface Companion {
  stop(): void;
}

export function startCompanion(window: Window): Companion {
  const store = new CompanionStore();
  const agent = new Agent(window, store);
  const desktopName = computerName();
  let token = loadToken();
  // Authenticated phones and what they called themselves in hello
  const clients = new Map<WebSocket, { name: string; connectedAt: number }>();

  const send = (socket: WebSocket, message: ServerMessage): void => {
    if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(message));
  };
  const broadcast = (message: ServerMessage): void =>
    clients.forEach((_, s) => send(s, message));

  // ---------------------------------------------------------------------------
  // Live frames: per task, after every finished step, plus a steady tick while
  // tasks run. The last frame of each task is kept so a phone that connects
  // later still sees a thumbnail for every chat.
  // ---------------------------------------------------------------------------

  const lastFrames = new Map<string, string>();
  const capturing = new Set<string>();

  const sendFrame = async (taskId: string, tab: Tab | null): Promise<void> => {
    if (!tab || capturing.has(taskId)) return;
    capturing.add(taskId);
    try {
      // stayHidden: agent tabs behind the active tab still have to render
      const image = await tab.webContents.capturePage(undefined, {
        stayHidden: true,
      });
      if (image.isEmpty()) return;
      const jpegBase64 = image
        .resize({ width: FRAME_WIDTH })
        .toJPEG(FRAME_QUALITY)
        .toString("base64");
      if (jpegBase64 === lastFrames.get(taskId)) return;
      lastFrames.set(taskId, jpegBase64);
      clients.forEach((_, socket) => {
        if (socket.bufferedAmount < MAX_BUFFERED_BYTES)
          send(socket, { type: "frame", taskId, jpegBase64 });
      });
    } catch (error) {
      console.error("Companion frame capture failed:", error);
    } finally {
      capturing.delete(taskId);
    }
  };

  const frameTimer = setInterval(() => {
    if (clients.size === 0) return;
    for (const { taskId, tab } of agent.runningTabs())
      void sendFrame(taskId, tab);
  }, FRAME_INTERVAL_MS);

  const unsubscribe = store.subscribe((event) => {
    broadcast({ type: "event", event });
    const settled =
      (event.kind === "step" && event.status !== "running") ||
      event.kind === "task.finished" ||
      event.kind === "task.status";
    if (settled) void sendFrame(event.taskId, agent.tabFor(event.taskId));
  });

  // ---------------------------------------------------------------------------
  // Connections
  // ---------------------------------------------------------------------------

  const handle = (message: ClientMessage): void => {
    switch (message.type) {
      case "hello":
        return; // already authenticated
      case "task.start":
        return agent.start(message.prompt, message.startUrl);
      case "task.cancel":
        return agent.cancel(message.taskId);
      case "task.message":
        return agent.message(message.taskId, message.text);
      case "approval.respond":
        return agent.respondApproval(
          message.approvalId,
          message.approved,
          message.note,
        );
    }
  };

  const server = new WebSocketServer({ port: PORT });

  server.on("connection", (socket, request) => {
    let authed = false;
    const helloTimer = setTimeout(
      () => socket.close(4001, "Expected hello"),
      HELLO_TIMEOUT_MS,
    );

    socket.on("message", (data) => {
      const parsed = parseClientMessage(data.toString());
      if (!parsed.ok)
        return send(socket, { type: "error", message: parsed.error });
      const message = parsed.data;

      if (!authed) {
        if (message.type !== "hello" || message.token !== token) {
          socket.close(4003, "Invalid token");
          return;
        }
        authed = true;
        clearTimeout(helloTimer);
        clients.set(socket, {
          name: message.deviceName,
          connectedAt: Date.now(),
        });
        console.log(
          `📱 Companion connected: ${message.deviceName} (${request.socket.remoteAddress})`,
        );
        send(socket, {
          type: "snapshot",
          state: store.state,
          desktop: { name: desktopName },
        });
        lastFrames.forEach((jpegBase64, taskId) =>
          send(socket, { type: "frame", taskId, jpegBase64 }),
        );
        notifyDevices();
        return;
      }

      try {
        handle(message);
      } catch (error) {
        send(socket, {
          type: "error",
          message: error instanceof Error ? error.message : String(error),
        });
      }
    });

    socket.on("close", () => {
      clearTimeout(helloTimer);
      if (clients.delete(socket)) notifyDevices();
    });
    socket.on("error", (error) =>
      console.error("Companion socket error:", error),
    );
  });

  server.on("listening", () =>
    console.log(`🫐 Blueberry Companion listening on port ${PORT}`),
  );
  server.on("error", (error) =>
    console.error("Companion server error:", error),
  );

  // ---------------------------------------------------------------------------
  // Desktop UI: the toolbar's phone button and the sidebar's pairing panel
  // ---------------------------------------------------------------------------

  const pairingInfo = async (): Promise<PairingInfo> => {
    const url = `blueberry://pair?host=${lanAddress()}&port=${PORT}&token=${token}`;
    return {
      url,
      qrDataUrl: await QRCode.toDataURL(url, { margin: 1, width: 480 }),
      desktopName,
      devices: [...clients.values()],
    };
  };

  // Pushes the connected-devices list to the browser UI
  function notifyDevices(): void {
    const devices = [...clients.values()];
    for (const view of [window.sidebar.view, window.topBar.view]) {
      if (!view.webContents.isDestroyed())
        view.webContents.send("companion:devices", devices);
    }
  }

  ipcMain.handle("companion:get-pairing", pairingInfo);

  ipcMain.handle("companion:show-pairing", () => {
    window.sidebar.show();
    window.updateAllBounds();
    window.sidebar.view.webContents.send("companion:show-pairing");
  });

  // Invalidates the old code: paired phones are disconnected and must scan again
  ipcMain.handle("companion:reset-pairing", async () => {
    token = createToken();
    clients.forEach((_, socket) => socket.close(4003, "Pairing reset"));
    return pairingInfo();
  });

  return {
    stop() {
      clearInterval(frameTimer);
      unsubscribe();
      for (const channel of [
        "companion:get-pairing",
        "companion:show-pairing",
        "companion:reset-pairing",
      ])
        ipcMain.removeHandler(channel);
      clients.forEach((_, socket) => socket.close(1001, "Shutting down"));
      server.close();
    },
  };
}

const tokenFile = (): string => join(app.getPath("userData"), "companion.json");

// Generated once and kept in userData, so a paired phone stays paired across restarts
function loadToken(): string {
  const file = tokenFile();
  if (existsSync(file)) {
    try {
      const { token } = JSON.parse(readFileSync(file, "utf8"));
      if (typeof token === "string" && token.length > 0) return token;
    } catch {
      // fall through and regenerate
    }
  }
  return createToken();
}

function createToken(): string {
  const token = randomBytes(24).toString("base64url");
  writeFileSync(tokenFile(), JSON.stringify({ token }, null, 2));
  return token;
}

// "Konstantin's MacBook Pro" rather than "Konstantins-MacBook-Pro.local"
function computerName(): string {
  if (process.platform === "darwin") {
    try {
      return execFileSync("scutil", ["--get", "ComputerName"], {
        encoding: "utf8",
      }).trim();
    } catch {
      // fall back to the hostname
    }
  }
  return hostname().replace(/\.local$/, "");
}

function lanAddress(): string {
  const candidates = Object.entries(networkInterfaces())
    .flatMap(([name, addresses]) =>
      (addresses ?? []).map((a) => ({ name, ...a })),
    )
    .filter((a) => a.family === "IPv4" && !a.internal);
  // Prefer Wi-Fi/Ethernet over VPN and bridge interfaces
  return (
    (candidates.find((a) => a.name.startsWith("en")) ?? candidates[0])
      ?.address ?? "127.0.0.1"
  );
}
