import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  Plus, Image as ImageIcon, Save, X, Upload, Zap, Camera, ChevronLeft, ChevronRight, GripVertical,
  Tag, Boxes, FileText, Fingerprint, FolderTree, DollarSign, Receipt, Palette, ArrowLeft,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../../lib/utils";
import { Product, Category } from "../../types";
import {
  Button, IconButton, Input, Select, Textarea, Switch, Tabs, SectionTitle, ContentCard, PanelCard, Badge, FilterLineSegmented, useToast,
} from "../../components/ui";
import FiscalCodeLookup from "../../components/fiscal/FiscalCodeLookup";
import VariationPresetsPanel from "./VariationPresetsPanel";
import type { VariationPreset } from "../../lib/variationPresets";
import { PIECE_KINDS, resolveGlassOptions, type GlassOptions } from "../../lib/glassPieces";
import { glassMeasurements } from "../../../shared/glassCatalog";
import { defaultMeasureUnit, measureUnitAbbr, measureUnitLabel, measureUnitOptions } from "../../utils/measurePricing";

// ── helpers ────────────────────────────────────────────────────────────────
export const PRODUCT_MODAL_TABS = [
  { id: "identificacao", label: "Identificação", icon: Tag },
  { id: "estoque", label: "Estoque e Grades", icon: Boxes },
  { id: "vitrine", label: "Catálogo virtual", icon: ImageIcon },
  { id: "fiscal", label: "Fiscal", icon: FileText },
] as const;
export type ProductModalTab = (typeof PRODUCT_MODAL_TABS)[number]["id"];

export function toSlug(name: string) {
  return name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function generateCombos(attrs: { name: string; values: string[] }[]): Record<string, string>[] {
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

// Campos required ficam espalhados entre abas que desmontam quando inativas, então a
// validação HTML5 nativa não os enxerga. Valida manualmente e informa a aba com erro.
export function validateProduct(p: Partial<Product> | null): { tab: ProductModalTab; message: string } | null {
  if (!p?.name?.trim()) return { tab: "identificacao", message: "Preencha o nome do produto." };
  const saleUnit = p?.sale_unit ?? "unidade";
  if (saleUnit === "unidade") {
    if (!p?.price || Number(p.price) <= 0) return { tab: "estoque", message: "Preencha o preço de venda." };
    if ((p?.skus || []).length === 0 && (p?.stock_quantity == null)) return { tab: "estoque", message: "Preencha o estoque atual." };
  } else {
    if (!p?.price_per_measure || Number(p.price_per_measure) <= 0) {
      return { tab: "estoque", message: `Preencha o preço por ${saleUnit === "m2" ? "m²" : "metro linear"}.` };
    }
    if (p?.measure_stock_quantity == null) return { tab: "estoque", message: "Preencha o estoque disponível." };
  }
  return null;
}

// Uppercase automático no onChange troca o value do input controlado pelo valor já
// transformado e o cursor pula pro fim — restaura a posição depois do re-render.
function handleUppercaseChange(
  e: React.ChangeEvent<HTMLInputElement>,
  apply: (upper: string) => void,
) {
  const input = e.target;
  const pos = input.selectionStart;
  apply(input.value.toUpperCase());
  requestAnimationFrame(() => {
    if (pos !== null) input.setSelectionRange(pos, pos);
  });
}

// ── Multi-image gallery uploader ───────────────────────────────────────────
interface GalleryUploaderProps {
  images: string[];
  onChange: (imgs: string[]) => void;
  label?: string;
}

function GalleryUploader({ images, onChange, label = "Fotos do Produto" }: GalleryUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
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
        <span className="ds-label">
          {label} <span className="font-normal text-slate-400">({images.length}/10)</span>
        </span>
        {images.length > 0 && (
          <div className="flex items-center gap-1">
            <Button type="button" variant="ghost" size="xs" iconLeft={<Camera size={12} />} onClick={() => cameraInputRef.current?.click()}>Tirar foto</Button>
            <Button type="button" variant="ghost" size="xs" iconLeft={<Plus size={12} />} onClick={() => inputRef.current?.click()}>Adicionar foto</Button>
          </div>
        )}
      </div>

      {/* ── Main preview (fixed height) ── */}
      <div className="relative h-48 rounded-lg overflow-hidden border border-slate-200 bg-slate-50 group">
        {current ? (
          <>
            <img src={current} alt="produto" className="w-full h-full object-contain" />
            {images.length > 1 && (
              <>
                <IconButton type="button" aria-label="Foto anterior" variant="secondary" size="sm" onClick={() => setSelected(i => (i - 1 + images.length) % images.length)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90">
                  <ChevronLeft size={13} />
                </IconButton>
                <IconButton type="button" aria-label="Próxima foto" variant="secondary" size="sm" onClick={() => setSelected(i => (i + 1) % images.length)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90">
                  <ChevronRight size={13} />
                </IconButton>
              </>
            )}
            {/* Sem group-hover: em touch (celular/tablet) não existe hover, então o X
                ficaria invisível/impossível de tocar — sempre visível em qualquer tela. */}
            <IconButton type="button" aria-label="Remover foto" variant="danger" size="xs" onClick={() => removeImage(selected)}
              className="absolute top-2 right-2 rounded-full">
              <X size={10} strokeWidth={3} />
            </IconButton>
            <div className="absolute bottom-2 right-2 bg-black/50 text-white text-[11px] font-medium px-1.5 py-0.5 rounded-full">
              {selected + 1}/{images.length}
            </div>
          </>
        ) : (
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className={cn(
              "w-full h-full flex flex-col items-center justify-center gap-2 transition-all",
              dragging ? "bg-blue-50" : ""
            )}
          >
            {uploading ? (
              <><div className="w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /><span className="text-[11px] font-medium text-blue-600">Enviando...</span></>
            ) : (
              <>
                <div className={cn("w-11 h-11 rounded-lg flex items-center justify-center", dragging ? "bg-blue-100" : "bg-slate-100")}>
                  <Upload size={20} className={dragging ? "text-blue-500" : "text-slate-300"} />
                </div>
                <div className="text-center">
                  <p className="text-xs font-medium text-slate-500">Arraste ou escolha uma opção pra adicionar fotos</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">JPG, PNG, WEBP · max 5 MB · até 10 fotos</p>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <Button type="button" variant="outline" size="sm" iconLeft={<ImageIcon size={12} />} onClick={() => inputRef.current?.click()}>Galeria</Button>
                  <Button type="button" variant="outline" size="sm" iconLeft={<Camera size={12} />} onClick={() => cameraInputRef.current?.click()}>Tirar foto</Button>
                </div>
              </>
            )}
          </div>
        )}
        {uploading && images.length > 0 && (
          <div className="absolute bottom-2 left-2 flex items-center gap-1.5 bg-white/90 rounded-full px-2 py-1 shadow-sm text-[11px] font-medium text-blue-600">
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
                selected === i ? "border-blue-500 shadow-sm" : "border-slate-200 hover:border-blue-300",
                dragOver === i && "border-blue-400 scale-105"
              )}
            >
              <img src={url} alt="" className="w-full h-full object-cover" />
              {i === 0 && (
                <span className="absolute bottom-0 left-0 right-0 bg-blue-600/80 text-white text-[10px] font-medium text-center py-0.5 leading-tight">Capa</span>
              )}
              <button
                type="button"
                aria-label="Remover foto"
                onClick={e => { e.stopPropagation(); removeImage(i); }}
                className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center shadow-sm"
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
              aria-label="Adicionar foto"
              onClick={() => inputRef.current?.click()}
              className="w-14 h-14 rounded-lg border-2 border-dashed border-slate-200 flex items-center justify-center hover:border-blue-400 hover:bg-blue-50 transition-all shrink-0"
            >
              <Plus size={14} className="text-slate-300" />
            </button>
          )}
        </div>
      )}

      <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={e => { if (e.target.files) doUpload(e.target.files); e.target.value = ""; }} />
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => { if (e.target.files) doUpload(e.target.files); e.target.value = ""; }} />
      <p className="text-[11px] text-slate-400 px-1">A primeira foto é a capa. Arraste as miniaturas para reordenar.</p>
    </div>
  );
}

