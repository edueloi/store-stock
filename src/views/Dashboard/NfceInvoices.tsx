import { useState, useEffect, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import ExcelJS from "exceljs";
import {
  FileCheck, Search, Download, RefreshCw, FileText, AlertTriangle,
  CheckCircle2, Loader2, Clock, XCircle, Ban, Archive, Calendar, Trash2, Plus,
  MessageCircle,
  Mail,
  Info,
} from "lucide-react";
import PageHeader from "../../components/layout/PageHeader";
import { NfceInvoice, NfceStatus, NfseInvoice, NfseStatus } from "../../types";
import { cn } from "../../lib/utils";
import { Modal, Button, IconButton, Input, Textarea, Select, Tabs, FilterLineSearch, FilterLineSegmented } from "../../components/ui";
import { useToast } from "../../components/ui/Toast";
import { onRealtime } from "../../lib/realtime";
import FiscalCodeLookup from "../../components/fiscal/FiscalCodeLookup";

const PRAZO_CANCELAMENTO_MINUTOS = 30;

interface CustomerOption { id: number; name: string; phone?: string; document?: string }

function maskPhone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 10) return d.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3").replace(/-$/, "");
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3").replace(/-$/, "");
}
function maskDoc(v: string) {
  const d = v.replace(/\D/g, "");
  if (d.length <= 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, "$1.$2.$3-$4").replace(/-$/, "").replace(/\.{1,}$/, "");
  return d.slice(0, 14).replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2})/, "$1.$2.$3/$4-$5").replace(/-$/, "").replace(/\/$/, "");
}
// Digita como centavos (ex.: "150" -> "1,50", "15000" -> "150,00") — mesmo padrão
// usado no fechamento de caixa, evita erro de digitar vírgula/ponto errado.
function maskCurrency(v: string) {
  const d = v.replace(/\D/g, "");
  if (!d) return "";
  const cents = parseInt(d, 10);
  return (cents / 100).toFixed(2).replace(".", ",");
}

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

function buildPresets(todayStr: () => string, firstOfMonthStr: () => string, lastOfMonthStr: () => string) {
  return [
    { label: "Hoje", from: todayStr(), to: todayStr() },
    { label: "7d", from: (() => { const d = new Date(); d.setDate(d.getDate() - 6); return d.toISOString().slice(0, 10); })(), to: todayStr() },
    { label: "Mês", from: firstOfMonthStr(), to: lastOfMonthStr() },
    { label: "Tudo", from: "", to: "" },
  ];
}

