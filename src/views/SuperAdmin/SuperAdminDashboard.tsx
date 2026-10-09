import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  CalendarClock, CreditCard, LogOut, RefreshCcw, ShieldCheck,
  Store, UserPlus2, Copy, Users, Link2, CheckCircle2, AlertCircle,
  X, LayoutDashboard, Settings, ChevronRight, Phone, Mail,
  ExternalLink, Clock, BadgeCheck, Pencil, Eye, EyeOff, PlusCircle,
  CalendarCheck, Activity, Timer, Search, TrendingUp, Crown, Wallet,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

import { clearSession, getStoredToken, getStoredUser } from "../../lib/session";
import type { ManagedTenant, SetupInvite, SubscriptionPlan } from "../../types";
import { Badge, EmptyState, SelectField } from "./components";
import PlansPage from "./PlansPage";
import { Button, IconButton } from "../../components/ui/Button";
import { Input, Select } from "../../components/ui/Input";
import { Modal, ModalFooter } from "../../components/ui/Modal";
import { Tabs } from "../../components/ui/Tabs";
import { Switch } from "../../components/ui/Switch";
import { Badge as UiBadge } from "../../components/ui/Badge";
import { StatGrid } from "../../components/ui/PageWrapper";
import { StatCard } from "../../components/ui/StatCard";
import { FilterLine, FilterLineSection, FilterLineItem, FilterLineSearch, FilterLineViewToggle } from "../../components/ui/FilterLine";
import BillingPage from "./BillingPage";

type OverviewResponse = {
  stats: { tenants: number; active_trials: number; active_accounts: number; pending_invites: number };
  tenants: ManagedTenant[];
  invites: SetupInvite[];
  plans: SubscriptionPlan[];
};
type Toast = { type: "success" | "error"; message: string };
const EDIT_TABS = [
  { id: "store", label: "Loja", icon: Store },
  { id: "modules", label: "Módulos", icon: Settings },
  { id: "user", label: "Usuário admin", icon: Users },
] as const;
type EditTab = typeof EDIT_TABS[number]["id"];

function tenantStatusBadge(status?: string) {
  const color = status === "active" ? "success" : status === "trial" ? "warning" : status === "suspended" ? "danger" : "default";
  const label = status === "active" ? "Ativo" : status === "trial" ? "Trial" : status === "suspended" ? "Suspenso" : (status || "—");
  return <UiBadge color={color} pill>{label}</UiBadge>;
}

type Page = "dashboard" | "invites" | "tenants" | "plans" | "billing" | "settings";

const PAGE_PATHS: Record<Page, string> = {
  dashboard: "/super-admin/dashboard",
  invites: "/super-admin/convites",
  tenants: "/super-admin/clientes",
  plans: "/super-admin/planos",
  billing: "/super-admin/financeiro",
  settings: "/super-admin/configuracoes",
};

function pageFromPath(pathname: string): Page {
  const segment = pathname.split("/").filter(Boolean)[1];
  if (segment === "convites") return "invites";
  if (segment === "clientes") return "tenants";
  if (segment === "planos") return "plans";
  if (segment === "financeiro") return "billing";
  if (segment === "configuracoes") return "settings";
  return "dashboard";
}

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

function buildTenantPreviewUrl(subdomain: string) {
  if (typeof window === "undefined" || !subdomain) return "";
  const { protocol, hostname, port } = window.location;
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname.endsWith(".localhost")) {
    return `${protocol}//${hostname}${port ? `:${port}` : ""}/s/${subdomain}`;
  }
  const parts = hostname.split(".");
  const rootDomain = parts.length > 2 ? parts.slice(-2).join(".") : hostname;
  return `${protocol}//${subdomain}.${rootDomain}`;
}

function InputField({ label, value, onChange, placeholder, type = "text", icon, hint }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder: string; type?: string; icon?: React.ReactNode; hint?: string;
}) {
  return (
    <Input
      label={label} type={type} value={value} onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder} required iconLeft={icon} hint={hint}
    />
  );
}

