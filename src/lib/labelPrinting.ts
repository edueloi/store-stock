export interface LabelPrintSettings {
  mode: "sheet" | "thermal";
  printer: "generic" | "elgin-btp-l42";
  media: "gap" | "continuous" | "mark";
  width: number; height: number; columns: number;
  paperWidth: number; paperHeight: number;
  gapX: number; gapY: number;
  marginLeft: number; marginRight: number; marginTop: number; marginBottom: number;
  safety: number; offsetX: number; offsetY: number; scale: number;
  skip: number; borders: boolean;
}

export const DEFAULT_LABEL_PRINT: LabelPrintSettings = {
  mode: "sheet", printer: "generic", media: "gap", width: 50, height: 30, columns: 3,
  paperWidth: 210, paperHeight: 297, gapX: 3, gapY: 2,
  marginLeft: 10, marginRight: 10, marginTop: 10, marginBottom: 10,
  safety: 1.5, offsetX: 0, offsetY: 0, scale: 100, skip: 0, borders: false,
};
export const LABEL_PRINT_PRESETS = [
  { id: "a4", name: "Exemplo: A4 · 50 × 30 mm", settings: DEFAULT_LABEL_PRINT },
  ...([1, 2, 3] as const).map(columns => ({
    id: `roll-${columns}`, name: `Exemplo: bobina · ${columns} coluna${columns > 1 ? "s" : ""}`,
    settings: { ...DEFAULT_LABEL_PRINT, mode: "thermal" as const, paperWidth: 104, paperHeight: 50,
      width: columns === 1 ? 100 : columns === 2 ? 50 : 32, height: columns === 1 ? 50 : columns === 2 ? 30 : 25,
      columns, gapX: columns === 1 ? 0 : 2, gapY: 3,
      marginLeft: columns === 2 ? 1 : 2, marginRight: columns === 2 ? 1 : 2,
      marginTop: 0, marginBottom: 0, safety: 1,
    },
  })),
];

export function labelGeometry(s: LabelPrintSettings) {
  const pageHeight = s.mode === "sheet" ? s.paperHeight : s.height + (s.media === "continuous" ? s.gapY : 0);
  const rows = s.mode === "thermal" ? 1 : Math.floor((pageHeight - s.marginTop - s.marginBottom + s.gapY + 1e-8) / (s.height + s.gapY));
  const rowWidth = s.columns * s.width + (s.columns - 1) * s.gapX;
  const insetX = s.safety + Math.abs(s.offsetX), insetY = s.safety + Math.abs(s.offsetY);
  return { pageHeight, rows, capacity: rows * s.columns, rowWidth,
    contentWidth: s.width - 2 * insetX, contentHeight: s.height - 2 * insetY,
    contentLeft: insetX + s.offsetX, contentTop: insetY + s.offsetY,
  };
}

