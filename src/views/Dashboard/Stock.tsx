import React, { useState, useEffect, useRef } from "react";
import {
  Plus,
  Minus,
  History,
  TrendingUp,
  AlertTriangle,
  ArrowRightLeft,
  Package,
  Calendar,
  Layers,
  ClipboardList,
  HelpCircle,
  Store
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  Badge,
  Button,
  ContentCard,
  FilterLine,
  FilterLineSearch,
  FilterLineSection,
  FilterLineSegmented,
  GridTable,
  IconButton,
  Modal,
  ModalFooter,
  PageWrapper,
  SectionTitle,
  StatCard,
  StatGrid,
  Tabs,
  Textarea,
  usePagination,
} from "../../components/ui";
import type { Column } from "../../components/ui";
import { Product } from "../../types";
import { cn } from "../../lib/utils";
import { onRealtimeAny } from "../../lib/realtime";
import StockPageTour, { STOCK_PAGE_TOUR_EVENTS, type StockPageTourHandle } from "../../components/onboarding/StockPageTour";

interface StockMovement {
  id: number;
  product_name: string;
  quantity: number;
  type: string;
  reason: string;
  created_at: string;
}

const TYPE_LABELS: Record<string, string> = {
  purchase: "Compra",
  adjustment: "Ajuste",
  loss: "Perda",
  return: "Devolução",
  in: "Importação XML",
  out: "Saída",
  consignment_out: "Saída p/ Consignação",
  consignment_return: "Devolução de Consignação",
  held_sale_out: "Saída (Venda em Espera)",
  held_sale_return: "Devolução (Venda em Espera)",
};

type VariationRow = { combo: Record<string, string>; stock: number; label: string };

// Lista as variações (combinações) de um produto: usa skus; se o produto for
// antigo (só `variations`), cada opção vira uma linha.
const getVariationRows = (p: Product | null): VariationRow[] => {
  if (!p) return [];
  if (Array.isArray(p.skus) && p.skus.length > 0) {
    return p.skus.map(s => ({ combo: s.combo, stock: Number(s.stock || 0), label: Object.values(s.combo).join(" / ") }));
  }
  if (Array.isArray(p.variations) && p.variations.length > 0) {
    return p.variations.flatMap(v => v.options.map(o => ({ combo: { [v.name]: o.value }, stock: Number(o.stock || 0), label: `${v.name}: ${o.value}` })));
  }
  return [];
};

const STOCK_VIEWS = [
  { id: 'inventory', label: 'Posição', icon: Package },
  { id: 'history', label: 'Auditoria', icon: History },
] as const;
type StockView = typeof STOCK_VIEWS[number]['id'];

