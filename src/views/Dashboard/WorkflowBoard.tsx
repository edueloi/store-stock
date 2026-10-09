import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, ClipboardList, FileText, Loader2, Trash2, History, Link2, Plus, ClipboardPlus, UserRound, CalendarClock, Wrench } from "lucide-react";
import PageHeader from "../../components/layout/PageHeader";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import { Modal, ModalFooter, Button, IconButton, Input, Textarea, Tabs, Alert } from "../../components/ui";
import { cn } from "../../lib/utils";
import { getStoredUser } from "../../lib/session";
import { authHeader, fmt, STATUS_ORDER, STATUS_META, type SOStatus } from "./serviceOrders.shared";
import { onRealtimeAny } from "../../lib/realtime";

type Tab = "ordens_servico" | "orcamentos" | "atividades" | "concluidos";

const BOARD_TABS = [
  { id: "ordens_servico", label: "Ordens de Serviço", icon: ClipboardList },
  { id: "orcamentos", label: "Orçamentos", icon: FileText },
  { id: "atividades", label: "Atividades", icon: ClipboardPlus },
  { id: "concluidos", label: "Concluídos", icon: History },
] as const;

const HISTORY_TYPE_TABS = [
  { id: "ordens_servico", label: "OS" },
  { id: "orcamentos", label: "Orçamentos" },
] as const;

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

interface ProductionTask {
  id: number; number: number; title: string; description?: string | null; expected_result?: string | null;
  status: string; priority: "normal" | "urgente"; customer_name?: string | null; customer_phone?: string | null;
  customer_email?: string | null; assignee_name?: string | null; created_by_name?: string | null;
  due_at?: string | null; planned_items?: { name?: string }[]; service_order_id?: number | null;
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
  const [tasks, setTasks] = useState<ProductionTask[]>([]);
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
  const [taskOpen, setTaskOpen] = useState(false);
  const [taskSaving, setTaskSaving] = useState(false);
  const [taskError, setTaskError] = useState("");
  const [taskForm, setTaskForm] = useState({ title: "", description: "", expected_result: "", priority: "normal", customer_name: "", customer_phone: "", customer_email: "", assignee_name: "", due_at: "", planned_items: "" });

