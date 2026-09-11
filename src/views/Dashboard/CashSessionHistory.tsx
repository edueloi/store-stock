import { useState, useEffect, useMemo } from "react";
import {
  Search, Wallet, CheckCircle2, Clock, X, Loader2, User, Calendar, ChevronRight,
} from "lucide-react";
import PageHeader from "../../components/layout/PageHeader";
import { cn } from "../../lib/utils";

interface CashSession {
  id: number;
  opened_by_name: string;
  closed_by_name: string | null;
  opening_amount: string | number;
  opening_note: string | null;
  status: "open" | "closed";
  opened_at: string;
  closed_at: string | null;
  counted_amount: string | number | null;
  expected_amount: string | number | null;
  difference_amount: string | number | null;
  closing_note: string | null;
}

interface CashSessionOrder {
  id: number;
  total_amount: string | number;
  payment_method: string;
  created_at: string;
  status: string;
}

interface CashSessionDetail extends CashSession {
  orders: CashSessionOrder[];
}

const money = (v: string | number | null | undefined) =>
  Number(v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function CashSessionHistory() {
  const [sessions, setSessions] = useState<CashSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "closed">("all");
  const [detail, setDetail] = useState<CashSessionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const token = localStorage.getItem("token");

  useEffect(() => {
    fetch("/api/cash-sessions", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => setSessions(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    return sessions.filter((s) => {
      if (statusFilter !== "all" && s.status !== statusFilter) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const haystack = `${s.opened_by_name} ${s.closed_by_name ?? ""}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [sessions, statusFilter, searchTerm]);

  const counts = useMemo(() => ({
    total: sessions.length,
    open: sessions.filter((s) => s.status === "open").length,
    closed: sessions.filter((s) => s.status === "closed").length,
    withDifference: sessions.filter((s) => s.status === "closed" && Number(s.difference_amount) !== 0).length,
  }), [sessions]);

  const openDetail = async (id: number) => {
    setDetailLoading(true);
    setDetail(null);
    try {
      const res = await fetch(`/api/cash-sessions/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setDetail(data);
    } catch {
      // ignore
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Histórico de Caixa"
        subtitle="Todas as aberturas e fechamentos de caixa — quem abriu, quem fechou e a diferença apurada"
      />

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-0 border-b border-slate-100 divide-x divide-slate-100">
          {[
            { label: "Total",              value: counts.total,          color: "text-slate-900" },
            { label: "Caixas Abertos",     value: counts.open,           color: "text-blue-500" },
            { label: "Caixas Fechados",    value: counts.closed,         color: "text-emerald-500" },
            { label: "Com Diferença",      value: counts.withDifference, color: "text-rose-500" },
          ].map((k) => (
            <div key={k.label} className="flex-1 px-5 py-4 flex flex-col gap-0.5">
              <span className={cn("text-2xl font-black tracking-tight font-mono leading-none", k.color)}>{k.value}</span>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{k.label}</span>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 px-4 py-3 flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
            <input
              type="text"
              placeholder="Buscar por operador..."
              className="w-full pl-8 pr-3 h-9 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-400 text-[11px] font-medium placeholder:text-slate-300 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "all" | "open" | "closed")}
            className="h-9 px-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-bold outline-none focus:border-blue-400 transition-all"
          >
            <option value="all">Todos os status</option>
            <option value="open">Aberto</option>
            <option value="closed">Fechado</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-t border-slate-100 bg-slate-50/60">
                {["Abertura", "Aberto por", "Fechado por", "Status", "Valor Inicial", "Contado", "Diferença", ""].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-400 text-xs">Carregando...</td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-400 text-xs">Nenhuma sessão de caixa encontrada</td></tr>
              )}
              {!loading && filtered.map((s) => {
                const diff = Number(s.difference_amount ?? 0);
                return (
                  <tr key={s.id} onClick={() => openDetail(s.id)}
                    className="border-t border-slate-100 hover:bg-slate-50/60 transition-colors cursor-pointer">
                    <td className="px-4 py-2.5 text-xs text-slate-500 whitespace-nowrap">
                      {new Date(s.opened_at).toLocaleString("pt-BR")}
                    </td>
                    <td className="px-4 py-2.5 text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <User size={12} className="text-slate-400" /> {s.opened_by_name}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-500">{s.closed_by_name ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      {s.status === "open" ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide bg-blue-50 text-blue-600">
                          <Clock size={12} /> Aberto
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide bg-emerald-50 text-emerald-600">
                          <CheckCircle2 size={12} /> Fechado
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs font-mono text-slate-600">{money(s.opening_amount)}</td>
                    <td className="px-4 py-2.5 text-xs font-mono text-slate-600">{s.counted_amount != null ? money(s.counted_amount) : "—"}</td>
                    <td className="px-4 py-2.5 text-xs font-mono font-bold">
                      {s.status === "closed" ? (
                        <span className={diff === 0 ? "text-slate-400" : diff > 0 ? "text-emerald-600" : "text-rose-600"}>
                          {diff > 0 ? "+" : ""}{money(diff)}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <ChevronRight size={14} className="text-slate-300" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de detalhe */}
      {(detail || detailLoading) && (
        <>
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[500]" onClick={() => setDetail(null)} />
          <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white z-[510] shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 shrink-0">
              <div className="flex items-center gap-2">
                <Wallet size={16} className="text-blue-600" />
                <h2 className="font-black text-slate-900 text-[15px]">Sessão de Caixa</h2>
              </div>
              <button onClick={() => setDetail(null)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500"><X size={18} /></button>
            </div>

            {detailLoading && (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 size={22} className="animate-spin text-slate-300" />
              </div>
            )}

            {detail && !detailLoading && (
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Aberto por</p>
                    <p className="text-[12px] font-bold text-slate-800">{detail.opened_by_name}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1"><Calendar size={9} /> {new Date(detail.opened_at).toLocaleString("pt-BR")}</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Fechado por</p>
                    <p className="text-[12px] font-bold text-slate-800">{detail.closed_by_name ?? "Ainda aberto"}</p>
                    {detail.closed_at && (
                      <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1"><Calendar size={9} /> {new Date(detail.closed_at).toLocaleString("pt-BR")}</p>
                    )}
                  </div>
                </div>

                <div className="bg-slate-900 rounded-2xl p-4 space-y-1.5">
                  <div className="flex justify-between text-[11px] font-bold text-slate-400">
                    <span>Valor inicial</span>
                    <span className="font-mono text-white">{money(detail.opening_amount)}</span>
                  </div>
                  {detail.status === "closed" && (
                    <>
                      <div className="flex justify-between text-[11px] font-bold text-slate-400">
                        <span>Esperado</span>
                        <span className="font-mono text-white">{money(detail.expected_amount)}</span>
                      </div>
                      <div className="flex justify-between text-[11px] font-bold text-slate-400">
                        <span>Contado</span>
                        <span className="font-mono text-white">{money(detail.counted_amount)}</span>
                      </div>
                      <div className="flex justify-between text-[13px] font-black pt-1.5 border-t border-slate-700">
                        <span className="text-white uppercase">Diferença</span>
                        <span className={cn("font-mono", Number(detail.difference_amount) === 0 ? "text-slate-300" : Number(detail.difference_amount) > 0 ? "text-emerald-400" : "text-rose-400")}>
                          {Number(detail.difference_amount) > 0 ? "+" : ""}{money(detail.difference_amount)}
                        </span>
                      </div>
                    </>
                  )}
                </div>

                {detail.opening_note && (
                  <div className="text-[11px] text-slate-500"><span className="font-bold text-slate-700">Obs. abertura:</span> {detail.opening_note}</div>
                )}
                {detail.closing_note && (
                  <div className="text-[11px] text-slate-500"><span className="font-bold text-slate-700">Obs. fechamento:</span> {detail.closing_note}</div>
                )}

                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">
                    Vendas nesta sessão ({detail.orders.length})
                  </p>
                  <div className="space-y-1.5">
                    {detail.orders.length === 0 && (
                      <p className="text-[11px] text-slate-400 py-4 text-center">Nenhuma venda registrada nesta sessão.</p>
                    )}
                    {detail.orders.map((o) => (
                      <div key={o.id} className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-xl border border-slate-100">
                        <div>
                          <p className="text-[11px] font-bold text-slate-700">#{String(o.id).padStart(6, "0")}</p>
                          <p className="text-[9px] text-slate-400">{new Date(o.created_at).toLocaleTimeString("pt-BR")}</p>
                        </div>
                        <p className="text-[11px] font-mono font-black text-slate-800">{money(o.total_amount)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
