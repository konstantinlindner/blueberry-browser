// A fake desktop for working on the companion app without Electron or an LLM.
// Plays a scripted shopping task, including an approval before checkout.
// Usage: npx tsx scripts/mock-desktop.ts [path/to/frame.jpg ...]
import { randomUUID } from "crypto";
import { readFileSync } from "fs";
import { networkInterfaces } from "os";
import { WebSocketServer, type WebSocket } from "ws";
import {
  initialState,
  parseClientMessage,
  reduce,
  type AgentEvent,
  type ServerMessage,
} from "../packages/protocol/src/index";

const PORT = 47801;
const TOKEN = "mock";
const frames = process.argv
  .slice(2)
  .map((file) => readFileSync(file).toString("base64"));

let state = initialState;
const clients = new Set<WebSocket>();
const approvals = new Map<string, (approved: boolean) => void>();
let cancelled = false;

const send = (socket: WebSocket, message: ServerMessage): void =>
  socket.send(JSON.stringify(message));
const broadcast = (message: ServerMessage): void =>
  clients.forEach((s) => send(s, message));
const emit = (event: AgentEvent): void => {
  state = reduce(state, event);
  broadcast({ type: "event", event });
};
const sleep = (ms: number): Promise<void> =>
  new Promise((r) => setTimeout(r, ms));

let frameIndex = 0;
const sendFrame = (taskId: string): void => {
  if (frames.length === 0) return;
  broadcast({
    type: "frame",
    taskId,
    jpegBase64: frames[frameIndex++ % frames.length],
  });
};

async function step(
  taskId: string,
  tool: string,
  running: string,
  done = running,
): Promise<void> {
  if (cancelled) throw new Error("cancelled");
  const stepId = randomUUID();
  emit({
    kind: "step",
    taskId,
    stepId,
    tool,
    summary: running,
    status: "running",
  });
  await sleep(1200);
  emit({ kind: "step", taskId, stepId, tool, summary: done, status: "ok" });
  sendFrame(taskId);
}

async function say(taskId: string, text: string): Promise<void> {
  const id = randomUUID();
  // Stream it in like the real agent does
  for (let i = 8; i < text.length + 8; i += 8) {
    emit({ kind: "text", taskId, id, text: text.slice(0, i) });
    await sleep(40);
  }
}

function ask(taskId: string, question: string): Promise<boolean> {
  const id = randomUUID();
  emit({ kind: "approval.requested", taskId, approval: { id, question } });
  return new Promise((resolve) => approvals.set(id, resolve));
}

async function runTask(prompt: string): Promise<void> {
  cancelled = false;
  const taskId = randomUUID();
  emit({
    kind: "task.created",
    task: { id: taskId, prompt, createdAt: Date.now() },
  });
  try {
    await step(taskId, "navigate", "Opening webhallen.com");
    await step(taskId, "type", "Typing “usb-c kabel”");
    await step(
      taskId,
      "read_page",
      "Reading the page",
      "Read Sökresultat – Webhallen",
    );
    await say(
      taskId,
      "Found a few options. The Deltaco 1 m cable is 79 kr and well reviewed.",
    );
    await step(taskId, "click", "Clicking “Deltaco USB-C 1m”");
    await step(taskId, "click", "Clicking “Lägg i varukorg”");
    await step(taskId, "click", "Clicking “Till kassan”", "Waiting for you");
    const approved = await ask(
      taskId,
      "Click “Till kassan”? This looks like a purchase or checkout step.",
    );
    if (approved) {
      await step(
        taskId,
        "read_page",
        "Reading the page",
        "Read Kassa – Webhallen",
      );
      emit({
        kind: "task.finished",
        taskId,
        summary:
          "Added Deltaco USB-C 1 m (79 kr) to the cart and opened checkout.",
      });
    } else {
      await say(taskId, "Okay, I left it in the cart without checking out.");
      emit({
        kind: "task.finished",
        taskId,
        summary: "Added Deltaco USB-C 1 m (79 kr) to the cart.",
      });
    }
  } catch {
    emit({ kind: "task.status", taskId, status: "cancelled" });
  }
}

const server = new WebSocketServer({ port: PORT });
server.on("connection", (socket) => {
  let authed = false;
  socket.on("message", (data) => {
    const parsed = parseClientMessage(data.toString());
    if (!parsed.ok)
      return send(socket, { type: "error", message: parsed.error });
    const message = parsed.data;

    if (!authed) {
      if (message.type !== "hello" || message.token !== TOKEN)
        return socket.close(4003, "Invalid token");
      authed = true;
      clients.add(socket);
      console.log(`connected: ${message.deviceName}`);
      send(socket, { type: "snapshot", state });
      if (state.order[0]) sendFrame(state.order[0]);
      return;
    }

    switch (message.type) {
      case "task.start":
        if (state.activeTaskId)
          return send(socket, {
            type: "error",
            message: "The agent is already working on a task.",
          });
        void runTask(message.prompt);
        break;
      case "task.message":
        emit({
          kind: "user.message",
          taskId: message.taskId,
          id: randomUUID(),
          text: message.text,
        });
        void say(message.taskId, `Got it: “${message.text}”.`);
        break;
      case "task.cancel":
        cancelled = true;
        approvals.forEach((resolve) => resolve(false));
        break;
      case "approval.respond": {
        const resolve = approvals.get(message.approvalId);
        const task = Object.values(state.tasks).find(
          (t) => t.pendingApproval?.id === message.approvalId,
        );
        if (!resolve || !task) return;
        approvals.delete(message.approvalId);
        emit({
          kind: "approval.resolved",
          taskId: task.id,
          approvalId: message.approvalId,
          approved: message.approved,
        });
        resolve(message.approved);
        break;
      }
    }
  });
  socket.on("close", () => clients.delete(socket));
});

const host =
  Object.values(networkInterfaces())
    .flat()
    .find((a) => a && a.family === "IPv4" && !a.internal)?.address ??
  "127.0.0.1";
console.log(
  `Mock desktop: blueberry://pair?host=${host}&port=${PORT}&token=${TOKEN}`,
);
