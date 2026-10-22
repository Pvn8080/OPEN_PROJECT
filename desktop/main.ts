import {
  app,
  BrowserWindow,
  Menu,
  ipcMain,
  safeStorage,
  dialog,
} from "electron";
import {
  readFileSync,
  writeFileSync,
  renameSync,
  existsSync,
  mkdirSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { startDesktopService } from "./service";
import { createWorkspaceBackup } from "./backup";
import { createQuitCoordinator } from "./lifecycle";
import { configuredProvider } from "../server/ai/provider";
import { defaultSettings, mergeSettings, type Settings } from "./settings";
const here = dirname(fileURLToPath(import.meta.url));
const smoke = process.argv.includes("--desktop-smoke");
const trace = (stage: string) => {
  if (smoke) console.log("Desktop smoke: " + stage);
};
app.setName("Open Project");
if (process.env.OP_DESKTOP_DATA_DIR)
  app.setPath("userData", process.env.OP_DESKTOP_DATA_DIR);
else app.setPath("userData", join(app.getPath("appData"), "Open Project"));
mkdirSync(app.getPath("userData"), { recursive: true, mode: 0o700 });
const settingsPath = join(app.getPath("userData"), "ai-settings.json");
let settings: Settings = { ...defaultSettings };
let window: BrowserWindow | null = null,
  service: Awaited<ReturnType<typeof startDesktopService>> | undefined;
const quitCoordinator = createQuitCoordinator({
  hasWindow: () => !!window && !window.isDestroyed(),
  closeWindow: () => window?.close(),
  closeService: async () => {
    if (service) await service.close();
  },
  quit: () => app.quit(),
});
function installProvider() {
  process.env.AI_BASE_URL = settings.baseURL;
  process.env.AI_MODEL = settings.model;
  delete process.env.AI_API_KEY;
  if (settings.encryptedKey)
    process.env.AI_API_KEY = safeStorage.decryptString(
      Buffer.from(settings.encryptedKey, "base64"),
    );
}
function publicSettings() {
  return {
    baseURL: settings.baseURL,
    model: settings.model,
    hasKey: !!settings.encryptedKey,
    dataDirectory: app.getPath("userData"),
    secureStorageAvailable:
      safeStorage.isEncryptionAvailable() &&
      (process.platform !== "linux" ||
        safeStorage.getSelectedStorageBackend() !== "basic_text"),
  };
}
function assertSender(event: Electron.IpcMainInvokeEvent) {
  if (
    !window ||
    event.sender !== window.webContents ||
    !event.senderFrame?.url.startsWith(service!.origin + "/")
  )
    throw Error("Unauthorized desktop operation");
}
async function backup() {
  if (!window || !service) return null;
  const result = await dialog.showSaveDialog(window, {
    title: "Back up Open Project",
    defaultPath: join(
      app.getPath("documents"),
      "Open-Project-" + new Date().toISOString().slice(0, 10) + ".sqlite",
    ),
    filters: [{ name: "SQLite backup", extensions: ["sqlite"] }],
  });
  if (result.canceled || !result.filePath) return null;
  return createWorkspaceBackup(
    service.store,
    result.filePath,
    app.getPath("userData"),
  );
}

async function createWindow() {
  if (window) {
    window.show();
    return;
  }
  trace("creating window");
  window = new BrowserWindow({
    show: !smoke,
    width: 1440,
    height: 960,
    minWidth: 1024,
    minHeight: 700,
    title: "Open Project",
    backgroundColor: "#ffffff",
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    trafficLightPosition: { x: 18, y: 18 },
    webPreferences: {
      preload: join(here, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      partition: "persist:open-project",
    },
  });
  const contents = window.webContents;
  contents.session.setPermissionRequestHandler(
    (_contents, _permission, callback) => callback(false),
  );
  contents.session.webRequest.onBeforeSendHeaders(
    { urls: [service!.origin + "/*"] },
    (details, callback) =>
      callback({
        requestHeaders: {
          ...details.requestHeaders,
          "X-Open-Project-Desktop": service!.token,
        },
      }),
  );
  contents.on("will-prevent-unload", (event) => {
    const choice = dialog.showMessageBoxSync(window!, {
      type: "warning",
      title: "Unsaved changes",
      message: "Keep editing your unsaved changes?",
      detail: "Closing this window will discard the retained draft.",
      buttons: ["Keep Editing", "Discard Changes"],
      defaultId: 0,
      cancelId: 0,
    });
    if (choice === 1) event.preventDefault();
    else quitCoordinator.unloadCancelled();
  });
  contents.setWindowOpenHandler(() => ({ action: "deny" }));
  contents.on("will-navigate", (event, url) => {
    if (!url.startsWith(service!.origin + "/")) event.preventDefault();
  });
  window.on("closed", () => {
    trace("window closed");
    window = null;
    quitCoordinator.windowClosed();
  });
  await window.loadURL(service!.origin);
  trace("window loaded");
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on("second-instance", () => {
    if (window) {
      if (window.isMinimized()) window.restore();
      window.focus();
    }
  });
  app
    .whenReady()
    .then(async () => {
      if (existsSync(settingsPath)) {
        try {
          settings = {
            ...defaultSettings,
            ...JSON.parse(readFileSync(settingsPath, "utf8")),
          };
          installProvider();
        } catch {
          settings = { ...defaultSettings };
          delete process.env.AI_API_KEY;
          dialog.showErrorBox(
            "AI settings need attention",
            "Your provider key could not be loaded. Local planning is available. Reconnect your provider in Settings.",
          );
        }
      }
      service = await startDesktopService({
        dataDirectory: app.getPath("userData"),
        clientDirectory: join(here, "client"),
        provider: {
          respond(context, request, signal) {
            const provider = configuredProvider();
            if (!provider)
              throw Error(
                "Connect your AI provider in Open Project Settings. Manual planning is available offline.",
              );
            return provider.respond(context, request, signal);
          },
        },
      });
      ipcMain.handle("desktop:settings:get", (event) => {
        assertSender(event);
        return publicSettings();
      });
      ipcMain.handle("desktop:settings:save", (event, input) => {
        assertSender(event);
        const next = mergeSettings(settings, input, (key) => {
          if (!publicSettings().secureStorageAvailable)
            throw Error(
              "Secure OS credential storage is unavailable. No key was saved.",
            );
          return safeStorage.encryptString(key).toString("base64");
        });
        const temp = settingsPath + ".tmp";
        writeFileSync(temp, JSON.stringify(next), { mode: 0o600 });
        renameSync(temp, settingsPath);
        settings = next;
        installProvider();
        return publicSettings();
      });
      ipcMain.handle("desktop:backup", (event) => {
        assertSender(event);
        return backup();
      });
      Menu.setApplicationMenu(
        Menu.buildFromTemplate([
          {
            label: "Open Project",
            submenu: [
              { role: "about" },
              { type: "separator" },
              {
                label: "Settings…",
                accelerator: "CmdOrCtrl+,",
                click: () => window?.webContents.send("desktop:open-settings"),
              },
              { type: "separator" },
              { role: "hide" },
              { role: "hideOthers" },
              { role: "unhide" },
              { type: "separator" },
              { role: "quit" },
            ],
          },
          {
            label: "File",
            submenu: [
              {
                label: "Back Up Workspace…",
                click: () => {
                  void backup().catch((error) =>
                    dialog.showErrorBox("Backup failed", error.message),
                  );
                },
              },
              { type: "separator" },
              { role: "close" },
            ],
          },
          { role: "editMenu" },
          { role: "viewMenu" },
          { role: "windowMenu" },
          {
            label: "Help",
            submenu: [
              {
                label: "About This Workspace",
                click: () =>
                  dialog.showMessageBox({
                    type: "info",
                    title: "Open Project",
                    message: "Your projects are saved on this Mac.",
                    detail:
                      "Tasks, resources, baselines, templates and history work locally. AI needs a provider key. Remote team sharing requires a hosted workspace. Use File → Back Up Workspace to keep a database copy.",
                  }),
              },
            ],
          },
        ]),
      );
      await createWindow();
    })
    .catch((error) => {
      dialog.showErrorBox("Open Project could not start", error.message);
      app.exit(1);
    });
  app.on("activate", () => {
    if (service) void createWindow();
  });
  app.on("window-all-closed", () => {
    trace("all windows closed");
    if (process.platform !== "darwin") app.quit();
  });
  app.on("before-quit", (event) => quitCoordinator.beforeQuit(event));
}
