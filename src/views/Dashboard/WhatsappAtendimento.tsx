import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bot,
  Check,
  Clock3,
  Loader2,
  MessageCircle,
  Phone,
  RefreshCw,
  Send,
  UserCheck,
  Users,
  XCircle,
} from "lucide-react";

import PageHeader from "../../components/layout/PageHeader";
import { useToast } from "../../components/ui/Toast";
import { getStoredUser } from "../../lib/session";
import { cn } from "../../lib/utils";
import { Button, IconButton, Select, Textarea, Badge } from "../../components/ui";

type ConversationStatus = "bot" | "queued" | "assigned" | "closed";
export type AtendimentoView = ConversationStatus;

interface Agent {
  id: number;
  name: string;
  department: string;
  is_active: boolean;
  is_online: boolean;
  can_receive_transfer: boolean;
  current_load: number;
  max_concurrent_chats: number;
  is_available: boolean;
}

interface Sector {
  id: number;
  key: string;
  name: string;
  is_active: boolean;
}

interface Conversation {
  id: number;
  phone: string;
  customer_name?: string | null;
  status: ConversationStatus;
  department?: string | null;
  department_label: string;
  queue_position?: number | null;
  last_message_preview?: string | null;
  last_inbound_at?: string | null;
  last_outbound_at?: string | null;
  updated_at: string;
  closed_reason?: string | null;
  assigned_agent?: { id: number; name: string; department: string } | null;
}

interface MessageLog {
  id: number;
  direction: "customer" | "bot" | "agent" | "system";
  body?: string | null;
  created_at: string;
}

interface Overview {
  stats: Record<`${ConversationStatus}_conversations`, number> & { online_agents: number };
  agents: Agent[];
  sectors: Sector[];
  conversations: Conversation[];
}

interface ConversationDetail {
  conversation: Conversation;
  messages: MessageLog[];
}

const VIEW_META: Record<AtendimentoView, {
  title: string;
  subtitle: string;
  empty: string;
  icon: typeof Bot;
  tone: string;
}> = {
  bot: {
    title: "Bot de atendimento",
    subtitle: "Clientes no fluxo automático que podem ser assumidos pela equipe",
    empty: "Nenhum cliente está falando com o bot agora.",
    icon: Bot,
    tone: "text-violet-700 bg-violet-50 border-violet-200",
  },
  queued: {
    title: "Fila de espera",
    subtitle: "Clientes aguardando atendimento, organizados pela ordem de chegada",
    empty: "A fila está vazia. Novos pedidos de atendimento aparecerão aqui.",
    icon: Clock3,
    tone: "text-amber-700 bg-amber-50 border-amber-200",
  },
  assigned: {
    title: "Em atendimento",
    subtitle: "Conversas assumidas pela equipe e prontas para resposta",
    empty: "Nenhuma conversa está em atendimento neste momento.",
    icon: UserCheck,
    tone: "text-emerald-700 bg-emerald-50 border-emerald-200",
  },
  closed: {
    title: "Atendimentos finalizados",
    subtitle: "Histórico recente de conversas encerradas",
    empty: "Ainda não há atendimentos finalizados.",
    icon: Check,
    tone: "text-slate-600 bg-slate-100 border-slate-200",
  },
};

const DEPARTMENT_LABELS: Record<string, string> = {
  sales: "Vendas",
  support: "Atendimento",
  finance: "Financeiro",
};

function authHeaders() {
  return {
    Authorization: `Bearer ${localStorage.getItem("token")}`,
    "Content-Type": "application/json",
  };
}

function formatTime(value?: string | null) {
  if (!value) return "Sem atividade";
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" }).format(new Date(value));
}

function initials(name?: string | null) {
  return (name || "?").trim().slice(0, 1).toUpperCase();
}

