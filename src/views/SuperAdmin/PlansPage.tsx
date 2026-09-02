import { type FormEvent, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Archive, BadgeCheck, Boxes, Check, ChevronRight, CreditCard,
  Crown, Edit3, PackagePlus, Plus, Search, Sparkles, Users, X,
} from "lucide-react";

import { getStoredToken } from "../../lib/session";
import type { ManagedTenant, SubscriptionPlan } from "../../types";

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

  const activePlans = plans.filter((plan) => plan.is_active);
  const assignedCount = tenants.filter((tenant) => tenant.plan_id).length;
  const planRevenue = tenants.reduce((sum, tenant) => sum + Number(tenant.subscription_amount || 0), 0);
  const filteredTenants = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("pt-BR");
    return tenants.filter((tenant) => !q || [tenant.name, tenant.subdomain, tenant.users?.[0]?.email, tenant.plan?.name]
      .some((value) => String(value || "").toLocaleLowerCase("pt-BR").includes(q)));
  }, [search, tenants]);

  function openPlan(plan?: SubscriptionPlan) {
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
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-6 text-white shadow-xl sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-blue-400/20 bg-blue-400/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-blue-300"><Sparkles size={12} /> Monetização</div>
            <h2 className="text-2xl font-black tracking-[-0.03em] sm:text-3xl">Planos e assinaturas</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">Defina o que cada plano oferece e gerencie a assinatura de todas as lojas em um só lugar.</p>
          </div>
          <button onClick={() => openPlan()} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white shadow-lg shadow-blue-950/40 hover:bg-blue-500"><Plus size={16} /> Criar plano</button>
        </div>
        <div className="mt-7 grid gap-3 sm:grid-cols-3">
          {[{ label: "Planos ativos", value: activePlans.length, icon: <Boxes size={17} /> }, { label: "Clientes com plano", value: assignedCount, icon: <Users size={17} /> }, { label: "Receita contratada", value: planRevenue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), icon: <CreditCard size={17} /> }].map((item) => (
            <div key={item.label} className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur"><div className="flex items-center justify-between text-slate-400"><span className="text-xs font-semibold">{item.label}</span>{item.icon}</div><p className="mt-2 text-xl font-black">{item.value}</p></div>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between"><div><h3 className="text-lg font-black text-slate-950">Catálogo de planos</h3><p className="text-sm text-slate-500">{plans.length} planos cadastrados</p></div></div>
        {plans.length === 0 ? (
          <button onClick={() => openPlan()} className="flex min-h-56 w-full flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-200 bg-white text-center hover:border-blue-300 hover:bg-blue-50/30"><PackagePlus size={34} className="text-blue-500" /><p className="mt-4 font-bold text-slate-800">Crie seu primeiro plano</p><p className="mt-1 text-sm text-slate-500">Configure preço, recursos e limites.</p></button>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
            {plans.map((plan) => (
              <article key={plan.id} className={`relative flex flex-col overflow-hidden rounded-3xl border bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg ${plan.is_active ? "border-slate-200" : "border-slate-200 opacity-60"}`}>
                <div className="h-1.5" style={{ backgroundColor: plan.color }} />
                <div className="flex flex-1 flex-col p-6">
                  <div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2"><h4 className="text-xl font-black text-slate-950">{plan.name}</h4>{plan.is_featured && <Crown size={15} className="text-amber-500" />}</div><p className="mt-1 line-clamp-2 text-sm text-slate-500">{plan.description || "Sem descrição"}</p></div><span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase ${plan.is_active ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"}`}>{plan.is_active ? "Ativo" : "Arquivado"}</span></div>
                  <div className="mt-5 flex items-end gap-1"><span className="text-sm font-bold text-slate-400">R$</span><span className="text-3xl font-black tracking-tight text-slate-950">{Number(plan.price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span><span className="pb-1 text-xs text-slate-400">/{plan.billing_cycle === "yearly" ? "ano" : "mês"}</span></div>
                  <div className="mt-5 space-y-2">{plan.features.slice(0, 5).map((feature) => <div key={feature} className="flex items-center gap-2 text-xs font-medium text-slate-600"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"><Check size={11} /></span>{featureLabel(feature)}</div>)}{plan.features.length > 5 && <p className="pl-7 text-[11px] font-bold text-blue-600">+ {plan.features.length - 5} recursos</p>}</div>
                  <div className="mt-5 grid grid-cols-3 gap-2 text-center">{[[plan.limits?.users, "usuários"], [plan.limits?.products, "produtos"], [plan.limits?.storageGb, "GB"]].map(([value, label]) => <div key={label} className="rounded-xl bg-slate-50 px-2 py-2"><p className="text-sm font-black text-slate-800">{value || "∞"}</p><p className="text-[9px] uppercase text-slate-400">{label}</p></div>)}</div>
                  <div className="mt-6 flex gap-2 border-t border-slate-100 pt-4"><button onClick={() => openPlan(plan)} className="flex h-9 flex-1 items-center justify-center gap-2 rounded-xl bg-slate-900 text-xs font-bold text-white hover:bg-slate-800"><Edit3 size={13} /> Editar</button>{plan.is_active && <button onClick={() => void archivePlan(plan)} title="Arquivar" className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-400 hover:border-red-200 hover:bg-red-50 hover:text-red-500"><Archive size={14} /></button>}</div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="font-black text-slate-950">Assinaturas dos clientes</h3><p className="text-xs text-slate-500">Vincule ou altere o plano de cada loja.</p></div><div className="relative w-full sm:w-72"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar cliente ou plano" className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:bg-white" /></div></div>
        <div className="divide-y divide-slate-100">{filteredTenants.map((tenant) => (
          <div key={tenant.id} className="flex flex-col gap-3 p-4 hover:bg-slate-50/70 sm:flex-row sm:items-center sm:px-5"><div className="flex min-w-0 flex-1 items-center gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 font-black text-blue-600">{tenant.name.charAt(0)}</div><div className="min-w-0"><p className="truncate text-sm font-bold text-slate-900">{tenant.name}</p><p className="truncate text-xs text-slate-400">{tenant.users?.[0]?.email || tenant.subdomain}</p></div></div><div className="flex items-center gap-3"><div className="hidden text-right md:block"><p className="text-xs font-bold text-slate-700">R$ {Number(tenant.subscription_amount || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p><p className="text-[10px] text-slate-400">mensalidade</p></div><select value={tenant.plan_id || ""} disabled={assigningId === tenant.id} onChange={(e) => void assignPlan(tenant, e.target.value)} className="h-10 min-w-44 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none focus:border-blue-500 sm:flex-none"><option value="">Sem plano</option>{activePlans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name} — R$ {Number(plan.price).toLocaleString("pt-BR")}</option>)}</select><ChevronRight size={15} className="hidden text-slate-300 sm:block" /></div></div>
        ))}{filteredTenants.length === 0 && <div className="p-10 text-center text-sm text-slate-500">Nenhum cliente encontrado.</div>}</div>
      </section>

      <AnimatePresence>{editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6"><motion.button aria-label="Fechar" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setEditing(null)} className="absolute inset-0 bg-slate-950/65 backdrop-blur-sm" /><motion.div initial={{ opacity: 0, scale: .97, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: .97 }} className="relative flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"><div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-7"><div><h3 className="text-lg font-black text-slate-950">{editing === "new" ? "Criar novo plano" : `Editar ${editing.name}`}</h3><p className="text-xs text-slate-500">Configure cobrança, limites e tudo que estará disponível.</p></div><button onClick={() => setEditing(null)} className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200"><X size={16} /></button></div>
          <form onSubmit={savePlan} className="flex min-h-0 flex-1 flex-col"><div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-7"><div className="grid gap-7 lg:grid-cols-[0.8fr_1.2fr]"><div className="space-y-4"><p className="text-[10px] font-black uppercase tracking-[.18em] text-blue-600">Informações comerciais</p>{[["Nome do plano", "name", "Ex: Profissional"], ["Descrição", "description", "Para lojas em crescimento"]].map(([label, key, placeholder]) => <label key={key} className="block space-y-1.5"><span className="text-xs font-bold text-slate-700">{label}</span><input required={key === "name"} value={draft[key as "name" | "description"]} onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))} placeholder={placeholder} className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10" /></label>)}<div className="grid grid-cols-2 gap-3"><label className="space-y-1.5"><span className="text-xs font-bold text-slate-700">Preço</span><input type="number" min="0" step="0.01" value={draft.price} onChange={(e) => setDraft(d => ({ ...d, price: e.target.value }))} className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-500" /></label><label className="space-y-1.5"><span className="text-xs font-bold text-slate-700">Cobrança</span><select value={draft.billingCycle} onChange={(e) => setDraft(d => ({ ...d, billingCycle: e.target.value as PlanDraft["billingCycle"] }))} className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none"><option value="monthly">Mensal</option><option value="yearly">Anual</option></select></label></div><div className="grid grid-cols-3 gap-3">{[["Usuários", "users"], ["Produtos", "products"], ["Armaz. GB", "storageGb"]].map(([label, key]) => <label key={key} className="space-y-1.5"><span className="text-[11px] font-bold text-slate-600">{label}</span><input type="number" min="0" value={draft[key as "users" | "products" | "storageGb"]} onChange={(e) => setDraft(d => ({ ...d, [key]: e.target.value }))} className="h-10 w-full rounded-xl border border-slate-200 px-2 text-sm outline-none focus:border-blue-500" /></label>)}</div><div className="grid grid-cols-2 gap-3"><label className="space-y-1.5"><span className="text-xs font-bold text-slate-700">Dias de trial</span><input type="number" min="0" value={draft.trialDays} onChange={(e) => setDraft(d => ({ ...d, trialDays: e.target.value }))} className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none" /></label><label className="space-y-1.5"><span className="text-xs font-bold text-slate-700">Cor do plano</span><input type="color" value={draft.color} onChange={(e) => setDraft(d => ({ ...d, color: e.target.value }))} className="h-11 w-full cursor-pointer rounded-xl border border-slate-200 bg-white p-1" /></label></div><div className="space-y-2">{[["isFeatured", "Destacar como recomendado"], ["isActive", "Plano ativo para contratação"]].map(([key, label]) => <button type="button" key={key} onClick={() => setDraft(d => ({ ...d, [key]: !d[key as "isFeatured" | "isActive"] }))} className="flex w-full items-center justify-between rounded-xl border border-slate-200 p-3 text-left text-xs font-bold text-slate-700"><span>{label}</span><span className={`flex h-6 w-10 items-center rounded-full p-0.5 transition ${draft[key as "isFeatured" | "isActive"] ? "justify-end bg-blue-600" : "justify-start bg-slate-200"}`}><span className="h-5 w-5 rounded-full bg-white shadow" /></span></button>)}</div></div>
            <div><p className="mb-4 text-[10px] font-black uppercase tracking-[.18em] text-blue-600">Recursos incluídos <span className="ml-2 rounded-full bg-blue-50 px-2 py-1 text-blue-600">{draft.features.length}</span></p><div className="grid gap-4 sm:grid-cols-2">{FEATURE_GROUPS.map((group) => <div key={group.title} className="rounded-2xl border border-slate-200 p-4"><p className="mb-3 text-xs font-black text-slate-800">{group.title}</p><div className="space-y-2">{group.items.map(([key, label]) => { const selected = draft.features.includes(key); return <button type="button" key={key} onClick={() => toggleFeature(key)} className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-xs font-semibold transition ${selected ? "bg-blue-50 text-blue-700" : "text-slate-500 hover:bg-slate-50"}`}><span className={`flex h-5 w-5 items-center justify-center rounded-md border ${selected ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300 bg-white"}`}>{selected && <Check size={12} />}</span>{label}</button>; })}</div></div>)}</div></div></div></div><div className="flex shrink-0 items-center justify-end gap-3 border-t border-slate-100 bg-slate-50 px-5 py-4 sm:px-7"><button type="button" onClick={() => setEditing(null)} className="h-10 rounded-xl px-4 text-xs font-bold text-slate-500 hover:bg-slate-200">Cancelar</button><button type="submit" disabled={saving} className="flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-5 text-xs font-bold text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700 disabled:opacity-50">{saving ? "Salvando..." : <><BadgeCheck size={14} /> Salvar plano</>}</button></div></form></motion.div></div>
      )}</AnimatePresence>
    </motion.div>
  );
}
