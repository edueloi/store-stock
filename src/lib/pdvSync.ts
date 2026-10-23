import {
  getPendingSales, getPendingCashOps, queueSale, queueCashOp,
  removePendingSale, removePendingCashOp, type PendingSale, type PendingCashOp,
} from "./offlineDb";

// Drena a fila offline do PDV (vendas + abertura/fechamento de caixa) para o servidor.
// Mesma regra do PDV padrão (PDVStandalone): tudo em ordem cronológica, para uma venda nunca
// sincronizar antes da abertura de caixa de que depende; vendas usam clientSaleId, então
// reenviar após uma resposta perdida não duplica nada.

export interface SyncResult {
  synced: number;
  /** localId da abertura de caixa offline → id real no servidor (quando já sincronizada). */
  sessionIdByLocalId: Map<string, number>;
  /** true se o servidor respondeu 401 (login expirado/inválido). */
  unauthorized: boolean;
}

async function errorMessage(res: Response) {
  let msg = `Erro ${res.status}`;
  try { const j = await res.json(); if (j?.error) msg = j.error; } catch { /* mantém o status */ }
  return msg;
}

async function currentSessionId(token: string): Promise<number | null> {
  try {
    const res = await fetch("/api/cash-sessions/current", { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return null;
    return (await res.json())?.session?.id ?? null;
  } catch {
    return null;
  }
}

export async function syncPendingOps(token: string): Promise<SyncResult> {
  const result: SyncResult = { synced: 0, sessionIdByLocalId: new Map(), unauthorized: false };
  if (!token || !navigator.onLine) return result;

  const [sales, cashOps] = await Promise.all([getPendingSales(), getPendingCashOps()]);
  type Item = { kind: "sale"; data: PendingSale } | { kind: "cash"; data: PendingCashOp };
  const items: Item[] = [
    ...sales.map((data): Item => ({ kind: "sale", data })),
    ...cashOps.map((data): Item => ({ kind: "cash", data })),
  ].sort((a, b) => a.data.createdAt.localeCompare(b.data.createdAt));

  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  for (const item of items) {
    try {
      if (item.kind === "cash" && item.data.type === "cash_open") {
        const op = item.data;
        const res = await fetch("/api/cash-sessions/open", {
          method: "POST", headers,
          body: JSON.stringify({ openingAmount: op.openingAmount ?? 0, openingNote: op.openingNote }),
        });
        if (res.ok) {
          result.sessionIdByLocalId.set(op.localId, (await res.json()).session.id);
          await removePendingCashOp(op.localId);
          result.synced++;
        } else if (res.status === 401) {
          result.unauthorized = true;
          break;
        } else if (res.status === 409) {
          // uma tentativa anterior já abriu (resposta perdida) — reaproveita a sessão
          const serverId = await currentSessionId(token);
          if (serverId != null) result.sessionIdByLocalId.set(op.localId, serverId);
          await removePendingCashOp(op.localId);
        } else {
          await queueCashOp({ ...op, attempts: (op.attempts ?? 0) + 1, lastError: await errorMessage(res) });
        }
      } else if (item.kind === "cash" && item.data.type === "cash_close") {
        const op = item.data;
        const sessionId = op.sessionId ?? (op.sessionLocalId ? result.sessionIdByLocalId.get(op.sessionLocalId) : undefined);
        if (sessionId == null) {
          await queueCashOp({ ...op, attempts: (op.attempts ?? 0) + 1, lastError: "Aguardando abertura de caixa sincronizar" });
          continue;
        }
        const res = await fetch(`/api/cash-sessions/${sessionId}/close`, {
          method: "POST", headers,
          body: JSON.stringify({ countedAmount: op.countedAmount ?? 0, countedBreakdown: op.countedBreakdown, closingNote: op.closingNote }),
        });
        if (res.ok || res.status === 404) {
          // 404 = já fechada por uma tentativa anterior cuja resposta se perdeu
          await removePendingCashOp(op.localId);
          result.synced++;
        } else if (res.status === 401) {
          result.unauthorized = true;
          break;
        } else {
          await queueCashOp({ ...op, attempts: (op.attempts ?? 0) + 1, lastError: await errorMessage(res) });
        }
      } else if (item.kind === "sale") {
        const sale = item.data;
        const body: Record<string, unknown> = { ...sale.body, isOfflineSync: true };
        const localCashId = typeof body.cashSessionLocalId === "string" ? body.cashSessionLocalId : undefined;
        if (localCashId) {
          const resolved = result.sessionIdByLocalId.get(localCashId);
          if (resolved == null) {
            await queueSale({ ...sale, attempts: (sale.attempts ?? 0) + 1, lastError: "Aguardando abertura de caixa sincronizar" });
            continue;
          }
          body.cashSessionId = resolved;
          delete body.cashSessionLocalId;
        }
        const res = await fetch("/api/sales", { method: "POST", headers, body: JSON.stringify(body) });
        if (res.ok) {
          await removePendingSale(sale.localId);
          result.synced++;
        } else if (res.status === 401) {
          result.unauthorized = true;
          break;
        } else {
          await queueSale({ ...sale, attempts: (sale.attempts ?? 0) + 1, lastError: await errorMessage(res) });
        }
      }
    } catch {
      break; // a rede caiu no meio — o que sobrou continua na fila
    }
  }
  return result;
}