export function validateLabelPrint(s: LabelPrintSettings): string[] {
  const errors: string[] = [];
  const numbers = ["width", "height", "columns", "paperWidth", "paperHeight", "gapX", "gapY", "marginLeft", "marginRight", "marginTop", "marginBottom", "safety", "offsetX", "offsetY", "scale", "skip"] as const;
  if (numbers.some(key => !Number.isFinite(s[key]))) return ["Preencha todas as medidas com números válidos."];
  if (!["sheet", "thermal"].includes(s.mode) || !["generic", "elgin-btp-l42"].includes(s.printer) || !["gap", "continuous", "mark"].includes(s.media)) errors.push("Selecione o tipo de papel e a impressora.");
  if (!Number.isInteger(s.columns) || s.columns < 1 || s.columns > 4) errors.push("Escolha de 1 a 4 colunas.");
  if (s.width < 10 || s.width > 300 || s.height < 8 || s.height > 500) errors.push("A etiqueta deve ter largura entre 10 e 300 mm e altura entre 8 e 500 mm.");
  if (s.paperWidth < 10 || s.paperWidth > 500 || s.paperHeight < 8 || s.paperHeight > 1000) errors.push("Informe um tamanho de papel válido.");
  if ([s.gapX, s.gapY, s.marginLeft, s.marginRight, s.marginTop, s.marginBottom, s.safety].some(n => n < 0 || n > 100)) errors.push("Espaços, margens e segurança devem ficar entre 0 e 100 mm.");
  if (Math.abs(s.offsetX) > 20 || Math.abs(s.offsetY) > 20) errors.push("Os deslocamentos devem ficar entre -20 e 20 mm.");
  if (s.scale < 50 || s.scale > 100) errors.push("A escala do conteúdo deve ficar entre 50% e 100%, mantendo a proporção.");
  const g = labelGeometry(s);
  if (g.rowWidth + s.marginLeft + s.marginRight > s.paperWidth + 0.001) errors.push(`As colunas, espaços e margens precisam de ${(g.rowWidth + s.marginLeft + s.marginRight).toFixed(2)} mm de largura; o papel tem ${s.paperWidth} mm.`);
  if (g.rows < 1) errors.push("A altura da etiqueta e as margens não cabem no papel.");
  if (g.contentWidth < 6 || g.contentHeight < 5) errors.push("A margem de segurança e os deslocamentos deixam pouco espaço para o conteúdo.");
  if (!Number.isInteger(s.skip) || s.skip < 0 || s.skip >= g.capacity) errors.push(`As posições já usadas devem ficar entre 0 e ${Math.max(0, g.capacity - 1)}.`);
  if (s.mode === "thermal" && (s.marginTop !== 0 || s.marginBottom !== 0)) errors.push("Na bobina, deixe as margens superior e inferior do papel em zero e ajuste a posição pelo deslocamento vertical.");
  if (s.printer === "elgin-btp-l42") {
    if (s.mode !== "thermal") errors.push("A Elgin BTP-L42(U) utiliza bobina; selecione esse tipo de papel.");
    if (s.paperWidth < 25 || s.paperWidth > 110) errors.push("Na BTP-L42(U), a largura do papel deve ficar entre 25 e 110 mm.");
    // Cabeça de 104 mm; a borda física do liner pode ser mais larga.
    const edge = Math.max(0, (s.paperWidth - 104) / 2);
    if (s.marginLeft + g.contentLeft < edge - 0.001 || s.marginLeft + g.rowWidth - s.width + g.contentLeft + g.contentWidth > s.paperWidth - edge + 0.001) errors.push("O conteúdo ultrapassa a faixa de impressão de 104 mm da BTP-L42(U). Ajuste as margens, a segurança ou as colunas.");
  }
  return errors;
}

export function labelPositions(s: LabelPrintSettings, count: number) {
  const errors = validateLabelPrint(s);
  if (errors.length) throw new Error(errors[0]);
  if (!Number.isInteger(count) || count < 1 || count > 2000) throw new Error("Imprima entre 1 e 2.000 etiquetas por vez.");
  const g = labelGeometry(s);
  return Array.from({ length: count }, (_, index) => {
    const slot = index + s.skip, local = slot % g.capacity, column = local % s.columns, row = Math.floor(local / s.columns);
    return { index, page: Math.floor(slot / g.capacity), column, row,
      x: s.marginLeft + column * (s.width + s.gapX), y: (s.mode === "sheet" ? s.marginTop : 0) + row * (s.height + s.gapY),
    };
  });
}

export const labelEscape = (value: string) => String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]!));

/** SVG com viewBox e escala uniforme: o código não pode ser esticado ou recortado. */
export function labelBarcodeSvg(source: SVGSVGElement | null): string {
  if (!source?.querySelector("rect")) return "";
  const clone = source.cloneNode(true) as SVGSVGElement;
  if (!clone.hasAttribute("viewBox")) {
    const width = parseFloat(clone.getAttribute("width") || "0"), height = parseFloat(clone.getAttribute("height") || "0");
    if (width && height) clone.setAttribute("viewBox", `0 0 ${width} ${height}`);
  }
  clone.removeAttribute("width"); clone.removeAttribute("height"); clone.removeAttribute("class");
  clone.setAttribute("preserveAspectRatio", "xMidYMid meet");
  return clone.outerHTML;
}

