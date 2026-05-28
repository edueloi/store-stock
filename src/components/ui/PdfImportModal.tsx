import React, { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Upload, FileText, AlertCircle, CheckCircle2, Loader2, Trash2, PackagePlus } from "lucide-react";
import Button from "./Button";

// ── types ──────────────────────────────────────────────────────────────────
interface ParsedProduct {
  sku: string;
  name: string;
  unit: string;
  qty: number;
  price: number;
  total: number;
  selected: boolean;
  importing?: boolean;
  done?: boolean;
  error?: string;
}

interface PdfImportModalProps {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}

// ── PDF text extraction ─────────────────────────────────────────────────────
async function extractTextFromPdf(file: File): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist");
  // Worker is copied to /assets/pdf.worker.mjs by the vite plugin at build time.
  // In dev, fallback to unpkg so local `npm run dev` also works.
  /* @vite-ignore */
  pdfjsLib.GlobalWorkerOptions.workerSrc = import.meta.env.DEV
    ? `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.mjs`
    : "/assets/pdf.worker.mjs";

  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  let fullText = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    // Group items by their Y position to reconstruct rows
    const byY: Record<number, { x: number; str: string }[]> = {};
    for (const item of content.items as { str: string; transform: number[] }[]) {
      const y = Math.round(item.transform[5]);
      if (!byY[y]) byY[y] = [];
      byY[y].push({ x: item.transform[4], str: item.str });
    }
    // Sort rows top-to-bottom, items left-to-right
    const rows = Object.keys(byY)
      .map(Number)
      .sort((a, b) => b - a);
    for (const y of rows) {
      const line = byY[y]
        .sort((a, b) => a.x - b.x)
        .map(i => i.str)
        .join(" ");
      fullText += line + "\n";
    }
  }
  return fullText;
}

// ── parsing ────────────────────────────────────────────────────────────────
// The PDF table has columns: Codigo | Descrição | Und | Qtd | Preço | Des. | Valor Total
// We look for lines where the first token looks like a SKU/barcode and last token looks like a price.
function parsePdfText(text: string): ParsedProduct[] {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  const products: ParsedProduct[] = [];

  // Regex: line that has a barcode/SKU-like code at start, unit (UN/PC/KG/CX/M), then numbers
  // Pattern: <code> <description...> <unit> <qty> <price> [des] <total>
  // We use a flexible approach: detect lines where:
  // - token[0] looks like a product code (alphanumeric, 4+ chars, may contain -)
  // - contains UN or PC or KG or CX as a word
  // - ends with number patterns for price/total
  const unitWords = ["UN", "PC", "KG", "CX", "M", "MT", "PAR", "LT", "LIT", "PÇ", "PÇS", "PCS"];
  const priceRe = /\d{1,3}(?:\.\d{3})*(?:,\d{2})?$/;
  // code-like: starts with digit or letter, at least 4 chars, no spaces
  const codeLike = /^[A-Z0-9][A-Z0-9\-_\.]{3,}$/i;

  for (const line of lines) {
    const tokens = line.split(/\s+/);
    if (tokens.length < 5) continue;
    const code = tokens[0];
    if (!codeLike.test(code)) continue;

    // Find unit position
    const unitIdx = tokens.findIndex(t => unitWords.includes(t.toUpperCase()));
    if (unitIdx < 1) continue;

    // Description is everything between code and unit
    const description = tokens.slice(1, unitIdx).join(" ").trim();
    if (!description || description.length < 2) continue;

    // After unit we expect: qty price [des] total
    const after = tokens.slice(unitIdx + 1);
    if (after.length < 2) continue;

    // Parse numbers from the end: total is last, price is before des or before total
    // Normalize Brazilian number format: 1.234,56 -> 1234.56
    const parseNum = (s: string) => {
      const cleaned = s.replace(/\./g, "").replace(",", ".");
      return parseFloat(cleaned);
    };

    // Find numeric tokens after unit
    const numTokens = after.filter(t => /^\d[\d.,]*$/.test(t));
    if (numTokens.length < 2) continue;

    const qty = parseNum(numTokens[0]);
    const total = parseNum(numTokens[numTokens.length - 1]);
    // price is second numeric or calculated
    let price = numTokens.length >= 3 ? parseNum(numTokens[1]) : numTokens.length === 2 ? parseNum(numTokens[0]) : 0;
    // If price looks wrong, derive from total/qty
    if (!price || price <= 0) price = qty > 0 ? total / qty : total;

    if (!qty || !total || isNaN(qty) || isNaN(total) || total <= 0) continue;

    products.push({
      sku: code,
      name: description,
      unit: tokens[unitIdx].toUpperCase(),
      qty: Math.round(qty),
      price: parseFloat(price.toFixed(2)),
      total: parseFloat(total.toFixed(2)),
      selected: true,
    });
  }

  return products;
}

