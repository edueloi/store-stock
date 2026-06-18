import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Wrench, Plus, Edit2, Trash2, Save, ToggleLeft, ToggleRight,
  AlertTriangle, CheckCircle, XCircle,
  Search, X, LayoutGrid, List, Clock,
  Printer, CreditCard, Copy, Image, Scissors, Box,
  Ruler, Package, Tag, Upload,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import Button from "../../components/ui/Button";
import { Input, Textarea } from "../../components/ui/Input";
import Modal from "../../components/ui/Modal";
import PageHeader from "../../components/layout/PageHeader";
import { EmptyState, LoadingState } from "../../components/layout/EmptyState";
import { StatCard } from "../../components/ui/Card";
import Combobox from "../../components/ui/Combobox";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Service {
  id: number;
  name: string;
  description?: string;
  price: number;
  unit: string;
  category: string;
  is_active: boolean;
  image_url?: string | null;
  created_at: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const SERVICE_CATEGORIES = [
  { value: "Impressão",        label: "Impressão",        icon: Printer,     color: "bg-violet-50 text-violet-600",   badge: "bg-violet-100 text-violet-700"  },
  { value: "Cartão de Visita", label: "Cartão de Visita", icon: CreditCard,  color: "bg-blue-50 text-blue-600",       badge: "bg-blue-100 text-blue-700"      },
  { value: "Xerox / Cópia",    label: "Xerox / Cópia",    icon: Copy,        color: "bg-amber-50 text-amber-600",     badge: "bg-amber-100 text-amber-700"    },
  { value: "Banner / Adesivo", label: "Banner / Adesivo", icon: Image,       color: "bg-pink-50 text-pink-600",       badge: "bg-pink-100 text-pink-700"      },
  { value: "Acabamento",       label: "Acabamento",       icon: Scissors,    color: "bg-emerald-50 text-emerald-600", badge: "bg-emerald-100 text-emerald-700"},
  { value: "Embalagem",        label: "Embalagem",        icon: Box,         color: "bg-orange-50 text-orange-600",   badge: "bg-orange-100 text-orange-700"  },
  { value: "Manutenção",       label: "Manutenção",       icon: Wrench,      color: "bg-slate-50 text-slate-600",     badge: "bg-slate-100 text-slate-700"    },
  { value: "Geral",            label: "Geral / Outros",   icon: Package,     color: "bg-slate-50 text-slate-500",     badge: "bg-slate-100 text-slate-600"    },
] as const;

export const SERVICE_UNITS = [
  { value: "unidade",  label: "Unidade",        abbr: "un"  },
  { value: "kg",       label: "Quilograma",      abbr: "kg"  },
  { value: "g",        label: "Grama",           abbr: "g"   },
  { value: "litro",    label: "Litro",           abbr: "L"   },
  { value: "ml",       label: "Mililitro",       abbr: "mL"  },
  { value: "metro",    label: "Metro",           abbr: "m"   },
  { value: "cm",       label: "Centímetro",      abbr: "cm"  },
  { value: "m2",       label: "Metro Quadrado",  abbr: "m²"  },
  { value: "hora",     label: "Hora",            abbr: "h"   },
  { value: "folha",    label: "Folha",           abbr: "fl"  },
  { value: "cópia",    label: "Cópia",           abbr: "cp"  },
] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const EMPTY_FORM = () => ({
  name: "", description: "", price: "", unit: "unidade", category: "Geral", is_active: true, image_url: "",
});

const MAX_IMAGE_SIZE = 2 * 1024 * 1024; // 2 MB

const authH = () => ({
  Authorization: `Bearer ${localStorage.getItem("token")}`,
  "Content-Type": "application/json",
});

function fmt(price: number) {
  return price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function applyMoneyMask(raw: string) {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  const num = parseInt(digits, 10) / 100;
  return num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseMaskedPrice(masked: string) {
  return parseFloat(masked.replace(/\./g, "").replace(",", ".")) || 0;
}

function getCategoryMeta(value: string) {
  return SERVICE_CATEGORIES.find((c) => c.value === value) ?? SERVICE_CATEGORIES[SERVICE_CATEGORIES.length - 1];
}

function getUnitAbbr(value: string) {
  return SERVICE_UNITS.find((u) => u.value === value)?.abbr ?? value;
}

type ViewMode = "grid" | "list";

// ─── Component ────────────────────────────────────────────────────────────────

export default function Services() {
  const [services, setServices]   = useState<Service[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState("");
  const [viewMode, setViewMode]   = useState<ViewMode>("grid");
  const [filterActive, setFilterActive] = useState<"all" | "active" | "inactive">("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing]         = useState<Service | null>(null);
  const [form, setForm]               = useState(EMPTY_FORM());
  const [saving, setSaving]           = useState(false);
  const [customCategories, setCustomCategories] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("svc_custom_cats") ?? "[]"); } catch { return []; }
  });

  const [deleteTarget, setDeleteTarget] = useState<Service | null>(null);
  const [deleting, setDeleting]         = useState(false);

  const [imagePreview, setImagePreview]   = useState<string>("");
  const [uploadingImg, setUploadingImg]   = useState(false);
  const [imgToast, setImgToast]           = useState<string>("");
  const fileInputRef                      = useRef<HTMLInputElement>(null);

  const fetchServices = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/services", { headers: authH() });
      const d = await r.json();
      setServices(Array.isArray(d) ? d : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchServices(); }, [fetchServices]);

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY_FORM());
    setImagePreview("");
    setImgToast("");
    setIsModalOpen(true);
  };

  const openEdit = (s: Service) => {
    setEditing(s);
    const masked = Number(s.price).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    setForm({
      name: s.name,
      description: s.description ?? "",
      price: masked,
      unit: s.unit ?? "unidade",
      category: s.category ?? "Geral",
      is_active: s.is_active,
      image_url: s.image_url ?? "",
    });
    setImagePreview(s.image_url ?? "");
    setImgToast("");
    setIsModalOpen(true);
  };

  const closeModal = () => { setIsModalOpen(false); setEditing(null); setImagePreview(""); setImgToast(""); };

  const handleImageFile = async (file: File) => {
    if (!["image/jpeg", "image/png"].includes(file.type)) {
      setImgToast("Apenas arquivos JPG e PNG são suportados.");
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      setImgToast(`Imagem muito grande (${(file.size / 1024 / 1024).toFixed(1)} MB). Limite: 2 MB.`);
      return;
    }
    setImgToast("");
    setUploadingImg(true);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const res = await fetch("/api/upload/service-image", {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        body: fd,
      });
      if (res.ok) {
        const { url } = await res.json();
        setForm((f) => ({ ...f, image_url: url }));
        setImagePreview(url);
      } else {
        setImgToast("Falha ao fazer upload da imagem.");
      }
    } finally {
      setUploadingImg(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.price) return;
    setSaving(true);
    try {
      const url    = editing ? `/api/services/${editing.id}` : "/api/services";
      const method = editing ? "PUT" : "POST";
      await fetch(url, {
        method, headers: authH(),
        body: JSON.stringify({ ...form, price: parseMaskedPrice(form.price), image_url: form.image_url || null }),
      });
      closeModal();
      fetchServices();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await fetch(`/api/services/${deleteTarget.id}`, { method: "DELETE", headers: authH() });
      setDeleteTarget(null);
      fetchServices();
    } finally {
      setDeleting(false);
    }
  };

  const handleToggle = async (s: Service) => {
    await fetch(`/api/services/${s.id}`, {
      method: "PUT", headers: authH(),
      body: JSON.stringify({ name: s.name, description: s.description, price: Number(s.price), unit: s.unit, category: s.category, is_active: !s.is_active }),
    });
    fetchServices();
  };

  // derived categories present in data
  const presentCategories = useMemo(() => {
    const cats = [...new Set(services.map((s) => s.category).filter(Boolean))];
    return cats.sort();
  }, [services]);

  const filtered = useMemo(() => services.filter((s) => {
    const matchSearch = !search
      || s.name.toLowerCase().includes(search.toLowerCase())
      || (s.description ?? "").toLowerCase().includes(search.toLowerCase())
      || s.category.toLowerCase().includes(search.toLowerCase());
    const matchStatus =
      filterActive === "all"      ? true :
      filterActive === "active"   ? s.is_active :
      !s.is_active;
    const matchCat = filterCategory === "all" || s.category === filterCategory;
    return matchSearch && matchStatus && matchCat;
  }), [services, search, filterActive, filterCategory]);

  const activeCount   = services.filter((s) => s.is_active).length;
  const inactiveCount = services.filter((s) => !s.is_active).length;

  // group filtered by category for grid
  const grouped = useMemo(() => {
    const map = new Map<string, Service[]>();
    filtered.forEach((s) => {
      const key = s.category || "Geral";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    });
    return map;
  }, [filtered]);

  // all category options: built-in + custom ones from previous saves + ones already used in data
  const allCategoryOptions = useMemo(() => {
    const builtIn = SERVICE_CATEGORIES.map((c) => ({ value: c.value, label: c.label, icon: <c.icon size={12} /> }));
    const existingInData = services.map((s) => s.category).filter(Boolean);
    const extra = [...new Set([...customCategories, ...existingInData])]
      .filter((c) => !SERVICE_CATEGORIES.some((b) => b.value === c));
    return [...builtIn, ...extra.map((c) => ({ value: c, label: c, icon: <Tag size={12} /> }))];
  }, [customCategories, services]);

  const unitOptions = SERVICE_UNITS.map((u) => ({
    value: u.value,
    label: `${u.label} (${u.abbr})`,
    description: u.abbr,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Serviços"
        subtitle="Gerencie os serviços oferecidos — impressão, cartão de visita, xerox e mais"
        action={
          <Button icon={<Plus size={15} />} onClick={openNew}>
            Novo Serviço
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Total" value={services.length} icon={<Wrench />} accent="blue" />
        <StatCard label="Ativos" value={activeCount} icon={<CheckCircle />} accent="blue" />
        <StatCard label="Inativos" value={inactiveCount} icon={<XCircle />} accent="slate" />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-2">
        {/* Search + view toggle */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, descrição ou categoria..."
              className="w-full pl-9 pr-9 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X size={14} />
              </button>
            )}
          </div>

          {/* Status filter */}
          <div className="flex border border-slate-200 rounded-xl overflow-hidden bg-white shrink-0 text-[10px] font-black uppercase tracking-widest">
            {(["all", "active", "inactive"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilterActive(f)}
                className={`px-3 py-2.5 transition-all ${filterActive === f ? "bg-slate-900 text-white" : "text-slate-400 hover:text-slate-600"}`}
              >
                {f === "all" ? "Todos" : f === "active" ? "Ativos" : "Inativos"}
              </button>
            ))}
          </div>

          {/* View toggle */}
          <div className="flex border border-slate-200 rounded-xl overflow-hidden bg-white shrink-0">
            <button
              onClick={() => setViewMode("list")}
              className={`px-3 py-2.5 transition-all ${viewMode === "list" ? "bg-slate-900 text-white" : "text-slate-400 hover:text-slate-600"}`}
            >
              <List size={14} />
            </button>
            <button
              onClick={() => setViewMode("grid")}
              className={`px-3 py-2.5 transition-all ${viewMode === "grid" ? "bg-slate-900 text-white" : "text-slate-400 hover:text-slate-600"}`}
            >
              <LayoutGrid size={14} />
            </button>
          </div>
        </div>

        {/* Category filter pills */}
        {presentCategories.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setFilterCategory("all")}
              className={`h-7 px-3 rounded-full text-[10px] font-black uppercase tracking-wider border transition-all ${
                filterCategory === "all"
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-500 border-slate-200 hover:border-slate-400"
              }`}
            >
              Todas
            </button>
            {presentCategories.map((cat) => {
              const meta = getCategoryMeta(cat);
              const Icon = meta.icon;
              return (
                <button
                  key={cat}
                  onClick={() => setFilterCategory(cat)}
                  className={`h-7 px-3 rounded-full text-[10px] font-black uppercase tracking-wider border transition-all flex items-center gap-1.5 ${
                    filterCategory === cat
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white text-slate-500 border-slate-200 hover:border-slate-400"
                  }`}
                >
                  <Icon size={10} />
                  {cat}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <LoadingState rows={4} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Wrench size={32} strokeWidth={1} />}
          title={search || filterActive !== "all" || filterCategory !== "all" ? "Nenhum serviço encontrado" : "Nenhum serviço cadastrado"}
          description="Cadastre serviços como impressão, cartão de visita, xerox e mais para usar no PDV."
          action={!search && filterActive === "all" && filterCategory === "all" && (
            <Button icon={<Plus size={14} />} onClick={openNew}>Cadastrar Serviço</Button>
          )}
        />
      ) : viewMode === "list" ? (
        /* ── LIST VIEW ── */
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="hidden sm:grid grid-cols-[1fr_1.5fr_auto_auto_auto] gap-4 px-5 py-2.5 bg-slate-50 border-b border-slate-200">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Serviço</span>
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Descrição</span>
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Unidade</span>
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Preço</span>
            <span />
          </div>
          <div className="divide-y divide-slate-50">
            {filtered.map((svc) => {
              const meta = getCategoryMeta(svc.category);
              const Icon = meta.icon;
              return (
                <motion.div
                  key={svc.id}
                  layout
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex sm:grid sm:grid-cols-[1fr_1.5fr_auto_auto_auto] items-center gap-4 px-5 py-3.5 hover:bg-slate-50/60 transition-colors ${!svc.is_active ? "opacity-50" : ""}`}
                >
                  {/* Nome + status */}
                  <div className="flex items-center gap-3 min-w-0">
                    {svc.image_url ? (
                      <div className="w-9 h-9 rounded-xl overflow-hidden shrink-0 border border-slate-100">
                        <img src={svc.image_url} alt={svc.name} className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${svc.is_active ? meta.color : "bg-slate-100 text-slate-400"}`}>
                        <Icon size={15} />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-[12px] font-bold text-slate-900 truncate">{svc.name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <span className={`text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full ${svc.is_active ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400"}`}>
                          {svc.is_active ? "Ativo" : "Inativo"}
                        </span>
                        <span className={`text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full ${meta.badge}`}>
                          {svc.category}
                        </span>
                        <span className="flex items-center gap-0.5 text-[9px] text-slate-400">
                          <Clock size={8} />
                          {new Date(svc.created_at).toLocaleDateString("pt-BR")}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Descrição */}
                  <p className="hidden sm:block text-[11px] text-slate-500 truncate">
                    {svc.description || <span className="text-slate-300 italic">Sem descrição</span>}
                  </p>

                  {/* Unidade */}
                  <span className="hidden sm:flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 shrink-0">
                    <Ruler size={9} className="text-slate-400" />
                    {getUnitAbbr(svc.unit ?? "unidade")}
                  </span>

                  {/* Preço */}
                  <div className="text-right shrink-0">
                    <p className="text-[14px] font-mono font-black text-blue-600">{fmt(Number(svc.price))}</p>
                    <p className="text-[9px] text-slate-400">/{getUnitAbbr(svc.unit ?? "unidade")}</p>
                  </div>

                  {/* Ações */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleToggle(svc)}
                      title={svc.is_active ? "Desativar" : "Ativar"}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 transition-all"
                    >
                      {svc.is_active
                        ? <ToggleRight size={18} className="text-emerald-500" />
                        : <ToggleLeft size={18} />}
                    </button>
                    <button
                      onClick={() => openEdit(svc)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-all"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(svc)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-all"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      ) : (
        /* ── GRID VIEW — grouped by category ── */
        <div className="space-y-6">
          <AnimatePresence>
            {[...grouped.entries()].map(([cat, items]) => {
              const meta = getCategoryMeta(cat);
              const CatIcon = meta.icon;
              return (
                <motion.div
                  key={cat}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                >
                  {/* Category header */}
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${meta.color}`}>
                      <CatIcon size={13} />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">{cat}</span>
                    <span className="text-[9px] text-slate-400 font-bold">{items.length} serviço{items.length !== 1 ? "s" : ""}</span>
                    <div className="flex-1 h-px bg-slate-100" />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {items.map((svc) => {
                      const m = getCategoryMeta(svc.category);
                      const Ic = m.icon;
                      return (
                        <motion.div
                          key={svc.id}
                          layout
                          className={`bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all flex flex-col gap-3 ${!svc.is_active ? "opacity-50" : ""}`}
                        >
                          {/* Header row */}
                          <div className="flex items-start justify-between gap-2">
                            {svc.image_url ? (
                              <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 border border-slate-100">
                                <img src={svc.image_url} alt={svc.name} className="w-full h-full object-cover" />
                              </div>
                            ) : (
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${svc.is_active ? m.color : "bg-slate-100 text-slate-400"}`}>
                                <Ic size={16} />
                              </div>
                            )}
                            <div className="flex flex-col items-end gap-1">
                              <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${svc.is_active ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400"}`}>
                                {svc.is_active ? "Ativo" : "Inativo"}
                              </span>
                              <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${m.badge}`}>
                                {svc.category}
                              </span>
                            </div>
                          </div>

                          {/* Name + description */}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-black text-slate-900 uppercase tracking-tight leading-tight">{svc.name}</p>
                            {svc.description && (
                              <p className="text-[10px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">{svc.description}</p>
                            )}
                          </div>

                          {/* Price + unit */}
                          <div className="flex items-end justify-between">
                            <div>
                              <p className="text-[18px] font-mono font-black text-blue-600 leading-none">{fmt(Number(svc.price))}</p>
                              <p className="text-[9px] text-slate-400 mt-0.5 flex items-center gap-1">
                                <Ruler size={8} />
                                por {svc.unit ?? "unidade"}
                              </p>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex gap-1.5 pt-2 border-t border-slate-100">
                            <button
                              onClick={() => handleToggle(svc)}
                              className="flex-1 h-7 flex items-center justify-center gap-1 bg-slate-50 hover:bg-emerald-50 hover:text-emerald-600 text-slate-400 rounded-lg transition-all border border-slate-200 hover:border-emerald-200 text-[9px] font-black uppercase"
                            >
                              {svc.is_active
                                ? <><ToggleRight size={11} /> Ativo</>
                                : <><ToggleLeft size={11} /> Inativo</>}
                            </button>
                            <button
                              onClick={() => openEdit(svc)}
                              className="w-7 h-7 flex items-center justify-center bg-slate-50 hover:bg-blue-50 hover:text-blue-600 text-slate-400 rounded-lg transition-all border border-slate-200 hover:border-blue-200"
                            >
                              <Edit2 size={11} />
                            </button>
                            <button
                              onClick={() => setDeleteTarget(svc)}
                              className="w-7 h-7 flex items-center justify-center bg-slate-50 hover:bg-red-50 hover:text-red-500 text-slate-400 rounded-lg transition-all border border-slate-200 hover:border-red-200"
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {/* Add card (grid only) */}
          <motion.button
            layout
            onClick={openNew}
            className="w-full bg-white border-2 border-dashed border-slate-200 rounded-2xl p-4 hover:border-blue-400 hover:bg-blue-50/30 transition-all flex items-center justify-center gap-2 text-slate-400 hover:text-blue-600 h-16"
          >
            <Plus size={18} strokeWidth={1.5} />
            <span className="text-[10px] font-black uppercase tracking-widest">Novo Serviço</span>
          </motion.button>
        </div>
      )}

      {/* ── Modal Criar / Editar ── */}
      <Modal
        open={isModalOpen}
        onClose={closeModal}
        title={editing ? "Editar Serviço" : "Novo Serviço"}
        subtitle={editing ? editing.name : "Preencha os dados do serviço"}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={closeModal}>Cancelar</Button>
            <Button form="service-form" type="submit" loading={saving} icon={<Save size={13} />}>
              {editing ? "Salvar" : "Cadastrar"}
            </Button>
          </>
        }
      >
        <form id="service-form" onSubmit={handleSave} className="space-y-3">
          {/* Nome */}
          <Input
            label="Nome do Serviço *"
            required
            autoFocus
            placeholder="Ex: Impressão A4 Colorida, Cartão 9x5cm..."
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />

          {/* Categoria + Unidade lado a lado */}
          <div className="grid grid-cols-2 gap-3">
            <Combobox
              label="Categoria"
              placeholder="Selecionar..."
              searchPlaceholder="Buscar ou criar..."
              options={allCategoryOptions}
              value={form.category}
              onChange={(v) => setForm({ ...form, category: v })}
              freeInput
              onAddNew={(q) => {
                const trimmed = q.trim();
                if (!trimmed) return;
                const updated = [...new Set([...customCategories, trimmed])];
                setCustomCategories(updated);
                localStorage.setItem("svc_custom_cats", JSON.stringify(updated));
                setForm((f) => ({ ...f, category: trimmed }));
              }}
            />
            <Combobox
              label="Unidade"
              placeholder="Unidade..."
              searchPlaceholder="Buscar unidade..."
              options={unitOptions}
              value={form.unit}
              onChange={(v) => setForm({ ...form, unit: v })}
            />
          </div>

          {/* Preço */}
          <div>
            <label className="block text-[10px] font-black text-slate-600 uppercase tracking-wider mb-1.5">
              Preço / {SERVICE_UNITS.find((u) => u.value === form.unit)?.abbr ?? form.unit} *
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[11px] font-bold pointer-events-none select-none">R$</span>
              <input
                required
                inputMode="numeric"
                placeholder="0,00"
                className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all text-slate-800 font-mono"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: applyMoneyMask(e.target.value) })}
              />
            </div>
            {parseMaskedPrice(form.price) > 0 && (
              <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Exemplos:</span>
                {[2, 5, 10, 50].map((qty) => (
                  <span key={qty} className="text-[9px] font-mono font-black text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-md">
                    {qty}× = {fmt(parseMaskedPrice(form.price) * qty)}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Descrição */}
          <Textarea
            label="Descrição"
            placeholder="Especificações, observações..."
            rows={2}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />

          {/* Imagem */}
          <div>
            <label className="block text-[10px] font-black text-slate-600 uppercase tracking-wider mb-1.5">
              Imagem <span className="font-normal normal-case tracking-normal text-slate-400">(JPG ou PNG, máx. 2 MB)</span>
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageFile(f); e.target.value = ""; }}
            />
            {imagePreview ? (
              <div className="relative w-full rounded-xl overflow-hidden border border-slate-200 bg-slate-50" style={{ height: 120 }}>
                <img src={imagePreview} alt="preview" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => { setImagePreview(""); setForm((f) => ({ ...f, image_url: "" })); }}
                  className="absolute top-2 right-2 w-6 h-6 bg-white/90 rounded-full flex items-center justify-center text-slate-500 hover:text-red-500 shadow-sm border border-slate-200"
                >
                  <X size={12} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={uploadingImg}
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-20 border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center gap-1.5 text-slate-400 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50/30 transition-all disabled:opacity-50"
              >
                {uploadingImg
                  ? <><span className="text-[10px]">Enviando...</span></>
                  : <><Upload size={16} strokeWidth={1.5} /><span className="text-[10px] font-bold">Clique para adicionar imagem</span></>}
              </button>
            )}
            {imgToast && (
              <p className="mt-1.5 text-[10px] font-bold text-amber-600 flex items-center gap-1">
                <AlertTriangle size={10} />
                {imgToast}
              </p>
            )}
          </div>

          {/* Ativo */}
          <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 h-10">
            <span className="text-[11px] font-bold text-slate-600">Serviço Ativo</span>
            <button
              type="button"
              onClick={() => setForm({ ...form, is_active: !form.is_active })}
              className="transition-colors"
            >
              {form.is_active
                ? <ToggleRight size={22} className="text-emerald-500" />
                : <ToggleLeft size={22} className="text-slate-400" />}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Modal Deletar ── */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Excluir Serviço"
        subtitle="Esta ação não pode ser desfeita"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button variant="danger" loading={deleting} icon={<Trash2 size={13} />} onClick={handleDelete}>
              Excluir
            </Button>
          </>
        }
      >
        <div className="flex gap-3 items-start">
          <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center text-red-500 shrink-0">
            <AlertTriangle size={18} />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">
              Excluir <span className="text-red-600">"{deleteTarget?.name}"</span>?
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Este serviço será removido permanentemente do sistema e não poderá mais ser usado no PDV.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
}
