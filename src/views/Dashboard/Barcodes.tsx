import { useState, useEffect, useRef, useCallback } from "react";
import {
  Barcode, Search, Printer, Download, RefreshCw,
  Package, ChevronDown, Tag, Plus, Minus, Check,
  HelpCircle, PenLine,
} from "lucide-react";
import { EmptyState } from "../../components/layout/EmptyState";
import {
  Button, IconButton, Input, Select, Textarea, Badge, Alert, Tabs, PageWrapper, SectionTitle, PanelCard,
  FilterLine, FilterLineSection, FilterLineItem, FilterLineSearch, FilterLineSegmented,
} from "../../components/ui";
import { Product } from "../../types";
import { cn } from "../../lib/utils";
import BarcodesPageTour, { BARCODES_PAGE_TOUR_EVENTS, type BarcodesPageTourHandle } from "../../components/onboarding/BarcodesPageTour";

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
    <div data-label-card className={cn("bg-white border border-slate-200 rounded-lg p-2 flex flex-col items-center gap-1 shadow-sm", sizeMap[labelSize])}>
      {fields.showName && (
        <p className="text-[10px] font-semibold text-slate-800 text-center line-clamp-2 leading-tight w-full">
          {product.name}
        </p>
      )}
      {fields.showPrice && (
        <p className="text-[11px] font-semibold text-blue-600 font-mono">
          R$ {Number(product.price).toFixed(2)}
        </p>
      )}
      {fields.showSku && code && (
        <p className="text-[10px] text-slate-400 font-mono">{code}</p>
      )}
      {fields.showBarcode && (
        code ? (
          <svg ref={svgRef} className="w-full" />
        ) : (
          <div className="w-full h-12 flex items-center justify-center bg-slate-50 rounded border border-dashed border-slate-200">
            <p className="text-[10px] text-slate-400 font-semibold">Sem código</p>
          </div>
        )
      )}
      {fields.showQrCode && code && (
        <canvas ref={canvasRef} className="max-w-full" />
      )}
    </div>
  );
}

type CustomLabelFields = {
  showCustomer: boolean;
  showReference: boolean;
  showDocument: boolean;
  showPhone: boolean;
  showAddress: boolean;
  showNotes: boolean;
  showBarcode: boolean;
  showQrCode: boolean;
};

type CustomLabelData = {
  title: string;
  customer: string;
  reference: string;
  document: string;
  phone: string;
  address: string;
  notes: string;
  code: string;
  quantity: number;
};

const DEFAULT_CUSTOM_FIELDS: CustomLabelFields = {
  showCustomer: true,
  showReference: true,
  showDocument: false,
  showPhone: false,
  showAddress: false,
  showNotes: true,
  showBarcode: true,
  showQrCode: false,
};

const DEFAULT_CUSTOM_LABEL: CustomLabelData = {
  title: "Etiqueta personalizada",
  customer: "",
  reference: "",
  document: "",
  phone: "",
  address: "",
  notes: "",
  code: "",
  quantity: 1,
};

function CustomLabelCard({ data, labelSize, fields }: { data: CustomLabelData; labelSize: LabelSize; fields: CustomLabelFields }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const code = data.code || data.reference;

  useEffect(() => {
    if (code && fields.showBarcode) loadJsBarcode().then(() => renderBarcode(svgRef.current, code, { height: 40, fontSize: 9, width: 1.3 }));
  }, [code, fields.showBarcode]);
  useEffect(() => {
    if (code && fields.showQrCode) loadQRCode().then(() => renderQRCode(canvasRef.current, code, 58));
  }, [code, fields.showQrCode]);

  const sizeMap = { small: "w-36", medium: "w-48", large: "w-60" };
  return (
    <div data-custom-label className={cn("flex min-h-28 flex-col items-center gap-1 rounded-lg border border-slate-200 bg-white p-2 shadow-sm", sizeMap[labelSize])}>
      <p className="w-full text-center text-[11px] font-semibold leading-tight text-slate-900">{data.title || "Etiqueta personalizada"}</p>
      {fields.showCustomer && data.customer && <p className="w-full truncate text-center text-[10px] font-semibold text-slate-700">{data.customer}</p>}
      {fields.showReference && data.reference && <p className="w-full text-center text-[10px] font-mono font-semibold text-blue-600">{data.reference}</p>}
      {fields.showDocument && data.document && <p className="text-center text-[10px] text-slate-500">{data.document}</p>}
      {fields.showPhone && data.phone && <p className="text-center text-[10px] text-slate-500">{data.phone}</p>}
      {fields.showAddress && data.address && <p className="line-clamp-2 text-center text-[10px] text-slate-500">{data.address}</p>}
      {fields.showNotes && data.notes && <p className="line-clamp-2 text-center text-[10px] italic text-slate-500">{data.notes}</p>}
      {fields.showBarcode && (code ? <svg ref={svgRef} className="mt-auto w-full" /> : <div className="mt-auto w-full rounded border border-dashed border-slate-200 py-2 text-center text-[10px] font-semibold text-slate-400">Inclua código ou referência</div>)}
      {fields.showQrCode && code && <canvas ref={canvasRef} className="max-w-full" />}
    </div>
  );
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (char) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#039;", '"': "&quot;" }[char] || char));
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
      <span className="text-[10px] text-slate-400 font-semibold">Sem código</span>
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

function LabelInput({ label, value, onChange, placeholder, hint }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; hint?: string }) {
  return (
    <Input label={label} hint={hint} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
  );
}

