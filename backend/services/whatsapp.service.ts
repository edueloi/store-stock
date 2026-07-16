import axios from "axios";
import { randomBytes } from "crypto";
import { Prisma } from "@prisma/client";

import { env } from "../config/env";
import { prisma } from "../config/prisma";

type ConversationStatus = "bot" | "queued" | "assigned" | "closed";
type PendingChoiceKind = "menu" | "agent" | "action";

interface WhatsappWorkspaceSettings {
  inactivity_timeout_minutes: number;
  marketing_interval_seconds: number;
  prefer_buttons: boolean;
  allow_numeric_fallback: boolean;
  show_agent_list_before_transfer: boolean;
  auto_close_on_inactivity: boolean;
}

interface WhatsappMenuOption {
  id: string;
  label: string;
  description: string;
  action: "orders" | "quotes" | "invoices" | "promotions" | "department" | "template";
  department?: string;
  template_key?: string;
  enabled: boolean;
  order: number;
}

interface WhatsappTemplates {
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
}

interface PendingChoice {
  key: string;
  label: string;
  kind: PendingChoiceKind;
}

interface ConversationMetadata {
  pending_choices?: PendingChoice[];
  agent_list_department?: string | null;
}

interface IncomingMessageContent {
  text: string;
  command: string;
}

const DEFAULT_SETTINGS: WhatsappWorkspaceSettings = {
  inactivity_timeout_minutes: 10,
  marketing_interval_seconds: 40,
  prefer_buttons: true,
  allow_numeric_fallback: true,
  show_agent_list_before_transfer: true,
  auto_close_on_inactivity: true,
};

const DEFAULT_MENUS: WhatsappMenuOption[] = [
  {
    id: "orders",
    label: "Meus pedidos",
    description: "Consultar andamento e últimos pedidos",
    action: "orders",
    enabled: true,
    order: 1,
  },
  {
    id: "quotes",
    label: "Orçamentos",
    description: "Solicitar ou revisar orçamentos",
    action: "quotes",
    enabled: true,
    order: 2,
  },
  {
    id: "invoices",
    label: "Notas e valores",
    description: "Ver NFC-e, totais e pagamentos",
    action: "invoices",
    enabled: true,
    order: 3,
  },
  {
    id: "promotions",
    label: "Promoções",
    description: "Receber itens em oferta e destaques",
    action: "promotions",
    enabled: true,
    order: 4,
  },
  {
    id: "department:sales",
    label: "Falar com vendas",
    description: "Transferir para a equipe comercial",
    action: "department",
    department: "sales",
    enabled: true,
    order: 5,
  },
  {
    id: "department:support",
    label: "Atendimento",
    description: "Dúvidas gerais e pós-venda",
    action: "department",
    department: "support",
    enabled: true,
    order: 6,
  },
  {
    id: "department:finance",
    label: "Financeiro",
    description: "Cobrança, boletos e pagamentos",
    action: "department",
    department: "finance",
    enabled: true,
    order: 7,
  },
];

const DEFAULT_TEMPLATES: WhatsappTemplates = {
  welcome:
    "Olá, {{customerName}}. Eu sou o atendimento virtual da {{storeName}} e vou te ajudar por aqui.",
  menu_intro:
    "Escolha uma opção abaixo. Se preferir, envie MENU para voltar ou SAIR para encerrar o atendimento.",
  fallback:
    "Não consegui entender sua escolha. Use os botões, a lista interativa ou envie MENU para voltar ao início.",
  queue_wait:
    "No momento nossa equipe de {{departmentLabel}} está em atendimento. Você entrou na fila na posição {{position}}.",
  transferred:
    "Perfeito. Sua conversa foi encaminhada para {{agentName}} da equipe de {{departmentLabel}}.",
  busy:
    "Este atendente está ocupado agora. Sua solicitação entrou na fila e nós seguimos por aqui assim que liberar.",
  closed_inactivity:
    "Encerramos este atendimento por falta de interação. Quando quiser continuar, envie OI ou MENU.",
  no_orders:
    "Não encontrei pedidos vinculados a este número até agora. Se quiser, posso te colocar com o time de vendas.",
  no_quotes:
    "Ainda não encontrei orçamentos recentes para este número. Se quiser, eu já te passo para um vendedor.",
  no_invoices:
    "Não encontrei notas ou cobranças recentes para este número neste momento.",
  no_promotions:
    "No momento não há promoções ativas cadastradas. Posso te passar para vendas para um atendimento direto.",
  manual_takeover:
    "Atendimento assumido manualmente por {{agentName}}. Você pode seguir por aqui normalmente.",
};

const OPEN_STATUSES: ConversationStatus[] = ["bot", "queued", "assigned"];
const MAINTENANCE_INTERVAL_MS = 60_000;

let maintenanceStarted = false;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepCopy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizePhone(raw: string | null | undefined) {
  return (raw ?? "").replace(/\D/g, "");
}

function normalizeJid(raw: string) {
  return raw.includes("@") ? raw : `${normalizePhone(raw)}@s.whatsapp.net`;
}

function getDepartmentLabel(department?: string | null) {
  switch (department) {
    case "sales":
      return "vendas";
    case "support":
      return "atendimento";
    case "finance":
      return "financeiro";
    default:
      return department || "atendimento";
  }
}

