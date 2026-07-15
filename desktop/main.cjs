const { app, BrowserWindow, Menu, ipcMain, dialog, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const https = require("https");
const { SerialPort } = require("serialport");
const printerModule = require("./printer.cjs");

// ─── Config persistence (userData/config.json) ──────────────────────────────
const configPath = () => path.join(app.getPath("userData"), "config.json");

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(configPath(), "utf-8"));
  } catch {
    return {};
  }
}

function writeConfig(cfg) {
  fs.writeFileSync(configPath(), JSON.stringify(cfg, null, 2), "utf-8");
}

// ─── Printer config helpers ──────────────────────────────────────────────────
function getPrinterConfig() {
  return readConfig().printer || null;
}

function savePrinterConfig(cfg) {
  writeConfig({ ...readConfig(), printer: cfg });
}

// ─── URL helpers ─────────────────────────────────────────────────────────────
function normalizeServer(input) {
  let v = String(input || "").trim().toLowerCase();
  if (!v) return null;
  v = v.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!/^[a-z0-9.-]+(:\d+)?$/.test(v)) return null;
  return v;
}

function entryUrl(server, mode) {
  return `https://${server}/${mode === "admin" ? "admin" : "pdv"}`;
}

function windowTitle(mode) {
  return mode === "admin" ? "BoxSys — Painel Completo" : "BoxSys PDV — Terminal de Caixa";
}

// Quick reachability test against the server
function testServer(server) {
  return new Promise((resolve) => {
    const req = https.get(
      { host: server.split(":")[0], port: server.split(":")[1] || 443, path: "/", timeout: 8000 },
      (res) => {
        res.resume();
        resolve(res.statusCode > 0);
      }
    );
    req.on("error", () => resolve(false));
    req.on("timeout", () => { req.destroy(); resolve(false); });
  });
}

// ─── Window ──────────────────────────────────────────────────────────────────
let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 768,
    minWidth: 1024,
    minHeight: 640,
    title: "BoxSys PDV",
    icon: path.join(__dirname, "icon.png"),
    backgroundColor: "#0f172a",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.maximize();

  // External links open in the OS browser, not inside the PDV window
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  // Connection lost / server unreachable → offline screen with retry
  mainWindow.webContents.on("did-fail-load", (_e, code, _desc, validatedURL) => {
    // Ignore aborts (code -3) triggered by in-app navigation
    if (code === -3) return;
    if (validatedURL && validatedURL.startsWith("http")) {
      mainWindow.loadFile(path.join(__dirname, "offline.html"));
    }
  });

  loadEntry();
}

function loadEntry() {
  const { server, mode } = readConfig();
  if (server) {
    mainWindow.setTitle(windowTitle(mode));
    mainWindow.loadURL(entryUrl(server, mode));
  } else {
    mainWindow.setTitle("BoxSys — Configuração");
    mainWindow.loadFile(path.join(__dirname, "setup.html"));
  }
}

// ─── Printer config window ───────────────────────────────────────────────────
let printerConfigWindow = null;

