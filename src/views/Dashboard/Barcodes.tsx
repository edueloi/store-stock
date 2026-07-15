import { useState, useEffect, useRef, useCallback } from "react";
import {
  Barcode, Search, Printer, Download, RefreshCw,
  Package, ChevronDown, Tag, Plus, Minus, Check,
} from "lucide-react";
import PageHeader from "../../components/layout/PageHeader";
import { Product } from "../../types";
import { cn } from "../../lib/utils";

const API_HEADERS = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${localStorage.getItem("token")}`,
});

// ── JsBarcode loader (CDN dinâmico, sem instalar pacote) ──────────────────────
let jsBarcodePromise: Promise<void> | null = null;
function loadJsBarcode(): Promise<void> {
  if ((window as any).JsBarcode) return Promise.resolve();
  if (jsBarcodePromise) return jsBarcodePromise;
  jsBarcodePromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js";
    s.onload = () => resolve();
    s.onerror = reject;
    document.head.appendChild(s);
  });
  return jsBarcodePromise;
}

// ── Gera SVG de código de barras ─────────────────────────────────────────────
function renderBarcode(svg: SVGSVGElement | null, code: string, opts?: object) {
  if (!svg || !(window as any).JsBarcode) return;
  try {
    (window as any).JsBarcode(svg, code, {
      format: "CODE128",
      width: 1.8,
      height: 48,
      displayValue: true,
      fontSize: 11,
      margin: 4,
      ...opts,
    });
  } catch { /* código inválido */ }
}

// ── QRCode loader (CDN dinâmico, sem instalar pacote) ─────────────────────────
let qrCodePromise: Promise<void> | null = null;
function loadQRCode(): Promise<void> {
  if ((window as any).QRCode) return Promise.resolve();
  if (qrCodePromise) return qrCodePromise;
  qrCodePromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js";
    s.onload = () => resolve();
    s.onerror = reject;
    document.head.appendChild(s);
  });
  return qrCodePromise;
}

// ── Gera canvas de QR Code ────────────────────────────────────────────────────
function renderQRCode(canvas: HTMLCanvasElement | null, code: string, size = 64) {
  if (!canvas || !(window as any).QRCode) return;
  (window as any).QRCode.toCanvas(canvas, code, { width: size, margin: 0 }, () => {});
}

// ── Componente de etiqueta individual ────────────────────────────────────────
function LabelCard({
  product, qty, labelSize, fields,
}: {
  product: Product & { barcode?: string };
  qty: number;
  labelSize: "small" | "medium" | "large";
  fields: LabelFields;
}) {
  const svgRef    = useRef<SVGSVGElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const code      = product.barcode || product.sku || "";

  useEffect(() => {
    if (!code || !fields.showBarcode) return;
    loadJsBarcode().then(() => renderBarcode(svgRef.current, code));
  }, [code, fields.showBarcode]);

  useEffect(() => {
    if (!code || !fields.showQrCode) return;
    loadQRCode().then(() => renderQRCode(canvasRef.current, code, 64));
  }, [code, fields.showQrCode]);

  const sizeMap = {
    small:  "w-32",
    medium: "w-44",
    large:  "w-56",
  };

  return (
    <div data-label-card className={cn("bg-white border border-slate-200 rounded-xl p-2 flex flex-col items-center gap-1 shadow-sm", sizeMap[labelSize])}>
      {fields.showName && (
        <p className="text-[9px] font-black text-slate-800 uppercase tracking-wide text-center line-clamp-2 leading-tight w-full">
          {product.name}
        </p>
      )}
      {fields.showPrice && (
        <p className="text-[10px] font-black text-blue-600 font-mono">
          R$ {Number(product.price).toFixed(2)}
        </p>
      )}
      {fields.showSku && code && (
        <p className="text-[8px] text-slate-400 font-mono tracking-wide">{code}</p>
      )}
      {fields.showBarcode && (
        code ? (
          <svg ref={svgRef} className="w-full" />
        ) : (
          <div className="w-full h-12 flex items-center justify-center bg-slate-50 rounded border border-dashed border-slate-200">
            <p className="text-[8px] text-slate-400 font-bold uppercase">Sem código</p>
          </div>
        )
      )}
      {fields.showQrCode && code && (
        <canvas ref={canvasRef} className="max-w-full" />
      )}
    </div>
  );
}

// ── Componente preview de barcode para seleção ────────────────────────────────
function BarcodePreview({ code }: { code: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (!code) return;
    loadJsBarcode().then(() => renderBarcode(svgRef.current, code, { height: 36, fontSize: 9, width: 1.4 }));
  }, [code]);

  if (!code) return (
    <div className="h-10 flex items-center justify-center bg-slate-50 rounded-lg border border-dashed border-slate-200">
      <span className="text-[9px] text-slate-400 font-bold uppercase">Sem código</span>
    </div>
  );
  return <svg ref={svgRef} className="w-full" />;
}

// ── Tipos ─────────────────────────────────────────────────────────────────────
interface SelectedItem {
  product: Product;
  qty: number;
}

type LabelSize = "small" | "medium" | "large";
type LabelLayout = "1x1" | "2x2" | "3x3" | "4x4";

interface LabelFields {
  showName: boolean;
  showPrice: boolean;
  showBarcode: boolean;
  showQrCode: boolean;
  showSku: boolean;
}

const DEFAULT_LABEL_FIELDS: LabelFields = {
  showName: true,
  showPrice: true,
  showBarcode: true,
  showQrCode: false,
  showSku: false,
};

const LAYOUT_COLS: Record<LabelLayout, number> = { "1x1": 1, "2x2": 2, "3x3": 3, "4x4": 4 };

// ── Componente principal ──────────────────────────────────────────────────────
export default function Barcodes() {
  const [products, setProducts]     = useState<Product[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState("");
  const [selected, setSelected]     = useState<SelectedItem[]>([]);
  const [labelSize, setLabelSize]   = useState<LabelSize>("medium");
  const [layout, setLayout]         = useState<LabelLayout>("3x3");
  const [showOnly, setShowOnly]     = useState<"all" | "with" | "without">("all");
  const [fields, setFields]         = useState<LabelFields>(DEFAULT_LABEL_FIELDS);
  const [jsBarcodeReady, setJsBarcodeReady] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/products", { headers: API_HEADERS() })
      .then((r) => r.json())
      .then((d) => {
        setProducts(Array.isArray(d) ? d : []);
        setLoading(false);
      });
    loadJsBarcode().then(() => setJsBarcodeReady(true));
  }, []);

  const filtered = products.filter((p) => {
    const code = p.barcode || p.sku || "";
    if (showOnly === "with"    && !code) return false;
    if (showOnly === "without" && code)  return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !code.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const isSelected = (id: number) => selected.some((s) => s.product.id === id);

  const toggleSelect = (p: Product) => {
    if (isSelected(p.id)) {
      setSelected((s) => s.filter((x) => x.product.id !== p.id));
    } else {
      setSelected((s) => [...s, { product: p, qty: 1 }]);
    }
  };

  const updateQty = (id: number, delta: number) =>
    setSelected((s) =>
      s.map((x) => x.product.id === id ? { ...x, qty: Math.max(1, x.qty + delta) } : x)
    );

  const selectAll = () =>
    setSelected(filtered.filter((p) => p.barcode || p.sku).map((p) => ({ product: p, qty: 1 })));

  const clearAll = () => setSelected([]);

  // Gera lista expandida de etiquetas (produto repetido pela qty)
  const labelItems = selected.flatMap(({ product, qty }) =>
    Array.from({ length: qty }, (_, i) => ({ product, key: `${product.id}-${i}` }))
  );

  const cols = LAYOUT_COLS[layout];

  // ── Impressão ─────────────────────────────────────────────────────────────
  const handlePrint = useCallback(() => {
    if (!printRef.current) return;
    const cards = Array.from(printRef.current.querySelectorAll("[data-label-card]"));

    const labelW = { small: "80px", medium: "110px", large: "140px" }[labelSize];
    const colsCSS = `repeat(${cols}, ${labelW})`;

    const cardsHtml = labelItems.map(({ product }, idx) => {
      const card = cards[idx] as HTMLElement | undefined;
      const code = product.barcode || product.sku || "";

      const svg = card?.querySelector("svg");
      const barcodeHtml = fields.showBarcode
        ? (svg ? svg.outerHTML : `<div class="label-nocode">Sem código</div>`)
        : "";

      const canvas = card?.querySelector("canvas") as HTMLCanvasElement | null;
      const qrHtml = fields.showQrCode && code && canvas
        ? `<img class="label-qr" src="${canvas.toDataURL()}" />`
        : "";

      return `
  <div class="label">
    ${fields.showName ? `<div class="label-name">${product.name}</div>` : ""}
    ${fields.showPrice ? `<div class="label-price">R$ ${Number(product.price).toFixed(2)}</div>` : ""}
    ${fields.showSku && code ? `<div class="label-sku">${code}</div>` : ""}
    ${barcodeHtml}
    ${qrHtml}
  </div>`;
    }).join("");

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Etiquetas</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #fff; font-family: Arial, sans-serif; }
  .grid { display: grid; grid-template-columns: ${colsCSS}; gap: 6px; padding: 12px; }
  .label { border: 1px solid #ccc; border-radius: 6px; padding: 4px; display: flex; flex-direction: column; align-items: center; gap: 2px; width: ${labelW}; }
  .label-name { font-size: 7px; font-weight: 900; text-transform: uppercase; text-align: center; line-height: 1.2; color: #111; }
  .label-price { font-size: 9px; font-weight: 900; color: #2563eb; font-family: monospace; }
  .label-sku { font-size: 7px; color: #666; font-family: monospace; }
  .label-nocode { font-size: 7px; color: #999; text-transform: uppercase; font-weight: 700; }
  svg { width: 100%; }
  .label-qr { width: 40px; height: 40px; }
  @media print { @page { margin: 8mm; } body { background: #fff; } }
</style></head><body>
<div class="grid">
${cardsHtml}
</div>
</body></html>`;

    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 600);
  }, [labelItems, labelSize, cols, fields]);

  const totalLabels = selected.reduce((s, x) => s + x.qty, 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Etiquetas & Códigos de Barras"
        subtitle="Gere, visualize e imprima etiquetas com código de barras"
        action={
          selected.length > 0 ? (
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 bg-slate-900 text-white px-5 h-10 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-700 transition-all shadow-lg"
            >
              <Printer size={14} strokeWidth={2.5} />
              Imprimir {totalLabels} etiqueta{totalLabels !== 1 ? "s" : ""}
            </button>
          ) : undefined
        }
      />

      <div className="flex flex-col lg:flex-row gap-4">

        {/* ── PAINEL ESQUERDO — seleção de produtos ──────────────────────── */}
        <div className="flex-1 min-w-0 space-y-3">

          {/* filtros */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar produto ou código..."
                  className="w-full pl-9 pr-4 h-10 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:border-blue-400 transition-all"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <select
                value={showOnly}
                onChange={(e) => setShowOnly(e.target.value as typeof showOnly)}
                className="h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-blue-400 appearance-none pr-8 transition-all"
              >
                <option value="all">Todos os produtos</option>
                <option value="with">Com código de barras</option>
                <option value="without">Sem código de barras</option>
              </select>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                {filtered.length} produto{filtered.length !== 1 ? "s" : ""}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={selectAll}
                  className="text-[9px] font-black uppercase tracking-widest text-blue-600 hover:text-blue-800 transition-colors"
                >
                  Selecionar com código
                </button>
                {selected.length > 0 && (
                  <button
                    onClick={clearAll}
                    className="text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    Limpar
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* lista de produtos */}
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <RefreshCw size={20} className="animate-spin text-slate-300" />
            </div>
          ) : (
            <div className="space-y-1.5 max-h-[calc(100vh-320px)] overflow-y-auto admin-scroll pr-1">
              {filtered.map((p) => {
                const sel = isSelected(p.id);
                const item = selected.find((s) => s.product.id === p.id);
                return (
                  <div
                    key={p.id}
                    className={cn(
                      "bg-white rounded-xl border transition-all",
                      sel
                        ? "border-blue-400 shadow-md shadow-blue-500/10"
                        : "border-slate-100 hover:border-slate-200 shadow-sm",
                    )}
                  >
                    <div className="flex items-center gap-3 p-3">
                      {/* checkbox */}
                      <button
                        onClick={() => toggleSelect(p)}
                        className={cn(
                          "w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all",
                          sel
                            ? "bg-blue-600 border-blue-600"
                            : "border-slate-300 hover:border-blue-400",
                        )}
                      >
                        {sel && <Check size={12} strokeWidth={3} className="text-white" />}
                      </button>

                      {/* thumb */}
                      <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-50 border border-slate-100 shrink-0 flex items-center justify-center">
                        {p.image_url
                          ? <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                          : <Package size={16} className="text-slate-300" />}
                      </div>

                      {/* info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-800 truncate">{p.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {(p.barcode || p.sku) ? (
                            <span className="text-[9px] font-mono text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                              {p.barcode || p.sku}
                            </span>
                          ) : (
                            <span className="text-[9px] text-amber-500 font-bold uppercase tracking-wide">
                              Sem código
                            </span>
                          )}
                          <span className="text-[9px] font-bold text-blue-600 font-mono">
                            R$ {Number(p.price).toFixed(2)}
                          </span>
                        </div>
                      </div>

                      {/* qty control (só quando selecionado) */}
                      {sel && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => updateQty(p.id, -1)}
                            className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-all"
                          >
                            <Minus size={11} />
                          </button>
                          <span className="w-8 text-center text-xs font-black text-slate-900 tabular-nums">
                            {item?.qty}
                          </span>
                          <button
                            onClick={() => updateQty(p.id, 1)}
                            className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-all"
                          >
                            <Plus size={11} />
                          </button>
                        </div>
                      )}

                      {/* barcode mini-preview */}
                      {(p.barcode || p.sku) && jsBarcodeReady && (
                        <div className="w-20 shrink-0">
                          <BarcodePreview code={p.barcode || p.sku || ""} />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {filtered.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <Barcode size={36} strokeWidth={1} className="text-slate-200" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-300">
                    Nenhum produto encontrado
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── PAINEL DIREITO — configuração + preview ─────────────────────── */}
        <div className="w-full lg:w-80 shrink-0 space-y-4">

          {/* Configurações de impressão */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-700 border-l-4 border-blue-500 pl-3">
              Configurações de Impressão
            </p>

            {/* Tamanho da etiqueta */}
            <div className="space-y-2">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Tamanho da Etiqueta</p>
              <div className="grid grid-cols-3 gap-1.5">
                {(["small", "medium", "large"] as LabelSize[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => setLabelSize(s)}
                    className={cn(
                      "h-9 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all",
                      labelSize === s
                        ? "bg-slate-900 border-slate-900 text-white shadow-sm"
                        : "border-slate-200 text-slate-500 hover:border-slate-400 bg-white",
                    )}
                  >
                    {s === "small" ? "Pequena" : s === "medium" ? "Média" : "Grande"}
                  </button>
                ))}
              </div>
            </div>

            {/* Layout da folha */}
            <div className="space-y-2">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Colunas por Linha</p>
              <div className="grid grid-cols-4 gap-1.5">
                {(["1x1", "2x2", "3x3", "4x4"] as LabelLayout[]).map((l) => (
                  <button
                    key={l}
                    onClick={() => setLayout(l)}
                    className={cn(
                      "h-9 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all",
                      layout === l
                        ? "bg-blue-600 border-blue-500 text-white shadow-sm"
                        : "border-slate-200 text-slate-500 hover:border-slate-400 bg-white",
                    )}
                  >
                    {l[0]}×
                  </button>
                ))}
              </div>
            </div>

            {/* Campos da etiqueta */}
            <div className="space-y-2">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Campos da Etiqueta</p>
              <div className="grid grid-cols-2 gap-1.5">
                {([
                  ["showName", "Nome"],
                  ["showPrice", "Valor"],
                  ["showBarcode", "Cód. de Barras"],
                  ["showQrCode", "QR Code"],
                  ["showSku", "Número/SKU"],
                ] as [keyof LabelFields, string][]).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setFields((f) => ({ ...f, [key]: !f[key] }))}
                    className={cn(
                      "h-9 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 px-2",
                      fields[key]
                        ? "bg-emerald-600 border-emerald-500 text-white shadow-sm"
                        : "border-slate-200 text-slate-500 hover:border-slate-400 bg-white",
                    )}
                  >
                    {fields[key] && <Check size={11} strokeWidth={3} />}
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Resumo */}
            <div className="bg-slate-50 rounded-xl p-3 space-y-1">
              <div className="flex justify-between text-[9px] font-bold uppercase tracking-widest">
                <span className="text-slate-400">Produtos selecionados</span>
                <span className="text-slate-700">{selected.length}</span>
              </div>
              <div className="flex justify-between text-[9px] font-bold uppercase tracking-widest">
                <span className="text-slate-400">Total de etiquetas</span>
                <span className="text-blue-600">{totalLabels}</span>
              </div>
            </div>

            <button
              onClick={handlePrint}
              disabled={totalLabels === 0}
              className="w-full h-12 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg"
            >
              <Printer size={15} strokeWidth={2.5} />
              Imprimir Etiquetas
            </button>
          </div>

          {/* Preview das etiquetas */}
          {selected.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-700 border-l-4 border-emerald-500 pl-3">
                  Pré-visualização
                </p>
                <Tag size={14} className="text-slate-300" />
              </div>

              {/* grid de etiquetas */}
              <div
                ref={printRef}
                className="overflow-auto max-h-96"
                style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(cols, 3)}, 1fr)`, gap: "6px" }}
              >
                {labelItems.map(({ product, key }) => (
                  <LabelCard
                    key={key}
                    product={product}
                    qty={1}
                    labelSize={labelSize}
                    fields={fields}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Dica de leitor */}
          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 space-y-2">
            <p className="text-[9px] font-black uppercase tracking-widest text-blue-600">
              Leitor de código de barras
            </p>
            <p className="text-[10px] text-blue-700 leading-relaxed font-medium">
              Conecte seu leitor USB ao computador. No PDV, o campo de busca detecta automaticamente o scan — o produto é adicionado ao carrinho sem precisar clicar.
            </p>
            <p className="text-[10px] text-blue-500 font-bold">
              Funciona com qualquer leitor HID (plug-and-play).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
