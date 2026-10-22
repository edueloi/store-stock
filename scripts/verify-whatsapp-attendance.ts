import { test } from "node:test";
import assert from "node:assert/strict";
import { BUSINESS_DAYS, agentAttendanceHours, describeBusinessHours, validateAgentBusinessHours } from "../shared/businessHours";

const weekly = (open: string, close: string) => Object.fromEntries(BUSINESS_DAYS.map(day => [day, day === "dom" ? { closed: true } : { open, close }]));
const at = (time: string) => new Date(`2026-10-22T${time}:00-03:00`); // Quinta-feira, Brasília.

test("expediente encerra exatamente às 17h; loja e atendente têm horários separados", () => {
  const store = weekly("08:00", "18:00"), agent = { business_hours: weekly("09:00", "17:00") };
  assert.equal(agentAttendanceHours(agent, store, at("16:59")).openNow, true);
  assert.equal(agentAttendanceHours(agent, store, at("17:00")).openNow, false);
  assert.equal(describeBusinessHours(store, at("17:30")).openNow, true);
  assert.equal(agentAttendanceHours({ business_hours: null }, store, at("17:30")).openNow, true);
  assert.match(agentAttendanceHours(agent, store, at("17:30")).nextOpening!, /amanhã, às 09:00/);
});

test("horário ausente ou malformado nunca vira fechado ou um expediente inventado", () => {
  assert.equal(describeBusinessHours(null).openNow, null);
  assert.equal(describeBusinessHours({ qui: { open: "25:00", close: "17:00" } }, at("12:00")).openNow, null);
  assert.equal(describeBusinessHours({ seg: { closed: true } }, at("12:00")).openNow, null);
  assert.equal(agentAttendanceHours({}, null).text, "não cadastrado");
  assert.throws(() => validateAgentBusinessHours({}), /expediente de Segunda/);
  assert.throws(() => validateAgentBusinessHours(weekly("25:00", "17:00")), /HH:mm/);
  assert.throws(() => validateAgentBusinessHours(weekly("09:00", "09:00")), /HH:mm/);
  assert.equal(validateAgentBusinessHours(null), null);
});

test("fins de semana e turnos que atravessam meia-noite respeitam o dia de origem", () => {
  assert.equal(describeBusinessHours(weekly("09:00", "17:00"), new Date("2026-10-25T12:00:00-03:00")).openNow, false);
  const night = { sex: { open: "22:00", close: "02:00" }, sab: { closed: true } };
  assert.equal(describeBusinessHours(night, new Date("2026-10-23T23:00:00-03:00")).openNow, true);
  assert.equal(describeBusinessHours(night, new Date("2026-10-24T01:59:00-03:00")).openNow, true);
  assert.equal(describeBusinessHours(night, new Date("2026-10-24T02:00:00-03:00")).openNow, false);
});

process.env.DATABASE_URL = "mysql://test:test@127.0.0.1:1/whatsapp_attendance_test";
const { prisma } = await import("../backend/config/prisma");
const { default: axios } = await import("axios");
const { processWhatsappWebhook } = await import("../backend/services/whatsapp.service");
const { buildStoreContext, buildCatalogContext } = await import("../backend/services/whatsapp-ai-context.service");
const { env } = await import("../backend/config/env");

