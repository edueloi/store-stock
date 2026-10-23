import { cacheGet, cacheSet } from "./offlineDb";

// Login do PDV sem internet. A cada login online bem-sucedido o app guarda no banco local
// (SQLite do Electron) uma verificação da senha — PBKDF2 com sal próprio, nunca a senha em
// si — junto com o token e o usuário recebidos. Sem servidor, quem já entrou neste
// computador antes consegue entrar de novo; as vendas ficam na fila e sincronizam depois
// com o mesmo token (que não expira).

const CACHE_KEY = "offline_logins";
const ITERATIONS = 150_000;
// Quanto tempo o acesso offline vale sem o usuário se conectar de novo. Dentro desse prazo,
// qualquer uso online (abrir o PDV com internet) renova; passou disso, a próxima entrada
// precisa de internet — assim senha trocada ou usuário removido deixam de valer offline.
export const OFFLINE_LOGIN_MAX_AGE_DAYS = 7;

interface StoredLogin {
  salt: string;
  hash: string;
  token: string;
  user: unknown;
  at: number; // última vez que este acesso foi confirmado pelo servidor (ms)
}

type LoginMap = Record<string, StoredLogin>;

const normalize = (identifier: string) => identifier.trim().toLowerCase();

function toHex(buf: ArrayBuffer) {
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function fromHex(hex: string) {
  return new Uint8Array((hex.match(/.{2}/g) ?? []).map((h) => parseInt(h, 16)));
}

async function derive(password: string, salt: Uint8Array) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  return toHex(await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" }, key, 256));
}

export async function rememberLogin(identifier: string, password: string, token: string, user: unknown) {
  try {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const logins = (await cacheGet<LoginMap>(CACHE_KEY)) ?? {};
    logins[normalize(identifier)] = { salt: toHex(salt.buffer), hash: await derive(password, salt), token, user, at: Date.now() };
    await cacheSet(CACHE_KEY, logins);
  } catch {
    // sem Electron/banco local: login offline simplesmente não fica disponível
  }
}

// O servidor recusou as credenciais (senha trocada, usuário removido): esquece o acesso offline.
export async function forgetLogin(identifier: string) {
  try {
    const logins = (await cacheGet<LoginMap>(CACHE_KEY)) ?? {};
    if (logins[normalize(identifier)]) {
      delete logins[normalize(identifier)];
      await cacheSet(CACHE_KEY, logins);
    }
  } catch { /* sem banco local */ }
}

// O usuário está usando o sistema COM internet e o servidor aceitou o token dele: renova o
// prazo do acesso offline.
export async function renewLogin(userId: number | undefined) {
  if (userId == null) return;
  try {
    const logins = (await cacheGet<LoginMap>(CACHE_KEY)) ?? {};
    let changed = false;
    for (const entry of Object.values(logins)) {
      if ((entry.user as { id?: number } | null)?.id === userId) { entry.at = Date.now(); changed = true; }
    }
    if (changed) await cacheSet(CACHE_KEY, logins);
  } catch { /* sem banco local */ }
}

// Retorna a sessão guardada se a senha confere; "unknown" se este usuário nunca entrou
// neste computador; "wrong" se a senha não bate; "expired" se passou do prazo offline.
export async function verifyOfflineLogin(identifier: string, password: string): Promise<StoredLogin | "unknown" | "wrong" | "expired"> {
  const logins = (await cacheGet<LoginMap>(CACHE_KEY)) ?? {};
  const stored = logins[normalize(identifier)];
  if (!stored) return "unknown";
  if (Date.now() - (stored.at ?? 0) > OFFLINE_LOGIN_MAX_AGE_DAYS * 86_400_000) return "expired";
  const hash = await derive(password, fromHex(stored.salt));
  return hash === stored.hash ? stored : "wrong";
}