function OptionButtons<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: [T, string][]; onChange: (value: T) => void }) {
  return (
    <div className="space-y-1">
      <p className="ds-label">{label}</p>
      <FilterLineSegmented<T>
        size="sm"
        value={value}
        options={options.map(([option, text]) => ({ value: option, label: text }))}
        onChange={onChange}
      />
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
const LABEL_MODE_TABS = [
  { id: "products", label: "Etiquetas de produtos", icon: Tag },
  { id: "custom", label: "Criar etiqueta própria", icon: PenLine },
] as const;

export default function Barcodes() {
  const [labelMode, setLabelMode]   = useState<"products" | "custom">("products");
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
  const customPrintRef = useRef<HTMLDivElement>(null);
  const barcodesPageTourRef = useRef<BarcodesPageTourHandle>(null);
  const [customLabel, setCustomLabel] = useState<CustomLabelData>(() => {
    try { return { ...DEFAULT_CUSTOM_LABEL, ...JSON.parse(localStorage.getItem("custom-label-draft") || "{}") }; }
    catch { return DEFAULT_CUSTOM_LABEL; }
  });
  const [customFields, setCustomFields] = useState<CustomLabelFields>(() => {
    try { return { ...DEFAULT_CUSTOM_FIELDS, ...JSON.parse(localStorage.getItem("custom-label-fields") || "{}") }; }
    catch { return DEFAULT_CUSTOM_FIELDS; }
  });

  useEffect(() => {
    fetch("/api/products", { headers: API_HEADERS() })
      .then((r) => r.json())
      .then((d) => {
        setProducts(Array.isArray(d) ? d : []);
        setLoading(false);
      });
    loadJsBarcode().then(() => setJsBarcodeReady(true));
  }, []);

  useEffect(() => {
    localStorage.setItem("custom-label-draft", JSON.stringify(customLabel));
  }, [customLabel]);
  useEffect(() => {
    localStorage.setItem("custom-label-fields", JSON.stringify(customFields));
  }, [customFields]);

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

  // ── Canal de comunicação do TOUR DE PÁGINA (BarcodesPageTour) ─────────────
  // Barcodes.tsx não tinha nenhum canal de tour antes; este é o primeiro.
  // Marca/limpa a seleção de verdade via toggleSelect/clearAll — o mesmo que
  // clicar no checkbox de um produto faria. Nunca chama handlePrint (que
  // abre uma janela nova e dispara window.print() real).
  useEffect(() => {
    const onSelectSample = () => {
      const list = Array.isArray(filtered) ? filtered : [];
      if (list.length > 0 && !isSelected(list[0].id)) toggleSelect(list[0]);
    };
    const onClearSelection = () => clearAll();

    window.addEventListener(BARCODES_PAGE_TOUR_EVENTS.selectSample, onSelectSample);
    window.addEventListener(BARCODES_PAGE_TOUR_EVENTS.clearSelection, onClearSelection);
    return () => {
      window.removeEventListener(BARCODES_PAGE_TOUR_EVENTS.selectSample, onSelectSample);
      window.removeEventListener(BARCODES_PAGE_TOUR_EVENTS.clearSelection, onClearSelection);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, selected]);

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
  .label-name { font-size: 7px; font-weight: 900; text-transform: ; text-align: center; line-height: 1.2; color: #111; }
  .label-price { font-size: 9px; font-weight: 900; color: #2563eb; font-family: monospace; }
  .label-sku { font-size: 7px; color: #666; font-family: monospace; }
  .label-nocode { font-size: 7px; color: #999; text-transform: ; font-weight: 700; }
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

  const handlePrintCustom = useCallback(() => {
    if (!customPrintRef.current) return;
    const card = customPrintRef.current.querySelector("[data-custom-label]");
    const code = customLabel.code || customLabel.reference;
    const barcode = customFields.showBarcode ? (card?.querySelector("svg")?.outerHTML || "") : "";
    const canvas = card?.querySelector("canvas") as HTMLCanvasElement | null;
    const qr = customFields.showQrCode && code && canvas ? `<img class="label-qr" src="${canvas.toDataURL()}" />` : "";
    const item = (show: boolean, value: string, className: string) => show && value ? `<div class="${className}">${escapeHtml(value)}</div>` : "";
    const label = `
      <div class="label">
        <div class="label-title">${escapeHtml(customLabel.title || "Etiqueta personalizada")}</div>
        ${item(customFields.showCustomer, customLabel.customer, "label-customer")}
        ${item(customFields.showReference, customLabel.reference, "label-reference")}
        ${item(customFields.showDocument, customLabel.document, "label-text")}
        ${item(customFields.showPhone, customLabel.phone, "label-text")}
        ${item(customFields.showAddress, customLabel.address, "label-text")}
        ${item(customFields.showNotes, customLabel.notes, "label-notes")}
        ${barcode}${qr}
      </div>`;
    const labelW = { small: "90px", medium: "130px", large: "170px" }[labelSize];
    const cards = Array.from({ length: Math.max(1, Math.min(500, customLabel.quantity || 1)) }, () => label).join("");
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) return;
    w.document.open();
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Etiquetas personalizadas</title><style>
      *{box-sizing:border-box;margin:0;padding:0} body{font-family:Arial,sans-serif;background:#fff}.grid{display:grid;grid-template-columns:repeat(${cols},${labelW});gap:6px;padding:12px}.label{width:${labelW};min-height:88px;border:1px solid #bbb;border-radius:5px;padding:5px;display:flex;flex-direction:column;align-items:center;gap:2px;text-align:center}.label-title{font-size:8px;font-weight:900;;line-height:1.2}.label-customer{font-size:8px;font-weight:700}.label-reference{font:700 8px monospace;color:#2563eb}.label-text,.label-notes{font-size:7px;color:#555;line-height:1.25}.label-notes{font-style:italic}svg{width:100%;margin-top:auto}.label-qr{width:42px;height:42px}@media print{@page{margin:8mm}}
    </style></head><body><div class="grid">${cards}</div></body></html>`);
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 600);
  }, [customLabel, customFields, labelSize, cols]);

  const totalLabels = selected.reduce((s, x) => s + x.qty, 0);
  const setCustom = (patch: Partial<CustomLabelData>) => setCustomLabel((current) => ({ ...current, ...patch }));

  return (
    <PageWrapper data-tour="barcodes-page">
    <div className="space-y-4">
      <SectionTitle
        title="Etiquetas & Códigos de Barras"
        description="Gere, visualize e imprima etiquetas com código de barras"
        action={
          <>
            {labelMode === "products" && selected.length > 0 && (
              <Button variant="primary" iconLeft={<Printer size={14} />} onClick={handlePrint}>
                Imprimir {totalLabels} etiqueta{totalLabels !== 1 ? "s" : ""}
              </Button>
            )}
            {labelMode === "custom" && (
              <Button variant="primary" iconLeft={<Printer size={14} />} onClick={handlePrintCustom}>
                Imprimir {customLabel.quantity || 1}
              </Button>
            )}
            <Button
              variant="outline"
              icon={<HelpCircle size={14} />}
              onClick={() => barcodesPageTourRef.current?.start()}
              title="Tour guiado desta página"
            >
              <span className="sr-only sm:not-sr-only">Ajuda</span>
            </Button>
          </>
        }
      />

      <BarcodesPageTour ref={barcodesPageTourRef} />

      <Tabs<typeof LABEL_MODE_TABS[number]["id"]> items={LABEL_MODE_TABS} value={labelMode} onChange={setLabelMode} label="Tipo de etiqueta">
      <div className={cn("flex flex-col gap-4 xl:flex-row", labelMode !== "products" && "hidden")}>

        {/* ── PAINEL ESQUERDO — seleção de produtos ──────────────────────── */}
        <div className="flex-1 min-w-0 space-y-3">

          {/* filtros */}
          <FilterLine>
            <FilterLineSection grow>
              <FilterLineItem grow minWidth={200}>
                <FilterLineSearch
                  placeholder="Buscar produto ou código..."
                  value={search}
                  onChange={setSearch}
                />
              </FilterLineItem>
              <FilterLineItem>
                <Select
                  size="sm"
                  aria-label="Filtrar por código de barras"
                  value={showOnly}
                  onChange={(e) => setShowOnly(e.target.value as typeof showOnly)}
                >
                  <option value="all">Todos os produtos</option>
                  <option value="with">Com código de barras</option>
                  <option value="without">Sem código de barras</option>
                </Select>
              </FilterLineItem>
            </FilterLineSection>
            <FilterLineSection align="right">
              <span className="text-[11px] font-medium text-slate-400">
                {filtered.length} produto{filtered.length !== 1 ? "s" : ""}
              </span>
              <Button variant="ghost" size="xs" onClick={selectAll}>Selecionar com código</Button>
              {selected.length > 0 && (
                <Button variant="ghost" size="xs" onClick={clearAll}>Limpar</Button>
              )}
            </FilterLineSection>
          </FilterLine>

          {/* lista de produtos */}
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <RefreshCw size={20} className="animate-spin text-slate-300" />
            </div>
          ) : (
            <div className="space-y-1.5 xl:max-h-[calc(100vh-320px)] xl:overflow-y-auto admin-scroll pr-1">
              {filtered.map((p, idx) => {
                const sel = isSelected(p.id);
                const item = selected.find((s) => s.product.id === p.id);
                return (
                  <div
                    key={p.id}
                    className={cn(
                      "bg-white rounded-lg border transition-all",
                      sel
                        ? "border-blue-400 shadow-sm"
                        : "border-slate-200 hover:border-slate-300",
                    )}
                  >
                    <div className="flex items-center gap-3 p-3">
                      {/* checkbox */}
                      <button
                        type="button"
                        aria-label={sel ? "Desmarcar produto" : "Selecionar produto"}
                        aria-pressed={sel}
                        {...(idx === 0 ? { "data-tour": "barcodes-select-sample-btn" } : {})}
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
                        <p className="text-xs font-medium text-slate-800 truncate">{p.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {(p.barcode || p.sku) ? (
                            <span className="text-[11px] font-mono text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                              {p.barcode || p.sku}
                            </span>
                          ) : (
                            <Badge color="warning">Sem código</Badge>
                          )}
                          <span className="text-[11px] font-medium text-blue-600 font-mono">
                            R$ {Number(p.price).toFixed(2)}
                          </span>
                        </div>
                      </div>

                      {/* qty control (só quando selecionado) */}
                      {sel && (
                        <div className="flex items-center gap-1 shrink-0">
                          <IconButton variant="secondary" size="sm" aria-label="Diminuir quantidade" onClick={() => updateQty(p.id, -1)}>
                            <Minus size={11} />
                          </IconButton>
                          <span className="w-8 text-center text-xs font-medium text-slate-900 tabular-nums">
                            {item?.qty}
                          </span>
                          <IconButton variant="secondary" size="sm" aria-label="Aumentar quantidade" onClick={() => updateQty(p.id, 1)}>
                            <Plus size={11} />
                          </IconButton>
                        </div>
                      )}

                      {/* barcode mini-preview */}
                      {(p.barcode || p.sku) && jsBarcodeReady && (
                        <div className="hidden w-20 shrink-0 md:block">
                          <BarcodePreview code={p.barcode || p.sku || ""} />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {filtered.length === 0 && (
                <EmptyState bordered={false} icon={<Barcode size={28} strokeWidth={1} />} title="Nenhum produto encontrado" />
              )}
            </div>
          )}
        </div>

        {/* ── PAINEL DIREITO — configuração + preview ─────────────────────── */}
        <div className="w-full shrink-0 space-y-4 xl:w-80">

          {/* Configurações de impressão */}
          <PanelCard title="Configurações de Impressão" contentClassName="space-y-4">
            {/* Tamanho da etiqueta */}
            <div data-tour="barcodes-label-size" className="space-y-1">
              <p className="ds-label">Tamanho da Etiqueta</p>
              <FilterLineSegmented<LabelSize>
                size="sm"
                value={labelSize}
                options={[
                  { value: "small", label: "Pequena" },
                  { value: "medium", label: "Média" },
                  { value: "large", label: "Grande" },
                ]}
                onChange={setLabelSize}
              />
            </div>

            {/* Layout da folha */}
            <div data-tour="barcodes-layout" className="space-y-1">
              <p className="ds-label">Colunas por Linha</p>
              <FilterLineSegmented<LabelLayout>
                size="sm"
                value={layout}
                options={(["1x1", "2x2", "3x3", "4x4"] as LabelLayout[]).map((l) => ({ value: l, label: `${l[0]}×` }))}
                onChange={setLayout}
              />
            </div>

            {/* Campos da etiqueta */}
            <div data-tour="barcodes-fields" className="space-y-1">
              <p className="ds-label">Campos da Etiqueta</p>
              <div className="grid grid-cols-2 gap-1.5">
                {([
                  ["showName", "Nome"],
                  ["showPrice", "Valor"],
                  ["showBarcode", "Cód. de Barras"],
                  ["showQrCode", "QR Code"],
                  ["showSku", "Número/SKU"],
                ] as [keyof LabelFields, string][]).map(([key, label]) => (
                  <Button
                    key={key}
                    size="sm"
                    variant={fields[key] ? "success" : "outline"}
                    aria-pressed={fields[key]}
                    iconLeft={fields[key] ? <Check size={11} strokeWidth={3} /> : undefined}
                    onClick={() => setFields((f) => ({ ...f, [key]: !f[key] }))}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Resumo */}
            <div className="bg-slate-50 rounded-lg p-3 space-y-1">
              <div className="flex justify-between text-[11px] font-medium">
                <span className="text-slate-400">Produtos selecionados</span>
                <span className="text-slate-700">{selected.length}</span>
              </div>
              <div className="flex justify-between text-[11px] font-medium">
                <span className="text-slate-400">Total de etiquetas</span>
                <span className="text-blue-600">{totalLabels}</span>
              </div>
            </div>

            <Button
              data-tour="barcodes-print-btn"
              variant="primary"
              fullWidth
              size="lg"
              iconLeft={<Printer size={15} />}
              onClick={handlePrint}
              disabled={totalLabels === 0}
            >
              Imprimir Etiquetas
            </Button>
          </PanelCard>

          {/* Preview das etiquetas */}
          {selected.length > 0 && (
            <PanelCard data-tour="barcodes-preview" title="Pré-visualização" icon={Tag} contentClassName="space-y-3">
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
            </PanelCard>
          )}

          {/* Dica de leitor */}
          <Alert variant="info" title="Leitor de código de barras">
            Conecte seu leitor USB ao computador. No PDV, o campo de busca detecta automaticamente o scan — o produto é adicionado ao carrinho sem precisar clicar. Funciona com qualquer leitor HID (plug-and-play).
          </Alert>
        </div>
      </div>

      {labelMode === "custom" && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <PanelCard
            className="min-w-0"
            title="Monte sua etiqueta"
            description="Preencha livremente com os dados de cliente, pedido, ordem de serviço ou orçamento."
            contentClassName="space-y-4"
            action={
              <Button variant="ghost" size="sm" onClick={() => { setCustomLabel(DEFAULT_CUSTOM_LABEL); setCustomFields(DEFAULT_CUSTOM_FIELDS); }}>
                Limpar campos
              </Button>
            }
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <LabelInput label="Título da etiqueta" value={customLabel.title} onChange={(value) => setCustom({ title: value })} placeholder="Ex.: Retirada de pedido" />
              <LabelInput label="Cliente / destinatário" value={customLabel.customer} onChange={(value) => setCustom({ customer: value })} placeholder="Nome do cliente" />
              <LabelInput label="Pedido, OS ou orçamento" value={customLabel.reference} onChange={(value) => setCustom({ reference: value })} placeholder="Ex.: Pedido #1042" />
              <LabelInput label="Código para barras / QR" value={customLabel.code} onChange={(value) => setCustom({ code: value })} placeholder="Ex.: PED-1042" hint="Se vazio, usamos a referência acima." />
              <LabelInput label="CPF / CNPJ" value={customLabel.document} onChange={(value) => setCustom({ document: value })} placeholder="Opcional" />
              <LabelInput label="Telefone" value={customLabel.phone} onChange={(value) => setCustom({ phone: value })} placeholder="Opcional" />
              <div className="sm:col-span-2"><LabelInput label="Endereço / local de entrega" value={customLabel.address} onChange={(value) => setCustom({ address: value })} placeholder="Rua, número, bairro, cidade" /></div>
              <div className="sm:col-span-2">
                <Textarea label="Observação" value={customLabel.notes} onChange={(event) => setCustom({ notes: event.target.value })} placeholder="Ex.: Separar para retirada no balcão" rows={3} />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 border-t border-slate-100 pt-4 sm:grid-cols-3">
              <div className="space-y-1">
                <p className="ds-label">Quantidade</p>
                <div className="flex w-fit items-center gap-1 rounded-lg border border-slate-200 bg-white p-1">
                  <IconButton variant="ghost" aria-label="Diminuir quantidade" onClick={() => setCustom({ quantity: Math.max(1, customLabel.quantity - 1) })}><Minus size={13} /></IconButton>
                  <span className="w-9 text-center text-xs font-medium tabular-nums">{customLabel.quantity}</span>
                  <IconButton variant="ghost" aria-label="Aumentar quantidade" onClick={() => setCustom({ quantity: Math.min(500, customLabel.quantity + 1) })}><Plus size={13} /></IconButton>
                </div>
              </div>
              <OptionButtons label="Tamanho" value={labelSize} options={[ ["small", "Pequena"], ["medium", "Média"], ["large", "Grande"] ] as [LabelSize, string][]} onChange={(value) => setLabelSize(value as LabelSize)} />
              <OptionButtons label="Colunas" value={layout} options={[ ["1x1", "1×"], ["2x2", "2×"], ["3x3", "3×"], ["4x4", "4×"] ] as [LabelLayout, string][]} onChange={(value) => setLayout(value as LabelLayout)} />
            </div>

            <div className="space-y-1 border-t border-slate-100 pt-4">
              <p className="ds-label">Dados que aparecerão na etiqueta</p>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                {([ ["showCustomer", "Cliente"], ["showReference", "Pedido / OS"], ["showDocument", "CPF / CNPJ"], ["showPhone", "Telefone"], ["showAddress", "Endereço"], ["showNotes", "Observação"], ["showBarcode", "Barras"], ["showQrCode", "QR Code"] ] as [keyof CustomLabelFields, string][]).map(([key, label]) => (
                  <Button
                    key={key}
                    size="sm"
                    variant={customFields[key] ? "success" : "outline"}
                    aria-pressed={customFields[key]}
                    iconLeft={customFields[key] ? <Check size={11} strokeWidth={3} /> : undefined}
                    onClick={() => setCustomFields((current) => ({ ...current, [key]: !current[key] }))}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>
          </PanelCard>

          <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
            <PanelCard title="Como vai ficar" description="Pré-visualização em tempo real" icon={Tag} contentClassName="space-y-3">
              <div ref={customPrintRef} className="flex max-h-[420px] justify-center overflow-auto rounded-lg bg-slate-50 p-4">
                <CustomLabelCard data={customLabel} labelSize={labelSize} fields={customFields} />
              </div>
              <Button variant="primary" fullWidth size="lg" iconLeft={<Printer size={14} />} onClick={handlePrintCustom}>
                Imprimir {customLabel.quantity} etiqueta{customLabel.quantity !== 1 ? "s" : ""}
              </Button>
            </PanelCard>
            <Alert variant="info" title="Dica rápida">
              Cadastre os dados que desejar, escolha o que aparece e imprima. Seu rascunho fica salvo neste dispositivo para continuar depois.
            </Alert>
          </aside>
        </div>
      )}
      </Tabs>
    </div>
    </PageWrapper>
  );
}
