import {
  isTerminal,
  type AgentState,
  type Approval,
  type Task,
  type TimelineItem,
} from '@blueberry/protocol';

import type { Theme } from '@/constants/theme';

export type StepItem = Extract<TimelineItem, { type: 'step' }>;

export const isActive = (task: Task): boolean => !isTerminal(task.status);

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

// One line for the chat list: what's happening now, or how it ended
export function chatPreview(task: Task): string {
  if (task.pendingApproval) return task.pendingApproval.question;
  if (task.summary && task.status === 'done') return task.summary;
  for (let i = task.timeline.length - 1; i >= 0; i--) {
    const item = task.timeline[i];
    if (item.type === 'step') return item.summary;
    if (item.type === 'agent' || item.type === 'user') return item.text;
  }
  return 'Starting…';
}

export function statusMeta(task: Task, theme: Theme): { label: string; color: string } {
  switch (task.status) {
    case 'running':
      return { label: 'Working', color: theme.primary };
    case 'waiting':
      return { label: 'Needs you', color: theme.warning };
    case 'done':
      return { label: 'Done', color: theme.success };
    case 'failed':
      return { label: 'Failed', color: theme.danger };
    case 'cancelled':
      return { label: 'Stopped', color: theme.textSecondary };
  }
}

// What the chat screen renders: consecutive steps collapse into one activity card
export type ChatRow =
  | { kind: 'prompt'; id: string; text: string }
  | { kind: 'steps'; id: string; steps: StepItem[] }
  | { kind: 'item'; id: string; item: Exclude<TimelineItem, StepItem> };

export function chatRows(task: Task): ChatRow[] {
  const rows: ChatRow[] = [{ kind: 'prompt', id: `${task.id}-prompt`, text: task.prompt }];
  for (const item of task.timeline) {
    const last = rows[rows.length - 1];
    if (item.type === 'step') {
      if (last.kind === 'steps') last.steps = [...last.steps, item];
      else rows.push({ kind: 'steps', id: `steps-${item.id}`, steps: [item] });
    } else {
      rows.push({ kind: 'item', id: item.id, item });
    }
  }
  return rows;
}

export function relativeTime(timestamp: number, now = Date.now()): string {
  const minutes = Math.floor((now - timestamp) / 60_000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return new Date(timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' });
}
