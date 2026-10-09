import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import ExcelJS from "exceljs";
import {
  Plus,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  AlertTriangle,
  XCircle,
  ChevronDown,
  Loader2,
  X,
  Calendar,
  User,
  FileText,
  Tag,
  DollarSign,
  TrendingUp,
  Edit2,
  Trash2,
  StickyNote,
  Repeat,
  Percent,
  Layers,
  Download,
  FileSpreadsheet,
  Upload,
  HelpCircle,
  Wallet,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { AccountReceivable, AccountStatus, Tenant } from "../../types";
import { cn } from "../../lib/utils";
import { useToast } from "../../components/ui/Toast";
import { onRealtime } from "../../lib/realtime";
import Combobox from "../../components/ui/Combobox";
import {
  Button, IconButton, Input, Select, Textarea, Modal, ModalFooter, ConfirmModal, Switch, Badge,
  Tabs, PageWrapper, SectionTitle, StatGrid, ContentCard, PanelCard, StatCard, EmptyState,
  FilterLine, FilterLineSection, FilterLineSearch, FilterLineSegmented,
} from "../../components/ui";
import ContasReceberPageTour, { CONTAS_RECEBER_PAGE_TOUR_EVENTS, type ContasReceberPageTourHandle } from "../../components/onboarding/ContasReceberPageTour";

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const today = () => new Date().toISOString().split("T")[0];

function formatDateBR(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d + (d.length === 10 ? "T12:00:00" : "")).toLocaleDateString("pt-BR");
}

// due_date vem da API como ISO completo ("2026-12-30T00:00:00.000Z"), não como
// "YYYY-MM-DD" puro — concatenar "T23:59:59" direto nisso vira uma string inválida,
// e Date inválida em qualquer comparação sempre dá false (por isso os cards ficavam
// zerados). Corta pros 10 primeiros caracteres primeiro.
function isOverdue(due: string, status: AccountStatus) {
  if (status !== "pending") return false;
  return new Date(due.substring(0, 10) + "T23:59:59") < new Date();
}

const DUE_SOON_DAYS = 3;
function isDueSoon(due: string, status: AccountStatus) {
  if (status !== "pending") return false;
  const daysUntil = (new Date(due.substring(0, 10) + "T23:59:59").getTime() - Date.now()) / 86_400_000;
  return daysUntil >= 0 && daysUntil <= DUE_SOON_DAYS;
}

// Sugestão de juros pro-rata sobre o valor restante — sempre calculada na hora pra
// exibir, nunca acumulada automaticamente (mesmo padrão do crediário em PDV.tsx).
function suggestedInterest(remaining: number, due_date: string, rate: number, period: "day" | "month", graceDays: number): number {
  if (rate <= 0) return 0;
  const daysLate = Math.floor((Date.now() - new Date(due_date + "T00:00:00").getTime()) / 86400000);
  const billableDays = Math.max(0, daysLate - graceDays);
  if (billableDays <= 0) return 0;
  const factor = period === "day" ? billableDays : billableDays / 30;
  return Math.round(remaining * (rate / 100) * factor * 100) / 100;
}

function splitEvenly(total: number, count: number): string[] {
  const base = Math.floor((total / count) * 100) / 100;
  return Array.from({ length: count }, (_, i) =>
    (i === count - 1 ? Math.round((total - base * (count - 1)) * 100) / 100 : base).toFixed(2)
  );
}

// ─── Export Excel — mesmo padrão visual de Contas a Pagar (cabeçalho com
// nome/CNPJ, tabela formatada), sem a divisão Fixo/Variável (não existe
// classificação equivalente em AccountReceivable).
async function exportReceivablesToExcel(items: AccountReceivable[], tenant: Partial<Tenant> | null) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Store BoxSys";
  wb.created = new Date();

  const font = (opts: { bold?: boolean; italic?: boolean; size?: number; color?: string }): Partial<ExcelJS.Font> => ({
    name: "Calibri", size: opts.size ?? 11, bold: !!opts.bold, italic: !!opts.italic,
    color: { argb: `FF${opts.color ?? "1E293B"}` },
  });
  const fill = (hex: string): ExcelJS.Fill => ({ type: "pattern", pattern: "solid", fgColor: { argb: `FF${hex}` } });
  const border = (): Partial<ExcelJS.Borders> => ({
    top: { style: "thin", color: { argb: "FFE2E8F0" } }, bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
    left: { style: "thin", color: { argb: "FFE2E8F0" } }, right: { style: "thin", color: { argb: "FFE2E8F0" } },
  });

  const ws = wb.addWorksheet("Contas a Receber", { pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true } });
  ws.columns = [
    { key: "seq", width: 5 }, { key: "desc", width: 34 }, { key: "customer", width: 20 },
    { key: "cat", width: 16 }, { key: "due", width: 14 }, { key: "status", width: 14 }, { key: "amount", width: 16 },
  ];

  ws.getRow(1).height = 28;
  const c1 = ws.getRow(1).getCell(1);
  c1.value = tenant?.name || "Store BoxSys";
  c1.font = font({ bold: true, size: 18, color: "1E3A5F" });

  const metaParts: string[] = [];
  if ((tenant as any)?.cnpj) metaParts.push(`CNPJ: ${(tenant as any).cnpj}`);
  if (tenant?.address) metaParts.push(`Endereço: ${tenant.address}`);
  ws.getRow(2).getCell(1).value = metaParts.join("   |   ") || " ";
  ws.getRow(2).getCell(1).font = font({ size: 9, color: "64748B" });
  ws.getRow(2).getCell(6).value = `Gerado em: ${new Date().toLocaleString("pt-BR")}`;
  ws.getRow(2).getCell(6).font = font({ size: 9, italic: true, color: "94A3B8" });
  ws.getRow(2).getCell(6).alignment = { horizontal: "right" };

  ws.getRow(3).getCell(1).value = "Contas a Receber";
  ws.getRow(3).getCell(1).font = font({ bold: true, size: 12, color: "1E3A5F" });
  ws.getRow(3).height = 18;

  const total = items.reduce((a, r) => a + Number(r.amount), 0);
  ws.getRow(4).getCell(1).value = `${items.length} lançamento(s) · Total: R$ ${fmt(total)}`;
  ws.getRow(4).getCell(1).font = font({ size: 9, italic: true, color: "94A3B8" });

  ws.getRow(5).height = 4;
  for (let c = 1; c <= 7; c++) ws.getRow(5).getCell(c).border = { bottom: { style: "medium", color: { argb: "FF1E3A5F" } } };

  const HEADERS = ["#", "Descrição", "Cliente", "Categoria", "Vencimento", "Status", "Valor (R$)"];
  HEADERS.forEach((h, i) => {
    const cell = ws.getRow(6).getCell(i + 1);
    cell.value = h;
    cell.font = font({ bold: true, size: 10, color: "FFFFFF" });
    cell.fill = fill("1E3A5F");
    cell.alignment = { horizontal: i === 6 ? "right" : "left", vertical: "middle" };
    cell.border = border();
  });
  ws.getRow(6).height = 20;

  items.forEach((item, i) => {
    const rowNum = 7 + i;
    const row = ws.getRow(rowNum);
    row.height = 18;
    const altBg = i % 2 === 0 ? "FFFFFF" : "F8FAFC";
    const cells = [
      i + 1,
      item.description,
      item.customer_name || "—",
      item.category || "—",
      formatDateBR(item.due_date),
      STATUS_CONFIG[isOverdue(item.due_date, item.status as AccountStatus) ? "overdue" : item.status as AccountStatus].label,
      Number(item.amount),
    ];
    cells.forEach((val, ci) => {
      const cell = row.getCell(ci + 1);
      cell.value = val;
      cell.fill = fill(altBg);
      cell.border = border();
      cell.font = font({ size: 10, bold: ci === 1 });
      if (ci === 6) { cell.numFmt = '"R$" #,##0.00'; cell.alignment = { horizontal: "right" }; }
      if (ci === 0) cell.alignment = { horizontal: "center" };
    });
  });

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `contas-a-receber-${new Date().toISOString().substring(0, 10)}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Export PDF — HTML formatada aberta numa aba nova e impressa, mesmo padrão
// de Contas a Pagar (sem o resumo Fixo/Variável).
function exportReceivablesToPDF(items: AccountReceivable[], tenant: Partial<Tenant> | null) {
  const total = items.reduce((a, i) => a + Number(i.amount), 0);
  const totalOverdue = items.filter((i) => isOverdue(i.due_date, i.status as AccountStatus)).reduce((a, i) => a + Number(i.amount), 0);
  const totalReceived = items.filter((i) => i.status === "received").reduce((a, i) => a + Number(i.amount), 0);

  const rows = items.map((item) => `
    <tr>
      <td>${item.description}</td>
      <td style="text-align:center">${item.customer_name || "—"}</td>
      <td style="text-align:center">${item.category || "—"}</td>
      <td style="text-align:center">${formatDateBR(item.due_date)}</td>
      <td style="text-align:right;font-weight:700">R$ ${fmt(Number(item.amount))}</td>
    </tr>`).join("");

  const html = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"/><title>Contas a Receber</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; padding: 32px; font-size: 12px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; border-bottom: 3px solid #1e3a5f; padding-bottom: 16px; }
  .header h1 { font-size: 20px; font-weight: 900; text-transform: ; letter-spacing: 0.1em; }
  .header p { font-size: 10px; color: #64748b; margin-top: 2px; }
  .meta { text-align: right; font-size: 10px; color: #64748b; }
  .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 24px; }
  .card { padding: 14px 16px; border-radius: 10px; border: 1px solid #e2e8f0; }
  .card label { font-size: 9px; font-weight: 700; text-transform: ; letter-spacing: 0.15em; display: block; margin-bottom: 4px; color: #94a3b8; }
  .card .val { font-size: 18px; font-weight: 900; font-family: monospace; }
  .card.overdue { background: #fff1f2; border-color: #fecdd3; } .card.overdue .val { color: #e11d48; }
  .card.received { background: #ecfdf5; border-color: #a7f3d0; } .card.received .val { color: #059669; }
  .card.total { background: #1e293b; border-color: #1e293b; } .card.total label { color: #64748b; } .card.total .val { color: #fff; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #f8fafc; border-bottom: 2px solid #e2e8f0; padding: 10px 12px; text-align: left; font-size: 9px; font-weight: 700; text-transform: ; letter-spacing: 0.15em; color: #94a3b8; }
  td { padding: 9px 12px; border-bottom: 1px solid #f1f5f9; font-size: 11px; }
  @media print { body { padding: 16px; } }
</style></head>
<body>
<div class="header">
  <div><h1>${tenant?.name || "Store BoxSys"}</h1>
    <p>${tenant?.address || ""}</p>
    ${(tenant as any)?.cnpj ? `<p>CNPJ: ${(tenant as any).cnpj}</p>` : ""}
  </div>
  <div class="meta"><strong>Relatório de Contas a Receber</strong><br/>Gerado em: ${new Date().toLocaleString("pt-BR")}</div>
</div>
<div class="summary">
  <div class="card overdue"><label>Vencidas</label><div class="val">R$ ${fmt(totalOverdue)}</div></div>
  <div class="card received"><label>Recebido</label><div class="val">R$ ${fmt(totalReceived)}</div></div>
  <div class="card total"><label>Total</label><div class="val">R$ ${fmt(total)}</div></div>
</div>
<table>
  <thead><tr><th>Descrição</th><th style="text-align:center">Cliente</th><th style="text-align:center">Categoria</th><th style="text-align:center">Vencimento</th><th style="text-align:right">Valor</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
</body></html>`;

  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 400);
}

