// Logo da loja nas notinhas térmicas (opção "Exibir logo nas notinhas", policies.receipt_logo).
// O logo é convertido aqui para um bitmap 1-bit e vai no texto como o marcador [[IMG:largura,altura,base64]], que o app desktop
// troca pelo comando de imagem do ESC/POS (GS v 0, ver desktop/printer.cjs). O resto do app continua mandando só texto:
// o gancho em window.boxsysDesktop.printReceipt coloca o logo em toda impressão (venda, reimpressão, cupom fiscal) sem mexer em cada tela.

const MAX_WIDTH = 320; // pontos (cabe em 58 mm e em 80 mm, centralizado)
const MAX_HEIGHT = 140;

interface LogoData { marker: string; dataUrl: string }
let cache: Promise<LogoData | null> | null = null;

export function resetReceiptLogoCache() { cache = null; }

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("logo"));
    img.src = src;
  });
}

async function build(): Promise<LogoData | null> {
  try {
    const res = await fetch("/api/tenant", { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } });
    if (!res.ok) return null;
    const tenant = await res.json();
    if (tenant?.policies?.receipt_logo !== true || !tenant?.logo_url) return null;

    const img = await loadImage(tenant.logo_url);
    const scale = Math.min(1, MAX_WIDTH / img.naturalWidth, MAX_HEIGHT / img.naturalHeight);
    const w = Math.max(8, Math.floor((img.naturalWidth * scale) / 8) * 8);
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h); // transparência vira branco
    ctx.drawImage(img, 0, 0, w, h);
    const pixels = ctx.getImageData(0, 0, w, h).data;

    const rowBytes = w / 8;
    const bits = new Uint8Array(rowBytes * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const lum = 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
        if (lum < 160) bits[y * rowBytes + (x >> 3)] |= 0x80 >> (x & 7);
      }
    }
    let bin = "";
    for (let i = 0; i < bits.length; i++) bin += String.fromCharCode(bits[i]);
    return { marker: `[[IMG:${w},${h},${btoa(bin)}]]`, dataUrl: canvas.toDataURL("image/png") };
  } catch {
    return null; // sem logo, sem imagem legível ou tela de cross-origin: imprime a notinha normal
  }
}

export function getReceiptLogo(): Promise<LogoData | null> {
  if (!cache) cache = build();
  return cache;
}

/** Entrega o logo ao app desktop, que o põe no topo de toda notinha (venda, reimpressão, cupom fiscal; relatórios ficam sem). */
export async function syncReceiptLogoToDesktop(): Promise<void> {
  const desktop = window.boxsysDesktop;
  if (!desktop?.setReceiptLogo) return;
  const logo = await getReceiptLogo();
  await desktop.setReceiptLogo(logo?.marker ?? "").catch(() => {});
}

// Fora do app desktop (impressão pelo navegador) o logo vai como <img> no topo da notinha.
const NO_LOGO = /FECHAMENTO|RELAT[ÓO]RIO|SANGRIA|SUPRIMENTO/i;
export async function receiptLogoHtml(text: string): Promise<string> {
  if (NO_LOGO.test(text.slice(0, 600))) return "";
  const logo = await getReceiptLogo();
  return logo ? `<div style="text-align:center"><img src="${logo.dataUrl}" style="max-width:60mm;max-height:24mm"></div>` : "";
}

/** Mantém o logo do desktop em dia: ao abrir, depois do login (token novo) e quando a janela volta ao foco. */
export function startReceiptLogoSync() {
  if (!window.boxsysDesktop?.setReceiptLogo) return;
  let lastToken: string | null = null;
  const tick = () => {
    const token = localStorage.getItem("token");
    if (token && token !== lastToken) { lastToken = token; resetReceiptLogoCache(); void syncReceiptLogoToDesktop(); }
  };
  tick();
  window.setInterval(tick, 15000);
  window.addEventListener("focus", () => { resetReceiptLogoCache(); void syncReceiptLogoToDesktop(); });
}
