// ─── Local offline SQLite database (Electron main process) ─────────────────
// Buffer used only while the terminal has no internet: caches catalog
// snapshots and queues operations (sales, cash open/close) created offline.
// The server (MySQL, via the backend API) remains the single source of
// truth — rows here are drained and deleted once synced by the renderer.

const path = require("path");
const Database = require("better-sqlite3");

let db = null;

function initDb(app) {
  if (db) return db;
  const dbPath = path.join(app.getPath("userData"), "offline.db");
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS cache_snapshots (
      key TEXT PRIMARY KEY,
      value_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS pending_ops (
      local_id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT
    );
  `);

  return db;
}

function saveCache(key, value) {
  db.prepare(
    `INSERT INTO cache_snapshots (key, value_json, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at`
  ).run(key, JSON.stringify(value ?? null), new Date().toISOString());
  return { ok: true };
}

function getCache(key) {
  const row = db.prepare(`SELECT value_json FROM cache_snapshots WHERE key = ?`).get(key);
  if (!row) return undefined;
  try {
    return JSON.parse(row.value_json);
  } catch {
    return undefined;
  }
}

function enqueueOp(type, localId, payload, createdAt) {
  db.prepare(
    `INSERT INTO pending_ops (local_id, type, payload_json, created_at, attempts, last_error)
     VALUES (?, ?, ?, ?, 0, NULL)
     ON CONFLICT(local_id) DO UPDATE SET payload_json = excluded.payload_json`
  ).run(localId, type, JSON.stringify(payload ?? {}), createdAt || new Date().toISOString());
  return { ok: true };
}

function rowToOp(row) {
  let payload = {};
  try {
    payload = JSON.parse(row.payload_json);
  } catch {
    payload = {};
  }
  return {
    localId: row.local_id,
    type: row.type,
    createdAt: row.created_at,
    attempts: row.attempts,
    lastError: row.last_error || undefined,
    ...payload,
  };
}

function listOps(type) {
  const rows = type
    ? db.prepare(`SELECT * FROM pending_ops WHERE type = ? ORDER BY created_at ASC`).all(type)
    : db.prepare(`SELECT * FROM pending_ops ORDER BY created_at ASC`).all();
  return rows.map(rowToOp);
}

function countOps(type) {
  const row = type
    ? db.prepare(`SELECT COUNT(*) AS c FROM pending_ops WHERE type = ?`).get(type)
    : db.prepare(`SELECT COUNT(*) AS c FROM pending_ops`).get();
  return row.c;
}

function removeOp(localId) {
  db.prepare(`DELETE FROM pending_ops WHERE local_id = ?`).run(localId);
  return { ok: true };
}

module.exports = {
  initDb,
  saveCache,
  getCache,
  enqueueOp,
  listOps,
  countOps,
  removeOp,
};
