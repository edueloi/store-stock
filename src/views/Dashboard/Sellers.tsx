import { useState, useEffect, useCallback } from "react";
import {
  Users, Plus, Search, Edit2, Trash2, Trophy,
  TrendingUp, DollarSign, X, Check, ChevronLeft,
  ChevronRight, Star, Medal, Award, ToggleLeft, ToggleRight,
  Phone, Mail, FileText, Percent, Target, ChevronDown,
  Clock, Flame, XCircle, CheckCircle2, AlertCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../../lib/utils";
import PageHeader from "../../components/layout/PageHeader";
import {
  SELLER_GOAL_TYPES,
  PERIODS,
  fmtValue,
  getTypeConfig,
  getPeriodLabel,
  progressColor,
  daysLeft,
  defaultDates,
} from "../../lib/goals";

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

interface SellerGoal {
  id: number;
  seller_id: number | null;
  title: string;
  description?: string;
  type: string;
  period: string;
  target_value: number;
  current_value: number;
  start_date: string;
  end_date: string;
  status: "active" | "completed" | "cancelled";
}

interface GoalRankingEntry extends Seller {
  goal: SellerGoal | null;
  progress_pct: number | null;
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

const emptyGoalForm = () => ({
  seller_id: "" as number | "",
  title: "",
  description: "",
  type: "revenue",
  period: "monthly",
  target_value: "",
  start_date: "",
  end_date: "",
});

// ─── Component ────────────────────────────────────────────────────────────────

export default function Sellers() {
  const now = new Date();
  const [tab, setTab]             = useState<"ranking" | "cadastro" | "metas">("ranking");
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

  // ranking: por receita (padrão) ou por % de meta batida
  const [rankingMode, setRankingMode] = useState<"revenue" | "goals">("revenue");
  const [goalsRanking, setGoalsRanking] = useState<GoalRankingEntry[]>([]);
  const [goalsRankingLoading, setGoalsRankingLoading] = useState(false);

  // aba Metas
  const [sellerGoals, setSellerGoals]       = useState<SellerGoal[]>([]);
  const [goalsLoading, setGoalsLoading]     = useState(true);
  const [goalFilter, setGoalFilter]         = useState<number | "all">("all");
  const [showGoalForm, setShowGoalForm]     = useState(false);
  const [editGoal, setEditGoal]             = useState<SellerGoal | null>(null);
  const [goalForm, setGoalForm]             = useState(emptyGoalForm());
  const [savingGoal, setSavingGoal]         = useState(false);

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

  const fetchGoalsRanking = useCallback(async () => {
    setGoalsRankingLoading(true);
    try {
      const r = await fetch(`/api/sellers/goals-ranking?month=${month}&year=${year}`, { headers: authH() });
      const d = await r.json();
      setGoalsRanking(Array.isArray(d.ranking) ? d.ranking : []);
    } finally {
      setGoalsRankingLoading(false);
    }
  }, [month, year]);

  const fetchSellerGoals = useCallback(async () => {
    setGoalsLoading(true);
    try {
      const r = await fetch("/api/sellers/goals", { headers: authH() });
      const d = await r.json();
      setSellerGoals(Array.isArray(d) ? d : []);
    } finally {
      setGoalsLoading(false);
    }
  }, []);

  useEffect(() => { fetchStats(); fetchSellers(); fetchSellerGoals(); }, [fetchStats, fetchSellers, fetchSellerGoals]);
  useEffect(() => { if (rankingMode === "goals") fetchGoalsRanking(); }, [rankingMode, fetchGoalsRanking]);

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

  // ── Metas por vendedor / loja ────────────────────────────────────────────

  const openNewGoal = () => {
    setEditGoal(null);
    const { start, end } = defaultDates("monthly");
    setGoalForm({ ...emptyGoalForm(), start_date: start, end_date: end });
    setShowGoalForm(true);
  };

  const openEditGoal = (g: SellerGoal) => {
    setEditGoal(g);
    setGoalForm({
      seller_id: g.seller_id ?? "",
      title: g.title,
      description: g.description ?? "",
      type: g.type,
      period: g.period,
      target_value: String(g.target_value),
      start_date: g.start_date.split("T")[0],
      end_date: g.end_date.split("T")[0],
    });
    setShowGoalForm(true);
  };

  const closeGoalForm = () => { setShowGoalForm(false); setEditGoal(null); };

  const handleSaveGoal = async () => {
    if (!goalForm.title.trim() || !goalForm.target_value || !goalForm.start_date || !goalForm.end_date) return;
    setSavingGoal(true);
    try {
      if (editGoal) {
        await fetch(`/api/goals/${editGoal.id}`, {
          method: "PUT", headers: authH(),
          body: JSON.stringify({
            title: goalForm.title,
            description: goalForm.description || undefined,
            target_value: Number(goalForm.target_value),
          }),
        });
      } else {
        await fetch("/api/goals", {
          method: "POST", headers: authH(),
          body: JSON.stringify({
            seller_id: goalForm.seller_id === "" ? null : Number(goalForm.seller_id),
            title: goalForm.title,
            description: goalForm.description || undefined,
            type: goalForm.type,
            period: goalForm.period,
            target_value: Number(goalForm.target_value),
            start_date: goalForm.start_date,
            end_date: goalForm.end_date,
          }),
        });
      }
      await Promise.all([fetchSellerGoals(), fetchGoalsRanking()]);
      closeGoalForm();
    } finally {
      setSavingGoal(false);
    }
  };

  const handleDeleteGoal = async (id: number) => {
    if (!confirm("Excluir esta meta?")) return;
    await fetch(`/api/goals/${id}`, { method: "DELETE", headers: authH() });
    fetchSellerGoals(); fetchGoalsRanking();
  };

  // Auto-fill de datas ao trocar período no form de metas
  useEffect(() => {
    if (goalForm.period !== "custom") {
      const { start, end } = defaultDates(goalForm.period);
      setGoalForm((f) => ({ ...f, start_date: start, end_date: end }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goalForm.period]);

  // ── Filtered list ──────────────────────────────────────────────────────────

  const filteredSellers = sellers.filter((s) =>
    !search || s.name.toLowerCase().includes(search.toLowerCase())
  );

  const filteredGoals = sellerGoals.filter(
    (g) => goalFilter === "all" || g.seller_id === goalFilter
  );

  const sellerName = (id: number | null) =>
    id == null ? "Loja (geral)" : sellers.find((s) => s.id === id)?.name ?? "Vendedor removido";

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
        subtitle="Ranking, comissões, metas e cadastro da equipe de vendas"
        action={
          tab === "metas" ? (
            <button onClick={openNewGoal}
              className="h-9 px-4 bg-blue-600 text-white rounded-lg flex items-center gap-2 text-[12px] font-bold hover:bg-blue-700 transition-all shadow-md shadow-blue-500/20">
              <Plus size={15} /> Nova Meta
            </button>
          ) : (
            <button onClick={openNew}
              className="h-9 px-4 bg-blue-600 text-white rounded-lg flex items-center gap-2 text-[12px] font-bold hover:bg-blue-700 transition-all shadow-md shadow-blue-500/20">
              <Plus size={15} /> Novo Vendedor
            </button>
          )
        }
      />

      {/* ── Tabs ─────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {(["ranking", "metas", "cadastro"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={cn(
              "h-8 px-5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all",
              tab === t ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}>
            {t === "ranking" ? "Ranking & Comissões" : t === "metas" ? "Metas" : "Cadastro"}
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

          {/* Sub-toggle: por receita vs % de meta batida */}
          <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit">
            {([
              { value: "revenue", label: "Por Receita" },
              { value: "goals",   label: "% de Meta Batida" },
            ] as const).map((o) => (
              <button key={o.value} onClick={() => setRankingMode(o.value)}
                className={cn(
                  "h-7 px-3 rounded-md text-[10px] font-black uppercase tracking-wider transition-all",
                  rankingMode === o.value ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                )}>
                {o.label}
              </button>
            ))}
          </div>

          {rankingMode === "revenue" && (
          <>
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
          </>
          )}

          {rankingMode === "goals" && (
            goalsRankingLoading ? (
              <div className="flex justify-center py-16 text-slate-400 text-sm">Carregando…</div>
            ) : goalsRanking.length === 0 ? (
              <div className="flex flex-col items-center py-16 text-slate-400 gap-3">
                <Target size={36} strokeWidth={1} />
                <p className="text-sm font-medium">Nenhum vendedor ativo cadastrado</p>
              </div>
            ) : (
              <div className="space-y-3">
                {goalsRanking.map((s, idx) => {
                  const hasGoal = s.goal != null && s.progress_pct != null;
                  const pct = hasGoal ? Math.min(100, s.progress_pct!) : 0;
                  return (
                    <motion.div
                      key={s.id}
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.04 }}
                      className={cn(
                        "bg-white rounded-2xl border shadow-sm p-4 flex items-center gap-4 transition-all",
                        hasGoal && idx === 0 && "border-yellow-300 bg-yellow-50/40 shadow-yellow-100/80"
                      )}
                    >
                      {/* Rank */}
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-black text-lg",
                        hasGoal && idx === 0 ? "bg-yellow-100" : hasGoal && idx === 1 ? "bg-slate-100" : hasGoal && idx === 2 ? "bg-amber-50" : "bg-slate-50 text-slate-400"
                      )}>
                        {hasGoal && idx < 3 ? MEDAL_ICONS[idx] : <span className="text-[13px] text-slate-400">#{idx + 1}</span>}
                      </div>

                      {/* Avatar */}
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-white font-black text-sm",
                        hasGoal && idx === 0 ? "bg-yellow-500" : "bg-blue-600"
                      )}>
                        {s.name.charAt(0).toUpperCase()}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-slate-900 text-sm truncate">{s.name}</p>
                        {hasGoal ? (
                          <p className="text-[11px] text-slate-400 font-medium truncate">
                            {s.goal!.title} · {getTypeConfig(s.goal!.type).label}
                          </p>
                        ) : (
                          <span className="inline-flex items-center text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full mt-0.5">
                            Sem meta definida
                          </span>
                        )}
                      </div>

                      {hasGoal && (
                        <>
                          <div className="hidden sm:flex items-center gap-6 shrink-0">
                            <div className="text-right">
                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Progresso</p>
                              <p className="font-black text-slate-900 text-sm">
                                {fmtValue(Number(s.goal!.current_value), getTypeConfig(s.goal!.type).unit)} / {fmtValue(Number(s.goal!.target_value), getTypeConfig(s.goal!.type).unit)}
                              </p>
                            </div>
                          </div>

                          <div className="w-24 shrink-0">
                            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className={cn("h-full rounded-full transition-all", progressColor(s.progress_pct!))}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <p className={cn("text-[9px] font-bold mt-0.5 text-right", progressColor(s.progress_pct!).replace("bg-", "text-"))}>
                              {s.progress_pct!.toFixed(0)}%
                            </p>
                          </div>
                        </>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            )
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

      {/* ══════════════════ METAS TAB ══════════════════ */}
      {tab === "metas" && (
        <div className="space-y-4">
          {/* Filtro por vendedor */}
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setGoalFilter("all")}
              className={cn(
                "h-8 px-3 rounded-lg text-[11px] font-bold border transition-all",
                goalFilter === "all" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              )}>
              Todas
            </button>
            {sellers.map((s) => (
              <button key={s.id} onClick={() => setGoalFilter(s.id)}
                className={cn(
                  "h-8 px-3 rounded-lg text-[11px] font-bold border transition-all",
                  goalFilter === s.id ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                )}>
                {s.name}
              </button>
            ))}
          </div>

          {goalsLoading ? (
            <div className="flex justify-center py-16 text-slate-400 text-sm">Carregando…</div>
          ) : filteredGoals.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-slate-400 gap-3">
              <Target size={40} strokeWidth={1} />
              <p className="text-sm font-medium">Nenhuma meta encontrada</p>
              <button onClick={openNewGoal}
                className="h-8 px-4 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700">
                Criar primeira meta
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              <AnimatePresence mode="popLayout">
                {filteredGoals.map((g) => {
                  const cfg = getTypeConfig(g.type);
                  const Icon = cfg.icon;
                  const pct = Math.min(100, Number(g.target_value) > 0 ? (Number(g.current_value) / Number(g.target_value)) * 100 : 0);
                  const left = daysLeft(g.end_date);
                  const isExpired = left < 0;
                  const isDone = pct >= 100;
                  return (
                    <motion.div
                      key={g.id} layout
                      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }}
                      className={cn(
                        "bg-white rounded-2xl border shadow-sm hover:shadow-md transition-all flex flex-col gap-0 overflow-hidden",
                        isDone ? "border-emerald-300 ring-1 ring-emerald-200" : "border-slate-200"
                      )}
                    >
                      <div className="flex items-start justify-between px-4 pt-4 pb-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border", cfg.bg, cfg.border)}>
                            <Icon size={16} className={cfg.color} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 leading-none mb-0.5">
                              {getPeriodLabel(g.period)} · {cfg.label}
                            </p>
                            <h3 className="font-black text-slate-800 text-[14px] leading-tight truncate">{g.title}</h3>
                            <p className="text-[11px] text-blue-500 font-bold mt-0.5">{sellerName(g.seller_id)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0 ml-2">
                          {isDone && <Trophy size={14} className="text-amber-400" />}
                          <button onClick={() => openEditGoal(g)}
                            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors">
                            <Edit2 size={13} />
                          </button>
                          <button onClick={() => handleDeleteGoal(g.id)}
                            className="p-1.5 hover:bg-red-50 rounded-lg text-slate-300 hover:text-red-400 transition-colors">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      <div className="px-4 pb-1">
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, ease: "easeOut" }}
                            className={cn("h-full rounded-full", progressColor(pct))}
                          />
                        </div>
                        <div className="flex items-center justify-between mt-1.5">
                          <span className={cn("text-[11px] font-black", progressColor(pct).replace("bg-", "text-"))}>
                            {pct.toFixed(1)}%
                          </span>
                          <span className="text-[10px] text-slate-400 font-semibold">
                            {fmtValue(Number(g.current_value), cfg.unit)} / {fmtValue(Number(g.target_value), cfg.unit)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 mt-auto">
                        <div className="flex items-center gap-1.5">
                          {isDone ? (
                            <span className="flex items-center gap-1 text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                              <CheckCircle2 size={10} /> Meta atingida!
                            </span>
                          ) : isExpired ? (
                            <span className="flex items-center gap-1 text-[10px] font-black text-red-500 bg-red-50 px-2 py-0.5 rounded-full">
                              <XCircle size={10} /> Expirada
                            </span>
                          ) : left <= 3 ? (
                            <span className="flex items-center gap-1 text-[10px] font-black text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">
                              <Flame size={10} /> {left}d restante{left !== 1 ? "s" : ""}
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-[10px] font-semibold text-slate-500">
                              <Clock size={10} /> {left}d restantes
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400">
                          Falta: {fmtValue(Math.max(0, Number(g.target_value) - Number(g.current_value)), cfg.unit)}
                        </span>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </div>
      )}

      {/* ══════════ FORM DRAWER — NOVA/EDITAR META ══════════ */}
      <AnimatePresence>
        {showGoalForm && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={closeGoalForm}
              className="fixed inset-0 bg-slate-900/50 z-40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 26, stiffness: 200 }}
              className="fixed inset-y-0 right-0 w-full max-w-md bg-white z-50 shadow-2xl flex flex-col"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 shrink-0">
                <div>
                  <h2 className="font-black text-slate-900 text-[15px]">
                    {editGoal ? "Editar Meta" : "Nova Meta"}
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    {editGoal ? "Altere título, descrição ou valor alvo" : "Configure o dono, tipo, período e valor alvo"}
                  </p>
                </div>
                <button onClick={closeGoalForm} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500">
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-4">

                {/* Dono da meta */}
                {!editGoal && (
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                      Meta de *
                    </label>
                    <div className="relative">
                      <select
                        value={goalForm.seller_id}
                        onChange={(e) => setGoalForm((f) => ({ ...f, seller_id: e.target.value === "" ? "" : Number(e.target.value) }))}
                        className="w-full h-9 pl-3 pr-8 rounded-lg border border-slate-200 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      >
                        <option value="">Loja (geral)</option>
                        {sellers.map((s) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                )}

                {/* Título */}
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                    Título da Meta *
                  </label>
                  <input
                    value={goalForm.title}
                    onChange={(e) => setGoalForm((f) => ({ ...f, title: e.target.value }))}
                    placeholder="Ex: Vender R$ 10.000 em Julho"
                    className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Descrição */}
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                    Descrição (opcional)
                  </label>
                  <textarea
                    value={goalForm.description}
                    onChange={(e) => setGoalForm((f) => ({ ...f, description: e.target.value }))}
                    rows={2}
                    placeholder="Detalhes ou estratégias para atingir a meta…"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>

                {/* Tipo */}
                {!editGoal && (
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-2">
                      Tipo de Meta *
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {SELLER_GOAL_TYPES.map((t) => (
                        <button key={t.value} onClick={() => setGoalForm((f) => ({ ...f, type: t.value }))}
                          className={cn(
                            "flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left transition-all",
                            goalForm.type === t.value ? `${t.bg} ${t.border} ${t.color} border-2` : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                          )}>
                          <t.icon size={14} className={goalForm.type === t.value ? t.color : "text-slate-400"} />
                          <span className="text-[11px] font-bold leading-tight">{t.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Período */}
                {!editGoal && (
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                      Período *
                    </label>
                    <div className="relative">
                      <select
                        value={goalForm.period}
                        onChange={(e) => setGoalForm((f) => ({ ...f, period: e.target.value }))}
                        className="w-full h-9 pl-3 pr-8 rounded-lg border border-slate-200 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      >
                        {PERIODS.map((p) => (
                          <option key={p.value} value={p.value}>{p.label}</option>
                        ))}
                      </select>
                      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                )}

                {/* Datas */}
                {!editGoal && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                        Início *
                      </label>
                      <input
                        type="date"
                        value={goalForm.start_date}
                        onChange={(e) => setGoalForm((f) => ({ ...f, period: "custom", start_date: e.target.value }))}
                        className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                        Fim *
                      </label>
                      <input
                        type="date"
                        value={goalForm.end_date}
                        onChange={(e) => setGoalForm((f) => ({ ...f, period: "custom", end_date: e.target.value }))}
                        className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                )}

                {/* Valor alvo */}
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                    Valor Alvo * {getTypeConfig(goalForm.type).unit === "currency" ? "(R$)" : "(unidades)"}
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">
                      {getTypeConfig(goalForm.type).unit === "currency" ? "R$" : "#"}
                    </span>
                    <input
                      type="number"
                      min={0}
                      step={getTypeConfig(goalForm.type).unit === "currency" ? "0.01" : "1"}
                      value={goalForm.target_value}
                      onChange={(e) => setGoalForm((f) => ({ ...f, target_value: e.target.value }))}
                      placeholder={getTypeConfig(goalForm.type).unit === "currency" ? "0,00" : "0"}
                      className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="border-t border-slate-200 px-5 py-4 shrink-0 bg-slate-50 flex gap-2">
                <button onClick={closeGoalForm}
                  className="flex-1 h-9 rounded-lg border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-100">
                  Cancelar
                </button>
                <button
                  onClick={handleSaveGoal}
                  disabled={savingGoal || !goalForm.title.trim() || !goalForm.target_value || (!editGoal && (!goalForm.start_date || !goalForm.end_date))}
                  className="flex-1 h-9 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {savingGoal ? "Salvando…" : editGoal ? "Salvar Alterações" : "Criar Meta"}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

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
              className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
            >
              <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-sm max-h-[92vh] sm:max-h-[88vh] overflow-y-auto overscroll-contain">
                {/* Colored header */}
                <div className="sticky top-0 z-10 bg-gradient-to-br from-blue-600 to-blue-700 px-5 sm:px-6 pt-5 sm:pt-6 pb-8 text-white relative">
                  <button onClick={() => setDetailSeller(null)}
                    className="absolute top-4 right-4 p-1.5 hover:bg-white/20 rounded-lg transition-colors">
                    <X size={16} />
                  </button>
                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white/20 flex items-center justify-center font-black text-xl sm:text-2xl mb-3 shrink-0">
                    {detailSeller.name.charAt(0).toUpperCase()}
                  </div>
                  <h3 className="font-black text-base sm:text-lg leading-tight truncate pr-8">{detailSeller.name}</h3>
                  {(detailSeller.phone || detailSeller.email) && (
                    <div className="mt-1 space-y-0.5">
                      {detailSeller.phone && (
                        <p className="text-blue-200 text-xs sm:text-sm flex items-center gap-1.5 truncate">
                          <Phone size={11} className="shrink-0" /> <span className="truncate">{detailSeller.phone}</span>
                        </p>
                      )}
                      {detailSeller.email && (
                        <p className="text-blue-200 text-xs sm:text-sm flex items-center gap-1.5 truncate">
                          <Mail size={11} className="shrink-0" /> <span className="truncate">{detailSeller.email}</span>
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Stats */}
                <div className="px-5 sm:px-6 -mt-4 relative z-10">
                  <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-3 sm:p-4 grid grid-cols-3 gap-2 sm:gap-3">
                    <div className="text-center min-w-0">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider truncate">Comissão</p>
                      <p className="font-black text-blue-600 text-sm sm:text-base truncate">{Number(detailSeller.commission_rate).toFixed(1)}%</p>
                    </div>
                    <div className="text-center border-x border-slate-100 min-w-0 px-1">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider truncate">Vendas mês</p>
                      <p className="font-black text-slate-900 text-sm sm:text-base truncate">{detailSeller.month_sales}</p>
                    </div>
                    <div className="text-center min-w-0">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider truncate">Receita mês</p>
                      <p className="font-black text-emerald-600 text-xs sm:text-sm truncate">{fmt(detailSeller.month_revenue)}</p>
                    </div>
                  </div>
                </div>

                <div className="p-5 sm:p-6 space-y-3">
                  {/* Comissão do mês */}
                  <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 sm:p-4 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Comissão a Receber</p>
                      <p className="text-[10px] text-emerald-500">{MONTHS[month-1]} {year}</p>
                    </div>
                    <p className="font-black text-emerald-700 text-lg sm:text-xl shrink-0">{fmt(detailSeller.month_commission)}</p>
                  </div>

                  {/* All time */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-50 rounded-xl p-3 min-w-0">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Receita Total</p>
                      <p className="font-black text-slate-900 text-sm mt-0.5 truncate">{fmt(detailSeller.all_time_revenue)}</p>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-3 min-w-0">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Comissão Total</p>
                      <p className="font-black text-slate-900 text-sm mt-0.5 truncate">{fmt(detailSeller.all_time_commission)}</p>
                    </div>
                  </div>

                  {detailSeller.notes && (
                    <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                      <p className="text-[9px] font-bold text-amber-500 uppercase tracking-wider mb-1">Obs</p>
                      <p className="text-sm text-amber-800 break-words">{detailSeller.notes}</p>
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
