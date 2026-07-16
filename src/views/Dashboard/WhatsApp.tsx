import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import {
  Bot,
  CheckCircle2,
  Clock3,
  Loader2,
  MessageSquare,
  Phone,
  PlugZap,
  QrCode,
  RefreshCw,
  Save,
  Send,
  Settings2,
  Smartphone,
  UserPlus,
  Users,
  X,
  Trash2,
  Edit2,
  Power,
  ShieldCheck,
  ArrowRightLeft,
  CircleDashed,
  BadgeAlert,
  XCircle,
} from "lucide-react";

import PageHeader from "../../components/layout/PageHeader";
import { useToast } from "../../components/ui/Toast";
import { getStoredUser } from "../../lib/session";
import { cn } from "../../lib/utils";

type ConversationStatus = "bot" | "queued" | "assigned" | "closed";

interface WorkspaceSettings {
  inactivity_timeout_minutes: number;
  marketing_interval_seconds: number;
  prefer_buttons: boolean;
  allow_numeric_fallback: boolean;
  show_agent_list_before_transfer: boolean;
  auto_close_on_inactivity: boolean;
}

interface MenuOption {
  id: string;
  label: string;
  description: string;
  action: "orders" | "quotes" | "invoices" | "promotions" | "department" | "template";
  department?: string;
  template_key?: string;
  enabled: boolean;
  order: number;
}

interface WorkspaceTemplates {
  welcome: string;
  menu_intro: string;
  fallback: string;
  queue_wait: string;
  transferred: string;
  busy: string;
  closed_inactivity: string;
  no_orders: string;
  no_quotes: string;
  no_invoices: string;
  no_promotions: string;
  manual_takeover: string;
  points_earned: string;
  points_redeemed: string;
  points_reminder: string;
}

interface WorkspaceState {
  id: number;
  tenant_id: number;
  is_enabled: boolean;
  provider: string;
  evolution_base_url: string;
  evolution_api_key: string;
  evolution_instance: string;
  webhook_secret: string;
  fallback_phone: string;
  settings: WorkspaceSettings;
  menus: MenuOption[];
  templates: WorkspaceTemplates;
  webhook_url: string;
  secret_header_name: string;
}

interface Agent {
  id: number;
  name: string;
  department: string;
  role: string;
  phone?: string | null;
  email?: string | null;
  is_active: boolean;
  is_online: boolean;
  can_receive_transfer: boolean;
  max_concurrent_chats: number;
  priority: number;
  notes?: string | null;
  current_load: number;
  is_available: boolean;
}

interface Conversation {
  id: number;
  phone: string;
  remote_jid: string;
  customer_name?: string | null;
  status: ConversationStatus;
  current_menu: string;
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
  message_type: string;
  body?: string | null;
  created_at: string;
}

interface ConversationDetailResponse {
  conversation: Conversation;
  messages: MessageLog[];
}

interface ConnectionStatus {
  connected: boolean;
  state: string;
  qrCode: string | null;
  pairingCode: string | null;
  phoneNumber: string | null;
}

interface OverviewResponse {
  workspace: WorkspaceState;
  stats: {
    online_agents: number;
    open_conversations: number;
    bot_conversations: number;
    queued_conversations: number;
    assigned_conversations: number;
    closed_conversations: number;
  };
  agents: Agent[];
  conversations: Conversation[];
}

interface AgentFormState {
  name: string;
  department: string;
  role: string;
  phone: string;
  email: string;
  is_active: boolean;
  is_online: boolean;
  can_receive_transfer: boolean;
  max_concurrent_chats: number;
  priority: number;
  notes: string;
}

const DEPARTMENTS = [
  { value: "sales", label: "Vendas" },
  { value: "support", label: "Atendimento" },
  { value: "finance", label: "Financeiro" },
];

const FILTERS: Array<{ key: "all" | ConversationStatus; label: string }> = [
  { key: "all", label: "Todos" },
  { key: "bot", label: "Bot" },
  { key: "queued", label: "Fila" },
  { key: "assigned", label: "Em atendimento" },
  { key: "closed", label: "Encerrados" },
];

function authHeaders() {
  return {
    Authorization: `Bearer ${localStorage.getItem("token")}`,
    "Content-Type": "application/json",
  };
}

function emptyAgentForm(): AgentFormState {
  return {
    name: "",
    department: "sales",
    role: "agent",
    phone: "",
    email: "",
    is_active: true,
    is_online: true,
    can_receive_transfer: true,
    max_concurrent_chats: 3,
    priority: 0,
    notes: "",
  };
}

function fmtDate(value?: string | null) {
  if (!value) return "Sem registro";
  return new Date(value).toLocaleString("pt-BR");
}

