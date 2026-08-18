import { useState, useEffect, useMemo } from "react";
import ExcelJS from "exceljs";
import {
  FileCheck, Search, Download, RefreshCw, FileText, AlertTriangle,
  CheckCircle2, Loader2, Clock, XCircle, Ban, Archive, Calendar,
} from "lucide-react";
import PageHeader from "../../components/layout/PageHeader";
import { NfceInvoice, NfceStatus } from "../../types";
import { cn } from "../../lib/utils";
import Modal from "../../components/ui/Modal";
import Button from "../../components/ui/Button";
import { useToast } from "../../components/ui/Toast";

const PRAZO_CANCELAMENTO_MINUTOS = 30;

const STATUS_META: Record<NfceStatus, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  pending:    { label: "Aguardando",  color: "text-blue-600",    bg: "bg-blue-50",    icon: <Clock size={12} /> },
  processing: { label: "Processando", color: "text-blue-600",    bg: "bg-blue-50",    icon: <Loader2 size={12} className="animate-spin" /> },
  authorized: { label: "Autorizada",  color: "text-emerald-600", bg: "bg-emerald-50", icon: <CheckCircle2 size={12} /> },
  rejected:   { label: "Rejeitada",   color: "text-rose-600",    bg: "bg-rose-50",    icon: <XCircle size={12} /> },
  error:      { label: "Erro",        color: "text-rose-600",    bg: "bg-rose-50",    icon: <AlertTriangle size={12} /> },
  cancelled:  { label: "Cancelada",   color: "text-slate-500",   bg: "bg-slate-100",  icon: <XCircle size={12} /> },
};

