import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  TrendingUp, TrendingDown, Package, DollarSign,
  ShoppingCart, Users, AlertTriangle, Trophy,
  Plus, X, Edit2, Trash2, Globe, Instagram, Facebook,
  Twitter, Youtube, Linkedin, Mail, Phone, MessageCircle,
  Calendar, Music, Bookmark, Star, Shield, Coffee, Heart,
  Link2, CheckCircle2, Check,
  BarChart3, Zap, Wrench,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../../lib/utils";
import {
  Alert, Badge, Button, ConfirmModal, EmptyState, FilterLine, FilterLineDateRange, FilterLineSection, FilterLineSegmented,
  IconButton, Input, Modal, ModalFooter, PageWrapper, PanelCard, SectionTitle, StatCard, StatGrid, Tabs,
} from "../../components/ui";

// ── Types ──────────────────────────────────────────────────────────

interface QuickLink {
  id: string;
  label: string;
  url: string;
  icon: string;
  color: string;
}

interface Task {
  id: string;
  text: string;
  done: boolean;
  created_at: string;
}

// ── Icon catalogue ────────────────────────────────────────────────

const ICON_MAP: Record<string, React.ElementType> = {
  link: Link2, globe: Globe, instagram: Instagram, facebook: Facebook,
  twitter: Twitter, youtube: Youtube, linkedin: Linkedin, mail: Mail,
  phone: Phone, whatsapp: MessageCircle, calendar: Calendar,
  music: Music, bookmark: Bookmark, star: Star, shield: Shield,
  coffee: Coffee, heart: Heart, chart: BarChart3, zap: Zap,
  users: Users, package: Package,
};

const ICON_KEYS = Object.keys(ICON_MAP);

const COLORS = [
  "#64748b","#1e293b","#ef4444","#dc2626","#f97316","#ea580c",
  "#f59e0b","#d97706","#eab308","#ca8a04","#84cc16","#65a30d",
  "#22c55e","#16a34a","#10b981","#059669","#14b8a6","#0d9488",
  "#06b6d4","#0891b2","#38bdf8","#0ea5e9","#3b82f6","#2563eb",
  "#6366f1","#4f46e5","#8b5cf6","#7c3aed","#a855f7","#9333ea",
  "#ec4899","#db2777","#f43f5e","#e11d48",
];

// ── API helpers ───────────────────────────────────────────────────

const headers = () => ({ "Authorization": `Bearer ${localStorage.getItem("token")}` });
const jsonHeaders = () => ({ ...headers(), "Content-Type": "application/json" });

function handle403() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  window.location.href = "/login";
}

async function getPref<T>(key: string, fallback: T): Promise<T> {
  try {
    const r = await fetch(`/api/preferences/${key}`, { headers: headers() });
    if (r.status === 401 || r.status === 403) { handle403(); return fallback; }
    const d = await r.json();
    return d ?? fallback;
  } catch { return fallback; }
}

async function setPref(key: string, value: unknown) {
  await fetch(`/api/preferences/${key}`, {
    method: "PUT", headers: jsonHeaders(),
    body: JSON.stringify({ value }),
  });
}

// ── Icon picker component ─────────────────────────────────────────

