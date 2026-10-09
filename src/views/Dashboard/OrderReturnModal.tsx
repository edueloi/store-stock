import { useState } from "react";
import { RotateCcw, CheckCircle2 } from "lucide-react";
import { cn } from "../../lib/utils";
import { Alert, Button, Input, Modal, ModalFooter, Textarea } from "../../components/ui";

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
    <Modal isOpen onClose={onClose} position="right" size="md" zIndex={610}
      title={<span className="inline-flex items-center gap-2"><RotateCcw size={15} className="text-amber-600" />Devolver / Trocar</span>}
      subtitle={`Pedido #${String(orderId).padStart(6, "0")}`}
      footer={
        <ModalFooter align="between">
          <div className="flex items-baseline gap-2">
            <span className="text-[11px] text-slate-500">Total a devolver</span>
            <span className="text-base font-semibold tabular-nums text-slate-900">R$ {totalCredit.toFixed(2)}</span>
          </div>
          <Button size="sm" onClick={handleConfirm} loading={submitting} disabled={!hasAnyLine} iconLeft={<CheckCircle2 size={14} />}>Confirmar Devolução</Button>
        </ModalFooter>
      }>
      <div className="space-y-3">
        <Alert variant={isWithinDeadline ? "success" : "warning"}>
          Vendido há {daysSinceOrder} {daysSinceOrder === 1 ? "dia" : "dias"} —
          {" "}{isWithinDeadline ? `dentro do prazo de devolução (${deadline} dias)` : `fora do prazo de devolução (${deadline} dias). Você ainda pode confirmar por exceção.`}
        </Alert>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="xs" className="flex-1" onClick={() => markAll(true)}>Marcar todos (volta ao estoque)</Button>
          <Button variant="outline" size="xs" className="flex-1" onClick={() => markAll(false)}>Marcar todos (descarte)</Button>
        </div>

        <div className="space-y-2">
          {returnableItems.length === 0 && (
            <p className="py-6 text-center text-xs text-slate-500">Todos os itens deste pedido já foram devolvidos.</p>
          )}
          {returnableItems.map((item) => {
            const available = item.quantity - (item.returned_quantity ?? 0);
            const line = lines[item.id];
            const qty = Number(line?.quantity) || 0;
            const restock = line?.restock ?? true;
            return (
              <div key={item.id} className="space-y-2 rounded-lg border border-slate-200 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-slate-800">{item.product_name}</p>
                    <p className="text-[11px] text-slate-500">
                      Vendido: {item.quantity} · Disponível p/ devolução: {available}
                      {(item.returned_quantity ?? 0) > 0 && <span className="ml-1 text-amber-600">({item.returned_quantity} já devolvido)</span>}
                    </p>
                  </div>
                  <span className="shrink-0 text-[11px] font-semibold tabular-nums text-slate-700">R$ {item.unit_price.toFixed(2)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Input aria-label={`Quantidade a devolver de ${item.product_name}`} type="number" min={0} max={available} step={1} size="sm" wrapperClassName="w-20"
                    value={line?.quantity ?? "0"}
                    onChange={(e) => setLine(item.id, { quantity: e.target.value })} />
                  <div className={cn("flex flex-1 gap-1", qty <= 0 && "pointer-events-none opacity-40")}>
                    <Button size="xs" className="flex-1" variant={restock ? "success" : "outline"} onClick={() => setLine(item.id, { restock: true })}>Volta ao estoque</Button>
                    <Button size="xs" className="flex-1" variant={!restock ? "danger" : "outline"} onClick={() => setLine(item.id, { restock: false })}>Descarte (defeito)</Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <Textarea label="Motivo (opcional)" rows={2} value={reason} onChange={(e) => setReason(e.target.value)}
          placeholder="Ex: cliente não gostou do produto, veio com defeito..." />

        {customerId ? (
          <Alert variant="info" className="border-violet-100 bg-violet-50 text-violet-700">
            O valor devolvido vira crédito de troca para <strong>{customerName}</strong>, resgatável numa venda nova no PDV.
          </Alert>
        ) : (
          <Alert variant="warning">Venda sem cliente identificado — o valor não vira crédito, é devolvido em dinheiro na hora.</Alert>
        )}

        {error && <Alert variant="error">{error}</Alert>}
      </div>
    </Modal>
  );
}
