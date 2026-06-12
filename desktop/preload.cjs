const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("boxsysDesktop", {
  // Identifies the desktop wrapper to the web app (used later for offline mode)
  isDesktop: true,
  version: "1.0.0",
  saveServer: (url) => ipcRenderer.invoke("setup:save-server", url),
  retry: () => ipcRenderer.invoke("app:retry"),
});
