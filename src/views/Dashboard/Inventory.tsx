import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Plus, Edit2, Trash2, Image as ImageIcon, Save, X, Package,
  TrendingUp, Upload, LayoutGrid, List, Tag,
  Search, AlertTriangle, Star,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../../lib/utils";
import { Product, Category } from "../../types";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import PageHeader from "../../components/layout/PageHeader";
import { EmptyState, LoadingState } from "../../components/layout/EmptyState";
import StatsGrid from "../../components/ui/StatsGrid";
import { Switch } from "../../components/ui/Switch";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import { DropdownMenu } from "../../components/ui/Dropdown";
import { Tabs, TabList, Tab } from "../../components/ui/Tabs";

// ── slug generation ────────────────────────────────────────────────────────
function toSlug(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// ── Image upload zone ──────────────────────────────────────────────────────
interface ImageZoneProps {
  value?: string;
  onChange: (url: string) => void;
  onClear: () => void;
}

function ImageZone({ value, onChange, onClear }: ImageZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const doUpload = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) { setError("Apenas imagens são aceitas"); return; }
    if (file.size > 5 * 1024 * 1024) { setError("Máximo 5 MB"); return; }
    setError("");
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const res = await fetch("/api/upload/product-image", {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        body: fd,
      });
      const data = await res.json();
      if (data.url) onChange(data.url);
      else setError("Falha no upload");
    } catch {
      setError("Erro ao enviar imagem");
    } finally {
      setUploading(false);
    }
  }, [onChange]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) doUpload(file);
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) doUpload(file);
    e.target.value = "";
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Foto do Produto</label>
        {value && (
          <button type="button" onClick={onClear} className="text-[10px] font-bold text-red-500 hover:text-red-700 flex items-center gap-1 transition-colors">
            <X size={11} /> Remover
          </button>
        )}
      </div>

      {value ? (
        <div
          className="relative w-full aspect-video rounded-xl overflow-hidden border-2 border-slate-200 group cursor-pointer"
          onClick={() => inputRef.current?.click()}
        >
          <img src={value} alt="produto" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
            <Upload size={20} className="text-white" />
            <span className="text-white text-[11px] font-bold">Trocar foto</span>
          </div>
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
        </div>
      ) : (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "w-full aspect-video rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-3 cursor-pointer transition-all",
            dragging ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-slate-50 hover:border-blue-400 hover:bg-blue-50/50"
          )}
        >
          {uploading ? (
            <>
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-[11px] font-bold text-blue-600">Enviando...</span>
            </>
          ) : (
            <>
              <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center transition-colors", dragging ? "bg-blue-100" : "bg-slate-100")}>
                <Upload size={22} className={dragging ? "text-blue-500" : "text-slate-400"} />
              </div>
              <div className="text-center">
                <p className="text-[11px] font-bold text-slate-600">Arraste ou clique para enviar</p>
                <p className="text-[10px] text-slate-400 mt-0.5">JPG, PNG, WEBP · max 5 MB</p>
              </div>
            </>
          )}
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
        </div>
      )}
      {error && <p className="text-[10px] font-bold text-red-500 px-1">{error}</p>}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export default function Inventory() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<"sale" | "internal">("sale");
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filterCategory, setFilterCategory] = useState<number | "">("");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive">("all");

  // Variation state
  const [variationName, setVariationName] = useState("");
  const [newOptValue, setNewOptValue] = useState("");
  const [newOptStock, setNewOptStock] = useState<number>(0);
  const [pendingOptions, setPendingOptions] = useState<{ value: string; stock: number }[]>([]);

  const fetchInventory = async () => {
    try {
      const [pRes, cRes] = await Promise.all([
        fetch("/api/products", { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }),
        fetch("/api/categories", { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }),
      ]);
      const [pData, cData] = await Promise.all([pRes.json(), cRes.json()]);
      setProducts(Array.isArray(pData) ? pData : []);
      setCategories(Array.isArray(cData) ? cData : []);
    } catch { /* noop */ }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchInventory(); }, []);

  const openNew = () => {
    setEditingProduct({ type: activeTab, is_active: true, is_featured: false, stock_quantity: 0 });
    setVariationName(""); setPendingOptions([]); setNewOptValue(""); setNewOptStock(0);
    setIsModalOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditingProduct(p);
    setVariationName(""); setPendingOptions([]); setNewOptValue(""); setNewOptStock(0);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const method = editingProduct?.id ? "PUT" : "POST";
    const url = editingProduct?.id ? `/api/products/${editingProduct.id}` : "/api/products";

    // Auto-generate SKU slug if empty
    const payload = {
      ...editingProduct,
      type: editingProduct?.type || activeTab,
      is_active: editingProduct?.is_active ?? true,
      is_featured: editingProduct?.is_featured ?? false,
      sku: editingProduct?.sku?.trim() || (editingProduct?.name ? toSlug(editingProduct.name) : undefined),
    };

    try {
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setIsModalOpen(false);
        fetchInventory();
      }
    } catch { /* noop */ }
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
    finally {
      setDeleteLoading(false);
      setDeleteTarget(null);
    }
  };

  const handleAddPendingOption = () => {
    const v = newOptValue.trim();
    if (!v) return;
    if (pendingOptions.some(o => o.value.toLowerCase() === v.toLowerCase())) return;
    setPendingOptions(prev => [...prev, { value: v, stock: newOptStock }]);
    setNewOptValue(""); setNewOptStock(0);
  };

  const handleAddVariation = () => {
    const name = variationName.trim();
    if (!name || pendingOptions.length === 0) return;
    const current = Array.isArray(editingProduct?.variations) ? editingProduct!.variations : [];
    if (current.some(v => v.name.toLowerCase() === name.toLowerCase())) return;
    setEditingProduct(prev => ({ ...prev!, variations: [...current, { name, options: pendingOptions }] }));
    setVariationName(""); setPendingOptions([]); setNewOptValue(""); setNewOptStock(0);
  };

  const removeVariation = (i: number) => {
    const next = [...(editingProduct?.variations || [])];
    next.splice(i, 1);
    setEditingProduct(prev => ({ ...prev!, variations: next }));
  };

  const updateOptionStock = (varIdx: number, optIdx: number, stock: number) => {
    const vars = [...(editingProduct?.variations || [])];
    vars[varIdx] = { ...vars[varIdx], options: vars[varIdx].options.map((o, i) => i === optIdx ? { ...o, stock } : o) };
    setEditingProduct(prev => ({ ...prev!, variations: vars }));
  };

  const filteredProducts = products.filter(p => {
    if (p.type !== activeTab) return false;
    if (searchTerm && !p.name.toLowerCase().includes(searchTerm.toLowerCase()) && !(p.sku?.toLowerCase().includes(searchTerm.toLowerCase()))) return false;
    if (filterCategory && p.category_id !== filterCategory) return false;
    if (filterStatus === "active" && !p.is_active) return false;
    if (filterStatus === "inactive" && p.is_active) return false;
    return true;
  });

  const saleProducts = products.filter(p => p.type === "sale");
  const totalCost = saleProducts.reduce((s, p) => s + Number(p.cost_price || 0) * p.stock_quantity, 0);
  const totalRevenue = saleProducts.reduce((s, p) => s + Number(p.price || 0) * p.stock_quantity, 0);
  const lowStock = saleProducts.filter(p => p.stock_quantity <= 5 && p.is_active).length;
  const featured = saleProducts.filter(p => p.is_featured).length;

  const displaySku = (p: Product) => p.sku || toSlug(p.name);

  if (loading) return <LoadingState text="Carregando inventário..." />;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader
        title="Catálogo & Inventário"
        subtitle="Gestão de produtos e controle de estoque"
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              icon={viewMode === "table" ? <LayoutGrid size={14} /> : <List size={14} />}
              onClick={() => setViewMode(v => v === "table" ? "grid" : "table")}
            >
              {viewMode === "table" ? "Grade" : "Tabela"}
            </Button>
            <Button icon={<Plus size={14} />} onClick={openNew}>
              {activeTab === "sale" ? "Novo Produto" : "Novo Interno"}
            </Button>
          </div>
        }
      />

      {/* Stats */}
      <StatsGrid
        columns={4}
        stats={[
          { label: "Capital Imobilizado", value: `R$ ${totalCost.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, icon: <Package size={18} />, accent: "blue" },
          { label: "Potencial Faturamento", value: `R$ ${totalRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, icon: <TrendingUp size={18} />, accent: "emerald" },
          { label: "Estoque Crítico", value: lowStock, icon: <AlertTriangle size={18} />, accent: lowStock > 0 ? "red" : "slate" },
          { label: "Destaques Ativos", value: featured, icon: <Star size={18} />, accent: "amber" },
        ]}
      />

      {/* Tabs */}
      <Tabs defaultTab={activeTab} onChange={(v) => setActiveTab(v as "sale" | "internal")}>
        <TabList variant="pill">
          <Tab id="sale">Catálogo de Venda</Tab>
          <Tab id="internal">Uso Interno</Tab>
        </TabList>
      </Tabs>

      {/* Filters bar */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nome ou SKU..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 h-10 rounded-xl border border-slate-200 bg-white text-xs font-medium outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10 transition-all"
          />
        </div>
        <select
          value={filterCategory}
          onChange={e => setFilterCategory(e.target.value === "" ? "" : Number(e.target.value))}
          className="h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-600 outline-none focus:border-blue-400 transition-all"
        >
          <option value="">Todas as categorias</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value as typeof filterStatus)}
          className="h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-600 outline-none focus:border-blue-400 transition-all"
        >
          <option value="all">Todos os status</option>
          <option value="active">Ativos</option>
          <option value="inactive">Inativos</option>
        </select>
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-auto">
          {filteredProducts.length} item{filteredProducts.length !== 1 ? "s" : ""}
        </span>
      </div>

      {filteredProducts.length === 0 ? (
        <EmptyState
          icon={<Package size={40} strokeWidth={1} />}
          title="Nenhum produto encontrado"
          description="Ajuste os filtros ou cadastre um novo produto."
          action={<Button icon={<Plus size={14} />} onClick={openNew}>Cadastrar</Button>}
        />
      ) : viewMode === "table" ? (
        /* ── TABLE VIEW ── */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Produto</th>
                  <th className="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">SKU / ID</th>
                  <th className="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Categoria</th>
                  <th className="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Custo</th>
                  <th className="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Preço</th>
                  <th className="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Estoque</th>
                  <th className="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                  <th className="px-5 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <AnimatePresence>
                  {filteredProducts.map(p => (
                    <motion.tr
                      key={p.id}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="hover:bg-slate-50/60 transition-colors group"
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-xl border border-slate-200 bg-slate-50 overflow-hidden shrink-0 shadow-sm">
                            {p.image_url
                              ? <img src={p.image_url} alt={p.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                              : <div className="w-full h-full flex items-center justify-center"><ImageIcon size={16} className="text-slate-300" /></div>}
                          </div>
                          <div>
                            <p className="text-xs font-black text-slate-900 uppercase tracking-tight leading-tight">{p.name}</p>
                            <div className="flex items-center gap-1.5 mt-1">
                              {p.is_featured && <span className="text-[8px] bg-amber-500 text-white px-1.5 py-0.5 rounded-full font-black uppercase">★ Destaque</span>}
                              {p.discount_price && <span className="text-[8px] bg-red-500 text-white px-1.5 py-0.5 rounded-full font-black uppercase">PROMO</span>}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-[10px] font-mono font-black text-slate-400 uppercase tracking-tighter group-hover:text-blue-500 transition-colors">
                          {displaySku(p)}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        {p.category_name
                          ? <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1"><Tag size={10} />{p.category_name}</span>
                          : <span className="text-[10px] text-slate-300">—</span>}
                      </td>
                      <td className="px-5 py-3.5 text-[11px] font-mono font-black text-slate-500">
                        R$ {Number(p.cost_price || 0).toFixed(2)}
                      </td>
                      <td className="px-5 py-3.5 text-[11px] font-mono font-black">
                        {p.discount_price ? (
                          <div>
                            <span className="line-through text-slate-300 mr-1">R$ {Number(p.price).toFixed(2)}</span>
                            <span className="text-emerald-600">R$ {Number(p.discount_price).toFixed(2)}</span>
                          </div>
                        ) : (
                          <span className="text-slate-900">R$ {Number(p.price).toFixed(2)}</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className={cn("w-2 h-2 rounded-full shrink-0", p.stock_quantity <= 5 ? "bg-red-500 animate-pulse" : p.stock_quantity <= 15 ? "bg-amber-400" : "bg-emerald-500")} />
                          <span className={cn("text-xs font-mono font-black", p.stock_quantity <= 5 ? "text-red-600" : "text-slate-900")}>
                            {p.stock_quantity} <span className="text-[9px] text-slate-400 font-bold">UN</span>
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={cn(
                          "text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full",
                          p.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"
                        )}>
                          {p.is_active ? "Ativo" : "Inativo"}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <DropdownMenu
                          items={[
                            { label: "Editar produto", icon: <Edit2 size={13} />, onClick: () => openEdit(p) },
                            { label: "Excluir", icon: <Trash2 size={13} />, variant: "danger", onClick: () => setDeleteTarget(p) },
                          ]}
                        />
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ── GRID VIEW ── */
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          <AnimatePresence>
            {filteredProducts.map(p => (
              <motion.div
                key={p.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-lg transition-all group"
              >
                <div className="relative aspect-square bg-slate-50">
                  {p.image_url
                    ? <img src={p.image_url} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    : <div className="w-full h-full flex items-center justify-center"><Package size={32} strokeWidth={1} className="text-slate-200" /></div>}
                  <div className="absolute top-2 right-2 flex gap-1.5">
                    {p.is_featured && <span className="text-[8px] bg-amber-500 text-white px-1.5 py-0.5 rounded-full font-black shadow-sm">★</span>}
                    {p.discount_price && <span className="text-[8px] bg-red-500 text-white px-1.5 py-0.5 rounded-full font-black shadow-sm">%</span>}
                  </div>
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button onClick={() => openEdit(p)} className="w-9 h-9 bg-white rounded-xl flex items-center justify-center hover:bg-blue-50 transition-colors shadow-sm">
                      <Edit2 size={14} className="text-blue-600" />
                    </button>
                    <button onClick={() => setDeleteTarget(p)} className="w-9 h-9 bg-white rounded-xl flex items-center justify-center hover:bg-red-50 transition-colors shadow-sm">
                      <Trash2 size={14} className="text-red-500" />
                    </button>
                  </div>
                </div>
                <div className="p-3 space-y-1.5">
                  <p className="text-xs font-black text-slate-900 uppercase tracking-tight leading-tight line-clamp-2">{p.name}</p>
                  <p className="text-[9px] font-mono font-bold text-slate-400 uppercase">{displaySku(p)}</p>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-sm font-black font-mono text-blue-600">
                      R$ {Number(p.discount_price || p.price).toFixed(2)}
                    </span>
                    <span className={cn("text-[9px] font-bold px-2 py-0.5 rounded-full", p.stock_quantity <= 5 ? "bg-red-100 text-red-600" : "bg-emerald-100 text-emerald-700")}>
                      {p.stock_quantity} UN
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* ── MODAL ── */}
      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingProduct?.id ? "Editar Produto" : "Novo Produto"}
        subtitle={`Tipo: ${activeTab === "sale" ? "Venda" : "Uso Interno"}`}
        size="xl"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
            <Button form="product-form" type="submit" icon={<Save size={13} />} disabled={saving}>
              {saving ? "Salvando..." : editingProduct?.id ? "Salvar Alterações" : "Cadastrar Produto"}
            </Button>
          </>
        }
      >
        <form id="product-form" onSubmit={handleSave} className="space-y-5">
          {/* Image */}
          <ImageZone
            value={editingProduct?.image_url}
            onChange={(url) => setEditingProduct(prev => ({ ...prev!, image_url: url }))}
            onClear={() => setEditingProduct(prev => ({ ...prev!, image_url: "" }))}
          />

          <div className="border-t border-slate-100 pt-5 grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Nome do Produto *</label>
              <input
                type="text"
                required
                placeholder="Ex: Camiseta Básica Preta"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold uppercase outline-none h-10 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10 transition-all"
                value={editingProduct?.name || ""}
                onChange={e => setEditingProduct(prev => ({ ...prev!, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">SKU / Identificador</label>
              <input
                type="text"
                placeholder={editingProduct?.name ? toSlug(editingProduct.name) : "auto-gerado do nome"}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-mono font-bold uppercase outline-none h-10 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10 transition-all"
                value={editingProduct?.sku || ""}
                onChange={e => setEditingProduct(prev => ({ ...prev!, sku: e.target.value }))}
              />
              <p className="text-[9px] text-slate-400 px-1">Deixe vazio para gerar do nome automaticamente</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Categoria</label>
              <select
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold outline-none h-10 focus:border-blue-400 transition-all"
                value={editingProduct?.category_id || ""}
                onChange={e => setEditingProduct(prev => ({ ...prev!, category_id: Number(e.target.value) }))}
              >
                <option value="">Sem categoria</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-blue-500 uppercase tracking-widest px-1">Data de Validade</label>
              <input
                type="date"
                className="w-full bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5 text-xs font-bold outline-none h-10 focus:border-blue-400 transition-all"
                value={editingProduct?.expiry_date || ""}
                onChange={e => setEditingProduct(prev => ({ ...prev!, expiry_date: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Descrição</label>
            <textarea
              rows={3}
              placeholder="Descreva o produto, materiais, como usar..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-medium outline-none resize-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10 transition-all"
              value={editingProduct?.description || ""}
              onChange={e => setEditingProduct(prev => ({ ...prev!, description: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-orange-500 uppercase tracking-widest px-1">Custo Un. (R$)</label>
              <input
                type="number" step="0.01" min="0"
                className="w-full bg-orange-50 border border-orange-100 rounded-xl px-3 py-2.5 text-xs font-mono font-bold outline-none h-10 focus:border-orange-400 transition-all"
                value={editingProduct?.cost_price || ""}
                onChange={e => setEditingProduct(prev => ({ ...prev!, cost_price: Number(e.target.value) }))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-700 uppercase tracking-widest px-1">Preço Venda (R$) *</label>
              <input
                type="number" step="0.01" min="0" required
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-mono font-bold outline-none h-10 focus:border-blue-400 transition-all"
                value={editingProduct?.price || ""}
                onChange={e => setEditingProduct(prev => ({ ...prev!, price: Number(e.target.value) }))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest px-1">Promoção (R$)</label>
              <input
                type="number" step="0.01" min="0"
                className="w-full bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2.5 text-xs font-mono font-bold outline-none h-10 focus:border-emerald-400 transition-all"
                value={editingProduct?.discount_price || ""}
                onChange={e => {
                  const v = e.target.value;
                  setEditingProduct(prev => ({ ...prev!, discount_price: v === "" ? undefined : Number(v) }));
                }}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Estoque Atual</label>
            <input
              type="number" min="0" required
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-mono font-bold outline-none h-10 focus:border-blue-400 transition-all"
              value={editingProduct?.stock_quantity ?? 0}
              onChange={e => setEditingProduct(prev => ({ ...prev!, stock_quantity: Number(e.target.value) }))}
            />
          </div>

          {/* Switches */}
          <div className="flex flex-wrap gap-6 py-2 border-t border-slate-100 pt-4">
            <Switch
              label="Ativo no catálogo"
              checked={editingProduct?.is_active ?? true}
              onChange={v => setEditingProduct(prev => ({ ...prev!, is_active: v }))}
              accent="emerald"
            />
            {activeTab === "sale" && (
              <Switch
                label="Destaque na home"
                checked={editingProduct?.is_featured ?? false}
                onChange={v => setEditingProduct(prev => ({ ...prev!, is_featured: v }))}
                accent="amber"
              />
            )}
          </div>

          {/* Variations */}
          <div className="space-y-4 border-t border-slate-100 pt-5">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-900 border-l-4 border-blue-600 pl-3">Grades & Variações</h4>
                <p className="text-[9px] text-slate-400 font-medium pl-4 mt-0.5">Tamanho, cor, voltagem, etc.</p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
              <input
                type="text"
                placeholder="Nome do atributo (ex: Tamanho, Cor)"
                className="w-full bg-white border border-slate-200 rounded-lg px-3 text-[11px] font-bold uppercase outline-none h-10 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all"
                value={variationName}
                onChange={e => setVariationName(e.target.value)}
              />
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Valor (P, M, G, Azul...)"
                  className="flex-1 bg-white border border-slate-200 rounded-lg px-3 text-[11px] font-bold uppercase outline-none h-10 focus:border-blue-500 transition-all"
                  value={newOptValue}
                  onChange={e => setNewOptValue(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && (e.preventDefault(), handleAddPendingOption())}
                />
                <input
                  type="number" min="0" placeholder="Qtd"
                  className="w-20 bg-white border border-slate-200 rounded-lg px-3 text-[11px] font-mono font-bold outline-none h-10 focus:border-blue-500 transition-all text-center"
                  value={newOptStock || ""}
                  onChange={e => setNewOptStock(Number(e.target.value))}
                  onKeyDown={e => e.key === "Enter" && (e.preventDefault(), handleAddPendingOption())}
                />
                <button
                  type="button"
                  onClick={handleAddPendingOption}
                  disabled={!newOptValue.trim()}
                  className="w-10 h-10 flex items-center justify-center bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all disabled:opacity-40"
                >
                  <Plus size={16} strokeWidth={3} />
                </button>
              </div>

              {pendingOptions.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {pendingOptions.map((opt, i) => (
                    <div key={i} className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 rounded-lg px-2.5 py-1.5 text-[10px] font-black text-blue-700 uppercase">
                      {opt.value} <span className="text-blue-400">·</span> <span className="font-mono">{opt.stock}un</span>
                      <button type="button" onClick={() => setPendingOptions(prev => prev.filter((_, j) => j !== i))} className="ml-0.5 text-blue-400 hover:text-red-500">
                        <X size={10} strokeWidth={3} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={handleAddVariation}
                disabled={!variationName.trim() || pendingOptions.length === 0}
                className="w-full bg-slate-900 text-white h-10 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-black transition-all disabled:opacity-30"
              >
                <Plus size={14} strokeWidth={3} /> Adicionar Variação
              </button>
            </div>

            {Array.isArray(editingProduct?.variations) && editingProduct.variations.length > 0 ? (
              <div className="space-y-3">
                {editingProduct.variations.map((v, varIdx) => (
                  <motion.div key={varIdx} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest">{v.name}</p>
                      <button type="button" onClick={() => removeVariation(varIdx)} className="w-7 h-7 flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all">
                        <Trash2 size={12} />
                      </button>
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {v.options.map((opt, optIdx) => (
                        <div key={optIdx} className="bg-slate-50 rounded-lg p-2.5 border border-slate-100 space-y-1">
                          <p className="text-[9px] font-black uppercase tracking-widest text-slate-700 truncate">{opt.value}</p>
                          <input
                            type="number" min="0"
                            className="w-full bg-white border border-slate-200 rounded px-2 text-[11px] font-mono font-black outline-none h-8 text-center focus:border-blue-500 transition-all"
                            value={opt.stock}
                            onChange={e => updateOptionStock(varIdx, optIdx, Number(e.target.value))}
                          />
                          <p className="text-[8px] text-slate-400 text-center font-bold">UN</p>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="py-6 border-2 border-dashed border-slate-100 rounded-2xl text-center text-slate-400">
                <p className="text-[9px] font-black uppercase tracking-widest">Sem variações</p>
                <p className="text-[9px] font-medium mt-0.5">Adicione grades para controlar estoque por opção</p>
              </div>
            )}
          </div>
        </form>
      </Modal>

      {/* ── CONFIRM DELETE ── */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title={`Excluir "${deleteTarget?.name}"?`}
        description="Esta ação é irreversível. O produto e sua foto serão removidos permanentemente."
        variant="danger"
        confirmLabel="Excluir produto"
        loading={deleteLoading}
      />
    </div>
  );
}
