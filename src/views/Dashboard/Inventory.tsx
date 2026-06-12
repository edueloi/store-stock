import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Plus, Edit2, Trash2, Image as ImageIcon, Save, X, Package,
  TrendingUp, Upload, LayoutGrid, List, Tag, Search, AlertTriangle,
  Star, ChevronLeft, ChevronRight, GripVertical, Zap, ArrowUpDown, FileUp, CheckSquare,
  History, ArrowRight, Loader2, ArrowUp, ArrowDown, SlidersHorizontal,
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
import PdfImportModal from "../../components/ui/PdfImportModal";

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
  const [filterLowStock, setFilterLowStock] = useState(false);

  type SortField = "name" | "price" | "stock" | "id";
  type SortDir = "asc" | "desc";
  const [sortField, setSortField] = useState<SortField>("id");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("desc"); }
  };

  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);

  // Variation state — new attribute+SKU model
  const [newAttrName, setNewAttrName] = useState("");
  const [newAttrValue, setNewAttrValue] = useState("");
  const [showPresets, setShowPresets] = useState(false);

  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);

  // ── bulk selection ──────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);

  // Product history panel
  interface HistoryEntry { id: number; field: string; old_value: string | null; new_value: string | null; created_at: string; }
  const [historyProduct, setHistoryProduct] = useState<Product | null>(null);
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

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
    setEditingProduct({ type: "sale", is_active: false, is_featured: false, stock_quantity: 0, attributes: [], skus: [] });
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
      const removedVal = attrs[attrIdx].values[valIdx];
      const colors = { ...(attrs[attrIdx].colors || {}) };
      delete colors[removedVal];
      attrs[attrIdx] = { ...attrs[attrIdx], values: newVals, colors };
    }
    const oldSkus = editingProduct?.skus || [];
    const oldMap = Object.fromEntries(oldSkus.map(s => [comboKey(s.combo), s.stock]));
    const newCombos = generateCombos(attrs);
    const newSkus = newCombos.map(combo => ({ combo, stock: oldMap[comboKey(combo)] ?? 0 }));
    setEditingProduct(prev => ({ ...prev!, attributes: attrs, skus: newSkus }));
  };

  const updateAttrColor = (attrIdx: number, val: string, hex: string) => {
    const attrs = [...(editingProduct?.attributes || [])];
    attrs[attrIdx] = { ...attrs[attrIdx], colors: { ...(attrs[attrIdx].colors || {}), [val]: hex } };
    setEditingProduct(prev => ({ ...prev!, attributes: attrs }));
  };

  const updateSkuStock = (skuIdx: number, stock: number) => {
    const skus = [...(editingProduct?.skus || [])];
    skus[skuIdx] = { ...skus[skuIdx], stock };
    setEditingProduct(prev => ({ ...prev!, skus }));
  };

  const applyPreset = (preset: typeof VARIATION_PRESETS[0]) => {
    // Replace all current attributes with the preset (full replace, not merge)
    const attrs = preset.variations.map(v => ({ name: v.name, values: v.options }));
    const newCombos = generateCombos(attrs);
    const newSkus = newCombos.map(combo => ({ combo, stock: 0 }));
    setEditingProduct(prev => ({ ...prev!, attributes: attrs, skus: newSkus }));
    setShowPresets(false);
  };

  const clearAttributes = () => {
    setEditingProduct(prev => ({ ...prev!, attributes: [], skus: [] }));
  };

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

  const filteredProducts = [...products]
    .filter(p => {
      if (p.type !== "sale") return false;
      if (searchTerm && !p.name.toLowerCase().includes(searchTerm.toLowerCase()) && !(p.sku?.toLowerCase().includes(searchTerm.toLowerCase()))) return false;
      if (filterCategory && p.category_id !== filterCategory) return false;
      if (filterStatus === "active" && !p.is_active) return false;
      if (filterStatus === "inactive" && p.is_active) return false;
      if (filterLowStock && p.stock_quantity > 5) return false;
      return true;
    })
    .sort((a, b) => {
      let cmp = 0;
      if (sortField === "name")  cmp = a.name.localeCompare(b.name, "pt-BR");
      if (sortField === "price") cmp = Number(a.discount_price ?? a.price) - Number(b.discount_price ?? b.price);
      if (sortField === "stock") cmp = a.stock_quantity - b.stock_quantity;
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
  const allSelected = filteredProducts.length > 0 && selectedIds.size === filteredProducts.length;
  const someSelected = selectedIds.size > 0 && !allSelected;

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
            <Button variant="secondary" icon={<FileUp size={14} />} onClick={() => setIsPdfModalOpen(true)}>
              Importar PDF
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
      <div className="space-y-2">
        {/* Row 1: search + page size */}
        <div className="flex gap-2 items-center">
          <div className="relative flex-1 min-w-0">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" placeholder="Buscar por nome ou SKU..." value={searchTerm}
              onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="w-full pl-9 pr-4 h-9 rounded-xl border border-slate-200 bg-white text-xs font-medium outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10 transition-all" />
          </div>
          <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
            className="h-9 px-2 rounded-xl border border-slate-200 bg-white text-[11px] font-bold text-slate-600 outline-none focus:border-blue-400 transition-all shrink-0">
            <option value={15}>15 / pág</option>
            <option value={25}>25 / pág</option>
            <option value={50}>50 / pág</option>
            <option value={100}>100 / pág</option>
          </select>
        </div>

        {/* Row 2: filter chips */}
        <div className="flex gap-1.5 flex-wrap items-center">
          <SlidersHorizontal size={12} className="text-slate-400 shrink-0" />

          {/* Category select as compact chip */}
          <select value={filterCategory} onChange={e => { setFilterCategory(e.target.value === "" ? "" : Number(e.target.value)); setCurrentPage(1); }}
            className={cn(
              "h-7 px-2 rounded-lg border text-[11px] font-bold outline-none transition-all",
              filterCategory ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-slate-200 hover:border-blue-300"
            )}>
            <option value="">Todas categorias</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>

          {/* Status chips */}
          {(["all", "active", "inactive"] as const).map(s => (
            <button key={s} onClick={() => { setFilterStatus(s); setCurrentPage(1); }}
              className={cn(
                "h-7 px-3 rounded-lg border text-[11px] font-bold transition-all",
                filterStatus === s && s === "all"      ? "bg-slate-800 text-white border-slate-800" :
                filterStatus === s && s === "active"   ? "bg-emerald-600 text-white border-emerald-600" :
                filterStatus === s && s === "inactive" ? "bg-slate-400 text-white border-slate-400" :
                "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
              )}>
              {s === "all" ? "Todos" : s === "active" ? "Ativos" : "Inativos"}
            </button>
          ))}

          {/* Low stock chip */}
          <button onClick={() => { setFilterLowStock(v => !v); setCurrentPage(1); }}
            className={cn(
              "h-7 px-3 rounded-lg border text-[11px] font-bold transition-all flex items-center gap-1",
              filterLowStock ? "bg-red-600 text-white border-red-600" : "bg-white text-slate-500 border-slate-200 hover:border-red-300"
            )}>
            <AlertTriangle size={10} /> Estoque crítico
          </button>

          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-auto">
            {filteredProducts.length} produto{filteredProducts.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* ── bulk action bar ── */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="flex items-center justify-between bg-red-50 border border-red-200 rounded-xl px-4 py-2.5"
          >
            <span className="text-xs font-bold text-red-700">
              {selectedIds.size} produto{selectedIds.size !== 1 ? "s" : ""} selecionado{selectedIds.size !== 1 ? "s" : ""}
            </span>
            <div className="flex items-center gap-2">
              <button onClick={() => setSelectedIds(new Set())} className="text-xs text-slate-500 hover:text-slate-700 font-medium">Limpar</button>
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
      ) : viewMode === "table" ? (<>
        {/* ── MOBILE: card list (< sm) ── */}
        <div className="sm:hidden space-y-2">
          <AnimatePresence>
            {pagedProducts.map(p => (
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
                  <th className="pl-4 pr-2 py-3 w-8">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      ref={el => { if (el) el.indeterminate = someSelected; }}
                      onChange={toggleSelectAll}
                      className="w-3.5 h-3.5 accent-blue-500 cursor-pointer"
                    />
                  </th>
                  {/* ID sortable */}
                  <th className="pl-3 pr-2 py-3 w-10">
                    <button onClick={() => toggleSort("id")} className="flex items-center gap-1 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-700 transition-colors">
                      #
                      {sortField === "id" ? (sortDir === "asc" ? <ArrowUp size={10} className="text-blue-500" /> : <ArrowDown size={10} className="text-blue-500" />) : <ArrowUpDown size={10} className="text-slate-300" />}
                    </button>
                  </th>
                  {/* Name sortable */}
                  <th className="px-3 py-3">
                    <button onClick={() => toggleSort("name")} className="flex items-center gap-1 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-700 transition-colors">
                      Produto
                      {sortField === "name" ? (sortDir === "asc" ? <ArrowUp size={10} className="text-blue-500" /> : <ArrowDown size={10} className="text-blue-500" />) : <ArrowUpDown size={10} className="text-slate-300" />}
                    </button>
                  </th>
                  <th className="px-3 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">SKU</th>
                  <th className="px-3 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Categoria</th>
                  <th className="px-3 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Custo</th>
                  {/* Price sortable */}
                  <th className="px-3 py-3">
                    <button onClick={() => toggleSort("price")} className="flex items-center gap-1 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-700 transition-colors">
                      Preço
                      {sortField === "price" ? (sortDir === "asc" ? <ArrowUp size={10} className="text-blue-500" /> : <ArrowDown size={10} className="text-blue-500" />) : <ArrowUpDown size={10} className="text-slate-300" />}
                    </button>
                  </th>
                  {/* Stock sortable */}
                  <th className="px-3 py-3">
                    <button onClick={() => toggleSort("stock")} className="flex items-center gap-1 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-700 transition-colors">
                      Estoque
                      {sortField === "stock" ? (sortDir === "asc" ? <ArrowUp size={10} className="text-blue-500" /> : <ArrowDown size={10} className="text-blue-500" />) : <ArrowUpDown size={10} className="text-slate-300" />}
                    </button>
                  </th>
                  <th className="px-3 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                  <th className="px-3 py-3 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <AnimatePresence>
                  {pagedProducts.map(p => (
                    <motion.tr key={p.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className={`hover:bg-slate-50/60 transition-colors group ${selectedIds.has(p.id) ? "bg-blue-50/40" : ""}`}>
                      <td className="pl-4 pr-2 py-2.5 w-8">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(p.id)}
                          onChange={() => toggleSelect(p.id)}
                          className="w-3.5 h-3.5 accent-blue-500 cursor-pointer"
                        />
                      </td>
                      <td className="pl-3 pr-2 py-2.5">
                        <span className="text-[10px] font-mono text-slate-400">#{p.id}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <div className="relative w-9 h-9 shrink-0">
                            <div className="w-9 h-9 rounded-lg border border-slate-200 bg-slate-50 overflow-hidden">
                              {coverImg(p) ? <img src={coverImg(p)} alt={p.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                                : <div className="w-full h-full flex items-center justify-center"><ImageIcon size={14} className="text-slate-300" /></div>}
                            </div>
                            {imgCount(p) > 1 && (
                              <span className="absolute -bottom-1 -right-1 bg-slate-700 text-white text-[7px] font-black w-3.5 h-3.5 rounded-full flex items-center justify-center shadow">
                                {imgCount(p)}
                              </span>
                            )}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-900 leading-tight max-w-[180px] truncate">{p.name}</p>
                            <div className="flex items-center gap-1 mt-0.5">
                              {p.is_featured && <span className="text-[7px] bg-amber-500 text-white px-1 py-0.5 rounded-full font-black">★</span>}
                              {p.discount_price && <span className="text-[7px] bg-red-500 text-white px-1 py-0.5 rounded-full font-black">%</span>}
                              {Array.isArray(p.attributes) && p.attributes.length > 0 && (
                                <span className="text-[7px] bg-blue-100 text-blue-700 px-1 py-0.5 rounded-full font-black">{p.attributes.length} var.</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="text-[9px] font-mono font-bold text-slate-400 uppercase group-hover:text-blue-500 transition-colors">{displaySku(p)}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        {p.category_name ? <span className="text-[10px] font-medium text-slate-500 flex items-center gap-1"><Tag size={9} />{p.category_name}</span>
                          : <span className="text-[10px] text-slate-300">—</span>}
                      </td>
                      <td className="px-3 py-2.5 text-[11px] font-mono text-slate-400">R$ {Number(p.cost_price || 0).toFixed(2)}</td>
                      <td className="px-3 py-2.5 text-[11px] font-mono font-bold">
                        {p.discount_price ? (
                          <div className="flex flex-col"><span className="line-through text-[9px] text-slate-300">R$ {Number(p.price).toFixed(2)}</span><span className="text-emerald-600">R$ {Number(p.discount_price).toFixed(2)}</span></div>
                        ) : <span className="text-slate-900">R$ {Number(p.price).toFixed(2)}</span>}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", p.stock_quantity <= 5 ? "bg-red-500 animate-pulse" : p.stock_quantity <= 15 ? "bg-amber-400" : "bg-emerald-500")} />
                          <span className={cn("text-xs font-mono font-bold", p.stock_quantity <= 5 ? "text-red-600" : "text-slate-900")}>
                            {p.stock_quantity} <span className="text-[9px] text-slate-400 font-normal">un</span>
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={cn("text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full", p.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400")}>
                          {p.is_active ? "Ativo" : "Inativo"}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <DropdownMenu items={[
                          { label: "Editar produto", icon: <Edit2 size={13} />, onClick: () => openEdit(p) },
                          { label: "Histórico", icon: <History size={13} />, onClick: () => openHistory(p) },
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

        {/* ── Pagination footer ── */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] text-slate-400 font-medium">
              {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, filteredProducts.length)} de {filteredProducts.length} produto{filteredProducts.length !== 1 ? "s" : ""}
            </span>
            <div className="flex items-center gap-1">
              <button onClick={() => setCurrentPage(1)} disabled={safePage === 1}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:border-blue-400 hover:text-blue-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all text-xs font-bold">
                «
              </button>
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={safePage === 1}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:border-blue-400 hover:text-blue-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                <ChevronLeft size={14} />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let page: number;
                if (totalPages <= 5) page = i + 1;
                else if (safePage <= 3) page = i + 1;
                else if (safePage >= totalPages - 2) page = totalPages - 4 + i;
                else page = safePage - 2 + i;
                return (
                  <button key={page} onClick={() => setCurrentPage(page)}
                    className={cn(
                      "w-8 h-8 flex items-center justify-center rounded-lg border text-xs font-bold transition-all",
                      page === safePage ? "bg-blue-600 text-white border-blue-600" : "border-slate-200 text-slate-500 hover:border-blue-400 hover:text-blue-600"
                    )}>
                    {page}
                  </button>
                );
              })}
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:border-blue-400 hover:text-blue-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                <ChevronRight size={14} />
              </button>
              <button onClick={() => setCurrentPage(totalPages)} disabled={safePage === totalPages}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:border-blue-400 hover:text-blue-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all text-xs font-bold">
                »
              </button>
            </div>
          </div>
        )}

      </>) : (
        /* GRID */
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
          <AnimatePresence>
            {pagedProducts.map(p => (
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
            <Switch label="Ativo no site" checked={editingProduct?.is_active ?? true}
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
                <div className="flex items-center gap-2">
                {/* Clear button — only when attributes exist */}
                {(editingProduct?.attributes || []).length > 0 && (
                  <button type="button" onClick={clearAttributes}
                    className="flex items-center gap-1.5 px-3 h-8 rounded-lg bg-rose-50 border border-rose-200 text-rose-600 text-[10px] font-black uppercase tracking-wider hover:bg-rose-100 transition-all">
                    <X size={11} /> Limpar
                  </button>
                )}
                <button type="button" onClick={() => setShowPresets(v => !v)}
                  className="flex items-center gap-1.5 px-3 h-8 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 text-[10px] font-black uppercase tracking-wider hover:bg-blue-100 transition-all">
                  <Zap size={11} /> Modelos rápidos
                </button>
              </div>
            </div>

            {/* Preset panel */}
            <AnimatePresence>
              {showPresets && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2.5">Selecione o segmento para carregar variações pré-definidas:</p>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {VARIATION_PRESETS.map(preset => {
                        const currentAttrs = editingProduct?.attributes || [];
                        // Preset is "active" when all its attribute names match the current attributes exactly
                        const isActive = currentAttrs.length === preset.variations.length &&
                          preset.variations.every(pv => currentAttrs.some(a => a.name.toLowerCase() === pv.name.toLowerCase()));
                        return (
                          <button key={preset.label} type="button"
                            onClick={() => { if (!isActive) applyPreset(preset); }}
                            disabled={isActive}
                            className={cn(
                              "flex flex-col items-center gap-1 p-2.5 rounded-xl border transition-all group",
                              isActive
                                ? "border-blue-400 bg-blue-50 cursor-default"
                                : "border-slate-200 bg-white hover:border-blue-400 hover:bg-blue-50"
                            )}>
                            <span className="text-xl">{preset.icon}</span>
                            <span className={cn("text-[9px] font-black uppercase tracking-wider", isActive ? "text-blue-700" : "text-slate-600 group-hover:text-blue-700")}>{preset.label}</span>
                            {isActive && <span className="text-[7px] font-black text-blue-500 uppercase tracking-widest">Em uso</span>}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-[8px] text-slate-400 mt-2">Clique em um modelo para substituir as variações atuais. Use "Limpar" para remover tudo.</p>
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
                  {/* detect if this is a color attribute */}
                  {(() => {
                    const isColorAttr = /^cor$/i.test(attr.name.trim()) || /^colou?r$/i.test(attr.name.trim());
                    return (
                      <div className="flex flex-wrap gap-1.5">
                        {attr.values.map((val, valIdx) => (
                          <span key={valIdx} className={`inline-flex items-center gap-1.5 border text-[10px] font-bold px-2 py-1 rounded-lg ${isColorAttr ? "bg-white border-slate-200" : "bg-blue-50 border-blue-200 text-blue-700"}`}>
                            {isColorAttr && (
                              <label className="relative w-5 h-5 rounded-full overflow-hidden cursor-pointer border border-slate-300 shrink-0" title="Clique para definir a cor">
                                <span className="absolute inset-0 rounded-full" style={{ backgroundColor: attr.colors?.[val] || "#cccccc" }} />
                                <input
                                  type="color"
                                  value={attr.colors?.[val] || "#cccccc"}
                                  onChange={e => updateAttrColor(attrIdx, val, e.target.value)}
                                  className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                                />
                              </label>
                            )}
                            <span className={isColorAttr ? "text-slate-700" : ""}>{val}</span>
                            <button type="button" onClick={() => removeAttrValue(attrIdx, valIdx)} className="text-slate-300 hover:text-red-500 transition-colors ml-0.5">
                              <X size={9} strokeWidth={3} />
                            </button>
                          </span>
                        ))}
                        {/* inline add value to existing attr */}
                        <input type="text" placeholder="+ valor"
                          className="w-20 bg-slate-50 border border-dashed border-slate-300 rounded-lg px-2 text-[10px] font-bold outline-none h-7 focus:border-blue-400 focus:bg-white transition-all"
                          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); const inp = e.currentTarget; addAttrValue(attr.name, inp.value); inp.value = ""; } }} />
                      </div>
                    );
                  })()}
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

      <ConfirmDialog open={showBulkConfirm} onClose={() => setShowBulkConfirm(false)} onConfirm={confirmBulkDelete}
        title={`Excluir ${selectedIds.size} produto${selectedIds.size !== 1 ? "s" : ""}?`}
        description="Todos os dados e fotos dos produtos selecionados serão removidos permanentemente."
        variant="danger" confirmLabel={`Excluir ${selectedIds.size} produto${selectedIds.size !== 1 ? "s" : ""}`} loading={bulkDeleting} />

      {/* ── HISTORY PANEL ── */}
      <AnimatePresence>
        {historyProduct && (
          <>
            <motion.div
              key="history-backdrop"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
              onClick={() => setHistoryProduct(null)}
            />
            <motion.div
              key="history-panel"
              initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col overflow-hidden"
            >
              {/* Header */}
              <div className="px-6 py-5 border-b border-slate-100 bg-slate-50 flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <History size={14} className="text-blue-600 shrink-0" />
                    <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest">Histórico de Alterações</span>
                  </div>
                  <p className="text-[13px] font-black text-slate-900 uppercase leading-tight truncate">{historyProduct.name}</p>
                  {historyProduct.sku && (
                    <p className="text-[9px] text-slate-400 font-mono mt-0.5">{historyProduct.sku}</p>
                  )}
                </div>
                <button
                  onClick={() => setHistoryProduct(null)}
                  className="ml-4 w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:border-slate-400 transition-all shrink-0"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto">
                {historyLoading ? (
                  <div className="flex items-center justify-center py-20">
                    <Loader2 size={22} className="animate-spin text-slate-300" />
                  </div>
                ) : historyEntries.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
                      <History size={22} className="text-slate-300" />
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sem histórico ainda</p>
                    <p className="text-[9px] text-slate-300 mt-1">As alterações aparecerão aqui após a próxima edição do produto.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-50">
                    {historyEntries.map((entry) => {
                      const dt = new Date(entry.created_at);
                      const dateStr = dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
                      const timeStr = dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
                      return (
                        <div key={entry.id} className="px-5 py-4">
                          {/* timestamp */}
                          <div className="flex items-center gap-1.5 mb-2">
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 px-2 py-0.5 rounded-md">
                              {dateStr}
                            </span>
                            <span className="text-[8px] font-bold text-slate-400">{timeStr}</span>
                          </div>
                          {/* field label */}
                          <p className="text-[10px] font-black text-slate-700 uppercase tracking-wider mb-2">{entry.field}</p>
                          {/* old → new */}
                          <div className="flex items-center gap-2">
                            <span className="flex-1 min-w-0 bg-rose-50 border border-rose-100 rounded-lg px-3 py-1.5 text-[11px] font-mono font-bold text-rose-600 truncate">
                              {entry.old_value ?? "—"}
                            </span>
                            <ArrowRight size={12} className="text-slate-300 shrink-0" />
                            <span className="flex-1 min-w-0 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-1.5 text-[11px] font-mono font-bold text-emerald-700 truncate">
                              {entry.new_value ?? "—"}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-slate-100">
                <p className="text-[8px] text-slate-400 text-center">
                  {historyEntries.length > 0 ? `${historyEntries.length} registro${historyEntries.length !== 1 ? "s" : ""} encontrado${historyEntries.length !== 1 ? "s" : ""}` : ""}
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <PdfImportModal
        open={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
        onImported={() => { fetchInventory(); }}
      />
    </div>
  );
}