async function exportNfceToExcel(invoices: NfceInvoice[]) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "BoxSys Store";
  wb.created = new Date();

  const ws = wb.addWorksheet("Notas Fiscais", {
    pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true },
  });

  ws.columns = [
    { header: "Número",     key: "number",   width: 12 },
    { header: "Série",      key: "series",   width: 8 },
    { header: "Pedido",     key: "order",    width: 12 },
    { header: "Cliente",    key: "customer", width: 28 },
    { header: "Chave de Acesso", key: "key", width: 46 },
    { header: "Protocolo",  key: "protocol", width: 18 },
    { header: "Status",     key: "status",   width: 14 },
    { header: "Valor (R$)", key: "value",    width: 14 },
    { header: "Emitida em", key: "date",     width: 18 },
  ];

  ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" } };

  invoices.forEach((inv) => {
    ws.addRow({
      number: inv.number,
      series: inv.series,
      order: inv.order_id,
      customer: inv.order?.customer_name || "Consumidor Final",
      key: inv.access_key || "—",
      protocol: inv.protocol || "—",
      status: STATUS_META[inv.status]?.label ?? inv.status,
      value: inv.order?.total_amount ?? 0,
      date: inv.authorized_at ? new Date(inv.authorized_at).toLocaleString("pt-BR") : "—",
    });
  });

  ws.getColumn("value").numFmt = '"R$" #,##0.00';

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `notas-fiscais-${new Date().toISOString().slice(0, 10)}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

// Baixa um arquivo autenticado (Bearer token) via fetch+blob — um <a href> direto
// não envia o header Authorization e o backend responde 401.
async function downloadAuthenticated(url: string, token: string | null, filename: string) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    let message = "Falha ao baixar arquivo";
    try {
      const data = await res.json();
      if (data?.error) message = data.error;
    } catch { /* resposta sem corpo JSON */ }
    throw new Error(message);
  }
  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(blobUrl);
}

export default function NfceInvoices() {
  const [invoices, setInvoices] = useState<NfceInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [retrying, setRetrying] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<NfceStatus | "all">("all");
  const [cancelTarget, setCancelTarget] = useState<NfceInvoice | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [batchLoading, setBatchLoading] = useState<"retry" | "xml" | "danfe" | null>(null);
  const notify = useToast();

  // Date filter — default: first → last day of current month
  const todayStr = () => new Date().toISOString().slice(0, 10);
  const firstOfMonthStr = (d = new Date()) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  const lastOfMonthStr = (d = new Date()) => {
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, "0")}-${String(last.getDate()).padStart(2, "0")}`;
  };
  const [dateFrom, setDateFrom] = useState(firstOfMonthStr());
  const [dateTo,   setDateTo]   = useState(lastOfMonthStr());

  const token = localStorage.getItem("token");

  const fetchInvoices = () => {
    setLoading(true);
    fetch("/api/nfce?pageSize=200", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => setInvoices(Array.isArray(data.invoices) ? data.invoices : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchInvoices(); }, []);

  const handleRetry = async (orderId: number) => {
    setRetrying(orderId);
    try {
      await fetch(`/api/nfce/${orderId}/retry`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      setTimeout(fetchInvoices, 1500);
    } finally {
      setRetrying(null);
    }
  };

  const handleCancel = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    setCancelError(null);
    try {
      const res = await fetch(`/api/nfce/${cancelTarget.order_id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason: cancelReason }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCancelError(data.error || "Falha ao cancelar a nota fiscal");
        return;
      }
      setCancelTarget(null);
      setCancelReason("");
      fetchInvoices();
    } finally {
      setCancelling(false);
    }
  };

  const handleDownloadDanfe = (inv: NfceInvoice) =>
    downloadAuthenticated(`/api/nfce/${inv.order_id}/danfe`, token, `danfe-${inv.access_key ?? inv.order_id}.pdf`)
      .catch((e) => notify.error(e instanceof Error ? e.message : "Não foi possível baixar o DANFE."));

  const handleDownloadXml = (inv: NfceInvoice) =>
    downloadAuthenticated(`/api/nfce/${inv.order_id}/xml`, token, `nfce-${inv.access_key ?? inv.order_id}.xml`)
      .catch((e) => notify.error(e instanceof Error ? e.message : "Não foi possível baixar o XML."));

  const filtered = useMemo(() => {
    return invoices.filter((inv) => {
      if (statusFilter !== "all" && inv.status !== statusFilter) return false;
      // Data local (evita o dia mudar por causa do offset UTC)
      const d = new Date(inv.created_at);
      const invDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (dateFrom && invDate < dateFrom) return false;
      if (dateTo   && invDate > dateTo)   return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const haystack = `${inv.number} ${inv.access_key ?? ""} ${inv.order?.customer_name ?? ""}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [invoices, statusFilter, searchTerm, dateFrom, dateTo]);

  const counts = useMemo(() => ({
    total: invoices.length,
    authorized: invoices.filter((i) => i.status === "authorized").length,
    pending: invoices.filter((i) => i.status === "pending" || i.status === "processing").length,
    error: invoices.filter((i) => i.status === "error" || i.status === "rejected").length,
  }), [invoices]);

  const toggleSelected = (orderId: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId); else next.add(orderId);
      return next;
    });
  };

  const toggleSelectAllFiltered = () => {
    setSelected((prev) => {
      const allSelected = filtered.length > 0 && filtered.every((inv) => prev.has(inv.order_id));
      if (allSelected) return new Set();
      return new Set(filtered.map((inv) => inv.order_id));
    });
  };

  const selectedInvoices = useMemo(
    () => filtered.filter((inv) => selected.has(inv.order_id)),
    [filtered, selected],
  );
  const selectedRetryable = selectedInvoices.filter((inv) => inv.status === "error" || inv.status === "rejected");
  const selectedAuthorized = selectedInvoices.filter((inv) => inv.status === "authorized");

  const handleRetryBatch = async () => {
    if (selectedRetryable.length === 0) return;
    setBatchLoading("retry");
    try {
      await fetch("/api/nfce/retry-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ order_ids: selectedRetryable.map((inv) => inv.order_id) }),
      });
      setTimeout(fetchInvoices, 2000);
    } finally {
      setBatchLoading(null);
    }
  };

  const handleDownloadXmlBatch = async () => {
    if (selectedAuthorized.length === 0) return;
    setBatchLoading("xml");
    try {
      const ids = selectedAuthorized.map((inv) => inv.order_id).join(",");
      await downloadAuthenticated(`/api/nfce/xml-batch?ids=${ids}`, token, `nfce-xml-${new Date().toISOString().slice(0, 10)}.zip`);
    } catch (e) {
      notify.error(e instanceof Error ? e.message : "Não foi possível baixar os XMLs.");
    } finally {
      setBatchLoading(null);
    }
  };

  const handleDownloadDanfeBatch = async () => {
    if (selectedAuthorized.length === 0) return;
    setBatchLoading("danfe");
    try {
      const ids = selectedAuthorized.map((inv) => inv.order_id).join(",");
      await downloadAuthenticated(`/api/nfce/danfe-batch?ids=${ids}`, token, `danfe-${new Date().toISOString().slice(0, 10)}.zip`);
    } catch (e) {
      notify.error(e instanceof Error ? e.message : "Não foi possível baixar os DANFEs.");
    } finally {
      setBatchLoading(null);
    }
  };

  const minutesSinceAuthorized = (inv: NfceInvoice) =>
    inv.authorized_at ? (Date.now() - new Date(inv.authorized_at).getTime()) / 60000 : Infinity;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notas Fiscais"
        subtitle="NFC-e emitidas junto à SEFAZ-SP · exporte o relatório para o contador"
        action={
          <button
            onClick={async () => { setExporting(true); try { await exportNfceToExcel(filtered); } finally { setExporting(false); } }}
            disabled={exporting || filtered.length === 0}
            className="h-9 bg-white border border-slate-200 px-4 rounded-xl flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest hover:bg-slate-50 transition-all text-slate-600 shadow-sm disabled:opacity-40"
          >
            {exporting ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />} Exportar
          </button>
        }
      />

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-0 border-b border-slate-100 divide-x divide-slate-100">
          {[
            { label: "Total",       value: counts.total,      color: "text-slate-900" },
            { label: "Autorizadas", value: counts.authorized, color: "text-emerald-500" },
            { label: "Em processo", value: counts.pending,    color: "text-blue-500" },
            { label: "Com erro",    value: counts.error,      color: "text-rose-500" },
          ].map((k) => (
            <div key={k.label} className="flex-1 px-5 py-4 flex flex-col gap-0.5">
              <span className={cn("text-2xl font-black tracking-tight font-mono leading-none", k.color)}>{k.value}</span>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{k.label}</span>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 px-4 py-3 flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
            <input
              type="text"
              placeholder="Buscar por número, chave, cliente..."
              className="w-full pl-8 pr-3 h-9 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-400 text-[11px] font-medium placeholder:text-slate-300 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as NfceStatus | "all")}
            className="h-9 px-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-bold outline-none focus:border-blue-400 transition-all"
          >
            <option value="all">Todos os status</option>
            {Object.entries(STATUS_META).map(([key, meta]) => (
              <option key={key} value={key}>{meta.label}</option>
            ))}
          </select>

          {/* Date range */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 h-9 shrink-0">
            <Calendar size={12} className="text-slate-400 shrink-0" />
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
              className="text-[11px] font-medium text-slate-700 outline-none bg-transparent cursor-pointer w-[105px]" />
            <span className="text-slate-300 font-bold text-[10px]">—</span>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
              className="text-[11px] font-medium text-slate-700 outline-none bg-transparent cursor-pointer w-[105px]" />
          </div>

          {/* Quick presets */}
          <div className="flex items-center gap-1 shrink-0 bg-slate-50 border border-slate-200 rounded-xl p-1">
            {[
              { label: "Hoje", from: todayStr(),        to: todayStr() },
              { label: "7d",   from: (() => { const d = new Date(); d.setDate(d.getDate() - 6); return d.toISOString().slice(0, 10); })(), to: todayStr() },
              { label: "Mês",  from: firstOfMonthStr(), to: lastOfMonthStr() },
              { label: "Tudo", from: "",                to: "" },
            ].map((p) => {
              const active = dateFrom === p.from && dateTo === p.to;
              return (
                <button key={p.label} onClick={() => { setDateFrom(p.from); setDateTo(p.to); }}
                  className={cn(
                    "h-7 px-3 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all",
                    active ? "bg-slate-900 text-white shadow-sm" : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>

        {selected.size > 0 && (
          <div className="flex items-center gap-2 px-4 py-2.5 flex-wrap bg-blue-50/60 border-b border-blue-100">
            <span className="text-[10px] font-black text-blue-700 uppercase tracking-widest mr-1">
              {selected.size} selecionada{selected.size > 1 ? "s" : ""}
            </span>
            <button
              onClick={handleRetryBatch}
              disabled={batchLoading !== null || selectedRetryable.length === 0}
              className="h-8 px-3 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-all"
            >
              {batchLoading === "retry" ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              Reemitir selecionadas ({selectedRetryable.length})
            </button>
            <button
              onClick={handleDownloadXmlBatch}
              disabled={batchLoading !== null || selectedAuthorized.length === 0}
              className="h-8 px-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-all disabled:opacity-40"
            >
              {batchLoading === "xml" ? <Loader2 size={12} className="animate-spin" /> : <Archive size={12} />}
              Baixar XMLs (.zip)
            </button>
            <button
              onClick={handleDownloadDanfeBatch}
              disabled={batchLoading !== null || selectedAuthorized.length === 0}
              className="h-8 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-all disabled:opacity-40"
            >
              {batchLoading === "danfe" ? <Loader2 size={12} className="animate-spin" /> : <Archive size={12} />}
              Baixar DANFEs (.zip)
            </button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-t border-slate-100 bg-slate-50/60">
                <th className="px-4 py-2.5 w-8">
                  <input
                    type="checkbox"
                    checked={filtered.length > 0 && filtered.every((inv) => selected.has(inv.order_id))}
                    onChange={toggleSelectAllFiltered}
                    className="rounded border-slate-300"
                  />
                </th>
                {["Nº", "Série", "Pedido", "Cliente", "Chave de Acesso", "Status", "Emitida em", ""].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-slate-400 text-xs">Carregando...</td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-slate-400 text-xs">Nenhuma nota fiscal encontrada</td></tr>
              )}
              {!loading && filtered.map((inv) => {
                const meta = STATUS_META[inv.status];
                return (
                  <tr key={inv.id} className="border-t border-slate-100 hover:bg-slate-50/60 transition-colors">
                    <td className="px-4 py-2.5">
                      <input
                        type="checkbox"
                        checked={selected.has(inv.order_id)}
                        onChange={() => toggleSelected(inv.order_id)}
                        className="rounded border-slate-300"
                      />
                    </td>
                    <td className="px-4 py-2.5 text-xs font-mono font-bold text-slate-700">{inv.number}</td>
                    <td className="px-4 py-2.5 text-xs font-mono text-slate-500">{inv.series}</td>
                    <td className="px-4 py-2.5 text-xs font-mono text-blue-600">#{String(inv.order_id).padStart(6, "0")}</td>
                    <td className="px-4 py-2.5 text-xs font-bold text-slate-700">{inv.order?.customer_name || "Consumidor Final"}</td>
                    <td className="px-4 py-2.5 text-[10px] font-mono text-slate-400 truncate max-w-[220px]">{inv.access_key || "—"}</td>
                    <td className="px-4 py-2.5">
                      <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide", meta.bg, meta.color)}>
                        {meta.icon} {meta.label}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-500">
                      {inv.authorized_at ? new Date(inv.authorized_at).toLocaleString("pt-BR") : "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2 justify-end">
                        {(inv.status === "error" || inv.status === "rejected") && (
                          <button
                            onClick={() => handleRetry(inv.order_id)}
                            disabled={retrying === inv.order_id}
                            className="h-8 px-3 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-all"
                          >
                            {retrying === inv.order_id ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Reemitir
                          </button>
                        )}
                        {inv.status === "authorized" && (
                          <>
                            <button onClick={() => handleDownloadDanfe(inv)}
                              className="h-8 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-all">
                              <FileText size={12} /> DANFE
                            </button>
                            <button onClick={() => handleDownloadXml(inv)}
                              className="h-8 px-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-all">
                              <FileCheck size={12} /> XML
                            </button>
                            {minutesSinceAuthorized(inv) <= PRAZO_CANCELAMENTO_MINUTOS && (
                              <button
                                onClick={() => { setCancelTarget(inv); setCancelReason(""); setCancelError(null); }}
                                className="h-8 px-3 bg-white border border-rose-200 hover:bg-rose-50 text-rose-600 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-all"
                              >
                                <Ban size={12} /> Cancelar
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={!!cancelTarget}
        onClose={() => { if (!cancelling) { setCancelTarget(null); setCancelError(null); } }}
        title="Cancelar NFC-e"
        subtitle={cancelTarget ? `Nota nº ${cancelTarget.number} · Prazo de ${PRAZO_CANCELAMENTO_MINUTOS} min após autorização` : undefined}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCancelTarget(null)} disabled={cancelling}>Voltar</Button>
            <Button
              variant="danger"
              onClick={handleCancel}
              disabled={cancelling || cancelReason.trim().length < 15}
              loading={cancelling}
            >
              Confirmar Cancelamento
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-xs text-slate-500">
            Esta ação envia o evento de cancelamento à SEFAZ-SP. Não é possível desfazer.
            A justificativa precisa ter no mínimo 15 caracteres.
          </p>
          <textarea
            rows={3}
            placeholder="Ex: Venda cancelada a pedido do cliente"
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-medium outline-none resize-none focus:border-rose-400 focus:ring-2 focus:ring-rose-500/10 transition-all"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
          />
          <p className="text-[10px] text-slate-400">{cancelReason.trim().length}/15 caracteres mínimos</p>
          {cancelError && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl px-3 py-2.5 text-[11px] font-bold text-rose-600">
              {cancelError}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
