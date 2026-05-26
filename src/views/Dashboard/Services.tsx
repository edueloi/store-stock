import { useState, useEffect, useCallback } from "react";
import {
  Wrench, Plus, Search, Edit2, Trash2, X, Check,
  ToggleLeft, ToggleRight, DollarSign,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../../lib/utils";
import PageHeader from "../../components/layout/PageHeader";

interface Service {
  id: number;
  name: string;
  description?: string;
  price: number;
  is_active: boolean;
  created_at: string;
}

const authH = () => ({
  Authorization: `Bearer ${localStorage.getItem("token")}`,
  "Content-Type": "application/json",
});

const emptyForm = () => ({ name: "", description: "", price: "", is_active: true });

export default function Services() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]     = useState<Service | null>(null);
  const [form, setForm]           = useState(emptyForm());
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);

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
    setForm(emptyForm());
    setShowModal(true);
  };

  const openEdit = (s: Service) => {
    setEditing(s);
    setForm({ name: s.name, description: s.description ?? "", price: String(Number(s.price).toFixed(2)), is_active: s.is_active });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.price) return;
    setSaving(true);
    try {
      const url    = editing ? `/api/services/${editing.id}` : "/api/services";
      const method = editing ? "PUT" : "POST";
      await fetch(url, {
        method, headers: authH(),
        body: JSON.stringify({ ...form, price: parseFloat(form.price) || 0 }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
      setShowModal(false);
      fetchServices();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Excluir este serviço?")) return;
    await fetch(`/api/services/${id}`, { method: "DELETE", headers: authH() });
    fetchServices();
  };

  const handleToggle = async (s: Service) => {
    await fetch(`/api/services/${s.id}`, {
      method: "PUT", headers: authH(),
      body: JSON.stringify({ name: s.name, description: s.description, price: Number(s.price), is_active: !s.is_active }),
    });
    fetchServices();
  };

  const filtered = services.filter((s) =>
    !search || s.name.toLowerCase().includes(search.toLowerCase()) || (s.description ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const active   = services.filter((s) => s.is_active).length;
  const avgPrice = services.length > 0 ? services.reduce((a, s) => a + Number(s.price), 0) / services.length : 0;

  return (
    <div className="flex flex-col h-full bg-[#f8fafc] overflow-hidden">
      <div className="flex-1 overflow-y-auto admin-scroll">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">

          <PageHeader
            title="Serviços"
            subtitle="Gerencie os serviços oferecidos pela sua loja"
            action={
              <button onClick={openNew}
                className="flex items-center gap-2 h-10 px-5 bg-blue-600 text-white rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/25 active:scale-95">
                <Plus size={14} /> Novo Serviço
              </button>
            }
          />

          {/* stats */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Total", value: services.length, color: "text-slate-900" },
              { label: "Ativos", value: active, color: "text-emerald-600" },
              { label: "Preço Médio", value: `R$ ${avgPrice.toFixed(2)}`, color: "text-blue-600" },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-white rounded-2xl border border-slate-200 p-4 text-center shadow-sm">
                <p className={cn("text-2xl font-mono font-black", color)}>{value}</p>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">{label}</p>
              </div>
            ))}
          </div>

          {/* search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input type="text" placeholder="Buscar serviço..."
              className="w-full pl-9 pr-4 h-10 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 text-[12px] text-slate-800 placeholder:text-slate-400 transition-all"
              value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>

          {/* list */}
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-3">
              <Wrench size={36} strokeWidth={1} className="text-slate-200" />
              <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                {search ? "Nenhum serviço encontrado" : "Nenhum serviço cadastrado"}
              </p>
              {!search && (
                <button onClick={openNew}
                  className="h-9 px-4 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all">
                  Cadastrar primeiro serviço
                </button>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="divide-y divide-slate-50">
                {filtered.map((svc) => (
                  <div key={svc.id} className={cn("flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors", !svc.is_active && "opacity-50")}>
                    <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                      <Wrench size={16} className="text-blue-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-[13px] font-bold text-slate-900">{svc.name}</p>
                        {!svc.is_active && (
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 px-2 py-0.5 rounded-full">Inativo</span>
                        )}
                      </div>
                      {svc.description && <p className="text-[11px] text-slate-500 truncate mt-0.5">{svc.description}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[15px] font-mono font-black text-blue-600">R$ {Number(svc.price).toFixed(2)}</p>
                      <p className="text-[9px] text-slate-400 font-medium mt-0.5">
                        {new Date(svc.created_at).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => handleToggle(svc)} title={svc.is_active ? "Desativar" : "Ativar"}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 transition-all">
                        {svc.is_active
                          ? <ToggleRight size={18} className="text-emerald-500" />
                          : <ToggleLeft size={18} />}
                      </button>
                      <button onClick={() => openEdit(svc)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-all">
                        <Edit2 size={14} />
                      </button>
                      <button onClick={() => handleDelete(svc.id)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-all">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── MODAL ───────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showModal && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowModal(false)}
              className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[300]" />
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.97 }}
              transition={{ type: "spring", damping: 28, stiffness: 280 }}
              className="fixed inset-x-4 bottom-4 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 z-[301] w-full sm:w-[420px] bg-white rounded-3xl shadow-2xl overflow-hidden">

              <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
                <div>
                  <h2 className="text-[12px] font-black uppercase tracking-widest text-slate-900">
                    {editing ? "Editar Serviço" : "Novo Serviço"}
                  </h2>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                    {editing ? "Atualize os dados do serviço" : "Preencha os dados do novo serviço"}
                  </p>
                </div>
                <button onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400">
                  <X size={16} />
                </button>
              </div>

              <div className="p-6 space-y-4">
                {/* nome */}
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Nome *</label>
                  <input
                    type="text" placeholder="Ex: Manutenção, Consultoria..."
                    className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 text-[12px] font-medium text-slate-800 placeholder:text-slate-400 transition-all"
                    value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                    autoFocus
                  />
                </div>

                {/* descrição */}
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Descrição</label>
                  <textarea
                    placeholder="Descreva o serviço (opcional)"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 text-[12px] font-medium text-slate-800 placeholder:text-slate-400 transition-all resize-none"
                    rows={2}
                    value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  />
                </div>

                {/* preço */}
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Preço *</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    <input
                      type="number" min="0" step="0.01" placeholder="0,00"
                      className="w-full pl-9 pr-4 h-11 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 text-[12px] font-medium text-slate-800 placeholder:text-slate-400 transition-all [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                      value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })}
                    />
                  </div>
                </div>

                {/* status */}
                <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 h-11">
                  <span className="text-[11px] font-bold text-slate-600">Ativo</span>
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
              </div>

              <div className="px-6 pb-6">
                <button onClick={handleSave} disabled={saving || !form.name.trim() || !form.price}
                  className={cn(
                    "w-full h-12 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-30 disabled:cursor-not-allowed",
                    saved
                      ? "bg-emerald-500 shadow-emerald-500/30 text-white"
                      : "bg-blue-600 hover:bg-blue-700 shadow-blue-500/30 text-white active:scale-[0.98]"
                  )}>
                  {saving ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : saved ? (
                    <><Check size={16} /> Salvo!</>
                  ) : (
                    <>{editing ? <><Edit2 size={14} /> Salvar alterações</> : <><Plus size={14} /> Cadastrar serviço</>}</>
                  )}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
