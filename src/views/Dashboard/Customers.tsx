import { useState, useEffect, useCallback } from "react";
import {
  Users, UserPlus, Phone, Mail, MapPin, Search,
  AlertTriangle, X, Plus, ChevronRight, Trash2,
  DollarSign, Clock, CheckCircle2, FileText,
  ShoppingBag, StickyNote, Edit2, Save, XCircle,
  TrendingDown, AlertCircle, Shield, Star, Gift, Award,
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
  birth_date?: string;
  risk_flag: boolean;
  risk_reason?: string;
  created_at: string;
  total_debt?: number;
  open_debts?: number;
}

interface Debt {
  id: number;
  description: string;
  amount: number;
  due_date?: string;
  paid_at?: string;
  status: "open" | "paid";
  created_at: string;
}

interface Note {
  id: number;
  body: string;
  created_at: string;
}

interface OrderItem {
  id: number;
  name?: string;
  quantity: number;
  unit_price: number;
}

interface Order {
  id: number;
  total_amount: number;
  payment_method?: string;
  created_at: string;
  items: OrderItem[];
}

interface CustomerDetail extends Customer {
  debts: Debt[];
  customer_notes: Note[];
  orders: Order[];
  total_debt: number;
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

function isOverdue(due_date?: string) {
  if (!due_date) return false;
  return new Date(due_date) < new Date();
}

const PAY_LABELS: Record<string, string> = {
  money: "Dinheiro", card: "Cartão", pix: "PIX",
};

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
type DetailTab = "summary" | "fiado" | "history" | "notes" | "loyalty";

export default function Customers() {
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
  const [fBirth, setFBirth]       = useState("");
  const [fRisk, setFRisk]         = useState(false);
  const [fRiskReason, setFRiskReason] = useState("");
  const [saving, setSaving]       = useState(false);

  // Detail panel
  const [detail, setDetail]       = useState<CustomerDetail | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>("summary");
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Debt form
  const [showDebtForm, setShowDebtForm] = useState(false);
  const [dDesc, setDDesc]   = useState("");
  const [dAmt, setDAmt]     = useState("");
  const [dDue, setDDue]     = useState("");
  const [savingDebt, setSavingDebt] = useState(false);

  // Note form
  const [noteBody, setNoteBody]   = useState("");
  const [savingNote, setSavingNote] = useState(false);

  // Generic confirmation dialog (replaces window.confirm)
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    onConfirm: () => void | Promise<void>;
  } | null>(null);
  const [confirming, setConfirming] = useState(false);

  // Loyalty
  interface PointEntry { id: number; delta: number; balance_after: number; description?: string; created_at: string; }
  interface LoyaltyReward { id: number; name: string; type: string; discount_value?: number; discount_type?: string; product_id?: number; points_cost: number; is_active: boolean; }
  const [loyaltyBalance, setLoyaltyBalance] = useState<number>(0);
  const [loyaltyEntries, setLoyaltyEntries] = useState<PointEntry[]>([]);
  const [loyaltyRewards, setLoyaltyRewards] = useState<LoyaltyReward[]>([]);
  const [loyaltyProgram, setLoyaltyProgram] = useState<{ spend_per_point: number; is_active: boolean } | null>(null);
  const [pointAdj, setPointAdj]   = useState("");
  const [pointDesc, setPointDesc] = useState("");
  const [savingPoints, setSavingPoints] = useState(false);
  const [redeemingId, setRedeemingId]  = useState<number | null>(null);

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