function formatMoney(value: unknown) {
  return Number(value ?? 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function asJson(value: unknown) {
  return value as Prisma.InputJsonValue;
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("pt-BR");
}

function generateWebhookSecret() {
  return randomBytes(18).toString("hex");
}

function getDefaultSettings() {
  return { ...DEFAULT_SETTINGS };
}

function getDefaultMenus() {
  return deepCopy(DEFAULT_MENUS);
}

function getDefaultTemplates() {
  return { ...DEFAULT_TEMPLATES };
}

function parseSettings(value: unknown): WhatsappWorkspaceSettings {
  if (!isRecord(value)) return getDefaultSettings();

  return {
    inactivity_timeout_minutes: Number(value.inactivity_timeout_minutes ?? DEFAULT_SETTINGS.inactivity_timeout_minutes),
    marketing_interval_seconds: Number(value.marketing_interval_seconds ?? DEFAULT_SETTINGS.marketing_interval_seconds),
    prefer_buttons: Boolean(value.prefer_buttons ?? DEFAULT_SETTINGS.prefer_buttons),
    allow_numeric_fallback: Boolean(value.allow_numeric_fallback ?? DEFAULT_SETTINGS.allow_numeric_fallback),
    show_agent_list_before_transfer: Boolean(
      value.show_agent_list_before_transfer ?? DEFAULT_SETTINGS.show_agent_list_before_transfer,
    ),
    auto_close_on_inactivity: Boolean(
      value.auto_close_on_inactivity ?? DEFAULT_SETTINGS.auto_close_on_inactivity,
    ),
  };
}

function parseMenus(value: unknown): WhatsappMenuOption[] {
  if (!Array.isArray(value)) return getDefaultMenus();

  const parsed = value
    .filter(isRecord)
    .map((item, index) => ({
      id: String(item.id ?? `custom-${index + 1}`),
      label: String(item.label ?? `Opção ${index + 1}`),
      description: String(item.description ?? ""),
      action: (item.action === "orders" ||
      item.action === "quotes" ||
      item.action === "invoices" ||
      item.action === "promotions" ||
      item.action === "department" ||
      item.action === "template"
        ? item.action
        : "template") as WhatsappMenuOption["action"],
      department: item.department ? String(item.department) : undefined,
      template_key: item.template_key ? String(item.template_key) : undefined,
      enabled: Boolean(item.enabled ?? true),
      order: Number(item.order ?? index + 1),
    }))
    .sort((a, b) => a.order - b.order);

  return parsed.length > 0 ? parsed : getDefaultMenus();
}

function parseTemplates(value: unknown): WhatsappTemplates {
  if (!isRecord(value)) return getDefaultTemplates();

  return {
    welcome: String(value.welcome ?? DEFAULT_TEMPLATES.welcome),
    menu_intro: String(value.menu_intro ?? DEFAULT_TEMPLATES.menu_intro),
    fallback: String(value.fallback ?? DEFAULT_TEMPLATES.fallback),
    queue_wait: String(value.queue_wait ?? DEFAULT_TEMPLATES.queue_wait),
    transferred: String(value.transferred ?? DEFAULT_TEMPLATES.transferred),
    busy: String(value.busy ?? DEFAULT_TEMPLATES.busy),
    closed_inactivity: String(value.closed_inactivity ?? DEFAULT_TEMPLATES.closed_inactivity),
    no_orders: String(value.no_orders ?? DEFAULT_TEMPLATES.no_orders),
    no_quotes: String(value.no_quotes ?? DEFAULT_TEMPLATES.no_quotes),
    no_invoices: String(value.no_invoices ?? DEFAULT_TEMPLATES.no_invoices),
    no_promotions: String(value.no_promotions ?? DEFAULT_TEMPLATES.no_promotions),
    manual_takeover: String(value.manual_takeover ?? DEFAULT_TEMPLATES.manual_takeover),
  };
}

function parseMetadata(value: unknown): ConversationMetadata {
  if (!isRecord(value)) return {};

  const pendingChoices = Array.isArray(value.pending_choices)
    ? value.pending_choices
        .filter(isRecord)
        .map((choice) => {
          const kind: PendingChoiceKind =
            choice.kind === "menu" || choice.kind === "agent" || choice.kind === "action"
              ? choice.kind
              : "menu";

          return {
            key: String(choice.key ?? ""),
            label: String(choice.label ?? ""),
            kind,
          };
        })
        .filter((choice) => choice.key)
    : [];

  return {
    pending_choices: pendingChoices,
    agent_list_department: value.agent_list_department ? String(value.agent_list_department) : null,
  };
}

function renderTemplate(template: string, values: Record<string, string | number | undefined | null>) {
  return template.replace(/\{\{(.*?)\}\}/g, (_, rawKey) => {
    const key = String(rawKey).trim();
    const value = values[key];
    return value === undefined || value === null ? "" : String(value);
  });
}

function extractIncomingMessageContent(data: Record<string, unknown>): IncomingMessageContent {
  const message = isRecord(data.message) ? data.message : {};
  const conversation = typeof message.conversation === "string" ? message.conversation.trim() : "";

  const extendedTextMessage = isRecord(message.extendedTextMessage) ? message.extendedTextMessage : {};
  const extendedText =
    typeof extendedTextMessage.text === "string" ? extendedTextMessage.text.trim() : "";

  const buttonsResponseMessage = isRecord(message.buttonsResponseMessage)
    ? message.buttonsResponseMessage
    : {};
  const selectedButtonId =
    typeof buttonsResponseMessage.selectedButtonId === "string"
      ? buttonsResponseMessage.selectedButtonId.trim()
      : "";

  const listResponseMessage = isRecord(message.listResponseMessage) ? message.listResponseMessage : {};
  const singleSelectReply = isRecord(listResponseMessage.singleSelectReply)
    ? listResponseMessage.singleSelectReply
    : {};
  const selectedRowId =
    typeof singleSelectReply.selectedRowId === "string" ? singleSelectReply.selectedRowId.trim() : "";

  const templateButtonReplyMessage = isRecord(message.templateButtonReplyMessage)
    ? message.templateButtonReplyMessage
    : {};
  const selectedTemplateId =
    typeof templateButtonReplyMessage.selectedId === "string"
      ? templateButtonReplyMessage.selectedId.trim()
      : "";

  const interactiveResponseMessage = isRecord(message.interactiveResponseMessage)
    ? message.interactiveResponseMessage
    : {};
  const nativeFlowResponseMessage = isRecord(interactiveResponseMessage.nativeFlowResponseMessage)
    ? interactiveResponseMessage.nativeFlowResponseMessage
    : {};
  const paramsJson =
    typeof nativeFlowResponseMessage.paramsJson === "string"
      ? nativeFlowResponseMessage.paramsJson
      : "";

  let interactiveId = "";

  if (paramsJson) {
    try {
      const parsed = JSON.parse(paramsJson) as Record<string, unknown>;
      interactiveId = String(
        parsed.id ??
          parsed.selectedId ??
          parsed.selectedRowId ??
          parsed.rowId ??
          "",
      ).trim();
    } catch {
      interactiveId = "";
    }
  }

  const command = selectedRowId || selectedButtonId || selectedTemplateId || interactiveId || conversation || extendedText;
  const text = conversation || extendedText || command;

  return {
    text,
    command,
  };
}

async function ensureWorkspace(tenantId: number) {
  const existing = await prisma.whatsappWorkspace.findUnique({
    where: { tenant_id: tenantId },
  });

  if (existing) return existing;

  return prisma.whatsappWorkspace.create({
    data: {
      tenant_id: tenantId,
      provider: "baileys",
      webhook_secret: generateWebhookSecret(),
      settings: asJson(getDefaultSettings()),
      menus: asJson(getDefaultMenus()),
      templates: asJson(getDefaultTemplates()),
    },
  });
}

async function getWorkspaceWithTenantByTenantId(tenantId: number) {
  const [tenant, workspace] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, slug: true, whatsapp: true },
    }),
    ensureWorkspace(tenantId),
  ]);

  if (!tenant) {
    throw new Error("Loja não encontrada.");
  }

  return { tenant, workspace };
}

async function getWorkspaceBySlug(slug: string) {
  return prisma.whatsappWorkspace.findFirst({
    where: { tenant: { slug } },
    include: {
      tenant: {
        select: { id: true, name: true, slug: true, whatsapp: true },
      },
    },
  });
}

async function getAgentLoadMap(workspaceId: number) {
  const rows = await prisma.whatsappConversation.findMany({
    where: {
      workspace_id: workspaceId,
      status: "assigned",
      assigned_agent_id: { not: null },
    },
    select: { assigned_agent_id: true },
  });

  const loadMap = new Map<number, number>();

  for (const row of rows) {
    if (!row.assigned_agent_id) continue;
    loadMap.set(row.assigned_agent_id, (loadMap.get(row.assigned_agent_id) ?? 0) + 1);
  }

  return loadMap;
}

function getWebhookUrl(tenantSlug: string) {
  return `${env.appBaseUrl.replace(/\/$/, "")}/api/whatsapp/webhook/${tenantSlug}`;
}

async function getWorkspacePayload(tenantId: number) {
  const { tenant, workspace } = await getWorkspaceWithTenantByTenantId(tenantId);

  return {
    id: workspace.id,
    tenant_id: workspace.tenant_id,
    is_enabled: workspace.is_enabled,
    provider: workspace.provider,
    evolution_base_url: workspace.evolution_base_url ?? "",
    evolution_api_key: workspace.evolution_api_key ?? "",
    evolution_instance: workspace.evolution_instance ?? "",
    webhook_secret: workspace.webhook_secret ?? "",
    fallback_phone: workspace.fallback_phone ?? tenant.whatsapp ?? "",
    settings: parseSettings(workspace.settings),
    menus: parseMenus(workspace.menus),
    templates: parseTemplates(workspace.templates),
    webhook_url: getWebhookUrl(tenant.slug),
    secret_header_name: "x-whatsapp-secret",
  };
}

function sanitizeStatus(status: unknown): ConversationStatus | undefined {
  if (status === "bot" || status === "queued" || status === "assigned" || status === "closed") {
    return status;
  }

  return undefined;
}

