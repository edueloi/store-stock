import React, { useState, useEffect } from "react";
import { 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  Plus, 
  Minus, 
  Search, 
  Download,
  Calendar,
  DollarSign
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { FinanceEntry } from "../../types";
import { cn } from "../../lib/utils";

export default function Finance() {
  const [entries, setEntries] = useState<FinanceEntry[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newEntry, setNewEntry] = useState<Partial<FinanceEntry>>({ type: 'expense', date: new Date().toISOString().split('T')[0] });
  const [loading, setLoading] = useState(true);

  const fetchFinance = async () => {
    try {
      const res = await fetch("/api/finance", {
        headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
      });
      const data = await res.json();
      setEntries(Array.isArray(data) ? data : []);
      setLoading(false);
    } catch (error) {
      console.error("Fetch failed", error);
    }
  };

  useEffect(() => {
    fetchFinance();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/finance", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify(newEntry)
      });
      if (res.ok) {
        setIsModalOpen(false);
        fetchFinance();
      }
    } catch (error) {
      console.error("Save failed", error);
    }
  };

  const totalIncome = entries.filter(e => e.type === 'income').reduce((acc, e) => acc + Number(e.amount), 0);
  const totalExpense = entries.filter(e => e.type === 'expense').reduce((acc, e) => acc + Number(e.amount), 0);
  const balance = totalIncome - totalExpense;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 uppercase tracking-tight">Fluxo Financeiro</h2>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest leading-none">Controle de Tesouraria & Lançamentos</p>
        </div>
        <div className="flex gap-2">
           <button 
             onClick={() => { setNewEntry({ type: 'income', date: new Date().toISOString().split('T')[0] }); setIsModalOpen(true); }}
             className="bg-emerald-600 text-white px-3 py-1.5 rounded-lg flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all"
           >
             <Plus size={14} /> Receita
           </button>
           <button 
             onClick={() => { setNewEntry({ type: 'expense', date: new Date().toISOString().split('T')[0] }); setIsModalOpen(true); }}
             className="bg-rose-600 text-white px-3 py-1.5 rounded-lg flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest shadow-lg shadow-rose-200 hover:bg-rose-700 transition-all"
           >
             <Minus size={14} /> Despesa
           </button>
        </div>
      </div>

      {/* DETAILED SUMMARY Area */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden group">
           <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Total Entradas</div>
           <h3 className="text-2xl font-mono font-bold text-emerald-600">R$ {totalIncome.toLocaleString()}</h3>
           <div className="absolute right-4 top-4 text-emerald-100 group-hover:text-emerald-200 transition-colors">
              <TrendingUp size={24} />
           </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden group">
           <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Total Saídas</div>
           <h3 className="text-2xl font-mono font-bold text-rose-600">R$ {totalExpense.toLocaleString()}</h3>
           <div className="absolute right-4 top-4 text-rose-100 group-hover:text-rose-200 transition-colors">
              <TrendingDown size={24} />
           </div>
        </div>
        <div className="bg-slate-900 p-4 rounded-xl shadow-xl shadow-slate-200 text-white relative overflow-hidden">
           <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Saldo Consolidado</div>
           <h3 className="text-2xl font-mono font-bold">R$ {balance.toLocaleString()}</h3>
           <div className="absolute right-4 top-4 text-slate-800">
              <Wallet size={24} />
           </div>
        </div>
      </div>

      {/* TRANSACTION LEDGER Area */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="px-5 py-3 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-900">Histórico de Movimentações</h3>
          <div className="flex gap-2">
            <button className="p-1.5 hover:bg-white rounded border border-transparent hover:border-slate-200 text-slate-400"><Search size={14} /></button>
            <button className="p-1.5 hover:bg-white rounded border border-transparent hover:border-slate-200 text-slate-400"><Calendar size={14} /></button>
          </div>
        </div>
        <div className="overflow-x-auto">
           <table className="w-full text-left border-collapse">
              <thead>
                 <tr className="border-b border-slate-100">
                    <th className="px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Descrição</th>
                    <th className="px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Data</th>
                    <th className="px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Categoria</th>
                    <th className="px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Valor Bruto</th>
                 </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                 {entries.map((entry) => (
                   <tr key={entry.id} className="hover:bg-slate-50/30 transition-colors">
                      <td className="px-5 py-3">
                         <div className="flex items-center gap-3">
                            <div className={cn(
                              "w-6 h-6 rounded flex items-center justify-center shrink-0",
                              entry.type === 'income' ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600"
                            )}>
                              {entry.type === 'income' ? <Plus size={10} /> : <Minus size={10} />}
                            </div>
                            <span className="text-xs font-bold text-slate-800 uppercase truncate max-w-[200px]">{entry.description}</span>
                         </div>
                      </td>
                      <td className="px-5 py-3 text-[10px] font-mono font-bold text-slate-500 uppercase">{new Date(entry.date).toLocaleDateString()}</td>
                      <td className="px-5 py-3 text-[9px] font-bold uppercase tracking-widest text-slate-400">{entry.category || "Operacional"}</td>
                      <td className={cn(
                        "px-5 py-3 text-right font-mono font-bold text-sm",
                        entry.type === 'income' ? "text-emerald-600" : "text-rose-600"
                      )}>
                        {entry.type === 'income' ? "+" : "-"} R$ {Number(entry.amount).toFixed(2)}
                      </td>
                   </tr>
                 ))}
              </tbody>
           </table>
        </div>
      </div>

      {/* FINANCIAL ENTRY MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
           <motion.div 
             initial={{ opacity: 0, scale: 0.98 }}
             animate={{ opacity: 1, scale: 1 }}
             className="bg-white w-full max-w-sm rounded-xl shadow-2xl overflow-hidden border border-slate-200"
           >
              <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
                 <h3 className="text-xs font-bold uppercase tracking-widest text-slate-900">
                    Lançamento de {newEntry.type === 'income' ? 'Receita' : 'Despesa'}
                 </h3>
              </div>
              <form onSubmit={handleSave} className="p-6 space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Descrição do Lançamento</label>
                  <input 
                    type="text" required
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold uppercase focus:ring-2 focus:ring-blue-500/20 outline-none"
                    value={newEntry.description || ""}
                    onChange={(e) => setNewEntry({...newEntry, description: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Montante (R$)</label>
                  <input 
                    type="number" step="0.01" required
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono font-bold focus:ring-2 focus:ring-blue-500/20 outline-none"
                    value={newEntry.amount || ""}
                    onChange={(e) => setNewEntry({...newEntry, amount: Number(e.target.value)})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Data Competência</label>
                  <input 
                    type="date" required
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-blue-500/20 outline-none"
                    value={newEntry.date || ""}
                    onChange={(e) => setNewEntry({...newEntry, date: e.target.value})}
                  />
                </div>
                <div className="pt-4 flex gap-3">
                   <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 h-10 border border-slate-200 text-[10px] font-bold uppercase tracking-widest rounded-lg hover:bg-slate-50 transition-colors">Cancelar</button>
                   <button type="submit" className="flex-1 h-10 bg-slate-900 text-white rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg shadow-slate-200">Efetivar Lançamento</button>
                </div>
              </form>
           </motion.div>
        </div>
      )}
    </div>
  );
}
