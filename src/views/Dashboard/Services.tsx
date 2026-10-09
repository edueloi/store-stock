import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import {
  Wrench,
  Plus,
  Edit2,
  Trash2,
  Save,
  ToggleLeft,
  ToggleRight,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Search,
  X,
  LayoutGrid,
  List,
  Clock,
  Scissors,
  LayoutPanelTop,
  Hammer,
  Ruler,
  Package,
  Tag,
  Upload,
  HelpCircle,
  Settings,
  FolderOpen,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import {
  Button,
  IconButton,
  Input,
  Textarea,
  Modal,
  ModalFooter,
  ConfirmModal,
  Switch,
  PageWrapper,
  SectionTitle,
  StatGrid,
  StatCard,
  FilterLine,
  FilterLineSection,
  FilterLineItem,
  FilterLineSearch,
  FilterLineSegmented,
  FilterLineViewToggle,
} from "../../components/ui";
import { EmptyState, LoadingState } from "../../components/layout/EmptyState";
import Combobox from "../../components/ui/Combobox";
import { onRealtime } from "../../lib/realtime";
import ServicesPageTour, {
  SERVICES_PAGE_TOUR_EVENTS,
  type ServicesPageTourHandle,
} from "../../components/onboarding/ServicesPageTour";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ServiceCategory {
  id: number;
  name: string;
  icon?: string | null;
  color?: string | null;
  _count?: { services: number };
}

interface Service {
  id: number;
  name: string;
  description?: string;
  price: number;
  unit: string;
  category_id: number | null;
  category_ref?: {
    id: number;
    name: string;
    icon: string | null;
    color: string | null;
  } | null;
  is_active: boolean;
  image_url?: string | null;
  sale_unit: "unidade" | "m2" | "linear";
  price_per_measure: number | null;
  min_billable_quantity: number | null;
  created_at: string;
}

export const SALE_UNIT_OPTIONS = [
  { value: "unidade", label: "Preço fixo" },
  { value: "m2", label: "Por m² (área)" },
  { value: "linear", label: "Por metro linear" },
] as const;

// ─── Constants ────────────────────────────────────────────────────────────────

// Ícones disponíveis para categoria de serviço — mesmas chaves usadas em
// scripts/migrate-service-categories.ts (KNOWN_CATEGORY_META), pra que
// categorias herdadas da migração antiga (string -> FK) já apareçam com o
// ícone certo aqui.
export const SERVICE_ICON_OPTIONS = [
  { value: "wrench", label: "Geral", Icon: Wrench },
  { value: "package", label: "Outros", Icon: Package },
  { value: "layout-panel-top", label: "Vidros", Icon: LayoutPanelTop },
  { value: "tag", label: "Sinalização", Icon: Tag },
  { value: "scissors", label: "Corte", Icon: Scissors },
  { value: "hammer", label: "Instalação", Icon: Hammer },
] as const;

export const SERVICE_ICON_MAP: Record<
  string,
  React.ComponentType<{ size?: number; className?: string }>
> = {
  wrench: Wrench,
  package: Package,
  "layout-panel-top": LayoutPanelTop,
  tag: Tag,
  scissors: Scissors,
  hammer: Hammer,
};

export const SERVICE_CATEGORY_COLORS = [
  "#2563eb",
  "#059669",
  "#ea580c",
  "#9333ea",
  "#dc2626",
  "#0891b2",
  "#ca8a04",
];

export const UNCATEGORIZED_SERVICE_CATEGORY = {
  id: 0,
  name: "Sem categoria",
  icon: "package",
  color: "#64748b",
};
const UNCATEGORIZED: ServiceCategory = UNCATEGORIZED_SERVICE_CATEGORY;

export function getCategoryIcon(iconKey?: string | null) {
  return SERVICE_ICON_MAP[iconKey ?? ""] ?? Wrench;
}

// Unidades de preço fixo. Serviço por medida (m²/linear) usa saleUnit à parte
// (mesmo mecanismo de Product) — ver SALE_UNIT_OPTIONS mais abaixo.
export const SERVICE_UNITS = [
  { value: "unidade", label: "Unidade", abbr: "un" },
  { value: "kg", label: "Quilograma", abbr: "kg" },
  { value: "g", label: "Grama", abbr: "g" },
  { value: "litro", label: "Litro", abbr: "L" },
  { value: "ml", label: "Mililitro", abbr: "mL" },
  { value: "metro", label: "Metro", abbr: "m" },
  { value: "cm", label: "Centímetro", abbr: "cm" },
  { value: "hora", label: "Hora", abbr: "h" },
  { value: "folha", label: "Folha", abbr: "fl" },
  { value: "cópia", label: "Cópia", abbr: "cp" },
] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const EMPTY_FORM = () => ({
  name: "",
  description: "",
  price: "",
  unit: "unidade",
  category_id: null as number | null,
  is_active: true,
  image_url: "",
  sale_unit: "unidade" as "unidade" | "m2" | "linear",
  price_per_measure: "",
  min_billable_quantity: "",
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
  return num.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function parseMaskedPrice(masked: string) {
  return parseFloat(masked.replace(/\./g, "").replace(",", ".")) || 0;
}

function getUnitAbbr(value: string) {
  return SERVICE_UNITS.find((u) => u.value === value)?.abbr ?? value;
}

// Preço de exibição: serviço por medida mostra o valor por m²/m linear
// (price_per_measure), não o "price" vitrine que é sempre 0 nesse caso.
function displayPrice(svc: Service): { value: string; suffix: string } {
  if (svc.sale_unit === "m2")
    return { value: fmt(Number(svc.price_per_measure ?? 0)), suffix: "/m²" };
  if (svc.sale_unit === "linear")
    return {
      value: fmt(Number(svc.price_per_measure ?? 0)),
      suffix: "/m linear",
    };
  return {
    value: fmt(Number(svc.price)),
    suffix: `/${getUnitAbbr(svc.unit ?? "unidade")}`,
  };
}

type ViewMode = "grid" | "list";

// ─── Component ────────────────────────────────────────────────────────────────

export default function Services() {
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [filterActive, setFilterActive] = useState<
    "all" | "active" | "inactive"
  >("all");
  const [filterCategory, setFilterCategory] = useState<number | "all">("all");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [form, setForm] = useState(EMPTY_FORM());
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Service | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [imagePreview, setImagePreview] = useState<string>("");
  const [uploadingImg, setUploadingImg] = useState(false);
  const [imgToast, setImgToast] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Gerenciar categorias (modal integrado, sem sair da tela de Serviços) ──
  const [showManageCategories, setShowManageCategories] = useState(false);
  const [catEditing, setCatEditing] = useState<ServiceCategory | null>(null);
  const [catForm, setCatForm] = useState({
    name: "",
    icon: "wrench",
    color: "#2563eb",
  });
  const [savingCategory, setSavingCategory] = useState(false);
  const [catDeleteTarget, setCatDeleteTarget] =
    useState<ServiceCategory | null>(null);

  const servicesPageTourRef = useRef<ServicesPageTourHandle>(null);

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

  const fetchCategories = useCallback(async () => {
    const r = await fetch("/api/services/categories", { headers: authH() });
    const d = await r.json();
    setCategories(Array.isArray(d) ? d : []);
  }, []);

  useEffect(() => {
    fetchServices();
    fetchCategories();
  }, [fetchServices, fetchCategories]);
  useEffect(
    () =>
      onRealtime("service-category:changed", () => {
        fetchCategories();
      }),
    [fetchCategories],
  );

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY_FORM());
    setImagePreview("");
    setImgToast("");
    setIsModalOpen(true);
  };

  const openEdit = (s: Service) => {
    setEditing(s);
    const masked = Number(s.price).toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    const measureMasked =
      s.price_per_measure != null
        ? Number(s.price_per_measure).toLocaleString("pt-BR", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })
        : "";
    setForm({
      name: s.name,
      description: s.description ?? "",
      price: masked,
      unit: s.unit ?? "unidade",
      category_id: s.category_id ?? null,
      is_active: s.is_active,
      image_url: s.image_url ?? "",
      sale_unit: s.sale_unit ?? "unidade",
      price_per_measure: measureMasked,
      min_billable_quantity:
        s.min_billable_quantity != null ? String(s.min_billable_quantity) : "",
    });
    setImagePreview(s.image_url ?? "");
    setImgToast("");
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditing(null);
    setImagePreview("");
    setImgToast("");
  };

  // ── Canal de comunicação do TOUR DE PÁGINA (ServicesPageTour) ─────────────
  // Abre o modal "Novo Serviço" de verdade via openNew (ou openEdit com o
  // primeiro serviço da lista, se houver) e preenche campos de exemplo via
  // setForm — nunca simula o submit do form (handleSave faz POST/PUT real),
  // nunca abre o modal de exclusão (deleteTarget → handleDelete, DELETE
  // real), nunca chama handleToggle (PUT real fora do modal) nem
  // handleImageFile (POST real de upload). Fechar sempre via closeModal
  // (equivalente a clicar fora ou no X, que já fazem isso na tela real).
  useEffect(() => {
    const onOpenNewService = () => openNew();
    const onFillService = (e: Event) => {
      const detail = (e as CustomEvent<Partial<typeof form>>).detail;
      if (detail) setForm((prev) => ({ ...prev, ...detail }));
    };
    const onCloseServiceModal = () => closeModal();
    const onOpenEditService = () => {
      const list = Array.isArray(services) ? services : [];
      if (list.length > 0) openEdit(list[0]);
    };

    window.addEventListener(
      SERVICES_PAGE_TOUR_EVENTS.openNewService,
      onOpenNewService,
    );
    window.addEventListener(
      SERVICES_PAGE_TOUR_EVENTS.fillService,
      onFillService,
    );
    window.addEventListener(
      SERVICES_PAGE_TOUR_EVENTS.closeServiceModal,
      onCloseServiceModal,
    );
    window.addEventListener(
      SERVICES_PAGE_TOUR_EVENTS.openEditService,
      onOpenEditService,
    );
    return () => {
      window.removeEventListener(
        SERVICES_PAGE_TOUR_EVENTS.openNewService,
        onOpenNewService,
      );
      window.removeEventListener(
        SERVICES_PAGE_TOUR_EVENTS.fillService,
        onFillService,
      );
      window.removeEventListener(
        SERVICES_PAGE_TOUR_EVENTS.closeServiceModal,
        onCloseServiceModal,
      );
      window.removeEventListener(
        SERVICES_PAGE_TOUR_EVENTS.openEditService,
        onOpenEditService,
      );
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [services]);

  const handleImageFile = async (file: File) => {
    if (!["image/jpeg", "image/png"].includes(file.type)) {
      setImgToast("Apenas arquivos JPG e PNG são suportados.");
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      setImgToast(
        `Imagem muito grande (${(file.size / 1024 / 1024).toFixed(1)} MB). Limite: 2 MB.`,
      );
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

  const isMeasuredForm = form.sale_unit !== "unidade";

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    if (isMeasuredForm ? !form.price_per_measure : !form.price) return;
    setSaving(true);
    try {
      const url = editing ? `/api/services/${editing.id}` : "/api/services";
      const method = editing ? "PUT" : "POST";
      await fetch(url, {
        method,
        headers: authH(),
        body: JSON.stringify({
          ...form,
          price: parseMaskedPrice(form.price),
          price_per_measure: form.price_per_measure
            ? parseMaskedPrice(form.price_per_measure)
            : null,
          min_billable_quantity: form.min_billable_quantity
            ? Number(form.min_billable_quantity)
            : null,
          image_url: form.image_url || null,
        }),
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
      await fetch(`/api/services/${deleteTarget.id}`, {
        method: "DELETE",
        headers: authH(),
      });
      setDeleteTarget(null);
      fetchServices();
    } finally {
      setDeleting(false);
    }
  };

  const handleToggle = async (s: Service) => {
    await fetch(`/api/services/${s.id}`, {
      method: "PUT",
      headers: authH(),
      body: JSON.stringify({
        name: s.name,
        description: s.description,
        price: Number(s.price),
        unit: s.unit,
        category_id: s.category_id,
        is_active: !s.is_active,
        sale_unit: s.sale_unit,
        price_per_measure: s.price_per_measure,
        min_billable_quantity: s.min_billable_quantity,
      }),
    });
    fetchServices();
  };

  // Metadados de exibição (ícone/cor) de uma categoria, com fallback pra
  // "Sem categoria" quando o serviço não tem category_id (ou a categoria foi excluída).
  const getCategoryMeta = useCallback(
    (categoryId: number | null): ServiceCategory => {
      if (!categoryId) return UNCATEGORIZED;
      return categories.find((c) => c.id === categoryId) ?? UNCATEGORIZED;
    },
    [categories],
  );

  // derived categories present in data (para os pills de filtro)
  const presentCategoryIds = useMemo(() => {
    const ids = [
      ...new Set(
        services.map((s) => s.category_id).filter((id): id is number => !!id),
      ),
    ];
    return ids.sort((a, b) =>
      getCategoryMeta(a).name.localeCompare(getCategoryMeta(b).name),
    );
  }, [services, getCategoryMeta]);

  const filtered = useMemo(
    () =>
      services.filter((s) => {
        const catName = getCategoryMeta(s.category_id).name;
        const matchSearch =
          !search ||
          s.name.toLowerCase().includes(search.toLowerCase()) ||
          (s.description ?? "").toLowerCase().includes(search.toLowerCase()) ||
          catName.toLowerCase().includes(search.toLowerCase());
        const matchStatus =
          filterActive === "all"
            ? true
            : filterActive === "active"
              ? s.is_active
              : !s.is_active;
        const matchCat =
          filterCategory === "all" || s.category_id === filterCategory;
        return matchSearch && matchStatus && matchCat;
      }),
    [services, search, filterActive, filterCategory, getCategoryMeta],
  );

  const activeCount = services.filter((s) => s.is_active).length;
  const inactiveCount = services.filter((s) => !s.is_active).length;

  // group filtered by category for grid
  const grouped = useMemo(() => {
    const map = new Map<number, Service[]>();
    filtered.forEach((s) => {
      const key = s.category_id ?? 0;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    });
    return map;
  }, [filtered]);

  // Opções de categoria pro combobox do formulário de serviço (categorias reais do backend)
  const allCategoryOptions = useMemo(() => {
    return categories.map((c) => {
      const Icon = getCategoryIcon(c.icon);
      return { value: String(c.id), label: c.name, icon: <Icon size={12} /> };
    });
  }, [categories]);

  const unitOptions = SERVICE_UNITS.map((u) => ({
    value: u.value,
    label: `${u.label} (${u.abbr})`,
    description: u.abbr,
  }));

  // ── CRUD de categoria de serviço (modal "Gerenciar categorias") ──────────
  const openNewCategory = () => {
    setCatEditing(null);
    setCatForm({ name: "", icon: "wrench", color: "#2563eb" });
  };
  const openEditCategory = (c: ServiceCategory) => {
    setCatEditing(c);
    setCatForm({
      name: c.name,
      icon: c.icon || "wrench",
      color: c.color || "#2563eb",
    });
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catForm.name.trim()) return;
    setSavingCategory(true);
    try {
      const url = catEditing
        ? `/api/services/categories/${catEditing.id}`
        : "/api/services/categories";
      const method = catEditing ? "PUT" : "POST";
      await fetch(url, {
        method,
        headers: authH(),
        body: JSON.stringify(catForm),
      });
      openNewCategory();
      fetchCategories();
    } finally {
      setSavingCategory(false);
    }
  };

  const handleDeleteCategory = async () => {
    if (!catDeleteTarget) return;
    await fetch(`/api/services/categories/${catDeleteTarget.id}`, {
      method: "DELETE",
      headers: authH(),
    });
    setCatDeleteTarget(null);
    fetchCategories();
    fetchServices();
  };

  return (
    <PageWrapper data-tour="services-page">
    <div className="space-y-4">
      <SectionTitle
        icon={Wrench}
        title="Serviços"
        description="Gerencie os serviços oferecidos — impressão, cartão de visita, xerox e mais"
        action={
          <>
            <Button
              size="sm"
              data-tour="services-new-btn"
              iconLeft={<Plus size={14} />}
              onClick={openNew}
            >
              Novo Serviço
            </Button>
            <Button
              size="sm"
              variant="outline"
              iconLeft={<FolderOpen size={14} />}
              onClick={() => {
                openNewCategory();
                setShowManageCategories(true);
              }}
              title="Gerenciar categorias de serviço"
            >
              <span className="sr-only sm:not-sr-only">Categorias</span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              iconLeft={<HelpCircle size={14} />}
              onClick={() => servicesPageTourRef.current?.start()}
              title="Tour guiado desta página"
            >
              <span className="sr-only sm:not-sr-only">Ajuda</span>
            </Button>
          </>
        }
      />

      <ServicesPageTour ref={servicesPageTourRef} />

      {/* Stats */}
      <StatGrid cols={3}>
        <StatCard title="Total" value={services.length} icon={Wrench} color="info" />
        <StatCard title="Ativos" value={activeCount} icon={CheckCircle} color="success" />
        <StatCard title="Inativos" value={inactiveCount} icon={XCircle} color="default" />
      </StatGrid>

      {/* Toolbar */}
      <FilterLine>
        <FilterLineSection grow>
          <FilterLineItem grow minWidth={220}>
            <FilterLineSearch
              aria-label="Buscar serviços"
              value={search}
              onChange={setSearch}
              placeholder="Buscar por nome, descrição ou categoria..."
            />
          </FilterLineItem>

          {/* Status filter */}
          <FilterLineSegmented<"all" | "active" | "inactive">
            value={filterActive}
            onChange={setFilterActive}
            options={[
              { value: "all", label: "Todos" },
              { value: "active", label: "Ativos" },
              { value: "inactive", label: "Inativos" },
            ]}
          />

          {/* Category filter */}
          {presentCategoryIds.length > 1 && (
            <FilterLineSegmented<number | "all">
              value={filterCategory}
              onChange={setFilterCategory}
              options={[
                { value: "all", label: "Todas" },
                ...presentCategoryIds.map((catId) => {
                  const meta = getCategoryMeta(catId);
                  const Icon = getCategoryIcon(meta.icon);
                  return { value: catId, label: meta.name, icon: <Icon size={12} /> };
                }),
              ]}
            />
          )}
        </FilterLineSection>

        {/* View toggle */}
        <FilterLineSection align="right">
          <FilterLineViewToggle<ViewMode> value={viewMode} onChange={setViewMode} gridValue="grid" listValue="list" />
        </FilterLineSection>
      </FilterLine>

      {/* Content */}
      {loading ? (
        <LoadingState rows={4} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Wrench size={32} strokeWidth={1} />}
          title={
            search || filterActive !== "all" || filterCategory !== "all"
              ? "Nenhum serviço encontrado"
              : "Nenhum serviço cadastrado"
          }
          description="Cadastre serviços como impressão, cartão de visita, xerox e mais para usar no PDV."
          action={
            !search &&
            filterActive === "all" &&
            filterCategory === "all" && (
              <Button icon={<Plus size={14} />} onClick={openNew}>
                Cadastrar Serviço
              </Button>
            )
          }
        />
      ) : viewMode === "list" ? (
        /* ── LIST VIEW ── */
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
          <div className="hidden sm:grid grid-cols-[1fr_1.5fr_auto_auto_auto] gap-4 px-5 py-2.5 bg-slate-50 border-b border-slate-200">
            <span className="text-[10px] font-semibold text-slate-400">
              Serviço
            </span>
            <span className="text-[10px] font-semibold text-slate-400">
              Descrição
            </span>
            <span className="text-[10px] font-semibold text-slate-400">
              Unidade
            </span>
            <span className="text-[10px] font-semibold text-slate-400">
              Preço
            </span>
            <span />
          </div>
          <div className="divide-y divide-slate-50">
            {filtered.map((svc) => {
              const meta = getCategoryMeta(svc.category_id);
              const Icon = getCategoryIcon(meta.icon);
              const color = meta.color || "#64748b";
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
                      <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0 border border-slate-100">
                        <img
                          src={svc.image_url}
                          alt={svc.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                        style={
                          svc.is_active
                            ? { background: `${color}1a`, color }
                            : undefined
                        }
                      >
                        <Icon
                          size={15}
                          className={
                            !svc.is_active ? "text-slate-400" : undefined
                          }
                        />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-[12px] font-semibold text-slate-900 truncate">
                        {svc.name}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <span
                          className={`text-[10px] font-semibold   px-1.5 py-0.5 rounded-full ${svc.is_active ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400"}`}
                        >
                          {svc.is_active ? "Ativo" : "Inativo"}
                        </span>
                        <span
                          className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                          style={{ background: `${color}1a`, color }}
                        >
                          {meta.name}
                        </span>
                        <span className="flex items-center gap-0.5 text-[10px] text-slate-400">
                          <Clock size={8} />
                          {new Date(svc.created_at).toLocaleDateString("pt-BR")}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Descrição */}
                  <p className="hidden sm:block text-[11px] text-slate-500 truncate">
                    {svc.description || (
                      <span className="text-slate-300 italic">
                        Sem descrição
                      </span>
                    )}
                  </p>

                  {/* Unidade */}
                  <span className="hidden sm:flex items-center gap-1 text-[11px] font-semibold text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 shrink-0">
                    <Ruler size={9} className="text-slate-400" />
                    {getUnitAbbr(svc.unit ?? "unidade")}
                  </span>

                  {/* Preço */}
                  <div className="text-right shrink-0">
                    <p className="text-[14px] font-mono font-semibold text-blue-600">
                      {displayPrice(svc).value}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {displayPrice(svc).suffix}
                    </p>
                  </div>

                  {/* Ações */}
                  <div className="flex items-center gap-1 shrink-0">
                    <IconButton
                      size="sm"
                      onClick={() => handleToggle(svc)}
                      title={svc.is_active ? "Desativar" : "Ativar"}
                      aria-label={svc.is_active ? "Desativar serviço" : "Ativar serviço"}
                    >
                      {svc.is_active ? (
                        <ToggleRight size={18} className="text-emerald-500" />
                      ) : (
                        <ToggleLeft size={18} />
                      )}
                    </IconButton>
                    <IconButton
                      size="sm"
                      onClick={() => openEdit(svc)}
                      title="Editar"
                      aria-label="Editar serviço"
                    >
                      <Edit2 size={14} />
                    </IconButton>
                    <IconButton
                      size="sm"
                      variant="danger"
                      onClick={() => setDeleteTarget(svc)}
                      title="Excluir"
                      aria-label="Excluir serviço"
                    >
                      <Trash2 size={14} />
                    </IconButton>
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
            {[...grouped.entries()].map(([catId, items]) => {
              const meta = getCategoryMeta(catId || null);
              const CatIcon = getCategoryIcon(meta.icon);
              const color = meta.color || "#64748b";
              return (
                <motion.div
                  key={catId}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                >
                  {/* Category header */}
                  <div className="flex items-center gap-2 mb-3">
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center"
                      style={{ background: `${color}1a`, color }}
                    >
                      <CatIcon size={13} />
                    </div>
                    <span className="text-[11px] font-semibold text-slate-600">
                      {meta.name}
                    </span>
                    <span className="text-[10px] text-slate-400 font-semibold">
                      {items.length} serviço{items.length !== 1 ? "s" : ""}
                    </span>
                    <div className="flex-1 h-px bg-slate-100" />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {items.map((svc) => {
                      const m = getCategoryMeta(svc.category_id);
                      const Ic = getCategoryIcon(m.icon);
                      const c = m.color || "#64748b";
                      return (
                        <motion.div
                          key={svc.id}
                          layout
                          className={`bg-white border border-slate-200 rounded-lg p-4 shadow-sm hover:shadow-sm transition-all flex flex-col gap-3 ${!svc.is_active ? "opacity-50" : ""}`}
                        >
                          {/* Header row */}
                          <div className="flex items-start justify-between gap-2">
                            {svc.image_url ? (
                              <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 border border-slate-100">
                                <img
                                  src={svc.image_url}
                                  alt={svc.name}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            ) : (
                              <div
                                className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                                style={
                                  svc.is_active
                                    ? { background: `${c}1a`, color: c }
                                    : undefined
                                }
                              >
                                <Ic
                                  size={16}
                                  className={
                                    !svc.is_active
                                      ? "text-slate-400"
                                      : undefined
                                  }
                                />
                              </div>
                            )}
                            <div className="flex flex-col items-end gap-1">
                              <span
                                className={`text-[10px] font-semibold   px-2 py-0.5 rounded-full ${svc.is_active ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400"}`}
                              >
                                {svc.is_active ? "Ativo" : "Inativo"}
                              </span>
                              <span
                                className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                                style={{ background: `${c}1a`, color: c }}
                              >
                                {m.name}
                              </span>
                            </div>
                          </div>

                          {/* Name + description */}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-slate-900 leading-tight">
                              {svc.name}
                            </p>
                            {svc.description && (
                              <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                                {svc.description}
                              </p>
                            )}
                          </div>

                          {/* Price + unit */}
                          <div className="flex items-end justify-between">
                            <div>
                              <p className="text-[18px] font-mono font-semibold text-blue-600 leading-none">
                                {displayPrice(svc).value}
                              </p>
                              <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                                <Ruler size={8} />
                                {displayPrice(svc).suffix}
                              </p>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex gap-1.5 pt-2 border-t border-slate-100">
                            <Button
                              size="xs"
                              variant="outline"
                              className="flex-1"
                              onClick={() => handleToggle(svc)}
                              iconLeft={
                                svc.is_active ? (
                                  <ToggleRight size={14} />
                                ) : (
                                  <ToggleLeft size={14} />
                                )
                              }
                            >
                              {svc.is_active ? "Ativo" : "Inativo"}
                            </Button>
                            <IconButton
                              size="xs"
                              variant="outline"
                              onClick={() => openEdit(svc)}
                              title="Editar"
                              aria-label="Editar serviço"
                            >
                              <Edit2 size={14} />
                            </IconButton>
                            <IconButton
                              size="xs"
                              variant="danger"
                              onClick={() => setDeleteTarget(svc)}
                              title="Excluir"
                              aria-label="Excluir serviço"
                            >
                              <Trash2 size={14} />
                            </IconButton>
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
            className="w-full bg-white border-2 border-dashed border-slate-200 rounded-lg p-4 hover:border-blue-400 hover:bg-blue-50/30 transition-all flex items-center justify-center gap-2 text-slate-400 hover:text-blue-600 h-16"
          >
            <Plus size={18} strokeWidth={1.5} />
            <span className="text-[11px] font-semibold">
              Novo Serviço
            </span>
          </motion.button>
        </div>
      )}

      {/* ── Modal Criar / Editar ── */}
      <Modal
        open={isModalOpen}
        onClose={closeModal}
        title={editing ? "Editar Serviço" : "Novo Serviço"}
        subtitle={editing ? editing.name : "Preencha os dados do serviço"}
        size="xl"
        footer={
          <ModalFooter>
            <Button variant="ghost" size="sm" onClick={closeModal}>
              Cancelar
            </Button>
            <Button
              size="sm"
              form="service-form"
              type="submit"
              loading={saving}
              iconLeft={<Save size={14} />}
            >
              {editing ? "Salvar" : "Cadastrar"}
            </Button>
          </ModalFooter>
        }
      >
        <form id="service-form" onSubmit={handleSave} className="space-y-4">
          {/* Identificação: imagem + nome/categoria lado a lado */}
          <div className="grid gap-4 lg:grid-cols-[150px_minmax(0,1fr)] lg:items-start">
            <input
              ref={fileInputRef}
              type="file"
              aria-label="Imagem do serviço"
              accept="image/jpeg,image/png"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleImageFile(f);
                e.target.value = "";
              }}
            />
            {imagePreview ? (
              <div
                data-tour="service-form-image"
                className="relative h-32 w-full max-w-[150px] overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
              >
                <img
                  src={imagePreview}
                  alt="preview"
                  className="w-full h-full object-cover"
                />
                <IconButton
                  size="xs"
                  variant="outline"
                  aria-label="Remover imagem"
                  title="Remover imagem"
                  onClick={() => {
                    setImagePreview("");
                    setForm((f) => ({ ...f, image_url: "" }));
                  }}
                  className="absolute top-1 right-1 !h-6 !w-6"
                >
                  <X size={12} />
                </IconButton>
              </div>
            ) : (
              <button
                data-tour="service-form-image"
                type="button"
                disabled={uploadingImg}
                onClick={() => fileInputRef.current?.click()}
                title="JPG ou PNG, máx. 2 MB"
                className="h-32 w-full max-w-[150px] border-2 border-dashed border-slate-200 rounded-lg flex flex-col items-center justify-center gap-2 text-slate-300 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50/30 transition-all disabled:opacity-50"
              >
                {uploadingImg ? (
                  <span className="text-[11px] font-medium">Enviando</span>
                ) : (
                  <Upload size={16} strokeWidth={1.5} />
                )}
              </button>
            )}

            <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                data-tour="service-form-name"
                wrapperClassName="sm:col-span-2"
                label="Nome do Serviço *"
                required
                autoFocus
                placeholder="Ex: Corte de vidro temperado, Instalação de placa..."
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
              <div className="flex gap-2 items-end sm:col-span-2">
                <div className="flex-1 min-w-0">
                  <Combobox
                    label="Categoria"
                    placeholder="Selecionar..."
                    searchPlaceholder="Buscar categoria..."
                    clearable
                    options={allCategoryOptions}
                    value={
                      form.category_id != null ? String(form.category_id) : ""
                    }
                    onChange={(v) =>
                      setForm({ ...form, category_id: v ? Number(v) : null })
                    }
                  />
                </div>
                <IconButton
                  variant="outline"
                  title="Nova categoria"
                  aria-label="Nova categoria"
                  onClick={() => {
                    openNewCategory();
                    setShowManageCategories(true);
                  }}
                >
                  <Plus size={16} />
                </IconButton>
              </div>
            </div>
          </div>
          {imgToast && (
            <p className="-mt-2 text-[11px] font-medium text-amber-600 flex items-center gap-1">
              <AlertTriangle size={10} />
              {imgToast}
            </p>
          )}

          {/* Precificação */}
          <div
            data-tour="service-form-pricing"
            className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-3"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-medium text-slate-600">
                  Como este serviço é cobrado
                </p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Defina o valor fixo ou a cobrança por medida.
                </p>
              </div>
              <FilterLineSegmented<"unidade" | "m2" | "linear">
                size="sm"
                value={form.sale_unit}
                onChange={(v) => setForm((f) => ({ ...f, sale_unit: v }))}
                options={SALE_UNIT_OPTIONS.map((opt) => ({
                  value: opt.value,
                  label: opt.label,
                }))}
              />
            </div>

            {!isMeasuredForm ? (
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Preço *"
                  required
                  inputMode="numeric"
                  placeholder="0,00"
                  addonLeft="R$"
                  className="font-mono"
                  value={form.price}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      price: applyMoneyMask(e.target.value),
                    })
                  }
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
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label={`Preço / ${form.sale_unit === "m2" ? "m²" : "metro linear"} *`}
                  required
                  inputMode="numeric"
                  placeholder="0,00"
                  addonLeft="R$"
                  className="font-mono"
                  value={form.price_per_measure}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      price_per_measure: applyMoneyMask(e.target.value),
                    })
                  }
                />
                <Input
                  label={`Mínimo faturável (${form.sale_unit === "m2" ? "m²" : "m"})`}
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Opcional"
                  className="font-mono"
                  value={form.min_billable_quantity}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      min_billable_quantity: e.target.value,
                    })
                  }
                />
              </div>
            )}

            {!isMeasuredForm && parseMaskedPrice(form.price) > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-medium text-slate-500">
                  Exemplos:
                </span>
                {[2, 5, 10, 50].map((qty) => (
                  <span
                    key={qty}
                    className="text-[11px] font-mono font-medium text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded-md"
                  >
                    {qty}× = {fmt(parseMaskedPrice(form.price) * qty)}
                  </span>
                ))}
              </div>
            )}
            {isMeasuredForm && parseMaskedPrice(form.price_per_measure) > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-medium text-slate-500">
                  Simulação:
                </span>
                {form.sale_unit === "linear" ? (
                  [0.5, 1, 2].map((meters) => (
                    <span
                      key={meters}
                      className="text-[11px] font-mono font-medium text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded-md"
                    >
                      {meters === 0.5 ? "50 cm" : `${meters} m`} ={" "}
                      {fmt(parseMaskedPrice(form.price_per_measure) * meters)}
                    </span>
                  ))
                ) : (
                  <span className="text-[11px] font-mono font-medium text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded-md">
                    1,20 m × 2,00 m ={" "}
                    {fmt(parseMaskedPrice(form.price_per_measure) * 2.4)}
                  </span>
                )}
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

          {/* Ativo */}
          <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-3 h-10">
            <span className="text-xs font-medium text-slate-600">
              Serviço Ativo
            </span>
            <Switch
              checked={form.is_active}
              aria-label="Serviço ativo"
              onCheckedChange={(checked) =>
                setForm({ ...form, is_active: checked })
              }
            />
          </div>
        </form>
      </Modal>

      {/* ── Modal Deletar ── */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Excluir Serviço"
        confirmLabel="Excluir"
        loading={deleting}
        message={
          <>
            <p className="font-medium text-slate-800">
              Excluir{" "}
              <span className="text-red-600">"{deleteTarget?.name}"</span>?
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Esta ação não pode ser desfeita. Este serviço será removido
              permanentemente do sistema e não poderá mais ser usado no PDV.
            </p>
          </>
        }
      />

      {/* ── Modal Gerenciar Categorias (integrado à tela de Serviços) ── */}
      <Modal
        open={showManageCategories}
        onClose={() => {
          setShowManageCategories(false);
          setCatDeleteTarget(null);
        }}
        title="Gerenciar Categorias"
        subtitle="Categorias de serviço desta loja"
        size="md"
      >
        <div className="space-y-4">
          {/* Mini-formulário de criar/editar */}
          <form
            onSubmit={handleSaveCategory}
            className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-3"
          >
            <p className="text-[11px] font-medium text-slate-500">
              {catEditing ? `Editando "${catEditing.name}"` : "Nova categoria"}
            </p>
            <div className="flex gap-2 items-start">
              <Input
                wrapperClassName="flex-1"
                aria-label="Nome da categoria"
                autoFocus
                value={catForm.name}
                onChange={(e) =>
                  setCatForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="Nome da categoria (ex: Vidros, Instalação...)"
              />
              {catEditing && (
                <IconButton
                  variant="outline"
                  onClick={openNewCategory}
                  title="Cancelar edição"
                  aria-label="Cancelar edição"
                >
                  <X size={14} />
                </IconButton>
              )}
            </div>

            <div>
              <p className="text-[11px] font-medium text-slate-500 mb-1.5">
                Ícone
              </p>
              <div className="grid grid-cols-6 gap-1.5">
                {SERVICE_ICON_OPTIONS.map(({ value, label, Icon }) => (
                  <button
                    type="button"
                    key={value}
                    aria-label={`Ícone ${label}`}
                    onClick={() => setCatForm((f) => ({ ...f, icon: value }))}
                    className={`h-9 rounded-lg border flex items-center justify-center transition-all ${
                      catForm.icon === value
                        ? "border-blue-500 bg-blue-50 text-blue-600"
                        : "border-slate-200 bg-white text-slate-500 hover:border-blue-200"
                    }`}
                  >
                    <Icon size={14} />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[11px] font-medium text-slate-500 mb-1.5">
                Cor
              </p>
              <div className="flex gap-1.5 items-center">
                {SERVICE_CATEGORY_COLORS.map((color) => (
                  <button
                    type="button"
                    key={color}
                    aria-label={`Usar a cor ${color}`}
                    onClick={() => setCatForm((f) => ({ ...f, color }))}
                    className={`w-7 h-7 rounded-full border-2 ${catForm.color === color ? "border-slate-900 scale-110" : "border-white"}`}
                    style={{ backgroundColor: color }}
                  />
                ))}
                <label className="w-7 h-7 rounded-full border border-slate-200 overflow-hidden cursor-pointer shrink-0">
                  <input
                    type="color"
                    aria-label="Escolher outra cor"
                    value={catForm.color}
                    onChange={(e) =>
                      setCatForm((f) => ({ ...f, color: e.target.value }))
                    }
                    className="w-9 h-9 -m-1 cursor-pointer"
                  />
                </label>
              </div>
            </div>

            <Button
              type="submit"
              size="sm"
              loading={savingCategory}
              iconLeft={<Save size={14} />}
              disabled={!catForm.name.trim()}
            >
              {catEditing ? "Salvar alterações" : "Criar categoria"}
            </Button>
          </form>

          {/* Lista de categorias existentes */}
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {categories.length === 0 ? (
              <p className="text-center text-xs text-slate-500 py-6">
                Nenhuma categoria criada ainda.
              </p>
            ) : (
              categories.map((c) => {
                const Icon = getCategoryIcon(c.icon);
                const color = c.color || "#2563eb";
                return (
                  <div
                    key={c.id}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg border border-slate-200 bg-white"
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: `${color}1a`, color }}
                    >
                      <Icon size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-800 truncate">
                        {c.name}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {c._count?.services ?? 0} serviço
                        {(c._count?.services ?? 0) !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <IconButton
                      size="sm"
                      onClick={() => openEditCategory(c)}
                      title="Editar categoria"
                      aria-label="Editar categoria"
                    >
                      <Edit2 size={14} />
                    </IconButton>
                    <IconButton
                      size="sm"
                      variant="danger"
                      onClick={() => setCatDeleteTarget(c)}
                      title="Excluir categoria"
                      aria-label="Excluir categoria"
                    >
                      <Trash2 size={14} />
                    </IconButton>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </Modal>

      {/* ── Modal Excluir Categoria ── */}
      <ConfirmModal
        isOpen={!!catDeleteTarget}
        onClose={() => setCatDeleteTarget(null)}
        onConfirm={handleDeleteCategory}
        title="Excluir Categoria"
        confirmLabel="Excluir"
        message={
          <>
            <p className="font-medium text-slate-800">
              Excluir{" "}
              <span className="text-red-600">"{catDeleteTarget?.name}"</span>?
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Esta ação não pode ser desfeita. Serviços vinculados a esta
              categoria ficarão sem categoria — eles não são excluídos.
            </p>
          </>
        }
      />
    </div>
    </PageWrapper>
  );
}