function mapConversationForUi(
  conversation: {
    id: number;
    phone: string;
    remote_jid: string;
    customer_name: string | null;
    status: string;
    current_menu: string;
    department: string | null;
    queue_position: number | null;
    last_message_preview: string | null;
    last_inbound_at: Date | null;
    last_outbound_at: Date | null;
    updated_at: Date;
    closed_reason: string | null;
    metadata: unknown;
    assigned_agent: { id: number; name: string; department: string } | null;
  },
) {
  const metadata = parseMetadata(conversation.metadata);

  return {
    id: conversation.id,
    phone: conversation.phone,
    remote_jid: conversation.remote_jid,
    customer_name: conversation.customer_name,
    status: conversation.status,
    current_menu: conversation.current_menu,
    department: conversation.department,
    department_label: getDepartmentLabel(conversation.department),
    queue_position: conversation.queue_position,
    last_message_preview: conversation.last_message_preview,
    last_inbound_at: conversation.last_inbound_at,
    last_outbound_at: conversation.last_outbound_at,
    updated_at: conversation.updated_at,
    closed_reason: conversation.closed_reason,
    assigned_agent: conversation.assigned_agent,
    pending_choices: metadata.pending_choices ?? [],
  };
}

export async function getWhatsappOverview(tenantId: number) {
  const [workspacePayload, workspace] = await Promise.all([
    getWorkspacePayload(tenantId),
    ensureWorkspace(tenantId),
  ]);

  const [agents, conversations, loadMap] = await Promise.all([
    prisma.whatsappAgent.findMany({
      where: { workspace_id: workspace.id },
      orderBy: [{ priority: "desc" }, { name: "asc" }],
    }),
    prisma.whatsappConversation.findMany({
      where: { workspace_id: workspace.id },
      include: {
        assigned_agent: {
          select: { id: true, name: true, department: true },
        },
      },
      orderBy: [{ status: "asc" }, { updated_at: "desc" }],
      take: 100,
    }),
    getAgentLoadMap(workspace.id),
  ]);

  const mappedAgents = agents.map((agent) => ({
    ...agent,
    current_load: loadMap.get(agent.id) ?? 0,
    is_available:
      agent.is_active &&
      agent.is_online &&
      agent.can_receive_transfer &&
      (loadMap.get(agent.id) ?? 0) < agent.max_concurrent_chats,
  }));

  const mappedConversations = conversations.map(mapConversationForUi);

  return {
    workspace: workspacePayload,
    stats: {
      online_agents: mappedAgents.filter((agent) => agent.is_online && agent.is_active).length,
      open_conversations: mappedConversations.filter((item) =>
        OPEN_STATUSES.includes(item.status as ConversationStatus),
      ).length,
      bot_conversations: mappedConversations.filter((item) => item.status === "bot").length,
      queued_conversations: mappedConversations.filter((item) => item.status === "queued").length,
      assigned_conversations: mappedConversations.filter((item) => item.status === "assigned").length,
      closed_conversations: mappedConversations.filter((item) => item.status === "closed").length,
    },
    agents: mappedAgents,
    conversations: mappedConversations,
  };
}

export async function updateWhatsappWorkspace(
  tenantId: number,
  payload: Partial<{
    is_enabled: boolean;
    provider: string;
    evolution_base_url: string;
    evolution_api_key: string;
    evolution_instance: string;
    webhook_secret: string;
    fallback_phone: string;
    settings: Partial<WhatsappWorkspaceSettings>;
    menus: WhatsappMenuOption[];
    templates: Partial<WhatsappTemplates>;
    regenerate_secret: boolean;
  }>,
) {
  const workspace = await ensureWorkspace(tenantId);
  const currentSettings = parseSettings(workspace.settings);
  const currentMenus = parseMenus(workspace.menus);
  const currentTemplates = parseTemplates(workspace.templates);

  const updated = await prisma.whatsappWorkspace.update({
    where: { id: workspace.id },
    data: {
      is_enabled:
        payload.is_enabled === undefined ? workspace.is_enabled : Boolean(payload.is_enabled),
      provider: payload.provider?.trim() || workspace.provider,
      evolution_base_url:
        payload.evolution_base_url === undefined
          ? workspace.evolution_base_url
          : payload.evolution_base_url.trim(),
      evolution_api_key:
        payload.evolution_api_key === undefined
          ? workspace.evolution_api_key
          : payload.evolution_api_key.trim(),
      evolution_instance:
        payload.evolution_instance === undefined
          ? workspace.evolution_instance
          : payload.evolution_instance.trim(),
      webhook_secret:
        payload.regenerate_secret
          ? generateWebhookSecret()
          : payload.webhook_secret === undefined
            ? workspace.webhook_secret
            : payload.webhook_secret.trim(),
      fallback_phone:
        payload.fallback_phone === undefined
          ? workspace.fallback_phone
          : payload.fallback_phone.trim(),
      settings: payload.settings
        ? asJson({ ...currentSettings, ...payload.settings })
        : asJson(currentSettings),
      menus: payload.menus ? asJson(parseMenus(payload.menus)) : asJson(currentMenus),
      templates: payload.templates
        ? asJson({ ...currentTemplates, ...payload.templates })
        : asJson(currentTemplates),
    },
  });

  return updated;
}

function validateAgentPayload(payload: Record<string, unknown>) {
  const name = String(payload.name ?? "").trim();

  if (!name) {
    throw new Error("Nome do atendente é obrigatório.");
  }

  return {
    name,
    department: String(payload.department ?? "sales").trim() || "sales",
    role: String(payload.role ?? "agent").trim() || "agent",
    phone: String(payload.phone ?? "").trim() || null,
    email: String(payload.email ?? "").trim() || null,
    is_active: Boolean(payload.is_active ?? true),
    is_online: Boolean(payload.is_online ?? true),
    can_receive_transfer: Boolean(payload.can_receive_transfer ?? true),
    max_concurrent_chats: Math.max(1, Number(payload.max_concurrent_chats ?? 3)),
    priority: Number(payload.priority ?? 0),
    notes: String(payload.notes ?? "").trim() || null,
  };
}

export async function createWhatsappAgent(tenantId: number, payload: Record<string, unknown>) {
  const workspace = await ensureWorkspace(tenantId);
  const data = validateAgentPayload(payload);

  const created = await prisma.whatsappAgent.create({
    data: {
      workspace_id: workspace.id,
      ...data,
    },
  });

  await advanceQueueForWorkspace(workspace.id, data.department);

  return created;
}

export async function updateWhatsappAgent(
  tenantId: number,
  agentId: number,
  payload: Record<string, unknown>,
) {
  const workspace = await ensureWorkspace(tenantId);

  const existing = await prisma.whatsappAgent.findFirst({
    where: { id: agentId, workspace_id: workspace.id },
  });

  if (!existing) {
    throw new Error("Atendente não encontrado.");
  }

  const data = validateAgentPayload(payload);

  const updated = await prisma.whatsappAgent.update({
    where: { id: agentId },
    data,
  });

  await advanceQueueForWorkspace(workspace.id, updated.department);

  return updated;
}

export async function deleteWhatsappAgent(tenantId: number, agentId: number) {
  const workspace = await ensureWorkspace(tenantId);

  const existing = await prisma.whatsappAgent.findFirst({
    where: { id: agentId, workspace_id: workspace.id },
  });

  if (!existing) {
    throw new Error("Atendente não encontrado.");
  }

  await prisma.whatsappConversation.updateMany({
    where: {
      workspace_id: workspace.id,
      assigned_agent_id: agentId,
      status: "assigned",
    },
    data: {
      assigned_agent_id: null,
      status: "queued",
      queue_position: 1,
    },
  });

  await prisma.whatsappAgent.delete({ where: { id: agentId } });
  await normalizeQueuePositions(workspace.id, existing.department);
  await advanceQueueForWorkspace(workspace.id, existing.department);
}

async function findConversationOrThrow(tenantId: number, conversationId: number) {
  const workspace = await ensureWorkspace(tenantId);

  const conversation = await prisma.whatsappConversation.findFirst({
    where: { id: conversationId, workspace_id: workspace.id },
    include: {
      assigned_agent: {
        select: { id: true, name: true, department: true },
      },
    },
  });

  if (!conversation) {
    throw new Error("Conversa não encontrada.");
  }

  return { workspace, conversation };
}

