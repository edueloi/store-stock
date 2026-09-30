import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowUpRight,
  BarChart3,
  Box,
  CheckCircle2,
  ClipboardList,
  CircleDollarSign,
  ExternalLink,
  Image,
  LayoutDashboard,
  Loader2,
  MapPin,
  Package,
  Palette,
  Settings2,
  ShoppingBag,
  ShoppingCart,
  Store,
  Truck,
  UserRound,
  Wallet,
} from "lucide-react";

import PageHeader from "../../components/layout/PageHeader";
import { cn } from "../../lib/utils";
import type { Tenant } from "../../types";

type Tab = "visao" | "vendas" | "faturamento" | "configurar";
type StoreData = {
  summary: { orders: number; confirmed_orders: number; pending_orders: number; confirmed_revenue: number; potential_revenue: number; discounts: number; units_sold: number };
  top_products: Array<{ name: string; sku: string | null; units: number; revenue: number }>;
  recent_orders: Array<{ id: number; customer_name: string | null; customer_phone: string | null; customer_document: string | null; customer_address: string | null; total_amount: number; gross_amount: number | null; discount_amount: number | null; shipping_amount: number; delivery_method: string | null; payment_method: string | null; status: string; created_at: string; items: Array<{ quantity: number; unit_price: number; product?: { name: string; sku: string | null } | null; name: string | null }> }>;
};

