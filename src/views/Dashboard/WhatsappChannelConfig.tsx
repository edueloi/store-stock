import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { Bot, CircleDot, Clock3, MessageCirclePlus, Plus, RefreshCw, Save, Send, Settings2, Sparkles, UsersRound, X } from "lucide-react";
import PageHeader from "../../components/layout/PageHeader";
import { useToast } from "../../components/ui/Toast";
import { cn } from "../../lib/utils";

type Tab = "canal" | "ze" | "equipe" | "experiencia";
type Settings = {
  prefer_buttons: boolean;
  allow_numeric_fallback: boolean;
  show_agent_list_before_transfer: boolean;
  auto_close_on_inactivity: boolean;
  smart_bot_enabled: boolean;
  bot_name: string;
  ai_provider: "rules" | "gemini" | "openai";
  ai_api_key: string;
  ai_api_key_configured?: boolean;
  ai_model: string;
  ai_system_prompt: string;
};
type Sector = { id: number; key: string; name: string; description?: string | null; is_active: boolean; sort_order: number };
type Agent = { id: number; name: string; department: string; phone?: string | null; email?: string | null; is_active: boolean; is_online: boolean; can_receive_transfer: boolean; is_available: boolean; current_load: number; max_concurrent_chats: number; priority: number; notes?: string | null };
type Menu = { id: string; label: string; description: string; action: string; department?: string; enabled: boolean; order: number };
type Workspace = { is_enabled: boolean; settings: Settings; menus: Menu[]; templates: Record<string, string>; [key: string]: unknown };
type Overview = { workspace: Workspace; sectors: Sector[]; agents: Agent[]; stats: { bot_conversations: number; queued_conversations: number; assigned_conversations: number; online_agents: number } };
type Connection = { connected?: boolean; state?: string; qrCode?: string | null; phoneNumber?: string | null };
type Log = { id: number; channel: string; status: string; recipient: string; summary?: string | null; error?: string | null; created_at: string };

const tabs: Array<{ id: Tab; label: string; icon: typeof Settings2 }> = [
  { id: "canal", label: "Canal", icon: CircleDot },
  { id: "ze", label: "Assistente", icon: Sparkles },
  { id: "equipe", label: "Setores e equipe", icon: UsersRound },
  { id: "experiencia", label: "Experiência", icon: Bot },
];

function headers() { return { Authorization: `Bearer ${localStorage.getItem("token")}`, "Content-Type": "application/json" }; }
function Switch({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return <button type="button" onClick={() => onChange(!checked)} aria-label={label} className={cn("relative h-7 w-12 rounded-full transition", checked ? "bg-emerald-500" : "bg-slate-300")}><span className={cn("absolute top-1 h-5 w-5 rounded-full bg-white shadow transition", checked ? "left-6" : "left-1")} /></button>;
}
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="grid gap-1.5 text-sm font-semibold text-slate-700"><span>{label}</span>{children}</label>; }
const inputStyle = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100";

