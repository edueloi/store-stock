import React, { useState, useEffect } from "react";
import {
  BarChart2, Eye, ShoppingCart, MessageCircle, MousePointerClick,
  TrendingUp, TrendingDown, Users, Package, Zap, Globe,
  Save, Check, Copy, ExternalLink, AlertCircle, ChevronRight,
  Activity, Target, ToggleLeft, ToggleRight, Info,
} from "lucide-react";
import PageHeader from "../../components/layout/PageHeader";
import { cn } from "../../lib/utils";

// ─── types ───────────────────────────────────────────────────────────────────

interface DashboardStats {
  summary: {
    revenue: number;
    expenses: number;
    stockValue: number;
    profit: number;
  };
  salesOverTime: { date: string; total: number }[];
}

interface TopProduct {
  name: string;
  total_sold: number;
}

interface PixelConfig {
  fb_pixel_id: string;
  fb_pixel_enabled: boolean;
  ga_measurement_id: string;
  ga_enabled: boolean;
}

// ─── helpers ─────────────────────────────────────────────────────────────────

const AUTH = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${localStorage.getItem("token")}`,
});

function fmt(n: number) {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtInt(n: number) {
  return n.toLocaleString("pt-BR");
}

// ─── sub-components ──────────────────────────────────────────────────────────

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="pb-4 border-b border-slate-100 mb-6">
      <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">{title}</h3>
      {subtitle && <p className="text-[10px] text-slate-400 font-medium mt-0.5">{subtitle}</p>}
    </div>
  );
}

interface KpiCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  trend?: "up" | "down" | "neutral";
  trendLabel?: string;
  accent?: "blue" | "emerald" | "amber" | "red" | "purple" | "slate";
  badge?: string;
}

const ACCENT_MAP = {
  blue:    { bg: "bg-blue-50",    icon: "text-blue-500",    val: "text-blue-700",    badge: "bg-blue-100 text-blue-700" },
  emerald: { bg: "bg-emerald-50", icon: "text-emerald-500", val: "text-emerald-700", badge: "bg-emerald-100 text-emerald-700" },
  amber:   { bg: "bg-amber-50",   icon: "text-amber-500",   val: "text-amber-700",   badge: "bg-amber-100 text-amber-700" },
  red:     { bg: "bg-red-50",     icon: "text-red-500",     val: "text-red-700",     badge: "bg-red-100 text-red-700" },
  purple:  { bg: "bg-purple-50",  icon: "text-purple-500",  val: "text-purple-700",  badge: "bg-purple-100 text-purple-700" },
  slate:   { bg: "bg-slate-50",   icon: "text-slate-400",   val: "text-slate-700",   badge: "bg-slate-100 text-slate-500" },
};

function KpiCard({ label, value, sub, icon, trend, trendLabel, accent = "blue", badge }: KpiCardProps) {
  const a = ACCENT_MAP[accent];
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", a.bg)}>
          <span className={a.icon}>{icon}</span>
        </div>
        {badge && (
          <span className={cn("text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full", a.badge)}>
            {badge}
          </span>
        )}
        {trend && !badge && (
          <div className={cn(
            "flex items-center gap-1 text-[10px] font-black",
            trend === "up" ? "text-emerald-600" : trend === "down" ? "text-red-500" : "text-slate-400",
          )}>
            {trend === "up" ? <TrendingUp size={12} /> : trend === "down" ? <TrendingDown size={12} /> : null}
            {trendLabel}
          </div>
        )}
      </div>
      <div>
        <p className="text-2xl font-black text-slate-900 tabular-nums leading-none">{value}</p>
        {sub && <p className="text-[10px] text-slate-400 font-medium mt-1">{sub}</p>}
      </div>
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
    </div>
  );
}

// Mini bar chart using divs (no lib dependency)
function MiniBarChart({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="flex items-end gap-1 h-20">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
          <div
            className="w-full bg-blue-100 rounded-t-md group-hover:bg-blue-500 transition-colors relative"
            style={{ height: `${Math.max(4, (d.value / max) * 100)}%` }}
          >
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[9px] font-bold px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
              {fmtInt(d.value)}
            </div>
          </div>
          <span className="text-[8px] font-bold text-slate-400 truncate w-full text-center">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={cn("w-11 h-6 rounded-full transition-all relative shadow-inner shrink-0", checked ? "bg-blue-600" : "bg-slate-200")}
    >
      <div className={cn("absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-sm", checked ? "left-6" : "left-1")} />
    </button>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy} className="p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-400 hover:text-slate-700">
      {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
    </button>
  );
}

// ─── NAV TABS ─────────────────────────────────────────────────────────────────

const TABS = [
  { id: "overview",  icon: BarChart2,          label: "Visão Geral" },
  { id: "store",     icon: Eye,                label: "Loja & Produtos" },
  { id: "marketing", icon: Target,             label: "Marketing & Pixels" },
  { id: "messages",  icon: MessageCircle,      label: "Mensagens" },
];

// GA snippet rendered safely outside JSX interpolation
function GaSnippetPreview({ measurementId }: { measurementId: string }) {
  const id = measurementId || "G-XXXXXXXXXX";
  const snippet = [
    "<!-- Google tag (gtag.js) -->",
    `<script async src="https://www.googletagmanager.com/gtag/js?id=${id}"></script>`,
    "<script>",
    "  window.dataLayer = window.dataLayer || [];",
    "  function gtag(){dataLayer.push(arguments);}",
    "  gtag('js', new Date());",
    `  gtag('config', '${id}');`,
    "</script>",
  ].join("\n");

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Preview do Código</p>
      <div className="bg-slate-900 rounded-xl p-4 relative">
        <div className="absolute top-3 right-3">
          <CopyButton text={snippet} />
        </div>
        <pre className="text-[9px] text-slate-300 font-mono leading-relaxed overflow-x-auto whitespace-pre pr-8">
          {snippet}
        </pre>
      </div>
      <p className="text-[9px] text-slate-400 font-medium">Este código é injetado automaticamente — não precisa adicionar manualmente.</p>
    </div>
  );
}

// ─── main ─────────────────────────────────────────────────────────────────────

export default function Analytics() {
  const [tab, setTab] = useState("overview");
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [loading, setLoading] = useState(true);

  // pixel config — loaded/saved via UserPreference
  const [pixels, setPixels] = useState<PixelConfig>({
    fb_pixel_id: "",
    fb_pixel_enabled: false,
    ga_measurement_id: "",
    ga_enabled: false,
  });
  const [pixelSaving, setPixelSaving] = useState(false);
  const [pixelSaved, setPixelSaved] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/stats", { headers: AUTH() }).then(r => r.json()),
      fetch("/api/stats/top-selling", { headers: AUTH() }).then(r => r.json()),
      fetch("/api/preferences/pixel_config", { headers: AUTH() }).then(r => r.json()),
    ]).then(([s, top, pref]) => {
      if (s?.summary) setStats(s);
      if (Array.isArray(top)) setTopProducts(top);
      if (pref && typeof pref === "object") setPixels(prev => ({ ...prev, ...pref }));
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const savePixels = async () => {
    setPixelSaving(true);
    try {
      await fetch("/api/preferences/pixel_config", {
        method: "PUT",
        headers: AUTH(),
        body: JSON.stringify({ value: pixels }),
      });
      setPixelSaved(true);
      setTimeout(() => setPixelSaved(false), 2500);
    } finally {
      setPixelSaving(false);
    }
  };

  // derive chart data from salesOverTime
  const chartData = (stats?.salesOverTime ?? []).map(d => ({
    label: new Date(d.date + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
    value: Number(d.total),
  }));

  const totalRevenue = stats?.summary.revenue ?? 0;
  const totalProfit  = stats?.summary.profit ?? 0;
  const totalOrders  = (stats?.salesOverTime ?? []).length; // proxy: days with sales

  return (
    <div className="space-y-6">
      <PageHeader
        title="Relatórios"
        subtitle="Desempenho da loja, rastreamento e integrações de marketing"
        action={pixelSaved ? (
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest">
            <Check size={13} strokeWidth={3} /> Configuração salva
          </div>
        ) : undefined}
      />

      {/* tab nav */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-2xl w-full overflow-x-auto no-scrollbar">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex items-center gap-2 px-4 h-9 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all flex-1 justify-center",
              tab === t.id
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-400 hover:text-slate-600",
            )}
          >
            <t.icon size={13} />
            {t.label}
          </button>
        ))}
      </div>

      {/* ── VISÃO GERAL ──────────────────────────────────────────────────── */}
      {tab === "overview" && (
        <div className="space-y-6">
          {loading ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-white rounded-2xl border border-slate-100 p-5 h-32 animate-pulse" />
              ))}
            </div>
          ) : (
            <>
              {/* KPI row */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard
                  label="Faturamento Total"
                  value={`R$ ${fmt(totalRevenue)}`}
                  sub="Pedidos concluídos"
                  icon={<TrendingUp size={18} />}
                  accent="emerald"
                  trend="up"
                  trendLabel="Período"
                />
                <KpiCard
                  label="Lucro Líquido"
                  value={`R$ ${fmt(totalProfit)}`}
                  sub="Receita − Despesas"
                  icon={<BarChart2 size={18} />}
                  accent={totalProfit >= 0 ? "blue" : "red"}
                  trend={totalProfit >= 0 ? "up" : "down"}
                />
                <KpiCard
                  label="Valor em Estoque"
                  value={`R$ ${fmt(stats?.summary.stockValue ?? 0)}`}
                  sub="Capital imobilizado"
                  icon={<Package size={18} />}
                  accent="amber"
                />
                <KpiCard
                  label="Dias com Vendas"
                  value={fmtInt(totalOrders)}
                  sub="Últimos 7 dias"
                  icon={<Activity size={18} />}
                  accent="purple"
                />
              </div>

              {/* chart + top products */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* bar chart */}
                <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Vendas por Dia</p>
                      <p className="text-sm font-black text-slate-900 mt-0.5">Últimos 7 dias</p>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full">
                      <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                      Dados reais
                    </div>
                  </div>
                  {chartData.length > 0 ? (
                    <div className="pt-4">
                      <MiniBarChart data={chartData} />
                    </div>
                  ) : (
                    <div className="h-20 flex items-center justify-center text-[10px] text-slate-300 font-bold uppercase tracking-widest">
                      Sem vendas no período
                    </div>
                  )}
                </div>

                {/* top products */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Top Produtos Vendidos</p>
                  {topProducts.length > 0 ? (
                    <div className="space-y-3">
                      {topProducts.map((p, i) => {
                        const maxSold = topProducts[0]?.total_sold ?? 1;
                        const pct = Math.round((p.total_sold / maxSold) * 100);
                        return (
                          <div key={i} className="space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold text-slate-700 truncate max-w-[70%]">{p.name}</span>
                              <span className="text-[10px] font-black text-slate-900 tabular-nums">{fmtInt(p.total_sold)} un</span>
                            </div>
                            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="h-20 flex items-center justify-center text-[10px] text-slate-300 font-bold uppercase tracking-widest text-center">
                      Nenhuma venda registrada
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── LOJA & PRODUTOS ──────────────────────────────────────────────── */}
      {tab === "store" && (
        <div className="space-y-6">
          {/* metrics info banner */}
          <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-100 rounded-2xl">
            <Info size={15} className="text-blue-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-blue-700">Rastreamento de Loja Pública</p>
              <p className="text-[10px] text-blue-700 font-medium leading-relaxed">
                As métricas de visualização de páginas e produtos são coletadas quando os visitantes acessam sua loja pública.
                Ative o Google Analytics ou Facebook Pixel na aba <strong>Marketing & Pixels</strong> para dados completos em tempo real.
              </p>
            </div>
          </div>

          {/* store metrics KPIs — preparados para dados reais via pixel */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard label="Visitas à Loja" value="—" sub="Requer Google Analytics" icon={<Globe size={18} />} accent="blue" badge="Configurar" />
            <KpiCard label="Visualiz. de Produtos" value="—" sub="Requer Google Analytics" icon={<Eye size={18} />} accent="purple" badge="Configurar" />
            <KpiCard label="Carrinhos Abandonados" value="—" sub="Requer Facebook Pixel" icon={<ShoppingCart size={18} />} accent="amber" badge="Configurar" />
            <KpiCard label="Taxa de Conversão" value="—" sub="Pedidos ÷ Visitas" icon={<MousePointerClick size={18} />} accent="emerald" badge="Configurar" />
          </div>

          {/* produtos mais vistos — top selling como proxy */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5">
            <SectionHeader
              title="Produtos Mais Vendidos"
              subtitle="Baseado em pedidos concluídos. Ative pixels para ver visualizações e cliques."
            />
            {topProducts.length > 0 ? (
              <div className="space-y-2">
                {topProducts.map((p, i) => {
                  const maxSold = topProducts[0]?.total_sold ?? 1;
                  const pct = Math.round((p.total_sold / maxSold) * 100);
                  const medals = ["🥇", "🥈", "🥉", "4º", "5º"];
                  return (
                    <div key={i} className="flex items-center gap-4 p-4 rounded-xl border border-slate-50 hover:border-slate-100 hover:bg-slate-50 transition-all">
                      <span className="text-lg w-8 text-center shrink-0">{medals[i] ?? `${i + 1}º`}</span>
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-bold text-slate-800 truncate">{p.name}</p>
                          <span className="text-xs font-black text-slate-900 tabular-nums shrink-0">{fmtInt(p.total_sold)} vendas</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-12 text-center">
                <Package size={32} strokeWidth={1} className="mx-auto text-slate-200 mb-3" />
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Nenhum produto vendido ainda</p>
              </div>
            )}
          </div>

          {/* carrinho abandonado — futuro */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <SectionHeader
              title="Carrinhos Abandonados"
              subtitle="Clientes que adicionaram produtos mas não finalizaram o pedido"
            />
            <div className="flex flex-col items-center justify-center py-10 gap-4">
              <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center">
                <ShoppingCart size={24} strokeWidth={1.5} className="text-amber-400" />
              </div>
              <div className="text-center max-w-xs space-y-2">
                <p className="text-xs font-black uppercase tracking-widest text-slate-500">Em breve</p>
                <p className="text-[10px] text-slate-400 font-medium leading-relaxed">
                  O rastreamento de carrinhos abandonados será ativado automaticamente quando o Facebook Pixel estiver configurado e o evento <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-blue-600">AddToCart</code> for disparado.
                </p>
              </div>
              <button
                onClick={() => setTab("marketing")}
                className="flex items-center gap-2 px-5 h-9 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all active:scale-95"
              >
                Configurar Pixel <ChevronRight size={12} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MARKETING & PIXELS ───────────────────────────────────────────── */}
      {tab === "marketing" && (
        <div className="space-y-6">
          {/* Facebook Pixel */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-50">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  {/* FB icon */}
                  <div className="w-10 h-10 rounded-xl bg-[#1877F2] flex items-center justify-center shrink-0">
                    <span className="text-white font-black text-lg leading-none">f</span>
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-900">Facebook Pixel</p>
                    <p className="text-[10px] text-slate-400 font-medium">Meta Ads · Conversões · Remarketing</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                    {pixels.fb_pixel_enabled ? "Ativo" : "Inativo"}
                  </span>
                  <Toggle
                    checked={pixels.fb_pixel_enabled}
                    onChange={v => setPixels(p => ({ ...p, fb_pixel_enabled: v }))}
                  />
                </div>
              </div>
            </div>
            <div className="p-6 space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                  Pixel ID
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={pixels.fb_pixel_id}
                    onChange={e => setPixels(p => ({ ...p, fb_pixel_id: e.target.value }))}
                    placeholder="Ex: 1234567890123456"
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 h-11 text-xs font-mono font-bold outline-none focus:ring-4 focus:ring-blue-500/8 focus:border-blue-500 transition-all"
                  />
                  {pixels.fb_pixel_id && <CopyButton text={pixels.fb_pixel_id} />}
                </div>
                <p className="text-[9px] text-slate-400 font-medium px-1">
                  Encontre em: Meta Business Suite → Gerenciador de Eventos → Pixel → Configurações
                </p>
              </div>

              {/* events tracked */}
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Eventos Rastreados</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { event: "PageView", desc: "Toda visita à loja", active: true },
                    { event: "ViewContent", desc: "Visualização de produto", active: true },
                    { event: "AddToCart", desc: "Produto adicionado", active: true },
                    { event: "InitiateCheckout", desc: "Início do checkout", active: true },
                    { event: "Purchase", desc: "Pedido finalizado", active: true },
                    { event: "Lead", desc: "Formulário enviado", active: false },
                  ].map(({ event, desc, active }) => (
                    <div
                      key={event}
                      className={cn(
                        "p-3 rounded-xl border text-left transition-all",
                        active && pixels.fb_pixel_id && pixels.fb_pixel_enabled
                          ? "border-emerald-200 bg-emerald-50"
                          : "border-slate-100 bg-slate-50 opacity-60",
                      )}
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <div className={cn("w-1.5 h-1.5 rounded-full", active ? "bg-emerald-500" : "bg-slate-300")} />
                        <p className="text-[9px] font-black uppercase tracking-wider text-slate-700 font-mono">{event}</p>
                      </div>
                      <p className="text-[9px] text-slate-400 font-medium">{desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              {pixels.fb_pixel_id && pixels.fb_pixel_enabled && (
                <div className="flex items-start gap-3 p-4 bg-emerald-50 border border-emerald-100 rounded-xl">
                  <Check size={14} className="text-emerald-600 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-emerald-800 font-medium leading-relaxed">
                    Pixel configurado. O código será injetado automaticamente em todas as páginas da sua loja pública quando você salvar.
                  </p>
                </div>
              )}

              {!pixels.fb_pixel_id && (
                <div className="flex items-start gap-3 p-4 bg-slate-50 border border-slate-100 rounded-xl">
                  <AlertCircle size={14} className="text-slate-400 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
                    Sem Pixel ID configurado. O rastreamento de conversões do Meta Ads não funcionará.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Google Analytics */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-50">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  {/* GA icon */}
                  <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 bg-white border border-slate-100 flex items-center justify-center">
                    <svg viewBox="0 0 24 24" width="24" height="24" fill="none">
                      <rect x="13" y="2" width="8" height="20" rx="2" fill="#F9AB00" />
                      <rect x="3" y="11" width="8" height="11" rx="2" fill="#E37400" />
                      <circle cx="7" cy="20" r="2" fill="#E37400" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-900">Google Analytics 4</p>
                    <p className="text-[10px] text-slate-400 font-medium">GA4 · Visitas · Comportamento · Funil</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                    {pixels.ga_enabled ? "Ativo" : "Inativo"}
                  </span>
                  <Toggle
                    checked={pixels.ga_enabled}
                    onChange={v => setPixels(p => ({ ...p, ga_enabled: v }))}
                  />
                </div>
              </div>
            </div>
            <div className="p-6 space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                  Measurement ID (GA4)
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden focus-within:ring-4 focus-within:ring-blue-500/8 focus-within:border-blue-500 transition-all bg-slate-50 flex-1">
                    <span className="bg-slate-100 border-r border-slate-200 px-3 h-11 flex items-center text-[10px] font-mono text-slate-400 shrink-0">G-</span>
                    <input
                      type="text"
                      value={pixels.ga_measurement_id.replace(/^G-/i, "")}
                      onChange={e => setPixels(p => ({ ...p, ga_measurement_id: `G-${e.target.value.replace(/^G-/i, "").toUpperCase()}` }))}
                      placeholder="XXXXXXXXXX"
                      className="flex-1 bg-transparent px-3 h-11 text-xs font-mono font-bold outline-none uppercase"
                    />
                  </div>
                  {pixels.ga_measurement_id && <CopyButton text={pixels.ga_measurement_id} />}
                </div>
                <p className="text-[9px] text-slate-400 font-medium px-1">
                  Encontre em: Google Analytics → Administrar → Fluxos de dados → Web → Measurement ID
                </p>
              </div>

              {/* GA events */}
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Eventos Rastreados</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { event: "page_view", desc: "Toda visita à loja", active: true },
                    { event: "view_item", desc: "Produto visualizado", active: true },
                    { event: "add_to_cart", desc: "Adicionado ao carrinho", active: true },
                    { event: "begin_checkout", desc: "Início do checkout", active: true },
                    { event: "purchase", desc: "Compra finalizada", active: true },
                    { event: "search", desc: "Busca na loja", active: true },
                  ].map(({ event, desc, active }) => (
                    <div
                      key={event}
                      className={cn(
                        "p-3 rounded-xl border text-left transition-all",
                        active && pixels.ga_measurement_id && pixels.ga_enabled
                          ? "border-blue-200 bg-blue-50"
                          : "border-slate-100 bg-slate-50 opacity-60",
                      )}
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <div className={cn("w-1.5 h-1.5 rounded-full", active ? "bg-blue-500" : "bg-slate-300")} />
                        <p className="text-[9px] font-black uppercase tracking-wider text-slate-700 font-mono">{event}</p>
                      </div>
                      <p className="text-[9px] text-slate-400 font-medium">{desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              {pixels.ga_measurement_id && pixels.ga_enabled && (
                <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-100 rounded-xl">
                  <Check size={14} className="text-blue-600 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-blue-800 font-medium leading-relaxed">
                    GA4 configurado. O script gtag.js será carregado automaticamente na loja pública. Visualize os dados em tempo real no{" "}
                    <a href="https://analytics.google.com" target="_blank" rel="noopener noreferrer" className="underline font-black hover:no-underline inline-flex items-center gap-0.5">
                      Google Analytics <ExternalLink size={10} />
                    </a>
                    .
                  </p>
                </div>
              )}

              {/* GA embed snippet preview */}
              {pixels.ga_measurement_id && (
                <GaSnippetPreview measurementId={pixels.ga_measurement_id} />
              )}
            </div>
          </div>

          {/* UTM helper */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
            <SectionHeader title="Dicas de Rastreamento" subtitle="Como usar UTMs e verificar sua implementação" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                {
                  title: "Facebook Pixel Helper",
                  desc: "Extensão do Chrome para verificar se o pixel está disparando corretamente nas páginas da loja.",
                  link: "https://chromewebstore.google.com/detail/meta-pixel-helper/fdgfkebogiimcoedlicjlajpkdmockpc",
                  label: "Instalar extensão",
                  color: "text-[#1877F2]",
                },
                {
                  title: "Google Tag Assistant",
                  desc: "Ferramenta do Google para verificar tags GTM e GA4 em tempo real.",
                  link: "https://tagassistant.google.com",
                  label: "Abrir Tag Assistant",
                  color: "text-[#4285F4]",
                },
                {
                  title: "Gerador de UTM",
                  desc: "Use UTMs nos seus links de campanha para rastrear a origem do tráfego no Google Analytics.",
                  link: "https://ga-dev-tools.google/campaign-url-builder/",
                  label: "Gerar UTM",
                  color: "text-emerald-600",
                },
              ].map(({ title, desc, link, label, color }) => (
                <div key={title} className="p-4 rounded-xl border border-slate-100 bg-slate-50 space-y-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-700">{title}</p>
                  <p className="text-[9px] text-slate-400 font-medium leading-relaxed">{desc}</p>
                  <a
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn("flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest hover:underline", color)}
                  >
                    {label} <ExternalLink size={10} />
                  </a>
                </div>
              ))}
            </div>
          </div>

          {/* save button */}
          <div className="flex justify-end pt-2">
            <button
              onClick={savePixels}
              disabled={pixelSaving}
              className="flex items-center gap-3 bg-blue-600 text-white px-8 h-12 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-blue-500/20 hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50"
            >
              {pixelSaving ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Save size={15} strokeWidth={2.5} />
              )}
              {pixelSaving ? "Salvando..." : "Salvar Configurações"}
            </button>
          </div>
        </div>
      )}

      {/* ── MENSAGENS ────────────────────────────────────────────────────── */}
      {tab === "messages" && (
        <div className="space-y-6">
          {/* whatsapp summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <KpiCard
              label="Mensagens Enviadas"
              value="—"
              sub="Via WhatsApp (pedidos)"
              icon={<MessageCircle size={18} />}
              accent="emerald"
              badge="Em breve"
            />
            <KpiCard
              label="Pedidos via WhatsApp"
              value={fmtInt(topProducts.reduce((a, p) => a + p.total_sold, 0))}
              sub="Total de itens vendidos"
              icon={<ShoppingCart size={18} />}
              accent="blue"
            />
            <KpiCard
              label="Clientes Alcançados"
              value="—"
              sub="Contatos únicos"
              icon={<Users size={18} />}
              accent="purple"
              badge="Em breve"
            />
          </div>

          {/* how it works */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5">
            <SectionHeader
              title="Fluxo de Mensagens WhatsApp"
              subtitle="Como os pedidos viram mensagens automáticas no WhatsApp"
            />
            <div className="space-y-3">
              {[
                { step: "01", title: "Cliente faz pedido na loja", desc: "O visitante seleciona produtos na sua loja pública e clica em \"Fazer Pedido\".", icon: "🛒" },
                { step: "02", title: "Sistema formata a mensagem", desc: "O pedido é convertido automaticamente em uma mensagem estruturada com itens, quantidades e total.", icon: "⚡" },
                { step: "03", title: "Redirecionamento ao WhatsApp", desc: "O cliente é redirecionado para o WhatsApp com a mensagem pré-preenchida para o número cadastrado.", icon: "💬" },
                { step: "04", title: "Pedido registrado no sistema", desc: "Simultaneamente, o pedido aparece na tela de Pedidos do painel para seu acompanhamento.", icon: "📋" },
              ].map(({ step, title, desc, icon }) => (
                <div key={step} className="flex items-start gap-4 p-4 rounded-xl border border-slate-50 hover:border-slate-100 hover:bg-slate-50/60 transition-all">
                  <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center shrink-0 text-lg">
                    {icon}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[9px] font-black text-slate-300 font-mono">{step}</span>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-800">{title}</p>
                    </div>
                    <p className="text-[10px] text-slate-400 font-medium leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* future features */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
            <SectionHeader title="Próximas Integrações" subtitle="Recursos planejados para comunicação e engajamento" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { title: "WhatsApp Business API", desc: "Envio automatizado de confirmações, atualizações de status e recuperação de carrinho via API oficial.", soon: true },
                { title: "Email Transacional", desc: "Confirmação de pedidos, recibos e recuperação de carrinho por e-mail.", soon: true },
                { title: "Push Notifications", desc: "Notificações no navegador para novos pedidos e alertas de estoque baixo.", soon: true },
                { title: "CRM Integrado", desc: "Histórico de interações, segmentação de clientes e campanhas direcionadas.", soon: false },
              ].map(({ title, desc, soon }) => (
                <div key={title} className="p-4 rounded-xl border border-slate-100 bg-slate-50 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-700">{title}</p>
                    <span className={cn(
                      "text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full",
                      soon ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-400"
                    )}>
                      {soon ? "Em breve" : "Roadmap"}
                    </span>
                  </div>
                  <p className="text-[9px] text-slate-400 font-medium leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
