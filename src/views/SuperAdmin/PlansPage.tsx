import { type FormEvent, useMemo, useState } from "react";
import { motion } from "motion/react";
import {
  Archive, BadgeCheck, Boxes, Check, ChevronRight, CreditCard,
  Crown, Edit3, PackagePlus, Plus, Sparkles, Users, Layers,
} from "lucide-react";

import { getStoredToken } from "../../lib/session";
import type { ManagedTenant, SubscriptionPlan } from "../../types";
import { Button, IconButton } from "../../components/ui/Button";
import { Input, Select } from "../../components/ui/Input";
import { Modal, ModalFooter } from "../../components/ui/Modal";
import { Tabs } from "../../components/ui/Tabs";
import { Switch } from "../../components/ui/Switch";
import { SectionTitle, StatGrid } from "../../components/ui/PageWrapper";
import { StatCard } from "../../components/ui/StatCard";
import { FilterLineSearch } from "../../components/ui/FilterLine";

const PLAN_TABS = [
  { id: "commercial", label: "Informações comerciais", icon: CreditCard },
  { id: "features", label: "Recursos incluídos", icon: Layers },
] as const;
type PlanTab = typeof PLAN_TABS[number]["id"];

const FEATURE_GROUPS = [
  { title: "Vendas", items: [["pdv", "PDV e caixa"], ["orders", "Pedidos"], ["orcamentos", "Orçamentos"], ["consignacoes", "Consignações"]] },
  { title: "Produtos", items: [["catalog", "Catálogo digital"], ["stock", "Estoque"], ["categories", "Categorias"], ["suppliers", "Fornecedores"], ["etiquetas", "Etiquetas"]] },
  { title: "Financeiro", items: [["finance", "Fluxo de caixa"], ["contas_receber", "Contas a receber"], ["contas_pagar", "Contas a pagar"], ["relatorio_financeiro", "Relatórios financeiros"]] },
  { title: "Serviços e gestão", items: [["ordens_servico", "Ordens de serviço"], ["fluxo_producao", "Fluxo de produção"], ["grafica", "Recursos para gráfica"], ["analytics", "Analytics"], ["loyalty", "Fidelidade"], ["whatsapp", "WhatsApp"]] },
] as const;

type PlanDraft = {
  name: string; description: string; price: string; billingCycle: "monthly" | "yearly";
  trialDays: string; features: string[]; users: string; products: string; storageGb: string;
  color: string; isFeatured: boolean; isActive: boolean; sortOrder: string;
};

const EMPTY_PLAN: PlanDraft = {
  name: "", description: "", price: "0", billingCycle: "monthly", trialDays: "14",
  features: ["pdv", "orders", "catalog", "stock"], users: "3", products: "1000",
  storageGb: "5", color: "#2563eb", isFeatured: false, isActive: true, sortOrder: "0",
};

function featureLabel(feature: string) {
  for (const group of FEATURE_GROUPS) {
    const match = group.items.find(([key]) => key === feature);
    if (match) return match[1];
  }
  return feature;
}

function headers() {
  return { "Content-Type": "application/json", Authorization: `Bearer ${getStoredToken()}` };
}

