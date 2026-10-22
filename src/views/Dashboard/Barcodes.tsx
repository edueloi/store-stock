import { useState, useEffect, useRef, useCallback, useMemo } from "react";
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
import LabelPrintSettings from "../../components/labels/LabelPrintSettings";
import LabelPrintPreview from "../../components/labels/LabelPrintPreview";
import { calibrationContents, labelBarcodeSvg, labelEscape, labelPrintDocument, labelSettingsStorageKey, storedLabelSettings, validateLabelPrint, type LabelPrintSettings as LabelPrintConfig } from "../../lib/labelPrinting";
import { useToast } from "../../components/ui/Toast";

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
    svg.dataset.code = code;
    delete svg.dataset.error;
  } catch { svg.innerHTML = ""; svg.dataset.error = "true"; delete svg.dataset.code; }
}

// ── QR Code carregado do pacote incluído no sistema ──────────────────────────
let qrCodePromise: Promise<void> | null = null;
function loadQRCode(): Promise<void> {
  if ((window as any).QRCode) return Promise.resolve();
  if (qrCodePromise) return qrCodePromise;
  qrCodePromise = import("qrcode").then(module => { (window as any).QRCode = module.default || module; });
  return qrCodePromise;
}

// ── Gera canvas de QR Code ────────────────────────────────────────────────────
function renderQRCode(canvas: HTMLCanvasElement | null, code: string, size = 64, onReady?: () => void) {
  if (!canvas || !(window as any).QRCode) return;
  delete canvas.dataset.code;
  (window as any).QRCode.toCanvas(canvas, code, { width: size, margin: 4 }, (error: unknown) => { if (!error) canvas.dataset.code = code; onReady?.(); });
}

