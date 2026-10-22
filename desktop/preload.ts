import { contextBridge, ipcRenderer } from "electron";
contextBridge.exposeInMainWorld("openProjectDesktop", {
  platform: process.platform,
  getSettings: () => ipcRenderer.invoke("desktop:settings:get"),
  saveSettings: (input: unknown) =>
    ipcRenderer.invoke("desktop:settings:save", input),
  backup: () => ipcRenderer.invoke("desktop:backup"),
  onOpenSettings: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on("desktop:open-settings", listener);
    return () => ipcRenderer.removeListener("desktop:open-settings", listener);
  },
});
