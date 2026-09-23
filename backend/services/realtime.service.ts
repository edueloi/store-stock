import type { Server as HttpServer } from "http";

import jwt from "jsonwebtoken";
import { Server as SocketIOServer } from "socket.io";

import { env } from "../config/env";
import { prisma } from "../config/prisma";
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
  | "order:returned"         // devolução/troca registrada num pedido
  | "finance:changed"        // lançamento financeiro (contas a pagar/receber, caixa) criado/editado/removido
  | "cash-session:changed"   // sessão de caixa aberta ou fechada
  | "customer-credit:changed" // saldo de crédito de troca de um cliente mudou
  | "service-order:changed"  // ordem de serviço criada ou com status alterado
  | "consignment:changed"    // consignação criada, editada ou liquidada
  | "nfce:changed"           // NFC-e emitida, autorizada, rejeitada ou cancelada
  | "nfse:changed"           // NFS-e emitida, autorizada, rejeitada ou cancelada
  | "print:requested";       // pedido de impressão remota pra um terminal desktop específico

let io: SocketIOServer | null = null;

function terminalRoom(terminalUid: string) {
  return `desktop-terminal:${terminalUid}`;
}

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

    // Um cliente web comum só entra na sala do tenant. O Electron pareado também
    // se identifica com seu UID local para receber apenas suas próprias impressões.
    // A posse é conferida no banco antes de entrar na sala.
    const identifyTerminal = async (terminalUid: unknown) => {
      if (!user?.tenantId || typeof terminalUid !== "string" || !terminalUid) return;
      try {
        const terminal = await prisma.desktopTerminal.findFirst({
          where: { terminal_uid: terminalUid, tenant_id: user.tenantId },
          select: { id: true },
        });
        if (!terminal) return;
        socket.join(terminalRoom(terminalUid));
        await prisma.desktopTerminal.update({
          where: { id: terminal.id },
          data: { last_seen_at: new Date() },
        });
      } catch {
        // A conexão em tempo real continua útil para os demais eventos mesmo se
        // não for possível atualizar o status do terminal neste momento.
      }
    };

    void identifyTerminal(socket.handshake.auth?.terminal_uid);
    socket.on("terminal:identify", (terminalUid) => { void identifyTerminal(terminalUid); });
  });

  return io;
}

// Dispara um evento só para os clientes conectados de um tenant específico.
// Chame depois que a alteração já foi persistida com sucesso no banco.
export function emitToTenant(tenantId: number | null | undefined, event: RealtimeEvent, payload: unknown = {}) {
  if (!io || !tenantId) return;
  io.to(`tenant:${tenantId}`).emit(event, payload);
}

// Retorna false quando o terminal pareado não está conectado. Assim a API não
// confirma uma impressão que seria inevitavelmente perdida.
export function emitToTerminal(terminalUid: string, event: RealtimeEvent, payload: unknown = {}) {
  if (!io || !io.sockets.adapter.rooms.get(terminalRoom(terminalUid))?.size) return false;
  io.to(terminalRoom(terminalUid)).emit(event, payload);
  return true;
}