const STATUS_CONFIG: Record<AccountStatus, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  pending:   { label: "Pendente",   color: "text-amber-600",   bg: "bg-amber-50 border-amber-200",   icon: <Clock size={12} /> },
  received:  { label: "Recebido",   color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200", icon: <CheckCircle2 size={12} /> },
  paid:      { label: "Pago",       color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200", icon: <CheckCircle2 size={12} /> },
  overdue:   { label: "Vencido",    color: "text-rose-600",    bg: "bg-rose-50 border-rose-200",     icon: <AlertCircle size={12} /> },
  cancelled: { label: "Cancelado",  color: "text-slate-400",   bg: "bg-slate-50 border-slate-200",   icon: <XCircle size={12} /> },
};

const CATEGORIES = ["Venda", "Serviço", "Aluguel", "Comissão", "Empréstimo", "Outro"];
const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

// Mesmo padrão de filtro de período do Fluxo de Caixa (Finance.tsx) — navegador
// de mês/ano com atalho pra período livre (dia 1 até o último dia do mês, ou
// qualquer intervalo customizado), em vez de dois <select> soltos sem noção
// de "mês atual".
type PeriodPreset = "month" | "year" | "custom" | "all";

function monthRange(year: number, month: number): { from: string; to: string } {
  const pad = (n: number) => String(n).padStart(2, "0");
  const lastDay = new Date(year, month + 1, 0).getDate();
  return { from: `${year}-${pad(month + 1)}-01`, to: `${year}-${pad(month + 1)}-${pad(lastDay)}` };
}

function yearRange(year: number): { from: string; to: string } {
  return { from: `${year}-01-01`, to: `${year}-12-31` };
}

const MAIN_TABS = [
  { id: "admin", label: "Administrativo", icon: FileText },
  { id: "crediario", label: "Crediário", icon: Wallet },
] as const;
type MainTabId = typeof MAIN_TABS[number]["id"];

const STATUS_TABS = [
  { id: "all", label: "Todos", icon: FileText },
  { id: "pending", label: "Pendentes", icon: Clock },
  { id: "overdue", label: "Vencidos", icon: AlertCircle },
  { id: "received", label: "Recebidos", icon: CheckCircle2 },
  { id: "cancelled", label: "Cancelados", icon: XCircle },
] as const;
type StatusTabId = typeof STATUS_TABS[number]["id"];

const FORM_TABS = [
  { id: "dados", label: "Dados", icon: FileText },
  { id: "lancamento", label: "Lançamento", icon: Repeat },
] as const;
type FormTabId = typeof FORM_TABS[number]["id"];

function DetailRow({ label, value, valueClass }: { label: string; value: React.ReactNode; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <dt className="text-[11px] text-slate-500">{label}</dt>
      <dd className={cn("text-right font-medium text-slate-700", valueClass)}>{value}</dd>
    </div>
  );
}

type ModalMode = "create" | "edit" | "receive" | "delete" | null;

interface FormData {
  description: string;
  amount: string;
  due_date: string;
  customer_name: string;
  category: string;
  notes: string;
}

const EMPTY_FORM: FormData = {
  description: "",
  amount: "",
  due_date: today(),
  customer_name: "",
  category: "",
  notes: "",
};

interface CrediarioInstallment {
  id: number;
  debt_id: number;
  customer_id: number;
  customer_name: string;
  customer_phone: string | null;
  risk_flag: boolean;
  description: string;
  number: number;
  due_date: string;
  amount: number;
  amount_paid: number;
  remaining: number;
}

// Aba "Crediário" — parcelas de venda fiado (CustomerDebtInstallment), sistema
// separado dos lançamentos administrativos de Contas a Receber (sem FK entre
// os dois no banco). Busca própria, filtro próprio, sem misturar com `items`/
// `filtered` da aba admin.
function CrediarioTab() {
  const navigate = useNavigate();
  const [installments, setInstallments] = useState<CrediarioInstallment[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"all" | "overdue">("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("token");
    fetch("/api/customers/debts/installments", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => setInstallments(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const now = Date.now();
  const withOverdue = installments.map((i) => ({
    ...i,
    isOverdue: new Date(i.due_date).getTime() < now,
    daysLate: Math.max(0, Math.floor((now - new Date(i.due_date).getTime()) / 86_400_000)),
  }));

  const filtered = withOverdue.filter((i) => {
    if (statusFilter === "overdue" && !i.isOverdue) return false;
    if (search && !i.customer_name.toLowerCase().includes(search.toLowerCase()) &&
        !i.description.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const overdueList = withOverdue.filter((i) => i.isOverdue);
  const totalOverdue = overdueList.reduce((sum, i) => sum + i.remaining, 0);
  const totalOpen = withOverdue.reduce((sum, i) => sum + i.remaining, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={22} className="animate-spin text-slate-300" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <StatGrid cols={3}>
        <StatCard title="Em Aberto" value={`R$ ${fmt(totalOpen)}`} description={`${withOverdue.length} parcelas`} icon={Wallet} color="info" />
        <StatCard title="Vencidas" value={`R$ ${fmt(totalOverdue)}`} description={`${overdueList.length} parcelas vencidas`} icon={AlertCircle} color="danger" />
        <StatCard title="Clientes Devedores" value={new Set(withOverdue.map((i) => i.customer_id)).size} description="com parcela em aberto" icon={User} color="default" />
      </StatGrid>

      <div data-tour="contas-receber-crediario-table" className="space-y-3">
        <FilterLine>
          <FilterLineSection grow>
            <FilterLineSearch
              aria-label="Buscar parcelas do crediário"
              placeholder="Buscar por cliente ou descrição..."
              value={search}
              onChange={setSearch}
            />
          </FilterLineSection>
          <FilterLineSection>
            <FilterLineSegmented<string>
              value={statusFilter}
              onChange={(v) => setStatusFilter(v as "all" | "overdue")}
              options={[{ value: "all", label: "Todas" }, { value: "overdue", label: "Vencidas" }]}
            />
          </FilterLineSection>
        </FilterLine>

        <ContentCard padding="none" className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-zinc-50">
                  {["Cliente", "Descrição", "Parcela", "Vencimento", "Valor Restante", "Status", ""].map((h) => (
                    <th key={h} className="whitespace-nowrap border-b border-slate-200 px-4 py-2 text-[11px] font-medium text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={7}><EmptyState icon={Wallet} title="Nenhuma parcela em aberto" description="Ajuste a busca ou o filtro." /></td></tr>
                )}
                {filtered.map((i) => (
                  <tr
                    key={i.id}
                    onClick={() => navigate(`/admin/customers/${i.customer_id}?tab=fiado`)}
                    className="cursor-pointer border-t border-slate-100 transition-colors hover:bg-blue-50/40"
                    title="Ver crediário deste cliente"
                  >
                    <td className="whitespace-nowrap px-4 py-2 text-xs font-medium text-slate-700">
                      {i.customer_name}
                      {i.risk_flag && <AlertTriangle size={11} className="ml-1.5 inline text-rose-400" />}
                    </td>
                    <td className="px-4 py-2 text-xs text-slate-500">{i.description}</td>
                    <td className="whitespace-nowrap px-4 py-2 text-center text-xs text-slate-500">{i.number}</td>
                    <td className="whitespace-nowrap px-4 py-2 text-xs text-slate-500">{formatDateBR(i.due_date)}</td>
                    <td className="whitespace-nowrap px-4 py-2 text-xs font-semibold tabular-nums text-slate-800">R$ {fmt(i.remaining)}</td>
                    <td className="whitespace-nowrap px-4 py-2">
                      {i.isOverdue ? (
                        <Badge size="sm" color="danger" icon={<AlertCircle size={10} />}>Vencida há {i.daysLate}d</Badge>
                      ) : (
                        <Badge size="sm" color="warning" icon={<Clock size={10} />}>Em aberto</Badge>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-right">
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600">
                        Ver Cliente <ChevronDown size={11} className="-rotate-90" />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ContentCard>
      </div>
    </div>
  );
}

export default function ContasReceber() {
  // "admin" = lançamentos manuais (comportamento existente, intocado); "crediario"
  // = parcelas de venda fiado (CustomerDebtInstallment) — sistema separado no
  // banco (sem FK entre os dois), por isso vive num componente à parte
  // (CrediarioTab) em vez de misturado na mesma lista/filtros.
  const [mainTab, setMainTab] = useState<MainTabId>("admin");
  const { success, error: toastError } = useToast();
  const [items, setItems] = useState<AccountReceivable[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selected, setSelected] = useState<AccountReceivable | null>(null);
  // Painel de detalhes/ações no mobile — mesmo padrão de ContasPagar.tsx: o card da
  // lista mobile só mostrava dados, sem nenhum jeito de abrir editar/receber/excluir.
  const [detailItem, setDetailItem] = useState<AccountReceivable | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [receiveDate, setReceiveDate] = useState(today());
  const [continueRecurring, setContinueRecurring] = useState(true);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<AccountStatus | "all">("all");

  // Filtro de período — default "Tudo" preserva o comportamento atual (nada
  // some da lista até o operador escolher um recorte de período).
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>("all");
  const nowRef = useState(() => new Date())[0];
  const [navYear, setNavYear] = useState(nowRef.getFullYear());
  const [navMonth, setNavMonth] = useState(nowRef.getMonth());
  const [dateFrom, setDateFrom] = useState(() => monthRange(nowRef.getFullYear(), nowRef.getMonth()).from);
  const [dateTo, setDateTo] = useState(() => monthRange(nowRef.getFullYear(), nowRef.getMonth()).to);

  const applyPeriodPreset = (p: PeriodPreset) => {
    setPeriodPreset(p);
    if (p === "month") { const r = monthRange(navYear, navMonth); setDateFrom(r.from); setDateTo(r.to); }
    else if (p === "year") { const r = yearRange(navYear); setDateFrom(r.from); setDateTo(r.to); }
  };

  const navigatePeriod = (delta: number) => {
    if (periodPreset === "year") {
      const y = navYear + delta;
      setNavYear(y);
      setPeriodPreset("year");
      const r = yearRange(y);
      setDateFrom(r.from); setDateTo(r.to);
      return;
    }
    let m = navMonth + delta;
    let y = navYear;
    if (m > 11) { m = 0; y++; }
    if (m < 0) { m = 11; y--; }
    setNavMonth(m); setNavYear(y);
    setPeriodPreset("month");
    const r = monthRange(y, m);
    setDateFrom(r.from); setDateTo(r.to);
  };

  // Parcelamento/recorrência (só na criação — editar uma parcela já gerada não
  // reconfigura a série inteira, isso fica fora do escopo desta primeira etapa)
  const [recurrenceEnabled, setRecurrenceEnabled] = useState(false);
  const [recurringVariable, setRecurringVariable] = useState(false);
  const [recurringValueMode, setRecurringValueMode] = useState<"fixed" | "variable">("variable");
  const [installmentsCount, setInstallmentsCount] = useState("2");
  const [intervalUnit, setIntervalUnit] = useState<"day" | "week" | "month">("month");
  const [intervalCount, setIntervalCount] = useState("1");
  const [valueMode, setValueMode] = useState<"fixed" | "variable">("fixed");
  const [variableAmounts, setVariableAmounts] = useState<string[]>([]);
  const [interestRate, setInterestRate] = useState("0");
  const [interestPeriod, setInterestPeriod] = useState<"day" | "month">("month");
  const [interestGraceDays, setInterestGraceDays] = useState("0");

  // Seleção em massa (receber várias parcelas de uma vez, em qualquer ordem)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkReceiving, setBulkReceiving] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [interestTarget, setInterestTarget] = useState<AccountReceivable | null>(null);
  const [interestValue, setInterestValue] = useState("0");
  const [applyingInterest, setApplyingInterest] = useState(false);
  const tourRef = useRef<ContasReceberPageTourHandle>(null);

  // Cadastro de clientes — dropdown com busca pra evitar duplicar nomes digitados,
  // com criação rápida sem sair do modal.
  const [customersList, setCustomersList] = useState<{ id: number; name: string }[]>([]);

  const [tenant, setTenant] = useState<Partial<Tenant> | null>(null);
  const [showExport, setShowExport] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ created: number; errors: { row: number; error: string }[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const token = () => localStorage.getItem("token");

  const fetchCustomersList = async () => {
    try {
      const res = await fetch("/api/customers", { headers: { Authorization: `Bearer ${token()}` } });
      const data = await res.json();
      setCustomersList(Array.isArray(data) ? data.map((c: { id: number; name: string }) => ({ id: c.id, name: c.name })) : []);
    } catch {}
  };

  const handleCreateCustomer = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.id) {
        setCustomersList((prev) => [...prev, { id: data.id, name: trimmed }]);
        setForm((prev) => ({ ...prev, customer_name: trimmed }));
      } else {
        toastError(data.error || "Erro ao cadastrar cliente.");
      }
    } catch {
      toastError("Erro de conexão. Verifique sua internet.");
    }
  };

  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/accounts-receivable", {
        headers: { Authorization: `Bearer ${token()}` },
      });
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    fetchItems();
    fetchCustomersList();
    fetch("/api/tenant", { headers: { Authorization: `Bearer ${token()}` } })
      .then((r) => r.json())
      .then((d) => setTenant(d))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setShowExport(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const downloadImportTemplate = async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Modelo");
    ws.columns = [
      { key: "desc", width: 34 }, { key: "amount", width: 14 }, { key: "due", width: 14 },
      { key: "customer", width: 20 }, { key: "cat", width: 16 },
    ];
    ws.addRow(["Descrição", "Valor", "Vencimento", "Cliente", "Categoria"]);
    ws.getRow(1).font = { bold: true };
    ws.addRow(["Venda a prazo", 350, "2026-09-05", "João da Silva", "Venda"]);
    ws.addRow(["Serviço prestado", 180.5, "2026-09-10", "", "Serviço"]);
    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "modelo-contas-a-receber.xlsx"; a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = async (file: File) => {
    setImporting(true);
    setImportResult(null);
    try {
      const buf = await file.arrayBuffer();
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buf);
      const ws = wb.worksheets[0];
      if (!ws) { toastError("Planilha vazia."); setImporting(false); return; }

      const colIndex: Record<string, number> = {};
      ws.getRow(1).eachCell((cell, colNumber) => {
        colIndex[String(cell.value || "").trim().toLowerCase()] = colNumber;
      });
      const findCol = (...names: string[]) => names.map((n) => colIndex[n]).find((v) => v != null) ?? null;
      const cDesc = findCol("descrição", "descricao", "description");
      const cAmount = findCol("valor", "valor (r$)", "amount");
      const cDue = findCol("vencimento", "due_date", "data");
      const cCustomer = findCol("cliente", "customer_name", "customer");
      const cCategory = findCol("categoria", "category");

      if (!cDesc || !cAmount || !cDue) {
        toastError('A planilha precisa ter as colunas "Descrição", "Valor" e "Vencimento".');
        setImporting(false);
        return;
      }

      const rows: { description: string; amount: number; due_date: string; customer_name?: string; category?: string }[] = [];
      for (let r = 2; r <= ws.rowCount; r++) {
        const row = ws.getRow(r);
        const descVal = row.getCell(cDesc).value;
        if (!descVal) continue;
        const dueVal = row.getCell(cDue).value;
        const dueStr = dueVal instanceof Date ? dueVal.toISOString().substring(0, 10) : String(dueVal || "").trim().substring(0, 10);

        rows.push({
          description: String(descVal).trim(),
          amount: Number(row.getCell(cAmount).value) || 0,
          due_date: dueStr,
          customer_name: cCustomer ? String(row.getCell(cCustomer).value || "").trim() || undefined : undefined,
          category: cCategory ? String(row.getCell(cCategory).value || "").trim() || undefined : undefined,
        });
      }

      if (rows.length === 0) {
        toastError("Nenhuma linha válida encontrada na planilha.");
        setImporting(false);
        return;
      }

      const res = await fetch("/api/accounts-receivable/import", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ rows }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setImportResult({ created: data.created || 0, errors: data.errors || [] });
        if (data.created > 0) { success(`${data.created} conta(s) importada(s)!`); fetchItems(); }
      } else {
        toastError(data.error || "Erro ao importar planilha.");
      }
    } catch {
      toastError("Erro ao ler a planilha. Confira o formato do arquivo.");
    }
    setImporting(false);
  };
  useEffect(() => onRealtime("finance:changed", () => { fetchItems(); }), []);

  // Lembra o filtro de período escolhido (Tudo/Mês/Ano) entre visitas à tela —
  // salvo por usuário no backend, mesmo mecanismo já usado no Fluxo de Caixa.
  const periodPrefLoaded = useRef(false);
  useEffect(() => {
    fetch("/api/preferences/accounts_receivable_period", { headers: { Authorization: `Bearer ${token()}` } })
      .then((r) => r.ok ? r.json() : null)
      .then((saved) => {
        if (saved === "month" || saved === "year" || saved === "all" || saved === "custom") {
          applyPeriodPreset(saved);
        }
      })
      .catch(() => {})
      .finally(() => { periodPrefLoaded.current = true; });
  }, []);

  useEffect(() => {
    if (!periodPrefLoaded.current) return;
    fetch("/api/preferences/accounts_receivable_period", {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
      body: JSON.stringify({ value: periodPreset }),
    }).catch(() => {});
  }, [periodPreset]);

  const openCreate = () => {
    setSelected(null);
    setForm(EMPTY_FORM);
    setRecurrenceEnabled(false);
    setRecurringVariable(false);
    setRecurringValueMode("variable");
    setInstallmentsCount("2");
    setIntervalUnit("month");
    setIntervalCount("1");
    setValueMode("fixed");
    setVariableAmounts([]);
    setInterestRate("0");
    setInterestPeriod("month");
    setInterestGraceDays("0");
    setModalMode("create");
  };

  // Mantém variableAmounts em sincronia com o nº de parcelas / valor total sempre que o
  // operador estiver no modo "personalizar valores" — reparte igual como ponto de
  // partida editável, não força o operador a preencher tudo do zero.
  const syncVariableAmounts = (count: number, totalStr: string) => {
    const total = Number(totalStr) || 0;
    setVariableAmounts(count > 0 && total > 0 ? splitEvenly(total, count) : Array(Math.max(0, count)).fill("0.00"));
  };

  const variableSum = valueMode === "variable" ? variableAmounts.reduce((a, v) => a + (Number(v) || 0), 0) : 0;
  const variableMismatch = valueMode === "variable" && Math.abs(variableSum - (Number(form.amount) || 0)) > 0.01;

  const openEdit = (item: AccountReceivable) => {
    setSelected(item);
    setForm({
      description: item.description,
      amount: String(item.amount),
      due_date: item.due_date.substring(0, 10),
      customer_name: item.customer_name || "",
      category: item.category || "",
      notes: item.notes || "",
    });
    setRecurrenceEnabled(false);
    setRecurringVariable(!!item.is_recurring);
    setRecurringValueMode("variable");
    setIntervalUnit((item.recurrence_interval_unit as "day" | "week" | "month") || "month");
    setIntervalCount(String(item.recurrence_interval_count || 1));
    setModalMode("edit");
  };

  const openReceive = (item: AccountReceivable) => {
    setSelected(item);
    setReceiveDate(today());
    setContinueRecurring(true);
    setModalMode("receive");
  };

  const openDelete = (item: AccountReceivable) => {
    setSelected(item);
    setModalMode("delete");
  };

  const closeModal = () => { setModalMode(null); setSelected(null); };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (modalMode === "create" && recurrenceEnabled && valueMode === "variable" && variableMismatch) {
      toastError("A soma dos valores das parcelas precisa bater com o valor total.");
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        description: form.description,
        amount: Number(form.amount),
        due_date: form.due_date,
        customer_name: form.customer_name || null,
        category: form.category || null,
        notes: form.notes || null,
      };
      if (modalMode === "create" && recurrenceEnabled) {
        body.recurrence = {
          installments_count: Math.max(2, Number(installmentsCount) || 2),
          interval_unit: intervalUnit,
          interval_count: Math.max(1, Number(intervalCount) || 1),
          value_mode: valueMode,
          amounts: valueMode === "variable" ? variableAmounts.map((v) => Number(v) || 0) : undefined,
          interest_rate: Number(interestRate) || 0,
          interest_period: interestPeriod,
          interest_grace_days: Math.max(0, Number(interestGraceDays) || 0),
        };
      } else if (modalMode === "create" && recurringVariable) {
        body.is_recurring = true;
        body.recurrence_interval_unit = intervalUnit;
        body.recurrence_interval_count = Math.max(1, Number(intervalCount) || 1);
      } else if (modalMode === "edit") {
        body.is_recurring = recurringVariable;
        body.recurrence_interval_unit = recurringVariable ? intervalUnit : null;
        body.recurrence_interval_count = recurringVariable ? Math.max(1, Number(intervalCount) || 1) : null;
      }
      const url = modalMode === "edit" ? `/api/accounts-receivable/${selected!.id}` : "/api/accounts-receivable";
      const method = modalMode === "edit" ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        success(
          modalMode === "edit"
            ? "Conta atualizada com sucesso!"
            : recurrenceEnabled
              ? `${Math.max(2, Number(installmentsCount) || 2)} parcelas cadastradas com sucesso!`
              : recurringVariable
                ? "Conta recorrente cadastrada! O próximo lançamento é criado ao receber este."
                : "Conta cadastrada com sucesso!"
        );
        closeModal();
        fetchItems();
      } else {
        const data = await res.json().catch(() => ({}));
        toastError(data.error || "Erro ao salvar conta. Tente novamente.");
      }
    } catch {
      toastError("Erro de conexão. Verifique sua internet.");
    }
    setSaving(false);
  };

  const handleReceive = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/accounts-receivable/${selected!.id}/receive`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ received_date: receiveDate, continue_recurring: continueRecurring }),
      });
      if (res.ok) {
        success("Recebimento confirmado!");
        closeModal();
        fetchItems();
      } else {
        const data = await res.json().catch(() => ({}));
        toastError(data.error || "Erro ao confirmar recebimento.");
      }
    } catch {
      toastError("Erro de conexão. Verifique sua internet.");
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/accounts-receivable/${selected!.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (res.ok) {
        success("Conta excluída.");
        closeModal();
        fetchItems();
      } else {
        const data = await res.json().catch(() => ({}));
        toastError(data.error || "Erro ao excluir conta.");
      }
    } catch {
      toastError("Erro de conexão. Verifique sua internet.");
    }
    setSaving(false);
  };

  const toggleSelected = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleBulkReceive = async () => {
    if (selectedIds.size === 0) return;
    setBulkReceiving(true);
    try {
      const res = await fetch("/api/accounts-receivable/bulk-receive", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ ids: [...selectedIds], received_date: today() }),
      });
      if (res.ok) {
        success(`${selectedIds.size} conta(s) marcada(s) como recebida(s)!`);
        setSelectedIds(new Set());
        fetchItems();
      } else {
        const data = await res.json().catch(() => ({}));
        toastError(data.error || "Erro ao marcar contas como recebidas.");
      }
    } catch {
      toastError("Erro de conexão. Verifique sua internet.");
    }
    setBulkReceiving(false);
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setBulkDeleting(true);
    try {
      const res = await fetch("/api/accounts-receivable/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ ids: [...selectedIds] }),
      });
      if (res.ok) {
        success(`${selectedIds.size} conta(s) excluída(s)!`);
        setSelectedIds(new Set());
        setShowBulkDeleteConfirm(false);
        fetchItems();
      } else {
        const data = await res.json().catch(() => ({}));
        toastError(data.error || "Erro ao excluir contas.");
      }
    } catch {
      toastError("Erro de conexão. Verifique sua internet.");
    }
    setBulkDeleting(false);
  };

  const openApplyInterest = (item: AccountReceivable) => {
    const rate = item.series?.interest_rate ?? 0;
    const period = item.series?.interest_period ?? "month";
    const grace = item.series?.interest_grace_days ?? 0;
    const suggestion = suggestedInterest(Number(item.amount), item.due_date, rate, period, grace);
    setInterestTarget(item);
    setInterestValue(suggestion > 0 ? suggestion.toFixed(2) : "0.00");
  };

  const handleApplyInterest = async () => {
    if (!interestTarget) return;
    const amount = Number(interestValue);
    if (!amount || amount <= 0) { toastError("Informe um valor de juros válido."); return; }
    setApplyingInterest(true);
    try {
      const res = await fetch(`/api/accounts-receivable/${interestTarget.id}/apply-interest`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ interest_amount: amount }),
      });
      if (res.ok) {
        success("Juros aplicado!");
        setInterestTarget(null);
        fetchItems();
      } else {
        const data = await res.json().catch(() => ({}));
        toastError(data.error || "Erro ao aplicar juros.");
      }
    } catch {
      toastError("Erro de conexão. Verifique sua internet.");
    }
    setApplyingInterest(false);
  };

  // ── Canal de comunicação do TOUR DE PÁGINA (ContasReceberPageTour) ────────
  // Além de trocar a aba ativa (mainTab), abre o modal "Nova Conta" de
  // verdade via openCreate e preenche campos de exemplo via setForm — nunca
  // chama handleSave/handleReceive/handleDelete. Fechar sempre via
  // closeModal (equivalente a clicar fora do modal ou no X).
  useEffect(() => {
    const onGoAdmin = () => setMainTab("admin");
    const onGoCrediario = () => setMainTab("crediario");
    const onOpenNewAccount = () => openCreate();
    const onFillAccount = (e: Event) => {
      const detail = (e as CustomEvent<Partial<typeof form>>).detail;
      if (detail) setForm((prev) => ({ ...prev, ...detail }));
    };
    const onCloseModal = () => closeModal();

    window.addEventListener(CONTAS_RECEBER_PAGE_TOUR_EVENTS.goToAdminTab, onGoAdmin);
    window.addEventListener(CONTAS_RECEBER_PAGE_TOUR_EVENTS.goToCrediarioTab, onGoCrediario);
    window.addEventListener("page-tour:contas-receber:open-new-account", onOpenNewAccount);
    window.addEventListener("page-tour:contas-receber:fill-account", onFillAccount);
    window.addEventListener("page-tour:contas-receber:close-modal", onCloseModal);
    return () => {
      window.removeEventListener(CONTAS_RECEBER_PAGE_TOUR_EVENTS.goToAdminTab, onGoAdmin);
      window.removeEventListener(CONTAS_RECEBER_PAGE_TOUR_EVENTS.goToCrediarioTab, onGoCrediario);
      window.removeEventListener("page-tour:contas-receber:open-new-account", onOpenNewAccount);
      window.removeEventListener("page-tour:contas-receber:fill-account", onFillAccount);
      window.removeEventListener("page-tour:contas-receber:close-modal", onCloseModal);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    return items
      .map(item => ({
        ...item,
        status: isOverdue(item.due_date, item.status as AccountStatus) ? "overdue" as AccountStatus : item.status as AccountStatus,
      }))
      .filter(item => {
        if (statusFilter !== "all" && item.status !== statusFilter) return false;
        if (periodPreset !== "all") {
          const due = item.due_date.substring(0, 10);
          if (due < dateFrom || due > dateTo) return false;
        }
        if (search && !item.description.toLowerCase().includes(search.toLowerCase()) &&
            !(item.customer_name || "").toLowerCase().includes(search.toLowerCase())) return false;
        return true;
      });
  }, [items, statusFilter, periodPreset, dateFrom, dateTo, search]);

  const totalPending  = items.filter(i => i.status === "pending" && !isOverdue(i.due_date, i.status as AccountStatus)).reduce((a, i) => a + Number(i.amount), 0);
  const totalOverdue  = items.filter(i => isOverdue(i.due_date, i.status as AccountStatus)).reduce((a, i) => a + Number(i.amount), 0);
  const totalReceived = items.filter(i => i.status === "received").reduce((a, i) => a + Number(i.amount), 0);
  const dueSoonItems = items.filter(i => isDueSoon(i.due_date, i.status as AccountStatus));
  const totalDueSoon = dueSoonItems.reduce((a, i) => a + Number(i.amount), 0);

  const isFormModal = modalMode === "create" || modalMode === "edit";
  const statusCounts = items.reduce<Record<string, number>>((acc, i) => {
    const eff = isOverdue(i.due_date, i.status as AccountStatus) ? "overdue" : i.status;
    acc[eff] = (acc[eff] || 0) + 1;
    return acc;
  }, {});
  const statusTabItems = STATUS_TABS.map((t) => ({ ...t, badge: t.id === "all" ? items.length : (statusCounts[t.id] || 0) }));
  const [formTab, setFormTab] = useState<FormTabId>("dados");
  useEffect(() => { if (!isFormModal) setFormTab("dados"); }, [isFormModal]);

  // O componente Tabs não repassa atributos aos botões; o tour do produto clica
  // nas abas por data-tour, então marcamos os botões após cada render.
  const tabsWrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const tabs = tabsWrapRef.current?.querySelectorAll<HTMLElement>('[role="tab"]');
    tabs?.forEach((el, idx) => {
      el.setAttribute("data-tour", idx === 1 ? "contas-receber-crediario-tab-btn" : "contas-receber-admin-tab-btn");
    });
  }, [mainTab]);

  return (
    <PageWrapper>
      <div data-tour="contas-receber-page" className="space-y-4">
        <SectionTitle
          title="Contas a Receber"
          description="Controle de recebimentos e vencimentos"
          icon={Wallet}
          action={
            <div className="flex flex-wrap items-center gap-2">
              {mainTab === "admin" && (
                <Button
                  data-tour="contas-receber-new-btn"
                  size="sm"
                  variant="success"
                  onClick={openCreate}
                  iconLeft={<Plus size={14} />}
                >
                  Nova Conta
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                iconLeft={<HelpCircle size={14} />}
                onClick={() => tourRef.current?.start()}
                title="Tour guiado desta página"
              >
                <span className="sr-only sm:not-sr-only">Ajuda</span>
              </Button>
            </div>
          }
        />

        <ContasReceberPageTour ref={tourRef} />

        <div data-tour="contas-receber-tabs" ref={tabsWrapRef}>
          <Tabs<MainTabId> items={MAIN_TABS} value={mainTab} onChange={setMainTab} label="Contas a receber">
            {mainTab === "crediario" && <CrediarioTab />}

            {mainTab === "admin" && (
              <div className="space-y-4">
                {/* Summary cards */}
                <StatGrid cols={4} data-tour="contas-receber-summary-cards">
                  <StatCard
                    title="A Receber"
                    value={`R$ ${fmt(totalPending)}`}
                    description={`${items.filter(i => i.status === "pending" && !isOverdue(i.due_date, i.status as AccountStatus)).length} contas pendentes`}
                    icon={Clock}
                    color="warning"
                  />
                  <StatCard
                    title="Vencendo em Breve"
                    value={`R$ ${fmt(totalDueSoon)}`}
                    description={`${dueSoonItems.length} nos próximos ${DUE_SOON_DAYS} dias`}
                    icon={AlertCircle}
                    color="warning"
                  />
                  <StatCard
                    title="Vencidas"
                    value={`R$ ${fmt(totalOverdue)}`}
                    description={`${items.filter(i => isOverdue(i.due_date, i.status as AccountStatus)).length} contas vencidas`}
                    icon={AlertCircle}
                    color="danger"
                  />
                  <StatCard
                    title="Recebido"
                    value={`R$ ${fmt(totalReceived)}`}
                    description={`${items.filter(i => i.status === "received").length} contas recebidas`}
                    icon={TrendingUp}
                    color="success"
                  />
                </StatGrid>

                <div data-tour="contas-receber-status-filters">

                <Tabs<StatusTabId> items={statusTabItems} value={statusFilter as StatusTabId} onChange={setStatusFilter} label="Filtrar por situação">

                <div className="space-y-4">

                {/* Filtros */}
                <div className="space-y-3">
                  <FilterLine>
                    <FilterLineSection grow>
                      <FilterLineSearch
                        aria-label="Buscar contas a receber"
                        placeholder="Buscar por descrição ou cliente..."
                        value={search}
                        onChange={setSearch}
                      />
                    </FilterLineSection>
                  </FilterLine>

                  <FilterLine data-tour="contas-receber-period-nav">
                    <FilterLineSection wrap>
                      {/* ← Mês/Ano → navigator — só faz sentido com Mês ou Ano selecionado */}
                      {(periodPreset === "month" || periodPreset === "year") && (
                        <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-0.5">
                          <IconButton size="sm" aria-label="Período anterior" onClick={() => navigatePeriod(-1)}>
                            <ChevronLeft size={14} />
                          </IconButton>
                          <span className="flex h-8 min-w-[140px] items-center justify-center px-3 text-xs font-medium text-slate-800">
                            {periodPreset === "year" ? navYear : `${MONTHS[navMonth]} ${navYear}`}
                          </span>
                          <IconButton size="sm" aria-label="Próximo período" onClick={() => navigatePeriod(1)}>
                            <ChevronRight size={14} />
                          </IconButton>
                        </div>
                      )}

                      {/* Tudo / Mês / Ano / Período Livre */}
                      <FilterLineSegmented<string>
                        value={periodPreset === "custom" ? "" : periodPreset}
                        onChange={(v) => applyPeriodPreset(v as "all" | "month" | "year")}
                        options={[
                          { value: "all", label: "Tudo" },
                          { value: "month", label: "Mês" },
                          { value: "year", label: "Ano" },
                        ]}
                      />
                      <Button
                        size="sm"
                        variant={periodPreset === "custom" ? "primary" : "outline"}
                        onClick={() => setPeriodPreset(periodPreset === "custom" ? "all" : "custom")}
                        iconLeft={<Calendar size={14} />}
                      >
                        Período Livre
                      </Button>
                      {periodPreset === "custom" && (
                        <div className="flex flex-wrap items-center gap-2">
                          <Input
                            type="date" aria-label="Data inicial" value={dateFrom}
                            onChange={(e) => setDateFrom(e.target.value)}
                            wrapperClassName="w-[148px]"
                          />
                          <span className="text-xs text-slate-500">até</span>
                          <Input
                            type="date" aria-label="Data final" value={dateTo}
                            onChange={(e) => setDateTo(e.target.value)}
                            wrapperClassName="w-[148px]"
                          />
                        </div>
                      )}
                    </FilterLineSection>
                    <FilterLineSection align="right">
                      <div className="relative" ref={exportRef}>
                        <Button
                          data-tour="contas-receber-export-btn"
                          size="sm"
                          variant="outline"
                          onClick={() => setShowExport(!showExport)}
                          iconLeft={<Download size={14} />}
                          iconRight={<ChevronDown size={12} />}
                        >
                          <span className="hidden sm:block">Exportar</span>
                        </Button>
                        {showExport && (
                          <div className="absolute right-0 top-10 z-50 w-52 overflow-hidden rounded-lg border border-slate-200 bg-white">
                            <button
                              type="button"
                              onClick={() => { exportReceivablesToExcel(filtered, tenant); setShowExport(false); }}
                              className="flex w-full items-center gap-3 px-4 py-2.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
                            >
                              <FileSpreadsheet size={14} className="text-emerald-600" /> Excel (.xlsx)
                            </button>
                            <div className="mx-3 h-px bg-slate-100" />
                            <button
                              type="button"
                              onClick={() => { exportReceivablesToPDF(filtered, tenant); setShowExport(false); }}
                              className="flex w-full items-center gap-3 px-4 py-2.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
                            >
                              <FileText size={14} className="text-rose-600" /> PDF / Imprimir
                            </button>
                            <div className="mx-3 h-px bg-slate-100" />
                            <button
                              type="button"
                              onClick={() => { setImportResult(null); setShowImportModal(true); setShowExport(false); }}
                              className="flex w-full items-center gap-3 px-4 py-2.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
                            >
                              <Upload size={14} className="text-blue-600" /> Importar Planilha
                            </button>
                          </div>
                        )}
                      </div>
                    </FilterLineSection>
                  </FilterLine>

                  {selectedIds.size > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="mr-1 text-xs font-medium text-slate-500">
                        {selectedIds.size} selecionada{selectedIds.size > 1 ? "s" : ""}
                      </span>
                      <Button
                        size="sm"
                        variant="success"
                        onClick={handleBulkReceive}
                        loading={bulkReceiving}
                        iconLeft={<CheckCircle2 size={14} />}
                      >
                        Marcar como recebida(s)
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => setShowBulkDeleteConfirm(true)}
                        iconLeft={<Trash2 size={14} />}
                      >
                        Excluir selecionada(s)
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
                        Limpar
                      </Button>
                    </div>
                  )}
                </div>

                {/* Table */}
                <ContentCard padding="none" className="overflow-hidden">
                  {/* Desktop table */}
                  <div data-tour="contas-receber-table" className="hidden overflow-x-auto lg:block">
                    {loading ? (
                      <div role="status" className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
                        <Loader2 size={18} className="animate-spin" /> Carregando contas…
                      </div>
                    ) : (
                      <table className="w-full whitespace-nowrap border-collapse text-left">
                        <thead>
                          <tr className="border-b border-slate-200 bg-zinc-50">
                            <th className="w-8 px-4 py-2">
                              <input
                                type="checkbox"
                                aria-label="Selecionar todas"
                                checked={filtered.length > 0 && filtered.every((i) => selectedIds.has(i.id))}
                                onChange={() => {
                                  setSelectedIds((prev) => {
                                    const allSelected = filtered.length > 0 && filtered.every((i) => prev.has(i.id));
                                    return allSelected ? new Set() : new Set(filtered.map((i) => i.id));
                                  });
                                }}
                                className="h-4 w-4 accent-blue-600"
                              />
                            </th>
                            <th className="px-4 py-2 text-[11px] font-medium text-slate-500">Descrição</th>
                            <th className="px-4 py-2 text-[11px] font-medium text-slate-500">Cliente</th>
                            <th className="px-4 py-2 text-[11px] font-medium text-slate-500">Vencimento</th>
                            <th className="px-4 py-2 text-[11px] font-medium text-slate-500">Recebimento</th>
                            <th className="px-4 py-2 text-[11px] font-medium text-slate-500">Status</th>
                            <th className="px-4 py-2 text-right text-[11px] font-medium text-slate-500">Valor</th>
                            <th className="px-4 py-2 text-center text-[11px] font-medium text-slate-500">Ações</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filtered.map((item) => {
                            const st = STATUS_CONFIG[item.status];
                            return (
                              <tr key={item.id} className="border-b border-slate-100 transition-colors hover:bg-slate-50/60">
                                <td className="px-4 py-2">
                                  <input type="checkbox" aria-label="Selecionar conta" checked={selectedIds.has(item.id)} onChange={() => toggleSelected(item.id)} className="h-4 w-4 accent-blue-600" />
                                </td>
                                <td className="px-4 py-2">
                                  <span className="text-xs font-medium text-slate-800">{item.description}</span>
                                  {item.category && (
                                    <Badge size="sm" color="primary" className="ml-2">{item.category}</Badge>
                                  )}
                                  {item.series && (
                                    <Badge size="sm" color="purple" className="ml-2" icon={<Layers size={10} />}>
                                      {item.installment_number}/{item.series.installments_count}
                                    </Badge>
                                  )}
                                  {item.is_recurring && (
                                    <Badge size="sm" color="info" className="ml-2" icon={<Repeat size={10} />}>Recorrente</Badge>
                                  )}
                                </td>
                                <td className="px-4 py-2 text-xs text-slate-500">{item.customer_name || "—"}</td>
                                <td className="px-4 py-2">
                                  <span className={cn(
                                    "rounded-md px-2 py-0.5 text-xs tabular-nums",
                                    item.status === "overdue" ? "bg-rose-50 text-rose-600"
                                      : isDueSoon(item.due_date, item.status) ? "bg-amber-50 text-amber-700"
                                      : "bg-slate-100 text-slate-500"
                                  )}>
                                    {formatDateBR(item.due_date)}
                                  </span>
                                </td>
                                <td className="px-4 py-2">
                                  <span className="text-xs tabular-nums text-slate-500">
                                    {formatDateBR(item.received_date)}
                                  </span>
                                </td>
                                <td className="px-4 py-2">
                                  <span className={cn("inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[11px] font-medium", st.bg, st.color)}>
                                    {st.icon}{st.label}
                                  </span>
                                </td>
                                <td className="px-4 py-2 text-right">
                                  <span className="text-xs font-semibold tabular-nums text-emerald-700">R$ {fmt(Number(item.amount))}</span>
                                </td>
                                <td className="px-4 py-2">
                                  <div className="flex items-center justify-center gap-1">
                                    {item.status === "pending" || item.status === "overdue" ? (
                                      <Button
                                        size="xs"
                                        variant="success"
                                        onClick={() => openReceive(item)}
                                        iconLeft={<CheckCircle2 size={12} />}
                                      >
                                        Receber
                                      </Button>
                                    ) : null}
                                    {item.status === "overdue" && (item.series?.interest_rate ?? 0) > 0 && (
                                      <IconButton
                                        size="xs"
                                        variant="outline"
                                        onClick={() => openApplyInterest(item)}
                                        title="Aplicar juros"
                                        aria-label="Aplicar juros"
                                      >
                                        <Percent size={12} />
                                      </IconButton>
                                    )}
                                    <IconButton size="xs" onClick={() => openEdit(item)} aria-label="Editar conta">
                                      <Edit2 size={13} />
                                    </IconButton>
                                    <IconButton size="xs" onClick={() => openDelete(item)} aria-label="Excluir conta" className="hover:bg-rose-50 hover:text-rose-500">
                                      <Trash2 size={13} />
                                    </IconButton>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                          {filtered.length === 0 && (
                            <tr>
                              <td colSpan={8}>
                                <EmptyState icon={Wallet} title="Nenhuma conta encontrada" description="Ajuste os filtros ou cadastre uma nova conta." />
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    )}
                  </div>

                  {/* Mobile list */}
                  <div className="divide-y divide-slate-100 lg:hidden">
                    {loading ? (
                      <div role="status" className="flex items-center justify-center py-10"><Loader2 size={18} className="animate-spin text-slate-400" /></div>
                    ) : filtered.length === 0 ? (
                      <EmptyState icon={Wallet} title="Nenhuma conta" description="Ajuste os filtros ou cadastre uma nova conta." />
                    ) : filtered.map(item => {
                      const st = STATUS_CONFIG[item.status];
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setDetailItem(item)}
                          className="flex w-full items-center gap-3 px-3 py-3 text-left transition-colors active:bg-slate-50"
                        >
                          <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", item.status === "received" ? "bg-emerald-100 text-emerald-600" : item.status === "overdue" ? "bg-rose-100 text-rose-600" : "bg-amber-100 text-amber-600")}>
                            {st.icon}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-medium text-slate-900">
                              {item.description}
                              {item.series && (
                                <span className="ml-1.5 text-[11px] text-violet-500">{item.installment_number}/{item.series.installments_count}</span>
                              )}
                            </p>
                            <p className="mt-0.5 text-[11px] text-slate-500">
                              Vence: {formatDateBR(item.due_date)} · {item.customer_name || "Sem cliente"}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-xs font-semibold tabular-nums text-emerald-700">R$ {fmt(Number(item.amount))}</p>
                            <span className={cn("mt-0.5 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium", st.bg, st.color)}>
                              {st.label}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </ContentCard>

                </div>

                </Tabs>

                </div>
              </div>
            )}
          </Tabs>
        </div>
      </div>

      {/* ─────────────────────── MODALS ─────────────────────────────── */}

      {/* Mobile detail/actions sheet */}
      <Modal
        isOpen={!!detailItem}
        onClose={() => setDetailItem(null)}
        size="sm"
        mobileStyle="bottom-sheet"
        title={detailItem?.description}
        footer={detailItem ? (
          <div className="flex w-full flex-col gap-2">
            {(detailItem.status === "pending" || detailItem.status === "overdue") && (
              <Button
                variant="success"
                fullWidth
                onClick={() => { openReceive(detailItem); setDetailItem(null); }}
                iconLeft={<CheckCircle2 size={14} />}
              >
                Marcar como Recebida
              </Button>
            )}
            {detailItem.status === "overdue" && (detailItem.series?.interest_rate ?? 0) > 0 && (
              <Button
                variant="outline"
                fullWidth
                onClick={() => { openApplyInterest(detailItem); setDetailItem(null); }}
                iconLeft={<Percent size={14} />}
              >
                Aplicar Juros
              </Button>
            )}
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => { openEdit(detailItem); setDetailItem(null); }}
                iconLeft={<Edit2 size={14} />}
              >
                Editar
              </Button>
              <Button
                variant="danger"
                className="flex-1"
                onClick={() => { openDelete(detailItem); setDetailItem(null); }}
                iconLeft={<Trash2 size={14} />}
              >
                Excluir
              </Button>
            </div>
          </div>
        ) : undefined}
      >
        {detailItem && (
          <div className="space-y-2.5">
            <span className={cn("inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[11px] font-medium", STATUS_CONFIG[detailItem.status].bg, STATUS_CONFIG[detailItem.status].color)}>
              {STATUS_CONFIG[detailItem.status].icon}{STATUS_CONFIG[detailItem.status].label}
            </span>
            <dl className="space-y-2">
              <DetailRow label="Valor" value={`R$ ${fmt(Number(detailItem.amount))}`} valueClass="font-semibold tabular-nums text-emerald-700" />
              <DetailRow label="Vencimento" value={formatDateBR(detailItem.due_date)} />
              {detailItem.received_date && (
                <DetailRow label="Recebido em" value={formatDateBR(detailItem.received_date)} />
              )}
              <DetailRow label="Cliente" value={detailItem.customer_name || "—"} />
              {detailItem.category && <DetailRow label="Categoria" value={detailItem.category} />}
              {detailItem.series && (
                <DetailRow label="Parcela" value={`${detailItem.installment_number}/${detailItem.series.installments_count}`} valueClass="font-medium text-violet-600" />
              )}
            </dl>
            {detailItem.notes && (
              <div className="mt-2 border-t border-slate-100 pt-2">
                <p className="mb-1 text-[11px] text-slate-500">Observações</p>
                <p className="text-xs text-slate-600">{detailItem.notes}</p>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Create / Edit Modal */}
      <Modal
        isOpen={isFormModal}
        onClose={closeModal}
        size="lg"
        title={modalMode === "create" ? "Nova Conta a Receber" : "Editar Conta"}
        subtitle="Preencha os dados da conta"
        footer={
          <ModalFooter>
            <Button variant="ghost" size="sm" onClick={closeModal}>Cancelar</Button>
            <Button form="ar-form" type="submit" size="sm" loading={saving}>
              {modalMode === "create" ? "Cadastrar" : "Salvar"}
            </Button>
          </ModalFooter>
        }
      >
        <form
          id="ar-form"
          onSubmit={handleSave}
          onInvalidCapture={(ev) => {
            // Campo obrigatório vazio em aba oculta: o navegador não consegue focar, então trocamos de aba.
            const tabId = (ev.target as HTMLElement).closest("[data-form-tab]")?.getAttribute("data-form-tab") as FormTabId | null | undefined;
            if (tabId && tabId !== formTab) {
              setFormTab(tabId);
              const f = ev.currentTarget;
              requestAnimationFrame(() => f.reportValidity());
            }
          }}
        >
          <Tabs<FormTabId> items={FORM_TABS} value={formTab} onChange={setFormTab} label="Dados da conta a receber">
            <div data-form-tab="dados" className={cn("space-y-4", formTab !== "dados" && "hidden")}>
              <div data-tour="contas-receber-form-description">
                <Input
                  label="Descrição *"
                  iconLeft={<FileText size={14} />}
                  type="text" required placeholder="Ex: Venda para cliente, serviço prestado..."
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                />
              </div>

              {/* Valor + Vencimento */}
              <div data-tour="contas-receber-form-amount-due" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input
                  label="Valor (R$) *"
                  iconLeft={<DollarSign size={14} />}
                  type="number" step="0.01" min="0.01" required placeholder="0,00"
                  value={form.amount}
                  onChange={e => setForm({ ...form, amount: e.target.value })}
                />
                <Input
                  label="Vencimento *"
                  type="date" required
                  value={form.due_date}
                  onChange={e => setForm({ ...form, due_date: e.target.value })}
                />
              </div>

              {/* Cliente + Categoria */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="ds-label">Cliente</label>
                  <Combobox
                    placeholder="Selecionar ou digitar cliente..."
                    searchPlaceholder="Buscar cliente..."
                    clearable
                    freeInput
                    value={form.customer_name}
                    onChange={(v) => setForm({ ...form, customer_name: v })}
                    options={customersList.map((c) => ({ value: c.name, label: c.name }))}
                    onAddNew={handleCreateCustomer}
                  />
                  <p className="text-[11px] text-slate-500">Não achou? Digite o nome e clique em "Adicionar" pra cadastrar.</p>
                </div>
                <Select
                  label="Categoria"
                  value={form.category}
                  onChange={e => setForm({ ...form, category: e.target.value })}
                >
                  <option value="">Selecionar...</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </Select>
              </div>

              <Textarea
                label="Observações"
                placeholder="Observações adicionais..."
                rows={2}
                value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
              />
            </div>

            <div data-form-tab="lancamento" className={cn("space-y-3", formTab !== "lancamento" && "hidden")}>
              {(modalMode === "create" || modalMode === "edit") && (
                <PanelCard title="Tipo de lançamento">
                  <div className="space-y-3">
                    <FilterLineSegmented<string>
                      value={recurrenceEnabled ? "installments" : recurringVariable ? "recurring" : "single"}
                      onChange={(mode) => {
                        setRecurrenceEnabled(mode === "installments");
                        setRecurringVariable(mode === "recurring");
                        if (mode === "installments" && valueMode === "variable") syncVariableAmounts(Number(installmentsCount) || 2, form.amount);
                      }}
                      options={modalMode === "create"
                        ? [{ value: "single", label: "Única" }, { value: "installments", label: "Parcelada" }, { value: "recurring", label: "Recorrente" }]
                        : [{ value: "single", label: "Única" }, { value: "recurring", label: "Recorrente" }]}
                    />
                    <p className="text-[11px] text-slate-500">
                      {recurrenceEnabled
                        ? "Nº de parcelas e valores já conhecidos (ex.: venda parcelada)."
                        : recurringVariable
                          ? "Repete indefinidamente até você encerrar a recorrência."
                          : "Um lançamento avulso, sem repetição."}
                    </p>

                    {recurringVariable && (
                      <div className="space-y-3 pt-1">
                        <div className="space-y-1.5">
                          <label className="ds-label">Valor</label>
                          <FilterLineSegmented<string>
                            value={recurringValueMode}
                            onChange={(m) => setRecurringValueMode(m as "fixed" | "variable")}
                            options={[{ value: "fixed", label: "Fixo" }, { value: "variable", label: "Variável" }]}
                          />
                          <p className="text-[11px] text-slate-500">
                            {recurringValueMode === "fixed"
                              ? "Mesmo valor sempre (ex.: mensalidade, aluguel recebido)."
                              : "Valor muda a cada vez — edite o valor antes de receber cada lançamento."}
                          </p>
                        </div>

                        <div className="space-y-1.5">
                          <label className="ds-label">Repete a cada</label>
                          <div className="flex gap-2 sm:w-2/3">
                            <Input
                              aria-label="Intervalo"
                              type="number" min={1} value={intervalCount}
                              onChange={(e) => setIntervalCount(e.target.value)}
                              wrapperClassName="w-20"
                            />
                            <Select
                              aria-label="Unidade do intervalo"
                              value={intervalUnit}
                              onChange={(e) => setIntervalUnit(e.target.value as "day" | "week" | "month")}
                              wrapperClassName="flex-1"
                            >
                              <option value="day">Dia(s)</option>
                              <option value="week">Semana(s)</option>
                              <option value="month">Mês(es)</option>
                            </Select>
                          </div>
                          <p className="text-[11px] text-slate-500">
                            Ao marcar essa conta como recebida, o próximo lançamento é criado automaticamente com o mesmo valor{recurringValueMode === "variable" ? " (só como estimativa — edite o valor real antes de receber esse próximo)" : ""}.
                          </p>
                        </div>
                      </div>
                    )}

                    {modalMode === "create" && recurrenceEnabled && (
                      <div className="space-y-3 pt-1">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <Input
                            label="Nº de parcelas"
                            type="number" min={2} value={installmentsCount}
                            onChange={(e) => {
                              setInstallmentsCount(e.target.value);
                              if (valueMode === "variable") syncVariableAmounts(Number(e.target.value) || 2, form.amount);
                            }}
                          />
                          <div className="space-y-1.5">
                            <label className="ds-label">A cada</label>
                            <div className="flex gap-2">
                              <Input
                                aria-label="Intervalo"
                                type="number" min={1} value={intervalCount}
                                onChange={(e) => setIntervalCount(e.target.value)}
                                wrapperClassName="w-20"
                              />
                              <Select
                                aria-label="Unidade do intervalo"
                                value={intervalUnit}
                                onChange={(e) => setIntervalUnit(e.target.value as "day" | "week" | "month")}
                                wrapperClassName="flex-1"
                              >
                                <option value="day">Dia(s)</option>
                                <option value="week">Semana(s)</option>
                                <option value="month">Mês(es)</option>
                              </Select>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label className="ds-label">Valor das parcelas</label>
                          <FilterLineSegmented<string>
                            value={valueMode}
                            onChange={(m) => {
                              setValueMode(m as "fixed" | "variable");
                              if (m === "variable") syncVariableAmounts(Number(installmentsCount) || 2, form.amount);
                            }}
                            options={[{ value: "fixed", label: "Dividir igualmente" }, { value: "variable", label: "Personalizar valores" }]}
                          />
                        </div>

                        {valueMode === "variable" && (
                          <div className="max-h-40 space-y-1.5 overflow-y-auto pr-1">
                            {variableAmounts.map((v, i) => (
                              <div key={i} className="flex items-center gap-2">
                                <span className="w-6 shrink-0 text-[11px] text-slate-500">{i + 1}ª</span>
                                <Input
                                  aria-label={`Valor da parcela ${i + 1}`}
                                  type="number" step="0.01" min="0" value={v}
                                  onChange={(e) => setVariableAmounts((prev) => prev.map((p, idx) => idx === i ? e.target.value : p))}
                                  wrapperClassName="flex-1"
                                />
                              </div>
                            ))}
                            <p className={cn("text-right text-[11px] font-medium", variableMismatch ? "text-rose-500" : "text-emerald-600")}>
                              Soma: R$ {fmt(variableSum)} {variableMismatch && `(total informado: R$ ${fmt(Number(form.amount) || 0)})`}
                            </p>
                          </div>
                        )}

                        <div className="space-y-1.5 border-t border-slate-200 pt-3">
                          <label className="ds-label">Juros por atraso (opcional)</label>
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                            <Input
                              label="Taxa (%)"
                              type="number" step="0.01" min="0" value={interestRate} onChange={(e) => setInterestRate(e.target.value)}
                            />
                            <Select
                              label="Por"
                              value={interestPeriod} onChange={(e) => setInterestPeriod(e.target.value as "day" | "month")}
                            >
                              <option value="day">Dia</option>
                              <option value="month">Mês</option>
                            </Select>
                            <Input
                              label="Carência (dias)"
                              type="number" min="0" value={interestGraceDays} onChange={(e) => setInterestGraceDays(e.target.value)}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </PanelCard>
              )}
            </div>
          </Tabs>
        </form>
      </Modal>

      {/* Receive Modal */}
      <Modal
        isOpen={modalMode === "receive" && !!selected}
        onClose={closeModal}
        size="sm"
        title="Baixar Conta"
        subtitle="Confirmar recebimento"
        footer={
          <ModalFooter>
            <Button variant="ghost" size="sm" onClick={closeModal}>Cancelar</Button>
            <Button form="receive-form" type="submit" size="sm" variant="success" loading={saving} iconLeft={<CheckCircle2 size={14} />}>
              Confirmar Recebimento
            </Button>
          </ModalFooter>
        }
      >
        {selected && (
          <div className="space-y-3">
            <div className="space-y-2 rounded-lg border border-slate-200 bg-zinc-50 p-3">
              <div className="flex items-start justify-between gap-3">
                <span className="text-xs text-slate-500">Conta</span>
                <span className="max-w-[200px] break-words text-right text-xs font-medium text-slate-800">{selected.description}</span>
              </div>
              {selected.customer_name && (
                <div className="flex justify-between gap-3">
                  <span className="text-xs text-slate-500">Cliente</span>
                  <span className="text-xs font-medium text-slate-700">{selected.customer_name}</span>
                </div>
              )}
              <div className="flex justify-between gap-3">
                <span className="text-xs text-slate-500">Vencimento</span>
                <span className={cn("text-xs font-medium", selected.status === "overdue" ? "text-rose-600" : "text-slate-700")}>
                  {formatDateBR(selected.due_date)}
                </span>
              </div>
            </div>

            {/* Valor em destaque */}
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-center">
              <p className="mb-1 text-[11px] text-emerald-700">Valor Recebido</p>
              <p className="text-2xl font-semibold tabular-nums text-emerald-700">R$ {fmt(Number(selected.amount))}</p>
            </div>

            {selected.is_recurring && (
              <div className="flex items-center gap-2.5 rounded-lg border border-slate-200 px-3 py-2.5">
                <Repeat size={14} className="shrink-0 text-slate-400" />
                <p className="flex-1 text-xs text-slate-600">
                  {continueRecurring
                    ? "Gerar o próximo lançamento automaticamente após confirmar."
                    : "Não gerar mais lançamentos — encerra a recorrência aqui."}
                </p>
                <Switch checked={continueRecurring} onCheckedChange={setContinueRecurring} aria-label="Gerar próximo lançamento" />
              </div>
            )}

            {/* Data recebimento */}
            <form id="receive-form" onSubmit={handleReceive}>
              <Input
                label="Data do Recebimento"
                type="date" value={receiveDate}
                onChange={e => setReceiveDate(e.target.value)}
              />
            </form>
          </div>
        )}
      </Modal>

      {/* Delete Modal */}
      <ConfirmModal
        isOpen={modalMode === "delete" && !!selected}
        onClose={closeModal}
        onConfirm={handleDelete}
        loading={saving}
        variant="danger"
        title="Excluir conta?"
        confirmLabel="Excluir"
        message={selected ? (
          <>
            <span className="block">{selected.description}</span>
            <span className="mt-1 block font-semibold tabular-nums text-rose-600">R$ {fmt(Number(selected.amount))}</span>
          </>
        ) : ""}
      />

      {/* Bulk Delete Confirm Modal */}
      <ConfirmModal
        isOpen={showBulkDeleteConfirm}
        onClose={() => setShowBulkDeleteConfirm(false)}
        onConfirm={handleBulkDelete}
        loading={bulkDeleting}
        variant="danger"
        title={`Excluir ${selectedIds.size} conta${selectedIds.size > 1 ? "s" : ""}?`}
        confirmLabel="Excluir"
        message="Essa ação não pode ser desfeita."
      />

      {/* Apply Interest Modal */}
      <Modal
        isOpen={!!interestTarget}
        onClose={() => setInterestTarget(null)}
        size="sm"
        title="Aplicar Juros"
        footer={
          <ModalFooter>
            <Button variant="ghost" size="sm" onClick={() => setInterestTarget(null)}>Cancelar</Button>
            <Button size="sm" onClick={handleApplyInterest} loading={applyingInterest}>Aplicar Juros</Button>
          </ModalFooter>
        }
      >
        {interestTarget && (
          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium text-slate-800">{interestTarget.description}</p>
              <p className="mt-1 text-[11px] text-slate-500">
                Vencida em {formatDateBR(interestTarget.due_date)} · Valor atual R$ {fmt(Number(interestTarget.amount))}
              </p>
            </div>
            <Input
              label="Valor do juros (R$)"
              type="number" step="0.01" min="0.01" autoFocus
              value={interestValue}
              onChange={(e) => setInterestValue(e.target.value)}
              hint={`Novo valor da conta: R$ ${fmt(Number(interestTarget.amount) + (Number(interestValue) || 0))}. Essa ação não pode ser desfeita.`}
            />
          </div>
        )}
      </Modal>

      {/* Import Modal */}
      <Modal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        size="md"
        title="Importar Planilha"
        subtitle="Excel (.xlsx) com contas a receber em massa"
        footer={
          <ModalFooter>
            <Button variant="ghost" size="sm" onClick={() => setShowImportModal(false)}>Fechar</Button>
          </ModalFooter>
        }
      >
        <div className="space-y-4">
          <Button variant="outline" fullWidth onClick={downloadImportTemplate} iconLeft={<FileSpreadsheet size={14} />}>
            Baixar Modelo de Planilha
          </Button>
          <p className="text-center text-[11px] text-slate-500">
            Colunas: Descrição, Valor, Vencimento, Cliente, Categoria.
          </p>

          <input
            ref={fileInputRef} type="file" accept=".xlsx" className="hidden" aria-label="Arquivo .xlsx"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImportFile(f); e.target.value = ""; }}
          />
          <Button
            variant="outline"
            fullWidth
            className="h-20 flex-col border-dashed"
            onClick={() => fileInputRef.current?.click()}
            loading={importing}
            iconLeft={importing ? undefined : <Upload size={18} />}
          >
            {importing ? "Importando..." : "Selecionar arquivo .xlsx"}
          </Button>

          {importResult && (
            <div className="max-h-40 space-y-1.5 overflow-y-auto rounded-lg border border-slate-200 p-3">
              <p className="text-xs font-medium text-emerald-700">{importResult.created} conta(s) importada(s)</p>
              {importResult.errors.length > 0 && (
                <>
                  <p className="text-xs font-medium text-rose-600">{importResult.errors.length} linha(s) com erro</p>
                  {importResult.errors.map((e, i) => (
                    <p key={i} className="text-[11px] text-slate-500">Linha {e.row}: {e.error}</p>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      </Modal>
    </PageWrapper>
  );
}