  const fetchDetail = useCallback(async (id: number) => {
    setLoadingDetail(true);
    const h = { Authorization: `Bearer ${localStorage.getItem("token")}` };
    try {
      const res = await fetch(`/api/customers/${id}`, { headers: h });
      const data = await res.json();
      setDetail(data);
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  const fetchLoyalty = useCallback(async (customerId: number) => {
    const h = { Authorization: `Bearer ${localStorage.getItem("token")}` };
    const [ptRes, pgRes, rwRes] = await Promise.all([
      fetch(`/api/loyalty/customers/${customerId}/points`, { headers: h }),
      fetch("/api/loyalty/program", { headers: h }),
      fetch("/api/loyalty/rewards", { headers: h }),
    ]);
    const pt = await ptRes.json();
    const pg = await pgRes.json();
    const rw = await rwRes.json();
    setLoyaltyBalance(pt.balance ?? 0);
    setLoyaltyEntries(pt.entries ?? []);
    setLoyaltyProgram({ spend_per_point: Number(pg.spend_per_point ?? 10), is_active: pg.is_active ?? false });
    setLoyaltyRewards(Array.isArray(rw) ? rw.filter((r: LoyaltyReward) => r.is_active) : []);
  }, []);

  // ── form helpers

  function openCreate() {
    setEditCust(null);
    setFName(""); setFEmail(""); setFPhone(""); setFDoc("");
    setFAddr(""); setFStreet(""); setFNumber(""); setFComplement(""); setFDistrict(""); setFCity(""); setFState(""); setFZip(""); setFCountry("Brasil");
    setFNotes(""); setFCredit(""); setFBirth(""); setFRisk(false); setFRiskReason("");
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
        birth_date: fBirth || null,
        risk_flag: fRisk,
        risk_reason: fRiskReason || null,
      };
      if (editCust) {
        await fetch(`/api/customers/${editCust.id}`, {
          method: "PUT", headers: authH(), body: JSON.stringify(body),
        });
        if (detail?.id === editCust.id) await fetchDetail(editCust.id);
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
        if (detail?.id === id) setDetail(null);
        fetchAll();
      },
    });
  }

  // ── debt actions

  async function handleAddDebt() {
    if (!detail || !dDesc.trim() || !dAmt) return;
    setSavingDebt(true);
    try {
      await fetch(`/api/customers/${detail.id}/debts`, {
        method: "POST", headers: authH(),
        body: JSON.stringify({ description: dDesc, amount: Number(dAmt), due_date: dDue || null }),
      });
      setDDesc(""); setDAmt(""); setDDue("");
      setShowDebtForm(false);
      await fetchDetail(detail.id);
      fetchAll();
    } finally { setSavingDebt(false); }
  }

  async function handlePayDebt(debtId: number) {
    if (!detail) return;
    await fetch(`/api/customers/${detail.id}/debts/${debtId}/pay`, {
      method: "POST", headers: authH(),
    });
    await fetchDetail(detail.id);
    fetchAll();
  }

  function handleDeleteDebt(debtId: number) {
    if (!detail) return;
    const customerId = detail.id;
    setConfirmDialog({
      title: "Remover fiado",
      message: "Remover esta dívida?",
      onConfirm: async () => {
        await fetch(`/api/customers/${customerId}/debts/${debtId}`, {
          method: "DELETE", headers: authH(),
        });
        await fetchDetail(customerId);
        fetchAll();
      },
    });
  }

  // ── note actions

  async function handleAddNote() {
    if (!detail || !noteBody.trim()) return;
    setSavingNote(true);
    try {
      await fetch(`/api/customers/${detail.id}/notes`, {
        method: "POST", headers: authH(),
        body: JSON.stringify({ body: noteBody }),
      });
      setNoteBody("");
      await fetchDetail(detail.id);
    } finally { setSavingNote(false); }
  }

