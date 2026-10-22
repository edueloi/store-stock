type PresenceSocket = { sendPresenceUpdate: (type: "composing" | "paused", jid: string) => Promise<void> };

/** Falhas no indicador de digitação nunca devem impedir a entrega da mensagem. */
export async function sendWithTyping<T>(
  socket: PresenceSocket,
  jid: string,
  delay: unknown,
  send: () => Promise<T>,
  wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
): Promise<T> {
  const ms = Math.min(2_000, Math.max(0, Number(delay) || 0));
  if (!ms) return send();
  try {
    await socket.sendPresenceUpdate("composing", jid).catch(() => undefined);
    await wait(ms);
    return await send();
  } finally {
    await socket.sendPresenceUpdate("paused", jid).catch(() => undefined);
  }
}
