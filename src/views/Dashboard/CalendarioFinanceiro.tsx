import { useState, useEffect, useMemo } from "react";
import PageHeader from "../../components/layout/PageHeader";
import {
  ChevronLeft, ChevronRight, ArrowDownCircle, ArrowUpCircle, Loader2, X, Layers, Repeat,
} from "lucide-react";
import { AccountPayable, AccountReceivable } from "../../types";
import { cn } from "../../lib/utils";
import { onRealtime } from "../../lib/realtime";

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function dateKey(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

// Grade de 6 semanas fixas — dias do mês anterior/seguinte entram esmaecidos só pra
// completar a grade, sem contar em nenhum total.
function buildMonthGrid(year: number, month: number) {
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();
  const prevMonth = month === 0 ? 11 : month - 1;
  const prevYear = month === 0 ? year - 1 : year;
  const nextMonth = month === 11 ? 0 : month + 1;
  const nextYear = month === 11 ? year + 1 : year;

  const cells: { day: number; year: number; month: number; inMonth: boolean }[] = [];

  for (let i = 0; i < firstWeekday; i++) {
    cells.push({ day: daysInPrevMonth - firstWeekday + 1 + i, year: prevYear, month: prevMonth, inMonth: false });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ day, year, month, inMonth: true });
  }
  // Sempre completa 6 semanas (42 células) — grade de altura fixa em qualquer mês.
  let trailingDay = 1;
  while (cells.length < 42) {
    cells.push({ day: trailingDay++, year: nextYear, month: nextMonth, inMonth: false });
  }
  return cells;
}

interface DayEntry {
  kind: "payable" | "receivable";
  id: number;
  description: string;
  amount: number;
  status: string;
  party?: string;
  isRecurring?: boolean;
  seriesLabel?: string;
}

