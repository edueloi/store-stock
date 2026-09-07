import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import {
  Wallet, Search, CheckCircle2, AlertTriangle, Ban, ExternalLink,
  Loader2, TrendingUp, ChevronDown, ChevronUp,
} from "lucide-react";

import { getStoredToken } from "../../lib/session";
import type { ManagedTenant } from "../../types";
import { EmptyState } from "./components";

interface PlatformInvoice {
  id: number;
  asaas_payment_id: string;
  status: string;
  value: number;
  due_date: string;
  payment_date: string | null;
  billing_type: string | null;
  invoice_url: string | null;
}

interface PlatformSubscription {
  id: number;
  tenant_id: number;
  status: string;
  value: number;
  next_due_date: string | null;
  grace_period_days: number;
  suspended_at: string | null;
  tenant?: { id: number; name: string; subdomain: string };
  invoices?: PlatformInvoice[];
}

interface BillingOverview {
  subscriptions: PlatformSubscription[];
  summary: { active: number; overdue: number; suspended: number; revenue_this_month: number };
}

const STATUS_META: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  active:    { label: "Em dia",    color: "text-emerald-600", bg: "bg-emerald-50", icon: <CheckCircle2 size={12} /> },
  overdue:   { label: "Em atraso", color: "text-amber-600",   bg: "bg-amber-50",   icon: <AlertTriangle size={12} /> },
  suspended: { label: "Suspensa",  color: "text-rose-600",    bg: "bg-rose-50",    icon: <Ban size={12} /> },
  cancelled: { label: "Cancelada", color: "text-slate-500",   bg: "bg-slate-100",  icon: <Ban size={12} /> },
};

function fmt(value: number) {
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDateBR(date: string | null) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("pt-BR");
}

function headers() {
  return { "Content-Type": "application/json", Authorization: `Bearer ${getStoredToken()}` };
}

