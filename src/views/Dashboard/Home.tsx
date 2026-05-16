import { useState, useEffect } from "react";
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Package, 
  DollarSign, 
  ArrowUpRight,
  Calendar,
  Layers,
  ArrowRight,
  Trophy,
  Activity,
  ShoppingCart,
  Clock
} from "lucide-react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart,
  Area
} from "recharts";
import { motion } from "motion/react";
import { cn } from "../../lib/utils";

export default function Home() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [topProducts, setTopProducts] = useState<any[]>([]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [statsRes, topRes] = await Promise.all([
          fetch("/api/stats", { headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` } }),
          fetch("/api/stats/top-selling", { headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` } })
        ]);
        setStats(await statsRes.json());
        setTopProducts(await topRes.json());
        setLoading(false);
      } catch (err) {
        console.error("Stats fail", err);
      }
    };
    fetchStats();
  }, []);

  if (loading) return <div className="p-8 text-center text-xs font-bold uppercase tracking-widest text-slate-400">Consolidando Matriz de Dados...</div>;

  const cards = [
    { title: "Volume de Faturamento", value: `R$ ${stats.summary.revenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, icon: DollarSign, trend: "+12.5%", color: "text-blue-600", bg: "bg-blue-50" },
    { title: "Custos do Período", value: `R$ ${stats.summary.expenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, icon: TrendingDown, trend: "-4.2%", color: "text-rose-600", bg: "bg-rose-50" },
    { title: "Valor em Inventário", value: `R$ ${stats.summary.stockValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, icon: Package, trend: "+1.8%", color: "text-amber-600", bg: "bg-amber-50" },
    { title: "Margem Líquida Est.", value: `R$ ${stats.summary.profit.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, icon: Activity, trend: "+15.2%", color: "text-emerald-600", bg: "bg-emerald-50" },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 uppercase tracking-tight">Cockpit de Gestão Nexus</h2>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest leading-none">Console Central de Monitoramento ERP/CRM</p>
        </div>
        <div className="flex gap-2">
          <div className="bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-sm flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
            <Calendar size={14} className="text-blue-500" />
            Jan - Dez 2026
          </div>
          <button className="bg-slate-900 text-white px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg active:scale-95">
             Nova Ordem
          </button>
        </div>
      </div>

      {/* Primary Analytics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card, idx) => (
          <motion.div 
            key={idx}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex justify-between items-start mb-4">
               <div className={cn("p-2 rounded-xl", card.bg, card.color)}>
                  <card.icon size={20} />
               </div>
               <span className={cn(
                 "text-[10px] font-bold px-2 py-0.5 rounded-full border",
                 card.trend.startsWith('+') ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-rose-50 text-rose-600 border-rose-100"
               )}>
                 {card.trend}
               </span>
            </div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">{card.title}</p>
            <h3 className="text-2xl font-black text-slate-900 tracking-tighter font-mono">{card.value}</h3>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Performance Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <div>
               <h3 className="text-xs font-bold uppercase tracking-widest text-slate-900 flex items-center gap-2">
                  <Activity size={14} className="text-blue-500" />
                  Curva de Faturamento Sazonal
               </h3>
               <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter mt-1">Análise de Recebimentos Brutos Mensais</p>
            </div>
            <div className="flex gap-1">
               <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            </div>
          </div>
          <div className="h-[320px] -ml-6">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.salesOverTime}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="6 6" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 9, fill: '#64748b', fontWeight: 'bold'}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 9, fill: '#64748b', fontWeight: 'bold'}} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: '1px solid #f1f5f9', fontSize: '11px', fontWeight: '800', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                  labelStyle={{ color: '#1e293b', marginBottom: '4px' }}
                />
                <Area type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Dynamic Analytics & Metric Panel */}
        <div className="space-y-6">
           <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-xl shadow-slate-200">
              <div className="flex items-center justify-between mb-6">
                 <h3 className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                    <Trophy size={14} className="text-amber-400" /> Curva ABC (Top 5)
                 </h3>
                 <span className="text-[8px] bg-white/10 px-2 py-0.5 rounded uppercase font-bold tracking-widest">Tempo Real</span>
              </div>
              <div className="space-y-4">
                 {topProducts.map((p, i) => (
                    <div key={i} className="flex items-center justify-between group">
                       <div className="flex items-center gap-3">
                          <span className="text-[10px] font-black text-slate-500 bg-white/5 w-5 h-5 flex items-center justify-center rounded truncate">{i+1}</span>
                          <span className="text-[10px] font-bold uppercase text-slate-300 truncate max-w-[140px] group-hover:text-white transition-colors">{p.name}</span>
                       </div>
                       <span className="text-[10px] font-mono font-bold text-blue-400">{p.total_sold} <span className="text-[8px] text-slate-500">UN</span></span>
                    </div>
                 ))}
                 {topProducts.length === 0 && (
                    <p className="text-[10px] text-slate-500 py-4 font-bold uppercase italic text-center">Aguardando volume transacional...</p>
                 )}
              </div>
              <button className="w-full mt-6 py-2 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-[9px] font-bold uppercase tracking-widest text-slate-400 transition-all flex items-center justify-center gap-2">
                 Relatório Expandido <ArrowRight size={12} />
              </button>
           </div>

           <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-900 mb-6 flex items-center gap-2">
                 <Activity size={14} className="text-emerald-500" /> Health Check
              </h3>
              <div className="space-y-4">
                 {[
                   { label: "Capacidade Operacional", current: 78, color: "bg-blue-500" },
                   { label: "Acuracidade de Inventário", current: 92, color: "bg-emerald-500" },
                   { label: "Taxa de Retenção (CRM)", current: 85, color: "bg-indigo-500" },
                   { label: "Nível de Ruptura", current: 4, color: "bg-rose-500" },
                 ].map((item, i) => (
                   <div key={i} className="space-y-1.5">
                      <div className="flex justify-between text-[10px] font-bold uppercase tracking-tighter">
                         <span className="text-slate-400">{item.label}</span>
                         <span className="text-slate-900">{item.current}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-50 rounded-full overflow-hidden">
                         <motion.div 
                           initial={{ width: 0 }}
                           animate={{ width: `${item.current}%` }}
                           className={`h-full ${item.color}`}
                         />
                      </div>
                   </div>
                 ))}
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