export default function CalendarioFinanceiro() {
  const [payables, setPayables] = useState<AccountPayable[]>([]);
  const [receivables, setReceivables] = useState<AccountReceivable[]>([]);
  const [loading, setLoading] = useState(true);
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [entryFilter, setEntryFilter] = useState<"all" | "settled" | "pending" | "overdue">("all");

  const token = () => localStorage.getItem("token");

  function matchesEntryFilter(status: string) {
    if (entryFilter === "all") return true;
    if (entryFilter === "settled") return status === "paid" || status === "received";
    if (entryFilter === "pending") return status === "pending";
    return status === "overdue";
  }

  const fetchData = async () => {
    setLoading(true);
    try {
      const [pRes, rRes] = await Promise.all([
        fetch("/api/accounts-payable", { headers: { Authorization: `Bearer ${token()}` } }),
        fetch("/api/accounts-receivable", { headers: { Authorization: `Bearer ${token()}` } }),
      ]);
      const [pData, rData] = await Promise.all([pRes.json(), rRes.json()]);
      setPayables(Array.isArray(pData) ? pData : []);
      setReceivables(Array.isArray(rData) ? rData : []);
    } catch { /* noop */ }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);
  useEffect(() => onRealtime("finance:changed", () => { fetchData(); }), []);

  // Agrupa os dois tipos de lançamento por data (YYYY-MM-DD) — um dia pode ter tanto
  // contas a pagar quanto a receber juntas, é exatamente a visão unificada pedida.
  const byDay = useMemo(() => {
    const map = new Map<string, DayEntry[]>();
    const push = (key: string, entry: DayEntry) => {
      const arr = map.get(key) ?? [];
      arr.push(entry);
      map.set(key, arr);
    };
    // "overdue" nunca é um status real do backend — é derivado aqui, do mesmo jeito que
    // ContasPagar/ContasReceber fazem, pra poder filtrar/exibir "vencido" no calendário.
    const effectiveStatus = (key: string, status: string) =>
      status === "pending" && key < dateKey(now.getFullYear(), now.getMonth(), now.getDate()) ? "overdue" : status;

    for (const p of payables) {
      const key = p.due_date.substring(0, 10);
      push(key, {
        kind: "payable", id: p.id, description: p.description, amount: Number(p.amount), status: effectiveStatus(key, p.status),
        party: p.supplier_name, isRecurring: p.is_recurring,
        seriesLabel: p.series ? `${p.installment_number}/${p.series.installments_count}` : undefined,
      });
    }
    for (const r of receivables) {
      const key = r.due_date.substring(0, 10);
      push(key, {
        kind: "receivable", id: r.id, description: r.description, amount: Number(r.amount), status: effectiveStatus(key, r.status),
        party: r.customer_name, isRecurring: r.is_recurring,
        seriesLabel: r.series ? `${r.installment_number}/${r.series.installments_count}` : undefined,
      });
    }
    return map;
  }, [payables, receivables]);

  const grid = useMemo(() => buildMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);

  const monthTotals = useMemo(() => {
    let pagar = 0, receber = 0;
    for (const cell of grid) {
      if (!cell.inMonth) continue;
      const entries = byDay.get(dateKey(cell.year, cell.month, cell.day)) ?? [];
      for (const e of entries) {
        if (e.status === "cancelled" || !matchesEntryFilter(e.status)) continue;
        if (e.kind === "payable") pagar += e.amount;
        if (e.kind === "receivable") receber += e.amount;
      }
    }
    return { pagar, receber, saldo: receber - pagar };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grid, byDay, entryFilter]);

  const goToday = () => { setViewYear(now.getFullYear()); setViewMonth(now.getMonth()); setSelectedDay(null); };
  const shiftMonth = (delta: number) => {
    let m = viewMonth + delta, y = viewYear;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setViewMonth(m); setViewYear(y);
    setSelectedDay(null);
  };

  const selectedEntries = selectedDay ? (byDay.get(selectedDay) ?? []).filter((e) => matchesEntryFilter(e.status)) : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Calendário Financeiro"
        subtitle="Contas a pagar e a receber juntas, por dia"
        action={
          <button
            onClick={goToday}
            className="h-9 px-4 bg-slate-900 text-white rounded-xl flex items-center gap-2 text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all active:scale-95"
          >
            Hoje
          </button>
        }
      />

      {/* Totais do mês visível */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">A Pagar no Mês</div>
          <div className="text-2xl font-mono font-black text-rose-600">R$ {fmt(monthTotals.pagar)}</div>
          <div className="absolute right-4 top-4 w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center text-rose-400">
            <ArrowUpCircle size={20} />
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">A Receber no Mês</div>
          <div className="text-2xl font-mono font-black text-emerald-600">R$ {fmt(monthTotals.receber)}</div>
          <div className="absolute right-4 top-4 w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-400">
            <ArrowDownCircle size={20} />
          </div>
        </div>
        <div className={cn("p-5 rounded-2xl shadow-xl relative overflow-hidden", monthTotals.saldo >= 0 ? "bg-slate-900" : "bg-rose-900")}>
          <div className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Saldo Projetado</div>
          <div className={cn("text-2xl font-mono font-black", monthTotals.saldo >= 0 ? "text-emerald-400" : "text-rose-300")}>
            {monthTotals.saldo >= 0 ? "" : "− "}R$ {fmt(Math.abs(monthTotals.saldo))}
          </div>
        </div>
      </div>

      {/* Navegação mês/ano */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <button onClick={() => shiftMonth(-1)} className="h-9 w-9 rounded-xl border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 transition-all">
              <ChevronLeft size={16} />
            </button>
            <h3 className="text-sm font-black uppercase tracking-wide text-slate-800 w-44 text-center">
              {MONTHS[viewMonth]} {viewYear}
            </h3>
            <button onClick={() => shiftMonth(1)} className="h-9 w-9 rounded-xl border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 transition-all">
              <ChevronRight size={16} />
            </button>
          </div>
          <select
            value={viewYear}
            onChange={(e) => { setViewYear(Number(e.target.value)); setSelectedDay(null); }}
            className="h-9 px-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-bold outline-none focus:border-blue-400 transition-all"
          >
            {Array.from({ length: 7 }, (_, i) => now.getFullYear() - 3 + i).map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-1.5 flex-wrap mb-4">
          {([
            ["all", "Todos"],
            ["pending", "Pendentes"],
            ["overdue", "Vencidos"],
            ["settled", "Histórico (pago/recebido)"],
          ] as const).map(([k, l]) => (
            <button
              key={k}
              onClick={() => setEntryFilter(k)}
              className={cn(
                "h-8 px-3 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all",
                entryFilter === k
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-400 border-slate-200 hover:border-slate-400"
              )}
            >{l}</button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={22} className="animate-spin text-slate-300" />
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-1.5">
            {WEEKDAYS.map((w) => (
              <div key={w} className="text-center text-[9px] font-black text-slate-400 uppercase tracking-widest py-1.5">{w}</div>
            ))}
            {grid.map((cell, idx) => {
              const key = dateKey(cell.year, cell.month, cell.day);
              const allEntries = byDay.get(key) ?? [];
              const entries = allEntries.filter((e) => matchesEntryFilter(e.status));
              const pagar = entries.filter((e) => e.kind === "payable" && e.status !== "cancelled").reduce((a, e) => a + e.amount, 0);
              const receber = entries.filter((e) => e.kind === "receivable" && e.status !== "cancelled").reduce((a, e) => a + e.amount, 0);
              const isToday = key === dateKey(now.getFullYear(), now.getMonth(), now.getDate());
              const isSelected = key === selectedDay;
              return (
                <button
                  key={idx}
                  onClick={() => entries.length > 0 && setSelectedDay(isSelected ? null : key)}
                  className={cn(
                    "min-h-[76px] rounded-xl border p-1.5 flex flex-col items-start text-left transition-all",
                    cell.inMonth ? "bg-white border-slate-200" : "bg-slate-50/50 border-slate-100",
                    isSelected && "ring-2 ring-blue-400 border-blue-300",
                    entries.length > 0 && "hover:border-blue-300 cursor-pointer",
                  )}
                >
                  <span className={cn(
                    "text-[10px] font-black mb-1",
                    !cell.inMonth ? "text-slate-300" : isToday ? "text-blue-600" : "text-slate-600",
                  )}>
                    {isToday ? <span className="bg-blue-600 text-white rounded-md px-1.5 py-0.5">{cell.day}</span> : cell.day}
                  </span>
                  <div className="space-y-0.5 w-full">
                    {pagar > 0 && (
                      <div className="text-[8.5px] font-bold text-rose-600 bg-rose-50 rounded px-1 py-0.5 truncate">
                        R$ {fmt(pagar)}
                      </div>
                    )}
                    {receber > 0 && (
                      <div className="text-[8.5px] font-bold text-emerald-600 bg-emerald-50 rounded px-1 py-0.5 truncate">
                        R$ {fmt(receber)}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Painel do dia selecionado */}
      {selectedDay && selectedEntries.length > 0 && (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center sm:p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setSelectedDay(null)} />
          <div className="relative w-full sm:max-w-md bg-white sm:rounded-2xl rounded-t-2xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
              <div>
                <h2 className="text-[13px] font-black uppercase tracking-widest text-slate-900">
                  {new Date(selectedDay + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
                </h2>
                <p className="text-[10px] text-slate-400 mt-0.5">{selectedEntries.length} lançamento{selectedEntries.length > 1 ? "s" : ""}</p>
              </div>
              <button onClick={() => setSelectedDay(null)} className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-all">
                <X size={16} />
              </button>
            </div>
            <div className="px-4 py-3 space-y-2 overflow-y-auto flex-1">
              {selectedEntries.map((e) => (
                <div key={`${e.kind}-${e.id}`} className={cn(
                  "rounded-xl border p-3 flex items-start gap-3",
                  e.kind === "payable" ? "bg-rose-50/50 border-rose-100" : "bg-emerald-50/50 border-emerald-100",
                )}>
                  <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", e.kind === "payable" ? "bg-rose-100 text-rose-600" : "bg-emerald-100 text-emerald-600")}>
                    {e.kind === "payable" ? <ArrowUpCircle size={15} /> : <ArrowDownCircle size={15} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-bold text-slate-800 truncate">{e.description}</p>
                    <p className="text-[10px] text-slate-400 truncate">{e.party || (e.kind === "payable" ? "Sem fornecedor" : "Sem cliente")}</p>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <span className={cn(
                        "text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded",
                        e.status === "paid" || e.status === "received" ? "bg-emerald-100 text-emerald-700"
                          : e.status === "cancelled" ? "bg-slate-100 text-slate-500" : "bg-amber-100 text-amber-700",
                      )}>
                        {e.status === "paid" ? "Pago" : e.status === "received" ? "Recebido" : e.status === "cancelled" ? "Cancelado" : "Pendente"}
                      </span>
                      {e.seriesLabel && (
                        <span className="inline-flex items-center gap-0.5 text-[9px] font-black text-violet-500 bg-violet-50 border border-violet-100 px-1.5 py-0.5 rounded">
                          <Layers size={8} /> {e.seriesLabel}
                        </span>
                      )}
                      {e.isRecurring && (
                        <span className="inline-flex items-center gap-0.5 text-[9px] font-black text-blue-500 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded">
                          <Repeat size={8} /> Recorrente
                        </span>
                      )}
                    </div>
                  </div>
                  <span className={cn("font-mono font-black text-sm shrink-0", e.kind === "payable" ? "text-rose-600" : "text-emerald-600")}>
                    R$ {fmt(e.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
