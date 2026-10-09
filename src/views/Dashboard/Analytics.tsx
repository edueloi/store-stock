import React, { useState, useEffect } from "react";
import {
  BarChart2, Eye, ShoppingCart, MessageCircle, MousePointerClick,
  TrendingUp, Users, Package, Zap, Globe,
  Save, Check, Copy, ExternalLink, ChevronRight,
  Activity, Target, ClipboardList, Send,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis } from "recharts";
import { cn } from "../../lib/utils";
import { Alert, Badge, Button, EmptyState, IconButton, Input, PageWrapper, PanelCard, SectionTitle, StatCard, StatGrid, Switch, Tabs } from "../../components/ui";

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

type StatColor = "default" | "success" | "info" | "danger" | "purple" | "warning";

/** KPI do painel; os que ainda dependem de integração mostram um selo no lugar da tendência. */
function Kpi({ label, value, sub, icon, color, badge }: { label: string; value: string | number; sub?: string; icon: React.ElementType; color: StatColor; badge?: string }) {
  return (
    <div className="relative min-w-0">
      <StatCard title={label} value={value} icon={icon} color={color} description={sub} />
      {badge && <span className="absolute right-3 top-3"><Badge color="warning">{badge}</Badge></span>}
    </div>
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
    <IconButton size="sm" variant="ghost" aria-label="Copiar" onClick={copy}>
      {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
    </IconButton>
  );
}

// ─── NAV TABS ─────────────────────────────────────────────────────────────────

const TABS = [
  { id: "overview",  icon: BarChart2,     label: "Visão Geral" },
  { id: "store",     icon: Eye,           label: "Loja & Produtos" },
  { id: "marketing", icon: Target,        label: "Marketing & Pixels" },
  { id: "messages",  icon: MessageCircle, label: "Mensagens" },
] as const;
type TabId = typeof TABS[number]["id"];

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
      <p className="text-xs font-medium text-slate-600">Preview do Código</p>
      <div className="relative rounded-lg bg-slate-900 p-3">
        <div className="absolute right-2 top-2">
          <CopyButton text={snippet} />
        </div>
        <pre className="overflow-x-auto whitespace-pre pr-8 font-mono text-[11px] leading-relaxed text-slate-300">
          {snippet}
        </pre>
      </div>
      <p className="text-[11px] text-slate-500">Este código é injetado automaticamente — não precisa adicionar manualmente.</p>
    </div>
  );
}