// ── component ───────────────────────────────────────────────────────────────
export default function PdfImportModal({ open, onClose, onImported }: PdfImportModalProps) {
  const [step, setStep] = useState<"upload" | "preview" | "importing" | "done">("upload");
  const [dragging, setDragging] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [products, setProducts] = useState<ParsedProduct[]>([]);
  const [importLog, setImportLog] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setStep("upload");
    setProducts([]);
    setParseError(null);
    setImportLog([]);
  };

  const handleClose = () => { reset(); onClose(); };

  const processFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setParseError("Selecione um arquivo PDF.");
      return;
    }
    setParsing(true);
    setParseError(null);
    try {
      const text = await extractTextFromPdf(file);
      const parsed = parsePdfText(text);
      if (parsed.length === 0) {
        setParseError("Nenhum produto encontrado. Verifique se o PDF contém a tabela com Código, Descrição, Und, Qtd, Preço e Valor Total.");
        return;
      }
      setProducts(parsed);
      setStep("preview");
    } catch (err) {
      setParseError(`Erro ao processar PDF: ${(err as Error).message}`);
    } finally {
      setParsing(false);
    }
  }, []);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) processFile(f);
    e.target.value = "";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) processFile(f);
  };

  const toggleAll = (val: boolean) =>
    setProducts(p => p.map(x => ({ ...x, selected: val })));

  const toggleOne = (i: number) =>
    setProducts(p => p.map((x, idx) => idx === i ? { ...x, selected: !x.selected } : x));

  const removeOne = (i: number) =>
    setProducts(p => p.filter((_, idx) => idx !== i));

  const selectedCount = products.filter(p => p.selected).length;

  const handleImport = async () => {
    const toImport = products.filter(p => p.selected);
    if (!toImport.length) return;
    setStep("importing");
    const logs: string[] = [];

    for (let i = 0; i < products.length; i++) {
      if (!products[i].selected) continue;
      setProducts(prev => prev.map((x, idx) => idx === i ? { ...x, importing: true } : x));

      const p = products[i];
      const payload = {
        name: p.name,
        sku: p.sku,
        barcode: /^\d{8,14}$/.test(p.sku) ? p.sku : undefined,
        price: p.price,
        cost_price: p.price,
        stock_quantity: p.qty,
        type: "sale",
        is_active: true,
        is_featured: false,
      };

      try {
        const res = await fetch("/api/products", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          logs.push(`✓ ${p.sku} — ${p.name}`);
          setProducts(prev => prev.map((x, idx) => idx === i ? { ...x, importing: false, done: true } : x));
        } else {
          const err = await res.json().catch(() => ({}));
          logs.push(`✗ ${p.sku} — ${err.error || "Erro desconhecido"}`);
          setProducts(prev => prev.map((x, idx) => idx === i ? { ...x, importing: false, error: err.error || "Erro" } : x));
        }
      } catch (e) {
        logs.push(`✗ ${p.sku} — Falha de rede`);
        setProducts(prev => prev.map((x, idx) => idx === i ? { ...x, importing: false, error: "Falha de rede" } : x));
      }
      setImportLog([...logs]);
    }
    setStep("done");
    onImported();
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* backdrop */}
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          onClick={handleClose}
        />

        {/* panel */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 16 }}
          transition={{ type: "spring", damping: 26, stiffness: 340 }}
          className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
        >
          {/* header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
                <FileText size={16} className="text-blue-500" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-800">Importar PDF de Pedido</h2>
                <p className="text-[11px] text-slate-400">
                  {step === "upload" && "Selecione o PDF com a tabela de produtos"}
                  {step === "preview" && `${products.length} produto${products.length !== 1 ? "s" : ""} encontrado${products.length !== 1 ? "s" : ""}`}
                  {step === "importing" && "Importando produtos..."}
                  {step === "done" && "Importação concluída"}
                </p>
              </div>
            </div>
            <button onClick={handleClose} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center transition-colors">
              <X size={14} className="text-slate-500" />
            </button>
          </div>

          {/* body */}
          <div className="flex-1 overflow-y-auto">

            {/* ── STEP: upload ── */}
            {step === "upload" && (
              <div className="p-6">
                <div
                  onDragOver={e => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={onDrop}
                  onClick={() => fileRef.current?.click()}
                  className={`
                    border-2 border-dashed rounded-2xl p-12 flex flex-col items-center gap-4 cursor-pointer transition-all
                    ${dragging ? "border-blue-400 bg-blue-50" : "border-slate-200 hover:border-blue-300 hover:bg-slate-50"}
                  `}
                >
                  {parsing ? (
                    <Loader2 size={32} className="text-blue-400 animate-spin" />
                  ) : (
                    <Upload size={32} className={dragging ? "text-blue-400" : "text-slate-300"} />
                  )}
                  <div className="text-center">
                    <p className="text-sm font-semibold text-slate-700">
                      {parsing ? "Processando PDF..." : "Arraste o PDF aqui ou clique para selecionar"}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">Suporta PDF com tabela: Código · Descrição · Und · Qtd · Preço · Valor Total</p>
                  </div>
                </div>
                <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={onFileChange} />

                {parseError && (
                  <div className="mt-4 flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-100">
                    <AlertCircle size={14} className="text-red-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-red-600">{parseError}</p>
                  </div>
                )}
              </div>
            )}

            {/* ── STEP: preview ── */}
            {(step === "preview" || step === "importing" || step === "done") && (
              <div className="p-4">
                {step === "preview" && (
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => toggleAll(true)} className="text-[11px] font-semibold text-blue-600 hover:underline">Todos</button>
                      <span className="text-slate-300">|</span>
                      <button onClick={() => toggleAll(false)} className="text-[11px] font-semibold text-slate-500 hover:underline">Nenhum</button>
                    </div>
                    <span className="text-[11px] text-slate-500 font-medium">{selectedCount} selecionado{selectedCount !== 1 ? "s" : ""}</span>
                  </div>
                )}

                <div className="rounded-xl border border-slate-100 overflow-hidden">
                  {/* table header */}
                  <div className="grid grid-cols-[auto_1fr_60px_60px_90px_90px_32px] gap-2 px-3 py-2 bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                    <div />
                    <div>Produto</div>
                    <div className="text-center">Und</div>
                    <div className="text-center">Qtd</div>
                    <div className="text-right">Preço</div>
                    <div className="text-right">Total</div>
                    <div />
                  </div>

                  {/* rows */}
                  <div className="divide-y divide-slate-50">
                    {products.map((p, i) => (
                      <div key={i} className={`grid grid-cols-[auto_1fr_60px_60px_90px_90px_32px] gap-2 px-3 py-2.5 items-center text-xs transition-colors ${p.selected ? "bg-white" : "bg-slate-50 opacity-50"}`}>
                        {/* checkbox / status */}
                        <div className="flex items-center justify-center w-5">
                          {(step === "importing" && p.importing) ? (
                            <Loader2 size={12} className="text-blue-400 animate-spin" />
                          ) : p.done ? (
                            <CheckCircle2 size={13} className="text-emerald-500" />
                          ) : p.error ? (
                            <AlertCircle size={13} className="text-red-400" />
                          ) : (
                            <input
                              type="checkbox"
                              checked={p.selected}
                              onChange={() => toggleOne(i)}
                              disabled={step !== "preview"}
                              className="w-3.5 h-3.5 accent-blue-500 cursor-pointer"
                            />
                          )}
                        </div>

                        {/* name + sku */}
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800 truncate leading-tight">{p.name}</p>
                          <p className="text-[10px] text-slate-400 font-mono">{p.sku}</p>
                          {p.error && <p className="text-[10px] text-red-500">{p.error}</p>}
                        </div>

                        <div className="text-center text-slate-500 font-medium">{p.unit}</div>
                        <div className="text-center font-bold text-slate-700">{p.qty}</div>
                        <div className="text-right text-slate-700">
                          R$ {p.price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </div>
                        <div className="text-right font-bold text-slate-800">
                          R$ {p.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </div>

                        {/* remove */}
                        <div className="flex items-center justify-center">
                          {step === "preview" && (
                            <button onClick={() => removeOne(i)} className="w-6 h-6 rounded-md hover:bg-red-50 flex items-center justify-center transition-colors group">
                              <Trash2 size={11} className="text-slate-300 group-hover:text-red-400" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* summary */}
                <div className="mt-3 flex items-center justify-between px-1">
                  <span className="text-[11px] text-slate-400">{products.filter(p => p.selected).length} de {products.length} produto{products.length !== 1 ? "s" : ""}</span>
                  <span className="text-[11px] font-bold text-slate-700">
                    Total: R$ {products.filter(p => p.selected).reduce((s, p) => s + p.total, 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* footer */}
          {(step === "preview" || step === "done") && (
            <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between shrink-0 gap-3">
              {step === "preview" && (
                <>
                  <button onClick={() => { setStep("upload"); setProducts([]); setParseError(null); }}
                    className="text-xs text-slate-500 hover:text-slate-700 font-medium">
                    Trocar arquivo
                  </button>
                  <div className="flex gap-2">
                    <Button variant="secondary" onClick={handleClose}>Cancelar</Button>
                    <Button
                      icon={<PackagePlus size={14} />}
                      onClick={handleImport}
                      disabled={selectedCount === 0}
                    >
                      Importar {selectedCount} produto{selectedCount !== 1 ? "s" : ""}
                    </Button>
                  </div>
                </>
              )}
              {step === "done" && (
                <>
                  <div className="flex items-center gap-2 text-emerald-600">
                    <CheckCircle2 size={14} />
                    <span className="text-xs font-semibold">
                      {products.filter(p => p.done).length} importado{products.filter(p => p.done).length !== 1 ? "s" : ""}
                      {products.filter(p => p.error).length > 0 && `, ${products.filter(p => p.error).length} com erro`}
                    </span>
                  </div>
                  <Button onClick={handleClose}>Fechar</Button>
                </>
              )}
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
