// ─── Offline storage for the PDV (SQLite, via the Electron main process) ───
// The renderer never touches the database file directly — it calls the IPC
// bridge exposed in desktop/preload.cjs, backed by desktop/db.cjs.
// Two kinds of rows:
//   "cache_snapshots" — key/value snapshots of API data (products, categories, tenant…)
//   "pending_ops"      — operations queued while offline (sale, cash_open, cash_close)
// The server (MySQL) stays the single source of truth; rows here are a
// temporary buffer drained by the sync worker in PDVStandalone.tsx.

function desktop() {
  if (!window.boxsysDesktop) throw new Error("boxsysDesktop bridge indisponível");
  return window.boxsysDesktop;
}

export interface PendingSale {
  localId: string;               // uuid — also sent as clientSaleId for idempotency
  body: Record<string, unknown>; // exact payload for POST /api/sales
  createdAt: string;             // ISO timestamp of when the sale happened
  total: number;
  customerName?: string;
  attempts?: number;             // failed sync attempts so far
  lastError?: string;            // last server rejection message (4xx/5xx)
}

export type CashOpType = "cash_open" | "cash_close";

export interface PendingCashOp {
  localId: string;
  type: CashOpType;
  createdAt: string;
  attempts?: number;
  lastError?: string;
  // cash_open payload
  openingAmount?: number;
  openingNote?: string;
  // cash_close payload — sessionId is the real server id (when already known),
  // sessionLocalId points back at the cash_open op when the session itself
  // was opened offline and hasn't synced yet
  sessionId?: number;
  sessionLocalId?: string;
  countedAmount?: number;
  countedBreakdown?: Record<string, number>;
  closingNote?: string;
}

// ─── cache ───────────────────────────────────────────────────────────────────
export function cacheSet(key: string, value: unknown): Promise<unknown> {
  return desktop().dbSaveCache(key, value).catch(() => null);
}

export function cacheGet<T = unknown>(key: string): Promise<T | undefined> {
  return desktop().dbGetCache<T>(key).catch(() => undefined);
}

// ─── pending sales queue ─────────────────────────────────────────────────────
export function queueSale(sale: PendingSale): Promise<unknown> {
  const { localId, createdAt, ...payload } = sale;
  return desktop().dbEnqueueOp("sale", localId, payload, createdAt);
}

export function getPendingSales(): Promise<PendingSale[]> {
  return desktop()
    .dbListOps("sale")
    .then((rows) => rows.map((r) => r as unknown as PendingSale))
    .catch(() => []);
}

export function removePendingSale(localId: string): Promise<unknown> {
  return desktop().dbRemoveOp(localId);
}

export function countPendingSales(): Promise<number> {
  return desktop().dbCountOps("sale").catch(() => 0);
}

// ─── pending cash-session queue ──────────────────────────────────────────────
export function queueCashOp(op: PendingCashOp): Promise<unknown> {
  const { localId, createdAt, type, ...payload } = op;
  return desktop().dbEnqueueOp(type, localId, payload, createdAt);
}

export function getPendingCashOps(): Promise<PendingCashOp[]> {
  return Promise.all([desktop().dbListOps("cash_open"), desktop().dbListOps("cash_close")])
    .then(([opens, closes]) => [...opens, ...closes].map((r) => r as unknown as PendingCashOp))
    .catch(() => []);
}

export function removePendingCashOp(localId: string): Promise<unknown> {
  return desktop().dbRemoveOp(localId);
}

export function countPendingCashOps(): Promise<number> {
  return Promise.all([desktop().dbCountOps("cash_open"), desktop().dbCountOps("cash_close")])
    .then(([a, b]) => a + b)
    .catch(() => 0);
}