export default function WhatsappAtendimento({ view }: { view: AtendimentoView }) {
  const toast = useToast();
  const navigate = useNavigate();
  const meta = VIEW_META[view];
  const Icon = meta.icon;
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [agentId, setAgentId] = useState<number | "">("");
  const [department, setDepartment] = useState("");
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const conversations = useMemo(
    () => (overview?.conversations ?? []).filter((conversation) => conversation.status === view),
    [overview?.conversations, view],
  );

  const loadOverview = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const response = await fetch("/api/whatsapp/overview", { headers: authHeaders() });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível carregar os atendimentos.");
      setOverview(data);
    } catch (error) {
      if (!silent) toast.error(error instanceof Error ? error.message : "Não foi possível carregar os atendimentos.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [toast]);

  const loadConversation = useCallback(async (conversationId: number, silent = false) => {
    if (!silent) setLoadingDetail(true);
    try {
      const response = await fetch(`/api/whatsapp/conversations/${conversationId}/messages`, { headers: authHeaders() });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível abrir a conversa.");
      setDetail(data);
      setSelectedId(conversationId);
      setAgentId(data.conversation.assigned_agent?.id ?? "");
      setDepartment(data.conversation.department ?? "");
    } catch (error) {
      if (!silent) toast.error(error instanceof Error ? error.message : "Não foi possível abrir a conversa.");
    } finally {
      if (!silent) setLoadingDetail(false);
    }
  }, [toast]);

  useEffect(() => { void loadOverview(); }, [loadOverview]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void loadOverview(true);
      if (selectedId) void loadConversation(selectedId, true);
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [loadConversation, loadOverview, selectedId]);

  useEffect(() => {
    if (selectedId && !conversations.some((conversation) => conversation.id === selectedId)) {
      setSelectedId(null);
      setDetail(null);
      setDraft("");
    }
  }, [conversations, selectedId]);

  const assign = async (assumeNow = false) => {
    if (!selectedId || (assumeNow ? !agentId : (!agentId && !department))) {
      toast.warning("Selecione um atendente disponível.");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(`/api/whatsapp/conversations/${selectedId}/${assumeNow ? "assign" : "transfer"}`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(assumeNow ? { agent_id: agentId } : { department, agent_id: agentId || undefined }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível iniciar o atendimento.");
      setDetail(data);
      await loadOverview(true);
      if (data.conversation?.status === "assigned") {
        toast.success(assumeNow ? "Conversa assumida." : "Atendimento iniciado.");
        if (view !== "assigned") navigate("/admin/atendimento/em-andamento");
      } else {
        toast.info(agentId ? "Pedido enviado ao atendente para aceite." : "Pedido enviado ao setor; o primeiro atendente a aceitar assume.");
        if (view !== "queued") navigate("/admin/atendimento/fila");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível iniciar o atendimento.");
    } finally {
      setSaving(false);
    }
  };

  const close = async () => {
    if (!selectedId) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/whatsapp/conversations/${selectedId}/close`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ reason: "closed-from-attendance" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível finalizar o atendimento.");
      toast.success("Atendimento finalizado.");
      setDetail(null);
      setSelectedId(null);
      setDraft("");
      await loadOverview(true);
      if (view !== "closed") navigate("/admin/atendimento/finalizados");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível finalizar o atendimento.");
    } finally {
      setSaving(false);
    }
  };

  const send = async () => {
    if (!selectedId || !draft.trim()) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/whatsapp/conversations/${selectedId}/message`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ text: draft.trim(), author: getStoredUser()?.name || "Atendimento" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível enviar a mensagem.");
      setDetail(data);
      setDraft("");
      await loadOverview(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível enviar a mensagem.");
    } finally {
      setSaving(false);
    }
  };

  const activeSectors = (overview?.sectors ?? []).filter((sector) => sector.is_active);
  const sectorNames = new Map((overview?.sectors ?? []).map((sector) => [sector.key, sector.name]));
  const availableAgents = (overview?.agents ?? []).filter((agent) => agent.is_active && (!department || agent.department === department));
  const selected = detail?.conversation;

  return (
    <div className="space-y-5">
      <PageHeader
        title={meta.title}
        subtitle={meta.subtitle}
        action={
          <Button variant="outline" size="sm" onClick={() => void loadOverview()} iconLeft={<RefreshCw size={14} />}>Atualizar</Button>
        }
      />

      <div className="min-h-[580px] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm grid grid-cols-1 xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="border-b border-slate-200 xl:border-b-0 xl:border-r overflow-y-auto max-h-[360px] xl:max-h-[680px]">
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-4 py-3">
            <div className="flex items-center gap-2">
              <span className={cn("grid h-8 w-8 place-items-center rounded-lg border", meta.tone)}><Icon size={15} /></span>
              <div>
                <p className="text-xs font-semibold text-slate-900">{meta.title}</p>
                <p className="text-[11px] font-semibold text-slate-400">{conversations.length} conversa{conversations.length === 1 ? "" : "s"}</p>
              </div>
            </div>
            <span className="grid h-7 min-w-7 place-items-center rounded-full bg-slate-100 px-2 text-[11px] font-semibold text-slate-600">{conversations.length}</span>
          </div>
          {loading ? (
            <div className="grid min-h-48 place-items-center text-slate-400"><Loader2 className="animate-spin" size={20} /></div>
          ) : conversations.length === 0 ? (
            <div className="p-7 text-center">
              <Icon className="mx-auto text-slate-300" size={28} />
              <p className="mt-3 text-sm font-semibold text-slate-600">{meta.empty}</p>
            </div>
          ) : conversations.map((conversation) => (
            <button key={conversation.id} onClick={() => void loadConversation(conversation.id)} className={cn("w-full border-b border-slate-100 px-4 py-4 text-left transition hover:bg-slate-50", selectedId === conversation.id && "bg-blue-50/70 border-l-4 border-l-blue-600 pl-3") }>
              <div className="flex gap-3">
                <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-semibold", view === "bot" ? "bg-violet-100 text-violet-700" : "bg-slate-100 text-slate-600")}>{view === "bot" ? <Bot size={18} /> : initials(conversation.customer_name)}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2"><strong className="truncate text-[13px] text-slate-800">{conversation.customer_name || conversation.phone}</strong><small className="shrink-0 text-[11px] font-semibold text-slate-400">{formatTime(conversation.last_inbound_at || conversation.updated_at)}</small></span>
                  <span className="mt-1 block truncate text-[11px] text-slate-500">{conversation.last_message_preview || "Sem mensagens registradas"}</span>
                  <span className="mt-2 flex flex-wrap items-center gap-1.5">
                    {conversation.queue_position && <Badge size="sm" color="warning">#{conversation.queue_position} na fila</Badge>}
                    {conversation.assigned_agent && <Badge size="sm" color="success">{conversation.assigned_agent.name}</Badge>}
                    {conversation.department_label && <Badge size="sm">{conversation.department_label}</Badge>}
                  </span>
                </span>
              </div>
            </button>
          ))}
        </aside>

        <section className="flex min-h-[480px] flex-col bg-slate-50/50">
          {!selected ? (
            <div className="m-auto max-w-sm px-6 text-center">
              <MessageCircle className="mx-auto text-slate-200" size={44} />
              <h3 className="mt-4 text-base font-semibold text-slate-700">Selecione uma conversa</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">Abra um cliente da lista para ver o histórico e responder por aqui.</p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4">
                <div className="min-w-0">
                  <h3 className="truncate text-base font-semibold text-slate-900">{selected.customer_name || "Cliente sem nome"}</h3>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500"><Phone size={12} /> {selected.phone}</p>
                </div>
                <div className="flex items-center gap-2">
                  {selected.status !== "closed" && <Button variant="danger" size="sm" disabled={saving} onClick={() => void close()} iconLeft={<XCircle size={14} />}>Encerrar conversa</Button>}                </div>
              </div>

              {selected.status !== "assigned" && selected.status !== "closed" && (
                <div className="grid gap-2 border-b border-amber-100 bg-amber-50 px-5 py-3 md:grid-cols-[180px_minmax(0,1fr)_auto_auto]">
                  <Select aria-label="Setor" value={department} onChange={(event) => { setDepartment(event.target.value); setAgentId(""); }}>
                    <option value="">Selecionar setor</option>
                    {activeSectors.map((sector) => <option key={sector.id} value={sector.key}>{sector.name}</option>)}
                  </Select>
                  <Select aria-label="Atendente" value={agentId} onChange={(event) => setAgentId(Number(event.target.value) || "")}>
                    <option value="">Distribuir automaticamente no setor</option>
                    {availableAgents.map((agent) => <option key={agent.id} value={agent.id} disabled={!agent.is_available}>{agent.name} · {sectorNames.get(agent.department) || DEPARTMENT_LABELS[agent.department] || agent.department} ({agent.current_load}/{agent.max_concurrent_chats}){agent.is_available ? "" : " — indisponível"}</option>)}
                  </Select>
                  <Button variant="outline" disabled={saving || (!agentId && !department)} onClick={() => void assign()} iconLeft={<UserCheck size={14} />}>{agentId ? "Enviar para pessoa" : "Distribuir no setor"}</Button>
                  <Button disabled={saving || !agentId} onClick={() => void assign(true)} iconLeft={<UserCheck size={14} />}>Assumir agora</Button>
                </div>
              )}

              {selected.status === "assigned" && <div className="border-b border-emerald-100 bg-emerald-50 px-5 py-2.5 text-[11px] font-semibold text-emerald-700 flex items-center gap-2"><UserCheck size={14} /> Atendimento em andamento com {selected.assigned_agent?.name || "a equipe"}.</div>}
              {selected.status === "closed" && <div className="border-b border-slate-200 bg-slate-100 px-5 py-2.5 text-[11px] font-semibold text-slate-500 flex items-center gap-2"><Check size={14} /> Atendimento finalizado{selected.closed_reason ? `: ${selected.closed_reason}` : "."}</div>}

              <div className="flex-1 space-y-3 overflow-y-auto p-5 max-h-[420px] xl:max-h-[450px]">
                {loadingDetail && !detail ? <div className="grid h-full place-items-center"><Loader2 className="animate-spin text-slate-400" size={20} /></div> : detail?.messages.map((message) => {
                  const mine = message.direction !== "customer";
                  return <div key={message.id} className={cn("flex", mine ? "justify-end" : "justify-start")}><div className={cn("max-w-[82%] rounded-lg border px-3.5 py-2.5 shadow-sm", mine ? message.direction === "bot" ? "border-violet-200 bg-violet-50 text-violet-950" : "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-700")}><p className="whitespace-pre-wrap text-sm leading-relaxed">{message.body || "Mensagem sem conteúdo"}</p><p className={cn("mt-1 text-[11px] font-medium", mine && message.direction !== "bot" ? "text-blue-100" : "text-slate-400")}>{message.direction === "bot" ? "BOT · " : ""}{formatTime(message.created_at)}</p></div></div>;
                })}
              </div>

              {selected.status !== "closed" && (
                <div className="border-t border-slate-200 bg-white p-4">
                  <div className="flex items-end gap-2">
                    <Textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }} rows={2} placeholder={selected.status === "assigned" ? "Escreva uma resposta…" : "Assuma o atendimento antes de responder…"} disabled={selected.status !== "assigned" || saving} wrapperClassName="flex-1" className="min-h-11 resize-none" aria-label="Mensagem" />
                    <IconButton variant="primary" size="lg" aria-label="Enviar mensagem" onClick={() => void send()} disabled={selected.status !== "assigned" || saving || !draft.trim()}><Send size={16} /></IconButton>
                  </div>
                  <p className="mt-2 text-[11px] font-medium text-slate-400">Enter envia · Shift + Enter quebra a linha</p>
                </div>
              )}
            </>
          )}
        </section>
      </div>

      <p className="flex items-center gap-2 text-[11px] font-medium text-slate-400"><Users size={13} /> {overview?.stats.online_agents ?? 0} atendente{(overview?.stats.online_agents ?? 0) === 1 ? "" : "s"} online{(overview?.stats.online_agents ?? 0) === 1 ? "" : "s"}.</p>
    </div>
  );
}
