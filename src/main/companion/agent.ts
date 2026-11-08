import { randomUUID } from "crypto";
import {
  hasToolCall,
  stepCountIs,
  streamText,
  tool,
  type LanguageModel,
  type ModelMessage,
  type ToolSet,
} from "ai";
import { z } from "zod";
import { createModel } from "../llm";
import type { Window } from "../Window";
import type { Tab } from "../Tab";
import type { CompanionStore } from "./store";
import * as page from "./pageScripts";

const MAX_STEPS = 30;
const MAX_CONCURRENT_TASKS = 4;
const LOAD_TIMEOUT_MS = 10_000;
const DEFAULT_START_URL = "https://www.google.com";

const SYSTEM_PROMPT = `You are Blueberry, a browser agent. You control one browser tab to complete the user's task.
The user is watching from their phone and may send you messages while you work.

How to work:
- Call read_page to see the page. Elements are listed as [ref] role "name". Use those refs with click and type.
- Refs change after every navigation or page update. Call read_page again before acting on a new page.
- Prefer navigating directly to a URL when you know it (e.g. a search results URL).
- Dismiss cookie banners and popups first (accept or close), since they block the page.
- Keep moving. Don't explain every step; short notes for the user are fine.
- Before anything irreversible (buying, paying, sending, submitting personal data, deleting), call ask_user and wait.
- If the user denies something, don't try to work around it. Adapt or ask what they want.
- When done, call finish with a short summary of what you did and the result.`;

interface Approval {
  taskId: string;
  resolve: (answer: { approved: boolean; note?: string }) => void;
}

interface Session {
  taskId: string;
  tab: Tab;
  messages: ModelMessage[];
  abort: AbortController | null;
  // Messages the user sent while the loop was running, delivered with the next tool result
  inbox: string[];
}

// Runs any number of tasks side by side, each in its own tab
export class Agent {
  private sessions = new Map<string, Session>();
  private approvals = new Map<string, Approval>();
  private readonly model: LanguageModel | null = createModel()?.model ?? null;

  constructor(
    private readonly window: Window,
    private readonly store: CompanionStore,
  ) {}

  // Tabs of tasks that are working right now, for live frames
  runningTabs(): { taskId: string; tab: Tab }[] {
    return [...this.sessions.values()]
      .filter((session) => session.abort !== null && isAlive(session.tab))
      .map(({ taskId, tab }) => ({ taskId, tab }));
  }

  tabFor(taskId: string): Tab | null {
    const tab = this.sessions.get(taskId)?.tab;
    return tab && isAlive(tab) ? tab : null;
  }

  start(prompt: string, startUrl?: string): void {
    if (!this.model)
      throw new Error("No LLM API key configured on the desktop (.env).");
    if (this.runningTabs().length >= MAX_CONCURRENT_TASKS)
      throw new Error(
        `Blueberry can run ${MAX_CONCURRENT_TASKS} tasks at once. Wait for one to finish.`,
      );

    const taskId = randomUUID();
    const session: Session = {
      taskId,
      tab: this.openTab(startUrl ?? DEFAULT_START_URL),
      messages: [{ role: "user", content: prompt }],
      abort: null,
      inbox: [],
    };
    this.sessions.set(taskId, session);
    this.store.emit({
      kind: "task.created",
      task: { id: taskId, prompt, createdAt: Date.now() },
    });
    void this.run(session);
  }

  message(taskId: string, text: string): void {
    const session = this.requireSession(taskId);
    this.store.emit({ kind: "user.message", taskId, id: randomUUID(), text });

    if (session.abort) {
      session.inbox.push(text);
      return;
    }
    // Follow-up on a finished task: continue the same conversation in the same tab
    if (!isAlive(session.tab)) session.tab = this.openTab(DEFAULT_START_URL);
    session.messages.push({ role: "user", content: text });
    this.store.emit({ kind: "task.status", taskId, status: "running" });
    void this.run(session);
  }

  cancel(taskId: string): void {
    const session = this.requireSession(taskId);
    session.abort?.abort();
    for (const [id, approval] of this.approvals) {
      if (approval.taskId === taskId)
        this.respondApproval(id, false, "Task cancelled");
    }
  }

  respondApproval(approvalId: string, approved: boolean, note?: string): void {
    const approval = this.approvals.get(approvalId);
    if (!approval) return;
    this.approvals.delete(approvalId);
    this.store.emit({
      kind: "approval.resolved",
      taskId: approval.taskId,
      approvalId,
      approved,
    });
    approval.resolve({ approved, note });
  }

  // ---------------------------------------------------------------------------
  // Loop
  // ---------------------------------------------------------------------------

