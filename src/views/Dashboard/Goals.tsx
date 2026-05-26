import { useState, useEffect, useCallback } from "react";
import {
  Target,
  Plus,
  Trash2,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  Users,
  FileText,
  X,
  CheckCircle2,
  Clock,
  XCircle,
  Edit2,
  ChevronDown,
  Flame,
  Trophy,
  AlertCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../../lib/utils";
import PageHeader from "../../components/layout/PageHeader";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Goal {
  id: number;
  title: string;
  description?: string;
  type: string;
  period: string;
  target_value: number;
  current_value: number;
  start_date: string;
  end_date: string;
  status: "active" | "completed" | "cancelled";
  created_at: string;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const GOAL_TYPES = [
  { value: "revenue",           label: "Faturamento Bruto",        icon: DollarSign,   unit: "currency", color: "text-emerald-600", bg: "bg-emerald-50",  border: "border-emerald-200" },
  { value: "income",            label: "Entradas (Caixa)",          icon: TrendingUp,   unit: "currency", color: "text-blue-600",    bg: "bg-blue-50",     border: "border-blue-200" },
  { value: "expense_reduction", label: "Redução de Despesas",       icon: TrendingDown, unit: "currency", color: "text-orange-600",  bg: "bg-orange-50",   border: "border-orange-200" },
  { value: "orders_count",      label: "Nº de Vendas",              icon: ShoppingCart, unit: "number",   color: "text-violet-600",  bg: "bg-violet-50",   border: "border-violet-200" },
  { value: "quotes_converted",  label: "Orçamentos Convertidos",    icon: FileText,     unit: "number",   color: "text-cyan-600",    bg: "bg-cyan-50",     border: "border-cyan-200" },
  { value: "new_customers",     label: "Novos Clientes",            icon: Users,        unit: "number",   color: "text-pink-600",    bg: "bg-pink-50",     border: "border-pink-200" },
];

const PERIODS = [
  { value: "daily",     label: "Diária" },
  { value: "weekly",    label: "Semanal" },
  { value: "monthly",   label: "Mensal" },
  { value: "quarterly", label: "Trimestral" },
  { value: "biannual",  label: "Semestral" },
  { value: "annual",    label: "Anual" },
  { value: "custom",    label: "Personalizado" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtCurrency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtNumber = (v: number) => v.toLocaleString("pt-BR");

function fmtValue(v: number, unit: string) {
  return unit === "currency" ? fmtCurrency(v) : fmtNumber(Math.round(v));
}

const authHeader = () => ({
  Authorization: `Bearer ${localStorage.getItem("token")}`,
  "Content-Type": "application/json",
});

function getTypeConfig(type: string) {
  return GOAL_TYPES.find((t) => t.value === type) ?? GOAL_TYPES[0];
}

function getPeriodLabel(period: string) {
  return PERIODS.find((p) => p.value === period)?.label ?? period;
}

function progressColor(pct: number) {
  if (pct >= 100) return "bg-emerald-500";
  if (pct >= 75)  return "bg-blue-500";
  if (pct >= 50)  return "bg-amber-400";
  if (pct >= 25)  return "bg-orange-400";
  return "bg-red-400";
}

function daysLeft(endDate: string) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);
  return Math.ceil((end.getTime() - now.getTime()) / 86400000);
}

// Computes default date range for a given period
function defaultDates(period: string): { start: string; end: string } {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  switch (period) {
    case "daily":
      return { start: fmt(now), end: fmt(now) };
    case "weekly": {
      const start = new Date(now);
      start.setDate(now.getDate() - now.getDay());
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return { start: fmt(start), end: fmt(end) };
    }
    case "monthly": {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { start: fmt(start), end: fmt(end) };
    }
    case "quarterly": {
      const q = Math.floor(now.getMonth() / 3);
      const start = new Date(now.getFullYear(), q * 3, 1);
      const end = new Date(now.getFullYear(), q * 3 + 3, 0);
      return { start: fmt(start), end: fmt(end) };
    }
    case "biannual": {
      const half = now.getMonth() < 6 ? 0 : 1;
      const start = new Date(now.getFullYear(), half * 6, 1);
      const end = new Date(now.getFullYear(), half * 6 + 6, 0);
      return { start: fmt(start), end: fmt(end) };
    }
    case "annual": {
      return {
        start: `${now.getFullYear()}-01-01`,
        end:   `${now.getFullYear()}-12-31`,
      };
    }
    default:
      return { start: fmt(now), end: fmt(now) };
  }
}

// ─── Goal Card ────────────────────────────────────────────────────────────────

function GoalCard({
  goal,
  onDelete,
  onEdit,
}: {
  goal: Goal;
  onDelete: (id: number) => void;
  onEdit: (goal: Goal) => void;
}) {
  const cfg = getTypeConfig(goal.type);
  const Icon = cfg.icon;
  const pct = Math.min(100, goal.target_value > 0 ? (Number(goal.current_value) / Number(goal.target_value)) * 100 : 0);
  const left = daysLeft(goal.end_date);
  const isExpired = left < 0;
  const isDone = pct >= 100;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      className={cn(
        "bg-white rounded-2xl border shadow-sm hover:shadow-md transition-all flex flex-col gap-0 overflow-hidden",
        isDone ? "border-emerald-300 ring-1 ring-emerald-200" : "border-slate-200"
      )}
    >
      {/* Header */}
      <div className={cn("flex items-start justify-between px-4 pt-4 pb-3")}>
        <div className="flex items-start gap-3 min-w-0">
          <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0", cfg.bg, cfg.border, "border")}>
            <Icon size={16} className={cfg.color} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 leading-none mb-0.5">
              {getPeriodLabel(goal.period)} · {cfg.label}
            </p>
            <h3 className="font-black text-slate-800 text-[14px] leading-tight truncate">{goal.title}</h3>
            {goal.description && (
              <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">{goal.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0 ml-2">
          {isDone && <Trophy size={14} className="text-amber-400" />}
          <button
            onClick={() => onEdit(goal)}
            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors"
          >
            <Edit2 size={13} />
          </button>
          <button
            onClick={() => onDelete(goal.id)}
            className="p-1.5 hover:bg-red-50 rounded-lg text-slate-300 hover:text-red-400 transition-colors"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-4 pb-1">
        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className={cn("h-full rounded-full", progressColor(pct))}
          />
        </div>
        <div className="flex items-center justify-between mt-1.5">
          <span className={cn("text-[11px] font-black", progressColor(pct).replace("bg-", "text-"))}>
            {pct.toFixed(1)}%
          </span>
          <span className="text-[10px] text-slate-400 font-semibold">
            {fmtValue(Number(goal.current_value), cfg.unit)} / {fmtValue(Number(goal.target_value), cfg.unit)}
          </span>
        </div>
      </div>

      {/* Footer info */}
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
          Falta: {fmtValue(Math.max(0, Number(goal.target_value) - Number(goal.current_value)), cfg.unit)}
        </span>
      </div>
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

type PeriodFilter = "all" | "daily" | "weekly" | "monthly" | "quarterly" | "biannual" | "annual";

export default function Goals() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("all");
  const [showForm, setShowForm] = useState(false);
  const [editGoal, setEditGoal] = useState<Goal | null>(null);
  const [saving, setSaving] = useState(false);

  // Form fields
  const [fTitle, setFTitle]           = useState("");
  const [fDesc, setFDesc]             = useState("");
  const [fType, setFType]             = useState("revenue");
  const [fPeriod, setFPeriod]         = useState("monthly");
  const [fTarget, setFTarget]         = useState("");
  const [fStart, setFStart]           = useState("");
  const [fEnd, setFEnd]               = useState("");

  const fetchGoals = useCallback(async () => {
    const h = { Authorization: `Bearer ${localStorage.getItem("token")}` };
    try {
      const res = await fetch("/api/goals", { headers: h });
      const data = await res.json();
      setGoals(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchGoals(); }, [fetchGoals]);

  // Auto-fill dates when period changes
  useEffect(() => {
    if (fPeriod !== "custom") {
      const { start, end } = defaultDates(fPeriod);
      setFStart(start);
      setFEnd(end);
    }
  }, [fPeriod]);

  function openCreate() {
    setEditGoal(null);
    setFTitle(""); setFDesc(""); setFType("revenue"); setFPeriod("monthly"); setFTarget("");
    const { start, end } = defaultDates("monthly");
    setFStart(start); setFEnd(end);
    setShowForm(true);
  }

  function openEdit(goal: Goal) {
    setEditGoal(goal);
    setFTitle(goal.title);
    setFDesc(goal.description ?? "");
    setFType(goal.type);
    setFPeriod(goal.period);
    setFTarget(String(goal.target_value));
    setFStart(goal.start_date.split("T")[0]);
    setFEnd(goal.end_date.split("T")[0]);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditGoal(null);
  }

  async function handleSave() {
    if (!fTitle.trim() || !fTarget || !fStart || !fEnd) return;
    setSaving(true);
    try {
      const body = {
        title: fTitle,
        description: fDesc || undefined,
        type: fType,
        period: fPeriod,
        target_value: Number(fTarget),
        start_date: fStart,
        end_date: fEnd,
      };

      if (editGoal) {
        await fetch(`/api/goals/${editGoal.id}`, {
          method: "PUT",
          headers: authHeader(),
          body: JSON.stringify({ title: fTitle, description: fDesc || undefined, target_value: Number(fTarget) }),
        });
      } else {
        await fetch("/api/goals", {
          method: "POST",
          headers: authHeader(),
          body: JSON.stringify(body),
        });
      }
      await fetchGoals();
      closeForm();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Excluir esta meta?")) return;
    await fetch(`/api/goals/${id}`, { method: "DELETE", headers: authHeader() });
    fetchGoals();
  }

  // ── Filtered & stats
  const filtered = goals.filter(
    (g) => periodFilter === "all" || g.period === periodFilter
  );

  const active    = goals.filter((g) => g.status === "active");
  const achieved  = active.filter((g) => (Number(g.current_value) / Number(g.target_value)) * 100 >= 100);
  const onTrack   = active.filter((g) => {
    const pct = (Number(g.current_value) / Number(g.target_value)) * 100;
    return pct >= 50 && pct < 100;
  });
  const atRisk    = active.filter((g) => {
    const pct = (Number(g.current_value) / Number(g.target_value)) * 100;
    return pct < 50;
  });

  const cfg = getTypeConfig(fType);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Metas"
        subtitle="Acompanhe faturamento, vendas, despesas e muito mais"
        action={
          <button
            onClick={openCreate}
            className="h-9 px-4 bg-blue-600 text-white rounded-lg flex items-center gap-2 text-[12px] font-bold hover:bg-blue-700 transition-all shadow-md shadow-blue-500/20"
          >
            <Plus size={15} /> Nova Meta
          </button>
        }
      />

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Total Ativas",   value: active.length,    icon: Target,       color: "text-slate-700",   bg: "bg-slate-50"   },
          { label: "Atingidas",      value: achieved.length,  icon: Trophy,       color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "No Caminho",     value: onTrack.length,   icon: TrendingUp,   color: "text-blue-600",    bg: "bg-blue-50"    },
          { label: "Em Risco",       value: atRisk.length,    icon: AlertCircle,  color: "text-orange-600",  bg: "bg-orange-50"  },
        ].map((s) => (
          <div key={s.label} className={cn("rounded-xl p-4 border border-white/60 shadow-sm flex items-center gap-3", s.bg)}>
            <s.icon size={20} className={cn(s.color, "shrink-0")} />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 leading-none">{s.label}</p>
              <p className={cn("text-2xl font-black mt-0.5 leading-none", s.color)}>{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Period filter pills */}
      <div className="flex gap-2 flex-wrap">
        {([
          { value: "all",       label: "Todas"       },
          { value: "daily",     label: "Diária"      },
          { value: "weekly",    label: "Semanal"     },
          { value: "monthly",   label: "Mensal"      },
          { value: "quarterly", label: "Trimestral"  },
          { value: "biannual",  label: "Semestral"   },
          { value: "annual",    label: "Anual"       },
        ] as { value: PeriodFilter; label: string }[]).map((p) => (
          <button
            key={p.value}
            onClick={() => setPeriodFilter(p.value)}
            className={cn(
              "h-8 px-3 rounded-lg text-[11px] font-bold border transition-all",
              periodFilter === p.value
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Goals grid */}
      {loading ? (
        <div className="flex justify-center py-16 text-slate-400 text-sm">Carregando…</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-slate-400 gap-3">
          <Target size={40} strokeWidth={1} />
          <p className="text-sm font-medium">Nenhuma meta encontrada</p>
          <button
            onClick={openCreate}
            className="h-8 px-4 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700"
          >
            Criar primeira meta
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          <AnimatePresence mode="popLayout">
            {filtered.map((g) => (
              <GoalCard key={g.id} goal={g} onDelete={handleDelete} onEdit={openEdit} />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* ── Form Drawer ──────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showForm && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={closeForm}
              className="fixed inset-0 bg-slate-900/50 z-40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 26, stiffness: 200 }}
              className="fixed inset-y-0 right-0 w-full max-w-md bg-white z-50 shadow-2xl flex flex-col"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 shrink-0">
                <div>
                  <h2 className="font-black text-slate-900 text-[15px]">
                    {editGoal ? "Editar Meta" : "Nova Meta"}
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    {editGoal ? "Altere título, descrição ou valor alvo" : "Configure o tipo, período e valor alvo"}
                  </p>
                </div>
                <button onClick={closeForm} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500">
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-4">

                {/* Título */}
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                    Título da Meta *
                  </label>
                  <input
                    value={fTitle}
                    onChange={(e) => setFTitle(e.target.value)}
                    placeholder="Ex: Faturar R$ 50.000 em Junho"
                    className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Descrição */}
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                    Descrição (opcional)
                  </label>
                  <textarea
                    value={fDesc}
                    onChange={(e) => setFDesc(e.target.value)}
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
                      {GOAL_TYPES.map((t) => (
                        <button
                          key={t.value}
                          onClick={() => setFType(t.value)}
                          className={cn(
                            "flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left transition-all",
                            fType === t.value
                              ? `${t.bg} ${t.border} ${t.color} border-2`
                              : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                          )}
                        >
                          <t.icon size={14} className={fType === t.value ? t.color : "text-slate-400"} />
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
                        value={fPeriod}
                        onChange={(e) => setFPeriod(e.target.value)}
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
                        value={fStart}
                        onChange={(e) => { setFPeriod("custom"); setFStart(e.target.value); }}
                        className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                        Fim *
                      </label>
                      <input
                        type="date"
                        value={fEnd}
                        onChange={(e) => { setFPeriod("custom"); setFEnd(e.target.value); }}
                        className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                )}

                {/* Valor alvo */}
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                    Valor Alvo * {cfg.unit === "currency" ? "(R$)" : "(unidades)"}
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">
                      {cfg.unit === "currency" ? "R$" : "#"}
                    </span>
                    <input
                      type="number"
                      min={0}
                      step={cfg.unit === "currency" ? "0.01" : "1"}
                      value={fTarget}
                      onChange={(e) => setFTarget(e.target.value)}
                      placeholder={cfg.unit === "currency" ? "0,00" : "0"}
                      className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Preview */}
                {fTarget && Number(fTarget) > 0 && (
                  <div className={cn("rounded-xl p-4 border", cfg.bg, cfg.border)}>
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Resumo da Meta</p>
                    <p className={cn("font-black text-[15px]", cfg.color)}>
                      {fTitle || "Meta sem título"}
                    </p>
                    <p className="text-[12px] text-slate-600 mt-1">
                      Alvo: <strong>{fmtValue(Number(fTarget), cfg.unit)}</strong>
                      {fStart && fEnd && (
                        <> · {new Date(fStart + "T12:00:00").toLocaleDateString("pt-BR")} até {new Date(fEnd + "T12:00:00").toLocaleDateString("pt-BR")}</>
                      )}
                    </p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="border-t border-slate-200 px-5 py-4 shrink-0 bg-slate-50 flex gap-2">
                <button
                  onClick={closeForm}
                  className="flex-1 h-9 rounded-lg border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !fTitle.trim() || !fTarget || (!editGoal && (!fStart || !fEnd))}
                  className="flex-1 h-9 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {saving ? "Salvando…" : editGoal ? "Salvar Alterações" : "Criar Meta"}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
