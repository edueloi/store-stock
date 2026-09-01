import React, { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Upload, FileCode, AlertCircle, CheckCircle2, Loader2, Trash2, PackagePlus, RefreshCw } from "lucide-react";
import Button from "./Button";

// ── types ──────────────────────────────────────────────────────────────────
interface ParsedProduct {
  sku: string;
  barcode: string;
  name: string;
  unit: string;
  unitTrib: string;
  qty: number;
  price: number;
  total: number;
  ncm: string;
  cest: string;
  cfop: string;
  selected: boolean;
  // set after matching against existing catalog
  existingId?: number;
  existingStock?: number;
  existingCost?: number;
  // import status
  importing?: boolean;
  done?: boolean;
  doneLabel?: string;
  error?: string;
}

interface XmlImportModalProps {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}

// ── helpers ─────────────────────────────────────────────────────────────────
const authHeader = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}` });
const norm = (s: string) => s.trim().toUpperCase();
const text = (el: Element | null, tag: string): string => el?.getElementsByTagName(tag)[0]?.textContent?.trim() ?? "";

// ── NFe XML parsing ──────────────────────────────────────────────────────────
// Aceita tanto o XML "puro" da NF-e (<NFe>) quanto o "processado" (<nfeProc>, que
// embrulha a NFe + o protocolo de autorização) — ambos os formatos usados pelo
// fisco/emissores. Não depende de namespace prefixado: getElementsByTagName casa
// pelo nome local mesmo com um xmlns default, que é como a NF-e sempre vem.
function parseNfeXml(xmlText: string, fileName: string): ParsedProduct[] {
  const doc = new DOMParser().parseFromString(xmlText, "application/xml");
  const parserError = doc.getElementsByTagName("parsererror")[0];
  if (parserError) {
    throw new Error(`XML inválido em "${fileName}"`);
  }

  const detNodes = Array.from(doc.getElementsByTagName("det"));
  if (detNodes.length === 0) {
    throw new Error(`Nenhum item (<det>) encontrado em "${fileName}" — confirma que é o XML da NF-e (modelo 55), não o DANFE em PDF.`);
  }

  const products: ParsedProduct[] = [];
  for (const det of detNodes) {
    const prod = det.getElementsByTagName("prod")[0] ?? null;
    if (!prod) continue;

    const sku = text(prod, "cProd");
    const name = text(prod, "xProd");
    const qty = parseFloat(text(prod, "qCom").replace(",", ".")) || 0;
    const price = parseFloat(text(prod, "vUnCom").replace(",", ".")) || 0;
    const total = parseFloat(text(prod, "vProd").replace(",", ".")) || (price * qty);
    if (!sku || !name || qty <= 0) continue;

    const barcodeRaw = text(prod, "cEAN");
    products.push({
      sku,
      barcode: /^\d{8,14}$/.test(barcodeRaw) ? barcodeRaw : "",
      name,
      unit: text(prod, "uCom") || "UN",
      unitTrib: text(prod, "uTrib") || text(prod, "uCom") || "UN",
      qty: Math.round(qty),
      price: parseFloat(price.toFixed(2)),
      total: parseFloat(total.toFixed(2)),
      ncm: text(prod, "NCM"),
      cest: text(prod, "CEST"),
      cfop: text(prod, "CFOP"),
      selected: true,
    });
  }
  return products;
}

// ── component ───────────────────────────────────────────────────────────────
export default function XmlImportModal({ open, onClose, onImported }: XmlImportModalProps) {
  const [step, setStep] = useState<"upload" | "preview" | "importing" | "done">("upload");
  const [dragging, setDragging] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [products, setProducts] = useState<ParsedProduct[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => { setStep("upload"); setProducts([]); setParseError(null); };
  const handleClose = () => { reset(); onClose(); };

  const processFiles = useCallback(async (files: FileList | File[]) => {
    const xmlFiles = Array.from(files).filter(f => f.name.toLowerCase().endsWith(".xml"));
    if (xmlFiles.length === 0) {
      setParseError("Selecione um ou mais arquivos XML de NF-e.");
      return;
    }
    setParsing(true);
    setParseError(null);
    try {
      const parsedLists = await Promise.all(xmlFiles.map(async f => parseNfeXml(await f.text(), f.name)));
      const parsed = parsedLists.flat();
      if (parsed.length === 0) {
        setParseError("Nenhum produto encontrado nos XML selecionados.");
        return;
      }

      // Fetch existing products to detect duplicates
      const res = await fetch("/api/products", { headers: authHeader() });
      const existing: { id: number; sku?: string; barcode?: string; stock_quantity: number; cost_price?: number }[] = res.ok ? await res.json() : [];

      const lookup = new Map<string, { id: number; stock: number; cost: number }>();
      for (const p of existing) {
        const entry = { id: p.id, stock: p.stock_quantity, cost: Number(p.cost_price ?? 0) };
        if (p.sku) lookup.set(norm(p.sku), entry);
        if (p.barcode) lookup.set(norm(p.barcode), entry);
      }

      const enriched = parsed.map(p => {
        const match = lookup.get(norm(p.sku)) ?? (p.barcode ? lookup.get(norm(p.barcode)) : undefined);
        return match
          ? { ...p, existingId: match.id, existingStock: match.stock, existingCost: match.cost }
          : p;
      });

      setProducts(enriched);
      setStep("preview");
    } catch (err) {
      setParseError((err as Error).message || "Erro ao processar XML.");
    } finally {
      setParsing(false);
    }
  }, []);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) processFiles(e.target.files);
    e.target.value = "";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files?.length) processFiles(e.dataTransfer.files);
  };

  const toggleAll = (val: boolean) => setProducts(p => p.map(x => ({ ...x, selected: val })));
  const toggleOne = (i: number) => setProducts(p => p.map((x, idx) => idx === i ? { ...x, selected: !x.selected } : x));
  const removeOne = (i: number) => setProducts(p => p.filter((_, idx) => idx !== i));

  const selectedCount = products.filter(p => p.selected).length;
  const updateCount = products.filter(p => p.selected && p.existingId).length;
  const newCount = products.filter(p => p.selected && !p.existingId).length;

  const handleImport = async () => {
    if (!products.filter(p => p.selected).length) return;
    setStep("importing");

    for (let i = 0; i < products.length; i++) {
      if (!products[i].selected) continue;
      setProducts(prev => prev.map((x, idx) => idx === i ? { ...x, importing: true } : x));

      const p = products[i];

      try {
        if (p.existingId) {
          // ── ATUALIZAR: soma estoque; atualiza custo se a NF-e trouxer valor maior ──
          const shouldUpdateCost = p.price > (p.existingCost ?? 0);

          const adjRes = await fetch("/api/products/stock-adjustment", {
            method: "POST",
            headers: authHeader(),
            body: JSON.stringify({
              productId: p.existingId,
              quantity: p.qty,
              type: "in",
              reason: `Importação XML NF-e — +${p.qty} un`,
            }),
          });

          if (shouldUpdateCost) {
            await fetch(`/api/products/${p.existingId}`, {
              method: "PUT",
              headers: authHeader(),
              body: JSON.stringify({ cost_price: p.price }),
            });
          }

          if (adjRes.ok) {
            const costNote = shouldUpdateCost ? ` · custo R$ ${p.price.toFixed(2)}` : "";
            setProducts(prev => prev.map((x, idx) => idx === i
              ? { ...x, importing: false, done: true, doneLabel: `Estoque: ${p.existingStock ?? 0} → ${(p.existingStock ?? 0) + p.qty}${costNote}` }
              : x));
          } else {
            const err = await adjRes.json().catch(() => ({}));
            setProducts(prev => prev.map((x, idx) => idx === i ? { ...x, importing: false, error: err.error || "Erro ao atualizar" } : x));
          }
        } else {
          // ── CRIAR NOVO — já populado com os dados fiscais da NF-e ──
          const res = await fetch("/api/products", {
            method: "POST",
            headers: authHeader(),
            body: JSON.stringify({
              name: p.name,
              sku: p.sku,
              barcode: p.barcode || undefined,
              price: p.price,
              cost_price: p.price,
              stock_quantity: p.qty,
              type: "sale",
              is_active: true,
              is_featured: false,
              ncm: p.ncm || undefined,
              cest: p.cest || undefined,
              cfop: p.cfop || undefined,
              unidade_comercial: p.unit,
              unidade_tributavel: p.unitTrib,
            }),
          });
          if (res.ok) {
            setProducts(prev => prev.map((x, idx) => idx === i ? { ...x, importing: false, done: true, doneLabel: "Criado" } : x));
          } else {
            const err = await res.json().catch(() => ({}));
            setProducts(prev => prev.map((x, idx) => idx === i ? { ...x, importing: false, error: err.error || "Erro ao criar" } : x));
          }
        }
      } catch {
        setProducts(prev => prev.map((x, idx) => idx === i ? { ...x, importing: false, error: "Falha de rede" } : x));
      }
    }

    setStep("done");
    onImported();
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          onClick={handleClose}
        />

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
              <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center">
                <FileCode size={16} className="text-violet-500" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-800">Importar XML de NF-e</h2>
                <p className="text-[11px] text-slate-400">
                  {step === "upload" && "Selecione o(s) XML da nota fiscal de entrada"}
                  {step === "preview" && `${products.length} produto${products.length !== 1 ? "s" : ""} — ${updateCount} atualizar · ${newCount} novo${newCount !== 1 ? "s" : ""}`}
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
                  className={`border-2 border-dashed rounded-2xl p-12 flex flex-col items-center gap-4 cursor-pointer transition-all
                    ${dragging ? "border-violet-400 bg-violet-50" : "border-slate-200 hover:border-violet-300 hover:bg-slate-50"}`}
                >
                  {parsing
                    ? <Loader2 size={32} className="text-violet-400 animate-spin" />
                    : <Upload size={32} className={dragging ? "text-violet-400" : "text-slate-300"} />
                  }
                  <div className="text-center">
                    <p className="text-sm font-semibold text-slate-700">
                      {parsing ? "Processando XML..." : "Arraste o(s) XML aqui ou clique para selecionar"}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">Aceita vários arquivos de uma vez · lê código, descrição, NCM, CEST, CFOP, unidade, quantidade e valor</p>
                  </div>
                </div>
                <input ref={fileRef} type="file" accept=".xml" multiple className="hidden" onChange={onFileChange} />

                {parseError && (
                  <div className="mt-4 flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-100">
                    <AlertCircle size={14} className="text-red-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-red-600">{parseError}</p>
                  </div>
                )}
              </div>
            )}

            {/* ── STEP: preview / importing / done ── */}
            {(step === "preview" || step === "importing" || step === "done") && (
              <div className="p-4">
                {step === "preview" && (
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => toggleAll(true)} className="text-[11px] font-semibold text-violet-600 hover:underline">Todos</button>
                      <span className="text-slate-300">|</span>
                      <button onClick={() => toggleAll(false)} className="text-[11px] font-semibold text-slate-500 hover:underline">Nenhum</button>
                    </div>
                    <div className="flex items-center gap-3">
                      {updateCount > 0 && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                          <RefreshCw size={9} /> {updateCount} atualizar estoque
                        </span>
                      )}
                      {newCount > 0 && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                          <PackagePlus size={9} /> {newCount} novo{newCount !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                <div className="rounded-xl border border-slate-100 overflow-x-auto">
                  <div className="min-w-[560px]">
                  {/* table header */}
                  <div className="grid grid-cols-[auto_1fr_52px_52px_80px_80px_32px] gap-2 px-3 py-2 bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                    <div />
                    <div>Produto</div>
                    <div className="text-center">Und</div>
                    <div className="text-center">Qtd</div>
                    <div className="text-right">Preço</div>
                    <div className="text-right">Total</div>
                    <div />
                  </div>

                  <div className="divide-y divide-slate-50">
                    {products.map((p, i) => (
                      <div key={i} className={`grid grid-cols-[auto_1fr_52px_52px_80px_80px_32px] gap-2 px-3 py-2.5 items-center text-xs transition-colors
                        ${p.selected ? "bg-white" : "bg-slate-50 opacity-50"}`}>

                        {/* checkbox / status icon */}
                        <div className="flex items-center justify-center w-5">
                          {step === "importing" && p.importing ? (
                            <Loader2 size={12} className="text-violet-400 animate-spin" />
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
                              className="w-3.5 h-3.5 accent-violet-500 cursor-pointer"
                            />
                          )}
                        </div>

                        {/* name + sku + badges */}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="font-semibold text-slate-800 truncate leading-tight">{p.name}</p>
                            {!p.done && !p.error && p.existingId && (
                              <span className="shrink-0 text-[9px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
                                ATUALIZAR +{p.qty}un{p.price > (p.existingCost ?? 0) ? " · novo custo" : ""}
                              </span>
                            )}
                            {!p.done && !p.error && !p.existingId && (
                              <span className="shrink-0 text-[9px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full">
                                NOVO
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <p className="text-[10px] text-slate-400 font-mono">{p.sku}</p>
                            {p.ncm && <p className="text-[10px] text-slate-400">NCM {p.ncm}</p>}
                            {p.cfop && <p className="text-[10px] text-slate-400">CFOP {p.cfop}</p>}
                            {p.cest && <p className="text-[10px] text-slate-400">CEST {p.cest}</p>}
                            {p.existingStock !== undefined && !p.done && (
                              <p className="text-[10px] text-amber-500">estoque atual: {p.existingStock}</p>
                            )}
                            {p.doneLabel && <p className="text-[10px] text-emerald-600 font-semibold">{p.doneLabel}</p>}
                            {p.error && <p className="text-[10px] text-red-500">{p.error}</p>}
                          </div>
                        </div>

                        <div className="text-center text-slate-500 font-medium">{p.unit}</div>
                        <div className="text-center font-bold text-slate-700">{p.qty}</div>
                        <div className="text-right text-slate-700">
                          R$ {p.price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </div>
                        <div className="text-right font-bold text-slate-800">
                          R$ {p.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </div>

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
                </div>

                {/* summary */}
                <div className="mt-3 flex items-center justify-between px-1">
                  <span className="text-[11px] text-slate-400">{products.filter(p => p.selected).length} de {products.length} selecionado{products.length !== 1 ? "s" : ""}</span>
                  <span className="text-[11px] font-bold text-slate-700">
                    Total: R$ {products.filter(p => p.selected).reduce((s, p) => s + p.total, 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* footer */}
          {(step === "preview" || step === "done") && (
            <div className="px-6 py-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between shrink-0 gap-3">
              {step === "preview" && (
                <>
                  <button
                    onClick={() => { setStep("upload"); setProducts([]); setParseError(null); }}
                    className="text-xs text-slate-500 hover:text-slate-700 font-medium text-left"
                  >
                    Trocar arquivo
                  </button>
                  <div className="flex gap-2">
                    <Button variant="secondary" onClick={handleClose} className="flex-1 sm:flex-none">Cancelar</Button>
                    <Button
                      icon={<PackagePlus size={14} />}
                      onClick={handleImport}
                      disabled={selectedCount === 0}
                      className="flex-1 sm:flex-none"
                    >
                      Confirmar {selectedCount} produto{selectedCount !== 1 ? "s" : ""}
                    </Button>
                  </div>
                </>
              )}
              {step === "done" && (
                <>
                  <div className="flex items-center gap-2 text-emerald-600">
                    <CheckCircle2 size={14} />
                    <span className="text-xs font-semibold">
                      {products.filter(p => p.done).length} processado{products.filter(p => p.done).length !== 1 ? "s" : ""}
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
