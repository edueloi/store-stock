import { useState, useEffect, useCallback, useRef } from "react";
import {
  Users, Plus, Search, Edit2, Trash2, Trophy,
  TrendingUp, DollarSign, X, Check, ChevronLeft,
  ChevronRight, Star, Medal, Award, ToggleLeft, ToggleRight,
  Phone, Mail, FileText, Percent, Target, ChevronDown,
  Clock, Flame, XCircle, CheckCircle2, AlertCircle, HelpCircle,
} from "lucide-react";
import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../../lib/utils";
import { Button, IconButton, Input, Textarea, Select, Switch, Modal, ModalFooter, Badge, Alert, EmptyState, PanelCard, DetailField, SectionTitle, StatGrid, StatCard, Tabs, FilterLine, FilterLineSection, FilterLineSearch, FilterLineSegmented } from "../../components/ui";
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
import SellersPageTour, { SELLERS_PAGE_TOUR_EVENTS, type SellersPageTourHandle } from "../../components/onboarding/SellersPageTour";

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
  user_id?: number | null;
}

interface TeamUser {
  id: number;
  name: string;
  email: string;
  role: string;
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
  commission_rate: 0, is_active: true, notes: "", user_id: null,
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

type SellersTab = "ranking" | "metas" | "cadastro";
type RankingMode = "revenue" | "goals";

const SELLERS_TABS = [
  { id: "ranking", label: "Ranking & Comissões", icon: Trophy },
  { id: "metas", label: "Metas", icon: Target },
  { id: "cadastro", label: "Cadastro", icon: Users },
] as const satisfies readonly { id: SellersTab; label: string; icon: React.ElementType }[];

const RANKING_TABS = [
  { id: "revenue", label: "Por Receita", icon: DollarSign },
  { id: "goals", label: "% de Meta Batida", icon: Target },
] as const satisfies readonly { id: RankingMode; label: string; icon: React.ElementType }[];

// ─── Component ────────────────────────────────────────────────────────────────

export default function Sellers() {
  const now = new Date();
  const [tab, setTab]             = useState<SellersTab>("ranking");
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
  const [rankingMode, setRankingMode] = useState<RankingMode>("revenue");
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

  const [teamUsers, setTeamUsers] = useState<TeamUser[]>([]);

  const sellersPageTourRef = useRef<SellersPageTourHandle>(null);

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

  const fetchTeamUsers = useCallback(async () => {
    const r = await fetch("/api/team", { headers: authH() });
    const d = await r.json();
    setTeamUsers(Array.isArray(d) ? d : []);
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

  useEffect(() => { fetchStats(); fetchSellers(); fetchSellerGoals(); fetchTeamUsers(); }, [fetchStats, fetchSellers, fetchSellerGoals, fetchTeamUsers]);
  useEffect(() => { if (rankingMode === "goals") fetchGoalsRanking(); }, [rankingMode, fetchGoalsRanking]);

  // ── CRUD ──────────────────────────────────────────────────────────────────

  const openNew = () => { setEditing(null); setForm(emptyForm()); setShowModal(true); };

  const openEdit = (s: Seller) => {
    setEditing(s);
    setForm({
      name: s.name, email: s.email ?? "", phone: s.phone ?? "",
      document: s.document ?? "", commission_rate: Number(s.commission_rate),
      is_active: s.is_active, notes: s.notes ?? "", user_id: s.user_id ?? null,
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

  // ── Canal de comunicação do TOUR DE PÁGINA (SellersPageTour) ──────────────
  // Troca de aba via setTab e abre o modal "Novo Vendedor"/drawer "Nova Meta"
  // de verdade via openNew/openNewGoal, preenchendo campos de exemplo via
  // setForm/setGoalForm — nunca chama handleSave, handleDelete
  // (window.confirm), handleToggleActive, handleSaveGoal ou handleDeleteGoal
  // (window.confirm). Fechar sempre via setShowModal(false)/closeGoalForm.
  useEffect(() => {
    const onGoRanking = () => setTab("ranking");
    const onGoCadastro = () => setTab("cadastro");
    const onGoMetas = () => setTab("metas");
    const onOpenNewSeller = () => openNew();
    const onFillSeller = (e: Event) => {
      const detail = (e as CustomEvent<Partial<typeof form>>).detail;
      if (detail) setForm((prev) => ({ ...prev, ...detail }));
    };
    const onCloseSellerModal = () => setShowModal(false);
    const onOpenNewGoal = () => openNewGoal();
    const onFillGoal = (e: Event) => {
      const detail = (e as CustomEvent<Partial<typeof goalForm>>).detail;
      if (detail) setGoalForm((prev) => ({ ...prev, ...detail }));
    };
    const onCloseGoalForm = () => closeGoalForm();

    window.addEventListener(SELLERS_PAGE_TOUR_EVENTS.goRankingTab, onGoRanking);
    window.addEventListener(SELLERS_PAGE_TOUR_EVENTS.goCadastroTab, onGoCadastro);
    window.addEventListener(SELLERS_PAGE_TOUR_EVENTS.goMetasTab, onGoMetas);
    window.addEventListener(SELLERS_PAGE_TOUR_EVENTS.openNewSeller, onOpenNewSeller);
    window.addEventListener(SELLERS_PAGE_TOUR_EVENTS.fillSeller, onFillSeller);
    window.addEventListener(SELLERS_PAGE_TOUR_EVENTS.closeSellerModal, onCloseSellerModal);
    window.addEventListener(SELLERS_PAGE_TOUR_EVENTS.openNewGoal, onOpenNewGoal);
    window.addEventListener(SELLERS_PAGE_TOUR_EVENTS.fillGoal, onFillGoal);
    window.addEventListener(SELLERS_PAGE_TOUR_EVENTS.closeGoalForm, onCloseGoalForm);
    return () => {
      window.removeEventListener(SELLERS_PAGE_TOUR_EVENTS.goRankingTab, onGoRanking);
      window.removeEventListener(SELLERS_PAGE_TOUR_EVENTS.goCadastroTab, onGoCadastro);
      window.removeEventListener(SELLERS_PAGE_TOUR_EVENTS.goMetasTab, onGoMetas);
      window.removeEventListener(SELLERS_PAGE_TOUR_EVENTS.openNewSeller, onOpenNewSeller);
      window.removeEventListener(SELLERS_PAGE_TOUR_EVENTS.fillSeller, onFillSeller);
      window.removeEventListener(SELLERS_PAGE_TOUR_EVENTS.closeSellerModal, onCloseSellerModal);
      window.removeEventListener(SELLERS_PAGE_TOUR_EVENTS.openNewGoal, onOpenNewGoal);
      window.removeEventListener(SELLERS_PAGE_TOUR_EVENTS.fillGoal, onFillGoal);
      window.removeEventListener(SELLERS_PAGE_TOUR_EVENTS.closeGoalForm, onCloseGoalForm);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    <div data-tour="sellers-page" className="space-y-4">
      <SectionTitle
        title="Vendedores"
        icon={Users}
        description="Ranking, comissões, metas e cadastro da equipe de vendas"
        action={
          <div className="flex flex-wrap items-center gap-2">
            {tab === "metas" ? (
              <Button size="sm" iconLeft={<Plus size={14} />} onClick={openNewGoal}>Nova Meta</Button>
            ) : (
              <Button size="sm" iconLeft={<Plus size={14} />} onClick={openNew}>Novo Vendedor</Button>
            )}
            <Button
              variant="outline"
              size="sm"
              iconLeft={<HelpCircle size={14} />}
              onClick={() => sellersPageTourRef.current?.start()}
              title="Tour guiado desta página"
            >
              <span className="sr-only sm:not-sr-only">Ajuda</span>
            </Button>
          </div>
        }
      />

      <SellersPageTour ref={sellersPageTourRef} />

      <Tabs<SellersTab> items={SELLERS_TABS} value={tab} onChange={setTab} label="Seções de vendedores">

      {/* ══════════════════ RANKING TAB ══════════════════ */}
      {tab === "ranking" && (
        <div className="space-y-3">

          {/* Period selector */}
          <div className="flex items-center gap-2">
            <IconButton variant="outline" onClick={prevMonth} aria-label="Mês anterior">
              <ChevronLeft size={15} />
            </IconButton>
            <span className="min-w-[160px] text-center text-[13px] font-medium text-slate-900">
              {MONTHS[month - 1]} {year}
            </span>
            <IconButton variant="outline" onClick={nextMonth} aria-label="Próximo mês">
              <ChevronRight size={15} />
            </IconButton>
          </div>

          {/* Sub-abas: por receita vs % de meta batida */}
          <Tabs<RankingMode> items={RANKING_TABS} value={rankingMode} onChange={setRankingMode} label="Critério do ranking">

          {rankingMode === "revenue" && (
          <div className="space-y-3">
          {/* Summary cards */}
          <StatGrid cols={4}>
            <StatCard title="Vendedores Ativos" value={activeSellers} icon={Users} color="info" />
            <StatCard title="Vendas no Mês" value={totalSales} icon={TrendingUp} color="success" />
            <StatCard title="Receita Total" value={fmt(totalRevenue)} icon={DollarSign} color="warning" />
            <StatCard title="Comissões a Pagar" value={fmt(totalCommission)} icon={Percent} color="purple" />
          </StatGrid>

          {/* Ranking list */}
          {loading ? (
            <div role="status" className="flex justify-center py-12 text-sm text-slate-500">Carregando…</div>
          ) : stats.filter((s) => s.is_active).length === 0 ? (
            <EmptyState icon={Trophy} title="Nenhum vendedor ativo ou sem vendas no período" />
          ) : (
            <div className="space-y-2">
              {stats.filter((s) => s.is_active).map((s, idx) => (
                <motion.div
                  key={s.id}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.04 }}
                  onClick={() => setDetailSeller(s)}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 transition-all hover:border-blue-200",
                    idx === 0 && "border-yellow-300 bg-yellow-50/40"
                  )}
                >
                  {/* Rank */}
                  <div className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg font-semibold",
                    idx === 0 ? "bg-yellow-100" : idx === 1 ? "bg-slate-100" : idx === 2 ? "bg-amber-50" : "bg-slate-50 text-slate-400"
                  )}>
                    {idx < 3 ? MEDAL_ICONS[idx] : <span className="text-[13px] text-slate-400">#{idx + 1}</span>}
                  </div>

                  {/* Avatar */}
                  <div className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-semibold text-white",
                    idx === 0 ? "bg-yellow-500" : "bg-blue-600"
                  )}>
                    {s.name.charAt(0).toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-slate-900">{s.name}</p>
                    <p className="text-[11px] text-slate-500">
                      {s.month_sales} {s.month_sales === 1 ? "venda" : "vendas"} · {Number(s.commission_rate).toFixed(1)}% comissão
                    </p>
                  </div>

                  {/* Stats — responsive */}
                  <div className="hidden shrink-0 items-center gap-6 sm:flex">
                    <div className="text-right">
                      <p className="text-[11px] text-slate-500">Receita</p>
                      <p className="text-[13px] font-semibold tabular-nums text-slate-900">{fmt(s.month_revenue)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] text-slate-500">Comissão</p>
                      <p className="text-[13px] font-semibold tabular-nums text-emerald-700">{fmt(s.month_commission)}</p>
                    </div>
                  </div>

                  {/* Mobile: only commission */}
                  <div className="shrink-0 text-right sm:hidden">
                    <p className="text-[11px] text-slate-500">Comissão</p>
                    <p className="text-[13px] font-semibold tabular-nums text-emerald-700">{fmt(s.month_commission)}</p>
                  </div>

                  {/* Progress bar — % de participação na receita total */}
                  <div className="hidden w-24 shrink-0 lg:block">
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={cn("h-full rounded-full transition-all", idx === 0 ? "bg-yellow-400" : "bg-blue-500")}
                        style={{ width: totalRevenue > 0 ? `${Math.min(100, (s.month_revenue / totalRevenue) * 100)}%` : "0%" }}
                      />
                    </div>
                    <p className="mt-0.5 text-right text-[11px] text-slate-500">
                      {totalRevenue > 0 ? ((s.month_revenue / totalRevenue) * 100).toFixed(0) : 0}%
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
          </div>
          )}

          {rankingMode === "goals" && (
            goalsRankingLoading ? (
              <div role="status" className="flex justify-center py-12 text-sm text-slate-500">Carregando…</div>
            ) : goalsRanking.length === 0 ? (
              <EmptyState icon={Target} title="Nenhum vendedor ativo cadastrado" />
            ) : (
              <div className="space-y-2">
                {goalsRanking.map((s, idx) => {
                  const hasGoal = s.goal != null && s.progress_pct != null;
                  const pct = hasGoal ? Math.min(100, s.progress_pct!) : 0;
                  return (
                    <motion.div
                      key={s.id}
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.04 }}
                      className={cn(
                        "flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 transition-all",
                        hasGoal && idx === 0 && "border-yellow-300 bg-yellow-50/40"
                      )}
                    >
                      {/* Rank */}
                      <div className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg font-semibold",
                        hasGoal && idx === 0 ? "bg-yellow-100" : hasGoal && idx === 1 ? "bg-slate-100" : hasGoal && idx === 2 ? "bg-amber-50" : "bg-slate-50 text-slate-400"
                      )}>
                        {hasGoal && idx < 3 ? MEDAL_ICONS[idx] : <span className="text-[13px] text-slate-400">#{idx + 1}</span>}
                      </div>

                      {/* Avatar */}
                      <div className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-semibold text-white",
                        hasGoal && idx === 0 ? "bg-yellow-500" : "bg-blue-600"
                      )}>
                        {s.name.charAt(0).toUpperCase()}
                      </div>

                      {/* Info */}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-slate-900">{s.name}</p>
                        {hasGoal ? (
                          <p className="truncate text-[11px] text-slate-500">
                            {s.goal!.title} · {getTypeConfig(s.goal!.type).label}
                          </p>
                        ) : (
                          <Badge pill className="mt-0.5">Sem meta definida</Badge>
                        )}
                      </div>

                      {hasGoal && (
                        <>
                          <div className="hidden shrink-0 items-center gap-6 sm:flex">
                            <div className="text-right">
                              <p className="text-[11px] text-slate-500">Progresso</p>
                              <p className="text-[13px] font-semibold tabular-nums text-slate-900">
                                {fmtValue(Number(s.goal!.current_value), getTypeConfig(s.goal!.type).unit)} / {fmtValue(Number(s.goal!.target_value), getTypeConfig(s.goal!.type).unit)}
                              </p>
                            </div>
                          </div>

                          <div className="w-24 shrink-0">
                            <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                              <div
                                className={cn("h-full rounded-full transition-all", progressColor(s.progress_pct!))}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <p className={cn("mt-0.5 text-right text-[11px] font-medium", progressColor(s.progress_pct!).replace("bg-", "text-"))}>
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
          </Tabs>
        </div>
      )}

      {/* ══════════════════ CADASTRO TAB ══════════════════ */}
      {tab === "cadastro" && (
        <div className="space-y-3">
          {/* Search */}
          <FilterLine>
            <FilterLineSection grow>
              <FilterLineSearch
                aria-label="Buscar vendedor"
                value={search}
                onChange={setSearch}
                placeholder="Buscar vendedor..."
              />
            </FilterLineSection>
          </FilterLine>

          {filteredSellers.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Nenhum vendedor cadastrado"
              action={<Button size="sm" onClick={openNew}>Cadastrar primeiro vendedor</Button>}
            />
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {filteredSellers.map((s) => {
                const st = stats.find((x) => x.id === s.id);
                return (
                  <motion.div key={s.id}
                    initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 transition-all hover:border-blue-200"
                  >
                    {/* Header */}
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-base font-semibold text-white",
                        s.is_active ? "bg-blue-600" : "bg-slate-300"
                      )}>
                        {s.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-semibold text-slate-900">{s.name}</p>
                        <Badge size="sm" dot color={s.is_active ? "success" : "default"} className="mt-0.5">
                          {s.is_active ? "Ativo" : "Inativo"}
                        </Badge>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <IconButton size="xs" aria-label="Editar vendedor" onClick={() => openEdit(s)}>
                          <Edit2 size={13} />
                        </IconButton>
                        <IconButton size="xs" variant="danger" aria-label="Excluir vendedor" onClick={() => handleDelete(s.id)}>
                          <Trash2 size={13} />
                        </IconButton>
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

                    {/* Commission */}
                    <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                      <span className="text-[11px] text-slate-500">Comissão</span>
                      <span className="text-[13px] font-semibold text-blue-600">{Number(s.commission_rate).toFixed(1)}%</span>
                    </div>

                    {/* Month stats */}
                    {st && (
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-lg bg-blue-50 py-2 text-center">
                          <p className="text-[11px] text-blue-500">Vendas {MONTHS[month-1].slice(0,3)}</p>
                          <p className="text-sm font-semibold text-blue-700">{st.month_sales}</p>
                        </div>
                        <div className="rounded-lg bg-emerald-50 py-2 text-center">
                          <p className="text-[11px] text-emerald-600">Comissão</p>
                          <p className="text-[13px] font-semibold text-emerald-700">{fmt(st.month_commission)}</p>
                        </div>
                      </div>
                    )}

                    {/* Toggle active */}
                    <Button
                      variant={s.is_active ? "outline" : "success"}
                      size="xs"
                      fullWidth
                      iconLeft={s.is_active ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                      onClick={() => handleToggleActive(s)}
                    >
                      {s.is_active ? "Desativar" : "Ativar"}
                    </Button>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════ METAS TAB ══════════════════ */}
      {tab === "metas" && (
        <div className="space-y-3">
          {/* Filtro por vendedor */}
          <FilterLine>
            <FilterLineSection grow>
              <FilterLineSegmented<string | number>
                value={goalFilter}
                onChange={(v) => setGoalFilter(v === "all" ? "all" : Number(v))}
                options={[
                  { value: "all", label: "Todas" },
                  ...sellers.map((s) => ({ value: s.id as string | number, label: s.name })),
                ]}
              />
            </FilterLineSection>
          </FilterLine>

          {goalsLoading ? (
            <div role="status" className="flex justify-center py-12 text-sm text-slate-500">Carregando…</div>
          ) : filteredGoals.length === 0 ? (
            <EmptyState
              icon={Target}
              title="Nenhuma meta encontrada"
              action={<Button size="sm" onClick={openNewGoal}>Criar primeira meta</Button>}
            />
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
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
                        "flex flex-col gap-0 overflow-hidden rounded-lg border bg-white transition-all hover:border-blue-200",
                        isDone ? "border-emerald-300 ring-1 ring-emerald-200" : "border-slate-200"
                      )}
                    >
                      <div className="flex items-start justify-between px-3 pt-3 pb-3">
                        <div className="flex min-w-0 items-start gap-3">
                          <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border", cfg.bg, cfg.border)}>
                            <Icon size={16} className={cfg.color} />
                          </div>
                          <div className="min-w-0">
                            <p className="mb-0.5 text-[11px] leading-none text-slate-500">
                              {getPeriodLabel(g.period)} · {cfg.label}
                            </p>
                            <h3 className="truncate text-[13px] font-semibold leading-tight text-slate-800">{g.title}</h3>
                            <p className="mt-0.5 text-[11px] font-medium text-blue-600">{sellerName(g.seller_id)}</p>
                          </div>
                        </div>
                        <div className="ml-2 flex shrink-0 items-center gap-1">
                          {isDone && <Trophy size={14} className="text-amber-400" />}
                          <IconButton size="xs" aria-label="Editar meta" onClick={() => openEditGoal(g)}>
                            <Edit2 size={13} />
                          </IconButton>
                          <IconButton size="xs" variant="danger" aria-label="Excluir meta" onClick={() => handleDeleteGoal(g.id)}>
                            <Trash2 size={13} />
                          </IconButton>
                        </div>
                      </div>

                      <div className="px-3 pb-1">
                        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                          <motion.div
                            initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, ease: "easeOut" }}
                            className={cn("h-full rounded-full", progressColor(pct))}
                          />
                        </div>
                        <div className="mt-1.5 flex items-center justify-between">
                          <span className={cn("text-[11px] font-semibold", progressColor(pct).replace("bg-", "text-"))}>
                            {pct.toFixed(1)}%
                          </span>
                          <span className="text-[11px] font-medium text-slate-500">
                            {fmtValue(Number(g.current_value), cfg.unit)} / {fmtValue(Number(g.target_value), cfg.unit)}
                          </span>
                        </div>
                      </div>

                      <div className="mt-auto flex items-center justify-between border-t border-slate-100 px-3 py-2.5">
                        <div className="flex items-center gap-1.5">
                          {isDone ? (
                            <Badge color="success" icon={<CheckCircle2 size={10} />}>Meta atingida!</Badge>
                          ) : isExpired ? (
                            <Badge color="danger" icon={<XCircle size={10} />}>Expirada</Badge>
                          ) : left <= 3 ? (
                            <Badge color="warning" icon={<Flame size={10} />}>{left}d restante{left !== 1 ? "s" : ""}</Badge>
                          ) : (
                            <span className="flex items-center gap-1 text-[11px] font-medium text-slate-500">
                              <Clock size={10} /> {left}d restantes
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-500">
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
      </Tabs>

      {/* ══════════ FORM — NOVA/EDITAR META ══════════ */}
      <Modal
        open={showGoalForm}
        onClose={closeGoalForm}
        position="right"
        size="md"
        title={editGoal ? "Editar Meta" : "Nova Meta"}
        subtitle={editGoal ? "Altere título, descrição ou valor alvo" : "Configure o dono, tipo, período e valor alvo"}
        footer={
          <ModalFooter>
            <Button variant="outline" onClick={closeGoalForm}>Cancelar</Button>
            <Button
              onClick={handleSaveGoal}
              disabled={savingGoal || !goalForm.title.trim() || !goalForm.target_value || (!editGoal && (!goalForm.start_date || !goalForm.end_date))}
            >
              {savingGoal ? "Salvando…" : editGoal ? "Salvar Alterações" : "Criar Meta"}
            </Button>
          </ModalFooter>
        }
      >
        <div className="space-y-4">
          {/* Dono da meta */}
          {!editGoal && (
            <Select
              label="Meta de *"
              value={goalForm.seller_id}
              onChange={(e) => setGoalForm((f) => ({ ...f, seller_id: e.target.value === "" ? "" : Number(e.target.value) }))}
            >
              <option value="">Loja (geral)</option>
              {sellers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>
          )}

          {/* Título */}
          <div data-tour="seller-goal-form-title">
            <Input
              label="Título da Meta *"
              value={goalForm.title}
              onChange={(e) => setGoalForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Ex: Vender R$ 10.000 em Julho"
            />
          </div>

          {/* Descrição */}
          <Textarea
            label="Descrição (opcional)"
            value={goalForm.description}
            onChange={(e) => setGoalForm((f) => ({ ...f, description: e.target.value }))}
            rows={2}
            placeholder="Detalhes ou estratégias para atingir a meta…"
          />

          {/* Tipo */}
          {!editGoal && (
            <div>
              <span className="ds-label mb-1.5 block">Tipo de Meta *</span>
              <div className="grid grid-cols-2 gap-2">
                {SELLER_GOAL_TYPES.map((t) => (
                  <button type="button" key={t.value} onClick={() => setGoalForm((f) => ({ ...f, type: t.value }))}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-all",
                      goalForm.type === t.value ? `${t.bg} ${t.border} ${t.color}` : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    )}>
                    <t.icon size={14} className={goalForm.type === t.value ? t.color : "text-slate-400"} />
                    <span className="text-[11px] font-medium leading-tight">{t.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Período */}
          {!editGoal && (
            <Select
              label="Período *"
              value={goalForm.period}
              onChange={(e) => setGoalForm((f) => ({ ...f, period: e.target.value }))}
            >
              {PERIODS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </Select>
          )}

          {/* Datas */}
          {!editGoal && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                label="Início *"
                type="date"
                value={goalForm.start_date}
                onChange={(e) => setGoalForm((f) => ({ ...f, period: "custom", start_date: e.target.value }))}
              />
              <Input
                label="Fim *"
                type="date"
                value={goalForm.end_date}
                onChange={(e) => setGoalForm((f) => ({ ...f, period: "custom", end_date: e.target.value }))}
              />
            </div>
          )}

          {/* Valor alvo */}
          <Input
            label={`Valor Alvo * ${getTypeConfig(goalForm.type).unit === "currency" ? "(R$)" : "(unidades)"}`}
            type="number"
            min={0}
            step={getTypeConfig(goalForm.type).unit === "currency" ? "0.01" : "1"}
            value={goalForm.target_value}
            onChange={(e) => setGoalForm((f) => ({ ...f, target_value: e.target.value }))}
            placeholder={getTypeConfig(goalForm.type).unit === "currency" ? "0,00" : "0"}
            addonLeft={getTypeConfig(goalForm.type).unit === "currency" ? "R$" : "#"}
          />
        </div>
      </Modal>

      {/* ══════════ MODAL CADASTRO / EDIÇÃO ══════════ */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        size="sm"
        title={editing ? "Editar Vendedor" : "Novo Vendedor"}
        footer={
          <ModalFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button
              onClick={handleSave}
              disabled={saving || !form.name.trim()}
              iconLeft={saved ? <Check size={14} /> : undefined}
            >
              {saved ? "Salvo!" : saving ? "Salvando…" : editing ? "Atualizar" : "Cadastrar"}
            </Button>
          </ModalFooter>
        }
      >
        <div className="space-y-4">
          {/* Nome */}
          <div data-tour="seller-form-name">
            <Input
              label="Nome *"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Nome completo"
            />
          </div>

          {/* Telefone + Email */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="Telefone"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              placeholder="(11) 99999-9999"
            />
            <Input
              label="E-mail"
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="email@email.com"
            />
          </div>

          {/* CPF / CNPJ */}
          <Input
            label="CPF / CNPJ"
            value={form.document}
            onChange={(e) => setForm((f) => ({ ...f, document: e.target.value }))}
            placeholder="000.000.000-00"
          />

          {/* Vínculo de login */}
          <Select
            label="Vincular a um usuário do sistema"
            value={form.user_id ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, user_id: e.target.value ? Number(e.target.value) : null }))}
            hint="Quando este usuário fizer login no PDV, o vendedor já vem selecionado por padrão."
          >
            <option value="">Nenhum</option>
            {teamUsers.map((u) => (
              <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
            ))}
          </Select>

          {/* Comissão */}
          <Input
            label="Taxa de Comissão (%)"
            type="number"
            min={0}
            max={100}
            step={0.1}
            value={form.commission_rate}
            onChange={(e) => setForm((f) => ({ ...f, commission_rate: Number(e.target.value) }))}
            iconRight={<Percent size={13} />}
            hint="Comissão calculada sobre o valor total das vendas do vendedor"
          />

          {/* Status */}
          <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-3">
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-slate-700">Vendedor Ativo</p>
              <p className="text-[11px] text-slate-500">Pode ser selecionado no PDV</p>
            </div>
            <Switch
              checked={form.is_active}
              onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))}
              aria-label="Vendedor ativo"
            />
          </div>

          {/* Observações */}
          <Textarea
            label="Observações"
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            rows={2}
            placeholder="Metas, turno, região..."
          />
        </div>
      </Modal>

      {/* ══════════ MODAL DETALHE DO VENDEDOR ══════════ */}
      <Modal
        open={!!detailSeller}
        onClose={() => setDetailSeller(null)}
        size="sm"
        title={detailSeller?.name ?? ""}
        subtitle={detailSeller ? [detailSeller.phone, detailSeller.email].filter(Boolean).join(" · ") || undefined : undefined}
        footer={detailSeller ? (
          <ModalFooter align="between">
            <Button variant="ghost" size="sm" onClick={() => setDetailSeller(null)}>Fechar</Button>
            <Button size="sm" iconLeft={<Edit2 size={14} />} onClick={() => { const s = detailSeller; setDetailSeller(null); openEdit(s); }}>
              Editar Vendedor
            </Button>
          </ModalFooter>
        ) : undefined}
      >
        {detailSeller && (
          <div className="space-y-3">
            <StatGrid cols={3}>
              <StatCard title="Comissão" value={`${Number(detailSeller.commission_rate).toFixed(1)}%`} icon={Percent} color="info" />
              <StatCard title="Vendas mês" value={detailSeller.month_sales} icon={TrendingUp} color="success" />
              <StatCard title="Receita mês" value={fmt(detailSeller.month_revenue)} icon={DollarSign} color="warning" />
            </StatGrid>

            <Alert variant="success" title={`Comissão a Receber · ${MONTHS[month-1]} ${year}`}>
              <span className="text-base font-semibold">{fmt(detailSeller.month_commission)}</span>
            </Alert>

            <PanelCard title="Acumulado">
              <dl className="grid grid-cols-2 gap-x-6">
                <DetailField label="Receita Total" value={fmt(detailSeller.all_time_revenue)} />
                <DetailField label="Comissão Total" value={fmt(detailSeller.all_time_commission)} />
              </dl>
            </PanelCard>

            {detailSeller.notes && (
              <Alert variant="warning" title="Observações">{detailSeller.notes}</Alert>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
