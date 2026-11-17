// Janela própria para pedir o PIN do token A3. O PowerShell que assina roda oculto e, em muitos Windows, a janela de PIN do driver
// do token não aparece (ou fica atrás de outras). Pedindo o PIN aqui, sempre à frente, a assinatura não depende dela.
// O PIN fica só na memória (nunca em disco) e vale por alguns minutos, para não pedir a cada nota.
const { BrowserWindow } = require("electron");

const KEEP_MS = 10 * 60_000;
const cache = new Map(); // thumbprint -> { pin, at }

const PAGE = `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>PIN do certificado</title>
<style>
  *{box-sizing:border-box} body{margin:0;font:14px Segoe UI,Arial,sans-serif;background:#f8fafc;color:#0f172a;padding:20px}
  h1{font-size:16px;margin:0 0 4px} p{margin:0 0 12px;color:#475569;font-size:12.5px;line-height:1.4}
  input{width:100%;height:40px;border:1px solid #cbd5e1;border-radius:8px;padding:0 12px;font-size:16px;letter-spacing:2px}
  input:focus{outline:2px solid #bfdbfe;border-color:#2563eb}
  .row{display:flex;gap:8px;justify-content:flex-end;margin-top:14px}
  button{height:36px;padding:0 18px;border-radius:8px;border:1px solid #cbd5e1;background:#fff;font-size:13px;cursor:pointer}
  button.ok{background:#2563eb;border-color:#2563eb;color:#fff;font-weight:600}
  small{display:block;margin-top:8px;color:#b45309;font-size:11.5px}
</style>
<body>
  <h1>Senha (PIN) do certificado digital</h1>
  <p>Digite o PIN do token para assinar a nota fiscal. Ele fica só na memória deste computador, por alguns minutos.</p>
  <form id="f"><input id="p" type="password" autocomplete="off" autofocus aria-label="PIN do token" placeholder="PIN">
  <small>Atenção: errar o PIN várias vezes pode bloquear o token.</small>
  <div class="row"><button type="button" id="c">Cancelar</button><button class="ok" type="submit">Assinar</button></div></form>
<script>
  const p=document.getElementById('p');
  document.getElementById('f').addEventListener('submit',e=>{e.preventDefault(); if(p.value) console.log('BOXPIN:OK:'+p.value);});
  document.getElementById('c').addEventListener('click',()=>console.log('BOXPIN:CANCEL'));
  setTimeout(()=>p.focus(),50);
</script></body></html>`;

function ask() {
  return new Promise((resolve) => {
    let done = false;
    const win = new BrowserWindow({
      width: 400, height: 250, resizable: false, minimizable: false, maximizable: false, autoHideMenuBar: true, show: false,
      alwaysOnTop: true, title: "PIN do certificado", webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true },
    });
    const finish = (pin) => { if (done) return; done = true; clearTimeout(timer); try { win.destroy(); } catch { /* já fechada */ } resolve(pin); };
    const timer = setTimeout(() => finish(null), 110_000);
    win.webContents.on("console-message", (e, _level, message) => {
      const m = typeof message === "string" ? message : e?.message;
      if (typeof m !== "string" || !m.startsWith("BOXPIN:")) return;
      if (m.startsWith("BOXPIN:OK:")) finish(m.slice("BOXPIN:OK:".length)); else finish(null);
    });
    win.on("closed", () => finish(null));
    win.once("ready-to-show", () => { win.setAlwaysOnTop(true, "screen-saver"); win.show(); win.focus(); });
    win.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(PAGE)).catch(() => finish(null));
  });
}

/** PIN em memória ou, se não houver, pergunta ao usuário. Devolve null se ele cancelar. */
async function getPin(thumbprint) {
  const key = String(thumbprint || "").toUpperCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < KEEP_MS) return hit.pin;
  const pin = await ask();
  if (pin) cache.set(key, { pin, at: Date.now() });
  return pin;
}
function forgetPin(thumbprint) { cache.delete(String(thumbprint || "").toUpperCase()); }
function touchPin(thumbprint) { const h = cache.get(String(thumbprint || "").toUpperCase()); if (h) h.at = Date.now(); }

module.exports = { getPin, forgetPin, touchPin };
