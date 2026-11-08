import { parseServerMessage, type ClientMessage } from '@blueberry/protocol';
import * as Device from 'expo-device';

import type { Pairing } from './pairing';
import { applyServerMessage, useStore, type ConnectionStatus } from './store';

const BACKOFF_MS = [1000, 2000, 5000, 10000];
const CONNECT_TIMEOUT_MS = 5000;

// One socket to the desktop. Reconnects with backoff while wanted; every
// (re)connect gets a fresh snapshot, so there's no replay logic here.
class Connection {
  private socket: WebSocket | null = null;
  private attempt = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private wanted = false;

  connect(): void {
    const { pairing } = useStore.getState();
    if (!pairing) return;
    this.wanted = true;
    if (!this.socket && !this.retryTimer) this.open(pairing);
  }

  disconnect(): void {
    this.wanted = false;
    this.clearRetry();
    const socket = this.socket;
    this.socket = null; // detach first so its close event is ignored
    socket?.close();
    setStatus('idle');
  }

  // Returns false when offline so the UI can say so instead of silently queueing
  send(message: ClientMessage): boolean {
    if (!this.socket || useStore.getState().status !== 'open') return false;
    this.socket.send(JSON.stringify(message));
    return true;
  }

  private open(pairing: Pairing): void {
    setStatus('connecting');
    const socket = new WebSocket(`ws://${pairing.host}:${pairing.port}`);
    this.socket = socket;

    // An unreachable LAN address can hang for a long time before failing
    const timeout = setTimeout(() => socket.close(), CONNECT_TIMEOUT_MS);

    socket.onopen = () => {
      socket.send(
        JSON.stringify({
          type: 'hello',
          token: pairing.token,
          deviceName: Device.deviceName ?? Device.modelName ?? 'Phone',
        } satisfies ClientMessage),
      );
    };

    socket.onmessage = (event) => {
      const parsed = parseServerMessage(String(event.data));
      if (!parsed.ok) {
        console.warn('Ignoring invalid message from desktop:', parsed.error);
        return;
      }
      // The snapshot is the proof that the token was accepted
      if (parsed.data.type === 'snapshot') {
        clearTimeout(timeout);
        this.attempt = 0;
        setStatus('open');
      }
      applyServerMessage(parsed.data);
    };

    socket.onclose = (event) => {
      clearTimeout(timeout);
      if (this.socket !== socket) return;
      this.socket = null;

      if (event.code === 4003) {
        this.wanted = false;
        setStatus('unauthorized');
        return;
      }
      if (!this.wanted) return;
      setStatus('offline');
      this.scheduleRetry();
    };
  }

  private scheduleRetry(): void {
    const delay = BACKOFF_MS[Math.min(this.attempt, BACKOFF_MS.length - 1)];
    this.attempt += 1;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      const { pairing } = useStore.getState();
      if (this.wanted && pairing) this.open(pairing);
    }, delay);
  }

  private clearRetry(): void {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    this.attempt = 0;
  }
}

function setStatus(status: ConnectionStatus): void {
  if (useStore.getState().status !== status) useStore.setState({ status });
}

export const connection = new Connection();

const PROBE_TIMEOUT_MS = 6000;

// Checks a freshly scanned code before saving it: connects, says hello and
// waits for the snapshot. Resolves with the desktop's name.
export function probe(pairing: Pairing): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`ws://${pairing.host}:${pairing.port}`);
    const fail = (message: string) => {
      clearTimeout(timer);
      socket.onclose = null;
      socket.close();
      reject(new Error(message));
    };
    const timer = setTimeout(
      () => fail('Couldn’t reach your computer. Make sure your phone is on the same Wi-Fi.'),
      PROBE_TIMEOUT_MS,
    );

    socket.onopen = () =>
      socket.send(
        JSON.stringify({
          type: 'hello',
          token: pairing.token,
          deviceName: Device.deviceName ?? Device.modelName ?? 'Phone',
        } satisfies ClientMessage),
      );
    socket.onmessage = (event) => {
      const parsed = parseServerMessage(String(event.data));
      if (parsed.ok && parsed.data.type === 'snapshot') {
        clearTimeout(timer);
        socket.onclose = null;
        socket.close();
        resolve(parsed.data.desktop.name);
      }
    };
    socket.onclose = (event) =>
      fail(
        event.code === 4003
          ? 'This code has expired. Show a new one on your computer.'
          : 'Couldn’t reach your computer. Make sure your phone is on the same Wi-Fi.',
      );
  });
}
