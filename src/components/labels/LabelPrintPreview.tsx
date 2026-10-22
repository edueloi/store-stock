import { useEffect, useRef, useState } from "react";
import { labelGeometry, labelPrintDocument, validateLabelPrint, type LabelPrintSettings } from "../../lib/labelPrinting";

export default function LabelPrintPreview({ settings, contents }: { settings: LabelPrintSettings; contents: string[] }) {
  const root = useRef<HTMLDivElement>(null), [width, setWidth] = useState(280);
  const frame = useRef<HTMLIFrameElement>(null), [minScale, setMinScale] = useState(1);
  useEffect(() => {
    const listener = (event: MessageEvent) => { if (event.source === frame.current?.contentWindow && event.data?.kind === "boxsys-label-fit" && typeof event.data.minScale === "number") setMinScale(event.data.minScale); };
    window.addEventListener("message", listener); return () => window.removeEventListener("message", listener);
  }, []);
  useEffect(() => {
    if (!root.current) return;
    const observer = new ResizeObserver(entries => setWidth(Math.max(80, entries[0].contentRect.width - 2)));
    observer.observe(root.current); return () => observer.disconnect();
  }, []);
  const errors = validateLabelPrint(settings), g = labelGeometry(settings);
  const firstPage = contents.slice(0, Math.max(0, g.capacity - settings.skip));
  return <div ref={root} className="w-full min-w-0">
    {!errors.length && firstPage.length > 0 ? <>
      <div className="max-h-[460px] overflow-x-hidden overflow-y-auto rounded border border-slate-200 bg-slate-50"><iframe ref={frame} title="Prévia real da primeira página de etiquetas" sandbox="allow-scripts" className="block w-full border-0 bg-white" style={{ height: Math.max(40, g.pageHeight / settings.paperWidth * width + 2) }} srcDoc={labelPrintDocument(settings, firstPage, "Prévia das etiquetas", false, width)} /></div>
      <p className="mt-3 text-xs leading-5 text-slate-500">{settings.columns} coluna{settings.columns > 1 ? "s" : ""} por fileira · {contents.length} etiqueta{contents.length > 1 ? "s" : ""} no lote. Posições vazias não são impressas. Prévia ajustada à tela; cada etiqueta será impressa com {settings.width} × {settings.height} mm.</p>
      {minScale < .65 && <p className="mt-2 rounded-lg bg-amber-50 p-2 text-[11px] leading-5 text-amber-800">Há muito conteúdo para este tamanho. Ele foi reduzido para caber; desative campos ou use uma etiqueta maior para melhorar a leitura. Confira o código com o leitor antes de imprimir um lote.</p>}
    </> : <p className="p-4 text-center text-xs text-slate-500">{errors.length ? "Revise as medidas para visualizar a impressão." : "Gerando os códigos e a prévia…"}</p>}
  </div>;
}
