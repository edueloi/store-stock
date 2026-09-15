import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, RotateCcw, AlertTriangle, CheckCircle2, Loader2, Gift } from "lucide-react";
import { cn } from "../../lib/utils";

interface ReturnableItem {
  id: number;
  product_name: string;
  quantity: number;
  unit_price: number;
  returned_quantity?: number;
}

interface OrderReturnModalProps {
  orderId: number;
  orderCreatedAt: string;
  customerId?: number | null;
  customerName?: string | null;
  items: ReturnableItem[];
  returnDeadlineDays?: number | null;
  onClose: () => void;
  onSuccess: (result: { credit: { id: number; amount: number } | null; creditAmount: number }) => void;
}

interface ReturnLineState {
  quantity: string;
  restock: boolean;
}

// Modal de devolução/troca — granularidade por item e quantidade parcial. Ao
// confirmar, chama POST /api/orders/:id/returns (backend já cuida de estoque,
// StockMovement, Finance de estorno e CustomerCredit — ver orders.controller.ts
// createOrderReturn). Este componente só monta o payload e mostra o resultado.
export default function OrderReturnModal({
  orderId, orderCreatedAt, customerId, customerName, items, returnDeadlineDays, onClose, onSuccess,
}: OrderReturnModalProps) {
  const token = () => localStorage.getItem("token");
  const [lines, setLines] = useState<Record<number, ReturnLineState>>({});
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const returnableItems = items.filter((i) => i.quantity - (i.returned_quantity ?? 0) > 0);

  const daysSinceOrder = Math.floor((Date.now() - new Date(orderCreatedAt).getTime()) / (1000 * 60 * 60 * 24));
  const deadline = returnDeadlineDays ?? 30;
  const isWithinDeadline = daysSinceOrder <= deadline;

  const setLine = (itemId: number, patch: Partial<ReturnLineState>) => {
    setLines((prev) => ({ ...prev, [itemId]: { quantity: "0", restock: true, ...prev[itemId], ...patch } }));
  };

  const markAll = (restock: boolean) => {
    const next: Record<number, ReturnLineState> = {};
    returnableItems.forEach((i) => {
      const available = i.quantity - (i.returned_quantity ?? 0);
      next[i.id] = { quantity: String(available), restock };
    });
    setLines(next);
  };

  const totalCredit = returnableItems.reduce((sum, item) => {
    const line = lines[item.id];
    const qty = Number(line?.quantity) || 0;
    return sum + qty * item.unit_price;
  }, 0);

  const hasAnyLine = Object.values(lines).some((l) => (Number(l.quantity) || 0) > 0);

  const handleConfirm = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const payloadItems = returnableItems
        .map((item) => {
          const line = lines[item.id];
          const qty = Number(line?.quantity) || 0;
          if (qty <= 0) return null;
          return { order_item_id: item.id, quantity: qty, restock: line?.restock ?? true };
        })
        .filter((l): l is { order_item_id: number; quantity: number; restock: boolean } => l !== null);

      if (payloadItems.length === 0) {
        setError("Informe a quantidade de ao menos um item para devolver");
        return;
      }

      const res = await fetch(`/api/orders/${orderId}/returns`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ items: payloadItems, reason: reason || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Falha ao registrar devolução");
        return;
      }
      onSuccess({ credit: data.credit, creditAmount: data.creditAmount });
    } catch {
      setError("Erro de conexão ao registrar devolução");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose} className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[600]" />
      <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 220 }}
        className="fixed inset-y-0 right-0 w-full max-w-md bg-white z-[610] shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-amber-100 rounded-xl flex items-center justify-center">
              <RotateCcw size={16} className="text-amber-600" />
            </div>
            <div>
              <h2 className="font-black text-slate-900 text-[14px]">Devolver / Trocar</h2>
              <p className="text-[11px] text-slate-500">Pedido #{String(orderId).padStart(6, "0")}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className={cn(
            "flex items-start gap-2.5 rounded-xl px-3 py-2.5 border text-[11px] font-semibold",
            isWithinDeadline ? "bg-emerald-50 border-emerald-100 text-emerald-700" : "bg-amber-50 border-amber-100 text-amber-700"
          )}>
            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
            <span>
              Vendido há {daysSinceOrder} {daysSinceOrder === 1 ? "dia" : "dias"} —
              {" "}{isWithinDeadline ? `dentro do prazo de devolução (${deadline} dias)` : `fora do prazo de devolução (${deadline} dias). Você ainda pode confirmar por exceção.`}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => markAll(true)}
              className="flex-1 h-8 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-600 text-[9px] font-black uppercase tracking-wide hover:bg-emerald-100 transition-all">
              Marcar todos (volta ao estoque)
            </button>
            <button onClick={() => markAll(false)}
              className="flex-1 h-8 rounded-lg bg-red-50 border border-red-100 text-red-600 text-[9px] font-black uppercase tracking-wide hover:bg-red-100 transition-all">
              Marcar todos (descarte)
            </button>
          </div>

          <div className="space-y-2">
            {returnableItems.length === 0 && (
              <p className="text-center text-xs text-slate-400 py-6">Todos os itens deste pedido já foram devolvidos.</p>
            )}
            {returnableItems.map((item) => {
              const available = item.quantity - (item.returned_quantity ?? 0);
              const line = lines[item.id];
              const qty = Number(line?.quantity) || 0;
              return (
                <div key={item.id} className="rounded-xl border border-slate-200 p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[12px] font-bold text-slate-800 truncate">{item.product_name}</p>
                      <p className="text-[10px] text-slate-400">
                        Vendido: {item.quantity} · Disponível p/ devolução: {available}
                        {(item.returned_quantity ?? 0) > 0 && <span className="ml-1 text-amber-600">({item.returned_quantity} já devolvido)</span>}
                      </p>
                    </div>
                    <span className="text-[11px] font-mono font-black text-slate-700 shrink-0">R$ {item.unit_price.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="number" min={0} max={available} step={1}
                      value={line?.quantity ?? "0"}
                      onChange={(e) => setLine(item.id, { quantity: e.target.value })}
                      className="w-20 h-8 px-2 rounded-lg border border-slate-200 text-[11px] font-mono focus:outline-none focus:border-amber-400" />
                    <div className={cn("flex bg-slate-100 border border-slate-200 rounded-lg p-0.5 gap-0.5 flex-1", qty <= 0 && "opacity-40 pointer-events-none")}>
                      <button onClick={() => setLine(item.id, { restock: true })}
                        className={cn("flex-1 h-7 rounded-md text-[9px] font-black uppercase tracking-wide transition-all", (line?.restock ?? true) ? "bg-emerald-600 text-white" : "text-slate-500")}>
                        Volta ao estoque
                      </button>
                      <button onClick={() => setLine(item.id, { restock: false })}
                        className={cn("flex-1 h-7 rounded-md text-[9px] font-black uppercase tracking-wide transition-all", !(line?.restock ?? true) ? "bg-red-600 text-white" : "text-slate-500")}>
                        Descarte (defeito)
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div>
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-wide block mb-1">Motivo (opcional)</label>
            <textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: cliente não gostou do produto, veio com defeito..."
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-medium outline-none resize-none focus:border-amber-400 transition-all" />
          </div>

          {customerId ? (
            <div className="flex items-start gap-2.5 rounded-xl px-3 py-2.5 bg-violet-50 border border-violet-100 text-[11px] text-violet-700">
              <Gift size={14} className="shrink-0 mt-0.5" />
              <span>O valor devolvido vira crédito de troca para <strong>{customerName}</strong>, resgatável numa venda nova no PDV.</span>
            </div>
          ) : (
            <div className="flex items-start gap-2.5 rounded-xl px-3 py-2.5 bg-slate-50 border border-slate-200 text-[11px] text-slate-600">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              <span>Venda sem cliente identificado — o valor não vira crédito, é devolvido em dinheiro na hora.</span>
            </div>
          )}

          {error && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl px-3 py-2.5 text-[11px] font-bold text-rose-600">{error}</div>
          )}
        </div>

        <div className="shrink-0 border-t border-slate-200 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total a devolver</span>
            <span className="text-lg font-black font-mono text-slate-900">R$ {totalCredit.toFixed(2)}</span>
          </div>
          <button onClick={handleConfirm} disabled={submitting || !hasAnyLine}
            className="w-full h-11 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-xl text-[12px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2">
            {submitting ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
            Confirmar Devolução
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
