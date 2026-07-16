import { useState, useEffect, useMemo } from "react";
import ExcelJS from "exceljs";
import {
  Terminal, Search, Download, CheckCircle2, Loader2, Clock, XCircle, AlertTriangle, Ban,
} from "lucide-react";
import PageHeader from "../../components/layout/PageHeader";
import { cn } from "../../lib/utils";

type TerminalTxStatus = "approved" | "denied" | "cancelled" | "pending" | "error";

interface TerminalTx {
  id: number;
  order_id: number | null;
  provider: string;
  environment: string;
  status: TerminalTxStatus;
  external_id: string | null;
  nsu: string | null;
  authorization_code: string | null;
  brand: string | null;
  mode: string | null;
  installments: number;
  amount: string | number;
  fee_amount: string | number | null;
  created_at: string;
}

const STATUS_META: Record<TerminalTxStatus, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  approved:  { label: "Aprovada",  color: "text-emerald-600", bg: "bg-emerald-50", icon: <CheckCircle2 size={12} /> },
  pending:   { label: "Pendente",  color: "text-blue-600",    bg: "bg-blue-50",    icon: <Clock size={12} /> },
  denied:    { label: "Negada",    color: "text-rose-600",    bg: "bg-rose-50",    icon: <XCircle size={12} /> },
  cancelled: { label: "Cancelada", color: "text-slate-500",   bg: "bg-slate-100",  icon: <Ban size={12} /> },
  error:     { label: "Erro",      color: "text-rose-600",    bg: "bg-rose-50",    icon: <AlertTriangle size={12} /> },
};

const PROVIDER_LABELS: Record<string, string> = {
  rede: "Rede (Itaú)",
  stone: "Stone",
  mercadopago: "Mercado Pago",
  cielo: "Cielo",
  pagseguro: "PagBank",
};

