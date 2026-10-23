const fs = require("fs");
const path = require("path");

// O Windows guarda as configurações do app (config.json: servidor, modo, vínculo do terminal, impressora)
// e o banco local (offline.db: fila de vendas e cache) na pasta %APPDATA%\<nome do app>. Quando o nome do
// app mudou de "BoxSys PDV" para "Store BoxSys", a atualização passou a ler uma pasta vazia e o terminal
// "perdeu" o vínculo e as impressoras — os dados continuavam intactos na pasta antiga. Aqui eles são
// recuperados na primeira abertura depois da atualização, uma única vez (marcador legacy-migrated.json).

const LEGACY_FOLDERS = ["BoxSys PDV", "boxsys-pdv"];
const MARKER = "legacy-migrated.json";

let legacyDirs = [];

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, "utf-8")); } catch { return null; }
}

function alreadyDone(current) {
  return fs.existsSync(path.join(current, MARKER));
}

// Antes de qualquer leitura de config: recupera servidor, modo, vínculo do terminal e impressora.
function beforeDb({ app, log }) {
  try {
    const current = app.getPath("userData");
    if (alreadyDone(current)) return;
    const appData = app.getPath("appData");
    legacyDirs = LEGACY_FOLDERS
      .map((name) => path.join(appData, name))
      .filter((dir) => dir !== current && fs.existsSync(dir) && (fs.existsSync(path.join(dir, "config.json")) || fs.existsSync(path.join(dir, "offline.db"))));
    if (legacyDirs.length === 0) return;

    fs.mkdirSync(current, { recursive: true });
    const currentFile = path.join(current, "config.json");
    const cfg = readJson(currentFile) || {};
    let merged = { ...cfg };
    let changed = false;

    for (const dir of legacyDirs) {
      const old = readJson(path.join(dir, "config.json"));
      if (!old) continue;
      // O vínculo vale pelo terminal_uid antigo: o servidor já tem esse terminal e as impressoras dele.
      if (!merged.pairedTerminal && old.pairedTerminal) {
        merged = { ...merged, terminalUid: old.terminalUid ?? merged.terminalUid, pairedTerminal: old.pairedTerminal };
        changed = true;
      }
      for (const key of ["server", "mode", "printer"]) {
        if (merged[key] === undefined && old[key] !== undefined) { merged[key] = old[key]; changed = true; }
      }
    }
    if (changed) {
      fs.writeFileSync(currentFile, JSON.stringify(merged, null, 2), "utf-8");
      log?.info?.(`[legacy-migration] configuração recuperada de ${legacyDirs.join(", ")}`);
    }
  } catch (err) {
    log?.warn?.(`[legacy-migration] falha ao recuperar configuração: ${err?.message || err}`);
  }
}

// Depois do banco aberto: traz a fila de vendas/caixa pendente e o cache do banco antigo.
function afterDb({ app, offlineDb, log }) {
  try {
    const current = app.getPath("userData");
    if (alreadyDone(current)) return;
    let imported = { ops: 0, cache: 0 };
    for (const dir of legacyDirs) {
      const dbFile = path.join(dir, "offline.db");
      if (!fs.existsSync(dbFile)) continue;
      try {
        const result = offlineDb.importFrom(dbFile);
        imported = { ops: imported.ops + result.ops, cache: imported.cache + result.cache };
      } catch (err) {
        log?.warn?.(`[legacy-migration] não consegui ler ${dbFile}: ${err?.message || err}`);
      }
    }
    fs.writeFileSync(path.join(current, MARKER), JSON.stringify({ at: new Date().toISOString(), from: legacyDirs, imported }, null, 2), "utf-8");
    if (legacyDirs.length) log?.info?.(`[legacy-migration] banco recuperado: ${imported.ops} operações pendentes, ${imported.cache} itens de cache`);
  } catch (err) {
    log?.warn?.(`[legacy-migration] falha ao recuperar o banco: ${err?.message || err}`);
  }
}

module.exports = { beforeDb, afterDb };
