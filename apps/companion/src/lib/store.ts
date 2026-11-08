import { initialState, reduce, type AgentState, type ServerMessage } from '@blueberry/protocol';
import { create } from 'zustand';

import { loadPairing, savePairing, type Pairing } from './pairing';

export type ConnectionStatus = 'idle' | 'connecting' | 'open' | 'offline' | 'unauthorized';

interface Store {
  pairing: Pairing | null;
  status: ConnectionStatus;
  // Built with the same reducer the desktop uses, from snapshot + events
  agent: AgentState;
  // Latest live frame per task, as a data URI. Not part of agent state.
  frames: Record<string, string>;
  // Increments so the same message twice still shows a toast
  error: { id: number; message: string } | null;
}

export const useStore = create<Store>(() => ({
  pairing: loadPairing(),
  status: 'idle',
  agent: initialState,
  frames: {},
  error: null,
}));

export function applyServerMessage(message: ServerMessage): void {
  useStore.setState((s) => {
    switch (message.type) {
      case 'snapshot': {
        const pairing = s.pairing && { ...s.pairing, desktopName: message.desktop.name };
        if (pairing && pairing.desktopName !== s.pairing?.desktopName) savePairing(pairing);
        return { agent: message.state, pairing };
      }
      case 'event':
        return { agent: reduce(s.agent, message.event) };
      case 'frame':
        return {
          frames: { ...s.frames, [message.taskId]: `data:image/jpeg;base64,${message.jpegBase64}` },
        };
      case 'error':
        return showError(s, message.message);
    }
  });
}

export function reportError(message: string): void {
  useStore.setState((s) => showError(s, message));
}

function showError(s: Store, message: string): Partial<Store> {
  return { error: { id: (s.error?.id ?? 0) + 1, message } };
}
