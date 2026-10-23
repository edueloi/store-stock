import { io, type Socket } from "socket.io-client";

import { getStoredToken } from "./session";

// Espelha backend/services/realtime.service.ts — mantenha os dois em sincronia.
export type RealtimeEvent =
  | "stock:changed"
  | "product:changed"
  | "category:changed"
  | "quote:requested"
  | "order:created"
  | "order:updated"
  | "order:cancelled"
  | "order:deleted"
  | "order:returned"
  | "finance:changed"
  | "cash-session:changed"
  | "customer-credit:changed"
  | "service-order:changed"
  | "service-category:changed"
  | "consignment:changed"
  | "nfce:changed"
  | "nfse:changed"
  | "print:requested";

let socket: Socket | null = null;
let socketToken: string | null = null;
let desktopTerminalUid: string | null = null;

// Assinaturas ativas, independentes do socket atual: quando o socket é recriado (logout/
// login, troca de token) elas são reanexadas ao novo. Sem isso, quem assinou antes (como a
// ponte de impressão remota do Electron) ficava preso ao socket antigo e perdia os eventos.
const subscriptions = new Set<{ event: RealtimeEvent; handler: (payload: any) => void }>();

function getSocket(): Socket | null {
  const token = getStoredToken();
  if (!token) return null;

  if (socket && socketToken === token) return socket;

  // Token mudou (login/logout/troca de usuário) — descarta o socket antigo e
  // reconecta autenticado com o novo.
  socket?.disconnect();
  socketToken = token;
  socket = io({
    auth: { token, ...(desktopTerminalUid ? { terminal_uid: desktopTerminalUid } : {}) },
    transports: ["websocket", "polling"],
  });
  subscriptions.forEach((sub) => socket!.on(sub.event, sub.handler));
  return socket;
}

/** Registra o Electron pareado para que o servidor entregue impressões a ele. */
export function identifyDesktopTerminal(terminalUid: string) {
  if (!terminalUid) return;
  desktopTerminalUid = terminalUid;
  // Recria o socket se ele foi derrubado (ex.: logout ao fechar o caixa) — o bridge chama
  // isto a cada 15s, então o terminal volta sozinho assim que houver login.
  const s = getSocket();
  if (!s) return;

  s.auth = { token: socketToken, terminal_uid: terminalUid };
  // Além de identificar conexões novas, isso mantém o "visto por último" fiel.
  if (s.connected) s.emit("terminal:identify", terminalUid);
}

/**
 * Assina um evento em tempo real. Retorna uma função de limpeza — chame no
 * cleanup do useEffect da tela.
 *
 * Ex.: useEffect(() => onRealtime("stock:changed", () => fetchProducts()), []);
 */
export function onRealtime(event: RealtimeEvent, handler: (payload: any) => void): () => void {
  const sub = { event, handler };
  const before = socket;
  subscriptions.add(sub);
  const s = getSocket();
  // Socket recém-criado já recebeu todas as assinaturas (incluindo esta).
  if (s && s === before) s.on(event, handler);
  return () => {
    subscriptions.delete(sub);
    socket?.off(event, handler);
  };
}

/** Assina vários eventos com o mesmo handler — útil quando uma tela depende de mais de um domínio. */
export function onRealtimeAny(events: RealtimeEvent[], handler: (payload: any) => void): () => void {
  const unsubs = events.map((event) => onRealtime(event, handler));
  return () => unsubs.forEach((unsub) => unsub());
}

/** Chame no logout para não deixar o socket autenticado do usuário anterior pendurado. */
export function disconnectRealtime() {
  socket?.disconnect();
  socket = null;
  socketToken = null;
  desktopTerminalUid = null;
}
