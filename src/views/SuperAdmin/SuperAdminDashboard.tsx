import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CalendarClock, CreditCard, LogOut, RefreshCcw, ShieldCheck,
  Store, UserPlus2, Copy, Users, Link2, CheckCircle2, AlertCircle,
  X, LayoutDashboard, Settings, Bell, ChevronRight, Phone, Mail,
  ExternalLink, TrendingUp, Clock, BadgeCheck,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

import { clearSession, getStoredToken, getStoredUser } from "../../lib/session";
import type { ManagedTenant, SetupInvite } from "../../types";
import { Badge, EmptyState, SelectField } from "./components";

type OverviewResponse = {
  stats: { tenants: number; active_trials: number; active_accounts: number; pending_invites: number };
  tenants: ManagedTenant[];
  invites: SetupInvite[];
};
type Toast = { type: "success" | "error"; message: string };
type Page = "dashboard" | "invites" | "tenants" | "settings";

function apiHeaders() {
  return { "Content-Type": "application/json", Authorization: `Bearer ${getStoredToken()}` };
}

function normalizeSubdomain(value: string) {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
}

function maskPhone(value: string) {
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function InputField({ label, value, onChange, placeholder, type = "text", icon, hint }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder: string; type?: string; icon?: React.ReactNode; hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">{label}</label>
      <div className="flex h-11 items-center gap-3 rounded-xl border border-slate-200 bg-white px-3.5 transition-all focus-within:border-[#C9A227] focus-within:shadow-[0_0_0_3px_rgba(201,162,39,0.12)]">
        {icon && <span className="shrink-0 text-slate-400">{icon}</span>}
        <input
          type={type} value={value} onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder} required
          className="h-full w-full bg-transparent text-sm font-medium text-slate-900 placeholder-slate-400 outline-none"
        />
      </div>
      {hint && <p className="text-[10px] text-[#C9A227] font-medium">{hint}</p>}
    </div>
  );
}

