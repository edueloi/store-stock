import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users, UserPlus, Phone, Search,
  AlertTriangle, X, ChevronRight, ChevronLeft, ChevronDown,
  DollarSign, CheckCircle2,
  TrendingDown, AlertCircle,
  Loader2, LayoutGrid, List, MapPin, Mail, StickyNote, WalletCards,
  HelpCircle, Download, Upload, FileSpreadsheet, FileText,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../../lib/utils";
import { Button, IconButton, Input, Textarea, Select, Modal, ModalFooter, Badge, Alert, EmptyState, ContentCard, PanelCard, DetailField, SectionTitle, StatGrid, StatCard, Tabs, GridTable, Pagination, FilterLine, FilterLineSection, FilterLineSearch, FilterLineViewToggle } from "../../components/ui";
import type { Column } from "../../components/ui";
import { DropdownMenu } from "../../components/ui/Dropdown";
import CustomersPageTour, { type CustomersPageTourHandle } from "../../components/onboarding/CustomersPageTour";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Customer {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  document?: string;
  address?: string;
  address_street?: string;
  address_number?: string;
  address_complement?: string;
  address_district?: string;
  address_city?: string;
  address_state?: string;
  address_zip?: string;
  address_country?: string;
  notes?: string;
  credit_limit?: number;
  consignment_limit?: number;
  birth_date?: string;
  risk_flag: boolean;
  risk_reason?: string;
  created_at: string;
  total_debt?: number;
  open_debts?: number;
  legal_name?: string;
  trade_name?: string;
  cnae_code?: string;
  cnae_description?: string;
  legal_nature?: string;
  registration_status?: string;
  registration_status_date?: string;
  // ── Campos expandidos (import/export planilha) ──
  external_code?: string;
  contact_name?: string;
  fax?: string;
  website?: string;
  person_type?: "physical" | "legal";
  state_registration?: string;
  state_registration_exempt?: boolean;
  status?: "active" | "inactive";
  marital_status?: string;
  profession?: string;
  gender?: string;
  birthplace?: string;
  father_name?: string;
  father_document?: string;
  mother_name?: string;
  mother_document?: string;
  segment?: string;
  seller_id?: number | null;
  seller?: { id: number; name: string } | null;
  contact_type?: string;
  nfe_email?: string;
  customer_since?: string;
  next_visit_at?: string;
  tax_regime?: string;
}

interface ImportSummary {
  created: number;
  updated: number;
  errors: { row: number; message: string }[];
}

interface Debtor {
  customer_id: number;
  customer_name: string;
  customer_phone?: string;
  risk_flag: boolean;
  total_debt: number;
  open_debts: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString("pt-BR");

const authH = () => ({
  Authorization: `Bearer ${localStorage.getItem("token")}`,
  "Content-Type": "application/json",
});

function maskPhone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 10) return d.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3").replace(/-$/, "");
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3").replace(/-$/, "");
}

// ─── Main Component ───────────────────────────────────────────────────────────

type MainTab = "customers" | "debtors";
type CustomerViewMode = "grid" | "table";

const CUSTOMER_VIEW_MODE_PREF = "customers_view_mode";

function getCachedViewMode(): CustomerViewMode {
  try {
    return localStorage.getItem(CUSTOMER_VIEW_MODE_PREF) === "table" ? "table" : "grid";
  } catch {
    return "grid";
  }
}

const MAIN_TABS = [
  { id: "customers", label: "Todos os Clientes", icon: Users },
  { id: "debtors", label: "Com pendências", icon: TrendingDown },
] as const satisfies readonly { id: MainTab; label: string; icon: React.ElementType; badge?: number }[];

