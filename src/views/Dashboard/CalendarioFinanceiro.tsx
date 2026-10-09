import { useState, useEffect, useMemo, useRef } from "react";
import { Badge, Button, ContentCard, FilterLine, FilterLineSection, FilterLineSegmented, Modal, PageWrapper, SectionTitle, Select, StatCard, StatGrid } from "../../components/ui";
import {
  ChevronLeft, ChevronRight, ArrowDownCircle, ArrowUpCircle, Loader2, Layers, Repeat, HelpCircle, CalendarDays, Wallet,
} from "lucide-react";
import { AccountPayable, AccountReceivable } from "../../types";
import { cn } from "../../lib/utils";
import { onRealtime } from "../../lib/realtime";
import CalendarioFinanceiroPageTour, { type CalendarioFinanceiroPageTourHandle } from "../../components/onboarding/CalendarioFinanceiroPageTour";

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

  const tourRef = useRef<CalendarioFinanceiroPageTourHandle>(null);

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

  const filterOptions = [
    { value: "all", label: "Todos" },
    { value: "pending", label: "Pendentes" },
    { value: "overdue", label: "Vencidos" },
    { value: "settled", label: "Histórico (pago/recebido)" },
  ];

  return (
    <PageWrapper data-tour="calendario-financeiro-page">
      <div className="space-y-4">
        <SectionTitle
          icon={CalendarDays}
          title="Calendário Financeiro"
          description="Contas a pagar e a receber juntas, por dia"
          action={
            <>
              <Button size="sm" onClick={goToday}>Hoje</Button>
              <Button size="sm" variant="outline" iconLeft={<HelpCircle size={14} />} onClick={() => tourRef.current?.start()} title="Tour guiado desta página">
                <span className="sr-only sm:not-sr-only">Ajuda</span>
              </Button>
            </>
          }
        />

        <CalendarioFinanceiroPageTour ref={tourRef} />

        <StatGrid cols={3} data-tour="calendario-totais">
          <StatCard title="A Pagar no Mês" value={`R$ ${fmt(monthTotals.pagar)}`} icon={ArrowUpCircle} color="danger" />
          <StatCard title="A Receber no Mês" value={`R$ ${fmt(monthTotals.receber)}`} icon={ArrowDownCircle} color="success" />
          <StatCard className="col-span-2 sm:col-span-1" title="Saldo Projetado" value={`${monthTotals.saldo >= 0 ? "" : "− "}R$ ${fmt(Math.abs(monthTotals.saldo))}`} icon={Wallet} color={monthTotals.saldo >= 0 ? "info" : "danger"} />
        </StatGrid>

        <ContentCard>
          <div data-tour="calendario-nav" className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="!min-w-0 !px-2" aria-label="Mês anterior" onClick={() => shiftMonth(-1)}><ChevronLeft size={14} /></Button>
              <h3 className="w-40 text-center text-[13px] font-medium text-slate-800">{MONTHS[viewMonth]} {viewYear}</h3>
              <Button variant="outline" size="sm" className="!min-w-0 !px-2" aria-label="Próximo mês" onClick={() => shiftMonth(1)}><ChevronRight size={14} /></Button>
            </div>
            <Select
              aria-label="Ano"
              size="sm"
              wrapperClassName="w-24"
              value={viewYear}
              onChange={(e) => { setViewYear(Number(e.target.value)); setSelectedDay(null); }}
              options={Array.from({ length: 7 }, (_, i) => now.getFullYear() - 3 + i).map((y) => ({ value: y, label: String(y) }))}
            />
          </div>

          <div data-tour="calendario-filtro" className="mb-3">
            <FilterLine>
              <FilterLineSection grow>
                <FilterLineSegmented value={entryFilter as string} onChange={(v) => setEntryFilter(v as typeof entryFilter)} options={filterOptions} />
              </FilterLineSection>
            </FilterLine>
          </div>

          {loading ? (
            <div role="status" className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
              <Loader2 size={18} className="animate-spin" />Carregando calendário…
            </div>
          ) : (
            <div data-tour="calendario-grid" className="grid grid-cols-7 gap-1">
              {WEEKDAYS.map((w) => (
                <div key={w} className="py-1 text-center text-[11px] font-medium text-slate-500">{w}</div>
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
                      "flex min-h-[64px] min-w-0 flex-col items-start rounded-lg border p-1 text-left transition-all sm:min-h-[76px] sm:p-1.5",
                      cell.inMonth ? "border-slate-200 bg-white" : "border-slate-100 bg-slate-50/50",
                      isSelected && "border-blue-300 ring-2 ring-blue-400",
                      entries.length > 0 && "cursor-pointer hover:border-blue-300",
                    )}
                  >
                    <span className={cn(
                      "mb-1 text-[11px] font-medium",
                      !cell.inMonth ? "text-slate-300" : isToday ? "text-blue-600" : "text-slate-600",
                    )}>
                      {isToday ? <span className="rounded-md bg-blue-600 px-1.5 py-0.5 text-white">{cell.day}</span> : cell.day}
                    </span>
                    <div className="w-full space-y-0.5">
                      {pagar > 0 && (
                        <div className="truncate rounded bg-rose-50 px-1 py-0.5 text-[11px] font-medium text-rose-600">R$ {fmt(pagar)}</div>
                      )}
                      {receber > 0 && (
                        <div className="truncate rounded bg-emerald-50 px-1 py-0.5 text-[11px] font-medium text-emerald-600">R$ {fmt(receber)}</div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </ContentCard>
      </div>

      <Modal
        isOpen={!!(selectedDay && selectedEntries.length > 0)}
        onClose={() => setSelectedDay(null)}
        size="md"
        title={selectedDay ? new Date(selectedDay + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" }) : ""}
        subtitle={`${selectedEntries.length} lançamento${selectedEntries.length > 1 ? "s" : ""}`}
      >
        <div className="space-y-2">
          {selectedEntries.map((e) => (
            <div key={`${e.kind}-${e.id}`} className={cn(
              "flex items-start gap-3 rounded-lg border p-3",
              e.kind === "payable" ? "border-rose-100 bg-rose-50/50" : "border-emerald-100 bg-emerald-50/50",
            )}>
              <div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-md", e.kind === "payable" ? "bg-rose-100 text-rose-600" : "bg-emerald-100 text-emerald-600")}>
                {e.kind === "payable" ? <ArrowUpCircle size={14} /> : <ArrowDownCircle size={14} />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-slate-800">{e.description}</p>
                <p className="truncate text-[11px] text-slate-500">{e.party || (e.kind === "payable" ? "Sem fornecedor" : "Sem cliente")}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <Badge color={e.status === "paid" || e.status === "received" ? "success" : e.status === "cancelled" ? "default" : "warning"}>
                    {e.status === "paid" ? "Pago" : e.status === "received" ? "Recebido" : e.status === "cancelled" ? "Cancelado" : "Pendente"}
                  </Badge>
                  {e.seriesLabel && <Badge color="purple" icon={<Layers size={10} />}>{e.seriesLabel}</Badge>}
                  {e.isRecurring && <Badge color="primary" icon={<Repeat size={10} />}>Recorrente</Badge>}
                </div>
              </div>
              <span className={cn("shrink-0 text-xs font-semibold tabular-nums", e.kind === "payable" ? "text-rose-600" : "text-emerald-600")}>
                R$ {fmt(e.amount)}
              </span>
            </div>
          ))}
        </div>
      </Modal>
    </PageWrapper>
  );
}
