import { useCallback, useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Download, FileCode, Loader2, RefreshCw, Trash2, XCircle } from "lucide-react";

import { Alert, Button, Modal, ModalFooter, Textarea } from "../ui";
import { useToast } from "../ui/Toast";
import { downloadAuthenticatedFile } from "../../lib/downloadFile";
import { onRealtime } from "../../lib/realtime";
import NfeEmitModal from "./NfeEmitModal";

interface NfeRow {
  id: number; order_id: number; status: string; environment: string; series: number; number: number;
  access_key: string | null; protocol: string | null; authorized_at: string | null; rejection_code: string | null; rejection_reason: string | null;
  nature: string | null; recipient: { name?: string; document?: string } | null; created_at: string;
  order?: { customer_name: string | null; total_amount: string | number; order_label?: string | null } | null;
}

const authHeader = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}` });
const fmtMoney = (v: string | number) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDoc = (raw?: string) => {
  const d = (raw ?? "").replace(/\D/g, "");
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  return raw ?? "";
};

function StatusChip({ row }: { row: NfeRow }) {
  const base = "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-semibold whitespace-nowrap";
  if (row.status === "authorized") return <span className={`${base} border-emerald-100 bg-emerald-50 text-emerald-600`}><CheckCircle2 size={10} /> Autorizada</span>;
  if (row.status === "cancelled") return <span className={`${base} border-slate-200 bg-slate-100 text-slate-500`}><XCircle size={10} /> Cancelada</span>;
  if (row.status === "pending" || row.status === "processing") return <span className={`${base} border-blue-100 bg-blue-50 text-blue-600`}><Loader2 size={10} className="animate-spin" /> Processando</span>;
  return <span className={`${base} border-red-100 bg-red-50 text-red-600`}><AlertCircle size={10} /> Rejeitada</span>;
}

/** Aba "NF-e (Mercadorias)" de Notas Fiscais: lista, DANFE/XML, reemitir, cancelar e excluir. */
export default function NfeInvoicesTab() {
  const toast = useToast();
  const [rows, setRows] = useState<NfeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [emitOrderId, setEmitOrderId] = useState<number | null>(null);
  const [cancelRow, setCancelRow] = useState<NfeRow | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/nfe?pageSize=200", { headers: authHeader() });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error || "Não foi possível carregar as NF-e.");
      setRows(Array.isArray(d.invoices) ? d.invoices : []);
      setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "Erro ao carregar."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => onRealtime("nfe:changed", () => { void load(); }), [load]);

  const download = (url: string, name: string) => downloadAuthenticatedFile(url, name).catch((e) => toast.error(e instanceof Error ? e.message : "Não foi possível baixar."));

  const doCancel = async () => {
    if (!cancelRow) return;
    setCancelling(true);
    try {
      const r = await fetch(`/api/nfe/${cancelRow.order_id}/cancel`, { method: "POST", headers: { ...authHeader(), "Content-Type": "application/json" }, body: JSON.stringify({ reason: cancelReason }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { toast.error(d?.error || "Não foi possível cancelar a NF-e."); return; }
      toast.success("NF-e cancelada.");
      setCancelRow(null); setCancelReason("");
      void load();
    } finally { setCancelling(false); }
  };

  const remove = async (row: NfeRow) => {
    if (!window.confirm(`Excluir a NF-e nº ${row.number} (pedido #${row.order_id})? Só notas não autorizadas podem ser excluídas.`)) return;
    const r = await fetch(`/api/nfe/${row.order_id}`, { method: "DELETE", headers: authHeader() });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) toast.error(d?.error || "Não foi possível excluir."); else void load();
  };

  return (
    <div className="space-y-3">
      <Alert variant="info">
        NF-e (modelo 55) é a nota de <b>mercadoria com destinatário identificado</b>. Para emitir, abra <b>Pedidos</b> e use o botão <b>NF-e</b> do pedido. A NFC-e continua sendo a nota de balcão (consumidor final).
      </Alert>
      {error && <Alert variant="error">{error}</Alert>}

      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => { setLoading(true); void load(); }} iconLeft={<RefreshCw size={13} />}>Atualizar</Button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[860px] text-left text-xs">
          <thead className="bg-slate-50 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-3 py-2.5">Nº / Série</th><th className="px-3 py-2.5">Pedido</th><th className="px-3 py-2.5">Destinatário</th>
              <th className="px-3 py-2.5">Status</th><th className="px-3 py-2.5 text-right">Valor</th><th className="px-3 py-2.5">Emitida em</th><th className="px-3 py-2.5 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && <tr><td colSpan={7} className="px-3 py-8 text-center text-slate-400"><Loader2 size={14} className="mr-1 inline animate-spin" /> Carregando…</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={7} className="px-3 py-10 text-center text-slate-400">Nenhuma NF-e emitida ainda.</td></tr>}
            {rows.map((row) => (
              <tr key={row.id} className="align-top">
                <td className="px-3 py-3 font-mono">{row.number} <span className="text-slate-400">/ {row.series}</span>{row.environment !== "producao" && <span className="ml-1.5 rounded bg-amber-50 px-1.5 py-0.5 text-[9px] font-semibold text-amber-600">Homologação</span>}</td>
                <td className="px-3 py-3 font-mono text-blue-600">#{String(row.order_id).padStart(6, "0")}</td>
                <td className="px-3 py-3"><p className="max-w-[240px] truncate font-medium text-slate-800">{row.recipient?.name || row.order?.customer_name || "—"}</p><p className="font-mono text-[10px] text-slate-400">{fmtDoc(row.recipient?.document)}</p></td>
                <td className="px-3 py-3">
                  <StatusChip row={row} />
                  {(row.status === "rejected" || row.status === "error") && row.rejection_reason && (
                    <p className="mt-1 max-w-[260px] text-[10px] leading-snug text-red-600" title={row.rejection_reason}>{row.rejection_code && row.rejection_code !== "sem-retorno" ? `${row.rejection_code}: ` : ""}{row.rejection_reason}</p>
                  )}
                </td>
                <td className="px-3 py-3 text-right font-mono">{row.order ? fmtMoney(row.order.total_amount) : "—"}</td>
                <td className="px-3 py-3 text-slate-500">{row.authorized_at ? new Date(row.authorized_at).toLocaleString("pt-BR") : "—"}</td>
                <td className="px-3 py-3">
                  <div className="flex flex-wrap justify-end gap-1.5">
                    {(row.status === "authorized" || row.status === "cancelled") && (
                      <>
                        <Button variant="primary" size="xs" iconLeft={<Download size={11} />} onClick={() => download(`/api/nfe/${row.order_id}/danfe`, `danfe-${row.access_key ?? row.order_id}.pdf`)}>DANFE</Button>
                        <Button variant="outline" size="xs" iconLeft={<FileCode size={11} />} onClick={() => download(`/api/nfe/${row.order_id}/xml`, `nfe-${row.access_key ?? row.order_id}.xml`)}>XML</Button>
                      </>
                    )}
                    {(row.status === "rejected" || row.status === "error") && (
                      <Button variant="danger" size="xs" iconLeft={<RefreshCw size={11} />} onClick={() => setEmitOrderId(row.order_id)}>Reemitir</Button>
                    )}
                    {row.status === "authorized" && <Button variant="outline" size="xs" onClick={() => { setCancelRow(row); setCancelReason(""); }}>Cancelar</Button>}
                    {row.status !== "authorized" && row.status !== "processing" && row.status !== "pending" && (
                      <Button variant="outline" size="xs" iconLeft={<Trash2 size={11} />} onClick={() => remove(row)}>Excluir</Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <NfeEmitModal orderId={emitOrderId} onClose={() => setEmitOrderId(null)} onDone={() => void load()} />

      <Modal
        open={!!cancelRow}
        onClose={() => { if (!cancelling) setCancelRow(null); }}
        size="sm"
        title="Cancelar NF-e"
        subtitle={cancelRow ? `Nota nº ${cancelRow.number} · pedido #${cancelRow.order_id}` : undefined}
        footer={
          <ModalFooter>
            <Button variant="outline" onClick={() => setCancelRow(null)} disabled={cancelling}>Voltar</Button>
            <Button variant="danger" onClick={doCancel} loading={cancelling} disabled={cancelReason.trim().length < 15}>Cancelar a NF-e</Button>
          </ModalFooter>
        }
      >
        <Textarea label="Justificativa (mínimo 15 caracteres)" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} rows={3} />
        <p className="mt-2 text-[11px] text-slate-500">O cancelamento só é aceito pela SEFAZ até 24 horas depois da autorização.</p>
      </Modal>
    </div>
  );
}