export default function WhatsappChannelConfig() {
  const toast = useToast();
  const location = useLocation();
  const [data, setData] = useState<Overview | null>(null);
  const [tab, setTab] = useState<Tab>("canal");
  const [connection, setConnection] = useState<Connection | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logsOpen, setLogsOpen] = useState(false);
  const [logs, setLogs] = useState<Log[]>([]);
  const [drawer, setDrawer] = useState<"sector" | "agent" | "start" | null>(() => new URLSearchParams(location.search).get("acao") === "iniciar" ? "start" : null);
  const [sectorForm, setSectorForm] = useState({ name: "", description: "" });
  const [agentForm, setAgentForm] = useState({ name: "", department: "sales", phone: "", email: "", max_concurrent_chats: "3" });
  const [startForm, setStartForm] = useState({ customer_name: "", phone: "" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/whatsapp/overview", { headers: headers() });
      const next = await response.json();
      if (!response.ok) throw new Error(next.error || "Não foi possível carregar o canal.");
      setData(next);
      setAgentForm((form) => ({ ...form, department: next.sectors?.find((sector: Sector) => sector.is_active)?.key || "sales" }));
    } catch (error) { toast.error(error instanceof Error ? error.message : "Falha ao carregar."); }
    finally { setLoading(false); }
  }, [toast]);

  const refreshConnection = useCallback(async () => {
    try {
      const response = await fetch("/api/whatsapp/connection-status", { headers: headers() });
      const next = await response.json();
      if (!response.ok) throw new Error(next.error || "Não foi possível consultar a conexão.");
      setConnection(next);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Falha ao consultar a conexão."); }
  }, [toast]);

  useEffect(() => { void load(); void refreshConnection(); }, []);
  useEffect(() => {
    if (new URLSearchParams(location.search).get("acao") === "iniciar") setDrawer("start");
  }, [location.search]);

  const workspace = data?.workspace;
  const settings = workspace?.settings;
  const activeSectors = useMemo(() => (data?.sectors ?? []).filter((sector) => sector.is_active), [data?.sectors]);
  const setSettings = (patch: Partial<Settings>) => setData((current) => current ? { ...current, workspace: { ...current.workspace, settings: { ...current.workspace.settings, ...patch } } } : current);
  const setWorkspace = (patch: Partial<Workspace>) => setData((current) => current ? { ...current, workspace: { ...current.workspace, ...patch } } : current);

  async function saveWorkspace() {
    if (!workspace) return;
    setSaving(true);
    try {
      const response = await fetch("/api/whatsapp/workspace", { method: "PUT", headers: headers(), body: JSON.stringify(workspace) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível salvar.");
      setSettings({ ai_api_key: "" });
      toast.success("Configurações salvas.");
      await load();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Falha ao salvar."); }
    finally { setSaving(false); }
  }

  async function openLogs() {
    setLogsOpen(true);
    try {
      const response = await fetch("/api/tenant/automated-message-logs", { headers: headers() });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível abrir os logs.");
      setLogs(result);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Falha ao abrir logs."); }
  }

  async function submitSector(event: FormEvent) {
    event.preventDefault();
    try {
      const response = await fetch("/api/whatsapp/sectors", { method: "POST", headers: headers(), body: JSON.stringify(sectorForm) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível criar o setor.");
      toast.success("Setor criado e adicionado ao menu do bot."); setDrawer(null); setSectorForm({ name: "", description: "" }); await load();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Falha ao criar setor."); }
  }
  async function removeSector(sector: Sector) {
    if (!window.confirm(`Remover o setor ${sector.name}?`)) return;
    try { const response = await fetch(`/api/whatsapp/sectors/${sector.id}`, { method: "DELETE", headers: headers() }); const result = await response.json(); if (!response.ok) throw new Error(result.error); toast.success("Setor removido."); await load(); } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível remover o setor."); }
  }
  async function submitAgent(event: FormEvent) {
    event.preventDefault();
    try {
      const response = await fetch("/api/whatsapp/agents", { method: "POST", headers: headers(), body: JSON.stringify({ ...agentForm, max_concurrent_chats: Number(agentForm.max_concurrent_chats), is_active: true, is_online: true, can_receive_transfer: true }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || "Não foi possível cadastrar o atendente.");
      toast.success("Atendente cadastrado."); setDrawer(null); setAgentForm({ name: "", department: activeSectors[0]?.key || "sales", phone: "", email: "", max_concurrent_chats: "3" }); await load();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Falha ao cadastrar atendente."); }
  }
  async function submitStart(event: FormEvent) {
    event.preventDefault();
    try {
      const response = await fetch("/api/whatsapp/conversations/start", { method: "POST", headers: headers(), body: JSON.stringify(startForm) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || "Não foi possível iniciar a conversa.");
      toast.success("O bot enviou a abertura da conversa."); setDrawer(null); setStartForm({ customer_name: "", phone: "" }); await load();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Falha ao iniciar a conversa."); }
  }

  if (loading || !data || !settings) return <div className="p-6 text-sm text-slate-500">Carregando canal do WhatsApp…</div>;
  const online = Boolean(connection?.connected);

  return <div className="space-y-6 pb-12">
    <PageHeader title="Canal do WhatsApp" subtitle="Configure seu assistente, organize setores e entregue cada conversa à pessoa certa." />
    <section className="rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-950 via-slate-900 to-blue-950 p-5 text-white shadow-sm">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
      <div className="flex items-center gap-4"><div className="rounded-2xl bg-white/10 p-3"><Bot className="h-7 w-7 text-blue-200" /></div><div><p className="text-xs font-bold uppercase tracking-[.18em] text-blue-200">Central de atendimento</p><h2 className="mt-1 text-xl font-bold">Bot de atendimento {workspace.is_enabled ? "ativo" : "desativado"}</h2><p className="mt-1 text-sm text-slate-300">{data.stats.bot_conversations} no bot · {data.stats.queued_conversations} na fila · {data.stats.assigned_conversations} em atendimento</p></div></div>
        <div className="flex flex-wrap gap-2"><button onClick={() => setDrawer("start")} className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-slate-900"><MessageCirclePlus className="h-4 w-4" />Iniciar conversa</button><button onClick={() => void openLogs()} className="rounded-xl border border-white/20 px-4 py-2.5 text-sm font-bold text-white">Ver logs</button><button onClick={() => void saveWorkspace()} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-blue-500 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"><Save className="h-4 w-4" />{saving ? "Salvando" : "Salvar"}</button></div>
      </div>
    </section>
    <div className="flex gap-2 overflow-x-auto border-b border-slate-200 pb-3">{tabs.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => setTab(id)} className={cn("inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold", tab === id ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100")}><Icon className="h-4 w-4" />{label}</button>)}</div>

    {tab === "canal" && (
      <div className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex items-start justify-between gap-4">
            <div><h2 className="font-bold text-slate-950">Status do canal</h2><p className="mt-1 text-sm text-slate-500">O bot só responde quando o canal estiver ativo.</p></div>
            <Switch checked={workspace.is_enabled} onChange={(value) => setWorkspace({ is_enabled: value })} label="Ativar canal" />
          </div>
          <div className="mt-6 rounded-xl bg-slate-50 p-4"><div className="flex items-center gap-3"><span className={cn("h-3 w-3 rounded-full", online ? "bg-emerald-500" : "bg-amber-400")} /><div><p className="font-semibold text-slate-800">{online ? "WhatsApp conectado" : "Aguardando conexão"}</p><p className="text-sm text-slate-500">{connection?.phoneNumber || connection?.state || "Atualize para verificar ou conectar o aparelho."}</p></div><button onClick={() => void refreshConnection()} className="ml-auto rounded-lg bg-white p-2 text-slate-600 shadow-sm"><RefreshCw className="h-4 w-4" /></button></div></div>
          {connection?.qrCode && <img src={connection.qrCode} alt="QR Code do WhatsApp" className="mx-auto mt-5 h-48 w-48 rounded-xl border border-slate-200 p-2" />}
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-6"><h2 className="font-bold text-slate-950">Como funciona</h2><ol className="mt-5 space-y-4 text-sm text-slate-600"><li><b className="mr-2 text-blue-600">01</b>Ative o canal e conecte o WhatsApp.</li><li><b className="mr-2 text-blue-600">02</b>O assistente acolhe, entende e mostra as opções.</li><li><b className="mr-2 text-blue-600">03</b>Quando necessário, transfere para o setor e atendente certo.</li></ol></section>
      </div>
    )}

    {tab === "ze" && (
      <div className="grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <div><h2 className="font-bold text-slate-950">Modo inteligente</h2><p className="mt-1 text-sm text-slate-500">Reconhece clientes cadastrados e entende mensagens livres.</p></div>
            <Switch checked={settings.smart_bot_enabled} onChange={(value) => setSettings({ smart_bot_enabled: value })} label="Ativar modo inteligente" />
          </div>
          <div className="mt-6 grid gap-4">
            <Field label="Nome do assistente"><input className={inputStyle} value={settings.bot_name} maxLength={40} onChange={(e) => setSettings({ bot_name: e.target.value })} /></Field>
            <Field label="Inteligência artificial"><select className={inputStyle} value={settings.ai_provider} onChange={(e) => setSettings({ ai_provider: e.target.value as Settings["ai_provider"] })}><option value="rules">Regras do sistema</option><option value="gemini">Google Gemini</option><option value="openai">OpenAI</option></select></Field>
            {settings.ai_provider !== "rules" && <>
              <Field label="Modelo"><input className={inputStyle} placeholder={settings.ai_provider === "gemini" ? "gemini-2.0-flash" : "gpt-4o-mini"} value={settings.ai_model} onChange={(e) => setSettings({ ai_model: e.target.value })} /></Field>
              <Field label={settings.ai_api_key_configured ? "Nova chave da IA (uma chave já está guardada)" : "Chave da IA"}><input type="password" className={inputStyle} value={settings.ai_api_key} onChange={(e) => setSettings({ ai_api_key: e.target.value })} /></Field>
            </>}
          </div>
        </section>
        <section className="rounded-2xl border border-blue-100 bg-blue-50/60 p-6">
          <Sparkles className="h-6 w-6 text-blue-600" />
          <h2 className="mt-4 font-bold text-slate-950">Limites seguros do assistente</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Ele identifica o cliente pelo telefone e consulta o que existe no sistema. Não inventa preço, pedido, pagamento ou prazo; quando faltar informação, encaminha para sua equipe.</p>
          <Field label="Instrução complementar"><textarea className={cn(inputStyle, "mt-4 min-h-36 resize-y")} value={settings.ai_system_prompt} onChange={(e) => setSettings({ ai_system_prompt: e.target.value })} /></Field>
        </section>
      </div>
    )}

    {tab === "equipe" && (
      <div className="space-y-5">
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-bold text-slate-950">Setores de atendimento</h2><p className="mt-1 text-sm text-slate-500">Cada conversa é encaminhada somente aos atendentes do setor escolhido.</p></div><button onClick={() => setDrawer("sector")} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white"><Plus className="h-4 w-4" />Novo setor</button></div>
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{data.sectors.map((sector) => { const count = data.agents.filter((agent) => agent.department === sector.key).length; return <article key={sector.id} className="rounded-xl border border-slate-200 p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="font-bold text-slate-900">{sector.name}</h3><p className="mt-1 text-sm text-slate-500">{sector.description || "Sem descrição"}</p></div><span className={cn("rounded-full px-2 py-1 text-xs font-bold", sector.is_active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500")}>{sector.is_active ? "Ativo" : "Inativo"}</span></div><div className="mt-4 flex items-center justify-between text-sm"><span className="text-slate-500">{count} atendente{count === 1 ? "" : "s"}</span>{!(["sales", "support", "finance"].includes(sector.key)) && <button onClick={() => void removeSector(sector)} className="font-semibold text-rose-600">Remover</button>}</div></article>; })}</div>
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-bold text-slate-950">Atendentes para handoff</h2><p className="mt-1 text-sm text-slate-500">Nome, setor, telefone e limite de conversas ficam visíveis para a gestão.</p></div><button onClick={() => setDrawer("agent")} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white"><Plus className="h-4 w-4" />Novo atendente</button></div>
          <div className="mt-5 grid gap-3 lg:grid-cols-2">{data.agents.map((agent) => <article key={agent.id} className="flex items-center gap-4 rounded-xl border border-slate-200 p-4"><div className="grid h-10 w-10 place-items-center rounded-full bg-blue-50 text-sm font-extrabold text-blue-700">{agent.name.slice(0, 1).toUpperCase()}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold text-slate-900">{agent.name}</h3><span className="text-xs font-semibold text-slate-500">{data.sectors.find((sector) => sector.key === agent.department)?.name || agent.department}</span></div><p className="mt-1 truncate text-sm text-slate-500">{agent.phone || "Telefone não informado"}</p></div><div className="text-right text-xs text-slate-500"><p className={agent.is_available ? "font-bold text-emerald-600" : "font-bold text-slate-500"}>{agent.is_available ? "Disponível" : "Indisponível"}</p><p>{agent.current_load}/{agent.max_concurrent_chats} conversas</p></div></article>)}{data.agents.length === 0 && <p className="rounded-xl bg-slate-50 p-5 text-sm text-slate-500">Cadastre quem pode receber transferências do assistente.</p>}</div>
        </section>
      </div>
    )}

    {tab === "experiencia" && <div className="grid gap-5 lg:grid-cols-[1.05fr_.95fr]"><section className="rounded-2xl border border-slate-200 bg-white p-6"><h2 className="font-bold text-slate-950">Como o cliente conversa</h2><p className="mt-1 text-sm text-slate-500">Apenas o essencial para manter o fluxo natural.</p><div className="mt-5 divide-y divide-slate-100">{[["prefer_buttons", "Preferir botões", "Quando houver poucas opções, mostra botões rápidos."],["allow_numeric_fallback", "Aceitar números", "Cliente pode responder 1, 2 ou 3 quando receber uma lista."],["show_agent_list_before_transfer", "Escolher atendente", "Mostra os atendentes do setor antes de entrar na fila."],["auto_close_on_inactivity", "Encerrar por inatividade", "Fecha atendimentos sem interação para manter a fila organizada."]].map(([key, title, subtitle]) => <div key={key} className="flex items-center justify-between gap-4 py-4"><div><p className="font-semibold text-slate-800">{title}</p><p className="mt-1 text-sm text-slate-500">{subtitle}</p></div><Switch checked={Boolean(settings[key as keyof Settings])} onChange={(value) => setSettings({ [key]: value } as Partial<Settings>)} label={title} /></div>)}</div></section><section className="rounded-2xl border border-slate-200 bg-white p-6"><h2 className="font-bold text-slate-950">Atalhos do menu</h2><p className="mt-1 text-sm text-slate-500">Os setores criados entram automaticamente no menu do bot.</p><div className="mt-5 space-y-2">{workspace.menus.sort((a, b) => a.order - b.order).map((menu) => <div key={menu.id} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3"><div><p className="font-semibold text-slate-800">{menu.label}</p><p className="text-xs text-slate-500">{menu.description}</p></div><Switch checked={menu.enabled} onChange={(value) => setWorkspace({ menus: workspace.menus.map((item) => item.id === menu.id ? { ...item, enabled: value } : item) })} label={`Ativar ${menu.label}`} /></div>)}</div></section></div>}

    <Drawer open={logsOpen} title="Logs de automações" onClose={() => setLogsOpen(false)}><p className="mb-5 text-sm text-slate-500">Envios automáticos do canal e alertas financeiros. As conversas ficam nas telas de atendimento.</p><div className="space-y-3">{logs.map((log) => <article key={log.id} className="rounded-xl border border-slate-200 p-4"><div className="flex justify-between gap-3"><p className="font-semibold text-slate-800">{log.recipient}</p><span className="text-xs font-bold uppercase text-slate-500">{log.status}</span></div><p className="mt-1 text-sm text-slate-500">{log.summary || log.error || log.channel}</p><p className="mt-2 text-xs text-slate-400">{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(log.created_at))}</p></article>)}{logs.length === 0 && <p className="rounded-xl bg-slate-50 p-5 text-sm text-slate-500">Ainda não há envios automáticos registrados.</p>}</div></Drawer>
    <Drawer open={drawer === "sector"} title="Novo setor" onClose={() => setDrawer(null)}><form className="space-y-5" onSubmit={submitSector}><Field label="Nome do setor"><input autoFocus required className={inputStyle} value={sectorForm.name} onChange={(e) => setSectorForm({ ...sectorForm, name: e.target.value })} placeholder="Ex.: Assistência técnica" /></Field><Field label="Descrição curta"><textarea className={cn(inputStyle, "min-h-28")} value={sectorForm.description} onChange={(e) => setSectorForm({ ...sectorForm, description: e.target.value })} placeholder="Para quais assuntos este setor recebe conversas?" /></Field><button className="w-full rounded-xl bg-blue-600 px-4 py-3 font-bold text-white">Criar setor</button></form></Drawer>
    <Drawer open={drawer === "agent"} title="Novo atendente" onClose={() => setDrawer(null)}><form className="space-y-5" onSubmit={submitAgent}><Field label="Nome"><input autoFocus required className={inputStyle} value={agentForm.name} onChange={(e) => setAgentForm({ ...agentForm, name: e.target.value })} /></Field><Field label="Setor"><select className={inputStyle} value={agentForm.department} onChange={(e) => setAgentForm({ ...agentForm, department: e.target.value })}>{activeSectors.map((sector) => <option key={sector.id} value={sector.key}>{sector.name}</option>)}</select></Field><Field label="WhatsApp com DDD"><input required className={inputStyle} value={agentForm.phone} onChange={(e) => setAgentForm({ ...agentForm, phone: e.target.value })} placeholder="11999999999" /></Field><Field label="E-mail (opcional)"><input type="email" className={inputStyle} value={agentForm.email} onChange={(e) => setAgentForm({ ...agentForm, email: e.target.value })} /></Field><Field label="Máximo de conversas"><input type="number" min="1" className={inputStyle} value={agentForm.max_concurrent_chats} onChange={(e) => setAgentForm({ ...agentForm, max_concurrent_chats: e.target.value })} /></Field><button className="w-full rounded-xl bg-blue-600 px-4 py-3 font-bold text-white">Cadastrar atendente</button></form></Drawer>
    <Drawer open={drawer === "start"} title="Iniciar conversa pelo bot" onClose={() => setDrawer(null)}><p className="mb-5 text-sm leading-6 text-slate-500">O assistente envia a apresentação e o menu para este número. O cliente pode seguir pelo bot ou ser transferido a um setor.</p><form className="space-y-5" onSubmit={submitStart}><Field label="Nome do cliente (opcional)"><input autoFocus className={inputStyle} value={startForm.customer_name} onChange={(e) => setStartForm({ ...startForm, customer_name: e.target.value })} /></Field><Field label="WhatsApp com DDD"><input required className={inputStyle} value={startForm.phone} onChange={(e) => setStartForm({ ...startForm, phone: e.target.value })} placeholder="11999999999" /></Field><button className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 font-bold text-white"><Send className="h-4 w-4" />Iniciar pelo bot</button></form></Drawer>
  </div>;
}

function Drawer({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  if (!open) return null;
  return <div className="fixed inset-0 z-[80]"><button className="absolute inset-0 bg-slate-950/35" onClick={onClose} aria-label="Fechar" /><aside role="dialog" aria-modal="true" aria-label={title} className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-white shadow-2xl"><header className="flex items-center justify-between border-b border-slate-200 px-6 py-5"><h2 className="font-bold text-slate-950">{title}</h2><button onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button></header><div className="flex-1 overflow-y-auto p-6">{children}</div></aside></div>;
}