  private async run(session: Session): Promise<void> {
    const { taskId } = session;
    const abort = new AbortController();
    session.abort = abort;
    let finishedWith: string | null = null;
    let lastText = "";

    try {
      const result = streamText({
        model: this.model!,
        system: SYSTEM_PROMPT,
        messages: session.messages,
        tools: this.buildTools(session, (summary) => (finishedWith = summary)),
        stopWhen: [stepCountIs(MAX_STEPS), hasToolCall("finish")],
        abortSignal: abort.signal,
      });

      // Stream the model's notes to the phone as they're written. Provider text
      // ids repeat across steps, so each text block gets its own id here.
      let textId = "";
      for await (const part of result.fullStream) {
        if (part.type === "text-start") {
          textId = randomUUID();
          lastText = "";
        } else if (part.type === "text-delta") {
          lastText += part.text;
          this.store.emit({ kind: "text", taskId, id: textId, text: lastText });
        } else if (part.type === "error") {
          throw part.error;
        }
      }
      // An aborted stream can end quietly instead of throwing
      if (abort.signal.aborted) throw new Error("Cancelled");

      session.messages.push(...(await result.response).messages);
    } catch (error) {
      session.abort = null;
      if (abort.signal.aborted) {
        this.store.emit({ kind: "task.status", taskId, status: "cancelled" });
      } else {
        console.error("Companion agent failed:", error);
        this.store.emit({
          kind: "text",
          taskId,
          id: randomUUID(),
          text: `Something went wrong: ${error instanceof Error ? error.message : String(error)}`,
        });
        this.store.emit({ kind: "task.status", taskId, status: "failed" });
      }
      return;
    }

    session.abort = null;

    // The user said something after the last tool call; keep going instead of stopping
    if (session.inbox.length > 0 && finishedWith === null) {
      session.messages.push({
        role: "user",
        content: session.inbox.splice(0).join("\n"),
      });
      return this.run(session);
    }

    this.store.emit({
      kind: "task.finished",
      taskId,
      summary: finishedWith ?? (lastText || "Stopped without a summary."),
    });
  }

