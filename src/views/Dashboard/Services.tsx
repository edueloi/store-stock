import React, { useState, useEffect, useCallback } from "react";
import {
  Wrench, Plus, Edit2, Trash2, Save, ToggleLeft, ToggleRight,
  AlertTriangle, CheckCircle, XCircle,
  Search, X, LayoutGrid, List, Clock,
} from "lucide-react";
import { motion } from "motion/react";
import Button from "../../components/ui/Button";
import { Input, Textarea } from "../../components/ui/Input";
import Modal from "../../components/ui/Modal";
import PageHeader from "../../components/layout/PageHeader";
import { EmptyState, LoadingState } from "../../components/layout/EmptyState";
import { StatCard } from "../../components/ui/Card";

interface Service {
  id: number;
  name: string;
  description?: string;
  price: number;
  is_active: boolean;
  created_at: string;
}

const EMPTY_FORM = () => ({ name: "", description: "", price: "", is_active: true });

const authH = () => ({
  Authorization: `Bearer ${localStorage.getItem("token")}`,
  "Content-Type": "application/json",
});

function fmt(price: number) {
  return price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

type ViewMode = "grid" | "list";

export default function Services() {
  const [services, setServices]     = useState<Service[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState("");
  const [viewMode, setViewMode]     = useState<ViewMode>("list");
  const [filterActive, setFilterActive] = useState<"all" | "active" | "inactive">("all");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing]         = useState<Service | null>(null);
  const [form, setForm]               = useState(EMPTY_FORM());
  const [saving, setSaving]           = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Service | null>(null);
  const [deleting, setDeleting]         = useState(false);

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
    setIsModalOpen(true);
  };

  const openEdit = (s: Service) => {
    setEditing(s);
    const masked = Number(s.price).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    setForm({ name: s.name, description: s.description ?? "", price: masked, is_active: s.is_active });
    setIsModalOpen(true);
  };

  const closeModal = () => { setIsModalOpen(false); setEditing(null); };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.price) return;
    setSaving(true);
    try {
      const url    = editing ? `/api/services/${editing.id}` : "/api/services";
      const method = editing ? "PUT" : "POST";
      await fetch(url, { method, headers: authH(), body: JSON.stringify({ ...form, price: parseMaskedPrice(form.price) }) });
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
      body: JSON.stringify({ name: s.name, description: s.description, price: Number(s.price), is_active: !s.is_active }),
    });
    fetchServices();
  };

  const filtered = services.filter((s) => {
    const matchSearch = !search
      || s.name.toLowerCase().includes(search.toLowerCase())
      || (s.description ?? "").toLowerCase().includes(search.toLowerCase());
    const matchFilter =
      filterActive === "all" ? true :
      filterActive === "active" ? s.is_active :
      !s.is_active;
    return matchSearch && matchFilter;
  });

  const activeCount   = services.filter((s) => s.is_active).length;
  const inactiveCount = services.filter((s) => !s.is_active).length;

  // Máscara monetária: converte dígitos em "1.234,56"
  const applyMoneyMask = (raw: string) => {
    const digits = raw.replace(/\D/g, "");
    if (!digits) return "";
    const num = parseInt(digits, 10) / 100;
    return num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const parseMaskedPrice = (masked: string) => {
    return parseFloat(masked.replace(/\./g, "").replace(",", ".")) || 0;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Serviços"
        subtitle="Gerencie os serviços oferecidos pela sua loja"
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

      {/* Search + filters + view toggle */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou descrição..."
            className="w-full pl-9 pr-9 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Filter tabs */}
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

      {/* Content */}
      {loading ? (
        <LoadingState rows={4} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Wrench size={32} strokeWidth={1} />}
          title={search || filterActive !== "all" ? "Nenhum serviço encontrado" : "Nenhum serviço cadastrado"}
          description="Cadastre serviços para disponibilizá-los no PDV e orçamentos."
          action={!search && filterActive === "all" && <Button icon={<Plus size={14} />} onClick={openNew}>Cadastrar Serviço</Button>}
        />
      ) : viewMode === "list" ? (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          {/* Header */}
          <div className="hidden sm:grid grid-cols-[1fr_2fr_auto_auto] gap-4 px-5 py-2.5 bg-slate-50 border-b border-slate-200">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Serviço</span>
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Descrição</span>
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Preço</span>
            <span />
          </div>
          <div className="divide-y divide-slate-50">
            {filtered.map((svc) => (
              <motion.div
                key={svc.id}
                layout
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex sm:grid sm:grid-cols-[1fr_2fr_auto_auto] items-center gap-4 px-5 py-3.5 hover:bg-slate-50/60 transition-colors ${!svc.is_active ? "opacity-60" : ""}`}
              >
                {/* Nome + status */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${svc.is_active ? "bg-blue-50 text-blue-500" : "bg-slate-100 text-slate-400"}`}>
                    <Wrench size={15} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[12px] font-bold text-slate-900 truncate">{svc.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={`text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full ${svc.is_active ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400"}`}>
                        {svc.is_active ? "Ativo" : "Inativo"}
                      </span>
                      <span className="flex items-center gap-0.5 text-[9px] text-slate-400">
                        <Clock size={8} />
                        {new Date(svc.created_at).toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Descrição */}
                <p className="hidden sm:block text-[11px] text-slate-500 truncate">{svc.description || <span className="text-slate-300 italic">Sem descrição</span>}</p>

                {/* Preço */}
                <p className="text-[14px] font-mono font-black text-blue-600 shrink-0">{fmt(Number(svc.price))}</p>

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
            ))}
          </div>
        </div>
      ) : (
        /* Grid view */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.map((svc) => (
            <motion.div
              key={svc.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all flex flex-col gap-3 ${!svc.is_active ? "opacity-60" : ""}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${svc.is_active ? "bg-blue-50 text-blue-500" : "bg-slate-100 text-slate-400"}`}>
                  <Wrench size={16} />
                </div>
                <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full shrink-0 ${svc.is_active ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400"}`}>
                  {svc.is_active ? "Ativo" : "Inativo"}
                </span>
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-xs font-black text-slate-900 uppercase tracking-tight leading-tight">{svc.name}</p>
                {svc.description && <p className="text-[10px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">{svc.description}</p>}
              </div>

              <p className="text-[18px] font-mono font-black text-blue-600">{fmt(Number(svc.price))}</p>

              <div className="flex gap-1.5 pt-2 border-t border-slate-100">
                <button
                  onClick={() => handleToggle(svc)}
                  className="flex-1 h-7 flex items-center justify-center gap-1 bg-slate-50 hover:bg-emerald-50 hover:text-emerald-600 text-slate-400 rounded-lg transition-all border border-slate-200 hover:border-emerald-200 text-[9px] font-black uppercase"
                >
                  {svc.is_active ? <><ToggleRight size={11} /> Ativo</> : <><ToggleLeft size={11} /> Inativo</>}
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
          ))}

          {/* Add card */}
          <motion.button
            layout
            onClick={openNew}
            className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-4 hover:border-blue-400 hover:bg-blue-50/30 transition-all flex flex-col items-center justify-center gap-2 text-slate-400 hover:text-blue-600 min-h-[160px]"
          >
            <Plus size={22} strokeWidth={1.5} />
            <span className="text-[9px] font-black uppercase tracking-widest">Novo Serviço</span>
          </motion.button>
        </div>
      )}

      {/* Modal Criar / Editar */}
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
              {editing ? "Salvar Alterações" : "Cadastrar"}
            </Button>
          </>
        }
      >
        <form id="service-form" onSubmit={handleSave} className="space-y-4">
          <Input
            label="Nome do Serviço *"
            required
            autoFocus
            placeholder="Ex: Manutenção, Consultoria, Instalação..."
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <Textarea
            label="Descrição"
            placeholder="Descreva o serviço (opcional)"
            rows={2}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
              Preço *
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[11px] font-bold pointer-events-none">R$</span>
              <input
                required
                inputMode="numeric"
                placeholder="0,00"
                className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all text-slate-800 font-mono"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: applyMoneyMask(e.target.value) })}
              />
            </div>
          </div>
          <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 h-11">
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

      {/* Modal Deletar */}
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
              Este serviço será removido permanentemente do sistema.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
}
