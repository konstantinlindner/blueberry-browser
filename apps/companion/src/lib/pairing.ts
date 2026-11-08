import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export interface Pairing {
  host: string;
  port: number;
  token: string;
  // Learned from the desktop on connect, so it can be shown while offline
  desktopName?: string;
}

const STORAGE_KEY = 'blueberry.pairing';

// Parses the desktop's QR payload: blueberry://pair?host=…&port=…&token=…
// Done by hand because URLSearchParams support in React Native is incomplete.
export function parsePairingUrl(raw: string): Pairing | null {
  const match = raw.trim().match(/^blueberry:\/\/pair\?(.+)$/);
  if (!match) return null;

  const params: Record<string, string> = {};
  for (const pair of match[1].split('&')) {
    const [key, value = ''] = pair.split('=');
    params[decodeURIComponent(key)] = decodeURIComponent(value);
  }

  const port = Number(params.port);
  if (!params.host || !params.token || !Number.isInteger(port)) return null;
  return { host: params.host, port, token: params.token };
}

export function loadPairing(): Pairing | null {
  try {
    const raw = read();
    return raw ? (JSON.parse(raw) as Pairing) : null;
  } catch {
    return null;
  }
}

export function savePairing(pairing: Pairing): void {
  write(JSON.stringify(pairing));
}

export function clearPairing(): void {
  write(null);
}

// SecureStore isn't available on web, where localStorage is good enough for development
function read(): string | null {
  if (Platform.OS === 'web')
    return typeof localStorage === 'undefined' ? null : localStorage.getItem(STORAGE_KEY);
  return SecureStore.getItem(STORAGE_KEY);
}

function write(value: string | null): void {
  if (Platform.OS === 'web') {
    if (typeof localStorage === 'undefined') return;
    if (value === null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, value);
    return;
  }
  if (value === null) void SecureStore.deleteItemAsync(STORAGE_KEY);
  else SecureStore.setItem(STORAGE_KEY, value);
}
