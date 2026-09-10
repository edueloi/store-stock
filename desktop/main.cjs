const { app, BrowserWindow, Menu, Tray, nativeImage, ipcMain, dialog, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const https = require("https");
const { SerialPort } = require("serialport");
const { autoUpdater } = require("electron-updater");
const printerModule = require("./printer.cjs");
const offlineDb = require("./db.cjs");

// A janela só minimiza pra bandeja ao fechar (nunca encerra o processo de verdade,
// ver handler "close" abaixo) — sem esse lock, clicar no ícone de novo sem lembrar
// que o app já está aberto (na bandeja) cria uma instância Electron nova a cada
// clique, em vez de trazer a janela existente pra frente.
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
}

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
function apiRequest(method, apiPath, body, authToken) {
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
        headers: {
          "Content-Type": "application/json",
          ...(data ? { "Content-Length": Buffer.byteLength(data) } : {}),
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
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

// Lê o token JWT já salvo no localStorage do renderer principal — usado pelas
// telas auxiliares (ex.: configuração de múltiplas impressoras) que precisam
// chamar endpoints autenticados do backend, mas não têm sessão própria (são
// janelas separadas do BrowserWindow principal).
async function getAuthToken() {
  if (!mainWindow || mainWindow.isDestroyed()) return null;
  try {
    return await mainWindow.webContents.executeJavaScript('localStorage.getItem("token")');
  } catch {
    return null;
  }
}

function apiRequestAuthed(method, apiPath, body) {
  return getAuthToken().then((token) => {
    if (!token) return Promise.reject(new Error("Faça login no terminal principal antes de configurar impressoras."));
    return apiRequest(method, apiPath, body, token);
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
    height: 760,
    resizable: false,
    minimizable: false,
    maximizable: false,
    parent: mainWindow,
    modal: false,
    title: "Configurar Impressoras",
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
        { label: "Configurar Impressoras...", click: () => openPrinterConfigWindow() },
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

// Resolve qual config de impressora térmica usar pro cupom de venda — prioriza
// uma impressora role "receipt" cadastrada no novo sistema (multi-impressora,
// backend), caindo pro config.json legado (impressora única, pré-atualização)
// quando o terminal ainda não foi pareado ou não tem nenhuma cadastrada assim.
// Mantém quem já usava impressora funcionando sem precisar reconfigurar nada.
async function resolveReceiptPrinterConfig() {
  try {
    const terminal = getPairedTerminal();
    if (terminal?.id) {
      const terminals = await apiRequestAuthed("GET", "/desktop-terminals");
      const mine = Array.isArray(terminals) ? terminals.find((t) => t.id === terminal.id) : null;
      const printers = mine?.printers || [];
      const printer = printers.find((p) => p.role === "receipt" && p.is_default) || printers.find((p) => p.role === "receipt");
      if (printer) return printer.config;
    }
  } catch {
    // sem terminal pareado, sem conexão, etc. — cai pro legado abaixo
  }
  return getPrinterConfig();
}

ipcMain.handle("printer:print-receipt", async (_e, text) => {
  const config = await resolveReceiptPrinterConfig();
  if (!config) return { ok: false, error: "Nenhuma impressora térmica configurada" };
  return printerModule.printReceipt(text, config);
});

ipcMain.handle("printer:open-drawer", async () => {
  const config = await resolveReceiptPrinterConfig();
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

// ─── Printers IPC (múltiplas impressoras, CRUD no backend) ──────────────────
// A lista de impressoras mora no backend (DesktopPrinter), não mais só no
// config.json local — precisa do terminal já pareado pra funcionar.
function requirePairedTerminalId() {
  const terminal = getPairedTerminal();
  if (!terminal?.id) throw new Error("Este terminal ainda não está vinculado. Use Vincular Dispositivo primeiro.");
  return terminal.id;
}

ipcMain.handle("printers:list", async () => {
  try {
    const terminalId = requirePairedTerminalId();
    const terminals = await apiRequestAuthed("GET", "/desktop-terminals");
    const mine = Array.isArray(terminals) ? terminals.find((t) => t.id === terminalId) : null;
    return { ok: true, printers: mine?.printers || [] };
  } catch (err) {
    return { ok: false, error: err.message, printers: [] };
  }
});

ipcMain.handle("printers:create", async (_e, printer) => {
  try {
    const terminalId = requirePairedTerminalId();
    const result = await apiRequestAuthed("POST", `/desktop-terminals/${terminalId}/printers`, printer);
    return { ok: true, printer: result };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle("printers:update", async (_e, printerId, printer) => {
  try {
    const terminalId = requirePairedTerminalId();
    await apiRequestAuthed("PUT", `/desktop-terminals/${terminalId}/printers/${printerId}`, printer);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle("printers:delete", async (_e, printerId) => {
  try {
    const terminalId = requirePairedTerminalId();
    await apiRequestAuthed("DELETE", `/desktop-terminals/${terminalId}/printers/${printerId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle("printers:test", async (_e, config) => printerModule.testConnection(config));

// Imprime num cupom térmico pelo "papel" (role) da impressora, não pela impressora
// especificamente — quem chama não precisa saber qual impressora física está
// configurada, só que quer imprimir "o cupom de venda" (role receipt). Vale só
// pra impressoras térmicas (ESC/POS); role "service_order" (A4) usa a impressora
// padrão do Windows via window.print() direto no renderer, não passa por aqui.
ipcMain.handle("printers:print-by-role", async (_e, role, text) => {
  try {
    const terminalId = requirePairedTerminalId();
    const terminals = await apiRequestAuthed("GET", "/desktop-terminals");
    const mine = Array.isArray(terminals) ? terminals.find((t) => t.id === terminalId) : null;
    const printers = mine?.printers || [];
    const printer = printers.find((p) => p.role === role && p.is_default) || printers.find((p) => p.role === role);
    if (!printer) return { ok: false, error: `Nenhuma impressora térmica configurada para "${role}" neste terminal` };
    return printerModule.printReceipt(text, printer.config);
  } catch (err) {
    return { ok: false, error: err.message };
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

// Alguém tentou abrir uma segunda instância (ícone clicado de novo) — em vez de
// deixar o Electron seguir com esse processo novo (que já se encerrou via
// app.quit() acima), traz a janela existente pra frente.
app.on("second-instance", () => {
  showMainWindow();
});

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