  function handleDeleteNote(noteId: number) {
    if (!detail) return;
    const customerId = detail.id;
    setConfirmDialog({
      title: "Remover nota",
      message: "Remover esta nota?",
      onConfirm: async () => {
        await fetch(`/api/customers/${customerId}/notes/${noteId}`, {
          method: "DELETE", headers: authH(),
        });
        await fetchDetail(customerId);
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
        subtitle="CRM, fiado, histórico de compras e notas internas"
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
                  onClick={() => { setDetail(null); setDetailTab("summary"); fetchDetail(c.id); }}
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
                          onClick={() => { setDetail(null); setDetailTab("fiado"); fetchDetail(d.customer_id); }}
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

      {/* ── CUSTOMER DETAIL PANEL ──────────────────────────────────────────── */}
      <AnimatePresence>
        {detail !== null && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setDetail(null)}
              className="fixed inset-0 bg-slate-900/50 z-40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 26, stiffness: 200 }}
              className="fixed inset-y-0 right-0 w-full max-w-lg bg-white z-50 shadow-2xl flex flex-col"
            >
              {loadingDetail ? (
                <div className="flex-1 flex items-center justify-center text-slate-400">Carregando…</div>
              ) : (
                <>
                  {/* Panel header */}
                  <div className={cn(
                    "px-5 py-4 border-b border-slate-200 shrink-0",
                    detail.risk_flag ? "bg-rose-50" : "bg-white"
                  )}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={cn(
                          "w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl uppercase shrink-0",
                          detail.risk_flag ? "bg-rose-100 text-rose-600" : "bg-blue-50 text-blue-600"
                        )}>
                          {detail.name[0]}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h2 className="font-black text-slate-900 text-[16px] leading-tight">{detail.name}</h2>
                            {detail.risk_flag && (
                              <span className="flex items-center gap-1 text-[9px] font-black text-rose-600 bg-rose-100 px-2 py-0.5 rounded-full uppercase">
                                <AlertTriangle size={9} /> Risco
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-3 mt-1">
                            {detail.phone && (
                              <a href={`tel:${detail.phone}`} className="text-[11px] text-slate-500 flex items-center gap-1 hover:text-blue-600">
                                <Phone size={10} /> {detail.phone}
                              </a>
                            )}
                            {detail.email && (
                              <a href={`mailto:${detail.email}`} className="text-[11px] text-slate-500 flex items-center gap-1 hover:text-blue-600">
                                <Mail size={10} /> {detail.email}
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button
                          onClick={() => openEdit(detail)}
                          className="p-2 hover:bg-slate-100 rounded-lg text-slate-500"
                          title="Editar"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          onClick={() => handleDelete(detail.id)}
                          className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg"
                          title="Excluir"
                        >
                          <Trash2 size={15} />
                        </button>
                        <button
                          onClick={() => setDetail(null)}
                          className="p-2 hover:bg-slate-100 rounded-lg text-slate-500"
                        >
                          <X size={15} />
                        </button>
                      </div>
                    </div>

                    {/* Debt badge */}
                    {detail.total_debt > 0 && (
                      <div className="mt-3 flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                        <DollarSign size={14} className="text-red-500 shrink-0" />
                        <span className="text-[12px] font-black text-red-600">
                          Deve {fmt(detail.total_debt)} em aberto
                        </span>
                      </div>
                    )}
                    {detail.risk_reason && (
                      <div className="mt-2 flex items-start gap-2 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
                        <Shield size={13} className="text-rose-500 mt-0.5 shrink-0" />
                        <p className="text-[11px] text-rose-700 font-semibold">{detail.risk_reason}</p>
                      </div>
                    )}
                  </div>

                  {/* Detail tabs */}
                  <div className="flex gap-0 border-b border-slate-200 shrink-0 overflow-x-auto">
                    {([
                      { value: "summary", label: "Resumo",    icon: Users },
                      { value: "fiado",   label: `Fiado (${detail.debts.filter(d => d.status === "open").length})`, icon: DollarSign },
                      { value: "history", label: `Compras (${detail.orders.length})`, icon: ShoppingBag },
                      { value: "notes",   label: `Notas (${detail.customer_notes.length})`, icon: StickyNote },
                      { value: "loyalty", label: "Pontos", icon: Star },
                    ] as { value: DetailTab; label: string; icon: React.FC<{size: number}> }[]).map((t) => (
                      <button
                        key={t.value}
                        onClick={() => {
                          setDetailTab(t.value);
                          if (t.value === "loyalty") fetchLoyalty(detail.id);
                        }}
                        className={cn(
                          "flex items-center gap-1.5 px-4 py-2.5 text-[11px] font-bold whitespace-nowrap border-b-2 transition-all",
                          detailTab === t.value
                            ? "border-blue-600 text-blue-600"
                            : "border-transparent text-slate-500 hover:text-slate-700"
                        )}
                      >
                        <t.icon size={12} /> {t.label}
                      </button>
                    ))}
                  </div>

                  {/* Tab content */}
                  <div className="flex-1 overflow-y-auto p-5 space-y-4">

                    {/* ─ SUMMARY ─ */}
                    {detailTab === "summary" && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                          {[
                            { label: "Total de Compras", value: detail.orders.length, icon: ShoppingBag },
                            { label: "Gasto Total",      value: fmt(detail.orders.reduce((s, o) => s + Number(o.total_amount), 0)), icon: DollarSign },
                            { label: "Fiados em Aberto", value: detail.debts.filter(d => d.status === "open").length, icon: AlertCircle },
                            { label: "Notas Internas",   value: detail.customer_notes.length, icon: StickyNote },
                          ].map((s) => (
                            <div key={s.label} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                              <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">{s.label}</p>
                              <p className="text-lg font-black text-slate-800 mt-0.5">{s.value}</p>
                            </div>
                          ))}
                        </div>

                        {detail.address && (
                          <div className="flex items-center gap-2 text-sm text-slate-600">
                            <MapPin size={13} className="text-slate-400 shrink-0" />
                            {detail.address}
                          </div>
                        )}
                        {detail.document && (
                          <div className="text-sm text-slate-600">
                            <span className="font-semibold">CPF/CNPJ:</span> {detail.document}
                          </div>
                        )}
                        {detail.credit_limit && (
                          <div className="text-sm text-slate-600">
                            <span className="font-semibold">Limite de crédito:</span> {fmt(Number(detail.credit_limit))}
                          </div>
                        )}
                        {detail.notes && (
                          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[12px] text-amber-800">
                            <p className="font-bold mb-1 flex items-center gap-1"><FileText size={11} /> Observações do cadastro</p>
                            {detail.notes}
                          </div>
                        )}
                      </div>
                    )}

                    {/* ─ FIADO ─ */}
                    {detailTab === "fiado" && (
                      <div className="space-y-3">
                        {/* Add debt button */}
                        {!showDebtForm ? (
                          <button
                            onClick={() => setShowDebtForm(true)}
                            className="w-full h-9 border-2 border-dashed border-slate-200 rounded-xl text-[12px] font-bold text-slate-500 hover:border-blue-400 hover:text-blue-600 transition-all flex items-center justify-center gap-1.5"
                          >
                            <Plus size={14} /> Adicionar Fiado
                          </button>
                        ) : (
                          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
                            <p className="text-[11px] font-black uppercase tracking-wider text-blue-600">Novo Fiado</p>
                            <input
                              value={dDesc}
                              onChange={(e) => setDDesc(e.target.value)}
                              placeholder="Descrição (ex: 1 kg de frango)"
                              className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <div className="grid grid-cols-2 gap-2">
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">R$</span>
                                <input
                                  type="number" min={0} step="0.01"
                                  value={dAmt}
                                  onChange={(e) => setDAmt(e.target.value)}
                                  placeholder="0,00"
                                  className="w-full h-9 pl-8 pr-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                              </div>
                              <input
                                type="date"
                                value={dDue}
                                onChange={(e) => setDDue(e.target.value)}
                                placeholder="Vencimento"
                                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => setShowDebtForm(false)}
                                className="flex-1 h-9 rounded-lg border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-100"
                              >
                                Cancelar
                              </button>
                              <button
                                onClick={handleAddDebt}
                                disabled={savingDebt || !dDesc.trim() || !dAmt}
                                className="flex-1 h-9 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 disabled:opacity-50"
                              >
                                {savingDebt ? "Salvando…" : "Registrar"}
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Debts list */}
                        {detail.debts.length === 0 ? (
                          <p className="text-center text-sm text-slate-400 py-8">Nenhum fiado registrado</p>
                        ) : (
                          <div className="space-y-2">
                            {detail.debts.map((d) => (
                              <div
                                key={d.id}
                                className={cn(
                                  "flex items-start gap-3 p-3 rounded-xl border",
                                  d.status === "paid"
                                    ? "bg-emerald-50 border-emerald-200"
                                    : isOverdue(d.due_date)
                                    ? "bg-red-50 border-red-200"
                                    : "bg-white border-slate-200"
                                )}
                              >
                                <div className={cn(
                                  "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
                                  d.status === "paid" ? "bg-emerald-100" : "bg-red-100"
                                )}>
                                  {d.status === "paid"
                                    ? <CheckCircle2 size={15} className="text-emerald-600" />
                                    : <Clock size={15} className="text-red-500" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-semibold text-[13px] text-slate-800">{d.description}</p>
                                  <p className="font-black text-[13px] text-red-600">{fmt(Number(d.amount))}</p>
                                  <div className="flex flex-wrap gap-2 mt-0.5">
                                    <span className="text-[10px] text-slate-400">{fmtDate(d.created_at)}</span>
                                    {d.due_date && (
                                      <span className={cn(
                                        "text-[10px] font-semibold",
                                        isOverdue(d.due_date) && d.status === "open" ? "text-red-500" : "text-slate-400"
                                      )}>
                                        Vence: {fmtDate(d.due_date)}
                                        {isOverdue(d.due_date) && d.status === "open" && " (vencido)"}
                                      </span>
                                    )}
                                    {d.status === "paid" && d.paid_at && (
                                      <span className="text-[10px] text-emerald-600 font-semibold">
                                        Pago em {fmtDate(d.paid_at)}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                {d.status === "open" && (
                                  <div className="flex gap-1 shrink-0">
                                    <button
                                      onClick={() => handlePayDebt(d.id)}
                                      title="Marcar como pago"
                                      className="p-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-600 rounded-lg transition-colors"
                                    >
                                      <CheckCircle2 size={13} />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteDebt(d.id)}
                                      title="Remover"
                                      className="p-1.5 hover:bg-red-50 text-slate-300 hover:text-red-400 rounded-lg transition-colors"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* ─ HISTORY ─ */}
                    {detailTab === "history" && (
                      <div className="space-y-2">
                        {detail.orders.length === 0 ? (
                          <p className="text-center text-sm text-slate-400 py-8">Nenhuma compra registrada</p>
                        ) : (
                          detail.orders.map((o) => (
                            <div key={o.id} className="bg-white border border-slate-200 rounded-xl p-3 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] text-slate-400">{fmtDate(o.created_at)}</span>
                                <div className="flex items-center gap-2">
                                  {o.payment_method && (
                                    <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                                      {PAY_LABELS[o.payment_method] ?? o.payment_method}
                                    </span>
                                  )}
                                  <span className="font-black text-emerald-600 text-[13px]">{fmt(Number(o.total_amount))}</span>
                                </div>
                              </div>
                              {o.items.length > 0 && (
                                <div className="space-y-0.5">
                                  {o.items.slice(0, 4).map((it) => (
                                    <div key={it.id} className="flex items-center justify-between text-[11px] text-slate-600">
                                      <span className="truncate">{it.name ?? `Item #${it.id}`} × {it.quantity}</span>
                                      <span className="font-semibold ml-2 shrink-0">{fmt(Number(it.unit_price) * it.quantity)}</span>
                                    </div>
                                  ))}
                                  {o.items.length > 4 && (
                                    <p className="text-[10px] text-slate-400">+{o.items.length - 4} itens</p>
                                  )}
                                </div>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    )}

                    {/* ─ NOTES ─ */}
                    {detailTab === "notes" && (
                      <div className="space-y-3">
                        {/* Add note */}
                        <div className="space-y-2">
                          <textarea
                            value={noteBody}
                            onChange={(e) => setNoteBody(e.target.value)}
                            rows={3}
                            placeholder="Adicionar nota interna… Ex: cliente costuma atrasar pagamento, cuidado ao fazer fiado."
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                          />
                          <button
                            onClick={handleAddNote}
                            disabled={savingNote || !noteBody.trim()}
                            className="h-8 px-4 bg-amber-500 text-white rounded-lg text-[12px] font-bold hover:bg-amber-600 disabled:opacity-50 transition-all flex items-center gap-1.5"
                          >
                            <Save size={12} /> {savingNote ? "Salvando…" : "Salvar Nota"}
                          </button>
                        </div>

                        {/* Notes list */}
                        {detail.customer_notes.length === 0 ? (
                          <p className="text-center text-sm text-slate-400 py-6">Nenhuma nota ainda</p>
                        ) : (
                          <div className="space-y-2">
                            {detail.customer_notes.map((n) => (
                              <div key={n.id} className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
                                <StickyNote size={13} className="text-amber-500 mt-0.5 shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-[12px] text-amber-900">{n.body}</p>
                                  <p className="text-[10px] text-amber-500 mt-1">{fmtDate(n.created_at)}</p>
                                </div>
                                <button
                                  onClick={() => handleDeleteNote(n.id)}
                                  className="p-1 hover:bg-amber-100 text-amber-300 hover:text-amber-500 rounded-lg transition-colors"
                                >
                                  <XCircle size={13} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* ─ LOYALTY ─ */}
                    {detailTab === "loyalty" && (
                      <div className="space-y-4">
                        {/* Balance card */}
                        <div className="bg-gradient-to-br from-amber-400 to-orange-400 rounded-2xl p-5 text-white">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-[11px] font-bold opacity-80 uppercase tracking-wider">Saldo de Pontos</p>
                              <p className="text-3xl font-black mt-1">{loyaltyBalance.toLocaleString("pt-BR")} pts</p>
                              {loyaltyProgram && (
                                <p className="text-[11px] opacity-70 mt-1">
                                  A cada {fmt(loyaltyProgram.spend_per_point)} gastos = 1 ponto
                                </p>
                              )}
                            </div>
                            <Award size={40} className="opacity-30" />
                          </div>
                        </div>

                        {/* Adjust points */}
                        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
                          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Ajuste Manual de Pontos</p>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[9px] text-slate-400 block mb-0.5">Delta (+ ou -)</label>
                              <input
                                type="number"
                                value={pointAdj}
                                onChange={(e) => setPointAdj(e.target.value)}
                                placeholder="Ex: 50 ou -20"
                                className="w-full h-8 px-2 rounded-lg border border-slate-200 text-[12px] focus:outline-none focus:ring-2 focus:ring-amber-400"
                              />
                            </div>
                            <div>
                              <label className="text-[9px] text-slate-400 block mb-0.5">Motivo</label>
                              <input
                                value={pointDesc}
                                onChange={(e) => setPointDesc(e.target.value)}
                                placeholder="Ex: Correção"
                                className="w-full h-8 px-2 rounded-lg border border-slate-200 text-[12px] focus:outline-none focus:ring-2 focus:ring-amber-400"
                              />
                            </div>
                          </div>
                          <button
                            disabled={savingPoints || !pointAdj}
                            onClick={async () => {
                              if (!pointAdj) return;
                              setSavingPoints(true);
                              try {
                                await fetch(`/api/loyalty/customers/${detail.id}/points`, {
                                  method: "POST", headers: authH(),
                                  body: JSON.stringify({ delta: Number(pointAdj), description: pointDesc || null }),
                                });
                                setPointAdj(""); setPointDesc("");
                                fetchLoyalty(detail.id);
                              } finally { setSavingPoints(false); }
                            }}
                            className="h-8 px-4 bg-amber-500 text-white rounded-lg text-[12px] font-bold hover:bg-amber-600 disabled:opacity-50 transition-all"
                          >
                            {savingPoints ? "Salvando…" : "Aplicar Ajuste"}
                          </button>
                        </div>

                        {/* Rewards available */}
                        {loyaltyRewards.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Resgatar Recompensa</p>
                            {loyaltyRewards.map((r) => {
                              const canRedeem = loyaltyBalance >= r.points_cost;
                              return (
                                <div key={r.id} className={cn(
                                  "flex items-center gap-3 p-3 rounded-xl border transition-all",
                                  canRedeem ? "border-amber-200 bg-amber-50" : "border-slate-100 bg-slate-50 opacity-60"
                                )}>
                                  <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center border border-slate-100 shrink-0">
                                    {r.type === "discount" ? <DollarSign size={14} className="text-blue-500" /> : <Gift size={14} className="text-purple-500" />}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[12px] font-bold text-slate-900">{r.name}</p>
                                    <div className="flex items-center gap-1 mt-0.5">
                                      <Star size={10} className="text-amber-400" fill="currentColor" />
                                      <span className="text-[10px] text-amber-600 font-bold">{r.points_cost} pts</span>
                                    </div>
                                  </div>
                                  <button
                                    disabled={!canRedeem || redeemingId === r.id}
                                    onClick={async () => {
                                      setRedeemingId(r.id);
                                      try {
                                        await fetch(`/api/loyalty/customers/${detail.id}/redeem`, {
                                          method: "POST", headers: authH(),
                                          body: JSON.stringify({ reward_id: r.id }),
                                        });
                                        fetchLoyalty(detail.id);
                                      } finally { setRedeemingId(null); }
                                    }}
                                    className="h-7 px-3 bg-amber-500 text-white rounded-lg text-[11px] font-bold hover:bg-amber-600 disabled:opacity-40 transition-all"
                                  >
                                    {redeemingId === r.id ? "…" : "Resgatar"}
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* History */}
                        <div className="space-y-2">
                          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Histórico de Pontos</p>
                          {loyaltyEntries.length === 0 ? (
                            <p className="text-center text-sm text-slate-400 py-6">Sem movimentações ainda</p>
                          ) : (
                            <div className="space-y-1.5">
                              {loyaltyEntries.map((e) => (
                                <div key={e.id} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-100">
                                  <div className={cn(
                                    "w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black shrink-0",
                                    e.delta > 0 ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600"
                                  )}>
                                    {e.delta > 0 ? "+" : ""}
                                    {e.delta}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[12px] font-medium text-slate-700 truncate">{e.description ?? "—"}</p>
                                    <p className="text-[10px] text-slate-400">{fmtDate(e.created_at)}</p>
                                  </div>
                                  <span className="text-[11px] font-bold text-slate-500 shrink-0">{e.balance_after} pts</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

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
                  <p className="text-[11px] text-slate-500">Cadastro CRM</p>
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
