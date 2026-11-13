// Filtro de período das listas (Orçamentos, Ordens de Serviço): datas "AAAA-MM-DD" no horário local do navegador.

export type ListPeriod = "today" | "7d" | "month" | "all" | "custom";

export const PERIOD_OPTIONS: { value: ListPeriod; label: string }[] = [
  { value: "today", label: "Hoje" },
  { value: "7d", label: "7 dias" },
  { value: "month", label: "Mês" },
  { value: "all", label: "Tudo" },
];

const pad2 = (n: number) => String(n).padStart(2, "0");

export const toYmd = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
export const todayYmd = () => toYmd(new Date());

export function presetRange(period: ListPeriod): { from: string | null; to: string | null } {
  const now = new Date();
  if (period === "today") return { from: toYmd(now), to: toYmd(now) };
  if (period === "7d") { const s = new Date(now); s.setDate(s.getDate() - 6); return { from: toYmd(s), to: toYmd(now) }; }
  if (period === "month") return { from: toYmd(new Date(now.getFullYear(), now.getMonth(), 1)), to: toYmd(now) };
  return { from: null, to: null };
}

/** A data (ISO do servidor) cai dentro do período? Sem limite em um dos lados = aberto desse lado. */
export function inPeriod(iso: string, from: string | null, to: string | null): boolean {
  if (!from && !to) return true;
  const d = toYmd(new Date(iso));
  return (!from || d >= from) && (!to || d <= to);
}
