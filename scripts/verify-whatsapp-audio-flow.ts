import { test } from "node:test";
import assert from "node:assert/strict";

// Mesmo que um mock falhe, este teste não pode acessar banco ou clientes reais.
process.env.DATABASE_URL = "mysql://test:test@127.0.0.1:1/whatsapp_audio_test";
const { prisma } = await import("../backend/config/prisma");
const { default: axios } = await import("axios");
const { processWhatsappWebhook } = await import("../backend/services/whatsapp.service");
const { env } = await import("../backend/config/env");

test("áudio chega ao catálogo e à IA com contexto; duplicatas e atendimento humano não duplicam respostas", async t => {
  // Os delegates do Prisma são proxies e não expõem descritores de métodos ao node:test.
  const replace = (target: any, key: string, implementation: (...args: any[]) => any) => {
    const original = target[key]; target[key] = implementation;
    t.after(() => { target[key] = original; });
  };
  const logs: any[] = [], sent: string[] = [];
  const tenant = { id: 99999, name: "Loja Teste", slug: "loja-teste", subdomain: "loja-teste", whatsapp: "5515999999999" };
  const workspace = { id: 901, tenant_id: tenant.id, tenant, provider: "baileys", is_enabled: true, webhook_secret: "teste-interno", settings: { smart_bot_enabled: true, ai_provider: "gemini", ai_api_key: "chave-falsa-de-teste" }, templates: {}, menus: [] };
  const conversation: any = { id: 44, phone: "5515999999999", customer_name: "Karen", status: "bot", metadata: {}, last_outbound_at: new Date() };
  let spoken = "Bom dia! Vocês têm bolsa preta?", unavailable = false, transcriptions = 0, aiCalls = 0;
  replace(prisma.whatsappWorkspace, "findFirst", async () => workspace);
  replace(prisma.whatsappWorkspace, "findUnique", async () => workspace);
  replace(prisma.whatsappConversation, "findUnique", async () => ({ ...conversation }));
  replace(prisma.whatsappConversation, "update", async ({ data }: any) => Object.assign(conversation, data));
  replace(prisma.whatsappMessageLog, "findFirst", async ({ where }: any) => logs.find(r => r.external_message_id === where.external_message_id) || null);
  replace(prisma.whatsappMessageLog, "findMany", async () => logs.slice().reverse());
  replace(prisma.whatsappMessageLog, "create", async ({ data }: any) => { const row = { id: logs.length + 1, ...data }; logs.push(row); return row; });
  replace(prisma.customer, "findMany", async () => []);
  replace(prisma.tenant, "findUnique", async () => tenant);
  replace(prisma.category, "findMany", async () => []);
  replace(prisma.service, "findMany", async () => []);
  replace(prisma.whatsappSector, "findMany", async () => []);
  replace(prisma.product, "findMany", async () => [{ id: 3, name: "Bolsa Luna", price: 189.9, stock_quantity: 4, skus: [{ combo: { Cor: "Preto" }, stock: 4 }], variations: [], attributes: [], is_active: true }]);
  replace(axios, "post", async (url: string, body: any) => {
    if (url === `${env.whatsappTranscriptionUrl}/transcribe`) {
      transcriptions++;
      if (unavailable) throw new Error("Serviço local temporariamente indisponível");
      return { data: { text: spoken, duration: 8 } };
    }
    if (url.startsWith("https://generativelanguage.googleapis.com/")) {
      aiCalls++;
      assert.ok(body.contents.at(-1).parts[0].text.includes(spoken));
      assert.match(body.systemInstruction.parts[0].text, /Bolsa Luna/);
      assert.match(body.systemInstruction.parts[0].text, /Preto/);
      return { data: { candidates: [{ content: { parts: [{ text: "Temos a *Bolsa Luna* na cor preta por *R$ 189,90*. Quantas unidades você precisa?" }] } }] } };
    }
    if (url === `${env.baileysServiceUrl}/sessions/${tenant.id}/send`) {
      sent.push(body.payload.text);
      return { data: { key: { id: "saida-mock" } } };
    }
    throw new Error(`Rede não autorizada no teste: ${url}`);
  });
  const request = (id: string) => ({ event: "MESSAGES_UPSERT", data: { key: { id, remoteJid: "5515999999999@s.whatsapp.net", fromMe: false }, pushName: "Karen", resolvedPhone: "5515999999999", message: { audioMessage: { mimetype: "audio/ogg", url: "https://midia-privada.invalid", mediaKey: "segredo-da-midia" } }, audio: { mimeType: "audio/ogg", seconds: 8, ptt: true, base64: "T2dnUw==" } } });
  const headers = { "x-whatsapp-secret": "teste-interno" };
  const reply = await processWhatsappWebhook(tenant.slug, request("audio-1"), headers);
  assert.equal(reply.action, "ze-ai-reply");
  assert.equal(logs[0].message_type, "audio");
  assert.equal(logs[0].body, spoken);
  assert.doesNotMatch(JSON.stringify(logs[0].payload), /base64|mediaKey|midia-privada|T2dnUw==/);
  assert.equal(sent.length, 1);
  assert.match(sent[0], /Bolsa Luna/);
  assert.equal((await processWhatsappWebhook(tenant.slug, request("audio-1"), headers)).reason, "duplicate-message");
  assert.equal(transcriptions, 1); assert.equal(aiCalls, 1); assert.equal(sent.length, 1);
  conversation.status = "assigned";
  spoken = "Quero duas unidades.";
  assert.equal((await processWhatsappWebhook(tenant.slug, request("audio-2"), headers)).action, "assigned-log-only");
  assert.equal(logs.at(-1).body, spoken);
  assert.equal(aiCalls, 1); assert.equal(sent.length, 1);
  conversation.status = "bot"; unavailable = true;
  assert.equal((await processWhatsappWebhook(tenant.slug, request("audio-3"), headers)).action, "audio-transcription-unavailable");
  assert.match(sent.at(-1)!, /enviar novamente ou escrever/);
  assert.equal(aiCalls, 1);
  const before = transcriptions;
  assert.equal((await processWhatsappWebhook(tenant.slug, request("audio-4"), { "x-whatsapp-secret": "invalido" })).reason, "invalid-secret");
  assert.equal(transcriptions, before);
});
