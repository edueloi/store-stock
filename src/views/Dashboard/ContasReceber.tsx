import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import ExcelJS from "exceljs";
import PageHeader from "../../components/layout/PageHeader";
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
} from "lucide-react";
import { AccountReceivable, AccountStatus, Tenant } from "../../types";
import { cn } from "../../lib/utils";
import { useToast } from "../../components/ui/Toast";
import { onRealtime } from "../../lib/realtime";
import Combobox from "../../components/ui/Combobox";

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
  ws.getRow(4).getCell(1).value = `${items.length} lançamento(s)  ·  Total: R$ ${fmt(total)}`;
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
  .header h1 { font-size: 20px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.1em; }
  .header p { font-size: 10px; color: #64748b; margin-top: 2px; }
  .meta { text-align: right; font-size: 10px; color: #64748b; }
  .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 24px; }
  .card { padding: 14px 16px; border-radius: 10px; border: 1px solid #e2e8f0; }
  .card label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.15em; display: block; margin-bottom: 4px; color: #94a3b8; }
  .card .val { font-size: 18px; font-weight: 900; font-family: monospace; }
  .card.overdue { background: #fff1f2; border-color: #fecdd3; } .card.overdue .val { color: #e11d48; }
  .card.received { background: #ecfdf5; border-color: #a7f3d0; } .card.received .val { color: #059669; }
  .card.total { background: #1e293b; border-color: #1e293b; } .card.total label { color: #64748b; } .card.total .val { color: #fff; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #f8fafc; border-bottom: 2px solid #e2e8f0; padding: 10px 12px; text-align: left; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.15em; color: #94a3b8; }
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Em Aberto</div>
          <div className="text-2xl font-mono font-black text-slate-800">R$ {fmt(totalOpen)}</div>
          <div className="mt-1 text-[9px] font-bold text-slate-400 uppercase">{withOverdue.length} parcelas</div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-rose-200 shadow-sm relative overflow-hidden">
          <div className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Vencidas</div>
          <div className="text-2xl font-mono font-black text-rose-600">R$ {fmt(totalOverdue)}</div>
          <div className="mt-1 text-[9px] font-bold text-slate-400 uppercase">{overdueList.length} parcelas vencidas</div>
          <div className="absolute right-4 top-4 w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center text-rose-400">
            <AlertCircle size={20} />
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Clientes Devedores</div>
          <div className="text-2xl font-mono font-black text-slate-800">{new Set(withOverdue.map((i) => i.customer_id)).size}</div>
          <div className="mt-1 text-[9px] font-bold text-slate-400 uppercase">com parcela em aberto</div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
            <input
              type="text"
              placeholder="Buscar por cliente ou descrição..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 h-9 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-bold uppercase tracking-widest placeholder:text-slate-300 focus:outline-none focus:border-blue-400 transition-all"
            />
          </div>
          <div className="flex gap-1.5">
            {([["all", "Todas"], ["overdue", "Vencidas"]] as const).map(([k, l]) => (
              <button
                key={k}
                onClick={() => setStatusFilter(k)}
                className={cn(
                  "h-9 px-3 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all",
                  statusFilter === k
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-400 border-slate-200 hover:border-slate-400"
                )}
              >{l}</button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50">
                {["Cliente", "Descrição", "Parcela", "Vencimento", "Valor Restante", "Status", ""].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap border-b border-slate-200">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400 text-xs">Nenhuma parcela em aberto</td></tr>
              )}
              {filtered.map((i) => (
                <tr
                  key={i.id}
                  onClick={() => navigate(`/admin/customers/${i.customer_id}?tab=fiado`)}
                  className="border-t border-slate-100 hover:bg-blue-50/40 cursor-pointer transition-colors"
                  title="Ver crediário deste cliente"
                >
                  <td className="px-4 py-2.5 text-xs font-bold text-slate-700 whitespace-nowrap">
                    {i.customer_name}
                    {i.risk_flag && <AlertTriangle size={11} className="inline ml-1.5 text-rose-400" />}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-500">{i.description}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-500 text-center whitespace-nowrap">{i.number}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-500 whitespace-nowrap">{formatDateBR(i.due_date)}</td>
                  <td className="px-4 py-2.5 text-xs font-mono font-bold text-slate-800 whitespace-nowrap">R$ {fmt(i.remaining)}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    {i.isOverdue ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-rose-50 border border-rose-200 text-rose-600">
                        <AlertCircle size={10} /> Vencida há {i.daysLate}d
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-amber-50 border border-amber-200 text-amber-600">
                        <Clock size={10} /> Em aberto
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-right">
                    <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-blue-600">
                      Ver Cliente <ChevronDown size={11} className="-rotate-90" />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function ContasReceber() {
  // "admin" = lançamentos manuais (comportamento existente, intocado); "crediario"
  // = parcelas de venda fiado (CustomerDebtInstallment) — sistema separado no
  // banco (sem FK entre os dois), por isso vive num componente à parte
  // (CrediarioTab) em vez de misturado na mesma lista/filtros.
  const [mainTab, setMainTab] = useState<"admin" | "crediario">("admin");
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contas a Receber"
        subtitle="Controle de recebimentos e vencimentos"
        action={
          mainTab === "admin" ? (
            <button
              onClick={openCreate}
              className="h-9 px-4 bg-emerald-600 text-white rounded-xl flex items-center gap-2 text-[10px] font-black uppercase tracking-widest hover:bg-emerald-500 transition-all active:scale-95"
            >
              <Plus size={13} strokeWidth={3} /> Nova Conta
            </button>
          ) : undefined
        }
      />

      <div className="flex items-center gap-1 bg-slate-100 border border-slate-200 rounded-xl p-1 w-fit">
        {([["admin", "Administrativo"], ["crediario", "Crediário"]] as const).map(([k, l]) => (
          <button
            key={k}
            onClick={() => setMainTab(k)}
            className={cn(
              "h-8 px-4 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
              mainTab === k ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}
          >{l}</button>
        ))}
      </div>

      {mainTab === "crediario" && <CrediarioTab />}

      {mainTab === "admin" && (
      <>
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">A Receber</div>
          <div className="text-2xl font-mono font-black text-amber-600">R$ {fmt(totalPending)}</div>
          <div className="mt-1 text-[9px] font-bold text-slate-400 uppercase">
            {items.filter(i => i.status === "pending" && !isOverdue(i.due_date, i.status as AccountStatus)).length} contas pendentes
          </div>
          <div className="absolute right-4 top-4 w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-400">
            <Clock size={20} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-amber-200 shadow-sm relative overflow-hidden">
          <div className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Vencendo em Breve</div>
          <div className="text-2xl font-mono font-black text-amber-700">R$ {fmt(totalDueSoon)}</div>
          <div className="mt-1 text-[9px] font-bold text-slate-400 uppercase">
            {dueSoonItems.length} nos próximos {DUE_SOON_DAYS} dias
          </div>
          <div className="absolute right-4 top-4 w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600">
            <AlertCircle size={20} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Vencidas</div>
          <div className="text-2xl font-mono font-black text-rose-600">R$ {fmt(totalOverdue)}</div>
          <div className="mt-1 text-[9px] font-bold text-slate-400 uppercase">
            {items.filter(i => isOverdue(i.due_date, i.status as AccountStatus)).length} contas vencidas
          </div>
          <div className="absolute right-4 top-4 w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center text-rose-400">
            <AlertCircle size={20} />
          </div>
        </div>

        <div className="bg-slate-900 p-5 rounded-2xl shadow-xl relative overflow-hidden">
          <div className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2">Recebido</div>
          <div className="text-2xl font-mono font-black text-emerald-400">R$ {fmt(totalReceived)}</div>
          <div className="mt-1 text-[9px] font-bold text-slate-600 uppercase">
            {items.filter(i => i.status === "received").length} contas recebidas
          </div>
          <div className="absolute right-4 top-4 w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-emerald-600">
            <TrendingUp size={20} />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Toolbar */}
        <div className="px-5 py-3 border-b border-slate-100 flex flex-col gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
              <input
                type="text"
                placeholder="Buscar por descrição ou cliente..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 h-9 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-bold uppercase tracking-widest placeholder:text-slate-300 focus:outline-none focus:border-blue-400 transition-all"
              />
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {([["all","Todos"], ["pending","Pendentes"], ["overdue","Vencidos"], ["received","Recebidos"], ["cancelled","Cancelados"]] as const).map(([k, l]) => (
                <button
                  key={k}
                  onClick={() => setStatusFilter(k)}
                  className={cn(
                    "h-9 px-3 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all",
                    statusFilter === k
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white text-slate-400 border-slate-200 hover:border-slate-400"
                  )}
                >{l}</button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* ← Mês/Ano → navigator — só faz sentido com Mês ou Ano selecionado */}
            {(periodPreset === "month" || periodPreset === "year") && (
              <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl p-1">
                <button
                  onClick={() => navigatePeriod(-1)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:bg-white hover:text-slate-900 transition-all"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                </button>
                <span className="px-3 h-7 flex items-center rounded-lg text-[11px] font-black uppercase tracking-widest bg-slate-900 text-white min-w-[140px] justify-center">
                  {periodPreset === "year" ? navYear : `${MONTHS[navMonth]} ${navYear}`}
                </span>
                <button
                  onClick={() => navigatePeriod(1)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:bg-white hover:text-slate-900 transition-all"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
              </div>
            )}

            {/* Tudo / Mês / Ano / Período Livre */}
            <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl p-1">
              {([["all", "Tudo"], ["month", "Mês"], ["year", "Ano"]] as const).map(([k, l]) => (
                <button
                  key={k}
                  onClick={() => applyPeriodPreset(k)}
                  className={cn(
                    "h-7 px-3 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all",
                    periodPreset === k ? "bg-slate-900 text-white shadow-sm" : "text-slate-500 hover:text-slate-700"
                  )}
                >{l}</button>
              ))}
            </div>
            <button
              onClick={() => setPeriodPreset(periodPreset === "custom" ? "all" : "custom")}
              className={cn(
                "h-9 px-3 rounded-xl flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest border transition-all",
                periodPreset === "custom" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-400 border-slate-200 hover:border-slate-400"
              )}
            >
              <Calendar size={12} /> Período Livre
            </button>
            {periodPreset === "custom" && (
              <div className="flex items-center gap-2">
                <input
                  type="date" value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="pl-3 pr-3 h-9 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-bold focus:outline-none focus:border-blue-400 transition-all w-[148px]"
                />
                <span className="text-[10px] font-black text-slate-300 uppercase">até</span>
                <input
                  type="date" value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="pl-3 pr-3 h-9 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-bold focus:outline-none focus:border-blue-400 transition-all w-[148px]"
                />
              </div>
            )}
            <div className="relative ml-auto" ref={exportRef}>
              <button
                onClick={() => setShowExport(!showExport)}
                className="h-9 px-3 rounded-lg flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest border border-slate-200 bg-white text-slate-500 hover:border-slate-400 transition-all"
              >
                <Download size={12} />
                <span className="hidden sm:block">Exportar</span>
                <ChevronDown size={10} />
              </button>
              {showExport && (
                <div className="absolute right-0 top-10 w-52 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden">
                  <button
                    onClick={() => { exportReceivablesToExcel(filtered, tenant); setShowExport(false); }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <FileSpreadsheet size={14} className="text-emerald-600" /> Excel (.xlsx)
                  </button>
                  <div className="h-px bg-slate-100 mx-3" />
                  <button
                    onClick={() => { exportReceivablesToPDF(filtered, tenant); setShowExport(false); }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <FileText size={14} className="text-rose-600" /> PDF / Imprimir
                  </button>
                  <div className="h-px bg-slate-100 mx-3" />
                  <button
                    onClick={() => { setImportResult(null); setShowImportModal(true); setShowExport(false); }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <Upload size={14} className="text-blue-600" /> Importar Planilha
                  </button>
                </div>
              )}
            </div>
          </div>
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2 px-1">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mr-1">
                {selectedIds.size} selecionada{selectedIds.size > 1 ? "s" : ""}
              </span>
              <button
                onClick={handleBulkReceive}
                disabled={bulkReceiving}
                className="h-8 px-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-all"
              >
                {bulkReceiving ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                Marcar como recebida(s)
              </button>
              <button
                onClick={() => setShowBulkDeleteConfirm(true)}
                className="h-8 px-3 bg-white border border-rose-200 hover:bg-rose-50 text-rose-600 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-all"
              >
                <Trash2 size={12} /> Excluir selecionada(s)
              </button>
              <button onClick={() => setSelectedIds(new Set())} className="text-[9px] font-bold text-slate-400 hover:text-slate-600 uppercase">
                Limpar
              </button>
            </div>
          )}
        </div>

        {/* Desktop table */}
        <div className="hidden lg:block overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={22} className="animate-spin text-slate-300" />
            </div>
          ) : (
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100">
                  <th className="px-5 py-3 w-8">
                    <input
                      type="checkbox"
                      checked={filtered.length > 0 && filtered.every((i) => selectedIds.has(i.id))}
                      onChange={() => {
                        setSelectedIds((prev) => {
                          const allSelected = filtered.length > 0 && filtered.every((i) => prev.has(i.id));
                          return allSelected ? new Set() : new Set(filtered.map((i) => i.id));
                        });
                      }}
                      className="rounded border-slate-300"
                    />
                  </th>
                  <th className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Descrição</th>
                  <th className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Cliente</th>
                  <th className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Vencimento</th>
                  <th className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Recebimento</th>
                  <th className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                  <th className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Valor</th>
                  <th className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item, idx) => {
                  const st = STATUS_CONFIG[item.status];
                  return (
                    <tr key={item.id} className={cn("border-b border-slate-50 hover:bg-slate-50/50 transition-colors", idx % 2 !== 0 && "bg-slate-50/20")}>
                      <td className="px-5 py-3">
                        <input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleSelected(item.id)} className="rounded border-slate-300" />
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-[11px] font-bold text-slate-800 uppercase">{item.description}</span>
                        {item.category && (
                          <span className="ml-2 text-[9px] font-black uppercase tracking-widest text-indigo-500 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded">
                            {item.category}
                          </span>
                        )}
                        {item.series && (
                          <span className="ml-2 inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-violet-500 bg-violet-50 border border-violet-100 px-1.5 py-0.5 rounded">
                            <Layers size={9} /> {item.installment_number}/{item.series.installments_count}
                          </span>
                        )}
                        {item.is_recurring && (
                          <span className="ml-2 inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-blue-500 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded">
                            <Repeat size={9} /> Recorrente
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-[10px] text-slate-500 font-bold">{item.customer_name || "—"}</td>
                      <td className="px-5 py-3">
                        <span className={cn(
                          "text-[10px] font-mono font-bold px-2 py-0.5 rounded-md",
                          item.status === "overdue" ? "bg-rose-50 text-rose-600"
                            : isDueSoon(item.due_date, item.status) ? "bg-amber-50 text-amber-700"
                            : "bg-slate-100 text-slate-500"
                        )}>
                          {formatDateBR(item.due_date)}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md">
                          {formatDateBR(item.received_date)}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className={cn("inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg border", st.bg, st.color)}>
                          {st.icon}{st.label}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span className="font-mono font-black text-sm text-emerald-600">R$ {fmt(Number(item.amount))}</span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-center gap-1">
                          {item.status === "pending" || item.status === "overdue" ? (
                            <button
                              onClick={() => openReceive(item)}
                              className="h-7 px-2.5 bg-emerald-600 text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-emerald-500 transition-all flex items-center gap-1"
                            >
                              <CheckCircle2 size={11} /> Receber
                            </button>
                          ) : null}
                          {item.status === "overdue" && (item.series?.interest_rate ?? 0) > 0 && (
                            <button
                              onClick={() => openApplyInterest(item)}
                              title="Aplicar juros"
                              className="h-7 px-2 bg-amber-50 border border-amber-200 text-amber-600 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-amber-100 transition-all flex items-center gap-1"
                            >
                              <Percent size={11} />
                            </button>
                          )}
                          <button onClick={() => openEdit(item)} className="h-7 w-7 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 transition-all">
                            <Edit2 size={13} />
                          </button>
                          <button onClick={() => openDelete(item)} className="h-7 w-7 flex items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-all">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-5 py-14 text-center text-[10px] font-black uppercase tracking-widest text-slate-300">
                      Nenhuma conta encontrada
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Mobile list */}
        <div className="lg:hidden divide-y divide-slate-50">
          {loading ? (
            <div className="flex items-center justify-center py-10"><Loader2 size={20} className="animate-spin text-slate-300" /></div>
          ) : filtered.length === 0 ? (
            <div className="px-4 py-12 text-center text-[10px] font-black uppercase tracking-widest text-slate-300">Nenhuma conta</div>
          ) : filtered.map(item => {
            const st = STATUS_CONFIG[item.status];
            return (
              <button
                key={item.id}
                onClick={() => setDetailItem(item)}
                className="w-full px-4 py-3.5 flex items-center gap-3 text-left active:bg-slate-50 transition-colors"
              >
                <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0", item.status === "received" ? "bg-emerald-100 text-emerald-600" : item.status === "overdue" ? "bg-rose-100 text-rose-600" : "bg-amber-100 text-amber-600")}>
                  {st.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-bold text-slate-900 uppercase truncate">
                    {item.description}
                    {item.series && (
                      <span className="ml-1.5 text-[9px] font-black text-violet-500">{item.installment_number}/{item.series.installments_count}</span>
                    )}
                  </p>
                  <p className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">
                    Vence: {formatDateBR(item.due_date)} · {item.customer_name || "Sem cliente"}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-mono font-black text-emerald-600">R$ {fmt(Number(item.amount))}</p>
                  <span className={cn("inline-flex items-center gap-1 text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded mt-0.5", st.bg, st.color)}>
                    {st.label}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Mobile detail/actions sheet */}
      {detailItem && (
        <div className="fixed inset-0 z-[190] flex items-end sm:items-center justify-center lg:hidden">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setDetailItem(null)} />
          <div className="relative w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div className="min-w-0">
                <h3 className="text-[12px] font-black uppercase text-slate-900 truncate">{detailItem.description}</h3>
                <span className={cn("inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg border mt-1", STATUS_CONFIG[detailItem.status].bg, STATUS_CONFIG[detailItem.status].color)}>
                  {STATUS_CONFIG[detailItem.status].icon}{STATUS_CONFIG[detailItem.status].label}
                </span>
              </div>
              <button onClick={() => setDetailItem(null)} className="w-8 h-8 shrink-0 flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 transition-all">
                <X size={16} />
              </button>
            </div>

            <div className="px-5 py-4 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-bold uppercase text-[9px] tracking-widest">Valor</span>
                <span className="font-mono font-black text-emerald-600">R$ {fmt(Number(detailItem.amount))}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-bold uppercase text-[9px] tracking-widest">Vencimento</span>
                <span className="font-mono font-bold text-slate-700">{formatDateBR(detailItem.due_date)}</span>
              </div>
              {detailItem.received_date && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-bold uppercase text-[9px] tracking-widest">Recebido em</span>
                  <span className="font-mono font-bold text-slate-700">{formatDateBR(detailItem.received_date)}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-bold uppercase text-[9px] tracking-widest">Cliente</span>
                <span className="font-bold text-slate-700">{detailItem.customer_name || "—"}</span>
              </div>
              {detailItem.category && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-bold uppercase text-[9px] tracking-widest">Categoria</span>
                  <span className="font-bold text-slate-700">{detailItem.category}</span>
                </div>
              )}
              {detailItem.series && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-bold uppercase text-[9px] tracking-widest">Parcela</span>
                  <span className="font-bold text-violet-600">{detailItem.installment_number}/{detailItem.series.installments_count}</span>
                </div>
              )}
              {detailItem.notes && (
                <div className="pt-1.5 border-t border-slate-100 mt-2">
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mb-1">Observações</p>
                  <p className="text-xs text-slate-600">{detailItem.notes}</p>
                </div>
              )}
            </div>

            <div className="px-5 pb-5 pt-1 flex flex-col gap-2">
              {(detailItem.status === "pending" || detailItem.status === "overdue") && (
                <button
                  onClick={() => { openReceive(detailItem); setDetailItem(null); }}
                  className="h-11 bg-emerald-600 text-white rounded-xl text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all"
                >
                  <CheckCircle2 size={14} /> Marcar como Recebida
                </button>
              )}
              {detailItem.status === "overdue" && (detailItem.series?.interest_rate ?? 0) > 0 && (
                <button
                  onClick={() => { openApplyInterest(detailItem); setDetailItem(null); }}
                  className="h-11 bg-amber-50 border border-amber-200 text-amber-700 rounded-xl text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all"
                >
                  <Percent size={14} /> Aplicar Juros
                </button>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => { openEdit(detailItem); setDetailItem(null); }}
                  className="flex-1 h-11 bg-slate-100 text-slate-700 rounded-xl text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all"
                >
                  <Edit2 size={14} /> Editar
                </button>
                <button
                  onClick={() => { openDelete(detailItem); setDetailItem(null); }}
                  className="flex-1 h-11 bg-white border border-rose-200 text-rose-600 rounded-xl text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all"
                >
                  <Trash2 size={14} /> Excluir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────── MODALS ─────────────────────────────── */}

      {/* Create / Edit Modal */}
      {isFormModal && (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center sm:p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative w-full sm:max-w-lg bg-white sm:rounded-2xl rounded-t-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h2 className="text-[13px] font-black uppercase tracking-widest text-slate-900">
                  {modalMode === "create" ? "Nova Conta a Receber" : "Editar Conta"}
                </h2>
                <p className="text-[10px] text-slate-400 mt-0.5">Preencha os dados da conta</p>
              </div>
              <button onClick={closeModal} className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-all">
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <form id="ar-form" onSubmit={handleSave} className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
              {/* Descrição */}
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-[9px] font-black text-slate-400 uppercase tracking-[0.18em]">
                  <FileText size={10} /> Descrição *
                </label>
                <input
                  type="text" required placeholder="Ex: Venda para cliente, serviço prestado..."
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 h-11 text-xs font-bold focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-400 outline-none transition-all"
                />
              </div>

              {/* Valor + Vencimento */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-[9px] font-black text-slate-400 uppercase tracking-[0.18em]">
                    <DollarSign size={10} /> Valor (R$) *
                  </label>
                  <input
                    type="number" step="0.01" min="0.01" required placeholder="0,00"
                    value={form.amount}
                    onChange={e => setForm({ ...form, amount: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 h-11 text-sm font-mono font-bold focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-400 outline-none transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-[9px] font-black text-slate-400 uppercase tracking-[0.18em]">
                    <Calendar size={10} /> Vencimento *
                  </label>
                  <input
                    type="date" required
                    value={form.due_date}
                    onChange={e => setForm({ ...form, due_date: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 h-11 text-xs font-bold focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-400 outline-none transition-all"
                  />
                </div>
              </div>

              {/* Cliente + Categoria */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-[9px] font-black text-slate-400 uppercase tracking-[0.18em]">
                    <User size={10} /> Cliente
                  </label>
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
                  <p className="text-[9px] text-slate-400 px-1">Não achou? Digite o nome e clique em "Adicionar" pra cadastrar.</p>
                </div>
                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-[9px] font-black text-slate-400 uppercase tracking-[0.18em]">
                    <Tag size={10} /> Categoria
                  </label>
                  <select
                    value={form.category}
                    onChange={e => setForm({ ...form, category: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 h-11 text-xs font-bold focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-400 outline-none transition-all appearance-none"
                  >
                    <option value="">Selecionar...</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              {(modalMode === "create" || modalMode === "edit") && (
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-3">
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-1.5 text-[9px] font-black text-slate-400 uppercase tracking-[0.16em]">
                      <Repeat size={10} /> Tipo de lançamento
                    </label>
                    <div className={cn("grid gap-1 bg-white border border-slate-200 rounded-lg p-0.5", modalMode === "create" ? "grid-cols-3" : "grid-cols-2")}>
                      {(modalMode === "create"
                        ? ([["single", "Única"], ["installments", "Parcelada"], ["recurring", "Recorrente"]] as const)
                        : ([["single", "Única"], ["recurring", "Recorrente"]] as const)
                      ).map(([mode, label]) => {
                        const active = mode === "installments" ? recurrenceEnabled : mode === "recurring" ? recurringVariable : (!recurrenceEnabled && !recurringVariable);
                        return (
                          <button
                            key={mode} type="button"
                            onClick={() => {
                              setRecurrenceEnabled(mode === "installments");
                              setRecurringVariable(mode === "recurring");
                              if (mode === "installments" && valueMode === "variable") syncVariableAmounts(Number(installmentsCount) || 2, form.amount);
                            }}
                            className={cn("h-8 px-1 rounded-md text-[9px] font-black uppercase tracking-wide transition-all whitespace-nowrap", active ? "bg-emerald-600 text-white" : "text-slate-500")}
                          >{label}</button>
                        );
                      })}
                    </div>
                    <p className="text-[9px] text-slate-400">
                      {recurrenceEnabled
                        ? "Nº de parcelas e valores já conhecidos (ex.: venda parcelada)."
                        : recurringVariable
                          ? "Repete indefinidamente até você encerrar a recorrência."
                          : "Um lançamento avulso, sem repetição."}
                    </p>
                  </div>

                  {recurringVariable && (
                    <div className="space-y-3 pt-1">
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.16em]">Valor</label>
                        <div className="flex bg-white border border-slate-200 rounded-lg p-0.5 gap-0.5 w-fit">
                          {([["fixed", "Fixo"], ["variable", "Variável"]] as const).map(([m, l]) => (
                            <button
                              key={m} type="button"
                              onClick={() => setRecurringValueMode(m)}
                              className={cn("h-8 px-3 rounded-md text-[9px] font-black uppercase tracking-wide transition-all", recurringValueMode === m ? "bg-emerald-600 text-white" : "text-slate-500")}
                            >{l}</button>
                          ))}
                        </div>
                        <p className="text-[9px] text-slate-400">
                          {recurringValueMode === "fixed"
                            ? "Mesmo valor sempre (ex.: mensalidade, aluguel recebido)."
                            : "Valor muda a cada vez — edite o valor antes de receber cada lançamento."}
                        </p>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.16em]">Repete a cada</label>
                        <div className="flex gap-1.5 w-1/2">
                          <input
                            type="number" min={1} value={intervalCount}
                            onChange={(e) => setIntervalCount(e.target.value)}
                            className="w-14 bg-white border border-slate-200 rounded-lg px-2 h-9 text-xs font-bold outline-none focus:border-emerald-400"
                          />
                          <select
                            value={intervalUnit}
                            onChange={(e) => setIntervalUnit(e.target.value as "day" | "week" | "month")}
                            className="flex-1 bg-white border border-slate-200 rounded-lg px-2 h-9 text-xs font-bold outline-none focus:border-emerald-400 appearance-none"
                          >
                            <option value="day">Dia(s)</option>
                            <option value="week">Semana(s)</option>
                            <option value="month">Mês(es)</option>
                          </select>
                        </div>
                        <p className="text-[9px] text-slate-400">
                          Ao marcar essa conta como recebida, o próximo lançamento é criado automaticamente com o mesmo valor{recurringValueMode === "variable" ? " (só como estimativa — edite o valor real antes de receber esse próximo)" : ""}.
                        </p>
                      </div>
                    </div>
                  )}

                  {modalMode === "create" && recurrenceEnabled && (
                    <div className="space-y-3 pt-1">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.16em]">Nº de parcelas</label>
                          <input
                            type="number" min={2} value={installmentsCount}
                            onChange={(e) => {
                              setInstallmentsCount(e.target.value);
                              if (valueMode === "variable") syncVariableAmounts(Number(e.target.value) || 2, form.amount);
                            }}
                            className="w-full bg-white border border-slate-200 rounded-lg px-3 h-9 text-xs font-bold outline-none focus:border-emerald-400"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.16em]">A cada</label>
                          <div className="flex gap-1.5">
                            <input
                              type="number" min={1} value={intervalCount}
                              onChange={(e) => setIntervalCount(e.target.value)}
                              className="w-14 bg-white border border-slate-200 rounded-lg px-2 h-9 text-xs font-bold outline-none focus:border-emerald-400"
                            />
                            <select
                              value={intervalUnit}
                              onChange={(e) => setIntervalUnit(e.target.value as "day" | "week" | "month")}
                              className="flex-1 bg-white border border-slate-200 rounded-lg px-2 h-9 text-xs font-bold outline-none focus:border-emerald-400 appearance-none"
                            >
                              <option value="day">Dia(s)</option>
                              <option value="week">Semana(s)</option>
                              <option value="month">Mês(es)</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.16em]">Valor das parcelas</label>
                        <div className="flex bg-white border border-slate-200 rounded-lg p-0.5 gap-0.5 w-fit">
                          {([["fixed", "Dividir igualmente"], ["variable", "Personalizar valores"]] as const).map(([m, l]) => (
                            <button
                              key={m} type="button"
                              onClick={() => {
                                setValueMode(m);
                                if (m === "variable") syncVariableAmounts(Number(installmentsCount) || 2, form.amount);
                              }}
                              className={cn("h-8 px-3 rounded-md text-[9px] font-black uppercase tracking-wide transition-all", valueMode === m ? "bg-emerald-600 text-white" : "text-slate-500")}
                            >{l}</button>
                          ))}
                        </div>
                      </div>

                      {valueMode === "variable" && (
                        <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                          {variableAmounts.map((v, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <span className="text-[9px] font-black text-slate-400 w-6 shrink-0">{i + 1}ª</span>
                              <input
                                type="number" step="0.01" min="0" value={v}
                                onChange={(e) => setVariableAmounts((prev) => prev.map((p, idx) => idx === i ? e.target.value : p))}
                                className="flex-1 bg-white border border-slate-200 rounded-lg px-3 h-8 text-xs font-mono font-bold outline-none focus:border-emerald-400"
                              />
                            </div>
                          ))}
                          <p className={cn("text-[9px] font-bold text-right", variableMismatch ? "text-rose-500" : "text-emerald-600")}>
                            Soma: R$ {fmt(variableSum)} {variableMismatch && `(total informado: R$ ${fmt(Number(form.amount) || 0)})`}
                          </p>
                        </div>
                      )}

                      <div className="pt-1 border-t border-slate-200 space-y-1.5">
                        <label className="flex items-center gap-1.5 text-[9px] font-black text-slate-400 uppercase tracking-[0.16em]">
                          <Percent size={10} /> Juros por atraso (opcional)
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="text-[8px] font-bold text-slate-400 uppercase">Taxa (%)</label>
                            <input type="number" step="0.01" min="0" value={interestRate} onChange={(e) => setInterestRate(e.target.value)}
                              className="w-full bg-white border border-slate-200 rounded-lg px-2 h-9 text-xs font-bold outline-none focus:border-emerald-400" />
                          </div>
                          <div>
                            <label className="text-[8px] font-bold text-slate-400 uppercase">Por</label>
                            <select value={interestPeriod} onChange={(e) => setInterestPeriod(e.target.value as "day" | "month")}
                              className="w-full bg-white border border-slate-200 rounded-lg px-2 h-9 text-xs font-bold outline-none focus:border-emerald-400 appearance-none">
                              <option value="day">Dia</option>
                              <option value="month">Mês</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[8px] font-bold text-slate-400 uppercase">Carência (dias)</label>
                            <input type="number" min="0" value={interestGraceDays} onChange={(e) => setInterestGraceDays(e.target.value)}
                              className="w-full bg-white border border-slate-200 rounded-lg px-2 h-9 text-xs font-bold outline-none focus:border-emerald-400" />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Observações */}
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-[9px] font-black text-slate-400 uppercase tracking-[0.18em]">
                  <StickyNote size={10} /> Observações
                </label>
                <textarea
                  placeholder="Observações adicionais..."
                  rows={2}
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-400 outline-none transition-all resize-none"
                />
              </div>
            </form>

            {/* Footer */}
            <div className="px-6 pb-5 flex gap-3">
              <button
                type="button" onClick={closeModal}
                className="flex-1 h-11 border border-slate-200 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                form="ar-form" type="submit" disabled={saving}
                className="flex-1 h-11 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-emerald-200 flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : modalMode === "create" ? "Cadastrar" : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receive Modal */}
      {modalMode === "receive" && selected && (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center sm:p-4">
          <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative w-full sm:max-w-md bg-[#0f172a] sm:rounded-2xl rounded-t-2xl shadow-2xl overflow-hidden border border-white/10 max-h-[92vh] flex flex-col">
            {/* Header dark */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Confirmar Recebimento</p>
                <h2 className="text-[15px] font-black uppercase tracking-wider text-white mt-0.5">Baixar Conta</h2>
              </div>
              <button onClick={closeModal} className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-500 hover:bg-white/10 transition-all">
                <X size={16} />
              </button>
            </div>

            {/* Resumo */}
            <div className="px-6 py-5 space-y-3 overflow-y-auto flex-1">
              <div className="bg-white/5 rounded-xl p-4 space-y-2">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Conta</span>
                  <span className="text-[11px] font-bold text-white text-right max-w-[200px]">{selected.description}</span>
                </div>
                {selected.customer_name && (
                  <div className="flex justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Cliente</span>
                    <span className="text-[11px] font-bold text-slate-300">{selected.customer_name}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Vencimento</span>
                  <span className={cn("text-[11px] font-bold", selected.status === "overdue" ? "text-rose-400" : "text-slate-300")}>
                    {formatDateBR(selected.due_date)}
                  </span>
                </div>
              </div>

              {/* Valor em destaque */}
              <div className="bg-emerald-600/20 border border-emerald-500/30 rounded-xl p-4 text-center">
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-400/70 mb-1">Valor Recebido</p>
                <p className="text-3xl font-mono font-black text-emerald-400">R$ {fmt(Number(selected.amount))}</p>
              </div>

              {selected.is_recurring && (
                <button
                  type="button"
                  onClick={() => setContinueRecurring((v) => !v)}
                  className="w-full flex items-center gap-2.5 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-left"
                >
                  <Repeat size={13} className="text-slate-400 shrink-0" />
                  <p className="text-[10px] text-slate-400 flex-1">
                    {continueRecurring
                      ? "Gerar o próximo lançamento automaticamente após confirmar."
                      : "Não gerar mais lançamentos — encerra a recorrência aqui."}
                  </p>
                  <span className={cn("w-9 h-5 rounded-full relative transition-all shrink-0", continueRecurring ? "bg-emerald-500" : "bg-slate-600")}>
                    <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-all", continueRecurring ? "left-4" : "left-0.5")} />
                  </span>
                </button>
              )}

              {/* Data recebimento */}
              <form id="receive-form" onSubmit={handleReceive}>
                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-[9px] font-black text-slate-400 uppercase tracking-[0.18em]">
                    <Calendar size={10} /> Data do Recebimento
                  </label>
                  <input
                    type="date" value={receiveDate}
                    onChange={e => setReceiveDate(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 h-11 text-xs font-bold text-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/50 outline-none transition-all"
                  />
                </div>
              </form>
            </div>

            {/* Footer */}
            <div className="px-6 pb-6 flex gap-3">
              <button
                type="button" onClick={closeModal}
                className="flex-1 h-12 border border-white/10 text-[10px] font-black uppercase tracking-widest rounded-xl text-slate-400 hover:bg-white/5 transition-colors"
              >
                Cancelar
              </button>
              <button
                form="receive-form" type="submit" disabled={saving}
                className="flex-1 h-12 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/50"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <><CheckCircle2 size={14} /> Confirmar Recebimento</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {modalMode === "delete" && selected && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-6 py-5 text-center">
              <div className="w-14 h-14 bg-rose-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Trash2 size={24} className="text-rose-500" />
              </div>
              <h2 className="text-[13px] font-black uppercase tracking-widest text-slate-900 mb-1">Excluir Conta?</h2>
              <p className="text-xs text-slate-500">{selected.description}</p>
              <p className="text-sm font-mono font-black text-rose-600 mt-1">R$ {fmt(Number(selected.amount))}</p>
            </div>
            <div className="px-6 pb-5 flex gap-3">
              <button onClick={closeModal} className="flex-1 h-11 border border-slate-200 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-slate-50 transition-colors">
                Cancelar
              </button>
              <button
                onClick={handleDelete} disabled={saving}
                className="flex-1 h-11 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : "Excluir"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirm Modal */}
      {showBulkDeleteConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowBulkDeleteConfirm(false)} />
          <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-6 py-5 text-center">
              <div className="w-14 h-14 bg-rose-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Trash2 size={24} className="text-rose-500" />
              </div>
              <h2 className="text-[13px] font-black uppercase tracking-widest text-slate-900 mb-1">Excluir {selectedIds.size} Conta{selectedIds.size > 1 ? "s" : ""}?</h2>
              <p className="text-xs text-slate-500">Essa ação não pode ser desfeita.</p>
            </div>
            <div className="px-6 pb-5 flex gap-3">
              <button onClick={() => setShowBulkDeleteConfirm(false)} className="flex-1 h-11 border border-slate-200 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-slate-50 transition-colors">
                Cancelar
              </button>
              <button
                onClick={handleBulkDelete} disabled={bulkDeleting}
                className="flex-1 h-11 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
              >
                {bulkDeleting ? <Loader2 size={14} className="animate-spin" /> : "Excluir"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Apply Interest Modal */}
      {interestTarget && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setInterestTarget(null)} />
          <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-6 py-5">
              <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Percent size={22} className="text-amber-500" />
              </div>
              <h2 className="text-[13px] font-black uppercase tracking-widest text-slate-900 mb-1 text-center">Aplicar Juros</h2>
              <p className="text-xs text-slate-500 text-center">{interestTarget.description}</p>
              <p className="text-[10px] text-slate-400 text-center mt-1">
                Vencida em {formatDateBR(interestTarget.due_date)} · Valor atual R$ {fmt(Number(interestTarget.amount))}
              </p>
              <div className="mt-4 space-y-1.5">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.16em]">Valor do juros (R$)</label>
                <input
                  type="number" step="0.01" min="0.01" autoFocus
                  value={interestValue}
                  onChange={(e) => setInterestValue(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 h-11 text-sm font-mono font-bold outline-none focus:ring-2 focus:ring-amber-500/10 focus:border-amber-400 transition-all"
                />
                <p className="text-[9px] text-slate-400">
                  Novo valor da conta: R$ {fmt(Number(interestTarget.amount) + (Number(interestValue) || 0))}. Essa ação não pode ser desfeita.
                </p>
              </div>
            </div>
            <div className="px-6 pb-5 flex gap-3">
              <button onClick={() => setInterestTarget(null)} className="flex-1 h-11 border border-slate-200 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-slate-50 transition-colors">
                Cancelar
              </button>
              <button
                onClick={handleApplyInterest} disabled={applyingInterest}
                className="flex-1 h-11 bg-amber-500 hover:bg-amber-400 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
              >
                {applyingInterest ? <Loader2 size={14} className="animate-spin" /> : "Aplicar Juros"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowImportModal(false)} />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h2 className="text-[13px] font-black uppercase tracking-widest text-slate-900">Importar Planilha</h2>
                <p className="text-[10px] text-slate-400 mt-0.5">Excel (.xlsx) com contas a receber em massa</p>
              </div>
              <button onClick={() => setShowImportModal(false)} className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-all">
                <X size={16} />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <button
                onClick={downloadImportTemplate}
                className="w-full flex items-center justify-center gap-2 h-10 rounded-xl border border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 transition-all"
              >
                <FileSpreadsheet size={13} /> Baixar Modelo de Planilha
              </button>
              <p className="text-[9px] text-slate-400 text-center">
                Colunas: Descrição, Valor, Vencimento, Cliente, Categoria.
              </p>

              <input
                ref={fileInputRef} type="file" accept=".xlsx" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImportFile(f); e.target.value = ""; }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
                className="w-full h-24 rounded-xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center gap-2 text-slate-400 hover:border-emerald-400 hover:text-emerald-500 transition-all disabled:opacity-60"
              >
                {importing ? <Loader2 size={20} className="animate-spin" /> : <Upload size={20} />}
                <span className="text-[10px] font-black uppercase tracking-widest">{importing ? "Importando..." : "Selecionar arquivo .xlsx"}</span>
              </button>

              {importResult && (
                <div className="rounded-xl border border-slate-200 p-3 space-y-1.5 max-h-40 overflow-y-auto">
                  <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">{importResult.created} conta(s) importada(s)</p>
                  {importResult.errors.length > 0 && (
                    <>
                      <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest">{importResult.errors.length} linha(s) com erro</p>
                      {importResult.errors.map((e, i) => (
                        <p key={i} className="text-[9px] text-slate-400">Linha {e.row}: {e.error}</p>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
            <div className="px-6 pb-5">
              <button onClick={() => setShowImportModal(false)} className="w-full h-11 border border-slate-200 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-slate-50 transition-colors">
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
      </>
      )}
    </div>
  );
}