// ── Componente de etiqueta individual ────────────────────────────────────────
function LabelCard({
  product, qty, labelSize, fields, onReady,
}: {
  product: Product & { barcode?: string };
  qty: number;
  labelSize: "small" | "medium" | "large";
  fields: LabelFields;
  onReady?: () => void;
}) {
  const svgRef    = useRef<SVGSVGElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const code      = product.barcode || product.sku || "";

  useEffect(() => {
    if (!code || !fields.showBarcode) return;
    loadJsBarcode().then(() => { renderBarcode(svgRef.current, code); onReady?.(); }).catch(() => onReady?.());
  }, [code, fields.showBarcode, onReady]);

  useEffect(() => {
    if (!code || !fields.showQrCode) return;
    loadQRCode().then(() => renderQRCode(canvasRef.current, code, 128, onReady)).catch(() => onReady?.());
  }, [code, fields.showQrCode, onReady]);

  const sizeMap = {
    small:  "w-32",
    medium: "w-44",
    large:  "w-56",
  };

  return (
    <div data-label-card data-product-id={product.id} className={cn("bg-white border border-slate-200 rounded-lg p-2 flex flex-col items-center gap-1 shadow-sm", sizeMap[labelSize])}>
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

function CustomLabelCard({ data, labelSize, fields, onReady }: { data: CustomLabelData; labelSize: LabelSize; fields: CustomLabelFields; onReady?: () => void }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const code = data.code || data.reference;

  useEffect(() => {
    if (code && fields.showBarcode) loadJsBarcode().then(() => { renderBarcode(svgRef.current, code, { height: 40, fontSize: 9, width: 1.3 }); onReady?.(); }).catch(() => onReady?.());
  }, [code, fields.showBarcode, onReady]);
  useEffect(() => {
    if (code && fields.showQrCode) loadQRCode().then(() => renderQRCode(canvasRef.current, code, 128, onReady)).catch(() => onReady?.());
  }, [code, fields.showQrCode, onReady]);

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

// ── Tipos ─────────────────────────────────────────────────────────────────────
interface SelectedItem {
  product: Product;
  qty: number;
}

type LabelSize = "small" | "medium" | "large";

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


function LabelInput({ label, value, onChange, placeholder, hint }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; hint?: string }) {
  return (
    <Input label={label} hint={hint} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
const LABEL_MODE_TABS = [
  { id: "products", label: "Etiquetas de produtos", icon: Tag },
  { id: "custom", label: "Criar etiqueta própria", icon: PenLine },
] as const;

export default function Barcodes() {
  const toast = useToast();
  const [labelMode, setLabelMode]   = useState<"products" | "custom">("products");
  const [products, setProducts]     = useState<Product[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState("");
  const [selected, setSelected]     = useState<SelectedItem[]>([]);
  const [printSettings, setPrintSettings] = useState<LabelPrintConfig>(storedLabelSettings);
  const labelSize: LabelSize = "medium";
  const printErrors = validateLabelPrint(printSettings);
  const [renderTick, setRenderTick] = useState(0);
  const codesReady = useCallback(() => setRenderTick(tick => tick + 1), []);
  const [productPreview, setProductPreview] = useState<string[]>([]), [customPreview, setCustomPreview] = useState<string[]>([]);
  const [showOnly, setShowOnly]     = useState<"all" | "with" | "without">("all");
  const [fields, setFields]         = useState<LabelFields>(DEFAULT_LABEL_FIELDS);
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
    loadJsBarcode().catch(() => toast.error("Não foi possível carregar o gerador de barras. Recarregue a página ou imprima sem esse campo."));
  }, []);

  useEffect(() => {
    if (!validateLabelPrint(printSettings).length) try { localStorage.setItem(labelSettingsStorageKey(), JSON.stringify(printSettings)); } catch { /* A impressão continua disponível sem persistência. */ }
  }, [printSettings]);

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
      s.map((x) => x.product.id === id ? { ...x, qty: Math.min(2000, Math.max(1, x.qty + delta)) } : x)
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
  const labelItems = useMemo(() => selected.flatMap(({ product, qty }) =>
    Array.from({ length: qty }, (_, i) => ({ product, key: `${product.id}-${i}` }))
  ), [selected]);

  const codeImages = useCallback((card: Element | null, code: string, barcode: boolean, qr: boolean, strict = false) => {
    const svg = card?.querySelector("svg") as SVGSVGElement | null;
    const canvas = card?.querySelector("canvas") as HTMLCanvasElement | null;
    if (strict && code && barcode && svg?.dataset.code !== code) throw new Error(svg?.dataset.error ? "Código de barras inválido. Revise o código do produto." : "Aguarde o código de barras carregar antes de imprimir.");
    if (strict && code && qr && canvas?.dataset.code !== code) throw new Error("Aguarde o QR Code carregar antes de imprimir.");
    return (barcode ? labelBarcodeSvg(svg) : "") + (qr && code && canvas?.dataset.code === code ? `<img class="label-qr" alt="QR Code" src="${canvas.toDataURL()}" />` : "");
  }, []);
  const productContents = useCallback((strict = false) => {
    const cards = new Map(Array.from(printRef.current?.querySelectorAll("[data-label-card]") || []).map(card => [(card as HTMLElement).dataset.productId, card]));
    return labelItems.map(({ product }) => {
      const code = product.barcode || product.sku || "";
      return `<div class="label-name">${fields.showName ? labelEscape(product.name) : ""}</div>` +
        (fields.showPrice ? `<div class="label-price">${labelEscape(Number(product.price).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }))}</div>` : "") +
        (fields.showSku && code ? `<div class="label-sku">${labelEscape(code)}</div>` : "") +
        codeImages(cards.get(String(product.id)) || null, code, fields.showBarcode, fields.showQrCode, strict);
    });
  }, [labelItems, fields, codeImages]);
  const customContents = useCallback((strict = false) => {
    const card = customPrintRef.current?.querySelector("[data-custom-label]") || null;
    const item = (show: boolean, value: string, className: string) => show && value ? `<div class="${className}">${labelEscape(value)}</div>` : "";
    const content = `<div class="label-title">${labelEscape(customLabel.title || "Etiqueta personalizada")}</div>` +
      item(customFields.showCustomer, customLabel.customer, "label-customer") + item(customFields.showReference, customLabel.reference, "label-reference") +
      item(customFields.showDocument, customLabel.document, "label-text") + item(customFields.showPhone, customLabel.phone, "label-text") +
      item(customFields.showAddress, customLabel.address, "label-text") + item(customFields.showNotes, customLabel.notes, "label-notes") +
      codeImages(card, customLabel.code || customLabel.reference, customFields.showBarcode, customFields.showQrCode, strict);
    return Array.from({ length: Math.max(1, Math.min(500, customLabel.quantity || 1)) }, () => content);
  }, [customLabel, customFields, codeImages]);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setProductPreview(labelMode === "products" ? productContents() : []);
      setCustomPreview(labelMode === "custom" ? customContents() : []);
    });
    return () => cancelAnimationFrame(frame);
  }, [productContents, customContents, renderTick, labelMode]);

  const openPrint = useCallback((contents: string[], title: string, calibration = false, settings = printSettings) => {
    try {
      const html = labelPrintDocument(settings, contents, title, calibration);
      const popup = window.open("", "_blank", "width=1000,height=760");
      if (!popup) { toast.warning("Permita a abertura da janela de impressão neste navegador."); return; }
      popup.document.open(); popup.document.write(html); popup.document.close();
      let attempts = 0;
      const timer = window.setInterval(() => {
        if (popup.closed) { clearInterval(timer); return; }
        if ((popup as any).__labelsReady) { clearInterval(timer); popup.focus(); popup.print(); }
        else if (++attempts > 160) { clearInterval(timer); toast.warning("A prévia está aberta. Aguarde o carregamento e use o botão Imprimir nessa janela."); }
      }, 50);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível preparar as etiquetas."); }
  }, [printSettings, toast]);
  const handlePrint = useCallback(() => { try { openPrint(productContents(true), "Etiquetas de produtos"); } catch (error) { toast.error((error as Error).message); } }, [productContents, openPrint, toast]);
  const handlePrintCustom = useCallback(() => { try { openPrint(customContents(true), "Etiquetas personalizadas"); } catch (error) { toast.error((error as Error).message); } }, [customContents, openPrint, toast]);
  const handleTestPrint = (settings: LabelPrintConfig) => openPrint(calibrationContents(settings), "Teste de alinhamento · etiquetas", true, settings);

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
              <Button variant="primary" iconLeft={<Printer size={14} />} onClick={handlePrint} disabled={printErrors.length > 0}>
                Imprimir {totalLabels} etiqueta{totalLabels !== 1 ? "s" : ""}
              </Button>
            )}
            {labelMode === "custom" && (
              <Button variant="primary" iconLeft={<Printer size={14} />} onClick={handlePrintCustom} disabled={printErrors.length > 0}>
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

      <LabelPrintSettings value={printSettings} onChange={setPrintSettings} onTest={handleTestPrint} />

      <Tabs<typeof LABEL_MODE_TABS[number]["id"]> items={LABEL_MODE_TABS} value={labelMode} onChange={setLabelMode} label="Tipo de etiqueta">
      <div className={cn("grid min-w-0 grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]", labelMode !== "products" && "hidden")}>

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
            <div className="max-h-[56vh] space-y-2 overflow-y-auto xl:max-h-[calc(100vh-340px)] admin-scroll pr-1">
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
                    <div className="flex flex-wrap items-center gap-3 p-3 sm:p-4">
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
                      <div className="w-9 h-9 rounded-lg overflow-hidden bg-slate-50 border border-slate-100 shrink-0 flex items-center justify-center">
                        {p.image_url
                          ? <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                          : <Package size={16} className="text-slate-300" />}
                      </div>

                      {/* info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold leading-5 text-slate-800 break-words">{p.name}</p>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                          {(p.barcode || p.sku) ? (
                            <span className="break-all text-xs font-mono text-slate-500">
                              {p.barcode || p.sku}
                            </span>
                          ) : (
                            <Badge color="warning">Sem código</Badge>
                          )}
                          <span className="text-sm font-semibold text-slate-800">
                            {Number(p.price).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                          </span>
                        </div>
                      </div>

                      {/* qty control (só quando selecionado) */}
                      {sel && (
                        <div className="flex w-full flex-wrap items-center justify-end gap-2 border-t border-blue-100 pt-3">
                          <span className="mr-auto text-xs font-medium text-slate-600">Cópias deste produto</span>
                          <IconButton variant="secondary" size="sm" aria-label="Diminuir quantidade" onClick={() => updateQty(p.id, -1)}>
                            <Minus size={11} />
                          </IconButton>
                          <Input type="number" min={1} max={2000} step={1} showCount={false} aria-label={`Quantidade de etiquetas de ${p.name}`} wrapperClassName="w-16" className="px-1 text-center tabular-nums" value={item?.qty || 1} onChange={event => setSelected(current => current.map(row => row.product.id === p.id ? { ...row, qty: Math.max(1, Math.min(2000, Math.floor(Number(event.target.value) || 1))) } : row))} />
                          <IconButton variant="secondary" size="sm" aria-label="Aumentar quantidade" onClick={() => updateQty(p.id, 1)}>
                            <Plus size={11} />
                          </IconButton>
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
        <div className="flex min-w-0 w-full flex-col gap-4 xl:sticky xl:top-4">

          {/* Configurações de impressão */}
          <PanelCard className="order-2" title="Conteúdo e quantidade" contentClassName="space-y-4">
            <div data-tour="barcodes-label-size" className="flex flex-wrap gap-2 text-xs font-medium text-slate-600">
              <span className="rounded-md bg-slate-100 px-3 py-2">{printSettings.width} × {printSettings.height} mm</span>
              <span data-tour="barcodes-layout" className="rounded-md bg-slate-100 px-3 py-2">{printSettings.columns} coluna{printSettings.columns > 1 ? "s" : ""} · {printSettings.mode === "thermal" ? "bobina" : "folha"}</span>
            </div>

            {/* Campos da etiqueta */}
            <div data-tour="barcodes-fields" className="space-y-1">
              <p className="ds-label">Campos da Etiqueta</p>
              <div className="flex flex-wrap gap-2">
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
            <div className="grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-4">
              <div className="space-y-1">
                <p className="text-xs text-slate-500">Produtos selecionados</p>
                <p className="text-2xl font-semibold text-slate-900">{selected.length}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-slate-500">Total de etiquetas</p>
                <p className="text-2xl font-semibold text-blue-600">{totalLabels}</p>
              </div>
            </div>
            {selected.length === 1 && printSettings.columns > 1 && totalLabels !== printSettings.columns && <Button variant="outline" fullWidth onClick={() => setSelected(current => current.map(item => ({ ...item, qty: printSettings.columns })))}>Preencher fileira com {printSettings.columns} cópias</Button>}

            <Button
              data-tour="barcodes-print-btn"
              variant="primary"
              fullWidth
              size="lg"
              iconLeft={<Printer size={15} />}
              onClick={handlePrint}
              disabled={totalLabels === 0 || printErrors.length > 0}
            >
              Imprimir Etiquetas
            </Button>
          </PanelCard>

          {/* Preview das etiquetas */}
            <PanelCard className="order-1" data-tour="barcodes-preview" title="Confira sua impressão" description="A fileira inteira, com as colunas e os dados escolhidos." icon={Tag} contentClassName="space-y-3">
              {selected.length > 0 ? <>
              <div ref={printRef} className="hidden" aria-hidden="true">{selected.map(({ product }) => <LabelCard key={product.id} product={product} qty={1} labelSize={labelSize} fields={fields} onReady={codesReady} />)}</div>
              <LabelPrintPreview settings={printSettings} contents={productPreview} />
              </> : <div className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center"><Tag size={28} className="mb-1 text-slate-400" /><p className="text-sm font-semibold text-slate-700">Selecione um produto para começar</p><p className="text-xs leading-5 text-slate-500">Escolha os produtos na lista e informe quantas cópias deseja imprimir.</p></div>}
            </PanelCard>

        </div>
      </div>

      {labelMode === "custom" && (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
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
                  <Input type="number" min={1} max={500} step={1} showCount={false} aria-label="Quantidade de etiquetas próprias" wrapperClassName="w-20" className="px-1 text-center tabular-nums" value={customLabel.quantity} onChange={event => setCustom({ quantity: Math.max(1, Math.min(500, Math.floor(Number(event.target.value) || 1))) })} />
                  <IconButton variant="ghost" aria-label="Aumentar quantidade" onClick={() => setCustom({ quantity: Math.min(500, customLabel.quantity + 1) })}><Plus size={13} /></IconButton>
                </div>
              </div>
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
              <div ref={customPrintRef} className="hidden" aria-hidden="true">
                <CustomLabelCard data={customLabel} labelSize={labelSize} fields={customFields} onReady={codesReady} />
              </div>
              <LabelPrintPreview settings={printSettings} contents={customPreview} />
              <Button variant="primary" fullWidth size="lg" iconLeft={<Printer size={14} />} onClick={handlePrintCustom} disabled={printErrors.length > 0}>
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
