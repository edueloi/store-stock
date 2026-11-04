import { useMemo, useState, type FormEvent } from "react";
import { Plus, Target, Trash2 } from "lucide-react";

import { Badge } from "../../../components/ui/Badge";
import { Button, IconButton } from "../../../components/ui/Button";
import { Input, Select } from "../../../components/ui/Input";
import { Modal, ModalFooter } from "../../../components/ui/Modal";
import {
  METRIC_LABEL, adminApi, brl, dateBR, errorMessage, useAdminData,
  type AffiliateGoal, type AffiliateRow, type GoalMetric, type Notify,
} from "./lib";
import { AsyncState } from "./ui";

const today = () => new Date().toISOString().slice(0, 10);
const endOfMonth = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
};

const targetLabel = (goal: AffiliateGoal) => (goal.metric === "commission" ? brl(goal.target) : String(goal.target));

/**
 * Metas do programa. Sem `affiliateId`: tela geral (metas globais ou de um afiliado escolhido).
 * Com `affiliateId`: só as metas daquele afiliado (usada dentro da ficha dele).
 */
export default function GoalsTab({ notify, affiliateId }: { notify: Notify; affiliateId?: number }) {
  const goalsQuery = useAdminData<{ goals: AffiliateGoal[] }>("/goals");
  const affiliatesQuery = useAdminData<{ affiliates: AffiliateRow[] }>("/affiliates", !affiliateId);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ affiliateId: "", title: "", metric: "sales" as GoalMetric, target: "", reward: "", periodStart: today(), periodEnd: endOfMonth() });

  const goals = useMemo(() => {
    const all = goalsQuery.data?.goals ?? [];
    return affiliateId ? all.filter((g) => g.affiliateId === affiliateId) : all;
  }, [goalsQuery.data, affiliateId]);

  const affiliateOptions = affiliateId ? [] : (affiliatesQuery.data?.affiliates ?? []);
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }));
  const valid = form.title.trim().length > 2 && Number(form.target) > 0 && form.periodStart !== "" && form.periodEnd >= form.periodStart;

  async function create(event: FormEvent) {
    event.preventDefault();
    if (!valid) return;
    setSaving(true);
    try {
      await adminApi("/goals", {
        method: "POST",
        body: {
          affiliateId: affiliateId ?? (form.affiliateId ? Number(form.affiliateId) : null),
          title: form.title.trim(), metric: form.metric, target: Number(form.target), reward: form.reward.trim() || undefined,
          periodStart: form.periodStart, periodEnd: form.periodEnd,
        },
      });
      notify("success", "Meta criada.");
      setOpen(false);
      setForm((f) => ({ ...f, title: "", target: "", reward: "" }));
      goalsQuery.reload();
    } catch (e) { notify("error", errorMessage(e, "Não foi possível criar a meta.")); }
    finally { setSaving(false); }
  }

  async function remove(goal: AffiliateGoal) {
    if (!window.confirm(`Excluir a meta "${goal.title}"?`)) return;
    try {
      await adminApi(`/goals/${goal.id}`, { method: "DELETE" });
      notify("success", "Meta excluída.");
      goalsQuery.reload();
    } catch (e) { notify("error", errorMessage(e, "Não foi possível excluir a meta.")); }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-500">
          {affiliateId
            ? "Metas só deste afiliado. Ele também vê as metas gerais e as que cria sozinho."
            : "Crie metas para todos os afiliados (gerais) ou para um afiliado específico. O progresso aparece no painel de cada um."}
        </p>
        <Button size="sm" iconLeft={<Plus size={14} />} onClick={() => setOpen(true)}>Nova meta</Button>
      </div>

      <AsyncState loading={goalsQuery.loading && !goalsQuery.data} error={goalsQuery.error} onRetry={goalsQuery.reload} empty={goals.length === 0}
        emptyTitle="Nenhuma meta ainda" emptyDescription="Metas dão ritmo ao afiliado: por exemplo, 5 vendas no mês com uma recompensa.">
        <div className="grid gap-3 md:grid-cols-2">
          {goals.map((goal) => (
            <article key={goal.id} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-blue-100 bg-blue-50 text-blue-600"><Target size={15} /></div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{goal.title}</p>
                    <p className="text-[11px] text-slate-500">{METRIC_LABEL[goal.metric]} · meta {targetLabel(goal)}</p>
                  </div>
                </div>
                <IconButton variant="outline" aria-label="Excluir meta" title="Excluir" onClick={() => void remove(goal)}><Trash2 size={14} /></IconButton>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                <Badge color={goal.affiliateId ? "info" : "purple"}>{goal.affiliateId ? (goal.affiliateName ?? `Afiliado #${goal.affiliateId}`) : "Meta geral"}</Badge>
                <span>{dateBR(goal.periodStart)} a {dateBR(goal.periodEnd)}</span>
                <Badge color="default">{goal.createdBy === "admin" ? "Criada pela equipe" : "Criada pelo afiliado"}</Badge>
              </div>
              {goal.reward && <p className="mt-2 text-xs text-slate-600">Recompensa: <b>{goal.reward}</b></p>}
            </article>
          ))}
        </div>
      </AsyncState>

      <Modal open={open} onClose={() => setOpen(false)} size="md" title="Nova meta" subtitle="Defina o alvo, o período e (se quiser) uma recompensa."
        footer={<ModalFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button type="submit" form="aff-goal-form" loading={saving} disabled={!valid}>Criar meta</Button></ModalFooter>}>
        <form id="aff-goal-form" onSubmit={create} className="space-y-3">
          {!affiliateId && (
            <Select label="Para quem" value={form.affiliateId} onChange={(e) => set("affiliateId", e.target.value)}
              options={[{ value: "", label: "Todos os afiliados (meta geral)" }, ...affiliateOptions.map((a) => ({ value: a.id, label: `${a.name} (${a.code})` }))]} />
          )}
          <Input label="Título" required value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Ex.: Fechar 5 vendas em novembro" />
          <div className="grid gap-3 sm:grid-cols-2">
            <Select label="O que medir" value={form.metric} onChange={(e) => set("metric", e.target.value as GoalMetric)}
              options={(Object.keys(METRIC_LABEL) as GoalMetric[]).map((m) => ({ value: m, label: METRIC_LABEL[m] }))} />
            <Input label={form.metric === "commission" ? "Alvo em R$" : "Alvo (quantidade)"} type="number" min="1" step={form.metric === "commission" ? "0.01" : "1"} required value={form.target} onChange={(e) => set("target", e.target.value)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Início" type="date" required value={form.periodStart} onChange={(e) => set("periodStart", e.target.value)} />
            <Input label="Fim" type="date" required value={form.periodEnd} min={form.periodStart} onChange={(e) => set("periodEnd", e.target.value)} />
          </div>
          <Input label="Recompensa (opcional)" value={form.reward} onChange={(e) => set("reward", e.target.value)} placeholder="Ex.: bônus de R$ 200" />
        </form>
      </Modal>
    </div>
  );
}
