import { test } from "node:test";
import assert from "node:assert/strict";
import { botTypingDelayMs, normalizeWhatsappAiText, parseWhatsappAiReply } from "../backend/services/whatsapp-ai-reply";
import { sendWithTyping } from "../whatsapp-service/src/typing";

test("corrige o negrito malformado do caso real e preserva acentos", () => {
  assert.equal(normalizeWhatsappAiText("**Bolsa Shoulder Luna* — R$ **189,90* (Cores: Preto, Caramelo e Bege disponíveis)"), "*Bolsa Shoulder Luna* — R$ *189,90* (Cores: Preto, Caramelo e Bege disponíveis)");
  assert.equal(normalizeWhatsappAiText("*** Ação e conexão ***\n* R$ 189,90 *"), "*Ação e conexão*\n*R$ 189,90*");
  assert.equal(normalizeWhatsappAiText("*Bolsa*\n*R$ 189,90*"), "*Bolsa*\n*R$ 189,90*");
});

test("URLs continuam intactas; lista e link Markdown ficam legíveis", () => {
  assert.equal(normalizeWhatsappAiText("- *Bolsa*\n\n[Catálogo](https://loja.example/catalogo?q=bolsa*&cat=72)"), "• *Bolsa*\n\nhttps://loja.example/catalogo?q=bolsa*&cat=72");
});

test("oferecer equipe não transfere nem expõe o comando do caso real", () => {
  const result = parseWhatsappAiReply("Não encontrei mouse no nosso catálogo.\n\nSe quiser, posso chamar nossa equipe para te ajudar. [[TRANSFERIR:sales]]");
  assert.equal(result.transferDepartment, null);
  assert.doesNotMatch(result.text, /TRANSFERIR|\[\[/);
  assert.match(result.text, /Se quiser, posso chamar/);
});

test("transferência explícita aceita comando isolado ou junto de texto", () => {
  assert.equal(parseWhatsappAiReply("[[TRANSFERIR:sales]]").transferDepartment, "sales");
  const result = parseWhatsappAiReply("Vou chamar a equipe para continuar. [[ TRANSFERIR : SUPPORT ]]");
  assert.equal(result.transferDepartment, "support");
  assert.equal(result.text, "Vou chamar a equipe para continuar.");
});

test("comando de reserva misturado ou truncado nunca vaza nem é executado", () => {
  const command = '[[SEGURAR:{"items":[{"id":123,"qty":1}]}]]';
  assert.ok(parseWhatsappAiReply(command).holdJson);
  assert.equal(parseWhatsappAiReply(`Veja: ${command}`).holdJson, null);
  assert.equal(parseWhatsappAiReply(`Veja: ${command}`).text, "Veja:");
  assert.equal(parseWhatsappAiReply('Olá [[SEGURAR:{"items":').text, "Olá");
});

test("digitação tem pausa breve, envia e encerra presença mesmo com erro", async () => {
  const events: unknown[] = [];
  const socket = { sendPresenceUpdate: async (state: string, jid: string) => { events.push([state, jid]); } };
  const wait = async (ms: number) => { events.push(ms); };
  const result = await sendWithTyping(socket, "cliente", botTypingDelayMs("Olá"), async () => { events.push("enviou"); return "ok"; }, wait);
  assert.equal(result, "ok");
  assert.deepEqual(events, [["composing", "cliente"], 1012, "enviou", ["paused", "cliente"]]);
  events.length = 0;
  await assert.rejects(sendWithTyping(socket, "cliente", 90_000, async () => { throw new Error("falha no envio"); }, wait));
  assert.deepEqual(events, [["composing", "cliente"], 2000, ["paused", "cliente"]]);
  assert.equal(botTypingDelayMs("a".repeat(10_000)), 2000);
});

test("falha de presença não bloqueia envio e envio manual não ganha atraso", async () => {
  const socket = { sendPresenceUpdate: async () => { throw new Error("indisponível"); } };
  let waits = 0;
  assert.equal(await sendWithTyping(socket, "cliente", 1200, async () => "enviado", async () => { waits++; }), "enviado");
  assert.equal(waits, 1);
  assert.equal(await sendWithTyping(socket, "cliente", undefined, async () => "manual", async () => { waits++; }), "manual");
  assert.equal(waits, 1);
});