  private buildTools(
    session: Session,
    onFinish: (summary: string) => void,
  ): ToolSet {
    const { taskId } = session;

    // Wraps a tool so every call shows up as a step on the phone, and any
    // messages the user sent meanwhile ride along with the result.
    const step = async (
      tool: string,
      summary: string,
      fn: () => Promise<{ result: string; summary?: string }>,
    ): Promise<string> => {
      const stepId = randomUUID();
      this.store.emit({
        kind: "step",
        taskId,
        stepId,
        tool,
        summary,
        status: "running",
      });
      try {
        const out = await fn();
        this.store.emit({
          kind: "step",
          taskId,
          stepId,
          tool,
          summary: out.summary ?? summary,
          status: "ok",
        });
        return this.withInbox(session, out.result);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.store.emit({
          kind: "step",
          taskId,
          stepId,
          tool,
          summary: `${summary} — failed`,
          status: "error",
        });
        return this.withInbox(session, `Error: ${message}`);
      }
    };

    const tab = (): Tab => {
      if (!isAlive(session.tab)) throw new Error("The agent's tab was closed.");
      return session.tab;
    };

    const run = async <T>(script: string): Promise<T> =>
      tab().runJs(script) as Promise<T>;

    const act = async (script: string): Promise<page.ElementResult> => {
      const out = await run<page.ElementResult>(script);
      if (!out.ok) throw new Error(out.error);
      return out;
    };

    // Returns a refusal message if the user denied, null if allowed to proceed
    const guard = async (
      ref: number,
      action: "click" | "type",
      what: string,
    ): Promise<string | null> => {
      const reason = await run<string | null>(
        page.sensitiveReason(ref, action),
      );
      if (!reason) return null;
      const answer = await this.askUser(taskId, `${what}? ${reason}.`);
      return answer.approved
        ? null
        : `The user denied this action.${answer.note ? ` Note: ${answer.note}` : ""}`;
    };

    return {
      navigate: tool({
        description: "Open a URL in the tab.",
        inputSchema: z.object({ url: z.string().describe("Absolute URL") }),
        execute: ({ url }) =>
          step("navigate", `Opening ${hostOf(url)}`, async () => {
            await tab()
              .loadURL(url)
              .catch(() => {}); // aborted loads still land somewhere
            await settle(tab());
            return { result: `Now on ${tab().url}` };
          }),
      }),

      read_page: tool({
        description:
          "Read the current page: URL, title, interactive elements with refs, and visible text.",
        inputSchema: z.object({}),
        execute: () =>
          step("read_page", "Reading the page", async () => {
            const snap = await run<page.PageSnapshot>(page.READ_PAGE);
            return {
              summary: `Read ${snap.title || hostOf(snap.url)}`,
              result: `URL: ${snap.url}\nTitle: ${snap.title}\n\nElements:\n${snap.elements || "(none)"}\n\nText:\n${snap.text}`,
            };
          }),
      }),

      click: tool({
        description: "Click an element by ref from read_page.",
        inputSchema: z.object({
          ref: z.number().int(),
          label: z
            .string()
            .describe(
              "Short human description of what you're clicking, e.g. 'Add to cart'",
            ),
        }),
        execute: ({ ref, label }) =>
          step("click", `Clicking “${label}”`, async () => {
            const denied = await guard(ref, "click", `Click “${label}”`);
            if (denied)
              return { result: denied, summary: `Skipped “${label}”` };
            await act(page.click(ref));
            await settle(tab());
            return {
              result: `Clicked. Now on ${tab().url}. Call read_page to see the result.`,
            };
          }),
      }),

      type: tool({
        description:
          "Type into an input, textarea or select (by ref). Replaces existing content.",
        inputSchema: z.object({
          ref: z.number().int(),
          text: z
            .string()
            .describe("Text to type, or the option label for a select"),
          submit: z.boolean().optional().describe("Press Enter afterwards"),
        }),
        execute: ({ ref, text, submit }) =>
          step("type", `Typing “${truncate(text, 40)}”`, async () => {
            const denied = await guard(ref, "type", "Type into this field");
            if (denied) return { result: denied, summary: "Skipped typing" };
            const target = await act(page.focusForTyping(ref));
            if (target.ok && target.kind === "select") {
              await act(page.selectOption(ref, text));
            } else {
              // Real input events, so React/Vue-controlled inputs pick up the value
              tab().webContents.insertText(text);
            }
            if (submit) {
              pressEnter(tab());
              await settle(tab());
            }
            return {
              result: submit
                ? `Typed and submitted. Now on ${tab().url}.`
                : "Typed.",
            };
          }),
      }),

      scroll: tool({
        description: "Scroll the page up or down by most of a screen.",
        inputSchema: z.object({ direction: z.enum(["up", "down"]) }),
        execute: ({ direction }) =>
          step("scroll", `Scrolling ${direction}`, async () => {
            await run(page.scroll(direction));
            await delay(300);
            return {
              result: "Scrolled. Call read_page to see what's visible now.",
            };
          }),
      }),

      ask_user: tool({
        description:
          "Ask the user to approve an action or answer a question. Blocks until they respond from their phone.",
        inputSchema: z.object({ question: z.string() }),
        execute: ({ question }) =>
          step("ask_user", "Waiting for you", async () => {
            const { approved, note } = await this.askUser(taskId, question);
            return {
              summary: approved ? "You approved" : "You declined",
              result: `${approved ? "Approved" : "Denied"}.${note ? ` The user said: ${note}` : ""}`,
            };
          }),
      }),

      finish: tool({
        description: "End the task with a short summary for the user.",
        inputSchema: z.object({ summary: z.string() }),
        execute: async ({ summary }) => {
          onFinish(summary);
          return "Done.";
        },
      }),
    };
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private askUser(
    taskId: string,
    question: string,
  ): Promise<{ approved: boolean; note?: string }> {
    const id = randomUUID();
    return new Promise((resolve) => {
      this.approvals.set(id, { taskId, resolve });
      this.store.emit({
        kind: "approval.requested",
        taskId,
        approval: { id, question },
      });
    });
  }

  private withInbox(session: Session, result: string): string {
    if (session.inbox.length === 0) return result;
    const messages = session.inbox
      .splice(0)
      .map((m) => `- ${m}`)
      .join("\n");
    return `${result}\n\n[New message from the user]\n${messages}`;
  }

  private openTab(url: string): Tab {
    const tab = this.window.createTab(url);
    this.window.switchActiveTab(tab.id);
    // Agent tabs keep working (and rendering frames) while another tab is in front
    tab.webContents.setBackgroundThrottling(false);
    // Keep popups and target=_blank inside the agent's tab
    tab.webContents.setWindowOpenHandler(({ url }) => {
      void tab.loadURL(url);
      return { action: "deny" };
    });
    return tab;
  }

  private requireSession(taskId: string): Session {
    const session = this.sessions.get(taskId);
    if (!session) throw new Error("That task isn't on this computer anymore.");
    return session;
  }
}

const isAlive = (tab: Tab): boolean => !tab.webContents.isDestroyed();

// Waits for any navigation the last action kicked off to finish
async function settle(tab: Tab): Promise<void> {
  await delay(400);
  const contents = tab.webContents;
  if (!contents.isLoading()) return;
  await new Promise<void>((resolve) => {
    const timer = setTimeout(done, LOAD_TIMEOUT_MS);
    contents.once("did-stop-loading", done);
    function done(): void {
      clearTimeout(timer);
      contents.removeListener("did-stop-loading", done);
      resolve();
    }
  });
  await delay(300);
}

function pressEnter(tab: Tab): void {
  const contents = tab.webContents;
  contents.sendInputEvent({ type: "keyDown", keyCode: "Return" });
  contents.sendInputEvent({ type: "char", keyCode: "\r" });
  contents.sendInputEvent({ type: "keyUp", keyCode: "Return" });
}

const delay = (ms: number): Promise<void> =>
  new Promise((r) => setTimeout(r, ms));

const truncate = (s: string, n: number): string =>
  s.length > n ? `${s.slice(0, n - 1)}…` : s;

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
