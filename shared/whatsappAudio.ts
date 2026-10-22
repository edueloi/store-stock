export const WHATSAPP_AUDIO_MAX_BYTES = 10 * 1024 * 1024;
export const WHATSAPP_AUDIO_MAX_SECONDS = 300;
export const WHATSAPP_AUDIO_MAX_TRANSCRIPT = 12_000;

export type WhatsappAudioError = "download_failed" | "too_large" | "too_long" | "unsupported_type";
export type WhatsappAudio = {
  mimeType: string;
  seconds: number | null;
  ptt: boolean;
  base64?: string;
  error?: WhatsappAudioError;
};

export function whatsappAudioMime(raw: unknown): string | null {
  const mime = String(raw || "audio/ogg").split(";")[0].trim().toLowerCase();
  const aliases: Record<string, string> = { "application/ogg": "audio/ogg", "audio/opus": "audio/ogg", "audio/mp3": "audio/mpeg", "audio/x-wav": "audio/wav", "audio/x-m4a": "audio/mp4", "audio/m4a": "audio/mp4", "audio/x-flac": "audio/flac" };
  const normalized = aliases[mime] || mime;
  return ["audio/ogg", "audio/mpeg", "audio/mp4", "audio/wav", "audio/webm", "audio/flac", "audio/aac", "audio/aiff"].includes(normalized) ? normalized : null;
}

export function unwrapWhatsappMessage(input: unknown): Record<string, unknown> {
  let message = input && typeof input === "object" ? input as Record<string, unknown> : {};
  for (let depth = 0; depth < 6; depth++) {
    const wrapper = ["ephemeralMessage", "viewOnceMessage", "viewOnceMessageV2", "viewOnceMessageV2Extension", "documentWithCaptionMessage"].map(key => message[key]).find(value => value && typeof value === "object");
    if (!wrapper || typeof wrapper !== "object" || !("message" in wrapper)) break;
    const inner = wrapper.message;
    if (!inner || typeof inner !== "object") break;
    message = inner as Record<string, unknown>;
  }
  return message;
}
