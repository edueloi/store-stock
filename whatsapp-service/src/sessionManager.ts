import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import path from "path";
import axios from "axios";
import QRCode from "qrcode";
import { makeWASocket, DisconnectReason, useMultiFileAuthState, jidDecode, fetchLatestBaileysVersion } from "@whiskeysockets/baileys";
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

function metaFile(tenantId: number) {
  return path.join(sessionFolder(tenantId), "meta.json");
}

// tenantSlug/webhookSecret precisam sobreviver a um restart do processo — sem isso,
// uma sessão reidratada do disco (hydrateFromDisk) não sabe para onde encaminhar as
// mensagens recebidas até que o backend principal chame /connect de novo, o que só
// acontece enquanto alguém está com a tela do WhatsApp aberta no painel. Persistir
// esses dois campos junto com a sessão evita esse buraco.
function saveMeta(tenantId: number, tenantSlug: string, webhookSecret: string) {
  try {
    mkdirSync(sessionFolder(tenantId), { recursive: true });
    writeFileSync(metaFile(tenantId), JSON.stringify({ tenantSlug, webhookSecret }));
  } catch (err) {
    logger.error({ err, tenantId }, "failed to persist session metadata");
  }
}

function loadMeta(tenantId: number): { tenantSlug: string; webhookSecret: string } | null {
  try {
    const raw = readFileSync(metaFile(tenantId), "utf8");
    const parsed = JSON.parse(raw);
    return { tenantSlug: String(parsed.tenantSlug ?? ""), webhookSecret: String(parsed.webhookSecret ?? "") };
  } catch {
    return null;
  }
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

async function startSocket(tenantId: number, tenantSlug: string, webhookSecret: string, reconnectAttempt = 0): Promise<SessionEntry> {
  if (tenantSlug && webhookSecret) {
    saveMeta(tenantId, tenantSlug, webhookSecret);
  }

  const { state, saveCreds } = await useMultiFileAuthState(sessionFolder(tenantId));

  // A versão do protocolo WA Web vem fixa no build da lib (pin "7.0.0-rc13") — o
  // WhatsApp já invalidou essa versão no servidor deles, então toda conexão morria
  // com "statusCode 405" antes mesmo de chegar a emitir um QR. Buscar a versão atual
  // evita depender de uma versão travada na hora em que essa dependência foi publicada.
  const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: undefined }));

  const sock = makeWASocket({
    auth: state,
    logger: logger.child({ tenantId }),
    ...(version ? { version } : {}),
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
        reconnectAttempt = 0; // conexão estável de novo — próxima queda recomeça o backoff do zero
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
        // Sem backoff aqui, isso reconectava em loop apertado (às vezes múltiplas
        // vezes por segundo) sem nunca dar tempo do lado do WhatsApp — mantém um
        // atraso crescente, com teto, entre tentativas.
        const delayMs = Math.min(2000 * (reconnectAttempt + 1), 30_000);
        logger.warn({ tenantId, statusCode, reconnectAttempt, delayMs }, "connection dropped, reconnecting");
        sessions.delete(tenantId);
        setTimeout(() => { void startSocket(tenantId, tenantSlug, webhookSecret, reconnectAttempt + 1); }, delayMs);
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
    saveMeta(tenantId, tenantSlug, webhookSecret);
    return toStatus(existing);
  }

  const entry = await startSocket(tenantId, tenantSlug, webhookSecret);
  return toStatus(entry);
}

export async function getStatus(tenantId: number) {
  const entry = sessions.get(tenantId);
  if (!entry) {
    return { connected: false, state: "close" as const, qrCode: null, pairingCode: null, phoneNumber: null };
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
  messageType: "text" | "buttons" | "list" | "document",
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
  } else if (messageType === "document") {
    const base64 = String(payload.base64 ?? "");
    if (!base64) throw new Error("Conteúdo do documento (base64) é obrigatório.");
    content = {
      document: Buffer.from(base64, "base64"),
      fileName: String(payload.fileName ?? "documento.pdf"),
      mimetype: String(payload.mimetype ?? "application/pdf"),
      caption: payload.caption ? String(payload.caption) : undefined,
    };
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

    const meta = loadMeta(tenantId);
    if (!meta) {
      logger.warn({ tenantId }, "no persisted metadata for session, reconnecting without webhook forwarding until next /connect call");
    }

    try {
      await startSocket(tenantId, meta?.tenantSlug ?? "", meta?.webhookSecret ?? "");
      logger.info({ tenantId }, "rehydrated session from disk");
    } catch (err) {
      logger.error({ err, tenantId }, "failed to rehydrate session from disk");
    }
  }
}

async function toStatus(entry: SessionEntry) {
  const jid = entry.sock.user?.id;
  const phoneNumber = jid ? (jidDecode(jid)?.user ?? null) : null;

  return {
    connected: entry.connected,
    state: entry.state,
    qrCode: entry.qr ? await QRCode.toDataURL(entry.qr) : null,
    pairingCode: null as string | null,
    phoneNumber,
  };
}
