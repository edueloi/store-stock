import { useState, useEffect, useCallback } from "react";
import {
  Users, Plus, Search, Edit2, Trash2, Trophy,
  TrendingUp, DollarSign, X, Check, ChevronLeft,
  ChevronRight, Star, Medal, Award, ToggleLeft, ToggleRight,
  Phone, Mail, FileText, Percent,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../../lib/utils";
import PageHeader from "../../components/layout/PageHeader";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Seller {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  document?: string;
  commission_rate: number;
  is_active: boolean;
  notes?: string;
  created_at: string;
}

interface SellerStats extends Seller {
  month_sales: number;
  month_revenue: number;
  month_commission: number;
  all_time_revenue: number;
  all_time_commission: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const authH = () => ({
  Authorization: `Bearer ${localStorage.getItem("token")}`,
  "Content-Type": "application/json",
});

const MONTHS = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];

const MEDAL_ICONS = [
  <Trophy size={18} className="text-yellow-500" />,
  <Medal  size={18} className="text-slate-400" />,
  <Award  size={18} className="text-amber-700" />,
];

// ─── Form vazio ──────────────────────────────────────────────────────────────

const emptyForm = (): Omit<Seller, "id" | "created_at"> => ({
  name: "", email: "", phone: "", document: "",
  commission_rate: 0, is_active: true, notes: "",
});

// ─── Component ────────────────────────────────────────────────────────────────

export default function Sellers() {
  const now = new Date();
  const [tab, setTab]             = useState<"ranking" | "cadastro">("ranking");
  const [stats, setStats]         = useState<SellerStats[]>([]);
  const [sellers, setSellers]     = useState<Seller[]>([]);
  const [loading, setLoading]     = useState(true);
  const [month, setMonth]         = useState(now.getMonth() + 1);
  const [year, setYear]           = useState(now.getFullYear());
  const [search, setSearch]       = useState("");

  // modal de cadastro / edição
  const [showModal, setShowModal]   = useState(false);
  const [editing, setEditing]       = useState<Seller | null>(null);
  const [form, setForm]             = useState(emptyForm());
  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState(false);

  // modal detalhe do vendedor
  const [detailSeller, setDetailSeller] = useState<SellerStats | null>(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/sellers/stats?month=${month}&year=${year}`, { headers: authH() });
      const d = await r.json();
      setStats(Array.isArray(d.stats) ? d.stats : []);
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  const fetchSellers = useCallback(async () => {
    const r = await fetch("/api/sellers", { headers: authH() });
    setSellers(await r.json());
  }, []);

  useEffect(() => { fetchStats(); fetchSellers(); }, [fetchStats, fetchSellers]);

  // ── CRUD ──────────────────────────────────────────────────────────────────

  const openNew = () => { setEditing(null); setForm(emptyForm()); setShowModal(true); };

  const openEdit = (s: Seller) => {
    setEditing(s);
    setForm({
      name: s.name, email: s.email ?? "", phone: s.phone ?? "",
      document: s.document ?? "", commission_rate: Number(s.commission_rate),
      is_active: s.is_active, notes: s.notes ?? "",
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const url    = editing ? `/api/sellers/${editing.id}` : "/api/sellers";
      const method = editing ? "PUT" : "POST";
      await fetch(url, { method, headers: authH(), body: JSON.stringify(form) });
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
      setShowModal(false);
      await Promise.all([fetchSellers(), fetchStats()]);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Excluir este vendedor? As vendas anteriores não serão afetadas.")) return;
    await fetch(`/api/sellers/${id}`, { method: "DELETE", headers: authH() });
    fetchSellers(); fetchStats();
  };

  const handleToggleActive = async (s: Seller) => {
    await fetch(`/api/sellers/${s.id}`, {
      method: "PUT", headers: authH(),
      body: JSON.stringify({ ...s, is_active: !s.is_active }),
    });
    fetchSellers(); fetchStats();
  };

  // ── Filtered list ──────────────────────────────────────────────────────────

  const filteredSellers = sellers.filter((s) =>
    !search || s.name.toLowerCase().includes(search.toLowerCase())
  );

  // ── Month navigation ───────────────────────────────────────────────────────

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  };

  // ── Summary totals ─────────────────────────────────────────────────────────

  const totalRevenue    = stats.reduce((s, x) => s + x.month_revenue, 0);
  const totalSales      = stats.reduce((s, x) => s + x.month_sales, 0);
  const totalCommission = stats.reduce((s, x) => s + x.month_commission, 0);
  const activeSellers   = stats.filter((s) => s.is_active).length;

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      <PageHeader
        title="Vendedores"
        subtitle="Ranking, comissões e cadastro da equipe de vendas"
        action={
          <button onClick={openNew}
            className="h-9 px-4 bg-blue-600 text-white rounded-lg flex items-center gap-2 text-[12px] font-bold hover:bg-blue-700 transition-all shadow-md shadow-blue-500/20">
            <Plus size={15} /> Novo Vendedor
          </button>
        }
      />

      {/* ── Tabs ─────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {(["ranking", "cadastro"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={cn(
              "h-8 px-5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all",
              tab === t ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}>
            {t === "ranking" ? "Ranking & Comissões" : "Cadastro"}
          </button>
        ))}
      </div>

      {/* ══════════════════ RANKING TAB ══════════════════ */}
      {tab === "ranking" && (
        <div className="space-y-4">

          {/* Period selector */}
          <div className="flex items-center gap-2">
            <button onClick={prevMonth}
              className="w-8 h-8 flex items-center justify-center bg-white border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-500 transition-all">
              <ChevronLeft size={15} />
            </button>
            <span className="min-w-[160px] text-center text-sm font-black text-slate-900 uppercase tracking-wide">
              {MONTHS[month - 1]} {year}
            </span>
            <button onClick={nextMonth}
              className="w-8 h-8 flex items-center justify-center bg-white border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-500 transition-all">
              <ChevronRight size={15} />
            </button>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: "Vendedores Ativos", value: activeSellers, icon: <Users size={16} />, color: "text-blue-600", bg: "bg-blue-50 border-blue-100" },
              { label: "Vendas no Mês",     value: totalSales,    icon: <TrendingUp size={16} />, color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-100" },
              { label: "Receita Total",     value: fmt(totalRevenue),    icon: <DollarSign size={16} />, color: "text-amber-600", bg: "bg-amber-50 border-amber-100" },
              { label: "Comissões a Pagar", value: fmt(totalCommission), icon: <Percent size={16} />,    color: "text-purple-600", bg: "bg-purple-50 border-purple-100" },
            ].map((c) => (
              <div key={c.label} className={cn("rounded-xl p-4 border shadow-sm", c.bg)}>
                <div className={cn("mb-1", c.color)}>{c.icon}</div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{c.label}</p>
                <p className={cn("text-xl font-black mt-0.5", c.color)}>{c.value}</p>
              </div>
            ))}
          </div>

          {/* Ranking list */}
          {loading ? (
            <div className="flex justify-center py-16 text-slate-400 text-sm">Carregando…</div>
          ) : stats.filter((s) => s.is_active).length === 0 ? (
            <div className="flex flex-col items-center py-16 text-slate-400 gap-3">
              <Trophy size={36} strokeWidth={1} />
              <p className="text-sm font-medium">Nenhum vendedor ativo ou sem vendas no período</p>
            </div>
          ) : (
            <div className="space-y-3">
              {stats.filter((s) => s.is_active).map((s, idx) => (
                <motion.div
                  key={s.id}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.04 }}
                  onClick={() => setDetailSeller(s)}
                  className={cn(
                    "bg-white rounded-2xl border shadow-sm p-4 flex items-center gap-4 cursor-pointer hover:shadow-md hover:border-blue-200 transition-all",
                    idx === 0 && "border-yellow-300 bg-yellow-50/40 shadow-yellow-100/80"
                  )}
                >
                  {/* Rank */}
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-black text-lg",
                    idx === 0 ? "bg-yellow-100" : idx === 1 ? "bg-slate-100" : idx === 2 ? "bg-amber-50" : "bg-slate-50 text-slate-400"
                  )}>
                    {idx < 3 ? MEDAL_ICONS[idx] : <span className="text-[13px] text-slate-400">#{idx + 1}</span>}
                  </div>

                  {/* Avatar */}
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-white font-black text-sm",
                    idx === 0 ? "bg-yellow-500" : "bg-blue-600"
                  )}>
                    {s.name.charAt(0).toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-slate-900 text-sm truncate">{s.name}</p>
                    <p className="text-[11px] text-slate-400 font-medium">
                      {s.month_sales} {s.month_sales === 1 ? "venda" : "vendas"} · {Number(s.commission_rate).toFixed(1)}% comissão
                    </p>
                  </div>

                  {/* Stats — responsive */}
                  <div className="hidden sm:flex items-center gap-6 shrink-0">
                    <div className="text-right">
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Receita</p>
                      <p className="font-black text-slate-900 text-sm">{fmt(s.month_revenue)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Comissão</p>
                      <p className="font-black text-emerald-600 text-sm">{fmt(s.month_commission)}</p>
                    </div>
                  </div>

                  {/* Mobile: only commission */}
                  <div className="sm:hidden text-right shrink-0">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Comissão</p>
                    <p className="font-black text-emerald-600 text-sm">{fmt(s.month_commission)}</p>
                  </div>

                  {/* Progress bar — % de participação na receita total */}
                  <div className="hidden lg:block w-24 shrink-0">
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={cn("h-full rounded-full transition-all", idx === 0 ? "bg-yellow-400" : "bg-blue-500")}
                        style={{ width: totalRevenue > 0 ? `${Math.min(100, (s.month_revenue / totalRevenue) * 100)}%` : "0%" }}
                      />
                    </div>
                    <p className="text-[9px] text-slate-400 font-bold mt-0.5 text-right">
                      {totalRevenue > 0 ? ((s.month_revenue / totalRevenue) * 100).toFixed(0) : 0}%
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════ CADASTRO TAB ══════════════════ */}
      {tab === "cadastro" && (
        <div className="space-y-4">
          {/* Search */}
          <div className="relative max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar vendedor..."
              className="w-full pl-9 pr-3 h-9 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {filteredSellers.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-slate-400 gap-3">
              <Users size={36} strokeWidth={1} />
              <p className="text-sm font-medium">Nenhum vendedor cadastrado</p>
              <button onClick={openNew}
                className="h-8 px-4 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700">
                Cadastrar primeiro vendedor
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredSellers.map((s) => {
                const st = stats.find((x) => x.id === s.id);
                return (
                  <motion.div key={s.id}
                    initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
                    className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col gap-3 hover:shadow-md hover:border-blue-200 transition-all"
                  >
                    {/* Header */}
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        "w-11 h-11 rounded-xl flex items-center justify-center text-white font-black text-base shrink-0",
                        s.is_active ? "bg-blue-600" : "bg-slate-300"
                      )}>
                        {s.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-slate-900 text-sm truncate">{s.name}</p>
                        <span className={cn(
                          "inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full mt-0.5",
                          s.is_active ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"
                        )}>
                          <span className={cn("w-1.5 h-1.5 rounded-full", s.is_active ? "bg-emerald-500" : "bg-slate-400")} />
                          {s.is_active ? "Ativo" : "Inativo"}
                        </span>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => openEdit(s)}
                          className="p-1.5 hover:bg-blue-50 text-blue-500 rounded-lg transition-colors">
                          <Edit2 size={13} />
                        </button>
                        <button onClick={() => handleDelete(s.id)}
                          className="p-1.5 hover:bg-red-50 text-red-400 rounded-lg transition-colors">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    {/* Contact */}
                    <div className="space-y-1">
                      {s.phone && (
                        <div className="flex items-center gap-2 text-[11px] text-slate-500">
                          <Phone size={11} className="shrink-0" /> {s.phone}
                        </div>
                      )}
                      {s.email && (
                        <div className="flex items-center gap-2 text-[11px] text-slate-500">
                          <Mail size={11} className="shrink-0" /> <span className="truncate">{s.email}</span>
                        </div>
                      )}
                      {s.document && (
                        <div className="flex items-center gap-2 text-[11px] text-slate-500">
                          <FileText size={11} className="shrink-0" /> {s.document}
                        </div>
                      )}
                    </div>

                    {/* Commission badge */}
                    <div className="flex items-center justify-between bg-slate-50 rounded-xl px-3 py-2">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Comissão</span>
                      <span className="font-black text-blue-600 text-sm">{Number(s.commission_rate).toFixed(1)}%</span>
                    </div>

                    {/* Month stats */}
                    {st && (
                      <div className="grid grid-cols-2 gap-2">
                        <div className="text-center bg-blue-50 rounded-xl py-2">
                          <p className="text-[9px] font-bold text-blue-400 uppercase tracking-wider">Vendas {MONTHS[month-1].slice(0,3)}</p>
                          <p className="font-black text-blue-700 text-base">{st.month_sales}</p>
                        </div>
                        <div className="text-center bg-emerald-50 rounded-xl py-2">
                          <p className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider">Comissão</p>
                          <p className="font-black text-emerald-700 text-sm">{fmt(st.month_commission)}</p>
                        </div>
                      </div>
                    )}

                    {/* Toggle active */}
                    <button onClick={() => handleToggleActive(s)}
                      className={cn(
                        "w-full flex items-center justify-center gap-2 h-8 rounded-lg text-[11px] font-bold border transition-all",
                        s.is_active
                          ? "border-slate-200 text-slate-500 hover:bg-red-50 hover:text-red-500 hover:border-red-200"
                          : "border-emerald-200 text-emerald-600 bg-emerald-50 hover:bg-emerald-100"
                      )}>
                      {s.is_active ? <><ToggleRight size={14} /> Desativar</> : <><ToggleLeft size={14} /> Ativar</>}
                    </button>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ══════════ MODAL CADASTRO / EDIÇÃO ══════════ */}
      <AnimatePresence>
        {showModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowModal(false)}
              className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 20 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
            >
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                  <h3 className="font-black text-slate-900 text-base">
                    {editing ? "Editar Vendedor" : "Novo Vendedor"}
                  </h3>
                  <button onClick={() => setShowModal(false)}
                    className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors">
                    <X size={16} />
                  </button>
                </div>

                <div className="p-6 space-y-4">
                  {/* Nome */}
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                      Nome *
                    </label>
                    <input
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder="Nome completo"
                      className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Telefone + Email */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                        Telefone
                      </label>
                      <input
                        value={form.phone}
                        onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                        placeholder="(11) 99999-9999"
                        className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                        E-mail
                      </label>
                      <input
                        type="email"
                        value={form.email}
                        onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                        placeholder="email@email.com"
                        className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  {/* CPF / CNPJ */}
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                      CPF / CNPJ
                    </label>
                    <input
                      value={form.document}
                      onChange={(e) => setForm((f) => ({ ...f, document: e.target.value }))}
                      placeholder="000.000.000-00"
                      className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Comissão */}
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                      Taxa de Comissão (%)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.1}
                        value={form.commission_rate}
                        onChange={(e) => setForm((f) => ({ ...f, commission_rate: Number(e.target.value) }))}
                        className="w-full h-10 px-3 pr-8 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <Percent size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Comissão calculada sobre o valor total das vendas do vendedor
                    </p>
                  </div>

                  {/* Status */}
                  <div className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3">
                    <div>
                      <p className="text-sm font-bold text-slate-700">Vendedor Ativo</p>
                      <p className="text-[10px] text-slate-400">Pode ser selecionado no PDV</p>
                    </div>
                    <button
                      onClick={() => setForm((f) => ({ ...f, is_active: !f.is_active }))}
                      className={cn(
                        "w-11 h-6 rounded-full transition-all relative shadow-inner shrink-0",
                        form.is_active ? "bg-emerald-500" : "bg-slate-300"
                      )}
                    >
                      <div className={cn(
                        "absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-sm",
                        form.is_active ? "left-6" : "left-1"
                      )} />
                    </button>
                  </div>

                  {/* Observações */}
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                      Observações
                    </label>
                    <textarea
                      value={form.notes}
                      onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                      rows={2}
                      placeholder="Metas, turno, região..."
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    />
                  </div>
                </div>

                {/* Footer */}
                <div className="flex gap-2 px-6 pb-6">
                  <button onClick={() => setShowModal(false)}
                    className="flex-1 h-10 rounded-lg border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-all">
                    Cancelar
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving || !form.name.trim()}
                    className="flex-1 h-10 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                  >
                    {saved ? <><Check size={14} /> Salvo!</> : saving ? "Salvando…" : editing ? "Atualizar" : "Cadastrar"}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ══════════ MODAL DETALHE DO VENDEDOR ══════════ */}
      <AnimatePresence>
        {detailSeller && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setDetailSeller(null)}
              className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 20 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
            >
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
                {/* Colored header */}
                <div className="bg-gradient-to-br from-blue-600 to-blue-700 px-6 pt-6 pb-8 text-white relative">
                  <button onClick={() => setDetailSeller(null)}
                    className="absolute top-4 right-4 p-1.5 hover:bg-white/20 rounded-lg transition-colors">
                    <X size={16} />
                  </button>
                  <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center font-black text-2xl mb-3">
                    {detailSeller.name.charAt(0).toUpperCase()}
                  </div>
                  <h3 className="font-black text-lg leading-tight">{detailSeller.name}</h3>
                  {detailSeller.phone && (
                    <p className="text-blue-200 text-sm mt-0.5 flex items-center gap-1.5">
                      <Phone size={11} /> {detailSeller.phone}
                    </p>
                  )}
                  {detailSeller.email && (
                    <p className="text-blue-200 text-sm flex items-center gap-1.5">
                      <Mail size={11} /> {detailSeller.email}
                    </p>
                  )}
                </div>

                {/* Stats */}
                <div className="px-6 -mt-4">
                  <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-4 grid grid-cols-3 gap-3">
                    <div className="text-center">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Comissão</p>
                      <p className="font-black text-blue-600 text-base">{Number(detailSeller.commission_rate).toFixed(1)}%</p>
                    </div>
                    <div className="text-center border-x border-slate-100">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Vendas mês</p>
                      <p className="font-black text-slate-900 text-base">{detailSeller.month_sales}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Receita mês</p>
                      <p className="font-black text-emerald-600 text-sm">{fmt(detailSeller.month_revenue)}</p>
                    </div>
                  </div>
                </div>

                <div className="p-6 space-y-3">
                  {/* Comissão do mês */}
                  <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Comissão a Receber</p>
                      <p className="text-[10px] text-emerald-500">{MONTHS[month-1]} {year}</p>
                    </div>
                    <p className="font-black text-emerald-700 text-xl">{fmt(detailSeller.month_commission)}</p>
                  </div>

                  {/* All time */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-50 rounded-xl p-3">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Receita Total</p>
                      <p className="font-black text-slate-900 text-sm mt-0.5">{fmt(detailSeller.all_time_revenue)}</p>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-3">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Comissão Total</p>
                      <p className="font-black text-slate-900 text-sm mt-0.5">{fmt(detailSeller.all_time_commission)}</p>
                    </div>
                  </div>

                  {detailSeller.notes && (
                    <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                      <p className="text-[9px] font-bold text-amber-500 uppercase tracking-wider mb-1">Obs</p>
                      <p className="text-sm text-amber-800">{detailSeller.notes}</p>
                    </div>
                  )}

                  <button
                    onClick={() => { setDetailSeller(null); openEdit(detailSeller); }}
                    className="w-full h-10 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
                  >
                    <Edit2 size={14} /> Editar Vendedor
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