function openPrinterConfigWindow() {
  if (printerConfigWindow) {
    printerConfigWindow.focus();
    return;
  }
  printerConfigWindow = new BrowserWindow({
    width: 480,
    height: 620,
    resizable: false,
    minimizable: false,
    maximizable: false,
    parent: mainWindow,
    modal: false,
    title: "Configurar Impressora",
    icon: path.join(__dirname, "icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  printerConfigWindow.setMenuBarVisibility(false);
  printerConfigWindow.loadFile(path.join(__dirname, "printer-config.html"));
  printerConfigWindow.on("closed", () => { printerConfigWindow = null; });
}

// ─── Menu ────────────────────────────────────────────────────────────────────
function buildMenu() {
  const template = [
    {
      label: "PDV",
      submenu: [
        { label: "Recarregar", accelerator: "CmdOrCtrl+R", click: () => loadEntry() },
        { label: "Tela Cheia", accelerator: "F11", click: () => mainWindow.setFullScreen(!mainWindow.isFullScreen()) },
        { type: "separator" },
        { label: "Abrir Gaveta", accelerator: "F4", click: () => mainWindow.webContents.send("pdv:shortcut", "open-drawer") },
        { label: "Buscar Produto", accelerator: "F2", click: () => mainWindow.webContents.send("pdv:shortcut", "focus-search") },
        { label: "Finalizar Venda", accelerator: "F8", click: () => mainWindow.webContents.send("pdv:shortcut", "checkout") },
        { label: "Nova Venda / Limpar Carrinho", accelerator: "F9", click: () => mainWindow.webContents.send("pdv:shortcut", "new-sale") },
        { type: "separator" },
        {
          label: "Reconfigurar Terminal...",
          click: async () => {
            const { response } = await dialog.showMessageBox(mainWindow, {
              type: "question",
              buttons: ["Cancelar", "Reconfigurar"],
              defaultId: 1,
              title: "Reconfigurar Terminal",
              message: "Deseja trocar o endereço da loja e/ou o modo deste terminal (PDV / Sistema Completo)?",
            });
            if (response === 1) {
              mainWindow.setTitle("BoxSys — Configuração");
              mainWindow.loadFile(path.join(__dirname, "setup.html"));
            }
          },
        },
        { type: "separator" },
        { label: "Configurar Impressora...", click: () => openPrinterConfigWindow() },
        { type: "separator" },
        { label: "Sair", accelerator: "CmdOrCtrl+Q", role: "quit" },
      ],
    },
    {
      label: "Exibir",
      submenu: [
        { role: "zoomIn", label: "Aumentar Zoom" },
        { role: "zoomOut", label: "Diminuir Zoom" },
        { role: "resetZoom", label: "Zoom Padrão" },
        { type: "separator" },
        { role: "toggleDevTools", label: "DevTools" },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ─── IPC ─────────────────────────────────────────────────────────────────────
ipcMain.handle("setup:get-current", () => {
  const { server, mode } = readConfig();
  return { server: server || "", mode: mode === "admin" ? "admin" : "pdv" };
});

ipcMain.handle("setup:save-server", async (_e, input, mode) => {
  const server = normalizeServer(input);
  if (!server) return { ok: false, error: "Endereço inválido. Ex: minhaloja.boxsys.com.br" };

  const reachable = await testServer(server);
  if (!reachable) return { ok: false, error: "Não foi possível conectar a este servidor. Verifique o endereço e sua internet." };

  const resolvedMode = mode === "admin" ? "admin" : "pdv";
  writeConfig({ ...readConfig(), server, mode: resolvedMode });
  mainWindow.setTitle(windowTitle(resolvedMode));
  mainWindow.loadURL(entryUrl(server, resolvedMode));
  return { ok: true };
});

ipcMain.handle("app:retry", () => {
  loadEntry();
  return true;
});

// ─── Printer IPC ─────────────────────────────────────────────────────────────
ipcMain.handle("printer:list-ports", async () => {
  try {
    const ports = await SerialPort.list();
    return ports.map((p) => ({
      path: p.path,
      manufacturer: p.manufacturer || null,
      serialNumber: p.serialNumber || null,
    }));
  } catch {
    return [];
  }
});

ipcMain.handle("printer:get-config", () => getPrinterConfig());

ipcMain.handle("printer:save-config", (_e, cfg) => {
  savePrinterConfig(cfg);
  return { ok: true };
});

ipcMain.handle("printer:test", async (_e, cfg) => {
  const config = cfg || getPrinterConfig();
  if (!config) return { ok: false, error: "Nenhuma impressora configurada" };
  return printerModule.testConnection(config);
});

ipcMain.handle("printer:print-receipt", async (_e, text) => {
  const config = getPrinterConfig();
  if (!config) return { ok: false, error: "Nenhuma impressora térmica configurada" };
  return printerModule.printReceipt(text, config);
});

ipcMain.handle("printer:open-drawer", async () => {
  const config = getPrinterConfig();
  if (!config) return { ok: false, error: "Nenhuma impressora térmica configurada" };
  return printerModule.openCashDrawer(config);
});

// ─── Lifecycle ───────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  buildMenu();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
