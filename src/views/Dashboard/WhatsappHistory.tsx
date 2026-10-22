import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowUpRight, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Filter, Loader2, MessageSquareText, Mic, RefreshCw, Search, Users } from "lucide-react";
import PageHeader from "../../components/layout/PageHeader";
import { Badge, Button, Input, Select } from "../../components/ui";
import { formatContactPhone } from "../../lib/whatsappPhone";
import { historyCloseReason, HISTORY_CLOSE_REASONS } from "../../../shared/whatsappHistory";
import { cn } from "../../lib/utils";

type RecordItem = {
  id: number; conversation_id: number; phone: string; customer_name: string | null; subject: string | null;
  department: string | null; department_label: string | null; agent_name: string | null;
  started_at: string; closed_at: string; close_reason: string; message_count: number; legacy_import: boolean;
};
type History = { records: RecordItem[]; page: number; page_size: number; pages: number; total: number; clients: number; messages: number; sectors: { key: string; name: string }[]; agents: { id: number; name: string }[] };
type Detail = { record: RecordItem; messages: { id: number; direction: string; body: string | null; message_type: string; created_at: string }[]; next_cursor: number | null };
const headers = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}` });
const protocol = (id: number) => `#${String(id).padStart(6, "0")}`;
const customer = (record: RecordItem) => record.customer_name || "Cliente sem nome";
const responsible = (record: RecordItem) => record.agent_name || (record.legacy_import ? "Não registrado" : "Assistente virtual");
const formatDate = (value: string, full = true) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", ...(full ? { hour: "2-digit", minute: "2-digit" } : {}) }).format(new Date(value));
const dayAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
const readFilters = (params: URLSearchParams) => Object.fromEntries(["from", "to", "department", "agent", "reason"].map(key => [key, params.get(key) || ""]));

