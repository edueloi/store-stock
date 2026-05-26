import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Plus, Edit2, Trash2, Image as ImageIcon, Save, X, Package,
  TrendingUp, Upload, LayoutGrid, List, Tag, Search, AlertTriangle,
  Star, ChevronLeft, ChevronRight, GripVertical, Zap, ArrowUpDown,
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

// ── helpers ────────────────────────────────────────────────────────────────
function toSlug(name: string) {
  return name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// ── preset variation templates por segmento ────────────────────────────────
const VARIATION_PRESETS: { label: string; icon: string; variations: { name: string; options: string[] }[] }[] = [
  {
    label: "Roupas", icon: "👕",
    variations: [
      { name: "Tamanho", options: ["PP", "P", "M", "G", "GG", "XGG"] },
      { name: "Cor", options: ["Preto", "Branco", "Cinza", "Azul", "Vermelho"] },
    ],
  },
  {
    label: "Calçados", icon: "👟",
    variations: [
      { name: "Número", options: ["34", "35", "36", "37", "38", "39", "40", "41", "42", "43", "44"] },
      { name: "Cor", options: ["Preto", "Branco", "Marrom", "Bege"] },
    ],
  },
  {
    label: "Eletrônicos", icon: "🔌",
    variations: [
      { name: "Voltagem", options: ["110V", "220V", "Bivolt"] },
      { name: "Cor", options: ["Preto", "Branco", "Prata"] },
    ],
  },
  {
    label: "Acessórios", icon: "💍",
    variations: [
      { name: "Tamanho", options: ["P", "M", "G", "Único"] },
      { name: "Material", options: ["Ouro", "Prata", "Aço", "Couro"] },
    ],
  },
  {
    label: "Perfumaria", icon: "🌸",
    variations: [
      { name: "Volume", options: ["30ml", "50ml", "75ml", "100ml", "150ml"] },
    ],
  },
  {
    label: "Alimentos", icon: "🥩",
    variations: [
      { name: "Peso", options: ["250g", "500g", "1kg", "2kg", "5kg"] },
      { name: "Sabor", options: ["Natural", "Com Sal", "Sem Sal"] },
    ],
  },
  {
    label: "Agro", icon: "🌱",
    variations: [
      { name: "Embalagem", options: ["1L", "5L", "10L", "20L", "50L"] },
      { name: "Formulação", options: ["Líquido", "Pó", "Grânulo"] },
    ],
  },
  {
    label: "Higiene", icon: "🧴",
    variations: [
      { name: "Volume", options: ["200ml", "400ml", "1L"] },
      { name: "Tipo", options: ["Normal", "Seco", "Oleoso", "Misto"] },
    ],
  },
];

// ── Multi-image gallery uploader ───────────────────────────────────────────
interface GalleryUploaderProps {
  images: string[];
  onChange: (imgs: string[]) => void;
}

function GalleryUploader({ images, onChange }: GalleryUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [selected, setSelected] = useState(0);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const dragItem = useRef<number | null>(null);

  const doUpload = useCallback(async (files: FileList | File[]) => {
    const arr = Array.from(files).filter(f => f.type.startsWith("image/")).slice(0, 10 - images.length);
    if (!arr.length) return;
    setUploading(true);
    try {
      const fd = new FormData();
      arr.forEach(f => fd.append("images", f));
      const res = await fetch("/api/upload/product-images", {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        body: fd,
      });
      const data = await res.json();
      if (data.urls) {
        const next = [...images, ...data.urls];
        onChange(next);
        setSelected(next.length - 1);
      }
    } finally {
      setUploading(false);
    }
  }, [images, onChange]);

  const removeImage = (i: number) => {
    const next = images.filter((_, idx) => idx !== i);
    onChange(next);
    setSelected(Math.min(selected, next.length - 1));
  };

  const moveImage = (from: number, to: number) => {
    const next = [...images];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
    setSelected(to);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) doUpload(e.dataTransfer.files);
  };

  const onThumbDragStart = (i: number) => { dragItem.current = i; };
  const onThumbDragOver = (e: React.DragEvent, i: number) => { e.preventDefault(); setDragOver(i); };
  const onThumbDrop = (e: React.DragEvent, i: number) => {
    e.preventDefault();
    if (dragItem.current !== null && dragItem.current !== i) moveImage(dragItem.current, i);
    dragItem.current = null;
    setDragOver(null);
  };

  const current = images[selected];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
          Fotos do Produto <span className="text-slate-400 normal-case font-normal">({images.length}/10)</span>
        </label>
        {images.length > 0 && (
          <button type="button" onClick={() => inputRef.current?.click()} className="text-[10px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1">
            <Plus size={10} /> Adicionar foto
          </button>
        )}
      </div>

      {/* ── Main preview (fixed height) ── */}
      <div className="relative h-48 rounded-xl overflow-hidden border border-slate-200 bg-slate-50 group">
        {current ? (
          <>
            <img src={current} alt="produto" className="w-full h-full object-contain" />
            {images.length > 1 && (
              <>
                <button type="button" onClick={() => setSelected(i => (i - 1 + images.length) % images.length)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 bg-white/90 rounded-full flex items-center justify-center shadow hover:bg-white transition-all opacity-0 group-hover:opacity-100">
                  <ChevronLeft size={13} />
                </button>
                <button type="button" onClick={() => setSelected(i => (i + 1) % images.length)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 bg-white/90 rounded-full flex items-center justify-center shadow hover:bg-white transition-all opacity-0 group-hover:opacity-100">
                  <ChevronRight size={13} />
                </button>
              </>
            )}
            <button type="button" onClick={() => removeImage(selected)}
              className="absolute top-2 right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow">
              <X size={10} strokeWidth={3} />
            </button>
            <div className="absolute bottom-2 right-2 bg-black/50 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
              {selected + 1}/{images.length}
            </div>
          </>
        ) : (
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={cn(
              "w-full h-full flex flex-col items-center justify-center gap-2 cursor-pointer transition-all",
              dragging ? "bg-blue-50" : "hover:bg-slate-100/80"
            )}
          >
            {uploading ? (
              <><div className="w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /><span className="text-[11px] font-bold text-blue-600">Enviando...</span></>
            ) : (
              <>
                <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center", dragging ? "bg-blue-100" : "bg-slate-100")}>
                  <Upload size={20} className={dragging ? "text-blue-500" : "text-slate-300"} />
                </div>
                <div className="text-center">
                  <p className="text-xs font-semibold text-slate-500">Arraste ou clique para adicionar fotos</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">JPG, PNG, WEBP · max 5 MB · até 10 fotos</p>
                </div>
              </>
            )}
          </div>
        )}
        {uploading && images.length > 0 && (
          <div className="absolute bottom-2 left-2 flex items-center gap-1.5 bg-white/90 rounded-full px-2 py-1 shadow text-[10px] font-bold text-blue-600">
            <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /> Enviando...
          </div>
        )}
      </div>

      {/* ── Thumbnail strip (horizontal) ── */}
      {images.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {images.map((url, i) => (
            <div
              key={i}
              draggable
              onDragStart={() => onThumbDragStart(i)}
              onDragOver={e => onThumbDragOver(e, i)}
              onDrop={e => onThumbDrop(e, i)}
              onDragLeave={() => setDragOver(null)}
              onClick={() => setSelected(i)}
              className={cn(
                "relative w-14 h-14 rounded-lg overflow-hidden border-2 cursor-pointer transition-all shrink-0 group/thumb",
                selected === i ? "border-blue-500 shadow-md" : "border-slate-200 hover:border-blue-300",
                dragOver === i && "border-blue-400 scale-105"
              )}
            >
              <img src={url} alt="" className="w-full h-full object-cover" />
              {i === 0 && (
                <span className="absolute bottom-0 left-0 right-0 bg-blue-600/80 text-white text-[7px] font-black text-center py-0.5 uppercase leading-tight">Capa</span>
              )}
              <button
                type="button"
                onClick={e => { e.stopPropagation(); removeImage(i); }}
                className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-500 text-white rounded-full items-center justify-center hidden group-hover/thumb:flex shadow"
              >
                <X size={8} strokeWidth={3} />
              </button>
              <div className="absolute top-0.5 left-0.5 opacity-25 pointer-events-none">
                <GripVertical size={9} className="text-white" />
              </div>
            </div>
          ))}
          {images.length < 10 && (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="w-14 h-14 rounded-lg border-2 border-dashed border-slate-200 flex items-center justify-center hover:border-blue-400 hover:bg-blue-50 transition-all shrink-0"
            >
              <Plus size={14} className="text-slate-300" />
            </button>
          )}
        </div>
      )}

      <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={e => { if (e.target.files) doUpload(e.target.files); e.target.value = ""; }} />
      <p className="text-[9px] text-slate-400 px-1">A primeira foto é a capa. Arraste as miniaturas para reordenar.</p>
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
  const [editingImages, setEditingImages] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filterCategory, setFilterCategory] = useState<number | "">("");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive">("all");
  const [sortBy, setSortBy] = useState<"name_asc" | "name_desc" | "price_asc" | "price_desc" | "stock_asc" | "stock_desc" | "newest">("newest");

  // Variation state — new attribute+SKU model
  const [newAttrName, setNewAttrName] = useState("");
  const [newAttrValue, setNewAttrValue] = useState("");
  const [showPresets, setShowPresets] = useState(false);

  type SortKey = typeof sortBy;
  const SORT_OPTIONS: { value: SortKey; label: string }[] = [
    { value: "newest",      label: "Mais recentes" },
    { value: "name_asc",    label: "Nome: A → Z" },
    { value: "name_desc",   label: "Nome: Z → A" },
    { value: "price_asc",   label: "Preço: menor → maior" },
    { value: "price_desc",  label: "Preço: maior → menor" },
    { value: "stock_asc",   label: "Estoque: menor → maior" },
    { value: "stock_desc",  label: "Estoque: maior → menor" },
  ];

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

  const resetVarState = () => { setNewAttrName(""); setNewAttrValue(""); setShowPresets(false); };

  const openNew = () => {
    setEditingProduct({ type: "sale", is_active: true, is_featured: false, stock_quantity: 0, attributes: [], skus: [] });
    setEditingImages([]);
    resetVarState();
    setIsModalOpen(true);
  };

  const openEdit = (p: Product) => {
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
    resetVarState();
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const method = editingProduct?.id ? "PUT" : "POST";
    const url = editingProduct?.id ? `/api/products/${editingProduct.id}` : "/api/products";

    // Derive total stock_quantity from SKU combos if using new model
    const skus = editingProduct?.skus || [];
    const derivedStock = skus.length > 0
      ? skus.reduce((s, k) => s + k.stock, 0)
      : editingProduct?.stock_quantity ?? 0;

    const payload = {
      ...editingProduct,
      type: editingProduct?.type || "sale",
      is_active: editingProduct?.is_active ?? true,
      is_featured: editingProduct?.is_featured ?? false,
      sku: editingProduct?.sku?.trim() || (editingProduct?.name ? toSlug(editingProduct.name) : undefined),
      image_url: editingImages[0] || null,
      images: editingImages,
      stock_quantity: derivedStock,
      attributes: editingProduct?.attributes || [],
      skus: editingProduct?.skus || [],
    };

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}` },
        body: JSON.stringify(payload),
      });
      if (res.ok) { setIsModalOpen(false); fetchInventory(); }
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
    finally { setDeleteLoading(false); setDeleteTarget(null); }
  };

  // ── helpers ────────────────────────────────────────────────────────
  function generateCombos(attrs: { name: string; values: string[] }[]): Record<string, string>[] {
    if (!attrs.length) return [];
    return attrs.reduce<Record<string, string>[]>((acc, attr) => {
      if (!attr.values.length) return acc;
      if (!acc.length) return attr.values.map(v => ({ [attr.name]: v }));
      return acc.flatMap(combo => attr.values.map(v => ({ ...combo, [attr.name]: v })));
    }, []);
  }

  function comboKey(combo: Record<string, string>) {
    return Object.entries(combo).map(([k, v]) => `${k}:${v}`).join("|");
  }

  // Add a value to an attribute (creates attr if new), then regenerate combos preserving existing stocks
  const addAttrValue = (attrName: string, value: string) => {
    const trimmedAttr = attrName.trim();
    const trimmedVal = value.trim();
    if (!trimmedAttr || !trimmedVal) return;

    const attrs = [...(editingProduct?.attributes || [])];
    const idx = attrs.findIndex(a => a.name.toLowerCase() === trimmedAttr.toLowerCase());
    if (idx >= 0) {
      if (attrs[idx].values.some(v => v.toLowerCase() === trimmedVal.toLowerCase())) return;
      attrs[idx] = { ...attrs[idx], values: [...attrs[idx].values, trimmedVal] };
    } else {
      attrs.push({ name: trimmedAttr, values: [trimmedVal] });
    }

    const oldSkus = editingProduct?.skus || [];
    const oldMap = Object.fromEntries(oldSkus.map(s => [comboKey(s.combo), s.stock]));
    const newCombos = generateCombos(attrs);
    const newSkus = newCombos.map(combo => ({ combo, stock: oldMap[comboKey(combo)] ?? 0 }));

    setEditingProduct(prev => ({ ...prev!, attributes: attrs, skus: newSkus }));
    setNewAttrValue("");
  };

  const removeAttrValue = (attrIdx: number, valIdx: number) => {
    const attrs = [...(editingProduct?.attributes || [])];
    const newVals = attrs[attrIdx].values.filter((_, i) => i !== valIdx);
    if (newVals.length === 0) {
      attrs.splice(attrIdx, 1);
    } else {
      attrs[attrIdx] = { ...attrs[attrIdx], values: newVals };
    }
    const oldSkus = editingProduct?.skus || [];
    const oldMap = Object.fromEntries(oldSkus.map(s => [comboKey(s.combo), s.stock]));
    const newCombos = generateCombos(attrs);
    const newSkus = newCombos.map(combo => ({ combo, stock: oldMap[comboKey(combo)] ?? 0 }));
    setEditingProduct(prev => ({ ...prev!, attributes: attrs, skus: newSkus }));
  };

  const updateSkuStock = (skuIdx: number, stock: number) => {
    const skus = [...(editingProduct?.skus || [])];
    skus[skuIdx] = { ...skus[skuIdx], stock };
    setEditingProduct(prev => ({ ...prev!, skus }));
  };

  const applyPreset = (preset: typeof VARIATION_PRESETS[0]) => {
    const current = editingProduct?.attributes || [];
    const oldSkus = editingProduct?.skus || [];
    const oldMap = Object.fromEntries(oldSkus.map(s => [comboKey(s.combo), s.stock]));
    const toAdd = preset.variations.filter(pv => !current.some(a => a.name.toLowerCase() === pv.name.toLowerCase()));
    if (!toAdd.length) { setShowPresets(false); return; }
    const attrs = [...current, ...toAdd.map(v => ({ name: v.name, values: v.options }))];
    const newCombos = generateCombos(attrs);
    const newSkus = newCombos.map(combo => ({ combo, stock: oldMap[comboKey(combo)] ?? 0 }));
    setEditingProduct(prev => ({ ...prev!, attributes: attrs, skus: newSkus }));
    setShowPresets(false);
  };

  const filteredProducts = [...products]
    .filter(p => {
      if (p.type !== "sale") return false;
      if (searchTerm && !p.name.toLowerCase().includes(searchTerm.toLowerCase()) && !(p.sku?.toLowerCase().includes(searchTerm.toLowerCase()))) return false;
      if (filterCategory && p.category_id !== filterCategory) return false;
      if (filterStatus === "active" && !p.is_active) return false;
      if (filterStatus === "inactive" && p.is_active) return false;
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "name_asc":   return a.name.localeCompare(b.name, "pt-BR");
        case "name_desc":  return b.name.localeCompare(a.name, "pt-BR");
        case "price_asc":  return Number(a.discount_price ?? a.price) - Number(b.discount_price ?? b.price);
        case "price_desc": return Number(b.discount_price ?? b.price) - Number(a.discount_price ?? a.price);
        case "stock_asc":  return a.stock_quantity - b.stock_quantity;
        case "stock_desc": return b.stock_quantity - a.stock_quantity;
        default:           return b.id - a.id; // newest
      }
    });

  const saleProducts = products.filter(p => p.type === "sale");
  const totalCost = saleProducts.reduce((s, p) => s + Number(p.cost_price || 0) * p.stock_quantity, 0);
  const totalRevenue = saleProducts.reduce((s, p) => s + Number(p.price || 0) * p.stock_quantity, 0);
  const lowStock = saleProducts.filter(p => p.stock_quantity <= 5 && p.is_active).length;
  const featured = saleProducts.filter(p => p.is_featured).length;

  const displaySku = (p: Product) => p.sku || toSlug(p.name);
  const coverImg = (p: Product) => (Array.isArray(p.images) && p.images[0]) || p.image_url;
  const imgCount = (p: Product) => {
    const imgs = Array.isArray(p.images) ? p.images : [];
    return imgs.length || (p.image_url ? 1 : 0);
  };

  if (loading) return <LoadingState text="Carregando inventário..." />;

  return (
    <div className="space-y-6 ">
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
              Novo Produto
            </Button>
          </div>
        }
      />

      <StatsGrid columns={4} stats={[
        { label: "Capital Imobilizado", value: `R$ ${totalCost.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, icon: <Package size={18} />, accent: "blue" },
        { label: "Potencial Faturamento", value: `R$ ${totalRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, icon: <TrendingUp size={18} />, accent: "emerald" },
        { label: "Estoque Crítico", value: lowStock, icon: <AlertTriangle size={18} />, accent: lowStock > 0 ? "red" : "slate" },
        { label: "Destaques Ativos", value: featured, icon: <Star size={18} />, accent: "amber" },
      ]} />

      {/* Filters */}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        {/* search */}
        <div className="relative flex-1 min-w-0 sm:min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder="Buscar por nome ou SKU..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 h-10 rounded-xl border border-slate-200 bg-white text-xs font-medium outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10 transition-all" />
        </div>

        {/* category + status + sort — row on mobile too */}
        <div className="flex gap-2 flex-wrap">
          <select value={filterCategory} onChange={e => setFilterCategory(e.target.value === "" ? "" : Number(e.target.value))}
            className="h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-600 outline-none focus:border-blue-400 transition-all">
            <option value="">Todas as categorias</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>

          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as typeof filterStatus)}
            className="h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-600 outline-none focus:border-blue-400 transition-all">
            <option value="all">Todos os status</option>
            <option value="active">Ativos</option>
            <option value="inactive">Inativos</option>
          </select>

          {/* sort */}
          <div className="relative flex items-center">
            <ArrowUpDown size={13} className="absolute left-3 text-slate-400 pointer-events-none" />
            <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}
              className="h-10 pl-8 pr-3 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-600 outline-none focus:border-blue-400 transition-all appearance-none">
              {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>

        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest sm:ml-auto">
          {filteredProducts.length} produto{filteredProducts.length !== 1 ? "s" : ""}
        </span>
      </div>

      {filteredProducts.length === 0 ? (
        <EmptyState icon={<Package size={40} strokeWidth={1} />} title="Nenhum produto encontrado"
          description="Ajuste os filtros ou cadastre um novo produto."
          action={<Button icon={<Plus size={14} />} onClick={openNew}>Cadastrar</Button>} />
      ) : viewMode === "table" ? (<>
        {/* ── MOBILE: card list (< sm) ── */}
        <div className="sm:hidden space-y-2">
          <AnimatePresence>
            {filteredProducts.map(p => (
              <motion.div key={p.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="flex items-center gap-3 p-3">
                  {/* thumb */}
                  <div className="relative w-14 h-14 shrink-0 rounded-xl overflow-hidden border border-slate-100 bg-slate-50">
                    {coverImg(p)
                      ? <img src={coverImg(p)} alt={p.name} className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center"><ImageIcon size={18} className="text-slate-300" /></div>}
                    {imgCount(p) > 1 && (
                      <span className="absolute bottom-0 right-0 bg-slate-700/80 text-white text-[8px] font-black w-4 h-4 flex items-center justify-center rounded-tl-lg">
                        {imgCount(p)}
                      </span>
                    )}
                  </div>
                  {/* info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-bold text-slate-900 leading-tight truncate">{p.name}</p>
                      <span className={cn("text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0", p.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400")}>
                        {p.is_active ? "Ativo" : "Inativo"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      {p.category_name && <span className="text-[9px] text-slate-400 font-medium">{p.category_name}</span>}
                      {p.is_featured && <span className="text-[8px] bg-amber-500 text-white px-1.5 py-0.5 rounded-full font-black">★ Destaque</span>}
                      {p.discount_price && <span className="text-[8px] bg-red-500 text-white px-1.5 py-0.5 rounded-full font-black">PROMO</span>}
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold font-mono text-blue-600">
                          R$ {Number(p.discount_price || p.price).toFixed(2)}
                        </span>
                        <div className="flex items-center gap-1">
                          <div className={cn("w-1.5 h-1.5 rounded-full", p.stock_quantity <= 5 ? "bg-red-500" : p.stock_quantity <= 15 ? "bg-amber-400" : "bg-emerald-500")} />
                          <span className={cn("text-xs font-mono font-bold", p.stock_quantity <= 5 ? "text-red-600" : "text-slate-600")}>
                            {p.stock_quantity} un
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(p)} className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-50 hover:bg-blue-50 transition-colors">
                          <Edit2 size={14} className="text-blue-600" />
                        </button>
                        <button onClick={() => setDeleteTarget(p)} className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-50 hover:bg-red-50 transition-colors">
                          <Trash2 size={14} className="text-red-500" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* ── DESKTOP: table (≥ sm) ── */}
        <div className="hidden sm:block bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Produto</th>
                  <th className="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">SKU</th>
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
                    <motion.tr key={p.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="hover:bg-slate-50/60 transition-colors group">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="relative w-11 h-11 shrink-0">
                            <div className="w-11 h-11 rounded-xl border border-slate-200 bg-slate-50 overflow-hidden shadow-sm">
                              {coverImg(p) ? <img src={coverImg(p)} alt={p.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                                : <div className="w-full h-full flex items-center justify-center"><ImageIcon size={16} className="text-slate-300" /></div>}
                            </div>
                            {imgCount(p) > 1 && (
                              <span className="absolute -bottom-1 -right-1 bg-slate-700 text-white text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow">
                                {imgCount(p)}
                              </span>
                            )}
                          </div>
                          <div>
                            <p className="text-xs font-black text-slate-900 uppercase tracking-tight leading-tight">{p.name}</p>
                            <div className="flex items-center gap-1.5 mt-1">
                              {p.is_featured && <span className="text-[8px] bg-amber-500 text-white px-1.5 py-0.5 rounded-full font-black">★ Destaque</span>}
                              {p.discount_price && <span className="text-[8px] bg-red-500 text-white px-1.5 py-0.5 rounded-full font-black">PROMO</span>}
                              {Array.isArray(p.variations) && p.variations.length > 0 && (
                                <span className="text-[8px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-black">{p.variations.length} var.</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-[10px] font-mono font-black text-slate-400 uppercase tracking-tighter group-hover:text-blue-500 transition-colors">{displaySku(p)}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        {p.category_name ? <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1"><Tag size={10} />{p.category_name}</span>
                          : <span className="text-[10px] text-slate-300">—</span>}
                      </td>
                      <td className="px-5 py-3.5 text-[11px] font-mono font-black text-slate-500">R$ {Number(p.cost_price || 0).toFixed(2)}</td>
                      <td className="px-5 py-3.5 text-[11px] font-mono font-black">
                        {p.discount_price ? (
                          <div><span className="line-through text-slate-300 mr-1">R$ {Number(p.price).toFixed(2)}</span><span className="text-emerald-600">R$ {Number(p.discount_price).toFixed(2)}</span></div>
                        ) : <span className="text-slate-900">R$ {Number(p.price).toFixed(2)}</span>}
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
                        <span className={cn("text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full", p.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400")}>
                          {p.is_active ? "Ativo" : "Inativo"}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <DropdownMenu items={[
                          { label: "Editar produto", icon: <Edit2 size={13} />, onClick: () => openEdit(p) },
                          { label: "Excluir", icon: <Trash2 size={13} />, variant: "danger", onClick: () => setDeleteTarget(p) },
                        ]} />
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </div>
      </>) : (
        /* GRID */
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
          <AnimatePresence>
            {filteredProducts.map(p => (
              <motion.div key={p.id} layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-lg transition-all group">
                <div className="relative aspect-square bg-slate-50">
                  {coverImg(p) ? <img src={coverImg(p)} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    : <div className="w-full h-full flex items-center justify-center"><Package size={32} strokeWidth={1} className="text-slate-200" /></div>}
                  <div className="absolute top-2 right-2 flex gap-1">
                    {p.is_featured && <span className="text-[8px] bg-amber-500 text-white px-1.5 py-0.5 rounded-full font-black shadow-sm">★</span>}
                    {p.discount_price && <span className="text-[8px] bg-red-500 text-white px-1.5 py-0.5 rounded-full font-black shadow-sm">%</span>}
                  </div>
                  {imgCount(p) > 1 && (
                    <span className="absolute bottom-2 left-2 bg-black/60 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-1">
                      <ImageIcon size={9} /> {imgCount(p)}
                    </span>
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button onClick={() => openEdit(p)} className="w-9 h-9 bg-white rounded-xl flex items-center justify-center hover:bg-blue-50 transition-colors shadow-sm"><Edit2 size={14} className="text-blue-600" /></button>
                    <button onClick={() => setDeleteTarget(p)} className="w-9 h-9 bg-white rounded-xl flex items-center justify-center hover:bg-red-50 transition-colors shadow-sm"><Trash2 size={14} className="text-red-500" /></button>
                  </div>
                </div>
                <div className="p-3 space-y-1">
                  <p className="text-xs font-bold text-slate-900 leading-tight line-clamp-2">{p.name}</p>
                  <p className="text-[9px] font-mono text-slate-400 uppercase truncate">{displaySku(p)}</p>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-sm font-bold font-mono text-blue-600">R$ {Number(p.discount_price || p.price).toFixed(2)}</span>
                    <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-full", p.stock_quantity <= 5 ? "bg-red-100 text-red-600" : "bg-emerald-100 text-emerald-700")}>
                      {p.stock_quantity} un
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* ── MODAL ── */}
      <Modal open={isModalOpen} onClose={() => setIsModalOpen(false)}
        title={editingProduct?.id ? "Editar Produto" : "Novo Produto"}
        subtitle="Catálogo de venda"
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

          {/* ── GALERIA ── */}
          <GalleryUploader images={editingImages} onChange={setEditingImages} />

          <div className="border-t border-slate-100 pt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Nome do Produto *</label>
              <input type="text" required placeholder="Ex: Camiseta Básica Preta"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold uppercase outline-none h-10 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10 transition-all"
                value={editingProduct?.name || ""}
                onChange={e => setEditingProduct(prev => ({ ...prev!, name: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">SKU / Identificador</label>
              <input type="text" placeholder={editingProduct?.name ? toSlug(editingProduct.name) : "auto-gerado do nome"}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-mono font-bold uppercase outline-none h-10 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10 transition-all"
                value={editingProduct?.sku || ""}
                onChange={e => setEditingProduct(prev => ({ ...prev!, sku: e.target.value }))} />
              <p className="text-[9px] text-slate-400 px-1">Vazio = gerado do nome automaticamente</p>
            </div>
          </div>

          {/* Barcode */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Código de Barras (EAN / ISBN / Interno)</label>
            <div className="flex gap-2">
              <input type="text" placeholder="Ex: 7891234567890 — deixe vazio para gerar automaticamente"
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-mono font-bold outline-none h-10 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10 transition-all"
                value={editingProduct?.barcode || ""}
                onChange={e => setEditingProduct(prev => ({ ...prev!, barcode: e.target.value }))} />
              <button type="button"
                className="h-10 px-4 bg-slate-900 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-slate-700 transition-all shrink-0"
                onClick={() => {
                  const code = String(Date.now()).slice(-12).padStart(12, "0");
                  const digits = code.split("").map(Number);
                  const check = (10 - (digits.reduce((s, d, i) => s + d * (i % 2 === 0 ? 1 : 3), 0) % 10)) % 10;
                  setEditingProduct(prev => ({ ...prev!, barcode: code + check }));
                }}>
                Gerar
              </button>
            </div>
            <p className="text-[9px] text-slate-400 px-1">Usado no leitor do PDV. Aceita EAN-13, EAN-8, Code128 ou código interno.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Categoria</label>
              <select className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold outline-none h-10 focus:border-blue-400 transition-all"
                value={editingProduct?.category_id || ""}
                onChange={e => setEditingProduct(prev => ({ ...prev!, category_id: Number(e.target.value) }))}>
                <option value="">Sem categoria</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-blue-500 uppercase tracking-widest px-1">Data de Validade</label>
              <input type="date"
                className="w-full bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5 text-xs font-bold outline-none h-10 focus:border-blue-400 transition-all"
                value={editingProduct?.expiry_date || ""}
                onChange={e => setEditingProduct(prev => ({ ...prev!, expiry_date: e.target.value }))} />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Descrição</label>
            <textarea rows={3} placeholder="Descreva o produto, materiais, como usar..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-medium outline-none resize-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10 transition-all"
              value={editingProduct?.description || ""}
              onChange={e => setEditingProduct(prev => ({ ...prev!, description: e.target.value }))} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-orange-500 uppercase tracking-widest px-1">Custo Un. (R$)</label>
              <input type="number" step="0.01" min="0"
                className="w-full bg-orange-50 border border-orange-100 rounded-xl px-3 py-2.5 text-xs font-mono font-bold outline-none h-10 focus:border-orange-400 transition-all"
                value={editingProduct?.cost_price || ""}
                onChange={e => setEditingProduct(prev => ({ ...prev!, cost_price: Number(e.target.value) }))} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-700 uppercase tracking-widest px-1">Preço Venda (R$) *</label>
              <input type="number" step="0.01" min="0" required
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-mono font-bold outline-none h-10 focus:border-blue-400 transition-all"
                value={editingProduct?.price || ""}
                onChange={e => setEditingProduct(prev => ({ ...prev!, price: Number(e.target.value) }))} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest px-1">Promoção (R$)</label>
              <input type="number" step="0.01" min="0"
                className="w-full bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2.5 text-xs font-mono font-bold outline-none h-10 focus:border-emerald-400 transition-all"
                value={editingProduct?.discount_price || ""}
                onChange={e => { const v = e.target.value; setEditingProduct(prev => ({ ...prev!, discount_price: v === "" ? undefined : Number(v) })); }} />
            </div>
          </div>

          {(editingProduct?.skus || []).length === 0 && (
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Estoque Atual</label>
              <input type="number" min="0" required
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-mono font-bold outline-none h-10 focus:border-blue-400 transition-all"
                value={editingProduct?.stock_quantity ?? 0}
                onChange={e => setEditingProduct(prev => ({ ...prev!, stock_quantity: Number(e.target.value) }))} />
            </div>
          )}

          <div className="flex flex-wrap gap-6 border-t border-slate-100 pt-4">
            <Switch label="Ativo no catálogo" checked={editingProduct?.is_active ?? true}
              onChange={v => setEditingProduct(prev => ({ ...prev!, is_active: v }))} accent="emerald" />
            <Switch label="Destaque na home" checked={editingProduct?.is_featured ?? false}
              onChange={v => setEditingProduct(prev => ({ ...prev!, is_featured: v }))} accent="amber" />
          </div>

          {/* ── VARIAÇÕES ── */}
          <div className="space-y-4 border-t border-slate-100 pt-5">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-900 border-l-4 border-blue-600 pl-3">Grades & Variações</h4>
                <p className="text-[9px] text-slate-400 font-medium pl-4 mt-0.5">Tamanho, cor, voltagem, peso, etc.</p>
              </div>
              {/* Preset picker trigger */}
              <button type="button" onClick={() => setShowPresets(v => !v)}
                className="flex items-center gap-1.5 px-3 h-8 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 text-[10px] font-black uppercase tracking-wider hover:bg-blue-100 transition-all">
                <Zap size={11} /> Modelos rápidos
              </button>
            </div>

            {/* Preset panel */}
            <AnimatePresence>
              {showPresets && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2.5">Selecione o segmento para carregar variações pré-definidas:</p>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {VARIATION_PRESETS.map(preset => (
                        <button key={preset.label} type="button" onClick={() => applyPreset(preset)}
                          className="flex flex-col items-center gap-1 p-2.5 rounded-xl border border-slate-200 bg-white hover:border-blue-400 hover:bg-blue-50 transition-all group">
                          <span className="text-xl">{preset.icon}</span>
                          <span className="text-[9px] font-black text-slate-600 uppercase tracking-wider group-hover:text-blue-700">{preset.label}</span>
                        </button>
                      ))}
                    </div>
                    <p className="text-[8px] text-slate-400 mt-2">Você pode editar os valores depois de adicionar.</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Step 1: Atributos ── */}
            <div className="space-y-3">
              {(editingProduct?.attributes || []).map((attr, attrIdx) => (
                <motion.div key={attrIdx} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
                  className="bg-white border border-slate-200 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-black text-slate-800 uppercase tracking-wider">{attr.name}
                      <span className="ml-2 text-slate-400 font-medium normal-case tracking-normal text-[9px]">{attr.values.length} valor{attr.values.length !== 1 ? "es" : ""}</span>
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {attr.values.map((val, valIdx) => (
                      <span key={valIdx} className="inline-flex items-center gap-1 bg-blue-50 border border-blue-200 text-blue-700 text-[10px] font-bold px-2.5 py-1 rounded-lg">
                        {val}
                        <button type="button" onClick={() => removeAttrValue(attrIdx, valIdx)} className="text-blue-300 hover:text-red-500 transition-colors ml-0.5">
                          <X size={9} strokeWidth={3} />
                        </button>
                      </span>
                    ))}
                    {/* inline add value to existing attr */}
                    <input type="text" placeholder="+ valor"
                      className="w-20 bg-slate-50 border border-dashed border-slate-300 rounded-lg px-2 text-[10px] font-bold outline-none h-7 focus:border-blue-400 focus:bg-white transition-all"
                      onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); const inp = e.currentTarget; addAttrValue(attr.name, inp.value); inp.value = ""; } }} />
                  </div>
                </motion.div>
              ))}
            </div>

            {/* ── Add new attribute ── */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Adicionar atributo</p>
              <div className="flex gap-2">
                <input type="text" placeholder="Atributo (Tamanho, Cor...)"
                  className="flex-1 bg-white border border-slate-200 rounded-lg px-3 text-[11px] font-bold uppercase outline-none h-9 focus:border-blue-500 transition-all min-w-0"
                  value={newAttrName} onChange={e => setNewAttrName(e.target.value)} />
                <input type="text" placeholder="1º valor (P, Azul...)"
                  className="flex-1 bg-white border border-slate-200 rounded-lg px-3 text-[11px] font-bold uppercase outline-none h-9 focus:border-blue-500 transition-all min-w-0"
                  value={newAttrValue} onChange={e => setNewAttrValue(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addAttrValue(newAttrName, newAttrValue); setNewAttrName(""); } }} />
                <button type="button"
                  onClick={() => { addAttrValue(newAttrName, newAttrValue); setNewAttrName(""); }}
                  disabled={!newAttrName.trim() || !newAttrValue.trim()}
                  className="w-9 h-9 flex items-center justify-center bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all disabled:opacity-40 shrink-0">
                  <Plus size={15} strokeWidth={3} />
                </button>
              </div>
              <p className="text-[9px] text-slate-400">Para adicionar mais valores ao mesmo atributo, use os campos inline acima ou clique novamente com o mesmo nome.</p>
            </div>

            {/* ── Step 2: Combinações (SKU matrix) ── */}
            {(editingProduct?.skus || []).length > 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-1 h-4 bg-blue-600 rounded-full" />
                  <p className="text-[10px] font-black text-slate-800 uppercase tracking-wider">Estoque por combinação</p>
                  <span className="text-[9px] bg-blue-100 text-blue-600 font-bold px-2 py-0.5 rounded-full">
                    {(editingProduct?.skus || []).length} SKU{(editingProduct?.skus || []).length !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <div className="divide-y divide-slate-100">
                    {(editingProduct?.skus || []).map((sku, skuIdx) => {
                      const label = Object.values(sku.combo).join(" · ");
                      return (
                        <div key={skuIdx} className="flex items-center gap-3 px-4 py-2.5">
                          <p className="flex-1 text-xs font-semibold text-slate-700 min-w-0 truncate">{label}</p>
                          <div className="flex items-center gap-2 shrink-0">
                            <input type="number" min="0"
                              className="w-20 bg-slate-50 border border-slate-200 rounded-lg px-2 text-xs font-mono font-bold outline-none h-8 text-center focus:border-blue-500 transition-all"
                              value={sku.stock}
                              onChange={e => updateSkuStock(skuIdx, Number(e.target.value))} />
                            <span className="text-[9px] text-slate-400 font-bold w-4">un</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="bg-slate-50 px-4 py-2 border-t border-slate-100 flex justify-between items-center">
                    <span className="text-[9px] text-slate-400 font-medium">Total em estoque</span>
                    <span className="text-sm font-black text-slate-900 font-mono">
                      {(editingProduct?.skus || []).reduce((s, k) => s + k.stock, 0)} un
                    </span>
                  </div>
                </div>
              </motion.div>
            )}

            {(editingProduct?.attributes || []).length === 0 && (
              <div className="py-5 border-2 border-dashed border-slate-100 rounded-2xl text-center text-slate-400">
                <p className="text-[9px] font-black uppercase tracking-widest">Sem variações</p>
                <p className="text-[9px] font-medium mt-0.5">Use "Modelos rápidos" ou adicione atributos acima</p>
              </div>
            )}
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={confirmDelete}
        title={`Excluir "${deleteTarget?.name}"?`}
        description="Todas as fotos e dados serão removidos permanentemente."
        variant="danger" confirmLabel="Excluir produto" loading={deleteLoading} />
    </div>
  );
}
