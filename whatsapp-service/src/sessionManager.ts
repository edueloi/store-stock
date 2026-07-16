import { existsSync, mkdirSync, readdirSync, rmSync } from "fs";
import path from "path";
import axios from "axios";
import QRCode from "qrcode";
import { makeWASocket, DisconnectReason, useMultiFileAuthState } from "@whiskeysockets/baileys";
import type { WASocket } from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import pino from "pino";

const logger = pino({ level: process.env.LOG_LEVEL ?? "warn" });

const SESSIONS_DIR = process.env.BAILEYS_SESSIONS_DIR ?? path.join(process.cwd(), "sessions");
const APP_BASE_URL = process.env.APP_BASE_URL ?? "http://localhost:3001";

if (!existsSync(SESSIONS_DIR)) {
  mkdirSync(SESSIONS_DIR, { recursive: true });
}

interface SessionEntry {
  sock: WASocket;
  tenantSlug: string;
  webhookSecret: string;
  qr: string | null;
  connected: boolean;
  state: "open" | "connecting" | "close";
}

const sessions = new Map<number, SessionEntry>();

function sessionFolder(tenantId: number) {
  return path.join(SESSIONS_DIR, String(tenantId));
}

async function forwardMessageToWebhook(tenantSlug: string, webhookSecret: string, data: Record<string, unknown>) {
  try {
    await axios.post(
      `${APP_BASE_URL}/api/whatsapp/webhook/${tenantSlug}`,
      { event: "MESSAGES_UPSERT", data },
      { headers: { "x-whatsapp-secret": webhookSecret }, timeout: 10_000 },
    );
  } catch (err) {
    logger.error({ err, tenantSlug }, "failed to forward inbound message to main backend webhook");
  }
}

async function startSocket(tenantId: number, tenantSlug: string, webhookSecret: string): Promise<SessionEntry> {
  const { state, saveCreds } = await useMultiFileAuthState(sessionFolder(tenantId));

  const sock = makeWASocket({
    auth: state,
    logger: logger.child({ tenantId }),
  });

  const entry: SessionEntry = {
    sock,
    tenantSlug,
    webhookSecret,
    qr: null,
    connected: false,
    state: "connecting",
  };
  sessions.set(tenantId, entry);

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", (update) => {
    const current = sessions.get(tenantId);
    if (!current) return;

    if (update.qr) {
      current.qr = update.qr;
    }

    if (update.connection) {
      current.state = update.connection;
      current.connected = update.connection === "open";
      if (update.connection === "open") {
        current.qr = null;
      }
    }

    if (update.connection === "close") {
      const statusCode = (update.lastDisconnect?.error as Boom | undefined)?.output?.statusCode;
      const loggedOut = statusCode === DisconnectReason.loggedOut;

      if (loggedOut) {
        logger.warn({ tenantId }, "session logged out from the phone, clearing local session");
        sessions.delete(tenantId);
        rmSync(sessionFolder(tenantId), { recursive: true, force: true });
      } else {
        logger.warn({ tenantId, statusCode }, "connection dropped, reconnecting");
        sessions.delete(tenantId);
        void startSocket(tenantId, tenantSlug, webhookSecret);
      }
    }
  });

  sock.ev.on("messages.upsert", (upsert) => {
    if (upsert.type !== "notify") return;
    const current = sessions.get(tenantId);
    if (!current) return;

    for (const message of upsert.messages) {
      if (message.key.fromMe) continue;
      void forwardMessageToWebhook(current.tenantSlug, current.webhookSecret, {
        key: message.key,
        message: message.message,
        pushName: message.pushName,
      });
    }
  });

  return entry;
}

export async function connect(tenantId: number, tenantSlug: string, webhookSecret: string) {
  const existing = sessions.get(tenantId);
  if (existing) {
    // Atualiza os dados de encaminhamento caso tenham mudado (ex: rotação do segredo).
    existing.tenantSlug = tenantSlug;
    existing.webhookSecret = webhookSecret;
    return toStatus(existing);
  }

  const entry = await startSocket(tenantId, tenantSlug, webhookSecret);
  return toStatus(entry);
}

export async function getStatus(tenantId: number) {
  const entry = sessions.get(tenantId);
  if (!entry) {
    return { connected: false, state: "close" as const, qrCode: null, pairingCode: null };
  }
  return toStatus(entry);
}

export async function logout(tenantId: number) {
  const entry = sessions.get(tenantId);
  if (entry) {
    try {
      await entry.sock.logout();
    } catch (err) {
      logger.warn({ err, tenantId }, "error logging out, proceeding to clear local session anyway");
    }
    sessions.delete(tenantId);
  }
  rmSync(sessionFolder(tenantId), { recursive: true, force: true });
}

export async function sendMessage(
  tenantId: number,
  number: string,
  messageType: "text" | "buttons" | "list",
  payload: Record<string, unknown>,
) {
  const entry = sessions.get(tenantId);
  if (!entry || !entry.connected) {
    throw new Error("WhatsApp não está conectado para este tenant.");
  }

  const jid = number.includes("@") ? number : `${number}@s.whatsapp.net`;

  // Baileys não tem um equivalente nativo de "botões"/"lista" interativa estável na
  // v7 (a Meta restringiu esses templates a contas Business API oficiais) — para
  // manter paridade de UX, achata em texto simples com as opções numeradas.
  let content: Record<string, unknown>;
  if (messageType === "text") {
    content = { text: String(payload.text ?? "") };
  } else if (messageType === "buttons") {
    const buttons = Array.isArray(payload.buttons) ? (payload.buttons as Array<Record<string, string>>) : [];
    const lines = buttons.map((b, i) => `${i + 1}. ${b.title ?? b.displayText ?? ""}`).join("\n");
    content = { text: `${payload.title ?? ""}\n${payload.description ?? ""}\n\n${lines}`.trim() };
  } else {
    const sections = Array.isArray(payload.sections) ? (payload.sections as Array<Record<string, unknown>>) : [];
    const rows = sections.flatMap((s) => (Array.isArray(s.rows) ? (s.rows as Array<Record<string, string>>) : []));
    const lines = rows.map((r, i) => `${i + 1}. ${r.title ?? ""}`).join("\n");
    content = { text: `${payload.title ?? ""}\n${payload.description ?? ""}\n\n${lines}`.trim() };
  }

  const result = await entry.sock.sendMessage(jid, content as never);
  return { key: result?.key ?? {} };
}

export async function hydrateFromDisk() {
  if (!existsSync(SESSIONS_DIR)) return;

  const entries = readdirSync(SESSIONS_DIR, { withFileTypes: true }).filter((e) => e.isDirectory());
  for (const dirEntry of entries) {
    const tenantId = Number(dirEntry.name);
    if (!Number.isFinite(tenantId)) continue;

    // Sem tenantSlug/webhookSecret ainda (não persistidos em disco de propósito —
    // o backend principal é quem detém essa informação). A sessão reconecta e passa
    // a aceitar mensagens assim que o backend principal chamar /connect de novo
    // (o que acontece automaticamente no próximo polling de connection-status).
    // Até lá, mantemos a sessão pareada mas sem encaminhar mensagens.
    try {
      await startSocket(tenantId, "", "");
      logger.info({ tenantId }, "rehydrated session from disk");
    } catch (err) {
      logger.error({ err, tenantId }, "failed to rehydrate session from disk");
    }
  }
}

async function toStatus(entry: SessionEntry) {
  return {
    connected: entry.connected,
    state: entry.state,
    qrCode: entry.qr ? await QRCode.toDataURL(entry.qr) : null,
    pairingCode: null as string | null,
  };
}