export default function WhatsappHistory() {
  const [params, setParams] = useSearchParams();
  const [filters, setFilters] = useState(() => readFilters(params));
  const paramsRef = useRef(new URLSearchParams(params));
  useLayoutEffect(() => { paramsRef.current = new URLSearchParams(params); setFilters(readFilters(params)); }, [params]);
  const selectedId = params.get("atendimento");
  const [search, setSearch] = useState(params.get("q") || "");
  const [subject, setSubject] = useState(params.get("subject") || "");
  const [history, setHistory] = useState<History | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true), [loadingDetail, setLoadingDetail] = useState(false), [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(""), [detailError, setDetailError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const listParams = new URLSearchParams(params); listParams.delete("atendimento");
  const query = listParams.toString();

  function filter(patch: Record<string, string>, replace = true) {
    setFilters(current => ({ ...current, ...Object.fromEntries(Object.entries(patch).filter(([key]) => key in current)) }));
    // setSearchParams não enfileira atualizações funcionais como setState.
    // O ref preserva filtros alterados em sequência antes do próximo render.
    const next = new URLSearchParams(paramsRef.current);
    for (const [key, value] of Object.entries(patch)) value ? next.set(key, value) : next.delete(key);
    if (!("page" in patch)) next.delete("page");
    paramsRef.current = next;
    setParams(next, { replace });
  }
  useEffect(() => { setSearch(params.get("q") || ""); setSubject(params.get("subject") || ""); }, [params.get("q"), params.get("subject")]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (search !== (params.get("q") || "") || subject !== (params.get("subject") || "")) filter({ q: search, subject });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [search, subject, params]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError("");
    fetch(`/api/whatsapp/history?${query}`, { headers: headers(), signal: controller.signal }).then(async response => {
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "Não foi possível carregar o histórico.");
      setHistory(data);
    }).catch(err => { if (err.name !== "AbortError") setError(err.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [query, refresh]);

  useEffect(() => {
    setDetail(null); setDetailError("");
    if (!selectedId) return;
    const controller = new AbortController(); setLoadingDetail(true);
    fetch(`/api/whatsapp/history/${encodeURIComponent(selectedId)}`, { headers: headers(), signal: controller.signal }).then(async response => {
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "Não foi possível abrir o atendimento.");
      setDetail(data);
    }).catch(err => { if (err.name !== "AbortError") setDetailError(err.message); }).finally(() => { if (!controller.signal.aborted) setLoadingDetail(false); });
    return () => controller.abort();
  }, [selectedId, refresh]);

  async function loadMore() {
    if (!detail?.next_cursor || loadingMore) return;
    const id = selectedId;
    setLoadingMore(true); setDetailError("");
    try {
      const response = await fetch(`/api/whatsapp/history/${id}?after=${detail.next_cursor}`, { headers: headers() });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "Não foi possível carregar as mensagens.");
      setDetail(current => current?.record.id === data.record.id ? { ...data, messages: [...current.messages, ...data.messages] } : current);
    } catch (err) { setDetailError(err instanceof Error ? err.message : "Falha ao carregar mensagens."); }
    finally { setLoadingMore(false); }
  }
  function open(record: RecordItem) {
    const next = new URLSearchParams(paramsRef.current); next.set("atendimento", String(record.id)); paramsRef.current = next; setParams(next);
  }
  function back() { const next = new URLSearchParams(paramsRef.current); next.delete("atendimento"); paramsRef.current = next; setParams(next); }

  if (selectedId) return <div className="space-y-5 pb-8">
    <PageHeader title="Conversa do atendimento" subtitle="Histórico preservado deste atendimento, separado dos próximos contatos do cliente." action={<Button variant="outline" size="sm" onClick={back} iconLeft={<ArrowLeft size={14} />}>Voltar ao histórico</Button>} />
    {loadingDetail && <div className="grid min-h-64 place-items-center" role="status"><Loader2 className="animate-spin text-blue-600" /><span className="sr-only">Carregando conversa</span></div>}
    {detailError && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{detailError}<Button variant="ghost" size="sm" onClick={() => setRefresh(n => n + 1)}>Tentar novamente</Button></div>}
    {detail && <>
      <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><p className="text-xs font-semibold tracking-wide text-blue-600">ATENDIMENTO {protocol(detail.record.id)}</p><h3 className="mt-2 text-xl font-semibold text-slate-900">{customer(detail.record)}</h3><p className="mt-1 text-sm text-slate-500">{formatContactPhone(detail.record.phone)}</p></div>
          <Badge color="success">Finalizado</Badge>
        </div>
        <dl className="mt-6 grid gap-5 border-t border-slate-100 pt-5 text-sm sm:grid-cols-2 xl:grid-cols-4">
          {[["Início", formatDate(detail.record.started_at)], ["Encerramento", formatDate(detail.record.closed_at)], ["Responsável", responsible(detail.record)], ["Setor", detail.record.department_label || "Não registrado"]].map(([label, value]) => <div key={label}><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 font-medium text-slate-800">{value}</dd></div>)}
        </dl>
        <div className="mt-5 rounded-lg bg-slate-50 p-4"><p className="text-xs font-medium text-slate-500">Assunto · primeira solicitação registrada</p><p className="mt-1 break-words text-sm text-slate-800">{detail.record.subject || "Assunto não informado"}</p></div>
        <p className="mt-4 text-xs text-slate-500">{historyCloseReason(detail.record.close_reason)} · {detail.record.message_count} mensagens · Horário de Brasília</p>
        {detail.record.legacy_import && <p className="mt-3 rounded-lg border border-amber-100 bg-amber-50 p-3 text-xs leading-5 text-amber-800">Registro anterior à separação dos atendimentos. As mensagens antigas deste contato foram preservadas juntas; dados de responsável que não foram registrados não são reconstruídos.</p>}
      </section>
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white" aria-label="Mensagens do atendimento">
        <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4"><MessageSquareText size={17} className="text-blue-600" /><h3 className="text-sm font-semibold text-slate-900">Conversa registrada</h3><span className="ml-auto text-xs text-slate-400">Somente leitura</span></div>
        <div className="space-y-4 bg-slate-50 p-4 sm:p-6">
          {detail.messages.length === 0 && <p className="py-10 text-center text-sm text-slate-500">Não há mensagens registradas neste atendimento.</p>}
          {detail.messages.map(message => {
            const mine = message.direction !== "customer", system = message.direction === "system";
            return <div key={message.id} className={cn("flex", system ? "justify-center" : mine ? "justify-end" : "justify-start")}><div className={cn("max-w-[92%] rounded-xl border p-3.5 sm:max-w-[78%]", system ? "border-slate-200 bg-slate-100 text-slate-600" : mine ? "border-blue-100 bg-blue-50 text-slate-800" : "border-slate-200 bg-white text-slate-800")}>
              <p className="mb-2 text-[11px] font-semibold text-slate-500">{system ? "Sistema" : message.direction === "bot" ? "Assistente virtual" : mine ? detail.record.agent_name || "Equipe" : customer(detail.record)}</p>
              {message.message_type === "audio" && <p className="mb-2 flex items-center gap-1 text-xs text-slate-500"><Mic size={13} />Áudio transcrito</p>}
              <p className="whitespace-pre-wrap break-words text-sm leading-6 [overflow-wrap:anywhere]">{message.body || "Mensagem sem conteúdo de texto"}</p><p className="mt-2 text-right text-[10px] text-slate-400">{formatDate(message.created_at)}</p>
            </div></div>;
          })}
          {detail.next_cursor && <div className="flex justify-center"><Button variant="outline" size="sm" onClick={() => void loadMore()} loading={loadingMore}>Carregar mais mensagens</Button></div>}
        </div>
      </section>
    </>}
  </div>;

  return <div className="space-y-5 pb-8">
    <PageHeader title="Histórico de atendimentos" subtitle="Consulte clientes, datas e assuntos dos atendimentos finalizados." action={<Button variant="outline" size="sm" onClick={() => setRefresh(n => n + 1)} iconLeft={<RefreshCw size={14} />}>Atualizar histórico</Button>} />
    <div className="grid gap-3 sm:grid-cols-3">
      {[[CheckCircle2, "Atendimentos encontrados", history?.total], [Users, "Clientes no resultado", history?.clients], [MessageSquareText, "Mensagens registradas", history?.messages]].map(([Icon, label, value]) => {
        const MetricIcon = Icon as typeof Users;
        return <div key={String(label)} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4"><MetricIcon size={19} className="text-blue-600" /><div><p className="text-xs text-slate-500">{String(label)}</p><p className="mt-1 text-xl font-semibold tabular-nums text-slate-900">{typeof value === "number" ? value.toLocaleString("pt-BR") : "—"}</p></div></div>;
      })}
    </div>
    <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5" aria-label="Filtros do histórico">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><Filter size={16} className="text-blue-600" /><h3 className="text-sm font-semibold text-slate-900">Filtrar atendimentos</h3></div><Button variant="ghost" size="xs" onClick={() => { setSearch(""); setSubject(""); setFilters(readFilters(new URLSearchParams())); paramsRef.current = new URLSearchParams(); setParams({}); }}>Limpar filtros</Button></div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Input label="Cliente ou telefone" placeholder="Buscar nome ou número" iconLeft={<Search size={15} />} showCount={false} value={search} onChange={event => setSearch(event.target.value)} />
        <Input label="Assunto" placeholder="Ex.: entrega, bolsa, pagamento" showCount={false} value={subject} onChange={event => setSubject(event.target.value)} />
        <Input label="Encerrados a partir de" type="date" showCount={false} value={filters.from} onChange={event => filter({ from: event.target.value })} />
        <Input label="Encerrados até" type="date" showCount={false} value={filters.to} onChange={event => filter({ to: event.target.value })} />
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <Select label="Setor" value={filters.department} onChange={event => filter({ department: event.target.value })}><option value="">Todos os setores</option>{history?.sectors.map(sector => <option key={sector.key} value={sector.key}>{sector.name}</option>)}</Select>
        <Select label="Responsável" value={filters.agent} onChange={event => filter({ agent: event.target.value })}><option value="">Todos os responsáveis</option><option value="bot">Assistente virtual</option><option value="unknown">Responsável não registrado</option>{history?.agents.map(agent => <option key={agent.id} value={agent.id}>{agent.name}</option>)}</Select>
        <Select label="Encerramento" value={filters.reason} onChange={event => filter({ reason: event.target.value })}><option value="">Todos os motivos</option>{Object.entries(HISTORY_CLOSE_REASONS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</Select>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4"><CalendarDays size={14} className="text-slate-400" />{[["Todo o período", ""], ["Últimos 7 dias", "7"], ["Últimos 30 dias", "30"]].map(([label, days]) => <Button key={label} variant="outline" size="xs" onClick={() => filter({ from: days ? dayAgo(Number(days) - 1) : "", to: days ? dayAgo(0) : "" })}>{label}</Button>)}<span className="text-[11px] text-slate-400 sm:ml-auto">Datas de encerramento · Brasília</span></div>
    </section>
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white" aria-label="Atendimentos finalizados" aria-busy={loading}>
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4"><div><h3 className="text-sm font-semibold text-slate-900">Atendimentos finalizados</h3><p className="mt-1 text-xs text-slate-500">Selecione um registro para consultar a conversa.</p></div>{loading && <Loader2 size={18} className="animate-spin text-blue-600" aria-label="Carregando histórico" />}</div>
      {error ? <div role="alert" className="p-8 text-center text-sm text-red-600">{error}<div className="mt-4"><Button variant="outline" size="sm" onClick={() => setRefresh(n => n + 1)}>Tentar novamente</Button></div></div> : !history && loading ? <p className="p-12 text-center text-sm text-slate-500">Carregando atendimentos…</p> : history?.records.length ? <table className="w-full text-left text-sm">
        <thead className="hidden border-b border-slate-100 bg-slate-50 text-[11px] font-semibold text-slate-500 md:table-header-group"><tr>{["Cliente", "Assunto", "Encerrado em", "Responsável / setor", "Encerramento", ""].map((label, index) => <th key={index} className="px-4 py-3">{label}</th>)}</tr></thead>
        <tbody className={cn(loading && "opacity-50")}>{history.records.map(record => <tr key={record.id} onClick={() => open(record)} className="grid cursor-pointer grid-cols-2 gap-3 border-b border-slate-100 p-4 transition-colors last:border-0 hover:bg-blue-50/40 md:table-row md:p-0">
          <td className="col-span-2 min-w-0 md:max-w-52 md:px-4 md:py-4"><p className="break-words font-semibold text-slate-900">{customer(record)}</p><p className="mt-1 text-xs text-slate-500">{formatContactPhone(record.phone)}</p><p className="mt-1 text-[10px] font-medium text-blue-600">{protocol(record.id)}</p></td>
          <td className="col-span-2 min-w-0 md:max-w-64 md:px-4 md:py-4"><p className="mb-1 text-[10px] text-slate-400 md:hidden">ASSUNTO</p><p className="line-clamp-2 break-words text-xs leading-5 text-slate-700">{record.subject || "Assunto não informado"}</p>{record.legacy_import && <span className="mt-1 inline-block text-[10px] text-amber-700">Registro anterior</span>}</td>
          <td className="md:px-4 md:py-4"><p className="mb-1 text-[10px] text-slate-400 md:hidden">ENCERRADO EM</p><p className="whitespace-nowrap text-xs text-slate-700">{formatDate(record.closed_at, false)}</p><p className="mt-1 text-[11px] text-slate-400">{new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }).format(new Date(record.closed_at))}</p></td>
          <td className="md:px-4 md:py-4"><p className="mb-1 text-[10px] text-slate-400 md:hidden">RESPONSÁVEL / SETOR</p><p className="text-xs text-slate-700">{responsible(record)}</p><p className="mt-1 text-[11px] text-slate-400">{record.department_label || "Sem setor registrado"}</p></td>
          <td className="flex items-center md:table-cell md:px-4 md:py-4"><span className="text-xs text-slate-500">{historyCloseReason(record.close_reason)}</span></td>
          <td className="text-right md:px-4 md:py-4"><Button variant="ghost" size="xs" aria-label={`Ver conversa do atendimento ${protocol(record.id)}`} onClick={event => { event.stopPropagation(); open(record); }} iconRight={<ArrowUpRight size={14} />}>Ver conversa</Button></td>
        </tr>)}</tbody>
      </table> : <div className="px-5 py-14 text-center"><Search size={28} className="mx-auto text-slate-300" /><h3 className="mt-3 text-sm font-semibold text-slate-700">Nenhum atendimento encontrado</h3><p className="mt-2 text-xs text-slate-500">Ajuste os filtros ou consulte outro período.</p></div>}
      {history && history.total > 0 && !error && <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-4"><span className="text-xs text-slate-500">{(history.page - 1) * history.page_size + 1}–{Math.min(history.page * history.page_size, history.total)} de {history.total} atendimentos</span><div className="flex items-center gap-3"><Button variant="outline" size="xs" disabled={loading || history.page <= 1} onClick={() => filter({ page: String(history.page - 1) })} iconLeft={<ChevronLeft size={13} />}>Anterior</Button><span className="text-xs text-slate-500">{history.page} / {history.pages}</span><Button variant="outline" size="xs" disabled={loading || history.page >= history.pages} onClick={() => filter({ page: String(history.page + 1) })} iconRight={<ChevronRight size={13} />}>Próxima</Button></div></div>}
    </section>
  </div>;
}
