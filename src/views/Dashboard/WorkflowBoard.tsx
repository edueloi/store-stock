import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, ClipboardList, FileText, Loader2, Trash2, History, Link2, Plus } from "lucide-react";
import PageHeader from "../../components/layout/PageHeader";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import Modal from "../../components/ui/Modal";
import Button from "../../components/ui/Button";
import { cn } from "../../lib/utils";
import { getStoredUser } from "../../lib/session";
import { authHeader, fmt, STATUS_ORDER, STATUS_META, type SOStatus } from "./serviceOrders.shared";
import { onRealtimeAny } from "../../lib/realtime";

type Tab = "ordens_servico" | "orcamentos" | "concluidos";

interface QuoteCard {
  id: number;
  number: number;
  customer_name: string;
  total_amount: number;
  status: string;
  updated_at?: string;
}

interface OrderCard {
  id: number;
  number: number;
  customer_name: string;
  total_amount: number;
  status: SOStatus;
  quote_id?: number | null;
  quote?: { number: number } | null;
  updated_at?: string;
}

interface Card {
  id: number;
  number: number;
  title: string;
  subtitle: string;
  status: string;
  quoteNumber?: number | null;
}

const QUOTE_STATUS_ORDER: string[] = ["rascunho", "orcamento_enviado", "aguardando_aprovacao", "aprovado", "aguardando_arte", "arte_finalizada", "em_producao", "finalizado", "nota_emitida", "entregue"];
const BOARD_STATUSES: string[] = STATUS_ORDER.filter((s) => s !== "cancelada"); // mesmas 8 etapas para OS e Orçamento

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

