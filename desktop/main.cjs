const { app, BrowserWindow, Menu, Tray, nativeImage, ipcMain, dialog, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const https = require("https");
const { SerialPort } = require("serialport");
const { autoUpdater } = require("electron-updater");
const printerModule = require("./printer.cjs");
const offlineDb = require("./db.cjs");

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

// ─── Terminal (pareamento) ───────────────────────────────────────────────────
// Cada instalação tem um terminal_uid próprio, gerado uma vez e persistido —
// é só um identificador técnico local; o vínculo de fato com o tenant só
// acontece quando o operador digita o código de pareamento no painel web (ver
// requestPairingCode/pairTerminal no backend).
function getTerminalUid() {
  const cfg = readConfig();
  if (cfg.terminalUid) return cfg.terminalUid;
  const uid = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 10)}`;
  writeConfig({ ...cfg, terminalUid: uid });
  return uid;
}

function getPairedTerminal() {
  return readConfig().pairedTerminal || null;
}

function savePairedTerminal(terminal) {
  writeConfig({ ...readConfig(), pairedTerminal: terminal });
}

// Faz uma chamada JSON ao backend já configurado neste terminal (mesmo servidor
// usado pelo BrowserWindow principal) — reaproveita o https nativo já usado em
// testServer(), sem precisar de dependência HTTP nova.
function apiRequest(method, apiPath, body) {
  return new Promise((resolve, reject) => {
    const { server } = readConfig();
    if (!server) { reject(new Error("Servidor não configurado")); return; }
    const [host, port] = server.split(":");
    const data = body ? JSON.stringify(body) : undefined;
    const req = https.request(
      {
        host,
        port: port || 443,
        path: `/api${apiPath}`,
        method,
        headers: { "Content-Type": "application/json", ...(data ? { "Content-Length": Buffer.byteLength(data) } : {}) },
        timeout: 10000,
      },
      (res) => {
        let raw = "";
        res.on("data", (chunk) => { raw += chunk; });
        res.on("end", () => {
          try {
            const json = raw ? JSON.parse(raw) : {};
            if (res.statusCode >= 200 && res.statusCode < 300) resolve(json);
            else reject(new Error(json.error || `HTTP ${res.statusCode}`));
          } catch {
            reject(new Error("Resposta inválida do servidor"));
          }
        });
      }
    );
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("Tempo esgotado ao contatar o servidor")); });
    if (data) req.write(data);
    req.end();
  });
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
let tray = null;
// Controla se "fechar a janela" deve realmente encerrar o processo — só true
// quando o usuário escolhe "Sair" (menu ou bandeja) ou o SO pede pra fechar de
// vez. Sem isso, o botão X da janela mataria o processo e nenhuma notificação
// push conseguiria chegar com o app "fechado" (objetivo da bandeja).
let isQuitting = false;

// ─── Bandeja (tray) ──────────────────────────────────────────────────────────
function createTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, "icon.png"));
  tray = new Tray(icon.resize({ width: 16, height: 16 }));
  tray.setToolTip("BoxSys PDV");
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "Abrir BoxSys PDV", click: () => showMainWindow() },
    { type: "separator" },
    { label: "Sair", click: () => { isQuitting = true; app.quit(); } },
  ]));
  tray.on("click", () => showMainWindow());
}

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) { createWindow(); return; }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

// Aviso mostrado só na primeira vez que o usuário fecha a janela (X) depois
// dessa mudança — evita susto de "o app ainda está aberto?" quando na verdade
// ele só foi minimizado pra bandeja, não encerrado.
function maybeShowTrayNotice() {
  const cfg = readConfig();
  if (cfg.trayNoticeShown) return;
  writeConfig({ ...cfg, trayNoticeShown: true });
  dialog.showMessageBox(mainWindow, {
    type: "info",
    title: "BoxSys PDV continua ativo",
    message: "O BoxSys PDV agora continua rodando na bandeja do sistema mesmo depois de fechar esta janela — assim notificações e impressões remotas continuam funcionando.",
    detail: 'Para encerrar de vez, clique com o botão direito no ícone da bandeja e escolha "Sair", ou use o menu PDV → Sair.',
  });
}

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

  // Fechar a janela (botão X) minimiza pra bandeja em vez de encerrar o
  // processo — necessário pra notificações push e impressão remota
  // continuarem funcionando mesmo com a janela "fechada". Só "Sair" (menu ou
  // bandeja) ou before-quit do SO de fato encerram (ver isQuitting acima).
  mainWindow.on("close", (e) => {
    if (isQuitting) return;
    e.preventDefault();
    mainWindow.hide();
    maybeShowTrayNotice();
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

// ─── Pairing window ──────────────────────────────────────────────────────────
let pairingWindow = null;

function openPairingWindow() {
  if (pairingWindow) {
    pairingWindow.focus();
    return;
  }
  pairingWindow = new BrowserWindow({
    width: 420,
    height: 480,
    resizable: false,
    minimizable: false,
    maximizable: false,
    parent: mainWindow,
    modal: false,
    title: "Vincular Dispositivo",
    icon: path.join(__dirname, "icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  pairingWindow.setMenuBarVisibility(false);
  pairingWindow.loadFile(path.join(__dirname, "pairing.html"));
  pairingWindow.on("closed", () => { pairingWindow = null; });
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
        { label: "Vincular Dispositivo...", click: () => openPairingWindow() },
        { type: "separator" },
        {
          label: "Verificar Atualizações...",
          click: async () => {
            try {
              const result = await autoUpdater.checkForUpdates();
              if (!result || result.updateInfo.version === app.getVersion()) {
                dialog.showMessageBox(mainWindow, {
                  type: "info", title: "Atualizações",
                  message: "Você já está usando a versão mais recente do BoxSys.",
                });
              }
            } catch (err) {
              dialog.showMessageBox(mainWindow, {
                type: "error", title: "Atualizações",
                message: `Não foi possível verificar atualizações: ${err?.message || err}`,
              });
            }
          },
        },
        { type: "separator" },
        { label: "Sair", accelerator: "CmdOrCtrl+Q", click: () => { isQuitting = true; app.quit(); } },
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

// ─── Pairing IPC ─────────────────────────────────────────────────────────────
ipcMain.handle("pairing:get-state", () => ({
  terminalUid: getTerminalUid(),
  paired: getPairedTerminal(),
  hasServer: !!readConfig().server,
}));

ipcMain.handle("pairing:request-code", async () => {
  try {
    const terminal_uid = getTerminalUid();
    const result = await apiRequest("POST", "/desktop-terminals/pairing-code", { terminal_uid });
    return { ok: true, code: result.code, expiresInSeconds: result.expires_in_seconds };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle("pairing:check-status", async () => {
  try {
    const terminal_uid = getTerminalUid();
    const result = await apiRequest("GET", `/desktop-terminals/pairing-status/${terminal_uid}`);
    if (result.paired && result.terminal) {
      savePairedTerminal(result.terminal);
    }
    return result;
  } catch (err) {
    return { paired: false, error: err.message };
  }
});

// ─── Offline SQLite IPC ──────────────────────────────────────────────────────
ipcMain.handle("db:save-cache", (_e, key, value) => offlineDb.saveCache(key, value));
ipcMain.handle("db:get-cache", (_e, key) => offlineDb.getCache(key));
ipcMain.handle("db:enqueue-op", (_e, type, localId, payload, createdAt) =>
  offlineDb.enqueueOp(type, localId, payload, createdAt)
);
ipcMain.handle("db:list-ops", (_e, type) => offlineDb.listOps(type));
ipcMain.handle("db:count-ops", (_e, type) => offlineDb.countOps(type));
ipcMain.handle("db:remove-op", (_e, localId) => offlineDb.removeOp(localId));

// ─── Auto-update ─────────────────────────────────────────────────────────────
// Checa e baixa a atualização em segundo plano; só instala quando o app fechar
// (nunca no meio de uma venda) ou se o operador confirmar manualmente pelo aviso.
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

autoUpdater.on("update-downloaded", () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    dialog.showMessageBox(mainWindow, {
      type: "info",
      buttons: ["Depois", "Reiniciar Agora"],
      defaultId: 0,
      title: "Atualização pronta",
      message: "Uma nova versão do BoxSys foi baixada. Ela será instalada automaticamente ao fechar o app, ou você pode reiniciar agora.",
    }).then(({ response }) => {
      if (response === 1) autoUpdater.quitAndInstall();
    });
  }
});

autoUpdater.on("error", (err) => {
  console.error("[autoUpdater] erro:", err?.message || err);
});

function checkForUpdates() {
  autoUpdater.checkForUpdates().catch((err) => {
    console.error("[autoUpdater] falha ao checar atualização:", err?.message || err);
  });
}

// ─── Lifecycle ───────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  offlineDb.initDb(app);
  buildMenu();
  createTray();
  createWindow();

  // Checagem assíncrona — não atrasa a abertura da janela principal.
  checkForUpdates();
  setInterval(checkForUpdates, 4 * 60 * 60 * 1000); // a cada 4 horas

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else showMainWindow();
  });
});

// A janela agora só esconde ao fechar (ver handler "close" em createWindow),
// então isso só dispara em cenários raros (todas as janelas destruídas sem
// passar pelo handler, ex.: crash) — mantido por segurança, não é mais o
// caminho normal de saída.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin" && isQuitting) app.quit();
});

// Cobre qualquer caminho de saída que não passe pelos cliques customizados
// (Cmd+Q no macOS, "Encerrar tarefa" do SO, etc.) — garante que o handler de
// "close" da janela não fique tentando esconder um app que já está saindo.
app.on("before-quit", () => { isQuitting = true; });
