# Build Plan — Blueberry Companion

Step-by-step plan for [ARCHITECTURE.md](./ARCHITECTURE.md). Every step ends with
a **Done when** check you can verify before moving on, plus one commit.
Rough times add up to ~8h. Phases 0–2 are the foundation, 3–4 are the
product, 5 is polish. Runs in Expo Go, no push notifications.

---

## Phase 0 — Workspace setup (~30 min)

### 0.1 Turn the repo into a pnpm workspace
- Add `pnpm-workspace.yaml` with `packages: ["packages/*", "apps/*"]`.
  The root stays the Electron app.
- Add `.npmrc` with `node-linker=hoisted` (Metro is happiest with this).
- `pnpm install`, then `pnpm dev`.

**Done when:** the browser still starts and the chat still works, i.e. nothing regressed.

### 0.2 Create `packages/protocol`
- `package.json` named `@blueberry/protocol` with `"main": "src/index.ts"`
  (consumed as TS source, no build step) and `zod` as a dependency.
- Add `"@blueberry/protocol": "workspace:*"` to the root `package.json`.
- In `electron.vite.config.ts`, make the main build **bundle** it instead of
  treating it as an external dependency:
  `externalizeDepsPlugin({ exclude: ["@blueberry/protocol"] })`.
  Otherwise Electron tries to `require` raw `.ts` at runtime.

**Done when:** a dummy `export const PING = "pong"` imported in `src/main/index.ts`
logs at startup.

---

## Phase 1 — Protocol (~45 min)

### 1.1 Schemas — `packages/protocol/src/messages.ts`
- zod schemas for `ClientMessage`, `ServerMessage`, `AgentEvent`, `Task`,
  `Step`, `Approval`, `AgentState` (exactly as in ARCHITECTURE §3).
- Export inferred types and `parseClientMessage(raw)` / `parseServerMessage(raw)`
  helpers that return `{ ok, data | error }`.

### 1.2 Reducer — `packages/protocol/src/reducer.ts`
- `initialState`, `reduce(state, event)`. Pure, no mutation.
- `AgentState = { tasks: Record<id, Task>; order: id[]; activeTaskId: id | null }`
  where `Task` holds `steps[]`, `messages[]` (agent + user, in order) and
  `pendingApproval | null`.

### 1.3 Reducer tests
- `vitest` in the package: create → steps → approval requested/resolved →
  finished. Also check that unknown task ids are ignored and don't throw.

**Done when:** `pnpm --filter @blueberry/protocol test` passes.

---

## Phase 2 — Desktop agent + server (~2.5h)

### 2.1 Event plumbing — `src/main/companion/state.ts`
- Tiny store: `state = reduce(state, event)` and notify listeners.
  That's the authoritative snapshot plus a subscribe function. ~30 lines.

### 2.2 Page scripts — `src/main/companion/pageScripts.ts`
- `READ_PAGE`: walk visible `a, button, input, select, textarea, [role=button],
  [onclick]`, assign `data-bb-ref`, return
  `{ url, title, elements: "[3] button \"Add to cart\"" lines, text: first ~3000 chars }`.
- `CLICK(ref)`, `TYPE(ref, text, submit)` as functions that build script strings.
  `TYPE` uses the native value setter + `input`/`change` events so React sites notice.
- `IS_SENSITIVE_SUBMIT(ref)`: is it a submit control inside a form with a
  password or payment field?

**Done when:** in `pnpm dev`, running the script on Google from a temporary dev
hook prints a sensible element list.

