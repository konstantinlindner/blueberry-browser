// Drives the companion server from the terminal, without the phone app.
// Usage: node scripts/ws-client.mjs "<blueberry://pair?... url>" "<task prompt>" [--deny]
import WebSocket from "ws";

const [pairUrl, prompt, flag] = process.argv.slice(2);
if (!pairUrl || !prompt) {
  console.error('Usage: node scripts/ws-client.mjs "<pair url>" "<prompt>" [--deny]');
  process.exit(1);
}
const params = new URL(pairUrl.replace("blueberry://", "http://")).searchParams;
const socket = new WebSocket(`ws://${params.get("host")}:${params.get("port")}`);

socket.on("open", () => {
  socket.send(JSON.stringify({ type: "hello", token: params.get("token"), deviceName: "ws-client" }));
  socket.send(JSON.stringify({ type: "task.start", prompt }));
});

socket.on("message", (raw) => {
  const msg = JSON.parse(raw.toString());
  if (msg.type === "frame") return console.log(`  [frame ${Math.round(msg.jpegBase64.length / 1024)} KB]`);
  if (msg.type === "snapshot") return console.log(`snapshot: ${msg.state.order.length} task(s)`);
  if (msg.type === "error") return console.log(`ERROR: ${msg.message}`);

  const e = msg.event;
  switch (e.kind) {
    case "step":
      if (e.status !== "running") console.log(`${e.status === "ok" ? "✓" : "✗"} ${e.tool}: ${e.summary}`);
      break;
    case "text":
      break; // streamed; noisy
    case "approval.requested": {
      const approved = flag !== "--deny";
      console.log(`? ${e.approval.question} → ${approved ? "approving" : "denying"}`);
      socket.send(JSON.stringify({ type: "approval.respond", approvalId: e.approval.id, approved }));
      break;
    }
    case "task.finished":
      console.log(`\nDONE: ${e.summary}`);
      socket.close();
      break;
    case "task.status":
      console.log(`status: ${e.status}`);
      if (e.status === "failed" || e.status === "cancelled") socket.close();
      break;
    default:
      console.log(e.kind);
  }
});

socket.on("close", (code, reason) => {
  console.log(`closed ${code} ${reason}`);
  process.exit(0);
});