// ── Formulário de produto (página própria) ─────────────────────────────────
// Recebe o produto em edição e os setters do dono (Inventory). Estado puramente
// de UI do formulário (aba ativa, margem de lucro, criação de categoria, variações)
// vive aqui; carga, persistência e navegação ficam em Inventory.
export interface ProductFormProps {
  product: Partial<Product>;
  onProductChange: React.Dispatch<React.SetStateAction<Partial<Product> | null>>;
  images: string[];
  onImagesChange: (imgs: string[]) => void;
  categories: Category[];
  onCategoryCreated: (category: Category) => void;
  taxRegime: string;
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
}

/** Texto que vira campo ao clicar: Enter ou sair do campo confirma, Esc cancela. */
function InlineEdit({ value, onCommit, onCancel, className }: { value: string; onCommit: (v: string) => void; onCancel: () => void; className?: string }) {
  return (
    <input
      autoFocus
      defaultValue={value}
      onFocus={e => e.currentTarget.select()}
      onKeyDown={e => {
        if (e.key === "Enter") { e.preventDefault(); onCommit(e.currentTarget.value); }
        if (e.key === "Escape") { e.preventDefault(); onCancel(); }
      }}
      onBlur={e => onCommit(e.currentTarget.value)}
      style={{ width: `${Math.max(value.length, 4) + 2}ch` }}
      className={cn("rounded border border-blue-400 bg-white px-1.5 py-0.5 text-[11px] font-medium text-slate-800 outline-none", className)}
    />
  );
}

