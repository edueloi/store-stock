export const HISTORY_CLOSE_REASONS = { team: "Encerrado pela equipe", customer: "Encerrado pelo cliente", inactivity: "Sem interação" };
export function historyCloseReason(reason: string) {
  if (reason === "inactivity-timeout") return HISTORY_CLOSE_REASONS.inactivity;
  if (reason === "customer-request") return HISTORY_CLOSE_REASONS.customer;
  if (["manual", "closed-from-attendance"].includes(reason)) return HISTORY_CLOSE_REASONS.team;
  return "Encerrado";
}

/** Usa a solicitação registrada do cliente como assunto, sem gerar fatos por IA. */
export function attendanceSubject(messages: Array<{ body: string | null }>) {
  for (const message of messages) {
    const body = (message.body ?? "").trim().replace(/\s+/g, " ");
    const normalized = body.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[!?.😊👋]/gu, "").trim();
    if (body.length < 6 || /^(oi|ola|bom dia|boa tarde|boa noite|tudo bem|obrigad[oa]|menu|sair|encerrar|fim|sim|nao|ok)$/.test(normalized)) continue;
    return body.slice(0, 180);
  }
  return null;
}

export function historyDateBoundary(value: unknown, end = false): Date | undefined {
  if (value === undefined || value === "") return undefined;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Informe uma data válida (AAAA-MM-DD).");
  const date = new Date(`${value}T00:00:00-03:00`);
  if (!Number.isFinite(date.getTime()) || date.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }) !== value) throw new Error("Informe uma data válida.");
  return end ? new Date(date.getTime() + 86_400_000) : date;
}
