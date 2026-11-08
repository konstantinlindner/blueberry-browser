import type { ClientMessage } from '@blueberry/protocol';

import { connection } from './connection';
import { clearPairing, savePairing, type Pairing } from './pairing';
import { reportError, useStore } from './store';

const START_TIMEOUT_MS = 10_000;

// Resolves with the new task's id once the desktop has created it, or rejects
// with the desktop's error (e.g. "already working on a task").
export function startTask(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const known = new Set(useStore.getState().agent.order);
    const errorBefore = useStore.getState().error?.id;

    if (!connection.send({ type: 'task.start', prompt })) {
      reject(new Error('Not connected to your desktop.'));
      return;
    }

    const finish = (fn: () => void) => {
      clearTimeout(timer);
      unsubscribe();
      fn();
    };
    const timer = setTimeout(
      () => finish(() => reject(new Error('Your desktop didn’t respond.'))),
      START_TIMEOUT_MS,
    );
    const unsubscribe = useStore.subscribe((s) => {
      const created = s.agent.order.find((id) => !known.has(id));
      if (created) finish(() => resolve(created));
      else if (s.error && s.error.id !== errorBefore)
        finish(() => reject(new Error(s.error!.message)));
    });
  });
}

export const sendMessage = (taskId: string, text: string) =>
  send({ type: 'task.message', taskId, text });

export const cancelTask = (taskId: string) => send({ type: 'task.cancel', taskId });

export const respondToApproval = (approvalId: string, approved: boolean, note?: string) =>
  send({ type: 'approval.respond', approvalId, approved, note: note || undefined });

export function pair(pairing: Pairing): void {
  savePairing(pairing);
  useStore.setState({ pairing });
}

export function unpair(): void {
  connection.disconnect();
  clearPairing();
  useStore.setState({ pairing: null, frames: {} });
}

function send(message: ClientMessage): boolean {
  const sent = connection.send(message);
  if (!sent) reportError('Not connected to your desktop.');
  return sent;
}
