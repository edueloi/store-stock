const { net } = require("electron");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

// Cache em disco do próprio site (HTML, JS, CSS, imagens) para o app abrir SEM internet.
// O Electron só carrega a URL do servidor; sem isto, sem conexão ele cai na tela "Sem
// Conexão". Aqui toda requisição GET de arquivo estático ao servidor da loja passa por um
// proxy: com rede, grava a resposta; sem rede (ou servidor fora do ar), entrega a última
// cópia gravada. Chamadas de dados (/api, /socket.io) nunca passam pelo cache — o PDV já
// trata essas falhas com os dados guardados no banco local (SQLite).

const NETWORK_TIMEOUT_MS = 5000;
const MAX_CACHED_BYTES = 8 * 1024 * 1024;
const INDEX_KEY = "__index_html__";

function install(session, getServer, userDataDir) {
  const dir = path.join(userDataDir, "webcache");
  fs.mkdirSync(dir, { recursive: true });

  const fileFor = (key) => path.join(dir, crypto.createHash("sha1").update(key).digest("hex"));

  // Todo acesso a disco aqui é ASSÍNCRONO: este código roda no processo principal do
  // Electron e cada leitura/escrita síncrona congelava o app inteiro ("não está
  // respondendo") — principalmente com centenas de fotos de produto passando pelo proxy.
  const fsp = fs.promises;

  async function readCached(key) {
    try {
      const [metaText, body] = await Promise.all([
        fsp.readFile(`${fileFor(key)}.json`, "utf-8"),
        fsp.readFile(`${fileFor(key)}.bin`),
      ]);
      return { meta: JSON.parse(metaText), body };
    } catch {
      return null;
    }
  }

  async function writeCached(key, contentType, body) {
    if (body.length > MAX_CACHED_BYTES) return;
    try {
      await fsp.writeFile(`${fileFor(key)}.bin`, body);
      await fsp.writeFile(`${fileFor(key)}.json`, JSON.stringify({ contentType }));
    } catch {
      // disco cheio/sem permissão: segue sem cache, não afeta o uso online
    }
  }

  // Só o que o app precisa para abrir offline entra no cache: a página, o JS/CSS do
  // sistema e os ícones. Fotos de produto (/uploads) e demais arquivos de cliente NÃO são
  // guardados — eram milhares de arquivos, escritos a cada abertura, sem limite.
  const isCacheable = (pathname, isHtml) =>
    isHtml || pathname.startsWith("/assets/") || pathname.startsWith("/system/") ||
    /^\/(favicon\.[a-z]+|app-manifest\.json|pdv-manifest\.json|manifest\.webmanifest)$/.test(pathname);

  // Limpeza única, em segundo plano e sem pressa, do que versões antigas gravaram
  // (imagens de produto): devolve disco e deixa a pasta pequena.
  async function pruneLegacyImages() {
    try {
      const files = (await fsp.readdir(dir)).filter((f) => f.endsWith(".json"));
      let removed = 0;
      for (const file of files) {
        let meta;
        try { meta = JSON.parse(await fsp.readFile(path.join(dir, file), "utf-8")); } catch { continue; }
        if (!/^image\//.test(meta.contentType || "")) continue;
        const base = path.join(dir, file.slice(0, -5));
        await fsp.rm(`${base}.json`, { force: true });
        await fsp.rm(`${base}.bin`, { force: true });
        if (++removed % 25 === 0) await new Promise((r) => setTimeout(r, 20)); // respira entre lotes
      }
    } catch {
      // melhor esforço
    }
  }

  const serveCached = (cached) =>
    new Response(cached.body, { status: 200, headers: { "content-type": cached.meta.contentType || "application/octet-stream" } });

  // Baixa em segundo plano os arquivos que o app carrega sob demanda (telas "lazy"), para
  // que também funcionem offline sem o operador precisar visitar cada uma antes. Lê os
  // JS/CSS já guardados, acha referências a outros /assets e busca os que faltam.
  const TYPES = { js: "text/javascript", css: "text/css" };
  async function prefetchAssets() {
    const server = getServer();
    if (!server) return;
    const seen = new Set();
    for (let round = 0; round < 4; round++) {
      const wanted = new Set();
      for (const file of (await fsp.readdir(dir)).filter((f) => f.endsWith(".json"))) {
        const base = path.join(dir, file.slice(0, -5));
        let meta;
        try { meta = JSON.parse(await fsp.readFile(path.join(dir, file), "utf-8")); } catch { continue; }
        if (!/javascript|css/.test(meta.contentType || "")) continue;
        let text;
        try { text = await fsp.readFile(`${base}.bin`, "utf-8"); } catch { continue; }
        for (const m of text.matchAll(/(?:assets\/|\.\/)([\w.-]+\.(?:js|css))/g)) wanted.add(m[1]);
      }
      let fetched = 0;
      for (const name of wanted) {
        const key = `/assets/${name}`;
        if (seen.has(key) || (await readCached(key))) continue;
        seen.add(key);
        try {
          const res = await net.fetch(`https://${server}${key}`, { bypassCustomProtocolHandlers: true });
          const type = res.headers.get("content-type") || "";
          // O SPA responde HTML para arquivo inexistente: só guarda se for JS/CSS de verdade.
          if (res.status === 200 && /javascript|css/.test(type)) {
            await writeCached(key, type || TYPES[name.split(".").pop()], Buffer.from(await res.arrayBuffer()));
            fetched++;
          }
        } catch {
          return; // sem rede: tenta de novo na próxima abertura
        }
      }
      if (!fetched) return;
    }
  }

  session.protocol.handle("https", async (request) => {
    const passthrough = () => net.fetch(request, { bypassCustomProtocolHandlers: true });
    try {
      const server = getServer();
      const url = new URL(request.url);
      const isOurs = server && url.host === server;
      const isData = url.pathname.startsWith("/api/") || url.pathname.startsWith("/socket.io");
      if (!isOurs || isData || request.method !== "GET") return passthrough();

      const accept = request.headers.get("accept") || "";
      const isHtml = request.mode === "navigate" || accept.includes("text/html");
      // Fora da lista offline (ex.: fotos de produto) vai direto à rede, sem tocar no disco.
      if (!isCacheable(url.pathname, isHtml)) return passthrough();
      const key = isHtml ? INDEX_KEY : url.pathname + url.search;
      const cached = await readCached(key);

      // Arquivos com hash no nome nunca mudam: cache primeiro (abre instantâneo e offline).
      if (cached && url.pathname.startsWith("/assets/")) return serveCached(cached);

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), cached ? NETWORK_TIMEOUT_MS : 30000);
      try {
        const response = await net.fetch(request, { bypassCustomProtocolHandlers: true, signal: controller.signal });
        clearTimeout(timer);
        if (response.status >= 500 && cached) return serveCached(cached);
        if (response.status === 200) {
          const contentType = response.headers.get("content-type") || "";
          // HTML só entra no cache se for mesmo a página do app (o SPA devolve o mesmo
          // index para qualquer rota), nunca uma página de erro do proxy.
          if (!isHtml || contentType.includes("text/html")) {
            response.clone().arrayBuffer().then((buf) => writeCached(key, contentType, Buffer.from(buf))).catch(() => {});
          }
        }
        return response;
      } catch (err) {
        clearTimeout(timer);
        if (cached) return serveCached(cached);
        throw err;
      }
    } catch (err) {
      return new Response(String(err?.message || err), { status: 504 });
    }
  });

  // Limpa o legado depois que o app já abriu, sem competir com a inicialização.
  setTimeout(() => { void pruneLegacyImages(); }, 45000);

  return { prefetchAssets };
}

module.exports = { install };
