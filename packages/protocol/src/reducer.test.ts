import { describe, expect, it } from "vitest";
import type { AgentEvent, AgentState } from "./messages";
import { parseClientMessage, parseServerMessage } from "./messages";
import { initialState, reduce } from "./reducer";

const run = (
  events: AgentEvent[],
  from: AgentState = initialState,
): AgentState => events.reduce(reduce, from);

const created: AgentEvent = {
  kind: "task.created",
  task: { id: "t1", prompt: "buy a cable", createdAt: 1 },
};

describe("reduce", () => {
  it("creates a running task, newest first, and marks it active", () => {
    const state = run([
      created,
      {
        kind: "task.created",
        task: { id: "t2", prompt: "second", createdAt: 2 },
      },
    ]);
    expect(state.order).toEqual(["t2", "t1"]);
    expect(state.activeTaskId).toBe("t2");
    expect(state.tasks.t1.status).toBe("running");
  });

  it("upserts steps by id so start and finish become one timeline item", () => {
    const state = run([
      created,
      {
        kind: "step",
        taskId: "t1",
        stepId: "s1",
        tool: "click",
        summary: "Clicking",
        status: "running",
      },
      { kind: "text", taskId: "t1", id: "m1", text: "Found it" },
      {
        kind: "step",
        taskId: "t1",
        stepId: "s1",
        tool: "click",
        summary: "Clicked",
        status: "ok",
      },
    ]);
    expect(state.tasks.t1.timeline).toEqual([
      {
        type: "step",
        id: "s1",
        tool: "click",
        summary: "Clicked",
        status: "ok",
      },
      { type: "agent", id: "m1", text: "Found it" },
    ]);
  });

  it("tracks an approval round trip", () => {
    const waiting = run([
      created,
      {
        kind: "approval.requested",
        taskId: "t1",
        approval: { id: "a1", question: "Checkout?" },
      },
    ]);
    expect(waiting.tasks.t1.status).toBe("waiting");
    expect(waiting.tasks.t1.pendingApproval).toEqual({
      id: "a1",
      question: "Checkout?",
    });

    const resolved = reduce(waiting, {
      kind: "approval.resolved",
      taskId: "t1",
      approvalId: "a1",
      approved: false,
    });
    expect(resolved.tasks.t1.status).toBe("running");
    expect(resolved.tasks.t1.pendingApproval).toBeNull();
    expect(resolved.tasks.t1.timeline).toEqual([
      { type: "approval", id: "a1", question: "Checkout?", approved: false },
    ]);
  });

  it("finishing clears the active task and any pending approval", () => {
    const state = run([
      created,
      {
        kind: "approval.requested",
        taskId: "t1",
        approval: { id: "a1", question: "?" },
      },
      { kind: "task.finished", taskId: "t1", summary: "Added to cart" },
    ]);
    expect(state.activeTaskId).toBeNull();
    expect(state.tasks.t1).toMatchObject({
      status: "done",
      summary: "Added to cart",
      pendingApproval: null,
    });
  });

  it("a follow-up makes a finished task active again", () => {
    const state = run([
      created,
      { kind: "task.finished", taskId: "t1", summary: "done" },
      { kind: "task.status", taskId: "t1", status: "running" },
    ]);
    expect(state.activeTaskId).toBe("t1");
  });

  it("ignores events for unknown tasks", () => {
    const before = run([created]);
    const after = reduce(before, {
      kind: "text",
      taskId: "nope",
      id: "m1",
      text: "hi",
    });
    expect(after).toBe(before);
  });

  it("does not mutate the previous state", () => {
    const before = run([created]);
    const snapshot = structuredClone(before);
    reduce(before, { kind: "text", taskId: "t1", id: "m1", text: "hi" });
    expect(before).toEqual(snapshot);
  });
});

describe("parsing", () => {
  it("accepts valid messages and rejects invalid ones", () => {
    expect(
      parseClientMessage(JSON.stringify({ type: "task.start", prompt: "go" }))
        .ok,
    ).toBe(true);
    expect(
      parseClientMessage(JSON.stringify({ type: "task.start", prompt: "" })).ok,
    ).toBe(false);
    expect(parseClientMessage("{nope").ok).toBe(false);
    expect(
      parseServerMessage(
        JSON.stringify({ type: "snapshot", state: initialState }),
      ).ok,
    ).toBe(true);
  });
});
