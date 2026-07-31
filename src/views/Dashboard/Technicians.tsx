import { useState, useEffect, useCallback } from "react";
import {
  Wrench, Plus, Search, Edit2, Trash2, X, Check,
  ToggleLeft, ToggleRight, Phone, FileText,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../../lib/utils";
import PageHeader from "../../components/layout/PageHeader";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Technician {
  id: number;
  name: string;
  phone?: string;
  document?: string;
  is_active: boolean;
  notes?: string;
  created_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const authH = () => ({
  Authorization: `Bearer ${localStorage.getItem("token")}`,
  "Content-Type": "application/json",
});

const emptyForm = (): Omit<Technician, "id" | "created_at"> => ({
  name: "", phone: "", document: "", is_active: true, notes: "",
});

// ─── Component ────────────────────────────────────────────────────────────────

export default function Technicians() {
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]     = useState<Technician | null>(null);
  const [form, setForm]           = useState(emptyForm());
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);

  const fetchTechnicians = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/technicians", { headers: authH() });
      setTechnicians(await r.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTechnicians(); }, [fetchTechnicians]);

  const openNew = () => { setEditing(null); setForm(emptyForm()); setShowModal(true); };

  const openEdit = (t: Technician) => {
    setEditing(t);
    setForm({
      name: t.name, phone: t.phone ?? "", document: t.document ?? "",
      is_active: t.is_active, notes: t.notes ?? "",
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const url    = editing ? `/api/technicians/${editing.id}` : "/api/technicians";
      const method = editing ? "PUT" : "POST";
      await fetch(url, { method, headers: authH(), body: JSON.stringify(form) });
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
      setShowModal(false);
      await fetchTechnicians();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Excluir este técnico? As ordens de serviço anteriores não serão afetadas.")) return;
    await fetch(`/api/technicians/${id}`, { method: "DELETE", headers: authH() });
    fetchTechnicians();
  };

  const handleToggleActive = async (t: Technician) => {
    await fetch(`/api/technicians/${t.id}`, {
      method: "PUT", headers: authH(),
      body: JSON.stringify({ ...t, is_active: !t.is_active }),
    });
    fetchTechnicians();
  };

  const filtered = technicians.filter((t) =>
    !search || t.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Técnicos"
        subtitle="Cadastro de técnicos e prestadores de serviço para atribuir em Ordens de Serviço"
        action={
          <button onClick={openNew}
            className="h-9 px-4 bg-blue-600 text-white rounded-lg flex items-center gap-2 text-[12px] font-bold hover:bg-blue-700 transition-all shadow-md shadow-blue-500/20">
            <Plus size={15} /> Novo Técnico
          </button>
        }
      />

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar técnico..."
          className="w-full pl-9 pr-3 h-9 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-16 text-slate-400 text-sm">Carregando…</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-slate-400 gap-3">
          <Wrench size={36} strokeWidth={1} />
          <p className="text-sm font-medium">Nenhum técnico cadastrado</p>
          <button onClick={openNew}
            className="h-8 px-4 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700">
            Cadastrar primeiro técnico
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((t) => (
            <motion.div key={t.id}
              initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col gap-3 hover:shadow-md hover:border-blue-200 transition-all"
            >
              <div className="flex items-start gap-3">
                <div className={cn(
                  "w-11 h-11 rounded-xl flex items-center justify-center text-white font-black text-base shrink-0",
                  t.is_active ? "bg-blue-600" : "bg-slate-300"
                )}>
                  {t.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-slate-900 text-sm truncate">{t.name}</p>
                  <span className={cn(
                    "inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full mt-0.5",
                    t.is_active ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"
                  )}>
                    <span className={cn("w-1.5 h-1.5 rounded-full", t.is_active ? "bg-emerald-500" : "bg-slate-400")} />
                    {t.is_active ? "Ativo" : "Inativo"}
                  </span>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => openEdit(t)}
                    className="p-1.5 hover:bg-blue-50 text-blue-500 rounded-lg transition-colors">
                    <Edit2 size={13} />
                  </button>
                  <button onClick={() => handleDelete(t.id)}
                    className="p-1.5 hover:bg-red-50 text-red-400 rounded-lg transition-colors">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                {t.phone && (
                  <div className="flex items-center gap-2 text-[11px] text-slate-500">
                    <Phone size={11} className="shrink-0" /> {t.phone}
                  </div>
                )}
                {t.document && (
                  <div className="flex items-center gap-2 text-[11px] text-slate-500">
                    <FileText size={11} className="shrink-0" /> {t.document}
                  </div>
                )}
              </div>

              {t.notes && (
                <p className="text-[11px] text-slate-400 bg-slate-50 rounded-lg px-2.5 py-2 line-clamp-2">{t.notes}</p>
              )}

              <button onClick={() => handleToggleActive(t)}
                className={cn(
                  "w-full flex items-center justify-center gap-2 h-8 rounded-lg text-[11px] font-bold border transition-all",
                  t.is_active
                    ? "border-slate-200 text-slate-500 hover:bg-red-50 hover:text-red-500 hover:border-red-200"
                    : "border-emerald-200 text-emerald-600 bg-emerald-50 hover:bg-emerald-100"
                )}>
                {t.is_active ? <><ToggleRight size={14} /> Desativar</> : <><ToggleLeft size={14} /> Ativar</>}
              </button>
            </motion.div>
          ))}
        </div>
      )}

      {/* ══════════ MODAL CADASTRO / EDIÇÃO ══════════ */}
      <AnimatePresence>
        {showModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowModal(false)}
              className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 20 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
            >
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                  <h3 className="font-black text-slate-900 text-base">
                    {editing ? "Editar Técnico" : "Novo Técnico"}
                  </h3>
                  <button onClick={() => setShowModal(false)}
                    className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors">
                    <X size={16} />
                  </button>
                </div>

                <div className="p-6 space-y-4">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                      Nome *
                    </label>
                    <input
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder="Nome completo"
                      className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                        Telefone
                      </label>
                      <input
                        value={form.phone}
                        onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                        placeholder="(11) 99999-9999"
                        className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                        CPF / CNPJ
                      </label>
                      <input
                        value={form.document}
                        onChange={(e) => setForm((f) => ({ ...f, document: e.target.value }))}
                        placeholder="000.000.000-00"
                        className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3">
                    <div>
                      <p className="text-sm font-bold text-slate-700">Técnico Ativo</p>
                      <p className="text-[10px] text-slate-400">Pode ser selecionado na Ordem de Serviço</p>
                    </div>
                    <button
                      onClick={() => setForm((f) => ({ ...f, is_active: !f.is_active }))}
                      className={cn(
                        "w-11 h-6 rounded-full transition-all relative shadow-inner shrink-0",
                        form.is_active ? "bg-emerald-500" : "bg-slate-300"
                      )}
                    >
                      <div className={cn(
                        "absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-sm",
                        form.is_active ? "left-6" : "left-1"
                      )} />
                    </button>
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                      Observações
                    </label>
                    <textarea
                      value={form.notes}
                      onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                      rows={2}
                      placeholder="Especialidade, região de atendimento..."
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    />
                  </div>
                </div>

                <div className="flex gap-2 px-6 pb-6">
                  <button onClick={() => setShowModal(false)}
                    className="flex-1 h-10 rounded-lg border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-all">
                    Cancelar
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving || !form.name.trim()}
                    className="flex-1 h-10 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                  >
                    {saved ? <><Check size={14} /> Salvo!</> : saving ? "Salvando…" : editing ? "Atualizar" : "Cadastrar"}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
