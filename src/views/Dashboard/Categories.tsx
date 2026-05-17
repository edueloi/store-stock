import React, { useState, useEffect } from "react";
import { Tag, Plus, FolderOpen, Edit2, Trash2, Save } from "lucide-react";
import { motion } from "motion/react";
import Button from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import Modal from "../../components/ui/Modal";
import PageHeader from "../../components/layout/PageHeader";
import SearchBar from "../../components/layout/SearchBar";
import { EmptyState, LoadingState } from "../../components/layout/EmptyState";
import { StatCard } from "../../components/ui/Card";
import { Category } from "../../types";

export default function Categories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Category> | null>(null);
  const [saving, setSaving] = useState(false);

  const headers = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  });

  const fetchCategories = async () => {
    const res = await fetch("/api/categories", { headers: headers() });
    const data = await res.json();
    setCategories(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  useEffect(() => { fetchCategories(); }, []);

  const openNew = () => { setEditing({ name: "" }); setIsModalOpen(true); };
  const openEdit = (c: Category) => { setEditing(c); setIsModalOpen(true); };
  const closeModal = () => { setIsModalOpen(false); setEditing(null); };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing?.name?.trim()) return;
    setSaving(true);
    try {
      if (editing.id) {
        await fetch(`/api/categories/${editing.id}`, { method: "PUT", headers: headers(), body: JSON.stringify({ name: editing.name }) });
      } else {
        await fetch("/api/categories", { method: "POST", headers: headers(), body: JSON.stringify({ name: editing.name }) });
      }
      closeModal();
      fetchCategories();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Excluir esta categoria? Produtos vinculados perderão a categorização.")) return;
    await fetch(`/api/categories/${id}`, { method: "DELETE", headers: headers() });
    fetchCategories();
  };

  const filtered = categories.filter((c) =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader
        title="Categorias"
        subtitle="Organização do catálogo de produtos"
        action={
          <Button icon={<Plus size={15} />} onClick={openNew}>
            Nova Categoria
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-4">
        <StatCard label="Total de Categorias" value={categories.length} icon={<FolderOpen />} accent="blue" />
        <StatCard label="Produtos Organizados" value="—" icon={<Tag />} accent="slate" />
      </div>

      {categories.length > 4 && (
        <SearchBar value={searchTerm} onChange={setSearchTerm} placeholder="Filtrar categorias..." />
      )}

      {loading ? (
        <LoadingState rows={4} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Tag size={32} strokeWidth={1} />}
          title={searchTerm ? "Nenhuma categoria encontrada" : "Nenhuma categoria criada"}
          description="Crie categorias para organizar seu catálogo de produtos."
          action={!searchTerm && <Button icon={<Plus size={14} />} onClick={openNew}>Criar Categoria</Button>}
        />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 lg:gap-4">
          {filtered.map((cat) => (
            <motion.div
              key={cat.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all group flex flex-col gap-3"
            >
              <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 shrink-0">
                <Tag size={17} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-black text-slate-900 uppercase tracking-tight leading-tight truncate">{cat.name}</p>
                <p className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">ID #{cat.id}</p>
              </div>
              <div className="flex gap-2 pt-2 border-t border-slate-100">
                <button
                  onClick={() => openEdit(cat)}
                  className="flex-1 h-7 flex items-center justify-center gap-1 bg-slate-50 hover:bg-blue-50 hover:text-blue-600 text-slate-400 rounded-lg transition-all border border-slate-200 hover:border-blue-200 text-[9px] font-black uppercase"
                >
                  <Edit2 size={10} /> Editar
                </button>
                <button
                  onClick={() => handleDelete(cat.id)}
                  className="w-7 h-7 flex items-center justify-center bg-slate-50 hover:bg-red-50 hover:text-red-500 text-slate-400 rounded-lg transition-all border border-slate-200 hover:border-red-200"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            </motion.div>
          ))}

          {/* Card + */}
          <motion.button
            layout
            onClick={openNew}
            className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-4 hover:border-blue-400 hover:bg-blue-50/30 transition-all flex flex-col items-center justify-center gap-2 text-slate-400 hover:text-blue-600 min-h-[130px]"
          >
            <Plus size={22} strokeWidth={1.5} />
            <span className="text-[9px] font-black uppercase tracking-widest">Nova</span>
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
          <>
            <Button variant="secondary" onClick={closeModal}>Cancelar</Button>
            <Button form="cat-form" type="submit" loading={saving} icon={<Save size={13} />}>
              Salvar
            </Button>
          </>
        }
      >
        <form id="cat-form" onSubmit={handleSave}>
          <Input
            label="Nome da Categoria *"
            autoFocus
            required
            placeholder="Ex: Camisetas, Calçados, Cosméticos..."
            value={editing?.name || ""}
            onChange={(e) => setEditing((prev) => ({ ...prev!, name: e.target.value }))}
          />
        </form>
      </Modal>
    </div>
  );
}