export default function Customers() {
  const navigate = useNavigate();
  const [mainTab, setMainTab] = useState<MainTab>("customers");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [debtors, setDebtors]     = useState<Debtor[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState("");
  const [viewMode, setViewMode]   = useState<CustomerViewMode>(getCachedViewMode);
  const [pageSize, setPageSize]   = useState(25);
  const [currentPage, setCurrentPage] = useState(1);

  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const importFileInputRef = useRef<HTMLInputElement>(null);

  // Generic confirmation dialog (replaces window.confirm)
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    onConfirm: () => void | Promise<void>;
  } | null>(null);
  const [confirming, setConfirming] = useState(false);

  const customersPageTourRef = useRef<CustomersPageTourHandle>(null);

  // ── fetch

  const fetchAll = useCallback(async () => {
    const h = { Authorization: `Bearer ${localStorage.getItem("token")}` };
    try {
      const [cRes, dRes] = await Promise.all([
        fetch("/api/customers", { headers: h }),
        fetch("/api/customers/debtors", { headers: h }),
      ]);
      const cData = await cRes.json();
      const dData = await dRes.json();
      setCustomers(Array.isArray(cData) ? cData : []);
      setDebtors(Array.isArray(dData) ? dData : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Mantém a escolha Grade/Tabela por usuário, inclusive ao abrir o sistema em outro dispositivo.
  useEffect(() => {
    let active = true;
    const loadViewPreference = async () => {
      try {
        const res = await fetch(`/api/preferences/${CUSTOMER_VIEW_MODE_PREF}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        });
        const value = await res.json();
        if (active && (value === "grid" || value === "table")) {
          setViewMode(value);
          localStorage.setItem(CUSTOMER_VIEW_MODE_PREF, value);
        }
      } catch {
        // A preferência local mantém a tela utilizável mesmo sem conexão.
      }
    };
    loadViewPreference();
    return () => { active = false; };
  }, []);

  const changeViewMode = (mode: CustomerViewMode) => {
    setViewMode(mode);
    try { localStorage.setItem(CUSTOMER_VIEW_MODE_PREF, mode); } catch { /* sem armazenamento local */ }
    fetch(`/api/preferences/${CUSTOMER_VIEW_MODE_PREF}`, {
      method: "PUT",
      headers: authH(),
      body: JSON.stringify({ value: mode }),
    }).catch(() => { /* cache local já foi atualizado */ });
  };

  function handleDelete(id: number) {
    setConfirmDialog({
      title: "Excluir cliente",
      message: "Excluir este cliente? Todas as dívidas e notas serão removidas.",
      onConfirm: async () => {
        await fetch(`/api/customers/${id}`, { method: "DELETE", headers: authH() });
        fetchAll();
      },
    });
  }

  // ── Export / Import planilha ──

  async function handleExport(format: "xlsx" | "csv") {
    setExporting(true);
    setExportMenuOpen(false);
    try {
      const res = await fetch(`/api/customers/export?format=${format}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `clientes_${new Date().toISOString().split("T")[0]}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  function handleImportClick() {
    importFileInputRef.current?.click();
  }

  async function handleImportFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite reimportar o mesmo arquivo depois
    if (!file) return;
    setImporting(true);
    setImportSummary(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/customers/import", {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        setImportSummary(data);
        await fetchAll();
      } else {
        setImportSummary({ created: 0, updated: 0, errors: [{ row: 0, message: data?.error ?? "Falha ao importar planilha" }] });
      }
    } catch {
      setImportSummary({ created: 0, updated: 0, errors: [{ row: 0, message: "Falha de conexão ao importar planilha" }] });
    } finally {
      setImporting(false);
    }
  }

  // ── filters

  const filteredCustomers = customers.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.phone && c.phone.includes(search)) ||
    (c.email && c.email.toLowerCase().includes(search.toLowerCase()))
  );

  const filteredDebtors = debtors.filter((d) =>
    d.customer_name.toLowerCase().includes(search.toLowerCase()) ||
    (d.customer_phone && d.customer_phone.includes(search))
  );

  const totalDebt = debtors.reduce((s, d) => s + d.total_debt, 0);

  useEffect(() => { setCurrentPage(1); }, [search, mainTab, viewMode, pageSize]);

  const pagedItems = mainTab === "customers" ? filteredCustomers : filteredDebtors;
  const totalPages = Math.max(1, Math.ceil(pagedItems.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const pagedCustomers = filteredCustomers.slice((safePage - 1) * pageSize, safePage * pageSize);
  const pagedDebtors = filteredDebtors.slice((safePage - 1) * pageSize, safePage * pageSize);

  // ─────────────────────────────────────────────────────────────────────────────

  const customerColumns: Column<Customer>[] = [
    { header: "Cliente", render: (c) => <span className="break-words text-xs font-medium text-slate-800">{c.name}</span> },
    { header: "Telefone", render: (c) => <span className="text-xs text-slate-500">{(c.phone && maskPhone(c.phone)) || "–"}</span> },
    { header: "Cidade", render: (c) => <span className="text-xs text-slate-500">{[c.address_city, c.address_state].filter(Boolean).join(" - ") || "–"}</span> },
    {
      header: "Saldo em aberto",
      className: "text-right",
      headerClassName: "text-right",
      render: (c) => <span className="whitespace-nowrap text-xs font-semibold tabular-nums text-red-600">{(c.total_debt ?? 0) > 0 ? fmt(c.total_debt!) : "–"}</span>,
    },
    {
      header: "Risco",
      className: "text-center",
      headerClassName: "text-center",
      render: (c) => c.risk_flag ? <AlertTriangle size={14} className="mx-auto text-rose-500" /> : <span className="text-xs text-slate-300">—</span>,
    },
    { header: "Cliente desde", render: (c) => <span className="text-xs text-slate-500">{fmtDate(c.customer_since ?? c.created_at)}</span> },
    {
      header: "Ação",
      className: "text-right",
      headerClassName: "text-right",
      render: (c) => <span className="text-[11px] font-medium text-blue-600">Ver ficha</span>,
    },
  ];

  const debtorColumns: Column<Debtor>[] = [
    { header: "Cliente", render: (d) => <span className="break-words text-xs font-medium text-slate-800">{d.customer_name}</span> },
    { header: "Telefone", render: (d) => <span className="text-xs text-slate-500">{(d.customer_phone && maskPhone(d.customer_phone)) || "–"}</span> },
    {
      header: "Parcelas",
      className: "text-center",
      headerClassName: "text-center",
      render: (d) => <Badge pill>{d.open_debts}</Badge>,
    },
    {
      header: "Saldo em aberto",
      className: "text-right",
      headerClassName: "text-right",
      render: (d) => <span className="whitespace-nowrap text-xs font-semibold tabular-nums text-red-600">{fmt(d.total_debt)}</span>,
    },
    {
      header: "Risco",
      className: "text-center",
      headerClassName: "text-center",
      render: (d) => d.risk_flag ? <AlertTriangle size={14} className="mx-auto text-rose-500" /> : <span className="text-xs text-slate-300">—</span>,
    },
    {
      header: "Ação",
      className: "text-right",
      headerClassName: "text-right",
      render: () => <span className="text-[11px] font-medium text-blue-600">Ver ficha</span>,
    },
  ];

  return (
    <div data-tour="customers-page" className="min-w-0 space-y-4">
      <SectionTitle
        title="Clientes"
        icon={Users}
        description="Clientes, crédito, histórico de compras e notas internas"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button data-tour="customers-new-btn" size="sm" iconLeft={<UserPlus size={14} />} onClick={() => navigate("/admin/customers/novo")}>
              Novo Cliente
            </Button>
            <DropdownMenu
              trigger={
                <Button
                  variant="outline"
                  size="sm"
                  iconLeft={<Download size={14} />}
                  iconRight={<ChevronDown size={12} />}
                  loading={exporting}
                  title="Exportar clientes para planilha"
                >
                  <span className="sr-only sm:not-sr-only">Exportar planilha</span>
                </Button>
              }
              items={[
                { label: "Excel (.xlsx)", icon: <FileSpreadsheet size={14} className="text-emerald-600" />, onClick: () => handleExport("xlsx") },
                { label: "CSV (.csv)", icon: <FileText size={14} className="text-blue-600" />, onClick: () => handleExport("csv") },
              ]}
            />
            <Button
              variant="outline"
              size="sm"
              iconLeft={<Upload size={14} />}
              loading={importing}
              onClick={handleImportClick}
              title="Importar clientes de planilha Excel ou CSV"
            >
              <span className="sr-only sm:not-sr-only">Importar planilha</span>
            </Button>
            <input
              ref={importFileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              aria-label="Importar planilha de clientes"
              onChange={handleImportFileChange}
            />
            <Button
              variant="outline"
              size="sm"
              iconLeft={<HelpCircle size={14} />}
              onClick={() => customersPageTourRef.current?.start()}
              title="Tour guiado desta página"
            >
              <span className="sr-only sm:not-sr-only">Ajuda</span>
            </Button>
          </div>
        }
      />

      <CustomersPageTour ref={customersPageTourRef} />

      {/* Stats */}
      <StatGrid cols={4}>
        <StatCard title="Total Clientes" value={customers.length} icon={Users} color="default" />
        <StatCard title="Com Pendências" value={debtors.length} icon={AlertCircle} color="warning" />
        <StatCard title="Saldo em Aberto" value={fmt(totalDebt)} icon={DollarSign} color="danger" />
        <StatCard title="Clientes em Risco" value={customers.filter(c => c.risk_flag).length} icon={AlertTriangle} color="purple" />
      </StatGrid>

      {/* Busca + modo de exibição */}
      <FilterLine>
        <FilterLineSection grow>
          <FilterLineSearch
            aria-label={mainTab === "customers" ? "Buscar cliente" : "Buscar cliente com pendência"}
            value={search}
            onChange={setSearch}
            placeholder={mainTab === "customers" ? "Buscar cliente…" : "Buscar cliente com pendência…"}
          />
        </FilterLineSection>
        {mainTab === "customers" && (
          <FilterLineSection align="right">
            <FilterLineViewToggle<CustomerViewMode>
              value={viewMode}
              onChange={changeViewMode}
              gridValue="grid"
              listValue="table"
            />
          </FilterLineSection>
        )}
      </FilterLine>

      {/* Main tabs */}
      <Tabs<MainTab>
        items={MAIN_TABS.map((t) => (t.id === "debtors" ? { ...t, badge: debtors.length } : t))}
        value={mainTab}
        onChange={setMainTab}
        label="Listas de clientes"
      >
      {/* ── CUSTOMERS LIST ─────────────────────────────────────────────────── */}
      {mainTab === "customers" && (
        <div className="space-y-3">
          {!loading && filteredCustomers.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Nenhum cliente encontrado"
              description={search ? "Ajuste a busca para ver outros clientes." : undefined}
              action={<Button size="sm" onClick={() => navigate("/admin/customers/novo")}>Cadastrar cliente</Button>}
            />
          ) : loading ? (
            <div role="status" className="flex justify-center py-12 text-sm text-slate-500">Carregando…</div>
          ) : viewMode === "grid" ? (
            <>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
              <AnimatePresence>
                {pagedCustomers.map((c) => {
                  const hasDebt = Number(c.total_debt ?? 0) > 0;
                  const hasCreditLimit = Number(c.credit_limit ?? 0) > 0;
                  const location = [c.address_city, c.address_state].filter(Boolean).join(" · ") || c.address;
                  const preference = c.notes?.trim();

                  return (
                  <motion.article
                    key={c.id}
                    layout
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    onClick={() => navigate(`/admin/customers/${c.id}`)}
                    className={cn(
                      "group flex min-w-0 cursor-pointer flex-col gap-3 rounded-lg border bg-white p-3 transition-all hover:border-blue-200",
                      c.risk_flag ? "border-rose-200" : "border-slate-200"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className={cn(
                          "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border text-base font-semibold",
                          c.risk_flag ? "border-rose-200 bg-rose-50 text-rose-500" : "border-blue-100 bg-blue-50 text-blue-600"
                        )}>
                          {c.name[0]}
                        </div>
                        <div className="min-w-0">
                          <p className="line-clamp-2 break-words text-[13px] font-semibold leading-tight text-slate-900">{c.name}</p>
                          <p className="mt-1 text-[11px] text-slate-500">Cliente desde {fmtDate(c.customer_since ?? c.created_at)}</p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        {c.risk_flag && (
                          <span title="Cliente em risco">
                            <Badge color="danger" icon={<AlertTriangle size={11} />}>Risco</Badge>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-2 border-y border-slate-100 py-3 min-[430px]:grid-cols-2">
                      <div className="flex min-w-0 items-center gap-2 text-slate-500">
                        {c.phone ? <Phone size={13} className="shrink-0 text-blue-500" /> : <Mail size={13} className="shrink-0 text-blue-500" />}
                        <span className="truncate text-[11px] font-medium">{(c.phone && maskPhone(c.phone)) || c.email || "Contato não informado"}</span>
                      </div>
                      <div className="flex min-w-0 items-center gap-2 text-slate-500">
                        <MapPin size={13} className="shrink-0 text-blue-500" />
                        <span className="truncate text-[11px] font-medium">{location || "Endereço não informado"}</span>
                      </div>
                    </div>

                    {preference && (
                      <div className="flex min-w-0 items-start gap-2 rounded-lg bg-blue-50/70 px-3 py-2 text-blue-800">
                        <StickyNote size={13} className="mt-0.5 shrink-0 text-blue-500" />
                        <div className="min-w-0">
                          <p className="text-[11px] font-medium text-blue-500">Preferências</p>
                          <p className="mt-0.5 line-clamp-2 break-words text-[11px] leading-relaxed">{preference}</p>
                        </div>
                      </div>
                    )}

                    <div className="mt-auto flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        {hasDebt ? (
                          <p className="text-[11px] font-semibold text-rose-600">Em aberto: {fmt(Number(c.total_debt))}</p>
                        ) : hasCreditLimit ? (
                          <p className="flex items-center gap-1 text-[11px] font-medium text-slate-500"><WalletCards size={12} /> Limite: {fmt(Number(c.credit_limit))}</p>
                        ) : (
                          <p className="text-[11px] font-medium text-emerald-600">Sem pendências</p>
                        )}
                      </div>
                      <span className="flex shrink-0 items-center gap-0.5 text-[11px] font-medium text-blue-600 transition-transform group-hover:translate-x-0.5">
                        Ver ficha <ChevronRight size={11} />
                      </span>
                    </div>
                  </motion.article>
                )})}
              </AnimatePresence>
            </div>
            <Pagination
              total={filteredCustomers.length}
              page={safePage}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
            />
            </>
          ) : (
            <ContentCard padding="none" className="overflow-hidden">
              <GridTable<Customer>
                noDesktopCard
                data={pagedCustomers}
                columns={customerColumns}
                keyExtractor={(c) => c.id}
                onRowClick={(c) => navigate(`/admin/customers/${c.id}`)}
                pagination={{
                  total: filteredCustomers.length,
                  page: safePage,
                  pageSize,
                  onPageChange: setCurrentPage,
                  onPageSizeChange: setPageSize,
                }}
              />
            </ContentCard>
          )}
        </div>
      )}

      {/* ── DEBTORS LIST ───────────────────────────────────────────────────── */}
      {mainTab === "debtors" && (
        <div className="space-y-3">
          {filteredDebtors.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="Nenhum cliente com pendência em aberto"
              description={search ? "Ajuste a busca para ver outros clientes." : undefined}
            />
          ) : (
            <ContentCard padding="none" className="overflow-hidden">
              <GridTable<Debtor>
                noDesktopCard
                data={pagedDebtors}
                columns={debtorColumns}
                keyExtractor={(d) => d.customer_id}
                onRowClick={(d) => navigate(`/admin/customers/${d.customer_id}`)}
                pagination={{
                  total: filteredDebtors.length,
                  page: safePage,
                  pageSize,
                  onPageChange: setCurrentPage,
                  onPageSizeChange: setPageSize,
                }}
              />
              <div className="flex items-center justify-between border-t border-red-100 bg-red-50 px-3 py-2">
                <span className="text-[11px] font-medium text-red-500">Total em aberto</span>
                <span className="text-xs font-semibold tabular-nums text-red-600">{fmt(totalDebt)}</span>
              </div>
            </ContentCard>
          )}
        </div>
      )}
      </Tabs>

      <Modal
        open={!!confirmDialog}
        onClose={() => { if (!confirming) setConfirmDialog(null); }}
        title={confirmDialog?.title ?? ""}
        size="sm"
        footer={
          <ModalFooter>
            <Button variant="outline" onClick={() => setConfirmDialog(null)} disabled={confirming}>Cancelar</Button>
            <Button
              variant="danger"
              loading={confirming}
              onClick={async () => {
                if (!confirmDialog) return;
                setConfirming(true);
                try {
                  await confirmDialog.onConfirm();
                  setConfirmDialog(null);
                } finally {
                  setConfirming(false);
                }
              }}
            >
              Confirmar
            </Button>
          </ModalFooter>
        }
      >
        <p className="text-[13px] text-slate-600">{confirmDialog?.message}</p>
      </Modal>

      {/* Resumo da importação de planilha */}
      <Modal
        open={!!importSummary}
        onClose={() => setImportSummary(null)}
        title="Resultado da Importação"
        size="md"
        footer={<ModalFooter><Button onClick={() => setImportSummary(null)}>Fechar</Button></ModalFooter>}
      >
        {importSummary && (
          <div className="space-y-3">
            <StatGrid cols={3}>
              <StatCard title="Criados" value={importSummary.created} icon={CheckCircle2} color="success" />
              <StatCard title="Atualizados" value={importSummary.updated} icon={Users} color="info" />
              <StatCard title="Erros" value={importSummary.errors.length} icon={AlertTriangle} color="danger" />
            </StatGrid>
            {importSummary.errors.length > 0 && (
              <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-200">
                <table className="w-full text-xs">
                  <thead className="bg-zinc-50 text-[11px] font-medium text-slate-500">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Linha</th>
                      <th className="px-3 py-2 text-left font-medium">Erro</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {importSummary.errors.map((e, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2 text-slate-600">{e.row || "–"}</td>
                        <td className="px-3 py-2 text-slate-600">{e.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
