import React, { useState, useEffect } from "react";
import { 
  Users, 
  UserPlus, 
  Search, 
  Mail, 
  Phone, 
  MapPin, 
  FileText, 
  MoreVertical,
  ChevronRight,
  Plus
} from "lucide-react";
import { motion } from "motion/react";
import { cn } from "../../lib/utils";

interface Customer {
  id: number;
  name: string;
  email: string;
  phone: string;
  document: string;
  address: string;
  notes: string;
  created_at: string;
}

export default function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newCustomer, setNewCustomer] = useState<Partial<Customer>>({
    name: "",
    email: "",
    phone: "",
    document: "",
    address: "",
    notes: ""
  });

  const fetchCustomers = async () => {
    try {
      const res = await fetch("/api/customers", {
        headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
      });
      setCustomers(await res.json());
      setLoading(false);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const handleCreate = async () => {
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify(newCustomer)
      });
      if (res.ok) {
        setIsModalOpen(false);
        setNewCustomer({ name: "", email: "", phone: "", document: "", address: "", notes: "" });
        fetchCustomers();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.email && c.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (c.phone && c.phone.includes(searchTerm))
  );

  if (loading) return <div className="p-8 text-center text-xs font-bold uppercase tracking-widest text-slate-400">Processando Clientes...</div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 uppercase tracking-tight">CRM / Base de Clientes</h2>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest leading-none">Gestão de Relacionamento e Fidelização</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-600 text-white px-4 h-11 rounded-xl text-[10px] font-bold uppercase tracking-widest shadow-xl shadow-blue-500/20 flex items-center gap-2 hover:bg-blue-700 transition-all active:scale-95"
        >
          <UserPlus size={16} /> Novo Registro
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
        <input 
          type="text" 
          placeholder="Localizar cliente por nome, e-mail ou telefone..." 
          className="w-full pl-12 pr-4 h-12 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 text-[10px] font-bold uppercase tracking-widest placeholder:text-slate-300 shadow-sm"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCustomers.map(customer => (
          <motion.div 
            whileHover={{ y: -4 }}
            key={customer.id}
            className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-xl transition-all group"
          >
            <div className="flex justify-between items-start mb-6">
              <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 font-black text-xl uppercase border-2 border-white shadow-inner">
                {customer.name[0]}
              </div>
              <button className="text-slate-300 hover:text-slate-600 transition-colors"><MoreVertical size={18} /></button>
            </div>
            
            <div className="space-y-4">
               <div>
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-tight line-clamp-1">{customer.name}</h3>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest group-hover:text-blue-500 transition-colors">#{String(customer.id).padStart(4, '0')}</p>
               </div>

               <div className="space-y-2">
                  {customer.email && (
                    <div className="flex items-center gap-3 text-slate-500">
                       <Mail size={14} className="shrink-0" />
                       <span className="text-[10px] font-mono font-medium truncate">{customer.email}</span>
                    </div>
                  )}
                  {customer.phone && (
                    <div className="flex items-center gap-3 text-slate-500">
                       <Phone size={14} className="shrink-0" />
                       <span className="text-[10px] font-mono font-medium">{customer.phone}</span>
                    </div>
                  )}
                  {customer.address && (
                    <div className="flex items-center gap-3 text-slate-500">
                       <MapPin size={14} className="shrink-0" />
                       <span className="text-[10px] font-medium line-clamp-1 truncate">{customer.address}</span>
                    </div>
                  )}
               </div>
            </div>

            <div className="mt-8 pt-4 border-t border-slate-50 flex items-center justify-between">
               <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">Desde {new Date(customer.created_at).toLocaleDateString()}</span>
               <button className="text-[10px] font-bold text-blue-600 uppercase flex items-center gap-1 hover:gap-2 transition-all">
                  Ver Ficha <ChevronRight size={14} />
               </button>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Full customer Registration Modal could go here... Simplified creation logic for now */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
           <motion.div 
             initial={{ opacity: 0, scale: 0.95 }}
             animate={{ opacity: 1, scale: 1 }}
             className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border border-slate-200"
           >
              <div className="px-8 py-6 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                 <h4 className="text-sm font-bold uppercase tracking-widest">Expansão de Base (CRM)</h4>
                 <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">×</button>
              </div>
              <div className="p-8 space-y-4">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1 col-span-2">
                       <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nome Completo / Razão Social</label>
                       <input 
                         type="text" 
                         className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-blue-500/10" 
                         value={newCustomer.name}
                         onChange={(e) => setNewCustomer({...newCustomer, name: e.target.value})}
                       />
                    </div>
                    <div className="space-y-1">
                       <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">E-mail Corporativo</label>
                       <input 
                         type="email" 
                         className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-blue-500/10" 
                         value={newCustomer.email}
                         onChange={(e) => setNewCustomer({...newCustomer, email: e.target.value})}
                       />
                    </div>
                    <div className="space-y-1">
                       <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Telefone de Contato</label>
                       <input 
                         type="text" 
                         className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-blue-500/10" 
                         value={newCustomer.phone}
                         onChange={(e) => setNewCustomer({...newCustomer, phone: e.target.value})}
                       />
                    </div>
                    <div className="space-y-1">
                       <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">CPF / CNPJ</label>
                       <input 
                         type="text" 
                         className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-blue-500/10" 
                         value={newCustomer.document}
                         onChange={(e) => setNewCustomer({...newCustomer, document: e.target.value})}
                       />
                    </div>
                    <div className="space-y-1 col-span-2">
                       <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Endereço de Faturamento</label>
                       <input 
                         type="text" 
                         className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-blue-500/10" 
                         value={newCustomer.address}
                         onChange={(e) => setNewCustomer({...newCustomer, address: e.target.value})}
                       />
                    </div>
                 </div>
                 <div className="pt-6 flex justify-end gap-3">
                    <button 
                      onClick={() => setIsModalOpen(false)}
                      className="px-6 h-10 rounded-lg text-[10px] font-bold uppercase tracking-widest text-slate-500 border border-slate-200 hover:bg-slate-50 transition-all"
                    >
                      Cancelar
                    </button>
                    <button 
                      onClick={handleCreate}
                      className="bg-blue-600 text-white px-8 h-10 rounded-lg text-[10px] font-bold uppercase tracking-widest shadow-xl shadow-blue-500/20 hover:bg-blue-700 transition-all"
                    >
                      Confirmar Alta
                    </button>
                 </div>
              </div>
           </motion.div>
        </div>
      )}
    </div>
  );
}
