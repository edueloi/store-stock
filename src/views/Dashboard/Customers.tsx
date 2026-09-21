import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users, UserPlus, Phone, Search,
  AlertTriangle, X, ChevronRight, ChevronLeft,
  DollarSign, CheckCircle2,
  TrendingDown, AlertCircle,
  Loader2, LayoutGrid, List, MapPin, Mail, StickyNote, WalletCards,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../../lib/utils";
import PageHeader from "../../components/layout/PageHeader";
import Modal from "../../components/ui/Modal";
import Button from "../../components/ui/Button";
import StatsGrid from "../../components/ui/StatsGrid";

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

function maskDoc(v: string) {
  const d = v.replace(/\D/g, "");
  if (d.length <= 11) {
    return d.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, "$1.$2.$3-$4").replace(/-$/, "").replace(/\.{1,}$/, "");
  }
  return d.slice(0, 14).replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2})/, "$1.$2.$3/$4-$5").replace(/-$/, "").replace(/\/$/, "");
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

// Rodapé de paginação client-side — mesmo padrão já usado no Catálogo
// (Inventory.tsx), reaproveitado aqui pra manter consistência visual.
function PaginationFooter({
  total, itemLabel, safePage, totalPages, pageSize, onPageChange,
}: {
  total: number; itemLabel: string; safePage: number; totalPages: number; pageSize: number;
  onPageChange: (p: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex flex-col items-center justify-between gap-2 px-1 min-[480px]:flex-row">
      <span className="text-[11px] text-slate-400 font-medium">
        {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, total)} de {total} {itemLabel}{total !== 1 ? "s" : ""}
      </span>
      <div className="flex items-center gap-1">
        <button onClick={() => onPageChange(1)} disabled={safePage === 1}
          className="hidden min-[480px]:flex w-8 h-8 items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:border-blue-400 hover:text-blue-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all text-xs font-bold">
          «
        </button>
        <button onClick={() => onPageChange(Math.max(1, safePage - 1))} disabled={safePage === 1}
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:border-blue-400 hover:text-blue-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
          <ChevronLeft size={14} />
        </button>
        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
          let page: number;
          if (totalPages <= 5) page = i + 1;
          else if (safePage <= 3) page = i + 1;
          else if (safePage >= totalPages - 2) page = totalPages - 4 + i;
          else page = safePage - 2 + i;
          return (
            <button key={page} onClick={() => onPageChange(page)}
              className={cn(
                "w-8 h-8 flex items-center justify-center rounded-lg border text-xs font-bold transition-all",
                page === safePage ? "bg-blue-600 text-white border-blue-600" : "border-slate-200 text-slate-500 hover:border-blue-400 hover:text-blue-600"
              )}>
              {page}
            </button>
          );
        })}
        <button onClick={() => onPageChange(Math.min(totalPages, safePage + 1))} disabled={safePage === totalPages}
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:border-blue-400 hover:text-blue-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
          <ChevronRight size={14} />
        </button>
        <button onClick={() => onPageChange(totalPages)} disabled={safePage === totalPages}
          className="hidden min-[480px]:flex w-8 h-8 items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:border-blue-400 hover:text-blue-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all text-xs font-bold">
          »
        </button>
      </div>
    </div>
  );
}