async function logConversationMessage(
  conversationId: number,
  direction: string,
  messageType: string,
  body: string,
  payload?: unknown,
  externalMessageId?: string | null,
) {
  await prisma.whatsappMessageLog.create({
    data: {
      conversation_id: conversationId,
      direction,
      message_type: messageType,
      body,
      payload: payload ? (payload as object) : undefined,
      external_message_id: externalMessageId || null,
    },
  });
}

async function updateConversationState(
  conversationId: number,
  data: Record<string, unknown>,
) {
  return prisma.whatsappConversation.update({
    where: { id: conversationId },
    data,
  });
}

async function getEvolutionConfig(workspaceId: number) {
  const workspace = await prisma.whatsappWorkspace.findUnique({
    where: { id: workspaceId },
  });

  if (!workspace) {
    throw new Error("Workspace do WhatsApp não encontrado.");
  }

  if (!workspace.evolution_base_url || !workspace.evolution_api_key || !workspace.evolution_instance) {
    throw new Error("Preencha URL, API key e nome da instância do Evolution.");
  }

  return {
    baseUrl: workspace.evolution_base_url.replace(/\/$/, ""),
    apiKey: workspace.evolution_api_key,
    instance: workspace.evolution_instance,
  };
}

async function sendEvolutionRequest(
  workspaceId: number,
  endpoint: string,
  body: Record<string, unknown>,
) {
  const config = await getEvolutionConfig(workspaceId);

  const response = await axios.post(`${config.baseUrl}${endpoint}/${config.instance}`, body, {
    headers: {
      "Content-Type": "application/json",
      apikey: config.apiKey,
    },
    timeout: 15_000,
  });

  return response.data as Record<string, unknown>;
}

function baileysHeaders() {
  return {
    "Content-Type": "application/json",
    "x-internal-token": env.baileysInternalToken,
  };
}

async function sendBaileysRequest(tenantId: number, endpoint: string, body: Record<string, unknown>) {
  const response = await axios.post(`${env.baileysServiceUrl}${endpoint}`, body, {
    headers: baileysHeaders(),
    timeout: 15_000,
  });

  return response.data as Record<string, unknown>;
}

// Mapeia o formato de envio (endpoint Evolution) para o messageType genérico que o
// serviço Baileys entende — ambos os providers são chamados a partir do mesmo trio de
// funções sendTextMessage/sendButtonsMessage/sendListMessage.
const EVOLUTION_ENDPOINT_TO_BAILEYS_TYPE: Record<string, "text" | "buttons" | "list"> = {
  "/message/sendText": "text",
  "/message/sendButtons": "buttons",
  "/message/sendList": "list",
};

async function sendProviderRequest(
  workspaceId: number,
  endpoint: string,
  body: Record<string, unknown>,
) {
  const workspace = await prisma.whatsappWorkspace.findUnique({ where: { id: workspaceId } });
  if (!workspace) {
    throw new Error("Workspace do WhatsApp não encontrado.");
  }

  if (workspace.provider === "baileys") {
    const { number, ...payload } = body;
    return sendBaileysRequest(workspace.tenant_id, `/sessions/${workspace.tenant_id}/send`, {
      number,
      messageType: EVOLUTION_ENDPOINT_TO_BAILEYS_TYPE[endpoint] ?? "text",
      payload,
    });
  }

  return sendEvolutionRequest(workspaceId, endpoint, body);
}

async function sendTextMessage(
  workspaceId: number,
  number: string,
  text: string,
) {
  return sendProviderRequest(workspaceId, "/message/sendText", {
    number,
    text,
  });
}

async function sendButtonsMessage(
  workspaceId: number,
  number: string,
  title: string,
  description: string,
  footer: string,
  buttons: Array<Record<string, string>>,
) {
  return sendProviderRequest(workspaceId, "/message/sendButtons", {
    number,
    title,
    description,
    footer,
    buttons,
  });
}

async function sendListMessage(
  workspaceId: number,
  number: string,
  title: string,
  description: string,
  buttonText: string,
  footerText: string,
  sections: Array<Record<string, unknown>>,
) {
  return sendProviderRequest(workspaceId, "/message/sendList", {
    number,
    title,
    description,
    buttonText,
    footerText,
    sections,
  });
}

async function sendMessageAndTrack(
  workspaceId: number,
  conversationId: number | null,
  number: string,
  messageType: "text" | "buttons" | "list",
  payload: Record<string, unknown>,
  previewText: string,
  direction: "bot" | "agent" | "system" = "bot",
) {
  let response: Record<string, unknown>;

  if (messageType === "text") {
    response = await sendTextMessage(workspaceId, number, String(payload.text ?? ""));
  } else if (messageType === "buttons") {
    response = await sendButtonsMessage(
      workspaceId,
      number,
      String(payload.title ?? ""),
      String(payload.description ?? ""),
      String(payload.footer ?? ""),
      Array.isArray(payload.buttons) ? (payload.buttons as Array<Record<string, string>>) : [],
    );
  } else {
    response = await sendListMessage(
      workspaceId,
      number,
      String(payload.title ?? ""),
      String(payload.description ?? ""),
      String(payload.buttonText ?? ""),
      String(payload.footerText ?? ""),
      Array.isArray(payload.sections) ? (payload.sections as Array<Record<string, unknown>>) : [],
    );
  }

  if (conversationId) {
    await logConversationMessage(
      conversationId,
      direction,
      messageType,
      previewText,
      payload,
      typeof response?.key === "object" && response.key && "id" in response.key
        ? String((response.key as Record<string, unknown>).id ?? "")
        : null,
    );

    await updateConversationState(conversationId, {
      last_message_preview: previewText,
      last_outbound_at: new Date(),
    });
  }

  return response;
}

async function sendMenuToConversation(
  workspace: { id: number; tenant_id: number; settings: unknown; menus: unknown; templates: unknown },
  tenantName: string,
  conversation: {
    id: number;
    phone: string;
    customer_name: string | null;
    metadata: unknown;
  },
) {
  const settings = parseSettings(workspace.settings);
  const menus = parseMenus(workspace.menus).filter((item) => item.enabled);
  const templates = parseTemplates(workspace.templates);
  const pendingChoices = menus.map((item) => ({
    key: item.id,
    label: item.label,
    kind: "menu" as PendingChoiceKind,
  }));

  const description = renderTemplate(templates.menu_intro, {
    storeName: tenantName,
    customerName: conversation.customer_name || "cliente",
  });

  if (settings.prefer_buttons && menus.length <= 3) {
    await sendMessageAndTrack(
      workspace.id,
      conversation.id,
      conversation.phone,
      "buttons",
      {
        title: tenantName,
        description,
        footer: "MENU para voltar • SAIR para encerrar",
        buttons: menus.map((item) => ({
          type: "reply",
          displayText: item.label,
          id: item.id,
        })),
      },
      description,
    );
  } else {
    await sendMessageAndTrack(
      workspace.id,
      conversation.id,
      conversation.phone,
      "list",
      {
        title: tenantName,
        description,
        buttonText: "Ver opções",
        footerText: "MENU para voltar • SAIR para encerrar",
        sections: [
          {
            title: "Atendimento",
            rows: menus.map((item) => ({
              title: item.label,
              description: item.description,
              rowId: item.id,
            })),
          },
        ],
      },
      description,
    );
  }

  const metadata = parseMetadata(conversation.metadata);

  await updateConversationState(conversation.id, {
    current_menu: "main",
    metadata: asJson({
      ...metadata,
      pending_choices: pendingChoices,
      agent_list_department: null,
    }),
  });
}

