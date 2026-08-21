import { io, type Socket } from "socket.io-client";

import { getStoredToken } from "./session";

// Espelha backend/services/realtime.service.ts — mantenha os dois em sincronia.
export type RealtimeEvent =
  | "stock:changed"
  | "product:changed"
  | "category:changed"
  | "order:created"
  | "order:updated"
  | "order:cancelled"
  | "order:deleted"
  | "finance:changed"
  | "cash-session:changed"
  | "service-order:changed"
  | "consignment:changed"
  | "nfce:changed"
  | "nfse:changed";

let socket: Socket | null = null;
let socketToken: string | null = null;

function getSocket(): Socket | null {
  const token = getStoredToken();
  if (!token) return null;

  if (socket && socketToken === token) return socket;

  // Token mudou (login/logout/troca de usuário) — descarta o socket antigo e
  // reconecta autenticado com o novo.
  socket?.disconnect();
  socketToken = token;
  socket = io({ auth: { token }, transports: ["websocket", "polling"] });
  return socket;
}

/**
 * Assina um evento em tempo real. Retorna uma função de limpeza — chame no
 * cleanup do useEffect da tela.
 *
 * Ex.: useEffect(() => onRealtime("stock:changed", () => fetchProducts()), []);
 */
export function onRealtime(event: RealtimeEvent, handler: (payload: any) => void): () => void {
  const s = getSocket();
  if (!s) return () => {};
  s.on(event, handler);
  return () => { s.off(event, handler); };
}

/** Assina vários eventos com o mesmo handler — útil quando uma tela depende de mais de um domínio. */
export function onRealtimeAny(events: RealtimeEvent[], handler: (payload: any) => void): () => void {
  const s = getSocket();
  if (!s) return () => {};
  events.forEach((event) => s.on(event, handler));
  return () => { events.forEach((event) => s.off(event, handler)); };
}

/** Chame no logout para não deixar o socket autenticado do usuário anterior pendurado. */
export function disconnectRealtime() {
  socket?.disconnect();
  socket = null;
  socketToken = null;
}
