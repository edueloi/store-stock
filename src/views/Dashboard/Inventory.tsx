import React, { useState, useEffect } from "react";
import { 
  Search, 
  Plus, 
  Filter, 
  MoreVertical, 
  Edit2, 
  Trash2, 
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  Save,
  X,
  Calendar,
  Package,
  TrendingUp
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../../lib/utils";
import { Product, Category } from "../../types";

export default function Inventory() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<'sale' | 'internal'>('sale');
  
  const [variationName, setVariationName] = useState("");
  const [variationOptions, setVariationOptions] = useState("");

  const fetchInventory = async () => {
    try {
      const pRes = await fetch("/api/products", {
        headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
      });
      const cRes = await fetch("/api/categories", {
        headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
      });
      const pData = await pRes.json();
      const cData = await cRes.json();
      setProducts(Array.isArray(pData) ? pData : []);
      setCategories(Array.isArray(cData) ? cData : []);
      setLoading(false);
    } catch (error) {
      console.error("Failed to fetch inventory", error);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const method = editingProduct?.id ? "PUT" : "POST";
    const url = editingProduct?.id ? `/api/products/${editingProduct.id}` : "/api/products";
    
    // Ensure default type based on current tab if not set
    const payload = { 
      ...editingProduct, 
      type: editingProduct?.type || activeTab,
      is_active: editingProduct?.is_active ?? true,
      is_featured: editingProduct?.is_featured ?? false
    };

    try {
      const res = await fetch(url, {
        method,
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setIsModalOpen(false);
        fetchInventory();
      }
    } catch (error) {
      console.error("Save failed", error);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Tem certeza que deseja excluir este produto?")) return;
    try {
      const res = await fetch(`/api/products/${id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
      });
      if (res.ok) fetchInventory();
    } catch (error) {
      console.error("Delete failed", error);
    }
  };

  const handleAddVariation = () => {
    if (!variationName || !variationOptions) return;
    const name = variationName.trim();
    const options = variationOptions.split(',').map(o => o.trim()).filter(o => o);
    
    if (!name || options.length === 0) return;

    const currentVariations = Array.isArray(editingProduct?.variations) ? editingProduct.variations : [];
    
    // Prevent duplicate variation names
    if (currentVariations.some(v => v.name.toLowerCase() === name.toLowerCase())) {
       alert("Já existe uma variação com este nome.");
       return;
    }

    const newVariation = { name, options };
    setEditingProduct({
      ...editingProduct!,
      variations: [...currentVariations, newVariation]
    });
    setVariationName("");
    setVariationOptions("");
  };

  const removeVariation = (index: number) => {
    const next = [...(editingProduct?.variations || [])];
    next.splice(index, 1);
    setEditingProduct({ ...editingProduct!, variations: next });
  };

  const filteredProducts = products.filter(p => 
    (p.type === activeTab) &&
    (p.name.toLowerCase().includes(searchTerm.toLowerCase()) || (p.sku && p.sku.toLowerCase().includes(searchTerm.toLowerCase())))
  );

  const totalCost = filteredProducts.reduce((sum, p) => sum + (Number(p.cost_price || 0) * p.stock_quantity), 0);
  const totalValue = filteredProducts.reduce((sum, p) => sum + (Number(p.price || 0) * p.stock_quantity), 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 uppercase tracking-tight">Gestão de Inventário</h2>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest leading-none">Controle de Ativos e Mercadorias</p>
        </div>
        <button 
          onClick={() => { setEditingProduct({ type: activeTab }); setIsModalOpen(true); }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
        >
          <Plus size={14} />
          {activeTab === 'sale' ? 'Cadastrar para Venda' : 'Lançar Uso Interno'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-slate-100 rounded-lg w-fit">
         <button 
           onClick={() => setActiveTab('sale')}
           className={cn(
             "px-4 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all",
             activeTab === 'sale' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:bg-slate-50"
           )}
         >
            Catálogo de Venda
         </button>
         <button 
           onClick={() => setActiveTab('internal')}
           className={cn(
             "px-4 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all",
             activeTab === 'internal' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:bg-slate-50"
           )}
         >
            Consumo/Uso Interno
         </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 lg:gap-4">
         <div className="bg-white p-4 lg:p-5 rounded-2xl border border-slate-200 shadow-sm transition-all hover:shadow-md">
            <div className="flex items-center gap-3 mb-3">
               <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                  <Package size={16} />
               </div>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Capital Imobilizado</p>
            </div>
            <h3 className="text-2xl lg:text-3xl font-mono font-black text-slate-900 tracking-tighter">R$ {totalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h3>
            <p className="text-[9px] text-slate-400 mt-1 uppercase font-bold">Investido em {filteredProducts.length} itens ativos</p>
         </div>
         {activeTab === 'sale' && (
            <div className="bg-white p-4 lg:p-5 rounded-2xl border-2 border-emerald-500/10 shadow-sm border-l-emerald-500 border-l-4 transition-all hover:shadow-md">
               <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
                     <TrendingUp size={16} />
                  </div>
                  <p className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em]">Potencial de Faturamento</p>
               </div>
               <h3 className="text-2xl lg:text-3xl font-mono font-black text-emerald-600 tracking-tighter">R$ {totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h3>
               <p className="text-[9px] text-emerald-400 mt-1 uppercase font-bold">Expectativa Bruta de Liquidação</p>
            </div>
         )}
      </div>

      {/* SEARCH Area */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
        <input 
          type="text" 
          placeholder="FILTRAR POR NOME OU SKU..." 
          className="w-full pl-10 pr-4 h-10 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-[10px] font-bold uppercase tracking-widest placeholder:text-slate-300"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Desktop TABLE Area */}
      <div className="hidden lg:block bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-5 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Item / Identificação</th>
                <th className="px-5 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">SKU</th>
                <th className="px-5 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Custo Un.</th>
                <th className="px-5 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Venda / Promo</th>
                <th className="px-5 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Saldo Físico</th>
                <th className="px-5 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Status</th>
                <th className="px-5 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProducts.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-center shrink-0 overflow-hidden shadow-sm">
                        {p.image_url ? <img src={p.image_url} alt={p.name} className="object-cover w-full h-full group-hover:scale-110 transition-transform" /> : <ImageIcon size={16} className="text-slate-300" />}
                      </div>
                      <div className="flex flex-col">
                        <p className="text-xs font-black text-slate-900 uppercase tracking-tight">{p.name}</p>
                        {p.is_featured && <span className="text-[8px] bg-amber-500 text-white px-1.5 py-0.5 rounded-full font-black uppercase tracking-widest w-fit mt-1">Featured</span>}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-[10px] font-mono font-black text-slate-400 uppercase tracking-tighter transition-colors group-hover:text-blue-500">{p.sku || String(p.id).padStart(6, '0')}</td>
                  <td className="px-5 py-4 text-[11px] font-mono font-black text-slate-500">R$ {Number(p.cost_price || 0).toFixed(2)}</td>
                  <td className="px-5 py-4 text-[11px] font-mono font-black text-slate-900">
                    {p.discount_price ? (
                      <div>
                        <span className="line-through text-slate-300 mr-1.5">R$ {Number(p.price).toFixed(2)}</span>
                        <span className="text-emerald-600 bg-emerald-50 px-1 py-0.5 rounded">R$ {Number(p.discount_price).toFixed(2)}</span>
                      </div>
                    ) : (
                      `R$ ${Number(p.price).toFixed(2)}`
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                       <div className={cn(
                          "w-2 h-2 rounded-full",
                          p.stock_quantity <= 5 ? "bg-red-500 animate-pulse" : "bg-emerald-500"
                       )}></div>
                       <span className={cn(
                         "text-xs font-mono font-black",
                         p.stock_quantity <= 5 ? "text-red-600" : "text-slate-900"
                       )}>
                         {String(p.stock_quantity).padStart(3, '0')} <span className="text-[10px] text-slate-400">UN</span>
                       </span>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                     <div className={cn(
                         "text-[9px] font-black uppercase tracking-[0.2em] px-2 py-1 rounded-full border w-fit",
                         p.is_active ? "bg-emerald-500 text-white border-emerald-500 shadow-sm" : "bg-slate-100 text-slate-400 border-slate-200"
                     )}>
                        {p.is_active ? 'ATIVO' : 'OFFLINE'}
                     </div>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button 
                        onClick={() => { setEditingProduct(p); setIsModalOpen(true); }}
                        className="w-8 h-8 flex items-center justify-center bg-white border border-slate-200 hover:border-blue-500 text-slate-400 hover:text-blue-600 rounded-xl transition-all shadow-sm"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button 
                        onClick={() => handleDelete(p.id)}
                        className="w-8 h-8 flex items-center justify-center bg-white border border-slate-200 hover:border-red-500 text-slate-400 hover:text-red-600 rounded-xl transition-all shadow-sm"
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

      {/* Mobile Card Area */}
      <div className="lg:hidden space-y-4 pb-10">
        {filteredProducts.map((p) => (
          <motion.div 
            layout
            key={p.id}
            className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-4"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-center shrink-0 overflow-hidden shadow-inner">
                  {p.image_url ? <img src={p.image_url} alt={p.name} className="object-cover w-full h-full" /> : <ImageIcon size={20} className="text-slate-200" />}
                </div>
                <div className="flex flex-col">
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-tight leading-tight mb-1">{p.name}</h4>
                  <p className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-tighter">SKU: {p.sku || String(p.id).padStart(6, '0')}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => { setEditingProduct(p); setIsModalOpen(true); }}
                  className="w-10 h-10 flex items-center justify-center bg-blue-50 text-blue-600 rounded-xl border border-blue-100"
                >
                  <Edit2 size={16} />
                </button>
                <button 
                   onClick={() => handleDelete(p.id)}
                   className="w-10 h-10 flex items-center justify-center bg-red-50 text-red-500 rounded-xl border border-red-100"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-50">
               <div className="space-y-0.5">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Saldo Físico</p>
                  <div className="flex items-center gap-2">
                     <div className={cn("w-1.5 h-1.5 rounded-full", p.stock_quantity <= 5 ? "bg-red-500 animate-pulse" : "bg-emerald-500")}></div>
                     <p className={cn("text-sm font-mono font-black", p.stock_quantity <= 5 ? "text-red-600" : "text-slate-900")}>
                        {p.stock_quantity} <span className="text-[9px] text-slate-400">UN</span>
                     </p>
                  </div>
               </div>
               <div className="space-y-0.5 text-right">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Preço Venda</p>
                  <p className="text-sm font-mono font-black text-blue-600">
                    R$ {(p.discount_price || p.price || 0).toFixed(2)}
                  </p>
               </div>
            </div>

            <div className="flex items-center justify-between pt-2">
               <div className={cn(
                  "px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-[0.2em] border",
                  p.is_active ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-slate-50 text-slate-300 border-slate-100"
               )}>
                  {p.is_active ? 'Status: Ativo' : 'Status: Offline'}
               </div>
               {p.is_featured && (
                  <span className="text-[8px] bg-amber-500 text-white px-2 py-1 rounded-full font-black uppercase tracking-widest shadow-lg shadow-amber-200">Featured Item</span>
               )}
            </div>
          </motion.div>
        ))}
      </div>

      {/* MODAL Area */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div 
              initial={{ opacity: 0, scale: 0.98, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 10 }}
              className="bg-white w-full max-w-lg rounded-xl shadow-2xl overflow-hidden border border-slate-200"
            >
              <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-slate-900">
                    {editingProduct?.id ? "Ficha de Edição" : "Novo Cadastro"}
                  </h3>
                  <p className="text-[9px] text-slate-500 font-bold uppercase tracking-tighter">
                     Fluxo de {activeTab === 'sale' ? 'Vendas' : 'Consumo'}
                  </p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-1.5 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-600">
                  <X size={16} />
                </button>
              </div>
              
              <form onSubmit={handleSave} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">SKU / Identificador</label>
                    <input 
                      type="text" 
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono font-bold uppercase outline-none h-10"
                      value={editingProduct?.sku || ""}
                      onChange={(e) => setEditingProduct(prev => ({...prev!, sku: e.target.value}))}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Nome do Item *</label>
                    <input 
                      type="text" 
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold uppercase outline-none h-10" 
                      value={editingProduct?.name || ""}
                      onChange={(e) => setEditingProduct(prev => ({...prev!, name: e.target.value}))}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Categoria Principal</label>
                    <select 
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold uppercase outline-none h-10"
                      value={editingProduct?.category_id || ""}
                      onChange={(e) => setEditingProduct(prev => ({...prev!, category_id: Number(e.target.value)}))}
                    >
                      <option value="">Selecione...</option>
                      {categories.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-blue-500 uppercase tracking-widest px-1">Data de Validade</label>
                    <input 
                      type="date"
                      className="w-full bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-xs font-bold outline-none h-10"
                      value={editingProduct?.expiry_date || ""}
                      onChange={(e) => setEditingProduct(prev => ({...prev!, expiry_date: e.target.value}))}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Descrição Detalhada</label>
                  <textarea 
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium outline-none h-20 resize-none"
                    value={editingProduct?.description || ""}
                    onChange={(e) => setEditingProduct(prev => ({...prev!, description: e.target.value}))}
                  />
                </div>
                
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-orange-500 uppercase tracking-widest px-1">Custo Un. (R$)</label>
                    <input 
                      type="number" step="0.01"
                      className="w-full bg-orange-50 border border-orange-100 rounded-lg px-3 py-2 text-xs font-mono font-bold outline-none h-10"
                      value={editingProduct?.cost_price || ""}
                      onChange={(e) => setEditingProduct(prev => ({...prev!, cost_price: Number(e.target.value)}))}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Preço Venda (R$)</label>
                    <input 
                      type="number" step="0.01"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono font-bold outline-none h-10"
                      value={editingProduct?.price || ""}
                      onChange={(e) => setEditingProduct(prev => ({...prev!, price: Number(e.target.value)}))}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest px-1">Em Promoção (R$)</label>
                    <input 
                      type="number" step="0.01"
                      className="w-full bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 text-xs font-mono font-bold outline-none h-10"
                      value={editingProduct?.discount_price || ""}
                      onChange={(e) => setEditingProduct(prev => ({...prev!, discount_price: Number(e.target.value)}))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">URL Imagem</label>
                      <input 
                        type="text"
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-blue-500/20 outline-none h-10"
                        value={editingProduct?.image_url || ""}
                        onChange={(e) => setEditingProduct(prev => ({...prev!, image_url: e.target.value}))}
                      />
                   </div>
                   <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Estoque Atual</label>
                    <input 
                      type="number"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono font-bold focus:ring-2 focus:ring-blue-500/20 outline-none h-10"
                      value={editingProduct?.stock_quantity || 0}
                      onChange={(e) => setEditingProduct(prev => ({...prev!, stock_quantity: Number(e.target.value)}))}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-4 pt-6 mt-4 border-t border-slate-100">
                    <div className="flex items-center justify-between px-1">
                       <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-900 border-l-4 border-blue-600 pl-3">Grades e Variações</h4>
                       <p className="text-[9px] font-bold text-slate-400 uppercase">Ex: Cor, Tamanho, Voltagem</p>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3">
                       <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1">
                             <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Nome do Atributo</label>
                             <input 
                               type="text" 
                               placeholder="Ex: Cor" 
                               className="w-full bg-white border border-slate-200 rounded-lg px-3 text-[11px] font-bold uppercase outline-none h-10 focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all"
                               value={variationName}
                               onChange={(e) => setVariationName(e.target.value)}
                             />
                          </div>
                          <div className="space-y-1">
                             <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Opções (Separadas por vírgula)</label>
                             <input 
                               type="text" 
                               placeholder="Ex: Azul, Vermelho, Preto" 
                               className="w-full bg-white border border-slate-200 rounded-lg px-3 text-[11px] font-bold uppercase outline-none h-10 focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all"
                               value={variationOptions}
                               onChange={(e) => setVariationOptions(e.target.value)}
                               onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddVariation())}
                             />
                          </div>
                       </div>
                       <button 
                         type="button"
                         onClick={handleAddVariation}
                         disabled={!variationName || !variationOptions}
                         className="w-full bg-slate-900 text-white h-10 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-black transition-all disabled:opacity-50"
                       >
                          <Plus size={14} strokeWidth={3} /> Anexar Variação
                       </button>
                    </div>
                    
                    <div className="space-y-2">
                       {Array.isArray(editingProduct?.variations) && editingProduct.variations.length > 0 ? (
                         <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {editingProduct.variations.map((v: any, idx: number) => (
                              <motion.div 
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                key={idx} 
                                className="bg-white border border-slate-200 rounded-xl p-3 flex items-center justify-between group hover:border-blue-200 transition-colors"
                              >
                                 <div className="leading-tight">
                                    <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest">{v.name}</p>
                                    <div className="flex flex-wrap gap-1 mt-1">
                                       {v.options.map((opt: string, oIdx: number) => (
                                          <span key={oIdx} className="text-[8px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded uppercase">{opt}</span>
                                       ))}
                                    </div>
                                 </div>
                                 <button 
                                   type="button" 
                                   onClick={() => removeVariation(idx)} 
                                   className="w-7 h-7 flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                 >
                                    <Trash2 size={12} />
                                 </button>
                              </motion.div>
                            ))}
                         </div>
                       ) : (
                          <div className="py-8 border-2 border-dashed border-slate-100 rounded-2xl flex flex-col items-center justify-center text-slate-400">
                             <p className="text-[9px] font-black uppercase tracking-[0.2em]">Nenhuma variação definida</p>
                             <p className="text-[8px] font-medium mt-1">Adicione atributos para gerenciar estoque por grade.</p>
                          </div>
                       )}
                    </div>
                </div>

                <div className="flex gap-4 pt-2">
                   <label className="flex items-center gap-2 cursor-pointer group">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" 
                        checked={editingProduct?.is_active ?? true}
                        onChange={(e) => setEditingProduct({...editingProduct, is_active: e.target.checked})}
                      />
                      <span className="text-[10px] font-bold uppercase text-slate-500 group-hover:text-slate-900 transition-colors">Ativo no Catálogo</span>
                   </label>
                   {activeTab === 'sale' && (
                     <label className="flex items-center gap-2 cursor-pointer group">
                        <input 
                          type="checkbox" 
                          className="w-4 h-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500" 
                          checked={editingProduct?.is_featured ?? false}
                          onChange={(e) => setEditingProduct({...editingProduct, is_featured: e.target.checked})}
                        />
                        <span className="text-[10px] font-bold uppercase text-slate-500 group-hover:text-slate-900 transition-colors">Destaque na Home</span>
                     </label>
                   )}
                </div>

                <div className="pt-4 flex gap-3">
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 h-10 border border-slate-200 text-[10px] font-bold uppercase tracking-widest rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    Descartar
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 h-10 bg-slate-900 text-white text-[10px] font-bold uppercase tracking-widest rounded-lg hover:bg-slate-800 transition-all flex items-center justify-center gap-2 shadow-lg shadow-slate-200"
                  >
                    <Save size={14} />
                    Efetivar Cadastro
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