export default function SuperAdminDashboard() {
  const navigate = useNavigate();
  const [page, setPage] = useState<Page>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [stats, setStats] = useState<OverviewResponse["stats"] | null>(null);
  const [tenants, setTenants] = useState<ManagedTenant[]>([]);
  const [invites, setInvites] = useState<SetupInvite[]>([]);
  const [toast, setToast] = useState<Toast | null>(null);
  const [form, setForm] = useState({
    storeName: "", subdomain: "", whatsapp: "", ownerName: "",
    ownerEmail: "", trialDays: "30", subscriptionAmount: "0",
  });

  const showToast = (type: Toast["type"], message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4500);
  };

  useEffect(() => {
    const user = getStoredUser();
    if (user?.role !== "super_admin") { navigate("/login", { replace: true }); return; }
    void loadOverview();
  }, [navigate]);

  const sortedInvites = useMemo(() => [...invites].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)), [invites]);
  const sortedTenants = useMemo(() => [...tenants].sort((a, b) => +new Date(b.created_at as string) - +new Date(a.created_at as string)), [tenants]);

  async function loadOverview() {
    setLoading(true);
    try {
      const res = await fetch("/api/super-admin/overview", { headers: apiHeaders() });
      const data = (await res.json()) as OverviewResponse & { error?: string };
      if (!res.ok) { showToast("error", data.error || "Falha ao carregar."); return; }
      setStats(data.stats); setTenants(data.tenants); setInvites(data.invites);
    } catch { showToast("error", "Não foi possível carregar o painel."); }
    finally { setLoading(false); }
  }

  async function handleCreateInvite(event: FormEvent) {
    event.preventDefault(); setSubmitting(true);
    try {
      const res = await fetch("/api/super-admin/invites", {
        method: "POST", headers: apiHeaders(),
        body: JSON.stringify({
          storeName: form.storeName, subdomain: form.subdomain,
          whatsapp: form.whatsapp.replace(/\D/g, ""),
          ownerName: form.ownerName, ownerEmail: form.ownerEmail,
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
      setPage("invites");
    } catch { showToast("error", "Erro ao gerar o convite."); }
    finally { setSubmitting(false); }
  }

  async function handleRegenerateInvite(inviteId: number) {
    try {
      const res = await fetch(`/api/super-admin/invites/${inviteId}/regenerate`, { method: "POST", headers: apiHeaders() });
      const data = (await res.json()) as SetupInvite & { error?: string };
      if (!res.ok) { showToast("error", data.error || "Não foi possível regenerar."); return; }
      setInvites((c) => c.map((i) => (i.id === inviteId ? data : i)));
      showToast("success", "Convite regenerado com sucesso.");
    } catch { showToast("error", "Erro ao regenerar o convite."); }
  }

  async function handleUpdateTenant(tenant: ManagedTenant) {
    try {
      const res = await fetch(`/api/super-admin/tenants/${tenant.id}`, {
        method: "PATCH", headers: apiHeaders(),
        body: JSON.stringify({ status: tenant.status, trialDays: tenant.trial_days, subscriptionAmount: tenant.subscription_amount }),
      });
      const data = (await res.json()) as ManagedTenant & { error?: string };
      if (!res.ok) { showToast("error", data.error || "Não foi possível atualizar."); return; }
      setTenants((c) => c.map((t) => (t.id === tenant.id ? data : t)));
      showToast("success", `${tenant.name} atualizado.`);
    } catch { showToast("error", "Erro ao atualizar."); }
  }

  function setTenantDraft(tenantId: number, patch: Partial<ManagedTenant>) {
    setTenants((c) => c.map((t) => (t.id === tenantId ? { ...t, ...patch } : t)));
  }

  async function copyText(value: string, msg: string) {
    try { await navigator.clipboard.writeText(value); showToast("success", msg); }
    catch { showToast("error", "Não foi possível copiar."); }
  }

  const navItems: { id: Page; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: "dashboard", label: "Dashboard", icon: <LayoutDashboard size={18} /> },
    { id: "invites", label: "Convites", icon: <Link2 size={18} />, badge: stats?.pending_invites },
    { id: "tenants", label: "Clientes", icon: <Users size={18} />, badge: stats?.tenants },
    { id: "settings", label: "Configurações", icon: <Settings size={18} /> },
  ];

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
    <div className="flex min-h-screen bg-slate-50">
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
            className="fixed left-1/2 top-5 z-50 flex -translate-x-1/2 items-center gap-3 rounded-2xl border bg-white px-5 py-3.5 shadow-[0_8px_32px_rgba(0,0,0,0.12)] min-w-[300px] max-w-sm"
            style={{ borderColor: toast.type === "error" ? "#fecaca" : "#bbf7d0" }}
          >
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${toast.type === "error" ? "bg-red-100" : "bg-emerald-100"}`}>
              {toast.type === "error" ? <AlertCircle size={16} className="text-red-500" /> : <CheckCircle2 size={16} className="text-emerald-500" />}
            </span>
            <p className="flex-1 text-sm font-medium text-slate-800">{toast.message}</p>
            <button type="button" onClick={() => setToast(null)} className="text-slate-400 hover:text-slate-600"><X size={14} /></button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile sidebar overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-20 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-30 flex w-64 flex-col bg-[#0f172a] transition-transform duration-300 lg:static lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        {/* Logo */}
        <div className="flex items-center gap-3 border-b border-white/8 px-5 py-5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white shadow">
            <img src="/system/logo.png" alt="BoxSys" className="h-6 w-6 object-contain" />
          </div>
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#C9A227]">BoxSys Store</p>
            <p className="text-[10px] text-slate-500">Super Admin</p>
          </div>
        </div>

        {/* Stats mini */}
        <div className="grid grid-cols-2 gap-2 border-b border-white/8 p-4">
          {[
            { label: "Tenants", value: stats?.tenants ?? 0, color: "text-blue-400" },
            { label: "Ativos", value: stats?.active_accounts ?? 0, color: "text-emerald-400" },
            { label: "Trials", value: stats?.active_trials ?? 0, color: "text-amber-400" },
            { label: "Convites", value: stats?.pending_invites ?? 0, color: "text-purple-400" },
          ].map((s) => (
            <div key={s.label} className="rounded-xl bg-white/5 px-3 py-2.5">
              <p className={`text-lg font-black ${s.color}`}>{s.value}</p>
              <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1 p-3">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => { setPage(item.id); setSidebarOpen(false); }}
              className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-all ${
                page === item.id
                  ? "bg-[#C9A227] text-white shadow-[0_4px_16px_rgba(201,162,39,0.30)]"
                  : "text-slate-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              {item.icon}
              <span className="flex-1 text-left">{item.label}</span>
              {item.badge !== undefined && item.badge > 0 && (
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${page === item.id ? "bg-white/20 text-white" : "bg-white/10 text-slate-400"}`}>
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Logout */}
        <div className="border-t border-white/8 p-4">
          <button
            onClick={() => { clearSession(); navigate("/login", { replace: true }); }}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-slate-500 transition-all hover:bg-white/5 hover:text-red-400"
          >
            <LogOut size={16} />
            Sair do painel
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Topbar */}
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden rounded-lg p-2 text-slate-500 hover:bg-slate-100">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
            <div>
              <h1 className="text-base font-black text-slate-900">
                {navItems.find(n => n.id === page)?.label}
              </h1>
              <p className="text-[10px] text-slate-400 hidden sm:block">Painel de gerenciamento BoxSys</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => void loadOverview()} className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition-all hover:bg-slate-50">
              <RefreshCcw size={14} />
            </button>
            <span className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-600">
              <ShieldCheck size={11} className="text-[#C9A227]" />
              Super Admin
            </span>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
          <AnimatePresence mode="wait">

            {/* ── DASHBOARD ── */}
            {page === "dashboard" && (
              <motion.div key="dashboard" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                  {[
                    { label: "Tenants", value: stats?.tenants ?? 0, icon: <Store size={20} className="text-blue-500" />, color: "bg-blue-50 border-blue-100", change: "Total de lojas" },
                    { label: "Em Trial", value: stats?.active_trials ?? 0, icon: <Clock size={20} className="text-amber-500" />, color: "bg-amber-50 border-amber-100", change: "Período gratuito" },
                    { label: "Ativos", value: stats?.active_accounts ?? 0, icon: <BadgeCheck size={20} className="text-emerald-500" />, color: "bg-emerald-50 border-emerald-100", change: "Assinantes ativos" },
                    { label: "Convites", value: stats?.pending_invites ?? 0, icon: <Link2 size={20} className="text-purple-500" />, color: "bg-purple-50 border-purple-100", change: "Aguardando ativação" },
                  ].map((s) => (
                    <div key={s.label} className={`flex items-center gap-4 rounded-2xl border p-4 ${s.color}`}>
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/70">{s.icon}</div>
                      <div>
                        <p className="text-2xl font-black text-slate-900">{s.value}</p>
                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">{s.label}</p>
                        <p className="text-[9px] text-slate-400 mt-0.5">{s.change}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Quick actions */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <button onClick={() => setPage("invites")} className="flex items-center gap-4 rounded-2xl border border-[#C9A227]/20 bg-[#C9A227]/5 p-5 text-left transition-all hover:bg-[#C9A227]/10">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#C9A227]/15"><UserPlus2 size={22} className="text-[#C9A227]" /></div>
                    <div><p className="font-bold text-slate-900">Gerar Convite</p><p className="text-xs text-slate-500 mt-0.5">Criar novo link de ativação</p></div>
                    <ChevronRight size={16} className="ml-auto text-slate-400" />
                  </button>
                  <button onClick={() => setPage("tenants")} className="flex items-center gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-left transition-all hover:bg-emerald-100">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-100"><Users size={22} className="text-emerald-600" /></div>
                    <div><p className="font-bold text-slate-900">Ver Clientes</p><p className="text-xs text-slate-500 mt-0.5">{stats?.tenants ?? 0} lojas provisionadas</p></div>
                    <ChevronRight size={16} className="ml-auto text-slate-400" />
                  </button>
                  <button onClick={() => setPage("invites")} className="flex items-center gap-4 rounded-2xl border border-purple-200 bg-purple-50 p-5 text-left transition-all hover:bg-purple-100">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-purple-100"><Link2 size={22} className="text-purple-600" /></div>
                    <div><p className="font-bold text-slate-900">Links Gerados</p><p className="text-xs text-slate-500 mt-0.5">{sortedInvites.length} convites criados</p></div>
                    <ChevronRight size={16} className="ml-auto text-slate-400" />
                  </button>
                </div>

                {/* Recent tenants */}
                <div className="rounded-2xl border border-slate-200 bg-white p-6">
                  <div className="flex items-center justify-between mb-5">
                    <h2 className="font-black text-slate-900">Clientes Recentes</h2>
                    <button onClick={() => setPage("tenants")} className="text-[11px] font-bold uppercase tracking-wider text-[#C9A227] hover:underline">Ver todos</button>
                  </div>
                  {sortedTenants.length === 0 ? <EmptyState message="Nenhuma loja provisionada ainda" /> : (
                    <div className="space-y-3">
                      {sortedTenants.slice(0, 5).map((t) => (
                        <div key={t.id} className="flex items-center gap-4 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#C9A227]/10 text-[#C9A227] font-black text-sm">
                            {t.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-slate-900 truncate">{t.name}</p>
                            <p className="text-xs text-slate-400 truncate">{t.users?.[0]?.email}</p>
                          </div>
                          <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${
                            t.status === "active" ? "bg-emerald-50 text-emerald-600 border border-emerald-200" :
                            t.status === "trial" ? "bg-amber-50 text-amber-600 border border-amber-200" :
                            "bg-red-50 text-red-600 border border-red-200"
                          }`}>{t.status}</span>
                          <button onClick={() => void copyText(t.public_url || "", "URL copiada!")} className="text-slate-400 hover:text-slate-600"><Copy size={13} /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* ── INVITES ── */}
            {page === "invites" && (
              <motion.div key="invites" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
                <div className="grid gap-6 lg:grid-cols-2">
                  {/* Form */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="mb-6 flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#C9A227]/10">
                        <UserPlus2 size={18} className="text-[#C9A227]" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#C9A227]">Novo</p>
                        <h2 className="text-lg font-black text-slate-900">Gerar Convite</h2>
                      </div>
                    </div>
                    <form onSubmit={handleCreateInvite} className="space-y-4">
                      <InputField label="Nome da loja" value={form.storeName}
                        onChange={(v) => setForm((c) => ({ ...c, storeName: v, subdomain: normalizeSubdomain(v) }))}
                        placeholder="Ex: Vogan Store" icon={<Store size={14} />} />
                      <InputField label="Subdomínio" value={form.subdomain}
                        onChange={(v) => setForm((c) => ({ ...c, subdomain: normalizeSubdomain(v) }))}
                        placeholder="voganstore" icon={<Link2 size={14} />}
                        hint={form.subdomain ? `→ ${form.subdomain}.boxsys.com.br` : undefined} />
                      <div className="grid gap-4 sm:grid-cols-2">
                        <InputField label="WhatsApp" value={form.whatsapp}
                          onChange={(v) => setForm((c) => ({ ...c, whatsapp: maskPhone(v) }))}
                          placeholder="(00) 00000-0000"
                          icon={<Phone size={14} />} />
                        <InputField label="Responsável" value={form.ownerName}
                          onChange={(v) => setForm((c) => ({ ...c, ownerName: v }))}
                          placeholder="Nome do cliente" icon={<Users size={14} />} />
                      </div>
                      <InputField label="E-mail" value={form.ownerEmail}
                        onChange={(v) => setForm((c) => ({ ...c, ownerEmail: v }))}
                        placeholder="cliente@empresa.com.br" type="email" icon={<Mail size={14} />} />
                      <div className="grid gap-4 sm:grid-cols-2">
                        <InputField label="Trial (dias)" value={form.trialDays}
                          onChange={(v) => setForm((c) => ({ ...c, trialDays: v }))}
                          placeholder="30" type="number" icon={<CalendarClock size={14} />} />
                        <InputField label="Assinatura (R$)" value={form.subscriptionAmount}
                          onChange={(v) => setForm((c) => ({ ...c, subscriptionAmount: v }))}
                          placeholder="0,00" type="number" icon={<CreditCard size={14} />} />
                      </div>
                      <button type="submit" disabled={submitting}
                        className="mt-2 flex h-12 w-full items-center justify-center gap-2.5 rounded-xl bg-[#C9A227] text-sm font-bold text-white shadow-[0_4px_20px_rgba(201,162,39,0.35)] transition-all hover:bg-[#b8911f] active:scale-[0.98] disabled:opacity-60">
                        {submitting ? <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" /></svg> : <UserPlus2 size={16} />}
                        {submitting ? "Gerando..." : "Criar Convite"}
                      </button>
                    </form>
                  </div>

                  {/* List */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="mb-5 flex items-center justify-between">
                      <h2 className="font-black text-slate-900">Links Gerados <span className="ml-2 rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-600">{sortedInvites.length}</span></h2>
                      <button onClick={() => void loadOverview()} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"><RefreshCcw size={13} /></button>
                    </div>
                    <div className="max-h-[520px] space-y-3 overflow-y-auto pr-1">
                      {sortedInvites.length === 0 && <EmptyState message="Nenhum convite criado ainda" />}
                      {sortedInvites.map((invite) => (
                        <div key={invite.id} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="min-w-0">
                              <p className="font-bold text-slate-900 truncate">{invite.store_name}</p>
                              <p className="text-xs text-slate-400">{invite.subdomain}.boxsys.com.br</p>
                            </div>
                            <Badge status={invite.used_at ? "used" : invite.is_expired ? "expired" : "pending"} />
                          </div>
                          <div className="flex gap-3 text-xs text-slate-500 mb-3">
                            <span className="flex items-center gap-1"><CalendarClock size={11} /> {invite.trial_days}d trial</span>
                            <span className="flex items-center gap-1"><CreditCard size={11} /> R$ {invite.subscription_amount.toFixed(2)}/mês</span>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => void copyText(invite.invite_url, "Link copiado!")}
                              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-600 hover:bg-slate-50">
                              <Copy size={11} /> Copiar link
                            </button>
                            <button onClick={() => void handleRegenerateInvite(invite.id)}
                              className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-600 hover:bg-slate-50">
                              <RefreshCcw size={11} />
                            </button>
                            <a href={invite.invite_url} target="_blank" rel="noopener noreferrer"
                              className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-600 hover:bg-slate-50">
                              <ExternalLink size={11} />
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── TENANTS ── */}
            {page === "tenants" && (
              <motion.div key="tenants" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-black text-slate-900">Clientes Provisionados</h2>
                    <p className="text-sm text-slate-500">{sortedTenants.length} lojas registradas</p>
                  </div>
                  <button onClick={() => setPage("invites")}
                    className="flex items-center gap-2 rounded-xl bg-[#C9A227] px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-white shadow-[0_4px_16px_rgba(201,162,39,0.3)] hover:bg-[#b8911f]">
                    <UserPlus2 size={14} /> Nova loja
                  </button>
                </div>
                {sortedTenants.length === 0 ? <EmptyState message="Nenhuma conta provisionada" /> : (
                  <div className="grid gap-4 lg:grid-cols-2">
                    {sortedTenants.map((tenant) => (
                      <div key={tenant.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="flex items-start justify-between gap-3 mb-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#C9A227]/10 text-[#C9A227] font-black text-lg">
                              {tenant.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-bold text-slate-900">{tenant.name}</p>
                              <p className="text-xs text-slate-400">{tenant.users?.[0]?.email || "Sem usuário"}</p>
                              {tenant.whatsapp && <p className="text-xs text-slate-400 flex items-center gap-1"><Phone size={10} /> {tenant.whatsapp}</p>}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            {tenant.public_url && (
                              <a href={tenant.public_url} target="_blank" rel="noopener noreferrer"
                                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50">
                                <ExternalLink size={13} />
                              </a>
                            )}
                            <button onClick={() => void copyText(tenant.public_url || "", "URL copiada!")}
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50">
                              <Copy size={13} />
                            </button>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 mb-4 text-center">
                          <div className="rounded-lg bg-slate-50 border border-slate-100 p-2">
                            <p className="text-sm font-black text-slate-900">{tenant.trial_days ?? 30}</p>
                            <p className="text-[9px] text-slate-400 uppercase tracking-wide">dias trial</p>
                          </div>
                          <div className="rounded-lg bg-slate-50 border border-slate-100 p-2">
                            <p className="text-sm font-black text-slate-900">R${Number(tenant.subscription_amount || 0).toFixed(0)}</p>
                            <p className="text-[9px] text-slate-400 uppercase tracking-wide">assinatura</p>
                          </div>
                          <div className="rounded-lg bg-slate-50 border border-slate-100 p-2">
                            <p className={`text-sm font-black ${tenant.status === "active" ? "text-emerald-600" : tenant.status === "trial" ? "text-amber-600" : "text-red-600"}`}>
                              {tenant.status === "active" ? "Ativo" : tenant.status === "trial" ? "Trial" : "Suspenso"}
                            </p>
                            <p className="text-[9px] text-slate-400 uppercase tracking-wide">status</p>
                          </div>
                        </div>
                        <div className="mb-3">
                          <SelectField label="Status" value={tenant.status || "active"}
                            onChange={(v) => setTenantDraft(tenant.id, { status: v as ManagedTenant["status"] })}
                            options={[
                              { value: "active", label: "Ativo" },
                              { value: "trial", label: "Trial" },
                              { value: "suspended", label: "Suspenso" },
                            ]} />
                        </div>
                        <button onClick={() => void handleUpdateTenant(tenant)}
                          className="w-full h-10 rounded-xl bg-slate-900 text-[10px] font-bold uppercase tracking-[0.16em] text-white transition-colors hover:bg-slate-800">
                          Salvar alterações
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* ── SETTINGS ── */}
            {page === "settings" && (
              <motion.div key="settings" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h2 className="font-black text-slate-900 mb-4">Informações do Sistema</h2>
                  <div className="space-y-3">
                    {[
                      { label: "Versão", value: "1.0.0" },
                      { label: "Domínio", value: "boxsys.com.br" },
                      { label: "Painel principal", value: "store.boxsys.com.br" },
                      { label: "Total de lojas", value: String(stats?.tenants ?? 0) },
                      { label: "Lojas ativas", value: String(stats?.active_accounts ?? 0) },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                        <p className="text-sm font-semibold text-slate-600">{item.label}</p>
                        <p className="text-sm font-bold text-slate-900">{item.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h2 className="font-black text-slate-900 mb-4">Ações</h2>
                  <div className="space-y-3">
                    <button onClick={() => void loadOverview()}
                      className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                      <RefreshCcw size={16} className="text-slate-500" /> Recarregar dados
                    </button>
                    <button onClick={() => { clearSession(); navigate("/login", { replace: true }); }}
                      className="flex w-full items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600 hover:bg-red-100">
                      <LogOut size={16} /> Sair do painel
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