export default function Stock() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedVariationKey, setSelectedVariationKey] = useState<string | null>(null);
  const [adjustmentValue, setAdjustmentValue] = useState(0);
  const [adjustmentType, setAdjustmentType] = useState("adjustment");
  const [adjustmentReason, setAdjustmentReason] = useState("");
  const [activeView, setActiveView] = useState<'inventory' | 'history'>('inventory');
  const [stockFilter, setStockFilter] = useState<'all' | 'out' | 'low' | 'expiring'>('all');
  const [lowStockThreshold, setLowStockThreshold] = useState(5);
  // Loja vende por encomenda/sem controle de estoque (Settings > Controle de
  // Caixa) — quando ligado, suprime cards/badges/filtros de "estoque crítico/
  // esgotado" porque a loja deliberadamente não controla estoque.
  const [sellWithoutStockControl, setSellWithoutStockControl] = useState(false);
  const openInCatalog = (p: { name: string }) => navigate(`/admin/catalog?q=${encodeURIComponent(p.name)}`);
  const PAGE_SIZE = 20;

  const stockPageTourRef = useRef<StockPageTourHandle>(null);

  const fetchData = async () => {
    try {
      const pRes = await fetch("/api/products", {
        headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
      });
      const mRes = await fetch("/api/products/movements", {
        headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
      });
      setProducts(await pRes.json());
      setMovements(await mRes.json());
      setLoading(false);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // Atualiza sozinho quando uma venda, cancelamento, ajuste ou OS mexe no estoque
  // em outra tela/terminal — sem precisar de F5.
  useEffect(() => onRealtimeAny(["stock:changed", "product:changed"], () => { fetchData(); }), []);

  useEffect(() => {
    fetch("/api/preferences/low_stock_alert", {
      headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((value) => { if (value !== null && Number(value) > 0) setLowStockThreshold(Number(value)); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/tenant", {
      headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data) setSellWithoutStockControl(!!data.sell_without_stock_control); })
      .catch(() => {});
  }, []);

  const openAdjust = (p: Product) => {
    setSelectedProduct(p);
    setSelectedVariationKey(null);
    setAdjustmentValue(0);
    setAdjustmentReason("");
    setAdjustmentType("adjustment");
    setIsAdjustmentModalOpen(true);
  };

  const variationRows = getVariationRows(selectedProduct);
  const selectedVariation = variationRows.find(v => JSON.stringify(v.combo) === selectedVariationKey) ?? null;
  const needsVariation = variationRows.length > 0 && !selectedVariation;

  const handleAdjustment = async () => {
    if (!selectedProduct || adjustmentValue === 0 || needsVariation) return;
    try {
      const res = await fetch("/api/products/stock-adjustment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify({
          productId: selectedProduct.id,
          quantity: adjustmentValue,
          combo: selectedVariation?.combo,
          type: adjustmentType,
          reason: adjustmentReason
        })
      });
      if (res.ok) {
        setIsAdjustmentModalOpen(false);
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // ── Canal de comunicação do TOUR DE PÁGINA (StockPageTour) ────────────────
  // Stock.tsx não tinha nenhum canal de tour antes; este é o primeiro. Abre o
  // modal de ajuste de verdade via openAdjust (com o primeiro produto da
  // lista, se houver) e fecha com setIsAdjustmentModalOpen(false) — o mesmo
  // que o botão "Cancelar" faz. Nunca chama handleAdjustment (que faz o POST
  // real em /api/products/stock-adjustment).
  useEffect(() => {
    const onOpenAdjustmentPage = () => {
      const list = Array.isArray(products) ? products : [];
      if (list.length > 0) openAdjust(list[0]);
    };
    const onCloseAdjustmentPage = () => setIsAdjustmentModalOpen(false);

    window.addEventListener(STOCK_PAGE_TOUR_EVENTS.openAdjustment, onOpenAdjustmentPage);
    window.addEventListener(STOCK_PAGE_TOUR_EVENTS.closeAdjustment, onCloseAdjustmentPage);
    return () => {
      window.removeEventListener(STOCK_PAGE_TOUR_EVENTS.openAdjustment, onOpenAdjustmentPage);
      window.removeEventListener(STOCK_PAGE_TOUR_EVENTS.closeAdjustment, onCloseAdjustmentPage);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products]);

  const searchedProducts = (Array.isArray(products) ? products : []).filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.sku && p.sku.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const expirySoonCutoff = new Date(Date.now() + 30 * 86400000);
  const isExpiringSoon = (p: Product) => !!p.expiry_date && new Date(p.expiry_date) <= expirySoonCutoff;
  // Loja vende por encomenda/sem controle de estoque — nunca marca um produto
  // como "estoque baixo" nos badges/indicadores visuais da linha/card.
  // Mínimo é por produto; 0 = sem aviso (padrão das lojas novas — o lojista só define mínimo onde quiser ser avisado).
  const minOf = (p: Product) => p.min_stock ?? lowStockThreshold;
  const isLowStock = (p: Product) => !sellWithoutStockControl && p.track_stock !== false && minOf(p) > 0 && p.stock_quantity <= minOf(p);

  // Loja vende por encomenda/sem controle de estoque — zera os contadores de
  // "esgotado"/"baixo estoque" (ela deliberadamente não controla estoque, não
  // faz sentido alertar sobre isso).
  const outCount = sellWithoutStockControl ? 0 : searchedProducts.filter(p => p.track_stock !== false && p.stock_quantity === 0).length;
  const lowOnlyCount = sellWithoutStockControl ? 0 : searchedProducts.filter(p => p.track_stock !== false && p.stock_quantity > 0 && minOf(p) > 0 && p.stock_quantity <= minOf(p)).length;
  const expiringCount = searchedProducts.filter(isExpiringSoon).length;
  const lowStockCount = searchedProducts.filter(isLowStock).length;
  const totalItems = searchedProducts.reduce((acc, p) => acc + p.stock_quantity, 0);
  const totalCost = searchedProducts.reduce((acc, p) => acc + (Number(p.cost_price || 0) * p.stock_quantity), 0);

  const STOCK_FILTERS = [
    { v: "all" as const, label: "Todos", count: searchedProducts.length },
    ...(sellWithoutStockControl ? [] : [
      { v: "out" as const, label: "Esgotado", count: outCount },
      { v: "low" as const, label: "Baixo estoque", count: lowOnlyCount },
    ]),
    { v: "expiring" as const, label: "Vencimento", count: expiringCount },
  ];

  const filteredProducts = searchedProducts.filter(p => {
    if (stockFilter === "out") return !sellWithoutStockControl && p.track_stock !== false && p.stock_quantity === 0;
    if (stockFilter === "low") return !sellWithoutStockControl && p.track_stock !== false && p.stock_quantity > 0 && minOf(p) > 0 && p.stock_quantity <= minOf(p);
    if (stockFilter === "expiring") return isExpiringSoon(p);
    return true;
  });

  const inventoryPagination = usePagination(filteredProducts, PAGE_SIZE);
  const historyPagination = usePagination(movements, PAGE_SIZE);

  const inventoryColumns: Column<Product>[] = [
    {
      header: "Produto / SKU",
      render: (p) => (
        <div className="flex flex-col">
          <span className="text-xs font-medium text-slate-800">{p.name}</span>
          <span className="mt-0.5 text-[11px] text-slate-500">SKU: {p.sku || String(p.id).padStart(6, '0')}</span>
          {getVariationRows(p).length > 0 && (
            <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-slate-500">
              <Layers size={11} /> {getVariationRows(p).length} variações
            </span>
          )}
        </div>
      ),
    },
    {
      header: "Validade",
      render: (p) => p.expiry_date ? (
        <div className={cn("flex items-center gap-1 text-xs whitespace-nowrap", new Date(p.expiry_date) < new Date() ? "text-red-600" : "text-slate-500")}>
          <Calendar size={12} />
          {new Date(p.expiry_date).toLocaleDateString('pt-BR')}
        </div>
      ) : (
        <span className="text-[11px] text-slate-400">N/A</span>
      ),
    },
    {
      header: "Custo",
      render: (p) => <span className="text-xs tabular-nums whitespace-nowrap text-slate-600">R$ {Number(p.cost_price || 0).toFixed(2)}</span>,
    },
    {
      header: "Saldo",
      render: (p) => (
        <div className="flex items-center gap-2">
          <span className={cn("text-xs font-semibold tabular-nums", isLowStock(p) ? "text-red-600" : "text-slate-800")}>
            {String(p.stock_quantity).padStart(3, '0')}
          </span>
          {isLowStock(p) && <AlertTriangle size={12} className="text-red-500" />}
        </div>
      ),
    },
    {
      header: "Impacto",
      render: (p) => <span className="text-xs font-semibold tabular-nums whitespace-nowrap text-slate-800">R$ {(Number(p.cost_price || 0) * p.stock_quantity).toFixed(2)}</span>,
    },
    {
      header: "Ações",
      className: "text-right",
      headerClassName: "text-right",
      render: (p) => (
        <div className="flex items-center justify-end gap-1.5">
          <IconButton variant="outline" size="sm" aria-label={`Ver ${p.name} no catálogo`} title="Ver no catálogo" onClick={() => openInCatalog(p)}>
            <Store size={13} />
          </IconButton>
          <IconButton data-tour="stock-adjust-btn" variant="outline" size="sm" aria-label={`Ajustar estoque de ${p.name}`} title="Ajustar estoque" onClick={() => openAdjust(p)}>
            <ArrowRightLeft size={13} />
          </IconButton>
        </div>
      ),
    },
  ];

  const historyColumns: Column<StockMovement>[] = [
    {
      header: "Data/Hora",
      render: (m) => <span className="text-xs whitespace-nowrap text-slate-500">{new Date(m.created_at).toLocaleString('pt-BR')}</span>,
    },
    {
      header: "Produto",
      render: (m) => <span className="text-xs font-medium text-slate-800">{m.product_name}</span>,
    },
    {
      header: "Tipo",
      render: (m) => <Badge color="info" size="sm">{TYPE_LABELS[m.type] || m.type}</Badge>,
    },
    {
      header: "Qtd",
      render: (m) => (
        <span className={cn("text-xs font-semibold tabular-nums whitespace-nowrap", m.quantity > 0 ? "text-emerald-700" : "text-red-600")}>
          {m.quantity > 0 ? '+' : ''}{m.quantity} UN
        </span>
      ),
    },
    {
      header: "Justificativa",
      render: (m) => <span className="max-w-sm break-words text-xs text-slate-500">{m.reason || "—"}</span>,
    },
  ];

  if (loading) return <div className="p-8 text-center text-xs font-medium text-slate-400">Processando Inventário...</div>;

  return (
    <PageWrapper data-tour="stock-page">
      <div className="space-y-4">
        <SectionTitle
          title="Estoque"
          description="Gestão de ativos, insumos e movimentações"
          icon={Package}
          action={
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                iconLeft={<HelpCircle size={14} />}
                onClick={() => stockPageTourRef.current?.start()}
                title="Tour guiado desta página"
              >
                <span className="sr-only sm:not-sr-only">Ajuda</span>
              </Button>
            </div>
          }
        />

        <StockPageTour ref={stockPageTourRef} />

        <StatGrid cols={sellWithoutStockControl ? 3 : 4}>
          <StatCard title="Volume Total" value={`${totalItems} UN`} icon={Layers} color="default" />
          <StatCard title="Capital" value={`R$ ${totalCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} icon={TrendingUp} color="info" />
          {/* Loja vende por encomenda/sem controle de estoque — card de "Críticos" não se aplica */}
          {!sellWithoutStockControl && (
            <StatCard title="Críticos" value={`${lowStockCount} ITENS`} icon={AlertTriangle} color={lowStockCount > 0 ? "danger" : "default"} />
          )}
          <StatCard title="Movimentos" value={`${movements.length} OPS`} icon={ClipboardList} color="default" />
        </StatGrid>

        <div data-tour="stock-view-inventory-btn">
          <Tabs<StockView> items={STOCK_VIEWS} value={activeView} onChange={setActiveView} label="Visões do estoque">
            {null}
          </Tabs>
        </div>

        {activeView === 'inventory' ? (
          <div className="space-y-3">
            <FilterLine>
              <FilterLineSection grow>
                <FilterLineSearch
                  aria-label="Buscar produto por nome ou SKU"
                  placeholder="Buscar por nome ou SKU..."
                  value={searchTerm}
                  onChange={setSearchTerm}
                />
              </FilterLineSection>
              <FilterLineSection align="right">
                <FilterLineSegmented
                  value={stockFilter}
                  onChange={(v) => setStockFilter(v as typeof stockFilter)}
                  options={STOCK_FILTERS.map(f => ({
                    value: f.v,
                    label: (
                      <>
                        {f.label}
                        <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500">{f.count}</span>
                      </>
                    ),
                  }))}
                />
              </FilterLineSection>
            </FilterLine>

            <ContentCard padding="none">
              <GridTable<Product>
                noDesktopCard
                data={inventoryPagination.paginatedData}
                keyExtractor={(p) => p.id}
                columns={inventoryColumns}
                emptyMessage="Nenhum produto encontrado"
                pagination={{
                  total: filteredProducts.length,
                  page: inventoryPagination.page,
                  pageSize: inventoryPagination.pageSize,
                  onPageChange: inventoryPagination.setPage,
                  onPageSizeChange: inventoryPagination.setPageSize,
                }}
              />
            </ContentCard>
          </div>
        ) : (
          <ContentCard padding="none">
            <GridTable<StockMovement>
              noDesktopCard
              data={historyPagination.paginatedData}
              keyExtractor={(m) => m.id}
              columns={historyColumns}
              emptyMessage="Sem movimentações registradas"
              pagination={{
                total: movements.length,
                page: historyPagination.page,
                pageSize: historyPagination.pageSize,
                onPageChange: historyPagination.setPage,
                onPageSizeChange: historyPagination.setPageSize,
              }}
            />
          </ContentCard>
        )}
      </div>

      {/* Adjustment Modal */}
      <Modal
        open={isAdjustmentModalOpen}
        onClose={() => setIsAdjustmentModalOpen(false)}
        title="Ajuste de Estoque"
        subtitle={selectedProduct?.name}
        size="sm"
        footer={
          <ModalFooter>
            <Button variant="outline" onClick={() => setIsAdjustmentModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleAdjustment} disabled={adjustmentValue === 0 || needsVariation}>Aplicar</Button>
          </ModalFooter>
        }
      >
        <div className="space-y-4">
          {/* Variações do produto */}
          {variationRows.length > 0 && (
            <div className="space-y-1.5">
              <p className="ds-label">Variação</p>
              <div className="max-h-48 space-y-1.5 overflow-y-auto">
                {variationRows.map(v => {
                  const key = JSON.stringify(v.combo);
                  const active = key === selectedVariationKey;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSelectedVariationKey(key)}
                      className={cn(
                        "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-xs transition-colors",
                        active ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      )}
                    >
                      <span className="font-medium">{v.label}</span>
                      <span className="tabular-nums text-slate-500">{v.stock} UN</span>
                    </button>
                  );
                })}
              </div>
              {needsVariation && <p className="text-[11px] text-amber-600">Selecione a variação que será ajustada.</p>}
            </div>
          )}

          {/* Current stock indicator */}
          <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-center">
            <p className="mb-1 text-[11px] font-medium text-slate-500">
              Saldo Atual{selectedVariation ? ` — ${selectedVariation.label}` : variationRows.length > 0 ? " (total)" : ""}
            </p>
            <p className="text-2xl font-semibold tabular-nums text-slate-900">{selectedVariation ? selectedVariation.stock : selectedProduct?.stock_quantity} <span className="text-sm font-medium text-slate-400">UN</span></p>
          </div>

          {selectedProduct && variationRows.length === 0 && (
            <p className="text-[11px] text-slate-500">
              Este produto não tem variações. Para cadastrar (cor, tamanho etc.), <a className="font-medium text-blue-600 underline" href={`/admin/catalog/${selectedProduct.id}/editar`}>edite o produto no catálogo</a>.
            </p>
          )}

          {/* Type selector */}
          <div data-tour="stock-adjustment-type" className="space-y-1.5">
            <p className="ds-label">Tipo de Operação</p>
            <div className="grid grid-cols-2 gap-2">
              {['purchase', 'adjustment', 'loss', 'return'].map(type => (
                <Button
                  key={type}
                  size="sm"
                  variant={adjustmentType === type ? "primary" : "outline"}
                  onClick={() => setAdjustmentType(type)}
                >
                  {TYPE_LABELS[type]}
                </Button>
              ))}
            </div>
          </div>

          {/* Quantity stepper */}
          <div data-tour="stock-adjustment-quantity" className="space-y-1.5">
            <p className="ds-label">Quantidade</p>
            <div className="flex items-center gap-4">
              <IconButton variant="outline" size="lg" aria-label="Diminuir quantidade" onClick={() => setAdjustmentValue(prev => prev - 1)}>
                <Minus size={16} />
              </IconButton>
              <div className="flex-1 text-center">
                <span className={cn(
                  "text-3xl font-semibold tabular-nums",
                  adjustmentValue > 0 ? "text-emerald-600" : adjustmentValue < 0 ? "text-red-600" : "text-slate-400"
                )}>
                  {adjustmentValue > 0 ? '+' : ''}{adjustmentValue}
                </span>
              </div>
              <IconButton variant="outline" size="lg" aria-label="Aumentar quantidade" onClick={() => setAdjustmentValue(prev => prev + 1)}>
                <Plus size={16} />
              </IconButton>
            </div>
          </div>

          {/* Reason */}
          <Textarea
            label="Justificativa"
            rows={3}
            placeholder="Explique o motivo desta variação..."
            value={adjustmentReason}
            onChange={(e) => setAdjustmentReason(e.target.value)}
          />
        </div>
      </Modal>
    </PageWrapper>
  );
}