async function sendAgentDirectory(
  workspace: { id: number; settings: unknown; templates: unknown },
  conversation: {
    id: number;
    phone: string;
    customer_name: string | null;
    metadata: unknown;
  },
  department: string,
) {
  const agents = await prisma.whatsappAgent.findMany({
    where: {
      workspace_id: workspace.id,
      department,
      is_active: true,
    },
    orderBy: [{ priority: "desc" }, { name: "asc" }],
  });

  const settings = parseSettings(workspace.settings);
  const loadMap = await getAgentLoadMap(workspace.id);

  if (agents.length === 0) {
    await queueConversation(workspace.id, conversation.id, department);
    return;
  }

  const options = agents.map((agent) => {
    const load = loadMap.get(agent.id) ?? 0;
    const statusLabel =
      agent.is_online && load < agent.max_concurrent_chats
        ? "Disponível agora"
        : "Em atendimento";

    return {
      key: `agent:${agent.id}`,
      label: agent.name,
      description: `${statusLabel} • ${load}/${agent.max_concurrent_chats} conversas`,
      kind: "agent" as PendingChoiceKind,
    };
  });

  const metadata = parseMetadata(conversation.metadata);
  const preview =
    "Escolha quem deve assumir seu atendimento. Se o atendente estiver ocupado, a fila anda automaticamente.";

  if (settings.prefer_buttons && options.length <= 2) {
    await sendMessageAndTrack(
      workspace.id,
      conversation.id,
      conversation.phone,
      "buttons",
      {
        title: `Equipe de ${getDepartmentLabel(department)}`,
        description: preview,
        footer: "MENU para voltar",
        buttons: [
          ...options.map((option) => ({
            type: "reply",
            displayText: option.label,
            id: option.key,
          })),
          {
            type: "reply",
            displayText: "Voltar ao menu",
            id: "menu:back",
          },
        ],
      },
      preview,
    );
  } else {
    await sendMessageAndTrack(
      workspace.id,
      conversation.id,
      conversation.phone,
      "list",
      {
        title: `Equipe de ${getDepartmentLabel(department)}`,
        description: preview,
        buttonText: "Escolher atendente",
        footerText: "MENU para voltar",
        sections: [
          {
            title: "Equipe disponível",
            rows: options.map((option) => ({
              title: option.label,
              description: option.description,
              rowId: option.key,
            })),
          },
          {
            title: "Navegação",
            rows: [
              {
                title: "Voltar ao menu",
                description: "Retornar para as opções principais",
                rowId: "menu:back",
              },
            ],
          },
        ],
      },
      preview,
    );
  }

  await updateConversationState(conversation.id, {
    current_menu: `department:${department}`,
    metadata: asJson({
      ...metadata,
      pending_choices: [
        ...options,
        { key: "menu:back", label: "Voltar ao menu", kind: "action" as PendingChoiceKind },
      ],
      agent_list_department: department,
    }),
  });
}

async function getRecentOrdersForPhone(tenantId: number, phone: string) {
  const target = normalizePhone(phone);
  const orders = await prisma.order.findMany({
    where: {
      tenant_id: tenantId,
      customer_phone: { not: null },
    },
    orderBy: { created_at: "desc" },
    take: 80,
  });

  return orders
    .filter((order) => {
      const candidate = normalizePhone(order.customer_phone);
      return Boolean(candidate) && (candidate.endsWith(target.slice(-10)) || target.endsWith(candidate));
    })
    .slice(0, 3);
}

async function getRecentQuotesForPhone(tenantId: number, phone: string) {
  const target = normalizePhone(phone);
  const quotes = await prisma.quote.findMany({
    where: {
      tenant_id: tenantId,
      customer_phone: { not: null },
    },
    orderBy: { created_at: "desc" },
    take: 80,
  });

  return quotes
    .filter((quote) => {
      const candidate = normalizePhone(quote.customer_phone);
      return Boolean(candidate) && (candidate.endsWith(target.slice(-10)) || target.endsWith(candidate));
    })
    .slice(0, 3);
}

async function getRecentInvoicesForPhone(tenantId: number, phone: string) {
  const target = normalizePhone(phone);
  const invoices = await prisma.nfceInvoice.findMany({
    where: { tenant_id: tenantId },
    include: {
      order: {
        select: {
          customer_phone: true,
          customer_name: true,
          total_amount: true,
        },
      },
    },
    orderBy: { created_at: "desc" },
    take: 80,
  });

  return invoices
    .filter((invoice) => {
      const candidate = normalizePhone(invoice.order?.customer_phone);
      return Boolean(candidate) && (candidate.endsWith(target.slice(-10)) || target.endsWith(candidate));
    })
    .slice(0, 3);
}

async function sendOrdersSummary(
  workspace: { id: number; tenant_id: number; templates: unknown },
  conversation: { id: number; phone: string },
) {
  const templates = parseTemplates(workspace.templates);
  const orders = await getRecentOrdersForPhone(workspace.tenant_id, conversation.phone);

  const text =
    orders.length === 0
      ? templates.no_orders
      : [
          "Encontrei estes pedidos recentes para este número:",
          ...orders.map(
            (order) =>
              `• Pedido #${order.id} • ${formatMoney(order.total_amount)} • ${order.status} • ${formatDate(order.created_at)}`,
          ),
        ].join("\n");

  await sendMessageAndTrack(
    workspace.id,
    conversation.id,
    conversation.phone,
    "text",
    { text },
    text,
  );
}

async function sendQuotesSummary(
  workspace: { id: number; tenant_id: number; templates: unknown },
  conversation: { id: number; phone: string },
) {
  const templates = parseTemplates(workspace.templates);
  const quotes = await getRecentQuotesForPhone(workspace.tenant_id, conversation.phone);

  const text =
    quotes.length === 0
      ? templates.no_quotes
      : [
          "Encontrei estes orçamentos recentes:",
          ...quotes.map(
            (quote) =>
              `• Orçamento #${quote.number} • ${formatMoney(quote.total_amount)} • ${quote.status} • ${formatDate(quote.created_at)}`,
          ),
        ].join("\n");

  await sendMessageAndTrack(
    workspace.id,
    conversation.id,
    conversation.phone,
    "text",
    { text },
    text,
  );
}

async function sendInvoicesSummary(
  workspace: { id: number; tenant_id: number; templates: unknown },
  conversation: { id: number; phone: string },
) {
  const templates = parseTemplates(workspace.templates);
  const invoices = await getRecentInvoicesForPhone(workspace.tenant_id, conversation.phone);

  const text =
    invoices.length === 0
      ? templates.no_invoices
      : [
          "Localizei estas notas e valores recentes:",
          ...invoices.map(
            (invoice) =>
              `• NFC-e ${invoice.number}/${invoice.series} • ${invoice.status} • ${formatMoney(invoice.order?.total_amount)} • ${formatDate(invoice.created_at)}`,
          ),
        ].join("\n");

  await sendMessageAndTrack(
    workspace.id,
    conversation.id,
    conversation.phone,
    "text",
    { text },
    text,
  );
}

async function sendPromotionsSummary(
  workspace: { id: number; tenant_id: number; templates: unknown },
  conversation: { id: number; phone: string },
) {
  const templates = parseTemplates(workspace.templates);
  const products = await prisma.product.findMany({
    where: {
      tenant_id: workspace.tenant_id,
      is_active: true,
      OR: [{ discount_price: { not: null } }, { is_featured: true }],
    },
    orderBy: [{ is_featured: "desc" }, { updated_at: "desc" }],
    take: 5,
    select: {
      name: true,
      price: true,
      discount_price: true,
    },
  });

  const text =
    products.length === 0
      ? templates.no_promotions
      : [
          "Estas são as promoções e destaques do momento:",
          ...products.map((product) => {
            const price = formatMoney(product.price);
            const promo = product.discount_price ? formatMoney(product.discount_price) : null;
            return promo
              ? `• ${product.name} • de ${price} por ${promo}`
              : `• ${product.name} • ${price}`;
          }),
        ].join("\n");

  await sendMessageAndTrack(
    workspace.id,
    conversation.id,
    conversation.phone,
    "text",
    { text },
    text,
  );
}

