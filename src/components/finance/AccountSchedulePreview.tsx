export function previewSchedule(amount: string, due: string, count: number, unit: "day" | "week" | "month", every: number, amounts?: string[]) {
  if (!due || !Number.isFinite(Number(amount)) || Number(amount) <= 0 || !Number.isInteger(count) || count < 1 || count > 360 || !Number.isInteger(every) || every < 1) return [];
  const first = new Date(due.slice(0, 10) + "T12:00:00");
  if (Number.isNaN(first.getTime())) return [];
  const total = Math.round(Number(amount) * 100), base = Math.floor(total / count);
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(first);
    if (unit === "month") { date.setDate(1); date.setMonth(date.getMonth() + index * every); date.setDate(Math.min(first.getDate(), new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate())); }
    else date.setDate(date.getDate() + index * every * (unit === "week" ? 7 : 1));
    return { number: index + 1, date: date.toLocaleDateString("pt-BR"), amount: amounts ? Number(amounts[index] || 0) : (index === count - 1 ? total - base * (count - 1) : base) / 100 };
  });
}
export default function AccountSchedulePreview({ amount, due, count, unit, every, amounts, recurring = false }: { amount: string; due: string; count: number; unit: "day" | "week" | "month"; every: number; amounts?: string[]; recurring?: boolean }) {
  const rows = previewSchedule(recurring ? String(Number(amount) * 3) : amount, due, recurring ? 3 : count, unit, every, recurring ? [amount, amount, amount] : amounts);
  return <section className="overflow-hidden rounded-lg border border-slate-200" aria-label="Prévia dos vencimentos"><header className="flex items-center justify-between gap-3 bg-slate-50 px-3 py-2.5"><h3 className="text-xs font-semibold text-slate-700">{recurring ? "Próximas ocorrências (estimativa)" : "Prévia das parcelas"}</h3><span className="text-[11px] text-slate-500">{recurring ? "3 próximas" : `${count || 0} parcelas`}</span></header>{rows.length ? <div className="max-h-56 overflow-y-auto divide-y divide-slate-100">{rows.map(row => <div key={row.number} className="grid grid-cols-[40px_1fr_auto] gap-3 px-3 py-2 text-xs"><span className="text-slate-400">{row.number}ª</span><span className="text-slate-600">{row.date}</span><strong className="font-medium tabular-nums text-slate-800">{row.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</strong></div>)}</div> : <p className="p-3 text-xs text-slate-500">Informe valor, vencimento e intervalo válidos para visualizar.</p>}</section>;
}