function NfceTabContent() {
  const navigate = useNavigate();
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
  const [deleteTarget, setDeleteTarget] = useState<NfceInvoice | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [productionTarget, setProductionTarget] = useState<NfceInvoice | null>(null);
  const [emittingProduction, setEmittingProduction] = useState(false);
  const [productionError, setProductionError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [batchLoading, setBatchLoading] = useState<"retry" | "xml" | "danfe" | null>(null);
  const [whatsappConnected, setWhatsappConnected] = useState(false);
  const [sendingWhatsapp, setSendingWhatsapp] = useState<number | null>(null);
  const [whatsappNumberTarget, setWhatsappNumberTarget] = useState<NfceInvoice | null>(null);
  const [whatsappNumberInput, setWhatsappNumberInput] = useState("");
  const [errorDetailTarget, setErrorDetailTarget] = useState<NfceInvoice | null>(null);
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
  useEffect(() => onRealtime("nfce:changed", () => { fetchInvoices(); }), []);

  // Botão "Enviar por WhatsApp" só aparece com o bot realmente conectado —
  // sem isso o envio falharia silenciosamente lá no backend.
  useEffect(() => {
    fetch("/api/whatsapp/connection-status", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => setWhatsappConnected(Boolean(d?.connected)))
      .catch(() => {});
  }, []);

  const handleSendWhatsapp = async (inv: NfceInvoice, numberOverride?: string) => {
    setSendingWhatsapp(inv.order_id);
    try {
      const res = await fetch(`/api/nfce/${inv.order_id}/send-whatsapp`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(numberOverride ? { number: numberOverride } : {}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // Sem telefone cadastrado no pedido — em vez de só bloquear, oferece
        // digitar o número na hora (pedido do lojista: não travar o envio).
        if (res.status === 422 && !numberOverride) {
          setWhatsappNumberTarget(inv);
          setWhatsappNumberInput("");
          return;
        }
        notify.error(data.error || "Falha ao enviar pelo WhatsApp.");
        return;
      }
      notify.success("NFC-e enviada pelo WhatsApp!");
      setWhatsappNumberTarget(null);
    } catch {
      notify.error("Erro de conexão ao enviar pelo WhatsApp.");
    } finally {
      setSendingWhatsapp(null);
    }
  };

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

  const handleEmitProduction = async () => {
    if (!productionTarget) return;
    setEmittingProduction(true);
    setProductionError(null);
    try {
      const res = await fetch(`/api/nfce/${productionTarget.order_id}/emit-production`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setProductionError(data.error || "Falha ao emitir NFC-e de produção");
        return;
      }
      setProductionTarget(null);
      fetchInvoices();
      notify.success("Emissão em Produção iniciada!");
    } catch {
      setProductionError("Erro de conexão ao emitir NFC-e de produção");
    } finally {
      setEmittingProduction(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/nfce/${deleteTarget.order_id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        setDeleteError(data.error || "Falha ao excluir a nota fiscal");
        return;
      }
      setDeleteTarget(null);
      fetchInvoices();
    } finally {
      setDeleting(false);
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
    amount: invoices.filter((i) => i.status === "authorized").reduce((sum, i) => sum + Number(i.order?.total_amount || 0), 0),
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <Button variant="primary" size="md" onClick={() => navigate("/admin/pdv")} title="A NFC-e avulsa é emitida a partir de uma venda no PDV — use o botão 'Item Avulso' no carrinho para vender algo fora do catálogo." className="w-full sm:w-auto">
          <Plus size={13} /> Nova Venda (PDV)
        </Button>
        <Button variant="outline" size="md" onClick={async () => { setExporting(true); try { await exportNfceToExcel(filtered); } finally { setExporting(false); } }} disabled={exporting || filtered.length === 0} className="w-full sm:w-auto">
          {exporting ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />} Exportar
        </Button>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 border-b border-slate-100 divide-x divide-y sm:divide-y-0 lg:divide-y-0 divide-slate-100">
          {[
            { label: "Total",       value: counts.total,      color: "text-slate-900" },
            { label: "Autorizadas", value: counts.authorized, color: "text-emerald-500" },
            { label: "Em processo", value: counts.pending,    color: "text-blue-500" },
            { label: "Com erro",    value: counts.error,      color: "text-rose-500" },
            { label: "Valor emitido", value: counts.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), color: "text-slate-900" },
          ].map((k) => (
            <div key={k.label} className="px-4 sm:px-5 py-3 sm:py-4 flex flex-col gap-0.5">
              <span className={cn("text-xl sm:text-2xl font-semibold font-mono leading-none", k.color)}>{k.value}</span>
              <span className="text-[10px] font-semibold text-slate-400">{k.label}</span>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 px-3 py-3 sm:px-4">
          <FilterLineSearch aria-label="Buscar por número, chave, cliente" placeholder="Buscar por número, chave, cliente..." value={searchTerm} onChange={setSearchTerm} />
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as NfceStatus | "all")} wrapperClassName="min-w-[180px] flex-1">
            <option value="all">Todos os status</option>
            {Object.entries(STATUS_META).map(([key, meta]) => (
              <option key={key} value={key}>{meta.label}</option>
            ))}
          </Select>

          {/* Date range */}
          <div className="flex min-w-[280px] flex-1 items-center gap-2">
            <Input type="date" aria-label="Data inicial" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} iconLeft={<Calendar size={13} />} wrapperClassName="flex-1" />
            <span className="text-[11px] text-slate-400">até</span>
            <Input type="date" aria-label="Data final" value={dateTo} onChange={(e) => setDateTo(e.target.value)} wrapperClassName="flex-1" />
          </div>

          {/* Quick presets */}
          <FilterLineSegmented<string>
            options={buildPresets(todayStr, firstOfMonthStr, lastOfMonthStr).map((p) => ({ value: p.label, label: p.label }))}
            value={buildPresets(todayStr, firstOfMonthStr, lastOfMonthStr).find((p) => dateFrom === p.from && dateTo === p.to)?.label ?? ""}
            onChange={(label) => { const p = buildPresets(todayStr, firstOfMonthStr, lastOfMonthStr).find((x) => x.label === label); if (p) { setDateFrom(p.from); setDateTo(p.to); } }}
          />
        </div>

        {selected.size > 0 && (
          <div className="flex items-center gap-2 px-4 py-2.5 flex-wrap bg-blue-50/60 border-b border-blue-100">
            <span className="text-[11px] font-semibold text-blue-700 mr-1">
              {selected.size} selecionada{selected.size > 1 ? "s" : ""}
            </span>
            <Button variant="danger" size="sm" onClick={handleRetryBatch} disabled={batchLoading !== null || selectedRetryable.length === 0}>
              {batchLoading === "retry" ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              Reemitir selecionadas ({selectedRetryable.length})
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownloadXmlBatch} disabled={batchLoading !== null || selectedAuthorized.length === 0}>
              {batchLoading === "xml" ? <Loader2 size={12} className="animate-spin" /> : <Archive size={12} />}
              Baixar XMLs (.zip)
            </Button>
            <Button variant="primary" size="sm" onClick={handleDownloadDanfeBatch} disabled={batchLoading !== null || selectedAuthorized.length === 0}>
              {batchLoading === "danfe" ? <Loader2 size={12} className="animate-spin" /> : <Archive size={12} />}
              Baixar DANFEs (.zip)
            </Button>
          </div>
        )}

        <div className="hidden xl:block max-h-[calc(100vh-390px)] overflow-auto overscroll-contain">
          <table className="w-full min-w-[1480px] text-left border-collapse table-fixed">
            <colgroup>
              <col className="w-8" />
              <col className="w-14" />
              <col className="w-12" />
              <col className="w-24" />
              <col className="w-44" />
              <col className="w-36" />
              <col className="w-28" />
              <col className="w-36" />
              <col className="w-[38rem]" />
            </colgroup>
            <thead>
              <tr className="sticky top-0 z-20 border-t border-slate-100 bg-slate-50 shadow-sm">
                <th className="px-4 py-2.5 w-8">
                  <input
                    type="checkbox"
                    checked={filtered.length > 0 && filtered.every((inv) => selected.has(inv.order_id))}
                    onChange={toggleSelectAllFiltered}
                    className="rounded border-slate-300"
                  />
                </th>
                {["Nº", "Série", "Pedido", "Cliente", "Status", "Valor", "Emitida em", ""].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-[10px] font-semibold text-slate-400 whitespace-nowrap">{h}</th>
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
                    <td className="px-4 py-2.5 text-xs font-mono font-semibold text-slate-700">{inv.number}</td>
                    <td className="px-4 py-2.5 text-xs font-mono text-slate-500">{inv.series}</td>
                    <td className="px-4 py-2.5 text-xs font-mono text-blue-600 truncate" title={`#${String(inv.order_id).padStart(6, "0")}`}>
                      #{String(inv.order_id).padStart(6, "0")}
                    </td>
                    <td className="px-4 py-2.5 text-xs font-semibold text-slate-700 truncate" title={inv.order?.customer_name || "Consumidor Final"}>
                      {inv.order?.customer_name || "Consumidor Final"}
                    </td>
                    <td className="px-4 py-2.5 whitespace-normal">
                      <span
                        title={(inv.status === "error" || inv.status === "rejected") ? (inv.rejection_reason ?? undefined) : undefined}
                        className={cn(
                          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap",
                          meta.bg, meta.color,
                          (inv.status === "error" || inv.status === "rejected") && inv.rejection_reason && "cursor-help",
                        )}
                      >
                        {meta.icon} {meta.label}
                      </span>
                      {(inv.status === "error" || inv.status === "rejected") && inv.rejection_reason && (
                        <button
                          onClick={() => setErrorDetailTarget(inv)}
                          className="flex items-center gap-1 text-[11px] text-rose-500 hover:text-rose-700 font-medium mt-1 max-w-full underline decoration-dotted"
                        >
                          <span className="truncate">{inv.rejection_reason}</span>
                          <Info size={11} className="shrink-0" />
                        </button>
                      )}
                      {inv.environment === "homologacao" && (
                        <span className="ml-1.5 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-600 border border-amber-200" title="Nota de teste — sem valor fiscal">
                          Homologação
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs font-mono font-semibold text-slate-700 whitespace-nowrap">
                      {Number(inv.order?.total_amount || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-500 whitespace-nowrap">
                      {inv.authorized_at ? new Date(inv.authorized_at).toLocaleString("pt-BR") : "—"}
                    </td>
                    <td className="px-4 py-2.5 pr-5">
                      <div className="flex items-center gap-2 justify-end flex-nowrap whitespace-nowrap shrink-0">
                        {(inv.status === "error" || inv.status === "rejected") && (
                          <>
                            <Button variant="danger" size="sm" onClick={() => handleRetry(inv.order_id)} disabled={retrying === inv.order_id}>
                              {retrying === inv.order_id ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Reemitir
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => { setDeleteTarget(inv); setDeleteError(null); }}>
                              <Trash2 size={12} /> Excluir
                            </Button>
                          </>
                        )}
                        {inv.status === "authorized" && inv.environment === "homologacao" && (
                          <Button variant="primary" size="sm" onClick={() => { setProductionTarget(inv); setProductionError(null); }} title="Essa nota é só teste (sem valor fiscal) — emitir uma nota nova, de produção, pro mesmo pedido" className="bg-amber-500 hover:bg-amber-600 border-amber-500">
                            <FileCheck size={12} /> Emitir em Produção
                          </Button>
                        )}
                        {inv.status === "authorized" && (
                          <>
                            <Button variant="primary" size="sm" onClick={() => handleDownloadDanfe(inv)}>
                              <FileText size={12} /> DANFE
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => handleDownloadXml(inv)}>
                              <FileCheck size={12} /> XML
                            </Button>
                            {whatsappConnected && (
                              <Button variant="outline" size="sm" onClick={() => handleSendWhatsapp(inv)} disabled={sendingWhatsapp === inv.order_id} className="text-emerald-700 border-emerald-200 hover:bg-emerald-50">
                                {sendingWhatsapp === inv.order_id ? <Loader2 size={12} className="animate-spin" /> : <MessageCircle size={12} />} WhatsApp
                              </Button>
                            )}
                            {minutesSinceAuthorized(inv) <= PRAZO_CANCELAMENTO_MINUTOS && (
                              <Button variant="outline" size="sm" onClick={() => { setCancelTarget(inv); setCancelReason(""); setCancelError(null); }} className="text-rose-600 border-rose-200 hover:bg-rose-50">
                                <Ban size={12} /> Cancelar
                              </Button>
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

        {/* Mobile/tablet: cards empilhados em vez da tabela — a tabela fixa vira
            colunas espremidas demais abaixo de lg, principalmente chave de acesso +
            status + data lado a lado. */}
        <div className="xl:hidden divide-y divide-slate-100">
          {loading && (
            <div className="px-4 py-10 text-center text-slate-400 text-xs">Carregando...</div>
          )}
          {!loading && filtered.length === 0 && (
            <div className="px-4 py-10 text-center text-slate-400 text-xs">Nenhuma nota fiscal encontrada</div>
          )}
          {!loading && filtered.map((inv) => {
            const meta = STATUS_META[inv.status];
            return (
              <div key={inv.id} className="p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selected.has(inv.order_id)}
                    onChange={() => toggleSelected(inv.order_id)}
                    className="rounded border-slate-300 mt-1 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono font-semibold text-slate-700">Nº {inv.number}</span>
                      <span className="text-[11px] font-mono text-slate-400">Série {inv.series}</span>
                      <span className="text-[11px] font-mono text-blue-600">#{String(inv.order_id).padStart(6, "0")}</span>
                    </div>
                    <p className="text-xs font-semibold text-slate-700 truncate mt-0.5">
                      {inv.order?.customer_name || "Consumidor Final"}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold",
                      meta.bg, meta.color,
                    )}
                  >
                    {meta.icon} {meta.label}
                  </span>
                </div>

                {(inv.status === "error" || inv.status === "rejected") && inv.rejection_reason && (
                  <button
                    onClick={() => setErrorDetailTarget(inv)}
                    className="flex items-center gap-1 text-[11px] text-rose-500 hover:text-rose-700 font-medium pl-7 max-w-full underline decoration-dotted text-left"
                  >
                    <span className="truncate">{inv.rejection_reason}</span>
                    <Info size={11} className="shrink-0" />
                  </button>
                )}
                {inv.environment === "homologacao" && (
                  <p className="pl-7">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-600 border border-amber-200" title="Nota de teste — sem valor fiscal">
                      Homologação
                    </span>
                  </p>
                )}

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pl-7">
                  <span className="text-xs font-mono font-semibold text-slate-700">
                    {Number(inv.order?.total_amount || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </span>
                  <span className="text-[11px] text-slate-400 font-medium">
                    {inv.authorized_at ? new Date(inv.authorized_at).toLocaleString("pt-BR") : "—"}
                  </span>
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    {(inv.status === "error" || inv.status === "rejected") && (
                      <>
                        <Button variant="danger" size="sm" onClick={() => handleRetry(inv.order_id)} disabled={retrying === inv.order_id}>
                          {retrying === inv.order_id ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Reemitir
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => { setDeleteTarget(inv); setDeleteError(null); }}>
                          <Trash2 size={12} /> Excluir
                        </Button>
                      </>
                    )}
                    {inv.status === "authorized" && inv.environment === "homologacao" && (
                      <Button variant="primary" size="sm" onClick={() => { setProductionTarget(inv); setProductionError(null); }} className="bg-amber-500 hover:bg-amber-600 border-amber-500">
                        <FileCheck size={12} /> Emitir em Produção
                      </Button>
                    )}
                    {inv.status === "authorized" && (
                      <>
                        <Button variant="primary" size="sm" onClick={() => handleDownloadDanfe(inv)}>
                          <FileText size={12} /> DANFE
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleDownloadXml(inv)}>
                          <FileCheck size={12} /> XML
                        </Button>
                        {whatsappConnected && (
                          <Button variant="outline" size="sm" onClick={() => handleSendWhatsapp(inv)} disabled={sendingWhatsapp === inv.order_id} className="text-emerald-700 border-emerald-200 hover:bg-emerald-50">
                            {sendingWhatsapp === inv.order_id ? <Loader2 size={12} className="animate-spin" /> : <MessageCircle size={12} />} WhatsApp
                          </Button>
                        )}
                        {minutesSinceAuthorized(inv) <= PRAZO_CANCELAMENTO_MINUTOS && (
                          <Button variant="outline" size="sm" onClick={() => { setCancelTarget(inv); setCancelReason(""); setCancelError(null); }} className="text-rose-600 border-rose-200 hover:bg-rose-50">
                            <Ban size={12} /> Cancelar
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
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
          <Textarea rows={3} placeholder="Ex: Venda cancelada a pedido do cliente" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} wrapperClassName="w-full" className="resize-none" />
          <p className="text-[11px] text-slate-400">{cancelReason.trim().length}/15 caracteres mínimos</p>
          {cancelError && (
            <div className="bg-rose-50 border border-rose-200 rounded-lg px-3 py-2.5 text-[11px] font-semibold text-rose-600">
              {cancelError}
            </div>
          )}
        </div>
      </Modal>

      <Modal
        open={!!productionTarget}
        onClose={() => { if (!emittingProduction) { setProductionTarget(null); setProductionError(null); } }}
        title="Emitir NFC-e de Produção"
        subtitle={productionTarget ? `Pedido #${String(productionTarget.order_id).padStart(6, "0")} — nota atual é só teste (Homologação)` : undefined}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setProductionTarget(null)} disabled={emittingProduction}>Voltar</Button>
            <Button
              onClick={handleEmitProduction}
              disabled={emittingProduction}
              loading={emittingProduction}
            >
              Emitir de Produção
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-xs text-slate-500">
            A nota atual (nº {productionTarget?.number}) foi emitida em <strong>Homologação</strong> — é só teste, sem valor fiscal.
            Esta ação emite uma <strong>NFC-e nova</strong> (novo número, ambiente Produção) para o mesmo pedido, essa sim com valor fiscal real.
            O registro de homologação fica guardado como histórico, mas deixa de ser exibido.
          </p>
          {productionError && (
            <div className="bg-rose-50 border border-rose-200 rounded-lg px-3 py-2.5 text-[11px] font-semibold text-rose-600">
              {productionError}
            </div>
          )}
        </div>
      </Modal>

      <Modal
        open={!!whatsappNumberTarget}
        onClose={() => setWhatsappNumberTarget(null)}
        title="Enviar NFC-e por WhatsApp"
        subtitle={whatsappNumberTarget ? `Pedido #${String(whatsappNumberTarget.order_id).padStart(6, "0")} não tem telefone de cliente cadastrado` : undefined}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setWhatsappNumberTarget(null)} disabled={sendingWhatsapp !== null}>Voltar</Button>
            <Button
              onClick={() => whatsappNumberTarget && handleSendWhatsapp(whatsappNumberTarget, whatsappNumberInput.replace(/\D/g, ""))}
              disabled={sendingWhatsapp !== null || whatsappNumberInput.replace(/\D/g, "").length < 10}
              loading={sendingWhatsapp !== null}
            >
              Enviar
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-xs text-slate-500">Informe o número de WhatsApp que vai receber o DANFE.</p>
          <Input type="tel" autoFocus placeholder="(11) 91234-5678" value={whatsappNumberInput} onChange={(e) => setWhatsappNumberInput(e.target.value)} wrapperClassName="w-full" />
        </div>
      </Modal>


      <Modal
        open={!!errorDetailTarget}
        onClose={() => setErrorDetailTarget(null)}
        title="Detalhe da Rejeição"
        subtitle={errorDetailTarget ? `Nota nº ${errorDetailTarget.number} · Pedido #${String(errorDetailTarget.order_id).padStart(6, "0")}` : undefined}
        size="sm"
        footer={<Button onClick={() => setErrorDetailTarget(null)}>Fechar</Button>}
      >
        <div className="space-y-3">
          <div className="bg-rose-50 border border-rose-200 rounded-lg px-4 py-3 text-[13px] font-medium text-rose-700 leading-relaxed break-words">
            {errorDetailTarget?.rejection_reason}
          </div>
          <button
            onClick={() => { navigator.clipboard?.writeText(errorDetailTarget?.rejection_reason || ""); notify.success("Copiado!"); }}
            className="text-[11px] font-semibold text-slate-400 hover:text-slate-600 transition-colors"
          >
            Copiar mensagem
          </button>
        </div>
      </Modal>

      <Modal
        open={!!deleteTarget}
        onClose={() => { if (!deleting) { setDeleteTarget(null); setDeleteError(null); } }}
        title="Excluir tentativa de NFC-e"
        subtitle={deleteTarget ? `Pedido #${String(deleteTarget.order_id).padStart(6, "0")}` : undefined}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)} disabled={deleting}>Voltar</Button>
            <Button variant="danger" onClick={handleDelete} disabled={deleting} loading={deleting}>
              Excluir
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-xs text-slate-500">
            Remove esta tentativa de emissão (rejeitada/com erro) para permitir reemitir do zero.
            A venda em si não é afetada — permanece no histórico normalmente.
          </p>
          {deleteError && (
            <div className="bg-rose-50 border border-rose-200 rounded-lg px-3 py-2.5 text-[11px] font-semibold text-rose-600">
              {deleteError}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

const NFSE_STATUS_META: Record<NfseStatus, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  pending:    { label: "Aguardando",  color: "text-blue-600",    bg: "bg-blue-50",    icon: <Clock size={12} /> },
  processing: { label: "Processando", color: "text-blue-600",    bg: "bg-blue-50",    icon: <Loader2 size={12} className="animate-spin" /> },
  authorized: { label: "Autorizada",  color: "text-emerald-600", bg: "bg-emerald-50", icon: <CheckCircle2 size={12} /> },
  rejected:   { label: "Rejeitada",   color: "text-rose-600",    bg: "bg-rose-50",    icon: <XCircle size={12} /> },
  error:      { label: "Erro",        color: "text-rose-600",    bg: "bg-rose-50",    icon: <AlertTriangle size={12} /> },
  cancelled:  { label: "Cancelada",   color: "text-slate-500",   bg: "bg-slate-100",  icon: <XCircle size={12} /> },
};

async function exportNfseToExcel(invoices: NfseInvoice[]) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "BoxSys Store";
  wb.created = new Date();

  const ws = wb.addWorksheet("Notas Fiscais de Serviço", {
    pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true },
  });

  ws.columns = [
    { header: "Número",     key: "numero",  width: 12 },
    { header: "Série",      key: "serie",   width: 8 },
    { header: "Ordem de Serviço", key: "os", width: 14 },
    { header: "Cliente",    key: "customer", width: 28 },
    { header: "Chave de Acesso", key: "key", width: 46 },
    { header: "Status",     key: "status",  width: 14 },
    { header: "Valor (R$)", key: "value",   width: 14 },
    { header: "Emitida em", key: "date",    width: 18 },
  ];

  ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" } };

  invoices.forEach((inv) => {
    ws.addRow({
      numero: inv.numero,
      serie: inv.serie,
      os: inv.service_order_id,
      customer: inv.service_order?.customer_name || "Consumidor Final",
      key: inv.chave_acesso || "—",
      status: NFSE_STATUS_META[inv.status]?.label ?? inv.status,
      value: inv.service_order?.service_value ?? 0,
      date: inv.authorized_at ? new Date(inv.authorized_at).toLocaleString("pt-BR") : "—",
    });
  });

  ws.getColumn("value").numFmt = '"R$" #,##0.00';

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `notas-fiscais-servico-${new Date().toISOString().slice(0, 10)}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

function NfseTabContent() {
  const [invoices, setInvoices] = useState<NfseInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [retrying, setRetrying] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<NfseStatus | "all">("all");
  const [deleteTarget, setDeleteTarget] = useState<NfseInvoice | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<NfseInvoice | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [batchLoading, setBatchLoading] = useState<"retry" | null>(null);
  const [whatsappConnected, setWhatsappConnected] = useState(false);
  const [sendingWhatsapp, setSendingWhatsapp] = useState<number | null>(null);
  const [whatsappNumberTarget, setWhatsappNumberTarget] = useState<NfseInvoice | null>(null);
  const [whatsappNumberInput, setWhatsappNumberInput] = useState("");
  const [emailTarget, setEmailTarget] = useState<NfseInvoice | null>(null);
  const [emailInput, setEmailInput] = useState("");
  const [sendingEmail, setSendingEmail] = useState<number | null>(null);
  const [errorDetailTarget, setErrorDetailTarget] = useState<NfseInvoice | null>(null);
  const notify = useToast();
  const todayStr = () => new Date().toISOString().slice(0, 10);
  const firstOfMonthStr = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  const lastOfMonthStr = (d = new Date()) => {
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, "0")}-${String(last.getDate()).padStart(2, "0")}`;
  };
  const [dateFrom, setDateFrom] = useState(firstOfMonthStr());
  const [dateTo, setDateTo] = useState(lastOfMonthStr());
  const token = localStorage.getItem("token");

  const [showAvulsaModal, setShowAvulsaModal] = useState(false);
  const [avulsaCustomers, setAvulsaCustomers] = useState<CustomerOption[]>([]);
  const [avulsaCustomerSearch, setAvulsaCustomerSearch] = useState("");
  const [avulsaSelectedCustomer, setAvulsaSelectedCustomer] = useState<CustomerOption | null>(null);
  const [avulsaShowNewCustomer, setAvulsaShowNewCustomer] = useState(false);
  const [avulsaNewCustomerSaving, setAvulsaNewCustomerSaving] = useState(false);
  const [avulsaCustomerName, setAvulsaCustomerName] = useState("");
  const [avulsaCustomerPhone, setAvulsaCustomerPhone] = useState("");
  const [avulsaCustomerDoc, setAvulsaCustomerDoc] = useState("");
  const [avulsaCodigo, setAvulsaCodigo] = useState("140601");
  const [avulsaDescricao, setAvulsaDescricao] = useState("");
  const [avulsaValor, setAvulsaValor] = useState("");
  const [avulsaEmitting, setAvulsaEmitting] = useState(false);
  const [avulsaError, setAvulsaError] = useState<string | null>(null);

  const fetchInvoices = () => {
    setLoading(true);
    fetch("/api/nfse?pageSize=200", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => setInvoices(Array.isArray(data.invoices) ? data.invoices : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(fetchInvoices, []);
  useEffect(() => onRealtime("nfse:changed", () => { fetchInvoices(); }), []);

  useEffect(() => {
    fetch("/api/whatsapp/connection-status", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => setWhatsappConnected(Boolean(d?.connected)))
      .catch(() => {});
  }, []);

  const handleSendWhatsapp = async (inv: NfseInvoice, numberOverride?: string) => {
    setSendingWhatsapp(inv.service_order_id);
    try {
      const res = await fetch(`/api/nfse/${inv.service_order_id}/send-whatsapp`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(numberOverride ? { number: numberOverride } : {}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 422 && !numberOverride) {
          setWhatsappNumberTarget(inv);
          setWhatsappNumberInput("");
          return;
        }
        notify.error(data.error || "Falha ao enviar pelo WhatsApp.");
        return;
      }
      notify.success("NFS-e enviada pelo WhatsApp!");
      setWhatsappNumberTarget(null);
    } catch {
      notify.error("Erro de conexão ao enviar pelo WhatsApp.");
    } finally {
      setSendingWhatsapp(null);
    }
  };

  const handleSendEmail = async (inv: NfseInvoice, emailOverride?: string) => {
    setSendingEmail(inv.service_order_id);
    try {
      const res = await fetch(`/api/nfse/${inv.service_order_id}/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(emailOverride ? { email: emailOverride } : {}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 422 && data?.code === "recipient_required" && !emailOverride) {
          setEmailTarget(inv);
          setEmailInput("");
          return;
        }
        notify.error(data.error || "Falha ao enviar a NFS-e por e-mail.");
        return;
      }
      notify.success(`NFS-e enviada para ${data.recipient}.`);
      setEmailTarget(null);
    } catch {
      notify.error("Erro de conexão ao enviar a NFS-e por e-mail.");
    } finally {
      setSendingEmail(null);
    }
  };

  const resetAvulsaForm = () => {
    setAvulsaCustomerSearch("");
    setAvulsaSelectedCustomer(null);
    setAvulsaShowNewCustomer(false);
    setAvulsaCustomerName("");
    setAvulsaCustomerPhone("");
    setAvulsaCustomerDoc("");
    setAvulsaCodigo("140601");
    setAvulsaDescricao("");
    setAvulsaValor("");
    setAvulsaError(null);
  };

  const openAvulsaModal = () => {
    resetAvulsaForm();
    setShowAvulsaModal(true);
    fetch("/api/customers", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => setAvulsaCustomers(Array.isArray(d) ? d : []))
      .catch(() => {});
  };

  const avulsaFilteredCustomers = useMemo(() => {
    const term = avulsaCustomerSearch.trim().toLowerCase();
    if (!term) return [];
    return avulsaCustomers.filter((c) =>
      c.name.toLowerCase().includes(term) || (c.phone ?? "").includes(term) || (c.document ?? "").includes(term),
    ).slice(0, 6);
  }, [avulsaCustomers, avulsaCustomerSearch]);

  const handleCreateAvulsaCustomer = async () => {
    if (!avulsaCustomerName.trim()) return;
    setAvulsaNewCustomerSaving(true);
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: avulsaCustomerName.trim(),
          phone: avulsaCustomerPhone.replace(/\D/g, "") || null,
          document: avulsaCustomerDoc.replace(/\D/g, "") || null,
        }),
      });
      const created = await res.json();
      if (!res.ok) {
        setAvulsaError(created.error || "Falha ao cadastrar cliente");
        return;
      }
      setAvulsaCustomers((prev) => [...prev, created]);
      setAvulsaSelectedCustomer(created);
      setAvulsaShowNewCustomer(false);
    } finally {
      setAvulsaNewCustomerSaving(false);
    }
  };

  const handleEmitAvulsa = async () => {
    setAvulsaEmitting(true);
    setAvulsaError(null);
    try {
      const res = await fetch("/api/nfse/avulsa", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          customer_id: avulsaSelectedCustomer?.id,
          customer_name: avulsaSelectedCustomer?.name,
          customer_phone: avulsaSelectedCustomer?.phone,
          codigo_tributacao_nacional: avulsaCodigo,
          descricao_servico: avulsaDescricao,
          valor_servico: Number(avulsaValor.replace(",", ".")),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAvulsaError(data.error || "Falha ao emitir NFS-e avulsa");
        return;
      }
      setShowAvulsaModal(false);
      resetAvulsaForm();
      fetchInvoices();
    } finally {
      setAvulsaEmitting(false);
    }
  };

  const handleRetry = async (serviceOrderId: number) => {
    setRetrying(serviceOrderId);
    try {
      await fetch(`/api/nfse/${serviceOrderId}/retry`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      setTimeout(fetchInvoices, 1500);
    } finally {
      setRetrying(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/nfse/${deleteTarget.service_order_id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        setDeleteError(data.error || "Falha ao excluir a nota fiscal");
        return;
      }
      setDeleteTarget(null);
      fetchInvoices();
    } finally {
      setDeleting(false);
    }
  };

  const handleCancel = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    setCancelError(null);
    try {
      const res = await fetch(`/api/nfse/${cancelTarget.service_order_id}/cancel`, {
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

  const handleDownloadXml = (inv: NfseInvoice) =>
    downloadAuthenticated(`/api/nfse/${inv.service_order_id}/xml`, token, `nfse-${inv.chave_acesso ?? inv.service_order_id}.xml`)
      .catch((e) => notify.error(e instanceof Error ? e.message : "Não foi possível baixar o XML."));

  const handleDownloadPdf = (inv: NfseInvoice) =>
    downloadAuthenticated(`/api/nfse/${inv.service_order_id}/pdf`, token, `nfse-${inv.chave_acesso ?? inv.service_order_id}.pdf`)
      .catch((e) => notify.error(e instanceof Error ? e.message : "Não foi possível baixar o PDF."));

  const filtered = useMemo(() => {
    return invoices.filter((inv) => {
      if (statusFilter !== "all" && inv.status !== statusFilter) return false;
      const d = new Date(inv.created_at);
      const invDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (dateFrom && invDate < dateFrom) return false;
      if (dateTo && invDate > dateTo) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const haystack = `${inv.numero} ${inv.chave_acesso ?? ""} ${inv.service_order?.customer_name ?? ""}`.toLowerCase();
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
    amount: invoices.filter((i) => i.status === "authorized").reduce((sum, i) => sum + Number(i.service_order?.service_value || 0), 0),
  }), [invoices]);

  const toggleSelected = (serviceOrderId: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(serviceOrderId)) next.delete(serviceOrderId); else next.add(serviceOrderId);
      return next;
    });
  };

  const toggleSelectAllFiltered = () => {
    setSelected((prev) => {
      const allSelected = filtered.length > 0 && filtered.every((inv) => prev.has(inv.service_order_id));
      if (allSelected) return new Set();
      return new Set(filtered.map((inv) => inv.service_order_id));
    });
  };

  const selectedInvoices = useMemo(
    () => filtered.filter((inv) => selected.has(inv.service_order_id)),
    [filtered, selected],
  );
  const selectedRetryable = selectedInvoices.filter((inv) => inv.status === "error" || inv.status === "rejected");

  const handleRetryBatch = async () => {
    if (selectedRetryable.length === 0) return;
    setBatchLoading("retry");
    try {
      await Promise.all(selectedRetryable.map((inv) =>
        fetch(`/api/nfse/${inv.service_order_id}/retry`, { method: "POST", headers: { Authorization: `Bearer ${token}` } }),
      ));
      setTimeout(fetchInvoices, 1500);
    } finally {
      setBatchLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <Button variant="primary" size="md" onClick={openAvulsaModal} className="w-full sm:w-auto">
          <Plus size={13} /> Nova NFS-e Avulsa
        </Button>
        <Button variant="outline" size="md" onClick={async () => { setExporting(true); try { await exportNfseToExcel(filtered); } finally { setExporting(false); } }} disabled={exporting || filtered.length === 0} className="w-full sm:w-auto">
          {exporting ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />} Exportar
        </Button>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 border-b border-slate-100 divide-x divide-y sm:divide-y-0 lg:divide-y-0 divide-slate-100">
          {[
            { label: "Total",       value: counts.total,      color: "text-slate-900" },
            { label: "Autorizadas", value: counts.authorized, color: "text-emerald-500" },
            { label: "Em processo", value: counts.pending,    color: "text-blue-500" },
            { label: "Com erro",    value: counts.error,      color: "text-rose-500" },
            { label: "Valor emitido", value: counts.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), color: "text-slate-900" },
          ].map((k) => (
            <div key={k.label} className="px-4 sm:px-5 py-3 sm:py-4 flex flex-col gap-0.5">
              <span className={cn("text-xl sm:text-2xl font-semibold font-mono leading-none", k.color)}>{k.value}</span>
              <span className="text-[10px] font-semibold text-slate-400">{k.label}</span>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 px-3 py-3 sm:px-4">
          <FilterLineSearch aria-label="Buscar por número, chave, cliente" placeholder="Buscar por número, chave, cliente..." value={searchTerm} onChange={setSearchTerm} />
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as NfseStatus | "all")} wrapperClassName="min-w-[180px] flex-1">
            <option value="all">Todos os status</option>
            {Object.entries(NFSE_STATUS_META).map(([key, meta]) => (
              <option key={key} value={key}>{meta.label}</option>
            ))}
          </Select>
          <div className="flex min-w-[280px] flex-1 items-center gap-2">
            <Input type="date" aria-label="Data inicial" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} iconLeft={<Calendar size={13} />} wrapperClassName="flex-1" />
            <span className="text-[11px] text-slate-400">até</span>
            <Input type="date" aria-label="Data final" value={dateTo} onChange={(e) => setDateTo(e.target.value)} wrapperClassName="flex-1" />
          </div>
          <FilterLineSegmented<string>
            options={buildPresets(todayStr, firstOfMonthStr, lastOfMonthStr).map((p) => ({ value: p.label, label: p.label }))}
            value={buildPresets(todayStr, firstOfMonthStr, lastOfMonthStr).find((p) => dateFrom === p.from && dateTo === p.to)?.label ?? ""}
            onChange={(label) => { const p = buildPresets(todayStr, firstOfMonthStr, lastOfMonthStr).find((x) => x.label === label); if (p) { setDateFrom(p.from); setDateTo(p.to); } }}
          />
        </div>

        {selected.size > 0 && (
          <div className="flex items-center gap-2 px-4 py-2.5 flex-wrap bg-blue-50/60 border-b border-blue-100">
            <span className="text-[11px] font-semibold text-blue-700 mr-1">
              {selected.size} selecionada{selected.size > 1 ? "s" : ""}
            </span>
            <Button variant="danger" size="sm" onClick={handleRetryBatch} disabled={batchLoading !== null || selectedRetryable.length === 0}>
              {batchLoading === "retry" ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              Reemitir selecionadas ({selectedRetryable.length})
            </Button>
          </div>
        )}

        <div className="hidden xl:block max-h-[calc(100vh-390px)] overflow-auto overscroll-contain">
          <table className="w-full min-w-[1480px] text-left border-collapse table-fixed">
            <colgroup>
              <col className="w-8" />
              <col className="w-14" />
              <col className="w-12" />
              <col className="w-24" />
              <col className="w-44" />
              <col className="w-36" />
              <col className="w-28" />
              <col className="w-36" />
              <col className="w-[38rem]" />
            </colgroup>
            <thead>
              <tr className="sticky top-0 z-20 border-t border-slate-100 bg-slate-50 shadow-sm">
                <th className="px-4 py-2.5 w-8">
                  <input
                    type="checkbox"
                    checked={filtered.length > 0 && filtered.every((inv) => selected.has(inv.service_order_id))}
                    onChange={toggleSelectAllFiltered}
                    className="rounded border-slate-300"
                  />
                </th>
                {["Nº", "Série", "O.S.", "Cliente", "Status", "Valor", "Emitida em", ""].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-[10px] font-semibold text-slate-400 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-slate-400 text-xs">Carregando...</td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-slate-400 text-xs">Nenhuma nota fiscal de serviço encontrada</td></tr>
              )}
              {!loading && filtered.map((inv) => {
                const meta = NFSE_STATUS_META[inv.status];
                return (
                  <tr key={inv.id} className="border-t border-slate-100 hover:bg-slate-50/60 transition-colors">
                    <td className="px-4 py-2.5">
                      <input
                        type="checkbox"
                        checked={selected.has(inv.service_order_id)}
                        onChange={() => toggleSelected(inv.service_order_id)}
                        className="rounded border-slate-300"
                      />
                    </td>
                    <td className="px-4 py-2.5 text-xs font-mono font-semibold text-slate-700">{inv.numero}</td>
                    <td className="px-4 py-2.5 text-xs font-mono text-slate-500">{inv.serie}</td>
                    <td className="px-4 py-2.5 text-xs font-mono text-blue-600 truncate" title={`#${String(inv.service_order_id).padStart(6, "0")}`}>
                      #{String(inv.service_order_id).padStart(6, "0")}
                    </td>
                    <td className="px-4 py-2.5 text-xs font-semibold text-slate-700 truncate" title={inv.service_order?.customer_name || "Consumidor Final"}>
                      {inv.service_order?.customer_name || "Consumidor Final"}
                    </td>
                    <td className="px-4 py-2.5 whitespace-normal">
                      <span
                        title={(inv.status === "error" || inv.status === "rejected") ? (inv.rejection_reason ?? undefined) : undefined}
                        className={cn(
                          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap",
                          meta.bg, meta.color,
                          (inv.status === "error" || inv.status === "rejected") && inv.rejection_reason && "cursor-help",
                        )}
                      >
                        {meta.icon} {meta.label}
                      </span>
                      {(inv.status === "error" || inv.status === "rejected") && inv.rejection_reason && (
                        <button
                          onClick={() => setErrorDetailTarget(inv)}
                          className="flex items-center gap-1 text-[11px] text-rose-500 hover:text-rose-700 font-medium mt-1 max-w-full underline decoration-dotted"
                        >
                          <span className="truncate">{inv.rejection_reason}</span>
                          <Info size={11} className="shrink-0" />
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs font-mono font-semibold text-slate-700 whitespace-nowrap">
                      {Number(inv.service_order?.service_value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-500 whitespace-nowrap">
                      {inv.authorized_at ? new Date(inv.authorized_at).toLocaleString("pt-BR") : "—"}
                    </td>
                    <td className="px-4 py-2.5 pr-5">
                      <div className="flex items-center gap-2 justify-end flex-nowrap whitespace-nowrap shrink-0">
                        {(inv.status === "error" || inv.status === "rejected") && (
                          <>
                            <Button variant="danger" size="sm" onClick={() => handleRetry(inv.service_order_id)} disabled={retrying === inv.service_order_id}>
                              {retrying === inv.service_order_id ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Reemitir
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => { setDeleteTarget(inv); setDeleteError(null); }}>
                              <Trash2 size={12} /> Excluir
                            </Button>
                          </>
                        )}
                        {inv.status === "authorized" && (
                          <>
                            <Button variant="primary" size="sm" onClick={() => handleDownloadPdf(inv)}>
                              <FileText size={12} /> PDF
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => handleDownloadXml(inv)}>
                              <FileCheck size={12} /> XML
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleSendEmail(inv)} loading={sendingEmail === inv.service_order_id} iconLeft={<Mail size={12} />}>
                              E-mail
                            </Button>
                            {whatsappConnected && (
                              <Button variant="outline" size="sm" onClick={() => handleSendWhatsapp(inv)} disabled={sendingWhatsapp === inv.service_order_id} className="text-emerald-700 border-emerald-200 hover:bg-emerald-50">
                                {sendingWhatsapp === inv.service_order_id ? <Loader2 size={12} className="animate-spin" /> : <MessageCircle size={12} />} WhatsApp
                              </Button>
                            )}
                            <Button variant="outline" size="sm" onClick={() => { setCancelTarget(inv); setCancelReason(""); setCancelError(null); }} className="text-rose-600 border-rose-200 hover:bg-rose-50">
                              <Ban size={12} /> Cancelar
                            </Button>
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

        {/* Mobile/tablet: cards empilhados em vez da tabela */}
        <div className="xl:hidden divide-y divide-slate-100">
          {loading && (
            <div className="px-4 py-10 text-center text-slate-400 text-xs">Carregando...</div>
          )}
          {!loading && filtered.length === 0 && (
            <div className="px-4 py-10 text-center text-slate-400 text-xs">Nenhuma nota fiscal de serviço encontrada</div>
          )}
          {!loading && filtered.map((inv) => {
            const meta = NFSE_STATUS_META[inv.status];
            return (
              <div key={inv.id} className="p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selected.has(inv.service_order_id)}
                    onChange={() => toggleSelected(inv.service_order_id)}
                    className="rounded border-slate-300 mt-1 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono font-semibold text-slate-700">Nº {inv.numero}</span>
                      <span className="text-[11px] font-mono text-slate-400">Série {inv.serie}</span>
                      <span className="text-[11px] font-mono text-blue-600">#{String(inv.service_order_id).padStart(6, "0")}</span>
                    </div>
                    <p className="text-xs font-semibold text-slate-700 truncate mt-0.5">
                      {inv.service_order?.customer_name || "Consumidor Final"}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold",
                      meta.bg, meta.color,
                    )}
                  >
                    {meta.icon} {meta.label}
                  </span>
                </div>

                {(inv.status === "error" || inv.status === "rejected") && inv.rejection_reason && (
                  <button
                    onClick={() => setErrorDetailTarget(inv)}
                    className="flex items-center gap-1 text-[11px] text-rose-500 hover:text-rose-700 font-medium pl-7 max-w-full underline decoration-dotted text-left"
                  >
                    <span className="truncate">{inv.rejection_reason}</span>
                    <Info size={11} className="shrink-0" />
                  </button>
                )}

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pl-7">
                  <span className="text-xs font-mono font-semibold text-slate-700">
                    {Number(inv.service_order?.service_value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </span>
                  <span className="text-[11px] text-slate-400 font-medium">
                    {inv.authorized_at ? new Date(inv.authorized_at).toLocaleString("pt-BR") : "—"}
                  </span>
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    {(inv.status === "error" || inv.status === "rejected") && (
                      <>
                        <Button variant="danger" size="sm" onClick={() => handleRetry(inv.service_order_id)} disabled={retrying === inv.service_order_id}>
                          {retrying === inv.service_order_id ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Reemitir
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => { setDeleteTarget(inv); setDeleteError(null); }}>
                          <Trash2 size={12} /> Excluir
                        </Button>
                      </>
                    )}
                    {inv.status === "authorized" && (
                      <>
                        <Button variant="primary" size="sm" onClick={() => handleDownloadPdf(inv)}>
                          <FileText size={12} /> PDF
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleDownloadXml(inv)}>
                          <FileCheck size={12} /> XML
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleSendEmail(inv)} loading={sendingEmail === inv.service_order_id} iconLeft={<Mail size={12} />}>
                          E-mail
                        </Button>
                        {whatsappConnected && (
                          <Button variant="outline" size="sm" onClick={() => handleSendWhatsapp(inv)} disabled={sendingWhatsapp === inv.service_order_id} className="text-emerald-700 border-emerald-200 hover:bg-emerald-50">
                            {sendingWhatsapp === inv.service_order_id ? <Loader2 size={12} className="animate-spin" /> : <MessageCircle size={12} />} WhatsApp
                          </Button>
                        )}
                        <Button variant="outline" size="sm" onClick={() => { setCancelTarget(inv); setCancelReason(""); setCancelError(null); }} className="text-rose-600 border-rose-200 hover:bg-rose-50">
                          <Ban size={12} /> Cancelar
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Modal
        open={!!deleteTarget}
        onClose={() => { if (!deleting) { setDeleteTarget(null); setDeleteError(null); } }}
        title="Excluir tentativa de NFS-e"
        subtitle={deleteTarget ? `Ordem de Serviço #${String(deleteTarget.service_order_id).padStart(6, "0")}` : undefined}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)} disabled={deleting}>Voltar</Button>
            <Button variant="danger" onClick={handleDelete} disabled={deleting} loading={deleting}>
              Excluir
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-xs text-slate-500">
            Remove esta tentativa de emissão (rejeitada/com erro) para permitir reemitir do zero.
            A ordem de serviço em si não é afetada — permanece no histórico normalmente.
          </p>
          {deleteError && (
            <div className="bg-rose-50 border border-rose-200 rounded-lg px-3 py-2.5 text-[11px] font-semibold text-rose-600">
              {deleteError}
            </div>
          )}
        </div>
      </Modal>

      <Modal
        open={!!cancelTarget}
        onClose={() => { if (!cancelling) { setCancelTarget(null); setCancelError(null); } }}
        title="Cancelar NFS-e"
        subtitle={cancelTarget ? `Nota nº ${cancelTarget.numero}` : undefined}
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
            Esta ação envia o evento de cancelamento ao Sistema Nacional NFS-e. Não é possível desfazer.
            A justificativa precisa ter no mínimo 15 caracteres.
          </p>
          <Textarea rows={3} placeholder="Ex: Serviço não foi prestado" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} wrapperClassName="w-full" className="resize-none" />
          <p className="text-[11px] text-slate-400">{cancelReason.trim().length}/15 caracteres mínimos</p>
          {cancelError && (
            <div className="bg-rose-50 border border-rose-200 rounded-lg px-3 py-2.5 text-[11px] font-semibold text-rose-600">
              {cancelError}
            </div>
          )}
        </div>
      </Modal>

      <Modal
        open={!!whatsappNumberTarget}
        onClose={() => setWhatsappNumberTarget(null)}
        title="Enviar NFS-e por WhatsApp"
        subtitle="OS não tem telefone de cliente cadastrado"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setWhatsappNumberTarget(null)} disabled={sendingWhatsapp !== null}>Voltar</Button>
            <Button
              onClick={() => whatsappNumberTarget && handleSendWhatsapp(whatsappNumberTarget, whatsappNumberInput.replace(/\D/g, ""))}
              disabled={sendingWhatsapp !== null || whatsappNumberInput.replace(/\D/g, "").length < 10}
              loading={sendingWhatsapp !== null}
            >
              Enviar
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-xs text-slate-500">Informe o número de WhatsApp que vai receber o PDF da NFS-e.</p>
          <Input type="tel" autoFocus placeholder="(11) 91234-5678" value={whatsappNumberInput} onChange={(e) => setWhatsappNumberInput(e.target.value)} wrapperClassName="w-full" />
        </div>
      </Modal>

      <Modal
        open={!!emailTarget}
        onClose={() => setEmailTarget(null)}
        title="Enviar NFS-e por e-mail"
        subtitle="Cliente sem e-mail fiscal cadastrado"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEmailTarget(null)} disabled={sendingEmail !== null}>Voltar</Button>
            <Button
              onClick={() => emailTarget && handleSendEmail(emailTarget, emailInput.trim())}
              disabled={sendingEmail !== null || !/^\S+@\S+\.\S+$/.test(emailInput.trim())}
              loading={sendingEmail !== null}
            >
              Enviar PDF
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-xs text-slate-500">O cliente receberá uma mensagem em texto simples, enviada em nome da loja, com o PDF da NFS-e anexado.</p>
          <Input type="email" autoFocus placeholder="cliente@exemplo.com" value={emailInput} onChange={(e) => setEmailInput(e.target.value)} wrapperClassName="w-full" />
        </div>
      </Modal>

      <Modal
        open={!!errorDetailTarget}
        onClose={() => setErrorDetailTarget(null)}
        title="Detalhe da Rejeição"
        subtitle={errorDetailTarget ? `OS #${errorDetailTarget.service_order_id}` : undefined}
        size="sm"
        footer={<Button onClick={() => setErrorDetailTarget(null)}>Fechar</Button>}
      >
        <div className="space-y-3">
          <div className="bg-rose-50 border border-rose-200 rounded-lg px-4 py-3 text-[13px] font-medium text-rose-700 leading-relaxed break-words">
            {errorDetailTarget?.rejection_reason}
          </div>
          <button
            onClick={() => { navigator.clipboard?.writeText(errorDetailTarget?.rejection_reason || ""); notify.success("Copiado!"); }}
            className="text-[11px] font-semibold text-slate-400 hover:text-slate-600 transition-colors"
          >
            Copiar mensagem
          </button>
        </div>
      </Modal>

      <Modal
        open={showAvulsaModal}
        onClose={() => { if (!avulsaEmitting) setShowAvulsaModal(false); }}
        title="Nova NFS-e Avulsa"
        subtitle="Emite uma nota de serviço sem precisar abrir uma Ordem de Serviço"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowAvulsaModal(false)} disabled={avulsaEmitting}>Voltar</Button>
            <Button
              onClick={handleEmitAvulsa}
              disabled={avulsaEmitting || !avulsaCodigo || !avulsaDescricao.trim() || !avulsaValor || Number(avulsaValor.replace(",", ".")) <= 0}
              loading={avulsaEmitting}
            >
              Emitir NFS-e
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-semibold text-slate-400 block mb-1">Cliente (opcional)</label>
            {avulsaSelectedCustomer ? (
              <div className="flex items-center justify-between gap-2 bg-violet-50 border border-violet-200 rounded-lg px-3 h-9">
                <div className="min-w-0">
                  <span className="text-xs font-semibold text-slate-700 truncate block">{avulsaSelectedCustomer.name}</span>
                </div>
                <IconButton variant="ghost" size="xs" aria-label="Remover cliente" onClick={() => setAvulsaSelectedCustomer(null)} className="shrink-0">
                  <XCircle size={14} />
                </IconButton>
              </div>
            ) : avulsaShowNewCustomer ? (
              <div className="space-y-2 bg-slate-50 border border-slate-200 rounded-lg p-3">
                <Input value={avulsaCustomerName} onChange={(e) => setAvulsaCustomerName(e.target.value)} placeholder="Nome do cliente" wrapperClassName="w-full" />
                <div className="grid grid-cols-2 gap-2">
                  <Input value={avulsaCustomerPhone} onChange={(e) => setAvulsaCustomerPhone(maskPhone(e.target.value))} inputMode="numeric" placeholder="(00) 00000-0000" wrapperClassName="w-full" />
                  <Input value={avulsaCustomerDoc} onChange={(e) => setAvulsaCustomerDoc(maskDoc(e.target.value))} inputMode="numeric" placeholder="CPF/CNPJ" wrapperClassName="w-full" />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => setAvulsaShowNewCustomer(false)}>Cancelar</Button>
                  <Button size="sm" className="flex-1" onClick={handleCreateAvulsaCustomer} disabled={!avulsaCustomerName.trim() || avulsaNewCustomerSaving}>
                    {avulsaNewCustomerSaving ? "Salvando…" : "Salvar Cliente"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                <FilterLineSearch aria-label="Buscar cliente" placeholder="Buscar cliente ou deixar em branco (Consumidor Final)" value={avulsaCustomerSearch} onChange={setAvulsaCustomerSearch} />
                {avulsaFilteredCustomers.length > 0 && (
                  <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 overflow-hidden max-h-32 overflow-y-auto">
                    {avulsaFilteredCustomers.map((c) => (
                      <button key={c.id} onClick={() => { setAvulsaSelectedCustomer(c); setAvulsaCustomerSearch(""); }}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-violet-50 transition-all">
                        <span className="font-semibold text-slate-700">{c.name}</span>
                        {c.phone && <span className="text-slate-400 ml-2">{c.phone}</span>}
                      </button>
                    ))}
                  </div>
                )}
                <Button variant="ghost" size="xs" onClick={() => { setAvulsaShowNewCustomer(true); setAvulsaCustomerName(avulsaCustomerSearch); setAvulsaCustomerSearch(""); }}>
                  + Cadastrar novo cliente
                </Button>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-semibold text-slate-400 block mb-1">Cód. Serviço</label>
              <Input value={avulsaCodigo} onChange={(e) => setAvulsaCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="140601" wrapperClassName="w-full" className="font-mono" />
              <div className="mt-1.5">
                <FiscalCodeLookup kind="nfse-service" token={token} onSelect={(item) => { setAvulsaCodigo(item.code); setAvulsaDescricao((current) => current || item.description); }} />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-slate-400 block mb-1">Valor (R$)</label>
              <Input value={avulsaValor} onChange={(e) => setAvulsaValor(maskCurrency(e.target.value))} inputMode="numeric" placeholder="0,00" wrapperClassName="w-full" className="font-mono" />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-semibold text-slate-400 block mb-1">Descrição do Serviço</label>
            <Textarea rows={3} value={avulsaDescricao} onChange={(e) => setAvulsaDescricao(e.target.value)} placeholder="O que foi feito — obrigatório para a prefeitura" wrapperClassName="w-full" className="resize-none" />
          </div>
          {!avulsaSelectedCustomer && (
            <p className="text-[11px] text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Sem cliente identificado, a nota sai como "Consumidor Final". Algumas prefeituras exigem CPF/CNPJ do
              tomador acima de certo valor — confira a regra do seu município caso a nota seja rejeitada.
            </p>
          )}
          {avulsaError && (
            <div className="bg-rose-50 border border-rose-200 rounded-lg px-3 py-2.5 text-[11px] font-semibold text-rose-600">
              {avulsaError}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

const NOTA_TABS = [
  { id: "nfce", label: "NFC-e (Produtos)", icon: FileText },
  { id: "nfse", label: "NFS-e (Serviços)", icon: FileCheck },
] as const;

export default function NfceInvoices() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const tab: "nfce" | "nfse" = tabParam === "nfse" ? "nfse" : "nfce";
  const setTab = (next: "nfce" | "nfse") => {
    setSearchParams(next === "nfce" ? {} : { tab: next }, { replace: true });
  };

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-4 sm:space-y-6">
      <PageHeader
        title="Notas Fiscais"
        className="[&>div>h2]:text-lg [&>div>h2]:tracking-normal sm:[&>div>h2]:text-xl [&>div>p]:"
        subtitle="NFC-e e NFS-e emitidas junto à SEFAZ/prefeitura · exporte o relatório para o contador"
      />

      <Tabs<"nfce" | "nfse"> items={NOTA_TABS} value={tab} onChange={setTab} label="Tipo de nota fiscal">
        {tab === "nfce" ? <NfceTabContent /> : <NfseTabContent />}
      </Tabs>
    </div>
  );
}
