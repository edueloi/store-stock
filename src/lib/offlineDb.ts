// ─── Offline storage for the PDV (IndexedDB) ────────────────────────────────
// Two stores:
//   "cache"        — key/value snapshots of API data (products, categories, tenant…)
//   "pendingSales" — sales completed while offline, waiting to sync

const DB_NAME = "boxsys-pdv-offline";
const DB_VERSION = 1;

export interface PendingSale {
  localId: string;            // uuid — also sent as clientSaleId for idempotency
  body: Record<string, unknown>; // exact payload for POST /api/sales
  createdAt: string;          // ISO timestamp of when the sale happened
  total: number;
  customerName?: string;
  attempts?: number;          // failed sync attempts so far
  lastError?: string;         // last server rejection message (4xx/5xx)
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("cache")) db.createObjectStore("cache");
      if (!db.objectStoreNames.contains("pendingSales")) db.createObjectStore("pendingSales", { keyPath: "localId" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode);
        const r = fn(t.objectStore(store));
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
        t.oncomplete = () => db.close();
      })
  );
}

// ─── cache ───────────────────────────────────────────────────────────────────
export function cacheSet(key: string, value: unknown): Promise<unknown> {
  return tx("cache", "readwrite", (s) => s.put(value, key)).catch(() => null);
}

export function cacheGet<T = unknown>(key: string): Promise<T | undefined> {
  return tx<T>("cache", "readonly", (s) => s.get(key) as IDBRequest<T>).catch(() => undefined);
}

// ─── pending sales queue ─────────────────────────────────────────────────────
export function queueSale(sale: PendingSale): Promise<unknown> {
  return tx("pendingSales", "readwrite", (s) => s.put(sale));
}

export function getPendingSales(): Promise<PendingSale[]> {
  return tx<PendingSale[]>("pendingSales", "readonly", (s) => s.getAll() as IDBRequest<PendingSale[]>).catch(() => []);
}

export function removePendingSale(localId: string): Promise<unknown> {
  return tx("pendingSales", "readwrite", (s) => s.delete(localId));
}

export function countPendingSales(): Promise<number> {
  return tx<number>("pendingSales", "readonly", (s) => s.count()).catch(() => 0);
}