function SectionCard({
  title,
  subtitle,
  icon,
  children,
  action,
}: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          {icon && (
            <div className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
              {icon}
            </div>
          )}
          <div className="min-w-0">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 truncate">
              {title}
            </h3>
            {subtitle && (
              <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-1">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 block mb-1.5">
      {children}
    </label>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="w-full flex items-start justify-between gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-left hover:border-slate-300 transition-colors"
    >
      <div>
        <p className="text-[11px] font-black uppercase tracking-wider text-slate-800">{label}</p>
        {hint && <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{hint}</p>}
      </div>
      <div
        className={cn(
          "w-11 h-6 rounded-full relative transition-all shrink-0 mt-0.5",
          checked ? "bg-emerald-500" : "bg-slate-300",
        )}
      >
        <span
          className={cn(
            "absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-all",
            checked ? "left-6" : "left-1",
          )}
        />
      </div>
    </button>
  );
}

export default function WhatsApp() {
  const toast = useToast();
  const isSuperAdmin = getStoredUser()?.role === "super_admin";
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pinging, setPinging] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null);
  const [loadingConnection, setLoadingConnection] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [sendingTest, setSendingTest] = useState(false);
  const [testPhone, setTestPhone] = useState("");
  const [regenerateSecret, setRegenerateSecret] = useState(false);
  const [filter, setFilter] = useState<"all" | ConversationStatus>("all");

  const [showAgentModal, setShowAgentModal] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [agentForm, setAgentForm] = useState<AgentFormState>(emptyAgentForm());
  const [agentSaving, setAgentSaving] = useState(false);

  const [selectedConversationId, setSelectedConversationId] = useState<number | null>(null);
  const [conversationDetail, setConversationDetail] = useState<ConversationDetailResponse | null>(null);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [assigningAgentId, setAssigningAgentId] = useState<number | "">("");

  const loadOverview = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const response = await fetch("/api/whatsapp/overview", { headers: authHeaders() });
        const data = (await response.json()) as OverviewResponse & { error?: string };
        if (!response.ok) {
          throw new Error(data.error || "Não foi possível carregar o módulo do WhatsApp.");
        }
        setOverview(data);
        setWorkspace((current) => current ?? data.workspace);
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Não foi possível carregar o módulo do WhatsApp.",
        );
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [toast],
  );

  const loadConversation = useCallback(
    async (conversationId: number, silent = false) => {
      if (!silent) setLoadingConversation(true);
      try {
        const response = await fetch(`/api/whatsapp/conversations/${conversationId}/messages`, {
          headers: authHeaders(),
        });
        const data = (await response.json()) as ConversationDetailResponse;
        if (!response.ok) {
          toast.error((data as { error?: string }).error || "Falha ao abrir conversa.");
          return;
        }
        setConversationDetail(data);
        setSelectedConversationId(conversationId);
        setAssigningAgentId(data.conversation.assigned_agent?.id ?? "");
      } catch {
        toast.error("Não foi possível carregar a conversa.");
      } finally {
        if (!silent) setLoadingConversation(false);
      }
    },
    [toast],
  );

  const loadConnectionStatus = useCallback(
    async (silent = false) => {
      if (!silent) setLoadingConnection(true);
      setConnectionError(null);
      try {
        const response = await fetch("/api/whatsapp/connection-status", { headers: authHeaders() });
        const data = (await response.json()) as ConnectionStatus & { error?: string };
        if (!response.ok) {
          setConnectionStatus(null);
          setConnectionError(data.error || "Não foi possível verificar a conexão. Confira URL, API key e instância.");
          return;
        }
        setConnectionStatus(data);
      } catch {
        setConnectionStatus(null);
        setConnectionError("Não foi possível verificar a conexão.");
      } finally {
        if (!silent) setLoadingConnection(false);
      }
    },
    [],
  );

  useEffect(() => {
    void loadOverview();
    void loadConnectionStatus();
  }, [loadOverview, loadConnectionStatus]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void loadOverview(true);
      if (selectedConversationId) {
        void loadConversation(selectedConversationId, true);
      }
    }, 15000);

    return () => window.clearInterval(interval);
  }, [loadConversation, loadOverview, selectedConversationId]);

  // Enquanto não conectado, atualiza o QR code sozinho a cada 20s — o código
  // expira periodicamente na Evolution API e o usuário não precisa ficar
  // clicando em "Atualizar" manualmente.
  useEffect(() => {
    if (connectionStatus?.connected) return;
    const interval = window.setInterval(() => {
      void loadConnectionStatus(true);
    }, 20000);
    return () => window.clearInterval(interval);
  }, [connectionStatus?.connected, loadConnectionStatus]);

  const filteredConversations = useMemo(() => {
    const items = overview?.conversations ?? [];
    if (filter === "all") return items;
    return items.filter((item) => item.status === filter);
  }, [filter, overview?.conversations]);

  const handleWorkspaceField = <K extends keyof WorkspaceState>(key: K, value: WorkspaceState[K]) => {
    setWorkspace((current) => (current ? { ...current, [key]: value } : current));
  };

  const handleSettingsField = <K extends keyof WorkspaceSettings>(
    key: K,
    value: WorkspaceSettings[K],
  ) => {
    setWorkspace((current) =>
      current
        ? {
            ...current,
            settings: {
              ...current.settings,
              [key]: value,
            },
          }
        : current,
    );
  };

  const handleTemplateField = <K extends keyof WorkspaceTemplates>(
    key: K,
    value: WorkspaceTemplates[K],
  ) => {
    setWorkspace((current) =>
      current
        ? {
            ...current,
            templates: {
              ...current.templates,
              [key]: value,
            },
          }
        : current,
    );
  };

  const handleMenuField = (menuId: string, patch: Partial<MenuOption>) => {
    setWorkspace((current) =>
      current
        ? {
            ...current,
            menus: current.menus.map((menu) =>
              menu.id === menuId ? { ...menu, ...patch } : menu,
            ),
          }
        : current,
    );
  };

  const saveWorkspace = async () => {
    if (!workspace) return;
    setSaving(true);
    try {
      const response = await fetch("/api/whatsapp/workspace", {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({
          ...workspace,
          regenerate_secret: regenerateSecret,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error || "Falha ao salvar a configuração.");
        return;
      }
      setRegenerateSecret(false);
      setWorkspace({
        ...workspace,
        webhook_secret: data.webhook_secret ?? workspace.webhook_secret,
      });
      toast.success("Configuração do WhatsApp salva.");
      await loadOverview(true);
    } catch {
      toast.error("Erro de conexão ao salvar o WhatsApp.");
    } finally {
      setSaving(false);
    }
  };

  const pingProvider = async () => {
    setPinging(true);
    try {
      const response = await fetch("/api/whatsapp/ping", {
        method: "POST",
        headers: authHeaders(),
      });
      const data = await response.json();
      if (response.ok && data.ok) {
        toast.success("Evolution respondeu corretamente.");
      } else {
        toast.error(data.error || "Falha ao validar a instância.");
      }
    } catch {
      toast.error("Não foi possível testar a conexão.");
    } finally {
      setPinging(false);
    }
  };

  const sendTestMenu = async () => {
    if (!testPhone.trim()) {
      toast.error("Informe um número para o teste.");
      return;
    }
    setSendingTest(true);
    try {
      const response = await fetch("/api/whatsapp/test-menu", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ phone: testPhone }),
      });
      const data = await response.json();
      if (response.ok) {
        toast.success("Menu de teste enviado.");
      } else {
        toast.error(data.error || "Falha ao enviar menu de teste.");
      }
    } catch {
      toast.error("Erro de conexão ao enviar o teste.");
    } finally {
      setSendingTest(false);
    }
  };

  const openNewAgent = () => {
    setEditingAgent(null);
    setAgentForm(emptyAgentForm());
    setShowAgentModal(true);
  };

  const openEditAgent = (agent: Agent) => {
    setEditingAgent(agent);
    setAgentForm({
      name: agent.name,
      department: agent.department,
      role: agent.role,
      phone: agent.phone ?? "",
      email: agent.email ?? "",
      is_active: agent.is_active,
      is_online: agent.is_online,
      can_receive_transfer: agent.can_receive_transfer,
      max_concurrent_chats: agent.max_concurrent_chats,
      priority: agent.priority,
      notes: agent.notes ?? "",
    });
    setShowAgentModal(true);
  };

  const saveAgent = async () => {
    if (!agentForm.name.trim()) {
      toast.error("Nome do atendente é obrigatório.");
      return;
    }
    setAgentSaving(true);
    try {
      const response = await fetch(
        editingAgent ? `/api/whatsapp/agents/${editingAgent.id}` : "/api/whatsapp/agents",
        {
          method: editingAgent ? "PATCH" : "POST",
          headers: authHeaders(),
          body: JSON.stringify(agentForm),
        },
      );
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error || "Não foi possível salvar o atendente.");
        return;
      }
      toast.success(editingAgent ? "Atendente atualizado." : "Atendente criado.");
      setShowAgentModal(false);
      await loadOverview(true);
    } catch {
      toast.error("Erro de conexão ao salvar atendente.");
    } finally {
      setAgentSaving(false);
    }
  };

  const deleteAgent = async (agentId: number) => {
    if (!window.confirm("Remover este atendente do módulo de WhatsApp?")) return;
    try {
      const response = await fetch(`/api/whatsapp/agents/${agentId}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error || "Não foi possível remover o atendente.");
        return;
      }
      toast.success("Atendente removido.");
      await loadOverview(true);
    } catch {
      toast.error("Erro de conexão ao remover atendente.");
    }
  };

  const assignConversation = async () => {
    if (!selectedConversationId || !assigningAgentId) {
      toast.error("Selecione um atendente para a transferência.");
      return;
    }

    try {
      const response = await fetch(`/api/whatsapp/conversations/${selectedConversationId}/assign`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ agent_id: assigningAgentId }),
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error || "Falha ao transferir a conversa.");
        return;
      }
      toast.success("Conversa transferida.");
      setConversationDetail(data);
      await loadOverview(true);
    } catch {
      toast.error("Erro de conexão ao transferir conversa.");
    }
  };

  const closeConversation = async () => {
    if (!selectedConversationId) return;
    try {
      const response = await fetch(`/api/whatsapp/conversations/${selectedConversationId}/close`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ reason: "closed-from-panel" }),
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error || "Falha ao encerrar a conversa.");
        return;
      }
      toast.success("Conversa encerrada.");
      setConversationDetail(null);
      setSelectedConversationId(null);
      setReplyText("");
      await loadOverview(true);
    } catch {
      toast.error("Erro de conexão ao encerrar.");
    }
  };

  const sendReply = async () => {
    if (!selectedConversationId || !replyText.trim()) return;
    setSendingReply(true);
    try {
      const response = await fetch(`/api/whatsapp/conversations/${selectedConversationId}/message`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ text: replyText, author: "Painel" }),
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error || "Falha ao enviar mensagem.");
        return;
      }
      toast.success("Mensagem enviada.");
      setConversationDetail(data);
      setReplyText("");
      await loadOverview(true);
    } catch {
      toast.error("Erro de conexão ao enviar mensagem.");
    } finally {
      setSendingReply(false);
    }
  };

  const statusMeta = (status: ConversationStatus) => {
    switch (status) {
      case "bot":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "queued":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "assigned":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "closed":
        return "bg-slate-100 text-slate-600 border-slate-200";
      default:
        return "bg-slate-100 text-slate-600 border-slate-200";
    }
  };

  if (loading || !overview || !workspace) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex items-center gap-3 text-slate-500">
          <Loader2 size={18} className="animate-spin" />
          <span className="text-sm font-semibold">Carregando módulo de WhatsApp…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="WhatsApp"
        subtitle="Bot, filas e atendimento pelo WhatsApp"
        action={
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => void loadOverview()}
              className="h-10 px-4 rounded-xl border border-slate-200 bg-white text-slate-600 text-[11px] font-black uppercase tracking-wider flex items-center gap-2 hover:bg-slate-50"
            >
              <RefreshCw size={14} />
              Atualizar
            </button>
            <button
              onClick={saveWorkspace}
              disabled={saving}
              className="h-10 px-5 rounded-xl bg-blue-600 text-white text-[11px] font-black uppercase tracking-wider flex items-center gap-2 hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Salvar módulo
            </button>
          </div>
        }
      />

      <section className="rounded-3xl border border-slate-200 shadow-sm overflow-hidden bg-white">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-4 bg-gradient-to-r from-emerald-50 to-white">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={cn(
                "w-11 h-11 rounded-2xl flex items-center justify-center shrink-0",
                connectionStatus?.connected ? "bg-emerald-500 text-white" : "bg-slate-900 text-white",
              )}
            >
              {connectionStatus?.connected ? <CheckCircle2 size={20} /> : <QrCode size={20} />}
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">
                {connectionStatus?.connected ? "WhatsApp conectado" : "Conectar WhatsApp"}
              </h3>
              <p className="text-[11px] text-slate-500 font-semibold mt-0.5">
                {connectionStatus?.connected
                  ? connectionStatus.phoneNumber
                    ? `Número +${connectionStatus.phoneNumber} vinculado e pronto para uso`
                    : "Número vinculado e pronto para uso"
                  : "Escaneie o QR code para vincular o número"}
              </p>
            </div>
          </div>
          <button
            onClick={() => void loadConnectionStatus()}
            disabled={loadingConnection}
            className="h-9 px-4 rounded-xl border border-slate-200 bg-white text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 flex items-center gap-2 disabled:opacity-50 shrink-0"
          >
            {loadingConnection ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            Atualizar
          </button>
        </div>

        <div className="p-6">
          {connectionError ? (
            <div className="flex flex-col items-center text-center gap-4 py-6">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center">
                <Smartphone size={24} />
              </div>
              <div className="max-w-sm">
                <p className="text-sm font-black text-slate-800">Não foi possível conectar agora</p>
                <p className="text-[12px] text-slate-500 mt-1.5 leading-relaxed">
                  Tente novamente em instantes clicando em <strong>Atualizar</strong>. Se o problema
                  continuar, fale com o suporte.
                </p>
                {isSuperAdmin && (
                  <p className="text-[11px] text-amber-600 mt-3 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                    {connectionError}
                  </p>
                )}
              </div>
            </div>
          ) : connectionStatus?.connected ? (
            <div className="flex items-center gap-4 py-2">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shrink-0">
                <CheckCircle2 size={26} />
              </div>
              <div>
                {connectionStatus.phoneNumber && (
                  <p className="text-sm font-black text-slate-800 mb-1">
                    +{connectionStatus.phoneNumber}
                  </p>
                )}
                <p className="text-[13px] text-slate-600 leading-relaxed">
                  O número já está vinculado à instância e pronto para receber e enviar mensagens pelo bot.
                  Se precisar trocar de aparelho, desconecte pelo próprio WhatsApp em
                  <strong> Aparelhos conectados</strong> e clique em Atualizar aqui para gerar um novo QR code.
                </p>
              </div>
            </div>
          ) : connectionStatus?.qrCode ? (
            <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-8 items-center">
              <div className="mx-auto md:mx-0 p-4 bg-white border-2 border-slate-100 rounded-3xl shadow-sm">
                <img
                  src={connectionStatus.qrCode}
                  alt="QR code para conectar o WhatsApp"
                  className="w-52 h-52 object-contain"
                />
              </div>
              <div className="space-y-4">
                <ol className="space-y-3">
                  {[
                    "Abra o WhatsApp no celular que vai ficar vinculado ao sistema.",
                    <>Toque em <strong>Configurações</strong> (ou os três pontinhos) → <strong>Aparelhos conectados</strong>.</>,
                    <>Toque em <strong>Conectar um aparelho</strong> e aponte a câmera para o QR code ao lado.</>,
                    "Pronto — esta tela detecta e confirma a conexão automaticamente.",
                  ].map((step, i) => (
                    <li key={i} className="flex gap-3 items-start">
                      <span className="w-6 h-6 rounded-full bg-slate-900 text-white text-[11px] font-black flex items-center justify-center shrink-0">
                        {i + 1}
                      </span>
                      <span className="text-[13px] text-slate-700 leading-snug pt-0.5">{step}</span>
                    </li>
                  ))}
                </ol>
                {connectionStatus.pairingCode && (
                  <div className="rounded-2xl bg-slate-50 border border-slate-200 px-4 py-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Ou digite o código</p>
                    <p className="text-lg font-black font-mono text-slate-800 mt-1">{connectionStatus.pairingCode}</p>
                  </div>
                )}
                <p className="text-[10px] text-slate-400">
                  O código se renova sozinho aqui — não é preciso ficar clicando em Atualizar.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center text-center gap-3 py-6">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-300 flex items-center justify-center">
                <Smartphone size={24} />
              </div>
              <p className="text-sm font-black text-slate-700">
                {loadingConnection ? "Gerando QR code…" : "Nenhum QR code disponível ainda"}
              </p>
              <p className="text-[12px] text-slate-500 max-w-sm">
                Clique em Atualizar para gerar o QR code de conexão.
              </p>
            </div>
          )}
        </div>
      </section>

      <div className="grid grid-cols-2 xl:grid-cols-5 gap-3">
        {[
          {
            label: "Atendentes online",
            value: overview.stats.online_agents,
            icon: <Users size={16} />,
            color: "text-blue-700",
            box: "bg-blue-50 border-blue-100",
          },
          {
            label: "Conversas abertas",
            value: overview.stats.open_conversations,
            icon: <MessageSquare size={16} />,
            color: "text-slate-800",
            box: "bg-white border-slate-200",
          },
          {
            label: "No bot",
            value: overview.stats.bot_conversations,
            icon: <Bot size={16} />,
            color: "text-cyan-700",
            box: "bg-cyan-50 border-cyan-100",
          },
          {
            label: "Na fila",
            value: overview.stats.queued_conversations,
            icon: <Clock3 size={16} />,
            color: "text-amber-700",
            box: "bg-amber-50 border-amber-100",
          },
          {
            label: "Com atendente",
            value: overview.stats.assigned_conversations,
            icon: <ShieldCheck size={16} />,
            color: "text-emerald-700",
            box: "bg-emerald-50 border-emerald-100",
          },
        ].map((card) => (
          <div key={card.label} className={cn("rounded-3xl border px-4 py-4 shadow-sm", card.box)}>
            <div className={cn("mb-2", card.color)}>{card.icon}</div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{card.label}</p>
            <p className={cn("text-2xl font-black mt-1", card.color)}>{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 2xl:grid-cols-[1.1fr_0.9fr] gap-6">
        {isSuperAdmin && (
        <SectionCard
          title="Instância e automação"
          subtitle="Evolution, webhook, timeout, botões e fallback numérico"
          icon={<Settings2 size={18} />}
          action={
            <button
              onClick={pingProvider}
              disabled={pinging}
              className="h-9 px-4 rounded-xl border border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 flex items-center gap-2 disabled:opacity-50"
            >
              {pinging ? <Loader2 size={13} className="animate-spin" /> : <PlugZap size={13} />}
              Testar Evolution
            </button>
          }
        >
          <div className="space-y-5">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <div>
                <Label>URL Base do Evolution</Label>
                <input
                  value={workspace.evolution_base_url}
                  onChange={(e) => handleWorkspaceField("evolution_base_url", e.target.value)}
                  placeholder="https://seu-evolution.exemplo.com"
                  className="w-full h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium"
                />
              </div>
              <div>
                <Label>Instância</Label>
                <input
                  value={workspace.evolution_instance}
                  onChange={(e) => handleWorkspaceField("evolution_instance", e.target.value)}
                  placeholder="minha-loja-whatsapp"
                  className="w-full h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium"
                />
              </div>
              <div className="xl:col-span-2">
                <Label>API Key do Evolution</Label>
                <input
                  value={workspace.evolution_api_key}
                  onChange={(e) => handleWorkspaceField("evolution_api_key", e.target.value)}
                  placeholder="Cole a API key da instância"
                  className="w-full h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium"
                />
              </div>
              <div>
                <Label>Telefone fallback</Label>
                <input
                  value={workspace.fallback_phone}
                  onChange={(e) => handleWorkspaceField("fallback_phone", e.target.value)}
                  placeholder="5511999999999"
                  className="w-full h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium"
                />
              </div>
              <div>
                <Label>Modo</Label>
                <div className="w-full h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-700">
                    {workspace.is_enabled ? "Ativo" : "Desativado"}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleWorkspaceField("is_enabled", !workspace.is_enabled)}
                    className={cn(
                      "w-11 h-6 rounded-full relative transition-all",
                      workspace.is_enabled ? "bg-emerald-500" : "bg-slate-300",
                    )}
                  >
                    <span
                      className={cn(
                        "absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-all",
                        workspace.is_enabled ? "left-6" : "left-1",
                      )}
                    />
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <div>
                <Label>Timeout de inatividade (min)</Label>
                <input
                  type="number"
                  min={1}
                  value={workspace.settings.inactivity_timeout_minutes}
                  onChange={(e) =>
                    handleSettingsField("inactivity_timeout_minutes", Number(e.target.value))
                  }
                  className="w-full h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium"
                />
              </div>
              <div>
                <Label>Timer marketing por contato (seg)</Label>
                <input
                  type="number"
                  min={10}
                  value={workspace.settings.marketing_interval_seconds}
                  onChange={(e) =>
                    handleSettingsField("marketing_interval_seconds", Number(e.target.value))
                  }
                  className="w-full h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
              <Toggle
                checked={workspace.settings.prefer_buttons}
                onChange={(value) => handleSettingsField("prefer_buttons", value)}
                label="Priorizar botões"
                hint="Usa botões quando houver até 3 opções; acima disso, envia lista interativa."
              />
              <Toggle
                checked={workspace.settings.allow_numeric_fallback}
                onChange={(value) => handleSettingsField("allow_numeric_fallback", value)}
                label="Aceitar resposta por número"
                hint="Caso o cliente não receba os botões, ainda pode responder 1, 2, 3..."
              />
              <Toggle
                checked={workspace.settings.show_agent_list_before_transfer}
                onChange={(value) => handleSettingsField("show_agent_list_before_transfer", value)}
                label="Mostrar lista de atendentes"
                hint="Antes do handoff, deixa o cliente escolher qual pessoa ou equipe vai atender."
              />
              <Toggle
                checked={workspace.settings.auto_close_on_inactivity}
                onChange={(value) => handleSettingsField("auto_close_on_inactivity", value)}
                label="Encerrar por inatividade"
                hint="Fecha automaticamente a conversa e libera fila quando o cliente para de responder."
              />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[1fr_auto] gap-3">
              <div>
                <Label>Webhook do Evolution</Label>
                <input
                  readOnly
                  value={workspace.webhook_url}
                  className="w-full h-11 rounded-2xl border border-slate-200 bg-slate-100 px-4 text-xs font-mono text-slate-600"
                />
              </div>
              <div className="xl:min-w-[280px]">
                <Label>Header secreto</Label>
                <div className="flex gap-2">
                  <input
                    value={workspace.webhook_secret}
                    onChange={(e) => handleWorkspaceField("webhook_secret", e.target.value)}
                    className="flex-1 h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-xs font-mono text-slate-700"
                  />
                  <button
                    onClick={() => setRegenerateSecret(true)}
                    className={cn(
                      "h-11 px-4 rounded-2xl border text-[10px] font-black uppercase tracking-widest",
                      regenerateSecret
                        ? "border-amber-200 bg-amber-50 text-amber-700"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50",
                    )}
                  >
                    Novo
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Envie no header <strong>{workspace.secret_header_name}</strong>.
                </p>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">
                Envio de teste
              </p>
              <div className="flex flex-col xl:flex-row gap-3">
                <input
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  placeholder="5511999999999"
                  className="flex-1 h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm"
                />
                <button
                  onClick={sendTestMenu}
                  disabled={sendingTest}
                  className="h-11 px-5 rounded-2xl bg-emerald-600 text-white text-[11px] font-black uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-emerald-700 disabled:opacity-50"
                >
                  {sendingTest ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  Enviar menu teste
                </button>
              </div>
            </div>
          </div>
        </SectionCard>
        )}

        <div className="space-y-6">
          <SectionCard
            title="Menus prontos"
            subtitle="Pedidos, notas, valores, promoções e transferência"
            icon={<Bot size={18} />}
          >
            <div className="space-y-3">
              {workspace.menus
                .slice()
                .sort((a, b) => a.order - b.order)
                .map((menu) => (
                  <div
                    key={menu.id}
                    className="rounded-3xl border border-slate-200 p-4 bg-slate-50/70 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[11px] font-black uppercase tracking-widest text-slate-700 truncate">
                          {menu.action === "department"
                            ? `${menu.label} • ${menu.department}`
                            : menu.label}
                        </p>
                        <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide mt-1">
                          {menu.id}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleMenuField(menu.id, { enabled: !menu.enabled })}
                        className={cn(
                          "w-11 h-6 rounded-full relative transition-all shrink-0",
                          menu.enabled ? "bg-emerald-500" : "bg-slate-300",
                        )}
                      >
                        <span
                          className={cn(
                            "absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-all",
                            menu.enabled ? "left-6" : "left-1",
                          )}
                        />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                      <input
                        value={menu.label}
                        onChange={(e) => handleMenuField(menu.id, { label: e.target.value })}
                        className="w-full h-10 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold"
                      />
                      <input
                        value={menu.description}
                        onChange={(e) => handleMenuField(menu.id, { description: e.target.value })}
                        className="w-full h-10 rounded-2xl border border-slate-200 bg-white px-4 text-sm"
                      />
                    </div>
                  </div>
                ))}
            </div>
          </SectionCard>

          <SectionCard
            title="Templates do bot"
            subtitle="Textos principais usados no fluxo"
            icon={<MessageSquare size={18} />}
          >
            <div className="space-y-4">
              {[
                ["welcome", "Boas-vindas"],
                ["menu_intro", "Introdução do menu"],
                ["queue_wait", "Fila de espera"],
                ["transferred", "Transferência concluída"],
                ["fallback", "Mensagem de fallback"],
                ["closed_inactivity", "Encerramento automático"],
                ["points_earned", "Pontos ganhos"],
                ["points_redeemed", "Pontos resgatados"],
                ["points_reminder", "Lembrete de pontos parados"],
              ].map(([key, label]) => (
                <div key={key}>
                  <Label>{label}</Label>
                  <textarea
                    rows={3}
                    value={workspace.templates[key as keyof WorkspaceTemplates]}
                    onChange={(e) =>
                      handleTemplateField(key as keyof WorkspaceTemplates, e.target.value)
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm resize-none"
                  />
                </div>
              ))}
              <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3">
                <p className="text-[11px] font-semibold text-blue-700 leading-relaxed">
                  Placeholders suportados:{" "}
                  <span className="font-black">
                    {"{{customerName}}"} {"{{storeName}}"} {"{{departmentLabel}}"} {"{{agentName}}"} {"{{position}}"} {"{{points}}"} {"{{balance}}"}
                  </span>
                </p>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>

      <div className="grid grid-cols-1 2xl:grid-cols-[0.9fr_1.1fr] gap-6">
        <SectionCard
          title="Equipe de atendimento"
          subtitle="Vendas, atendimento, financeiro e disponibilidade"
          icon={<Users size={18} />}
          action={
            <button
              onClick={openNewAgent}
              className="h-9 px-4 rounded-xl bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-blue-700"
            >
              <UserPlus size={13} />
              Novo atendente
            </button>
          }
        >
          <div className="space-y-3">
            {overview.agents.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-300 p-8 text-center">
                <p className="text-sm font-semibold text-slate-500">
                  Nenhum atendente cadastrado no módulo.
                </p>
              </div>
            ) : (
              overview.agents.map((agent) => (
                <div
                  key={agent.id}
                  className="rounded-3xl border border-slate-200 bg-slate-50/80 px-4 py-4 flex items-start gap-4"
                >
                  <div
                    className={cn(
                      "w-11 h-11 rounded-2xl flex items-center justify-center font-black text-white shrink-0",
                      agent.is_available ? "bg-emerald-500" : agent.is_online ? "bg-amber-500" : "bg-slate-400",
                    )}
                  >
                    {agent.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-black text-slate-900 truncate">{agent.name}</p>
                      <span className="px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-white border border-slate-200 text-slate-600">
                        {DEPARTMENTS.find((item) => item.value === agent.department)?.label ?? agent.department}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      {agent.phone || "Sem telefone"} • carga {agent.current_load}/{agent.max_concurrent_chats}
                    </p>
                    <div className="flex flex-wrap gap-2 mt-3">
                      <span
                        className={cn(
                          "px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border",
                          agent.is_available
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : agent.is_online
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : "bg-slate-100 text-slate-600 border-slate-200",
                        )}
                      >
                        {agent.is_available ? "Disponível" : agent.is_online ? "Ocupado" : "Offline"}
                      </span>
                      {!agent.is_active && (
                        <span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border bg-red-50 text-red-700 border-red-200">
                          Inativo
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditAgent(agent)}
                      className="w-9 h-9 rounded-xl border border-slate-200 bg-white text-slate-500 hover:text-blue-600 hover:border-blue-200"
                    >
                      <Edit2 size={14} className="mx-auto" />
                    </button>
                    <button
                      onClick={() => void deleteAgent(agent.id)}
                      className="w-9 h-9 rounded-xl border border-slate-200 bg-white text-slate-500 hover:text-red-600 hover:border-red-200"
                    >
                      <Trash2 size={14} className="mx-auto" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </SectionCard>

        <SectionCard
          title="Fila e conversas"
          subtitle="Monitoramento do bot e handoff para o time"
          icon={<CircleDashed size={18} />}
        >
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {FILTERS.map((item) => (
                <button
                  key={item.key}
                  onClick={() => setFilter(item.key)}
                  className={cn(
                    "h-9 px-4 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all",
                    filter === item.key
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white text-slate-500 border-slate-200 hover:border-slate-300",
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="space-y-3 max-h-[780px] overflow-y-auto pr-1">
              {filteredConversations.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-slate-300 p-8 text-center">
                  <p className="text-sm font-semibold text-slate-500">
                    Nenhuma conversa encontrada neste filtro.
                  </p>
                </div>
              ) : (
                filteredConversations.map((conversation) => (
                  <button
                    key={conversation.id}
                    onClick={() => void loadConversation(conversation.id)}
                    className={cn(
                      "w-full rounded-3xl border px-4 py-4 text-left transition-all",
                      selectedConversationId === conversation.id
                        ? "border-blue-300 bg-blue-50/70"
                        : "border-slate-200 bg-white hover:border-slate-300",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-black text-slate-900 truncate">
                            {conversation.customer_name || "Cliente sem nome"}
                          </p>
                          <span
                            className={cn(
                              "px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border",
                              statusMeta(conversation.status),
                            )}
                          >
                            {conversation.status}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1">
                          {conversation.phone} • {conversation.department_label}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        {conversation.queue_position ? (
                          <p className="text-xs font-black text-amber-700">Fila {conversation.queue_position}</p>
                        ) : conversation.assigned_agent ? (
                          <p className="text-xs font-black text-emerald-700">
                            {conversation.assigned_agent.name}
                          </p>
                        ) : (
                          <p className="text-xs font-black text-blue-700">Bot ativo</p>
                        )}
                        <p className="text-[10px] text-slate-400 mt-1">{fmtDate(conversation.updated_at)}</p>
                      </div>
                    </div>
                    <p className="text-[12px] text-slate-600 mt-3 leading-relaxed line-clamp-2">
                      {conversation.last_message_preview || "Sem mensagem recente."}
                    </p>
                  </button>
                ))
              )}
            </div>
          </div>
        </SectionCard>
      </div>

      {showAgentModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/55 backdrop-blur-sm">
          <div className="w-full max-w-xl bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  {editingAgent ? "Editar atendente" : "Novo atendente"}
                </p>
                <h3 className="text-base font-black text-slate-900 mt-1">
                  {editingAgent ? "Atualizar operação da fila" : "Cadastrar pessoa para handoff"}
                </h3>
              </div>
              <button
                onClick={() => setShowAgentModal(false)}
                className="w-10 h-10 rounded-2xl hover:bg-slate-100 text-slate-500"
              >
                <X size={16} className="mx-auto" />
              </button>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label>Nome</Label>
                <input
                  value={agentForm.name}
                  onChange={(e) => setAgentForm((current) => ({ ...current, name: e.target.value }))}
                  className="w-full h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm"
                />
              </div>
              <div>
                <Label>Departamento</Label>
                <select
                  value={agentForm.department}
                  onChange={(e) =>
                    setAgentForm((current) => ({ ...current, department: e.target.value }))
                  }
                  className="w-full h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm"
                >
                  {DEPARTMENTS.map((department) => (
                    <option key={department.value} value={department.value}>
                      {department.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Função</Label>
                <input
                  value={agentForm.role}
                  onChange={(e) => setAgentForm((current) => ({ ...current, role: e.target.value }))}
                  className="w-full h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm"
                />
              </div>
              <div>
                <Label>Telefone</Label>
                <input
                  value={agentForm.phone}
                  onChange={(e) => setAgentForm((current) => ({ ...current, phone: e.target.value }))}
                  className="w-full h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm"
                />
              </div>
              <div>
                <Label>E-mail</Label>
                <input
                  value={agentForm.email}
                  onChange={(e) => setAgentForm((current) => ({ ...current, email: e.target.value }))}
                  className="w-full h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm"
                />
              </div>
              <div>
                <Label>Máx. conversas</Label>
                <input
                  type="number"
                  min={1}
                  value={agentForm.max_concurrent_chats}
                  onChange={(e) =>
                    setAgentForm((current) => ({
                      ...current,
                      max_concurrent_chats: Number(e.target.value),
                    }))
                  }
                  className="w-full h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm"
                />
              </div>
              <div>
                <Label>Prioridade</Label>
                <input
                  type="number"
                  value={agentForm.priority}
                  onChange={(e) =>
                    setAgentForm((current) => ({ ...current, priority: Number(e.target.value) }))
                  }
                  className="w-full h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm"
                />
              </div>
              <div className="md:col-span-2">
                <Label>Observações</Label>
                <textarea
                  rows={3}
                  value={agentForm.notes}
                  onChange={(e) => setAgentForm((current) => ({ ...current, notes: e.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm resize-none"
                />
              </div>
              <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-3">
                <Toggle
                  checked={agentForm.is_active}
                  onChange={(value) => setAgentForm((current) => ({ ...current, is_active: value }))}
                  label="Ativo"
                  hint="Participa do módulo."
                />
                <Toggle
                  checked={agentForm.is_online}
                  onChange={(value) => setAgentForm((current) => ({ ...current, is_online: value }))}
                  label="Online"
                  hint="Pode receber agora."
                />
                <Toggle
                  checked={agentForm.can_receive_transfer}
                  onChange={(value) =>
                    setAgentForm((current) => ({ ...current, can_receive_transfer: value }))
                  }
                  label="Recebe transferências"
                  hint="Aceita handoff do bot."
                />
              </div>
            </div>
            <div className="px-6 pb-6 flex justify-end gap-3">
              <button
                onClick={() => setShowAgentModal(false)}
                className="h-11 px-5 rounded-2xl border border-slate-200 text-[11px] font-black uppercase tracking-wider text-slate-600 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={saveAgent}
                disabled={agentSaving}
                className="h-11 px-5 rounded-2xl bg-blue-600 text-white text-[11px] font-black uppercase tracking-wider flex items-center gap-2 hover:bg-blue-700 disabled:opacity-50"
              >
                {agentSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {editingAgent ? "Salvar" : "Cadastrar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedConversationId && (
        <div className="fixed inset-0 z-[210] bg-slate-900/50 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-2xl h-full bg-[#f8fafc] border-l border-slate-200 shadow-2xl flex flex-col">
            <div className="px-6 py-5 border-b border-slate-200 bg-white flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Atendimento WhatsApp
                </p>
                <h3 className="text-lg font-black text-slate-900 mt-1">
                  {conversationDetail?.conversation.customer_name || "Cliente sem nome"}
                </h3>
                <p className="text-[12px] text-slate-500 mt-1 flex items-center gap-2">
                  <Phone size={13} />
                  {conversationDetail?.conversation.phone}
                </p>
              </div>
              <button
                onClick={() => {
                  setSelectedConversationId(null);
                  setConversationDetail(null);
                }}
                className="w-10 h-10 rounded-2xl hover:bg-slate-100 text-slate-500"
              >
                <X size={16} className="mx-auto" />
              </button>
            </div>

            {loadingConversation && !conversationDetail ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 size={20} className="animate-spin text-slate-400" />
              </div>
            ) : (
              <>
                <div className="px-6 py-4 bg-white border-b border-slate-100 grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-3">
                  <select
                    value={assigningAgentId}
                    onChange={(e) => setAssigningAgentId(Number(e.target.value) || "")}
                    className="h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm"
                  >
                    <option value="">Selecionar atendente</option>
                    {overview.agents.map((agent) => (
                      <option key={agent.id} value={agent.id}>
                        {agent.name} • {DEPARTMENTS.find((d) => d.value === agent.department)?.label ?? agent.department}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={assignConversation}
                    className="h-11 px-4 rounded-2xl bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-emerald-700"
                  >
                    <ArrowRightLeft size={13} />
                    Transferir
                  </button>
                  <button
                    onClick={closeConversation}
                    className="h-11 px-4 rounded-2xl border border-red-200 bg-red-50 text-red-700 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-red-100"
                  >
                    <Power size={13} />
                    Encerrar
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-3">
                  {conversationDetail?.messages.map((message) => (
                    <div
                      key={message.id}
                      className={cn(
                        "flex",
                        message.direction === "customer" ? "justify-start" : "justify-end",
                      )}
                    >
                      <div
                        className={cn(
                          "max-w-[82%] rounded-3xl px-4 py-3 shadow-sm border",
                          message.direction === "customer" &&
                            "bg-white border-slate-200 text-slate-800 rounded-tl-md",
                          message.direction === "bot" &&
                            "bg-cyan-50 border-cyan-100 text-cyan-900 rounded-tr-md",
                          message.direction === "agent" &&
                            "bg-emerald-50 border-emerald-100 text-emerald-900 rounded-tr-md",
                          message.direction === "system" &&
                            "bg-amber-50 border-amber-100 text-amber-900 rounded-tr-md",
                        )}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[9px] font-black uppercase tracking-widest opacity-70">
                            {message.direction}
                          </span>
                          {message.direction === "system" && <BadgeAlert size={12} />}
                        </div>
                        <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.body || "Sem texto"}</p>
                        <p className="text-[10px] opacity-60 mt-2">{fmtDate(message.created_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="p-6 border-t border-slate-200 bg-white">
                  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-3">
                    <textarea
                      rows={4}
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Responder por dentro do sistema. A conversa continua registrada aqui."
                      className="w-full bg-transparent resize-none text-sm outline-none"
                    />
                    <div className="pt-3 border-t border-slate-200 flex justify-between gap-3">
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        O cliente continua falando com o bot, mas a operação humana segue por dentro do painel.
                      </p>
                      <button
                        onClick={sendReply}
                        disabled={sendingReply || !replyText.trim()}
                        className="h-11 px-5 rounded-2xl bg-blue-600 text-white text-[11px] font-black uppercase tracking-wider flex items-center gap-2 hover:bg-blue-700 disabled:opacity-50 shrink-0"
                      >
                        {sendingReply ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                        Enviar
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