export default function BillingPage({ tenants, notify }: {
  tenants: ManagedTenant[];
  notify: (type: "success" | "error", message: string) => void;
}) {
  const [overview, setOverview] = useState<BillingOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [creatingId, setCreatingId] = useState<number | null>(null);
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const loadOverview = () => {
    setLoading(true);
    fetch("/api/super-admin/billing/overview", { headers: headers() })
      .then((r) => r.json())
      .then((data) => setOverview(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(loadOverview, []);

  const subscriptionByTenantId = useMemo(() => {
    const map = new Map<number, PlatformSubscription>();
    overview?.subscriptions.forEach((sub) => map.set(sub.tenant_id, sub));
    return map;
  }, [overview]);

  const filteredTenants = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("pt-BR");
    return tenants.filter((tenant) => !q || [tenant.name, tenant.subdomain, tenant.users?.[0]?.email]
      .some((value) => String(value || "").toLocaleLowerCase("pt-BR").includes(q)));
  }, [search, tenants]);

  async function createSubscription(tenant: ManagedTenant) {
    setCreatingId(tenant.id);
    try {
      const res = await fetch(`/api/super-admin/tenants/${tenant.id}/billing/create-subscription`, {
        method: "POST", headers: headers(),
      });
      const data = await res.json();
      if (!res.ok) { notify("error", data.error || "Não foi possível criar a cobrança."); return; }
      notify("success", `Assinatura Asaas criada para ${tenant.name}.`);
      loadOverview();
    } catch { notify("error", "Erro ao criar a cobrança."); }
    finally { setCreatingId(null); }
  }

  async function cancelSubscription(tenant: ManagedTenant) {
    if (!window.confirm(`Cancelar a assinatura Asaas de ${tenant.name}? Isso encerra a cobrança recorrente.`)) return;
    setCancellingId(tenant.id);
    try {
      const res = await fetch(`/api/super-admin/tenants/${tenant.id}/billing/cancel-subscription`, {
        method: "POST", headers: headers(),
      });
      const data = await res.json();
      if (!res.ok) { notify("error", data.error || "Não foi possível cancelar a assinatura."); return; }
      notify("success", `Assinatura de ${tenant.name} cancelada.`);
      loadOverview();
    } catch { notify("error", "Erro ao cancelar a assinatura."); }
    finally { setCancellingId(null); }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={24} className="animate-spin text-slate-300" />
      </div>
    );
  }

  const summary = overview?.summary ?? { active: 0, overdue: 0, suspended: 0, revenue_this_month: 0 };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-6 text-white shadow-xl sm:p-8">
        <div className="max-w-2xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-blue-400/20 bg-blue-400/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-blue-300">
            <Wallet size={12} /> Financeiro da plataforma
          </div>
          <h2 className="text-2xl font-black tracking-[-0.03em] sm:text-3xl">Assinaturas Box Sys</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Cobrança recorrente via Asaas das mensalidades de cada loja cliente.
          </p>
        </div>
        <div className="mt-7 grid gap-3 grid-cols-2 sm:grid-cols-4">
          {[
            { label: "Em dia", value: summary.active, icon: <CheckCircle2 size={16} /> },
            { label: "Em atraso", value: summary.overdue, icon: <AlertTriangle size={16} /> },
            { label: "Suspensas", value: summary.suspended, icon: <Ban size={16} /> },
            { label: "Receita no mês", value: `R$ ${fmt(summary.revenue_this_month)}`, icon: <TrendingUp size={16} /> },
          ].map((item) => (
            <div key={item.label} className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[10px] font-semibold uppercase tracking-wide">{item.label}</span>{item.icon}
              </div>
              <p className="mt-2 text-xl font-black">{item.value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-black text-slate-950">Assinaturas por loja</h3>
            <p className="text-xs text-slate-500">Crie a cobrança, acompanhe faturas e cancele quando precisar.</p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar loja"
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:bg-white" />
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {filteredTenants.map((tenant) => {
            const subscription = subscriptionByTenantId.get(tenant.id);
            const meta = subscription ? STATUS_META[subscription.status] ?? STATUS_META.active : null;
            const expanded = expandedId === tenant.id;

            return (
              <div key={tenant.id}>
                <div className="flex flex-col gap-3 p-4 hover:bg-slate-50/70 sm:flex-row sm:items-center sm:px-5">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 font-black text-blue-600">
                      {tenant.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-900">{tenant.name}</p>
                      <p className="truncate text-xs text-slate-400">{tenant.users?.[0]?.email || tenant.subdomain}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="hidden text-right md:block">
                      <p className="text-xs font-bold text-slate-700">R$ {fmt(Number(tenant.subscription_amount || 0))}</p>
                      <p className="text-[10px] text-slate-400">mensalidade</p>
                    </div>

                    {meta ? (
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-wide ${meta.bg} ${meta.color}`}>
                        {meta.icon} {meta.label}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[9px] font-black uppercase tracking-wide text-slate-400">
                        Sem cobrança
                      </span>
                    )}

                    {!subscription && (
                      <button
                        onClick={() => createSubscription(tenant)}
                        disabled={creatingId === tenant.id || !Number(tenant.subscription_amount)}
                        title={!Number(tenant.subscription_amount) ? "Defina um valor de assinatura antes" : undefined}
                        className="h-9 rounded-lg bg-blue-600 px-3 text-[10px] font-black uppercase tracking-widest text-white hover:bg-blue-700 disabled:opacity-40"
                      >
                        {creatingId === tenant.id ? <Loader2 size={13} className="animate-spin" /> : "Criar cobrança"}
                      </button>
                    )}

                    {subscription && (
                      <button
                        onClick={() => setExpandedId(expanded ? null : tenant.id)}
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:bg-slate-50"
                      >
                        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                    )}
                  </div>
                </div>

                {expanded && subscription && (
                  <div className="bg-slate-50/60 px-4 pb-4 sm:px-5">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                          Próximo vencimento: <span className="text-slate-700">{formatDateBR(subscription.next_due_date)}</span>
                          {" · "}Carência: {subscription.grace_period_days}d
                        </p>
                        {subscription.status !== "cancelled" && (
                          <button
                            onClick={() => cancelSubscription(tenant)}
                            disabled={cancellingId === tenant.id}
                            className="h-8 px-3 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 text-[9px] font-black uppercase tracking-widest disabled:opacity-40"
                          >
                            {cancellingId === tenant.id ? <Loader2 size={12} className="animate-spin" /> : "Cancelar assinatura"}
                          </button>
                        )}
                      </div>

                      {(!subscription.invoices || subscription.invoices.length === 0) && (
                        <p className="text-xs text-slate-400">Nenhuma fatura ainda.</p>
                      )}

                      {subscription.invoices?.map((inv) => (
                        <div key={inv.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2.5">
                          <div>
                            <p className="text-xs font-bold text-slate-700">Vencimento {formatDateBR(inv.due_date)}</p>
                            <p className="text-[10px] text-slate-400">
                              {inv.status} {inv.payment_date && `· pago em ${formatDateBR(inv.payment_date)}`}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-sm text-slate-900">R$ {fmt(inv.value)}</span>
                            {inv.invoice_url && (
                              <a href={inv.invoice_url} target="_blank" rel="noopener noreferrer"
                                className="flex h-7 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 text-[9px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50">
                                <ExternalLink size={11} /> Ver
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {filteredTenants.length === 0 && <EmptyState message="Nenhuma loja encontrada." />}
        </div>
      </section>
    </motion.div>
  );
}