async function exportToExcel(txs: TerminalTx[]) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "BoxSys Store";
  wb.created = new Date();

  const ws = wb.addWorksheet("Maquininhas", {
    pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true },
  });

  ws.columns = [
    { header: "Data",         key: "date",     width: 18 },
    { header: "Adquirente",   key: "provider", width: 16 },
    { header: "Ambiente",     key: "env",      width: 12 },
    { header: "Pedido",       key: "order",    width: 12 },
    { header: "Status",       key: "status",   width: 14 },
    { header: "Modo",         key: "mode",     width: 10 },
    { header: "Parcelas",     key: "inst",     width: 10 },
    { header: "Bandeira",     key: "brand",    width: 12 },
    { header: "NSU",          key: "nsu",      width: 16 },
    { header: "Autorização",  key: "auth",     width: 16 },
    { header: "Valor (R$)",   key: "amount",   width: 14 },
  ];

  ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" } };

  txs.forEach((t) => {
    ws.addRow({
      date: new Date(t.created_at).toLocaleString("pt-BR"),
      provider: PROVIDER_LABELS[t.provider] ?? t.provider,
      env: t.environment === "sandbox" ? "Sandbox" : "Produção",
      order: t.order_id ? `#${String(t.order_id).padStart(6, "0")}` : "—",
      status: STATUS_META[t.status]?.label ?? t.status,
      mode: t.mode === "debit" ? "Débito" : "Crédito",
      inst: t.installments,
      brand: t.brand ?? "—",
      nsu: t.nsu ?? "—",
      auth: t.authorization_code ?? "—",
      amount: Number(t.amount) || 0,
    });
  });

  ws.getColumn("amount").numFmt = '"R$" #,##0.00';

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `maquininhas-${new Date().toISOString().slice(0, 10)}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function TerminalTransactions() {
  const [txs, setTxs] = useState<TerminalTx[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<TerminalTxStatus | "all">("all");
  const [providerFilter, setProviderFilter] = useState<string>("all");

  const token = localStorage.getItem("token");

  const fetchTxs = () => {
    setLoading(true);
    fetch("/api/terminals/transactions", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => setTxs(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchTxs(); }, []);

  const filtered = useMemo(() => {
    return txs.filter((t) => {
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (providerFilter !== "all" && t.provider !== providerFilter) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const haystack = `${t.nsu ?? ""} ${t.authorization_code ?? ""} ${t.external_id ?? ""} ${t.order_id ?? ""}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [txs, statusFilter, providerFilter, searchTerm]);

  const counts = useMemo(() => ({
    total: txs.length,
    approved: txs.filter((t) => t.status === "approved").length,
    pending: txs.filter((t) => t.status === "pending").length,
    error: txs.filter((t) => t.status === "denied" || t.status === "error").length,
    volume: txs.filter((t) => t.status === "approved").reduce((sum, t) => sum + (Number(t.amount) || 0), 0),
  }), [txs]);

  const providersUsed = useMemo(
    () => Array.from(new Set(txs.map((t) => t.provider))),
    [txs],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Relatório de Maquininha"
        subtitle="Transações de cartão nas maquininhas físicas conectadas · NSU, autorização e taxas"
        action={
          <button
            onClick={async () => { setExporting(true); try { await exportToExcel(filtered); } finally { setExporting(false); } }}
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
            { label: "Total",       value: counts.total,    color: "text-slate-900" },
            { label: "Aprovadas",   value: counts.approved, color: "text-emerald-500" },
            { label: "Pendentes",   value: counts.pending,  color: "text-blue-500" },
            { label: "Com erro",    value: counts.error,    color: "text-rose-500" },
          ].map((k) => (
            <div key={k.label} className="flex-1 px-5 py-4 flex flex-col gap-0.5">
              <span className={cn("text-2xl font-black tracking-tight font-mono leading-none", k.color)}>{k.value}</span>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{k.label}</span>
            </div>
          ))}
          <div className="flex-1 px-5 py-4 flex flex-col gap-0.5">
            <span className="text-2xl font-black tracking-tight font-mono leading-none text-slate-900">
              {counts.volume.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </span>
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Volume Aprovado</span>
          </div>
        </div>

        <div className="flex items-center gap-2 px-4 py-3 flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
            <input
              type="text"
              placeholder="Buscar por NSU, autorização, pedido..."
              className="w-full pl-8 pr-3 h-9 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-400 text-[11px] font-medium placeholder:text-slate-300 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select
            value={providerFilter}
            onChange={(e) => setProviderFilter(e.target.value)}
            className="h-9 px-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-bold outline-none focus:border-blue-400 transition-all"
          >
            <option value="all">Todas as maquininhas</option>
            {providersUsed.map((p) => (
              <option key={p} value={p}>{PROVIDER_LABELS[p] ?? p}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as TerminalTxStatus | "all")}
            className="h-9 px-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-bold outline-none focus:border-blue-400 transition-all"
          >
            <option value="all">Todos os status</option>
            {Object.entries(STATUS_META).map(([key, meta]) => (
              <option key={key} value={key}>{meta.label}</option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-t border-slate-100 bg-slate-50/60">
                {["Data", "Maquininha", "Pedido", "Status", "Modo", "Bandeira", "NSU", "Autorização", "Valor"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-slate-400 text-xs">Carregando...</td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-slate-400 text-xs">Nenhuma transação encontrada</td></tr>
              )}
              {!loading && filtered.map((t) => {
                const meta = STATUS_META[t.status] ?? STATUS_META.error;
                return (
                  <tr key={t.id} className="border-t border-slate-100 hover:bg-slate-50/60 transition-colors">
                    <td className="px-4 py-2.5 text-xs text-slate-500 whitespace-nowrap">
                      {new Date(t.created_at).toLocaleString("pt-BR")}
                    </td>
                    <td className="px-4 py-2.5 text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <Terminal size={12} className="text-slate-400" /> {PROVIDER_LABELS[t.provider] ?? t.provider}
                    </td>
                    <td className="px-4 py-2.5 text-xs font-mono text-blue-600">
                      {t.order_id ? `#${String(t.order_id).padStart(6, "0")}` : "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide", meta.bg, meta.color)}>
                        {meta.icon} {meta.label}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-500">{t.mode === "debit" ? "Débito" : "Crédito"}{t.installments > 1 ? ` ${t.installments}x` : ""}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-500 uppercase">{t.brand ?? "—"}</td>
                    <td className="px-4 py-2.5 text-[10px] font-mono text-slate-400">{t.nsu ?? "—"}</td>
                    <td className="px-4 py-2.5 text-[10px] font-mono text-slate-400">{t.authorization_code ?? "—"}</td>
                    <td className="px-4 py-2.5 text-xs font-bold font-mono text-slate-700">
                      {Number(t.amount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