  const effectiveTab: "ordens_servico" | "orcamentos" = graficaEnabled ? "ordens_servico" : (tab === "orcamentos" ? "orcamentos" : "ordens_servico");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (graficaEnabled) {
        const [ordersRes, tasksRes] = await Promise.all([
          fetch("/api/workflow/board?type=ordens_servico", { headers: authHeader() }),
          fetch("/api/workflow/tasks", { headers: authHeader() }),
        ]);
        if (ordersRes.ok) setOrders(await ordersRes.json());
        if (tasksRes.ok) setTasks(await tasksRes.json());
      } else {
        const [ordersRes, quotesRes, tasksRes] = await Promise.all([
          fetch("/api/workflow/board?type=ordens_servico", { headers: authHeader() }),
          fetch("/api/workflow/board?type=orcamentos", { headers: authHeader() }),
          fetch("/api/workflow/tasks", { headers: authHeader() }),
        ]);
        if (ordersRes.ok) setOrders(await ordersRes.json());
        if (quotesRes.ok) setQuotes(await quotesRes.json());
        if (tasksRes.ok) setTasks(await tasksRes.json());
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

  const taskCardsByStage = useMemo(() => {
    const map = new Map<string, ProductionTask[]>();
    for (const stage of columns) map.set(stage, []);
    for (const task of tasks) if (map.has(task.status)) map.get(task.status)!.push(task);
    return map;
  }, [tasks, columns]);

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

  const openTask = () => {
    setTaskForm({ title: "", description: "", expected_result: "", priority: "normal", customer_name: "", customer_phone: "", customer_email: "", assignee_name: "", due_at: "", planned_items: "" });
    setTaskError("");
    setTaskOpen(true);
  };

  const submitTask = async () => {
    if (!taskForm.title.trim()) { setTaskError("Informe a atividade que deve ser feita."); return; }
    setTaskSaving(true);
    try {
      const res = await fetch("/api/workflow/tasks", {
        method: "POST", headers: authHeader(),
        body: JSON.stringify({ ...taskForm, planned_items: taskForm.planned_items.split("\n").map((name) => name.trim()).filter(Boolean).map((name) => ({ name })) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setTaskError(data.error || "Não foi possível criar a atividade."); return; }
      setTaskOpen(false);
      setTasks((prev) => [data, ...prev]);
    } finally { setTaskSaving(false); }
  };

  const moveTask = async (task: ProductionTask, nextStatus: string) => {
    const res = await fetch(`/api/workflow/tasks/${task.id}/status`, { method: "PUT", headers: authHeader(), body: JSON.stringify({ status: nextStatus }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setError(data.error || "Não foi possível mover a atividade."); return; }
    setTasks((prev) => prev.map((item) => item.id === task.id ? data : item));
  };

  const createTaskServiceOrder = async (task: ProductionTask) => {
    const res = await fetch(`/api/workflow/tasks/${task.id}/create-service-order`, { method: "POST", headers: authHeader() });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setError(data.error || "Não foi possível criar a Ordem de Serviço."); return; }
    navigate(`/admin/ordens-servico/${data.service_order_id}`);
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
        className="bg-white rounded-lg border border-slate-200 p-3 cursor-pointer hover:border-blue-300 hover:shadow-sm transition-all group"
      >
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-semibold text-slate-300">#{String(card.number).padStart(4, "0")}</p>
          <div className="flex items-center gap-1">
            {meta && (
              <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1", meta.color)}>
                {meta.icon} {meta.label}
              </span>
            )}
            <IconButton
              variant="ghost"
              size="xs"
              aria-label="Excluir"
              onClick={(e) => { e.stopPropagation(); setDeleteTarget({ id: card.id, isOrder: effectiveTab === "ordens_servico" }); }}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:bg-red-50"
              title="Excluir"
            >
              <Trash2 size={12} />
            </IconButton>
          </div>
        </div>
        <p className="text-[12px] font-semibold text-slate-800 truncate mt-1">{card.title}</p>
        {card.quoteNumber && (
          <p className="text-[10px] font-semibold text-blue-400 flex items-center gap-1 mt-0.5">
            <Link2 size={10} /> Orç. #{String(card.quoteNumber).padStart(4, "0")}
          </p>
        )}
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-[11px] font-mono font-semibold text-slate-500">{card.subtitle}</span>
          {nextStage && (
            <IconButton
              variant="ghost"
              size="xs"
              aria-label="Avançar etapa"
              onClick={(e) => { e.stopPropagation(); moveCard(card.id, stage, nextStage); }}
              disabled={movingId === card.id || !canMove(nextStage)}
              title={canMove(nextStage) ? `Avançar para ${labelFor(nextStage)}` : "Sem permissão para esta etapa"}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-blue-500 hover:bg-blue-50"
            >
              {movingId === card.id ? <Loader2 size={13} className="animate-spin" /> : <ArrowRight size={13} />}
            </IconButton>
          )}
        </div>
      </div>
    );
  };

  const renderTaskCard = (task: ProductionTask, stage: string, nextStage: string | undefined) => (
    <div key={task.id} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[10px] font-semibold text-slate-400">ATV #{String(task.number).padStart(4, "0")}</span>
        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", task.priority === "urgente" ? "bg-rose-100 text-rose-600" : "bg-blue-50 text-blue-600")}>{task.priority}</span>
      </div>
      <p className="mt-2 text-[12px] font-semibold text-slate-800">{task.title}</p>
      {task.description && <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-slate-500">{task.description}</p>}
      {task.expected_result && <p className="mt-1 line-clamp-1 text-[10px] font-semibold text-violet-600">Entrega: {task.expected_result}</p>}
      {!!task.planned_items?.length && <p className="mt-2 line-clamp-2 rounded-lg bg-slate-50 px-2 py-1.5 text-[10px] text-slate-500">Itens: {task.planned_items.map((item) => item.name).filter(Boolean).join(" · ")}</p>}
      <div className="mt-3 space-y-1 border-t border-slate-100 pt-2 text-[10px] font-semibold text-slate-500">
        {task.customer_name && <p className="flex items-center gap-1"><UserRound size={10} /> {task.customer_name}</p>}
        {task.assignee_name && <p className="flex items-center gap-1"><Wrench size={10} /> {task.assignee_name}</p>}
        {task.due_at && <p className="flex items-center gap-1 text-amber-600"><CalendarClock size={10} /> {new Date(`${task.due_at}T12:00:00`).toLocaleDateString("pt-BR")}</p>}
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <Button variant="ghost" size="xs" onClick={() => createTaskServiceOrder(task)}>
          {task.service_order_id ? "Abrir OS" : "Criar OS"}
        </Button>
        {nextStage && <Button size="xs" onClick={() => moveTask(task, nextStage)} iconRight={<ArrowRight size={11} />}>Avançar</Button>}
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Fluxo de Produção"
        subtitle={graficaEnabled ? "Acompanhe os trabalhos por etapa" : "Acompanhe Ordens de Serviço e Orçamentos por etapa"}
        action={<div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={openTask} iconLeft={<ClipboardPlus size={14} />}>Nova Atividade</Button>
          <Button size="sm" onClick={openQuickQuote} iconLeft={<Plus size={14} />}>Novo Orçamento</Button>
        </div>}
      />

      <Tabs<Tab> items={graficaEnabled ? BOARD_TABS.filter((t) => t.id === "atividades" || t.id === "concluidos") : BOARD_TABS} value={tab} onChange={setTab} label="Etapas do fluxo de produção">
      {error && (
        <Alert variant="error">{error}</Alert>
      )}

      {tab === "concluidos" ? (
        <div className="space-y-4">
          <div className="flex items-end gap-3 flex-wrap bg-white rounded-lg border border-slate-200 p-4">
            {!graficaEnabled && (
              <div>
                <label className="ds-label mb-1 block">Tipo</label>
                <Tabs<"ordens_servico" | "orcamentos"> items={HISTORY_TYPE_TABS} value={historyType} onChange={setHistoryType} label="Tipo de registro concluído">{null}</Tabs>
              </div>
            )}
            <div>
              <Input label="De" type="date" value={historyFrom} onChange={(e) => setHistoryFrom(e.target.value)} />
            </div>
            <div>
              <Input label="Até" type="date" value={historyTo} onChange={(e) => setHistoryTo(e.target.value)} />
            </div>
            <Button onClick={loadHistory} loading={historyLoading}>Filtrar</Button>
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
                    className="bg-white rounded-lg border border-slate-200 p-3 flex items-center justify-between gap-3 cursor-pointer hover:border-blue-300 transition-all">
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold text-slate-300">#{String(h.number).padStart(4, "0")}</p>
                      <p className="text-[12px] font-semibold text-slate-800 truncate">{h.customer_name || "Sem cliente"}</p>
                      {h.updated_at && <p className="text-[10px] text-slate-400">{new Date(h.updated_at).toLocaleDateString("pt-BR")}</p>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {meta ? (
                        <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1", meta.color)}>{meta.icon} {meta.label}</span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-500">{QUOTE_LABELS[h.status] ?? h.status}</span>
                      )}
                      <span className="text-[11px] font-mono font-semibold text-slate-500">{fmt(h.total_amount)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : tab === "atividades" ? (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {columns.map((stage, idx) => {
            const stageTasks = taskCardsByStage.get(stage) ?? [];
            return <div key={stage} className="flex w-72 shrink-0 flex-col gap-2 rounded-lg border border-violet-100 bg-violet-50/40 p-3">
              <div className="flex items-center justify-between px-1"><p className="text-[11px] font-semibold text-violet-700">{labelFor(stage)}</p><span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-violet-500">{stageTasks.length}</span></div>
              <div className="flex min-h-[80px] flex-col gap-2">{stageTasks.map((task) => renderTaskCard(task, stage, columns[idx + 1]))}</div>
            </div>;
          })}
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
                    "shrink-0 w-72 rounded-lg border bg-slate-50/60 p-3 flex flex-col gap-2 transition-colors",
                    dragOverStage === stage ? "border-blue-400 bg-blue-50/60" : "border-slate-200"
                  )}
                >
                  <div className="flex items-center justify-between px-1">
                    <p className="text-[11px] font-semibold text-slate-600">{labelFor(stage)}</p>
                    <span className="text-[10px] font-semibold text-slate-400 bg-white border border-slate-200 rounded-full px-2 py-0.5">{cards.length}</span>
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
            <Tabs<string>
              items={columns.map((stage) => ({ id: stage, label: `${labelFor(stage)} (${(cardsByStage.get(stage) ?? []).length})` }))}
              value={mobileStage ?? ""}
              onChange={setMobileStage}
              label="Etapas do fluxo"
            >{null}</Tabs>
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

      </Tabs>

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
          <ModalFooter>
            <Button variant="ghost" size="sm" onClick={closeQuickQuote} disabled={quickQuoteCreating}>
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={submitQuickQuote}
              loading={quickQuoteCreating}
              disabled={!quickQuoteName.trim()}
            >
              Criar
            </Button>
          </ModalFooter>
        }
      >
        <div className="space-y-2">
          <Input
            label="Nome do Cliente"
            autoFocus
            value={quickQuoteName}
            onChange={(e) => { setQuickQuoteName(e.target.value); if (quickQuoteError) setQuickQuoteError(""); }}
            onKeyDown={(e) => { if (e.key === "Enter" && quickQuoteName.trim() && !quickQuoteCreating) submitQuickQuote(); }}
            placeholder="Ex: João da Silva"
            error={quickQuoteError || undefined}
          />
        </div>
      </Modal>

      <Modal
        open={taskOpen}
        onClose={() => !taskSaving && setTaskOpen(false)}
        title="Nova atividade de produção"
        subtitle="Crie um card independente e transforme em OS quando precisar"
        size="lg"
        persistent={taskSaving}
        footer={<ModalFooter><Button variant="ghost" size="sm" onClick={() => setTaskOpen(false)} disabled={taskSaving}>Cancelar</Button><Button size="sm" onClick={submitTask} loading={taskSaving}>Criar atividade</Button></ModalFooter>}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input label="Atividade *" wrapperClassName="sm:col-span-2" autoFocus value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} placeholder="Ex.: Produzir fachada e instalar até sexta" />
          <Input label="Cliente" value={taskForm.customer_name} onChange={(e) => setTaskForm({ ...taskForm, customer_name: e.target.value })} placeholder="Nome do cliente" />
          <Input label="Quem vai fazer" value={taskForm.assignee_name} onChange={(e) => setTaskForm({ ...taskForm, assignee_name: e.target.value })} placeholder="Responsável pela atividade" />
          <Input label="Telefone" value={taskForm.customer_phone} onChange={(e) => setTaskForm({ ...taskForm, customer_phone: e.target.value })} placeholder="(00) 00000-0000" />
          <Input label="Prazo" type="date" value={taskForm.due_at} onChange={(e) => setTaskForm({ ...taskForm, due_at: e.target.value })} />
          <div>
            <label className="ds-label mb-1 block">Prioridade</label>
            <div className="flex gap-2">
              <Button size="md" variant={taskForm.priority === "normal" ? "primary" : "outline"} className="flex-1" onClick={() => setTaskForm({ ...taskForm, priority: "normal" })}>Normal</Button>
              <Button size="md" variant={taskForm.priority === "urgente" ? "danger" : "outline"} className="flex-1" onClick={() => setTaskForm({ ...taskForm, priority: "urgente" })}>Urgente</Button>
            </div>
          </div>
          <Input label="E-mail do cliente" type="email" value={taskForm.customer_email} onChange={(e) => setTaskForm({ ...taskForm, customer_email: e.target.value })} placeholder="cliente@empresa.com" />
          <Textarea label="O que precisa ser feito" wrapperClassName="sm:col-span-2" value={taskForm.description} onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })} rows={3} placeholder="Detalhes da atividade, medidas, orientações e observações" />
          <Textarea label="Produtos / serviços planejados" wrapperClassName="sm:col-span-2" value={taskForm.planned_items} onChange={(e) => setTaskForm({ ...taskForm, planned_items: e.target.value })} rows={2} placeholder="Um item por linha" />
          <Textarea label="Resultado esperado" wrapperClassName="sm:col-span-2" value={taskForm.expected_result} onChange={(e) => setTaskForm({ ...taskForm, expected_result: e.target.value })} rows={2} placeholder="Como deve ficar ao concluir" />
          {taskError && <Alert variant="error" className="sm:col-span-2">{taskError}</Alert>}
        </div>
      </Modal>
    </div>
  );
}