function IconCircle({ icon, color, size = 40 }: { icon: string; color: string; size?: number }) {
  const Icon = ICON_MAP[icon] ?? Link2;
  return (
    <div
      className="rounded-lg flex items-center justify-center shrink-0"
      style={{ width: size, height: size, backgroundColor: color }}
    >
      <Icon size={size * 0.45} color="#fff" />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────

// primeiro e último dia do mês atual no formato YYYY-MM-DD
function monthRange(): { from: string; to: string } {
  const n = new Date();
  const pad = (x: number) => String(x).padStart(2, "0");
  const first = new Date(n.getFullYear(), n.getMonth(), 1);
  const last  = new Date(n.getFullYear(), n.getMonth() + 1, 0);
  const fmtDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return { from: fmtDate(first), to: fmtDate(last) };
}

// Mesma janela usada no badge da sidebar (AdminDashboard.tsx) para parcelas
// de crediário "vencendo em breve" — mantido em sincronia manualmente.
const CREDIARIO_DUE_SOON_DAYS = 3;

type HomeTabId = "resumo" | "alertas" | "atalhos";
const LINK_TABS = [
  { id: "dados", label: "Dados", icon: Link2 },
  { id: "aparencia", label: "Ícone e cor", icon: Star },
] as const;
type LinkTabId = typeof LINK_TABS[number]["id"];

interface DebtInstallment { id: number; customer_name: string; due_date: string; remaining: number }

export default function Home() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<any>(null);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [overdueDebts, setOverdueDebts] = useState<DebtInstallment[]>([]);
  const [dueSoonDebts, setDueSoonDebts] = useState<DebtInstallment[]>([]);

  // Filtro de período (default: mês atual)
  const [period, setPeriod] = useState<{ from: string; to: string }>(monthRange);

  // Filtro de visualização de vendas: "all" | "products" | "services"
  const [homeTab, setHomeTab] = useState<HomeTabId>("resumo");
  const [linkTab, setLinkTab] = useState<LinkTabId>("dados");
  const [salesView, setSalesView] = useState<"all" | "products" | "services">("all");

  // Quick links
  const [links, setLinks] = useState<QuickLink[]>([]);
  const [linkModal, setLinkModal] = useState(false);
  const [editingLink, setEditingLink] = useState<QuickLink | null>(null);
  const [deleteLink, setDeleteLink] = useState<QuickLink | null>(null);
  const [linkForm, setLinkForm] = useState({ label: "", url: "", icon: "globe", color: "#3b82f6" });

  // Tasks
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskInput, setTaskInput] = useState("");
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editTaskText, setEditTaskText] = useState("");
  const [deleteTask, setDeleteTask] = useState<Task | null>(null);

  // ── Load everything ───────────────────────────────────────────

  // stats + top produtos: recarregam quando o período muda
  useEffect(() => {
    const auth = headers();
    const qs = `?from=${period.from}&to=${period.to}`;
    setLoadingStats(true);
    Promise.all([
      fetch(`/api/stats${qs}`, { headers: auth }),
      fetch(`/api/stats/top-selling${qs}`, { headers: auth }),
    ]).then(async ([rStats, rTop]) => {
      if (rStats.status === 401 || rStats.status === 403) { handle403(); return; }
      const s = await rStats.json();
      const top = rTop.ok ? await rTop.json() : [];
      setStats(s?.summary ? s : null);
      setTopProducts(Array.isArray(top) ? top : []);
      setLoadingStats(false);
    }).catch(() => setLoadingStats(false));
  }, [period.from, period.to]);

  // Crediário vencido / vencendo em breve — carrega uma vez (mesmo endpoint
  // usado no badge da sidebar em AdminDashboard.tsx, dividido client-side
  // nas duas janelas, mesmo padrão).
  useEffect(() => {
    fetch("/api/customers/debts/installments", { headers: headers() })
      .then(async (r) => {
        if (r.status === 401 || r.status === 403) { handle403(); return []; }
        const d = await r.json();
        return Array.isArray(d) ? d : [];
      })
      .then((data: DebtInstallment[]) => {
        const now = Date.now();
        setOverdueDebts(data.filter((i) => new Date(i.due_date).getTime() < now));
        setDueSoonDebts(data.filter((i) => {
          const daysUntil = (new Date(i.due_date).getTime() - now) / 86_400_000;
          return daysUntil >= 0 && daysUntil <= CREDIARIO_DUE_SOON_DAYS;
        }));
      })
      .catch(() => {});
  }, []);

  // preferências (links/tarefas/salesView): carregam uma vez
  useEffect(() => {
    Promise.all([
      getPref<QuickLink[]>("quick_links", []),
      getPref<Task[]>("daily_tasks", []),
      getPref<string>("home_sales_view", "all"),
    ]).then(([ql, tk, sv]) => {
      setLinks(Array.isArray(ql) ? ql : []);
      setTasks(Array.isArray(tk) ? tk : []);
      if (sv === "products" || sv === "services" || sv === "all") setSalesView(sv);
    }).catch(() => {});
  }, []);

  const changeSalesView = (v: "all" | "products" | "services") => {
    setSalesView(v);
    setPref("home_sales_view", v).catch(() => {});
  };

  // ── Quick Links CRUD ──────────────────────────────────────────

  function openNewLink() {
    setEditingLink(null);
    setLinkTab("dados");
    setLinkForm({ label: "", url: "", icon: "globe", color: "#3b82f6" });
    setLinkModal(true);
  }

  function openEditLink(link: QuickLink) {
    setEditingLink(link);
    setLinkTab("dados");
    setLinkForm({ label: link.label, url: link.url, icon: link.icon, color: link.color });
    setLinkModal(true);
  }

  async function saveLink() {
    if (!linkForm.label.trim() || !linkForm.url.trim()) return;
    let url = linkForm.url.trim();
    if (url && !url.startsWith("http://") && !url.startsWith("https://")) url = "https://" + url;
    const updated = editingLink
      ? links.map(l => l.id === editingLink.id ? { ...l, ...linkForm, url } : l)
      : [...links, { id: crypto.randomUUID(), ...linkForm, url }];
    setLinks(updated);
    await setPref("quick_links", updated);
    setLinkModal(false);
  }

  async function confirmDeleteLink() {
    if (!deleteLink) return;
    const updated = links.filter(l => l.id !== deleteLink.id);
    setLinks(updated);
    await setPref("quick_links", updated);
    setDeleteLink(null);
  }

  // ── Tasks CRUD ────────────────────────────────────────────────

  async function addTask() {
    if (!taskInput.trim()) return;
    const updated = [...tasks, {
      id: crypto.randomUUID(),
      text: taskInput.trim(),
      done: false,
      created_at: new Date().toISOString(),
    }];
    setTasks(updated);
    setTaskInput("");
    await setPref("daily_tasks", updated);
  }

  async function toggleTask(id: string) {
    const updated = tasks.map(t => t.id === id ? { ...t, done: !t.done } : t);
    setTasks(updated);
    await setPref("daily_tasks", updated);
  }

  async function saveEditTask() {
    if (!editingTask || !editTaskText.trim()) return;
    const updated = tasks.map(t => t.id === editingTask.id ? { ...t, text: editTaskText.trim() } : t);
    setTasks(updated);
    await setPref("daily_tasks", updated);
    setEditingTask(null);
  }

  async function confirmDeleteTask() {
    if (!deleteTask) return;
    const updated = tasks.filter(t => t.id !== deleteTask.id);
    setTasks(updated);
    await setPref("daily_tasks", updated);
    setDeleteTask(null);
  }

  const pendingTasks = tasks.filter(t => !t.done).length;

  // ── Render ────────────────────────────────────────────────────

  const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

  // Serviços não têm custo de mercadoria (sem order_items), então ao filtrar
  // por "Serviços" o custo é zero e o lucro é a própria receita líquida de serviços.
  const kpiGross  = stats ? (salesView === "products" ? stats.summary.productsGross : salesView === "services" ? stats.summary.servicesGross : stats.summary.grossRevenue) : 0;
  const kpiNet    = stats ? (salesView === "products" ? stats.summary.productsNet   : salesView === "services" ? stats.summary.servicesNet   : stats.summary.netRevenue) : 0;
  const kpiCogs   = stats ? (salesView === "services" ? 0 : stats.summary.cogs) : 0;
  const kpiProfit = Number(kpiNet) - Number(kpiCogs);

  const kpis = stats ? [
    { label: "Faturamento Bruto", value: fmt(Number(kpiGross)), icon: DollarSign, color: "info" as const },
    { label: "Fat. Líquido", value: fmt(Number(kpiNet)), icon: TrendingUp, color: "success" as const },
    { label: "Custo Mercadoria", value: fmt(Number(kpiCogs)), icon: TrendingDown, color: "danger" as const },
    { label: "Lucro Líquido", value: fmt(kpiProfit), icon: Package, color: "default" as const },
  ] : [];

  const today = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });

  const lastMonthRange = () => {
    const n = new Date();
    const pad = (x: number) => String(x).padStart(2, "0");
    const f = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    return { from: f(new Date(n.getFullYear(), n.getMonth() - 1, 1)), to: f(new Date(n.getFullYear(), n.getMonth(), 0)) };
  };
  const thisMonth = monthRange();
  const lastMonth = lastMonthRange();
  const periodPreset = period.from === thisMonth.from && period.to === thisMonth.to ? "current"
    : period.from === lastMonth.from && period.to === lastMonth.to ? "last" : "custom";
  const changePreset = (v: string) => {
    if (v === "current") setPeriod(monthRange());
    else if (v === "last") setPeriod(lastMonthRange());
  };
  const periodOptions = [
    { value: "current", label: "Mês atual" },
    { value: "last", label: "Mês passado" },
    { value: "custom", label: "Personalizado" },
  ];

  const outOfStock: { id: number; name: string; sku: string | null }[] = stats?.summary?.outOfStockProducts ?? [];
  const alertCount = outOfStock.length + overdueDebts.length + dueSoonDebts.length;
  const brl = (v: number) => `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

  const homeTabs = [
    { id: "resumo", label: "Resumo", icon: BarChart3 },
    { id: "alertas", label: "Alertas", icon: AlertTriangle, ...(alertCount > 0 ? { badge: alertCount } : {}) },
    { id: "atalhos", label: "Atalhos e tarefas", icon: CheckCircle2, ...(pendingTasks > 0 ? { badge: pendingTasks } : {}) },
  ] as const;

  const salesOptions = [
    { value: "all", label: "Tudo" },
    { value: "products", label: "Catálogo" },
    { value: "services", label: "Serviços" },
  ];

  return (
    <PageWrapper>
      <div className="space-y-4">
        <SectionTitle icon={BarChart3} title="Visão Geral" description={today} />

        {/* Filtros: período + origem das vendas */}
        <FilterLine>
          <FilterLineSection>
            <FilterLineDateRange
              from={period.from}
              to={period.to}
              onFromChange={(v) => v && setPeriod((p) => ({ ...p, from: v }))}
              onToChange={(v) => v && setPeriod((p) => ({ ...p, to: v }))}
            />
            <FilterLineSegmented value={periodPreset} onChange={(v) => changePreset(String(v))} options={periodOptions} />
          </FilterLineSection>
          {stats?.summary && (
            <FilterLineSection align="right">
              <FilterLineSegmented value={salesView as string} onChange={(v) => changeSalesView(v as "all" | "products" | "services")} options={salesOptions} />
            </FilterLineSection>
          )}
        </FilterLine>

        {/* Aviso do que exige ação hoje: um único card, acima das abas */}
        {alertCount > 0 && homeTab !== "alertas" && (
          <div
            role="status"
            className={cn(
              "flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border px-3 py-2 text-xs",
              overdueDebts.length > 0 || outOfStock.length > 0 ? "border-red-200 bg-red-50 text-red-700" : "border-amber-200 bg-amber-50 text-amber-800"
            )}
          >
            <AlertTriangle size={14} className="shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1 basis-48">
              <span className="font-medium">Precisam de atenção: </span>
              {[
                outOfStock.length > 0 ? `${outOfStock.length} produto${outOfStock.length !== 1 ? "s" : ""} esgotado${outOfStock.length !== 1 ? "s" : ""}` : "",
                overdueDebts.length > 0 ? `${overdueDebts.length} parcela${overdueDebts.length !== 1 ? "s" : ""} de crediário vencida${overdueDebts.length !== 1 ? "s" : ""}` : "",
                dueSoonDebts.length > 0 ? `${dueSoonDebts.length} parcela${dueSoonDebts.length !== 1 ? "s" : ""} a vencer` : "",
              ].filter(Boolean).join(" · ")}
            </span>
            <Button size="xs" variant="outline" onClick={() => setHomeTab("alertas")}>Ver alertas</Button>
          </div>
        )}

        <Tabs<HomeTabId> items={homeTabs} value={homeTab} onChange={setHomeTab} label="Seções da visão geral">
          {/* ── Resumo ─────────────────────────────────────────── */}
          {homeTab === "resumo" && (
            <div className="space-y-3">
              {loadingStats ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-20 animate-pulse rounded-lg border border-slate-200 bg-white" />
                  ))}
                </div>
              ) : (
                <StatGrid cols={4}>
                  {kpis.map((k, i) => (
                    <StatCard key={i} title={k.label} value={k.value} icon={k.icon} color={k.color} delay={i * 0.05} />
                  ))}
                </StatGrid>
              )}

              {/* Breakdown: Produtos vs Serviços — respeita o filtro acima */}
              {stats?.summary && (stats.summary.servicesNet > 0 || stats.summary.productsNet > 0) && (
                <StatGrid cols={2}>
                  {(salesView === "all" || salesView === "products") && (
                    <StatCard
                      title={`Vendas — Catálogo · ${stats.summary.productsCount ?? "—"} pedido${stats.summary.productsCount !== 1 ? "s" : ""}`}
                      value={brl(stats.summary.productsNet)}
                      description={`Bruto: ${brl(stats.summary.productsGross)}`}
                      icon={Package}
                      color="info"
                    />
                  )}
                  {(salesView === "all" || salesView === "services") && (
                    <StatCard
                      title={`Vendas — Serviços · ${stats.summary.servicesCount ?? "—"} pedido${stats.summary.servicesCount !== 1 ? "s" : ""}`}
                      value={brl(stats.summary.servicesNet)}
                      description={`Bruto: ${brl(stats.summary.servicesGross)}`}
                      icon={Wrench}
                      color="purple"
                    />
                  )}
                </StatGrid>
              )}

              <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
                <PanelCard className="xl:col-span-2" title="Faturamento — período" description="Receita líquida de pedidos concluídos">
                  {stats?.salesOverTime?.length > 0 ? (
                    <div className="h-64 min-w-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={stats.salesOverTime}>
                          <defs>
                            <linearGradient id="gTotal" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#2563eb" stopOpacity={0.12} />
                              <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="gProducts" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.12} />
                              <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="gServices" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.12} />
                              <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid vertical={false} stroke="#e2e8f0" />
                          <XAxis
                            dataKey="date"
                            axisLine={false} tickLine={false}
                            tick={{ fontSize: 11, fill: "#64748b" }} dy={8}
                            tickFormatter={(v: string) => new Date(v + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                          />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#64748b" }} width={48} />
                          <Tooltip
                            contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
                            labelStyle={{ color: "#1e293b", marginBottom: 2 }}
                            labelFormatter={(v: string) => new Date(v + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })}
                            formatter={(value: number, name: string) => {
                              const labels: Record<string, string> = { total: "Total", products: "Catálogo", services: "Serviços" };
                              return [`R$ ${Number(value).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, labels[name] ?? name];
                            }}
                          />
                          <Legend
                            iconType="circle" iconSize={7}
                            formatter={(v) => {
                              const labels: Record<string, string> = { total: "Total", products: "Catálogo", services: "Serviços" };
                              return <span style={{ fontSize: 11 }}>{labels[v] ?? v}</span>;
                            }}
                          />
                          {salesView !== "services" && (
                            <Area type="monotone" dataKey={salesView === "products" ? "products" : "total"} name={salesView === "products" ? "products" : "total"} stroke="#2563eb" strokeWidth={2} fillOpacity={1} fill="url(#gTotal)" dot={false} />
                          )}
                          {salesView === "all" && (
                            <Area type="monotone" dataKey="products" name="products" stroke="#0ea5e9" strokeWidth={1.5} strokeDasharray="4 2" fillOpacity={1} fill="url(#gProducts)" dot={false} />
                          )}
                          {(salesView === "all" || salesView === "services") && (
                            <Area type="monotone" dataKey="services" name="services" stroke="#8b5cf6" strokeWidth={salesView === "services" ? 2 : 1.5} strokeDasharray={salesView === "services" ? undefined : "4 2"} fillOpacity={1} fill="url(#gServices)" dot={false} />
                          )}
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <EmptyState icon={BarChart3} title="Sem dados ainda" />
                  )}
                </PanelCard>

                <PanelCard icon={Trophy} title="Top Produtos" action={<Badge color="primary">Tempo real</Badge>}>
                  <div className="space-y-3">
                    {topProducts.map((p, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <span className="w-4 shrink-0 text-[11px] font-medium text-slate-400">{i + 1}</span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium text-slate-700">{p.name}</p>
                          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-blue-500"
                              style={{ width: `${Math.min(100, (p.total_sold / (topProducts[0]?.total_sold || 1)) * 100)}%` }}
                            />
                          </div>
                        </div>
                        <span className="shrink-0 text-[11px] font-semibold tabular-nums text-blue-600">{p.total_sold} un</span>
                      </div>
                    ))}
                    {topProducts.length === 0 && <EmptyState title="Nenhuma venda ainda" />}
                  </div>
                </PanelCard>
              </div>
            </div>
          )}

          {/* ── Alertas ────────────────────────────────────────── */}
          {homeTab === "alertas" && (
            <div className="space-y-3">
              {alertCount === 0 && <EmptyState icon={CheckCircle2} title="Nada precisa de atenção agora" />}

              {outOfStock.length > 0 && (
                <PanelCard
                  icon={AlertTriangle}
                  iconWrapClassName="border-red-100 bg-red-50"
                  iconClassName="text-red-500"
                  title="Produtos Esgotados"
                  description={`${outOfStock.length} sem estoque${stats.summary.lowStockCount > 0 ? ` · ${stats.summary.lowStockCount} com estoque baixo` : ""}`}
                  action={<Button variant="outline" size="xs" onClick={() => navigate("/admin/stock")}>Ver estoque</Button>}
                  contentClassName="p-0"
                >
                  <ul className="max-h-64 divide-y divide-slate-100 overflow-y-auto">
                    {outOfStock.slice(0, 8).map((p) => (
                      <li key={p.id} className="flex items-center justify-between gap-3 px-3 py-2">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium text-slate-900">{p.name}</p>
                          <p className="text-[11px] text-slate-500">SKU: {p.sku || String(p.id).padStart(6, "0")}</p>
                        </div>
                        <Badge color="danger">0 un</Badge>
                      </li>
                    ))}
                  </ul>
                  {outOfStock.length > 8 && (
                    <p className="border-t border-slate-100 bg-slate-50 px-3 py-2 text-center text-[11px] text-slate-500">
                      +{outOfStock.length - 8} outros produtos esgotados
                    </p>
                  )}
                </PanelCard>
              )}

              {overdueDebts.length > 0 && (
                <PanelCard
                  icon={AlertTriangle}
                  iconWrapClassName="border-red-100 bg-red-50"
                  iconClassName="text-red-500"
                  title="Crediário Vencido"
                  description={`${overdueDebts.length} parcela${overdueDebts.length !== 1 ? "s" : ""} · ${brl(overdueDebts.reduce((s, i) => s + i.remaining, 0))}`}
                  action={<Button variant="outline" size="xs" onClick={() => navigate("/admin/contas-receber")}>Ver crediário</Button>}
                  contentClassName="p-0"
                >
                  <ul className="max-h-64 divide-y divide-slate-100 overflow-y-auto">
                    {overdueDebts.slice(0, 8).map((i) => (
                      <li key={i.id} className="flex items-center justify-between gap-3 px-3 py-2">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium text-slate-900">{i.customer_name}</p>
                          <p className="text-[11px] text-slate-500">Venceu em {new Date(i.due_date).toLocaleDateString("pt-BR")}</p>
                        </div>
                        <span className="shrink-0 text-xs font-semibold tabular-nums text-red-600">{brl(i.remaining)}</span>
                      </li>
                    ))}
                  </ul>
                  {overdueDebts.length > 8 && (
                    <p className="border-t border-slate-100 bg-slate-50 px-3 py-2 text-center text-[11px] text-slate-500">
                      +{overdueDebts.length - 8} outras parcelas vencidas
                    </p>
                  )}
                </PanelCard>
              )}

              {dueSoonDebts.length > 0 && (
                <PanelCard
                  icon={AlertTriangle}
                  iconWrapClassName="border-amber-100 bg-amber-50"
                  iconClassName="text-amber-500"
                  title="Crediário a Vencer"
                  description={`${dueSoonDebts.length} parcela${dueSoonDebts.length !== 1 ? "s" : ""} nos próximos ${CREDIARIO_DUE_SOON_DAYS} dias · ${brl(dueSoonDebts.reduce((s, i) => s + i.remaining, 0))}`}
                  action={<Button variant="outline" size="xs" onClick={() => navigate("/admin/contas-receber")}>Ver crediário</Button>}
                  contentClassName="p-0"
                >
                  <ul className="max-h-64 divide-y divide-slate-100 overflow-y-auto">
                    {dueSoonDebts.slice(0, 8).map((i) => (
                      <li key={i.id} className="flex items-center justify-between gap-3 px-3 py-2">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium text-slate-900">{i.customer_name}</p>
                          <p className="text-[11px] text-slate-500">Vence em {new Date(i.due_date).toLocaleDateString("pt-BR")}</p>
                        </div>
                        <span className="shrink-0 text-xs font-semibold tabular-nums text-amber-600">{brl(i.remaining)}</span>
                      </li>
                    ))}
                  </ul>
                  {dueSoonDebts.length > 8 && (
                    <p className="border-t border-slate-100 bg-slate-50 px-3 py-2 text-center text-[11px] text-slate-500">
                      +{dueSoonDebts.length - 8} outras parcelas a vencer
                    </p>
                  )}
                </PanelCard>
              )}
            </div>
          )}

          {/* ── Atalhos e tarefas ──────────────────────────────── */}
          {homeTab === "atalhos" && (
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
              {/* Acessos Rápidos */}
              <PanelCard
                icon={Globe}
                title="Acessos Rápidos"
                description="Links de apoio para o dia a dia"
                action={<Button size="xs" iconLeft={<Plus size={12} />} onClick={openNewLink}>Novo</Button>}
              >
                {links.length === 0 ? (
                  <EmptyState
                    icon={Plus}
                    title="Nenhum acesso ainda"
                    action={<Button size="sm" variant="outline" iconLeft={<Plus size={14} />} onClick={openNewLink}>Adicionar primeiro acesso</Button>}
                  />
                ) : (
                  <div className="grid grid-cols-3 gap-3 min-[420px]:grid-cols-4">
                    {links.map(link => (
                      <div key={link.id} className="group relative flex flex-col items-center gap-2">
                        <a href={link.url} target="_blank" rel="noopener noreferrer" className="block">
                          <IconCircle icon={link.icon} color={link.color} size={48} />
                        </a>
                        <p className="w-full truncate text-center text-[11px] font-medium leading-tight text-slate-600">{link.label}</p>
                        {/* Edit/Delete overlay */}
                        <div className="absolute -right-1 -top-1 hidden gap-1 group-hover:flex">
                          <button
                            aria-label={`Editar ${link.label}`}
                            onClick={() => openEditLink(link)}
                            className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:text-blue-600"
                          >
                            <Edit2 size={10} />
                          </button>
                          <button
                            aria-label={`Remover ${link.label}`}
                            onClick={() => setDeleteLink(link)}
                            className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:text-red-600"
                          >
                            <X size={10} />
                          </button>
                        </div>
                      </div>
                    ))}
                    <div className="flex flex-col items-center gap-2">
                      <button
                        aria-label="Novo acesso"
                        onClick={openNewLink}
                        className="flex h-12 w-12 items-center justify-center rounded-lg border-2 border-dashed border-slate-200 text-slate-400 transition-all hover:border-blue-400 hover:text-blue-500"
                      >
                        <Plus size={18} />
                      </button>
                      <p className="text-center text-[11px] text-slate-400">Novo</p>
                    </div>
                  </div>
                )}
              </PanelCard>

              {/* Tarefas Diárias */}
              <PanelCard
                icon={CheckCircle2}
                title="Tarefas Diárias"
                description="Checklist rápido de hoje"
                contentClassName="p-0"
                action={
                  pendingTasks > 0 ? <Badge color="warning">{pendingTasks} pendente{pendingTasks > 1 ? "s" : ""}</Badge>
                    : tasks.length > 0 ? <Badge color="success" icon={<Check size={11} />}>Tudo feito!</Badge> : undefined
                }
              >
                <div className="flex flex-col" style={{ maxHeight: 320 }}>
                  <div className="flex-1 divide-y divide-slate-100 overflow-y-auto">
                    <AnimatePresence initial={false}>
                      {tasks.map(task => (
                        <motion.div
                          key={task.id}
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.15 }}
                          className="group flex items-center gap-3 px-3 py-2 transition-colors hover:bg-slate-50/60"
                        >
                          <button
                            aria-label={task.done ? "Marcar como pendente" : "Marcar como feita"}
                            onClick={() => toggleTask(task.id)}
                            className={cn(
                              "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all",
                              task.done ? "border-emerald-500 bg-emerald-500" : "border-slate-300 hover:border-emerald-400"
                            )}
                          >
                            {task.done && <Check size={10} color="white" strokeWidth={3} />}
                          </button>

                          {editingTask?.id === task.id ? (
                            <input
                              autoFocus
                              aria-label="Editar tarefa"
                              className="flex-1 border-b border-blue-400 bg-transparent text-[13px] outline-none"
                              value={editTaskText}
                              onChange={e => setEditTaskText(e.target.value)}
                              onKeyDown={e => { if (e.key === "Enter") saveEditTask(); if (e.key === "Escape") setEditingTask(null); }}
                              onBlur={saveEditTask}
                            />
                          ) : (
                            <span className={cn("min-w-0 flex-1 break-words text-[13px] leading-snug", task.done ? "text-slate-400 line-through" : "text-slate-700")}>
                              {task.text}
                            </span>
                          )}

                          <div className="hidden shrink-0 items-center gap-1 group-hover:flex">
                            <IconButton size="xs" variant="ghost" aria-label="Editar tarefa" onClick={() => { setEditingTask(task); setEditTaskText(task.text); }}>
                              <Edit2 size={12} />
                            </IconButton>
                            <IconButton size="xs" variant="ghost" aria-label="Remover tarefa" onClick={() => setDeleteTask(task)}>
                              <Trash2 size={12} />
                            </IconButton>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                    {tasks.length === 0 && (
                      <div className="p-3"><EmptyState title="Nenhuma tarefa ainda" /></div>
                    )}
                  </div>

                  {/* Add task input */}
                  <div className="flex shrink-0 flex-col gap-2 border-t border-slate-100 p-3 sm:flex-row sm:items-center">
                    <Input
                      wrapperClassName="flex-1"
                      aria-label="Nova tarefa"
                      placeholder="O que você não pode esquecer hoje?"
                      value={taskInput}
                      onChange={e => setTaskInput(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && addTask()}
                    />
                    <Button size="md" className="w-full sm:w-auto" onClick={addTask} disabled={!taskInput.trim()} iconLeft={<Plus size={14} />}>Adicionar</Button>
                  </div>
                </div>
              </PanelCard>
            </div>
          )}
        </Tabs>
      </div>

      {/* ── Modal: Criar / Editar Acesso Rápido ─────────── */}
      <Modal
        open={linkModal}
        onClose={() => setLinkModal(false)}
        title={editingLink ? "Editar Acesso Rápido" : "Novo Acesso Rápido"}
        size="md"
        footer={
          <ModalFooter>
            <Button variant="ghost" size="sm" onClick={() => setLinkModal(false)}>Cancelar</Button>
            <Button size="sm" onClick={saveLink} disabled={!linkForm.label.trim() || !linkForm.url.trim()}>Salvar</Button>
          </ModalFooter>
        }
      >
        <div className="space-y-3">
          {/* Preview sempre visível */}
          <div className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3">
            <IconCircle icon={linkForm.icon} color={linkForm.color} size={48} />
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-slate-800">{linkForm.label || "Nome do acesso"}</p>
              <p className="truncate text-[11px] text-slate-500">{linkForm.url || "exemplo.com.br"}</p>
            </div>
          </div>

          <Tabs<LinkTabId> items={LINK_TABS} value={linkTab} onChange={setLinkTab} label="Dados do acesso rápido">
            {linkTab === "dados" && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input
                  autoFocus
                  label="Nome do acesso"
                  placeholder="Ex: Meu site, artigos..."
                  value={linkForm.label}
                  onChange={e => setLinkForm(f => ({ ...f, label: e.target.value }))}
                />
                <Input
                  label="Link (URL)"
                  placeholder="exemplo.com.br"
                  value={linkForm.url}
                  onChange={e => setLinkForm(f => ({ ...f, url: e.target.value }))}
                />
              </div>
            )}

            {linkTab === "aparencia" && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <p className="ds-label">Ícone</p>
                  <div className="grid grid-cols-6 gap-1.5">
                    {ICON_KEYS.map(key => {
                      const Icon = ICON_MAP[key];
                      const active = linkForm.icon === key;
                      return (
                        <button
                          key={key}
                          aria-label={`Ícone ${key}`}
                          aria-pressed={active}
                          onClick={() => setLinkForm(f => ({ ...f, icon: key }))}
                          className={cn(
                            "flex aspect-square w-full items-center justify-center rounded-lg border transition-all",
                            active
                              ? "border-blue-600 bg-blue-600 text-white"
                              : "border-slate-200 bg-white text-slate-500 hover:border-blue-300 hover:text-blue-600"
                          )}
                        >
                          <Icon size={15} />
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="ds-label">Cor</p>
                  <div className="grid grid-cols-6 gap-1.5">
                    {COLORS.map(c => (
                      <button
                        key={c}
                        aria-label={`Cor ${c}`}
                        aria-pressed={linkForm.color === c}
                        onClick={() => setLinkForm(f => ({ ...f, color: c }))}
                        className={cn(
                          "aspect-square w-full rounded-full border-2 transition-all hover:scale-110 active:scale-95",
                          linkForm.color === c ? "scale-110 border-slate-900" : "border-transparent"
                        )}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </Tabs>
        </div>
      </Modal>

      {/* ── Confirmar exclusão de link ───────────── */}
      <ConfirmModal
        isOpen={!!deleteLink}
        onClose={() => setDeleteLink(null)}
        onConfirm={confirmDeleteLink}
        title="Remover acesso"
        confirmLabel="Remover"
        message={
          <div className="flex items-center gap-3">
            {deleteLink && <IconCircle icon={deleteLink.icon} color={deleteLink.color} size={40} />}
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-900">{deleteLink?.label}</p>
              <p className="mt-0.5 text-[11px] text-slate-500">Esta ação não pode ser desfeita.</p>
            </div>
          </div>
        }
      />

      {/* ── Confirmar exclusão de tarefa ─────────── */}
      <ConfirmModal
        isOpen={!!deleteTask}
        onClose={() => setDeleteTask(null)}
        onConfirm={confirmDeleteTask}
        title="Remover tarefa"
        confirmLabel="Remover"
        message={
          <div>
            <p className="text-sm font-medium leading-snug text-slate-700">"{deleteTask?.text}"</p>
            <p className="mt-2 text-[11px] text-slate-500">Esta ação não pode ser desfeita.</p>
          </div>
        }
      />
    </PageWrapper>
  );
}