export default function PlansPage({ plans, tenants, onPlansChange, onTenantChange, notify }: {
  plans: SubscriptionPlan[];
  tenants: ManagedTenant[];
  onPlansChange: (plans: SubscriptionPlan[]) => void;
  onTenantChange: (tenant: ManagedTenant) => void;
  notify: (type: "success" | "error", message: string) => void;
}) {
  const [editing, setEditing] = useState<SubscriptionPlan | "new" | null>(null);
  const [draft, setDraft] = useState<PlanDraft>(EMPTY_PLAN);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [assigningId, setAssigningId] = useState<number | null>(null);
  const [planTab, setPlanTab] = useState<PlanTab>("commercial");

  const activePlans = plans.filter((plan) => plan.is_active);
  const assignedCount = tenants.filter((tenant) => tenant.plan_id).length;
  const planRevenue = tenants.reduce((sum, tenant) => sum + Number(tenant.subscription_amount || 0), 0);
  const filteredTenants = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("pt-BR");
    return tenants.filter((tenant) => !q || [tenant.name, tenant.subdomain, tenant.users?.[0]?.email, tenant.plan?.name]
      .some((value) => String(value || "").toLocaleLowerCase("pt-BR").includes(q)));
  }, [search, tenants]);

  function openPlan(plan?: SubscriptionPlan) {
    setPlanTab("commercial");
    if (!plan) {
      setDraft(EMPTY_PLAN);
      setEditing("new");
      return;
    }
    setDraft({
      name: plan.name, description: plan.description || "", price: String(plan.price),
      billingCycle: plan.billing_cycle, trialDays: String(plan.trial_days), features: [...plan.features],
      users: String(plan.limits?.users || 0), products: String(plan.limits?.products || 0),
      storageGb: String(plan.limits?.storageGb || 0), color: plan.color, isFeatured: plan.is_featured,
      isActive: plan.is_active, sortOrder: String(plan.sort_order),
    });
    setEditing(plan);
  }

  function toggleFeature(feature: string) {
    setDraft((current) => ({ ...current, features: current.features.includes(feature)
      ? current.features.filter((item) => item !== feature) : [...current.features, feature] }));
  }

  async function savePlan(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    const isNew = editing === "new";
    try {
      const response = await fetch(isNew ? "/api/super-admin/plans" : `/api/super-admin/plans/${(editing as SubscriptionPlan).id}`, {
        method: isNew ? "POST" : "PATCH", headers: headers(),
        body: JSON.stringify({
          name: draft.name, description: draft.description, price: Number(draft.price), billingCycle: draft.billingCycle,
          trialDays: Number(draft.trialDays), features: draft.features,
          limits: { users: Number(draft.users), products: Number(draft.products), storageGb: Number(draft.storageGb) },
          color: draft.color, isFeatured: draft.isFeatured, isActive: draft.isActive, sortOrder: Number(draft.sortOrder),
        }),
      });
      const data = await response.json() as SubscriptionPlan & { error?: string };
      if (!response.ok) { notify("error", data.error || "Não foi possível salvar o plano."); return; }
      onPlansChange(isNew ? [...plans, data] : plans.map((plan) => plan.id === data.id ? data : plan));
      setEditing(null);
      notify("success", isNew ? "Plano criado com sucesso." : "Plano atualizado com sucesso.");
    } catch { notify("error", "Erro ao salvar o plano."); }
    finally { setSaving(false); }
  }

  async function archivePlan(plan: SubscriptionPlan) {
    if (!window.confirm(`Arquivar o plano ${plan.name}? Os clientes atuais continuarão vinculados.`)) return;
    try {
      const response = await fetch(`/api/super-admin/plans/${plan.id}`, { method: "DELETE", headers: headers() });
      if (!response.ok) throw new Error();
      onPlansChange(plans.map((item) => item.id === plan.id ? { ...item, is_active: false } : item));
      notify("success", "Plano arquivado.");
    } catch { notify("error", "Não foi possível arquivar o plano."); }
  }

  async function assignPlan(tenant: ManagedTenant, planId: string) {
    setAssigningId(tenant.id);
    try {
      const response = await fetch(`/api/super-admin/tenants/${tenant.id}`, {
        method: "PATCH", headers: headers(), body: JSON.stringify({ planId: planId ? Number(planId) : null }),
      });
      const data = await response.json() as ManagedTenant & { error?: string };
      if (!response.ok) { notify("error", data.error || "Não foi possível alterar a assinatura."); return; }
      onTenantChange(data);
      notify("success", `Assinatura de ${tenant.name} atualizada.`);
    } catch { notify("error", "Erro ao alterar a assinatura."); }
    finally { setAssigningId(null); }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <SectionTitle
        icon={Sparkles}
        title="Planos e assinaturas"
        description="Defina o que cada plano oferece e gerencie a assinatura de todas as lojas em um só lugar."
        action={<Button iconLeft={<Plus size={14} />} onClick={() => openPlan()}>Criar plano</Button>}
      />

      <StatGrid cols={3}>
        <StatCard title="Planos ativos" value={activePlans.length} icon={Boxes} color="info" />
        <StatCard title="Clientes com plano" value={assignedCount} icon={Users} color="success" />
        <StatCard title="Receita contratada" value={planRevenue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} icon={CreditCard} color="purple" />
      </StatGrid>

      <section>
        <div className="mb-4 flex items-center justify-between"><div><h3 className="text-lg font-semibold text-slate-950">Catálogo de planos</h3><p className="text-sm text-slate-500">{plans.length} planos cadastrados</p></div></div>
        {plans.length === 0 ? (
          <button onClick={() => openPlan()} className="flex min-h-56 w-full flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-200 bg-white text-center hover:border-blue-300 hover:bg-blue-50/30"><PackagePlus size={34} className="text-blue-500" /><p className="mt-4 font-semibold text-slate-800">Crie seu primeiro plano</p><p className="mt-1 text-sm text-slate-500">Configure preço, recursos e limites.</p></button>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
            {plans.map((plan) => (
              <article key={plan.id} className={`relative flex flex-col overflow-hidden rounded-lg border bg-white transition  ${plan.is_active ? "border-slate-200" : "border-slate-200 opacity-60"}`}>
                <div className="h-1.5" style={{ backgroundColor: plan.color }} />
                <div className="flex flex-1 flex-col p-6">
                  <div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2"><h4 className="text-xl font-semibold text-slate-950">{plan.name}</h4>{plan.is_featured && <Crown size={15} className="text-amber-500" />}</div><p className="mt-1 line-clamp-2 text-sm text-slate-500">{plan.description || "Sem descrição"}</p></div><span className={`rounded-full px-2 py-1 text-[10px] font-semibold  ${plan.is_active ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"}`}>{plan.is_active ? "Ativo" : "Arquivado"}</span></div>
                  <div className="mt-5 flex items-end gap-1"><span className="text-sm font-semibold text-slate-400">R$</span><span className="text-3xl font-semibold text-slate-950">{Number(plan.price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span><span className="pb-1 text-xs text-slate-400">/{plan.billing_cycle === "yearly" ? "ano" : "mês"}</span></div>
                  <div className="mt-5 space-y-2">{plan.features.slice(0, 5).map((feature) => <div key={feature} className="flex items-center gap-2 text-xs font-medium text-slate-600"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"><Check size={11} /></span>{featureLabel(feature)}</div>)}{plan.features.length > 5 && <p className="pl-7 text-[11px] font-semibold text-blue-600">+ {plan.features.length - 5} recursos</p>}</div>
                  <div className="mt-5 grid grid-cols-3 gap-2 text-center">{[[plan.limits?.users, "usuários"], [plan.limits?.products, "produtos"], [plan.limits?.storageGb, "GB"]].map(([value, label]) => <div key={label} className="rounded-lg bg-slate-50 px-2 py-2"><p className="text-sm font-semibold text-slate-800">{value || "∞"}</p><p className="text-[10px] text-slate-400">{label}</p></div>)}</div>
                  <div className="mt-6 flex gap-2 border-t border-slate-100 pt-4"><Button className="flex-1" iconLeft={<Edit3 size={13} />} onClick={() => openPlan(plan)}>Editar</Button>{plan.is_active && <IconButton variant="outline" aria-label="Arquivar plano" title="Arquivar" onClick={() => void archivePlan(plan)}><Archive size={14} /></IconButton>}</div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="font-semibold text-slate-950">Assinaturas dos clientes</h3><p className="text-xs text-slate-500">Vincule ou altere o plano de cada loja.</p></div><div className="w-full sm:w-72"><FilterLineSearch value={search} onChange={setSearch} placeholder="Buscar cliente ou plano" aria-label="Buscar cliente ou plano" /></div></div>
        <div className="divide-y divide-slate-100">{filteredTenants.map((tenant) => (
          <div key={tenant.id} className="flex flex-col gap-3 p-4 hover:bg-slate-50/70 sm:flex-row sm:items-center sm:px-5"><div className="flex min-w-0 flex-1 items-center gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 font-semibold text-blue-600">{tenant.name.charAt(0)}</div><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-900">{tenant.name}</p><p className="truncate text-xs text-slate-400">{tenant.users?.[0]?.email || tenant.subdomain}</p></div></div><div className="flex items-center gap-3"><div className="hidden text-right md:block"><p className="text-xs font-semibold text-slate-700">R$ {Number(tenant.subscription_amount || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p><p className="text-[11px] text-slate-400">mensalidade</p></div><Select wrapperClassName="min-w-44 flex-1 sm:flex-none" size="sm" aria-label={`Plano de ${tenant.name}`} value={tenant.plan_id || ""} disabled={assigningId === tenant.id} onChange={(e) => void assignPlan(tenant, e.target.value)}><option value="">Sem plano</option>{activePlans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name} — R$ {Number(plan.price).toLocaleString("pt-BR")}</option>)}</Select><ChevronRight size={15} className="hidden text-slate-300 sm:block" /></div></div>
        ))}{filteredTenants.length === 0 && <div className="p-10 text-center text-sm text-slate-500">Nenhum cliente encontrado.</div>}</div>
      </section>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        size="xl"
        title={editing === "new" ? "Criar novo plano" : editing ? `Editar ${editing.name}` : ""}
        subtitle="Configure cobrança, limites e tudo que estará disponível."
        footer={
          <ModalFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button type="submit" form="plan-form" loading={saving} iconLeft={<BadgeCheck size={14} />}>Salvar plano</Button>
          </ModalFooter>
        }
      >
        <form id="plan-form" onSubmit={savePlan}>
          <Tabs<PlanTab> items={PLAN_TABS} value={planTab} onChange={setPlanTab} label="Seções do plano">
            {planTab === "commercial" ? (
              <div className="space-y-4">
                <Input label="Nome do plano" required value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} placeholder="Ex: Profissional" />
                <Input label="Descrição" value={draft.description} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} placeholder="Para lojas em crescimento" />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Input label="Preço" type="number" min="0" step="0.01" value={draft.price} onChange={(e) => setDraft((d) => ({ ...d, price: e.target.value }))} />
                  <Select label="Cobrança" value={draft.billingCycle} onChange={(e) => setDraft((d) => ({ ...d, billingCycle: e.target.value as PlanDraft["billingCycle"] }))}>
                    <option value="monthly">Mensal</option><option value="yearly">Anual</option>
                  </Select>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {([["Usuários", "users"], ["Produtos", "products"], ["Armaz. GB", "storageGb"]] as const).map(([label, key]) => (
                    <Input key={key} label={label} type="number" min="0" value={draft[key]} onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))} />
                  ))}
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Input label="Dias de trial" type="number" min="0" value={draft.trialDays} onChange={(e) => setDraft((d) => ({ ...d, trialDays: e.target.value }))} />
                  <div className="flex flex-col gap-1">
                    <label htmlFor="plan-color" className="ds-label">Cor do plano</label>
                    <input id="plan-color" type="color" value={draft.color} onChange={(e) => setDraft((d) => ({ ...d, color: e.target.value }))} className="h-[34px] w-full cursor-pointer rounded-lg border border-slate-200 bg-white p-1" />
                  </div>
                </div>
                <div className="space-y-2">
                  {([["isFeatured", "Destacar como recomendado"], ["isActive", "Plano ativo para contratação"]] as const).map(([key, label]) => (
                    <div key={key} className="flex items-center justify-between rounded-lg border border-slate-200 p-3 text-xs font-medium text-slate-700">
                      <span>{label}</span>
                      <Switch checked={draft[key]} aria-label={label} onChange={(checked) => setDraft((d) => ({ ...d, [key]: checked }))} />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {FEATURE_GROUPS.map((group) => (
                  <div key={group.title} className="rounded-lg border border-slate-200 p-3">
                    <p className="mb-2 text-xs font-medium text-slate-800">{group.title}</p>
                    <div className="space-y-1">
                      {group.items.map(([key, label]) => {
                        const selected = draft.features.includes(key);
                        return (
                          <button type="button" key={key} onClick={() => toggleFeature(key)} className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-medium transition ${selected ? "bg-blue-50 text-blue-700" : "text-slate-500 hover:bg-slate-50"}`}>
                            <span className={`flex h-5 w-5 items-center justify-center rounded-md border ${selected ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300 bg-white"}`}>{selected && <Check size={12} />}</span>{label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Tabs>
        </form>
      </Modal>
    </motion.div>
  );
}