async function normalizeQueuePositions(workspaceId: number, department: string) {
  const queued = await prisma.whatsappConversation.findMany({
    where: {
      workspace_id: workspaceId,
      status: "queued",
      department,
    },
    orderBy: [{ created_at: "asc" }, { id: "asc" }],
  });

  await Promise.all(
    queued.map((conversation, index) =>
      prisma.whatsappConversation.update({
        where: { id: conversation.id },
        data: { queue_position: index + 1 },
      }),
    ),
  );
}

async function queueConversation(workspaceId: number, conversationId: number, department: string) {
  const workspace = await prisma.whatsappWorkspace.findUnique({ where: { id: workspaceId } });
  const conversation = await prisma.whatsappConversation.findUnique({ where: { id: conversationId } });

  if (!workspace || !conversation) return;

  const templates = parseTemplates(workspace.templates);
  const currentQueuedCount = await prisma.whatsappConversation.count({
    where: {
      workspace_id: workspaceId,
      status: "queued",
      department,
      id: { not: conversationId },
    },
  });

  const position = currentQueuedCount + 1;

  await updateConversationState(conversationId, {
    status: "queued",
    department,
    assigned_agent_id: null,
    queue_position: position,
    current_menu: `queue:${department}`,
    metadata: asJson({
      ...parseMetadata(conversation.metadata),
      pending_choices: [],
      agent_list_department: null,
    }),
  });

  const text = renderTemplate(templates.queue_wait, {
    position,
    departmentLabel: getDepartmentLabel(department),
  });

  await sendMessageAndTrack(workspaceId, conversationId, conversation.phone, "text", { text }, text, "system");
  await normalizeQueuePositions(workspaceId, department);
}

async function assignConversationToAgent(
  workspaceId: number,
  conversationId: number,
  agentId: number,
  takeoverMessage?: string,
) {
  const [workspace, conversation, agent] = await Promise.all([
    prisma.whatsappWorkspace.findUnique({ where: { id: workspaceId } }),
    prisma.whatsappConversation.findUnique({ where: { id: conversationId } }),
    prisma.whatsappAgent.findUnique({ where: { id: agentId } }),
  ]);

  if (!workspace || !conversation || !agent) return;

  const templates = parseTemplates(workspace.templates);
  const department = agent.department || conversation.department || "sales";

  await updateConversationState(conversationId, {
    status: "assigned",
    department,
    assigned_agent_id: agent.id,
    queue_position: null,
    current_menu: `agent:${agent.id}`,
    metadata: asJson({
      ...parseMetadata(conversation.metadata),
      pending_choices: [],
      agent_list_department: null,
    }),
  });

  const text =
    takeoverMessage ||
    renderTemplate(templates.transferred, {
      agentName: agent.name,
      departmentLabel: getDepartmentLabel(department),
    });

  await sendMessageAndTrack(workspaceId, conversationId, conversation.phone, "text", { text }, text, "system");
  await normalizeQueuePositions(workspaceId, department);
}

async function chooseBestAvailableAgent(workspaceId: number, department: string) {
  const [agents, loadMap] = await Promise.all([
    prisma.whatsappAgent.findMany({
      where: {
        workspace_id: workspaceId,
        department,
        is_active: true,
        is_online: true,
        can_receive_transfer: true,
      },
      orderBy: [{ priority: "desc" }, { name: "asc" }],
    }),
    getAgentLoadMap(workspaceId),
  ]);

  const candidates = agents
    .map((agent) => ({ agent, load: loadMap.get(agent.id) ?? 0 }))
    .filter(({ agent, load }) => load < agent.max_concurrent_chats)
    .sort((a, b) => {
      if (a.load !== b.load) return a.load - b.load;
      if (a.agent.priority !== b.agent.priority) return b.agent.priority - a.agent.priority;
      return a.agent.name.localeCompare(b.agent.name);
    });

  return candidates[0]?.agent ?? null;
}

async function tryAssignSpecificAgent(
  workspaceId: number,
  conversationId: number,
  agentId: number,
) {
  const [agent, loadMap] = await Promise.all([
    prisma.whatsappAgent.findFirst({
      where: { id: agentId, workspace_id: workspaceId, is_active: true },
    }),
    getAgentLoadMap(workspaceId),
  ]);

  if (!agent) {
    throw new Error("Atendente não encontrado.");
  }

  const load = loadMap.get(agent.id) ?? 0;

  if (agent.is_online && agent.can_receive_transfer && load < agent.max_concurrent_chats) {
    await assignConversationToAgent(workspaceId, conversationId, agent.id);
    return { assigned: true, department: agent.department };
  }

  await queueConversation(workspaceId, conversationId, agent.department);
  return { assigned: false, department: agent.department };
}

async function handleDepartmentRequest(
  workspace: { id: number; settings: unknown; templates: unknown },
  tenantName: string,
  conversation: {
    id: number;
    phone: string;
    customer_name: string | null;
    metadata: unknown;
  },
  department: string,
) {
  const settings = parseSettings(workspace.settings);

  if (settings.show_agent_list_before_transfer) {
    await sendAgentDirectory(workspace, conversation, department);
    return;
  }

  const bestAgent = await chooseBestAvailableAgent(workspace.id, department);

  if (bestAgent) {
    await assignConversationToAgent(workspace.id, conversation.id, bestAgent.id);
    return;
  }

  await queueConversation(workspace.id, conversation.id, department);
  void tenantName;
}

async function handleMenuSelection(
  workspace: { id: number; tenant_id: number; settings: unknown; menus: unknown; templates: unknown },
  tenantName: string,
  conversation: {
    id: number;
    phone: string;
    customer_name: string | null;
    metadata: unknown;
  },
  selection: string,
) {
  const menus = parseMenus(workspace.menus).filter((item) => item.enabled);
  const selectedMenu = menus.find((item) => item.id === selection);

  if (!selectedMenu) {
    const templates = parseTemplates(workspace.templates);
    await sendMessageAndTrack(
      workspace.id,
      conversation.id,
      conversation.phone,
      "text",
      { text: templates.fallback },
      templates.fallback,
    );
    await sendMenuToConversation(workspace, tenantName, conversation);
    return;
  }

  switch (selectedMenu.action) {
    case "orders":
      await sendOrdersSummary(workspace, conversation);
      await sendMenuToConversation(workspace, tenantName, conversation);
      return;
    case "quotes":
      await sendQuotesSummary(workspace, conversation);
      await sendMenuToConversation(workspace, tenantName, conversation);
      return;
    case "invoices":
      await sendInvoicesSummary(workspace, conversation);
      await sendMenuToConversation(workspace, tenantName, conversation);
      return;
    case "promotions":
      await sendPromotionsSummary(workspace, conversation);
      await sendMenuToConversation(workspace, tenantName, conversation);
      return;
    case "department":
      await handleDepartmentRequest(
        workspace,
        tenantName,
        conversation,
        selectedMenu.department || "sales",
      );
      return;
    case "template": {
      const templates = parseTemplates(workspace.templates);
      const key = selectedMenu.template_key as keyof WhatsappTemplates | undefined;
      const text = key ? templates[key] : templates.fallback;
      await sendMessageAndTrack(
        workspace.id,
        conversation.id,
        conversation.phone,
        "text",
        { text },
        text,
      );
      await sendMenuToConversation(workspace, tenantName, conversation);
      return;
    }
    default:
      await sendMenuToConversation(workspace, tenantName, conversation);
  }
}

function resolveChoiceFromMetadata(
  metadata: ConversationMetadata,
  command: string,
) {
  const normalized = command.trim().toLowerCase();
  const pendingChoices = metadata.pending_choices ?? [];

  if (/^\d+$/.test(normalized)) {
    const index = Number(normalized) - 1;
    if (index >= 0 && index < pendingChoices.length) {
      return pendingChoices[index];
    }
  }

  return (
    pendingChoices.find((choice) => choice.key.toLowerCase() === normalized) ||
    pendingChoices.find((choice) => choice.label.trim().toLowerCase() === normalized)
  );
}

