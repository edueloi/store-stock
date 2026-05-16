import React, { useState, useEffect } from "react";
import { 
  Plus, 
  Search, 
  Phone, 
  MapPin, 
  User, 
  MessageCircle, 
  MoreHorizontal, 
  Trash2, 
  Edit3,
  Loader2,
  Tag,
  Info,
  X
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../../lib/utils";
import { Supplier } from "../../types";

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Partial<Supplier> | null>(null);
  const [saveLoading, setSaveLoading] = useState(false);

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/suppliers", {
        headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
      });
      const data = await res.json();
      setSuppliers(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveLoading(true);
    try {
      const method = editingSupplier?.id ? "PUT" : "POST";
      const url = editingSupplier?.id ? `/api/suppliers/${editingSupplier.id}` : "/api/suppliers";
      
      const res = await fetch(url, {
        method,
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify(editingSupplier)
      });

      if (res.ok) {
        await fetchSuppliers();
        setIsModalOpen(false);
        setEditingSupplier(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaveLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Deseja realmente remover este fornecedor?")) return;
    try {
      await fetch(`/api/suppliers/${id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
      });
      await fetchSuppliers();
    } catch (err) {
      console.error(err);
    }
  };

  const filteredSuppliers = suppliers.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.contact_person?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Gestão de Fornecedores</h1>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Conecte sua cadeia de suprimentos</p>
        </div>
        <button 
          onClick={() => { setEditingSupplier({}); setIsModalOpen(true); }}
          className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95 flex items-center gap-2"
        >
          <Plus size={16} />
          Novo Fornecedor
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="Buscar por nome, categoria ou contato..."
              className="w-full pl-10 pr-4 h-10 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500/10 outline-none transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Fornecedor / Categoria</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Contato Direto</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Localização</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status/Info</th>
                <th className="px-6 py-4 text-right"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-24 text-center">
                    <Loader2 size={32} className="animate-spin mx-auto text-blue-600 opacity-20" />
                  </td>
                </tr>
              ) : filteredSuppliers.length === 0 ? (
                <tr>
                   <td colSpan={5} className="px-6 py-24 text-center text-slate-400 font-bold uppercase text-[10px]">
                      Nenhum fornecedor encontrado
                   </td>
                </tr>
              ) : filteredSuppliers.map((supplier) => (
                <tr key={supplier.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-center text-blue-600 font-black text-sm">
                        {supplier.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-xs font-black text-slate-900 uppercase tracking-tight">{supplier.name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                           <Tag size={10} className="text-slate-400" />
                           <span className="text-[9px] font-bold text-slate-400 uppercase">{supplier.category}</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <User size={12} className="text-slate-400" />
                        <span className="text-[10px] font-bold text-slate-600 uppercase">{supplier.contact_person || '—'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone size={12} className="text-slate-400" />
                        <span className="text-[10px] font-bold text-slate-600">{supplier.phone || '—'}</span>
                        {supplier.phone && (
                          <a 
                            href={`https://wa.me/${supplier.phone.replace(/\D/g, '')}`} 
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 text-emerald-500 hover:bg-emerald-50 rounded transition-colors"
                          >
                             <MessageCircle size={12} />
                          </a>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2 max-w-[200px]">
                      <MapPin size={12} className="text-slate-400 shrink-0 mt-0.5" />
                      <span className="text-[10px] font-bold text-slate-500 leading-relaxed uppercase">{supplier.address || 'Não informado'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {supplier.notes ? (
                       <div className="flex items-center gap-2 text-slate-400">
                          <Info size={12} />
                          <span className="text-[9px] font-bold uppercase truncate max-w-[150px]">{supplier.notes}</span>
                       </div>
                    ) : (
                       <span className="text-[8px] font-bold text-slate-300 uppercase italic">Sem observações</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => { setEditingSupplier(supplier); setIsModalOpen(true); }}
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                      >
                        <Edit3 size={14} />
                      </button>
                      <button 
                        onClick={() => handleDelete(supplier.id)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Add/Edit */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               onClick={() => { if(!saveLoading) setIsModalOpen(false); }}
               className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl w-full max-w-lg shadow-2xl relative z-10 overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">{editingSupplier?.id ? 'Editar Fornecedor' : 'Registro de Fornecedor'}</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Cadastro detalhado de parceiros</p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSave} className="p-6 space-y-4">
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1 col-span-2">
                       <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Nome Fantasia / Empresa</label>
                       <input 
                         required
                         type="text" 
                         className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 h-11 text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all" 
                         value={editingSupplier?.name || ""}
                         onChange={(e) => setEditingSupplier({...editingSupplier!, name: e.target.value})}
                         placeholder="Razão Social ou Nome Fantasia"
                       />
                    </div>
                    <div className="space-y-1">
                       <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">O que fornece? (Categoria)</label>
                       <input 
                         required
                         type="text" 
                         className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 h-11 text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all" 
                         value={editingSupplier?.category || ""}
                         onChange={(e) => setEditingSupplier({...editingSupplier!, category: e.target.value})}
                         placeholder="Ex: Embalagens, Matéria Prima"
                       />
                    </div>
                    <div className="space-y-1">
                       <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Nome do Contato</label>
                       <input 
                         type="text" 
                         className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 h-11 text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all" 
                         value={editingSupplier?.contact_person || ""}
                         onChange={(e) => setEditingSupplier({...editingSupplier!, contact_person: e.target.value})}
                         placeholder="Representante"
                       />
                    </div>
                    <div className="space-y-1 col-span-2">
                       <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">WhatsApp / Telefone</label>
                       <input 
                         type="text" 
                         className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 h-11 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all" 
                         value={editingSupplier?.phone || ""}
                         onChange={(e) => setEditingSupplier({...editingSupplier!, phone: e.target.value})}
                         placeholder="5511999999999"
                       />
                       <p className="text-[9px] text-slate-400 px-1 italic">Inclua o 55 antes do DDD</p>
                    </div>
                    <div className="space-y-1 col-span-2">
                       <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Endereço / Sede</label>
                       <input 
                         type="text" 
                         className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 h-11 text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all" 
                         value={editingSupplier?.address || ""}
                         onChange={(e) => setEditingSupplier({...editingSupplier!, address: e.target.value})}
                         placeholder="Cidade - UF"
                       />
                    </div>
                    <div className="space-y-1 col-span-2">
                       <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Notas Internas</label>
                       <textarea 
                         className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all resize-none h-24" 
                         value={editingSupplier?.notes || ""}
                         onChange={(e) => setEditingSupplier({...editingSupplier!, notes: e.target.value})}
                         placeholder="Observações sobre faturamento, prazos, etc..."
                       />
                    </div>
                 </div>

                 <div className="flex gap-4 pt-4 border-t border-slate-100">
                    <button 
                       type="button"
                       onClick={() => setIsModalOpen(false)}
                       className="flex-1 px-6 h-12 rounded-xl text-xs font-bold uppercase tracking-widest text-slate-500 hover:bg-slate-50 transition-all"
                    >
                       Cancelar
                    </button>
                    <button 
                       disabled={saveLoading}
                       type="submit"
                       className="flex-1 px-6 h-12 bg-blue-600 text-white rounded-xl text-xs font-bold uppercase tracking-widest shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                       {saveLoading ? <Loader2 size={16} className="animate-spin" /> : editingSupplier?.id ? 'Atualizar Dados' : 'Finalizar Cadastro'}
                    </button>
                 </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
