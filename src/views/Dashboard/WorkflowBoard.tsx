import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, ClipboardList, FileText, Loader2 } from "lucide-react";
import PageHeader from "../../components/layout/PageHeader";
import { cn } from "../../lib/utils";
import { getStoredUser } from "../../lib/session";
import { authHeader, fmt, STATUS_ORDER, STATUS_META, type SOStatus } from "./serviceOrders.shared";
import { onRealtimeAny } from "../../lib/realtime";

type Tab = "ordens_servico" | "orcamentos";

interface QuoteCard {
  id: number;
  number: number;
  customer_name: string;
  total_amount: number;
  status: string;
}

interface OrderCard {
  id: number;
  number: number;
  customer_name: string;
  total_amount: number;
  status: SOStatus;
}

const QUOTE_STATUS_ORDER: string[] = ["rascunho", "orcamento_enviado", "aguardando_aprovacao", "aprovado", "aguardando_arte", "arte_finalizada", "em_producao", "finalizado", "nota_emitida", "entregue"];
const BOARD_STATUSES: string[] = STATUS_ORDER.filter((s) => s !== "cancelada"); // mesmas 8 etapas para OS e Orçamento

export default function WorkflowBoard() {
  const navigate = useNavigate();
  const currentUser = getStoredUser();
  const isAdmin = currentUser?.role === "admin";
  const allowedStages = currentUser?.stages ?? [];
  const canMove = (stage: string) => isAdmin || allowedStages.includes(stage);

  const [tab, setTab] = useState<Tab>("ordens_servico");
  const [orders, setOrders] = useState<OrderCard[]>([]);
  const [quotes, setQuotes] = useState<QuoteCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [movingId, setMovingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ordersRes, quotesRes] = await Promise.all([
        fetch("/api/workflow/board?type=ordens_servico", { headers: authHeader() }),
        fetch("/api/workflow/board?type=orcamentos", { headers: authHeader() }),
      ]);
      if (ordersRes.ok) setOrders(await ordersRes.json());
      if (quotesRes.ok) setQuotes(await quotesRes.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => onRealtimeAny(["service-order:changed", "order:updated"], () => { load(); }), [load]);

  // Loja sem o módulo Gráfica não vê "Aguardando arte"/"Arte finalizada" no quadro
  // (ver Tenant.grafica_enabled, refletido em currentUser.grafica_enabled no login).
  const graficaEnabled = !!currentUser?.grafica_enabled;
  const hideGraficaStages = (stages: string[]) =>
    graficaEnabled ? stages : stages.filter((s) => s !== "aguardando_arte" && s !== "arte_finalizada");
  const columns = hideGraficaStages(tab === "ordens_servico" ? BOARD_STATUSES : QUOTE_STATUS_ORDER);

  const cardsByStage = useMemo(() => {
    const map = new Map<string, { id: number; number: number; title: string; subtitle: string }[]>();
    for (const stage of columns) map.set(stage, []);
    if (tab === "ordens_servico") {
      for (const o of orders) {
        if (!map.has(o.status)) continue;
        map.get(o.status)!.push({ id: o.id, number: o.number, title: o.customer_name || "Sem cliente", subtitle: fmt(o.total_amount) });
      }
    } else {
      for (const q of quotes) {
        if (!map.has(q.status)) continue;
        map.get(q.status)!.push({ id: q.id, number: q.number, title: q.customer_name || "Sem cliente", subtitle: fmt(q.total_amount) });
      }
    }
    return map;
  }, [tab, orders, quotes, columns]);

  const moveCard = async (id: number, fromStage: string, toStage: string) => {
    const fromIdx = columns.indexOf(fromStage);
    const toIdx = columns.indexOf(toStage);
    if (toIdx !== fromIdx + 1) {
      setError("Só é possível avançar para a próxima etapa do fluxo.");
      setTimeout(() => setError(""), 3000);
      return;
    }
    if (!canMove(toStage)) {
      setError("Você não tem permissão para mover para esta etapa.");
      setTimeout(() => setError(""), 3000);
      return;
    }

    setMovingId(id);
    try {
      const url = tab === "ordens_servico" ? `/api/service-orders/${id}/status` : `/api/quotes/${id}/status`;
      const res = await fetch(url, { method: "PUT", headers: authHeader(), body: JSON.stringify({ status: toStage }) });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Não foi possível mover.");
        setTimeout(() => setError(""), 3000);
        return;
      }
      await load();
    } finally {
      setMovingId(null);
    }
  };

  const labelFor = (stage: string): string => {
    if (tab === "ordens_servico") return STATUS_META[stage as SOStatus]?.label ?? stage;
    const QUOTE_LABELS: Record<string, string> = {
      rascunho: "Rascunho",
      orcamento_enviado: "Orçamento Enviado",
      aguardando_aprovacao: "Aguardando Aprovação",
      aprovado: "Aprovado",
      aguardando_arte: "Aguardando Arte",
      arte_finalizada: "Arte Finalizada",
      em_producao: "Em Produção",
      finalizado: "Finalizado",
      nota_emitida: "Nota Emitida",
      entregue: "Entregue",
    };
    return QUOTE_LABELS[stage] ?? stage;
  };

  const openCard = (id: number) => {
    navigate(tab === "ordens_servico" ? `/admin/ordens-servico/${id}` : `/admin/orcamentos/${id}`);
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Fluxo de Produção" subtitle="Acompanhe Ordens de Serviço e Orçamentos por etapa" />

      <div className="flex items-center gap-2">
        <button
          onClick={() => setTab("ordens_servico")}
          className={cn("h-9 px-4 rounded-xl text-[11px] font-black uppercase tracking-wider flex items-center gap-2 transition-all",
            tab === "ordens_servico" ? "bg-blue-600 text-white" : "bg-white border border-slate-200 text-slate-500 hover:bg-slate-50")}
        >
          <ClipboardList size={13} /> Ordens de Serviço
        </button>
        <button
          onClick={() => setTab("orcamentos")}
          className={cn("h-9 px-4 rounded-xl text-[11px] font-black uppercase tracking-wider flex items-center gap-2 transition-all",
            tab === "orcamentos" ? "bg-blue-600 text-white" : "bg-white border border-slate-200 text-slate-500 hover:bg-slate-50")}
        >
          <FileText size={13} /> Orçamentos
        </button>
      </div>

      {error && (
        <div className="px-4 py-2.5 rounded-xl bg-red-50 border border-red-200 text-[11px] font-bold text-red-600">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={22} className="animate-spin text-slate-300" />
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {columns.map((stage, idx) => {
            const cards = cardsByStage.get(stage) ?? [];
            const nextStage = columns[idx + 1];
            const movableHere = canMove(stage);
            return (
              <div
                key={stage}
                onDragOver={(e) => { if (idx > 0) { e.preventDefault(); setDragOverStage(stage); } }}
                onDragLeave={() => setDragOverStage((s) => (s === stage ? null : s))}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOverStage(null);
                  const raw = e.dataTransfer.getData("text/plain");
                  if (!raw) return;
                  const { id, status } = JSON.parse(raw);
                  moveCard(id, status, stage);
                }}
                className={cn(
                  "shrink-0 w-72 rounded-2xl border bg-slate-50/60 p-3 flex flex-col gap-2 transition-colors",
                  dragOverStage === stage ? "border-blue-400 bg-blue-50/60" : "border-slate-200"
                )}
              >
                <div className="flex items-center justify-between px-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">{labelFor(stage)}</p>
                  <span className="text-[9px] font-black text-slate-400 bg-white border border-slate-200 rounded-full px-2 py-0.5">{cards.length}</span>
                </div>

                <div className="flex flex-col gap-2 min-h-[60px]">
                  {cards.map((card) => (
                    <div
                      key={card.id}
                      draggable={movableHere || canMove(nextStage ?? "")}
                      onDragStart={(e) => e.dataTransfer.setData("text/plain", JSON.stringify({ id: card.id, status: stage }))}
                      onClick={() => openCard(card.id)}
                      className="bg-white rounded-xl border border-slate-200 p-3 cursor-pointer hover:border-blue-300 hover:shadow-sm transition-all group"
                    >
                      <p className="text-[9px] font-black text-slate-300 uppercase tracking-wider">#{String(card.number).padStart(4, "0")}</p>
                      <p className="text-[12px] font-bold text-slate-800 truncate mt-0.5">{card.title}</p>
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-[11px] font-mono font-bold text-slate-500">{card.subtitle}</span>
                        {nextStage && (
                          <button
                            onClick={(e) => { e.stopPropagation(); moveCard(card.id, stage, nextStage); }}
                            disabled={movingId === card.id || !canMove(nextStage)}
                            title={canMove(nextStage) ? `Avançar para ${labelFor(nextStage)}` : "Sem permissão para esta etapa"}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg text-blue-500 hover:bg-blue-50 disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            {movingId === card.id ? <Loader2 size={13} className="animate-spin" /> : <ArrowRight size={13} />}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