function EventGrid({ events, ready, tone }: { events: { event: string; desc: string; active: boolean }[]; ready: boolean; tone: "emerald" | "blue" }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-slate-600">Eventos Rastreados</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {events.map(({ event, desc, active }) => (
          <div
            key={event}
            className={cn(
              "rounded-lg border p-2.5 text-left transition-all",
              active && ready
                ? tone === "emerald" ? "border-emerald-200 bg-emerald-50" : "border-blue-200 bg-blue-50"
                : "border-slate-100 bg-slate-50 opacity-60",
            )}
          >
            <div className="mb-1 flex items-center gap-1.5">
              <div className={cn("h-1.5 w-1.5 rounded-full", active ? (tone === "emerald" ? "bg-emerald-500" : "bg-blue-500") : "bg-slate-300")} />
              <p className="font-mono text-[11px] font-medium text-slate-700">{event}</p>
            </div>
            <p className="text-[11px] text-slate-500">{desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function TopProductsList({ products, unit, compact }: { products: TopProduct[]; unit: string; compact?: boolean }) {
  const maxSold = products[0]?.total_sold ?? 1;
  return (
    <div className={compact ? "space-y-3" : "space-y-2"}>
      {products.map((p, i) => {
        const pct = Math.round((p.total_sold / maxSold) * 100);
        return (
          <div key={i} className="min-w-0 space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate text-xs font-medium text-slate-700">{compact ? p.name : `${i + 1}º · ${p.name}`}</span>
              <span className="shrink-0 text-xs font-semibold tabular-nums text-slate-900">{fmtInt(p.total_sold)} {unit}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── main ─────────────────────────────────────────────────────────────────────

export default function Analytics() {
  const [tab, setTab] = useState<TabId>("overview");
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
    <PageWrapper>
      <div className="space-y-4">
        <SectionTitle
          icon={BarChart2}
          title="Relatórios"
          description="Desempenho da loja, rastreamento e integrações de marketing"
          action={pixelSaved ? <Badge color="success" icon={<Check size={12} />}>Configuração salva</Badge> : undefined}
        />

        <Tabs<TabId> items={TABS} value={tab} onChange={setTab} label="Seções de relatórios">
          {/* ── VISÃO GERAL ──────────────────────────────────────────────── */}
          {tab === "overview" && (
            <div className="space-y-3">
              {loading ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-20 animate-pulse rounded-lg border border-slate-200 bg-white" />
                  ))}
                </div>
              ) : (
                <>
                  <StatGrid cols={4}>
                    <StatCard title="Faturamento Total" value={`R$ ${fmt(totalRevenue)}`} description="Pedidos concluídos" icon={TrendingUp} color="success" />
                    <StatCard title="Lucro Líquido" value={`R$ ${fmt(totalProfit)}`} description="Receita − Despesas" icon={BarChart2} color={totalProfit >= 0 ? "info" : "danger"} />
                    <StatCard title="Valor em Estoque" value={`R$ ${fmt(stats?.summary.stockValue ?? 0)}`} description="Capital imobilizado" icon={Package} color="warning" />
                    <StatCard title="Dias com Vendas" value={fmtInt(totalOrders)} description="Últimos 7 dias" icon={Activity} color="purple" />
                  </StatGrid>

                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                    <PanelCard className="lg:col-span-2" title="Vendas por Dia" description="Últimos 7 dias" action={<Badge color="success" dot>Dados reais</Badge>}>
                      {chartData.length > 0 ? (
                        <div className="h-64 min-w-0">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                              <CartesianGrid vertical={false} stroke="#e2e8f0" />
                              <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#64748b" }} />
                              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#64748b" }} width={48} />
                              <ChartTooltip formatter={(v: number) => [`R$ ${fmt(Number(v))}`, "Vendas"]} contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }} />
                              <Bar dataKey="value" fill="#2563eb" radius={[3, 3, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <EmptyState title="Sem vendas no período" />
                      )}
                    </PanelCard>

                    <PanelCard title="Top Produtos Vendidos">
                      {topProducts.length > 0 ? (
                        <TopProductsList products={topProducts} unit="un" compact />
                      ) : (
                        <EmptyState title="Nenhuma venda registrada" />
                      )}
                    </PanelCard>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── LOJA & PRODUTOS ──────────────────────────────────────────── */}
          {tab === "store" && (
            <div className="space-y-3">
              <Alert variant="info" title="Rastreamento de Loja Pública">
                As métricas de visualização de páginas e produtos são coletadas quando os visitantes acessam sua loja pública.
                Ative o Google Analytics ou Facebook Pixel na aba <strong>Marketing & Pixels</strong> para dados completos em tempo real.
              </Alert>

              <StatGrid cols={4}>
                <Kpi label="Visitas à Loja" value="—" sub="Requer Google Analytics" icon={Globe} color="info" badge="Configurar" />
                <Kpi label="Visualiz. de Produtos" value="—" sub="Requer Google Analytics" icon={Eye} color="purple" badge="Configurar" />
                <Kpi label="Carrinhos Abandonados" value="—" sub="Requer Facebook Pixel" icon={ShoppingCart} color="warning" badge="Configurar" />
                <Kpi label="Taxa de Conversão" value="—" sub="Pedidos ÷ Visitas" icon={MousePointerClick} color="success" badge="Configurar" />
              </StatGrid>

              <PanelCard title="Produtos Mais Vendidos" description="Baseado em pedidos concluídos. Ative pixels para ver visualizações e cliques.">
                {topProducts.length > 0 ? (
                  <TopProductsList products={topProducts} unit="vendas" />
                ) : (
                  <EmptyState icon={Package} title="Nenhum produto vendido ainda" />
                )}
              </PanelCard>

              <PanelCard title="Carrinhos Abandonados" description="Clientes que adicionaram produtos mas não finalizaram o pedido">
                <EmptyState
                  icon={ShoppingCart}
                  title="Em breve"
                  description="O rastreamento de carrinhos abandonados será ativado automaticamente quando o Facebook Pixel estiver configurado e o evento AddToCart for disparado."
                  action={<Button size="sm" iconRight={<ChevronRight size={14} />} onClick={() => setTab("marketing")}>Configurar Pixel</Button>}
                />
              </PanelCard>
            </div>
          )}

          {/* ── MARKETING & PIXELS ───────────────────────────────────────── */}
          {tab === "marketing" && (
            <div className="space-y-3">
              {/* Facebook Pixel */}
              <PanelCard
                title="Facebook Pixel"
                description="Meta Ads · Conversões · Remarketing"
                action={
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">{pixels.fb_pixel_enabled ? "Ativo" : "Inativo"}</span>
                    <Switch checked={pixels.fb_pixel_enabled} aria-label="Ativar Facebook Pixel" onCheckedChange={v => setPixels(p => ({ ...p, fb_pixel_enabled: v }))} />
                  </div>
                }
              >
                <div className="space-y-4">
                  <div className="flex items-end gap-2">
                    <Input
                      wrapperClassName="flex-1"
                      label="Pixel ID"
                      type="text"
                      value={pixels.fb_pixel_id}
                      onChange={e => setPixels(p => ({ ...p, fb_pixel_id: e.target.value }))}
                      placeholder="Ex: 1234567890123456"
                      hint="Encontre em: Meta Business Suite → Gerenciador de Eventos → Pixel → Configurações"
                    />
                    {pixels.fb_pixel_id && <CopyButton text={pixels.fb_pixel_id} />}
                  </div>

                  <EventGrid
                    tone="emerald"
                    ready={!!(pixels.fb_pixel_id && pixels.fb_pixel_enabled)}
                    events={[
                      { event: "PageView", desc: "Toda visita à loja", active: true },
                      { event: "ViewContent", desc: "Visualização de produto", active: true },
                      { event: "AddToCart", desc: "Produto adicionado", active: true },
                      { event: "InitiateCheckout", desc: "Início do checkout", active: true },
                      { event: "Purchase", desc: "Pedido finalizado", active: true },
                      { event: "Lead", desc: "Formulário enviado", active: false },
                    ]}
                  />

                  {pixels.fb_pixel_id && pixels.fb_pixel_enabled && (
                    <Alert variant="success">
                      Pixel configurado. O código será injetado automaticamente em todas as páginas da sua loja pública quando você salvar.
                    </Alert>
                  )}

                  {!pixels.fb_pixel_id && (
                    <Alert variant="warning">
                      Sem Pixel ID configurado. O rastreamento de conversões do Meta Ads não funcionará.
                    </Alert>
                  )}
                </div>
              </PanelCard>

              {/* Google Analytics */}
              <PanelCard
                title="Google Analytics 4"
                description="GA4 · Visitas · Comportamento · Funil"
                action={
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">{pixels.ga_enabled ? "Ativo" : "Inativo"}</span>
                    <Switch checked={pixels.ga_enabled} aria-label="Ativar Google Analytics" onCheckedChange={v => setPixels(p => ({ ...p, ga_enabled: v }))} />
                  </div>
                }
              >
                <div className="space-y-4">
                  <div className="flex items-end gap-2">
                    <Input
                      wrapperClassName="flex-1"
                      label="Measurement ID (GA4)"
                      type="text"
                      addonLeft="G-"
                      value={pixels.ga_measurement_id.replace(/^G-/i, "")}
                      onChange={e => setPixels(p => ({ ...p, ga_measurement_id: `G-${e.target.value.replace(/^G-/i, "").toUpperCase()}` }))}
                      placeholder="XXXXXXXXXX"
                      hint="Encontre em: Google Analytics → Administrar → Fluxos de dados → Web → Measurement ID"
                    />
                    {pixels.ga_measurement_id && <CopyButton text={pixels.ga_measurement_id} />}
                  </div>

                  <EventGrid
                    tone="blue"
                    ready={!!(pixels.ga_measurement_id && pixels.ga_enabled)}
                    events={[
                      { event: "page_view", desc: "Toda visita à loja", active: true },
                      { event: "view_item", desc: "Produto visualizado", active: true },
                      { event: "add_to_cart", desc: "Adicionado ao carrinho", active: true },
                      { event: "begin_checkout", desc: "Início do checkout", active: true },
                      { event: "purchase", desc: "Compra finalizada", active: true },
                      { event: "search", desc: "Busca na loja", active: true },
                    ]}
                  />

                  {pixels.ga_measurement_id && pixels.ga_enabled && (
                    <Alert variant="info">
                      GA4 configurado. O script gtag.js será carregado automaticamente na loja pública. Visualize os dados em tempo real no{" "}
                      <a href="https://analytics.google.com" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 font-medium underline hover:no-underline">
                        Google Analytics <ExternalLink size={11} />
                      </a>
                      .
                    </Alert>
                  )}

                  {pixels.ga_measurement_id && (
                    <GaSnippetPreview measurementId={pixels.ga_measurement_id} />
                  )}
                </div>
              </PanelCard>

              {/* UTM helper */}
              <PanelCard title="Dicas de Rastreamento" description="Como usar UTMs e verificar sua implementação">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {[
                    {
                      title: "Facebook Pixel Helper",
                      desc: "Extensão do Chrome para verificar se o pixel está disparando corretamente nas páginas da loja.",
                      link: "https://chromewebstore.google.com/detail/meta-pixel-helper/fdgfkebogiimcoedlicjlajpkdmockpc",
                      label: "Instalar extensão",
                    },
                    {
                      title: "Google Tag Assistant",
                      desc: "Ferramenta do Google para verificar tags GTM e GA4 em tempo real.",
                      link: "https://tagassistant.google.com",
                      label: "Abrir Tag Assistant",
                    },
                    {
                      title: "Gerador de UTM",
                      desc: "Use UTMs nos seus links de campanha para rastrear a origem do tráfego no Google Analytics.",
                      link: "https://ga-dev-tools.google/campaign-url-builder/",
                      label: "Gerar UTM",
                    },
                  ].map(({ title, desc, link, label }) => (
                    <div key={title} className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
                      <p className="text-xs font-medium text-slate-700">{title}</p>
                      <p className="text-[11px] leading-relaxed text-slate-500">{desc}</p>
                      <a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[11px] font-medium text-blue-600 hover:underline">
                        {label} <ExternalLink size={11} />
                      </a>
                    </div>
                  ))}
                </div>
              </PanelCard>

              <div className="flex justify-end pt-1">
                <Button size="sm" onClick={savePixels} loading={pixelSaving} iconLeft={<Save size={14} />}>
                  {pixelSaving ? "Salvando..." : "Salvar Configurações"}
                </Button>
              </div>
            </div>
          )}

          {/* ── MENSAGENS ────────────────────────────────────────────────── */}
          {tab === "messages" && (
            <div className="space-y-3">
              <StatGrid cols={3}>
                <Kpi label="Mensagens Enviadas" value="—" sub="Via WhatsApp (pedidos)" icon={MessageCircle} color="success" badge="Em breve" />
                <StatCard title="Pedidos via WhatsApp" value={fmtInt(topProducts.reduce((a, p) => a + p.total_sold, 0))} description="Total de itens vendidos" icon={ShoppingCart} color="info" />
                <Kpi label="Clientes Alcançados" value="—" sub="Contatos únicos" icon={Users} color="purple" badge="Em breve" />
              </StatGrid>

              <PanelCard title="Fluxo de Mensagens WhatsApp" description="Como os pedidos viram mensagens automáticas no WhatsApp">
                <div className="space-y-2">
                  {[
                    { step: "01", title: "Cliente faz pedido na loja", desc: "O visitante seleciona produtos na sua loja pública e clica em \"Fazer Pedido\".", icon: ShoppingCart },
                    { step: "02", title: "Sistema formata a mensagem", desc: "O pedido é convertido automaticamente em uma mensagem estruturada com itens, quantidades e total.", icon: Zap },
                    { step: "03", title: "Redirecionamento ao WhatsApp", desc: "O cliente é redirecionado para o WhatsApp com a mensagem pré-preenchida para o número cadastrado.", icon: Send },
                    { step: "04", title: "Pedido registrado no sistema", desc: "Simultaneamente, o pedido aparece na tela de Pedidos do painel para seu acompanhamento.", icon: ClipboardList },
                  ].map(({ step, title, desc, icon: Icon }) => (
                    <div key={step} className="flex items-start gap-3 rounded-lg border border-slate-100 p-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-blue-100 bg-blue-50">
                        <Icon size={15} className="text-blue-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="mb-0.5 flex items-center gap-2">
                          <span className="font-mono text-[11px] text-slate-400">{step}</span>
                          <p className="text-xs font-medium text-slate-800">{title}</p>
                        </div>
                        <p className="text-[11px] leading-relaxed text-slate-500">{desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </PanelCard>

              <PanelCard title="Próximas Integrações" description="Recursos planejados para comunicação e engajamento">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {[
                    { title: "WhatsApp Business API", desc: "Envio automatizado de confirmações, atualizações de status e recuperação de carrinho via API oficial.", soon: true },
                    { title: "Email Transacional", desc: "Confirmação de pedidos, recibos e recuperação de carrinho por e-mail.", soon: true },
                    { title: "Push Notifications", desc: "Notificações no navegador para novos pedidos e alertas de estoque baixo.", soon: true },
                    { title: "CRM Integrado", desc: "Histórico de interações, segmentação de clientes e campanhas direcionadas.", soon: false },
                  ].map(({ title, desc, soon }) => (
                    <div key={title} className="space-y-1.5 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-medium text-slate-700">{title}</p>
                        <Badge color={soon ? "warning" : "default"}>{soon ? "Em breve" : "Roadmap"}</Badge>
                      </div>
                      <p className="text-[11px] leading-relaxed text-slate-500">{desc}</p>
                    </div>
                  ))}
                </div>
              </PanelCard>
            </div>
          )}
        </Tabs>
      </div>
    </PageWrapper>
  );
}
