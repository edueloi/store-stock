export const BUSINESS_DAYS = ["seg", "ter", "qua", "qui", "sex", "sab", "dom"] as const;
export type BusinessDay = typeof BUSINESS_DAYS[number];
export const BUSINESS_DAY_LABELS: Record<BusinessDay, string> = {
  seg: "Segunda", ter: "Terça", qua: "Quarta", qui: "Quinta", sex: "Sexta", sab: "Sábado", dom: "Domingo",
};
export type BusinessHours = Partial<Record<BusinessDay, { open?: string; close?: string; closed?: boolean }>>;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);

/** Horários de atendentes são completos; null significa usar o horário da loja. */
export function validateAgentBusinessHours(value: unknown): BusinessHours | null {
  if (value == null) return null;
  if (!record(value)) throw new Error("Informe os horários de atendimento por dia da semana.");
  const result: BusinessHours = {};
  for (const day of BUSINESS_DAYS) {
    const entry = value[day];
    if (!record(entry)) throw new Error(`Informe o expediente de ${BUSINESS_DAY_LABELS[day]}.`);
    if (entry.closed === true) { result[day] = { closed: true }; continue; }
    if (typeof entry.open !== "string" || typeof entry.close !== "string" || !TIME.test(entry.open) || !TIME.test(entry.close) || entry.open === entry.close) {
      throw new Error(`Informe a entrada e a saída de ${BUSINESS_DAY_LABELS[day]} (HH:mm).`);
    }
    result[day] = { open: entry.open, close: entry.close, closed: false };
  }
  return result;
}

export function describeBusinessHours(value: unknown, now = new Date()) {
  const map: BusinessHours = {};
  if (record(value)) for (const day of BUSINESS_DAYS) {
    const entry = value[day];
    if (!record(entry)) continue;
    if (entry.closed === true) map[day] = { closed: true };
    else if (typeof entry.open === "string" && typeof entry.close === "string" && TIME.test(entry.open) && TIME.test(entry.close) && entry.open !== entry.close) {
      map[day] = { open: entry.open, close: entry.close };
    }
  }
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Sao_Paulo", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(now);
  const day = ({ Mon: "seg", Tue: "ter", Wed: "qua", Thu: "qui", Fri: "sex", Sat: "sab", Sun: "dom" } as const)[parts.find(p => p.type === "weekday")!.value];
  const dayIndex = BUSINESS_DAYS.indexOf(day);
  const nowMinutes = Number(parts.find(p => p.type === "hour")!.value) * 60 + Number(parts.find(p => p.type === "minute")!.value);
  const today = map[day];
  const previous = map[BUSINESS_DAYS[(dayIndex + 6) % 7]];
  const dayText = (key: BusinessDay) => {
    const entry = map[key];
    if (!entry) return "não cadastrado";
    if (entry.closed) return "sem expediente";
    return `${entry.open} às ${entry.close}${minutes(entry.close!) < minutes(entry.open!) ? " do dia seguinte" : ""}`;
  };
  let openNow: boolean | null = today ? false : null;
  if (today && !today.closed) {
    const start = minutes(today.open!), end = minutes(today.close!);
    openNow = end > start ? nowMinutes >= start && nowMinutes < end : nowMinutes >= start;
  }
  // Um turno que atravessa a meia-noite pertence ao dia em que começou.
  if (previous && !previous.closed && minutes(previous.close!) < minutes(previous.open!) && nowMinutes < minutes(previous.close!)) openNow = true;
  let nextOpening: string | null = null;
  if (openNow !== true) for (let offset = 0; offset <= 7; offset++) {
    const key = BUSINESS_DAYS[(dayIndex + offset) % 7], entry = map[key];
    if (entry && !entry.closed && (offset > 0 || minutes(entry.open!) > nowMinutes)) {
      nextOpening = `${offset === 0 ? "hoje" : offset === 1 ? "amanhã" : BUSINESS_DAY_LABELS[key]}, às ${entry.open}`;
      break;
    }
  }
  return {
    text: BUSINESS_DAYS.some(key => map[key]) ? BUSINESS_DAYS.map(key => `${BUSINESS_DAY_LABELS[key]}: ${dayText(key)}`).join("; ") : "não cadastrado",
    today: today ? `${BUSINESS_DAY_LABELS[day]}: ${dayText(day)}` : null,
    openNow, nextOpening,
  };
}

export function agentAttendanceHours(agent: { business_hours?: unknown }, storeHours: unknown, now = new Date()) {
  return describeBusinessHours(agent.business_hours ?? storeHours, now);
}
