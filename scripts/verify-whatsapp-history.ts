import { test } from "node:test";
import assert from "node:assert/strict";
import { attendanceSubject, historyDateBoundary, historyCloseReason } from "../shared/whatsappHistory";

process.env.DATABASE_URL = "mysql://test:test@127.0.0.1:1/whatsapp_history_test";
const { prisma } = await import("../backend/config/prisma");
const { archiveWhatsappAttendance, getWhatsappHistoryDetail, listWhatsappHistory, historyWhere } = await import("../backend/services/whatsapp-history.service");
const replace = (t: any, target: any, key: string, fn: (...args: any[]) => any) => {
  const original = target[key]; target[key] = fn; t.after(() => { target[key] = original; });
};

test("datas incluem o dia final inteiro em Brasília; filtros combinam cliente, assunto e responsável", () => {
  assert.equal(historyDateBoundary("2026-10-22")!.toISOString(), "2026-10-22T03:00:00.000Z");
  assert.equal(historyDateBoundary("2026-10-22", true)!.toISOString(), "2026-10-23T03:00:00.000Z");
  assert.throws(() => historyDateBoundary("2026-02-30"), /data válida/);
  assert.throws(() => historyDateBoundary(["2026-10-22"]), /data válida/);
  const where: any = historyWhere(41, { q: "(15) 99999-9999", subject: "entrega", from: "2026-10-22", to: "2026-10-22", agent: "5", department: "sales", reason: "team" });
  assert.equal(where.workspace_id, 41); assert.equal(where.agent_id, 5); assert.equal(where.department, "sales");
  assert.equal(where.OR[1].phone.contains, "15999999999"); assert.equal(where.subject.contains, "entrega");
  assert.deepEqual(where.close_reason.in, ["manual", "closed-from-attendance"]);
  assert.throws(() => historyWhere(41, { from: "2026-10-23", to: "2026-10-22" }), /data inicial/);
  assert.throws(() => historyWhere(41, { agent: "-3" }), /identificador/);
  assert.throws(() => historyWhere(41, { reason: "qualquer" }), /motivo/);
  assert.equal(historyWhere(41, { agent: "bot" }).legacy_import, false);
  assert.equal(historyWhere(41, { agent: "unknown" }).legacy_import, true);
});

test("assunto vem da solicitação do cliente, sem usar saudações ou textos de encerramento", () => {
  assert.equal(attendanceSubject([{ body: "Boa tarde!" }, { body: "Oi 😊" }, { body: "Quero saber o prazo de entrega da bolsa Ação." }]), "Quero saber o prazo de entrega da bolsa Ação.");
  assert.equal(attendanceSubject([{ body: "MENU" }, { body: "bom dia" }, { body: null }]), null);
  assert.equal(attendanceSubject([{ body: "A".repeat(179) + "👜" }]), "A".repeat(179) + "👜");
  assert.equal(historyCloseReason("inactivity-timeout"), "Sem interação");
  assert.equal(historyCloseReason("closed-from-attendance"), "Encerrado pela equipe");
  assert.equal(historyCloseReason("codigo-interno-antigo"), "Encerrado");
});

