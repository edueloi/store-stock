import React, { useState, useEffect } from "react";
import { Plus, Edit2, Trash2, Image as ImageIcon, Save, X, Package, TrendingUp } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../../lib/utils";
import { Product, Category } from "../../types";
import Button from "../../components/ui/Button";
import { Input, Select, Textarea } from "../../components/ui/Input";
import Modal from "../../components/ui/Modal";
import PageHeader from "../../components/layout/PageHeader";
import SearchBar from "../../components/layout/SearchBar";
import { EmptyState, LoadingState } from "../../components/layout/EmptyState";
import { StatCard } from "../../components/ui/Card";
import { ActiveBadge } from "../../components/ui/Badge";

export default function Inventory() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<'sale' | 'internal'>('sale');
  
  const [variationName, setVariationName] = useState("");
  // newOptionInput: controle de adicionar opção individual com estoque
  const [newOptValue, setNewOptValue] = useState("");
  const [newOptStock, setNewOptStock] = useState<number>(0);
  const [pendingOptions, setPendingOptions] = useState<{ value: string; stock: number }[]>([]);

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

  const handleAddPendingOption = () => {
    const v = newOptValue.trim();
    if (!v) return;
    if (pendingOptions.some(o => o.value.toLowerCase() === v.toLowerCase())) return;
    setPendingOptions(prev => [...prev, { value: v, stock: newOptStock }]);
    setNewOptValue("");
    setNewOptStock(0);
  };

  const removePendingOption = (idx: number) => {
    setPendingOptions(prev => prev.filter((_, i) => i !== idx));
  };

  const handleAddVariation = () => {
    const name = variationName.trim();
    if (!name || pendingOptions.length === 0) return;

    const currentVariations = Array.isArray(editingProduct?.variations) ? editingProduct.variations : [];
    if (currentVariations.some(v => v.name.toLowerCase() === name.toLowerCase())) {
      alert("Já existe uma variação com este nome.");
      return;
    }

    setEditingProduct({
      ...editingProduct!,
      variations: [...currentVariations, { name, options: pendingOptions }],
    });
    setVariationName("");
    setPendingOptions([]);
    setNewOptValue("");
    setNewOptStock(0);
  };

  const removeVariation = (index: number) => {
    const next = [...(editingProduct?.variations || [])];
    next.splice(index, 1);
    setEditingProduct({ ...editingProduct!, variations: next });
  };

  const updateOptionStock = (varIdx: number, optIdx: number, stock: number) => {
    const vars = [...(editingProduct?.variations || [])];
    vars[varIdx] = {
      ...vars[varIdx],
      options: vars[varIdx].options.map((o, i) => i === optIdx ? { ...o, stock } : o),
    };
    setEditingProduct({ ...editingProduct!, variations: vars });
  };

  const filteredProducts = products.filter(p => 
    (p.type === activeTab) &&
    (p.name.toLowerCase().includes(searchTerm.toLowerCase()) || (p.sku && p.sku.toLowerCase().includes(searchTerm.toLowerCase())))
  );

  const totalCost = filteredProducts.reduce((sum, p) => sum + (Number(p.cost_price || 0) * p.stock_quantity), 0);
  const totalValue = filteredProducts.reduce((sum, p) => sum + (Number(p.price || 0) * p.stock_quantity), 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader
        title="Catálogo / Inventário"
        subtitle="Controle de ativos e mercadorias"
        action={
          <Button icon={<Plus size={14} />} onClick={() => { setEditingProduct({ type: activeTab }); setIsModalOpen(true); }}>
            {activeTab === "sale" ? "Cadastrar Produto" : "Lançar Interno"}
          </Button>
        }
      />

      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-slate-100 rounded-xl w-fit">
        {(["sale", "internal"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all",
              activeTab === tab ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:bg-slate-50"
            )}
          >
            {tab === "sale" ? "Catálogo de Venda" : "Uso Interno"}
          </button>
        ))}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:gap-4">
        <StatCard
          label="Capital Imobilizado"
          value={`R$ ${totalCost.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
          icon={<Package />}
          accent="blue"
        />
        {activeTab === "sale" && (
          <StatCard
            label="Potencial de Faturamento"
            value={`R$ ${totalValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
            icon={<TrendingUp />}
            accent="emerald"
          />
        )}
      </div>

      <SearchBar
        value={searchTerm}
        onChange={setSearchTerm}
        placeholder="Filtrar por nome ou SKU..."
      />

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
                    R$ {Number(p.discount_price || p.price || 0).toFixed(2)}
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

      {/* MODAL */}
      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingProduct?.id ? "Editar Produto" : "Novo Produto"}
        subtitle={`Fluxo de ${activeTab === "sale" ? "Vendas" : "Consumo Interno"}`}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>Descartar</Button>
            <Button form="product-form" type="submit" icon={<Save size={13} />}>
              {editingProduct?.id ? "Salvar Alterações" : "Efetivar Cadastro"}
            </Button>
          </>
        }
      >
        {true && (
              
        <form id="product-form" onSubmit={handleSave} className="space-y-4">
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

                {/* ── GRADES E VARIAÇÕES ── */}
                <div className="space-y-4 pt-6 mt-4 border-t border-slate-100">
                  <div className="flex items-center justify-between px-1">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-900 border-l-4 border-blue-600 pl-3">Grades e Variações</h4>
                    <p className="text-[9px] font-bold text-slate-400 uppercase">Ex: Tamanho, Cor</p>
                  </div>

                  {/* Bloco para criar nova variação */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                    {/* Nome do atributo */}
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-1">Nome do Atributo</label>
                      <input
                        type="text"
                        placeholder="Ex: Tamanho, Cor, Voltagem..."
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 text-[11px] font-bold uppercase outline-none h-10 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all"
                        value={variationName}
                        onChange={(e) => setVariationName(e.target.value)}
                      />
                    </div>

                    {/* Adicionar opções com estoque individual */}
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-1">Opções da Grade</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Valor (ex: P, M, G)"
                          className="flex-1 bg-white border border-slate-200 rounded-lg px-3 text-[11px] font-bold uppercase outline-none h-10 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all"
                          value={newOptValue}
                          onChange={(e) => setNewOptValue(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddPendingOption())}
                        />
                        <input
                          type="number"
                          min="0"
                          placeholder="Qtd"
                          className="w-20 bg-white border border-slate-200 rounded-lg px-3 text-[11px] font-mono font-bold outline-none h-10 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all text-center"
                          value={newOptStock === 0 ? "" : newOptStock}
                          onChange={(e) => setNewOptStock(Number(e.target.value))}
                          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddPendingOption())}
                        />
                        <button
                          type="button"
                          onClick={handleAddPendingOption}
                          disabled={!newOptValue.trim()}
                          className="w-10 h-10 flex items-center justify-center bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all disabled:opacity-40 shrink-0"
                        >
                          <Plus size={16} strokeWidth={3} />
                        </button>
                      </div>

                      {/* Lista de opções pendentes */}
                      {pendingOptions.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {pendingOptions.map((opt, i) => (
                            <div key={i} className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 rounded-lg px-2.5 py-1.5 text-[10px] font-black text-blue-700 uppercase">
                              <span>{opt.value}</span>
                              <span className="text-blue-400">·</span>
                              <span className="font-mono">{opt.stock} un</span>
                              <button type="button" onClick={() => removePendingOption(i)} className="ml-1 text-blue-400 hover:text-red-500 transition-colors">
                                <X size={10} strokeWidth={3} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={handleAddVariation}
                      disabled={!variationName.trim() || pendingOptions.length === 0}
                      className="w-full bg-slate-900 text-white h-10 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-black transition-all disabled:opacity-40"
                    >
                      <Plus size={14} strokeWidth={3} /> Confirmar Variação
                    </button>
                  </div>

                  {/* Variações já salvas no produto */}
                  <div className="space-y-3">
                    {Array.isArray(editingProduct?.variations) && editingProduct.variations.length > 0 ? (
                      editingProduct.variations.map((v, varIdx) => (
                        <motion.div
                          key={varIdx}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="bg-white border border-slate-200 rounded-xl p-4 space-y-3"
                        >
                          <div className="flex items-center justify-between">
                            <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest">{v.name}</p>
                            <button
                              type="button"
                              onClick={() => removeVariation(varIdx)}
                              className="w-7 h-7 flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {v.options.map((opt, optIdx) => (
                              <div key={optIdx} className="flex flex-col gap-1 bg-slate-50 rounded-lg p-2 border border-slate-100">
                                <span className="text-[9px] font-black uppercase tracking-widest text-slate-700">{opt.value}</span>
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    min="0"
                                    className="w-full bg-white border border-slate-200 rounded px-2 text-[11px] font-mono font-black outline-none h-8 text-center focus:border-blue-500 transition-all"
                                    value={opt.stock}
                                    onChange={(e) => updateOptionStock(varIdx, optIdx, Number(e.target.value))}
                                  />
                                  <span className="text-[9px] font-bold text-slate-400 shrink-0">un</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      ))
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

        </form>
        )}
      </Modal>
    </div>
  );
}
