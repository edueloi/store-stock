import { useEffect, useMemo, useState } from "react";
import { RotateCcw, CheckCircle2, Minus, Plus, Search, Trash2, PackageCheck, PackageX, Banknote, Wallet, ArrowLeftRight } from "lucide-react";
import { cn } from "../../lib/utils";
import { Alert, Button, Input, Modal, ModalFooter, Textarea } from "../../components/ui";

interface ReturnableItem {
  id: number;
  product_name: string;
  quantity: number;
  unit_price: number | string;
  returned_quantity?: number;
}

export interface OrderReturnResult {
  credit: { id: number; amount: number } | null;
  creditAmount: number;
  refundMode: "credit" | "cash";
  exchange: { name: string; quantity: number; price: number }[];
  difference: number; // > 0 cliente paga · < 0 sobra para o cliente · 0 troca equivalente
}

interface OrderReturnModalProps {
  orderId: number;
  orderCreatedAt: string;
  customerId?: number | null;
  customerName?: string | null;
  items: ReturnableItem[];
  returnDeadlineDays?: number | null;
  onClose: () => void;
  onSuccess: (result: OrderReturnResult) => void;
}

interface ReturnLineState {
  quantity: number;
  restock: boolean;
}

interface CatalogProduct {
  id: number;
  name: string;
  price: number | string;
  stock_quantity: number;
  sale_unit?: string | null;
}

interface ExchangeLine {
  product: CatalogProduct;
  quantity: number;
}

const money = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;

const REASONS = ["Não gostou", "Tamanho/modelo errado", "Defeito de fábrica", "Pedido errado", "Outro"];

