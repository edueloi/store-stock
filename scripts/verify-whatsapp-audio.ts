import { test } from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { prepareInboundAudio } from "../whatsapp-service/src/inboundAudio";
import { audioRetryMessage, prepareWhatsappIncomingAudio, transcribeWhatsappAudio } from "../backend/services/whatsapp-audio.service";
import { WHATSAPP_AUDIO_MAX_BYTES, whatsappAudioMime } from "../shared/whatsappAudio";
import { KeyedTaskQueue } from "../shared/keyedTaskQueue";

const voice = { audioMessage: { mimetype: "audio/ogg; codecs=opus", seconds: 9, ptt: true, fileLength: 4 } };
const bytes = Buffer.from("OggS");

test("baixa voz normal, temporária e de visualização única com MIME do WhatsApp", async () => {
  for (const message of [voice, { ephemeralMessage: { message: voice } }, { viewOnceMessageV2: { message: voice } }]) {
    const audio = await prepareInboundAudio(message, async () => Readable.from([bytes]));
    assert.equal(audio?.base64, bytes.toString("base64"));
    assert.equal(audio?.mimeType, "audio/ogg");
    assert.equal(audio?.ptt, true);
  }
  assert.equal(await prepareInboundAudio({ conversation: "Olá" }, async () => { throw new Error("não deve baixar"); }), null);
  assert.equal(whatsappAudioMime("audio/x-wav"), "audio/wav");
});

test("limita tamanho anunciado, tamanho real e duração antes de chamar a IA", async () => {
  let downloads = 0;
  const download = async () => { downloads++; return Readable.from([bytes]); };
  assert.equal((await prepareInboundAudio({ audioMessage: { ...voice.audioMessage, seconds: 301 } }, download))?.error, "too_long");
  assert.equal((await prepareInboundAudio({ audioMessage: { ...voice.audioMessage, fileLength: WHATSAPP_AUDIO_MAX_BYTES + 1 } }, download))?.error, "too_large");
  assert.equal(downloads, 0);
  const stream = Readable.from([Buffer.alloc(WHATSAPP_AUDIO_MAX_BYTES), Buffer.from("extra")]);
  assert.equal((await prepareInboundAudio(voice, async () => stream))?.error, "too_large");
  assert.ok(stream.destroyed);
  assert.equal((await prepareInboundAudio(voice, async () => { throw new Error("download falhou"); }))?.error, "download_failed");
});

test("usa somente o serviço local com os bytes e conserva o pedido falado", async () => {
  const audio = await prepareInboundAudio(voice, async () => Readable.from([bytes]));
  let calls = 0;
  const result = await transcribeWhatsappAudio(audio!, (async (url: string, body: Buffer, config: any) => {
    calls++;
    assert.match(url, /^http:\/\/127\.0\.0\.1:3032\/transcribe$/);
    assert.deepEqual(body, bytes);
    assert.equal(config.headers["Content-Type"], "audio/ogg");
    return { data: { text: "Bom dia! Vocês têm bolsa na cor preta?", duration: 9 } };
  }) as any);
  assert.equal(calls, 1);
  assert.equal(result.status, "transcribed");
  assert.equal(result.text, "Bom dia! Vocês têm bolsa na cor preta?");
});

test("indisponibilidade não usa API paga e áudio vazio não inventa pedido", async () => {
  let calls = 0;
  const fail = async () => { calls++; throw new Error("offline"); };
  const input = { mimeType: "audio/ogg", seconds: 1, base64: bytes.toString("base64") };
  assert.equal((await transcribeWhatsappAudio(input, fail as any)).status, "unavailable");
  assert.equal(calls, 1);
  assert.equal((await transcribeWhatsappAudio(input, (async () => ({ data: { text: "" } })) as any)).status, "unintelligible");
  assert.equal((await transcribeWhatsappAudio({ ...input, base64: "%%%%" }, fail as any)).status, "invalid_audio");
  assert.equal(calls, 1);
  assert.match(audioRetryMessage("unintelligible"), /gravar novamente/);
});

test("transcrição vira texto da conversa; bytes e URL privada não entram no histórico", async () => {
  const result = await prepareWhatsappIncomingAudio({ key: { id: "mensagem-1" }, pushName: "Karen Ação", message: voice, audio: { mimeType: "audio/ogg", ptt: true, seconds: 9, base64: bytes.toString("base64"), url: "https://privado.example/audio" } }, async () => ({ status: "transcribed", text: "Quero a bolsa preta.", duration: 8.5 }));
  assert.equal(result?.text, "Quero a bolsa preta.");
  assert.equal(result?.logPayload.audio.transcription_status, "transcribed");
  assert.doesNotMatch(JSON.stringify(result?.logPayload), /base64|T2dnUw==|privado\.example/);
  assert.equal(await prepareWhatsappIncomingAudio({ message: { conversation: "Olá" } }), null);
});

test("fila mantém áudio antes da próxima mensagem e libera outros clientes", async () => {
  const queue = new KeyedTaskQueue();
  const events: string[] = [];
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const first = queue.run("loja:cliente", async () => { events.push("áudio começou"); await gate; events.push("áudio pronto"); });
  const second = queue.run("loja:cliente", async () => { events.push("texto depois do áudio"); });
  await queue.run("loja:outro-cliente", async () => { events.push("outro cliente livre"); });
  assert.deepEqual(events, ["áudio começou", "outro cliente livre"]);
  release(); await Promise.all([first, second]);
  assert.deepEqual(events, ["áudio começou", "outro cliente livre", "áudio pronto", "texto depois do áudio"]);
  await assert.rejects(queue.run("falha", async () => { throw new Error("falhou"); }));
  assert.equal(await queue.run("falha", async () => "recuperou"), "recuperou");
});
