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
  Pencil,
  Settings2,
  ShoppingBag,
  ShoppingCart,
  Store,
  Truck,
  UserRound,
  Wallet,
} from "lucide-react";

import {
  Alert, Badge, Button, DetailField, EmptyState, Input, Modal, ModalFooter, PageWrapper, PanelCard, SectionTitle, Select, StatCard, StatGrid, Tabs,
} from "../../components/ui";
import { cn } from "../../lib/utils";
import type { Tenant } from "../../types";

type Tab = "visao" | "vendas" | "faturamento" | "configurar";
type StoreData = {
  summary: {
    orders: number;
    confirmed_orders: number;
    pending_orders: number;
    confirmed_revenue: number;
    potential_revenue: number;
    discounts: number;
    units_sold: number;
  };
  top_products: Array<{
    name: string;
    sku: string | null;
    units: number;
    revenue: number;
  }>;
  recent_orders: Array<{
    id: number;
    customer_name: string | null;
    customer_phone: string | null;
    customer_document: string | null;
    customer_address: string | null;
    total_amount: number;
    gross_amount: number | null;
    discount_amount: number | null;
    shipping_amount: number;
    delivery_method: string | null;
    payment_method: string | null;
    status: string;
    created_at: string;
    items: Array<{
      product_id: number | null;
      quantity: number;
      unit_price: number;
      product?: { name: string; sku: string | null } | null;
      name: string | null;
    }>;
  }>;
};

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("token")}`,
});
const money = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const statusLabel: Record<string, string> = {
  completed: "Faturado",
  confirmed: "Confirmado",
  pending: "Aguardando confirmação",
  cancelled: "Cancelado",
  canceled: "Cancelado",
};
const paymentLabel: Record<string, string> = {
  pix: "PIX",
  money: "Dinheiro",
  debit: "Cartão de débito",
  credit: "Cartão de crédito",
  cash_on_delivery: "Dinheiro na entrega",
  card_on_delivery: "Cartão na entrega",
  to_confirm: "A confirmar",
};
const deliveryLabel: Record<string, string> = {
  pickup: "Retirada na loja",
  delivery: "Entrega no endereço",
  to_confirm: "A combinar",
};

const MINHA_LOJA_TABS = [
  { id: "visao", label: "Visão geral", icon: LayoutDashboard },
  { id: "vendas", label: "Vendas online", icon: ShoppingCart },
  { id: "faturamento", label: "Faturamento", icon: BarChart3 },
  { id: "configurar", label: "Configurar loja", icon: Settings2 },
] as const;

const statusBadgeColor = (status: string): "success" | "warning" | "default" =>
  status === "completed" ? "success" : status === "pending" ? "warning" : "default";

const thClass = "px-3 py-2 text-[11px] font-medium text-slate-500 whitespace-nowrap";

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

  useEffect(() => {
    load();
  }, []);

  const storeLink =
    tenant?.public_url || (tenant?.slug ? `/s/${tenant.slug}` : "#");
  const onlineActive = tenant?.policies?.storefront?.checkout_mode === "online";
  const paymentMethods =
    tenant?.policies?.storefront?.checkout_payment_methods || {};
  const activePayments = [
    paymentMethods.pix && "PIX",
    paymentMethods.cash_on_delivery && "Dinheiro",
    paymentMethods.card_on_delivery && "Cartão",
  ].filter(Boolean);
  const metrics = useMemo(
    () => [
      {
        label: "Faturamento confirmado",
        value: money(data?.summary.confirmed_revenue || 0),
        icon: CircleDollarSign,
        color: "success" as const,
      },
      {
        label: "Pedidos online",
        value: String(data?.summary.orders || 0),
        icon: ShoppingBag,
        color: "info" as const,
      },
      {
        label: "Unidades vendidas",
        value: String(data?.summary.units_sold || 0),
        icon: Package,
        color: "purple" as const,
      },
      {
        label: "Aguardando confirmação",
        value: String(data?.summary.pending_orders || 0),
        icon: Wallet,
        color: "warning" as const,
      },
    ],
    [data],
  );

  const goSettings = (section: string) =>
    navigate(`/admin/minha-loja/configurar?tab=${section}`);

  return (
    <PageWrapper>
      <div className="space-y-4">
        <SectionTitle
          icon={Store}
          title="Minha Loja"
          description="Central da sua vitrine: catálogo, checkout, vendas e faturamento online."
          action={
            <a href={storeLink} target="_blank" rel="noreferrer">
              <Button size="sm" iconLeft={<ExternalLink size={14} />}>Ver minha loja</Button>
            </a>
          }
        />

        <Tabs<Tab> items={MINHA_LOJA_TABS} value={tab} onChange={setTab} label="Seções da minha loja">
          {loading ? (
            <div role="status" className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
              <Loader2 size={18} className="animate-spin" />Carregando loja…
            </div>
          ) : (
            <>
              {tab === "visao" && (
                <div className="space-y-3">
                  <StatGrid cols={4}>
                    {metrics.map(({ label, value, icon, color }) => (
                      <StatCard key={label} title={label} value={value} icon={icon} color={color} />
                    ))}
                  </StatGrid>
                  <section className="grid gap-3 xl:grid-cols-[1.15fr_.85fr]">
                    <PanelCard title={tenant?.name || "Sua loja"} description="Vitrine pública" icon={Store}
                      action={
                        tenant?.logo_url ? (
                          <img className="h-10 w-10 rounded-lg border border-slate-100 object-contain" src={tenant.logo_url} alt="Logo da loja" />
                        ) : undefined
                      }>
                      <p className="max-w-lg text-[13px] leading-relaxed text-slate-600">
                        {onlineActive
                          ? "Checkout online ativo. Os clientes podem informar entrega e enviar o pedido pela vitrine."
                          : "A vitrine está no modo atendimento. Ative o checkout online quando as regras de entrega e pagamento estiverem prontas."}
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button size="sm" iconLeft={<ShoppingCart size={14} />} onClick={() => goSettings("storefront")}>Configurar checkout</Button>
                        <Button size="sm" variant="outline" iconLeft={<Palette size={14} />} onClick={() => goSettings("design")}>Editar visual</Button>
                      </div>
                    </PanelCard>
                    <PanelCard title="Status do checkout" icon={ShoppingBag}>
                      <dl className="space-y-3">
                        <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
                          <dt className="text-xs text-slate-600">Vendas online</dt>
                          <dd><Badge color={onlineActive ? "success" : "warning"} dot>{onlineActive ? "Ativo" : "Atendimento"}</Badge></dd>
                        </div>
                        <div>
                          <dt className="text-[11px] text-slate-500">Formas configuradas</dt>
                          <dd className="mt-0.5 text-[13px] text-slate-800">
                            {activePayments.length ? activePayments.join(" · ") : "Nenhuma forma manual configurada"}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[11px] text-slate-500">Pedidos em aberto</dt>
                          <dd className="mt-0.5 text-base font-medium text-slate-900">{data?.summary.pending_orders || 0}</dd>
                        </div>
                      </dl>
                    </PanelCard>
                  </section>
                  <RecentOrders orders={(data?.recent_orders || []).slice(0, 5)} />
                </div>
              )}

              {tab === "vendas" && (
                <div className="space-y-3">
                  <OnlineOrders orders={data?.recent_orders || []} />
                  <div className="grid gap-3 lg:grid-cols-2">
                    <PanelCard title="Unidades da loja online" description="Produtos mais vendidos" contentClassName="p-0">
                      <div className="divide-y divide-slate-100">
                        {data?.top_products.length ? (
                          data.top_products.map((product, index) => (
                            <div key={`${product.name}-${index}`} className="flex items-center justify-between gap-4 px-3 py-2">
                              <div className="min-w-0">
                                <p className="truncate text-xs font-medium text-slate-800">{product.name}</p>
                                <p className="mt-0.5 text-[11px] text-slate-500">
                                  {product.sku ? `SKU ${product.sku} · ` : ""}
                                  {product.units} unidades
                                </p>
                              </div>
                              <p className="shrink-0 text-xs font-semibold tabular-nums text-slate-900">{money(product.revenue)}</p>
                            </div>
                          ))
                        ) : (
                          <div className="p-3"><Empty text="Os produtos vendidos pela vitrine aparecerão aqui." /></div>
                        )}
                      </div>
                    </PanelCard>
                    <Alert variant="info" title="Pedidos com informação completa">
                      Selecione qualquer pedido acima para conferir cliente, endereço, itens, valores, desconto, frete,
                      pagamento e situação. Os dados ficam disponíveis por até 12 meses.
                    </Alert>
                  </div>
                </div>
              )}

              {tab === "faturamento" && (
                <div className="space-y-3">
                  <StatGrid cols={4}>
                    <StatCard title="Faturamento confirmado" value={money(data?.summary.confirmed_revenue || 0)} icon={CircleDollarSign} color="success" />
                    <StatCard title="Em pedidos ativos" value={money(data?.summary.potential_revenue || 0)} icon={Wallet} color="info" />
                    <StatCard title="Descontos aplicados" value={money(data?.summary.discounts || 0)} icon={ShoppingBag} color="warning" />
                    <StatCard title="Pedidos confirmados" value={String(data?.summary.confirmed_orders || 0)} icon={CheckCircle2} color="purple" />
                  </StatGrid>
                  <PanelCard title="Últimos 30 dias da loja online" description="Leitura do período">
                    <p className="max-w-2xl text-[13px] leading-relaxed text-slate-600">
                      Faturamento confirmado considera somente pedidos concluídos.
                      Pedidos pendentes ficam separados para que você não conte uma
                      venda antes de receber ou confirmar o pagamento.
                    </p>
                    <dl className="mt-4 grid gap-x-6 gap-y-3 md:grid-cols-3">
                      <DetailField
                        label="Ticket médio confirmado"
                        value={
                          data?.summary.confirmed_orders
                            ? money((data.summary.confirmed_revenue || 0) / data.summary.confirmed_orders)
                            : money(0)
                        }
                      />
                      <DetailField label="Unidades vendidas" value={String(data?.summary.units_sold || 0)} />
                      <DetailField label="Pedidos aguardando" value={String(data?.summary.pending_orders || 0)} />
                    </dl>
                  </PanelCard>
                </div>
              )}

              {tab === "configurar" && (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  <ConfigCard
                    icon={Image}
                    title="Identidade da loja"
                    text="Nome, logo, endereço, redes sociais e dados que aparecem para o cliente."
                    action="Editar identidade"
                    onClick={() => goSettings("identity")}
                  />
                  <ConfigCard
                    icon={Palette}
                    title="Visual da vitrine"
                    text="Modelo, cores, imagens de capa, textos da home e experiência do catálogo."
                    action="Personalizar visual"
                    onClick={() => goSettings("design")}
                  />
                  <ConfigCard
                    icon={Box}
                    title="Catálogo e categorias"
                    text="Produtos, fotos, variações, descrições, preços, estoque e categorias da loja."
                    action="Abrir catálogo"
                    onClick={() => navigate("/admin/catalog")}
                  />
                  <ConfigCard
                    icon={ShoppingCart}
                    title="Checkout e entrega"
                    text="WhatsApp, reserva, checkout, CEP atendido, retirada e formas de pagamento."
                    action="Configurar checkout"
                    onClick={() => goSettings("storefront")}
                  />
                  <ConfigCard
                    icon={CircleDollarSign}
                    title="Contas de recebimento"
                    text="Conecte a conta própria da loja no Mercado Pago ou Asaas. Tokens ficam protegidos."
                    action="Ver integrações"
                    onClick={() => goSettings("storefront")}
                  />
                  <ConfigCard
                    icon={BarChart3}
                    title="Vendas online"
                    text="Acompanhe pedidos, faturamento, descontos, produtos e unidades vendidas."
                    action="Ver vendas"
                    onClick={() => setTab("vendas")}
                  />
                </div>
              )}
            </>
          )}
        </Tabs>
      </div>
    </PageWrapper>
  );
}

function Empty({ text }: { text: string }) {
  return <EmptyState title={text} />;
}
function ConfigCard({
  icon: Icon,
  title,
  text,
  action,
  onClick,
}: {
  icon: typeof Store;
  title: string;
  text: string;
  action: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group rounded-lg border border-slate-200 bg-white p-3 text-left transition hover:border-blue-300"
    >
      <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-blue-100 bg-blue-50 text-blue-600">
        <Icon size={15} />
      </div>
      <h2 className="mt-3 text-sm font-medium text-slate-900">{title}</h2>
      <p className="mt-1 min-h-10 text-xs leading-relaxed text-slate-500">
        {text}
      </p>
      <span className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-blue-600">
        {action}
        <ArrowUpRight size={14} className="transition-transform group-hover:translate-x-0.5" />
      </span>
    </button>
  );
}
function OnlineOrders({
  orders,
  onChanged,
}: {
  orders: StoreData["recent_orders"];
  onChanged?: () => Promise<void>;
}) {
  const [selectedId, setSelectedId] = useState<number | null>(
    orders[0]?.id ?? null,
  );
  const selected = orders.find((order) => order.id === selectedId) || orders[0];
  const [paymentMethod, setPaymentMethod] = useState("pix");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [editingRequest, setEditingRequest] = useState(false);
  const updateOrder = async (status: "confirmed" | "completed") => {
    if (!selected) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const response = await fetch(`/api/orders/${selected.id}/status`, {
        method: "PUT",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          ...(status === "completed" ? { payment_method: paymentMethod } : {}),
        }),
      });
      if (!response.ok)
        throw new Error(
          (await response.json().catch(() => ({}))).error ||
            "Não foi possível atualizar o pedido.",
        );
      if (onChanged) await onChanged();
      else window.location.reload();
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Não foi possível atualizar o pedido.",
      );
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <PanelCard
      icon={ClipboardList}
      title="Vendas online"
      description="Selecione um pedido para consultar todos os dados da venda, da entrega e do pagamento."
      action={<Badge>{orders.length} pedido(s) nos últimos 12 meses</Badge>}
      contentClassName="p-0"
    >
      {!orders.length ? (
        <div className="p-3"><Empty text="Nenhuma venda online neste período." /></div>
      ) : (
        <div className="grid xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,.9fr)]">
          <div className="border-b border-slate-100 xl:border-b-0 xl:border-r">
            <div className="max-h-[620px] overflow-auto">
              <table className="w-full min-w-[720px] text-left">
                <thead className="sticky top-0 z-10 bg-zinc-50">
                  <tr>
                    <th className={thClass}>Pedido</th>
                    <th className={thClass}>Cliente</th>
                    <th className={thClass}>Entrega</th>
                    <th className={thClass}>Pagamento</th>
                    <th className={thClass}>Status</th>
                    <th className={cn(thClass, "text-right")}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr
                      key={order.id}
                      onClick={() => setSelectedId(order.id)}
                      className={cn(
                        "cursor-pointer border-t border-slate-100 text-xs transition",
                        selected?.id === order.id
                          ? "bg-blue-50/80"
                          : "hover:bg-slate-50",
                      )}
                    >
                      <td className="px-3 py-2">
                        <p className="font-medium text-slate-900">#{order.id}</p>
                        <p className="mt-0.5 text-[11px] text-slate-500">
                          {new Date(order.created_at).toLocaleDateString("pt-BR")} ·{" "}
                          {new Date(order.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </td>
                      <td className="px-3 py-2">
                        <p className="max-w-[150px] truncate font-medium text-slate-700">
                          {order.customer_name || "Cliente não identificado"}
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-500">
                          {order.items.reduce((sum, item) => sum + item.quantity, 0)} item(ns)
                        </p>
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-600">
                        {deliveryLabel[order.delivery_method || ""] || "A combinar"}
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-600">
                        {paymentLabel[order.payment_method || ""] || order.payment_method || "—"}
                      </td>
                      <td className="px-3 py-2">
                        <Badge color={statusBadgeColor(order.status)}>{statusLabel[order.status] || order.status}</Badge>
                      </td>
                      <td className="px-3 py-2 text-right text-xs font-semibold tabular-nums text-slate-900">
                        {money(order.total_amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {selected && (
            <aside className="space-y-3 bg-slate-50/70 p-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-medium text-blue-600">Detalhes do pedido</p>
                  <h3 className="mt-0.5 text-base font-medium text-slate-900">#{selected.id}</h3>
                </div>
                <Badge color={statusBadgeColor(selected.status)}>{statusLabel[selected.status] || selected.status}</Badge>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                <DetailCard
                  icon={UserRound}
                  label="Cliente"
                  value={selected.customer_name || "Não informado"}
                  detail={
                    [
                      selected.customer_phone,
                      selected.customer_document
                        ? `Documento: ${selected.customer_document}`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "Sem contato informado"
                  }
                />
                <DetailCard
                  icon={Truck}
                  label="Entrega"
                  value={deliveryLabel[selected.delivery_method || ""] || "A combinar"}
                  detail={selected.customer_address || "Endereço não informado"}
                />
                <DetailCard
                  icon={ShoppingCart}
                  label="Pagamento"
                  value={
                    paymentLabel[selected.payment_method || ""] ||
                    selected.payment_method ||
                    "Não informado"
                  }
                  detail={`Pedido feito em ${new Date(selected.created_at).toLocaleString("pt-BR")}`}
                />
                <DetailCard
                  icon={MapPin}
                  label="Situação da entrega"
                  value={
                    selected.delivery_method === "delivery"
                      ? "Entregar no endereço"
                      : "Retirada na loja"
                  }
                  detail={
                    selected.delivery_method === "delivery"
                      ? "Confira o endereço antes de separar o pedido."
                      : "Separe o pedido para retirada do cliente."
                  }
                />
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-slate-700">Itens do pedido</p>
                  <p className="text-[11px] text-slate-500">{selected.items.length} produto(s)</p>
                </div>
                <div className="mt-2 divide-y divide-slate-100">
                  {selected.items.map((item, index) => (
                    <div
                      key={`${item.product?.sku || item.name || "item"}-${index}`}
                      className="py-2 first:pt-0 last:pb-0"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="break-words text-xs font-medium text-slate-800">
                            {item.product?.name || item.name || "Produto removido"}
                          </p>
                          <p className="mt-0.5 text-[11px] text-slate-500">
                            {item.product?.sku ? `SKU ${item.product.sku} · ` : ""}
                            {item.quantity} × {money(item.unit_price)}
                          </p>
                        </div>
                        <p className="shrink-0 text-xs font-semibold tabular-nums text-slate-900">
                          {money(item.quantity * item.unit_price)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <p className="text-xs font-medium text-slate-700">Resumo financeiro</p>
                <div className="mt-2 space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Produtos</span>
                    <span className="tabular-nums">
                      {money(selected.items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0))}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Frete</span>
                    <span className="tabular-nums">
                      {selected.shipping_amount ? money(selected.shipping_amount) : "Grátis / não informado"}
                    </span>
                  </div>
                  {selected.discount_amount ? (
                    <div className="flex justify-between text-emerald-600">
                      <span>Desconto</span>
                      <span className="tabular-nums">− {money(selected.discount_amount)}</span>
                    </div>
                  ) : null}
                  <div className="flex justify-between border-t border-slate-100 pt-2 text-[13px] font-semibold text-slate-900">
                    <span>Total do pedido</span>
                    <span className="tabular-nums">{money(selected.total_amount)}</span>
                  </div>
                </div>
              </div>
              {!["completed", "cancelled", "canceled"].includes(selected.status) && (
                <Alert variant="info" title="Conferir e finalizar">
                  Enquanto estiver aguardando, você pode corrigir cliente, itens, valores, frete e condições antes de confirmar.
                  {selected.status === "pending" && (
                    <div className="mt-3 space-y-2">
                      <Button size="sm" variant="outline" fullWidth iconLeft={<Pencil size={13} />} onClick={() => setEditingRequest(true)}>Editar solicitação</Button>
                      <Button size="sm" variant="outline" fullWidth loading={actionLoading} onClick={() => updateOrder("confirmed")}>Confirmar pedido</Button>
                    </div>
                  )}
                  <div className="mt-3 grid grid-cols-[1fr_auto] items-end gap-2">
                    <Select
                      aria-label="Forma de pagamento"
                      size="sm"
                      value={paymentMethod}
                      onChange={(event) => setPaymentMethod(event.target.value)}
                      options={[
                        { value: "pix", label: "PIX" },
                        { value: "money", label: "Dinheiro" },
                        { value: "debit", label: "Cartão de débito" },
                        { value: "credit", label: "Cartão de crédito" },
                      ]}
                    />
                    <Button size="sm" disabled={actionLoading} onClick={() => updateOrder("completed")}>Faturar agora</Button>
                  </div>
                  {actionError && <p className="mt-3 text-xs font-medium text-red-600">{actionError}</p>}
                </Alert>
              )}
            </aside>
          )}
          {editingRequest && selected && (
            <PendingOrderEditor
              order={selected}
              onClose={() => setEditingRequest(false)}
              onSaved={async () => {
                setEditingRequest(false);
                if (onChanged) await onChanged();
                else window.location.reload();
              }}
            />
          )}
        </div>
      )}
    </PanelCard>
  );
}

const EDITOR_TABS = [
  { id: "cliente", label: "Cliente e entrega", icon: UserRound },
  { id: "itens", label: "Itens", icon: Package },
] as const;
type EditorTabId = typeof EDITOR_TABS[number]["id"];

function PendingOrderEditor({
  order,
  onClose,
  onSaved,
}: {
  order: StoreData["recent_orders"][number];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [editorTab, setEditorTab] = useState<EditorTabId>("cliente");
  const [customerName, setCustomerName] = useState(order.customer_name || "");
  const [customerPhone, setCustomerPhone] = useState(
    order.customer_phone || "",
  );
  const [customerAddress, setCustomerAddress] = useState(
    order.customer_address || "",
  );
  const [delivery, setDelivery] = useState(
    order.delivery_method || "to_confirm",
  );
  const [payment, setPayment] = useState(order.payment_method || "to_confirm");
  const [shipping, setShipping] = useState(String(order.shipping_amount || 0));
  const [items, setItems] = useState(
    order.items.map((item) => ({
      ...item,
      quantity: String(item.quantity),
      unit_price: String(item.unit_price),
    })),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const total =
    items.reduce(
      (sum, item) =>
        sum + (Number(item.quantity) || 0) * (Number(item.unit_price) || 0),
      0,
    ) + (Number(shipping) || 0);
  const updateItem = (
    index: number,
    field: "quantity" | "unit_price",
    value: string,
  ) =>
    setItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
    );
  const save = async () => {
    if (!items.length) {
      setError("Inclua ao menos um item.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/orders/${order.id}/pending-edit`, {
        method: "PUT",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_name: customerName,
          customer_phone: customerPhone,
          customer_address: customerAddress,
          delivery_method: delivery,
          payment_method: payment,
          shipping_amount: Number(shipping) || 0,
          items: items.map((item) => ({
            product_id: item.product_id,
            quantity: Number(item.quantity),
            unit_price: Number(item.unit_price),
          })),
        }),
      });
      if (!response.ok)
        throw new Error(
          (await response.json().catch(() => ({}))).error ||
            "Não foi possível salvar a solicitação.",
        );
      await onSaved();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Não foi possível salvar a solicitação.",
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal
      isOpen
      onClose={onClose}
      size="lg"
      title={`Editar solicitação — Pedido #${order.id}`}
      subtitle="Alterações permitidas antes da confirmação e do faturamento."
      footer={
        <ModalFooter align="between">
          <p className="text-xs text-slate-600">
            Total atualizado: <span className="font-semibold text-blue-700">{money(total)}</span>
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>Cancelar</Button>
            <Button size="sm" loading={saving} onClick={save}>Salvar alterações</Button>
          </div>
        </ModalFooter>
      }
    >
      <div className="space-y-3">
        <Tabs<EditorTabId> items={EDITOR_TABS} value={editorTab} onChange={setEditorTab} label="Edição da solicitação">
          {editorTab === "cliente" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label="Nome do cliente"
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
                placeholder="Nome do cliente"
              />
              <Input
                label="WhatsApp"
                value={customerPhone}
                onChange={(event) =>
                  setCustomerPhone(event.target.value.replace(/\D/g, "").slice(0, 15))
                }
                placeholder="WhatsApp"
              />
              <Input
                wrapperClassName="sm:col-span-2"
                label="Endereço ou referência"
                value={customerAddress}
                onChange={(event) => setCustomerAddress(event.target.value)}
                placeholder="Endereço ou referência"
              />
              <Select
                label="Entrega"
                value={delivery}
                onChange={(event) => setDelivery(event.target.value)}
                options={[
                  { value: "to_confirm", label: "Entrega a combinar" },
                  { value: "pickup", label: "Retirada na loja" },
                  { value: "delivery", label: "Entrega no endereço" },
                ]}
              />
              <Select
                label="Pagamento"
                value={payment}
                onChange={(event) => setPayment(event.target.value)}
                options={[
                  { value: "to_confirm", label: "Pagamento a confirmar" },
                  { value: "pix", label: "PIX" },
                  { value: "money", label: "Dinheiro" },
                  { value: "debit", label: "Cartão de débito" },
                  { value: "credit", label: "Cartão de crédito" },
                ]}
              />
            </div>
          )}

          {editorTab === "itens" && (
            <div className="space-y-3">
              <p className="text-[11px] text-slate-500">Ajuste quantidade e valor</p>
              <div className="space-y-2">
                {items.map((item, index) => (
                  <div
                    key={`${item.product_id}-${index}`}
                    className="grid gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-[1fr_88px_110px_auto] sm:items-center"
                  >
                    <p className="break-words text-xs font-medium text-slate-800">
                      {item.product?.name || item.name || "Produto"}
                    </p>
                    <Input
                      aria-label="Quantidade"
                      size="sm"
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(event) => updateItem(index, "quantity", event.target.value)}
                    />
                    <Input
                      aria-label="Valor unitário"
                      size="sm"
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.unit_price}
                      onChange={(event) => updateItem(index, "unit_price", event.target.value)}
                    />
                    <Button
                      variant="danger"
                      size="xs"
                      onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                    >
                      Remover
                    </Button>
                  </div>
                ))}
              </div>
              <Input
                wrapperClassName="sm:w-44"
                label="Frete"
                type="number"
                min="0"
                step="0.01"
                value={shipping}
                onChange={(event) => setShipping(event.target.value)}
              />
            </div>
          )}
        </Tabs>
        {error && <Alert variant="error">{error}</Alert>}
      </div>
    </Modal>
  );
}

function DetailCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof UserRound;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-center gap-2 text-blue-600">
        <Icon size={14} />
        <p className="text-[11px] font-medium">{label}</p>
      </div>
      <p className="mt-1.5 text-xs font-medium text-slate-800">{value}</p>
      <p className="mt-0.5 break-words text-[11px] leading-relaxed text-slate-500">
        {detail}
      </p>
    </div>
  );
}
function RecentOrders({
  orders,
  full = false,
}: {
  orders: StoreData["recent_orders"];
  full?: boolean;
}) {
  return (
    <PanelCard
      title={full ? "Todas as vendas recentes" : "Últimas vendas"}
      description="Pedidos online"
      action={<CheckCircle2 size={18} className="text-emerald-500" />}
      contentClassName="p-0"
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] text-left">
          <thead>
            <tr className="border-b border-slate-100 bg-zinc-50">
              <th className={thClass}>Pedido</th>
              <th className={thClass}>Cliente</th>
              <th className={thClass}>Itens</th>
              <th className={thClass}>Pagamento</th>
              <th className={thClass}>Status</th>
              <th className={cn(thClass, "text-right")}>Total</th>
            </tr>
          </thead>
          <tbody>
            {orders.length ? (
              orders.map((order) => (
                <tr key={order.id} className="border-b border-slate-50 text-xs">
                  <td className="px-3 py-2 font-medium text-slate-800">#{order.id}</td>
                  <td className="px-3 py-2">
                    <p className="font-medium text-slate-700">
                      {order.customer_name || "Cliente não identificado"}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {new Date(order.created_at).toLocaleDateString("pt-BR")}
                    </p>
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-600">
                    {order.items.reduce((sum, item) => sum + item.quantity, 0)} unidade(s)
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-600">
                    {paymentLabel[order.payment_method || ""] || order.payment_method || "—"}
                  </td>
                  <td className="px-3 py-2">
                    <Badge color={statusBadgeColor(order.status)}>{statusLabel[order.status] || order.status}</Badge>
                  </td>
                  <td className="px-3 py-2 text-right text-xs font-semibold tabular-nums text-slate-900">
                    {money(order.total_amount)}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="p-3">
                  <Empty text="Nenhuma venda online neste período." />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </PanelCard>
  );
}
