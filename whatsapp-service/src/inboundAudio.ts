import type { Readable } from "node:stream";
import { WHATSAPP_AUDIO_MAX_BYTES, WHATSAPP_AUDIO_MAX_SECONDS, unwrapWhatsappMessage, whatsappAudioMime, type WhatsappAudio } from "../../shared/whatsappAudio";

type Download = () => Promise<Readable>;

/** O download em stream permite interromper um arquivo grande, mesmo com metadados incorretos. */
export async function prepareInboundAudio(message: unknown, download: Download): Promise<WhatsappAudio | null> {
  const content = unwrapWhatsappMessage(message);
  const audio = content.audioMessage;
  if (!audio || typeof audio !== "object") return null;
  const metadata = audio as Record<string, unknown>;
  const mimeType = whatsappAudioMime(metadata.mimetype);
  const duration = Number(metadata.seconds);
  const result: WhatsappAudio = { mimeType: mimeType || "application/octet-stream", seconds: Number.isFinite(duration) && duration > 0 ? duration : null, ptt: Boolean(metadata.ptt) };
  if (!mimeType) return { ...result, error: "unsupported_type" };
  if ((result.seconds || 0) > WHATSAPP_AUDIO_MAX_SECONDS) return { ...result, error: "too_long" };
  const declaredSize = Number(String(metadata.fileLength ?? 0));
  if (declaredSize > WHATSAPP_AUDIO_MAX_BYTES) return { ...result, error: "too_large" };
  let stream: Readable | null = null;
  try {
    stream = await download();
    let bytes = 0;
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      const buffer = Buffer.from(chunk);
      bytes += buffer.length;
      if (bytes > WHATSAPP_AUDIO_MAX_BYTES) { stream.destroy(); return { ...result, error: "too_large" }; }
      chunks.push(buffer);
    }
    if (!bytes) return { ...result, error: "download_failed" };
    return { ...result, base64: Buffer.concat(chunks).toString("base64") };
  } catch { stream?.destroy(); return { ...result, error: "download_failed" }; }
}
