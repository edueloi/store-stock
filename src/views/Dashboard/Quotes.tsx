import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  FileText,
  Plus,
  Trash2,
  Download,
  CheckCircle2,
  Clock,
  XCircle,
  Palette,
  PenTool,
  HelpCircle,
} from "lucide-react";
import {
  Button, IconButton, Badge, SectionTitle, StatGrid, StatCard, ContentCard, EmptyState,
  FilterLine, FilterLineSection, FilterLineItem, FilterLineSearch, FilterLineSegmented,
  GridTable, usePagination,
} from "../../components/ui";
import type { Column } from "../../components/ui";
import { generateQuotePDF } from "../../lib/quotePdf";
import type { DocumentTenant } from "../../lib/documentPdf";
import QuotesPageTour, { type QuotesPageTourHandle } from "../../components/onboarding/QuotesPageTour";

type BadgeColor = "default" | "primary" | "success" | "warning" | "danger" | "info" | "purple" | "orange" | "teal";

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

function statusLabel(s: string): { label: string; color: BadgeColor; icon: React.ReactNode } {
  const map: Record<string, { label: string; color: BadgeColor; icon: React.ReactNode }> = {
    rascunho:  { label: "Rascunho",   color: "default", icon: <Clock size={12} /> },
    orcamento_enviado: { label: "Aberto", color: "info",    icon: <Clock size={12} /> },
    aguardando_aprovacao: { label: "Aguardando Aprovação", color: "warning", icon: <Clock size={12} /> },
    aprovado: { label: "Aprovado", color: "teal", icon: <CheckCircle2 size={12} /> },
    aguardando_arte: { label: "Aguardando Arte", color: "purple", icon: <Palette size={12} /> },
    arte_finalizada: { label: "Arte Finalizada", color: "purple", icon: <PenTool size={12} /> },
    converted: { label: "Convertido", color: "success", icon: <CheckCircle2 size={12} /> },
    cancelled: { label: "Cancelado",  color: "danger",      icon: <XCircle size={12} /> },
    expired:   { label: "Expirado",   color: "orange",icon: <Clock size={12} /> },
  };
  return map[s] ?? map.orcamento_enviado;
}

