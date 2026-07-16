import React, { useState, useEffect } from "react";
import {
  Plus,
  Minus,
  Search,
  History,
  TrendingUp,
  AlertTriangle,
  ArrowRightLeft,
  Check,
  Package,
  Calendar,
  Layers,
  ClipboardList,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import PageHeader from "../../components/layout/PageHeader";
import { Product } from "../../types";
import { cn } from "../../lib/utils";
import Modal from "../../components/ui/Modal";

interface StockMovement {
  id: number;
  product_name: string;
  quantity: number;
  type: string;
  reason: string;
  created_at: string;
}

const TYPE_LABELS: Record<string, string> = {
  purchase: "Compra",
  adjustment: "Ajuste",
  loss: "Perda",
  return: "Devolução",
};

function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between px-2">
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
        Página {page} de {totalPages}
      </p>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          className="w-9 h-9 rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40 flex items-center justify-center transition-all"
        >
          <ChevronLeft size={14} />
        </button>
        <button
          onClick={() => onChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          className="w-9 h-9 rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40 flex items-center justify-center transition-all"
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
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
  const [inventoryPage, setInventoryPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const PAGE_SIZE = 20;

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

  useEffect(() => { fetchData(); }, []);

  const openAdjust = (p: Product) => {
    setSelectedProduct(p);
    setAdjustmentValue(0);
    setAdjustmentReason("");
    setAdjustmentType("adjustment");
    setIsAdjustmentModalOpen(true);
  };

  const handleAdjustment = async () => {
    if (!selectedProduct || adjustmentValue === 0) return;
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

  useEffect(() => { setInventoryPage(1); }, [searchTerm]);

  const inventoryTotalPages = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE));
  const pagedProducts = filteredProducts.slice(
    (inventoryPage - 1) * PAGE_SIZE,
    inventoryPage * PAGE_SIZE,
  );

  const historyTotalPages = Math.max(1, Math.ceil(movements.length / PAGE_SIZE));
  const pagedMovements = movements.slice(
    (historyPage - 1) * PAGE_SIZE,
    historyPage * PAGE_SIZE,
  );

  if (loading) return <div className="p-8 text-center text-xs font-bold uppercase tracking-widest text-slate-400">Processando Inventário...</div>;

  return (
    <div className="space-y-6 ">
      <PageHeader
        title="Estoque"
        subtitle="Gestão de ativos, insumos e movimentações"
        action={
          <div className="flex gap-2">
            <button
              onClick={() => setActiveView('inventory')}
              className={cn(
                "h-9 px-4 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all flex items-center gap-2",
                activeView === 'inventory' ? "bg-slate-900 text-white shadow-sm" : "bg-white border border-slate-200 text-slate-500 hover:bg-slate-50"
              )}
            >
              <Package size={13} /> Posição
            </button>
            <button
              onClick={() => setActiveView('history')}
              className={cn(
                "h-9 px-4 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all flex items-center gap-2",
                activeView === 'history' ? "bg-slate-900 text-white shadow-sm" : "bg-white border border-slate-200 text-slate-500 hover:bg-slate-50"
              )}
            >
              <History size={13} /> Auditoria
            </button>
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-2 text-slate-400">
            <Layers size={16} />
            <TrendingUp size={14} className="text-emerald-500" />
          </div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Volume Total</p>
          <h3 className="text-2xl font-black text-slate-900 tracking-tighter">{totalItems} <span className="text-xs font-bold text-slate-300">UN</span></h3>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm border-l-4 border-l-blue-500">
          <div className="flex items-center justify-between mb-2 text-slate-400">
            <TrendingUp size={16} />
          </div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Capital</p>
          <h3 className="text-xl font-black text-blue-600 tracking-tighter font-mono">R${totalCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
        </div>
        <div className={cn(
          "bg-white p-4 rounded-2xl border border-slate-100 shadow-sm",
          lowStockCount > 0 ? "border-l-4 border-l-red-500" : ""
        )}>
          <div className="flex items-center justify-between mb-2 text-slate-400">
            <AlertTriangle size={16} className={lowStockCount > 0 ? "text-red-500" : ""} />
          </div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Críticos</p>
          <h3 className={cn("text-2xl font-black tracking-tighter", lowStockCount > 0 ? "text-red-600" : "text-slate-900")}>
            {lowStockCount} <span className="text-xs font-bold text-slate-300">ITENS</span>
          </h3>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-2 text-slate-400">
            <ClipboardList size={16} />
          </div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Movimentos</p>
          <h3 className="text-2xl font-black text-slate-900 tracking-tighter">{movements.length} <span className="text-xs font-bold text-slate-300">OPS</span></h3>
        </div>
      </div>

      {activeView === 'inventory' ? (
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Buscar por nome ou SKU..."
              className="w-full pl-12 pr-4 h-11 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 text-sm placeholder:text-slate-300"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Produto / SKU</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Validade</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Custo</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Saldo</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Impacto</th>
                  <th className="px-6 py-4 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {pagedProducts.map(p => (
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
                          {new Date(p.expiry_date).toLocaleDateString('pt-BR')}
                        </div>
                      ) : (
                        <span className="text-[9px] text-slate-300 font-bold uppercase">N/A</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-[11px] font-mono font-bold text-slate-500">R$ {Number(p.cost_price || 0).toFixed(2)}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className={cn("text-xs font-mono font-bold", p.stock_quantity <= 5 ? "text-red-500" : "text-slate-900")}>
                          {String(p.stock_quantity).padStart(3, '0')}
                        </span>
                        {p.stock_quantity <= 5 && <AlertTriangle size={12} className="text-red-500" />}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-[11px] font-mono font-bold text-slate-900">R$ {(Number(p.cost_price || 0) * p.stock_quantity).toFixed(2)}</td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => openAdjust(p)}
                        className="w-8 h-8 rounded-lg bg-slate-100 text-slate-400 hover:bg-slate-900 hover:text-white transition-all flex items-center justify-center ml-auto"
                      >
                        <ArrowRightLeft size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredProducts.length === 0 && (
                  <tr><td colSpan={6} className="px-6 py-12 text-center text-[10px] font-bold uppercase tracking-widest text-slate-300">Nenhum produto encontrado</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile card list */}
          <div className="sm:hidden space-y-3">
            {pagedProducts.map(p => (
              <div key={p.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 uppercase truncate">{p.name}</p>
                    <p className="text-[9px] font-mono text-slate-400 uppercase">SKU: {p.sku || String(p.id).padStart(6, '0')}</p>
                  </div>
                  <button
                    onClick={() => openAdjust(p)}
                    className="shrink-0 w-9 h-9 rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-900 hover:text-white transition-all flex items-center justify-center"
                  >
                    <ArrowRightLeft size={14} />
                  </button>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "text-lg font-mono font-black tracking-tighter",
                      p.stock_quantity <= 5 ? "text-red-500" : "text-slate-900"
                    )}>
                      {p.stock_quantity}
                    </span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase">un</span>
                    {p.stock_quantity <= 5 && <AlertTriangle size={12} className="text-red-500" />}
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-bold text-slate-400 uppercase">Custo unit.</p>
                    <p className="text-xs font-mono font-bold text-slate-700">R$ {Number(p.cost_price || 0).toFixed(2)}</p>
                  </div>
                </div>
              </div>
            ))}
            {filteredProducts.length === 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-[10px] font-bold uppercase tracking-widest text-slate-300">
                Nenhum produto encontrado
              </div>
            )}
          </div>

          <Pagination page={inventoryPage} totalPages={inventoryTotalPages} onChange={setInventoryPage} />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Desktop table */}
          <div className="hidden sm:block bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Logs de Auditoria</h3>
              <History size={14} className="text-slate-300" />
            </div>
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-50">
                  <th className="px-6 py-4 text-[9px] font-bold text-slate-400 uppercase tracking-widest">Data/Hora</th>
                  <th className="px-6 py-4 text-[9px] font-bold text-slate-400 uppercase tracking-widest">Produto</th>
                  <th className="px-6 py-4 text-[9px] font-bold text-slate-400 uppercase tracking-widest">Tipo</th>
                  <th className="px-6 py-4 text-[9px] font-bold text-slate-400 uppercase tracking-widest">Qtd</th>
                  <th className="px-6 py-4 text-[9px] font-bold text-slate-400 uppercase tracking-widest">Justificativa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {pagedMovements.map(m => (
                  <tr key={m.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 text-[10px] font-mono text-slate-400 whitespace-nowrap">
                      {new Date(m.created_at).toLocaleString('pt-BR')}
                    </td>
                    <td className="px-6 py-4 text-[10px] font-bold text-slate-900 uppercase">{m.product_name}</td>
                    <td className="px-6 py-4">
                      <span className="text-[9px] font-bold text-blue-500 uppercase tracking-widest bg-blue-50 px-2 py-0.5 rounded">
                        {TYPE_LABELS[m.type] || m.type}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn("text-[11px] font-mono font-bold", m.quantity > 0 ? "text-emerald-500" : "text-red-500")}>
                        {m.quantity > 0 ? '+' : ''}{m.quantity} UN
                      </span>
                    </td>
                    <td className="px-6 py-4 text-[10px] text-slate-500 italic">{m.reason || "—"}</td>
                  </tr>
                ))}
                {movements.length === 0 && (
                  <tr><td colSpan={5} className="px-6 py-12 text-center text-[10px] font-bold uppercase tracking-widest text-slate-300">Sem movimentações registradas</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile card list */}
          <div className="sm:hidden space-y-3">
            {pagedMovements.map(m => (
              <div key={m.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-900 uppercase truncate">{m.product_name}</p>
                    <p className="text-[9px] font-mono text-slate-400">{new Date(m.created_at).toLocaleString('pt-BR')}</p>
                  </div>
                  <span className={cn("text-sm font-mono font-black shrink-0", m.quantity > 0 ? "text-emerald-500" : "text-red-500")}>
                    {m.quantity > 0 ? '+' : ''}{m.quantity}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-bold text-blue-500 uppercase tracking-widest bg-blue-50 px-2 py-0.5 rounded">
                    {TYPE_LABELS[m.type] || m.type}
                  </span>
                  {m.reason && <p className="text-[10px] text-slate-400 italic truncate max-w-[60%]">{m.reason}</p>}
                </div>
              </div>
            ))}
            {movements.length === 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-[10px] font-bold uppercase tracking-widest text-slate-300">
                Sem movimentações registradas
              </div>
            )}
          </div>

          <Pagination page={historyPage} totalPages={historyTotalPages} onChange={setHistoryPage} />
        </div>
      )}

      {/* Adjustment Modal */}
      <Modal
        open={isAdjustmentModalOpen}
        onClose={() => setIsAdjustmentModalOpen(false)}
        title="Ajuste de Estoque"
        subtitle={selectedProduct?.name}
        size="sm"
        footer={
          <>
            <button onClick={() => setIsAdjustmentModalOpen(false)} className="flex-1 h-10 border border-slate-200 text-[10px] font-bold uppercase tracking-widest rounded-lg hover:bg-slate-50 transition-colors">Cancelar</button>
            <button
              onClick={handleAdjustment}
              disabled={adjustmentValue === 0}
              className="flex-1 h-10 bg-blue-600 text-white rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-blue-700 disabled:opacity-40 disabled:grayscale transition-all shadow-lg shadow-blue-200"
            >
              Aplicar
            </button>
          </>
        }
      >
        <div className="space-y-5">
          {/* Current stock indicator */}
          <div className="text-center p-4 bg-slate-50 rounded-xl border border-slate-100">
            <p className="text-[9px] font-bold uppercase text-slate-400 tracking-widest mb-1">Saldo Atual</p>
            <h5 className="text-2xl font-mono font-black text-slate-900">{selectedProduct?.stock_quantity} <span className="text-sm font-bold text-slate-400">UN</span></h5>
          </div>

          {/* Type selector */}
          <div className="space-y-2">
            <label className="text-[9px] font-bold uppercase text-slate-400 tracking-widest px-1">Tipo de Operação</label>
            <div className="grid grid-cols-2 gap-2">
              {['purchase', 'adjustment', 'loss', 'return'].map(type => (
                <button
                  key={type}
                  onClick={() => setAdjustmentType(type)}
                  className={cn(
                    "h-9 rounded-lg text-[10px] font-bold uppercase border transition-all",
                    adjustmentType === type ? "bg-slate-900 text-white border-slate-900 shadow-lg" : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                  )}
                >
                  {TYPE_LABELS[type]}
                </button>
              ))}
            </div>
          </div>

          {/* Quantity stepper */}
          <div className="space-y-2">
            <label className="text-[9px] font-bold uppercase text-slate-400 tracking-widest px-1">Quantidade</label>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setAdjustmentValue(prev => prev - 1)}
                className="w-11 h-11 bg-rose-50 border border-rose-100 rounded-xl flex items-center justify-center text-rose-500 transition-all active:scale-95"
              >
                <Minus size={18} />
              </button>
              <div className="flex-1 text-center">
                <span className={cn(
                  "text-3xl font-mono font-black tracking-tighter",
                  adjustmentValue > 0 ? "text-emerald-500" : adjustmentValue < 0 ? "text-red-500" : "text-slate-400"
                )}>
                  {adjustmentValue > 0 ? '+' : ''}{adjustmentValue}
                </span>
              </div>
              <button
                onClick={() => setAdjustmentValue(prev => prev + 1)}
                className="w-11 h-11 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center justify-center text-emerald-500 transition-all active:scale-95"
              >
                <Plus size={18} />
              </button>
            </div>
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <label className="text-[9px] font-bold uppercase text-slate-400 tracking-widest px-1">Justificativa</label>
            <textarea
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm h-16 outline-none focus:ring-2 focus:ring-blue-500/10 transition-all resize-none"
              placeholder="Explique o motivo desta variação..."
              value={adjustmentReason}
              onChange={(e) => setAdjustmentReason(e.target.value)}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
