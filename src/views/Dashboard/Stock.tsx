import React, { useState, useEffect } from "react";
import { 
  Plus, 
  Minus, 
  Search, 
  History, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle,
  ArrowRightLeft,
  X,
  Check,
  Package,
  Calendar,
  Layers,
  ClipboardList
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Product } from "../../types";
import { cn } from "../../lib/utils";

interface StockMovement {
  id: number;
  product_name: string;
  quantity: number;
  type: string;
  reason: string;
  created_at: string;
}

export default function Stock() {
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [adjustmentValue, setAdjustmentValue] = useState(0);
  const [adjustmentType, setAdjustmentType] = useState("adjustment");
  const [adjustmentReason, setAdjustmentReason] = useState("");
  const [activeView, setActiveView] = useState<'inventory' | 'history'>('inventory');

  const fetchData = async () => {
    try {
      const pRes = await fetch("/api/products", {
        headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
      });
      const mRes = await fetch("/api/products/movements", {
        headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
      });
      setProducts(await pRes.json());
      setMovements(await mRes.json());
      setLoading(false);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAdjustment = async () => {
    if (!selectedProduct) return;
    try {
      const res = await fetch("/api/products/stock-adjustment", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify({
          productId: selectedProduct.id,
          quantity: adjustmentValue,
          type: adjustmentType,
          reason: adjustmentReason
        })
      });
      if (res.ok) {
        setIsAdjustmentModalOpen(false);
        setAdjustmentValue(0);
        setAdjustmentReason("");
        setAdjustmentType("adjustment");
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filteredProducts = (Array.isArray(products) ? products : []).filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (p.sku && p.sku.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const lowStockCount = filteredProducts.filter(p => p.stock_quantity <= 5).length;
  const totalItems = filteredProducts.reduce((acc, p) => acc + p.stock_quantity, 0);
  const totalCost = filteredProducts.reduce((acc, p) => acc + (Number(p.cost_price || 0) * p.stock_quantity), 0);

  if (loading) return <div className="p-8 text-center text-xs font-bold uppercase tracking-widest text-slate-400">Processando Inventário...</div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 uppercase tracking-tight">Controle Técnico de Estoque</h2>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest leading-none underline decoration-blue-500/30">Gestão de Ativos, Insumos e Movimentações</p>
        </div>
        <div className="flex gap-2">
            <button 
              onClick={() => setActiveView('inventory')}
              className={cn(
                "h-10 px-4 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all flex items-center gap-2",
                activeView === 'inventory' ? "bg-slate-900 text-white shadow-lg shadow-slate-200" : "bg-white border border-slate-200 text-slate-500 hover:bg-slate-50"
              )}
            >
               <Package size={14} /> Posicionamento
            </button>
            <button 
              onClick={() => setActiveView('history')}
              className={cn(
                "h-10 px-4 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all flex items-center gap-2",
                activeView === 'history' ? "bg-slate-900 text-white shadow-lg shadow-slate-200" : "bg-white border border-slate-200 text-slate-500 hover:bg-slate-50"
              )}
            >
               <History size={14} /> Auditoria
            </button>
        </div>
      </div>

      {/* Highlights Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
         <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
            <div className="flex items-center justify-between mb-3 text-slate-400">
               <Layers size={16} />
               <TrendingUp size={14} className="text-emerald-500" />
            </div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Volume Armazenado</p>
            <h3 className="text-2xl font-black text-slate-900 tracking-tighter">{totalItems} <span className="text-xs font-bold text-slate-300">UN</span></h3>
         </div>
         <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm border-l-4 border-l-blue-500">
            <div className="flex items-center justify-between mb-3 text-slate-400">
               <TrendingUp size={16} />
            </div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Capital Imobilizado</p>
            <h3 className="text-2xl font-black text-blue-600 tracking-tighter font-mono">R$ {totalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h3>
         </div>
         <div className={cn(
           "bg-white p-5 rounded-2xl border border-slate-100 shadow-sm",
           lowStockCount > 0 ? "border-l-4 border-l-red-500 animate-pulse" : ""
         )}>
            <div className="flex items-center justify-between mb-3 text-slate-400">
               <AlertTriangle size={16} className={lowStockCount > 0 ? "text-red-500" : ""} />
            </div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Alertas de Crítica</p>
            <h3 className={cn("text-2xl font-black tracking-tighter", lowStockCount > 0 ? "text-red-600" : "text-slate-900")}>
               {lowStockCount} <span className="text-xs font-bold text-slate-300">ITENS</span>
            </h3>
         </div>
         <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
            <div className="flex items-center justify-between mb-3 text-slate-400">
               <ClipboardList size={16} />
            </div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Movimentos (30 dias)</p>
            <h3 className="text-2xl font-black text-slate-900 tracking-tighter">{movements.length} <span className="text-xs font-bold text-slate-300">OPS</span></h3>
         </div>
      </div>

      {activeView === 'inventory' ? (
        <div className="space-y-4">
           {/* Filters */}
           <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text" 
                placeholder="Rastrear Item por Descritivo ou SKU Industrial..." 
                className="w-full pl-12 pr-4 h-12 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 text-[10px] font-bold uppercase tracking-widest placeholder:text-slate-300"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
           </div>

           {/* Inventory Table */}
           <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
               <table className="w-full text-left">
                  <thead>
                     <tr className="bg-slate-50 border-b border-slate-100">
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ativo / SKU</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Validade</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Custo Med.</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Saldo Físico</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Impacto Finan.</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Ajustar</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                     {filteredProducts.map(p => (
                        <tr key={p.id} className="hover:bg-slate-50/50 transition-colors group">
                           <td className="px-6 py-4">
                              <div className="flex flex-col">
                                 <span className="text-xs font-bold text-slate-900 uppercase">{p.name}</span>
                                 <span className="text-[9px] font-mono text-slate-400 uppercase">SKU: {p.sku || String(p.id).padStart(6, '0')}</span>
                              </div>
                           </td>
                           <td className="px-6 py-4">
                              {p.expiry_date ? (
                                 <div className={cn(
                                    "flex items-center gap-1 text-[10px] font-bold uppercase",
                                    new Date(p.expiry_date) < new Date() ? "text-red-500" : "text-slate-500"
                                 )}>
                                    <Calendar size={12} />
                                    {new Date(p.expiry_date).toLocaleDateString()}
                                 </div>
                              ) : (
                                 <span className="text-[9px] text-slate-300 font-bold uppercase">N/A</span>
                              )}
                           </td>
                           <td className="px-6 py-4 text-[11px] font-mono font-bold text-slate-500">R$ {Number(p.cost_price || 0).toFixed(2)}</td>
                           <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                 <span className={cn(
                                    "text-xs font-mono font-bold",
                                    p.stock_quantity <= 5 ? "text-red-500" : "text-slate-900"
                                 )}>
                                    {String(p.stock_quantity).padStart(3, '0')}
                                 </span>
                                 {p.stock_quantity <= 5 && <AlertTriangle size={12} className="text-red-500" />}
                              </div>
                           </td>
                           <td className="px-6 py-4 text-[11px] font-mono font-bold text-slate-900">R$ {(Number(p.cost_price || 0) * p.stock_quantity).toFixed(2)}</td>
                           <td className="px-6 py-4 text-right">
                              <button 
                                 onClick={() => { setSelectedProduct(p); setIsAdjustmentModalOpen(true); }}
                                 className="w-8 h-8 rounded-lg bg-slate-100 text-slate-400 hover:bg-slate-900 hover:text-white transition-all flex items-center justify-center mx-auto md:ml-auto md:mr-0 shadow-sm"
                              >
                                 <Plus size={14} />
                              </button>
                           </td>
                        </tr>
                     ))}
                  </tbody>
               </table>
           </div>
        </div>
      ) : (
        <div className="space-y-4">
           <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
               <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Logs de Auditoria Industrial</h3>
                  <History size={14} className="text-slate-300" />
               </div>
               <table className="w-full text-left">
                  <thead>
                     <tr className="border-b border-slate-50">
                        <th className="px-6 py-4 text-[9px] font-bold text-slate-400 uppercase tracking-widest">Timestamp</th>
                        <th className="px-6 py-4 text-[9px] font-bold text-slate-400 uppercase tracking-widest">Item / Operação</th>
                        <th className="px-6 py-4 text-[9px] font-bold text-slate-400 uppercase tracking-widest">Variação</th>
                        <th className="px-6 py-4 text-[9px] font-bold text-slate-400 uppercase tracking-widest">Contexto / Justificativa</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                     {movements.map(m => (
                        <tr key={m.id} className="hover:bg-slate-50/50 transition-colors">
                           <td className="px-6 py-4 text-[10px] font-mono text-slate-400 whitespace-nowrap">
                              {new Date(m.created_at).toLocaleString()}
                           </td>
                           <td className="px-6 py-4">
                              <div className="flex flex-col">
                                 <span className="text-[10px] font-bold text-slate-900 uppercase">{m.product_name}</span>
                                 <span className="text-[8px] font-bold text-blue-500 uppercase tracking-widest">{m.type}</span>
                              </div>
                           </td>
                           <td className="px-6 py-4">
                              <span className={cn(
                                 "text-[11px] font-mono font-bold",
                                 m.quantity > 0 ? "text-emerald-500" : "text-red-500"
                              )}>
                                 {m.quantity > 0 ? '+' : ''}{m.quantity} UN
                              </span>
                           </td>
                           <td className="px-6 py-4">
                              <p className="text-[10px] text-slate-500 font-medium italic">{m.reason || "Sem observações registradas."}</p>
                           </td>
                        </tr>
                     ))}
                  </tbody>
               </table>
           </div>
        </div>
      )}

      {/* Adjustment Modal */}
      <AnimatePresence>
         {isAdjustmentModalOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
               <motion.div 
                 initial={{ opacity: 0, scale: 0.95 }}
                 animate={{ opacity: 1, scale: 1 }}
                 exit={{ opacity: 0, scale: 0.95 }}
                 className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden border border-slate-200"
               >
                  <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                     <div className="flex items-center gap-2">
                        <ArrowRightLeft size={16} className="text-blue-500" />
                        <h4 className="text-xs font-bold uppercase tracking-widest">Retificação de Saldo</h4>
                     </div>
                     <button onClick={() => setIsAdjustmentModalOpen(false)} className="p-1 hover:bg-slate-200 rounded text-slate-400 transition-all"><X size={16} /></button>
                  </div>
                  
                  <div className="p-6 space-y-6">
                     <div className="text-center p-4 bg-slate-50 rounded-xl">
                        <p className="text-[9px] font-bold uppercase text-slate-400 tracking-widest mb-1">Item Selecionado</p>
                        <h5 className="text-xs font-bold text-slate-900 uppercase">{selectedProduct?.name}</h5>
                        <p className="text-[11px] font-mono font-bold text-blue-600 mt-2">SALDO ATUAL: {selectedProduct?.stock_quantity} UN</p>
                     </div>

                     <div className="space-y-4">
                        <div className="space-y-1">
                           <label className="text-[9px] font-bold uppercase text-slate-400 tracking-widest px-1">Natureza da Operação</label>
                           <div className="grid grid-cols-2 gap-2">
                              {['purchase', 'adjustment', 'loss', 'return'].map(type => (
                                 <button 
                                    key={type}
                                    onClick={() => setAdjustmentType(type)}
                                    className={cn(
                                       "h-8 rounded-lg text-[9px] font-bold uppercase border transition-all",
                                       adjustmentType === type ? "bg-slate-900 text-white border-slate-900 shadow-lg" : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                                    )}
                                 >
                                    {type}
                                 </button>
                              ))}
                           </div>
                        </div>

                        <div className="space-y-1">
                           <label className="text-[9px] font-bold uppercase text-slate-400 tracking-widest px-1">Quantidade Variada</label>
                           <div className="flex items-center gap-4">
                              <button 
                                 onClick={() => setAdjustmentValue(prev => prev - 1)}
                                 className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center hover:bg-red-50 text-red-500 transition-all border border-transparent active:scale-95"
                              >
                                 <Minus size={18} />
                              </button>
                              <div className="flex-1 text-center">
                                 <span className={cn(
                                    "text-2xl font-mono font-bold tracking-tighter",
                                    adjustmentValue > 0 ? "text-emerald-500" : adjustmentValue < 0 ? "text-red-500" : "text-slate-900"
                                 )}>
                                    {adjustmentValue > 0 ? '+' : ''}{adjustmentValue}
                                 </span>
                              </div>
                              <button 
                                 onClick={() => setAdjustmentValue(prev => prev + 1)}
                                 className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center hover:bg-emerald-50 text-emerald-500 transition-all border border-transparent active:scale-95"
                              >
                                 <Plus size={18} />
                              </button>
                           </div>
                           <p className="text-[8px] text-center text-slate-400 font-bold uppercase mt-1">Use os controles para somar ou subtrair</p>
                        </div>

                        <div className="space-y-1">
                           <label className="text-[9px] font-bold uppercase text-slate-400 tracking-widest px-1">Justificativa Operacional</label>
                           <textarea 
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-[10px] font-medium h-16 outline-none focus:ring-2 focus:ring-blue-500/10 transition-all"
                              placeholder="Explique o motivo desta variação..."
                              value={adjustmentReason}
                              onChange={(e) => setAdjustmentReason(e.target.value)}
                           />
                        </div>
                     </div>

                     <button 
                        onClick={handleAdjustment}
                        disabled={adjustmentValue === 0}
                        className="w-full h-11 bg-blue-600 text-white rounded-xl text-[10px] font-bold uppercase tracking-[0.2em] shadow-xl shadow-blue-500/20 hover:bg-blue-700 disabled:opacity-50 disabled:grayscale transition-all flex items-center justify-center gap-2 group"
                     >
                        <Check size={16} className="group-hover:scale-110 transition-transform" />
                        Formalizar Mudança
                     </button>
                  </div>
               </motion.div>
            </div>
         )}
      </AnimatePresence>
    </div>
  );
}