export default function Customers() {
  const navigate = useNavigate();
  const [mainTab, setMainTab] = useState<MainTab>("customers");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [debtors, setDebtors]     = useState<Debtor[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState("");
  const [viewMode, setViewMode]   = useState<CustomerViewMode>(getCachedViewMode);
  const [pageSize, setPageSize]   = useState(24);
  const [currentPage, setCurrentPage] = useState(1);

  // Customer form (create/edit)
  const [showForm, setShowForm]   = useState(false);
  const [editCust, setEditCust]   = useState<Customer | null>(null);
  const [fName, setFName]         = useState("");
  const [fEmail, setFEmail]       = useState("");
  const [fPhone, setFPhone]       = useState("");
  const [fDoc, setFDoc]           = useState("");
  const [fAddr, setFAddr]         = useState("");
  const [fStreet, setFStreet]     = useState("");
  const [fNumber, setFNumber]     = useState("");
  const [fComplement, setFComplement] = useState("");
  const [fDistrict, setFDistrict] = useState("");
  const [fCity, setFCity]         = useState("");
  const [fState, setFState]       = useState("");
  const [fZip, setFZip]           = useState("");
  const [fCountry, setFCountry]   = useState("Brasil");
  const [cepLoading, setCepLoading] = useState(false);
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const [cnpjError, setCnpjError] = useState<string | null>(null);
  const [fLegalName, setFLegalName] = useState("");
  const [fTradeName, setFTradeName] = useState("");
  const [fCnaeCode, setFCnaeCode] = useState("");
  const [fCnaeDescription, setFCnaeDescription] = useState("");
  const [fLegalNature, setFLegalNature] = useState("");
  const [fRegistrationStatus, setFRegistrationStatus] = useState("");
  const [fRegistrationStatusDate, setFRegistrationStatusDate] = useState("");
  const [fNotes, setFNotes]       = useState("");
  const [fCredit, setFCredit]     = useState("");
  const [fConsignmentLimit, setFConsignmentLimit] = useState("");
  const [fBirth, setFBirth]       = useState("");
  const [fRisk, setFRisk]         = useState(false);
  const [fRiskReason, setFRiskReason] = useState("");
  const [saving, setSaving]       = useState(false);

  // Generic confirmation dialog (replaces window.confirm)
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    onConfirm: () => void | Promise<void>;
  } | null>(null);
  const [confirming, setConfirming] = useState(false);

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

  // ── form helpers

  function openCreate() {
    setEditCust(null);
    setFName(""); setFEmail(""); setFPhone(""); setFDoc("");
    setFAddr(""); setFStreet(""); setFNumber(""); setFComplement(""); setFDistrict(""); setFCity(""); setFState(""); setFZip(""); setFCountry("Brasil");
    setFNotes(""); setFCredit(""); setFConsignmentLimit(""); setFBirth(""); setFRisk(false); setFRiskReason("");
    setFLegalName(""); setFTradeName(""); setFCnaeCode(""); setFCnaeDescription(""); setFLegalNature(""); setFRegistrationStatus(""); setFRegistrationStatusDate("");
    setCnpjError(null);
    setShowForm(true);
  }

  function openEdit(c: Customer) {
    setEditCust(c);
    setFName(c.name); setFEmail(c.email ?? ""); setFPhone(maskPhone(c.phone ?? ""));
    setFDoc(maskDoc(c.document ?? "")); setFAddr(c.address ?? ""); setFNotes(c.notes ?? "");
    setFStreet(c.address_street ?? ""); setFNumber(c.address_number ?? ""); setFComplement(c.address_complement ?? "");
    setFDistrict(c.address_district ?? ""); setFCity(c.address_city ?? ""); setFState(c.address_state ?? ""); setFZip(c.address_zip ?? "");
    setFCountry(c.address_country ?? "Brasil");
    setFCredit(c.credit_limit ? String(c.credit_limit) : "");
    setFConsignmentLimit(c.consignment_limit ? String(c.consignment_limit) : "");
    setFBirth(c.birth_date ? c.birth_date.slice(0, 10) : "");
    setFRisk(c.risk_flag); setFRiskReason(c.risk_reason ?? "");
    setFLegalName(c.legal_name ?? ""); setFTradeName(c.trade_name ?? "");
    setFCnaeCode(c.cnae_code ?? ""); setFCnaeDescription(c.cnae_description ?? "");
    setFLegalNature(c.legal_nature ?? ""); setFRegistrationStatus(c.registration_status ?? "");
    setFRegistrationStatusDate(c.registration_status_date ? c.registration_status_date.slice(0, 10) : "");
    setCnpjError(null);
    setShowForm(true);
  }

  function closeForm() { setShowForm(false); setEditCust(null); }

  async function handleLookupCEP() {
    const raw = fZip.replace(/\D/g, "");
    if (raw.length !== 8) return;
    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${raw}/json/`);
      const d = await res.json();
      if (!d.erro) {
        setFStreet(d.logradouro ?? "");
        setFDistrict(d.bairro ?? "");
        setFCity(d.localidade ?? "");
        setFState(d.uf ?? "");
        setFZip(raw);
      }
    } catch {
      // silencioso — mesmo comportamento do lookup de CEP do Tenant
    } finally {
      setCepLoading(false);
    }
  }

  async function handleLookupCNPJ() {
    const raw = fDoc.replace(/\D/g, "");
    if (raw.length !== 14) return;
    setCnpjLoading(true);
    setCnpjError(null);
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${raw}`);
      if (!res.ok) { setCnpjError("CNPJ não encontrado."); return; }
      const d = await res.json();
      const displayName = d.nome_fantasia?.trim() || d.razao_social?.trim();
      if (displayName) setFName(displayName);
      if (d.email) setFEmail(d.email);
      if (d.ddd_telefone_1) setFPhone(maskPhone(d.ddd_telefone_1));
      if (d.cep) setFZip(String(d.cep).replace(/\D/g, ""));
      if (d.logradouro) setFStreet(d.logradouro);
      if (d.numero) setFNumber(d.numero);
      if (d.complemento) setFComplement(d.complemento);
      if (d.bairro) setFDistrict(d.bairro);
      if (d.municipio) setFCity(d.municipio);
      if (d.uf) setFState(d.uf);
      setFLegalName(d.razao_social?.trim() ?? "");
      setFTradeName(d.nome_fantasia?.trim() ?? "");
      setFCnaeCode(d.cnae_fiscal ? String(d.cnae_fiscal) : "");
      setFCnaeDescription(d.cnae_fiscal_descricao ?? "");
      setFLegalNature(d.natureza_juridica ?? "");
      setFRegistrationStatus(d.descricao_situacao_cadastral ?? "");
      setFRegistrationStatusDate(d.data_situacao_cadastral ?? "");
    } catch {
      setCnpjError("Falha ao consultar CNPJ. Tente novamente.");
    } finally {
      setCnpjLoading(false);
    }
  }

  async function handleSave() {
    if (!fName.trim()) return;
    setSaving(true);
    try {
      const computedAddress = [
        fStreet && fNumber ? `${fStreet}, ${fNumber}` : fStreet,
        fDistrict,
        fCity && fState ? `${fCity} - ${fState}` : fCity || fState,
      ].filter(Boolean).join(", ");
      const body = {
        name: fName, email: fEmail,
        phone: fPhone.replace(/\D/g, "") || null,
        document: fDoc.replace(/\D/g, "") || null,
        address: computedAddress || fAddr || null, notes: fNotes,
        address_street: fStreet || null,
        address_number: fNumber || null,
        address_complement: fComplement || null,
        address_district: fDistrict || null,
        address_city: fCity || null,
        address_state: fState || null,
        address_zip: fZip.replace(/\D/g, "") || null,
        address_country: fCountry || null,
        credit_limit: fCredit ? Number(fCredit) : null,
        consignment_limit: fConsignmentLimit ? Number(fConsignmentLimit) : null,
        birth_date: fBirth || null,
        risk_flag: fRisk,
        risk_reason: fRiskReason || null,
        legal_name: fLegalName || null,
        trade_name: fTradeName || null,
        cnae_code: fCnaeCode || null,
        cnae_description: fCnaeDescription || null,
        legal_nature: fLegalNature || null,
        registration_status: fRegistrationStatus || null,
        registration_status_date: fRegistrationStatusDate || null,
      };
      if (editCust) {
        await fetch(`/api/customers/${editCust.id}`, {
          method: "PUT", headers: authH(), body: JSON.stringify(body),
        });
      } else {
        await fetch("/api/customers", {
          method: "POST", headers: authH(), body: JSON.stringify(body),
        });
      }
      await fetchAll();
      closeForm();
    } finally {
      setSaving(false);
    }
  }

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

  return (
    <div className="min-w-0 space-y-4 sm:space-y-5">
      <PageHeader
        title="Clientes"
        subtitle="Clientes, crédito, histórico de compras e notas internas"
        action={
          <Button icon={<UserPlus size={14} />} onClick={openCreate}>
            Novo Cliente
          </Button>
        }
      />

      {/* Stats */}
      <StatsGrid
        stats={[
          { label: "Total Clientes",  value: customers.length, icon: <Users size={16} />, accent: "slate" },
          { label: "Com Pendências",  value: debtors.length,   icon: <AlertCircle size={16} />, accent: "amber" },
          { label: "Saldo em Aberto", value: fmt(totalDebt),   icon: <DollarSign size={16} />, accent: "red" },
          { label: "Clientes em Risco", value: customers.filter(c => c.risk_flag).length, icon: <AlertTriangle size={16} />, accent: "purple" },
        ]}
      />

      {/* Main tabs */}
      <div className="flex flex-col gap-3 min-[480px]:flex-row min-[480px]:items-center min-[480px]:justify-between">
        <div className="flex max-w-full overflow-x-auto bg-slate-100 p-1 rounded-xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {([
            { value: "customers", label: "Todos os Clientes", icon: Users },
            { value: "debtors",   label: `Com pendências (${debtors.length})`, icon: TrendingDown },
          ] as { value: MainTab; label: string; icon: React.FC<{ size: number }> }[]).map((t) => (
            <button
              key={t.value}
              onClick={() => setMainTab(t.value)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg text-[11px] sm:text-[12px] font-bold transition-all",
                mainTab === t.value ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              <t.icon size={13} /> {t.label}
            </button>
          ))}
        </div>

        {mainTab === "customers" && (
          <Button
            variant="secondary"
            icon={viewMode === "table" ? <LayoutGrid size={14} /> : <List size={14} />}
            onClick={() => changeViewMode(viewMode === "table" ? "grid" : "table")}
            className="w-full min-[480px]:w-auto"
          >
            {viewMode === "table" ? "Grade" : "Tabela"}
          </Button>
        )}
      </div>

      {/* Search + page size */}
      <div className="flex flex-col gap-2 min-[480px]:flex-row min-[480px]:items-center">
        <div className="relative w-full min-w-0 min-[480px]:max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={mainTab === "customers" ? "Buscar cliente…" : "Buscar cliente com pendência…"}
            className="w-full pl-9 pr-3 h-11 sm:h-9 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={pageSize}
          onChange={(e) => setPageSize(Number(e.target.value))}
          className="h-11 w-full rounded-xl border border-slate-200 px-3 text-[12px] font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 min-[480px]:h-9 min-[480px]:w-auto"
        >
          {[12, 24, 50, 100].map((n) => <option key={n} value={n}>{n}/página</option>)}
        </select>
      </div>

      {/* ── CUSTOMERS LIST ─────────────────────────────────────────────────── */}
      {mainTab === "customers" && (
        <>
          {loading ? (
            <div className="flex justify-center py-16 text-slate-400 text-sm">Carregando…</div>
          ) : filteredCustomers.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-slate-400 gap-3">
              <Users size={40} strokeWidth={1} />
              <p className="text-sm font-medium">Nenhum cliente encontrado</p>
              <button onClick={openCreate} className="h-8 px-4 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700">
                Cadastrar cliente
              </button>
            </div>
          ) : viewMode === "grid" ? (
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
                    whileHover={{ y: -2 }}
                    onClick={() => navigate(`/admin/customers/${c.id}`)}
                    className={cn(
                      "group flex min-w-0 cursor-pointer flex-col rounded-2xl border bg-white p-4 shadow-sm transition-all hover:border-blue-200 hover:shadow-md sm:p-5",
                      c.risk_flag ? "border-rose-200 ring-1 ring-rose-100" : "border-slate-200"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className={cn(
                          "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border text-lg font-black uppercase",
                          c.risk_flag ? "bg-rose-50 text-rose-500 border border-rose-200" : "bg-blue-50 text-blue-600 border border-blue-100"
                        )}>
                          {c.name[0]}
                        </div>
                        <div className="min-w-0">
                          <p className="line-clamp-2 text-[13px] font-black leading-tight text-slate-900">{c.name}</p>
                          <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Cliente desde {fmtDate(c.created_at)}</p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        {c.risk_flag && (
                          <span title="Cliente em risco" className="inline-flex items-center gap-1 rounded-lg border border-rose-100 bg-rose-50 px-2 py-1 text-[9px] font-black uppercase tracking-wide text-rose-600">
                            <AlertTriangle size={11} /> Risco
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-2 border-y border-slate-100 py-3 min-[430px]:grid-cols-2">
                      <div className="flex min-w-0 items-center gap-2 text-slate-500">
                        {c.phone ? <Phone size={13} className="shrink-0 text-blue-500" /> : <Mail size={13} className="shrink-0 text-blue-500" />}
                        <span className="truncate text-[11px] font-semibold">{c.phone ?? c.email ?? "Contato não informado"}</span>
                      </div>
                      <div className="flex min-w-0 items-center gap-2 text-slate-500">
                        <MapPin size={13} className="shrink-0 text-blue-500" />
                        <span className="truncate text-[11px] font-semibold">{location || "Endereço não informado"}</span>
                      </div>
                    </div>

                    {preference && (
                      <div className="flex min-w-0 items-start gap-2 rounded-xl bg-blue-50/70 px-3 py-2.5 text-blue-800">
                        <StickyNote size={13} className="mt-0.5 shrink-0 text-blue-500" />
                        <div className="min-w-0">
                          <p className="text-[9px] font-black uppercase tracking-widest text-blue-500">Preferências</p>
                          <p className="mt-0.5 line-clamp-2 text-[11px] font-medium leading-relaxed">{preference}</p>
                        </div>
                      </div>
                    )}

                    <div className="mt-auto flex items-center justify-between gap-3 pt-1">
                      <div className="min-w-0">
                        {hasDebt ? (
                          <p className="text-[11px] font-black text-rose-600">Em aberto: {fmt(Number(c.total_debt))}</p>
                        ) : hasCreditLimit ? (
                          <p className="flex items-center gap-1 text-[11px] font-bold text-slate-500"><WalletCards size={12} /> Limite: {fmt(Number(c.credit_limit))}</p>
                        ) : (
                          <p className="text-[11px] font-bold text-emerald-600">Sem pendências</p>
                        )}
                      </div>
                      <span className="flex shrink-0 items-center gap-0.5 text-[10px] font-black text-blue-600 transition-transform group-hover:translate-x-0.5">
                        Ver ficha <ChevronRight size={11} />
                      </span>
                    </div>
                  </motion.article>
                )})}
              </AnimatePresence>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden overflow-x-auto">
              <table className="w-full text-sm whitespace-nowrap">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-wider text-slate-500">Cliente</th>
                    <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-wider text-slate-500">Telefone</th>
                    <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-wider text-slate-500">Cidade</th>
                    <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-wider text-slate-500">Saldo em aberto</th>
                    <th className="px-4 py-3 text-center text-[10px] font-black uppercase tracking-wider text-slate-500">Risco</th>
                    <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-wider text-slate-500">Cliente desde</th>
                    <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-wider text-slate-500">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pagedCustomers.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => navigate(`/admin/customers/${c.id}`)}>
                      <td className="px-4 py-3 font-semibold text-slate-800">{c.name}</td>
                      <td className="px-4 py-3 text-slate-500">{c.phone ?? "–"}</td>
                      <td className="px-4 py-3 text-slate-500">{[c.address_city, c.address_state].filter(Boolean).join(" - ") || "–"}</td>
                      <td className="px-4 py-3 text-right font-black text-red-600">{(c.total_debt ?? 0) > 0 ? fmt(c.total_debt!) : "–"}</td>
                      <td className="px-4 py-3 text-center">
                        {c.risk_flag ? <AlertTriangle size={14} className="text-rose-500 mx-auto" /> : <span className="text-slate-300 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-[12px]">{fmtDate(c.created_at)}</td>
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => navigate(`/admin/customers/${c.id}`)} className="text-[11px] font-bold text-blue-600 hover:underline">
                          Ver ficha
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!loading && filteredCustomers.length > 0 && (
            <PaginationFooter
              total={filteredCustomers.length}
              itemLabel="cliente"
              safePage={safePage}
              totalPages={totalPages}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
            />
          )}
        </>
      )}

      {/* ── DEBTORS LIST ───────────────────────────────────────────────────── */}
      {mainTab === "debtors" && (
        <>
          {filteredDebtors.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-slate-400 gap-3">
              <CheckCircle2 size={40} strokeWidth={1} />
              <p className="text-sm font-medium">Nenhum cliente com pendência em aberto</p>
            </div>
          ) : (
            <>
              <div className="space-y-3 md:hidden">
                {pagedDebtors.map((d) => (
                  <button
                    key={d.customer_id}
                    onClick={() => navigate(`/admin/customers/${d.customer_id}`)}
                    className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-colors hover:border-rose-200"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-black text-slate-900">{d.customer_name}</p>
                        <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-slate-500"><Phone size={11} /> {d.customer_phone ?? "Contato não informado"}</p>
                      </div>
                      {d.risk_flag && <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-rose-50 px-2 py-1 text-[9px] font-black uppercase text-rose-600"><AlertTriangle size={11} /> Risco</span>}
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Parcelas</p>
                        <p className="mt-1 text-sm font-black text-slate-700">{d.open_debts}</p>
                      </div>
                      <div className="border-l border-slate-100 pl-3">
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Em aberto</p>
                        <p className="mt-1 text-sm font-black text-rose-600">{fmt(d.total_debt)}</p>
                      </div>
                    </div>
                    <span className="mt-3 flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-blue-600">Ver ficha <ChevronRight size={12} /></span>
                  </button>
                ))}
              </div>
              <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm md:block">
              <table className="w-full text-sm whitespace-nowrap">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-wider text-slate-500">Cliente</th>
                    <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-wider text-slate-500 hidden sm:table-cell">Telefone</th>
                    <th className="px-4 py-3 text-center text-[10px] font-black uppercase tracking-wider text-slate-500">Parcelas</th>
                    <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-wider text-slate-500">Saldo em aberto</th>
                    <th className="px-4 py-3 text-center text-[10px] font-black uppercase tracking-wider text-slate-500">Risco</th>
                    <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-wider text-slate-500">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pagedDebtors.map((d) => (
                    <tr key={d.customer_id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-semibold text-slate-800">{d.customer_name}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 hidden sm:table-cell">{d.customer_phone ?? "–"}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                          {d.open_debts}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-black text-red-600">{fmt(d.total_debt)}</td>
                      <td className="px-4 py-3 text-center">
                        {d.risk_flag
                          ? <AlertTriangle size={14} className="text-rose-500 mx-auto" />
                          : <span className="text-slate-300 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => navigate(`/admin/customers/${d.customer_id}`)}
                          className="text-[11px] font-bold text-blue-600 hover:underline"
                        >
                          Ver ficha
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-red-50 border-t border-red-100">
                    <td colSpan={3} className="px-4 py-2 text-[11px] font-black uppercase text-red-500">Total em aberto</td>
                    <td className="px-4 py-2 text-right font-black text-red-600">{fmt(totalDebt)}</td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
              </div>
            </>
          )}

          {filteredDebtors.length > 0 && (
            <PaginationFooter
              total={filteredDebtors.length}
              itemLabel="cliente com pendência"
              safePage={safePage}
              totalPages={totalPages}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
            />
          )}
        </>
      )}

      {/* ── CREATE / EDIT FORM DRAWER ─────────────────────────────────────── */}
      <AnimatePresence>
        {showForm && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={closeForm}
              className="fixed inset-0 bg-slate-900/50 z-[60] backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 26, stiffness: 200 }}
              className="fixed inset-y-0 right-0 w-full max-w-sm bg-white z-[70] shadow-2xl flex flex-col"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 shrink-0">
                <div>
                  <h2 className="font-black text-slate-900 text-[15px]">{editCust ? "Editar Cliente" : "Novo Cliente"}</h2>
                  <p className="text-[11px] text-slate-500">Cadastro de Cliente</p>
                </div>
                <button onClick={closeForm} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500">
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Nome *</label>
                  <input value={fName} onChange={(e) => setFName(e.target.value)} placeholder="Nome completo" className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Telefone</label>
                    <input
                      value={fPhone}
                      onChange={(e) => setFPhone(maskPhone(e.target.value))}
                      placeholder="(11) 99999-9999"
                      inputMode="numeric"
                      className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">CPF/CNPJ</label>
                    <div className="flex gap-1.5">
                      <input
                        value={fDoc}
                        onChange={(e) => { setFDoc(maskDoc(e.target.value)); setCnpjError(null); }}
                        placeholder="000.000.000-00"
                        inputMode="numeric"
                        className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      {fDoc.replace(/\D/g, "").length === 14 && (
                        <button type="button" onClick={handleLookupCNPJ} disabled={cnpjLoading}
                          title="Buscar dados do CNPJ na Receita Federal"
                          className="h-9 px-2.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-all flex items-center justify-center shrink-0">
                          {cnpjLoading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                {cnpjError && (
                  <p className="text-[11px] font-semibold text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{cnpjError}</p>
                )}
                {fDoc.replace(/\D/g, "").length === 14 && (fLegalName || fCnaeDescription || fRegistrationStatus) && (
                  <div className="space-y-2 bg-slate-50 border border-slate-100 rounded-lg p-3">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Dados Fiscais (Receita Federal)</p>
                    {fLegalName && (
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Razão Social</label>
                        <input value={fLegalName} onChange={(e) => setFLegalName(e.target.value)}
                          className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      {fLegalNature && (
                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Natureza Jurídica</label>
                          <p className="text-[12px] font-semibold text-slate-700 h-9 px-3 flex items-center rounded-lg border border-slate-200 bg-white truncate">{fLegalNature}</p>
                        </div>
                      )}
                      {fRegistrationStatus && (
                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Situação Cadastral</label>
                          <p className={cn(
                            "text-[12px] font-bold h-9 px-3 flex items-center rounded-lg border",
                            fRegistrationStatus === "ATIVA" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"
                          )}>{fRegistrationStatus}</p>
                        </div>
                      )}
                    </div>
                    {fCnaeDescription && (
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">CNAE Principal</label>
                        <p className="text-[12px] font-semibold text-slate-700 px-3 py-2 rounded-lg border border-slate-200 bg-white">
                          {fCnaeCode ? `${fCnaeCode} — ` : ""}{fCnaeDescription}
                        </p>
                      </div>
                    )}
                  </div>
                )}
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Data de Aniversário</label>
                  <input
                    type="date"
                    value={fBirth}
                    onChange={(e) => setFBirth(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">E-mail</label>
                  <input type="email" value={fEmail} onChange={(e) => setFEmail(e.target.value)} placeholder="email@exemplo.com" className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Endereço</label>
                  <div className="flex gap-2">
                    <input
                      value={fZip}
                      onChange={(e) => setFZip(e.target.value.replace(/\D/g, "").slice(0, 8))}
                      placeholder="CEP"
                      inputMode="numeric"
                      className="w-32 h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={handleLookupCEP}
                      disabled={cepLoading || fZip.replace(/\D/g, "").length !== 8}
                      className="h-9 px-3 rounded-lg border border-slate-200 text-[11px] font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-all flex items-center gap-1.5 shrink-0"
                    >
                      {cepLoading ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
                      Buscar CEP
                    </button>
                  </div>
                  <input
                    value={fStreet}
                    onChange={(e) => setFStreet(e.target.value)}
                    placeholder="Rua / Logradouro"
                    className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={fNumber}
                      onChange={(e) => setFNumber(e.target.value)}
                      placeholder="Número"
                      className="h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      value={fComplement}
                      onChange={(e) => setFComplement(e.target.value)}
                      placeholder="Complemento"
                      className="h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <input
                    value={fDistrict}
                    onChange={(e) => setFDistrict(e.target.value)}
                    placeholder="Bairro"
                    className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      value={fCity}
                      onChange={(e) => setFCity(e.target.value)}
                      placeholder="Cidade"
                      className="col-span-2 h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <select
                      value={fState}
                      onChange={(e) => setFState(e.target.value)}
                      className="h-9 px-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">UF</option>
                      {["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"].map((uf) => (
                        <option key={uf} value={uf}>{uf}</option>
                      ))}
                    </select>
                  </div>
                  <input
                    value={fCountry}
                    onChange={(e) => setFCountry(e.target.value)}
                    placeholder="País"
                    className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Limite de Crédito (R$)</label>
                  <input type="number" min={0} value={fCredit} onChange={(e) => setFCredit(e.target.value)} placeholder="0,00" className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Limite de Consignação (R$)</label>
                  <input type="number" min={0} value={fConsignmentLimit} onChange={(e) => setFConsignmentLimit(e.target.value)} placeholder="0,00" className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Observações</label>
                  <textarea value={fNotes} onChange={(e) => setFNotes(e.target.value)} rows={2} placeholder="Preferências, anotações gerais…" className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                </div>

                {/* Risk flag */}
                <div className={cn("rounded-xl border p-3 space-y-2 transition-colors", fRisk ? "bg-rose-50 border-rose-200" : "bg-slate-50 border-slate-200")}>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={fRisk}
                      onChange={(e) => setFRisk(e.target.checked)}
                      className="w-4 h-4 accent-rose-500"
                    />
                    <span className={cn("text-[12px] font-black", fRisk ? "text-rose-600" : "text-slate-600")}>
                      <AlertTriangle size={12} className="inline mr-1" />
                      Marcar como Cliente de Risco
                    </span>
                  </label>
                  {fRisk && (
                    <textarea
                      value={fRiskReason}
                      onChange={(e) => setFRiskReason(e.target.value)}
                      rows={2}
                      placeholder="Motivo do risco (ex: atrasou 3x, cheque sem fundo…)"
                      className="w-full px-3 py-2 rounded-lg border border-rose-200 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400 resize-none bg-white"
                    />
                  )}
                </div>
              </div>

              <div className="border-t border-slate-200 px-5 py-4 shrink-0 bg-slate-50 flex gap-2">
                <button onClick={closeForm} className="flex-1 h-9 rounded-lg border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-100">Cancelar</button>
                <button
                  onClick={handleSave}
                  disabled={saving || !fName.trim()}
                  className="flex-1 h-9 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 disabled:opacity-50 transition-all"
                >
                  {saving ? "Salvando…" : editCust ? "Salvar" : "Criar Cliente"}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <Modal
        open={!!confirmDialog}
        onClose={() => { if (!confirming) setConfirmDialog(null); }}
        title={confirmDialog?.title ?? ""}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmDialog(null)} disabled={confirming}>Cancelar</Button>
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
          </>
        }
      >
        <p className="text-sm text-slate-600">{confirmDialog?.message}</p>
      </Modal>
    </div>
  );
}
