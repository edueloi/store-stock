import axios from "axios";
import { env } from "../config/env";
import { WHATSAPP_AUDIO_MAX_BYTES, WHATSAPP_AUDIO_MAX_SECONDS, WHATSAPP_AUDIO_MAX_TRANSCRIPT, unwrapWhatsappMessage, whatsappAudioMime } from "../../shared/whatsappAudio";

export type AudioTranscription = { text: string; status: "transcribed" | "unavailable" | "unintelligible" | "too_large" | "too_long" | "invalid_audio"; duration?: number };

/** Transcrição local no servidor, sem fallback para API paga. */
export async function transcribeWhatsappAudio(input: Record<string, unknown>, post: typeof axios.post = axios.post): Promise<AudioTranscription> {
  if (input.error) {
    return { text: "", status: input.error === "too_large" ? "too_large" : input.error === "too_long" ? "too_long" : "unavailable" };
  }
  const mime = whatsappAudioMime(input.mimeType);
  const base64 = typeof input.base64 === "string" ? input.base64 : "";
  if (Number(input.seconds) > WHATSAPP_AUDIO_MAX_SECONDS) return { text: "", status: "too_long" };
  if (base64.length > Math.ceil(WHATSAPP_AUDIO_MAX_BYTES / 3) * 4) return { text: "", status: "too_large" };
  if (!mime || !base64 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64) || base64.length % 4 !== 0) return { text: "", status: "invalid_audio" };
  const audio = Buffer.from(base64, "base64");
  if (audio.length > WHATSAPP_AUDIO_MAX_BYTES) return { text: "", status: "too_large" };
  try {
    const response = await post(`${env.whatsappTranscriptionUrl.replace(/\/$/, "")}/transcribe`, audio, {
      headers: { "Content-Type": mime, "x-internal-token": env.baileysInternalToken },
      timeout: 120_000, maxBodyLength: WHATSAPP_AUDIO_MAX_BYTES,
    });
    const text = typeof response.data?.text === "string" ? response.data.text.trim() : "";
    if (!text || /^\[?(?:inaudível|sem fala|ininteligível)\]?\.?$/i.test(text)) return { text: "", status: "unintelligible" };
    if (text.length > WHATSAPP_AUDIO_MAX_TRANSCRIPT) return { text: "", status: "too_long" };
    return { text, status: "transcribed", duration: Number(response.data.duration) || undefined };
  } catch (error) {
    const code = axios.isAxiosError(error) ? error.response?.data?.error : "";
    return { text: "", status: code === "no_speech" ? "unintelligible" : code === "too_long" ? "too_long" : code === "too_large" ? "too_large" : code === "invalid_audio" ? "invalid_audio" : "unavailable" };
  }
}

export function audioRetryMessage(status: AudioTranscription["status"]): string {
  if (status === "too_long" || status === "too_large") return "Recebi seu áudio, mas ele é muito longo ou grande. Pode enviar em partes de até 5 minutos e 10 MB, ou escrever sua dúvida?";
  if (status === "unintelligible") return "Não consegui entender a fala nesse áudio. Pode gravar novamente, um pouco mais perto do microfone, ou escrever o que você precisa?";
  return "Recebi seu áudio, mas não consegui ouvir agora. Pode enviar novamente ou escrever sua dúvida para eu te ajudar?";
}

export async function prepareWhatsappIncomingAudio(data: Record<string, unknown>, transcribe = transcribeWhatsappAudio) {
  const message = unwrapWhatsappMessage(data.message);
  const raw = message.audioMessage && typeof message.audioMessage === "object" ? message.audioMessage as Record<string, unknown> : null;
  const attachment = data.audio && typeof data.audio === "object" ? data.audio as Record<string, unknown> : raw ? { mimeType: raw.mimetype, seconds: raw.seconds, ptt: raw.ptt, error: "download_failed" } : null;
  if (!attachment) return null;
  const result = await transcribe(attachment);
  const declaredSeconds = Number(attachment.seconds);
  // O histórico conserva a transcrição, sem bytes, chaves de mídia ou URL privada do WhatsApp.
  const metadata = {
    mimeType: whatsappAudioMime(attachment.mimeType) || "application/octet-stream",
    seconds: result.duration || (Number.isFinite(declaredSeconds) && declaredSeconds > 0 ? declaredSeconds : null),
    ptt: Boolean(attachment.ptt), transcription_status: result.status, engine: "local",
  };
  return { ...result, logPayload: { ...(data.key ? { key: data.key } : {}), ...(typeof data.pushName === "string" ? { pushName: data.pushName } : {}), audio: metadata } };
}
