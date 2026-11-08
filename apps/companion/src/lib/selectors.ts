import type { AgentState, Approval, Task, TaskStatus, TimelineItem } from '@blueberry/protocol';

import type { Theme } from '@/constants/theme';

export type StepItem = Extract<TimelineItem, { type: 'step' }>;

export function firstPendingApprovalId(agent: AgentState): string | null {
  for (const id of agent.order) {
    const approval = agent.tasks[id]?.pendingApproval;
    if (approval) return approval.id;
  }
  return null;
}

export function findApproval(
  agent: AgentState,
  approvalId: string,
): { task: Task; approval: Approval } | null {
  for (const task of Object.values(agent.tasks)) {
    if (task.pendingApproval?.id === approvalId) return { task, approval: task.pendingApproval };
  }
  return null;
}

export function latestStep(task: Task): StepItem | null {
  for (let i = task.timeline.length - 1; i >= 0; i--) {
    const item = task.timeline[i];
    if (item.type === 'step') return item;
  }
  return null;
}

export function statusMeta(status: TaskStatus, theme: Theme): { label: string; color: string } {
  switch (status) {
    case 'running':
      return { label: 'Working', color: theme.primary };
    case 'waiting':
      return { label: 'Needs you', color: theme.warning };
    case 'done':
      return { label: 'Done', color: theme.success };
    case 'failed':
      return { label: 'Failed', color: theme.danger };
    case 'cancelled':
      return { label: 'Cancelled', color: theme.textSecondary };
  }
}
