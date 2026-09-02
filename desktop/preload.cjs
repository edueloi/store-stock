const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("boxsysDesktop", {
  isDesktop: true,
  version: "1.0.0",
  saveServer: (url, mode) => ipcRenderer.invoke("setup:save-server", url, mode),
  getCurrentSetup: () => ipcRenderer.invoke("setup:get-current"),
  retry: () => ipcRenderer.invoke("app:retry"),

  // Impressora térmica
  printReceipt: (text) => ipcRenderer.invoke("printer:print-receipt", text),
  openCashDrawer: () => ipcRenderer.invoke("printer:open-drawer"),
  getPrinterConfig: () => ipcRenderer.invoke("printer:get-config"),
  savePrinterConfig: (cfg) => ipcRenderer.invoke("printer:save-config", cfg),
  testPrinter: (cfg) => ipcRenderer.invoke("printer:test", cfg),
  listSerialPorts: () => ipcRenderer.invoke("printer:list-ports"),

  // Banco local (SQLite) — cache de catálogo e fila de operações offline
  dbSaveCache: (key, value) => ipcRenderer.invoke("db:save-cache", key, value),
  dbGetCache: (key) => ipcRenderer.invoke("db:get-cache", key),
  dbEnqueueOp: (type, localId, payload, createdAt) =>
    ipcRenderer.invoke("db:enqueue-op", type, localId, payload, createdAt),
  dbListOps: (type) => ipcRenderer.invoke("db:list-ops", type),
  dbCountOps: (type) => ipcRenderer.invoke("db:count-ops", type),
  dbRemoveOp: (localId) => ipcRenderer.invoke("db:remove-op", localId),

  // Atalhos rápidos do PDV (F2/F4/F8/F9) disparados pelo menu nativo
  onShortcut: (callback) => {
    const listener = (_e, action) => callback(action);
    ipcRenderer.on("pdv:shortcut", listener);
    return () => ipcRenderer.removeListener("pdv:shortcut", listener);
  },
});
