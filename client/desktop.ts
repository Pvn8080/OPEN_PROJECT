export interface DesktopSettings {
  baseURL: string;
  model: string;
  hasKey: boolean;
  dataDirectory: string;
  secureStorageAvailable: boolean;
}
interface DesktopBridge {
  platform: string;
  getSettings(): Promise<DesktopSettings>;
  saveSettings(input: {
    baseURL: string;
    model: string;
    apiKey: string;
    removeKey?: boolean;
  }): Promise<DesktopSettings>;
  backup(): Promise<string | null>;
  onOpenSettings(callback: () => void): () => void;
}
declare global {
  interface Window {
    openProjectDesktop?: DesktopBridge;
  }
}
export const desktop = window.openProjectDesktop;
if (desktop)
  document.documentElement.classList.add(
    "desktop-app",
    desktop.platform === "darwin" ? "desktop-mac" : "desktop-other",
  );
