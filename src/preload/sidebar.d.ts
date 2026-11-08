import { ElectronAPI } from "@electron-toolkit/preload";

interface ChatRequest {
  message: string;
  context: {
    url: string | null;
    content: string | null;
    text: string | null;
  };
  messageId: string;
}

interface ChatResponse {
  messageId: string;
  content: string;
  isComplete: boolean;
}

interface TabInfo {
  id: string;
  title: string;
  url: string;
  isActive: boolean;
}

interface SidebarAPI {
  // Chat functionality
  sendChatMessage: (request: ChatRequest) => Promise<void>;
  onChatResponse: (callback: (data: ChatResponse) => void) => void;
  removeChatResponseListener: () => void;

  // Page content access
  getPageContent: () => Promise<string | null>;
  getPageText: () => Promise<string | null>;
  getCurrentUrl: () => Promise<string | null>;

  // Tab information
  getActiveTabInfo: () => Promise<TabInfo | null>;

  companion: CompanionAPI;
}

interface CompanionDevice {
  name: string;
  connectedAt: number;
}

interface CompanionPairing {
  url: string;
  qrDataUrl: string;
  desktopName: string;
  devices: CompanionDevice[];
}

interface CompanionAPI {
  getPairing: () => Promise<CompanionPairing>;
  resetPairing: () => Promise<CompanionPairing>;
  // Both return an unsubscribe function
  onDevicesChanged: (callback: (devices: CompanionDevice[]) => void) => () => void;
  onShowPairing: (callback: () => void) => () => void;
}

declare global {
  interface Window {
    electron: ElectronAPI;
    sidebarAPI: SidebarAPI;
  }
}

