import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { labelGeometry, labelPrintDocument, validateLabelPrint, type LabelPrintSettings } from "../../lib/labelPrinting";

// Código de barras de exemplo (barras determinísticas) só para ver o espaço que ele ocupa na etiqueta.
function sampleBarcode() {
  const widths = [2, 1, 1, 3, 1, 2, 2, 1, 3, 1, 1, 2, 1, 3, 2, 1, 1, 2, 3, 1, 2, 1, 1, 3, 2, 1, 2, 2, 1, 1, 3, 1, 2, 1, 2, 3, 1, 1, 2, 1];
  let x = 0, bars = "";
  widths.forEach((w, i) => { if (i % 2 === 0) bars += `<rect x="${x}" y="0" width="${w}" height="30" fill="#000"/>`; x += w; });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${x} 30" preserveAspectRatio="none">${bars}</svg>`;
}

/**
 * Prévia em tempo real, na proporção física real: usa o mesmo gerador da impressão com as configurações em edição
 * (medidas, espaços, margens, deslocamentos, fonte e tamanhos). Contorno azul = etiqueta; tracejado = área de conteúdo.
 */
export default function LabelSettingsPreview({ settings }: { settings: LabelPrintSettings }) {
  const root = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(320);
  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const measure = () => { const w = el.getBoundingClientRect().width; if (w > 0) setWidth(Math.max(120, Math.round(w - 2))); };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    const timers = [60, 300].map(ms => window.setTimeout(measure, ms));
    return () => { observer.disconnect(); timers.forEach(clearTimeout); };
  }, []);

  const errors = validateLabelPrint(settings);
  const g = labelGeometry(settings);
  const doc = useMemo(() => {
    if (errors.length) return "";
    const one = `<div class="label-name">${settings.nameBold ? "" : ""}PRODUTO DE EXEMPLO COM NOME BEM GRANDE 123</div><div class="label-price">R$ 40,00</div><div class="label-sku">7898660998309</div>${sampleBarcode()}`;
    const contents = Array.from({ length: Math.max(1, settings.columns * (settings.mode === "sheet" ? Math.min(2, g.rows) : 1)) }, () => one);
    const html = labelPrintDocument({ ...settings, borders: false, skip: 0 }, contents, "Prévia", false, width);
    const extra = "<style>.label{outline:0.2mm solid #2563eb;outline-offset:-0.2mm}.label-safe{outline:0.15mm dashed #94a3b8;outline-offset:0}.empty-slot{display:none!important}</style>";
    return html.replace("</head>", `${extra}</head>`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(settings), width]);

  if (errors.length) return <p className="text-xs text-slate-500">Corrija as medidas para visualizar a fileira.</p>;
  const height = Math.max(40, (g.pageHeight / settings.paperWidth) * width + 2);
  return (
    <div ref={root} className="w-full min-w-0">
      <div className="max-h-[420px] overflow-y-auto overflow-x-hidden rounded border border-slate-300 bg-slate-200 p-0">
        <iframe key={Math.round(width)} title="Prévia em tempo real da etiqueta" sandbox="allow-scripts" className="block w-full border-0 bg-white" style={{ height }} srcDoc={doc} />
      </div>
      <p className="mt-2 text-[11px] leading-4 text-slate-500">
        Tamanho real em proporção: papel de {settings.paperWidth} mm, etiquetas de {settings.width} × {settings.height} mm.
        Contorno azul = etiqueta · tracejado = área de impressão. Muda na hora conforme você edita.
      </p>
    </div>
  );
}
