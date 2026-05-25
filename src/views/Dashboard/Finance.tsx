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
  Trash2
} from "lucide-react";
import { FinanceEntry } from "../../types";
import { cn } from "../../lib/utils";
import Modal from "../../components/ui/Modal";

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

  useEffect(() => { fetchFinance(); }, []);

  const openModal = (type: 'income' | 'expense') => {
    setNewEntry({ type, date: new Date().toISOString().split('T')[0] });
    setIsModalOpen(true);
  };

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
    <div className="space-y-6 ">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 uppercase tracking-tight">Fluxo Financeiro</h2>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest leading-none">Controle de Tesouraria & Lançamentos</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button
            onClick={() => openModal('income')}
            className="flex-1 sm:flex-none bg-emerald-600 text-white px-4 py-2.5 rounded-xl flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all active:scale-95"
          >
            <Plus size={14} /> Receita
          </button>
          <button
            onClick={() => openModal('expense')}
            className="flex-1 sm:flex-none bg-rose-600 text-white px-4 py-2.5 rounded-xl flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest shadow-lg shadow-rose-200 hover:bg-rose-700 transition-all active:scale-95"
          >
            <Minus size={14} /> Despesa
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden group">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Total Entradas</div>
          <h3 className="text-2xl font-mono font-bold text-emerald-600">R$ {totalIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
          <div className="absolute right-4 top-4 text-emerald-100 group-hover:text-emerald-200 transition-colors">
            <TrendingUp size={24} />
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden group">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Total Saídas</div>
          <h3 className="text-2xl font-mono font-bold text-rose-600">R$ {totalExpense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
          <div className="absolute right-4 top-4 text-rose-100 group-hover:text-rose-200 transition-colors">
            <TrendingDown size={24} />
          </div>
        </div>
        <div className="bg-slate-900 p-4 rounded-xl shadow-xl shadow-slate-200 text-white relative overflow-hidden">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Saldo Consolidado</div>
          <h3 className={cn("text-2xl font-mono font-bold", balance >= 0 ? "text-white" : "text-rose-400")}>
            R$ {balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </h3>
          <div className="absolute right-4 top-4 text-slate-800">
            <Wallet size={24} />
          </div>
        </div>
      </div>

      {/* Transaction List */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="px-5 py-3 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-900">Histórico de Movimentações</h3>
          <div className="flex gap-2">
            <button className="p-1.5 hover:bg-white rounded border border-transparent hover:border-slate-200 text-slate-400"><Search size={14} /></button>
            <button className="p-1.5 hover:bg-white rounded border border-transparent hover:border-slate-200 text-slate-400"><Calendar size={14} /></button>
            <button className="p-1.5 hover:bg-white rounded border border-transparent hover:border-slate-200 text-slate-400"><Download size={14} /></button>
          </div>
        </div>

        {/* Desktop table */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Descrição</th>
                <th className="px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Data</th>
                <th className="px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Categoria</th>
                <th className="px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Valor</th>
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
                  <td className="px-5 py-3 text-[10px] font-mono font-bold text-slate-500 uppercase">{new Date(entry.date).toLocaleDateString('pt-BR')}</td>
                  <td className="px-5 py-3 text-[9px] font-bold uppercase tracking-widest text-slate-400">{entry.category || "Operacional"}</td>
                  <td className={cn(
                    "px-5 py-3 text-right font-mono font-bold text-sm",
                    entry.type === 'income' ? "text-emerald-600" : "text-rose-600"
                  )}>
                    {entry.type === 'income' ? "+" : "-"} R$ {Number(entry.amount).toFixed(2)}
                  </td>
                </tr>
              ))}
              {entries.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-12 text-center text-[10px] font-bold uppercase tracking-widest text-slate-300">
                    Nenhum lançamento registrado
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile card list */}
        <div className="sm:hidden divide-y divide-slate-50">
          {entries.map((entry) => (
            <div key={entry.id} className="px-4 py-3 flex items-center gap-3">
              <div className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                entry.type === 'income' ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600"
              )}>
                {entry.type === 'income' ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-900 uppercase truncate">{entry.description}</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase">{new Date(entry.date).toLocaleDateString('pt-BR')} · {entry.category || "Operacional"}</p>
              </div>
              <span className={cn(
                "text-sm font-mono font-bold shrink-0",
                entry.type === 'income' ? "text-emerald-600" : "text-rose-600"
              )}>
                {entry.type === 'income' ? "+" : "-"}R${Number(entry.amount).toFixed(2)}
              </span>
            </div>
          ))}
          {entries.length === 0 && (
            <div className="px-4 py-12 text-center text-[10px] font-bold uppercase tracking-widest text-slate-300">
              Nenhum lançamento registrado
            </div>
          )}
        </div>
      </div>

      {/* Add Entry Modal */}
      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={`Lançamento de ${newEntry.type === 'income' ? 'Receita' : 'Despesa'}`}
        size="sm"
        footer={
          <>
            <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 h-10 border border-slate-200 text-[10px] font-bold uppercase tracking-widest rounded-lg hover:bg-slate-50 transition-colors">Cancelar</button>
            <button form="finance-form" type="submit" className={cn(
              "flex-1 h-10 text-white rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all shadow-lg",
              newEntry.type === 'income' ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200" : "bg-rose-600 hover:bg-rose-700 shadow-rose-200"
            )}>Efetivar</button>
          </>
        }
      >
        <form id="finance-form" onSubmit={handleSave} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Descrição</label>
            <input
              type="text" required
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
              value={newEntry.description || ""}
              onChange={(e) => setNewEntry({...newEntry, description: e.target.value})}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Valor (R$)</label>
            <input
              type="number" step="0.01" min="0.01" required
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm font-mono focus:ring-2 focus:ring-blue-500/20 outline-none"
              value={newEntry.amount || ""}
              onChange={(e) => setNewEntry({...newEntry, amount: Number(e.target.value)})}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Data</label>
              <input
                type="date" required
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                value={newEntry.date || ""}
                onChange={(e) => setNewEntry({...newEntry, date: e.target.value})}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Categoria</label>
              <input
                type="text"
                placeholder="Operacional"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                value={newEntry.category || ""}
                onChange={(e) => setNewEntry({...newEntry, category: e.target.value})}
              />
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
