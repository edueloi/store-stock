import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CalendarClock,
  CreditCard,
  LogOut,
  RefreshCcw,
  ShieldCheck,
  Store,
  UserPlus2,
  Copy,
  Users,
  Link2,
  CheckCircle2,
  AlertCircle,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

import { clearSession, getStoredToken, getStoredUser } from "../../lib/session";
import type { ManagedTenant, SetupInvite } from "../../types";
import { Badge, EmptyState, SelectField } from "./components";

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

type Toast = { type: "success" | "error"; message: string };

function apiHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${getStoredToken()}`,
  };
}

function normalizeSubdomain(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function maskPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 13);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `+${digits.slice(0, 2)} (${digits.slice(2)}`;
  if (digits.length <= 11) return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4)}`;
  return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
}

function InputField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  icon,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  type?: string;
  icon?: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </label>
      <div className="flex h-11 items-center gap-3 rounded-xl border border-slate-200 bg-white px-3.5 transition-all focus-within:border-[#C9A227] focus-within:shadow-[0_0_0_3px_rgba(201,162,39,0.12)]">
        {icon && <span className="shrink-0 text-slate-400">{icon}</span>}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="h-full w-full bg-transparent text-sm font-medium text-slate-900 placeholder-slate-400 outline-none"
          required
        />
      </div>
      {hint && <p className="text-[10px] text-slate-400">{hint}</p>}
    </div>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
  return (
    <div className={`flex items-center gap-3 rounded-2xl border p-4 ${color}`}>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/60">
        {icon}
      </div>
      <div>
        <p className="text-2xl font-black tracking-tight text-slate-900">{value}</p>
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      </div>
    </div>
  );
}

