// Certificado A3: o driver do token abre a própria janela de PIN, mas o PowerShell que assina roda oculto e a janela do driver ficava
// sem janela-mãe visível (nunca aparecia e a assinatura esperava 120 s). Aqui o app mostra uma janelinha de aviso, sempre à frente,
// e entrega o handle dela ao driver (propriedade "HWND Handle" da chave) para que a janela de PIN do Windows/token abra por cima dela.
// A janela só aparece quando o PIN realmente será pedido (primeira assinatura do dia); depois o login do token fica aberto o dia todo.
const { BrowserWindow } = require("electron");

const PAGE = `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Certificado digital</title>
<style>
  *{box-sizing:border-box;margin:0}
  html,body{height:100%;overflow:hidden}
  body{font:14px/1.45 "Segoe UI",system-ui,Arial,sans-serif;color:#0f172a;background:#eef2f7;display:flex;align-items:stretch;padding:0;user-select:none;cursor:default}
  .card{width:100%;display:flex;flex-direction:column;background:#fff}
  .top{display:flex;align-items:center;gap:14px;padding:20px 22px;background:linear-gradient(135deg,#0b1220,#1e3a8a 55%,#2563eb);color:#fff}
  .ico{flex:none;width:46px;height:46px;border-radius:14px;background:rgba(255,255,255,.18);display:grid;place-items:center}
  h1{font-size:16px;font-weight:600;letter-spacing:.1px}
  .sub{font-size:12.5px;opacity:.9;margin-top:2px}
  .body{flex:1;padding:20px 24px 18px;display:flex;flex-direction:column;justify-content:space-between}
  ol{list-style:none;padding:0;display:grid;gap:11px}
  li{display:flex;gap:11px;align-items:flex-start;font-size:13.5px;color:#1e293b}
  .n{flex:none;width:22px;height:22px;border-radius:50%;background:#dbeafe;color:#1d4ed8;font-size:12px;font-weight:700;display:grid;place-items:center;margin-top:1px}
  .wait{display:flex;align-items:center;gap:10px;margin-top:14px;padding:10px 12px;border-radius:10px;background:#f8fafc;border:1px solid #e2e8f0;font-size:12.5px;color:#475569}
  .spin{flex:none;width:16px;height:16px;border-radius:50%;border:2.5px solid #bfdbfe;border-top-color:#2563eb;animation:r .8s linear infinite}
  @keyframes r{to{transform:rotate(360deg)}}
  .tip{margin-top:10px;font-size:11.5px;color:#64748b}
</style>
<body>
  <div class="card">
    <div class="top">
      <div class="ico"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z"/><rect x="9" y="10.5" width="6" height="5" rx="1"/><path d="M10.5 10.5V9a1.5 1.5 0 0 1 3 0v1.5"/></svg></div>
      <div><h1>Assinando a nota fiscal</h1><div class="sub">Certificado digital A3 (token)</div></div>
    </div>
    <div class="body">
      <ol>
        <li><span class="n">1</span><span>Vai abrir uma janela do <b>Windows ou do token</b> pedindo o <b>PIN</b>.</span></li>
        <li><span class="n">2</span><span>Digite o PIN e confirme. Ele fica valendo <b>o dia todo</b>, não vai pedir a cada nota.</span></li>
      </ol>
      <div class="wait"><div class="spin"></div><span>Aguardando o PIN do certificado…</span></div>
      <p class="tip">Se a janela do PIN não aparecer, confira se o token está conectado. Esta janela fecha sozinha.</p>
    </div>
  </div>
</body></html>`;

/** Mostra a janela de aviso e devolve { hwnd, close }. hwnd é o handle nativo (texto numérico) para o driver usar como janela-mãe. */
function showWaiting() {
  try {
    const win = new BrowserWindow({
      width: 460, height: 330, useContentSize: true, resizable: false, minimizable: false, maximizable: false, autoHideMenuBar: true, show: false,
      alwaysOnTop: true, title: "Certificado digital", backgroundColor: "#eef2f7", webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true },
    });
    win.setMenuBarVisibility(false);
    win.setAlwaysOnTop(true, "screen-saver");
    win.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(PAGE)).catch(() => {});
    win.show();
    win.focus();
    const buf = win.getNativeWindowHandle();
    const hwnd = buf.length >= 8 ? buf.readBigUInt64LE(0).toString() : String(buf.readUInt32LE(0));
    return { hwnd, close: () => { try { win.destroy(); } catch { /* já fechada */ } } };
  } catch (e) {
    console.error("[fiscal-agent] janela de espera indisponivel:", e && e.message);
    return { hwnd: "", close: () => {} };
  }
}

module.exports = { showWaiting };
