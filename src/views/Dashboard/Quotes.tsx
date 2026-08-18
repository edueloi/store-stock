import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  FileText,
  Plus,
  Search,
  Trash2,
  Download,
  CheckCircle2,
  Clock,
  XCircle,
  Palette,
  PenTool,
} from "lucide-react";
import { cn } from "../../lib/utils";
import PageHeader from "../../components/layout/PageHeader";
import { generateQuotePDF } from "../../lib/quotePdf";
import type { DocumentTenant } from "../../lib/documentPdf";

// ─── Types ────────────────────────────────────────────────────────────────────

interface QuoteItem {
  id?: number;
  product_id?: number;
  name: string;
  quantity: number;
  unit_price: number;
  total: number;
  dimensions_label?: string | null;
}

interface QuoteServiceRow {
  id: number;
  service_id: number;
  name: string;
  unit_price: number;
  quantity: number;
  total: number;
}

interface Quote {
  id: number;
  number: number;
  customer_name: string;
  customer_phone?: string;
  customer_email?: string;
  subtotal: number;
  discount_type: "percent" | "fixed";
  discount_value: number;
  total_amount: number;
  validity_days: number;
  notes?: string;
  status: "rascunho" | "orcamento_enviado" | "aguardando_aprovacao" | "aprovado" | "aguardando_arte" | "arte_finalizada" | "converted" | "cancelled" | "expired";
  deposit_amount?: number | null;
  deposit_payment_method?: string | null;
  created_at: string;
  items: QuoteItem[];
  services: QuoteServiceRow[];
}

type Tenant = DocumentTenant;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const authHeader = () => ({
  Authorization: `Bearer ${localStorage.getItem("token")}`,
  "Content-Type": "application/json",
});

