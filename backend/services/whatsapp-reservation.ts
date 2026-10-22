export const WHATSAPP_RESERVATION_VALIDITY_MS = 24 * 60 * 60 * 1_000;

/** Somente reservas novas do WhatsApp têm expiração automática; comandas comuns não mudam. */
export function whatsappReservationExpiry(snapshot: unknown): Date | null {
  if (!snapshot || typeof snapshot !== "object") return null;
  const reservation = (snapshot as { whatsappReservation?: { expiresAt?: unknown } }).whatsappReservation;
  if (typeof reservation?.expiresAt !== "string") return null;
  const date = new Date(reservation.expiresAt);
  return Number.isFinite(date.getTime()) ? date : null;
}
