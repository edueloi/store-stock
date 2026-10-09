import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Plus, Edit2, Trash2, Image as ImageIcon, Package,
  TrendingUp, LayoutGrid, List, Tag, AlertTriangle,
  Star, FileUp, History, ArrowRight, Loader2, FileCode, HelpCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../../lib/utils";
import { Product, Category } from "../../types";
import { EmptyState, LoadingState } from "../../components/layout/EmptyState";
import StatsGrid from "../../components/ui/StatsGrid";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import Drawer from "../../components/ui/Drawer";
import { DropdownMenu } from "../../components/ui/Dropdown";
import PdfImportModal from "../../components/ui/PdfImportModal";
import XmlImportModal from "../../components/ui/XmlImportModal";
import {
  Button, IconButton, Select, Badge, PageWrapper, SectionTitle, GridTable, Pagination,
  FilterLine, FilterLineSection, FilterLineItem, FilterLineSearch, FilterLineSegmented, useToast,
} from "../../components/ui";
import type { Column } from "../../components/ui";
import InventoryPageTour, { INVENTORY_PAGE_TOUR_EVENTS, type InventoryPageTourHandle } from "../../components/onboarding/InventoryPageTour";
import { useBarcodeScanner } from "../../hooks/useBarcodeScanner";
import { useNavigate, useLocation } from "react-router-dom";
import ProductForm, { toSlug, generateCombos } from "./ProductForm";

type SortField = "name" | "price" | "stock" | "id";
type SortDir = "asc" | "desc";
type StatusFilter = "all" | "active" | "inactive";

interface HistoryEntry { id: number; field: string; old_value: string | null; new_value: string | null; created_at: string; }

const STATUS_OPTIONS = [
  { value: "all", label: "Todos" },
  { value: "active", label: "Ativos" },
  { value: "inactive", label: "Inativos" },
] as const;

