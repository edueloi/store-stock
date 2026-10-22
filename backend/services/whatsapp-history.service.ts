import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";
import { attendanceSubject, historyDateBoundary } from "../../shared/whatsappHistory";

const DEPARTMENTS: Record<string, string> = { sales: "Vendas", support: "Atendimento", finance: "Financeiro" };
const messageSelect = { id: true, direction: true, body: true, message_type: true, created_at: true } as const;

/** O bloqueio da linha e o arquivo são atômicos: dois encerramentos não geram dois registros. */
export async function archiveWhatsappAttendance(workspaceId: number, conversationId: number, reason: string) {
  return prisma.$transaction(async tx => {
    const changed = await tx.whatsappConversation.updateMany({
      where: { id: conversationId, workspace_id: workspaceId, status: { in: ["bot", "queued", "assigned"] } },
      data: { status: "closed", closed_reason: reason, current_menu: "closed" },
    });
    if (!changed.count) return null;
    const conversation = await tx.whatsappConversation.findUniqueOrThrow({
      where: { id: conversationId }, include: { assigned_agent: { select: { id: true, name: true } } },
    });
    const previous = await tx.whatsappAttendance.findFirst({ where: { conversation_id: conversationId }, orderBy: { id: "desc" }, select: { end_message_id: true } });
    const messagesWhere: Prisma.WhatsappMessageLogWhereInput = {
      conversation_id: conversationId,
      ...(previous?.end_message_id ? { id: { gt: previous.end_message_id } } : {}),
      ...(conversation.attendance_started_at ? { created_at: { gte: conversation.attendance_started_at } } : {}),
    };
    const [range, requests, sector] = await Promise.all([
      tx.whatsappMessageLog.aggregate({ where: messagesWhere, _min: { id: true, created_at: true }, _max: { id: true }, _count: { id: true } }),
      tx.whatsappMessageLog.findMany({ where: { ...messagesWhere, direction: "customer" }, select: { body: true }, orderBy: { id: "asc" }, take: 30 }),
      conversation.department ? tx.whatsappSector.findFirst({ where: { workspace_id: workspaceId, key: conversation.department }, select: { name: true } }) : Promise.resolve(null),
    ]);
    const closedAt = new Date();
    const archive = await tx.whatsappAttendance.create({ data: {
      workspace_id: workspaceId, conversation_id: conversationId,
      phone: conversation.phone, customer_name: conversation.customer_name,
      department: conversation.department, department_label: sector?.name ?? (conversation.department ? DEPARTMENTS[conversation.department] ?? conversation.department : null),
      agent_id: conversation.assigned_agent?.id ?? null, agent_name: conversation.assigned_agent?.name ?? null,
      subject: attendanceSubject(requests), started_at: range._min.created_at ?? conversation.attendance_started_at ?? conversation.created_at,
      closed_at: closedAt, close_reason: reason,
      start_message_id: range._min.id, end_message_id: range._max.id, message_count: range._count.id,
      legacy_import: !conversation.attendance_started_at,
    } });
    const metadata = conversation.metadata && typeof conversation.metadata === "object" && !Array.isArray(conversation.metadata) ? conversation.metadata as Record<string, unknown> : {};
    await tx.whatsappConversation.update({ where: { id: conversationId }, data: {
      assigned_agent_id: null, queue_position: null,
      metadata: { ...metadata, pending_choices: [], agent_list_department: null, handoff: null } as Prisma.InputJsonValue,
    } });
    return { conversation, archive };
  });
}

function text(value: unknown, limit = 160) { return typeof value === "string" ? value.trim().slice(0, limit) : ""; }
function positiveInt(value: unknown, fallback: number, max = Number.MAX_SAFE_INTEGER) {
  if (value === undefined || value === "") return fallback;
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 1) throw new Error("Informe uma página ou identificador válido.");
  return Math.min(n, max);
}