export default function SuperAdminDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const currentUser = useMemo(() => getStoredUser(), []);
  const page = pageFromPath(location.pathname);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [stats, setStats] = useState<OverviewResponse["stats"] | null>(null);
  const [tenants, setTenants] = useState<ManagedTenant[]>([]);
  const [invites, setInvites] = useState<SetupInvite[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [billingAlerts, setBillingAlerts] = useState(0);
  const [toast, setToast] = useState<Toast | null>(null);
  const [tenantSearch, setTenantSearch] = useState("");
  const [tenantStatus, setTenantStatus] = useState<"all" | ManagedTenant["status"]>("all");
  const [form, setForm] = useState({
    storeName: "", subdomain: "", whatsapp: "", ownerName: "",
    ownerEmail: "", trialDays: "30", subscriptionAmount: "0", planId: "",
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

  useEffect(() => {
    if (location.pathname === "/super-admin" || location.pathname === "/super-admin/") {
      navigate(PAGE_PATHS.dashboard, { replace: true });
    }
  }, [location.pathname, navigate]);

  function goToPage(nextPage: Page) {
    navigate(PAGE_PATHS[nextPage]);
    setSidebarOpen(false);
  }

  const sortedInvites = useMemo(() => [...invites].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)), [invites]);
  const sortedTenants = useMemo(() => [...tenants].sort((a, b) => +new Date(b.created_at as string) - +new Date(a.created_at as string)), [tenants]);
  const filteredTenants = useMemo(() => {
    const query = tenantSearch.trim().toLocaleLowerCase("pt-BR");
    return sortedTenants.filter((tenant) => {
      const matchesStatus = tenantStatus === "all" || tenant.status === tenantStatus;
      const matchesQuery = !query || [tenant.name, tenant.subdomain, tenant.whatsapp, tenant.users?.[0]?.name, tenant.users?.[0]?.email]
        .some((value) => String(value || "").toLocaleLowerCase("pt-BR").includes(query));
      return matchesStatus && matchesQuery;
    });
  }, [sortedTenants, tenantSearch, tenantStatus]);

  const monthlyRevenue = useMemo(() => tenants
    .filter((tenant) => tenant.status === "active")
    .reduce((total, tenant) => total + Number(tenant.subscription_amount || 0), 0), [tenants]);

  async function loadOverview() {
    setLoading(true);
    try {
      const res = await fetch("/api/super-admin/overview", { headers: apiHeaders() });
      const data = (await res.json()) as OverviewResponse & { error?: string };
      if (!res.ok) { showToast("error", data.error || "Falha ao carregar."); return; }
      setStats(data.stats); setTenants(data.tenants); setInvites(data.invites); setPlans(data.plans || []);
    } catch { showToast("error", "Não foi possível carregar o painel."); }
    finally { setLoading(false); }
  }

  // Badge de aviso no menu "Financeiro" — quantas lojas estão em atraso ou já suspensas
  // por inadimplência. Rota própria (não o /overview geral) pra não pesar a carga inicial.
  useEffect(() => {
    fetch("/api/super-admin/billing/overview", { headers: apiHeaders() })
      .then((r) => r.json())
      .then((data: { summary?: { overdue: number; suspended: number } }) => {
        if (data?.summary) setBillingAlerts(data.summary.overdue + data.summary.suspended);
      })
      .catch(() => {});
  }, []);

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
          planId: form.planId ? Number(form.planId) : null,
        }),
      });
      const data = (await res.json()) as SetupInvite & { error?: string };
      if (!res.ok) { showToast("error", data.error || "Não foi possível gerar o convite."); return; }
      setInvites((c) => [data, ...c]);
      setStats((c) => c ? { ...c, pending_invites: c.pending_invites + 1 } : c);
      showToast("success", "Convite criado com sucesso!");
      setForm((c) => ({ ...c, storeName: "", subdomain: "", whatsapp: "", ownerName: "", ownerEmail: "" }));
      goToPage("invites");
    } catch { showToast("error", "Erro ao gerar o convite."); }
    finally { setSubmitting(false); }
  }

  const [inviteAmountDraft, setInviteAmountDraft] = useState<Record<number, string>>({});
  const [savingInviteId, setSavingInviteId] = useState<number | null>(null);

  async function handleUpdateInviteAmount(invite: SetupInvite) {
    const raw = inviteAmountDraft[invite.id];
    const amount = raw !== undefined ? Number(raw) : invite.subscription_amount;
    if (Number.isNaN(amount) || amount < 0) { showToast("error", "Valor inválido."); return; }
    setSavingInviteId(invite.id);
    try {
      const res = await fetch(`/api/super-admin/invites/${invite.id}`, {
        method: "PATCH", headers: apiHeaders(),
        body: JSON.stringify({ subscriptionAmount: amount }),
      });
      const data = (await res.json()) as SetupInvite & { error?: string };
      if (!res.ok) { showToast("error", data.error || "Não foi possível atualizar o convite."); return; }
      setInvites((c) => c.map((i) => (i.id === invite.id ? data : i)));
      setInviteAmountDraft((c) => { const n = { ...c }; delete n[invite.id]; return n; });
      showToast("success", "Valor da assinatura atualizado.");
    } catch { showToast("error", "Erro ao atualizar o convite."); }
    finally { setSavingInviteId(null); }
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

  // ── Edit tenant modal ────────────────────────────────────────────────
  type EditForm = {
    tenantName: string; whatsapp: string;
    userName: string; userEmail: string; userPassword: string;
    fluxoProducaoEnabled: boolean;
    graficaEnabled: boolean;
  };
  const [editingTenant, setEditingTenant] = useState<ManagedTenant | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ tenantName: "", whatsapp: "", userName: "", userEmail: "", userPassword: "", fluxoProducaoEnabled: false, graficaEnabled: false });
  const [editSaving, setEditSaving] = useState(false);
  const [showEditPwd, setShowEditPwd] = useState(false);
  const [editTab, setEditTab] = useState<EditTab>("store");

  function openEdit(tenant: ManagedTenant) {
    setEditTab("store");
    const user = tenant.users?.[0];
    setEditForm({
      tenantName: tenant.name,
      whatsapp: tenant.whatsapp || "",
      userName: user?.name || "",
      userEmail: user?.email || "",
      userPassword: "",
      fluxoProducaoEnabled: !!tenant.fluxo_producao_enabled,
      graficaEnabled: !!tenant.grafica_enabled,
    });
    setShowEditPwd(false);
    setEditingTenant(tenant);
  }

  async function handleSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editingTenant) return;
    setEditSaving(true);
    try {
      // 1. Update tenant (name + whatsapp + módulos habilitados)
      const tRes = await fetch(`/api/super-admin/tenants/${editingTenant.id}`, {
        method: "PATCH", headers: apiHeaders(),
        body: JSON.stringify({ name: editForm.tenantName, whatsapp: editForm.whatsapp, fluxoProducaoEnabled: editForm.fluxoProducaoEnabled, graficaEnabled: editForm.graficaEnabled }),
      });
      const tData = (await tRes.json()) as ManagedTenant & { error?: string };
      if (!tRes.ok) { showToast("error", tData.error || "Erro ao salvar loja."); return; }

      // 2. Update user (name, email, password) if user exists
      const user = editingTenant.users?.[0];
      if (user) {
        const uBody: Record<string, string> = { name: editForm.userName, email: editForm.userEmail };
        if (editForm.userPassword.trim()) uBody.password = editForm.userPassword;
        const uRes = await fetch(`/api/super-admin/tenants/${editingTenant.id}/users/${user.id}`, {
          method: "PATCH", headers: apiHeaders(),
          body: JSON.stringify(uBody),
        });
        const uData = (await uRes.json()) as { error?: string };
        if (!uRes.ok) { showToast("error", uData.error || "Erro ao salvar usuário."); return; }
        // Patch user in tenant data
        tData.users = [{ ...user, name: editForm.userName, email: editForm.userEmail }];
      }

      setTenants((c) => c.map((t) => (t.id === editingTenant.id ? { ...t, ...tData } : t)));
      showToast("success", "Cliente atualizado com sucesso!");
      setEditingTenant(null);
    } catch { showToast("error", "Erro ao salvar alterações."); }
    finally { setEditSaving(false); }
  }

  async function copyText(value: string, msg: string) {
    try { await navigator.clipboard.writeText(value); showToast("success", msg); }
    catch { showToast("error", "Não foi possível copiar."); }
  }

  // ── Tenants view mode (list = compacto / card = detalhado) ───────────
  const [tenantsView, setTenantsView] = useState<"list" | "card">("list");

  // ── Extend trial ─────────────────────────────────────────────────────
  const [extendingId, setExtendingId] = useState<number | null>(null);
  const [extraDays, setExtraDays] = useState<Record<number, string>>({});

  async function handleExtendTrial(tenant: ManagedTenant) {
    const days = Number(extraDays[tenant.id] || 0);
    if (!days || days < 1) { showToast("error", "Informe quantos dias adicionar."); return; }
    setExtendingId(tenant.id);
    try {
      const currentEnd = tenant.trial_ends_at ? new Date(tenant.trial_ends_at) : new Date();
      const base = currentEnd > new Date() ? currentEnd : new Date();
      const newEnd = new Date(base);
      newEnd.setDate(newEnd.getDate() + days);
      const res = await fetch(`/api/super-admin/tenants/${tenant.id}`, {
        method: "PATCH", headers: apiHeaders(),
        body: JSON.stringify({ trialEndsAt: newEnd.toISOString() }),
      });
      const data = (await res.json()) as ManagedTenant & { error?: string };
      if (!res.ok) { showToast("error", data.error || "Erro ao estender trial."); return; }
      setTenants((c) => c.map((t) => (t.id === tenant.id ? data : t)));
      setExtraDays((c) => ({ ...c, [tenant.id]: "" }));
      showToast("success", `+${days} dias adicionados ao trial de ${tenant.name}.`);
    } catch { showToast("error", "Erro ao estender trial."); }
    finally { setExtendingId(null); }
  }

  const navItems: { id: Page; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: "dashboard", label: "Dashboard", icon: <LayoutDashboard size={18} /> },
    { id: "invites", label: "Convites", icon: <Link2 size={18} />, badge: stats?.pending_invites },
    { id: "tenants", label: "Clientes", icon: <Users size={18} />, badge: stats?.tenants },
    { id: "plans", label: "Planos e assinaturas", icon: <Crown size={18} />, badge: plans.filter((plan) => plan.is_active).length },
    { id: "billing", label: "Financeiro", icon: <Wallet size={18} />, badge: billingAlerts || undefined },
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
    <div className="flex h-screen overflow-hidden bg-[#f6f8fc]">
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
            className="fixed left-1/2 top-5 z-50 flex -translate-x-1/2 items-center gap-3 rounded-lg border bg-white px-5 py-3.5 shadow-[0_8px_32px_rgba(0,0,0,0.12)] min-w-[300px] max-w-sm"
            style={{ borderColor: toast.type === "error" ? "#fecaca" : "#bbf7d0" }}
          >
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${toast.type === "error" ? "bg-red-100" : "bg-emerald-100"}`}>
              {toast.type === "error" ? <AlertCircle size={16} className="text-red-500" /> : <CheckCircle2 size={16} className="text-emerald-500" />}
            </span>
            <p className="flex-1 text-sm font-medium text-slate-800">{toast.message}</p>
            <IconButton size="xs" aria-label="Fechar aviso" onClick={() => setToast(null)}><X size={14} /></IconButton>
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
      <aside className={`fixed inset-y-0 left-0 z-30 flex h-screen w-[280px] shrink-0 flex-col overflow-y-auto bg-[#0b1324] shadow-sm transition-transform duration-300 lg:static lg:translate-x-0 lg:shadow-none ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        {/* Logo */}
        <div className="flex h-[88px] items-center justify-between border-b border-white/8 px-6">
          <img src="/system/logo-boxsys-vazado.png" alt="BoxSys" className="h-9 w-auto object-contain" />
          <button onClick={() => setSidebarOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-slate-400 hover:bg-white/10 lg:hidden"><X size={15} /></button>
        </div>

        <div className="mx-4 mt-5 rounded-lg border border-blue-400/15 bg-gradient-to-br from-blue-500/15 to-cyan-400/5 p-4">
          <div className="flex items-center gap-2 text-blue-300"><ShieldCheck size={14} /><span className="text-[11px] font-semibold">Central SaaS</span></div>
          <p className="mt-2 text-xs leading-5 text-slate-400">Gerencie clientes, planos e receita da plataforma.</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1.5 p-4 pt-6">
          <p className="px-3 pb-2 text-[10px] font-semibold text-slate-600">Navegação</p>
          {navItems.map((item) => {
            const active = page === item.id;
            return (
              <button
                key={item.id}
                onClick={() => goToPage(item.id)}
                className={`group relative flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm font-semibold transition-all ${
                  active
                    ? "bg-blue-600 text-white shadow-[0_8px_24px_rgba(37,99,235,0.28)]"
                    : "text-slate-400 hover:bg-white/[0.06] hover:text-white"
                }`}
              >
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ${
                  active ? "bg-white/15" : "bg-white/[0.04] group-hover:bg-white/10"
                }`}>
                  {item.icon}
                </span>
                <span className="flex-1 text-left">{item.label}</span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${active ? "bg-white/20 text-white" : "bg-white/10 text-slate-400"}`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* User + Logout */}
        <div className="border-t border-white/8 p-3">
          <div className="flex items-center gap-3 rounded-lg px-3 py-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-500/15 text-xs font-semibold text-blue-400">
              {(currentUser?.name || "SA").charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-white">{currentUser?.name || "Super Admin"}</p>
              <p className="truncate text-[11px] text-slate-500">{currentUser?.email || ""}</p>
            </div>
          </div>
          <button
            onClick={() => { clearSession(); navigate("/login", { replace: true }); }}
            className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-500 transition-all hover:bg-white/5 hover:text-red-400"
          >
            <LogOut size={16} />
            Sair do painel
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {/* Topbar */}
        <header className="relative z-10 flex h-[72px] shrink-0 items-center justify-between border-b border-slate-200/80 bg-white/95 px-4 backdrop-blur sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden rounded-lg p-2 text-slate-500 hover:bg-slate-100">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
            <div>
              <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-400">
                <span>Super Admin</span><ChevronRight size={10} /><span className="text-blue-600">{navItems.find(n => n.id === page)?.label}</span>
              </div>
              <h1 className="mt-0.5 text-lg font-semibold text-slate-900">
                {navItems.find(n => n.id === page)?.label}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <IconButton variant="outline" aria-label="Recarregar dados" onClick={() => void loadOverview()}><RefreshCcw size={14} /></IconButton>
            <span className="hidden items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-semibold text-slate-600 sm:flex">
              <ShieldCheck size={11} className="text-[#C9A227]" />
              Super Admin
            </span>
          </div>
        </header>

        {/* Content */}
        <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6 lg:p-8">
          <div className="mx-auto w-full max-w-[1600px]">
          <AnimatePresence mode="wait">

            {/* ── DASHBOARD ── */}
            {page === "dashboard" && (
              <motion.div key="dashboard" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
                <StatGrid cols={4} className="xl:grid-cols-5">
                  <StatCard title="Tenants" value={stats?.tenants ?? 0} icon={Store} color="info" description="Total de lojas" />
                  <StatCard title="Em Trial" value={stats?.active_trials ?? 0} icon={Clock} color="warning" description="Período gratuito" />
                  <StatCard title="Ativos" value={stats?.active_accounts ?? 0} icon={BadgeCheck} color="success" description="Assinantes ativos" />
                  <StatCard title="Convites" value={stats?.pending_invites ?? 0} icon={Link2} color="purple" description="Aguardando ativação" />
                  <StatCard title="Receita mensal" value={monthlyRevenue.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })} icon={TrendingUp} color="info" description="Contas ativas" />
                </StatGrid>

                {/* Quick actions */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <button onClick={() => goToPage("invites")} className="flex items-center gap-4 rounded-lg border border-[#C9A227]/20 bg-[#C9A227]/5 p-5 text-left transition-all hover:bg-[#C9A227]/10">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#C9A227]/15"><UserPlus2 size={22} className="text-[#C9A227]" /></div>
                    <div><p className="font-semibold text-slate-900">Gerar Convite</p><p className="text-xs text-slate-500 mt-0.5">Criar novo link de ativação</p></div>
                    <ChevronRight size={16} className="ml-auto text-slate-400" />
                  </button>
                  <button onClick={() => goToPage("tenants")} className="flex items-center gap-4 rounded-lg border border-emerald-200 bg-emerald-50 p-5 text-left transition-all hover:bg-emerald-100">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-emerald-100"><Users size={22} className="text-emerald-600" /></div>
                    <div><p className="font-semibold text-slate-900">Ver Clientes</p><p className="text-xs text-slate-500 mt-0.5">{stats?.tenants ?? 0} lojas provisionadas</p></div>
                    <ChevronRight size={16} className="ml-auto text-slate-400" />
                  </button>
                  <button onClick={() => goToPage("invites")} className="flex items-center gap-4 rounded-lg border border-purple-200 bg-purple-50 p-5 text-left transition-all hover:bg-purple-100">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-purple-100"><Link2 size={22} className="text-purple-600" /></div>
                    <div><p className="font-semibold text-slate-900">Links Gerados</p><p className="text-xs text-slate-500 mt-0.5">{sortedInvites.length} convites criados</p></div>
                    <ChevronRight size={16} className="ml-auto text-slate-400" />
                  </button>
                </div>

                {/* Recent tenants */}
                <div className="rounded-lg border border-slate-200 bg-white p-6">
                  <div className="flex items-center justify-between mb-5">
                    <h2 className="font-semibold text-slate-900">Clientes Recentes</h2>
                    <Button variant="ghost" size="xs" onClick={() => goToPage("tenants")}>Ver todos</Button>
                  </div>
                  {sortedTenants.length === 0 ? <EmptyState message="Nenhuma loja provisionada ainda" /> : (
                    <div className="space-y-3">
                      {sortedTenants.slice(0, 5).map((t) => (
                        <div key={t.id} className="flex items-center gap-4 rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#C9A227]/10 text-[#C9A227] font-semibold text-sm">
                            {t.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-slate-900 truncate">{t.name}</p>
                            <p className="text-xs text-slate-400 truncate">{t.users?.[0]?.email}</p>
                          </div>
                          {tenantStatusBadge(t.status)}
                          <IconButton size="xs" aria-label="Copiar URL" onClick={() => void copyText(t.public_url || "", "URL copiada!")}><Copy size={13} /></IconButton>
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
                  <div className="rounded-lg border border-slate-200 bg-white p-6">
                    <div className="mb-6 flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#C9A227]/10">
                        <UserPlus2 size={18} className="text-[#C9A227]" />
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold text-[#C9A227]">Novo</p>
                        <h2 className="text-lg font-semibold text-slate-900">Gerar Convite</h2>
                      </div>
                    </div>
                    <form onSubmit={handleCreateInvite} className="space-y-4">
                      <InputField label="Nome da loja" value={form.storeName}
                        onChange={(v) => setForm((c) => ({ ...c, storeName: v, subdomain: normalizeSubdomain(v) }))}
                        placeholder="Ex: Vogan Store" icon={<Store size={14} />} />
                      <InputField label="Subdomínio" value={form.subdomain}
                        onChange={(v) => setForm((c) => ({ ...c, subdomain: normalizeSubdomain(v) }))}
                        placeholder="voganstore" icon={<Link2 size={14} />}
                        hint={form.subdomain ? `→ ${buildTenantPreviewUrl(form.subdomain)}` : undefined} />
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
                      <Select label="Plano da assinatura"
                          value={form.planId}
                          onChange={(event) => {
                            const selected = plans.find((plan) => plan.id === Number(event.target.value));
                            setForm((current) => ({ ...current, planId: event.target.value,
                              subscriptionAmount: selected ? String(selected.price) : current.subscriptionAmount,
                              trialDays: selected ? String(selected.trial_days) : current.trialDays }));
                          }}
                          >
                          <option value="">Personalizado / sem plano</option>
                          {plans.filter((plan) => plan.is_active).map((plan) => (
                            <option key={plan.id} value={plan.id}>{plan.name} — R$ {Number(plan.price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</option>
                          ))}
                        </Select>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <InputField label="Trial (dias)" value={form.trialDays}
                          onChange={(v) => setForm((c) => ({ ...c, trialDays: v }))}
                          placeholder="30" type="number" icon={<CalendarClock size={14} />} />
                        <InputField label="Assinatura (R$)" value={form.subscriptionAmount}
                          onChange={(v) => setForm((c) => ({ ...c, subscriptionAmount: v }))}
                          placeholder="0,00" type="number" icon={<CreditCard size={14} />} />
                      </div>
                      <Button type="submit" size="lg" fullWidth loading={submitting} iconLeft={<UserPlus2 size={16} />} className="mt-2">
                        {submitting ? "Gerando..." : "Criar Convite"}
                      </Button>
                    </form>
                  </div>

                  {/* List */}
                  <div className="rounded-lg border border-slate-200 bg-white p-6">
                    <div className="mb-5 flex items-center justify-between">
                      <h2 className="font-semibold text-slate-900">Links Gerados <span className="ml-2 rounded-full bg-purple-100 px-2 py-0.5 text-[11px] font-semibold text-purple-600">{sortedInvites.length}</span></h2>
                      <IconButton variant="outline" size="sm" aria-label="Recarregar convites" onClick={() => void loadOverview()}><RefreshCcw size={13} /></IconButton>
                    </div>
                    <div className="max-h-[520px] space-y-3 overflow-y-auto pr-1">
                      {sortedInvites.length === 0 && <EmptyState message="Nenhum convite criado ainda" />}
                      {sortedInvites.map((invite) => (
                        <div key={invite.id} className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-900 truncate">{invite.store_name}</p>
                              <p className="truncate text-xs text-slate-400">{invite.access_url || buildTenantPreviewUrl(invite.subdomain)}</p>
                            </div>
                            <Badge status={invite.used_at ? "used" : invite.is_expired ? "expired" : "pending"} />
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mb-3">
                            <span className="flex items-center gap-1"><CalendarClock size={11} /> {invite.trial_days}d trial</span>
                            <div className="flex items-center gap-1.5">
                              <CreditCard size={11} />
                              <span>R$</span>
                              <Input
                                type="number" min="0" step="0.01" size="sm"
                                aria-label="Valor da assinatura do convite"
                                disabled={!!invite.used_at}
                                value={inviteAmountDraft[invite.id] ?? invite.subscription_amount}
                                onChange={(e) => setInviteAmountDraft((c) => ({ ...c, [invite.id]: e.target.value }))}
                                wrapperClassName="w-20"
                              />
                              <span>/mês</span>
                              {inviteAmountDraft[invite.id] !== undefined && Number(inviteAmountDraft[invite.id]) !== invite.subscription_amount && (
                                <Button
                                  variant="success" size="xs"
                                  onClick={() => void handleUpdateInviteAmount(invite)}
                                  loading={savingInviteId === invite.id}
                                >
                                  Salvar
                                </Button>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" className="flex-1" iconLeft={<Copy size={11} />} onClick={() => void copyText(invite.invite_url, "Link copiado!")}>
                              Copiar link
                            </Button>
                            <IconButton variant="outline" size="sm" aria-label="Gerar novo link" onClick={() => void handleRegenerateInvite(invite.id)}>
                              <RefreshCcw size={11} />
                            </IconButton>
                            <a href={invite.invite_url} target="_blank" rel="noopener noreferrer" aria-label="Abrir convite"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-blue-600 bg-white text-blue-600 hover:bg-blue-50">
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
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-base font-medium text-slate-900 sm:text-lg">Clientes Provisionados</h2>
                    <p className="text-xs text-slate-500">{filteredTenants.length} de {sortedTenants.length} lojas</p>
                  </div>
                  <Button iconLeft={<UserPlus2 size={14} />} onClick={() => goToPage("invites")}>Nova loja</Button>
                </div>
                <FilterLine>
                  <FilterLineSection grow>
                    <FilterLineItem grow minWidth={220}>
                      <FilterLineSearch value={tenantSearch} onChange={setTenantSearch} placeholder="Buscar loja, domínio ou e-mail" aria-label="Buscar loja, domínio ou e-mail" />
                    </FilterLineItem>
                    <FilterLineItem minWidth={170}>
                      <Select
                        size="sm"
                        aria-label="Filtrar por status"
                        value={tenantStatus}
                        onChange={(event) => setTenantStatus(event.target.value as typeof tenantStatus)}
                        options={[
                          { value: "all", label: "Todos os status" },
                          { value: "active", label: "Ativos" },
                          { value: "trial", label: "Em trial" },
                          { value: "suspended", label: "Suspensos" },
                        ]}
                      />
                    </FilterLineItem>
                  </FilterLineSection>
                  <FilterLineSection align="right">
                    <FilterLineViewToggle value={tenantsView} onChange={(v) => setTenantsView(v as typeof tenantsView)} gridValue="card" listValue="list" />
                  </FilterLineSection>
                </FilterLine>
                {filteredTenants.length === 0 ? <EmptyState message={sortedTenants.length === 0 ? "Nenhuma conta provisionada" : "Nenhum cliente encontrado com esses filtros"} /> : (
                  <div className={tenantsView === "card" ? "grid gap-4 lg:grid-cols-2" : "space-y-2"}>
                    {filteredTenants.map((tenant) => {
                      const now = new Date();
                      const createdAt = tenant.created_at ? new Date(tenant.created_at) : null;
                      const trialStart = tenant.trial_starts_at ? new Date(tenant.trial_starts_at) : createdAt;
                      const trialEnd = tenant.trial_ends_at ? new Date(tenant.trial_ends_at) : null;
                      const setupAt = tenant.setup_completed_at ? new Date(tenant.setup_completed_at) : null;

                      // days active (since setup or creation)
                      const activeSince = setupAt || createdAt;
                      const daysActive = activeSince ? Math.max(0, Math.floor((now.getTime() - activeSince.getTime()) / 86400000)) : null;

                      // trial info
                      const trialTotal = trialEnd && trialStart ? Math.max(1, Math.ceil((trialEnd.getTime() - trialStart.getTime()) / 86400000)) : (tenant.trial_days ?? 30);
                      const trialRemaining = trialEnd ? Math.ceil((trialEnd.getTime() - now.getTime()) / 86400000) : null;
                      const trialPct = trialEnd && trialStart
                        ? Math.min(100, Math.max(0, Math.round(((now.getTime() - trialStart.getTime()) / (trialEnd.getTime() - trialStart.getTime())) * 100)))
                        : (tenant.status === "active" ? 100 : 0);
                      const trialExpired = trialEnd ? trialEnd < now : false;

                      const fmtDate = (d: Date | null) => d ? d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";

                      const statusColor = tenant.status === "active"
                        ? { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", bar: "bg-emerald-400" }
                        : tenant.status === "trial"
                        ? { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", bar: trialRemaining !== null && trialRemaining <= 5 ? "bg-red-400" : "bg-amber-400" }
                        : { bg: "bg-red-50", border: "border-red-200", text: "text-red-700", bar: "bg-red-400" };

                      const statusLabel = tenant.status === "active" ? "Ativo" : tenant.status === "trial" ? "Trial" : tenant.status === "suspended" ? "Suspenso" : tenant.status;

                      // ── List view: linha compacta, ideal para mobile ──
                      if (tenantsView === "list") {
                        return (
                          <div key={tenant.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-slate-200 bg-white px-4 py-3">
                            <div className="flex items-center gap-3 min-w-0 basis-full sm:basis-auto sm:flex-1">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#C9A227]/10 text-[#C9A227] font-semibold text-sm">
                                {tenant.name.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="font-semibold text-slate-900 truncate text-sm">{tenant.name}</p>
                                <p className="text-[11px] text-slate-400 truncate">{tenant.users?.[0]?.email || "Sem usuário"}</p>
                              </div>
                            </div>

                            {tenantStatusBadge(tenant.status)}

                            <div className="flex items-center gap-1 shrink-0">
                              <span className="text-[11px] font-semibold text-slate-400">R$</span>
                              <Input
                                type="number" min="0" step="0.01" size="sm"
                                aria-label={`Assinatura mensal de ${tenant.name}`}
                                value={tenant.subscription_amount ?? 0}
                                onChange={(e) => setTenantDraft(tenant.id, { subscription_amount: Number(e.target.value) })}
                                wrapperClassName="w-20"
                              />
                              <span className="text-[11px] text-slate-400">/mês</span>
                            </div>

                            <span className={`text-[11px] font-semibold whitespace-nowrap shrink-0 ${trialExpired ? "text-red-500" : trialRemaining !== null && trialRemaining <= 5 ? "text-orange-500" : "text-slate-500"}`}>
                              {trialEnd ? (trialExpired ? "Trial vencido" : `${trialRemaining}d trial`) : "—"}
                            </span>

                            <span className="hidden sm:inline text-[11px] text-slate-400 whitespace-nowrap shrink-0">
                              {daysActive !== null ? `${daysActive}d ativo` : "—"}
                            </span>

                            <div className="flex items-center gap-1 ml-auto shrink-0">
                              <IconButton variant="success" size="sm" aria-label="Salvar alterações" title="Salvar alterações" onClick={() => void handleUpdateTenant(tenant)}>
                                <CheckCircle2 size={13} />
                              </IconButton>
                              {tenant.public_url && (
                                <a href={tenant.public_url} target="_blank" rel="noopener noreferrer" aria-label="Abrir loja"
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-blue-600 bg-white text-blue-600 hover:bg-blue-50">
                                  <ExternalLink size={13} />
                                </a>
                              )}
                              <IconButton variant="outline" size="sm" aria-label="Copiar URL" onClick={() => void copyText(tenant.public_url || "", "URL copiada!")}>
                                <Copy size={13} />
                              </IconButton>
                              <IconButton variant="outline" size="sm" aria-label="Editar cliente" onClick={() => openEdit(tenant)}>
                                <Pencil size={13} />
                              </IconButton>
                            </div>
                          </div>
                        );
                      }

                      // ── Card view: detalhado, com bloco de trial e extensão ──
                      return (
                        <div key={tenant.id} className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                          {/* Header */}
                          <div className={`flex items-start justify-between gap-3 px-5 py-4 ${statusColor.bg} border-b ${statusColor.border}`}>
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white/80 shadow-sm text-[#C9A227] font-semibold text-lg border border-white">
                                {tenant.name.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="font-semibold text-slate-900 truncate">{tenant.name}</p>
                                <p className="text-xs text-slate-500 truncate">{tenant.users?.[0]?.email || "Sem usuário"}</p>
                                {tenant.whatsapp && (
                                  <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                                    <Phone size={10} /> {tenant.whatsapp}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {tenantStatusBadge(tenant.status)}
                              {tenant.public_url && (
                                <a href={tenant.public_url} target="_blank" rel="noopener noreferrer" aria-label="Abrir loja"
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-blue-600 bg-white text-blue-600 hover:bg-blue-50">
                                  <ExternalLink size={13} />
                                </a>
                              )}
                              <IconButton variant="outline" size="sm" aria-label="Copiar URL" onClick={() => void copyText(tenant.public_url || "", "URL copiada!")}>
                                <Copy size={13} />
                              </IconButton>
                              <IconButton variant="outline" size="sm" aria-label="Editar cliente" onClick={() => openEdit(tenant)}>
                                <Pencil size={13} />
                              </IconButton>
                            </div>
                          </div>

                          <div className="px-5 py-4 space-y-4">
                            {/* Stats row */}
                            <div className="grid grid-cols-3 gap-2 text-center">
                              <div className="rounded-lg bg-slate-50 border border-slate-100 p-2.5">
                                <div className="flex items-center justify-center gap-1 mb-0.5">
                                  <Activity size={11} className="text-blue-400" />
                                </div>
                                <p className="text-base font-semibold text-slate-900">{daysActive !== null ? daysActive : "—"}</p>
                                <p className="text-[10px] text-slate-400">dias ativo</p>
                              </div>
                              <div className="rounded-lg bg-slate-50 border border-slate-100 p-2.5">
                                <div className="flex items-center justify-center gap-1 mb-0.5">
                                  <CreditCard size={11} className="text-emerald-400" />
                                </div>
                                <Input
                                  type="number" min="0" step="0.01" size="sm"
                                  aria-label={`Assinatura mensal de ${tenant.name}`}
                                  addonLeft="R$"
                                  value={tenant.subscription_amount ?? 0}
                                  onChange={(e) => setTenantDraft(tenant.id, { subscription_amount: Number(e.target.value) })}
                                  className="text-center"
                                />
                                <p className="text-[10px] text-slate-400">assinatura/mês</p>
                              </div>
                              <div className="rounded-lg bg-slate-50 border border-slate-100 p-2.5">
                                <div className="flex items-center justify-center gap-1 mb-0.5">
                                  <CalendarCheck size={11} className="text-purple-400" />
                                </div>
                                <p className="text-base font-semibold text-slate-900">{fmtDate(createdAt)}</p>
                                <p className="text-[10px] text-slate-400">criado em</p>
                              </div>
                            </div>

                            {/* Trial block */}
                            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 space-y-2.5">
                              <div className="flex items-center justify-between">
                                <span className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
                                  <Timer size={12} /> Período Trial
                                </span>
                                {trialEnd ? (
                                  <span className={`text-[11px] font-semibold ${trialExpired ? "text-red-500" : trialRemaining !== null && trialRemaining <= 5 ? "text-orange-500" : "text-slate-600"}`}>
                                    {trialExpired ? "Vencido" : trialRemaining === 0 ? "Vence hoje" : `${trialRemaining}d restantes`}
                                  </span>
                                ) : (
                                  <span className="text-[11px] text-slate-400">Sem data</span>
                                )}
                              </div>

                              {/* Progress bar */}
                              <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${statusColor.bar}`}
                                  style={{ width: `${trialPct}%` }}
                                />
                              </div>

                              <div className="grid grid-cols-2 gap-x-4 text-[11px] text-slate-500">
                                <span className="flex items-center gap-1">
                                  <Clock size={9} />
                                  Início: {fmtDate(trialStart)}
                                </span>
                                <span className="flex items-center gap-1">
                                  <CalendarClock size={9} />
                                  Vence: {fmtDate(trialEnd)}
                                </span>
                              </div>

                              {/* Add days */}
                              <div className="flex items-center gap-2 pt-0.5">
                                <Input
                                  type="number" min="1" max="365" size="sm"
                                  aria-label="Dias adicionais de trial"
                                  value={extraDays[tenant.id] || ""}
                                  onChange={(e) => setExtraDays((c) => ({ ...c, [tenant.id]: e.target.value }))}
                                  placeholder="+ dias"
                                  wrapperClassName="w-24"
                                />
                                <Button
                                  variant="outline" size="sm" className="flex-1"
                                  iconLeft={<PlusCircle size={11} />}
                                  onClick={() => void handleExtendTrial(tenant)}
                                  loading={extendingId === tenant.id}
                                >
                                  Adicionar dias
                                </Button>
                              </div>
                            </div>

                            {/* Status + save */}
                            <div className="flex items-end gap-2">
                              <div className="flex-1">
                                <SelectField label="Status" value={tenant.status || "active"}
                                  onChange={(v) => setTenantDraft(tenant.id, { status: v as ManagedTenant["status"] })}
                                  options={[
                                    { value: "active", label: "Ativo" },
                                    { value: "trial", label: "Trial" },
                                    { value: "suspended", label: "Suspenso" },
                                  ]} />
                              </div>
                              <Button onClick={() => void handleUpdateTenant(tenant)}>Salvar</Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}

            {/* ── PLANS & SUBSCRIPTIONS ── */}
            {page === "plans" && (
              <PlansPage
                plans={plans}
                tenants={sortedTenants}
                onPlansChange={setPlans}
                onTenantChange={(updated) => setTenants((current) => current.map((tenant) => tenant.id === updated.id ? updated : tenant))}
                notify={showToast}
              />
            )}

            {/* ── BILLING (ASSINATURAS ASAAS) ── */}
            {page === "billing" && (
              <BillingPage tenants={sortedTenants} notify={showToast} />
            )}

            {/* ── SETTINGS ── */}
            {page === "settings" && (
              <motion.div key="settings" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
                <div className="rounded-lg border border-slate-200 bg-white p-6">
                  <h2 className="font-semibold text-slate-900 mb-4">Informações do Sistema</h2>
                  <div className="space-y-3">
                    {[
                      { label: "Versão", value: "1.0.0" },
                      { label: "Ambiente", value: window.location.origin },
                      { label: "Painel principal", value: window.location.host },
                      { label: "Total de lojas", value: String(stats?.tenants ?? 0) },
                      { label: "Lojas ativas", value: String(stats?.active_accounts ?? 0) },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
                        <p className="text-sm font-semibold text-slate-600">{item.label}</p>
                        <p className="text-sm font-semibold text-slate-900">{item.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-6">
                  <h2 className="font-semibold text-slate-900 mb-4">Ações</h2>
                  <div className="space-y-3">
                    <Button variant="outline" size="lg" fullWidth className="justify-start" iconLeft={<RefreshCcw size={16} />} onClick={() => void loadOverview()}>Recarregar dados</Button>
                    <Button variant="danger" size="lg" fullWidth className="justify-start" iconLeft={<LogOut size={16} />} onClick={() => { clearSession(); navigate("/login", { replace: true }); }}>Sair do painel</Button>
                  </div>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
          </div>
        </main>
      </div>

      {/* ── Edit tenant modal ── */}
      <Modal
        open={!!editingTenant}
        onClose={() => setEditingTenant(null)}
        size="lg"
        title="Editar Cliente"
        subtitle={editingTenant ? (editingTenant.public_url || buildTenantPreviewUrl(editingTenant.subdomain)) : undefined}
        footer={
          <ModalFooter>
            <Button variant="outline" onClick={() => setEditingTenant(null)}>Cancelar</Button>
            <Button type="submit" form="edit-tenant-form" loading={editSaving}>Salvar alterações</Button>
          </ModalFooter>
        }
      >
        {editingTenant && (
          <div className="space-y-4">
            {/* dados atuais, somente leitura */}
            <div className="grid grid-cols-3 divide-x divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
              <div className="px-3 py-2.5 text-center">
                <div className="flex justify-center">{tenantStatusBadge(editingTenant.status)}</div>
                <p className="mt-1 text-[11px] text-slate-500">Status</p>
              </div>
              <div className="px-3 py-2.5 text-center">
                <p className="text-xs font-medium text-slate-800">R$ {Number(editingTenant.subscription_amount ?? 0).toFixed(2)}</p>
                <p className="mt-1 text-[11px] text-slate-500">Assinatura/mês</p>
              </div>
              <div className="px-3 py-2.5 text-center">
                <p className="text-xs font-medium text-slate-800">
                  {editingTenant.created_at ? new Date(editingTenant.created_at).toLocaleDateString("pt-BR") : "—"}
                </p>
                <p className="mt-1 text-[11px] text-slate-500">Criado em</p>
              </div>
            </div>
            {editingTenant.public_url && (
              <div className="flex items-center gap-2">
                <ExternalLink size={11} className="shrink-0 text-slate-400" />
                <a href={editingTenant.public_url} target="_blank" rel="noopener noreferrer"
                  className="truncate text-[11px] text-slate-500 hover:text-blue-600 hover:underline">
                  {editingTenant.public_url}
                </a>
                <IconButton size="xs" className="ml-auto" aria-label="Copiar URL" onClick={() => void copyText(editingTenant.public_url || "", "URL copiada!")}>
                  <Copy size={12} />
                </IconButton>
              </div>
            )}

            <form id="edit-tenant-form" onSubmit={(e) => void handleSaveEdit(e)}>
              <Tabs<EditTab> items={EDIT_TABS.filter((tab) => tab.id !== "user" || !!editingTenant.users?.[0])} value={editTab} onChange={setEditTab} label="Dados do cliente">
                {editTab === "store" && (
                  <div className="space-y-4">
                    <InputField label="Nome da Loja" value={editForm.tenantName} onChange={v => setEditForm(f => ({ ...f, tenantName: v }))} placeholder="Nome da loja" icon={<Store size={14} />} />
                    <InputField label="WhatsApp" value={editForm.whatsapp} onChange={v => setEditForm(f => ({ ...f, whatsapp: maskPhone(v) }))} placeholder="(11) 99999-9999" icon={<Phone size={14} />} />
                  </div>
                )}

                {editTab === "modules" && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-slate-800">Fluxo de Produção</p>
                        <p className="text-[11px] text-slate-500">Quadro Kanban de Ordens de Serviço e Orçamentos</p>
                      </div>
                      <Switch checked={editForm.fluxoProducaoEnabled} aria-label="Fluxo de Produção" onChange={(checked) => setEditForm(f => ({ ...f, fluxoProducaoEnabled: checked }))} />
                    </div>
                    <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-slate-800">Gráfica</p>
                        <p className="text-[11px] text-slate-500">Etapas "Aguardando arte" e "Arte finalizada" na Ordem de Serviço</p>
                      </div>
                      <Switch checked={editForm.graficaEnabled} aria-label="Gráfica" onChange={(checked) => setEditForm(f => ({ ...f, graficaEnabled: checked }))} />
                    </div>
                  </div>
                )}

                {editTab === "user" && editingTenant.users?.[0] && (
                  <div className="space-y-4">
                    <InputField label="Nome" value={editForm.userName} onChange={v => setEditForm(f => ({ ...f, userName: v }))} placeholder="Nome completo" />
                    <InputField label="E-mail" type="email" value={editForm.userEmail} onChange={v => setEditForm(f => ({ ...f, userEmail: v }))} placeholder="email@exemplo.com" icon={<Mail size={14} />} />
                    <Input
                      label="Nova Senha (deixe em branco para não alterar)"
                      type={showEditPwd ? "text" : "password"}
                      value={editForm.userPassword}
                      onChange={e => setEditForm(f => ({ ...f, userPassword: e.target.value }))}
                      placeholder="Mínimo 6 caracteres"
                      iconRight={
                        <button type="button" aria-label={showEditPwd ? "Ocultar senha" : "Mostrar senha"} onClick={() => setShowEditPwd(v => !v)} className="text-slate-400 hover:text-slate-600">
                          {showEditPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      }
                    />
                  </div>
                )}
              </Tabs>
            </form>
          </div>
        )}
      </Modal>
    </div>
  );
}
