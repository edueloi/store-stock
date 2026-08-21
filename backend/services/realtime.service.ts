import type { Server as HttpServer } from "http";

import jwt from "jsonwebtoken";
import { Server as SocketIOServer } from "socket.io";

import { env } from "../config/env";
import type { AuthTokenPayload } from "../types/auth";

// Eventos em tempo real que o front escuta para atualizar telas sozinho, sem
// precisar de F5 — cada tenant só recebe os próprios eventos (sala `tenant:<id>`).
export type RealtimeEvent =
  | "stock:changed"          // estoque de produto mudou (venda, cancelamento, ajuste, OS)
  | "product:changed"        // produto/catálogo criado, editado ou removido
  | "category:changed"       // categoria criada, editada ou removida
  | "order:created"          // novo pedido/venda registrado
  | "order:updated"          // pedido teve status/dados alterados
  | "order:cancelled"        // pedido cancelado
  | "order:deleted"          // pedido excluído
  | "finance:changed"        // lançamento financeiro (contas a pagar/receber, caixa) criado/editado/removido
  | "cash-session:changed"   // sessão de caixa aberta ou fechada
  | "service-order:changed"  // ordem de serviço criada ou com status alterado
  | "consignment:changed"    // consignação criada, editada ou liquidada
  | "nfce:changed"           // NFC-e emitida, autorizada, rejeitada ou cancelada
  | "nfse:changed";          // NFS-e emitida, autorizada, rejeitada ou cancelada

let io: SocketIOServer | null = null;

export function initRealtime(httpServer: HttpServer) {
  io = new SocketIOServer(httpServer, {
    cors: { origin: true, credentials: true },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token || typeof token !== "string") {
      next(new Error("unauthorized"));
      return;
    }
    try {
      const payload = jwt.verify(token, env.jwtSecret) as AuthTokenPayload;
      (socket.data as { user?: AuthTokenPayload }).user = payload;
      next();
    } catch {
      next(new Error("unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    const user = (socket.data as { user?: AuthTokenPayload }).user;
    if (user?.tenantId) {
      socket.join(`tenant:${user.tenantId}`);
    }
  });

  return io;
}

// Dispara um evento só para os clientes conectados de um tenant específico.
// Chame depois que a alteração já foi persistida com sucesso no banco.
export function emitToTenant(tenantId: number | null | undefined, event: RealtimeEvent, payload: unknown = {}) {
  if (!io || !tenantId) return;
  io.to(`tenant:${tenantId}`).emit(event, payload);
}
