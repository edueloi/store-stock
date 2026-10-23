import React, { useCallback, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AlertCircle, CheckCircle2, FileText, Image as ImageIcon, Loader2, PackagePlus, RefreshCw, Trash2, Upload, X } from "lucide-react";
import Button from "./Button";
import pdfjsWorkerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";
import { parseOrderTable } from "../../lib/pdfOrderTable";

interface PdfImage { file: File; preview: string; }
interface ParsedProduct {
  sku: string; name: string; unit: string; qty: number; price: number; total: number;
  image?: PdfImage; selected: boolean; existingId?: number; existingStock?: number;
  existingCost?: number; existingImages?: string[]; existingImageUrl?: string | null;
  importing?: boolean; done?: boolean; doneLabel?: string; error?: string;
}
interface PdfImportModalProps { open: boolean; onClose: () => void; onImported: () => void; }
interface PdfTextItem { str: string; transform: number[]; }
interface TextRow { y: number; items: { str: string; x: number }[]; text: string; }
interface SupplierCandidate extends Omit<ParsedProduct, "image" | "selected"> { codeX: number; startY: number; bottomY: number; pageNumber: number; }

const authHeader = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}` });
const jsonHeader = () => ({ "Content-Type": "application/json", ...authHeader() });
const norm = (value: string) => value.trim().toUpperCase();
const unitAliases: Record<string, string> = { "PÇ": "UN", "PÇA": "UN", "PEÇA": "UN", "PÇS": "UN" };
const normalizeUnit = (value: string) => unitAliases[value.trim().toUpperCase()] ?? value.trim().toUpperCase();
const parseBrazilNumber = (value: string) => Number(value.replace(/\./g, "").replace(",", "."));

function buildRows(items: PdfTextItem[]): TextRow[] {
  const rows: TextRow[] = [];
  const sorted = items.filter((item) => item.str.trim()).map((item) => ({ str: item.str.trim(), x: item.transform[4], y: item.transform[5] })).sort((a, b) => b.y - a.y || a.x - b.x);
  for (const item of sorted) {
    const row = rows.find((current) => Math.abs(current.y - item.y) <= 2);
    if (row) row.items.push({ str: item.str, x: item.x });
    else rows.push({ y: item.y, items: [{ str: item.str, x: item.x }], text: "" });
  }
  return rows.map((row) => ({ ...row, items: row.items.sort((a, b) => a.x - b.x), text: row.items.sort((a, b) => a.x - b.x).map((item) => item.str).join(" ") }));
}

function parseSupplierPage(rows: TextRow[], pageNumber: number): SupplierCandidate[] {
  const codeRows = rows.map((row) => ({ row, match: row.text.match(/c[oó]digo\s*:\s*([a-z0-9._-]+)/i) })).filter((entry): entry is { row: TextRow; match: RegExpMatchArray } => Boolean(entry.match));
  return codeRows.map(({ row, match }, index) => {
    const nextRow = codeRows[index + 1]?.row;
    const bottomY = nextRow ? nextRow.y : row.y - 78;
    const productRows = rows.filter((item) => item.y <= row.y + 2 && item.y > bottomY + 1);
    const rangeText = productRows.map((item) => item.text).join(" ");
    const unitMatches = [...rangeText.matchAll(/\b(UN|PC|PÇ|PÇA|PEÇA|PÇS|PCS|KG|CX|PAR|MT|M|LT|LIT)\b/gi)];
    const unitMatch = unitMatches.at(-1);
    const afterUnit = unitMatch ? rangeText.slice((unitMatch.index ?? 0) + unitMatch[0].length) : "";
    const values = (afterUnit.match(/\d+(?:\.\d{3})*(?:,\d+)?/g) ?? []).map(parseBrazilNumber);
    const unitX = unitMatch ? productRows.flatMap((item) => item.items).find((item) => item.str.toUpperCase() === unitMatch[1].toUpperCase())?.x : undefined;
    const name = productRows.map((item) => item.items.filter((part) => part.x >= row.items[0].x - 4 && (unitX === undefined || part.x < unitX - 4)).map((part) => part.str).join(" ")).join(" ").replace(/c[oó]digo\s*:\s*[a-z0-9._-]+/ig, "").replace(/\s+/g, " ").trim();
    return { sku: match[1], name, unit: normalizeUnit(unitMatch?.[1] ?? "UN"), qty: values[0] ?? 0, price: values[1] ?? 0, total: values[2] ?? ((values[0] ?? 0) * (values[1] ?? 0)), codeX: row.items[0].x, startY: row.y, bottomY, pageNumber };
  }).filter((product) => product.name.length >= 2 && product.qty > 0 && product.price > 0);
}

function parseGenericPdfText(text: string): ParsedProduct[] {
  const units = ["UN", "PC", "PÇ", "PÇA", "PEÇA", "PÇS", "PCS", "KG", "CX", "M", "MT", "PAR", "LT", "LIT"];
  const products: ParsedProduct[] = [];
  for (const line of text.split("\n")) {
    const tokens = line.trim().split(/\s+/).filter(Boolean);
    const unitIndex = tokens.findIndex((token) => units.includes(token.toUpperCase()));
    if (tokens.length < 5 || unitIndex < 1 || !/^[A-Z0-9][A-Z0-9._-]{3,}$/i.test(tokens[0])) continue;
    const values = tokens.slice(unitIndex + 1).filter((token) => /^\d[\d.,]*$/.test(token)).map(parseBrazilNumber);
    const qty = values[0] ?? 0; const price = values[1] ?? 0; const total = values.at(-1) ?? qty * price;
    if (qty > 0 && price > 0 && total > 0) products.push({ sku: tokens[0], name: tokens.slice(1, unitIndex).join(" "), unit: normalizeUnit(tokens[unitIndex]), qty, price, total, selected: true });
  }
  return products;
}

function hasVisibleProductImage(canvas: HTMLCanvasElement): boolean {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return false;
  const { data, width, height } = context.getImageData(0, 0, canvas.width, canvas.height);
  let nonWhite = 0; const left = Math.floor(width * 0.08); const right = Math.ceil(width * 0.92); const top = Math.floor(height * 0.08); const bottom = Math.ceil(height * 0.92);
  for (let y = top; y < bottom; y += 2) for (let x = left; x < right; x += 2) { const offset = (y * width + x) * 4; if (data[offset + 3] > 0 && (data[offset] < 225 || data[offset + 1] < 225 || data[offset + 2] < 225)) nonWhite++; }
  return nonWhite > Math.max(20, ((right - left) * (bottom - top)) / 240);
}

async function renderSupplierImage(page: any, candidate: SupplierCandidate): Promise<PdfImage | undefined> {
  const scale = 2; const viewport = page.getViewport({ scale }); const pageCanvas = document.createElement("canvas"); pageCanvas.width = Math.ceil(viewport.width); pageCanvas.height = Math.ceil(viewport.height);
  const context = pageCanvas.getContext("2d"); if (!context) return undefined;
  await page.render({ canvasContext: context, viewport }).promise;
  const sourceX = Math.max(0, Math.floor((candidate.codeX - 105) * scale)); const sourceRight = Math.min(pageCanvas.width, Math.ceil((candidate.codeX - 16) * scale));
  const sourceY = Math.max(0, Math.floor(pageCanvas.height - (candidate.startY + 16) * scale)); const sourceBottom = Math.min(pageCanvas.height, Math.ceil(pageCanvas.height - (candidate.bottomY + 3) * scale));
  const sourceWidth = sourceRight - sourceX; const sourceHeight = sourceBottom - sourceY; if (sourceWidth < 12 || sourceHeight < 12) return undefined;
  const crop = document.createElement("canvas"); crop.width = sourceWidth; crop.height = sourceHeight; const cropContext = crop.getContext("2d"); if (!cropContext) return undefined;
  cropContext.drawImage(pageCanvas, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, sourceWidth, sourceHeight);
  if (!hasVisibleProductImage(crop)) return undefined;
  const blob = await new Promise<Blob | null>((resolve) => crop.toBlob(resolve, "image/png")); if (!blob) return undefined;
  return { file: new File([blob], `produto-${candidate.sku}.png`, { type: "image/png" }), preview: URL.createObjectURL(blob) };
}

async function extractProductsFromPdf(file: File): Promise<ParsedProduct[]> {
  const pdfjsLib = await import("pdfjs-dist"); pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;
  const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages: { page: any; rows: TextRow[]; candidates: SupplierCandidate[] }[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) { const page = await pdf.getPage(pageNumber); const rows = buildRows((await page.getTextContent()).items as PdfTextItem[]); pages.push({ page, rows, candidates: parseSupplierPage(rows, pageNumber) }); }
  const candidates = pages.flatMap((item) => item.candidates);
  if (candidates.length === 0) {
    // pedido de fornecedor em tabela (Cod / Produto / Qtde. / Valor Unit. / Total), sem coluna de unidade
    const orderTable = parseOrderTable(pages.map((item) => item.rows));
    if (orderTable.length > 0) return orderTable.map((product) => ({ ...product, selected: true }));
    return parseGenericPdfText(pages.flatMap((item) => item.rows.map((row) => row.text)).join("\n"));
  }
  const images = new Map<SupplierCandidate, PdfImage | undefined>();
  for (const pageInfo of pages) await Promise.all(pageInfo.candidates.map(async (candidate) => images.set(candidate, await renderSupplierImage(pageInfo.page, candidate))));
  return candidates.map((candidate) => ({ sku: candidate.sku, name: candidate.name, unit: candidate.unit, qty: candidate.qty, price: candidate.price, total: candidate.total, image: images.get(candidate), selected: true }));
}

async function uploadProductImage(image: PdfImage): Promise<string> {
  const form = new FormData(); form.append("image", image.file);
  const response = await fetch("/api/upload/product-image", { method: "POST", headers: authHeader(), body: form }); const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.url) throw new Error(result.error || "Não foi possível enviar a imagem do produto."); return result.url;
}

export default function PdfImportModal({ open, onClose, onImported }: PdfImportModalProps) {
  const [step, setStep] = useState<"upload" | "preview" | "importing" | "done">("upload"); const [dragging, setDragging] = useState(false); const [parsing, setParsing] = useState(false); const [parseError, setParseError] = useState<string | null>(null); const [products, setProducts] = useState<ParsedProduct[]>([]); const fileRef = useRef<HTMLInputElement>(null);
  const reset = () => { products.forEach((product) => product.image && URL.revokeObjectURL(product.image.preview)); setStep("upload"); setProducts([]); setParseError(null); };
  const handleClose = () => { reset(); onClose(); };
  const processFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".pdf")) { setParseError("Selecione um arquivo PDF."); return; }
    setParsing(true); setParseError(null);
    try {
      const parsed = await extractProductsFromPdf(file); if (parsed.length === 0) throw new Error("Nenhum produto encontrado. Verifique se o PDF contém a tabela de produtos.");
      const response = await fetch("/api/products", { headers: authHeader() }); const existing: { id: number; sku?: string; barcode?: string; stock_quantity: number; cost_price?: number; images?: string[]; image_url?: string | null }[] = response.ok ? await response.json() : [];
      const lookup = new Map<string, typeof existing[number]>(); existing.forEach((product) => { if (product.sku) lookup.set(norm(product.sku), product); if (product.barcode) lookup.set(norm(product.barcode), product); });
      setProducts(parsed.map((product) => { const match = lookup.get(norm(product.sku)); return match ? { ...product, existingId: match.id, existingStock: match.stock_quantity, existingCost: Number(match.cost_price ?? 0), existingImages: Array.isArray(match.images) ? match.images : [], existingImageUrl: match.image_url } : product; })); setStep("preview");
    } catch (error) { setParseError((error as Error).message || "Erro ao processar o PDF."); } finally { setParsing(false); }
  }, []);
  const updateProduct = (index: number, update: Partial<ParsedProduct>) => setProducts((current) => current.map((product, i) => i === index ? { ...product, ...update } : product));
  const toggleAll = (selected: boolean) => setProducts((current) => current.map((product) => ({ ...product, selected })));
  const selectedProducts = products.filter((product) => product.selected); const updateCount = selectedProducts.filter((product) => product.existingId).length; const newCount = selectedProducts.length - updateCount;
  const handleImport = async () => {
    if (selectedProducts.length === 0) return; setStep("importing");
    for (let index = 0; index < products.length; index++) {
      const product = products[index]; if (!product.selected) continue; updateProduct(index, { importing: true, error: undefined });
      try {
        const hasCatalogImage = (product.existingImages?.length ?? 0) > 0 || Boolean(product.existingImageUrl); const imageUrl = product.image && (!product.existingId || !hasCatalogImage) ? await uploadProductImage(product.image) : undefined;
        if (product.existingId) {
          const shouldUpdateCost = product.price > (product.existingCost ?? 0);
          if (imageUrl) { const imageResponse = await fetch(`/api/products/${product.existingId}`, { method: "PUT", headers: jsonHeader(), body: JSON.stringify({ images: [...(product.existingImages ?? []), imageUrl] }) }); if (!imageResponse.ok) throw new Error("Não foi possível atualizar a imagem do produto."); }
          const stockResponse = await fetch("/api/products/stock-adjustment", { method: "POST", headers: jsonHeader(), body: JSON.stringify({ productId: product.existingId, quantity: product.qty, type: "in", reason: `Importação de PDF — +${product.qty} un` }) }); if (!stockResponse.ok) throw new Error((await stockResponse.json().catch(() => ({}))).error || "Não foi possível atualizar o estoque.");
          if (shouldUpdateCost) { const costResponse = await fetch(`/api/products/${product.existingId}`, { method: "PUT", headers: jsonHeader(), body: JSON.stringify({ cost_price: product.price }) }); if (!costResponse.ok) throw new Error("Não foi possível atualizar o custo do produto."); }
          const imageNote = imageUrl ? " · imagem incluída" : ""; const costNote = shouldUpdateCost ? ` · custo R$ ${product.price.toFixed(2)}` : ""; updateProduct(index, { importing: false, done: true, doneLabel: `Estoque: ${product.existingStock ?? 0} → ${(product.existingStock ?? 0) + product.qty}${costNote}${imageNote}` });
        } else {
          const response = await fetch("/api/products", { method: "POST", headers: jsonHeader(), body: JSON.stringify({ name: product.name, sku: product.sku, barcode: /^\d{8,14}$/.test(product.sku) ? product.sku : undefined, price: product.price, cost_price: product.price, stock_quantity: product.qty, unidade_comercial: product.unit, unidade_tributavel: product.unit, images: imageUrl ? [imageUrl] : undefined, image_url: imageUrl, type: "sale", is_active: true, is_featured: false }) }); if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || "Não foi possível criar o produto."); updateProduct(index, { importing: false, done: true, doneLabel: imageUrl ? "Criado com imagem" : "Criado" });
        }
      } catch (error) { updateProduct(index, { importing: false, error: (error as Error).message || "Falha ao importar" }); }
    }
    setStep("done"); onImported();
  };
  if (!open) return null;
  return <AnimatePresence><div className="fixed inset-0 z-50 flex items-center justify-center p-4"><motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleClose} /><motion.div initial={{ opacity: 0, scale: 0.95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 16 }} transition={{ type: "spring", damping: 26, stiffness: 340 }} className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-white shadow-sm"><div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50"><FileText size={16} className="text-blue-500" /></div><div><h2 className="text-sm font-semibold text-slate-800">Importar PDF de Pedido</h2><p className="text-[11px] text-slate-400">{step === "upload" ? "Selecione o PDF com a tabela de produtos" : step === "preview" ? `${products.length} produtos — ${updateCount} atualizar · ${newCount} novos` : step === "importing" ? "Importando produtos..." : "Importação concluída"}</p></div></div><button onClick={handleClose} className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-slate-100"><X size={14} className="text-slate-500" /></button></div><div className="flex-1 overflow-y-auto">{step === "upload" && <div className="p-6"><div data-tour="pdf-import-dropzone" onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); const file = event.dataTransfer.files?.[0]; if (file) processFile(file); }} onClick={() => fileRef.current?.click()} className={`flex cursor-pointer flex-col items-center gap-4 rounded-lg border-2 border-dashed p-12 transition-all ${dragging ? "border-blue-400 bg-blue-50" : "border-slate-200 hover:border-blue-300 hover:bg-slate-50"}`}>{parsing ? <Loader2 size={32} className="animate-spin text-blue-400" /> : <Upload size={32} className={dragging ? "text-blue-400" : "text-slate-300"} />}<div className="text-center"><p className="text-sm font-semibold text-slate-700">{parsing ? "Processando PDF..." : "Arraste o PDF aqui ou clique para selecionar"}</p><p className="mt-1 text-xs text-slate-400">Lê código, descrição, quantidade, preço e a imagem do produto quando ela estiver no PDF. Aceita também o pedido de fornecedor em tabela (Cod, Produto, Qtde., Valor Unit., Total).</p></div></div><input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) processFile(file); event.target.value = ""; }} />{parseError && <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-100 bg-red-50 p-3"><AlertCircle size={14} className="mt-0.5 shrink-0 text-red-500" /><p className="text-xs text-red-600">{parseError}</p></div>}</div>}{(step === "preview" || step === "importing" || step === "done") && <div className="p-4">{step === "preview" && <div className="mb-3 flex items-center justify-between"><div className="flex items-center gap-2"><button onClick={() => toggleAll(true)} className="text-[11px] font-semibold text-blue-600 hover:underline">Todos</button><span className="text-slate-300">|</span><button onClick={() => toggleAll(false)} className="text-[11px] font-semibold text-slate-500 hover:underline">Nenhum</button></div><div className="flex items-center gap-2">{updateCount > 0 && <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-600"><RefreshCw size={9} /> {updateCount} atualizar</span>}{newCount > 0 && <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-600"><PackagePlus size={9} /> {newCount} novo{newCount === 1 ? "" : "s"}</span>}</div></div>}<div className="overflow-hidden rounded-lg border border-slate-100"><div className="grid grid-cols-[auto_44px_1fr_44px_48px_72px_72px_28px] gap-2 bg-slate-50 px-3 py-2 text-[11px] font-semibold text-slate-500"><div /><div>Foto</div><div>Produto</div><div className="text-center">Und</div><div className="text-center">Qtd</div><div className="text-right">Preço</div><div className="text-right">Total</div><div /></div><div className="divide-y divide-slate-50">{products.map((product, index) => <div key={`${product.sku}-${index}`} className={`grid grid-cols-[auto_44px_1fr_44px_48px_72px_72px_28px] items-center gap-2 px-3 py-2.5 text-xs ${product.selected ? "bg-white" : "bg-slate-50 opacity-50"}`}><div className="flex w-5 justify-center">{step === "importing" && product.importing ? <Loader2 size={12} className="animate-spin text-blue-400" /> : product.done ? <CheckCircle2 size={13} className="text-emerald-500" /> : product.error ? <AlertCircle size={13} className="text-red-400" /> : <input type="checkbox" checked={product.selected} disabled={step !== "preview"} onChange={() => updateProduct(index, { selected: !product.selected })} className="h-3.5 w-3.5 cursor-pointer accent-blue-500" />}</div><div>{product.image ? <img src={product.image.preview} alt="Imagem extraída do PDF" className="h-9 w-9 rounded border border-slate-100 object-contain" /> : <span title="Este item não contém imagem no PDF" className="flex h-9 w-9 items-center justify-center rounded bg-slate-50"><ImageIcon size={14} className="text-slate-300" /></span>}</div><div className="min-w-0"><div className="flex flex-wrap items-center gap-1.5"><p className="truncate font-semibold leading-tight text-slate-800">{product.name}</p>{!product.done && !product.error && <span className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${product.existingId ? "border-amber-200 bg-amber-50 text-amber-600" : "border-emerald-200 bg-emerald-50 text-emerald-600"}`}>{product.existingId ? `ATUALIZAR +${product.qty}` : "NOVO"}</span>}</div><div className="mt-0.5 flex gap-2"><p className="font-mono text-[11px] text-slate-400">{product.sku}</p>{product.doneLabel && <p className="text-[11px] font-semibold text-emerald-600">{product.doneLabel}</p>}{product.error && <p className="text-[11px] text-red-500">{product.error}</p>}</div></div><div className="text-center font-medium text-slate-500">{product.unit}</div><div className="text-center font-semibold text-slate-700">{product.qty}</div><div className="text-right text-slate-700">R$ {product.price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div><div className="text-right font-semibold text-slate-800">R$ {product.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div><div>{step === "preview" && <button onClick={() => setProducts((current) => current.filter((_, i) => i !== index))} className="group flex h-6 w-6 items-center justify-center rounded-md hover:bg-red-50"><Trash2 size={11} className="text-slate-300 group-hover:text-red-400" /></button>}</div></div>)}</div></div><div className="mt-3 flex items-center justify-between px-1"><span className="text-[11px] text-slate-400">{selectedProducts.length} de {products.length} selecionado{products.length === 1 ? "" : "s"}</span><span className="text-[11px] font-semibold text-slate-700">Total: R$ {selectedProducts.reduce((sum, product) => sum + product.total, 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span></div></div>}</div>{(step === "preview" || step === "done") && <div className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-100 px-6 py-4">{step === "preview" ? <button onClick={reset} className="text-xs font-medium text-slate-500 hover:text-slate-700">Escolher outro PDF</button> : <span />}{step === "preview" ? <Button onClick={handleImport} disabled={selectedProducts.length === 0} icon={<Upload size={13} />}>Importar {selectedProducts.length} produto{selectedProducts.length === 1 ? "" : "s"}</Button> : <Button onClick={handleClose}>Concluir</Button>}</div>}</motion.div></div></AnimatePresence>;
}
