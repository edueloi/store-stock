import { useState, useEffect } from "react";
import { 
  Receipt, 
  Search, 
  Filter, 
  Download, 
  ChevronRight, 
  Clock, 
  CheckCircle2, 
  XCircle,
  MoreVertical,
  Eye,
  ArrowRight,
  TrendingUp,
  Package,
  ShoppingCart as CartIcon,
  X,
  CreditCard,
  Truck
} from "lucide-react";
import { Order, Product } from "../../types";
import { cn } from "../../lib/utils";
import { motion, AnimatePresence } from "motion/react";

interface OrderDetail extends Order {
  items: Array<{
    id: number;
    product_name: string;
    quantity: number;
    unit_price: number;
  }>;
}

export default function Orders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<OrderDetail | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const fetchOrders = async () => {
    try {
      const res = await fetch("/api/orders", {
        headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
      });
      const data = await res.json();
      setOrders(Array.isArray(data) ? data : []);
      setLoading(false);
    } catch (err) {
       console.error(err);
    }
  };

  const fetchTopSelling = async () => {
    try {
      const res = await fetch("/api/stats/top-selling", {
        headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
      });
      setTopProducts(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchOrders();
    fetchTopSelling();
  }, []);

  const fetchOrderDetails = async (id: number) => {
    try {
      const res = await fetch(`/api/orders/${id}`, {
        headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
      });
      const data = await res.json();
      setSelectedOrder(data);
      setIsDetailModalOpen(true);
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateStatus = async (id: number, status: string) => {
    try {
      const res = await fetch(`/api/orders/${id}/status`, {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        setIsDetailModalOpen(false);
        fetchOrders();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filteredOrders = orders.filter(o => 
    (selectedStatus === "all" || o.status === selectedStatus) &&
    (searchTerm === "" || (o.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) || String(o.id).includes(searchTerm)))
  );

  const getStatusStyle = (status: string) => {
    switch(status) {
      case 'completed': return "bg-emerald-50 text-emerald-600 border-emerald-100";
      case 'pending': return "bg-amber-50 text-amber-600 border-amber-100";
      case 'cancelled': return "bg-red-50 text-red-600 border-red-100";
      default: return "bg-gray-50 text-gray-600 border-gray-100";
    }
  };

  const getStatusIcon = (status: string) => {
    switch(status) {
      case 'completed': return <CheckCircle2 size={14} />;
      case 'pending': return <Clock size={14} />;
      case 'cancelled': return <XCircle size={14} />;
      default: return null;
    }
  };

  if (loading) return <div className="p-8 text-center text-xs font-bold uppercase tracking-widest text-slate-400">Puxando Fluxo de Pedidos...</div>;

  return (
    <div className="space-y-6 ">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 uppercase tracking-tight font-sans">Workflow de Pedidos</h2>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest leading-none">Visão Analítica e Operacional de Vendas</p>
        </div>
        <div className="flex gap-2">
            <button className="h-10 bg-white border border-slate-200 px-4 rounded-lg flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest hover:bg-slate-50 transition-all text-slate-600 shadow-sm">
              <Download size={14} /> Relatório de Carga
            </button>
        </div>
      </div>

      {/* Analytics Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
         <div className="md:col-span-2 bg-white rounded-[32px] border border-slate-200 p-6 lg:p-8 shadow-sm flex flex-col justify-between overflow-hidden relative group">
            <div className="absolute right-0 top-0 p-8 text-slate-50 opacity-10 group-hover:opacity-20 transition-opacity hidden sm:block">
               <TrendingUp size={120} strokeWidth={1.5} />
            </div>
            <div>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6">Métricas de Vazão</p>
               <div className="grid grid-cols-3 gap-4 sm:gap-12">
                  <div className="space-y-1">
                     <h3 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tighter">{orders.length}</h3>
                     <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total</p>
                  </div>
                  <div className="space-y-1">
                     <h3 className="text-2xl sm:text-4xl font-black text-amber-500 tracking-tighter">{orders.filter(o => o.status === 'pending').length}</h3>
                     <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Pendente</p>
                  </div>
                  <div className="space-y-1">
                     <h3 className="text-2xl sm:text-4xl font-black text-emerald-500 tracking-tighter">{orders.filter(o => o.status === 'completed').length}</h3>
                     <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Pago</p>
                  </div>
               </div>
            </div>
            <div className="mt-8 flex flex-wrap gap-2">
               {['all', 'pending', 'completed', 'cancelled'].map(status => (
                  <button 
                    key={status}
                    onClick={() => setSelectedStatus(status)}
                    className={cn(
                      "px-4 h-9 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border shrink-0",
                      selectedStatus === status ? "bg-slate-900 text-white border-slate-900 shadow-xl shadow-slate-200" : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                    )}
                  >
                    {status === 'all' ? 'Tudo' : status === 'pending' ? 'Pendentes' : status === 'completed' ? 'Efetivados' : 'Cancelados'}
                  </button>
               ))}
            </div>
         </div>

         <div className="bg-slate-900 rounded-[32px] p-6 lg:p-8 text-white shadow-2xl shadow-slate-200 flex flex-col justify-between">
            <div>
               <div className="flex items-center justify-between mb-6">
                  <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em]">Rank de Saída</p>
                  <CartIcon size={16} className="text-blue-400" />
               </div>
               <div className="space-y-4">
                  {topProducts.map((p, i) => (
                    <div key={i} className="flex items-center justify-between group">
                       <div className="flex items-center gap-3">
                          <span className="text-[8px] font-black text-slate-500 w-4">0{i+1}</span>
                          <span className="text-[11px] font-bold uppercase truncate max-w-[120px] text-slate-300 group-hover:text-white transition-colors">{p.name}</span>
                       </div>
                       <span className="text-[10px] font-mono font-black text-blue-400 px-2.5 py-1 rounded-lg bg-blue-400/10 leading-none">{p.total_sold} UN</span>
                    </div>
                  ))}
                  {topProducts.length === 0 && (
                     <p className="text-[10px] text-slate-600 py-6 uppercase font-black tracking-widest text-center border border-dashed border-slate-800 rounded-2xl">Vácuo de analytics</p>
                  )}
               </div>
            </div>
            <button className="mt-8 w-full h-10 bg-white/5 hover:bg-white/10 text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border border-white/10">Full Report</button>
         </div>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
        <input 
          type="text" 
          placeholder="Buscar Transação por ID ou Nome do Destinatário..." 
          className="w-full pl-12 pr-4 h-12 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 text-[10px] font-bold uppercase tracking-widest placeholder:text-slate-300 shadow-sm"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Desktop View Table */}
      <div className="hidden lg:block bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col transition-all hover:shadow-md">
        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Protocolo</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Fluxo / Destinatário</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Data / Hora</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Liquidação</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Etapa Final</th>
                <th className="px-8 py-5 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-slate-700">
              {filteredOrders.map((order) => (
                <tr 
                  key={order.id} 
                  onClick={() => fetchOrderDetails(order.id)}
                  className="hover:bg-blue-50/30 transition-colors group cursor-pointer"
                >
                  <td className="px-8 py-6">
                    <span className="font-mono font-black text-xs text-slate-400 group-hover:text-blue-600 transition-colors">#{String(order.id).padStart(6, '0')}</span>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex flex-col">
                       <span className="font-black text-xs text-slate-900 uppercase tracking-tight">{order.customer_name || "Nexus Global Delivery"}</span>
                       <span className="text-[9px] text-slate-400 font-bold uppercase mt-1 tracking-widest bg-slate-100 px-1.5 py-0.5 rounded w-fit">{order.customer_phone || "BALCÃO / GENÉRICO"}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-[10px] font-mono font-black text-slate-500 uppercase">
                    {new Date(order.created_at).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-8 py-6">
                    <span className="font-mono font-black text-sm text-slate-900 tracking-tighter">R$ {Number(order.total_amount).toFixed(2)}</span>
                  </td>
                  <td className="px-8 py-6">
                    <div className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border w-fit shadow-sm",
                      getStatusStyle(order.status)
                    )}>
                      {getStatusIcon(order.status)}
                      <span>{order.status === 'completed' ? 'PAGO' : order.status === 'pending' ? 'PENDENTE' : 'ESTORNO'}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-right">
                     <div className="flex justify-end opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
                        <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-lg">
                           <ChevronRight size={18} strokeWidth={3} />
                        </div>
                     </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Card-Based List */}
      <div className="lg:hidden space-y-4 pb-12">
        {filteredOrders.map((order) => (
          <motion.div 
            layout
            key={order.id}
            onClick={() => fetchOrderDetails(order.id)}
            className="bg-white p-5 rounded-[28px] border border-slate-200 shadow-sm active:scale-95 transition-all"
          >
            <div className="flex justify-between items-start mb-4">
              <div className="space-y-1">
                <span className="text-[10px] font-mono font-black text-slate-300">#{String(order.id).padStart(6, '0')}</span>
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-tight">{order.customer_name || "Cliente Balcão"}</h4>
              </div>
              <div className={cn(
                "px-3 py-1.5 rounded-xl text-[8px] font-black uppercase tracking-widest border shadow-sm flex items-center gap-1.5",
                getStatusStyle(order.status)
              )}>
                {getStatusIcon(order.status)}
                {order.status === 'completed' ? 'PAGO' : order.status === 'pending' ? 'PEND' : 'CANCL'}
              </div>
            </div>

            <div className="flex justify-between items-end pt-4 border-t border-slate-50">
               <div className="space-y-1">
                  <div className="flex items-center gap-2 text-slate-400">
                    <Clock size={10} />
                    <span className="text-[9px] font-mono font-bold uppercase">{new Date(order.created_at).toLocaleDateString('pt-BR')}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-400">
                    <CreditCard size={10} />
                    <span className="text-[9px] font-black uppercase tracking-tighter">{order.payment_method || 'Cartão'}</span>
                  </div>
               </div>
               <div className="text-right">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Montante Líquido</p>
                  <p className="text-xl font-mono font-black text-slate-900 tracking-tighter">R$ {Number(order.total_amount).toFixed(2)}</p>
               </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Details Modal */}
      <AnimatePresence>
         {isDetailModalOpen && selectedOrder && (
            <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-end bg-slate-900/40 backdrop-blur-xs">
               <motion.div
                 initial={{ y: "100%", x: 0 }}
                 animate={{ y: 0, x: 0 }}
                 exit={{ y: "100%", x: 0 }}
                 className="bg-white w-full max-h-[92dvh] sm:max-h-full sm:h-full sm:max-w-lg shadow-2xl flex flex-col rounded-t-2xl sm:rounded-none sm:border-l border-slate-200 overflow-hidden"
               >
                  <div className="px-8 py-6 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                     <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Protocolo de Venda</p>
                        <h4 className="text-xl font-black text-slate-900 tracking-tighter">ORD #{String(selectedOrder.id).padStart(5, '0')}</h4>
                     </div>
                     <button onClick={() => setIsDetailModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-all text-slate-400"><X size={20} /></button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-8 space-y-8 no-scrollbar">
                     {/* Status Control */}
                     <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                           <div className={cn("w-3 h-3 rounded-full", selectedOrder.status === 'completed' ? 'bg-emerald-500' : selectedOrder.status === 'pending' ? 'bg-amber-500' : 'bg-red-500')}></div>
                           <span className="text-[10px] font-bold uppercase tracking-widest text-slate-600">Status: {selectedOrder.status}</span>
                        </div>
                        <div className="flex gap-2">
                           {selectedOrder.status === 'pending' && (
                             <button 
                               onClick={() => handleUpdateStatus(selectedOrder.id, 'completed')}
                               className="px-3 h-8 bg-emerald-600 text-white rounded text-[9px] font-bold uppercase tracking-widest shadow-lg shadow-emerald-200"
                             >Efetivar</button>
                           )}
                           {selectedOrder.status !== 'cancelled' && (
                             <button 
                               onClick={() => handleUpdateStatus(selectedOrder.id, 'cancelled')}
                               className="px-3 h-8 bg-red-50 text-red-600 border border-red-100 rounded text-[9px] font-bold uppercase tracking-widest"
                             >Cancelar</button>
                           )}
                        </div>
                     </div>

                     {/* Customer Info */}
                     <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-1">
                           <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Cliente</p>
                           <p className="text-xs font-bold text-slate-900 uppercase">{selectedOrder.customer_name || "Consumidor Final"}</p>
                        </div>
                        <div className="space-y-1">
                           <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Contato</p>
                           <p className="text-xs font-mono font-bold text-slate-900">{selectedOrder.customer_phone || "--"}</p>
                        </div>
                        <div className="space-y-1 col-span-2">
                           <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Endereço de Logística</p>
                           <p className="text-xs font-medium text-slate-600 leading-relaxed uppercase">{selectedOrder.customer_address || "Retirada em loja / Balcão"}</p>
                        </div>
                     </div>

                     {/* Items List */}
                     <div className="space-y-4">
                        <p className="text-[10px] font-bold text-slate-900 uppercase tracking-widest flex items-center gap-2">
                           <Package size={14} className="text-slate-400" /> Itens do Pedido ({selectedOrder.items.length})
                        </p>
                        <div className="border border-slate-100 rounded-xl overflow-hidden divide-y divide-slate-50">
                           {selectedOrder.items.map(item => (
                             <div key={item.id} className="p-4 flex items-center justify-between text-xs">
                                <div className="flex flex-col">
                                   <span className="font-bold text-slate-900 uppercase tracking-tight">{item.product_name}</span>
                                   <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{item.quantity} x R$ {item.unit_price.toFixed(2)}</span>
                                </div>
                                <span className="font-mono font-bold text-slate-900 bg-slate-50 px-2 py-1 rounded">R$ {(item.quantity * item.unit_price).toFixed(2)}</span>
                             </div>
                           ))}
                        </div>
                     </div>

                     {/* Financial Info */}
                     <div className="p-6 bg-slate-900 rounded-2xl text-white space-y-4">
                        <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-slate-400">
                           <span>Método</span>
                           <span className="flex items-center gap-2 text-white"><CreditCard size={12} /> {selectedOrder.payment_method}</span>
                        </div>
                        <div className="flex justify-between items-center">
                           <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-blue-400">Total Liquidado</span>
                           <span className="text-2xl font-black font-mono tracking-tighter">R$ {Number(selectedOrder.total_amount).toFixed(2)}</span>
                        </div>
                     </div>
                  </div>

                  <div className="p-8 border-t border-slate-100 bg-slate-50 flex gap-3">
                     <button className="flex-1 h-12 bg-white border border-slate-200 rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-slate-100 transition-all">
                        <Download size={16} /> Imprimir Comprovante
                     </button>
                     <button className="w-12 h-12 bg-emerald-600 text-white rounded-xl flex items-center justify-center hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-200">
                        <Receipt size={20} />
                     </button>
                  </div>
               </motion.div>
            </div>
         )}
      </AnimatePresence>
    </div>
  );
}