// ── Main component ─────────────────────────────────────────────────────────
export default function Inventory() {
  const toast = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [taxRegime, setTaxRegime] = useState<string>("simples_nacional");
  // Loja vende por encomenda/sem controle de estoque (Settings > Controle de
  // Caixa) — quando ligado, suprime cards/filtros de "Estoque Crítico" porque
  // a loja deliberadamente não controla estoque e não deveria ser incomodada.
  const [sellWithoutStockControl, setSellWithoutStockControl] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  // Página do formulário aberta (cadastro/edição). O formulário em si vive em ProductForm.
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
  const [editingImages, setEditingImages] = useState<string[]>([]);
  // Muda a cada abertura do formulário para remontá-lo com o estado de UI zerado.
  const [formKey, setFormKey] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filterCategory, setFilterCategory] = useState<number | "">("");
  const [filterStatus, setFilterStatus] = useState<StatusFilter>("all");
  const [filterLowStock, setFilterLowStock] = useState(false);

  const [sortField, setSortField] = useState<SortField>("id");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("desc"); }
  };

  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);

  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [isXmlModalOpen, setIsXmlModalOpen] = useState(false);
  // Só usado pelo tour guiado: quando definido, o XmlImportModal carrega e
  // processa este XML de exemplo automaticamente (ver prop autoLoadUrl).
  const [xmlAutoLoadUrl, setXmlAutoLoadUrl] = useState<string | undefined>(undefined);

  const inventoryPageTourRef = useRef<InventoryPageTourHandle>(null);

  // ── bulk selection ──────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);

  // Product history panel
  const [historyProduct, setHistoryProduct] = useState<Product | null>(null);
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const fetchInventory = async () => {
    try {
      const [pRes, cRes, tRes] = await Promise.all([
        fetch("/api/products", { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }),
        fetch("/api/categories", { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }),
        fetch("/api/tenant", { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }),
      ]);
      const [pData, cData, tData] = await Promise.all([pRes.json(), cRes.json(), tRes.json()]);
      setProducts(Array.isArray(pData) ? pData : []);
      setCategories(Array.isArray(cData) ? cData : []);
      if (tData?.tax_regime) setTaxRegime(tData.tax_regime);
      setSellWithoutStockControl(!!tData?.sell_without_stock_control);
    } catch { /* noop */ }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchInventory(); }, []);

  // Bipar um produto no Catálogo abre direto a tela de edição — mesmo padrão de
  // captura de leitor de código de barras usado no PDV (sequência de teclas
  // rápida demais pra ser digitação humana), via hook compartilhado
  // useBarcodeScanner. Desligado com o formulário já aberto, pra não atrapalhar
  // quem está digitando nele (que tem seu próprio campo de barcode).
  const handleCatalogScan = useCallback(async (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;
    const local = products.find((p) => p.barcode === trimmed);
    if (local) { openEdit(local); return; }
    try {
      const res = await fetch(`/api/products/by-barcode/${encodeURIComponent(trimmed)}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      if (res.ok) { openEdit(await res.json()); return; }
      toast.error(`Nenhum produto cadastrado com o código "${trimmed}".`);
    } catch {
      toast.error("Falha ao buscar produto pelo código de barras.");
    }
  }, [products]);

  useBarcodeScanner({
    onScan: handleCatalogScan,
    enabled: !isModalOpen,
    searchFields: [
      { id: "catalog-search-input", getValue: () => searchTerm, setValue: setSearchTerm },
    ],
  });

  const startNew = () => {
    setEditingProduct({ type: "sale", is_active: false, is_featured: false, stock_quantity: 0, attributes: [], skus: [] });
    setEditingImages([]);
    setFormKey(k => k + 1);
    setIsModalOpen(true);
  };

  const startEdit = (p: Product) => {
    // migrate legacy variations → attributes+skus if needed
    let attrs = Array.isArray(p.attributes) ? p.attributes : [];
    let skus = Array.isArray(p.skus) ? p.skus : [];
    if (attrs.length === 0 && Array.isArray(p.variations) && p.variations.length > 0) {
      attrs = p.variations.map(v => ({ name: v.name, values: v.options.map(o => o.value) }));
      skus = generateCombos(attrs).map(combo => {
        const legacyStock = p.variations!.flatMap(v => v.options).find(o => Object.values(combo).includes(o.value))?.stock ?? 0;
        return { combo, stock: legacyStock };
      });
    }
    setEditingProduct({ ...p, attributes: attrs, skus });
    setEditingImages(Array.isArray(p.images) ? p.images : p.image_url ? [p.image_url] : []);
    setFormKey(k => k + 1);
    setIsModalOpen(true);
  };

  // Cadastro/edição ficam em página própria com URL (/admin/catalog/novo e
  // /admin/catalog/:id/editar). Inventory é montado em "catalog/*" e continua
  // dono do estado do produto em edição; a URL só liga/desliga a página.
  const openNew = () => { startNew(); navigate("/admin/catalog/novo"); };
  const openEdit = (p: Product) => { startEdit(p); navigate(`/admin/catalog/${p.id}/editar`); };
  const closeForm = () => { setIsModalOpen(false); navigate("/admin/catalog"); };

  // Sincroniza a URL com a página do formulário (acesso direto, voltar/avançar do navegador).
  useEffect(() => {
    if (loading) return;
    const m = location.pathname.match(/\/catalog\/(?:(novo)|(\d+)\/editar)\/?$/);
    if (!m) { if (isModalOpen) setIsModalOpen(false); return; }
    if (isModalOpen) return;
    if (m[1]) { startNew(); return; }
    const id = Number(m[2]);
    const local = products.find(p => p.id === id);
    if (local) { startEdit(local); return; }
    fetch(`/api/products/${id}`, { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(p => startEdit(p))
      .catch(() => { toast.error("Produto não encontrado."); navigate("/admin/catalog", { replace: true }); });
  }, [location.pathname, loading]);

  // ── Canal de comunicação do tour guiado (onboarding) ──────────────────────
  // O OnboardingTour (src/components/onboarding/OnboardingTour.tsx) precisa
  // abrir/preencher/fechar o formulário "Novo Produto" de verdade para ilustrar o
  // fluxo, mas sem nunca chamar handleSave (que faz o POST real). Em vez de
  // expor as funções internas do componente pra fora, o tour dispara
  // CustomEvents no window e este componente escuta e chama as funções reais
  // (openNew, setEditingProduct, setIsModalOpen) — nunca handleSave/submit.
  useEffect(() => {
    const onOpenNewProduct = (e: Event) => {
      openNew();
      const detail = (e as CustomEvent<Partial<Product>>).detail;
      if (detail) {
        // Aplica os valores de exemplo em cima do estado default do openNew (a
        // função é assíncrona via setState, então agendamos depois do open).
        setEditingProduct((prev) => ({ ...prev!, ...detail }));
      }
    };
    const onFillProduct = (e: Event) => {
      const detail = (e as CustomEvent<Partial<Product>>).detail;
      if (detail) setEditingProduct((prev) => ({ ...(prev ?? {}), ...detail }));
    };
    const onCloseModal = () => closeForm();

    window.addEventListener("onboarding-tour:open-new-product", onOpenNewProduct);
    window.addEventListener("onboarding-tour:fill-product", onFillProduct);
    window.addEventListener("onboarding-tour:close-product-modal", onCloseModal);
    return () => {
      window.removeEventListener("onboarding-tour:open-new-product", onOpenNewProduct);
      window.removeEventListener("onboarding-tour:fill-product", onFillProduct);
      window.removeEventListener("onboarding-tour:close-product-modal", onCloseModal);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Canal de comunicação do TOUR DE PÁGINA (InventoryPageTour) ─────────────
  // Namespace separado (page-tour:inventory:*) do tour geral acima — nunca
  // colidem porque os nomes de evento são distintos. Mesmas garantias de
  // segurança: só abre/preenche/fecha via openNew/openEdit/setEditingProduct/
  // setIsModalOpen, nunca chama handleSave. Os eventos de abrir/fechar os
  // modais de importação (PDF/XML) só setam os estados isPdfModalOpen/
  // isXmlModalOpen — o tour nunca interage com o conteúdo interno desses
  // modais (nunca seleciona arquivo nem chama handleImport).
  useEffect(() => {
    const onOpenNewProductPage = (e: Event) => {
      openNew();
      const detail = (e as CustomEvent<Partial<Product>>).detail;
      if (detail) {
        setEditingProduct((prev) => ({ ...prev!, ...detail }));
      }
    };
    const onFillProductPage = (e: Event) => {
      const detail = (e as CustomEvent<Partial<Product>>).detail;
      if (detail) setEditingProduct((prev) => ({ ...(prev ?? {}), ...detail }));
    };
    const onOpenEditProductPage = () => {
      // Edita o primeiro produto da lista, se houver — senão simplesmente não
      // abre nada e o passo do tour é pulado (skipMissingElement cuida disso).
      if (products.length > 0) openEdit(products[0]);
    };
    // Injeta a foto de exemplo (asset estático em /public/tour-assets, nunca
    // passa por upload real) só para ilustrar visualmente como fica um
    // produto com foto — editingImages só é persistido de verdade se o
    // usuário clicar em "Cadastrar Produto", o que o tour nunca faz.
    const onFillProductImagePage = () => setEditingImages(["/tour-assets/mouse_exemplo.png"]);
    const onCloseProductModalPage = () => closeForm();
    const onOpenPdfModalPage = () => setIsPdfModalOpen(true);
    const onClosePdfModalPage = () => setIsPdfModalOpen(false);
    // Abre o XML já com autoLoadUrl setado — o modal busca o arquivo de
    // exemplo e processa de verdade (chega ao preview com produtos reais).
    const onOpenXmlModalPage = () => {
      setXmlAutoLoadUrl("/tour-assets/produtos_exemplo.xml");
      setIsXmlModalOpen(true);
    };
    const onCloseXmlModalPage = () => { setIsXmlModalOpen(false); setXmlAutoLoadUrl(undefined); };

    window.addEventListener(INVENTORY_PAGE_TOUR_EVENTS.openNewProduct, onOpenNewProductPage);
    window.addEventListener(INVENTORY_PAGE_TOUR_EVENTS.fillProduct, onFillProductPage);
    window.addEventListener("page-tour:inventory:fill-product-image", onFillProductImagePage);
    window.addEventListener(INVENTORY_PAGE_TOUR_EVENTS.openEditProduct, onOpenEditProductPage);
    window.addEventListener(INVENTORY_PAGE_TOUR_EVENTS.closeProductModal, onCloseProductModalPage);
    window.addEventListener("page-tour:inventory:open-pdf-modal", onOpenPdfModalPage);
    window.addEventListener("page-tour:inventory:close-pdf-modal", onClosePdfModalPage);
    window.addEventListener("page-tour:inventory:open-xml-modal", onOpenXmlModalPage);
    window.addEventListener("page-tour:inventory:close-xml-modal", onCloseXmlModalPage);
    return () => {
      window.removeEventListener(INVENTORY_PAGE_TOUR_EVENTS.openNewProduct, onOpenNewProductPage);
      window.removeEventListener(INVENTORY_PAGE_TOUR_EVENTS.fillProduct, onFillProductPage);
      window.removeEventListener("page-tour:inventory:fill-product-image", onFillProductImagePage);
      window.removeEventListener(INVENTORY_PAGE_TOUR_EVENTS.openEditProduct, onOpenEditProductPage);
      window.removeEventListener(INVENTORY_PAGE_TOUR_EVENTS.closeProductModal, onCloseProductModalPage);
      window.removeEventListener("page-tour:inventory:open-pdf-modal", onOpenPdfModalPage);
      window.removeEventListener("page-tour:inventory:close-pdf-modal", onClosePdfModalPage);
      window.removeEventListener("page-tour:inventory:open-xml-modal", onOpenXmlModalPage);
      window.removeEventListener("page-tour:inventory:close-xml-modal", onCloseXmlModalPage);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products]);

  // A validação de campos obrigatórios (e a troca para a aba com erro) acontece em
  // ProductForm antes de chamar este handler.
  const handleSave = async () => {
    if (saving) return;

    setSaving(true);
    const method = editingProduct?.id ? "PUT" : "POST";
    const url = editingProduct?.id ? `/api/products/${editingProduct.id}` : "/api/products";

    // Derive total stock_quantity from SKU combos if using new model
    const skus = editingProduct?.skus || [];
    const derivedStock = skus.length > 0
      ? skus.reduce((s, k) => s + k.stock, 0)
      : editingProduct?.stock_quantity ?? 0;

    // Convert attributes+skus → legacy variations format for store display
    const attrs = editingProduct?.attributes || [];
    const skuList = editingProduct?.skus || [];
    const legacyVariations = attrs.length > 0
      ? attrs.map(attr => ({
          name: attr.name,
          options: attr.values.map(val => {
            const stock = skuList
              .filter(s => s.combo[attr.name] === val)
              .reduce((sum, s) => sum + (s.stock ?? 0), 0);
            return { value: val, stock };
          }),
        }))
      : [];

    const payload = {
      ...editingProduct,
      type: editingProduct?.type || "sale",
      is_active: editingProduct?.is_active ?? false,
      is_featured: editingProduct?.is_featured ?? false,
      sku: editingProduct?.sku?.trim() || (editingProduct?.name ? toSlug(editingProduct.name) : undefined),
      image_url: editingImages[0] || null,
      images: editingImages,
      stock_quantity: derivedStock,
      attributes: attrs,
      skus: skuList,
      variations: legacyVariations.length > 0 ? legacyVariations : [],
    };

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        // Aviso não-bloqueante (ex.: CFOP incompatível pra venda) — o produto já
        // foi salvo, só avisa pra o lojista corrigir quando puder.
        if (data?.warning) toast.warning(data.warning, 10000);
        closeForm();
        fetchInventory();
      } else {
        toast.error(data?.error || "Erro ao salvar produto.");
      }
    } catch { toast.error("Erro de conexão ao salvar produto."); }
    finally { setSaving(false); }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await fetch(`/api/products/${deleteTarget.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      fetchInventory();
    } catch { /* noop */ }
    finally { setDeleteLoading(false); setDeleteTarget(null); }
  };

  const confirmBulkDelete = async () => {
    setBulkDeleting(true);
    await Promise.all([...selectedIds].map(id =>
      fetch(`/api/products/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      })
    ));
    setSelectedIds(new Set());
    setShowBulkConfirm(false);
    setBulkDeleting(false);
    fetchInventory();
  };

  const toggleSelect = (id: number) => setSelectedIds(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const openHistory = async (p: Product) => {
    setHistoryProduct(p);
    setHistoryEntries([]);
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/products/${p.id}/history`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      const data = await res.json();
      setHistoryEntries(Array.isArray(data) ? data : []);
    } catch { /* noop */ }
    setHistoryLoading(false);
  };

  const isMeasuredProduct = (p: Product) => p.sale_unit === "m2" || p.sale_unit === "linear";
  const stockValue = (p: Product) => isMeasuredProduct(p) ? Number(p.measure_stock_quantity ?? 0) : p.stock_quantity;
  const minStockValue = (p: Product) => isMeasuredProduct(p) ? Number(p.measure_min_stock ?? 0) : (p.min_stock ?? 5);
  // Loja vende por encomenda/sem controle de estoque — nunca marca um produto como
  // "estoque crítico" nos badges/indicadores visuais da linha/card.
  const isLowStock = (p: Product) => !sellWithoutStockControl && stockValue(p) <= minStockValue(p);
  const stockUnit = (p: Product) => ({
    m: "m", cm: "cm", mm: "mm", km: "km", m2: "m²", cm2: "cm²", mm2: "mm²", km2: "km²",
  }[p.measure_unit ?? (p.sale_unit === "m2" ? "m2" : "m")] ?? "un");
  const formatStock = (p: Product) => isMeasuredProduct(p) ? stockValue(p).toFixed(3) : String(stockValue(p));

  const filteredProducts = [...products]
    .filter(p => {
      if (p.type !== "sale") return false;
      if (searchTerm && !p.name.toLowerCase().includes(searchTerm.toLowerCase()) && !(p.sku?.toLowerCase().includes(searchTerm.toLowerCase()))) return false;
      if (filterCategory && p.category_id !== filterCategory) return false;
      if (filterStatus === "active" && !p.is_active) return false;
      if (filterStatus === "inactive" && p.is_active) return false;
      if (filterLowStock && !sellWithoutStockControl && stockValue(p) > minStockValue(p)) return false;
      return true;
    })
    .sort((a, b) => {
      let cmp = 0;
      if (sortField === "name")  cmp = a.name.localeCompare(b.name, "pt-BR");
      if (sortField === "price") cmp = Number(a.discount_price ?? a.price) - Number(b.discount_price ?? b.price);
      if (sortField === "stock") cmp = stockValue(a) - stockValue(b);
      if (sortField === "id")    cmp = a.id - b.id;
      return sortDir === "asc" ? cmp : -cmp;
    });

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const pagedProducts = filteredProducts.slice((safePage - 1) * pageSize, safePage * pageSize);

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredProducts.length && filteredProducts.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredProducts.map(p => p.id)));
    }
  };

  const saleProducts = products.filter(p => p.type === "sale");
  const totalCost = saleProducts.reduce((s, p) => s + Number(p.cost_price || 0) * stockValue(p), 0);
  const totalRevenue = saleProducts.reduce((s, p) => s + Number(p.price || 0) * stockValue(p), 0);
  const lowStock = saleProducts.filter(p => stockValue(p) <= minStockValue(p) && p.is_active).length;
  const featured = saleProducts.filter(p => p.is_featured).length;

  const displaySku = (p: Product) => p.sku || toSlug(p.name);
  const coverImg = (p: Product) => (Array.isArray(p.images) && p.images[0]) || p.image_url;
  const imgCount = (p: Product) => {
    const imgs = Array.isArray(p.images) ? p.images : [];
    return imgs.length || (p.image_url ? 1 : 0);
  };

  if (loading) return <LoadingState text="Carregando inventário..." />;

  // ── Página do formulário (cadastro/edição) ────────────────────────────────
  if (isModalOpen && editingProduct) {
    return (
      <PageWrapper data-tour="inventory-page">
        <ProductForm
          key={formKey}
          product={editingProduct}
          onProductChange={setEditingProduct}
          images={editingImages}
          onImagesChange={setEditingImages}
          categories={categories}
          onCategoryCreated={(category) => setCategories((prev) => [...prev, category])}
          taxRegime={taxRegime}
          saving={saving}
          onSave={handleSave}
          onCancel={closeForm}
        />
        <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={confirmDelete}
          title={`Excluir "${deleteTarget?.name}"?`}
          description="Todas as fotos e dados serão removidos permanentemente."
          variant="danger" confirmLabel="Excluir produto" loading={deleteLoading} />
      </PageWrapper>
    );
  }

  // ── Colunas da tabela ─────────────────────────────────────────────────────
  const columns: Column<Product>[] = [
    {
      header: "#", sortKey: "id", className: "w-10",
      render: (p) => <span className="text-[11px] font-mono text-slate-400">#{p.id}</span>,
    },
    {
      header: "Produto", sortKey: "name",
      render: (p) => (
        <div className="flex items-center gap-2.5">
          <div className="relative w-9 h-9 shrink-0">
            <div className="w-9 h-9 rounded-lg border border-slate-200 bg-slate-50 overflow-hidden">
              {coverImg(p) ? <img src={coverImg(p)} alt={p.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                : <div className="w-full h-full flex items-center justify-center"><ImageIcon size={14} className="text-slate-300" /></div>}
            </div>
            {imgCount(p) > 1 && (
              <span className="absolute -bottom-1 -right-1 bg-slate-700 text-white text-[10px] font-medium w-4 h-4 rounded-full flex items-center justify-center shadow-sm">
                {imgCount(p)}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-900 leading-tight max-w-[180px] truncate">{p.name}</p>
            <div className="flex items-center gap-1 mt-0.5">
              {p.is_featured && <Badge color="warning" pill>★</Badge>}
              {p.discount_price && <Badge color="danger" pill>%</Badge>}
              {Array.isArray(p.attributes) && p.attributes.length > 0 && (
                <Badge color="primary" pill>{p.attributes.length} var.</Badge>
              )}
            </div>
          </div>
        </div>
      ),
    },
    {
      header: "SKU",
      render: (p) => <span className="text-[11px] font-mono font-medium text-slate-400 group-hover:text-blue-500 transition-colors">{displaySku(p)}</span>,
    },
    {
      header: "Categoria",
      render: (p) => p.category_name
        ? <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1"><Tag size={10} />{p.category_name}</span>
        : <span className="text-[11px] text-slate-300">—</span>,
    },
    {
      header: "Custo",
      render: (p) => <span className="text-[11px] font-mono text-slate-400">R$ {Number(p.cost_price || 0).toFixed(2)}</span>,
    },
    {
      header: "Preço", sortKey: "price",
      render: (p) => p.discount_price ? (
        <div className="flex flex-col text-[11px] font-mono font-medium">
          <span className="line-through text-[11px] text-slate-300">R$ {Number(p.price).toFixed(2)}</span>
          <span className="text-emerald-600">R$ {Number(p.discount_price).toFixed(2)}</span>
        </div>
      ) : <span className="text-[11px] font-mono font-medium text-slate-900">R$ {Number(p.price).toFixed(2)}</span>,
    },
    {
      header: "Estoque", sortKey: "stock",
      render: (p) => (
        <div className="flex items-center gap-1.5">
          <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", isLowStock(p) ? "bg-red-500 animate-pulse" : !sellWithoutStockControl && stockValue(p) <= minStockValue(p) * 3 ? "bg-amber-400" : "bg-emerald-500")} />
          <span className={cn("text-xs font-mono font-medium", isLowStock(p) ? "text-red-600" : "text-slate-900")}>
            {formatStock(p)} <span className="text-[11px] text-slate-400 font-normal">{stockUnit(p)}</span>
          </span>
        </div>
      ),
    },
    {
      header: "Status",
      render: (p) => <Badge color={p.is_active ? "success" : "default"} pill>{p.is_active ? "Ativo" : "Inativo"}</Badge>,
    },
    {
      header: "Ações", className: "text-right", headerClassName: "text-right",
      render: (p) => (
        <DropdownMenu items={[
          { label: "Editar produto", icon: <Edit2 size={13} />, onClick: () => openEdit(p) },
          { label: "Histórico", icon: <History size={13} />, onClick: () => openHistory(p) },
          { label: "Excluir", icon: <Trash2 size={13} />, variant: "danger", onClick: () => setDeleteTarget(p) },
        ]} />
      ),
    },
  ];

  // ── Cartão mobile (< sm) ──────────────────────────────────────────────────
  const renderMobileItem = (p: Product) => (
    <div className="flex items-center gap-3">
      {/* thumb */}
      <div className="relative w-14 h-14 shrink-0 rounded-lg overflow-hidden border border-slate-100 bg-slate-50">
        {coverImg(p)
          ? <img src={coverImg(p)} alt={p.name} className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center"><ImageIcon size={18} className="text-slate-300" /></div>}
        {imgCount(p) > 1 && (
          <span className="absolute bottom-0 right-0 bg-slate-700/80 text-white text-[11px] font-medium w-4 h-4 flex items-center justify-center rounded-tl-lg">
            {imgCount(p)}
          </span>
        )}
      </div>
      {/* info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[13px] font-medium text-slate-900 leading-tight truncate">{p.name}</p>
          <Badge color={p.is_active ? "success" : "default"} pill>{p.is_active ? "Ativo" : "Inativo"}</Badge>
        </div>
        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
          {p.category_name && <span className="text-[11px] text-slate-400 font-medium">{p.category_name}</span>}
          {p.is_featured && <Badge color="warning" pill>★ Destaque</Badge>}
          {p.discount_price && <Badge color="danger" pill>PROMO</Badge>}
        </div>
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-3">
            <span className="text-[13px] font-medium font-mono text-blue-600">
              R$ {Number(p.discount_price || p.price).toFixed(2)}
            </span>
            <div className="flex items-center gap-1">
              <div className={cn("w-1.5 h-1.5 rounded-full", isLowStock(p) ? "bg-red-500" : !sellWithoutStockControl && stockValue(p) <= minStockValue(p) * 3 ? "bg-amber-400" : "bg-emerald-500")} />
              <span className={cn("text-xs font-mono font-medium", isLowStock(p) ? "text-red-600" : "text-slate-600")}>
                {formatStock(p)} {stockUnit(p)}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <IconButton variant="ghost" aria-label="Editar produto" onClick={() => openEdit(p)}>
              <Edit2 size={14} className="text-blue-600" />
            </IconButton>
            <IconButton variant="ghost" aria-label="Excluir produto" onClick={() => setDeleteTarget(p)}>
              <Trash2 size={14} className="text-red-500" />
            </IconButton>
          </div>
        </div>
      </div>
    </div>
  );

  const paginationProps = {
    total: filteredProducts.length,
    page: safePage,
    pageSize,
    onPageChange: setCurrentPage,
    onPageSizeChange: (size: number) => { setPageSize(size); setCurrentPage(1); },
  };

  return (
    <PageWrapper data-tour="inventory-page">
      <div className="space-y-4">
        <SectionTitle
          title="Catálogo & Inventário"
          description="Gestão de produtos e controle de estoque"
          action={
            <>
              <Button
                variant="secondary"
                icon={viewMode === "table" ? <LayoutGrid size={14} /> : <List size={14} />}
                onClick={() => setViewMode(v => v === "table" ? "grid" : "table")}
              >
                {viewMode === "table" ? "Grade" : "Tabela"}
              </Button>
              <Button data-tour="inventory-import-pdf-btn" variant="secondary" icon={<FileUp size={14} />} onClick={() => setIsPdfModalOpen(true)}>
                Importar PDF
              </Button>
              <Button data-tour="inventory-import-xml-btn" variant="secondary" icon={<FileCode size={14} />} onClick={() => setIsXmlModalOpen(true)}>
                Importar XML
              </Button>
              <Button data-tour="inventory-new-product-btn" icon={<Plus size={14} />} onClick={openNew}>
                Novo Produto
              </Button>
              <Button
                variant="outline"
                icon={<HelpCircle size={14} />}
                onClick={() => inventoryPageTourRef.current?.start()}
                title="Tour guiado desta página"
              >
                <span className="sr-only sm:not-sr-only">Ajuda</span>
              </Button>
            </>
          }
        />

        <InventoryPageTour ref={inventoryPageTourRef} />

        <StatsGrid columns={4} stats={[
          { label: "Capital Imobilizado", value: `R$ ${totalCost.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, icon: <Package size={18} />, accent: "blue" },
          { label: "Potencial Faturamento", value: `R$ ${totalRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, icon: <TrendingUp size={18} />, accent: "emerald" },
          // Loja vende por encomenda/sem controle de estoque — não faz sentido mostrar
          // "Estoque Crítico" pra quem deliberadamente não controla estoque.
          ...(sellWithoutStockControl ? [] : [{ label: "Estoque Crítico", value: lowStock, icon: <AlertTriangle size={18} />, accent: lowStock > 0 ? ("red" as const) : ("slate" as const) }]),
          { label: "Destaques Ativos", value: featured, icon: <Star size={18} />, accent: "amber" },
        ]} />

        {/* Filters */}
        <FilterLine>
          <FilterLineSection grow>
            <FilterLineItem grow minWidth={200}>
              <FilterLineSearch
                id="catalog-search-input"
                placeholder="Buscar por nome ou SKU..."
                value={searchTerm}
                onChange={(v) => { setSearchTerm(v); setCurrentPage(1); }}
              />
            </FilterLineItem>
            <FilterLineItem>
              <Select size="sm" aria-label="Filtrar por categoria" value={filterCategory}
                onChange={e => { setFilterCategory(e.target.value === "" ? "" : Number(e.target.value)); setCurrentPage(1); }}>
                <option value="">Todas categorias</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </FilterLineItem>
            <FilterLineSegmented<StatusFilter>
              size="sm"
              value={filterStatus}
              options={STATUS_OPTIONS as unknown as { value: StatusFilter; label: string }[]}
              onChange={(s) => { setFilterStatus(s); setCurrentPage(1); }}
            />
            {/* Low stock chip — oculto quando a loja vende por encomenda/sem controle de estoque */}
            {!sellWithoutStockControl && (
              <Button
                size="sm"
                variant={filterLowStock ? "danger" : "outline"}
                iconLeft={<AlertTriangle size={11} />}
                onClick={() => { setFilterLowStock(v => !v); setCurrentPage(1); }}
              >
                Estoque crítico
              </Button>
            )}
          </FilterLineSection>
          <FilterLineSection align="right">
            <span className="text-[11px] font-medium text-slate-400">
              {filteredProducts.length} produto{filteredProducts.length !== 1 ? "s" : ""}
            </span>
          </FilterLineSection>
        </FilterLine>

        {/* ── bulk action bar ── */}
        <AnimatePresence>
          {selectedIds.size > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className="flex flex-wrap items-center justify-between gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5"
            >
              <span className="text-xs font-medium text-red-700">
                {selectedIds.size} produto{selectedIds.size !== 1 ? "s" : ""} selecionado{selectedIds.size !== 1 ? "s" : ""}
              </span>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>Limpar</Button>
                <Button variant="danger" icon={<Trash2 size={13} />} onClick={() => setShowBulkConfirm(true)}>
                  Excluir {selectedIds.size}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {filteredProducts.length === 0 ? (
          <EmptyState icon={<Package size={40} strokeWidth={1} />} title="Nenhum produto encontrado"
            description="Ajuste os filtros ou cadastre um novo produto."
            action={<Button icon={<Plus size={14} />} onClick={openNew}>Cadastrar</Button>} />
        ) : viewMode === "table" ? (
          <GridTable<Product>
            data={pagedProducts}
            columns={columns}
            keyExtractor={(p) => p.id}
            selectedIds={new Set([...selectedIds].map(String))}
            onToggleSelect={(id) => toggleSelect(Number(id))}
            onToggleSelectAll={toggleSelectAll}
            sortKey={sortField}
            sortOrder={sortDir}
            onSort={(key) => toggleSort(key as SortField)}
            renderMobileItem={renderMobileItem}
            pagination={paginationProps}
          />
        ) : (
          <>
            {/* GRID */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
              <AnimatePresence>
                {pagedProducts.map(p => (
                  <motion.div key={p.id} layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm transition-all group">
                    <div className="relative aspect-square bg-slate-50">
                      {coverImg(p) ? <img src={coverImg(p)} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                        : <div className="w-full h-full flex items-center justify-center"><Package size={32} strokeWidth={1} className="text-slate-200" /></div>}
                      <div className="absolute top-2 right-2 flex gap-1">
                        {p.is_featured && <Badge color="warning" pill>★</Badge>}
                        {p.discount_price && <Badge color="danger" pill>%</Badge>}
                      </div>
                      {imgCount(p) > 1 && (
                        <span className="absolute bottom-2 left-2 bg-black/60 text-white text-[11px] font-medium px-1.5 py-0.5 rounded-full flex items-center gap-1">
                          <ImageIcon size={9} /> {imgCount(p)}
                        </span>
                      )}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <IconButton variant="secondary" aria-label="Editar produto" onClick={() => openEdit(p)}><Edit2 size={14} className="text-blue-600" /></IconButton>
                        <IconButton variant="secondary" aria-label="Excluir produto" onClick={() => setDeleteTarget(p)}><Trash2 size={14} className="text-red-500" /></IconButton>
                      </div>
                    </div>
                    <div className="p-3 space-y-1">
                      <p className="text-xs font-medium text-slate-900 leading-tight line-clamp-2">{p.name}</p>
                      <p className="text-[11px] font-mono text-slate-400 truncate">{displaySku(p)}</p>
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[13px] font-medium font-mono text-blue-600">R$ {Number(p.discount_price || p.price).toFixed(2)}</span>
                        <Badge color={isLowStock(p) ? "danger" : "success"} pill>
                          {formatStock(p)} {stockUnit(p)}
                        </Badge>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
            <Pagination {...paginationProps} className="rounded-lg border" />
          </>
        )}
      </div>

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={confirmDelete}
        title={`Excluir "${deleteTarget?.name}"?`}
        description="Todas as fotos e dados serão removidos permanentemente."
        variant="danger" confirmLabel="Excluir produto" loading={deleteLoading} />

      <ConfirmDialog open={showBulkConfirm} onClose={() => setShowBulkConfirm(false)} onConfirm={confirmBulkDelete}
        title={`Excluir ${selectedIds.size} produto${selectedIds.size !== 1 ? "s" : ""}?`}
        description="Todos os dados e fotos dos produtos selecionados serão removidos permanentemente."
        variant="danger" confirmLabel={`Excluir ${selectedIds.size} produto${selectedIds.size !== 1 ? "s" : ""}`} loading={bulkDeleting} />

      {/* ── HISTORY PANEL ── */}
      <Drawer
        open={!!historyProduct}
        onClose={() => setHistoryProduct(null)}
        title={historyProduct ? `Histórico de Alterações — ${historyProduct.name}` : undefined}
        subtitle={historyProduct?.sku || undefined}
        width="w-full sm:w-[440px]"
        footer={
          <p className="text-[11px] text-slate-400 text-center">
            {historyEntries.length > 0 ? `${historyEntries.length} registro${historyEntries.length !== 1 ? "s" : ""} encontrado${historyEntries.length !== 1 ? "s" : ""}` : ""}
          </p>
        }
      >
        {historyLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={22} className="animate-spin text-slate-300" />
          </div>
        ) : historyEntries.length === 0 ? (
          <EmptyState bordered={false} icon={<History size={22} />} title="Sem histórico ainda"
            description="As alterações aparecerão aqui após a próxima edição do produto." />
        ) : (
          <div className="divide-y divide-slate-100">
            {historyEntries.map((entry) => {
              const dt = new Date(entry.created_at);
              const dateStr = dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
              const timeStr = dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
              return (
                <div key={entry.id} className="py-3">
                  {/* timestamp */}
                  <div className="flex items-center gap-1.5 mb-2">
                    <Badge color="default">{dateStr}</Badge>
                    <span className="text-[11px] font-medium text-slate-400">{timeStr}</span>
                  </div>
                  {/* field label */}
                  <p className="text-xs font-medium text-slate-700 mb-2">{entry.field}</p>
                  {/* old → new */}
                  <div className="flex items-center gap-2">
                    <span className="flex-1 min-w-0 bg-rose-50 border border-rose-100 rounded-lg px-3 py-1.5 text-[11px] font-mono font-medium text-rose-600 truncate">
                      {entry.old_value ?? "—"}
                    </span>
                    <ArrowRight size={12} className="text-slate-300 shrink-0" />
                    <span className="flex-1 min-w-0 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-1.5 text-[11px] font-mono font-medium text-emerald-700 truncate">
                      {entry.new_value ?? "—"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Drawer>

      <PdfImportModal
        open={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
        onImported={() => { fetchInventory(); }}
      />

      <XmlImportModal
        open={isXmlModalOpen}
        onClose={() => { setIsXmlModalOpen(false); setXmlAutoLoadUrl(undefined); }}
        onImported={() => { fetchInventory(); }}
        autoLoadUrl={xmlAutoLoadUrl}
      />
    </PageWrapper>
  );
}