### 2.3 Agent — `src/main/companion/agent.ts`
- `class Agent { start(prompt, startUrl?), cancel(), message(text), respondApproval(id, ok, note) }`.
- `start`: refuse if busy → `window.createTab(startUrl ?? "https://www.google.com")`
  → `window.switchActiveTab` (so it's visible on the laptop during the demo) →
  run the loop.
- Loop: `streamText({ model, system, messages, tools, stopWhen: stepCountIs(25), abortSignal })`.
  Emit `step` events from each tool's `execute` (start + finish), and `text` for
  assistant text.
- `ask_user` + the sensitive-submit guard in `click` both go through
  `awaitApproval(question)`. It emits `approval.requested`, status `waiting`,
  and returns a promise kept in a `Map<approvalId, resolve>`.
- Steering: append `{ role: "user" }` to history. If the loop already ended,
  start another loop with the same history.
- Model: read `LLM_PROVIDER`/`LLM_MODEL` from `.env` like `LLMClient`, defaulting
  to a current Claude model.

### 2.4 Server — `src/main/companion/server.ts`
- `pnpm add ws qrcode-terminal` (+ `@types/ws`).
- Token: load or create `userData/companion.json` (`{ token }`).
- On listen: find the LAN IPv4 with `os.networkInterfaces()`, print the QR code
  for `blueberry://pair?host=…&port=47800&token=…`.
- Per socket: 3s hello timeout → validate token → send
  `snapshot` → subscribe to state events → route parsed client messages to `Agent`.
- Frames: after every `step` finish event, `capturePage` → resize 480 → JPEG 60 →
  send if `bufferedAmount < 1MB`.

### 2.5 Wire up — `src/main/index.ts`
- After `createWindow()`: `startCompanion(mainWindow)`. That's the only edit to
  existing files.

### 2.6 Test without the app — `scripts/ws-client.mjs`
- Node script: connect, hello, `task.start "search for blueberries on wikipedia"`,
  log every message (frames as byte counts), auto-approve approvals.

**Done when:** the script drives a full task. The agent tab moves on the laptop,
steps stream into the terminal, and the task finishes with a summary. Also test
an approval with the cart flow.

---

## Phase 3 — Expo Go skeleton + connection (~1.5h)

### 3.1 Scaffold
- `cd apps && npx create-expo-app@latest companion` (default template: Router + TS).
- Add deps with `npx expo install` (it picks SDK-compatible versions):
  `expo-camera expo-secure-store expo-haptics`, plus `zustand` and
  `@blueberry/protocol` (workspace).
- Check that the scaffolded SDK version matches the Expo Go app on your phone.
  If they don't match, update Expo Go.
- Strip the template's example screens.
- `npx expo start`, then scan with Expo Go. Phone and laptop on the same Wi-Fi.
  If Metro can't be reached, use `--tunnel`. That only affects the Metro
  connection, not the agent WebSocket, which still needs the LAN.

**Done when:** Expo Go opens a blank home screen on the phone and imports from
`@blueberry/protocol` resolve.

### 3.2 Store — `lib/store.ts`
- zustand: `{ conn: "idle" | "connecting" | "open" | "offline", agent: AgentState,
  frames: Record<taskId, string>, apply(msg), send(msg) }`.
- `apply` handles `snapshot` (replace), `event` (`reduce`), `frame` (overwrite).

### 3.3 Connection — `lib/connection.ts`
- `connect({ host, port, token })`: WebSocket → `hello` → set `open`.
  Validate incoming messages with `parseServerMessage`.
- Backoff (1s → 2s → 5s → 10s cap) while the app is active. `AppState` listener:
  active → connect, background → close.
- `send()` is a no-op that returns `false` when not open, so the UI disables
  actions instead of queueing.

### 3.4 Pair screen — `app/pair.tsx`
- `CameraView` with barcode scanning → parse `blueberry://pair?...` → save to
  secure store → connect → success haptic → `router.replace("/")`.
- `_layout.tsx`: if nothing is saved, redirect to `/pair`. Otherwise auto-connect.
- Pairing is in-app only. A custom URL scheme can't open Expo Go, so the
  QR code payload is just data that the app parses.
- First connect on iOS triggers the Local Network permission prompt. Allow it.

**Done when:** scanning the terminal QR connects. A temporary `<Text>` shows
`open` and the task count from the snapshot.

---

## Phase 4 — Core screens (~2h)

### 4.1 Tasks screen — `app/index.tsx`
- `ConnectionPill` in the header.
- Active task card pinned at the top: prompt, current step summary, small live frame.
- History list below (status icon, prompt, finished summary).
- Composer at the bottom → `task.start` → navigate to `/task/<id>` when
  `task.created` arrives.
- Empty state: 3 suggested prompts (the demo flows) as tappable chips.

### 4.2 Live task screen — `app/task/[id].tsx`
- `LiveFrame` on top (16:10, tap for full screen).
- `StepTimeline`: steps with icons per tool, with agent/user messages interleaved.
  Auto-scroll to the latest.
- Input bar → `task.message`. Cancel in the header → `task.cancel` (confirm first).
- When finished: a summary card replaces the input bar.

### 4.3 Approval modal — `app/approval/[id].tsx`
- Expo Router `presentation: "modal"` (or formSheet).
- Question, latest frame, optional note, big Approve / Deny → `approval.respond`
  → haptic → dismiss.
- Global watcher in `_layout.tsx`: when a new `pendingApproval` shows up
  (live event **or** in a snapshot after coming back from the background),
  push the modal route with a warning haptic.
- Tasks list: "Needs you" badge on a task waiting for approval.
- The desktop agent just waits on a pending approval. No timeout for the demo.

**Done when:** demo flow 1 runs end to end from the phone: start → watch →
approve checkout → summary. Also: background the app during the task, reopen it,
and the approval modal shows up right away.

---

## Phase 5 — Polish, then stretch goals (rest of the time)

Polish (do all of these before any stretch goal):
- [ ] `LiveFrame` cross-fade between frames (two stacked `Image`s, Reanimated opacity).
- [ ] Steps animate in (`Animated.View` with `entering={FadeInDown}`). The running step pulses.
- [ ] Haptics: light on send, success on finish, warning on approval needed.
- [ ] Error states: agent busy, task failed, desktop unreachable (with "re-pair" action).
- [ ] Blueberry color palette + typography throughout (Expo Go shows its own icon/splash, so put the brand in the UI instead).
- [ ] Dark mode.

Stretch goals, in order:
1. **Tap-to-point**: tap the live frame → send normalized `{x, y}` → desktop
   `sendInputEvent` click. That needs one new client message and one handler on
   the desktop. It's very demoable.
2. Quick replies: `ask_user` takes optional `suggestions[]`, shown as chips in the modal.
3. Saved prompts in secure store / AsyncStorage, shown on the empty state.
4. Full-screen pinch-zoom live view.

---

## Phase 6 — Submission (~45 min)

- [ ] README section: what it is, how to run desktop + companion, architecture
      diagram, link to ARCHITECTURE.md.
- [ ] Practice both demo flows 3× each. Fix whatever breaks.
- [ ] Record ~2 min: the problem (10s) → demo flow with the phone in hand and
      the laptop visible (60s) → architecture and decisions (30s) → the code
      you're proudest of, i.e. the shared reducer or the approval round-trip (20s).
- [ ] Push to GitHub, send the repo link + video.

---

## Cut list if time runs short
Cut from the bottom up: stretch goals → dark mode/icon → steering mid-run →
the sensitive-submit guard (keep only `ask_user`) → background/foreground approval recovery.
**Never cut:** pairing, live frames, the approval flow. Those are the demo.