// Modal de devolução/troca. Cada item do pedido é marcado com a quantidade e o destino
// (volta ao estoque ou descarte); opcionalmente o cliente escolhe produtos de troca e o
// modal mostra a diferença (cliente paga / sobra crédito). Ao confirmar, chama
// POST /api/orders/:id/returns (estoque, StockMovement, estorno financeiro e crédito
// são feitos no backend — ver createOrderReturn em orders.controller.ts).
export default function OrderReturnModal({
  orderId, orderCreatedAt, customerId, customerName, items, returnDeadlineDays, onClose, onSuccess,
}: OrderReturnModalProps) {
  const token = () => localStorage.getItem("token");
  const [lines, setLines] = useState<Record<number, ReturnLineState>>({});
  const [reason, setReason] = useState("");
  const [reasonNote, setReasonNote] = useState("");
  const [refundMode, setRefundMode] = useState<"credit" | "cash">(customerId ? "credit" : "cash");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [exchangeOn, setExchangeOn] = useState(false);
  const [catalog, setCatalog] = useState<CatalogProduct[] | null>(null);
  const [query, setQuery] = useState("");
  const [exchange, setExchange] = useState<ExchangeLine[]>([]);

  const returnableItems = items.filter((i) => i.quantity - (i.returned_quantity ?? 0) > 0);
  const availableOf = (i: ReturnableItem) => i.quantity - (i.returned_quantity ?? 0);

  const daysSinceOrder = Math.floor((Date.now() - new Date(orderCreatedAt).getTime()) / (1000 * 60 * 60 * 24));
  const deadline = returnDeadlineDays ?? 30;
  const isWithinDeadline = daysSinceOrder <= deadline;

  useEffect(() => {
    if (!exchangeOn || catalog) return;
    fetch("/api/products", { headers: { Authorization: `Bearer ${token()}` } })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setCatalog(Array.isArray(data) ? data : (data?.products ?? [])))
      .catch(() => setCatalog([]));
  }, [exchangeOn, catalog]);

  const setQty = (item: ReturnableItem, quantity: number) => {
    const q = Math.max(0, Math.min(availableOf(item), Math.floor(quantity) || 0));
    setLines((prev) => ({ ...prev, [item.id]: { restock: true, ...prev[item.id], quantity: q } }));
  };
  const setRestock = (itemId: number, restock: boolean) => {
    setLines((prev) => ({ ...prev, [itemId]: { quantity: 0, ...prev[itemId], restock } }));
  };
  const markAll = (restock: boolean) => {
    const next: Record<number, ReturnLineState> = {};
    returnableItems.forEach((i) => { next[i.id] = { quantity: availableOf(i), restock }; });
    setLines(next);
  };
  const clearAll = () => setLines({});

  const summary = useMemo(() => {
    let restockQty = 0, discardQty = 0, total = 0;
    returnableItems.forEach((item) => {
      const l = lines[item.id];
      const q = l?.quantity ?? 0;
      if (q <= 0) return;
      total += q * Number(item.unit_price || 0);
      if (l?.restock ?? true) restockQty += q; else discardQty += q;
    });
    return { restockQty, discardQty, total: Math.round(total * 100) / 100 };
  }, [lines, returnableItems]);

  const exchangeTotal = Math.round(exchange.reduce((s, l) => s + Number(l.product.price || 0) * l.quantity, 0) * 100) / 100;
  const difference = exchangeOn && exchange.length > 0 ? Math.round((exchangeTotal - summary.total) * 100) / 100 : 0;
  const hasAnyLine = summary.restockQty + summary.discardQty > 0;

  const results = useMemo(() => {
    if (!catalog) return [];
    const q = query.trim().toLowerCase();
    const list = q ? catalog.filter((p) => p.name?.toLowerCase().includes(q)) : catalog;
    return list.slice(0, 8);
  }, [catalog, query]);

  const addExchange = (product: CatalogProduct) => {
    setExchange((prev) => {
      const found = prev.find((l) => l.product.id === product.id);
      if (found) return prev.map((l) => (l.product.id === product.id ? { ...l, quantity: l.quantity + 1 } : l));
      return [...prev, { product, quantity: 1 }];
    });
    setQuery("");
  };
  const changeExchangeQty = (id: number, delta: number) => {
    setExchange((prev) => prev
      .map((l) => (l.product.id === id ? { ...l, quantity: l.quantity + delta } : l))
      .filter((l) => l.quantity > 0));
  };

  const handleConfirm = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const payloadItems = returnableItems
        .map((item) => {
          const line = lines[item.id];
          const qty = line?.quantity ?? 0;
          if (qty <= 0) return null;
          return { order_item_id: item.id, quantity: qty, restock: line?.restock ?? true };
        })
        .filter((l): l is { order_item_id: number; quantity: number; restock: boolean } => l !== null);

      if (payloadItems.length === 0) {
        setError("Informe a quantidade de ao menos um item para devolver");
        return;
      }

      const fullReason = [reason, reasonNote.trim()].filter(Boolean).join(" — ");
      const exchangeNote = exchangeOn && exchange.length > 0
        ? `Troca por: ${exchange.map((l) => `${l.quantity}x ${l.product.name}`).join(", ")}`
        : "";
      const finalReason = [fullReason, exchangeNote].filter(Boolean).join(" | ");

      const res = await fetch(`/api/orders/${orderId}/returns`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ items: payloadItems, reason: finalReason || undefined, refund_mode: refundMode }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Falha ao registrar devolução");
        return;
      }
      onSuccess({
        credit: data.credit ? { ...data.credit, amount: Number(data.credit.amount) } : null,
        creditAmount: Number(data.creditAmount) || 0,
        refundMode,
        exchange: exchangeOn ? exchange.map((l) => ({ name: l.product.name, quantity: l.quantity, price: Number(l.product.price || 0) })) : [],
        difference,
      });
    } catch {
      setError("Erro de conexão ao registrar devolução");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} position="right" size="md" zIndex={610}
      title={<span className="inline-flex items-center gap-2"><RotateCcw size={15} className="text-amber-600" />Devolver / Trocar</span>}
      subtitle={`Pedido #${String(orderId).padStart(6, "0")}${customerName ? ` · ${customerName}` : ""}`}
      footer={
        <div className="w-full space-y-2">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-emerald-50 px-2 py-1.5">
              <p className="text-[10px] text-emerald-700">Volta ao estoque</p>
              <p className="text-sm font-semibold tabular-nums text-emerald-800">{summary.restockQty} un</p>
            </div>
            <div className="rounded-lg bg-rose-50 px-2 py-1.5">
              <p className="text-[10px] text-rose-700">Descarte</p>
              <p className="text-sm font-semibold tabular-nums text-rose-800">{summary.discardQty} un</p>
            </div>
            <div className="rounded-lg bg-slate-100 px-2 py-1.5">
              <p className="text-[10px] text-slate-600">Total devolvido</p>
              <p className="text-sm font-semibold tabular-nums text-slate-900">{money(summary.total)}</p>
            </div>
          </div>
          <ModalFooter align="between">
            <Button size="sm" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button size="sm" onClick={handleConfirm} loading={submitting} disabled={!hasAnyLine} iconLeft={<CheckCircle2 size={14} />}>
              Confirmar {exchangeOn && exchange.length > 0 ? "troca" : "devolução"}
            </Button>
          </ModalFooter>
        </div>
      }>
      <div className="space-y-4">
        <Alert variant={isWithinDeadline ? "success" : "warning"}>
          Vendido há {daysSinceOrder} {daysSinceOrder === 1 ? "dia" : "dias"} —
          {" "}{isWithinDeadline ? `dentro do prazo de devolução (${deadline} dias)` : `fora do prazo de devolução (${deadline} dias). Você ainda pode confirmar por exceção.`}
        </Alert>

        {/* 1. O que está voltando */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-slate-800">1. O que o cliente está devolvendo</h4>
            <div className="flex gap-1">
              <Button variant="outline" size="xs" onClick={() => markAll(true)}>Tudo p/ estoque</Button>
              <Button variant="outline" size="xs" onClick={() => markAll(false)}>Tudo descarte</Button>
              {hasAnyLine && <Button variant="ghost" size="xs" onClick={clearAll}>Limpar</Button>}
            </div>
          </div>

          {returnableItems.length === 0 && (
            <p className="py-6 text-center text-xs text-slate-500">Todos os itens deste pedido já foram devolvidos.</p>
          )}
          {returnableItems.map((item) => {
            const available = availableOf(item);
            const line = lines[item.id];
            const qty = line?.quantity ?? 0;
            const restock = line?.restock ?? true;
            const price = Number(item.unit_price || 0);
            const active = qty > 0;
            return (
              <div key={item.id} className={cn("space-y-2 rounded-lg border p-3 transition-colors", active ? "border-amber-300 bg-amber-50/40" : "border-slate-200")}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-slate-800">{item.product_name}</p>
                    <p className="text-[11px] text-slate-500">
                      Vendido: {item.quantity} · Pode devolver: {available} · {money(price)} cada
                      {(item.returned_quantity ?? 0) > 0 && <span className="ml-1 text-amber-600">({item.returned_quantity} já devolvido)</span>}
                    </p>
                  </div>
                  {active && <span className="shrink-0 text-xs font-semibold tabular-nums text-slate-800">{money(qty * price)}</span>}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center overflow-hidden rounded-lg border border-slate-200 bg-white">
                    <button type="button" aria-label="Diminuir" className="h-8 w-8 text-slate-600 hover:bg-slate-100" onClick={() => setQty(item, qty - 1)}><Minus size={13} className="mx-auto" /></button>
                    <input aria-label={`Quantidade a devolver de ${item.product_name}`} type="number" min={0} max={available} value={qty}
                      onChange={(e) => setQty(item, Number(e.target.value))}
                      className="h-8 w-12 border-x border-slate-200 text-center text-xs font-semibold tabular-nums outline-none" />
                    <button type="button" aria-label="Aumentar" className="h-8 w-8 text-slate-600 hover:bg-slate-100" onClick={() => setQty(item, qty + 1)}><Plus size={13} className="mx-auto" /></button>
                  </div>
                  <Button size="xs" variant="outline" onClick={() => setQty(item, available)}>Todos ({available})</Button>
                  <div className={cn("flex min-w-[220px] flex-1 gap-1", !active && "pointer-events-none opacity-40")}>
                    <Button size="xs" className="flex-1" variant={restock ? "success" : "outline"} iconLeft={<PackageCheck size={12} />} onClick={() => setRestock(item.id, true)}>Volta ao estoque</Button>
                    <Button size="xs" className="flex-1" variant={!restock ? "danger" : "outline"} iconLeft={<PackageX size={12} />} onClick={() => setRestock(item.id, false)}>Descarte (defeito)</Button>
                  </div>
                </div>
              </div>
            );
          })}
        </section>

        {/* 2. Motivo */}
        <section className="space-y-2">
          <h4 className="text-xs font-semibold text-slate-800">2. Motivo</h4>
          <div className="flex flex-wrap gap-1.5">
            {REASONS.map((r) => (
              <button key={r} type="button" onClick={() => setReason(reason === r ? "" : r)}
                className={cn("h-7 rounded-full border px-3 text-[11px] font-medium transition-colors",
                  reason === r ? "border-amber-400 bg-amber-100 text-amber-800" : "border-slate-200 text-slate-600 hover:bg-slate-50")}>
                {r}
              </button>
            ))}
          </div>
          <Textarea rows={2} value={reasonNote} onChange={(e) => setReasonNote(e.target.value)} placeholder="Observação (opcional)" />
        </section>

        {/* 3. Troca por outro produto */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-slate-800">3. Troca por outro produto</h4>
            <button type="button" role="switch" aria-checked={exchangeOn} onClick={() => setExchangeOn((v) => !v)}
              className={cn("relative h-5 w-9 rounded-full transition-colors", exchangeOn ? "bg-amber-500" : "bg-slate-300")}>
              <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all", exchangeOn ? "left-[18px]" : "left-0.5")} />
            </button>
          </div>

          {exchangeOn && (
            <div className="space-y-2 rounded-lg border border-slate-200 p-3">
              <Input size="sm" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar produto que o cliente vai levar…" iconLeft={<Search size={13} />} />
              {query.trim() && (
                <div className="max-h-44 overflow-y-auto rounded-lg border border-slate-200">
                  {!catalog && <p className="p-3 text-center text-[11px] text-slate-500">Carregando produtos…</p>}
                  {catalog && results.length === 0 && <p className="p-3 text-center text-[11px] text-slate-500">Nenhum produto encontrado.</p>}
                  {results.map((p) => (
                    <button key={p.id} type="button" onClick={() => addExchange(p)}
                      className="flex w-full items-center justify-between gap-2 border-b border-slate-100 px-3 py-2 text-left last:border-0 hover:bg-slate-50">
                      <span className="min-w-0 truncate text-xs text-slate-800">{p.name}</span>
                      <span className="shrink-0 text-[11px] tabular-nums text-slate-500">{money(Number(p.price || 0))} · est. {p.stock_quantity}</span>
                    </button>
                  ))}
                </div>
              )}

              {exchange.length === 0 && !query.trim() && (
                <p className="py-2 text-center text-[11px] text-slate-500">Busque e adicione o(s) produto(s) que o cliente vai levar no lugar.</p>
              )}
              {exchange.map((l) => (
                <div key={l.product.id} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-slate-800">{l.product.name}</p>
                    <p className="text-[11px] text-slate-500">{money(Number(l.product.price || 0))} cada</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center overflow-hidden rounded-lg border border-slate-200 bg-white">
                      <button type="button" aria-label="Diminuir" className="h-7 w-7 hover:bg-slate-100" onClick={() => changeExchangeQty(l.product.id, -1)}>
                        {l.quantity === 1 ? <Trash2 size={12} className="mx-auto text-rose-500" /> : <Minus size={12} className="mx-auto" />}
                      </button>
                      <span className="w-8 text-center text-xs font-semibold tabular-nums">{l.quantity}</span>
                      <button type="button" aria-label="Aumentar" className="h-7 w-7 hover:bg-slate-100" onClick={() => changeExchangeQty(l.product.id, 1)}><Plus size={12} className="mx-auto" /></button>
                    </div>
                    <span className="w-20 text-right text-xs font-semibold tabular-nums">{money(Number(l.product.price || 0) * l.quantity)}</span>
                  </div>
                </div>
              ))}

              {exchange.length > 0 && (
                <div className={cn("flex items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold",
                  !hasAnyLine ? "bg-slate-100 text-slate-600"
                    : difference > 0 ? "bg-amber-100 text-amber-900"
                    : difference < 0 ? "bg-emerald-100 text-emerald-900" : "bg-slate-100 text-slate-700")}>
                  <span className="inline-flex items-center gap-1.5"><ArrowLeftRight size={13} />
                    {!hasAnyLine ? "Marque o que está sendo devolvido para calcular a diferença"
                      : difference > 0 ? "Cliente paga a diferença"
                      : difference < 0 ? "Sobra para o cliente" : "Troca equivalente (sem diferença)"}
                  </span>
                  {hasAnyLine && difference !== 0 && <span className="tabular-nums">{money(Math.abs(difference))}</span>}
                </div>
              )}
            </div>
          )}
        </section>

        {/* 4. Como devolver o valor */}
        <section className="space-y-2">
          <h4 className="text-xs font-semibold text-slate-800">4. Valor devolvido</h4>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" disabled={!customerId} onClick={() => setRefundMode("credit")}
              className={cn("rounded-lg border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                refundMode === "credit" ? "border-violet-400 bg-violet-50" : "border-slate-200 hover:bg-slate-50")}>
              <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-800"><Wallet size={13} />Crédito de troca</span>
              <span className="mt-0.5 block text-[11px] text-slate-500">{customerId ? `Fica no cadastro de ${customerName || "cliente"}` : "Exige cliente identificado"}</span>
            </button>
            <button type="button" onClick={() => setRefundMode("cash")}
              className={cn("rounded-lg border p-3 text-left transition-colors",
                refundMode === "cash" ? "border-emerald-400 bg-emerald-50" : "border-slate-200 hover:bg-slate-50")}>
              <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-800"><Banknote size={13} />Devolver o dinheiro</span>
              <span className="mt-0.5 block text-[11px] text-slate-500">Estorno na hora, sem crédito</span>
            </button>
          </div>
          {!customerId && <Alert variant="warning">Venda sem cliente identificado — o valor é devolvido em dinheiro na hora.</Alert>}
        </section>

        {error && <Alert variant="error">{error}</Alert>}
      </div>
    </Modal>
  );
}
