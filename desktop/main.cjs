const { app, BrowserWindow, Menu, ipcMain, dialog, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const https = require("https");

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

// ─── URL helpers ─────────────────────────────────────────────────────────────
function normalizeServer(input) {
  let v = String(input || "").trim().toLowerCase();
  if (!v) return null;
  v = v.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!/^[a-z0-9.-]+(:\d+)?$/.test(v)) return null;
  return v;
}

function pdvUrl(server) {
  return `https://${server}/pdv`;
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
  const { server } = readConfig();
  if (server) {
    mainWindow.loadURL(pdvUrl(server));
  } else {
    mainWindow.loadFile(path.join(__dirname, "setup.html"));
  }
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
        {
          label: "Trocar Servidor...",
          click: async () => {
            const { response } = await dialog.showMessageBox(mainWindow, {
              type: "question",
              buttons: ["Cancelar", "Trocar"],
              defaultId: 1,
              title: "Trocar Servidor",
              message: "Deseja desconectar desta loja e configurar outro endereço?",
            });
            if (response === 1) {
              writeConfig({});
              mainWindow.loadFile(path.join(__dirname, "setup.html"));
            }
          },
        },
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
ipcMain.handle("setup:save-server", async (_e, input) => {
  const server = normalizeServer(input);
  if (!server) return { ok: false, error: "Endereço inválido. Ex: minhaloja.boxsys.com.br" };

  const reachable = await testServer(server);
  if (!reachable) return { ok: false, error: "Não foi possível conectar a este servidor. Verifique o endereço e sua internet." };

  writeConfig({ server });
  mainWindow.loadURL(pdvUrl(server));
  return { ok: true };
});

ipcMain.handle("app:retry", () => {
  loadEntry();
  return true;
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
