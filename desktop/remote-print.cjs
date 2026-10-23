const { io } = require("socket.io-client");

// Conexão em tempo real do PRÓPRIO processo do Electron (não da tela web): recebe os
// pedidos de impressão remota mesmo sem ninguém logado ou com a janela do PDV fechada,
// e reconecta sozinha se a internet/servidor cair. Autentica com a credencial do
// terminal (uid + token), emitida pelo servidor na primeira vez que alguém loga no app.

const HEARTBEAT_MS = 20_000;

let socket = null;
let heartbeat = null;
let current = { server: null, uid: null, token: null };

function stop() {
  if (heartbeat) { clearInterval(heartbeat); heartbeat = null; }
  if (socket) { socket.removeAllListeners(); socket.disconnect(); socket = null; }
}

// `onPrint(role, text)` resolve a impressora do terminal e imprime. Chamar de novo com
// os mesmos dados é seguro (não recria a conexão); com dados novos, reconecta.
function start({ server, uid, token, onPrint, log }) {
  if (!server || !uid || !token) return false;
  if (socket && current.server === server && current.uid === uid && current.token === token) return true;
  stop();
  current = { server, uid, token };

  socket = io(`https://${server}`, {
    auth: { terminal_uid: uid, terminal_token: token },
    transports: ["websocket"],
    reconnection: true,
    reconnectionDelay: 2000,
    reconnectionDelayMax: 30000,
  });

  socket.on("connect", () => log?.info?.("[remote-print] conectado ao servidor"));
  socket.on("disconnect", (reason) => log?.warn?.(`[remote-print] desconectado: ${reason}`));
  socket.on("connect_error", (err) => log?.warn?.(`[remote-print] erro de conexão: ${err?.message || err}`));
  socket.on("print:requested", async (payload) => {
    if (!payload?.role || !payload?.text) return;
    try {
      const result = await onPrint(payload.role, payload.text);
      if (result && result.ok === false) log?.warn?.(`[remote-print] falha ao imprimir: ${result.error}`);
    } catch (err) {
      log?.warn?.(`[remote-print] falha ao imprimir: ${err?.message || err}`);
    }
  });

  heartbeat = setInterval(() => {
    if (socket?.connected) socket.emit("terminal:heartbeat");
  }, HEARTBEAT_MS);
  return true;
}

function isConnected() {
  return !!socket?.connected;
}

module.exports = { start, stop, isConnected };
