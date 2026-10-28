import { useEffect, useMemo, useState } from "react";
import { RotateCcw, CheckCircle2, Minus, Plus, Search, Trash2, PackageCheck, PackageX, Banknote, Wallet, ArrowLeftRight, ScanBarcode, CreditCard, UserRound } from "lucide-react";
import { cn } from "../../lib/utils";
import ExchangePaymentForm, { checkPayLines, newPayLine, payLinesPayload, type PayLine } from "./ExchangePaymentForm";
import { useBarcodeScanner } from "../../hooks/useBarcodeScanner";
import { Alert, Button, Input, Modal, ModalFooter, Textarea } from "../../components/ui";

interface ReturnableItem {
  id: number;
  product_name: string;
  quantity: number;
  unit_price: number | string;
  returned_quantity?: number;
  product_id?: number | null;
  barcode?: string | null;
  sku?: string | null;
}

export interface OrderReturnResult {
  credit: { id: number; amount: number } | null;
  creditAmount: number;
  refundMode: "credit" | "cash";
  exchange: { name: string; quantity: number; price: number }[];
  difference: number; // > 0 cliente paga · < 0 sobra para o cliente · 0 troca equivalente
  exchangeOrderId: number | null; // venda criada para os produtos novos
  toPay: number; // quanto o cliente pagou de diferença
  change: number; // troco devolvido (pagamento em dinheiro)
}

interface OrderReturnModalProps {
  orderId: number;
  orderCreatedAt: string;
  customerId?: number | null;
  customerName?: string | null;
  paymentMethod?: string | null;
  orderTotal?: number | string;
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
  barcode?: string | null;
  sku?: string | null;
}

interface ExchangeLine {
  product: CatalogProduct;
  quantity: number;
}

const money = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;

const METHOD_LABELS: Record<string, string> = {
  money: "Dinheiro", pix: "PIX", debit: "Débito", credit: "Crédito", crediario: "Crediário",
  to_confirm: "A combinar", cash_on_delivery: "Dinheiro na entrega", card_on_delivery: "Cartão na entrega",
};

// payment_method: "credit-visa-3:120.5|pix:30" → segmentos legíveis
function parsePayments(pm?: string | null) {
  if (!pm) return [] as { method: string; label: string; amount: number | null }[];
  return pm.split("|").map((seg) => {
    const [methodPart, amountStr] = seg.split(":");
    const [method = "money", brand, inst] = methodPart.split("-");
    const brandTxt = brand && brand !== "other" ? ` ${brand.toUpperCase()}` : "";
    const instTxt = inst && Number(inst) > 1 ? ` em ${inst}x` : "";
    const amount = amountStr && Number.isFinite(parseFloat(amountStr)) ? parseFloat(amountStr) : null;
    return { method, label: `${METHOD_LABELS[method] ?? method}${brandTxt}${instTxt}`, amount };
  });
}

const STEPS = ["1. Itens", "2. Troca (opcional)", "3. Confirmar"];

const REASONS = ["Não gostou", "Tamanho/modelo errado", "Defeito de fábrica", "Pedido errado", "Outro"];

