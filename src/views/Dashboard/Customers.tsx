import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users, UserPlus, Phone, Search,
  AlertTriangle, X, ChevronRight,
  DollarSign, CheckCircle2,
  TrendingDown, AlertCircle,
  Loader2,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../../lib/utils";
import PageHeader from "../../components/layout/PageHeader";
import Modal from "../../components/ui/Modal";
import Button from "../../components/ui/Button";

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

export default function Customers() {
  const navigate = useNavigate();
  const [mainTab, setMainTab] = useState<MainTab>("customers");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [debtors, setDebtors]     = useState<Debtor[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState("");

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

  // ── form helpers

  function openCreate() {
    setEditCust(null);
    setFName(""); setFEmail(""); setFPhone(""); setFDoc("");
    setFAddr(""); setFStreet(""); setFNumber(""); setFComplement(""); setFDistrict(""); setFCity(""); setFState(""); setFZip(""); setFCountry("Brasil");
    setFNotes(""); setFCredit(""); setFConsignmentLimit(""); setFBirth(""); setFRisk(false); setFRiskReason("");
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

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      <PageHeader
        title="Clientes"
        subtitle="Clientes, fiado, histórico de compras e notas internas"
        action={
          <button
            onClick={openCreate}
            className="h-9 px-4 bg-blue-600 text-white rounded-lg flex items-center gap-2 text-[12px] font-bold hover:bg-blue-700 transition-all shadow-md shadow-blue-500/20"
          >
            <UserPlus size={14} /> Novo Cliente
          </button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Total Clientes",  value: customers.length,    color: "text-slate-700",   bg: "bg-slate-50",   icon: Users },
          { label: "Com Dívida",      value: debtors.length,      color: "text-orange-600",  bg: "bg-orange-50",  icon: AlertCircle },
          { label: "Total em Fiado",  value: fmt(totalDebt),      color: "text-red-600",     bg: "bg-red-50",     icon: DollarSign },
          { label: "Clientes em Risco", value: customers.filter(c => c.risk_flag).length, color: "text-rose-600", bg: "bg-rose-50", icon: AlertTriangle },
        ].map((s) => (
          <div key={s.label} className={cn("rounded-xl p-4 border border-white/60 shadow-sm flex items-center gap-3", s.bg)}>
            <s.icon size={20} className={cn(s.color, "shrink-0")} />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 leading-none">{s.label}</p>
              <p className={cn("text-xl font-black mt-0.5 leading-none", s.color)}>{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Main tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {([
          { value: "customers", label: "Todos os Clientes", icon: Users },
          { value: "debtors",   label: `Devedores (${debtors.length})`, icon: TrendingDown },
        ] as { value: MainTab; label: string; icon: React.FC<{ size: number }> }[]).map((t) => (
          <button
            key={t.value}
            onClick={() => setMainTab(t.value)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-bold transition-all",
              mainTab === t.value ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}
          >
            <t.icon size={13} /> {t.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={mainTab === "customers" ? "Buscar cliente…" : "Buscar devedor…"}
          className="w-full pl-9 pr-3 h-9 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
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
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {filteredCustomers.map((c) => (
                <motion.div
                  key={c.id}
                  whileHover={{ y: -2 }}
                  onClick={() => navigate(`/admin/customers/${c.id}`)}
                  className={cn(
                    "bg-white rounded-2xl border shadow-sm hover:shadow-md transition-all cursor-pointer p-4 flex flex-col gap-3",
                    c.risk_flag ? "border-rose-200 ring-1 ring-rose-100" : "border-slate-200"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg uppercase shrink-0",
                        c.risk_flag ? "bg-rose-50 text-rose-500 border border-rose-200" : "bg-blue-50 text-blue-600 border border-blue-100"
                      )}>
                        {c.name[0]}
                      </div>
                      <div className="min-w-0">
                        <p className="font-black text-slate-800 text-[13px] truncate">{c.name}</p>
                        {c.phone && (
                          <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                            <Phone size={9} /> {c.phone}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {c.risk_flag && (
                        <span title="Cliente em risco" className="p-1 bg-rose-50 text-rose-500 rounded-lg">
                          <AlertTriangle size={12} />
                        </span>
                      )}
                      {(c.total_debt ?? 0) > 0 && (
                        <span className="text-[10px] font-black text-red-500 bg-red-50 px-1.5 py-0.5 rounded-full">
                          {fmt(c.total_debt!)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                    <span className="text-[9px] text-slate-400 font-semibold">
                      Desde {fmtDate(c.created_at)}
                    </span>
                    <span className="text-[10px] text-blue-600 font-bold flex items-center gap-0.5">
                      Ver ficha <ChevronRight size={11} />
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── DEBTORS LIST ───────────────────────────────────────────────────── */}
      {mainTab === "debtors" && (
        <>
          {filteredDebtors.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-slate-400 gap-3">
              <CheckCircle2 size={40} strokeWidth={1} />
              <p className="text-sm font-medium">Nenhum devedor em aberto</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-wider text-slate-500">Cliente</th>
                    <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-wider text-slate-500 hidden sm:table-cell">Telefone</th>
                    <th className="px-4 py-3 text-center text-[10px] font-black uppercase tracking-wider text-slate-500">Parcelas</th>
                    <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-wider text-slate-500">Total Devendo</th>
                    <th className="px-4 py-3 text-center text-[10px] font-black uppercase tracking-wider text-slate-500">Risco</th>
                    <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-wider text-slate-500">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredDebtors.map((d) => (
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
                    <input
                      value={fDoc}
                      onChange={(e) => setFDoc(maskDoc(e.target.value))}
                      placeholder="000.000.000-00"
                      inputMode="numeric"
                      className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
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
