import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, Loader2, Search, TrendingDown } from "lucide-react";
import { Button, Modal } from "../../components/ui";
import { cn } from "../../lib/utils";
import type { Product } from "../../types";

// Revisão em lote do Markup: abre numa janela só todos os produtos "abaixo do markup" ou "sem custo",
// para conferir e aplicar na hora (um a um ou vários de uma vez), sem sair da tela.

export type ReviewTab = "abaixo" | "semcusto";

interface Props {
  tab: ReviewTab;
  onTabChange: (tab: ReviewTab) => void;
  onClose: () => void;
  /** produtos com preço abaixo do markup recomendado (já calculado pela tela) */
  below: Product[];
  /** produtos sem custo cadastrado */
  noCost: Product[];
  /** preço sugerido (já arredondado como na tela) para um custo informado */
  suggestedFor: (cost: number) => number;
  /** o produto foi alterado no servidor: atualiza a lista da tela */
  onProductUpdated: (id: number, patch: Partial<Product>) => void;
}

const money = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const PAGE = 50;
const parseLoose = (raw: string) => {
  const t = String(raw).trim();
  // "29,36" (BR) ou "29.36" (teclado numérico)
  return Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
};

async function putProduct(id: number, body: Record<string, number>): Promise<boolean> {
  try {
    const res = await fetch(`/api/products/${id}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export default function MarkupReview({ tab, onTabChange, onClose, below, noCost, suggestedFor, onProductUpdated }: Props) {
  const [search, setSearch] = useState("");
  const [visible, setVisible] = useState(PAGE);
  const [edited, setEdited] = useState<Record<number, string>>({});   // preço (aba abaixo) ou custo (aba sem custo) digitado
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [savingId, setSavingId] = useState<number | null>(null);
  const [doneIds, setDoneIds] = useState<Set<number>>(new Set());
  const [bulk, setBulk] = useState<{ done: number; total: number; failed: number } | null>(null);
  const [confirmBulk, setConfirmBulk] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setVisible(PAGE); setSelected(new Set()); setConfirmBulk(false); setError(null); }, [tab, search]);
  useEffect(() => { const t = window.setTimeout(() => searchRef.current?.focus(), 50); return () => window.clearTimeout(t); }, [tab]);

  // lista congelada ao abrir: o item aplicado continua visível com "Salvo" em vez de sumir da tela
  const [frozen] = useState(() => ({ below, noCost }));
  const source = tab === "abaixo" ? frozen.below : frozen.noCost;
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? source.filter((p) => p.name.toLowerCase().includes(q) || (p.sku ?? "").toLowerCase().includes(q) || (p.barcode ?? "").includes(q)) : source;
  }, [source, search]);
  const shown = rows.slice(0, visible);

  // ── aba "abaixo do markup" ────────────────────────────────────────────────
  const suggestedOf = (p: Product) => suggestedFor(Number(p.cost_price) || 0);
  const priceInput = (p: Product) => edited[p.id] ?? suggestedOf(p).toFixed(2).replace(".", ",");

  async function applyPrice(p: Product): Promise<boolean> {
    const value = parseLoose(priceInput(p));
    if (!Number.isFinite(value) || value <= 0) { setError(`Preço inválido para "${p.name}".`); return false; }
    setSavingId(p.id);
    const ok = await putProduct(p.id, { price: Math.round(value * 100) / 100 });
    setSavingId(null);
    if (ok) { onProductUpdated(p.id, { price: value }); setDoneIds((s) => new Set(s).add(p.id)); setError(null); }
    else setError(`Não foi possível salvar "${p.name}".`);
    return ok;
  }

  // ── aba "sem custo" ───────────────────────────────────────────────────────
  async function applyCost(p: Product): Promise<boolean> {
    const value = parseLoose(edited[p.id] ?? "");
    if (!Number.isFinite(value) || value <= 0) { setError(`Informe o custo de "${p.name}".`); return false; }
    setSavingId(p.id);
    const ok = await putProduct(p.id, { cost_price: Math.round(value * 100) / 100 });
    setSavingId(null);
    if (ok) { onProductUpdated(p.id, { cost_price: value }); setDoneIds((s) => new Set(s).add(p.id)); setError(null); }
    else setError(`Não foi possível salvar "${p.name}".`);
    return ok;
  }

  // ── aplicar vários de uma vez ─────────────────────────────────────────────
  const toApply = rows.filter((p) => selected.has(p.id) && !doneIds.has(p.id)
    && (tab === "abaixo" || parseLoose(edited[p.id] ?? "") > 0));
  async function runBulk() {
    const list = [...toApply];
    setConfirmBulk(false);
    setBulk({ done: 0, total: list.length, failed: 0 });
    let done = 0; let failed = 0; let cursor = 0;
    const worker = async () => {
      while (cursor < list.length) {
        const p = list[cursor++];
        const ok = tab === "abaixo" ? await applyPrice(p) : await applyCost(p);
        if (ok) done++; else failed++;
        setBulk({ done: done + failed, total: list.length, failed });
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    setSelected(new Set());
    setBulk((b) => b && { ...b, done: b.total });
  }

  const allShownSelectable = shown.filter((p) => !doneIds.has(p.id));
  const allChecked = allShownSelectable.length > 0 && allShownSelectable.every((p) => selected.has(p.id));
  const toggleAll = () => setSelected(allChecked ? new Set() : new Set(allShownSelectable.map((p) => p.id)));
  const toggle = (id: number) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const remaining = (arr: Product[]) => arr.filter((p) => !doneIds.has(p.id)).length;

  const tabs: { id: ReviewTab; label: string; count: number; tone: string }[] = [
    { id: "abaixo", label: "Abaixo do markup", count: remaining(frozen.below), tone: "text-red-600" },
    { id: "semcusto", label: "Sem custo", count: remaining(frozen.noCost), tone: "text-amber-600" },
  ];

  return (
    <Modal open onClose={onClose} title="Revisar produtos" subtitle="Confira e aplique sem sair do Markup" size="full" className="markup-review-modal">
      <div className="flex min-h-[60vh] flex-col gap-3">
        {/* abas */}
        <div className="flex flex-wrap items-center gap-2">
          {tabs.map((t) => (
            <button key={t.id} type="button" onClick={() => onTabChange(t.id)}
              className={cn("inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-[13px] font-semibold transition-colors",
                tab === t.id ? "border-blue-600 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50")}>
              {t.id === "abaixo" ? <TrendingDown size={14} className={t.tone} /> : <AlertTriangle size={14} className={t.tone} />}
              {t.label}
              <span className={cn("rounded-full px-2 py-0.5 text-[11px]", tab === t.id ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600")}>{t.count}</span>
            </button>
          ))}
          <div className="relative ml-auto w-full sm:w-72">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input ref={searchRef} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar produto, SKU ou código…"
              className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-[13px] outline-none focus:border-blue-500" />
          </div>
        </div>

        <p className="text-[12px] text-slate-500">
          {tab === "abaixo"
            ? "Preço atual abaixo do sugerido pelas suas configurações de markup. O campo já vem com o preço sugerido: ajuste se quiser e clique em Aplicar."
            : "Estes produtos não têm custo cadastrado, então o markup não consegue calcular. Informe o custo e salve; o produto passa a ser analisado."}
        </p>

        {/* ações em lote */}
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
          <label className="inline-flex cursor-pointer items-center gap-2 text-[13px] font-medium text-slate-700">
            <input type="checkbox" checked={allChecked} onChange={toggleAll} className="h-4 w-4 accent-blue-600" />
            Selecionar todos exibidos
          </label>
          <span className="text-[12px] text-slate-400">{toApply.length} selecionado(s) · {rows.length} na lista</span>
          <div className="ml-auto flex items-center gap-2">
            {bulk && bulk.done < bulk.total && (
              <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-blue-700"><Loader2 size={14} className="animate-spin" /> Aplicando {bulk.done}/{bulk.total}…</span>
            )}
            {bulk && bulk.done >= bulk.total && (
              <span className={cn("text-[12px] font-medium", bulk.failed ? "text-amber-700" : "text-emerald-700")}>
                {bulk.failed ? `${bulk.total - bulk.failed} aplicados · ${bulk.failed} falharam` : `${bulk.total} produtos atualizados`}
              </span>
            )}
            {!confirmBulk ? (
              <Button size="sm" variant="primary" disabled={toApply.length === 0 || (bulk !== null && bulk.done < bulk.total)} onClick={() => setConfirmBulk(true)}>
                {tab === "abaixo" ? `Aplicar preço sugerido (${toApply.length})` : `Salvar custos (${toApply.length})`}
              </Button>
            ) : (
              <>
                <span className="text-[12px] font-semibold text-slate-700">Alterar {toApply.length} produto(s)?</span>
                <Button size="sm" variant="primary" onClick={() => void runBulk()}>Confirmar</Button>
                <Button size="sm" variant="outline" onClick={() => setConfirmBulk(false)}>Cancelar</Button>
              </>
            )}
          </div>
        </div>
        {error && <p role="alert" className="text-[12px] font-semibold text-red-600">{error}</p>}

        {/* lista */}
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[720px] border-collapse text-[13px]">
            <thead className="sticky top-0 z-10 bg-slate-50 text-left text-[11px] font-semibold text-slate-500">
              <tr>
                <th className="w-10 px-3 py-2" />
                <th className="px-3 py-2">Produto</th>
                {tab === "abaixo" ? (
                  <>
                    <th className="px-3 py-2 text-right">Custo</th>
                    <th className="px-3 py-2 text-right">Preço atual</th>
                    <th className="px-3 py-2 text-right">Sugerido</th>
                    <th className="w-40 px-3 py-2 text-right">Novo preço</th>
                  </>
                ) : (
                  <>
                    <th className="px-3 py-2 text-right">Preço atual</th>
                    <th className="w-40 px-3 py-2 text-right">Custo</th>
                    <th className="px-3 py-2 text-right">Sugerido</th>
                  </>
                )}
                <th className="w-28 px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {shown.length === 0 && (
                <tr><td colSpan={7} className="px-3 py-10 text-center text-slate-400">{source.length === 0 ? "Nada para revisar aqui. Tudo certo!" : "Nenhum produto encontrado."}</td></tr>
              )}
              {shown.map((p) => {
                const done = doneIds.has(p.id);
                const saving = savingId === p.id;
                const costTyped = parseLoose(edited[p.id] ?? "");
                return (
                  <tr key={p.id} className={cn("hover:bg-slate-50", done && "bg-emerald-50/60")}>
                    <td className="px-3 py-2"><input type="checkbox" disabled={done} checked={selected.has(p.id)} onChange={() => toggle(p.id)} className="h-4 w-4 accent-blue-600" aria-label={`Selecionar ${p.name}`} /></td>
                    <td className="max-w-[360px] px-3 py-2">
                      <div className="flex items-center gap-2.5">
                        {p.image_url ? <img src={p.image_url} alt="" loading="lazy" decoding="async" className="h-9 w-9 shrink-0 rounded-md border border-slate-200 bg-slate-50 object-contain" /> : <div className="h-9 w-9 shrink-0 rounded-md border border-slate-200 bg-slate-100" />}
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-800" title={p.name}>{p.name}</p>
                          {p.sku && <p className="truncate text-[11px] text-slate-400">{p.sku}</p>}
                        </div>
                      </div>
                    </td>
                    {tab === "abaixo" ? (
                      <>
                        <td className="px-3 py-2 text-right font-mono text-slate-600">{money(Number(p.cost_price) || 0)}</td>
                        <td className="px-3 py-2 text-right font-mono font-semibold text-red-600">{money(Number(p.price) || 0)}</td>
                        <td className="px-3 py-2 text-right font-mono text-slate-700">{money(suggestedOf(p))}</td>
                        <td className="px-3 py-2">
                          <div className="ml-auto flex w-36 items-center overflow-hidden rounded-lg border border-slate-200 bg-white focus-within:border-blue-500">
                            <span className="bg-slate-50 px-2 text-[12px] text-slate-400">R$</span>
                            <input value={priceInput(p)} disabled={done} onChange={(e) => setEdited((s) => ({ ...s, [p.id]: e.target.value }))}
                              onKeyDown={(e) => { if (e.key === "Enter") void applyPrice(p); }} inputMode="decimal"
                              className="h-8 w-full bg-transparent px-2 text-right font-mono text-[13px] font-semibold outline-none" />
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-3 py-2 text-right font-mono text-slate-600">{money(Number(p.price) || 0)}</td>
                        <td className="px-3 py-2">
                          <div className="ml-auto flex w-36 items-center overflow-hidden rounded-lg border border-slate-200 bg-white focus-within:border-blue-500">
                            <span className="bg-slate-50 px-2 text-[12px] text-slate-400">R$</span>
                            <input value={edited[p.id] ?? ""} disabled={done} placeholder="0,00" onChange={(e) => setEdited((s) => ({ ...s, [p.id]: e.target.value }))}
                              onKeyDown={(e) => { if (e.key === "Enter") void applyCost(p); }} inputMode="decimal"
                              className="h-8 w-full bg-transparent px-2 text-right font-mono text-[13px] font-semibold outline-none" />
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-slate-500">{Number.isFinite(costTyped) && costTyped > 0 ? money(suggestedFor(costTyped)) : "—"}</td>
                      </>
                    )}
                    <td className="px-3 py-2 text-right">
                      {done ? (
                        <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-emerald-700"><CheckCircle2 size={14} /> Salvo</span>
                      ) : (
                        <Button size="xs" variant="outline" disabled={saving} onClick={() => void (tab === "abaixo" ? applyPrice(p) : applyCost(p))}
                          iconLeft={saving ? <Loader2 size={11} className="animate-spin" /> : <ArrowRight size={11} />}>
                          {tab === "abaixo" ? "Aplicar" : "Salvar"}
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {rows.length > visible && (
          <button type="button" onClick={() => setVisible((v) => v + PAGE)}
            className="h-10 rounded-lg border border-slate-200 bg-white text-[13px] font-semibold text-slate-600 hover:bg-slate-50">
            Mostrar mais ({rows.length - visible} restantes)
          </button>
        )}
      </div>
    </Modal>
  );
}
