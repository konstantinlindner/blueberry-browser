import { z } from "zod";

// ---------------------------------------------------------------------------
// State — what both the desktop and the phone hold, built by `reduce()`
// ---------------------------------------------------------------------------

export const TaskStatusSchema = z.enum([
  "running",
  "waiting",
  "done",
  "failed",
  "cancelled",
]);
export type TaskStatus = z.infer<typeof TaskStatusSchema>;

export const StepStatusSchema = z.enum(["running", "ok", "error"]);
export type StepStatus = z.infer<typeof StepStatusSchema>;

export const ApprovalSchema = z.object({
  id: z.string(),
  question: z.string(),
});
export type Approval = z.infer<typeof ApprovalSchema>;

// One ordered feed per task, so the UI renders steps and messages in the order they happened
export const TimelineItemSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("step"),
    id: z.string(),
    tool: z.string(),
    summary: z.string(),
    status: StepStatusSchema,
  }),
  z.object({ type: z.literal("agent"), id: z.string(), text: z.string() }),
  z.object({ type: z.literal("user"), id: z.string(), text: z.string() }),
  z.object({
    type: z.literal("approval"),
    id: z.string(),
    question: z.string(),
    approved: z.boolean().nullable(),
  }),
]);
export type TimelineItem = z.infer<typeof TimelineItemSchema>;

export const TaskSchema = z.object({
  id: z.string(),
  prompt: z.string(),
  createdAt: z.number(),
  status: TaskStatusSchema,
  timeline: z.array(TimelineItemSchema),
  pendingApproval: ApprovalSchema.nullable(),
  summary: z.string().nullable(),
});
export type Task = z.infer<typeof TaskSchema>;

export const AgentStateSchema = z.object({
  tasks: z.record(z.string(), TaskSchema),
  // Newest first. Several tasks can run at once; a task is running until its
  // status is terminal, so there's no single "active" task.
  order: z.array(z.string()),
});
export type AgentState = z.infer<typeof AgentStateSchema>;

// ---------------------------------------------------------------------------
// Events — desktop → clients, the only way state changes
// ---------------------------------------------------------------------------

export const AgentEventSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("task.created"),
    task: z.object({
      id: z.string(),
      prompt: z.string(),
      createdAt: z.number(),
    }),
  }),
  z.object({
    kind: z.literal("task.status"),
    taskId: z.string(),
    status: TaskStatusSchema,
  }),
  // Sent when a step starts and again when it finishes, upserted by stepId
  z.object({
    kind: z.literal("step"),
    taskId: z.string(),
    stepId: z.string(),
    tool: z.string(),
    summary: z.string(),
    status: StepStatusSchema,
  }),
  z.object({
    kind: z.literal("text"),
    taskId: z.string(),
    id: z.string(),
    text: z.string(),
  }),
  z.object({
    kind: z.literal("user.message"),
    taskId: z.string(),
    id: z.string(),
    text: z.string(),
  }),
  z.object({
    kind: z.literal("approval.requested"),
    taskId: z.string(),
    approval: ApprovalSchema,
  }),
  z.object({
    kind: z.literal("approval.resolved"),
    taskId: z.string(),
    approvalId: z.string(),
    approved: z.boolean(),
  }),
  z.object({
    kind: z.literal("task.finished"),
    taskId: z.string(),
    summary: z.string(),
  }),
]);
export type AgentEvent = z.infer<typeof AgentEventSchema>;

// ---------------------------------------------------------------------------
// Wire messages
// ---------------------------------------------------------------------------

export const ClientMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("hello"),
    token: z.string(),
    deviceName: z.string(),
  }),
  z.object({
    type: z.literal("task.start"),
    prompt: z.string().min(1),
    startUrl: z.string().optional(),
  }),
  z.object({ type: z.literal("task.cancel"), taskId: z.string() }),
  z.object({
    type: z.literal("task.message"),
    taskId: z.string(),
    text: z.string().min(1),
  }),
  z.object({
    type: z.literal("approval.respond"),
    approvalId: z.string(),
    approved: z.boolean(),
    note: z.string().optional(),
  }),
]);
export type ClientMessage = z.infer<typeof ClientMessageSchema>;

export const ServerMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("snapshot"),
    state: AgentStateSchema,
    desktop: z.object({ name: z.string() }),
  }),
  z.object({ type: z.literal("event"), event: AgentEventSchema }),
  // Latest frame wins; never part of state
  z.object({
    type: z.literal("frame"),
    taskId: z.string(),
    jpegBase64: z.string(),
  }),
  z.object({ type: z.literal("error"), message: z.string() }),
]);
export type ServerMessage = z.infer<typeof ServerMessageSchema>;

// ---------------------------------------------------------------------------
// Boundary parsing
// ---------------------------------------------------------------------------

export type ParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function parseWith<T>(schema: z.ZodType<T>, raw: string): ParseResult<T> {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false, error: "Invalid JSON" };
  }
  const result = schema.safeParse(json);
  return result.success
    ? { ok: true, data: result.data }
    : { ok: false, error: z.prettifyError(result.error) };
}

export const parseClientMessage = (raw: string): ParseResult<ClientMessage> =>
  parseWith(ClientMessageSchema, raw);

export const parseServerMessage = (raw: string): ParseResult<ServerMessage> =>
  parseWith(ServerMessageSchema, raw);
