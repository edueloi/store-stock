import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { Alert, Button, Input, ModalFooter } from "../ui";
import Combobox from "../ui/Combobox";
import Modal from "../ui/Modal";

const authHeader = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}` });
const fmtMoney = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const toNum = (v: string) => Number(String(v).replace(/\./g, "").replace(",", ".")) || 0;

interface ProductOpt { id: number; name: string; sku?: string | null; price: string | number; ncm?: string | null; is_active?: boolean }
interface Row { key: number; productId: string; name: string; ncm: string; quantity: string; unitPrice: string }

let rowKey = 0;
const newRow = (): Row => ({ key: ++rowKey, productId: "", name: "", ncm: "", quantity: "1", unitPrice: "" });

/**
 * NF-e avulsa: monta os itens direto na tela de Notas Fiscais (do catálogo ou item avulso com NCM), sem abrir Pedidos.
 * Ao continuar, o backend cria um pedido interno só como vínculo e devolve o id para abrir o modal normal de emissão
 * (destinatário, frete, natureza).
 */
export default function NfeAvulsaModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (orderId: number) => void }) {
  const [rows, setRows] = useState<Row[]>([newRow()]);
  const [products, setProducts] = useState<ProductOpt[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setRows([newRow()]); setError(""); setSaving(false);
    let alive = true;
    fetch("/api/products", { headers: authHeader() })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => { if (alive && Array.isArray(d)) setProducts(d); })
      .catch(() => {});
    return () => { alive = false; };
  }, [open]);

  const options = useMemo(
    () => products.filter((p) => p.is_active !== false).map((p) => ({ value: String(p.id), label: p.name, description: [p.sku, fmtMoney(Number(p.price))].filter(Boolean).join(" · ") })),
    [products],
  );

  const patch = (key: number, p: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...p } : r)));
  const pick = (key: number, id: string) => {
    const prod = products.find((p) => String(p.id) === id);
    patch(key, { productId: id, ...(prod ? { unitPrice: Number(prod.price).toFixed(2).replace(".", ","), name: "", ncm: "" } : {}) });
  };

  const total = rows.reduce((s, r) => s + Math.floor(toNum(r.quantity)) * toNum(r.unitPrice), 0);

  const submit = async () => {
    setError("");
    setSaving(true);
    try {
      const items = rows.map((r) => ({
        ...(r.productId ? { product_id: Number(r.productId) } : { name: r.name.trim(), ncm: r.ncm.replace(/\D/g, "") }),
        quantity: Math.floor(toNum(r.quantity)), unit_price: toNum(r.unitPrice),
      }));
      const res = await fetch("/api/nfe/avulsa", { method: "POST", headers: { ...authHeader(), "Content-Type": "application/json" }, body: JSON.stringify({ items }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setError(d?.error || "Não foi possível criar a NF-e."); return; }
      onCreated(d.order_id);
    } catch { setError("Sem conexão com o servidor."); }
    finally { setSaving(false); }
  };

  return (
    <Modal
      open={open}
      onClose={() => { if (!saving) onClose(); }}
      size="lg"
      title="Nova NF-e"
      subtitle="Monte os itens da nota. Na próxima etapa você informa o destinatário, o frete e a natureza da operação."
      footer={
        <ModalFooter>
          <span className="mr-auto text-sm font-semibold text-slate-700">Total: {fmtMoney(total)}</span>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button variant="primary" onClick={submit} loading={saving} disabled={total <= 0}>Continuar</Button>
        </ModalFooter>
      }
    >
      <div className="space-y-3">
        {rows.map((r, i) => (
          <div key={r.key} className="rounded-xl border border-slate-200 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-400">Item {i + 1}</span>
              {rows.length > 1 && (
                <button type="button" className="text-slate-400 hover:text-red-500" onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} title="Remover item"><Trash2 size={14} /></button>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-6">
              <div className="sm:col-span-6">
                <Combobox label="Produto do catálogo (ou deixe vazio para um item avulso)" options={options} value={r.productId} onChange={(v) => pick(r.key, v)} clearable placeholder="Buscar produto…" searchPlaceholder="Buscar pelo nome" />
              </div>
              {!r.productId && (
                <>
                  <div className="sm:col-span-4"><Input label="Descrição do item" value={r.name} onChange={(e) => patch(r.key, { name: e.target.value })} placeholder="Ex.: Vidro temperado 8 mm" /></div>
                  <div className="sm:col-span-2"><Input label="NCM (8 dígitos)" value={r.ncm} onChange={(e) => patch(r.key, { ncm: e.target.value.replace(/\D/g, "").slice(0, 8) })} placeholder="00000000" inputMode="numeric" /></div>
                </>
              )}
              <div className="sm:col-span-3"><Input label="Quantidade" value={r.quantity} onChange={(e) => patch(r.key, { quantity: e.target.value.replace(/\D/g, "") })} inputMode="numeric" /></div>
              <div className="sm:col-span-3"><Input label="Valor unitário (R$)" value={r.unitPrice} onChange={(e) => patch(r.key, { unitPrice: e.target.value.replace(/[^\d,.]/g, "") })} placeholder="0,00" inputMode="decimal" /></div>
            </div>
          </div>
        ))}
        <Button variant="outline" size="sm" iconLeft={<Plus size={13} />} onClick={() => setRows((rs) => [...rs, newRow()])}>Adicionar item</Button>
        <Alert variant="info">Esta nota não registra venda, não baixa estoque e não mexe no caixa. Se quiser que a venda controle o estoque, emita pela tela de Pedidos.</Alert>
        {error && <Alert variant="error">{error}</Alert>}
      </div>
    </Modal>
  );
}
