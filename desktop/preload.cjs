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

  // Atalhos rápidos do PDV (F2/F4/F8/F9) disparados pelo menu nativo
  onShortcut: (callback) => {
    const listener = (_e, action) => callback(action);
    ipcRenderer.on("pdv:shortcut", listener);
    return () => ipcRenderer.removeListener("pdv:shortcut", listener);
  },
});