const STATUS_FILTERS = [
  { value: "all", label: "Todos" },
  { value: "rascunho", label: "Rascunhos" },
  { value: "orcamento_enviado", label: "Abertos" },
  { value: "converted", label: "Convertidos" },
  { value: "cancelled", label: "Cancelados" },
];

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Quotes() {
  const navigate = useNavigate();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const quotesPageTourRef = useRef<QuotesPageTourHandle>(null);

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

  // ── Filter (rascunhos agora aparecem também na aba "Todos") ──
  const filtered = quotes.filter((q) => {
    const matchStatus = statusFilter === "all" ? true : q.status === statusFilter;
    const matchSearch =
      !searchTerm ||
      q.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(q.number).includes(searchTerm);
    return matchStatus && matchSearch;
  });

  // ── Stats (total conta todos, incluindo rascunhos, já que agora aparecem na lista;
  // totalValue continua restrito a orçamentos em aberto para não contar valor de rascunho) ──
  const stats = {
    total: quotes.length,
    open: quotes.filter((q) => q.status === "orcamento_enviado").length,
    converted: quotes.filter((q) => q.status === "converted").length,
    totalValue: quotes.filter((q) => q.status === "orcamento_enviado").reduce((s, q) => s + Number(q.total_amount), 0),
  };

  const pg = usePagination(filtered, 15);

  const columns: Column<Quote>[] = [
    { header: "Nº", render: (q) => <span className="font-mono text-xs text-slate-500">#{String(q.number).padStart(4, "0")}</span> },
    { header: "Cliente", render: (q) => <span className="text-xs font-medium text-slate-800">{q.customer_name || "—"}</span> },
    { header: "Data", className: "hidden md:table-cell", headerClassName: "hidden md:table-cell", render: (q) => <span className="text-xs whitespace-nowrap text-slate-500">{new Date(q.created_at).toLocaleDateString("pt-BR")}</span> },
    { header: "Validade", className: "hidden lg:table-cell", headerClassName: "hidden lg:table-cell", render: (q) => <span className="text-xs text-slate-500">{q.validity_days}d</span> },
    { header: "Total", className: "text-right", headerClassName: "text-right", render: (q) => <span className="text-xs font-semibold tabular-nums whitespace-nowrap text-slate-800">{fmt(Number(q.total_amount))}</span> },
    { header: "Status", render: (q) => { const st = statusLabel(q.status); return <Badge color={st.color} size="sm" icon={st.icon}>{st.label}</Badge>; } },
    {
      header: "Ações",
      className: "text-right",
      headerClassName: "text-right",
      render: (q) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          {q.status !== "rascunho" && (
            <IconButton size="xs" variant="ghost" aria-label="Baixar PDF" title="Baixar PDF" onClick={() => handleDownloadPDF(q)}>
              <Download size={14} />
            </IconButton>
          )}
          <IconButton size="xs" variant="ghost" aria-label="Excluir" title="Excluir" onClick={() => handleDelete(q.id)}>
            <Trash2 size={14} />
          </IconButton>
        </div>
      ),
    },
  ];

  return (
    <div data-tour="quotes-page" className="space-y-4">
      <SectionTitle
        title="Orçamentos"
        description="Crie orçamentos profissionais e converta em vendas"
        icon={FileText}
        action={
          <>
            <Button
              size="sm"
              data-tour="quotes-new-btn"
              iconLeft={<Plus size={14} />}
              onClick={() => navigate("/admin/orcamentos/novo")}
            >
              Novo Orçamento
            </Button>
            <Button
              size="sm"
              variant="outline"
              iconLeft={<HelpCircle size={14} />}
              onClick={() => quotesPageTourRef.current?.start()}
              title="Tour guiado desta página"
            >
              <span className="sr-only sm:not-sr-only">Ajuda</span>
            </Button>
          </>
        }
      />

      <QuotesPageTour ref={quotesPageTourRef} />

      <StatGrid cols={4}>
        <StatCard title="Total" value={stats.total} icon={FileText} color="info" />
        <StatCard title="Em Aberto" value={stats.open} icon={Clock} color="info" />
        <StatCard title="Convertidos" value={stats.converted} icon={CheckCircle2} color="success" />
        <StatCard title="Valor em Aberto" value={fmt(stats.totalValue)} icon={FileText} color="warning" />
      </StatGrid>

      <FilterLine>
        <FilterLineSection grow>
          <FilterLineItem grow minWidth={200}>
            <FilterLineSearch
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Buscar por cliente ou número..."
              aria-label="Buscar orçamentos"
            />
          </FilterLineItem>
          <FilterLineSegmented value={statusFilter} onChange={(v) => setStatusFilter(String(v))} options={STATUS_FILTERS} />
        </FilterLineSection>
      </FilterLine>

      <ContentCard padding="none" data-tour="quotes-table">
        <GridTable
          noDesktopCard
          data={pg.paginatedData}
          keyExtractor={(q) => q.id}
          isLoading={loading}
          columns={columns}
          onRowClick={(q) => navigate(`/admin/orcamentos/${q.id}`)}
          emptyMessage={
            <EmptyState
              icon={FileText}
              title="Nenhum orçamento encontrado"
              description={searchTerm || statusFilter !== "all" ? "Ajuste a busca ou o filtro." : "Crie o primeiro orçamento para começar."}
              action={<Button size="sm" onClick={() => navigate("/admin/orcamentos/novo")}>Criar primeiro orçamento</Button>}
            />
          }
          pagination={{ total: filtered.length, page: pg.page, pageSize: pg.pageSize, onPageChange: pg.setPage, onPageSizeChange: pg.setPageSize }}
        />
      </ContentCard>
    </div>
  );
}
