import { useState, type FormEvent } from "react";
import { BadgeCheck, Edit3, Plus, Star, Trash2 } from "lucide-react";

import { Badge } from "../../../components/ui/Badge";
import { Button, IconButton } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { ConfirmModal, Modal, ModalFooter } from "../../../components/ui/Modal";
import { Switch } from "../../../components/ui/Switch";
import RulesEditor from "./RulesEditor";
import {
  adminApi, describeRules, draftToRules, errorMessage, rulesToDraft, useAdminData, validateDraft, windowOf,
  type AffiliatePlan, type Notify, type RuleDraft,
} from "./lib";
import { AsyncState } from "./ui";

interface Draft { name: string; description: string; rules: RuleDraft[]; isDefault: boolean; isActive: boolean }
const EMPTY: Draft = { name: "", description: "", rules: rulesToDraft(null), isDefault: false, isActive: true };

export default function PlansTab({ notify, onChanged }: { notify: Notify; onChanged: () => void }) {
  const { data, loading, error, reload } = useAdminData<{ plans: AffiliatePlan[] }>("/plans");
  const [editing, setEditing] = useState<AffiliatePlan | "new" | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState<AffiliatePlan | null>(null);

  const plans = data?.plans ?? [];
  const validation = validateDraft(draft.rules);
  const canSave = draft.name.trim().length > 1 && validation.general === null && Object.keys(validation.rows).length === 0;

  function open(plan?: AffiliatePlan) {
    setDraft(plan ? { name: plan.name, description: plan.description ?? "", rules: rulesToDraft(plan.rules), isDefault: plan.isDefault, isActive: plan.isActive } : EMPTY);
    setEditing(plan ?? "new");
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!canSave) return;
    setSaving(true);
    try {
      const isNew = editing === "new";
      await adminApi(isNew ? "/plans" : `/plans/${(editing as AffiliatePlan).id}`, {
        method: isNew ? "POST" : "PATCH",
        body: { name: draft.name.trim(), description: draft.description.trim() || null, rules: draftToRules(draft.rules), isDefault: draft.isDefault, isActive: draft.isActive },
      });
      notify("success", isNew ? "Plano criado." : "Plano atualizado.");
      setEditing(null);
      reload();
      onChanged();
    } catch (e) { notify("error", errorMessage(e, "Não foi possível salvar o plano.")); }
    finally { setSaving(false); }
  }

  async function remove(plan: AffiliatePlan) {
    setSaving(true);
    try {
      await adminApi(`/plans/${plan.id}`, { method: "DELETE" });
      notify("success", "Plano removido (ou desativado, se já estiver em uso).");
      setRemoving(null);
      reload();
      onChanged();
    } catch (e) { notify("error", errorMessage(e, "Não foi possível remover o plano.")); }
    finally { setSaving(false); }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-500">
          Cada plano define quanto o afiliado ganha em cada mês da assinatura do cliente. O plano <b>padrão</b> vale para quem não tiver outro.
          A indicação guarda uma cópia das regras no dia da venda: mudar o plano depois não altera vendas já feitas.
        </p>
        <Button size="sm" iconLeft={<Plus size={14} />} onClick={() => open()}>Novo plano</Button>
      </div>

      <AsyncState loading={loading} error={error} onRetry={reload} empty={plans.length === 0}
        emptyTitle="Nenhum plano de comissão ainda"
        emptyDescription="Crie o primeiro plano e marque como padrão. Sem plano padrão, afiliados aprovados não conseguem ganhar comissão.">
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {plans.map((plan) => {
            const months = windowOf(plan.rules);
            return (
              <article key={plan.id} className={`flex flex-col rounded-lg border bg-white p-5 ${plan.isActive ? "border-slate-200" : "border-slate-200 opacity-60"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h4 className="truncate text-base font-semibold text-slate-950">{plan.name}</h4>
                    <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{plan.description || "Sem descrição"}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {plan.isDefault && <Badge color="primary" icon={<Star size={11} />}>Padrão</Badge>}
                    {!plan.isActive && <Badge color="default">Inativo</Badge>}
                  </div>
                </div>
                <ul className="mt-4 space-y-1.5 text-xs">
                  {plan.rules.map((rule, i) => (
                    <li key={i} className="flex items-center gap-2 rounded-md bg-slate-50 px-2.5 py-1.5 font-medium text-slate-700">{describeRules([rule])}</li>
                  ))}
                </ul>
                <p className="mt-3 text-[11px] text-slate-500">{months === null ? "Sem limite: recebe enquanto o cliente pagar." : `Comissão por ${months} ${months === 1 ? "mês" : "meses"}.`}</p>
                <div className="mt-4 flex gap-2 border-t border-slate-100 pt-3">
                  <Button className="flex-1" size="sm" variant="outline" iconLeft={<Edit3 size={13} />} onClick={() => open(plan)}>Editar</Button>
                  <IconButton variant="outline" aria-label="Remover plano" title="Remover" onClick={() => setRemoving(plan)}><Trash2 size={14} /></IconButton>
                </div>
              </article>
            );
          })}
        </div>
      </AsyncState>

      <Modal open={!!editing} onClose={() => setEditing(null)} size="xl"
        title={editing === "new" ? "Novo plano de comissão" : "Editar plano de comissão"}
        subtitle="Defina as faixas por mês. Ex.: 1ª mensalidade 40%, meses 2 a 6 20%, depois R$ 10 fixo."
        footer={
          <ModalFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button type="submit" form="aff-plan-form" loading={saving} disabled={!canSave} iconLeft={<BadgeCheck size={14} />}>Salvar plano</Button>
          </ModalFooter>
        }>
        <form id="aff-plan-form" onSubmit={save} className="space-y-4">
          <Input label="Nome do plano" required value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} placeholder="Ex.: Parceiro padrão" />
          <Input label="Descrição (interna)" value={draft.description} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} placeholder="Quando usar este plano" />
          <RulesEditor value={draft.rules} onChange={(rules) => setDraft((d) => ({ ...d, rules }))} />
          <div className="space-y-2">
            <div className="flex items-center justify-between rounded-lg border border-slate-200 p-3 text-xs font-medium text-slate-700">
              <span>Plano padrão (vale para afiliados sem plano próprio)</span>
              <Switch checked={draft.isDefault} aria-label="Plano padrão" onCheckedChange={(v) => setDraft((d) => ({ ...d, isDefault: v }))} />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-slate-200 p-3 text-xs font-medium text-slate-700">
              <span>Plano ativo</span>
              <Switch checked={draft.isActive} aria-label="Plano ativo" onCheckedChange={(v) => setDraft((d) => ({ ...d, isActive: v }))} />
            </div>
          </div>
        </form>
      </Modal>

      <ConfirmModal isOpen={!!removing} onClose={() => setRemoving(null)} onConfirm={() => removing && void remove(removing)} loading={saving}
        title="Remover plano" confirmLabel="Remover"
        message={`Remover "${removing?.name ?? ""}"? Se já houver afiliados usando, ele só será desativado. Indicações antigas mantêm as regras do dia da venda.`} />
    </div>
  );
}