function statusLabel(s: string) {
  const map: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    rascunho:  { label: "Rascunho",   color: "text-slate-500 bg-slate-100", icon: <Clock size={12} /> },
    orcamento_enviado: { label: "Aberto", color: "text-blue-600 bg-blue-50",    icon: <Clock size={12} /> },
    aguardando_aprovacao: { label: "Aguardando Aprovação", color: "text-amber-600 bg-amber-50", icon: <Clock size={12} /> },
    aprovado: { label: "Aprovado", color: "text-teal-600 bg-teal-50", icon: <CheckCircle2 size={12} /> },
    aguardando_arte: { label: "Aguardando Arte", color: "text-fuchsia-600 bg-fuchsia-50", icon: <Palette size={12} /> },
    arte_finalizada: { label: "Arte Finalizada", color: "text-pink-600 bg-pink-50", icon: <PenTool size={12} /> },
    converted: { label: "Convertido", color: "text-emerald-600 bg-emerald-50", icon: <CheckCircle2 size={12} /> },
    cancelled: { label: "Cancelado",  color: "text-red-600 bg-red-50",      icon: <XCircle size={12} /> },
    expired:   { label: "Expirado",   color: "text-orange-600 bg-orange-50",icon: <Clock size={12} /> },
  };
  return map[s] ?? map.orcamento_enviado;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Quotes() {
  const navigate = useNavigate();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const fetchAll = useCallback(async () => {
    const h = { Authorization: `Bearer ${localStorage.getItem("token")}` };
    try {
      const [qRes, tRes] = await Promise.all([
        fetch("/api/quotes", { headers: h }),
        fetch("/api/tenant", { headers: h }),
      ]);
      const qData = await qRes.json();
      const tData = await tRes.json();
      setQuotes(Array.isArray(qData) ? qData : []);
      setTenant(tData);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleDelete = async (id: number) => {
    if (!confirm("Excluir este orçamento?")) return;
    await fetch(`/api/quotes/${id}`, { method: "DELETE", headers: authHeader() });
    fetchAll();
  };

  const handleDownloadPDF = async (q: Quote) => {
    if (!tenant) return;
    await generateQuotePDF(q, tenant);
  };

  // ── Filter (rascunhos ficam fora da lista "Todos" — aparecem só se buscados/filtrados) ──
  const filtered = quotes.filter((q) => {
    const matchStatus = statusFilter === "all" ? q.status !== "rascunho" : q.status === statusFilter;
    const matchSearch =
      !searchTerm ||
      q.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(q.number).includes(searchTerm);
    return matchStatus && matchSearch;
  });

  // ── Stats
  const stats = {
    total: quotes.filter((q) => q.status !== "rascunho").length,
    open: quotes.filter((q) => q.status === "orcamento_enviado").length,
    converted: quotes.filter((q) => q.status === "converted").length,
    totalValue: quotes.filter((q) => q.status === "orcamento_enviado").reduce((s, q) => s + Number(q.total_amount), 0),
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Orçamentos"
        subtitle="Crie orçamentos profissionais e converta em vendas"
        action={
          <button
            onClick={() => navigate("/admin/orcamentos/novo")}
            className="h-9 px-4 bg-blue-600 text-white rounded-lg flex items-center gap-2 text-[12px] font-bold hover:bg-blue-700 transition-all shadow-md shadow-blue-500/20"
          >
            <Plus size={15} /> Novo Orçamento
          </button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Total", value: stats.total, color: "text-slate-700", bg: "bg-slate-50" },
          { label: "Em Aberto", value: stats.open, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Convertidos", value: stats.converted, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Valor em Aberto", value: fmt(stats.totalValue), color: "text-amber-600", bg: "bg-amber-50" },
        ].map((s) => (
          <div key={s.label} className={cn("rounded-xl p-4 border border-white/60 shadow-sm", s.bg)}>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{s.label}</p>
            <p className={cn("text-xl font-black mt-0.5", s.color)}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Search & filter */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por cliente ou número..."
            className="w-full pl-9 pr-3 h-9 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        {["all", "rascunho", "orcamento_enviado", "converted", "cancelled"].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={cn(
              "h-9 px-3 rounded-lg text-[11px] font-bold border transition-all",
              statusFilter === s
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            )}
          >
            {{ all: "Todos", rascunho: "Rascunhos", orcamento_enviado: "Abertos", converted: "Convertidos", cancelled: "Cancelados" }[s]}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16 text-slate-400 text-sm">Carregando…</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-slate-400 gap-3">
          <FileText size={36} strokeWidth={1} />
          <p className="text-sm font-medium">Nenhum orçamento encontrado</p>
          <button
            onClick={() => navigate("/admin/orcamentos/novo")}
            className="mt-1 h-8 px-4 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700"
          >
            Criar primeiro orçamento
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-wider text-slate-500">Nº</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-wider text-slate-500">Cliente</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-wider text-slate-500 hidden md:table-cell">Data</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-wider text-slate-500 hidden lg:table-cell">Validade</th>
                <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-wider text-slate-500">Total</th>
                <th className="px-4 py-3 text-center text-[10px] font-black uppercase tracking-wider text-slate-500">Status</th>
                <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-wider text-slate-500">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((q) => {
                const st = statusLabel(q.status);
                return (
                  <tr key={q.id} onClick={() => navigate(`/admin/orcamentos/${q.id}`)} className="hover:bg-slate-50 transition-colors cursor-pointer">
                    <td className="px-4 py-3 font-mono text-slate-500 text-xs">
                      #{String(q.number).padStart(4, "0")}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-800">{q.customer_name || "—"}</td>
                    <td className="px-4 py-3 text-slate-500 hidden md:table-cell">
                      {new Date(q.created_at).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-4 py-3 text-slate-500 hidden lg:table-cell">
                      {q.validity_days}d
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-slate-800">
                      {fmt(Number(q.total_amount))}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold", st.color)}>
                        {st.icon} {st.label}
                      </span>
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        {q.status !== "rascunho" && (
                          <button
                            onClick={() => handleDownloadPDF(q)}
                            title="Baixar PDF"
                            className="p-1.5 hover:bg-blue-50 text-blue-500 rounded-lg transition-colors"
                          >
                            <Download size={14} />
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(q.id)}
                          title="Excluir"
                          className="p-1.5 hover:bg-red-50 text-red-400 rounded-lg transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