export function labelPrintDocument(s: LabelPrintSettings, contents: string[], title = "Etiquetas", calibration = false, previewWidth?: number) {
  const positions = labelPositions(s, contents.length), g = labelGeometry(s);
  const pages = Array.from({ length: positions.at(-1)!.page + 1 }, () => [] as string[]);
  for (const cell of positions) pages[cell.page].push(`<div class="label" data-index="${cell.index}" style="left:${cell.x}mm;top:${cell.y}mm"><div class="label-safe"><div class="label-content">${contents[cell.index]}</div></div></div>`);
  if (previewWidth) {
    const occupied = new Set(positions.filter(p => p.page === 0).map(p => p.row * s.columns + p.column));
    for (let slot = 0; slot < g.capacity; slot++) if (!occupied.has(slot)) {
      const x = s.marginLeft + slot % s.columns * (s.width + s.gapX), y = (s.mode === "sheet" ? s.marginTop : 0) + Math.floor(slot / s.columns) * (s.height + s.gapY);
      pages[0].push(`<div class="label empty-slot" style="left:${x}mm;top:${y}mm"><span>${slot < s.skip ? "Já utilizada" : "Sem impressão"}</span></div>`);
    }
  }
  return `<!doctype html><html lang="pt-BR"><head><meta charset="UTF-8"><title>${labelEscape(title)}</title><style>
*{box-sizing:border-box}html,body{margin:0;padding:0;font-family:Arial,sans-serif;color:#000;background:white}
@page{size:${s.paperWidth}mm ${g.pageHeight}mm;margin:0}
.print-sheet{position:relative;width:${s.paperWidth}mm;height:${g.pageHeight}mm;overflow:hidden;break-after:page;page-break-after:always;break-inside:avoid}
.print-sheet:last-of-type{break-after:auto;page-break-after:auto}
.label{position:absolute;width:${s.width}mm;height:${s.height}mm;${s.borders || calibration ? "outline:0.15mm solid #000;outline-offset:-0.25mm;" : ""}}
.empty-slot{display:flex;align-items:center;justify-content:center;border:0.15mm dashed #adb9cb;color:#738297;font-size:6pt;background:#f8fafc}
.label-safe{position:absolute;left:${g.contentLeft}mm;top:${g.contentTop}mm;width:${g.contentWidth}mm;height:${g.contentHeight}mm;overflow:hidden}
.label-content{width:100%;display:flex;flex-direction:column;align-items:center;gap:0.35mm;text-align:center;transform-origin:top left;overflow-wrap:anywhere}
.label-name,.label-title{font-size:8pt;font-weight:700;line-height:1.12}.label-name{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.label-price{font-size:9pt;font-weight:800;line-height:1.1}.label-sku,.label-reference{font:6.5pt monospace;line-height:1.15}.label-customer{font-size:7.5pt;font-weight:700}
.label-text,.label-notes,.label-nocode{font-size:6.5pt;line-height:1.15}.label-notes{font-style:italic}
.label-content svg{display:block;width:100%;height:auto;max-height:9mm;flex-shrink:0}.label-content svg.calibration-svg{max-height:none;height:${g.contentHeight}mm}.label-qr{width:10mm;height:10mm;object-fit:contain;flex-shrink:0}
.calibration{font-size:7pt;line-height:1.2}.ruler{width:10mm;height:2mm;border:0.2mm solid #000;border-top:0;margin-top:1mm}
.print-help{padding:16px;background:#edf4ff;color:#1e3a5f;font-size:13px;line-height:1.6}.print-help button{margin-top:8px;padding:8px 14px;cursor:pointer}
@media screen{body{background:#e9edf2}.print-sheet{background:white;margin:16px auto;box-shadow:0 2px 8px #0002}}
@media print{.print-help,.empty-slot{display:none}body{background:white}.print-sheet{margin:0;box-shadow:none}}
${previewWidth ? `@media screen{html{zoom:${Math.min(1, previewWidth / (s.paperWidth * 96 / 25.4))}}.print-help{display:none!important}.print-sheet{margin:0!important;box-shadow:none!important}body{background:#fff!important}` : ""}
</style></head><body><aside class="print-help"><strong>${labelEscape(title)}</strong><br>Papel ${s.paperWidth} × ${g.pageHeight} mm. Use escala 100%, margens nenhuma e cabeçalhos/rodapés desativados. Cadastre esse papel no driver. ${s.mode === "thermal" && s.media !== "continuous" ? `Configure o GAP/marca de ${s.gapY} mm no driver; ele faz o avanço entre fileiras.` : ""}<br><button type="button" onclick="window.print()">Imprimir</button></aside>
${pages.map((cells, page) => `<section class="print-sheet" data-page="${page + 1}">${cells.join("")}</section>`).join("")}
<script>
(async()=>{await document.fonts.ready;await Promise.all(Array.from(document.images).map(img=>img.complete?Promise.resolve():new Promise(resolve=>{img.onload=resolve;img.onerror=resolve})));let minScale=1;for(const box of document.querySelectorAll('.label-safe')){const content=box.firstElementChild;const scale=${calibration ? "1" : `Math.min(1,box.clientWidth/Math.max(1,content.scrollWidth),box.clientHeight/Math.max(1,content.scrollHeight))*${s.scale / 100}`};minScale=Math.min(minScale,scale);content.style.transform='translate('+Math.max(0,(box.clientWidth-content.offsetWidth*scale)/2)+'px,'+Math.max(0,(box.clientHeight-content.scrollHeight*scale)/2)+'px) scale('+scale+')';content.dataset.scale=String(scale)}window.__labelsReady=true;window.dispatchEvent(new Event('labels-ready'));if(window.parent!==window)window.parent.postMessage({kind:'boxsys-label-fit',minScale},'*')})();
</script></body></html>`;
}

export function calibrationContents(s: LabelPrintSettings) {
  const g = labelGeometry(s), length = Math.min(10, Math.floor(g.contentWidth));
  const font = Math.min(2.4, g.contentWidth / 19, g.contentHeight / 4.5), y = Math.min(g.contentHeight - 0.5, font * 3.7);
  return Array.from({ length: s.columns * 2 }, (_, i) => `<svg class="calibration-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${g.contentWidth} ${g.contentHeight}" preserveAspectRatio="xMinYMin meet"><text x="0" y="${font}" font-size="${font}">Teste ${Math.floor(i / s.columns) + 1} / coluna ${i % s.columns + 1}</text><text x="0" y="${font * 2.2}" font-size="${font * .8}">${s.width} x ${s.height} mm / linha ${length} mm</text><path d="M0 ${y - 1} V${y} H${length} V${y - 1}" fill="none" stroke="black" stroke-width="0.15"/></svg>`);
}

export function labelSettingsStorageKey() {
  try { const user = JSON.parse(localStorage.getItem("user") || "{}"); return `boxsys-label-print:v1:${user.tenant_id ?? user.tenantId ?? "loja"}:${user.id ?? "usuario"}`; }
  catch { return "boxsys-label-print:v1:usuario"; }
}
export function storedLabelSettings(): LabelPrintSettings {
  try { const value = { ...DEFAULT_LABEL_PRINT, ...JSON.parse(localStorage.getItem(labelSettingsStorageKey()) || "null") }; return validateLabelPrint(value).length ? DEFAULT_LABEL_PRINT : value; }
  catch { return DEFAULT_LABEL_PRINT; }
}
