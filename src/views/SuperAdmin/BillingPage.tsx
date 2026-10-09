import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import {
  Wallet, CheckCircle2, AlertTriangle, Ban, ExternalLink,
  Loader2, TrendingUp, ChevronDown, ChevronUp,
} from "lucide-react";

import { getStoredToken } from "../../lib/session";
import type { ManagedTenant } from "../../types";
import { EmptyState } from "./components";
import { Button, IconButton } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { SectionTitle, StatGrid } from "../../components/ui/PageWrapper";
import { StatCard } from "../../components/ui/StatCard";
import { FilterLineSearch } from "../../components/ui/FilterLine";

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

const STATUS_META: Record<string, { label: string; color: "success" | "warning" | "danger" | "default"; icon: React.ReactNode }> = {
  active:    { label: "Em dia",    color: "success", icon: <CheckCircle2 size={12} /> },
  overdue:   { label: "Em atraso", color: "warning", icon: <AlertTriangle size={12} /> },
  suspended: { label: "Suspensa",  color: "danger",  icon: <Ban size={12} /> },
  cancelled: { label: "Cancelada", color: "default", icon: <Ban size={12} /> },
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
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <SectionTitle
        icon={Wallet}
        title="Assinaturas Box Sys"
        description="Cobrança recorrente via Asaas das mensalidades de cada loja cliente."
      />

      <StatGrid cols={4}>
        <StatCard title="Em dia" value={summary.active} icon={CheckCircle2} color="success" />
        <StatCard title="Em atraso" value={summary.overdue} icon={AlertTriangle} color="warning" />
        <StatCard title="Suspensas" value={summary.suspended} icon={Ban} color="danger" />
        <StatCard title="Receita no mês" value={`R$ ${fmt(summary.revenue_this_month)}`} icon={TrendingUp} color="info" />
      </StatGrid>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-semibold text-slate-950">Assinaturas por loja</h3>
            <p className="text-xs text-slate-500">Crie a cobrança, acompanhe faturas e cancele quando precisar.</p>
          </div>
          <div className="w-full sm:w-72">
            <FilterLineSearch value={search} onChange={setSearch} placeholder="Buscar loja" aria-label="Buscar loja" />
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
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 font-semibold text-blue-600">
                      {tenant.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{tenant.name}</p>
                      <p className="truncate text-xs text-slate-400">{tenant.users?.[0]?.email || tenant.subdomain}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="hidden text-right md:block">
                      <p className="text-xs font-semibold text-slate-700">R$ {fmt(Number(tenant.subscription_amount || 0))}</p>
                      <p className="text-[11px] text-slate-400">mensalidade</p>
                    </div>

                    {meta ? (
                      <Badge color={meta.color} icon={meta.icon}>{meta.label}</Badge>
                    ) : (
                      <Badge color="default">Sem cobrança</Badge>
                    )}

                    {!subscription && (
                      <Button
                        size="sm"
                        onClick={() => createSubscription(tenant)}
                        loading={creatingId === tenant.id}
                        disabled={!Number(tenant.subscription_amount)}
                        title={!Number(tenant.subscription_amount) ? "Defina um valor de assinatura antes" : undefined}
                      >
                        Criar cobrança
                      </Button>
                    )}

                    {subscription && (
                      <IconButton
                        variant="outline"
                        size="sm"
                        aria-label={expanded ? "Recolher faturas" : "Ver faturas"}
                        onClick={() => setExpandedId(expanded ? null : tenant.id)}
                      >
                        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </IconButton>
                    )}
                  </div>
                </div>

                {expanded && subscription && (
                  <div className="bg-slate-50/60 px-4 pb-4 sm:px-5">
                    <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-[11px] font-semibold text-slate-500">
                          Próximo vencimento: <span className="text-slate-700">{formatDateBR(subscription.next_due_date)}</span>
                          {" · "}Carência: {subscription.grace_period_days}d
                        </p>
                        {subscription.status !== "cancelled" && (
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => cancelSubscription(tenant)}
                            loading={cancellingId === tenant.id}
                          >
                            Cancelar assinatura
                          </Button>
                        )}
                      </div>

                      {(!subscription.invoices || subscription.invoices.length === 0) && (
                        <p className="text-xs text-slate-400">Nenhuma fatura ainda.</p>
                      )}

                      {subscription.invoices?.map((inv) => (
                        <div key={inv.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2.5">
                          <div>
                            <p className="text-xs font-semibold text-slate-700">Vencimento {formatDateBR(inv.due_date)}</p>
                            <p className="text-[11px] text-slate-400">
                              {inv.status} {inv.payment_date && `· pago em ${formatDateBR(inv.payment_date)}`}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-semibold text-sm text-slate-900">R$ {fmt(inv.value)}</span>
                            {inv.invoice_url && (
                              <a href={inv.invoice_url} target="_blank" rel="noopener noreferrer"
                                className="inline-flex h-7 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-[11px] font-medium text-slate-600 hover:bg-blue-50 hover:text-blue-700">
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