function isMenuCommand(command: string) {
  const normalized = command.trim().toLowerCase();
  return normalized === "menu" || normalized === "0" || normalized === "voltar" || normalized === "oi";
}

function isCloseCommand(command: string) {
  const normalized = command.trim().toLowerCase();
  return normalized === "sair" || normalized === "encerrar" || normalized === "fim" || normalized === "9";
}

async function closeConversationInternal(
  workspaceId: number,
  conversationId: number,
  reason: string,
  notifyCustomer: boolean,
) {
  const [workspace, conversation] = await Promise.all([
    prisma.whatsappWorkspace.findUnique({ where: { id: workspaceId } }),
    prisma.whatsappConversation.findUnique({ where: { id: conversationId } }),
  ]);

  if (!workspace || !conversation) return;

  const department = conversation.department || undefined;
  const templates = parseTemplates(workspace.templates);

  await updateConversationState(conversationId, {
    status: "closed",
    closed_reason: reason,
    assigned_agent_id: null,
    queue_position: null,
    current_menu: "closed",
    metadata: asJson({
      ...parseMetadata(conversation.metadata),
      pending_choices: [],
      agent_list_department: null,
    }),
  });

  if (notifyCustomer) {
    const text = templates.closed_inactivity;
    await sendMessageAndTrack(
      workspaceId,
      conversationId,
      conversation.phone,
      "text",
      { text },
      text,
      "system",
    );
  }

  if (department) {
    await normalizeQueuePositions(workspaceId, department);
    await advanceQueueForWorkspace(workspaceId, department);
  }
}

async function advanceQueueForWorkspace(workspaceId: number, department?: string) {
  const departments = department
    ? [department]
    : (
        await prisma.whatsappAgent.findMany({
          where: { workspace_id: workspaceId },
          select: { department: true },
          distinct: ["department"],
        })
      ).map((item) => item.department);

  for (const currentDepartment of departments) {
    let nextConversation = await prisma.whatsappConversation.findFirst({
      where: {
        workspace_id: workspaceId,
        status: "queued",
        department: currentDepartment,
      },
      orderBy: [{ queue_position: "asc" }, { created_at: "asc" }],
    });

    while (nextConversation) {
      const availableAgent = await chooseBestAvailableAgent(workspaceId, currentDepartment);

      if (!availableAgent) break;

      await assignConversationToAgent(workspaceId, nextConversation.id, availableAgent.id);
      await normalizeQueuePositions(workspaceId, currentDepartment);

      nextConversation = await prisma.whatsappConversation.findFirst({
        where: {
          workspace_id: workspaceId,
          status: "queued",
          department: currentDepartment,
        },
        orderBy: [{ queue_position: "asc" }, { created_at: "asc" }],
      });
    }
  }
}

export async function getWhatsappConversationMessages(tenantId: number, conversationId: number) {
  const { conversation } = await findConversationOrThrow(tenantId, conversationId);

  const messages = await prisma.whatsappMessageLog.findMany({
    where: { conversation_id: conversation.id },
    orderBy: { created_at: "asc" },
  });

  return {
    conversation: mapConversationForUi(conversation),
    messages,
  };
}

export async function assignWhatsappConversation(
  tenantId: number,
  conversationId: number,
  agentId: number,
) {
  const { workspace, conversation } = await findConversationOrThrow(tenantId, conversationId);

  await tryAssignSpecificAgent(workspace.id, conversation.id, agentId);

  return getWhatsappConversationMessages(tenantId, conversationId);
}

export async function closeWhatsappConversation(
  tenantId: number,
  conversationId: number,
  reason = "manual",
) {
  const { workspace, conversation } = await findConversationOrThrow(tenantId, conversationId);
  await closeConversationInternal(workspace.id, conversation.id, reason, false);
}

export async function sendWhatsappManualMessage(
  tenantId: number,
  conversationId: number,
  text: string,
  author?: string,
) {
  const trimmed = text.trim();

  if (!trimmed) {
    throw new Error("Mensagem vazia.");
  }

  const { workspace, conversation } = await findConversationOrThrow(tenantId, conversationId);
  const payloadText = author ? `${author}: ${trimmed}` : trimmed;

  await sendMessageAndTrack(
    workspace.id,
    conversation.id,
    conversation.phone,
    "text",
    { text: payloadText },
    payloadText,
    "agent",
  );

  if (conversation.status !== "assigned" && conversation.assigned_agent?.name) {
    const templates = parseTemplates(workspace.templates);
    const message = renderTemplate(templates.manual_takeover, {
      agentName: conversation.assigned_agent.name,
    });
    await logConversationMessage(conversation.id, "system", "text", message);
  }

  return getWhatsappConversationMessages(tenantId, conversationId);
}

export async function pingWhatsappEvolution(tenantId: number) {
  const workspace = await ensureWorkspace(tenantId);
  const config = await getEvolutionConfig(workspace.id);

  const response = await axios.get(config.baseUrl, {
    headers: { apikey: config.apiKey },
    timeout: 10_000,
  });

  return response.data;
}

async function getEvolutionConnectionStatus(workspaceId: number) {
  const config = await getEvolutionConfig(workspaceId);

  const stateResponse = await axios.get(
    `${config.baseUrl}/instance/connectionState/${config.instance}`,
    { headers: { apikey: config.apiKey }, timeout: 10_000 },
  );

  const state: string =
    stateResponse.data?.instance?.state ?? stateResponse.data?.state ?? "close";
  const connected = state === "open";

  if (connected) {
    return { connected: true, state, qrCode: null as string | null, pairingCode: null as string | null };
  }

  const connectResponse = await axios.get(
    `${config.baseUrl}/instance/connect/${config.instance}`,
    { headers: { apikey: config.apiKey }, timeout: 15_000 },
  );

  const qrCode: string | null =
    connectResponse.data?.base64 ?? connectResponse.data?.qrcode?.base64 ?? null;
  const pairingCode: string | null =
    connectResponse.data?.pairingCode ?? connectResponse.data?.qrcode?.pairingCode ?? null;

  return { connected: false, state, qrCode, pairingCode };
}

// O serviço Baileys é stateless do ponto de vista do backend: não fica sabendo de
// tenantSlug/webhookSecret até que o backend os informe. Por isso toda chamada de
// status/conexão já envia esses dois dados junto — o /connect do serviço é
// idempotente (se já existe sessão ativa, apenas atualiza os dados de encaminhamento
// e devolve o status atual).
async function getBaileysConnectionStatus(
  tenantId: number,
  tenantSlug: string,
  webhookSecret: string,
) {
  const data = await sendBaileysRequest(tenantId, `/sessions/${tenantId}/connect`, {
    tenantSlug,
    webhookSecret,
  });

  return {
    connected: Boolean(data.connected),
    state: String(data.state ?? "close"),
    qrCode: (data.qrCode as string | null) ?? null,
    pairingCode: (data.pairingCode as string | null) ?? null,
  };
}

export async function logoutBaileysSession(tenantId: number) {
  await sendBaileysRequest(tenantId, `/sessions/${tenantId}/logout`, {});
}

// Consulta o estado da conexão (Evolution ou Baileys, conforme o provider configurado
// no workspace) e, se ainda não estiver pareada, devolve o QR code de conexão — é a
// etapa que faltava para o usuário de fato vincular o WhatsApp.
export async function getWhatsappConnectionStatus(tenantId: number) {
  const { tenant, workspace } = await getWorkspaceWithTenantByTenantId(tenantId);

  if (workspace.provider === "baileys") {
    return getBaileysConnectionStatus(tenantId, tenant.slug, workspace.webhook_secret ?? "");
  }

  return getEvolutionConnectionStatus(workspace.id);
}