export default function SuperAdminDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [stats, setStats] = useState<OverviewResponse["stats"] | null>(null);
  const [tenants, setTenants] = useState<ManagedTenant[]>([]);
  const [invites, setInvites] = useState<SetupInvite[]>([]);
  const [toast, setToast] = useState<Toast | null>(null);
  const [form, setForm] = useState({
    storeName: "",
    subdomain: "",
    whatsapp: "",
    ownerName: "",
    ownerEmail: "",
    trialDays: "30",
    subscriptionAmount: "0",
  });

  const showToast = (type: Toast["type"], message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4500);
  };

  useEffect(() => {
    const user = getStoredUser();
    if (user?.role !== "super_admin") {
      navigate("/login", { replace: true });
      return;
    }
    void loadOverview();
  }, [navigate]);

  const sortedInvites = useMemo(
    () => [...invites].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)),
    [invites]
  );

  const sortedTenants = useMemo(
    () => [...tenants].sort((a, b) => +new Date(b.created_at as string) - +new Date(a.created_at as string)),
    [tenants]
  );

  async function loadOverview() {
    setLoading(true);
    try {
      const res = await fetch("/api/super-admin/overview", { headers: apiHeaders() });
      const data = (await res.json()) as OverviewResponse & { error?: string };
      if (!res.ok) { showToast("error", data.error || "Falha ao carregar."); return; }
      setStats(data.stats);
      setTenants(data.tenants);
      setInvites(data.invites);
    } catch {
      showToast("error", "Não foi possível carregar o painel.");
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
    try {
      const res = await fetch("/api/super-admin/invites", {
        method: "POST",
        headers: apiHeaders(),
        body: JSON.stringify({
          storeName: form.storeName,
          subdomain: form.subdomain,
          whatsapp: form.whatsapp.replace(/\D/g, ""),
          ownerName: form.ownerName,
          ownerEmail: form.ownerEmail,
          trialDays: Number(form.trialDays) || 30,
          subscriptionAmount: Number(form.subscriptionAmount) || 0,
        }),
      });
      const data = (await res.json()) as SetupInvite & { error?: string };
      if (!res.ok) { showToast("error", data.error || "Não foi possível gerar o convite."); return; }
      setInvites((c) => [data, ...c]);
      setStats((c) => c ? { ...c, pending_invites: c.pending_invites + 1 } : c);
      showToast("success", "Convite criado com sucesso!");
      setForm((c) => ({ ...c, storeName: "", subdomain: "", whatsapp: "", ownerName: "", ownerEmail: "" }));
    } catch {
      showToast("error", "Erro ao gerar o convite.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRegenerateInvite(inviteId: number) {
    try {
      const res = await fetch(`/api/super-admin/invites/${inviteId}/regenerate`, { method: "POST", headers: apiHeaders() });
      const data = (await res.json()) as SetupInvite & { error?: string };
      if (!res.ok) { showToast("error", data.error || "Não foi possível regenerar."); return; }
      setInvites((c) => c.map((i) => (i.id === inviteId ? data : i)));
      showToast("success", "Convite regenerado. O link antigo foi invalidado.");
    } catch {
      showToast("error", "Erro ao regenerar o convite.");
    }
  }

  async function handleUpdateTenant(tenant: ManagedTenant) {
    try {
      const res = await fetch(`/api/super-admin/tenants/${tenant.id}`, {
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
      const data = (await res.json()) as ManagedTenant & { error?: string };
      if (!res.ok) { showToast("error", data.error || "Não foi possível atualizar."); return; }
      setTenants((c) => c.map((t) => (t.id === tenant.id ? data : t)));
      showToast("success", `${tenant.name} atualizado com sucesso.`);
    } catch {
      showToast("error", "Erro ao atualizar o tenant.");
    }
  }

  function setTenantDraft(tenantId: number, patch: Partial<ManagedTenant>) {
    setTenants((c) => c.map((t) => (t.id === tenantId ? { ...t, ...patch } : t)));
  }

  async function copyText(value: string, msg: string) {
    try {
      await navigator.clipboard.writeText(value);
      showToast("success", msg);
    } catch {
      showToast("error", "Não foi possível copiar.");
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0f172a]">
        <div className="space-y-4 text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-700 border-t-[#C9A227]" />
          <p className="text-sm font-semibold text-slate-400">Carregando painel...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.25 }}
            className="fixed left-1/2 top-5 z-50 flex -translate-x-1/2 items-center gap-3 rounded-2xl border bg-white px-5 py-3.5 shadow-[0_8px_32px_rgba(0,0,0,0.12)] min-w-[300px] max-w-sm"
            style={{ borderColor: toast.type === "error" ? "#fecaca" : "#bbf7d0" }}
          >
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${toast.type === "error" ? "bg-red-100" : "bg-emerald-100"}`}>
              {toast.type === "error"
                ? <AlertCircle size={16} className="text-red-500" />
                : <CheckCircle2 size={16} className="text-emerald-500" />}
            </span>
            <p className="flex-1 text-sm font-medium text-slate-800">{toast.message}</p>
            <button type="button" onClick={() => setToast(null)} className="shrink-0 text-slate-400 hover:text-slate-600">
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sidebar / Header */}
      <div className="bg-[#0f172a] text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow">
              <img src="/system/logo.png" alt="BoxSys" className="h-7 w-7 object-contain" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#C9A227]">BoxSys Store</p>
              <p className="text-xs font-semibold text-slate-400">Painel Super Admin</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-300">
              <ShieldCheck size={12} className="text-[#C9A227]" />
              Super Admin
            </span>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-300 transition-all hover:bg-white/10"
            >
              <LogOut size={13} />
              Sair
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Tenants" value={stats?.tenants ?? 0} icon={<Store size={18} className="text-blue-500" />} color="border-blue-100 bg-blue-50" />
          <StatCard label="Trials" value={stats?.active_trials ?? 0} icon={<CalendarClock size={18} className="text-amber-500" />} color="border-amber-100 bg-amber-50" />
          <StatCard label="Ativos" value={stats?.active_accounts ?? 0} icon={<Users size={18} className="text-emerald-500" />} color="border-emerald-100 bg-emerald-50" />
          <StatCard label="Convites" value={stats?.pending_invites ?? 0} icon={<Link2 size={18} className="text-purple-500" />} color="border-purple-100 bg-purple-50" />
        </div>

        {/* Grid: Form + Invites */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Formulário */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#C9A227]/10">
                <UserPlus2 size={18} className="text-[#C9A227]" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#C9A227]">Novo</p>
                <h2 className="text-xl font-black tracking-tight text-slate-900">Gerar Convite</h2>
              </div>
            </div>

            <form onSubmit={handleCreateInvite} className="space-y-4">
              <InputField
                label="Nome da loja"
                value={form.storeName}
                onChange={(v) => setForm((c) => ({ ...c, storeName: v, subdomain: normalizeSubdomain(v) }))}
                placeholder="Ex: Vogan Store"
                icon={<Store size={14} />}
              />

              <InputField
                label="Subdomínio"
                value={form.subdomain}
                onChange={(v) => setForm((c) => ({ ...c, subdomain: normalizeSubdomain(v) }))}
                placeholder="voganstore"
                icon={<Link2 size={14} />}
                hint={form.subdomain ? `→ ${form.subdomain}.boxsys.com.br` : undefined}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <InputField
                  label="WhatsApp"
                  value={form.whatsapp}
                  onChange={(v) => setForm((c) => ({ ...c, whatsapp: maskPhone(v) }))}
                  placeholder="+55 (11) 99999-9999"
                  icon={
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" xmlns="http://www.w3.org/2000/svg">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                  }
                />
                <InputField
                  label="Responsável"
                  value={form.ownerName}
                  onChange={(v) => setForm((c) => ({ ...c, ownerName: v }))}
                  placeholder="Nome do cliente"
                  icon={<Users size={14} />}
                />
              </div>

              <InputField
                label="E-mail"
                value={form.ownerEmail}
                onChange={(v) => setForm((c) => ({ ...c, ownerEmail: v }))}
                placeholder="cliente@empresa.com.br"
                type="email"
                icon={
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
                    <rect width="20" height="16" x="2" y="4" rx="2"/>
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                  </svg>
                }
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <InputField
                  label="Trial (dias)"
                  value={form.trialDays}
                  onChange={(v) => setForm((c) => ({ ...c, trialDays: v }))}
                  placeholder="30"
                  type="number"
                  icon={<CalendarClock size={14} />}
                />
                <InputField
                  label="Assinatura (R$)"
                  value={form.subscriptionAmount}
                  onChange={(v) => setForm((c) => ({ ...c, subscriptionAmount: v }))}
                  placeholder="0,00"
                  type="number"
                  icon={<CreditCard size={14} />}
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="mt-2 flex h-12 w-full items-center justify-center gap-2.5 rounded-xl bg-[#C9A227] text-sm font-bold text-white shadow-[0_4px_20px_rgba(201,162,39,0.35)] transition-all hover:bg-[#b8911f] hover:shadow-[0_4px_28px_rgba(201,162,39,0.45)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? (
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                ) : <UserPlus2 size={16} />}
                {submitting ? "Gerando..." : "Criar Convite"}
              </button>
            </form>
          </motion.div>

          {/* Lista de convites */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50">
                  <Link2 size={18} className="text-purple-500" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-purple-500">Links</p>
                  <h2 className="text-xl font-black tracking-tight text-slate-900">Gerados</h2>
                </div>
              </div>
              <button
                onClick={() => void loadOverview()}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 transition-all hover:bg-slate-100"
              >
                <RefreshCcw size={14} />
              </button>
            </div>

            <div className="max-h-[520px] space-y-3 overflow-y-auto pr-1">
              {sortedInvites.length === 0 && <EmptyState message="Nenhum convite criado ainda" />}
              {sortedInvites.map((invite) => (
                <motion.div
                  key={invite.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl border border-slate-100 bg-slate-50 p-4"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 truncate">{invite.store_name}</p>
                      <p className="text-xs text-slate-400 truncate">{invite.subdomain}.boxsys.com.br</p>
                    </div>
                    <Badge status={invite.used_at ? "used" : invite.is_expired ? "expired" : "pending"} />
                  </div>
                  <div className="flex gap-2 text-xs text-slate-500 mb-3">
                    <span className="flex items-center gap-1"><CalendarClock size={11} /> {invite.trial_days}d trial</span>
                    <span className="flex items-center gap-1"><CreditCard size={11} /> R$ {invite.subscription_amount.toFixed(2)}</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => void copyText(invite.invite_url, "Link copiado!")}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-600 transition-all hover:bg-slate-50"
                    >
                      <Copy size={11} /> Copiar link
                    </button>
                    <button
                      onClick={() => void handleRegenerateInvite(invite.id)}
                      className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-600 transition-all hover:bg-slate-50"
                    >
                      <RefreshCcw size={11} />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Tenants */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50">
              <Store size={18} className="text-emerald-500" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-600">Accounts</p>
              <h2 className="text-xl font-black tracking-tight text-slate-900">Provisionados</h2>
            </div>
          </div>

          {sortedTenants.length === 0
            ? <EmptyState message="Nenhuma conta provisionada" />
            : (
              <div className="grid gap-4 lg:grid-cols-2">
                {sortedTenants.map((tenant) => (
                  <div key={tenant.id} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-2 mb-4">
                      <div>
                        <p className="font-bold text-slate-900">{tenant.name}</p>
                        <p className="text-xs text-slate-400">{tenant.users?.[0]?.email || "Sem usuário"}</p>
                      </div>
                      <button
                        onClick={() => void copyText(tenant.public_url || "", "URL copiada!")}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-all hover:bg-slate-50"
                      >
                        <Copy size={13} />
                      </button>
                    </div>

                    <div className="space-y-3 mb-4">
                      <SelectField
                        label="Status"
                        value={tenant.status || "active"}
                        onChange={(v) => setTenantDraft(tenant.id, { status: v as ManagedTenant["status"] })}
                        options={[
                          { value: "active", label: "Ativo" },
                          { value: "trial", label: "Trial" },
                          { value: "suspended", label: "Suspenso" },
                        ]}
                      />
                    </div>

                    <button
                      onClick={() => void handleUpdateTenant(tenant)}
                      className="w-full h-10 rounded-xl bg-slate-900 text-[10px] font-bold uppercase tracking-[0.16em] text-white transition-colors hover:bg-slate-800"
                    >
                      Salvar
                    </button>
                  </div>
                ))}
              </div>
            )}
        </motion.div>
      </div>
    </div>
  );
}
