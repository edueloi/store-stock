import React, { useState, useEffect, useRef } from "react";
import { Tag, Plus, FolderOpen, Edit2, Trash2, Save, Shirt, Footprints, Lightbulb, Wrench, Smartphone, Package, ImageUp, PackagePlus, HelpCircle } from "lucide-react";
import { motion } from "motion/react";
import {
  Button, IconButton, Input, Modal, ModalFooter, ConfirmModal, PageWrapper, SectionTitle,
  StatGrid, StatCard, FilterLine, FilterLineSection, FilterLineSearch, EmptyState, Tabs,
} from "../../components/ui";
import { LoadingState } from "../../components/layout/EmptyState";
import { Category, Product } from "../../types";
import { onRealtime } from "../../lib/realtime";
import CategoriesPageTour, { CATEGORIES_PAGE_TOUR_EVENTS, type CategoriesPageTourHandle } from "../../components/onboarding/CategoriesPageTour";

const CATEGORY_ICONS = { package: Package, fashion: Shirt, footwear: Footprints, light: Lightbulb, tools: Wrench, tech: Smartphone };
const ICON_OPTIONS = [
  { value: "package", label: "Geral", Icon: Package },
  { value: "fashion", label: "Roupas", Icon: Shirt },
  { value: "footwear", label: "Calçados", Icon: Footprints },
  { value: "light", label: "Iluminação", Icon: Lightbulb },
  { value: "tools", label: "Ferramentas", Icon: Wrench },
  { value: "tech", label: "Tecnologia", Icon: Smartphone },
];
const CATEGORY_COLORS = ["#2563eb", "#059669", "#ea580c", "#9333ea", "#dc2626", "#0891b2", "#ca8a04"];

const MANAGE_TABS = [
  { id: "in", label: "Nesta categoria" },
  { id: "add", label: "Sem categoria" },
] as const;
type ManageTab = typeof MANAGE_TABS[number]["id"];

