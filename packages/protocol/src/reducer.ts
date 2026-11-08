import type {
  AgentEvent,
  AgentState,
  Task,
  TaskStatus,
  TimelineItem,
} from "./messages";

export const initialState: AgentState = { tasks: {}, order: [] };

export const isTerminal = (status: TaskStatus): boolean =>
  status === "done" || status === "failed" || status === "cancelled";

// Pure — the desktop, the phone and the tests all run this exact function
export function reduce(state: AgentState, event: AgentEvent): AgentState {
  if (event.kind === "task.created") {
    const task: Task = {
      ...event.task,
      status: "running",
      timeline: [],
      pendingApproval: null,
      summary: null,
    };
    return {
      tasks: { ...state.tasks, [task.id]: task },
      order: [task.id, ...state.order.filter((id) => id !== task.id)],
    };
  }

  const task = state.tasks[event.taskId];
  if (!task) return state;

  switch (event.kind) {
    case "task.status":
      return withStatus(state, task, event.status);

    case "step":
      return withTask(state, {
        ...task,
        timeline: upsert(task.timeline, {
          type: "step",
          id: event.stepId,
          tool: event.tool,
          summary: event.summary,
          status: event.status,
        }),
      });

    case "text":
      return withTask(state, {
        ...task,
        timeline: upsert(task.timeline, {
          type: "agent",
          id: event.id,
          text: event.text,
        }),
      });

    case "user.message":
      return withTask(state, {
        ...task,
        timeline: upsert(task.timeline, {
          type: "user",
          id: event.id,
          text: event.text,
        }),
      });

    case "approval.requested":
      return withTask(state, {
        ...task,
        status: "waiting",
        pendingApproval: event.approval,
        timeline: upsert(task.timeline, {
          type: "approval",
          id: event.approval.id,
          question: event.approval.question,
          approved: null,
        }),
      });

    case "approval.resolved": {
      const item = task.timeline.find((i) => i.id === event.approvalId);
      return withTask(state, {
        ...task,
        status: task.status === "waiting" ? "running" : task.status,
        pendingApproval:
          task.pendingApproval?.id === event.approvalId
            ? null
            : task.pendingApproval,
        timeline:
          item?.type === "approval"
            ? upsert(task.timeline, { ...item, approved: event.approved })
            : task.timeline,
      });
    }

    case "task.finished":
      return withStatus(state, { ...task, summary: event.summary }, "done");
  }
}

function withTask(state: AgentState, task: Task): AgentState {
  return { ...state, tasks: { ...state.tasks, [task.id]: task } };
}

function withStatus(
  state: AgentState,
  task: Task,
  status: TaskStatus,
): AgentState {
  return withTask(state, {
    ...task,
    status,
    // A finished task can't still be waiting on the user
    pendingApproval: isTerminal(status) ? null : task.pendingApproval,
  });
}

function upsert(timeline: TimelineItem[], item: TimelineItem): TimelineItem[] {
  const index = timeline.findIndex((i) => i.id === item.id);
  if (index === -1) return [...timeline, item];
  const next = timeline.slice();
  next[index] = item;
  return next;
}