export async function sendWhatsappTestMenu(tenantId: number, phone: string) {
  const normalizedPhone = normalizePhone(phone);

  if (!normalizedPhone) {
    throw new Error("Informe um número válido para teste.");
  }

  const { workspace, tenant } = await getWorkspaceWithTenantByTenantId(tenantId);
  const templates = parseTemplates(workspace.templates);
  const welcome = renderTemplate(templates.welcome, {
    customerName: "cliente teste",
    storeName: tenant.name,
  });
  const menus = parseMenus(workspace.menus).filter((item) => item.enabled);
  const settings = parseSettings(workspace.settings);
  const description = templates.menu_intro;

  await sendTextMessage(workspace.id, normalizedPhone, welcome);

  if (settings.prefer_buttons && menus.length <= 3) {
    await sendButtonsMessage(
      workspace.id,
      normalizedPhone,
      tenant.name,
      description,
      "MENU para voltar • SAIR para encerrar",
      menus.map((item) => ({
        type: "reply",
        displayText: item.label,
        id: item.id,
      })),
    );
    return;
  }

  await sendListMessage(
    workspace.id,
    normalizedPhone,
    tenant.name,
    description,
    "Ver opções",
    "MENU para voltar • SAIR para encerrar",
    [
      {
        title: "Atendimento",
        rows: menus.map((item) => ({
          title: item.label,
          description: item.description,
          rowId: item.id,
        })),
      },
    ],
  );
}

async function createOrUpdateConversationFromWebhook(
  workspaceId: number,
  remoteJid: string,
  phone: string,
  customerName: string | null,
  text: string,
  messageId: string | null,
  payload: unknown,
) {
  const existing = await prisma.whatsappConversation.findUnique({
    where: {
      workspace_id_remote_jid: {
        workspace_id: workspaceId,
        remote_jid: remoteJid,
      },
    },
  });

  const metadata = parseMetadata(existing?.metadata);
  const status: ConversationStatus =
    existing?.status === "closed" ? "bot" : (sanitizeStatus(existing?.status) ?? "bot");

  const conversation = existing
    ? await prisma.whatsappConversation.update({
        where: { id: existing.id },
      data: {
          phone,
          customer_name: customerName ?? existing.customer_name,
          status,
          last_message_preview: text,
          last_inbound_at: new Date(),
          closed_reason: null,
          metadata: asJson(metadata),
        },
      })
    : await prisma.whatsappConversation.create({
        data: {
          workspace_id: workspaceId,
          remote_jid: remoteJid,
          phone,
          customer_name: customerName,
          status: "bot",
          last_message_preview: text,
          last_inbound_at: new Date(),
          metadata: asJson(metadata),
        },
      });

  await logConversationMessage(
    conversation.id,
    "customer",
    "text",
    text,
    payload,
    messageId,
  );

  return conversation;
}

export async function processWhatsappWebhook(
  tenantSlug: string,
  body: Record<string, unknown>,
  headers: Record<string, string | string[] | undefined>,
) {
  const workspaceRecord = await getWorkspaceBySlug(tenantSlug);

  if (!workspaceRecord) {
    return { ok: false, ignored: true, reason: "workspace-not-found" };
  }

  if (workspaceRecord.webhook_secret) {
    const secretHeader = headers["x-whatsapp-secret"];
    const authHeader = headers.authorization;

    const providedSecret =
      (Array.isArray(secretHeader) ? secretHeader[0] : secretHeader) ||
      (typeof authHeader === "string" ? authHeader.replace(/^Bearer\s+/i, "") : "");

    if (providedSecret !== workspaceRecord.webhook_secret) {
      return { ok: false, ignored: true, reason: "invalid-secret" };
    }
  }

  if (!workspaceRecord.is_enabled) {
    return { ok: true, ignored: true, reason: "workspace-disabled" };
  }

  if (String(body.event ?? "") !== "MESSAGES_UPSERT") {
    return { ok: true, ignored: true, reason: "event-not-handled" };
  }

  const data = isRecord(body.data) ? body.data : {};
  const key = isRecord(data.key) ? data.key : {};
  const fromMe = Boolean(key.fromMe ?? false);

  if (fromMe) {
    return { ok: true, ignored: true, reason: "from-me" };
  }

  const remoteJid = String(key.remoteJid ?? body.sender ?? "");

  if (!remoteJid || remoteJid.endsWith("@g.us")) {
    return { ok: true, ignored: true, reason: "unsupported-chat" };
  }

  const phone = normalizePhone(remoteJid);
  const customerName = typeof data.pushName === "string" ? data.pushName : null;
  const messageId = typeof key.id === "string" ? key.id : null;
  const incoming = extractIncomingMessageContent(data);

  if (!incoming.text && !incoming.command) {
    return { ok: true, ignored: true, reason: "empty-message" };
  }

  const conversation = await createOrUpdateConversationFromWebhook(
    workspaceRecord.id,
    normalizeJid(remoteJid),
    phone,
    customerName,
    incoming.text || incoming.command,
    messageId,
    body,
  );

  const tenantName = workspaceRecord.tenant.name;
  const metadata = parseMetadata(conversation.metadata);
  const normalizedCommand = (incoming.command || incoming.text).trim();

  if (isCloseCommand(normalizedCommand)) {
    await closeConversationInternal(workspaceRecord.id, conversation.id, "customer-request", false);
    return { ok: true, handled: true, action: "closed" };
  }

  if (isMenuCommand(normalizedCommand) || !conversation.last_outbound_at) {
    const templates = parseTemplates(workspaceRecord.templates);
    const welcome = renderTemplate(templates.welcome, {
      customerName: conversation.customer_name || "cliente",
      storeName: tenantName,
    });

    await sendMessageAndTrack(
      workspaceRecord.id,
      conversation.id,
      conversation.phone,
      "text",
      { text: welcome },
      welcome,
    );
    await sendMenuToConversation(workspaceRecord, tenantName, conversation);
    return { ok: true, handled: true, action: "menu" };
  }

  if (conversation.status === "assigned") {
    return { ok: true, handled: true, action: "assigned-log-only" };
  }

  const resolvedChoice = resolveChoiceFromMetadata(metadata, normalizedCommand);
  const selection = resolvedChoice?.key || normalizedCommand;

  if (selection === "menu:back") {
    await sendMenuToConversation(workspaceRecord, tenantName, conversation);
    return { ok: true, handled: true, action: "menu-back" };
  }

  if (selection.startsWith("agent:")) {
    const agentId = Number(selection.replace("agent:", ""));
    await tryAssignSpecificAgent(workspaceRecord.id, conversation.id, agentId);
    return { ok: true, handled: true, action: "agent-selection" };
  }

  await handleMenuSelection(workspaceRecord, tenantName, conversation, selection);
  return { ok: true, handled: true, action: "menu-selection" };
}

export async function runWhatsappMaintenance() {
  let workspaces;

  try {
    workspaces = await prisma.whatsappWorkspace.findMany({
      where: { is_enabled: true },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2021"
    ) {
      return;
    }
    throw error;
  }

  for (const workspace of workspaces) {
    const settings = parseSettings(workspace.settings);

    if (!settings.auto_close_on_inactivity || settings.inactivity_timeout_minutes <= 0) {
      continue;
    }

    const limit = new Date(Date.now() - settings.inactivity_timeout_minutes * 60_000);

    const staleConversations = await prisma.whatsappConversation.findMany({
      where: {
        workspace_id: workspace.id,
        status: { in: OPEN_STATUSES },
        OR: [
          { last_inbound_at: { lt: limit } },
          { last_inbound_at: null, updated_at: { lt: limit } },
        ],
      },
      select: { id: true },
    });

    for (const conversation of staleConversations) {
      await closeConversationInternal(workspace.id, conversation.id, "inactivity-timeout", true);
    }
  }
}

export function startWhatsappMaintenanceLoop() {
  if (maintenanceStarted) return;
  maintenanceStarted = true;

  const timer = setInterval(() => {
    runWhatsappMaintenance().catch((error) => {
      console.error("WhatsApp maintenance failed:", error);
    });
  }, MAINTENANCE_INTERVAL_MS);

  timer.unref?.();
}
