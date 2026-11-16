const os = require("os");
const fs = require("fs");

// Diagnóstico remoto: quando o app trava, cai ou fica lento, registra o que aconteceu (e o
// estado do computador na hora) e envia ao servidor, para consultarmos sem precisar acessar
// a máquina do cliente. Tudo aqui é leve e tolerante a falhas — nunca pode derrubar o app.
//
// O que é registrado:
//  - main-lag: o processo principal ficou parado vários segundos (causa do "não está respondendo")
//  - window-unresponsive / window-responsive: a janela parou de responder e voltou
//  - render-process-gone / child-process-gone: queda da página ou de um processo do Electron
//  - uncaught-exception / unhandled-rejection: erros não tratados no processo principal
//  - app-start: abertura do app (versão, sistema, memória), para saber o que cada terminal usa
//  - support-bundle: envio manual pelo menu (últimas linhas do log local)

const LAG_CHECK_MS = 1000;
const LAG_THRESHOLD_MS = 3000;
const LAG_MIN_INTERVAL_MS = 30000;
const FLUSH_DELAY_MS = 3000;
const RETRY_MS = 60000;
const MAX_QUEUE = 100;

function install({ app, log, send }) {
  const queue = [];
  let flushTimer = null;
  let flushing = false;
  let lastLagAt = 0;

  function context() {
    let metrics = [];
    try {
      metrics = app
        .getAppMetrics()
        .map((m) => ({ type: m.type, pid: m.pid, memMB: Math.round((m.memory?.workingSetSize || 0) / 1024), cpu: Math.round((m.cpu?.percentCPUUsage || 0) * 10) / 10 }))
        .sort((a, b) => b.memMB - a.memMB)
        .slice(0, 6);
    } catch {
      // melhor esforço
    }
    return {
      version: app.getVersion(),
      os: `${os.platform()} ${os.release()} ${os.arch()}`,
      cpus: os.cpus()?.length,
      memTotalMB: Math.round(os.totalmem() / 1048576),
      memFreeMB: Math.round(os.freemem() / 1048576),
      uptimeMin: Math.round(process.uptime() / 60),
      processes: metrics,
    };
  }

  function scheduleFlush(delay = FLUSH_DELAY_MS) {
    if (flushTimer) return;
    flushTimer = setTimeout(() => { flushTimer = null; void flush(); }, delay);
    flushTimer.unref?.();
  }

  async function flush() {
    if (flushing || queue.length === 0) return;
    flushing = true;
    const batch = queue.splice(0, 50);
    try {
      await send(batch);
    } catch {
      // sem rede ou terminal ainda sem credencial: devolve para a fila e tenta mais tarde
      queue.unshift(...batch);
      if (queue.length > MAX_QUEUE) queue.splice(0, queue.length - MAX_QUEUE);
      scheduleFlush(RETRY_MS);
    } finally {
      flushing = false;
      if (queue.length > 0 && !flushTimer) scheduleFlush(FLUSH_DELAY_MS);
    }
  }

  function record(kind, message, data, level = "warn") {
    try {
      const entry = { ts: new Date().toISOString(), level, kind, message: String(message || "").slice(0, 2000), ctx: context() };
      if (data !== undefined) entry.data = data;
      log[level === "error" ? "error" : "warn"](`[diag] ${kind}: ${entry.message}`);
      queue.push(entry);
      if (queue.length > MAX_QUEUE) queue.shift();
      scheduleFlush();
    } catch {
      // nunca derruba o app por causa do diagnóstico
    }
  }

  // 1) Processo principal parado: o timer de 1s atrasa quando o loop de eventos trava.
  let expected = Date.now() + LAG_CHECK_MS;
  const lagTimer = setInterval(() => {
    const now = Date.now();
    const lag = now - expected;
    expected = now + LAG_CHECK_MS;
    if (lag > LAG_THRESHOLD_MS && now - lastLagAt > LAG_MIN_INTERVAL_MS) {
      lastLagAt = now;
      record("main-lag", `Processo principal ficou ${Math.round(lag / 1000)}s sem responder`, { lagMs: lag });
    }
  }, LAG_CHECK_MS);
  lagTimer.unref?.();

  // 2) Janelas sem resposta e quedas de processo.
  app.on("web-contents-created", (_e, wc) => {
    let hungSince = 0;
    wc.on("unresponsive", () => {
      hungSince = Date.now();
      let url = "";
      try { url = wc.getURL(); } catch { /* destruído */ }
      record("window-unresponsive", "Janela parou de responder", { url });
    });
    wc.on("responsive", () => {
      if (!hungSince) return;
      record("window-responsive", `Janela voltou a responder após ${Math.round((Date.now() - hungSince) / 1000)}s`, undefined, "info");
      hungSince = 0;
    });
  });
  app.on("render-process-gone", (_e, wc, details) => {
    let url = "";
    try { url = wc.getURL(); } catch { /* destruído */ }
    record("render-process-gone", `Página caiu: ${details?.reason} (código ${details?.exitCode})`, { url, ...details }, "error");
  });
  app.on("child-process-gone", (_e, details) => {
    record("child-process-gone", `Processo ${details?.type} caiu: ${details?.reason} (código ${details?.exitCode})`, details, "error");
  });

  // 3) Erros não tratados.
  process.on("uncaughtException", (err) => record("uncaught-exception", err?.stack || String(err), undefined, "error"));
  process.on("unhandledRejection", (reason) => record("unhandled-rejection", (reason && reason.stack) || String(reason), undefined, "error"));

  // 4) Abertura do app: qual versão e que computador cada terminal usa.
  record("app-start", `Store BoxSys ${app.getVersion()} aberto`, undefined, "info");

  // 5) Envio manual pelo menu: últimas linhas do log local, para o suporte ver tudo.
  async function sendSupportBundle() {
    let text = "";
    try {
      const file = log.transports.file.getFile().path;
      const stat = await fs.promises.stat(file);
      const size = Math.min(stat.size, 90000);
      const handle = await fs.promises.open(file, "r");
      try {
        const buf = Buffer.alloc(size);
        await handle.read(buf, 0, size, stat.size - size);
        text = buf.toString("utf-8");
      } finally {
        await handle.close();
      }
    } catch (err) {
      text = `Não foi possível ler o log local: ${err?.message || err}`;
    }
    const entry = { ts: new Date().toISOString(), level: "info", kind: "support-bundle", message: text, ctx: context() };
    await send([entry]);
  }

  return { record, flush, sendSupportBundle };
}

module.exports = { install };