export default function Categories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Category> | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [managing, setManaging] = useState<Category | null>(null);
  const [selectedProductIds, setSelectedProductIds] = useState<Set<number>>(new Set());
  const [assigning, setAssigning] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [manageTab, setManageTab] = useState<ManageTab>("in");

  const categoriesPageTourRef = useRef<CategoriesPageTourHandle>(null);

  const headers = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  });

  const fetchCategories = async () => {
    const [catRes, productRes] = await Promise.all([
      fetch("/api/categories", { headers: headers() }),
      fetch("/api/products", { headers: headers() }),
    ]);
    const [catData, productData] = await Promise.all([catRes.json(), productRes.json()]);
    setCategories(Array.isArray(catData) ? catData : []);
    setProducts(Array.isArray(productData) ? productData : []);
    setLoading(false);
  };

  useEffect(() => { fetchCategories(); }, []);
  useEffect(() => onRealtime("category:changed", () => { fetchCategories(); }), []);

  const openNew = () => { setEditing({ name: "", icon: "package", color: "#2563eb", cover_url: "" }); setIsModalOpen(true); };
  const openEdit = (c: Category) => { setEditing(c); setIsModalOpen(true); };
  const closeModal = () => { setIsModalOpen(false); setEditing(null); };

  // ── Canal de comunicação do tour guiado (onboarding) ──────────────────────
  // Mesmo padrão usado em Inventory.tsx: o OnboardingTour abre/preenche/fecha
  // o modal "Nova Categoria" de verdade via CustomEvent no window, chamando só
  // openNew/setEditing/closeModal — nunca handleSave (POST/PUT real).
  useEffect(() => {
    const onOpenNewCategory = () => openNew();
    const onFillCategory = (e: Event) => {
      const detail = (e as CustomEvent<Partial<Category>>).detail;
      if (detail) setEditing((prev) => ({ ...(prev ?? {}), ...detail }));
    };
    const onCloseModal = () => closeModal();

    window.addEventListener("onboarding-tour:open-new-category", onOpenNewCategory);
    window.addEventListener("onboarding-tour:fill-category", onFillCategory);
    window.addEventListener("onboarding-tour:close-category-modal", onCloseModal);
    return () => {
      window.removeEventListener("onboarding-tour:open-new-category", onOpenNewCategory);
      window.removeEventListener("onboarding-tour:fill-category", onFillCategory);
      window.removeEventListener("onboarding-tour:close-category-modal", onCloseModal);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Canal de comunicação do TOUR DE PÁGINA (CategoriesPageTour) ────────────
  // Namespace separado (page-tour:categories:*) do tour geral acima — nomes
  // de evento distintos, nunca colidem. Mesmas garantias de segurança: só
  // abre/preenche/fecha via openNew/openEdit/setEditing/closeModal, nunca
  // chama handleSave, uploadCover, handleDelete ou assignSelectedProducts.
  useEffect(() => {
    const onOpenNewCategoryPage = () => openNew();
    const onFillCategoryPage = (e: Event) => {
      const detail = (e as CustomEvent<Partial<Category>>).detail;
      if (detail) setEditing((prev) => ({ ...(prev ?? {}), ...detail }));
    };
    const onCloseModalPage = () => closeModal();
    const onOpenEditCategoryPage = () => {
      // Edita a primeira categoria da lista, se houver — senão não abre nada
      // e o passo do tour é pulado (skipMissingElement cuida disso).
      if (categories.length > 0) openEdit(categories[0]);
    };

    window.addEventListener(CATEGORIES_PAGE_TOUR_EVENTS.openNewCategory, onOpenNewCategoryPage);
    window.addEventListener(CATEGORIES_PAGE_TOUR_EVENTS.fillCategory, onFillCategoryPage);
    window.addEventListener(CATEGORIES_PAGE_TOUR_EVENTS.closeCategoryModal, onCloseModalPage);
    window.addEventListener(CATEGORIES_PAGE_TOUR_EVENTS.openEditCategory, onOpenEditCategoryPage);
    return () => {
      window.removeEventListener(CATEGORIES_PAGE_TOUR_EVENTS.openNewCategory, onOpenNewCategoryPage);
      window.removeEventListener(CATEGORIES_PAGE_TOUR_EVENTS.fillCategory, onFillCategoryPage);
      window.removeEventListener(CATEGORIES_PAGE_TOUR_EVENTS.closeCategoryModal, onCloseModalPage);
      window.removeEventListener(CATEGORIES_PAGE_TOUR_EVENTS.openEditCategory, onOpenEditCategoryPage);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing?.name?.trim()) return;
    setSaving(true);
    try {
      if (editing.id) {
        await fetch(`/api/categories/${editing.id}`, { method: "PUT", headers: headers(), body: JSON.stringify(editing) });
      } else {
        await fetch("/api/categories", { method: "POST", headers: headers(), body: JSON.stringify(editing) });
      }
      closeModal();
      fetchCategories();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await fetch(`/api/categories/${deleteTarget.id}`, { method: "DELETE", headers: headers() });
      setDeleteTarget(null);
      fetchCategories();
    } finally {
      setDeleting(false);
    }
  };

  const filtered = categories.filter((c) =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const productsFor = (categoryId: number) => products.filter((p) => p.category_id === categoryId);
  const uncategorized = products.filter((p) => !p.category_id);

  const uploadCover = async (file: File) => {
    setUploadingCover(true);
    try {
      const form = new FormData();
      form.append("image", file);
      const res = await fetch("/api/upload/category-cover", { method: "POST", headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }, body: form });
      const data = await res.json();
      if (res.ok && data.url) setEditing((prev) => ({ ...prev!, cover_url: data.url }));
    } finally { setUploadingCover(false); }
  };

  const assignSelectedProducts = async () => {
    if (!managing || selectedProductIds.size === 0) return;
    setAssigning(true);
    try {
      await fetch(`/api/categories/${managing.id}/products`, { method: "PUT", headers: headers(), body: JSON.stringify({ product_ids: Array.from(selectedProductIds) }) });
      setSelectedProductIds(new Set());
      fetchCategories();
    } finally { setAssigning(false); }
  };

  return (
    <PageWrapper data-tour="categories-page">
    <div className="space-y-4">
      <SectionTitle
        title="Categorias"
        description="Organização do catálogo de produtos"
        icon={Tag}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button data-tour="categories-new-btn" size="sm" iconLeft={<Plus size={14} />} onClick={openNew}>
              Nova Categoria
            </Button>
            <Button
              variant="outline"
              size="sm"
              iconLeft={<HelpCircle size={14} />}
              onClick={() => categoriesPageTourRef.current?.start()}
              title="Tour guiado desta página"
            >
              <span className="sr-only sm:not-sr-only">Ajuda</span>
            </Button>
          </div>
        }
      />

      <CategoriesPageTour ref={categoriesPageTourRef} />

      <StatGrid cols={2}>
        <StatCard title="Total de Categorias" value={categories.length} icon={FolderOpen} color="info" />
        <StatCard title="Produtos Organizados" value={products.filter((p) => !!p.category_id).length} icon={Tag} color="default" />
      </StatGrid>

      {categories.length > 4 && (
        <FilterLine>
          <FilterLineSection grow>
            <FilterLineSearch aria-label="Filtrar categorias" value={searchTerm} onChange={setSearchTerm} placeholder="Filtrar categorias..." />
          </FilterLineSection>
        </FilterLine>
      )}

      {loading ? (
        <LoadingState rows={4} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Tag}
          title={searchTerm ? "Nenhuma categoria encontrada" : "Nenhuma categoria criada"}
          description="Crie categorias para organizar seu catálogo de produtos."
          action={!searchTerm && <Button size="sm" iconLeft={<Plus size={14} />} onClick={openNew}>Criar Categoria</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 lg:gap-4">
          {filtered.map((cat) => (
            <motion.div
              key={cat.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative overflow-hidden bg-white border border-slate-200 rounded-lg shadow-sm hover:shadow-sm hover:-translate-y-0.5 transition-all group flex flex-col"
            >
              {(() => { const Icon = CATEGORY_ICONS[cat.icon as keyof typeof CATEGORY_ICONS] || Package; const count = productsFor(cat.id); const color = cat.color || "#2563eb"; const coverUrl = cat.cover_url || "/category-covers/store-boxsys-default.png"; return <>
              <div className="h-24 relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${color}22, ${color}08)` }}>
                <img src={coverUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
                <div className="absolute inset-0" style={{ background: "linear-gradient(90deg, rgba(15,23,42,.58), rgba(15,23,42,.06))" }} />
                <div className="absolute left-4 bottom-3 w-10 h-10 rounded-lg bg-white/95 shadow-sm flex items-center justify-center" style={{ color }}><Icon size={19} /></div>
              </div>
              <div className="p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-sm font-semibold text-slate-900 leading-tight truncate">{cat.name}</p><p className="text-[11px] font-semibold mt-1" style={{ color }}>{count.length} {count.length === 1 ? "produto" : "produtos"}</p></div><Button size="xs" variant="outline" onClick={() => { setManaging(cat); setManageTab("in"); setSelectedProductIds(new Set()); }}>Ver itens</Button></div>
                <div className="min-h-8 flex flex-wrap gap-1">{count.slice(0, 3).map(p => <span key={p.id} className="max-w-full truncate px-2 py-1 rounded-md bg-slate-50 text-slate-500 text-[10px] font-semibold">{p.name}</span>)}{count.length > 3 && <span className="px-2 py-1 rounded-md bg-slate-100 text-slate-400 text-[10px] font-semibold">+{count.length - 3}</span>}{count.length === 0 && <span className="text-[10px] text-slate-400">Sem produtos nesta categoria</span>}</div>
              </div>
              <div className="flex gap-2 px-4 pb-4">
                <Button size="xs" variant="outline" className="flex-1" iconLeft={<Edit2 size={11} />} onClick={() => openEdit(cat)}>
                  Editar
                </Button>
                <IconButton size="xs" variant="outline" aria-label={`Excluir categoria ${cat.name}`} title="Excluir" onClick={() => setDeleteTarget(cat)} className="hover:text-red-600">
                  <Trash2 size={12} />
                </IconButton>
              </div>
              </> })()}
            </motion.div>
          ))}

          {/* Card + */}
          <motion.button
            layout
            onClick={openNew}
            className="bg-white border-2 border-dashed border-slate-200 rounded-lg p-4 hover:border-blue-400 hover:bg-blue-50/30 transition-all flex flex-col items-center justify-center gap-2 text-slate-400 hover:text-blue-600 min-h-[130px]"
          >
            <Plus size={22} strokeWidth={1.5} />
            <span className="text-[10px] font-semibold">Nova</span>
          </motion.button>
        </div>
      )}

      <Modal
        open={isModalOpen}
        onClose={closeModal}
        title={editing?.id ? "Editar Categoria" : "Nova Categoria"}
        subtitle="Organização do catálogo"
        size="sm"
        footer={
          <ModalFooter>
            <Button variant="outline" onClick={closeModal}>Cancelar</Button>
            <Button form="cat-form" type="submit" loading={saving} iconLeft={<Save size={13} />}>
              Salvar
            </Button>
          </ModalFooter>
        }
      >
        <form id="cat-form" onSubmit={handleSave} className="space-y-4">
          <div data-tour="category-name-field">
          <Input
            label="Nome da Categoria *"
            autoFocus
            required
            placeholder="Ex: Camisetas, Calçados, Cosméticos..."
            value={editing?.name || ""}
            onChange={(e) => setEditing((prev) => ({ ...prev!, name: e.target.value }))}
          />
          </div>
          <div><p className="ds-label mb-1.5">Ícone</p><div className="grid grid-cols-3 gap-2">{ICON_OPTIONS.map(({ value, label, Icon }) => <Button type="button" key={value} size="md" variant={editing?.icon === value ? "primary" : "outline"} iconLeft={<Icon size={14} />} onClick={() => setEditing(prev => ({ ...prev!, icon: value }))}>{label}</Button>)}</div></div>
          <div><p className="ds-label mb-1.5">Cor da categoria</p><div className="flex gap-2">{CATEGORY_COLORS.map(color => <button type="button" key={color} aria-label={`Usar a cor ${color}`} onClick={() => setEditing(prev => ({ ...prev!, color }))} className={`w-8 h-8 rounded-full border-2 ${editing?.color === color ? "border-slate-900 scale-110" : "border-white"}`} style={{ backgroundColor: color }} />)}<label className="w-8 h-8 rounded-full border border-slate-200 overflow-hidden cursor-pointer"><input type="color" value={editing?.color || "#2563eb"} onChange={e => setEditing(prev => ({ ...prev!, color: e.target.value }))} className="w-10 h-10 -m-1 cursor-pointer" /></label></div></div>
          <div><p className="ds-label mb-1.5">Capa da categoria</p><label className="h-20 rounded-lg border border-dashed border-slate-300 hover:border-blue-400 bg-slate-50 flex items-center justify-center gap-2 cursor-pointer overflow-hidden">{editing?.cover_url ? <img src={editing.cover_url} alt="Capa selecionada" className="w-full h-full object-cover" /> : <><ImageUp size={16} className="text-blue-500" /><span className="text-[11px] font-semibold text-slate-500">{uploadingCover ? "Enviando capa..." : "Enviar imagem"}</span></>}<input type="file" accept="image/*" className="hidden" disabled={uploadingCover} onChange={e => { const file = e.target.files?.[0]; if (file) uploadCover(file); }} /></label></div>
        </form>
      </Modal>

      <Modal
        open={!!managing}
        onClose={() => setManaging(null)}
        title={managing ? `Produtos em ${managing.name}` : "Produtos"}
        subtitle="Produtos desta categoria e itens disponíveis para adicionar"
        size="lg"
        footer={
          <ModalFooter>
            <Button variant="outline" onClick={() => setManaging(null)}>Fechar</Button>
            <Button loading={assigning} disabled={selectedProductIds.size === 0} iconLeft={<PackagePlus size={13} />} onClick={assignSelectedProducts}>Adicionar {selectedProductIds.size || ""} selecionado(s)</Button>
          </ModalFooter>
        }
      >
        <Tabs<ManageTab>
          items={MANAGE_TABS.map((t) => ({ ...t, badge: t.id === "in" ? (managing ? productsFor(managing.id).length : 0) : uncategorized.length }))}
          value={manageTab}
          onChange={setManageTab}
          label="Produtos da categoria"
        >
          {manageTab === "in" ? (
            <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
              {managing && productsFor(managing.id).length ? productsFor(managing.id).map(p => <div key={p.id} className="px-3 py-2 text-xs font-medium text-slate-700">{p.name}</div>) : <p className="p-3 text-xs text-slate-500">Nenhum produto adicionado ainda.</p>}
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-[11px] text-slate-500">Apenas produtos sem categoria aparecem aqui. Cada produto pertence a uma única categoria.</p>
              <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
                {uncategorized.length ? uncategorized.map(p => <label key={p.id} className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 cursor-pointer"><input type="checkbox" checked={selectedProductIds.has(p.id)} onChange={() => setSelectedProductIds(prev => { const next = new Set(prev); next.has(p.id) ? next.delete(p.id) : next.add(p.id); return next; })} className="h-4 w-4 accent-blue-600" /><span className="flex-1 text-xs font-medium text-slate-700">{p.name}</span><span className="text-[11px] text-slate-500">R$ {Number(p.price).toFixed(2)}</span></label>) : <p className="p-3 text-xs text-slate-500">Todos os produtos já possuem uma categoria.</p>}
              </div>
            </div>
          )}
        </Tabs>
      </Modal>

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Excluir Categoria"
        variant="danger"
        loading={deleting}
        confirmLabel="Excluir"
        message={
          <>
            <p className="text-sm font-medium text-slate-800">Excluir <span className="text-red-600">"{deleteTarget?.name}"</span>?</p>
            <p className="mt-1 text-xs text-slate-500">Produtos vinculados a esta categoria perderão a categorização. Esta ação não pode ser desfeita.</p>
          </>
        }
      />
    </div>
    </PageWrapper>
  );
}
