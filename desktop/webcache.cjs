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

  function readCached(key) {
    try {
      const meta = JSON.parse(fs.readFileSync(`${fileFor(key)}.json`, "utf-8"));
      const body = fs.readFileSync(`${fileFor(key)}.bin`);
      return { meta, body };
    } catch {
      return null;
    }
  }

  function writeCached(key, contentType, body) {
    if (body.length > MAX_CACHED_BYTES) return;
    try {
      fs.writeFileSync(`${fileFor(key)}.bin`, body);
      fs.writeFileSync(`${fileFor(key)}.json`, JSON.stringify({ contentType }));
    } catch {
      // disco cheio/sem permissão: segue sem cache, não afeta o uso online
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
      for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".json"))) {
        const base = path.join(dir, file.slice(0, -5));
        let meta;
        try { meta = JSON.parse(fs.readFileSync(path.join(dir, file), "utf-8")); } catch { continue; }
        if (!/javascript|css/.test(meta.contentType || "")) continue;
        let text;
        try { text = fs.readFileSync(`${base}.bin`, "utf-8"); } catch { continue; }
        for (const m of text.matchAll(/(?:assets\/|\.\/)([\w.-]+\.(?:js|css))/g)) wanted.add(m[1]);
      }
      let fetched = 0;
      for (const name of wanted) {
        const key = `/assets/${name}`;
        if (seen.has(key) || readCached(key)) continue;
        seen.add(key);
        try {
          const res = await net.fetch(`https://${server}${key}`, { bypassCustomProtocolHandlers: true });
          const type = res.headers.get("content-type") || "";
          // O SPA responde HTML para arquivo inexistente: só guarda se for JS/CSS de verdade.
          if (res.status === 200 && /javascript|css/.test(type)) {
            writeCached(key, type || TYPES[name.split(".").pop()], Buffer.from(await res.arrayBuffer()));
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
      const key = isHtml ? INDEX_KEY : url.pathname + url.search;
      const cached = readCached(key);

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

  return { prefetchAssets };
}

module.exports = { install };