export default function ProductForm({
  product: editingProduct, onProductChange: setEditingProduct, images: editingImages, onImagesChange: setEditingImages,
  categories, onCategoryCreated, taxRegime, saving, onSave, onCancel,
}: ProductFormProps) {
  const toast = useToast();
  const [productModalTab, setProductModalTab] = useState<ProductModalTab>("identificacao");
  // listas de vidro/espessura/perfil que a loja cadastrou em Configurações > Vidraçaria (usadas nos padrões da peça)
  const [glassOptions, setGlassOptions] = useState<GlassOptions | undefined>();
  useEffect(() => {
    fetch("/api/tenant", { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } })
      .then((r) => r.json()).then((t) => setGlassOptions(t?.policies?.glass_options)).catch(() => {});
  }, []);
  // Campo auxiliar de UI (não é salvo no produto) — % de lucro desejada sobre o custo.
  // String pra permitir digitar livremente sem o input travar em 0.
  const [profitMarginInput, setProfitMarginInput] = useState("");
  const [expandedSkuImagesIndex, setExpandedSkuImagesIndex] = useState<number | null>(null);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [savingCategory, setSavingCategory] = useState(false);
  const [newAttrName, setNewAttrName] = useState("");
  const [newAttrValue, setNewAttrValue] = useState("");
  const [showPresets, setShowPresets] = useState(false);
  // qual nome está em edição: um valor (val = índice) ou o nome da própria variação (val = null)
  const [editCell, setEditCell] = useState<{ attr: number; val: number | null } | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const invalid = validateProduct(editingProduct);
    if (invalid) {
      setProductModalTab(invalid.tab);
      toast.error(invalid.message);
      return;
    }
    onSave();
  };

  // Cria categoria sem sair do formulário — a categoria nova já vem selecionada.
  const handleCreateCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) return;
    setSavingCategory(true);
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}` },
        body: JSON.stringify({ name }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.id) {
        onCategoryCreated({ id: data.id, tenant_id: 0, name });
        setEditingProduct((prev) => prev ? { ...prev, category_id: data.id } : prev);
        setNewCategoryName("");
        setCreatingCategory(false);
      } else {
        toast.error(data.error || "Erro ao criar categoria.");
      }
    } catch {
      toast.error("Erro de conexão. Verifique sua internet.");
    }
    setSavingCategory(false);
  };

  // Add a value to an attribute (creates attr if new), then regenerate combos preserving existing stocks
  const addAttrValue = (attrName: string, value: string) => {
    const trimmedAttr = attrName.trim();
    // vários valores de uma vez: "Azul, Marrom, Preto" (vírgula, ponto e vírgula ou quebra de linha)
    const incoming = value.split(/[,;\n]+/).map(v => v.trim()).filter(Boolean);
    if (!trimmedAttr || incoming.length === 0) return;

    const attrs = [...(editingProduct?.attributes || [])];
    const idx = attrs.findIndex(a => a.name.toLowerCase() === trimmedAttr.toLowerCase());
    const current = idx >= 0 ? attrs[idx].values : [];
    const fresh: string[] = [];
    for (const v of incoming) {
      if ([...current, ...fresh].some(x => x.toLowerCase() === v.toLowerCase())) continue;
      fresh.push(v);
    }
    if (fresh.length === 0) return;
    if (idx >= 0) attrs[idx] = { ...attrs[idx], values: [...current, ...fresh] };
    else attrs.push({ name: trimmedAttr, values: fresh });

    const oldSkus = editingProduct?.skus || [];
    const oldMap = Object.fromEntries(oldSkus.map(s => [comboKey(s.combo), s]));
    const newCombos = generateCombos(attrs);
    const newSkus = newCombos.map(combo => ({ combo, stock: oldMap[comboKey(combo)]?.stock ?? 0, images: oldMap[comboKey(combo)]?.images }));

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
    const oldMap = Object.fromEntries(oldSkus.map(s => [comboKey(s.combo), s]));
    const newCombos = generateCombos(attrs);
    const newSkus = newCombos.map(combo => ({ combo, stock: oldMap[comboKey(combo)]?.stock ?? 0, images: oldMap[comboKey(combo)]?.images }));
    setEditingProduct(prev => ({ ...prev!, attributes: attrs, skus: newSkus }));
  };

  // Renomeia um valor (ex.: "Azul" → "Azul Royal") mantendo estoque, fotos e cor das combinações.
  const renameAttrValue = (attrIdx: number, valIdx: number, next: string) => {
    setEditCell(null);
    const attrs = [...(editingProduct?.attributes || [])];
    const attr = attrs[attrIdx];
    const old = attr.values[valIdx];
    const name = next.trim();
    if (!name || name === old) return;
    if (attr.values.some((v, i) => i !== valIdx && v.toLowerCase() === name.toLowerCase())) { toast.error(`"${name}" já existe em ${attr.name}.`); return; }
    const values = attr.values.map((v, i) => (i === valIdx ? name : v));
    const colors = attr.colors && old in attr.colors ? Object.fromEntries(Object.entries(attr.colors).map(([k, v]) => [k === old ? name : k, v])) : attr.colors;
    attrs[attrIdx] = { ...attr, values, ...(colors ? { colors } : {}) };
    const skus = (editingProduct?.skus || []).map(sku => ({ ...sku, combo: { ...sku.combo, ...(sku.combo[attr.name] === old ? { [attr.name]: name } : {}) } }));
    setEditingProduct(prev => ({ ...prev!, attributes: attrs, skus }));
  };

  // Renomeia a variação (ex.: "Tamanho" → "Numeração") em todas as combinações.
  const renameAttr = (attrIdx: number, next: string) => {
    setEditCell(null);
    const attrs = [...(editingProduct?.attributes || [])];
    const old = attrs[attrIdx].name;
    const name = next.trim();
    if (!name || name === old) return;
    if (attrs.some((a, i) => i !== attrIdx && a.name.toLowerCase() === name.toLowerCase())) { toast.error(`Já existe uma variação chamada "${name}".`); return; }
    attrs[attrIdx] = { ...attrs[attrIdx], name };
    const skus = (editingProduct?.skus || []).map(sku => ({
      ...sku,
      combo: Object.fromEntries(Object.entries(sku.combo).map(([k, v]) => [k === old ? name : k, v])),
    }));
    setEditingProduct(prev => ({ ...prev!, attributes: attrs, skus }));
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

  const updateSkuImages = (skuIdx: number, images: string[]) => {
    const skus = [...(editingProduct?.skus || [])];
    skus[skuIdx] = { ...skus[skuIdx], images };
    setEditingProduct(prev => ({ ...prev!, skus }));
  };

  const applyPreset = (preset: VariationPreset) => {
    // Replace all current attributes with the preset (full replace, not merge)
    const attrs = preset.variations.map(v => ({ name: v.name, values: v.options, ...(v.colors ? { colors: v.colors } : {}) }));
    const newCombos = generateCombos(attrs);
    const newSkus = newCombos.map(combo => ({ combo, stock: 0 }));
    setEditingProduct(prev => ({ ...prev!, attributes: attrs, skus: newSkus }));
    setShowPresets(false);
  };

  const clearAttributes = () => {
    setEditingProduct(prev => ({ ...prev!, attributes: [], skus: [] }));
  };

  const measureUnitFactor = (unit: string) => ({
    m: 1, cm: 0.01, mm: 0.001, km: 1000,
    m2: 1, cm2: 0.0001, mm2: 0.000001, km2: 1000000,
    kg: 1, g: 0.001, mg: 0.000001, t: 1000,
    l: 1, ml: 0.001,
  }[unit] ?? 1);
  const changeMeasureUnit = (nextUnit: string) => setEditingProduct((previous) => {
    if (!previous) return previous;
    const previousUnit = previous.measure_unit ?? (previous.sale_unit === "m2" ? "m2" : "m");
    if (previousUnit === nextUnit) return previous;
    const ratio = measureUnitFactor(previousUnit) / measureUnitFactor(nextUnit);
    const priceRatio = 1 / ratio;
    const round = (value: number) => Math.round(value * 1000000) / 1000000;
    return {
      ...previous,
      measure_unit: nextUnit,
      measure_stock_quantity: round(Number(previous.measure_stock_quantity ?? 0) * ratio),
      measure_min_stock: round(Number(previous.measure_min_stock ?? 0) * ratio),
      min_billable_quantity: previous.min_billable_quantity == null ? previous.min_billable_quantity : round(Number(previous.min_billable_quantity) * ratio),
      price_per_measure: previous.price_per_measure == null ? previous.price_per_measure : round(Number(previous.price_per_measure) * priceRatio),
    };
  });

  const generateBarcode = () => {
    const code = String(Date.now()).slice(-12).padStart(12, "0");
    const digits = code.split("").map(Number);
    const check = (10 - (digits.reduce((s, d, i) => s + d * (i % 2 === 0 ? 1 : 3), 0) % 10)) % 10;
    setEditingProduct(prev => ({ ...prev!, barcode: code + check }));
  };

  const measureSaleUnit = editingProduct?.sale_unit ?? "linear";
  const measureSuffix = measureUnitAbbr(editingProduct?.measure_unit, measureSaleUnit);

  return (
    <div className="space-y-4">
      <Button type="button" variant="ghost" size="sm" iconLeft={<ArrowLeft size={14} />} onClick={onCancel}>Voltar</Button>
      <SectionTitle title={editingProduct?.id ? "Editar produto" : "Novo produto"} description="Catálogo de venda" />
      <ContentCard padding="lg">
        <form id="product-form" onSubmit={handleSubmit} className="space-y-4">
          <Tabs<typeof PRODUCT_MODAL_TABS[number]["id"]> items={PRODUCT_MODAL_TABS} value={productModalTab} onChange={setProductModalTab} label="Dados do produto">
            {productModalTab === "identificacao" && (
              <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-4 items-start">
                <PanelCard data-tour="product-gallery" title="Galeria" icon={Camera}>
                  <GalleryUploader images={editingImages} onChange={setEditingImages} />
                </PanelCard>

                <div className="space-y-4">
                  <PanelCard title="Identificação" icon={Fingerprint} contentClassName="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div data-tour="product-name-field">
                        <Input label="Nome do Produto *" type="text" required placeholder="Ex: Camiseta Básica Preta"
                          value={editingProduct?.name || ""}
                          onChange={e => handleUppercaseChange(e, (upper) => setEditingProduct(prev => ({ ...prev!, name: upper })))} />
                      </div>
                      <Input label="SKU / Identificador" type="text" className="font-mono"
                        placeholder={editingProduct?.name ? toSlug(editingProduct.name) : "auto-gerado do nome"}
                        hint="Vazio = gerado do nome automaticamente"
                        value={editingProduct?.sku || ""}
                        onChange={e => setEditingProduct(prev => ({ ...prev!, sku: e.target.value }))} />
                    </div>

                    {/* Barcode */}
                    <div className="space-y-1">
                      <div className="flex items-end gap-2">
                        <Input wrapperClassName="flex-1" label="Código de Barras (EAN / ISBN / Interno)" type="text" className="font-mono"
                          placeholder="Ex: 7891234567890 — deixe vazio para gerar automaticamente"
                          value={editingProduct?.barcode || ""}
                          onChange={e => setEditingProduct(prev => ({ ...prev!, barcode: e.target.value }))} />
                        <Button type="button" variant="outline" onClick={generateBarcode}>Gerar</Button>
                      </div>
                      <p className="text-[11px] text-slate-400">Usado no leitor do PDV. Aceita EAN-13, EAN-8, Code128 ou código interno.</p>
                    </div>
                  </PanelCard>

                  <PanelCard title="Organização" icon={FolderTree} contentClassName="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="ds-label">Categoria</label>
                        {creatingCategory ? (
                          <div className="flex gap-1.5">
                            <Input
                              wrapperClassName="flex-1"
                              autoFocus type="text" placeholder="Nome da categoria"
                              value={newCategoryName}
                              onChange={(e) => setNewCategoryName(e.target.value)}
                              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleCreateCategory(); } if (e.key === "Escape") { setCreatingCategory(false); setNewCategoryName(""); } }}
                            />
                            <IconButton type="button" variant="primary" aria-label="Salvar categoria" onClick={handleCreateCategory}
                              disabled={savingCategory || !newCategoryName.trim()} loading={savingCategory}>
                              <Save size={14} />
                            </IconButton>
                            <IconButton type="button" variant="outline" aria-label="Cancelar" onClick={() => { setCreatingCategory(false); setNewCategoryName(""); }}>
                              <X size={14} />
                            </IconButton>
                          </div>
                        ) : (
                          <div className="flex gap-1.5">
                            <Select wrapperClassName="flex-1"
                              value={editingProduct?.category_id || ""}
                              onChange={e => setEditingProduct(prev => ({ ...prev!, category_id: Number(e.target.value) }))}>
                              <option value="">Sem categoria</option>
                              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </Select>
                            <IconButton type="button" variant="outline" title="Criar nova categoria" aria-label="Criar nova categoria" onClick={() => setCreatingCategory(true)}>
                              <Plus size={14} />
                            </IconButton>
                          </div>
                        )}
                      </div>
                      <Input label="Data de Validade" type="date"
                        value={editingProduct?.expiry_date || ""}
                        onChange={e => setEditingProduct(prev => ({ ...prev!, expiry_date: e.target.value }))} />
                    </div>
                    <Textarea label="Descrição pública do produto" rows={3} maxLength={2000}
                      hint="Aparece na página deste produto na sua loja online."
                      placeholder="Ex.: Camiseta em algodão premium, modelagem confortável e acabamento reforçado."
                      value={editingProduct?.description || ""}
                      onChange={e => setEditingProduct(prev => ({ ...prev!, description: e.target.value }))} />
                    <div className="flex flex-wrap gap-6 border-t border-slate-100 pt-3">
                      <Switch label="Ativo no site" checked={editingProduct?.is_active ?? true}
                        onChange={v => setEditingProduct(prev => ({ ...prev!, is_active: v }))} accent="emerald" />
                      <Switch label="Destaque na home" checked={editingProduct?.is_featured ?? false}
                        onChange={v => setEditingProduct(prev => ({ ...prev!, is_featured: v }))} accent="amber" />
                    </div>
                    <div className="grid gap-3 border-t border-slate-100 pt-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Switch label="Controlar estoque" checked={editingProduct?.track_stock ?? true}
                          onChange={v => setEditingProduct(prev => ({ ...prev!, track_stock: v }))} accent="blue" />
                        <p className="text-[11px] leading-snug text-slate-500">
                          Desligue para produto sob encomenda ou feito na hora: ele vende mesmo sem saldo, não baixa estoque e não aparece como esgotado.
                        </p>
                      </div>
                      <div className="space-y-1">
                        <Switch label="Ocultar preço no site" checked={editingProduct?.hide_price_on_site ?? false}
                          onChange={v => setEditingProduct(prev => ({ ...prev!, hide_price_on_site: v }))} accent="amber" />
                        <p className="text-[11px] leading-snug text-slate-500">
                          O preço continua no catálogo, no PDV e nos relatórios, mas a loja virtual mostra "Sob consulta" e o cliente pede orçamento.
                        </p>
                      </div>
                    </div>
                  </PanelCard>

                  <PanelCard title="Preços" icon={DollarSign} contentClassName="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <Input label="Custo Un. (R$)" type="number" step="0.01" min="0" className="font-mono"
                        value={editingProduct?.cost_price || ""}
                        onChange={e => setEditingProduct(prev => ({ ...prev!, cost_price: Number(e.target.value) }))} />
                      <Input label="Lucro Estimado (%)" type="number" step="1" min="0" placeholder="Ex: 60" className="font-mono"
                        value={profitMarginInput}
                        onChange={e => {
                          const v = e.target.value;
                          setProfitMarginInput(v);
                          const margin = Number(v);
                          const cost = Number(editingProduct?.cost_price || 0);
                          // Markup sobre o custo: preço = custo × (1 + margem/100) — só recalcula com
                          // custo e margem válidos, senão deixa o Preço Venda como o operador digitou.
                          if (v !== "" && !Number.isNaN(margin) && cost > 0) {
                            const price = Math.round(cost * (1 + margin / 100) * 100) / 100;
                            setEditingProduct(prev => ({ ...prev!, price }));
                          }
                        }} />
                      <div data-tour="product-price-field">
                        <Input label="Preço Venda (R$) *" type="number" step="0.01" min="0" required className="font-mono"
                          value={editingProduct?.price || ""}
                          onChange={e => { setProfitMarginInput(""); setEditingProduct(prev => ({ ...prev!, price: Number(e.target.value) })); }} />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Input label="Promoção (R$)" type="number" step="0.01" min="0" className="font-mono"
                        value={editingProduct?.discount_price || ""}
                        onChange={e => { const v = e.target.value; setEditingProduct(prev => ({ ...prev!, discount_price: v === "" ? undefined : Number(v) })); }} />
                      <Input label="Desconto Máximo no PDV (%)" type="number" step="1" min="0" max="100" placeholder="Sem limite" className="font-mono"
                        hint="Vazio = sem limite. Trava o desconto do carrinho no PDV quando este item estiver nele."
                        value={editingProduct?.max_discount_pct ?? ""}
                        onChange={e => { const v = e.target.value; setEditingProduct(prev => ({ ...prev!, max_discount_pct: v === "" ? undefined : Number(v) })); }} />
                    </div>
                  </PanelCard>
                </div>
              </div>
            )}

            {productModalTab === "fiscal" && (
              <PanelCard title="Dados Fiscais" icon={Receipt} contentClassName="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Input label="NCM" type="text" maxLength={8} placeholder="00000000" className="font-mono" showCount={false}
                      value={editingProduct?.ncm || ""}
                      onChange={e => setEditingProduct(prev => ({ ...prev!, ncm: e.target.value.replace(/\D/g, "") }))} />
                    <FiscalCodeLookup kind="ncm" token={localStorage.getItem("token")} onSelect={(item) => setEditingProduct(prev => ({ ...prev!, ncm: item.code }))} />
                  </div>
                  <Input label="CEST" type="text" maxLength={7} placeholder="Se aplicável" className="font-mono" showCount={false}
                    value={editingProduct?.cest || ""}
                    onChange={e => setEditingProduct(prev => ({ ...prev!, cest: e.target.value.replace(/\D/g, "") }))} />
                  <Input label="CFOP" type="text" maxLength={4} placeholder="5102" className="font-mono" showCount={false}
                    value={editingProduct?.cfop ?? "5102"}
                    onChange={e => setEditingProduct(prev => ({ ...prev!, cfop: e.target.value.replace(/\D/g, "") }))} />
                  <Select label="Origem da Mercadoria"
                    value={editingProduct?.origem ?? 0}
                    onChange={e => setEditingProduct(prev => ({ ...prev!, origem: Number(e.target.value) }))}>
                    <option value={0}>0 — Nacional</option>
                    <option value={1}>1 — Estrangeira (importação direta)</option>
                    <option value={2}>2 — Estrangeira (adquirida no mercado interno)</option>
                    <option value={3}>3 — Nacional (conteúdo import. 40-70%)</option>
                    <option value={4}>4 — Nacional (processos produtivos básicos)</option>
                    <option value={5}>5 — Nacional (conteúdo import. até 40%)</option>
                    <option value={6}>6 — Estrangeira (import. direta, sem similar)</option>
                    <option value={7}>7 — Estrangeira (mercado interno, sem similar)</option>
                    <option value={8}>8 — Nacional (conteúdo import. acima de 70%)</option>
                  </Select>
                  <Input label="Unidade Comercial" type="text" placeholder="UN" className="font-mono"
                    value={editingProduct?.unidade_comercial ?? "UN"}
                    onChange={e => handleUppercaseChange(e, (upper) => setEditingProduct(prev => ({ ...prev!, unidade_comercial: upper })))} />
                  <Input label="Unidade Tributável" type="text" placeholder="UN" className="font-mono"
                    value={editingProduct?.unidade_tributavel ?? "UN"}
                    onChange={e => handleUppercaseChange(e, (upper) => setEditingProduct(prev => ({ ...prev!, unidade_tributavel: upper })))} />
                </div>

                {taxRegime === "simples_nacional" || taxRegime === "simples_excesso" ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Select label="CSOSN"
                      value={editingProduct?.csosn ?? "102"}
                      onChange={e => setEditingProduct(prev => ({ ...prev!, csosn: e.target.value }))}>
                      <option value="101">101 — Tributada com permissão de crédito</option>
                      <option value="102">102 — Tributada sem permissão de crédito</option>
                      <option value="103">103 — Isenção do ICMS (faixa de receita bruta)</option>
                      <option value="300">300 — Imune</option>
                      <option value="400">400 — Não tributada</option>
                      <option value="500">500 — ICMS cobrado por ST/antecipação</option>
                      <option value="900">900 — Outros</option>
                    </Select>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <Select label="CST ICMS"
                      value={editingProduct?.cst_icms ?? "00"}
                      onChange={e => setEditingProduct(prev => ({ ...prev!, cst_icms: e.target.value }))}>
                      <option value="00">00 — Tributada integralmente</option>
                      <option value="10">10 — Tributada com ST</option>
                      <option value="20">20 — Com redução de base de cálculo</option>
                      <option value="40">40 — Isenta</option>
                      <option value="41">41 — Não tributada</option>
                      <option value="50">50 — Suspensão</option>
                      <option value="60">60 — Cobrado anteriormente por ST</option>
                      <option value="90">90 — Outras</option>
                    </Select>
                    <Input label="Alíquota ICMS (%)" type="number" step="0.01" min="0" className="font-mono"
                      value={editingProduct?.icms_aliquota ?? ""}
                      onChange={e => { const v = e.target.value; setEditingProduct(prev => ({ ...prev!, icms_aliquota: v === "" ? undefined : Number(v) })); }} />
                    <Input label="PIS CST" type="text" maxLength={2} className="font-mono" showCount={false}
                      value={editingProduct?.pis_cst || ""}
                      onChange={e => setEditingProduct(prev => ({ ...prev!, pis_cst: e.target.value.replace(/\D/g, "") }))} />
                    <Input label="COFINS CST" type="text" maxLength={2} className="font-mono" showCount={false}
                      value={editingProduct?.cofins_cst || ""}
                      onChange={e => setEditingProduct(prev => ({ ...prev!, cofins_cst: e.target.value.replace(/\D/g, "") }))} />
                  </div>
                )}
              </PanelCard>
            )}

            {productModalTab === "vitrine" && <PanelCard title="Conteúdo do catálogo virtual" icon={ImageIcon} contentClassName="space-y-4">
              <p className="text-xs text-slate-500">Cada produto tem seu próprio conteúdo. As abas vazias não aparecem na loja. Cadastre cor, espessura e acabamento em Estoque e Grades → Grades & Variações; somente as opções cadastradas serão exibidas.</p>
              <Textarea label="Descrição" rows={4} maxLength={10000} value={editingProduct?.description || ""} onChange={e => setEditingProduct(prev => ({ ...prev!, description: e.target.value }))}/>
              <Textarea label="Especificações" rows={5} maxLength={10000} placeholder="Material, espessura, dimensões de fábrica, conteúdo do kit…" value={editingProduct?.storefront_details?.specifications || ""} onChange={e => setEditingProduct(prev => ({ ...prev!, storefront_details: { ...prev?.storefront_details, specifications: e.target.value } }))}/>
              <Textarea label="Entrega e instalação" rows={5} maxLength={10000} placeholder="Região atendida, prazo, retirada e o que está incluído na instalação deste produto." value={editingProduct?.storefront_details?.delivery_installation || ""} onChange={e => setEditingProduct(prev => ({ ...prev!, storefront_details: { ...prev?.storefront_details, delivery_installation: e.target.value } }))}/>
              <div className="space-y-3 border-t border-slate-200 pt-4">
                <Switch label="Cliente pode informar medidas neste produto" checked={glassMeasurements(editingProduct as Product).enabled} onChange={enabled => setEditingProduct(prev => ({ ...prev!, storefront_details: { ...prev?.storefront_details, measurements: { ...prev?.storefront_details?.measurements, enabled } } }))} accent="blue"/>
                <p className="text-xs text-slate-500">Desligue para ferragens, kits e produtos com dimensão fixa. Produtos vendidos por m² ou metro linear usam medidas por padrão. Para receber solicitações em rascunho, habilite Orçamento online nas configurações da loja.</p>
                {glassMeasurements(editingProduct as Product).enabled && <>
                  <Select label="Modelo do desenho da peça" value={editingProduct?.storefront_details?.measurements?.kind || "fixo"} onChange={e => setEditingProduct(prev => ({ ...prev!, storefront_details: { ...prev?.storefront_details, measurements: { ...prev?.storefront_details?.measurements, kind: e.target.value } } }))}>{PIECE_KINDS.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}</Select>
                  <Switch label="Permitir solicitar conferência quando o cliente não souber as medidas" checked={editingProduct?.storefront_details?.measurements?.allow_measure_later !== false} onChange={allow_measure_later => setEditingProduct(prev => ({ ...prev!, storefront_details: { ...prev?.storefront_details, measurements: { ...prev?.storefront_details?.measurements, allow_measure_later } } }))} accent="blue"/>
                </>}
              </div>
            </PanelCard>}
            {productModalTab === "estoque" && (
              <div className="space-y-4">
                <PanelCard title="Estoque" icon={Boxes} contentClassName="space-y-3">
                  <div className="space-y-1">
                    <label className="ds-label">Tipo de Venda</label>
                    <FilterLineSegmented
                      size="sm"
                      className="sm:!w-fit"
                      value={editingProduct?.sale_unit ?? "unidade"}
                      options={[
                        { value: "unidade", label: "Unidade" },
                        { value: "m2", label: "m²" },
                        { value: "linear", label: "Metro linear" },
                        { value: "peso", label: "Peso" },
                        { value: "volume", label: "Líquido" },
                      ]}
                      onChange={(value) => setEditingProduct(prev => ({
                        ...prev!,
                        sale_unit: value as Product["sale_unit"],
                        measure_unit: value === "unidade" ? prev?.measure_unit : defaultMeasureUnit(value as NonNullable<Product["sale_unit"]>),
                      }))}
                    />
                  </div>

                  {(editingProduct?.sale_unit ?? "unidade") === "unidade" ? (
                    (editingProduct?.skus || []).length === 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div data-tour="product-stock-field">
                          <Input label="Estoque Atual" type="number" min="0" required className="font-mono"
                            value={editingProduct?.stock_quantity ?? 0}
                            onChange={e => setEditingProduct(prev => ({ ...prev!, stock_quantity: Number(e.target.value) }))} />
                        </div>
                        <Input label="Estoque Mínimo" type="number" min="0" className="font-mono"
                          hint="Abaixo disso, o produto entra no alerta de Estoque Crítico"
                          value={editingProduct?.min_stock ?? 5}
                          onChange={e => setEditingProduct(prev => ({ ...prev!, min_stock: Number(e.target.value) }))} />
                      </div>
                    )
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <Select label="Unidade de medida"
                        hint="Preço, saldo e mínimo usam esta unidade."
                        value={editingProduct?.measure_unit ?? defaultMeasureUnit(measureSaleUnit)}
                        onChange={e => changeMeasureUnit(e.target.value)}
                      >
                        {measureUnitOptions(measureSaleUnit).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                      </Select>
                      <Input label={`Preço por ${measureUnitLabel(editingProduct?.measure_unit, measureSaleUnit)} (R$) *`} type="number" step="0.01" min="0" required className="font-mono"
                        value={editingProduct?.price_per_measure ?? ""}
                        onChange={e => { const v = e.target.value; setEditingProduct(prev => ({ ...prev!, price_per_measure: v === "" ? undefined : Number(v) })); }} />
                      <Input label={`Estoque disponível (${measureSuffix}) *`} type="number" step="0.001" min="0" required className="font-mono"
                        hint={`Ex.: 10 ${measureSuffix}; vender 0,50 ${measureSuffix} deixa 9,50 ${measureSuffix}.`}
                        value={editingProduct?.measure_stock_quantity ?? 0}
                        onChange={e => setEditingProduct(prev => ({ ...prev!, measure_stock_quantity: Number(e.target.value) }))} />
                      <Input label={`Mínimo faturável (${measureSuffix}) — opcional`} type="number" step="0.01" min="0" className="font-mono"
                        value={editingProduct?.min_billable_quantity ?? ""}
                        onChange={e => { const v = e.target.value; setEditingProduct(prev => ({ ...prev!, min_billable_quantity: v === "" ? undefined : Number(v) })); }} />
                      <Input label={`Estoque mínimo (${measureSuffix})`} type="number" step="0.001" min="0" className="font-mono"
                        value={editingProduct?.measure_min_stock ?? 0}
                        onChange={e => setEditingProduct(prev => ({ ...prev!, measure_min_stock: Number(e.target.value) }))} />
                      <p className="hidden">
                        Produtos por medida não têm controle de estoque — a peça é cortada sob medida no momento da venda.
                      </p>
                    </div>
                  )}

                  {editingProduct?.sale_unit === "m2" && (() => {
                    const opts = resolveGlassOptions(glassOptions);
                    const setDefault = (patch: Record<string, string | number | undefined>) =>
                      setEditingProduct(prev => ({ ...prev!, piece_defaults: { ...(prev?.piece_defaults ?? {}), ...patch } }));
                    return (
                      <div className="space-y-3 rounded-lg border border-cyan-200 bg-cyan-50/60 p-3">
                        <label className="flex items-start gap-2 text-xs font-semibold text-slate-800">
                          <input
                            type="checkbox" className="mt-0.5 accent-cyan-600" checked={!!editingProduct?.piece_kind}
                            onChange={(e) => setEditingProduct(prev => ({ ...prev!, piece_kind: e.target.checked ? (prev?.piece_kind || opts.kinds[0]?.value || "janela_correr") : null }))}
                          />
                          <span>
                            Este produto é uma peça de vidraçaria
                            <span className="mt-0.5 block text-[11px] font-normal text-slate-500">
                              No orçamento abre o desenho da peça, para informar largura e altura (mm) com vidro, espessura, sangria, margem de segurança e adicionais. O valor sai do preço por m² acima.
                            </span>
                          </span>
                        </label>
                        {editingProduct?.piece_kind && (
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <Select label="Tipo de peça" value={editingProduct.piece_kind} onChange={e => setEditingProduct(prev => ({ ...prev!, piece_kind: e.target.value }))}>
                              {PIECE_KINDS.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
                            </Select>
                            <Select label="Vidro padrão" value={editingProduct.piece_defaults?.glass ?? ""} onChange={e => setDefault({ glass: e.target.value || undefined })}>
                              <option value="">Não definir</option>
                              {opts.glassTypes.map(g => <option key={g} value={g}>{g}</option>)}
                            </Select>
                            <Select label="Espessura padrão" value={editingProduct.piece_defaults?.thickness_mm ?? ""} onChange={e => setDefault({ thickness_mm: e.target.value ? Number(e.target.value) : undefined })}>
                              <option value="">Não definir</option>
                              {opts.thicknesses.map(t => <option key={t} value={t}>{t} mm</option>)}
                            </Select>
                            <div className="sm:col-span-3">
                              <Select label="Cor do perfil / ferragem padrão" value={editingProduct.piece_defaults?.finish ?? ""} onChange={e => setDefault({ finish: e.target.value || undefined })}>
                                <option value="">Não definir</option>
                                {opts.finishes.map(f => <option key={f} value={f}>{f}</option>)}
                              </Select>
                            </div>
                            <p className="sm:col-span-3 text-[11px] text-slate-500">Os vidros, espessuras e cores desta lista vêm de Configurações &gt; Vidraçaria.</p>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </PanelCard>

                <PanelCard title="Envio e Embalagem" description="Usado no cálculo de frete das vendas online." icon={Boxes} contentClassName="space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <Input label="Peso (g)" type="number" step="1" min="0" placeholder="Ex.: 350" className="font-mono"
                      value={editingProduct?.weight_grams ?? ""}
                      onChange={e => { const v = e.target.value; setEditingProduct(prev => ({ ...prev!, weight_grams: v === "" ? null : Math.round(Number(v)) })); }} />
                    <Input label="Comprimento (cm)" type="number" step="0.1" min="0" className="font-mono"
                      value={editingProduct?.package_length_cm ?? ""}
                      onChange={e => { const v = e.target.value; setEditingProduct(prev => ({ ...prev!, package_length_cm: v === "" ? null : Number(v) })); }} />
                    <Input label="Largura (cm)" type="number" step="0.1" min="0" className="font-mono"
                      value={editingProduct?.package_width_cm ?? ""}
                      onChange={e => { const v = e.target.value; setEditingProduct(prev => ({ ...prev!, package_width_cm: v === "" ? null : Number(v) })); }} />
                    <Input label="Altura (cm)" type="number" step="0.1" min="0" className="font-mono"
                      value={editingProduct?.package_height_cm ?? ""}
                      onChange={e => { const v = e.target.value; setEditingProduct(prev => ({ ...prev!, package_height_cm: v === "" ? null : Number(v) })); }} />
                  </div>
                </PanelCard>

                {/* ── VARIAÇÕES ── */}
                <PanelCard
                  title="Grades & Variações"
                  description="Tamanho, cor, voltagem, peso, etc."
                  icon={Palette}
                  contentClassName="space-y-3"
                  action={
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Clear button — only when attributes exist */}
                      {(editingProduct?.attributes || []).length > 0 && (
                        <Button type="button" variant="danger" size="sm" iconLeft={<X size={11} />} onClick={clearAttributes}>Limpar</Button>
                      )}
                      <Button type="button" variant="outline" size="sm" iconLeft={<Zap size={11} />} onClick={() => setShowPresets(v => !v)}>Modelos rápidos</Button>
                    </div>
                  }
                >
                  {/* Preset panel */}
                  <AnimatePresence>
                    {showPresets && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                        <VariationPresetsPanel current={editingProduct?.attributes || []} onApply={applyPreset} />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* ── Step 1: Atributos ── */}
                  <div className="space-y-3">
                    {(editingProduct?.attributes || []).map((attr, attrIdx) => (
                      <motion.div key={attrIdx} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
                        className="bg-white border border-slate-200 rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-medium text-slate-800">
                            {editCell?.attr === attrIdx && editCell.val === null
                              ? <InlineEdit value={attr.name} onCommit={v => renameAttr(attrIdx, v)} onCancel={() => setEditCell(null)} />
                              : <button type="button" title="Clique para renomear a variação" onClick={() => setEditCell({ attr: attrIdx, val: null })} className="rounded px-0.5 hover:bg-slate-100 hover:text-blue-600">{attr.name}</button>}
                            <span className="ml-2 text-slate-400 font-medium text-[11px]">{attr.values.length} valor{attr.values.length !== 1 ? "es" : ""}</span>
                          </p>
                        </div>
                        {/* detect if this is a color attribute */}
                        {(() => {
                          const isColorAttr = /^cor$/i.test(attr.name.trim()) || /^colou?r$/i.test(attr.name.trim());
                          return (
                            <div className="flex flex-wrap items-center gap-1.5">
                              {attr.values.map((val, valIdx) => (
                                <span key={valIdx} className={`inline-flex items-center gap-1.5 border text-[11px] font-medium px-2 py-1 rounded-lg ${isColorAttr ? "bg-white border-slate-200" : "bg-blue-50 border-blue-200 text-blue-700"}`}>
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
                                  {editCell?.attr === attrIdx && editCell.val === valIdx
                                    ? <InlineEdit value={val} onCommit={v => renameAttrValue(attrIdx, valIdx, v)} onCancel={() => setEditCell(null)} />
                                    : <button type="button" title="Clique para renomear" onClick={() => setEditCell({ attr: attrIdx, val: valIdx })} className={cn("rounded hover:underline", isColorAttr ? "text-slate-700" : "")}>{val}</button>}
                                  <button type="button" aria-label={`Remover ${val}`} onClick={() => removeAttrValue(attrIdx, valIdx)} className="text-slate-300 hover:text-red-500 transition-colors ml-0.5">
                                    <X size={9} strokeWidth={3} />
                                  </button>
                                </span>
                              ))}
                              {/* inline add value to existing attr */}
                              <Input size="sm" wrapperClassName="w-36" type="text" placeholder="+ valor (Enter ou vírgula)"
                                onKeyDown={e => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); const inp = e.currentTarget; addAttrValue(attr.name, inp.value); inp.value = ""; } }}
                                onBlur={e => { const inp = e.currentTarget; if (inp.value.trim()) { addAttrValue(attr.name, inp.value); inp.value = ""; } }} />
                            </div>
                          );
                        })()}
                      </motion.div>
                    ))}
                  </div>

                  {/* ── Add new attribute ── */}
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
                    <p className="text-[11px] font-medium text-slate-500">Adicionar atributo</p>
                    <div className="flex gap-2">
                      <Input wrapperClassName="flex-1" type="text" placeholder="Atributo (Tamanho, Cor...)"
                        value={newAttrName} onChange={e => setNewAttrName(e.target.value)} />
                      <Input wrapperClassName="flex-1" type="text" placeholder="Valores: Azul, Marrom, Preto"
                        value={newAttrValue} onChange={e => setNewAttrValue(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addAttrValue(newAttrName, newAttrValue); setNewAttrName(""); } }} />
                      <IconButton type="button" variant="primary" aria-label="Adicionar atributo"
                        onClick={() => { addAttrValue(newAttrName, newAttrValue); setNewAttrName(""); }}
                        disabled={!newAttrName.trim() || !newAttrValue.trim()}>
                        <Plus size={15} strokeWidth={3} />
                      </IconButton>
                    </div>
                    <p className="text-[11px] text-slate-400">Separe vários valores com vírgula (Azul, Marrom, Preto) — cada um vira uma opção. Para somar mais valores depois, use o campo "+ valor" acima.</p>
                  </div>

                  {/* ── Step 2: Combinações (SKU matrix) ── */}
                  {(editingProduct?.skus || []).length > 0 && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-1 h-4 bg-blue-600 rounded-full" />
                        <p className="text-xs font-medium text-slate-800">Estoque por combinação</p>
                        <Badge color="primary" pill>
                          {(editingProduct?.skus || []).length} SKU{(editingProduct?.skus || []).length !== 1 ? "s" : ""}
                        </Badge>
                      </div>
                      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                        <div className="divide-y divide-slate-100">
                          {(editingProduct?.skus || []).map((sku, skuIdx) => {
                            const label = Object.values(sku.combo).join(" · ");
                            return (
                              <div key={skuIdx} className="px-4 py-2.5">
                                <div className="flex flex-wrap items-center gap-3">
                                  <p className="flex-1 text-xs font-medium text-slate-700 min-w-0 truncate">{label}</p>
                                  <Button type="button" size="sm" variant={expandedSkuImagesIndex === skuIdx ? "primary" : "outline"}
                                    iconLeft={<ImageIcon size={12} />}
                                    onClick={() => setExpandedSkuImagesIndex(i => i === skuIdx ? null : skuIdx)}>
                                    Fotos {sku.images?.length ? `(${sku.images.length})` : ""}
                                  </Button>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <Input size="sm" wrapperClassName="w-20" type="number" min="0" className="text-center font-mono"
                                      value={sku.stock}
                                      onChange={e => updateSkuStock(skuIdx, Number(e.target.value))} />
                                    <span className="text-[11px] text-slate-400 font-medium w-4">un</span>
                                  </div>
                                </div>
                                {expandedSkuImagesIndex === skuIdx && (
                                  <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50/40 p-3">
                                    <p className="mb-2 text-[11px] font-medium leading-relaxed text-slate-500">Estas fotos aparecerão automaticamente quando o cliente escolher <strong className="text-slate-700">{label}</strong>.</p>
                                    <GalleryUploader label="Fotos desta variação" images={sku.images || []} onChange={images => updateSkuImages(skuIdx, images)} />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        <div className="bg-zinc-50 px-4 py-2 border-t border-slate-100 flex justify-between items-center">
                          <span className="text-[11px] text-slate-400 font-medium">Total em estoque</span>
                          <span className="text-sm font-medium text-slate-900 font-mono">
                            {(editingProduct?.skus || []).reduce((s, k) => s + k.stock, 0)} un
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {(editingProduct?.attributes || []).length === 0 && (
                    <div className="py-5 border-2 border-dashed border-slate-100 rounded-lg text-center text-slate-400">
                      <p className="text-[11px] font-medium">Sem variações</p>
                      <p className="text-[11px] font-medium mt-0.5">Use "Modelos rápidos" ou adicione atributos acima</p>
                    </div>
                  )}
                </PanelCard>
              </div>
            )}
          </Tabs>
          <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
            <Button variant="secondary" type="button" onClick={onCancel} disabled={saving}>Cancelar</Button>
            <Button type="submit" icon={<Save size={13} />} loading={saving} disabled={saving}>
              {saving ? "Salvando..." : editingProduct?.id ? "Salvar Alterações" : "Cadastrar Produto"}
            </Button>
          </div>
        </form>
      </ContentCard>
    </div>
  );
}