export default function WorkflowBoard() {
  const navigate = useNavigate();
  const currentUser = getStoredUser();
  const isAdmin = currentUser?.role === "admin";
  const allowedStages = currentUser?.stages ?? [];
  const canMove = (stage: string) => isAdmin || allowedStages.includes(stage);

  // Loja com o módulo Gráfica: todo Orçamento já nasce com uma OS vinculada (ver
  // createLinkedServiceOrder em quotes.controller.ts) — o quadro deixa de precisar de
  // duas abas (Orçamento é só o documento/preço por baixo da OS) e vira uma lista só,
  // agrupada por etapa. Loja sem Gráfica mantém as duas abas de sempre.
  const graficaEnabled = !!currentUser?.grafica_enabled;

  const [tab, setTab] = useState<Tab>("ordens_servico");
  const [orders, setOrders] = useState<OrderCard[]>([]);
  const [quotes, setQuotes] = useState<QuoteCard[]>([]);
  const [history, setHistory] = useState<(OrderCard | QuoteCard)[]>([]);
  const [historyType, setHistoryType] = useState<"ordens_servico" | "orcamentos">("ordens_servico");
  const [historyFrom, setHistoryFrom] = useState("");
  const [historyTo, setHistoryTo] = useState("");
  const [historyLoading, setHistoryLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [movingId, setMovingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; isOrder: boolean } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [mobileStage, setMobileStage] = useState<string | null>(null);
  const [quickQuoteOpen, setQuickQuoteOpen] = useState(false);
  const [quickQuoteName, setQuickQuoteName] = useState("");
  const [quickQuoteCreating, setQuickQuoteCreating] = useState(false);
  const [quickQuoteError, setQuickQuoteError] = useState("");

  const effectiveTab: "ordens_servico" | "orcamentos" = graficaEnabled ? "ordens_servico" : (tab === "orcamentos" ? "orcamentos" : "ordens_servico");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (graficaEnabled) {
        const ordersRes = await fetch("/api/workflow/board?type=ordens_servico", { headers: authHeader() });
        if (ordersRes.ok) setOrders(await ordersRes.json());
      } else {
        const [ordersRes, quotesRes] = await Promise.all([
          fetch("/api/workflow/board?type=ordens_servico", { headers: authHeader() }),
          fetch("/api/workflow/board?type=orcamentos", { headers: authHeader() }),
        ]);
        if (ordersRes.ok) setOrders(await ordersRes.json());
        if (quotesRes.ok) setQuotes(await quotesRes.json());
      }
    } finally {
      setLoading(false);
    }
  }, [graficaEnabled]);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const params = new URLSearchParams({ type: historyType });
      if (historyFrom) params.set("from", historyFrom);
      if (historyTo) params.set("to", historyTo);
      const res = await fetch(`/api/workflow/history?${params.toString()}`, { headers: authHeader() });
      if (res.ok) setHistory(await res.json());
    } finally {
      setHistoryLoading(false);
    }
  }, [historyType, historyFrom, historyTo]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => onRealtimeAny(["service-order:changed", "order:updated"], () => { load(); if (tab === "concluidos") loadHistory(); }), [load, loadHistory, tab]);
  useEffect(() => { if (tab === "concluidos") loadHistory(); }, [tab, loadHistory]);

  // Loja sem o módulo Gráfica não vê "Aguardando arte"/"Arte finalizada" no quadro
  // (ver Tenant.grafica_enabled, refletido em currentUser.grafica_enabled no login).
  const hideGraficaStages = (stages: string[]) =>
    graficaEnabled ? stages : stages.filter((s) => s !== "aguardando_arte" && s !== "arte_finalizada");
  const columns = hideGraficaStages(effectiveTab === "ordens_servico" ? BOARD_STATUSES : QUOTE_STATUS_ORDER);

  useEffect(() => { if (!mobileStage || !columns.includes(mobileStage)) setMobileStage(columns[0] ?? null); }, [columns, mobileStage]);

  const cardsByStage = useMemo(() => {
    const map = new Map<string, Card[]>();
    for (const stage of columns) map.set(stage, []);
    if (effectiveTab === "ordens_servico") {
      for (const o of orders) {
        if (!map.has(o.status)) continue;
        map.get(o.status)!.push({
          id: o.id, number: o.number, title: o.customer_name || "Sem cliente", subtitle: fmt(o.total_amount),
          status: o.status, quoteNumber: o.quote?.number ?? null,
        });
      }
    } else {
      for (const q of quotes) {
        if (!map.has(q.status)) continue;
        map.get(q.status)!.push({ id: q.id, number: q.number, title: q.customer_name || "Sem cliente", subtitle: fmt(q.total_amount), status: q.status });
      }
    }
    return map;
  }, [effectiveTab, orders, quotes, columns]);

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
      const url = effectiveTab === "ordens_servico" ? `/api/service-orders/${id}/status` : `/api/quotes/${id}/status`;
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
    if (effectiveTab === "ordens_servico") return STATUS_META[stage as SOStatus]?.label ?? stage;
    return QUOTE_LABELS[stage] ?? stage;
  };

  const openCard = (id: number) => {
    navigate(effectiveTab === "ordens_servico" ? `/admin/ordens-servico/${id}` : `/admin/orcamentos/${id}`);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const url = deleteTarget.isOrder ? `/api/service-orders/${deleteTarget.id}` : `/api/quotes/${deleteTarget.id}`;
      const res = await fetch(url, { method: "DELETE", headers: authHeader() });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Não foi possível excluir.");
        setTimeout(() => setError(""), 4000);
        return;
      }
      if (deleteTarget.isOrder) setOrders((prev) => prev.filter((o) => o.id !== deleteTarget.id));
      else setQuotes((prev) => prev.filter((q) => q.id !== deleteTarget.id));
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  // "Novo Orçamento Rápido": o botão só ABRE o modal — nenhuma chamada à API acontece
  // aqui. O POST /api/quotes só é disparado no submit do modal, e só com o nome do
  // cliente já preenchido (evita o problema de rascunhos vazios criados ao simplesmente
  // clicar/navegar, que hoje ocorre em Quotes.tsx -> /admin/orcamentos/novo -> QuoteNew.tsx).
  const openQuickQuote = () => {
    setQuickQuoteName("");
    setQuickQuoteError("");
    setQuickQuoteOpen(true);
  };

  const closeQuickQuote = () => {
    if (quickQuoteCreating) return;
    setQuickQuoteOpen(false);
  };

  const submitQuickQuote = async () => {
    const name = quickQuoteName.trim();
    if (!name) {
      setQuickQuoteError("Informe o nome do cliente.");
      return;
    }
    setQuickQuoteCreating(true);
    setQuickQuoteError("");
    try {
      const res = await fetch("/api/quotes", {
        method: "POST",
        headers: authHeader(),
        body: JSON.stringify({ customer_name: name }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setQuickQuoteError(data.error || "Não foi possível criar o orçamento.");
        return;
      }
      const created = await res.json();
      setQuickQuoteOpen(false);
      navigate(`/admin/orcamentos/${created.id}`);
    } catch {
      setQuickQuoteError("Não foi possível criar o orçamento.");
    } finally {
      setQuickQuoteCreating(false);
    }
  };

  // Renderiza um card — extraído pra ser reaproveitado no quadro desktop (colunas
  // lado a lado) e na lista única mobile/modo-unificado (mesma estrutura, só que
  // empilhada verticalmente, agrupada por etapa).
  const renderCard = (card: Card, stage: string, nextStage: string | undefined) => {
    const movableHere = canMove(stage);
    const meta = effectiveTab === "ordens_servico" ? STATUS_META[stage as SOStatus] : null;
    return (
      <div
        key={card.id}
        draggable={movableHere || canMove(nextStage ?? "")}
        onDragStart={(e) => e.dataTransfer.setData("text/plain", JSON.stringify({ id: card.id, status: stage }))}
        onClick={() => openCard(card.id)}
        className="bg-white rounded-xl border border-slate-200 p-3 cursor-pointer hover:border-blue-300 hover:shadow-sm transition-all group"
      >
        <div className="flex items-center justify-between gap-2">
          <p className="text-[9px] font-black text-slate-300 uppercase tracking-wider">#{String(card.number).padStart(4, "0")}</p>
          <div className="flex items-center gap-1">
            {meta && (
              <span className={cn("px-1.5 py-0.5 rounded text-[8px] font-black uppercase flex items-center gap-1", meta.color)}>
                {meta.icon} {meta.label}
              </span>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); setDeleteTarget({ id: card.id, isOrder: effectiveTab === "ordens_servico" }); }}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg text-red-400 hover:bg-red-50"
              title="Excluir"
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>
        <p className="text-[12px] font-bold text-slate-800 truncate mt-1">{card.title}</p>
        {card.quoteNumber && (
          <p className="text-[9px] font-bold text-blue-400 flex items-center gap-1 mt-0.5">
            <Link2 size={10} /> Orç. #{String(card.quoteNumber).padStart(4, "0")}
          </p>
        )}
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
    );
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Fluxo de Produção"
        subtitle={graficaEnabled ? "Acompanhe os trabalhos por etapa" : "Acompanhe Ordens de Serviço e Orçamentos por etapa"}
        action={
          <button
            onClick={openQuickQuote}
            className="h-9 px-4 bg-blue-600 text-white rounded-lg flex items-center gap-2 text-[12px] font-bold hover:bg-blue-700 transition-all shadow-md shadow-blue-500/20"
          >
            <Plus size={15} /> Novo Orçamento Rápido
          </button>
        }
      />

      <div className="flex items-center gap-2 flex-wrap">
        {!graficaEnabled && (
          <>
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
          </>
        )}
        <button
          onClick={() => setTab("concluidos")}
          className={cn("h-9 px-4 rounded-xl text-[11px] font-black uppercase tracking-wider flex items-center gap-2 transition-all",
            tab === "concluidos" ? "bg-blue-600 text-white" : "bg-white border border-slate-200 text-slate-500 hover:bg-slate-50")}
        >
          <History size={13} /> Concluídos
        </button>
      </div>

      {error && (
        <div className="px-4 py-2.5 rounded-xl bg-red-50 border border-red-200 text-[11px] font-bold text-red-600">
          {error}
        </div>
      )}

      {tab === "concluidos" ? (
        <div className="space-y-4">
          <div className="flex items-end gap-3 flex-wrap bg-white rounded-2xl border border-slate-200 p-4">
            {!graficaEnabled && (
              <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">Tipo</label>
                <div className="flex gap-1.5">
                  <button onClick={() => setHistoryType("ordens_servico")}
                    className={cn("h-9 px-3 rounded-lg text-[10px] font-black uppercase transition-all",
                      historyType === "ordens_servico" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500")}>
                    OS
                  </button>
                  <button onClick={() => setHistoryType("orcamentos")}
                    className={cn("h-9 px-3 rounded-lg text-[10px] font-black uppercase transition-all",
                      historyType === "orcamentos" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500")}>
                    Orçamentos
                  </button>
                </div>
              </div>
            )}
            <div>
              <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">De</label>
              <input type="date" value={historyFrom} onChange={(e) => setHistoryFrom(e.target.value)}
                className="h-9 px-3 rounded-lg border border-slate-200 text-[12px] focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">Até</label>
              <input type="date" value={historyTo} onChange={(e) => setHistoryTo(e.target.value)}
                className="h-9 px-3 rounded-lg border border-slate-200 text-[12px] focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <button onClick={loadHistory} disabled={historyLoading}
              className="h-9 px-4 rounded-lg bg-slate-800 text-white text-[10px] font-black uppercase tracking-wider hover:bg-slate-900 transition-all disabled:opacity-50">
              {historyLoading ? <Loader2 size={13} className="animate-spin" /> : "Filtrar"}
            </button>
          </div>

          {historyLoading ? (
            <div className="flex items-center justify-center py-16"><Loader2 size={22} className="animate-spin text-slate-300" /></div>
          ) : history.length === 0 ? (
            <p className="text-[12px] text-slate-400 text-center py-10">Nenhum registro concluído no período.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {history.map((h) => {
                const isOrder = "quote_id" in h || historyType === "ordens_servico";
                const meta = isOrder ? STATUS_META[h.status as SOStatus] : null;
                return (
                  <div key={h.id}
                    onClick={() => navigate(isOrder ? `/admin/ordens-servico/${h.id}` : `/admin/orcamentos/${h.id}`)}
                    className="bg-white rounded-xl border border-slate-200 p-3 flex items-center justify-between gap-3 cursor-pointer hover:border-blue-300 transition-all">
                    <div className="min-w-0">
                      <p className="text-[9px] font-black text-slate-300 uppercase tracking-wider">#{String(h.number).padStart(4, "0")}</p>
                      <p className="text-[12px] font-bold text-slate-800 truncate">{h.customer_name || "Sem cliente"}</p>
                      {h.updated_at && <p className="text-[9px] text-slate-400">{new Date(h.updated_at).toLocaleDateString("pt-BR")}</p>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {meta ? (
                        <span className={cn("px-1.5 py-0.5 rounded text-[8px] font-black uppercase flex items-center gap-1", meta.color)}>{meta.icon} {meta.label}</span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase bg-slate-100 text-slate-500">{QUOTE_LABELS[h.status] ?? h.status}</span>
                      )}
                      <span className="text-[11px] font-mono font-bold text-slate-500">{fmt(h.total_amount)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={22} className="animate-spin text-slate-300" />
        </div>
      ) : (
        <>
          {/* Desktop/tablet: colunas lado a lado com scroll horizontal */}
          <div className="hidden md:flex gap-3 overflow-x-auto pb-4">
            {columns.map((stage, idx) => {
              const cards = cardsByStage.get(stage) ?? [];
              const nextStage = columns[idx + 1];
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
                    {cards.map((card) => renderCard(card, stage, nextStage))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Mobile: seletor de etapa (pill row) + lista vertical de uma etapa por vez */}
          <div className="md:hidden space-y-3">
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {columns.map((stage) => {
                const count = (cardsByStage.get(stage) ?? []).length;
                return (
                  <button
                    key={stage}
                    onClick={() => setMobileStage(stage)}
                    className={cn("shrink-0 h-8 px-3 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all",
                      mobileStage === stage ? "bg-blue-600 text-white" : "bg-white border border-slate-200 text-slate-500")}
                  >
                    {labelFor(stage)} <span className="opacity-70">({count})</span>
                  </button>
                );
              })}
            </div>
            <div className="flex flex-col gap-2">
              {(cardsByStage.get(mobileStage ?? "") ?? []).length === 0 ? (
                <p className="text-[11px] text-slate-400 text-center py-8">Nenhum card nesta etapa</p>
              ) : (
                (cardsByStage.get(mobileStage ?? "") ?? []).map((card) =>
                  renderCard(card, mobileStage ?? "", columns[columns.indexOf(mobileStage ?? "") + 1]))
              )}
            </div>
          </div>
        </>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Excluir este card?"
        description="Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        variant="danger"
        loading={deleting}
      />

      <Modal
        open={quickQuoteOpen}
        onClose={closeQuickQuote}
        title="Novo Orçamento Rápido"
        subtitle="Informe o cliente para criar o orçamento"
        size="sm"
        persistent={quickQuoteCreating}
        footer={
          <div className="flex gap-3 w-full">
            <Button variant="secondary" onClick={closeQuickQuote} className="flex-1" disabled={quickQuoteCreating}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={submitQuickQuote}
              loading={quickQuoteCreating}
              disabled={!quickQuoteName.trim()}
              className="flex-1"
            >
              Criar
            </Button>
          </div>
        }
      >
        <div className="space-y-2">
          <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block">Nome do Cliente</label>
          <input
            autoFocus
            value={quickQuoteName}
            onChange={(e) => { setQuickQuoteName(e.target.value); if (quickQuoteError) setQuickQuoteError(""); }}
            onKeyDown={(e) => { if (e.key === "Enter" && quickQuoteName.trim() && !quickQuoteCreating) submitQuickQuote(); }}
            placeholder="Ex: João da Silva"
            className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {quickQuoteError && (
            <p className="text-[11px] font-bold text-red-500">{quickQuoteError}</p>
          )}
        </div>
      </Modal>
    </div>
  );
}
