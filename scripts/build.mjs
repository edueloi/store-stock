// Build de produção SEM derrubar o site e SEM quebrar quem está com o sistema aberto.
//
// O problema antigo: `vite build` apagava a pasta `dist` e a reconstruía (1–3 min). Nesse intervalo o site respondia
// "Not Found"; no fim, os arquivos com hash do build anterior (assets/Algo-abc123.js) já não existiam, e as abas abertas
// falhavam ao abrir uma tela nova ("Failed to fetch dynamically imported module").
//
// O que este script faz:
//   1. constrói tudo em `dist-build` (o `dist` publicado não é tocado; se o build falhar, o site continua como está);
//   2. guarda os arquivos de `dist/assets` da versão ATUAL em `.asset-archive/` (o servidor usa isso quando alguém pede
//      um arquivo antigo que não existe mais no `dist`);
//   3. troca `dist-build` por `dist` de uma vez (renomear pasta é instantâneo);
//   4. apaga do arquivo o que tem mais de 30 dias.
//
// Uso: `npm run build` (já chama este script). O restart do pm2 continua sendo feito no deploy.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { build as esbuildBuild } from "esbuild";

const root = process.cwd();
const dist = path.join(root, "dist");
const staging = path.join(root, "dist-build");
const old = path.join(root, "dist-old");
const archive = path.join(root, ".asset-archive");
const KEEP_MS = 30 * 24 * 60 * 60 * 1000;

function run(label, script, args) {
  const r = spawnSync(process.execPath, [script, ...args], { stdio: "inherit", cwd: root });
  if (r.status !== 0) {
    console.error(`\n✖ ${label} falhou — o site publicado (dist) NÃO foi alterado.`);
    process.exit(r.status ?? 1);
  }
}

fs.rmSync(staging, { recursive: true, force: true });

run("vite build", path.join(root, "node_modules", "vite", "bin", "vite.js"), ["build", "--outDir", "dist-build", "--emptyOutDir"]);
// esbuild pela API (no Linux o bin/esbuild é um binário nativo e não roda com "node"; a API funciona em qualquer sistema)
try {
  await esbuildBuild({
    entryPoints: ["server.ts"], bundle: true, platform: "node", format: "cjs", packages: "external", sourcemap: true,
    outfile: "dist-build/server.cjs", absWorkingDir: root, logLevel: "info",
  });
} catch {
  console.error("\n✖ esbuild do servidor falhou — o site publicado (dist) NÃO foi alterado.");
  process.exit(1);
}

// 2) arquivo de apoio: assets da versão que está no ar agora
const liveAssets = path.join(dist, "assets");
if (fs.existsSync(liveAssets)) {
  fs.mkdirSync(archive, { recursive: true });
  let copied = 0;
  for (const name of fs.readdirSync(liveAssets)) {
    const target = path.join(archive, name);
    if (!fs.existsSync(target)) { fs.copyFileSync(path.join(liveAssets, name), target); copied++; }
  }
  console.log(`▶ Arquivo de apoio: ${copied} arquivo(s) da versão atual guardados em .asset-archive/`);
}

// 3) troca instantânea
fs.rmSync(old, { recursive: true, force: true });
const hadDist = fs.existsSync(dist);
try {
  if (hadDist) fs.renameSync(dist, old);
  fs.renameSync(staging, dist);
} catch (err) {
  // desfaz: devolve a versão anterior para o lugar, para o site nunca ficar sem pasta publicada
  if (!fs.existsSync(dist) && fs.existsSync(old)) fs.renameSync(old, dist);
  console.error("\n✖ Não foi possível trocar a pasta publicada (" + (err && err.code ? err.code : err) + "). A versão anterior foi mantida.");
  process.exit(1);
}
fs.rmSync(old, { recursive: true, force: true });
console.log("▶ Nova versão publicada em dist/ (troca instantânea).");

// 4) limpeza: guarda 30 dias
if (fs.existsSync(archive)) {
  const limit = Date.now() - KEEP_MS;
  let removed = 0;
  for (const name of fs.readdirSync(archive)) {
    const file = path.join(archive, name);
    if (fs.statSync(file).mtimeMs < limit) { fs.rmSync(file, { force: true }); removed++; }
  }
  if (removed) console.log(`▶ Arquivo de apoio: ${removed} arquivo(s) com mais de 30 dias removidos.`);
}