test("transferência e aceite respeitam o expediente, sem fila ou aviso fora do horário", async t => {
  t.mock.timers.enable({ apis: ["Date"], now: at("17:00") });
  const replace = (target: any, key: string, fn: (...args: any[]) => any) => {
    const original = target[key]; target[key] = fn; t.after(() => { target[key] = original; });
  };
  const tenant = { id: 99999, name: "Loja Ação", slug: "loja-acao", business_hours: weekly("08:00", "18:00"), about_text: "Acessórios e tecnologia para o dia a dia.", instagram_url: "https://instagram.com/loja-acao", facebook_url: "https://facebook.com/loja-acao", address_street: "Rua da Conexão", address_number: "123", address_complement: "Sala 2", address_city: "São Paulo", address_state: "SP", address_zip: "01001000" };
  const workspace = { id: 901, tenant_id: tenant.id, tenant, provider: "baileys", is_enabled: true, webhook_secret: "teste", settings: { smart_bot_enabled: true, ai_provider: "gemini", ai_api_key: "chave-falsa" }, templates: {}, menus: [] };
  const agent = { id: 11, workspace_id: workspace.id, name: "Edu", department: "sales", phone: "5511999999901", is_active: true, is_online: true, can_receive_transfer: true, business_hours: weekly("09:00", "17:00"), priority: 0, max_concurrent_chats: 3 };
  const agents = [agent];
  const conversation: any = { id: 44, workspace_id: workspace.id, phone: "5515999999999", customer_name: "Karen", status: "bot", metadata: {}, last_outbound_at: new Date() };
  const sent: any[] = [], logs: any[] = [];
  let counts = 0, aiCalls = 0;
  replace(prisma.whatsappWorkspace, "findFirst", async () => workspace);
  replace(prisma.whatsappWorkspace, "findUnique", async () => workspace);
  replace(prisma.whatsappConversation, "findUnique", async () => ({ ...conversation }));
  replace(prisma.whatsappConversation, "update", async ({ data }: any) => Object.assign(conversation, data));
  replace(prisma.whatsappConversation, "count", async () => { counts++; return 0; });
  replace(prisma.whatsappConversation, "findMany", async ({ where }: any) => where.status === conversation.status ? [{ ...conversation }] : []);
  replace(prisma.whatsappAgent, "findUnique", async () => agent);
  replace(prisma.whatsappAgent, "findMany", async ({ where }: any) => {
    assert.equal(where.workspace_id, workspace.id);
    return agents.filter(a => (!where.department || a.department === where.department) && (!where.id || a.id === where.id));
  });
  replace(prisma.whatsappMessageLog, "findFirst", async () => null);
  replace(prisma.whatsappMessageLog, "findMany", async () => []);
  replace(prisma.whatsappMessageLog, "create", async ({ data }: any) => { logs.push(data); return data; });
  replace(prisma.customer, "findMany", async () => []);
  replace(prisma.tenant, "findUnique", async () => tenant);
  replace(prisma.category, "findMany", async () => [{ id: 1, name: "Eletrônicos" }]);
  replace(prisma.service, "findMany", async () => []);
  replace(prisma.product, "findMany", async () => []);
  replace(prisma.whatsappSector, "findMany", async () => [{ key: "sales", name: "Vendas" }]);
  replace(prisma.whatsappSector, "findFirst", async () => ({ name: "Vendas" }));
  replace(axios, "post", async (url: string, body: any) => {
    if (url.startsWith("https://generativelanguage.googleapis.com/")) {
      aiCalls++;
      const prompt = body.systemInstruction.parts[0].text;
      for (const value of [tenant.instagram_url, tenant.facebook_url, "Sala 2", "Acessórios e tecnologia", "09:00 às 17:00", "NUNCA conclua 'não vendemos'"]) assert.ok(prompt.includes(value), value);
      return { data: { candidates: [{ content: { parts: [{ text: "[[TRANSFERIR:sales]]" }] } }] } };
    }
    assert.equal(url, `${env.baileysServiceUrl}/sessions/${tenant.id}/send`);
    sent.push(body); return { data: { key: { id: "teste" } } };
  });
  let id = 0;
  const message = (text: string, phone = "5515999999999") => processWhatsappWebhook(tenant.slug, { event: "MESSAGES_UPSERT", data: { key: { id: `teste-${++id}`, remoteJid: `${phone}@s.whatsapp.net`, fromMe: false }, pushName: "Karen", resolvedPhone: phone, message: { conversation: text } } }, { "x-whatsapp-secret": "teste" });
  await message("Quero falar com vendedor");
  assert.equal(conversation.status, "bot"); assert.equal(counts, 0);
  assert.equal(sent.length, 1); assert.match(sent[0].payload.text, /fora do expediente/); assert.match(sent[0].payload.text, /09:00 às 17:00/);
  assert.doesNotMatch(sent[0].payload.text, /posição|entrou na fila/);
  // Até um comando indevido da IA passa pelo mesmo bloqueio.
  await message("Preciso negociar essa compra");
  assert.equal(aiCalls, 1); assert.equal(conversation.status, "bot"); assert.equal(counts, 0);
  // Perguntar horário de vendedor vai para a IA, sem acionar a regra de transferência.
  await message("Qual o horário do vendedor e o Instagram?");
  assert.equal(aiCalls, 2); assert.equal(conversation.status, "bot");
  sent.length = 0;
  t.mock.timers.setTime(at("16:59").getTime());
  await message("Quero falar com vendedor");
  assert.equal(conversation.status, "queued");
  assert.deepEqual(conversation.metadata.handoff.candidate_agent_ids, [agent.id]);
  assert.equal(sent.length, 2); // fila para cliente + aviso para o atendente
  // O aceite chega depois de encerrar o expediente: não pode atribuir.
  t.mock.timers.setTime(at("17:00").getTime());
  await message("1", agent.phone);
  assert.equal(conversation.status, "bot"); assert.equal(conversation.assigned_agent_id, null);
  assert.equal(conversation.metadata.handoff, null);
  assert.match(sent.at(-1).payload.text, /não foi atribuído/);
  // Um segundo turno aberto no mesmo setor pode receber, sem avisar quem já saiu.
  const late = { ...agent, id: 12, name: "Ana", phone: "5511999999902", business_hours: weekly("13:00", "21:00") };
  agents.push(late); sent.length = 0;
  await message("Quero falar com vendedor");
  assert.deepEqual(conversation.metadata.handoff.candidate_agent_ids, [late.id]);
  assert.equal(sent.length, 2); assert.ok(sent.at(-1).number.endsWith("999999902"));
  late.is_online = false; conversation.status = "bot"; sent.length = 0;
  await message("Quero falar com vendedor");
  assert.equal(conversation.status, "bot"); assert.equal(sent.length, 1); assert.match(sent[0].payload.text, /não há atendentes disponíveis/);
  const store = await buildStoreContext(tenant.id);
  assert.match(store, /Conexão/); assert.match(store, /01001000/);
  assert.match(await buildCatalogContext(tenant.id, "Tem mouse?", []), /NÃO confirma que a loja não vende/);
});
