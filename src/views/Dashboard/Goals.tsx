import { useState, useEffect, useCallback, useRef } from "react";
import {
  Target,
  Plus,
  Trash2,
  TrendingUp,
  CheckCircle2,
  Clock,
  XCircle,
  Edit2,
  Flame,
  Trophy,
  AlertCircle,
  HelpCircle,
  Layers,
  CalendarDays,
  CalendarRange,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../../lib/utils";
import React from "react";
import { Button, Input, Textarea, Select, Modal, ModalFooter, EmptyState, ContentCard, SectionTitle, StatGrid, StatCard, Tabs, IconButton, Badge } from "../../components/ui";
import GoalsPageTour, { type GoalsPageTourHandle } from "../../components/onboarding/GoalsPageTour";
import {
  GOAL_TYPES,
  PERIODS,
  fmtValue,
  getTypeConfig,
  getPeriodLabel,
  progressColor,
  daysLeft,
  defaultDates,
} from "../../lib/goals";

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

const authHeader = () => ({
  Authorization: `Bearer ${localStorage.getItem("token")}`,
  "Content-Type": "application/json",
});

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
        "bg-white rounded-lg border hover:border-blue-200 transition-all flex flex-col gap-0 overflow-hidden",
        isDone ? "border-emerald-300 ring-1 ring-emerald-200" : "border-slate-200"
      )}
    >
      {/* Header */}
      <div className={cn("flex items-start justify-between px-4 pt-4 pb-3")}>
        <div className="flex items-start gap-3 min-w-0">
          <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", cfg.bg, cfg.border, "border")}>
            <Icon size={16} className={cfg.color} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-slate-400 leading-none mb-0.5">
              {getPeriodLabel(goal.period)} · {cfg.label}
            </p>
            <h3 className="font-semibold text-slate-800 text-[14px] leading-tight truncate">{goal.title}</h3>
            {goal.description && (
              <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">{goal.description}</p>
            )}
          </div>
        </div>
        <div className="ml-2 flex shrink-0 items-center gap-1">
          {isDone && <Trophy size={14} className="text-amber-400" />}
          <IconButton size="xs" aria-label="Editar meta" onClick={() => onEdit(goal)}>
            <Edit2 size={13} />
          </IconButton>
          <IconButton size="xs" variant="danger" aria-label="Excluir meta" onClick={() => onDelete(goal.id)}>
            <Trash2 size={13} />
          </IconButton>
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
          <span className={cn("text-[11px] font-semibold", progressColor(pct).replace("bg-", "text-"))}>
            {pct.toFixed(1)}%
          </span>
          <span className="text-[11px] text-slate-400 font-semibold">
            {fmtValue(Number(goal.current_value), cfg.unit)} / {fmtValue(Number(goal.target_value), cfg.unit)}
          </span>
        </div>
      </div>

      {/* Footer info */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 mt-auto">
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
        <span className="text-[11px] text-slate-400">
          Falta: {fmtValue(Math.max(0, Number(goal.target_value) - Number(goal.current_value)), cfg.unit)}
        </span>
      </div>
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

type PeriodFilter = "all" | "daily" | "weekly" | "monthly" | "quarterly" | "biannual" | "annual";

const PERIOD_TABS = [
  { id: "all", label: "Todas", icon: Layers },
  { id: "daily", label: "Diária", icon: CalendarDays },
  { id: "weekly", label: "Semanal", icon: CalendarDays },
  { id: "monthly", label: "Mensal", icon: CalendarRange },
  { id: "quarterly", label: "Trimestral", icon: CalendarRange },
  { id: "biannual", label: "Semestral", icon: CalendarRange },
  { id: "annual", label: "Anual", icon: CalendarRange },
] as const satisfies readonly { id: PeriodFilter; label: string; icon: React.ElementType }[];

export default function Goals() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("all");
  const [showForm, setShowForm] = useState(false);
  const [editGoal, setEditGoal] = useState<Goal | null>(null);
  const [saving, setSaving] = useState(false);
  const tourRef = useRef<GoalsPageTourHandle>(null);

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

  // ── Canal de comunicação do TOUR DE PÁGINA (GoalsPageTour) ────────────────
  // Abre o drawer "Nova Meta" de verdade via openCreate e preenche campos de
  // exemplo — nunca chama handleSave (POST/PUT real em /api/goals) nem
  // handleDelete (DELETE real, atrás de um window.confirm). Fechar sempre
  // via closeForm.
  useEffect(() => {
    const onOpenNewGoal = () => openCreate();
    const onFillGoal = (e: Event) => {
      const detail = (e as CustomEvent<{ title?: string; target?: string }>).detail;
      if (!detail) return;
      if (detail.title !== undefined) setFTitle(detail.title);
      if (detail.target !== undefined) setFTarget(detail.target);
    };
    const onCloseForm = () => closeForm();

    window.addEventListener("page-tour:goals:open-new-goal", onOpenNewGoal);
    window.addEventListener("page-tour:goals:fill-goal", onFillGoal);
    window.addEventListener("page-tour:goals:close-form", onCloseForm);
    return () => {
      window.removeEventListener("page-tour:goals:open-new-goal", onOpenNewGoal);
      window.removeEventListener("page-tour:goals:fill-goal", onFillGoal);
      window.removeEventListener("page-tour:goals:close-form", onCloseForm);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    <div data-tour="goals-page" className="space-y-4">
      <SectionTitle
        title="Metas"
        icon={Target}
        description="Acompanhe faturamento, vendas, despesas e muito mais"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button data-tour="goals-new-btn" size="sm" iconLeft={<Plus size={14} />} onClick={openCreate}>
              Nova Meta
            </Button>
            <Button
              variant="outline"
              size="sm"
              iconLeft={<HelpCircle size={14} />}
              onClick={() => tourRef.current?.start()}
              title="Tour guiado desta página"
            >
              <span className="sr-only sm:not-sr-only">Ajuda</span>
            </Button>
          </div>
        }
      />

      <GoalsPageTour ref={tourRef} />

      {/* Summary cards */}
      <div data-tour="goals-summary-cards">
        <StatGrid cols={4}>
          <StatCard title="Total Ativas" value={active.length} icon={Target} color="info" />
          <StatCard title="Atingidas" value={achieved.length} icon={Trophy} color="success" />
          <StatCard title="No Caminho" value={onTrack.length} icon={TrendingUp} color="info" />
          <StatCard title="Em Risco" value={atRisk.length} icon={AlertCircle} color="warning" />
        </StatGrid>
      </div>

      {/* Filtro de período (abas) */}
      <div data-tour="goals-period-filter">
        <Tabs<PeriodFilter> items={PERIOD_TABS} value={periodFilter} onChange={setPeriodFilter} label="Período das metas">
          {null}
        </Tabs>
      </div>

      {/* Goals grid */}
      {loading ? (
        <div role="status" className="flex justify-center py-12 text-sm text-slate-500">Carregando…</div>
      ) : filtered.length === 0 ? (
        <ContentCard>
          <EmptyState
            icon={Target}
            title="Nenhuma meta encontrada"
            action={<Button size="sm" onClick={openCreate}>Criar primeira meta</Button>}
          />
        </ContentCard>
      ) : (
        <div data-tour="goals-grid" className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {filtered.map((g) => (
              <GoalCard key={g.id} goal={g} onDelete={handleDelete} onEdit={openEdit} />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* ── Form (modal lateral) ─────────────────────────────────────────────── */}
      <Modal
        open={showForm}
        onClose={closeForm}
        position="right"
        size="md"
        title={editGoal ? "Editar Meta" : "Nova Meta"}
        subtitle={editGoal ? "Altere título, descrição ou valor alvo" : "Configure o tipo, período e valor alvo"}
        footer={
          <ModalFooter>
            <Button variant="outline" onClick={closeForm}>Cancelar</Button>
            <Button
              onClick={handleSave}
              disabled={saving || !fTitle.trim() || !fTarget || (!editGoal && (!fStart || !fEnd))}
            >
              {saving ? "Salvando…" : editGoal ? "Salvar Alterações" : "Criar Meta"}
            </Button>
          </ModalFooter>
        }
      >
        <div className="space-y-4">
          {/* Título */}
          <div data-tour="goals-form-title">
            <Input
              label="Título da Meta *"
              value={fTitle}
              onChange={(e) => setFTitle(e.target.value)}
              placeholder="Ex: Faturar R$ 50.000 em Junho"
            />
          </div>

          {/* Descrição */}
          <Textarea
            label="Descrição (opcional)"
            value={fDesc}
            onChange={(e) => setFDesc(e.target.value)}
            rows={2}
            placeholder="Detalhes ou estratégias para atingir a meta…"
          />

          {/* Tipo */}
          {!editGoal && (
            <div>
              <span className="ds-label mb-1.5 block">Tipo de Meta *</span>
              <div className="grid grid-cols-2 gap-2">
                {GOAL_TYPES.map((t) => (
                  <button
                    type="button"
                    key={t.value}
                    onClick={() => setFType(t.value)}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-all",
                      fType === t.value
                        ? `${t.bg} ${t.border} ${t.color}`
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    <t.icon size={14} className={fType === t.value ? t.color : "text-slate-400"} />
                    <span className="text-[11px] font-medium leading-tight">{t.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Período */}
          {!editGoal && (
            <Select label="Período *" value={fPeriod} onChange={(e) => setFPeriod(e.target.value)}>
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
                value={fStart}
                onChange={(e) => { setFPeriod("custom"); setFStart(e.target.value); }}
              />
              <Input
                label="Fim *"
                type="date"
                value={fEnd}
                onChange={(e) => { setFPeriod("custom"); setFEnd(e.target.value); }}
              />
            </div>
          )}

          {/* Valor alvo */}
          <div data-tour="goals-form-target">
            <Input
              label={`Valor Alvo * ${cfg.unit === "currency" ? "(R$)" : "(unidades)"}`}
              type="number"
              min={0}
              step={cfg.unit === "currency" ? "0.01" : "1"}
              value={fTarget}
              onChange={(e) => setFTarget(e.target.value)}
              placeholder={cfg.unit === "currency" ? "0,00" : "0"}
              addonLeft={cfg.unit === "currency" ? "R$" : "#"}
            />
          </div>

          {/* Preview */}
          {fTarget && Number(fTarget) > 0 && (
            <div className={cn("rounded-lg border p-3", cfg.bg, cfg.border)}>
              <p className="mb-1 text-[11px] font-medium text-slate-500">Resumo da Meta</p>
              <p className={cn("text-sm font-semibold", cfg.color)}>
                {fTitle || "Meta sem título"}
              </p>
              <p className="mt-1 text-xs text-slate-600">
                Alvo: <strong>{fmtValue(Number(fTarget), cfg.unit)}</strong>
                {fStart && fEnd && (
                  <> · {new Date(fStart + "T12:00:00").toLocaleDateString("pt-BR")} até {new Date(fEnd + "T12:00:00").toLocaleDateString("pt-BR")}</>
                )}
              </p>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
