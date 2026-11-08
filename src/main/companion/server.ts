import { app } from "electron";
import { randomBytes } from "crypto";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { networkInterfaces } from "os";
import { join } from "path";
import qrcode from "qrcode-terminal";
import { WebSocketServer, type WebSocket } from "ws";
import {
  parseClientMessage,
  type ClientMessage,
  type ServerMessage,
} from "@blueberry/protocol";
import type { Window } from "../Window";
import { Agent } from "./agent";
import { CompanionStore } from "./store";

const PORT = 47800;
const HELLO_TIMEOUT_MS = 3000;
const FRAME_INTERVAL_MS = 1000;
const FRAME_WIDTH = 480;
const FRAME_QUALITY = 60;
// Skip a frame rather than queue it behind a slow connection
const MAX_BUFFERED_BYTES = 1_000_000;

export interface Companion {
  stop(): void;
}

export function startCompanion(window: Window): Companion {
  const store = new CompanionStore();
  const agent = new Agent(window, store);
  const token = loadToken();
  const clients = new Set<WebSocket>();

  const send = (socket: WebSocket, message: ServerMessage): void => {
    if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(message));
  };
  const broadcast = (message: ServerMessage): void =>
    clients.forEach((s) => send(s, message));

  // ---------------------------------------------------------------------------
  // Live frames: after every finished step, plus a steady tick while a task runs
  // ---------------------------------------------------------------------------

  let lastFrame = "";
  let capturing = false;
  const sendFrame = async (): Promise<void> => {
    const taskId = store.state.activeTaskId ?? store.state.order[0];
    const tab = agent.tab;
    if (!taskId || !tab || clients.size === 0 || capturing) return;
    capturing = true;
    try {
      const image = await tab.screenshot();
      if (image.isEmpty()) return;
      const jpegBase64 = image
        .resize({ width: FRAME_WIDTH })
        .toJPEG(FRAME_QUALITY)
        .toString("base64");
      if (jpegBase64 === lastFrame) return;
      lastFrame = jpegBase64;
      for (const socket of clients) {
        if (socket.bufferedAmount < MAX_BUFFERED_BYTES)
          send(socket, { type: "frame", taskId, jpegBase64 });
      }
    } catch (error) {
      console.error("Companion frame capture failed:", error);
    } finally {
      capturing = false;
    }
  };

  const frameTimer = setInterval(() => {
    if (store.state.activeTaskId) void sendFrame();
  }, FRAME_INTERVAL_MS);

  const unsubscribe = store.subscribe((event) => {
    broadcast({ type: "event", event });
    if (event.kind === "step" && event.status !== "running") void sendFrame();
    if (event.kind === "task.finished" || event.kind === "task.status")
      void sendFrame();
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
        clients.add(socket);
        console.log(
          `📱 Companion connected: ${message.deviceName} (${request.socket.remoteAddress})`,
        );
        send(socket, { type: "snapshot", state: store.state });
        lastFrame = ""; // make sure the new client gets a frame
        void sendFrame();
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
      clients.delete(socket);
    });
    socket.on("error", (error) =>
      console.error("Companion socket error:", error),
    );
  });

  server.on("listening", () => printPairingCode(token));
  server.on("error", (error) =>
    console.error("Companion server error:", error),
  );

  return {
    stop() {
      clearInterval(frameTimer);
      unsubscribe();
      clients.forEach((socket) => socket.close(1001, "Shutting down"));
      server.close();
    },
  };
}

// Generated once and kept in userData, so a paired phone stays paired across restarts
function loadToken(): string {
  const file = join(app.getPath("userData"), "companion.json");
  if (existsSync(file)) {
    try {
      const { token } = JSON.parse(readFileSync(file, "utf8"));
      if (typeof token === "string" && token.length > 0) return token;
    } catch {
      // fall through and regenerate
    }
  }
  const token = randomBytes(24).toString("base64url");
  writeFileSync(file, JSON.stringify({ token }, null, 2));
  return token;
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

function printPairingCode(token: string): void {
  const host = lanAddress();
  const url = `blueberry://pair?host=${host}&port=${PORT}&token=${token}`;
  console.log(`\n🫐 Blueberry Companion listening on ws://${host}:${PORT}`);
  console.log("   Scan this with the Blueberry Companion app:\n");
  qrcode.generate(url, { small: true });
  console.log(`   ${url}\n`);
}