export function historyWhere(workspaceId: number, query: Record<string, unknown>): Prisma.WhatsappAttendanceWhereInput {
  const q = text(query.q), digits = q.replace(/\D/g, "");
  const from = historyDateBoundary(query.from), to = historyDateBoundary(query.to, true);
  if (from && to && from >= to) throw new Error("A data inicial deve ser anterior ou igual à data final.");
  const reason = text(query.reason);
  if (reason && !["team", "customer", "inactivity"].includes(reason)) throw new Error("Selecione um motivo de encerramento válido.");
  return {
    workspace_id: workspaceId,
    ...(q ? { OR: [{ customer_name: { contains: q } }, { phone: { contains: digits.length >= 3 ? digits : q } }] } : {}),
    ...(text(query.subject) ? { subject: { contains: text(query.subject) } } : {}),
    ...(text(query.department) ? { department: text(query.department) } : {}),
    ...(query.agent === "bot" ? { agent_id: null, legacy_import: false } : query.agent === "unknown" ? { agent_id: null, legacy_import: true } : query.agent ? { agent_id: positiveInt(query.agent, 0) } : {}),
    ...(from || to ? { closed_at: { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) } } : {}),
    ...(reason ? { close_reason: { in: reason === "team" ? ["manual", "closed-from-attendance"] : reason === "customer" ? ["customer-request"] : ["inactivity-timeout"] } } : {}),
  };
}

export async function listWhatsappHistory(tenantId: number, query: Record<string, unknown>) {
  const workspace = await prisma.whatsappWorkspace.findUnique({ where: { tenant_id: tenantId }, select: { id: true } });
  const page = positiveInt(query.page, 1), pageSize = 20;
  if (!workspace) return { records: [], page: 1, page_size: pageSize, pages: 1, total: 0, clients: 0, messages: 0, sectors: [], agents: [] };
  const where = historyWhere(workspace.id, query);
  const [totals, clients, sectors, agents] = await Promise.all([
    prisma.whatsappAttendance.aggregate({ where, _count: { id: true }, _sum: { message_count: true } }),
    prisma.whatsappAttendance.groupBy({ by: ["phone"], where }),
    prisma.whatsappAttendance.groupBy({ by: ["department", "department_label"], where: { workspace_id: workspace.id, department: { not: null } } }),
    prisma.whatsappAttendance.groupBy({ by: ["agent_id", "agent_name"], where: { workspace_id: workspace.id, agent_id: { not: null } } }),
  ]);
  const total = totals._count.id, pages = Math.max(1, Math.ceil(total / pageSize)), currentPage = Math.min(page, pages);
  const records = await prisma.whatsappAttendance.findMany({ where, orderBy: [{ closed_at: "desc" }, { id: "desc" }], skip: (currentPage - 1) * pageSize, take: pageSize });
  return {
    records, page: currentPage, page_size: pageSize, pages, total, clients: clients.length, messages: totals._sum.message_count ?? 0,
    sectors: [...new Map(sectors.map(s => [s.department, { key: s.department!, name: s.department_label || DEPARTMENTS[s.department!] || s.department! }])).values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    agents: [...new Map(agents.map(a => [a.agent_id, { id: a.agent_id!, name: a.agent_name || "Atendente não registrado" }])).values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
  };
}

export async function getWhatsappHistoryDetail(tenantId: number, attendanceId: number, afterValue?: unknown) {
  const id = positiveInt(attendanceId, 0), after = afterValue === undefined ? 0 : positiveInt(afterValue, 0);
  const workspace = await prisma.whatsappWorkspace.findUnique({ where: { tenant_id: tenantId }, select: { id: true } });
  const record = workspace ? await prisma.whatsappAttendance.findFirst({ where: { id, workspace_id: workspace.id } }) : null;
  if (!record) throw new Error("Atendimento não encontrado.");
  const messages = record.start_message_id && record.end_message_id ? await prisma.whatsappMessageLog.findMany({
    where: { conversation_id: record.conversation_id, id: { gte: record.start_message_id, lte: record.end_message_id, gt: after } },
    select: messageSelect, orderBy: { id: "asc" }, take: 101,
  }) : [];
  const hasMore = messages.length > 100;
  return { record, messages: messages.slice(0, 100), next_cursor: hasMore ? messages[99].id : null };
}