const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}` });
const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const statusLabel: Record<string, string> = { completed: "Confirmado", pending: "Aguardando", cancelled: "Cancelado", canceled: "Cancelado" };
const paymentLabel: Record<string, string> = { pix: "PIX", cash_on_delivery: "Dinheiro na entrega", card_on_delivery: "Cartão na entrega" };
const deliveryLabel: Record<string, string> = { pickup: "Retirada na loja", delivery: "Entrega no endereço" };

export default function MinhaLoja() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("visao");
  const [tenant, setTenant] = useState<Partial<Tenant> | null>(null);
  const [data, setData] = useState<StoreData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [tenantResponse, dashboardResponse] = await Promise.all([
        fetch("/api/tenant", { headers: authHeaders() }),
        fetch("/api/store-dashboard?days=365", { headers: authHeaders() }),
      ]);
      if (tenantResponse.ok) setTenant(await tenantResponse.json());
      if (dashboardResponse.ok) setData(await dashboardResponse.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const storeLink = tenant?.public_url || (tenant?.slug ? `/s/${tenant.slug}` : "#");
  const onlineActive = tenant?.policies?.storefront?.checkout_mode === "online";
  const paymentMethods = tenant?.policies?.storefront?.checkout_payment_methods || {};
  const activePayments = [paymentMethods.pix && "PIX", paymentMethods.cash_on_delivery && "Dinheiro", paymentMethods.card_on_delivery && "Cartão"].filter(Boolean);
  const metrics = useMemo(() => [
    { label: "Faturamento confirmado", value: money(data?.summary.confirmed_revenue || 0), icon: CircleDollarSign, tone: "text-emerald-600 bg-emerald-50" },
    { label: "Pedidos online", value: String(data?.summary.orders || 0), icon: ShoppingBag, tone: "text-blue-600 bg-blue-50" },
    { label: "Unidades vendidas", value: String(data?.summary.units_sold || 0), icon: Package, tone: "text-violet-600 bg-violet-50" },
    { label: "Aguardando confirmação", value: String(data?.summary.pending_orders || 0), icon: Wallet, tone: "text-amber-600 bg-amber-50" },
  ], [data]);

  const goSettings = (section: string) => navigate(`/admin/minha-loja/configurar?tab=${section}`);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Minha Loja"
        subtitle="Central da sua vitrine: catálogo, checkout, vendas e faturamento online."
        action={<a href={storeLink} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-950 px-4 text-[11px] font-black uppercase tracking-wider text-white hover:bg-slate-800"><ExternalLink size={14} /> Ver minha loja</a>}
      />

      <div className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1">
        {[
          ["visao", "Visão geral", LayoutDashboard],
          ["vendas", "Vendas online", ShoppingCart],
          ["faturamento", "Faturamento", BarChart3],
          ["configurar", "Configurar loja", Settings2],
        ].map(([id, label, Icon]) => <button key={id as string} onClick={() => setTab(id as Tab)} className={cn("flex h-10 shrink-0 items-center gap-2 rounded-lg px-4 text-[11px] font-black transition", tab === id ? "bg-blue-600 text-white shadow-sm" : "text-slate-500 hover:bg-slate-50")}><Icon size={14} />{label}</button>)}
      </div>

      {loading ? <div className="flex h-64 items-center justify-center"><Loader2 className="animate-spin text-slate-300" /></div> : <>
        {tab === "visao" && <div className="space-y-5">
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {metrics.map(({ label, value, icon: Icon, tone }) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className={cn("mb-5 flex h-10 w-10 items-center justify-center rounded-xl", tone)}><Icon size={19} /></div><p className="text-2xl font-black tracking-tight text-slate-900">{value}</p><p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p></div>)}
          </section>
          <section className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-blue-600">Vitrine pública</p><h2 className="mt-2 text-xl font-black text-slate-900">{tenant?.name || "Sua loja"}</h2><p className="mt-2 max-w-lg text-sm leading-relaxed text-slate-500">{onlineActive ? "Checkout online ativo. Os clientes podem informar entrega e enviar o pedido pela vitrine." : "A vitrine está no modo atendimento. Ative o checkout online quando as regras de entrega e pagamento estiverem prontas."}</p></div>{tenant?.logo_url ? <img className="h-14 w-14 rounded-xl border border-slate-100 object-contain" src={tenant.logo_url} alt="Logo da loja" /> : <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-slate-100 text-slate-400"><Store size={22} /></div>}</div><div className="mt-6 flex flex-wrap gap-2"><button onClick={() => goSettings("storefront")} className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-[10px] font-black uppercase tracking-wider text-white"><ShoppingCart size={14} /> Configurar checkout</button><button onClick={() => goSettings("design")} className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-4 text-[10px] font-black uppercase tracking-wider text-slate-700"><Palette size={14} /> Editar visual</button></div></div>
            <div className="rounded-2xl border border-slate-200 bg-slate-950 p-6 text-white shadow-sm"><p className="text-[10px] font-black uppercase tracking-[.18em] text-blue-300">Status do checkout</p><div className="mt-5 space-y-4"><div className="flex items-center justify-between border-b border-white/10 pb-4"><span className="text-sm text-slate-300">Vendas online</span><span className={cn("rounded-full px-3 py-1 text-[10px] font-black uppercase", onlineActive ? "bg-emerald-400 text-emerald-950" : "bg-amber-300 text-amber-950")}>{onlineActive ? "Ativo" : "Atendimento"}</span></div><div><p className="text-xs font-bold text-white">Formas configuradas</p><p className="mt-1 text-xs text-slate-400">{activePayments.length ? activePayments.join(" · ") : "Nenhuma forma manual configurada"}</p></div><div><p className="text-xs font-bold text-white">Pedidos em aberto</p><p className="mt-1 text-2xl font-black">{data?.summary.pending_orders || 0}</p></div></div></div>
          </section>
          <RecentOrders orders={(data?.recent_orders || []).slice(0, 5)} />
        </div>}

        {tab === "vendas" && <div className="space-y-5"><OnlineOrders orders={data?.recent_orders || []} /><div className="grid gap-5 lg:grid-cols-2"><div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><p className="text-[10px] font-black uppercase tracking-[.18em] text-slate-400">Produtos mais vendidos</p><h2 className="mt-2 text-lg font-black text-slate-900">Unidades da loja online</h2><div className="mt-5 divide-y divide-slate-100">{data?.top_products.length ? data.top_products.map((product, index) => <div key={`${product.name}-${index}`} className="flex items-center justify-between gap-4 py-3"><div><p className="text-sm font-bold text-slate-800">{product.name}</p><p className="mt-1 text-[10px] text-slate-400">{product.sku ? `SKU ${product.sku} · ` : ""}{product.units} unidades</p></div><p className="text-sm font-black text-slate-900">{money(product.revenue)}</p></div>) : <Empty text="Os produtos vendidos pela vitrine aparecerão aqui." />}</div></div><div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-6"><p className="text-[10px] font-black uppercase tracking-[.18em] text-blue-600">Conferência rápida</p><h2 className="mt-2 text-lg font-black text-slate-900">Pedidos com informação completa</h2><p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600">Selecione qualquer pedido acima para conferir cliente, endereço, itens, valores, desconto, frete, pagamento e situação. Os dados ficam disponíveis por até 12 meses.</p></div></div></div>}

        {tab === "faturamento" && <div className="space-y-5"><section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Faturamento confirmado" value={money(data?.summary.confirmed_revenue || 0)} /><Metric label="Em pedidos ativos" value={money(data?.summary.potential_revenue || 0)} /><Metric label="Descontos aplicados" value={money(data?.summary.discounts || 0)} /><Metric label="Pedidos confirmados" value={String(data?.summary.confirmed_orders || 0)} /></section><div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><p className="text-[10px] font-black uppercase tracking-[.18em] text-slate-400">Leitura do período</p><h2 className="mt-2 text-lg font-black text-slate-900">Últimos 30 dias da loja online</h2><p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">Faturamento confirmado considera somente pedidos concluídos. Pedidos pendentes ficam separados para que você não conte uma venda antes de receber ou confirmar o pagamento.</p><div className="mt-6 grid gap-3 md:grid-cols-3"><Info label="Ticket médio confirmado" value={data?.summary.confirmed_orders ? money((data.summary.confirmed_revenue || 0) / data.summary.confirmed_orders) : money(0)} /><Info label="Unidades vendidas" value={String(data?.summary.units_sold || 0)} /><Info label="Pedidos aguardando" value={String(data?.summary.pending_orders || 0)} /></div></div></div>}

        {tab === "configurar" && <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"><ConfigCard icon={Image} title="Identidade da loja" text="Nome, logo, endereço, redes sociais e dados que aparecem para o cliente." action="Editar identidade" onClick={() => goSettings("identity")} /><ConfigCard icon={Palette} title="Visual da vitrine" text="Modelo, cores, imagens de capa, textos da home e experiência do catálogo." action="Personalizar visual" onClick={() => goSettings("design")} /><ConfigCard icon={Box} title="Catálogo e categorias" text="Produtos, fotos, variações, descrições, preços, estoque e categorias da loja." action="Abrir catálogo" onClick={() => navigate("/admin/catalog")} /><ConfigCard icon={ShoppingCart} title="Checkout e entrega" text="WhatsApp, reserva, checkout, CEP atendido, retirada e formas de pagamento." action="Configurar checkout" onClick={() => goSettings("storefront")} /><ConfigCard icon={CircleDollarSign} title="Contas de recebimento" text="Conecte a conta própria da loja no Mercado Pago ou Asaas. Tokens ficam protegidos." action="Ver integrações" onClick={() => goSettings("storefront")} /><ConfigCard icon={BarChart3} title="Vendas online" text="Acompanhe pedidos, faturamento, descontos, produtos e unidades vendidas." action="Ver vendas" onClick={() => setTab("vendas")} /></div>}
      </>}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-2xl font-black tracking-tight text-slate-900">{value}</p><p className="mt-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p></div>; }
function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-slate-50 p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-2 text-lg font-black text-slate-900">{value}</p></div>; }
function Empty({ text }: { text: string }) { return <p className="py-10 text-center text-sm text-slate-400">{text}</p>; }
function ConfigCard({ icon: Icon, title, text, action, onClick }: { icon: typeof Store; title: string; text: string; action: string; onClick: () => void }) { return <button onClick={onClick} className="group rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><Icon size={20} /></div><h2 className="mt-5 text-base font-black text-slate-900">{title}</h2><p className="mt-2 min-h-10 text-sm leading-relaxed text-slate-500">{text}</p><span className="mt-5 inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-blue-600">{action}<ArrowUpRight size={14} /></span></button>; }
function OnlineOrders({ orders }: { orders: StoreData["recent_orders"] }) {
  const [selectedId, setSelectedId] = useState<number | null>(orders[0]?.id ?? null);
  const selected = orders.find((order) => order.id === selectedId) || orders[0];

  return <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <div className="flex flex-col justify-between gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:p-6">
      <div><p className="text-[10px] font-black uppercase tracking-[.18em] text-blue-600">Central de pedidos</p><h2 className="mt-2 text-xl font-black text-slate-900">Vendas online</h2><p className="mt-1 text-sm text-slate-500">Selecione um pedido para consultar todos os dados da venda, da entrega e do pagamento.</p></div>
      <span className="inline-flex w-fit items-center gap-2 rounded-full bg-slate-100 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-slate-600"><ClipboardList size={14} /> {orders.length} pedido(s) nos últimos 12 meses</span>
    </div>
    {!orders.length ? <Empty text="Nenhuma venda online neste período." /> : <div className="grid xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,.9fr)]">
      <div className="border-b border-slate-100 xl:border-b-0 xl:border-r">
        <div className="max-h-[620px] overflow-auto">
          <table className="w-full min-w-[720px] text-left"><thead className="sticky top-0 z-10 bg-slate-50"><tr className="text-[10px] font-black uppercase tracking-wider text-slate-400"><th className="px-5 py-3">Pedido</th><th className="px-3 py-3">Cliente</th><th className="px-3 py-3">Entrega</th><th className="px-3 py-3">Pagamento</th><th className="px-3 py-3">Status</th><th className="px-5 py-3 text-right">Total</th></tr></thead><tbody>{orders.map((order) => <tr key={order.id} onClick={() => setSelectedId(order.id)} className={cn("cursor-pointer border-t border-slate-100 text-sm transition", selected?.id === order.id ? "bg-blue-50/80" : "hover:bg-slate-50")}><td className="px-5 py-4"><p className="font-black text-slate-900">#{order.id}</p><p className="mt-1 text-[10px] text-slate-400">{new Date(order.created_at).toLocaleDateString("pt-BR")} · {new Date(order.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p></td><td className="px-3 py-4"><p className="max-w-[150px] truncate font-bold text-slate-700">{order.customer_name || "Cliente não identificado"}</p><p className="mt-1 text-[10px] text-slate-400">{order.items.reduce((sum, item) => sum + item.quantity, 0)} item(ns)</p></td><td className="px-3 py-4 text-xs font-medium text-slate-600">{deliveryLabel[order.delivery_method || ""] || "A combinar"}</td><td className="px-3 py-4 text-xs font-medium text-slate-600">{paymentLabel[order.payment_method || ""] || order.payment_method || "—"}</td><td className="px-3 py-4"><span className={cn("rounded-full px-2.5 py-1 text-[9px] font-black uppercase", order.status === "completed" ? "bg-emerald-100 text-emerald-700" : order.status === "pending" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600")}>{statusLabel[order.status] || order.status}</span></td><td className="px-5 py-4 text-right font-black text-slate-900">{money(order.total_amount)}</td></tr>)}</tbody></table>
        </div>
      </div>
      {selected && <aside className="bg-slate-50/70 p-5 sm:p-6"><div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-blue-600">Detalhes do pedido</p><h3 className="mt-1 text-2xl font-black text-slate-900">#{selected.id}</h3></div><span className={cn("rounded-full px-3 py-1.5 text-[10px] font-black uppercase", selected.status === "completed" ? "bg-emerald-100 text-emerald-700" : selected.status === "pending" ? "bg-amber-100 text-amber-700" : "bg-slate-200 text-slate-600")}>{statusLabel[selected.status] || selected.status}</span></div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-1"><DetailCard icon={UserRound} label="Cliente" value={selected.customer_name || "Não informado"} detail={[selected.customer_phone, selected.customer_document ? `Documento: ${selected.customer_document}` : null].filter(Boolean).join(" · ") || "Sem contato informado"} /><DetailCard icon={Truck} label="Entrega" value={deliveryLabel[selected.delivery_method || ""] || "A combinar"} detail={selected.customer_address || "Endereço não informado"} /><DetailCard icon={ShoppingCart} label="Pagamento" value={paymentLabel[selected.payment_method || ""] || selected.payment_method || "Não informado"} detail={`Pedido feito em ${new Date(selected.created_at).toLocaleString("pt-BR")}`} /><DetailCard icon={MapPin} label="Situação da entrega" value={selected.delivery_method === "delivery" ? "Entregar no endereço" : "Retirada na loja"} detail={selected.delivery_method === "delivery" ? "Confira o endereço antes de separar o pedido." : "Separe o pedido para retirada do cliente."} /></div>
        <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4"><div className="flex items-center justify-between"><p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Itens do pedido</p><p className="text-xs font-bold text-slate-500">{selected.items.length} produto(s)</p></div><div className="mt-3 divide-y divide-slate-100">{selected.items.map((item, index) => <div key={`${item.product?.sku || item.name || "item"}-${index}`} className="py-3 first:pt-0 last:pb-0"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-bold text-slate-800">{item.product?.name || item.name || "Produto removido"}</p><p className="mt-1 text-[10px] text-slate-400">{item.product?.sku ? `SKU ${item.product.sku} · ` : ""}{item.quantity} × {money(item.unit_price)}</p></div><p className="shrink-0 text-sm font-black text-slate-900">{money(item.quantity * item.unit_price)}</p></div></div>)}</div></div>
        <div className="mt-5 rounded-xl bg-slate-950 p-4 text-white"><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Resumo financeiro</p><div className="mt-3 space-y-2 text-sm"><div className="flex justify-between text-slate-300"><span>Produtos</span><span>{money(selected.items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0))}</span></div><div className="flex justify-between text-slate-300"><span>Frete</span><span>{selected.shipping_amount ? money(selected.shipping_amount) : "Grátis / não informado"}</span></div>{selected.discount_amount ? <div className="flex justify-between text-emerald-300"><span>Desconto</span><span>− {money(selected.discount_amount)}</span></div> : null}<div className="flex justify-between border-t border-white/10 pt-3 text-base font-black"><span>Total do pedido</span><span>{money(selected.total_amount)}</span></div></div></div>
      </aside>}
    </div>}
  </section>;
}
function DetailCard({ icon: Icon, label, value, detail }: { icon: typeof UserRound; label: string; value: string; detail: string }) { return <div className="rounded-xl border border-slate-200 bg-white p-3.5"><div className="flex items-center gap-2 text-blue-600"><Icon size={14} /><p className="text-[10px] font-black uppercase tracking-wider">{label}</p></div><p className="mt-2 text-sm font-black text-slate-800">{value}</p><p className="mt-1 break-words text-[11px] leading-relaxed text-slate-500">{detail}</p></div>; }
function RecentOrders({ orders, full = false }: { orders: StoreData["recent_orders"]; full?: boolean }) { return <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-center justify-between"><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-slate-400">Pedidos online</p><h2 className="mt-2 text-lg font-black text-slate-900">{full ? "Todas as vendas recentes" : "Últimas vendas"}</h2></div><CheckCircle2 size={20} className="text-emerald-500" /></div><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[620px] text-left"><thead><tr className="border-b border-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-400"><th className="pb-3">Pedido</th><th className="pb-3">Cliente</th><th className="pb-3">Itens</th><th className="pb-3">Pagamento</th><th className="pb-3">Status</th><th className="pb-3 text-right">Total</th></tr></thead><tbody>{orders.length ? orders.map((order) => <tr key={order.id} className="border-b border-slate-50 text-sm"><td className="py-4 font-black text-slate-800">#{order.id}</td><td className="py-4"><p className="font-bold text-slate-700">{order.customer_name || "Cliente não identificado"}</p><p className="text-[10px] text-slate-400">{new Date(order.created_at).toLocaleDateString("pt-BR")}</p></td><td className="py-4 text-xs text-slate-600">{order.items.reduce((sum, item) => sum + item.quantity, 0)} unidade(s)</td><td className="py-4 text-xs text-slate-600">{paymentLabel[order.payment_method || ""] || order.payment_method || "—"}</td><td className="py-4"><span className={cn("rounded-full px-2.5 py-1 text-[9px] font-black uppercase", order.status === "completed" ? "bg-emerald-100 text-emerald-700" : order.status === "pending" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600")}>{statusLabel[order.status] || order.status}</span></td><td className="py-4 text-right font-black text-slate-900">{money(order.total_amount)}</td></tr>) : <tr><td colSpan={6}><Empty text="Nenhuma venda online neste período." /></td></tr>}</tbody></table></div></section>; }
