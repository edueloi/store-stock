import React, { useState, useEffect } from "react";
import {
  TrendingUp, TrendingDown, Package, DollarSign,
  ShoppingCart, Users, AlertTriangle, Trophy,
  Plus, X, Edit2, Trash2, Globe, Instagram, Facebook,
  Twitter, Youtube, Linkedin, Mail, Phone, MessageCircle,
  Calendar, Music, Bookmark, Star, Shield, Coffee, Heart,
  Link2, CheckCircle2, Check,
  BarChart3, Zap, Wrench,
} from "lucide-react";
import PageHeader from "../../components/layout/PageHeader";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../../lib/utils";
import Modal from "../../components/ui/Modal";

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
      className="rounded-2xl flex items-center justify-center shrink-0"
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

export default function Home() {
  const [stats, setStats] = useState<any>(null);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);

  // Filtro de período (default: mês atual)
  const [period, setPeriod] = useState<{ from: string; to: string }>(monthRange);

  // Filtro de visualização de vendas: "all" | "products" | "services"
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
    setLinkForm({ label: "", url: "", icon: "globe", color: "#3b82f6" });
    setLinkModal(true);
  }

  function openEditLink(link: QuickLink) {
    setEditingLink(link);
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
  const kpis = stats ? [
    {
      label: "Faturamento Bruto", value: fmt(Number(stats.summary.grossRevenue)),
      icon: DollarSign, color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-100",
    },
    {
      label: "Fat. Líquido", value: fmt(Number(stats.summary.netRevenue)),
      icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-100",
    },
    {
      label: "Custo Mercadoria", value: fmt(Number(stats.summary.cogs)),
      icon: TrendingDown, color: "text-rose-600", bg: "bg-rose-50", border: "border-rose-100",
    },
    {
      label: "Lucro Líquido", value: fmt(Number(stats.summary.profit)),
      icon: Package, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-100",
    },
  ] : [];

  const today = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });

  const setThisMonth = () => setPeriod(monthRange());
  const setLastMonth = () => {
    const n = new Date();
    const pad = (x: number) => String(x).padStart(2, "0");
    const first = new Date(n.getFullYear(), n.getMonth() - 1, 1);
    const last  = new Date(n.getFullYear(), n.getMonth(), 0);
    const f = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    setPeriod({ from: f(first), to: f(last) });
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Visão Geral" subtitle={today} />

      {/* Filtro de período */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">De</label>
          <input
            type="date"
            value={period.from}
            max={period.to}
            onChange={(e) => setPeriod((p) => ({ ...p, from: e.target.value }))}
            className="px-3 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Até</label>
          <input
            type="date"
            value={period.to}
            min={period.from}
            onChange={(e) => setPeriod((p) => ({ ...p, to: e.target.value }))}
            className="px-3 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
          />
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <button onClick={setThisMonth}
            className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors">
            Mês atual
          </button>
          <button onClick={setLastMonth}
            className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors">
            Mês passado
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      {loadingStats ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white h-24 rounded-2xl border border-slate-100 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map((k, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className={cn("bg-white p-4 rounded-2xl border shadow-sm hover:shadow-md transition-shadow", k.border)}
            >
              <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center mb-3", k.bg)}>
                <k.icon size={18} className={k.color} />
              </div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">{k.label}</p>
              <h3 className="text-lg font-black text-slate-900 tracking-tight font-mono leading-none">{k.value}</h3>
            </motion.div>
          ))}
        </div>
      )}

      {/* Breakdown: Produtos vs Serviços — com filtro de visualização */}
      {stats?.summary && (stats.summary.servicesNet > 0 || stats.summary.productsNet > 0) && (
        <div className="space-y-3">
          {/* Toggle Tudo / Catálogo / Serviços */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Vendas:</span>
            <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
              {([
                { v: "all",      label: "Tudo"      },
                { v: "products", label: "Catálogo"  },
                { v: "services", label: "Serviços"  },
              ] as const).map(({ v, label }) => (
                <button
                  key={v}
                  onClick={() => changeSalesView(v)}
                  className={cn(
                    "h-7 px-3 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all",
                    salesView === v
                      ? v === "services" ? "bg-violet-600 text-white shadow-sm"
                        : v === "products" ? "bg-blue-600 text-white shadow-sm"
                        : "bg-slate-900 text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className={cn("grid gap-4", salesView === "all" ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-1 max-w-sm")}>
            {/* Produtos card */}
            {(salesView === "all" || salesView === "products") && (
              <motion.div
                key="products"
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className="bg-white p-4 rounded-2xl border border-blue-100 shadow-sm"
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
                    <Package size={15} className="text-blue-600" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Vendas — Catálogo</p>
                    <p className="text-[9px] text-slate-400">{stats.summary.productsCount ?? "—"} pedido{stats.summary.productsCount !== 1 ? "s" : ""}</p>
                  </div>
                </div>
                <h3 className="text-xl font-black text-blue-600 font-mono tracking-tight">
                  {`R$ ${Number(stats.summary.productsNet).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                </h3>
                <p className="text-[9px] text-slate-400 mt-0.5">
                  Bruto: {`R$ ${Number(stats.summary.productsGross).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                </p>
              </motion.div>
            )}

            {/* Serviços card */}
            {(salesView === "all" || salesView === "services") && (
              <motion.div
                key="services"
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: salesView === "all" ? 0.05 : 0 }}
                className="bg-white p-4 rounded-2xl border border-violet-100 shadow-sm"
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-xl bg-violet-50 flex items-center justify-center">
                    <Wrench size={15} className="text-violet-600" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Vendas — Serviços</p>
                    <p className="text-[9px] text-slate-400">{stats.summary.servicesCount ?? "—"} pedido{stats.summary.servicesCount !== 1 ? "s" : ""}</p>
                  </div>
                </div>
                <h3 className="text-xl font-black text-violet-600 font-mono tracking-tight">
                  {`R$ ${Number(stats.summary.servicesNet).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                </h3>
                <p className="text-[9px] text-slate-400 mt-0.5">
                  Bruto: {`R$ ${Number(stats.summary.servicesGross).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                </p>
              </motion.div>
            )}
          </div>
        </div>
      )}

      {/* Chart + Top Products */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-900">Faturamento — período</h3>
              <p className="text-[10px] text-slate-400 font-medium mt-0.5">Receita líquida de pedidos concluídos</p>
            </div>
            <div className="w-2 h-2 bg-blue-500 rounded-full" />
          </div>
          {stats?.salesOverTime?.length > 0 ? (
            <div className="h-52 -mx-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.salesOverTime}>
                  <defs>
                    <linearGradient id="gTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.10} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
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
                  <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="date"
                    axisLine={false} tickLine={false}
                    tick={{ fontSize: 9, fill: "#94a3b8", fontWeight: 700 }} dy={8}
                    tickFormatter={(v: string) => new Date(v + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                  />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "#94a3b8", fontWeight: 700 }} width={48} />
                  <Tooltip
                    contentStyle={{ borderRadius: 10, border: "1px solid #f1f5f9", fontSize: 11, fontWeight: 700, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
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
                      return <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>{labels[v] ?? v}</span>;
                    }}
                  />
                  {salesView !== "services" && (
                    <Area type="monotone" dataKey={salesView === "products" ? "products" : "total"} name={salesView === "products" ? "products" : "total"} stroke="#3b82f6" strokeWidth={2.5} fillOpacity={1} fill="url(#gTotal)" dot={false} />
                  )}
                  {salesView === "all" && (
                    <Area type="monotone" dataKey="products" name="products" stroke="#0ea5e9" strokeWidth={1.5} strokeDasharray="4 2" fillOpacity={1} fill="url(#gProducts)" dot={false} />
                  )}
                  {(salesView === "all" || salesView === "services") && (
                    <Area type="monotone" dataKey="services" name="services" stroke="#8b5cf6" strokeWidth={salesView === "services" ? 2.5 : 1.5} strokeDasharray={salesView === "services" ? undefined : "4 2"} fillOpacity={1} fill="url(#gServices)" dot={false} />
                  )}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-52 flex items-center justify-center text-slate-300 flex-col gap-2">
              <BarChart3 size={36} strokeWidth={1} />
              <p className="text-[10px] font-bold uppercase tracking-widest">Sem dados ainda</p>
            </div>
          )}
        </div>

        <div className="bg-slate-900 rounded-2xl p-5 text-white shadow-xl">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">
              <Trophy size={13} className="text-amber-400" /> Top Produtos
            </h3>
            <span className="text-[8px] bg-white/10 px-2 py-0.5 rounded-full uppercase font-bold tracking-widest">Tempo real</span>
          </div>
          <div className="space-y-3">
            {topProducts.map((p, i) => (
              <div key={i} className="flex items-center gap-3 group">
                <span className="text-[10px] font-black text-slate-600 w-4 shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-bold text-slate-300 group-hover:text-white transition-colors truncate uppercase">{p.name}</p>
                  <div className="mt-1 h-1 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full"
                      style={{ width: `${Math.min(100, (p.total_sold / (topProducts[0]?.total_sold || 1)) * 100)}%` }}
                    />
                  </div>
                </div>
                <span className="text-[10px] font-mono font-black text-blue-400 shrink-0">{p.total_sold} un</span>
              </div>
            ))}
            {topProducts.length === 0 && (
              <p className="text-[10px] text-slate-600 py-6 text-center font-bold uppercase">Nenhuma venda ainda</p>
            )}
          </div>
        </div>
      </div>

      {/* Quick Links + Tasks (side by side) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── Acessos Rápidos ─────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 flex items-center justify-between border-b border-slate-50">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
                <Globe size={16} className="text-blue-600" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-widest leading-none">Acessos Rápidos</h3>
                <p className="text-[10px] text-slate-400 font-medium mt-0.5">Links de apoio para o dia a dia</p>
              </div>
            </div>
            <button
              onClick={openNewLink}
              className="flex items-center gap-1.5 px-3 h-8 bg-slate-900 text-white rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-slate-700 transition-all active:scale-95"
            >
              <Plus size={12} /> Novo
            </button>
          </div>

          <div className="p-4">
            {links.length === 0 ? (
              <button
                onClick={openNewLink}
                className="w-full py-8 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 text-[11px] font-bold uppercase tracking-widest hover:border-blue-300 hover:text-blue-500 transition-all flex flex-col items-center gap-2"
              >
                <Plus size={20} />
                Adicionar primeiro acesso
              </button>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {links.map(link => (
                  <div key={link.id} className="group relative flex flex-col items-center gap-2">
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block"
                    >
                      <IconCircle icon={link.icon} color={link.color} size={52} />
                    </a>
                    <p className="text-[10px] font-bold text-slate-600 text-center leading-tight truncate w-full text-center">{link.label}</p>
                    {/* Edit/Delete overlay */}
                    <div className="absolute -top-1 -right-1 hidden group-hover:flex gap-1">
                      <button
                        onClick={() => openEditLink(link)}
                        className="w-5 h-5 bg-white border border-slate-200 rounded-full flex items-center justify-center text-slate-500 hover:text-blue-600 shadow-sm"
                      >
                        <Edit2 size={9} />
                      </button>
                      <button
                        onClick={() => setDeleteLink(link)}
                        className="w-5 h-5 bg-white border border-slate-200 rounded-full flex items-center justify-center text-slate-500 hover:text-red-600 shadow-sm"
                      >
                        <X size={9} />
                      </button>
                    </div>
                  </div>
                ))}
                <div className="flex flex-col items-center gap-2">
                  <button
                    onClick={openNewLink}
                    className="w-[52px] h-[52px] rounded-2xl border-2 border-dashed border-slate-200 flex items-center justify-center text-slate-400 hover:border-blue-400 hover:text-blue-500 transition-all"
                  >
                    <Plus size={18} />
                  </button>
                  <p className="text-[10px] font-bold text-slate-300 text-center">Novo</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Tarefas Diárias ──────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 flex items-center justify-between border-b border-slate-50">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center">
                <CheckCircle2 size={16} className="text-amber-500" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-widest leading-none">Tarefas Diárias</h3>
                <p className="text-[10px] text-slate-400 font-medium mt-0.5">Checklist rápido de hoje</p>
              </div>
            </div>
            {pendingTasks > 0 && (
              <span className="px-2.5 py-1 bg-amber-100 text-amber-700 text-[10px] font-black uppercase tracking-widest rounded-full">
                {pendingTasks} pendente{pendingTasks > 1 ? "s" : ""}
              </span>
            )}
            {pendingTasks === 0 && tasks.length > 0 && (
              <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase tracking-widest rounded-full flex items-center gap-1">
                <Check size={10} /> Tudo feito!
              </span>
            )}
          </div>

          <div className="flex flex-col" style={{ maxHeight: 280 }}>
            <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
              <AnimatePresence initial={false}>
                {tasks.map(task => (
                  <motion.div
                    key={task.id}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.15 }}
                    className="group flex items-center gap-3 px-5 py-3 hover:bg-slate-50/60 transition-colors"
                  >
                    <button
                      onClick={() => toggleTask(task.id)}
                      className={cn(
                        "w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-all",
                        task.done
                          ? "bg-emerald-500 border-emerald-500"
                          : "border-slate-300 hover:border-emerald-400"
                      )}
                    >
                      {task.done && <Check size={10} color="white" strokeWidth={3} />}
                    </button>

                    {editingTask?.id === task.id ? (
                      <input
                        autoFocus
                        className="flex-1 text-sm bg-transparent outline-none border-b border-blue-400"
                        value={editTaskText}
                        onChange={e => setEditTaskText(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") saveEditTask(); if (e.key === "Escape") setEditingTask(null); }}
                        onBlur={saveEditTask}
                      />
                    ) : (
                      <span
                        className={cn(
                          "flex-1 text-sm font-medium leading-snug",
                          task.done ? "line-through text-slate-400" : "text-slate-700"
                        )}
                      >
                        {task.text}
                      </span>
                    )}

                    <div className="hidden group-hover:flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => { setEditingTask(task); setEditTaskText(task.text); }}
                        className="p-1 text-slate-400 hover:text-blue-600 transition-colors"
                      >
                        <Edit2 size={12} />
                      </button>
                      <button
                        onClick={() => setDeleteTask(task)}
                        className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {tasks.length === 0 && (
                <div className="py-8 text-center text-[10px] font-bold uppercase tracking-widest text-slate-300">
                  Nenhuma tarefa ainda
                </div>
              )}
            </div>

            {/* Add task input */}
            <div className="shrink-0 border-t border-slate-100 flex items-center gap-2 px-4 py-3">
              <input
                className="flex-1 text-sm bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 placeholder:text-slate-300 transition-all"
                placeholder="O que você não pode esquecer hoje?"
                value={taskInput}
                onChange={e => setTaskInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addTask()}
              />
              <button
                onClick={addTask}
                disabled={!taskInput.trim()}
                className="shrink-0 h-9 px-3 bg-blue-600 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-blue-700 disabled:opacity-30 transition-all active:scale-95 flex items-center gap-1.5"
              >
                <Plus size={13} /> Adicionar
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Modal: Criar / Editar Acesso Rápido ─────────── */}
      <Modal
        open={linkModal}
        onClose={() => setLinkModal(false)}
        title={editingLink ? "Editar Acesso Rápido" : "Novo Acesso Rápido"}
        size="md"
        footer={
          <>
            <button onClick={() => setLinkModal(false)} className="flex-1 h-10 border border-slate-200 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-slate-50 transition-colors">
              Cancelar
            </button>
            <button
              onClick={saveLink}
              disabled={!linkForm.label.trim() || !linkForm.url.trim()}
              className="flex-1 h-10 bg-slate-900 text-white rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-slate-700 disabled:opacity-40 transition-all shadow-lg"
            >
              Salvar
            </button>
          </>
        }
      >
        <div className="space-y-5">
          {/* Preview + campos lado a lado no desktop */}
          <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
            <div className="shrink-0">
              <IconCircle icon={linkForm.icon} color={linkForm.color} size={56} />
            </div>
            <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Nome do acesso</label>
                <input
                  autoFocus
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none"
                  placeholder="Ex: Meu site, artigos..."
                  value={linkForm.label}
                  onChange={e => setLinkForm(f => ({ ...f, label: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Link (URL)</label>
                <input
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none"
                  placeholder="exemplo.com.br"
                  value={linkForm.url}
                  onChange={e => setLinkForm(f => ({ ...f, url: e.target.value }))}
                />
              </div>
            </div>
          </div>

          {/* Icon picker — 2 colunas: ícones | cores */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Ícone</label>
              <div className="grid grid-cols-6 gap-1.5">
                {ICON_KEYS.map(key => {
                  const Icon = ICON_MAP[key];
                  const active = linkForm.icon === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setLinkForm(f => ({ ...f, icon: key }))}
                      className={cn(
                        "w-full aspect-square rounded-xl flex items-center justify-center border transition-all",
                        active
                          ? "bg-slate-900 border-slate-900 text-white shadow-lg"
                          : "bg-white border-slate-200 text-slate-500 hover:border-slate-400 hover:text-slate-700"
                      )}
                    >
                      <Icon size={15} />
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Cor</label>
              <div className="grid grid-cols-6 gap-1.5">
                {COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setLinkForm(f => ({ ...f, color: c }))}
                    className={cn(
                      "w-full aspect-square rounded-full border-2 transition-all hover:scale-110 active:scale-95",
                      linkForm.color === c ? "border-slate-900 scale-110 shadow-md" : "border-transparent"
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {/* ── Modal: Confirmar exclusão de link ───────────── */}
      <Modal
        open={!!deleteLink}
        onClose={() => setDeleteLink(null)}
        title="Remover acesso"
        size="sm"
        footer={
          <>
            <button onClick={() => setDeleteLink(null)} className="flex-1 h-10 border border-slate-200 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-slate-50 transition-colors">
              Cancelar
            </button>
            <button
              onClick={confirmDeleteLink}
              className="flex-1 h-10 bg-red-600 text-white rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-red-700 transition-all shadow-lg shadow-red-100"
            >
              Remover
            </button>
          </>
        }
      >
        <div className="flex items-center gap-4 p-4 bg-red-50 rounded-xl">
          {deleteLink && <IconCircle icon={deleteLink.icon} color={deleteLink.color} size={44} />}
          <div>
            <p className="text-sm font-bold text-slate-900">{deleteLink?.label}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Esta ação não pode ser desfeita.</p>
          </div>
        </div>
      </Modal>

      {/* ── Modal: Confirmar exclusão de tarefa ─────────── */}
      <Modal
        open={!!deleteTask}
        onClose={() => setDeleteTask(null)}
        title="Remover tarefa"
        size="sm"
        footer={
          <>
            <button onClick={() => setDeleteTask(null)} className="flex-1 h-10 border border-slate-200 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-slate-50 transition-colors">
              Cancelar
            </button>
            <button
              onClick={confirmDeleteTask}
              className="flex-1 h-10 bg-red-600 text-white rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-red-700 transition-all shadow-lg shadow-red-100"
            >
              Remover
            </button>
          </>
        }
      >
        <div className="p-4 bg-red-50 rounded-xl">
          <p className="text-sm font-medium text-slate-700 leading-snug">"{deleteTask?.text}"</p>
          <p className="text-[10px] text-slate-400 font-bold uppercase mt-2">Esta ação não pode ser desfeita.</p>
        </div>
      </Modal>
    </div>
  );
}
