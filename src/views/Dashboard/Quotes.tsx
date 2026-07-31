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
} from "lucide-react";
import { cn } from "../../lib/utils";
import PageHeader from "../../components/layout/PageHeader";
import { downloadHtmlAsPdf } from "../../lib/pdf";
import { buildDocumentHeaderHtml, buildDocumentTableHtml, DOCUMENT_BASE_CSS, fmtMoney } from "../../lib/documentPdf";

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
  status: "rascunho" | "open" | "converted" | "cancelled" | "expired";
  deposit_amount?: number | null;
  created_at: string;
  items: QuoteItem[];
  services: QuoteServiceRow[];
}

interface Tenant {
  name: string;
  document?: string;
  logo_url?: string;
  whatsapp?: string;
  address_street?: string;
  address_number?: string;
  address_complement?: string;
  address_district?: string;
  address_city?: string;
  address_state?: string;
  address_zip?: string;
  address?: string;
  primary_color?: string;
  razao_social?: string;
  inscricao_estadual?: string;
  inscricao_municipal?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const authHeader = () => ({
  Authorization: `Bearer ${localStorage.getItem("token")}`,
  "Content-Type": "application/json",
});

function statusLabel(s: string) {
  const map: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    rascunho:  { label: "Rascunho",   color: "text-slate-500 bg-slate-100", icon: <Clock size={12} /> },
    open:      { label: "Aberto",     color: "text-blue-600 bg-blue-50",    icon: <Clock size={12} /> },
    converted: { label: "Convertido", color: "text-emerald-600 bg-emerald-50", icon: <CheckCircle2 size={12} /> },
    cancelled: { label: "Cancelado",  color: "text-red-600 bg-red-50",      icon: <XCircle size={12} /> },
    expired:   { label: "Expirado",   color: "text-orange-600 bg-orange-50",icon: <Clock size={12} /> },
  };
  return map[s] ?? map.open;
}

function quoteItemUnit(dimLabel?: string | null): string {
  if (!dimLabel) return "UN";
  return /m²|m2/i.test(dimLabel) ? "M²" : "UN";
}

async function generateQuotePDF(quote: Quote, tenant: Tenant) {
  const brandColor = tenant.primary_color ?? "#2563eb";
  const dateStr = new Date(quote.created_at).toLocaleDateString("pt-BR");
  const validUntil = new Date(
    new Date(quote.created_at).getTime() + quote.validity_days * 86400000
  ).toLocaleDateString("pt-BR");

  const header = buildDocumentHeaderHtml(tenant, {
    docTitle: "Orçamento",
    docNumber: String(quote.number).padStart(4, "0"),
    docDateLabel: "Emitido em",
    docDate: dateStr,
    extraTopRight: [`Válido até ${validUntil}`],
  });

  const itemsTable = buildDocumentTableHtml(
    [
      { label: "Cód", align: "center", width: "45px" },
      { label: "Descrição" },
      { label: "Un", align: "center", width: "40px" },
      { label: "Qtd", align: "center", width: "45px" },
      { label: "Preço Unit.", align: "right", width: "85px" },
      { label: "Total", align: "right", width: "85px" },
    ],
    [
      ...quote.items.map((i) => ({
        cells: [
          i.product_id ? String(i.product_id) : "—",
          i.name,
          quoteItemUnit(i.dimensions_label),
          String(i.quantity),
          fmtMoney(Number(i.unit_price)),
          fmtMoney(Number(i.total)),
        ],
        sub: i.dimensions_label ?? undefined,
      })),
      ...(quote.services ?? []).map((s) => ({
        cells: [
          "SERV",
          s.name,
          "UN",
          String(s.quantity),
          fmtMoney(Number(s.unit_price)),
          fmtMoney(Number(s.unit_price) * s.quantity),
        ],
      })),
    ],
  );

  const discountAmt = quote.discount_value > 0
    ? (quote.discount_type === "percent"
        ? (Number(quote.subtotal) * Number(quote.discount_value)) / 100
        : Number(quote.discount_value))
    : 0;
  const discountLabel = quote.discount_type === "percent"
    ? `Desconto (${quote.discount_value}%)`
    : "Desconto";

  const depositAmt = Number(quote.deposit_amount ?? 0);
  const remaining = Math.max(0, Number(quote.total_amount) - depositAmt);

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8"/>
<title>Orçamento #${String(quote.number).padStart(4, "0")}</title>
<style>
  :root { --doc-brand: ${brandColor}; }
  ${DOCUMENT_BASE_CSS}
</style>
</head>
<body>

${header}

<div class="doc-section">
  <div class="doc-section-label">Cliente</div>
  <div class="doc-info-grid">
    <div class="doc-info-row"><b>${quote.customer_name}</b></div>
    ${[quote.customer_phone, quote.customer_email].filter(Boolean).length
      ? `<div class="doc-info-row">${[quote.customer_phone, quote.customer_email].filter(Boolean).join("  |  ")}</div>`
      : ""}
  </div>
</div>

<div class="doc-section">
  <div class="doc-section-label">Itens / Serviços</div>
  ${itemsTable}
</div>

<div class="doc-section">
  <div class="doc-totals">
    <div class="doc-totals-box">
      <div class="doc-totals-row"><span>Subtotal</span><span>${fmtMoney(Number(quote.subtotal))}</span></div>
      ${discountAmt > 0 ? `<div class="doc-totals-row"><span>${discountLabel}</span><span>- ${fmtMoney(discountAmt)}</span></div>` : ""}
      <div class="doc-totals-row grand"><span>TOTAL</span><span>${fmtMoney(Number(quote.total_amount))}</span></div>
      ${depositAmt > 0 ? `
      <div class="doc-totals-row" style="margin-top:8px"><span>Entrada paga</span><span>${fmtMoney(depositAmt)}</span></div>
      <div class="doc-totals-row"><span>Restante</span><span>${fmtMoney(remaining)}</span></div>` : ""}
    </div>
  </div>
</div>

${quote.notes ? `
<div class="doc-section">
  <div class="doc-section-label">Observações / Condições de Pagamento</div>
  <div class="doc-obs-box">${quote.notes}</div>
</div>` : ""}

<div class="doc-section" style="font-size:10px;color:#94a3b8;font-style:italic;">
  Este orçamento é válido por ${quote.validity_days} dia(s) a partir de ${dateStr} (até ${validUntil}).
</div>

<div class="doc-footer">
  Documento emitido em ${new Date().toLocaleString("pt-BR")} — Este documento não tem valor fiscal.
</div>

</body>
</html>`;

  await downloadHtmlAsPdf(html, `orcamento-${String(quote.number).padStart(4, "0")}-${quote.customer_name.replace(/\s+/g, "-")}.pdf`);
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
    open: quotes.filter((q) => q.status === "open").length,
    converted: quotes.filter((q) => q.status === "converted").length,
    totalValue: quotes.filter((q) => q.status === "open").reduce((s, q) => s + Number(q.total_amount), 0),
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
        {["all", "rascunho", "open", "converted", "cancelled"].map((s) => (
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
            {{ all: "Todos", rascunho: "Rascunhos", open: "Abertos", converted: "Convertidos", cancelled: "Cancelados" }[s]}
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
