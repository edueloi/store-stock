import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CalendarClock,
  CreditCard,
  Link2,
  LogOut,
  RefreshCcw,
  ShieldCheck,
  Store,
  UserPlus2,
  Copy,
} from "lucide-react";
import { motion } from "motion/react";

import { clearSession, getStoredToken, getStoredUser } from "../../lib/session";
import type { ManagedTenant, SetupInvite } from "../../types";
import {
  Field,
  SelectField,
  MiniInfo,
  InfoLine,
  ActionButton,
  StatCard,
  Badge,
  EmptyState,
  Alert,
} from "./components";

type OverviewResponse = {
  stats: {
    tenants: number;
    active_trials: number;
    active_accounts: number;
    pending_invites: number;
  };
  tenants: ManagedTenant[];
  invites: SetupInvite[];
};

function apiHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${getStoredToken()}`,
  };
}

function normalizeSubdomain(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export default function SuperAdminDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [stats, setStats] = useState<OverviewResponse["stats"] | null>(null);
  const [tenants, setTenants] = useState<ManagedTenant[]>([]);
  const [invites, setInvites] = useState<SetupInvite[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    storeName: "",
    subdomain: "",
    whatsapp: "",
    ownerName: "",
    ownerEmail: "",
    trialDays: "30",
    subscriptionAmount: "0",
  });

  useEffect(() => {
    const user = getStoredUser();

    if (user?.role !== "super_admin") {
      navigate("/login", { replace: true });
      return;
    }

    void loadOverview();
  }, [navigate]);

  const sortedInvites = useMemo(
    () =>
      [...invites].sort(
        (left, right) =>
          +new Date(right.created_at) - +new Date(left.created_at)
      ),
    [invites]
  );

  const sortedTenants = useMemo(
    () =>
      [...tenants].sort(
        (left, right) =>
          +new Date(right.created_at as string) -
          +new Date(left.created_at as string)
      ),
    [tenants]
  );

  async function loadOverview() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/super-admin/overview", {
        headers: apiHeaders(),
      });

      const data = (await response.json()) as OverviewResponse & {
        error?: string;
      };

      if (!response.ok) {
        setError(data.error || "Falha ao carregar o painel.");
        return;
      }

      setStats(data.stats);
      setTenants(data.tenants);
      setInvites(data.invites);
    } catch {
      setError("Não foi possível carregar o painel do super admin.");
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    clearSession();
    navigate("/login", { replace: true });
  }

  async function handleCreateInvite(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/super-admin/invites", {
        method: "POST",
        headers: apiHeaders(),
        body: JSON.stringify({
          storeName: form.storeName,
          subdomain: form.subdomain,
          whatsapp: form.whatsapp,
          ownerName: form.ownerName,
          ownerEmail: form.ownerEmail,
          trialDays: Number(form.trialDays) || 30,
          subscriptionAmount: Number(form.subscriptionAmount) || 0,
        }),
      });

      const data = (await response.json()) as SetupInvite & { error?: string };

      if (!response.ok) {
        setError(data.error || "Não foi possível gerar o convite.");
        return;
      }

      setInvites((current) => [data, ...current]);
      setStats((current) =>
        current
          ? {
              ...current,
              pending_invites: current.pending_invites + 1,
            }
          : current
      );
      setMessage("Link de ativação criado com sucesso.");
      setForm((current) => ({
        ...current,
        storeName: "",
        subdomain: "",
        whatsapp: "",
        ownerName: "",
        ownerEmail: "",
      }));
    } catch {
      setError("Erro ao gerar o convite.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRegenerateInvite(inviteId: number) {
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `/api/super-admin/invites/${inviteId}/regenerate`,
        {
          method: "POST",
          headers: apiHeaders(),
        }
      );

      const data = (await response.json()) as SetupInvite & { error?: string };

      if (!response.ok) {
        setError(data.error || "Não foi possível regenerar o convite.");
        return;
      }

      setInvites((current) =>
        current.map((invite) => (invite.id === inviteId ? data : invite))
      );
      setMessage("Convite regenerado. O link antigo deixa de valer.");
    } catch {
      setError("Erro ao regenerar o convite.");
    }
  }

  async function handleUpdateTenant(tenant: ManagedTenant) {
    setError("");
    setMessage("");

    try {
      const response = await fetch(`/api/super-admin/tenants/${tenant.id}`, {
        method: "PATCH",
        headers: apiHeaders(),
        body: JSON.stringify({
          status: tenant.status,
          trialDays: tenant.trial_days,
          trialEndsAt: tenant.trial_ends_at,
          subscriptionAmount: tenant.subscription_amount,
          whatsapp: tenant.whatsapp,
        }),
      });

      const data = (await response.json()) as ManagedTenant & {
        error?: string;
      };

      if (!response.ok) {
        setError(data.error || "Não foi possível atualizar o tenant.");
        return;
      }

      setTenants((current) =>
        current.map((item) => (item.id === tenant.id ? data : item))
      );
      setMessage(`Tenant ${tenant.name} atualizado.`);
    } catch {
      setError("Erro ao atualizar o tenant.");
    }
  }

  function setTenantDraft(tenantId: number, patch: Partial<ManagedTenant>) {
    setTenants((current) =>
      current.map((tenant) =>
        tenant.id === tenantId ? { ...tenant, ...patch } : tenant
      )
    );
  }

  async function copyText(value: string, successMessage: string) {
    try {
      await navigator.clipboard.writeText(value);
      setMessage(successMessage);
    } catch {
      setError("Não foi possível copiar para a área de transferência.");
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
        <motion.div
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="space-y-4 text-center"
        >
          <div className="mx-auto h-12 w-12 rounded-full border-4 border-slate-600 border-t-blue-500" />
          <p className="text-sm font-semibold text-slate-300">
            Carregando painel...
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white shadow-2xl"
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(59,130,246,0.2),_transparent_40%),radial-gradient(circle_at_bottom_left,_rgba(14,165,233,0.15),_transparent_35%)]" />
          <div className="relative grid gap-8 px-6 py-8 sm:px-8 lg:grid-cols-[1.2fr_0.8fr] lg:px-10">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-3 rounded-full border border-white/20 bg-white/10 px-4 py-2 backdrop-blur-sm">
                <ShieldCheck size={16} className="text-sky-300" />
                <span className="text-[11px] font-bold uppercase tracking-[0.28em] text-sky-200">
                  Super Admin
                </span>
              </div>

              <div className="space-y-4">
                <h1 className="text-3xl font-black leading-tight tracking-[-0.04em] sm:text-4xl lg:text-5xl">
                  Provisionamento SaaS
                </h1>
                <p className="max-w-2xl text-sm leading-relaxed text-slate-300 sm:text-base">
                  Gere convites exclusivos, reserve subdomínios e gerencie
                  clientes com segurança.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-4">
                <StatCard
                  label="Tenants"
                  value={stats?.tenants ?? 0}
                  icon={<Store size={16} />}
                />
                <StatCard
                  label="Trials"
                  value={stats?.active_trials ?? 0}
                  icon={<CalendarClock size={16} />}
                />
                <StatCard
                  label="Ativos"
                  value={stats?.active_accounts ?? 0}
                  icon={<UserPlus2 size={16} />}
                />
                <StatCard
                  label="Convites"
                  value={stats?.pending_invites ?? 0}
                  icon={<RefreshCcw size={16} />}
                />
              </div>
            </div>

            <div className="flex flex-col items-start justify-between gap-4 lg:items-end">
              <button
                onClick={handleLogout}
                className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-5 text-[11px] font-bold uppercase tracking-[0.22em] text-white backdrop-blur-sm transition-all hover:bg-white/20"
              >
                <LogOut size={15} />
                Sair
              </button>
            </div>
          </div>
        </motion.section>

        {/* Alerts */}
        {(message || error) && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-5"
          >
            <Alert
              type={error ? "error" : "success"}
              message={error || message}
            />
          </motion.div>
        )}

        {/* Content Grid */}
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1fr]">
          {/* Create Invite */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-lg"
          >
            <div className="space-y-2 mb-8">
              <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-blue-600">
                Novo
              </p>
              <h2 className="text-2xl font-black tracking-[-0.04em] text-slate-900">
                Gerar convite
              </h2>
            </div>

            <form onSubmit={handleCreateInvite} className="space-y-6">
              <div className="space-y-4">
                <Field
                  label="Nome da loja"
                  value={form.storeName}
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      storeName: value,
                      subdomain: normalizeSubdomain(value),
                    }))
                  }
                  placeholder="Ex: Vogan Store"
                />

                <Field
                  label="Subdomínio"
                  value={form.subdomain}
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      subdomain: normalizeSubdomain(value),
                    }))
                  }
                  placeholder="voganstore"
                />

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label="WhatsApp"
                    value={form.whatsapp}
                    onChange={(value) =>
                      setForm((current) => ({ ...current, whatsapp: value }))
                    }
                    placeholder="5511999999999"
                  />
                  <Field
                    label="Responsável"
                    value={form.ownerName}
                    onChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        ownerName: value,
                      }))
                    }
                    placeholder="Nome do cliente"
                  />
                </div>

                <Field
                  label="E-mail"
                  value={form.ownerEmail}
                  onChange={(value) =>
                    setForm((current) => ({ ...current, ownerEmail: value }))
                  }
                  placeholder="cliente@empresa.com.br"
                />

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label="Trial (dias)"
                    value={form.trialDays}
                    onChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        trialDays: value,
                      }))
                    }
                    placeholder="30"
                    type="number"
                  />
                  <Field
                    label="Assinatura (R$)"
                    value={form.subscriptionAmount}
                    onChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        subscriptionAmount: value,
                      }))
                    }
                    placeholder="0.00"
                    type="number"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 text-[11px] font-bold uppercase tracking-[0.24em] text-white shadow-lg hover:shadow-xl transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <UserPlus2 size={16} />
                {submitting ? "Gerando..." : "Criar convite"}
              </button>
            </form>
          </motion.section>

          {/* Invites */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-lg"
          >
            <div className="flex items-center justify-between gap-3 mb-6">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-blue-600">
                  Links
                </p>
                <h2 className="text-2xl font-black tracking-[-0.04em] text-slate-900">
                  Gerados
                </h2>
              </div>
              <button
                onClick={() => void loadOverview()}
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-600 transition-all hover:bg-slate-100"
              >
                <RefreshCcw size={13} />
              </button>
            </div>

            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {sortedInvites.length === 0 && (
                <EmptyState message="Nenhum convite criado" />
              )}

              {sortedInvites.map((invite) => (
                <motion.div
                  key={invite.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-lg border border-slate-100 bg-gradient-to-br from-slate-50 to-blue-50/30 p-4"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-slate-900 truncate">
                        {invite.store_name}
                      </h3>
                      <p className="text-xs text-slate-500 truncate">
                        {invite.subdomain}
                      </p>
                    </div>
                    <Badge
                      status={
                        invite.used_at
                          ? "used"
                          : invite.is_expired
                            ? "expired"
                            : "pending"
                      }
                    />
                  </div>

                  <div className="grid gap-2 mb-3">
                    <MiniInfo
                      icon={<CalendarClock size={12} />}
                      label="Trial"
                      value={`${invite.trial_days} dias`}
                    />
                    <MiniInfo
                      icon={<CreditCard size={12} />}
                      label="Assinatura"
                      value={`R$ ${invite.subscription_amount.toFixed(2)}`}
                    />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <ActionButton
                      variant="secondary"
                      onClick={() =>
                        void copyText(invite.invite_url, "Link copiado")
                      }
                    >
                      <Copy size={12} />
                    </ActionButton>
                    <ActionButton
                      variant="secondary"
                      onClick={() =>
                        void handleRegenerateInvite(invite.id)
                      }
                    >
                      <RefreshCcw size={12} />
                    </ActionButton>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.section>
        </div>

        {/* Tenants */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-lg"
        >
          <div className="space-y-2 mb-6">
            <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-blue-600">
              Accounts
            </p>
            <h2 className="text-2xl font-black tracking-[-0.04em] text-slate-900">
              Provisionados
            </h2>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {sortedTenants.length === 0 && (
              <EmptyState message="Nenhuma conta provisionada" />
            )}

            {sortedTenants.map((tenant) => (
              <motion.div
                key={tenant.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-lg border border-slate-100 bg-gradient-to-br from-slate-50 to-blue-50/30 p-5"
              >
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-slate-900">
                      {tenant.name}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      {tenant.users?.[0]?.email || "Sem usuário"}
                    </p>
                  </div>
                  <ActionButton
                    variant="secondary"
                    onClick={() =>
                      void copyText(
                        tenant.public_url || "",
                        "URL copiada"
                      )
                    }
                  >
                    <Copy size={12} />
                  </ActionButton>
                </div>

                <div className="space-y-3 mb-4">
                  <SelectField
                    label="Status"
                    value={tenant.status || "active"}
                    onChange={(value) =>
                      setTenantDraft(tenant.id, {
                        status: value as ManagedTenant["status"],
                      })
                    }
                    options={[
                      { value: "active", label: "Ativo" },
                      { value: "trial", label: "Trial" },
                      { value: "suspended", label: "Suspenso" },
                    ]}
                  />
                  <Field
                    label="Trial (dias)"
                    value={String(tenant.trial_days || 30)}
                    onChange={(value) =>
                      setTenantDraft(tenant.id, {
                        trial_days: Number(value) || 30,
                      })
                    }
                    type="number"
                    placeholder="30"
                  />
                  <Field
                    label="Assinatura (R$)"
                    value={String(tenant.subscription_amount || 0)}
                    onChange={(value) =>
                      setTenantDraft(tenant.id, {
                        subscription_amount: Number(value) || 0,
                      })
                    }
                    type="number"
                    placeholder="0.00"
                  />
                </div>

                <button
                  onClick={() => void handleUpdateTenant(tenant)}
                  className="w-full h-10 bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-bold uppercase tracking-[0.16em] rounded-lg transition-colors"
                >
                  Salvar
                </button>
              </motion.div>
            ))}
          </div>
        </motion.section>
      </div>
    </div>
  );
}