test("encerrar duas vezes não duplica; novo contato do mesmo cliente preserva episódios, assuntos e atendentes", async t => {
  const start = new Date("2026-10-22T09:00:00-03:00");
  let conversation: any = { id: 88, workspace_id: 41, status: "assigned", phone: "5515999999999", customer_name: "Karen Ação", department: "sales", assigned_agent: { id: 5, name: "Edu" }, assigned_agent_id: 5, attendance_started_at: start, created_at: start, metadata: { handoff: { candidate_agent_ids: [5] } } };
  let archives: any[] = [];
  const logs = [
    { id: 1, created_at: start, direction: "customer", body: "Bom dia!" },
    { id: 2, created_at: new Date(start.getTime() + 1000), direction: "customer", body: "Preciso de uma bolsa preta para amanhã." },
    { id: 3, created_at: new Date(start.getTime() + 2000), direction: "agent", body: "Vou verificar." },
  ];
  let fail = false;
  const match = (where: any) => logs.filter(m => (!where.id?.gt || m.id > where.id.gt) && (!where.created_at?.gte || m.created_at >= where.created_at.gte) && (!where.direction || where.direction === m.direction));
  const tx: any = {
    whatsappConversation: {
      updateMany: async ({ where, data }: any) => { if (where.workspace_id !== conversation.workspace_id || conversation.status === "closed") return { count: 0 }; Object.assign(conversation, data); return { count: 1 }; },
      findUniqueOrThrow: async () => structuredClone(conversation),
      update: async ({ data }: any) => Object.assign(conversation, data),
    },
    whatsappAttendance: {
      findFirst: async () => archives.at(-1) ?? null,
      create: async ({ data }: any) => { if (fail) throw new Error("falha de gravação"); const row = { id: archives.length + 1, ...data }; archives.push(row); return row; },
    },
    whatsappMessageLog: {
      aggregate: async ({ where }: any) => { const rows = match(where); return { _min: { id: rows[0]?.id ?? null, created_at: rows[0]?.created_at ?? null }, _max: { id: rows.at(-1)?.id ?? null }, _count: { id: rows.length } }; },
      findMany: async ({ where }: any) => match(where),
    },
    whatsappSector: { findFirst: async () => ({ name: "Vendas" }) },
  };
  replace(t, prisma, "$transaction", async (fn: any) => {
    const saved = structuredClone({ conversation, archives });
    try { return await fn(tx); } catch (error) { conversation = saved.conversation; archives = saved.archives; throw error; }
  });
  const first = await archiveWhatsappAttendance(41, 88, "manual");
  assert.equal(first!.archive.subject, "Preciso de uma bolsa preta para amanhã.");
  assert.equal(archives[0].agent_name, "Edu"); assert.equal(archives[0].department_label, "Vendas");
  assert.equal(archives[0].message_count, 3); assert.equal(archives[0].start_message_id, 1); assert.equal(archives[0].end_message_id, 3);
  assert.equal(conversation.assigned_agent_id, null); assert.equal(conversation.metadata.handoff, null);
  assert.equal(await archiveWhatsappAttendance(41, 88, "manual"), null); assert.equal(archives.length, 1);
  const later = new Date(start.getTime() + 3600000);
  logs.push({ id: 4, created_at: new Date(start.getTime() + 3000), direction: "system", body: "Atendimento encerrado." });
  logs.push({ id: 5, created_at: later, direction: "customer", body: "Agora preciso da segunda via da nota fiscal." });
  Object.assign(conversation, { status: "assigned", attendance_started_at: later, assigned_agent: { id: 6, name: "Ana" }, assigned_agent_id: 6, department: "finance" });
  const second = await archiveWhatsappAttendance(41, 88, "customer-request");
  assert.equal(second!.archive.subject, "Agora preciso da segunda via da nota fiscal."); assert.equal(archives[1].agent_name, "Ana");
  assert.equal(archives[1].start_message_id, 5); assert.equal(archives[1].end_message_id, 5); assert.equal(archives[1].message_count, 1);
  assert.equal(archives[0].agent_name, "Edu"); assert.equal(archives[0].subject, first!.archive.subject);
  Object.assign(conversation, { status: "bot", attendance_started_at: later }); fail = true;
  await assert.rejects(archiveWhatsappAttendance(41, 88, "manual"), /falha de gravação/);
  assert.equal(conversation.status, "bot"); assert.equal(archives.length, 2);
  assert.equal(await archiveWhatsappAttendance(99, 88, "manual"), null);
});

test("detalhe isola a loja e o intervalo de mensagens, com paginação e sem expor payload de mídia", async t => {
  replace(t, prisma.whatsappWorkspace, "findUnique", async () => ({ id: 41 }));
  const record = { id: 1, workspace_id: 41, conversation_id: 88, start_message_id: 10, end_message_id: 250 };
  replace(t, prisma.whatsappAttendance, "findFirst", async ({ where }: any) => where.id === 1 && where.workspace_id === 41 ? record : null);
  replace(t, prisma.whatsappMessageLog, "findMany", async ({ where, select, take }: any) => {
    assert.equal(where.conversation_id, 88); assert.equal(where.id.gte, 10); assert.equal(where.id.lte, 250);
    assert.equal(select.payload, undefined); assert.equal(take, 101);
    return Array.from({ length: Math.min(101, 250 - Math.max(9, where.id.gt)) }, (_, i) => ({ id: Math.max(10, where.id.gt + 1) + i, body: "Mensagem Ação", direction: "customer" }));
  });
  const first = await getWhatsappHistoryDetail(6, 1);
  assert.equal(first.messages.length, 100); assert.equal(first.messages[0].id, 10); assert.equal(first.next_cursor, 109);
  const next = await getWhatsappHistoryDetail(6, 1, "109"); assert.equal(next.messages[0].id, 110);
  await assert.rejects(getWhatsappHistoryDetail(6, 2), /não encontrado/);
  replace(t, prisma.whatsappWorkspace, "findUnique", async () => ({ id: 99 }));
  await assert.rejects(getWhatsappHistoryDetail(999, 1), /não encontrado/);
});

test("lista não usa o limite de 100 conversas do painel e pagina os resultados filtrados no servidor", async t => {
  replace(t, prisma.whatsappWorkspace, "findUnique", async () => ({ id: 41 }));
  replace(t, prisma.whatsappAttendance, "aggregate", async ({ where }: any) => {
    assert.equal(where.workspace_id, 41); assert.equal(where.subject.contains, "entrega");
    return { _count: { id: 147 }, _sum: { message_count: 750 } };
  });
  replace(t, prisma.whatsappAttendance, "groupBy", async ({ by, where }: any) => {
    assert.equal(where.workspace_id, 41);
    return by[0] === "phone" ? [{ phone: "1" }, { phone: "2" }] : by[0] === "agent_id" ? [{ agent_id: 5, agent_name: "Edu" }] : [{ department: "sales", department_label: "Vendas" }];
  });
  replace(t, prisma.whatsappAttendance, "findMany", async ({ skip, take, where }: any) => {
    assert.equal(skip, 140); assert.equal(take, 20); assert.equal(where.subject.contains, "entrega"); return [{ id: 1 }];
  });
  const result = await listWhatsappHistory(6, { page: "999", subject: "entrega" });
  assert.equal(result.total, 147); assert.equal(result.pages, 8); assert.equal(result.page, 8); assert.equal(result.clients, 2); assert.equal(result.messages, 750);
});
