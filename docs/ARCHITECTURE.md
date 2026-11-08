# Blueberry Companion — Architecture

**Pitch:** Strawberry assumes you're sitting at your computer. Agent tasks take
minutes, so the agent should be able to reach you wherever you are. Blueberry
Companion is an Expo app that lets you start browser tasks from your phone,
watch them run live, steer them, and approve risky steps. It runs in **Expo Go**,
so there's no native build and no push notifications.

**Principle:** the Expo app is the product. The desktop side is the thinnest
possible agent plus a server, added **next to** the existing code and not
mixed into it.

## 1. Big picture

```
┌──────────────── Electron main (existing app, untouched) ────────────────┐
│                                                                         │
│   Window / Tab  ◄── createTab, loadURL, runJs, capturePage, sendInput   │
│        ▲                                                                │
│   ┌────┴──────────────── new: src/main/companion/ ───────────────────┐  │
│   │ agent.ts   streamText + tools, runs in its own agent tab         │  │
│   │ server.ts  ws server: pairing, snapshot, events, frames          │  │
│   └──────────────────────────────┬───────────────────────────────────┘  │
└──────────────────────────────────┼──────────────────────────────────────┘
                                   │ ws:// over LAN
                                   ▼
                    ┌────── apps/companion (Expo Go) ───────┐
                    │ pair · tasks · live task · approvals  │
                    └───────────────────────────────────────┘
          both sides share packages/protocol (zod schemas + reducer)
```

## 2. Repo layout

```
blueberry-browser/
├── src/main/companion/        # NEW — the only desktop additions
│   ├── agent.ts               # ~200 lines
│   ├── pageScripts.ts         # injected JS for read_page / element refs
│   └── server.ts              # ~150 lines
├── src/main/index.ts          # + a few lines to start the server
├── packages/protocol/         # NEW — shared types, schemas, reducer
├── apps/companion/            # NEW — the Expo app (the focus)
└── pnpm-workspace.yaml
```

Not changed: the sidebar, `LLMClient`, IPC/preload, topbar, layout code.
(pnpm isolated installs, so the Expo app's React 19.3 and the renderer's React 19.1 never mix.)

## 3. Protocol (`packages/protocol`)

One source of truth: zod schemas with inferred types, validated at the
socket boundary on both sides.

```ts
// phone → desktop
type ClientMessage =
  | { type: "hello"; token: string; deviceName: string }
  | { type: "task.start"; prompt: string; startUrl?: string }
  | { type: "task.cancel"; taskId: string }
  | { type: "task.message"; taskId: string; text: string }          // steer mid-run
  | { type: "approval.respond"; approvalId: string; approved: boolean; note?: string };

// desktop → phone
type ServerMessage =
  | { type: "snapshot"; state: AgentState }                           // on every connect
  | { type: "event"; event: AgentEvent }
  | { type: "frame"; taskId: string; jpegBase64: string };            // latest wins, not stored

type AgentEvent =
  | { kind: "task.created";  task: { id: string; prompt: string; createdAt: number } }
  | { kind: "task.status";   taskId: string; status: "running" | "waiting" | "done" | "failed" | "cancelled" }
  | { kind: "step";          taskId: string; stepId: string; tool: string; summary: string; ok?: boolean }
  | { kind: "text";          taskId: string; text: string }           // agent's message to the user
  | { kind: "user.message";  taskId: string; text: string }
  | { kind: "approval.requested"; taskId: string; approvalId: string; question: string }
  | { kind: "approval.resolved";  taskId: string; approvalId: string; approved: boolean }
  | { kind: "task.finished"; taskId: string; summary: string };
```

`reduce(state, event) => state` lives here too. The desktop uses it to keep the
snapshot. The app uses it as its store logic.

Reconnect has no replay: the server sends a full `snapshot` on every connect.
State is small (a few tasks with their steps), so this is simpler and correct.

## 4. Desktop: the minimum

### `agent.ts`

- One task at a time. `task.start` while one is running → reply with an error event.
- Opens its **own tab** via the existing `window.createTab(url)`, so the user
  can keep browsing.
- AI SDK `streamText` with `stopWhen: stepCountIs(25)` and an `AbortController`
  for cancel.
- Steering: `task.message` is pushed onto the message history and picked up
  on the next step.

| Tool | Implementation |
|---|---|
| `navigate(url)` | `tab.loadURL` |
| `read_page()` | injected script tags visible interactive elements `data-bb-ref` and returns `[ref] role "name"` + trimmed text |
| `click(ref)` | `tab.runJs` → scroll into view + `.click()` (upgrade to `sendInputEvent` if a site needs it) |
| `type(ref, text, submit?)` | `tab.runJs` → set value + dispatch `input`/`change`, optional Enter |
| `ask_user(question)` | emits `approval.requested`, awaits the phone's answer, returns it as the tool result |
| `finish(summary)` | ends the task |