// Modal de devolução/troca. Cada item do pedido é marcado com a quantidade e o destino
// (volta ao estoque ou descarte); opcionalmente o cliente escolhe produtos de troca e o
// modal mostra a diferença (cliente paga / sobra crédito). Ao confirmar, chama
// POST /api/orders/:id/returns (estoque, StockMovement, estorno financeiro e crédito
// são feitos no backend — ver createOrderReturn em orders.controller.ts).
export default function OrderReturnModal({
  orderId, orderCreatedAt, customerId, customerName, paymentMethod, orderTotal, items, returnDeadlineDays, onClose, onSuccess,
}: OrderReturnModalProps) {
  const token = () => localStorage.getItem("token");
  const [lines, setLines] = useState<Record<number, ReturnLineState>>({});
  const [reason, setReason] = useState("");
  const [reasonNote, setReasonNote] = useState("");
  const [refundMode, setRefundMode] = useState<"credit" | "cash">(customerId ? "credit" : "cash");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [payLines, setPayLines] = useState<PayLine[]>([newPayLine()]);

  const [exchangeOn, setExchangeOn] = useState(false);
  const [catalog, setCatalog] = useState<CatalogProduct[] | null>(null);
  const [query, setQuery] = useState("");
  const [exchange, setExchange] = useState<ExchangeLine[]>([]);

  const payments = useMemo(() => parsePayments(paymentMethod), [paymentMethod]);
  const payHint = useMemo(() => {
    const m = payments.map((p) => p.method);
    const hints: string[] = [];
    if (m.includes("crediario")) hints.push("Parte desta venda ficou no crediário: o cliente ainda pode estar devendo. Devolver em dinheiro só vale pelo que ele já pagou.");
    if (m.includes("credit") || m.includes("debit")) hints.push("Pago no cartão: o estorno do valor na maquininha/adquirente é feito por fora do sistema.");
    if (m.includes("pix")) hints.push("Pago no PIX: devolva o valor por PIX ao cliente.");
    return hints.join(" ");
  }, [payments]);

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
      if (!item.product_id) return;
      if (l?.restock ?? true) restockQty += q; else discardQty += q;
    });
    return { restockQty, discardQty, total: Math.round(total * 100) / 100 };
  }, [lines, returnableItems]);

  const exchangeTotal = Math.round(exchange.reduce((s, l) => s + Number(l.product.price || 0) * l.quantity, 0) * 100) / 100;
  const difference = exchangeOn && exchange.length > 0 ? Math.round((exchangeTotal - summary.total) * 100) / 100 : 0;
  const hasAnyLine = summary.total > 0;
  const hasExchange = exchangeOn && exchange.length > 0;
  const due = hasExchange && difference > 0 ? difference : 0;
  const payCheck = checkPayLines(payLines, due, !!customerId);
  const payOk = due <= 0.009 || payCheck.ok;

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

  const [scanCode, setScanCode] = useState("");
  const [scanMsg, setScanMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const norm = (v?: string | null) => (v ?? "").trim().toLowerCase();

  // Código bipado: primeiro procura entre os itens da venda (devolução); se a troca estiver
  // ligada e o código não for de um item da venda, procura no catálogo (produto novo).
  const handleScan = (raw: string) => {
    const code = norm(raw);
    if (!code) return;
    const hit = returnableItems.find((i) => norm(i.barcode) === code || norm(i.sku) === code);
    if (hit) {
      const current = lines[hit.id]?.quantity ?? 0;
      if (current >= availableOf(hit)) {
        setScanMsg({ ok: false, text: `${hit.product_name}: já marcou tudo que pode devolver (${availableOf(hit)})` });
      } else {
        setQty(hit, current + 1);
        setScanMsg({ ok: true, text: `${hit.product_name} — ${current + 1} de ${availableOf(hit)} marcado(s) para devolução` });
      }
      return;
    }
    if (exchangeOn) {
      const prod = catalog?.find((p) => norm(p.barcode) === code || norm(p.sku) === code);
      if (prod) {
        addExchange(prod);
        setScanMsg({ ok: true, text: `${prod.name} adicionado à troca` });
        return;
      }
    }
    setScanMsg({ ok: false, text: `Código ${raw} não encontrado ${exchangeOn ? "nesta venda nem no catálogo" : "nesta venda"}` });
  };

  useBarcodeScanner({
    onScan: handleScan,
    searchFields: [{ id: "return-scan-input", getValue: () => scanCode, setValue: setScanCode }],
  });

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
        body: JSON.stringify({
          items: payloadItems,
          reason: finalReason || undefined,
          refund_mode: refundMode,
          exchange: hasExchange
            ? {
                items: exchange.map((l) => ({ product_id: l.product.id, quantity: l.quantity })),
                payments: due > 0.009 ? payLinesPayload(payLines, due) : [],
                crediario_installments: payCheck.crediarioInstallments,
                change_amount: payCheck.change || undefined,
              }
            : undefined,
        }),
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
        exchangeOrderId: data.exchange_order_id ?? null,
        toPay: Number(data.to_pay) || 0,
        change: payCheck.change,
      });
    } catch {
      setError("Erro de conexão ao registrar devolução");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} size="2xl" zIndex={610}
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
            <Button size="sm" variant="outline" onClick={() => (step === 0 ? onClose() : setStep(step - 1))}>{step === 0 ? "Cancelar" : "Voltar"}</Button>
            {step < 2 ? (
              <Button size="sm" onClick={() => setStep(step + 1)} disabled={!hasAnyLine}>
                {step === 0 ? (exchangeOn ? "Próximo" : "Próximo") : "Revisar"}
              </Button>
            ) : (
              <Button size="sm" onClick={handleConfirm} loading={submitting} disabled={!hasAnyLine || !payOk} iconLeft={<CheckCircle2 size={14} />}>
                Confirmar {exchangeOn && exchange.length > 0 ? "troca" : "devolução"}
              </Button>
            )}
          </ModalFooter>
        </div>
      }>
      <div className="space-y-4">
        <ol className="flex items-center gap-2">
          {STEPS.map((label, i) => {
            const reachable = i === 0 || hasAnyLine;
            return (
              <li key={label} className="flex flex-1 items-center gap-2">
                <button type="button" disabled={!reachable} onClick={() => setStep(i)}
                  className={cn("flex flex-1 items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                    step === i ? "border-amber-400 bg-amber-50" : i < step ? "border-emerald-300 bg-emerald-50" : "border-slate-200 hover:bg-slate-50")}>
                  <span className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                    step === i ? "bg-amber-500 text-white" : i < step ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-600")}>
                    {i < step ? <CheckCircle2 size={12} /> : i + 1}
                  </span>
                  <span className="text-xs font-semibold text-slate-800">{label}</span>
                </button>
              </li>
            );
          })}
        </ol>

        {step === 0 && (<div className="space-y-4">
        <Alert variant={isWithinDeadline ? "success" : "warning"}>
          Vendido há {daysSinceOrder} {daysSinceOrder === 1 ? "dia" : "dias"} —
          {" "}{isWithinDeadline ? `dentro do prazo de devolução (${deadline} dias)` : `fora do prazo de devolução (${deadline} dias). Você ainda pode confirmar por exceção.`}
        </Alert>

        {/* Como a venda foi paga */}
        <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 font-semibold text-slate-800">
              <UserRound size={13} />{customerId ? customerName || "Cliente" : "Sem cliente (venda balcão)"}
            </span>
            {orderTotal !== undefined && <span className="tabular-nums text-slate-600">Total da venda: <strong>{money(Number(orderTotal) || 0)}</strong></span>}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <CreditCard size={13} className="text-slate-500" />
            {payments.length === 0 && <span className="text-[11px] text-slate-500">Forma de pagamento não informada</span>}
            {payments.map((p, i) => (
              <span key={i} className="rounded-full bg-white px-2.5 py-0.5 text-[11px] font-medium text-slate-700 ring-1 ring-slate-200">
                {p.label}{p.amount !== null ? ` · ${money(p.amount)}` : ""}
              </span>
            ))}
          </div>
          {payHint && <p className="text-[11px] leading-relaxed text-slate-600">{payHint}</p>}
        </div>

        {/* Leitor de código de barras */}
        <div className="space-y-1">
          <Input id="return-scan-input" size="sm" value={scanCode} onChange={(e) => setScanCode(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleScan(scanCode); setScanCode(""); } }}
            placeholder="Bipe o código de barras (ou digite e Enter) para marcar o item" iconLeft={<ScanBarcode size={13} />} />
          {scanMsg && <p className={cn("text-[11px] font-medium", scanMsg.ok ? "text-emerald-700" : "text-rose-600")}>{scanMsg.text}</p>}
        </div>

        {/* 1. O que está voltando */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-slate-800">O que o cliente está devolvendo</h4>
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
            const isAvulso = !item.product_id;
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
                  {isAvulso ? (
                    <span className="flex-1 rounded-lg bg-slate-100 px-3 py-1.5 text-[11px] text-slate-600">Item avulso — não controla estoque, só devolve o valor</span>
                  ) : (
                  <div className={cn("flex min-w-[220px] flex-1 gap-1", !active && "pointer-events-none opacity-40")}>
                    <Button size="xs" className="flex-1" variant={restock ? "success" : "outline"} iconLeft={<PackageCheck size={12} />} onClick={() => setRestock(item.id, true)}>Volta ao estoque</Button>
                    <Button size="xs" className="flex-1" variant={!restock ? "danger" : "outline"} iconLeft={<PackageX size={12} />} onClick={() => setRestock(item.id, false)}>Descarte (defeito)</Button>
                  </div>
                  )}
                </div>
              </div>
            );
          })}
        </section>

        {/* 2. Motivo */}
        <section className="space-y-2">
          <h4 className="text-xs font-semibold text-slate-800">Motivo</h4>
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

        </div>)}

        {step === 1 && (<div className="space-y-4">
        {/* 3. Troca por outro produto */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-slate-800">Trocar por outro produto?</h4>
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

        </div>)}

        {step === 2 && (<div className="space-y-4">
        <div className="space-y-1.5 rounded-lg border border-slate-200 p-3">
          <h4 className="text-xs font-semibold text-slate-800">Resumo</h4>
          {returnableItems.filter((i) => (lines[i.id]?.quantity ?? 0) > 0).map((i) => (
            <div key={i.id} className="flex items-center justify-between gap-2 text-xs text-slate-700">
              <span className="min-w-0 truncate">{lines[i.id]!.quantity}x {i.product_name}
                <span className="ml-1 text-[11px] text-slate-500">{!i.product_id ? "(avulso)" : lines[i.id]!.restock ? "→ estoque" : "→ descarte"}</span>
              </span>
              <span className="tabular-nums">{money(lines[i.id]!.quantity * Number(i.unit_price || 0))}</span>
            </div>
          ))}
          {(reason || reasonNote.trim()) && <p className="text-[11px] text-slate-500">Motivo: {[reason, reasonNote.trim()].filter(Boolean).join(" — ")}</p>}
          {exchangeOn && exchange.length > 0 && (
            <div className="border-t border-slate-100 pt-1.5 text-xs text-slate-700">
              <p className="font-medium">Troca por: {exchange.map((l) => `${l.quantity}x ${l.product.name}`).join(", ")}</p>
              <p className="font-semibold">{difference > 0 ? `Cliente paga a diferença: ${money(difference)}` : difference < 0 ? `Sobra para o cliente: ${money(Math.abs(difference))}` : "Troca equivalente"}</p>
            </div>
          )}
        </div>
        {/* 4. Como devolver o valor / pagar a diferença */}
        {hasExchange && due > 0.009 ? (
          <ExchangePaymentForm due={due} hasCustomer={!!customerId} lines={payLines} onChange={setPayLines} />
        ) : hasExchange && difference === 0 ? (
          <Alert variant="success">Troca equivalente: o valor devolvido cobre exatamente os produtos novos. Nada a pagar nem a devolver.</Alert>
        ) : (
        <section className="space-y-2">
          <h4 className="text-xs font-semibold text-slate-800">Como devolver o valor</h4>
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
          {hasExchange && difference < 0 && (
            <Alert variant="info">Os produtos novos ({money(exchangeTotal)}) abatem o valor devolvido. Sobram {money(Math.abs(difference))} para o cliente.</Alert>
          )}
          {!customerId && <Alert variant="warning">Venda sem cliente identificado — o valor é devolvido em dinheiro na hora.</Alert>}
        </section>
        )}

        </div>)}

        {error && <Alert variant="error">{error}</Alert>}
      </div>
    </Modal>
  );
}