**Approvals:** the system prompt tells the model to call `ask_user` before any
irreversible action (submitting, purchasing, sending). There's one hard-coded
safety net in `click`: if the target is a submit button in a form containing a
password or payment field, ask first regardless. That's a few lines, not a
policy engine.

### `server.ts`

- `ws` on `0.0.0.0:47800`. On startup it prints a QR code to the terminal
  (`qrcode-terminal`) with `blueberry://pair?host=<lan-ip>&port=47800&token=<token>`.
- Token: random, generated once and saved in `userData`. Any socket that doesn't send a
  valid `hello` within 3s gets closed.
- After each agent step: `capturePage()` → `resize({ width: 480 })` → `toJPEG(60)` → `frame`.
  Skipped if the socket's `bufferedAmount` is high.

## 5. Companion app (the focus)

**Stack:** Expo SDK (latest), Expo Router, TypeScript, zustand (state = protocol
reducer), Reanimated, `expo-camera`, `expo-haptics`, `expo-secure-store`.

**Expo Go constraints:** only libraries that ship in Expo Go (everything above
does). The project's SDK must match the Expo Go version on the phone, so scaffold
with `create-expo-app@latest`. A custom `blueberry://` URL scheme won't open the
app, so pairing only works through the in-app scanner. Phone and laptop must be
on the same Wi-Fi network. iOS will ask for Local Network permission the first time.

```
apps/companion/
├── app/
│   ├── _layout.tsx         # connection lifecycle, approval watcher
│   ├── pair.tsx            # QR scan → save host/token → connect
│   ├── index.tsx           # tasks list + composer ("What should Blueberry do?")
│   ├── task/[id].tsx       # live view
│   └── approval/[id].tsx   # modal route
├── lib/
│   ├── connection.ts       # ws client, hello, backoff, AppState-aware
│   └── store.ts            # zustand wrapping protocol reducer + latest frames
└── components/
    ├── LiveFrame.tsx       # cross-fades between frames
    ├── StepTimeline.tsx    # steps animate in, running step pulses
    ├── ApprovalSheet.tsx
    └── ConnectionPill.tsx  # connected / reconnecting / offline
```

### Screens

1. **Pair**: in-app camera scans the QR code, credentials go into secure store, then it
   connects. A "Connected to Konstantin's MacBook" confirmation with a success haptic.
2. **Tasks**: running task pinned at the top with its live thumbnail, then
   history. Composer at the bottom, with suggested prompts as an empty state.
3. **Live task**: big live frame on top. Step timeline below ("Opened
   amazon.se", "Searching for 'usb-c cable'", "Clicking 'Add to cart'…").
   Agent messages inline. Input bar to steer ("pick the cheaper one"). Cancel
   button.
4. **Approval** (modal): question, latest frame, big Approve / Deny, optional
   note. Opens automatically when an approval comes in. If the app was in the
   background, it opens right after reconnecting, since the snapshot carries
   `pendingApproval`. The tasks list also shows a "Needs you" badge.

### Connection behavior

- `AppState` `active` → connect (snapshot brings it up to date). `background`
  → close. iOS would kill the socket anyway. The agent just waits on a pending
  approval until you come back.
- Exponential backoff while active. `ConnectionPill` always shows the state.
- Commands sent while offline are blocked in the UI, not queued. That's simpler
  and honest.

### Stretch goals (in order)

All of these work in Expo Go.

1. **Tap-to-point**: tap on the live frame to tell the agent "click here".
   The app sends normalized coordinates and the desktop uses `sendInputEvent`.
2. Quick replies: the agent suggests 2–3 answers with `ask_user`, shown as chips.
3. Saved prompts: reusable tasks stored on the phone.
4. Full-screen pinch-zoom live view.

## 6. Demo flows (make these reliable, not general)

1. "Find a USB-C cable under 100 kr and add it to the cart". Ends with an
   approval before checkout, answered from the phone.
2. "Fill in this signup form with my details". Steer mid-run from the phone.

## 7. Not building (talking points)

- **Off-LAN access**: a relay (e.g. Cloudflare Durable Object) that both sides
  connect outward to, with E2E encryption using keys exchanged in the QR code.
  The protocol carries no transport assumptions.
- **Push notifications + native build**: a dev build with `expo-notifications`,
  and the desktop POSTing to the Expo push API when an approval is pending and
  no phone is connected. That's the step that makes "walk away from your laptop"
  real. The protocol doesn't need to change for it.
- Multiple tasks at once, a sidebar UI for agent tasks, a full approval policy engine.

## 8. Build order

1. `packages/protocol`: schemas + reducer. *(~30 min)*
2. Desktop `agent.ts` + `server.ts`, tested with a tiny node ws script. *(~2.5 h)*
3. Expo: connection + store + pair + tasks + live task. *(~3 h)*
4. Approval modal + background/foreground handling. *(~45 min)*
5. Polish: animations, haptics, empty states, then stretch goals. *(rest)*
