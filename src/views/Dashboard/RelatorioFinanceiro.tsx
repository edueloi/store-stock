import React, { useState, useEffect, useMemo } from "react";
import ExcelJS from "exceljs";
import PageHeader from "../../components/layout/PageHeader";
import {
  ChevronLeft, ChevronRight, Loader2, Download, FileSpreadsheet, FileText,
  ChevronDown, TrendingUp, TrendingDown, Wallet, Calendar, LayoutGrid,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { Tenant } from "../../types";

// ── types (espelham backend/controllers/financial-reports.controller.ts) ─────
type PmKey = "money" | "pix" | "debit" | "credit";
interface CostItem { description: string; amount: number; date: string; source: "financeiro" | "contas_pagar" }
interface MonthReport {
  year: number;
  month: number; // 0-based
  entradas: { byOperator: Record<string, Record<PmKey, number>>; totalByMethod: Record<PmKey, number>; total: number };
  custoFixo: { total: number; items: CostItem[] };
  custoVariavel: { total: number; items: CostItem[] };
}
interface YearlyReport { year: number; months: MonthReport[] }

const PM_KEYS: PmKey[] = ["money", "pix", "debit", "credit"];
const PM_LABELS: Record<PmKey, string> = { money: "Dinheiro", pix: "PIX", debit: "Débito", credit: "Crédito" };
const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const MONTHS_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDateBR = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("pt-BR");
const token = () => localStorage.getItem("token");

// ── Excel export ──────────────────────────────────────────────────────────────
async function exportToExcel(report: YearlyReport, tenant: Partial<Tenant> | null, selectedMonth: number) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "BoxSys Store";
  wb.created = new Date();

  const border = (): Partial<ExcelJS.Borders> => ({
    top: { style: "thin", color: { argb: "FFE2E8F0" } }, bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
    left: { style: "thin", color: { argb: "FFE2E8F0" } }, right: { style: "thin", color: { argb: "FFE2E8F0" } },
  });
  const fill = (hex: string): ExcelJS.Fill => ({ type: "pattern", pattern: "solid", fgColor: { argb: `FF${hex}` } });
  const font = (o: { bold?: boolean; size?: number; color?: string }): Partial<ExcelJS.Font> => ({
    name: "Calibri", size: o.size ?? 11, bold: o.bold ?? false, color: { argb: `FF${o.color ?? "1E293B"}` },
  });

  function header(ws: ExcelJS.Worksheet, cols: number, subtitle: string) {
    ws.getRow(1).height = 28;
    const c1 = ws.getRow(1).getCell(1);
    c1.value = tenant?.name || "BoxSys Store";
    c1.font = font({ bold: true, size: 18, color: "1E3A5F" });
    const meta: string[] = [];
    if ((tenant as any)?.cnpj) meta.push(`CNPJ: ${(tenant as any).cnpj}`);
    meta.push(subtitle);
    ws.getRow(2).getCell(1).value = meta.join("   ·   ");
    ws.getRow(2).getCell(1).font = font({ size: 9, color: "64748B" });
    ws.getRow(3).height = 4;
    for (let c = 1; c <= cols; c++) ws.getRow(3).getCell(c).border = { bottom: { style: "medium", color: { argb: "FF1E3A5F" } } };
  }

  // ── sheet: mês selecionado ──
  const m = report.months[selectedMonth];
  const ws1 = wb.addWorksheet("Mensal", { pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true } });
  ws1.columns = [{ width: 24 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 16 }];
  header(ws1, 6, `${MONTHS[selectedMonth]}/${report.year}`);

  ws1.getRow(5).values = ["Operador", "Dinheiro", "PIX", "Débito", "Crédito", "Total"];
  ws1.getRow(5).eachCell((cell) => { cell.font = font({ bold: true, color: "FFFFFF" }); cell.fill = fill("1E3A5F"); cell.border = border(); cell.alignment = { horizontal: "center" }; });
  let r = 6;
  for (const [operator, pm] of Object.entries(m.entradas.byOperator)) {
    const total = PM_KEYS.reduce((s, k) => s + pm[k], 0);
    ws1.getRow(r).values = [operator, pm.money, pm.pix, pm.debit, pm.credit, total];
    ws1.getRow(r).eachCell((cell, col) => { cell.border = border(); if (col > 1) { cell.numFmt = '"R$" #,##0.00'; cell.alignment = { horizontal: "right" }; } });
    r++;
  }
  ws1.getRow(r).values = ["TOTAL ENTRADAS", m.entradas.totalByMethod.money, m.entradas.totalByMethod.pix, m.entradas.totalByMethod.debit, m.entradas.totalByMethod.credit, m.entradas.total];
  ws1.getRow(r).eachCell((cell, col) => { cell.font = font({ bold: true, color: "065F46" }); cell.fill = fill("D1FAE5"); cell.border = border(); if (col > 1) { cell.numFmt = '"R$" #,##0.00'; cell.alignment = { horizontal: "right" }; } });
  r += 2;

  function costSection(title: string, items: CostItem[], total: number, headColor: string, bgColor: string) {
    ws1.getRow(r).getCell(1).value = title;
    ws1.getRow(r).getCell(1).font = font({ bold: true, size: 13 });
    r++;
    ws1.getRow(r).values = ["Descrição", "", "", "", "Data", "Valor"];
    ws1.getRow(r).eachCell((cell) => { cell.font = font({ bold: true, color: "FFFFFF" }); cell.fill = fill(headColor); cell.border = border(); });
    r++;
    for (const it of items) {
      ws1.getRow(r).values = [it.description, "", "", "", it.date.split("-").reverse().join("/"), it.amount];
      ws1.mergeCells(r, 1, r, 4);
      ws1.getRow(r).getCell(6).numFmt = '"R$" #,##0.00';
      ws1.getRow(r).getCell(6).alignment = { horizontal: "right" };
      ws1.getRow(r).eachCell((cell) => { cell.border = border(); });
      r++;
    }
    ws1.getRow(r).values = ["TOTAL", "", "", "", "", total];
    ws1.mergeCells(r, 1, r, 4);
    ws1.getRow(r).eachCell((cell) => { cell.font = font({ bold: true }); cell.fill = fill(bgColor); cell.border = border(); });
    ws1.getRow(r).getCell(6).numFmt = '"R$" #,##0.00';
    ws1.getRow(r).getCell(6).alignment = { horizontal: "right" };
    r += 2;
  }
  costSection("Custo Variável", m.custoVariavel.items, m.custoVariavel.total, "D97706", "FEF3C7");
  costSection("Custo Fixo", m.custoFixo.items, m.custoFixo.total, "7C3AED", "EDE9FE");

  // ── sheet: resumo anual ──
  const ws2 = wb.addWorksheet("Anual", { pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true } });
  ws2.columns = [{ width: 20 }, ...MONTHS_SHORT.map(() => ({ width: 12 })), { width: 14 }];
  header(ws2, 14, `Ano ${report.year}`);

  const rows: [string, (mo: MonthReport) => number][] = [
    ["Dinheiro", (mo) => mo.entradas.totalByMethod.money],
    ["PIX", (mo) => mo.entradas.totalByMethod.pix],
    ["Débito", (mo) => mo.entradas.totalByMethod.debit],
    ["Crédito", (mo) => mo.entradas.totalByMethod.credit],
    ["Total Entradas", (mo) => mo.entradas.total],
    ["Custo Fixo", (mo) => mo.custoFixo.total],
    ["Custo Variável", (mo) => mo.custoVariavel.total],
  ];
  ws2.getRow(5).values = ["", ...MONTHS_SHORT, "Total Ano"];
  ws2.getRow(5).eachCell((cell) => { cell.font = font({ bold: true, color: "FFFFFF" }); cell.fill = fill("1E3A5F"); cell.border = border(); cell.alignment = { horizontal: "center" }; });
  let rr = 6;
  for (const [label, getter] of rows) {
    const values = report.months.map(getter);
    const yearTotal = values.reduce((a, b) => a + b, 0);
    ws2.getRow(rr).values = [label, ...values, yearTotal];
    ws2.getRow(rr).eachCell((cell, col) => {
      cell.border = border();
      if (col > 1) { cell.numFmt = '"R$" #,##0.00'; cell.alignment = { horizontal: "right" }; }
      if (label === "Total Entradas") { cell.font = font({ bold: true, color: "065F46" }); cell.fill = fill("D1FAE5"); }
      if (col === 15) cell.font = font({ bold: true });
    });
    rr++;
  }

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `Relatorio_Financeiro_${report.year}.xlsx`; a.click();
  URL.revokeObjectURL(url);
}

// ── PDF export (mesmo padrão de Finance.tsx — HTML + print) ─────────────────
function exportToPDF(report: YearlyReport, tenant: Partial<Tenant> | null, selectedMonth: number) {
  const m = report.months[selectedMonth];
  const operatorRows = Object.entries(m.entradas.byOperator).map(([op, pm]) => {
    const total = PM_KEYS.reduce((s, k) => s + pm[k], 0);
    return `<tr><td>${op}</td><td>R$ ${fmt(pm.money)}</td><td>R$ ${fmt(pm.pix)}</td><td>R$ ${fmt(pm.debit)}</td><td>R$ ${fmt(pm.credit)}</td><td class="tot">R$ ${fmt(total)}</td></tr>`;
  }).join("");

  const costRows = (items: CostItem[]) => items.map(it =>
    `<tr><td>${it.description}</td><td style="text-align:center">${fmtDateBR(it.date)}</td><td class="tot">R$ ${fmt(it.amount)}</td></tr>`
  ).join("");

  const yearRows = ([
    ["Dinheiro", (mo: MonthReport) => mo.entradas.totalByMethod.money],
    ["PIX", (mo: MonthReport) => mo.entradas.totalByMethod.pix],
    ["Débito", (mo: MonthReport) => mo.entradas.totalByMethod.debit],
    ["Crédito", (mo: MonthReport) => mo.entradas.totalByMethod.credit],
    ["Total Entradas", (mo: MonthReport) => mo.entradas.total],
    ["Custo Fixo", (mo: MonthReport) => mo.custoFixo.total],
    ["Custo Variável", (mo: MonthReport) => mo.custoVariavel.total],
  ] as const).map(([label, getter]) => {
    const values = report.months.map(getter);
    const total = values.reduce((a, b) => a + b, 0);
    return `<tr><td class="${label === "Total Entradas" ? "tot" : ""}">${label}</td>${values.map(v => `<td>R$ ${fmt(v)}</td>`).join("")}<td class="tot">R$ ${fmt(total)}</td></tr>`;
  }).join("");

  const html = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"/><title>Relatório Financeiro</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; padding: 32px; font-size: 11px; }
  h1 { font-size: 20px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.08em; }
  .meta { font-size: 10px; color: #64748b; margin-top: 4px; }
  .header { border-bottom: 3px solid #1e40af; padding-bottom: 12px; margin-bottom: 20px; }
  h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.1em; margin: 20px 0 8px; color: #1e293b; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
  th { background: #1e3a5f; color: #fff; padding: 6px 10px; text-align: right; font-size: 9px; text-transform: uppercase; letter-spacing: 0.08em; }
  th:first-child, td:first-child { text-align: left; }
  td { padding: 6px 10px; border-bottom: 1px solid #f1f5f9; text-align: right; }
  td.tot { font-weight: 700; }
  tr:last-child td { border-top: 2px solid #1e293b; font-weight: 700; }
  @media print { body { padding: 16px; } }
</style></head>
<body>
  <div class="header">
    <h1>${tenant?.name || "BoxSys Store"}</h1>
    <p class="meta">${(tenant as any)?.cnpj ? `CNPJ: ${(tenant as any).cnpj} · ` : ""}Relatório Financeiro · Gerado em ${new Date().toLocaleString("pt-BR")}</p>
  </div>

  <h2>Entradas — ${MONTHS[selectedMonth]}/${report.year}</h2>
  <table><thead><tr><th>Operador</th><th>Dinheiro</th><th>PIX</th><th>Débito</th><th>Crédito</th><th>Total</th></tr></thead>
  <tbody>${operatorRows}<tr><td class="tot">TOTAL</td><td class="tot">R$ ${fmt(m.entradas.totalByMethod.money)}</td><td class="tot">R$ ${fmt(m.entradas.totalByMethod.pix)}</td><td class="tot">R$ ${fmt(m.entradas.totalByMethod.debit)}</td><td class="tot">R$ ${fmt(m.entradas.totalByMethod.credit)}</td><td class="tot">R$ ${fmt(m.entradas.total)}</td></tr></tbody></table>

  <h2>Custo Variável</h2>
  <table><thead><tr><th>Descrição</th><th style="text-align:center">Data</th><th>Valor</th></tr></thead>
  <tbody>${costRows(m.custoVariavel.items)}<tr><td class="tot">TOTAL</td><td></td><td class="tot">R$ ${fmt(m.custoVariavel.total)}</td></tr></tbody></table>

  <h2>Custo Fixo</h2>
  <table><thead><tr><th>Descrição</th><th style="text-align:center">Data</th><th>Valor</th></tr></thead>
  <tbody>${costRows(m.custoFixo.items)}<tr><td class="tot">TOTAL</td><td></td><td class="tot">R$ ${fmt(m.custoFixo.total)}</td></tr></tbody></table>

  <h2>Resumo Anual — ${report.year}</h2>
  <table><thead><tr><th>&nbsp;</th>${MONTHS_SHORT.map(m2 => `<th>${m2}</th>`).join("")}<th>Total Ano</th></tr></thead>
  <tbody>${yearRows}</tbody></table>
</body></html>`;

  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 400);
}

// ── component ───────────────────────────────────────────────────────────────
export default function RelatorioFinanceiro() {
  const [tenant, setTenant] = useState<Partial<Tenant> | null>(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());
  const [view, setView] = useState<"month" | "year">("month");
  const [report, setReport] = useState<YearlyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [showExport, setShowExport] = useState(false);

  useEffect(() => {
    fetch("/api/tenant", { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => r.json()).then(setTenant).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/financial-reports/${year}`, { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => r.json()).then(setReport).finally(() => setLoading(false));
  }, [year]);

  const m = report?.months[month];

  const yearTotals = useMemo(() => {
    if (!report) return null;
    const entradas = report.months.reduce((s, mo) => s + mo.entradas.total, 0);
    const fixo = report.months.reduce((s, mo) => s + mo.custoFixo.total, 0);
    const variavel = report.months.reduce((s, mo) => s + mo.custoVariavel.total, 0);
    return { entradas, fixo, variavel };
  }, [report]);

  const resultado = m ? m.entradas.total - m.custoFixo.total - m.custoVariavel.total : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Relatório Financeiro"
        subtitle="Entradas, custo fixo e custo variável — mensal e anual"
        action={
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl px-1 h-9">
              <button onClick={() => setYear(y => y - 1)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500">
                <ChevronLeft size={14} />
              </button>
              <span className="text-xs font-black text-slate-700 w-12 text-center">{year}</span>
              <button onClick={() => setYear(y => y + 1)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500">
                <ChevronRight size={14} />
              </button>
            </div>
            <div className="relative">
              <button
                onClick={() => setShowExport(v => !v)}
                disabled={!report}
                className="h-9 px-3 rounded-xl flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest border border-slate-200 bg-white text-slate-500 hover:border-slate-400 transition-all disabled:opacity-40"
              >
                <Download size={12} /> Exportar <ChevronDown size={10} />
              </button>
              {showExport && report && (
                <div className="absolute right-0 top-10 w-52 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden">
                  <button
                    onClick={() => { exportToExcel(report, tenant, month); setShowExport(false); }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <FileSpreadsheet size={14} className="text-emerald-600" /> Excel (.xlsx)
                  </button>
                  <div className="h-px bg-slate-100 mx-3" />
                  <button
                    onClick={() => { exportToPDF(report, tenant, month); setShowExport(false); }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <FileText size={14} className="text-rose-600" /> PDF / Imprimir
                  </button>
                </div>
              )}
            </div>
          </div>
        }
      />

      {/* view toggle */}
      <div className="flex gap-1.5">
        <button onClick={() => setView("month")}
          className={cn("h-9 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest border flex items-center gap-1.5 transition-all",
            view === "month" ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-400 border-slate-200")}>
          <Calendar size={12} /> Mês
        </button>
        <button onClick={() => setView("year")}
          className={cn("h-9 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest border flex items-center gap-1.5 transition-all",
            view === "year" ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-400 border-slate-200")}>
          <LayoutGrid size={12} /> Resumo Anual
        </button>
      </div>

      {loading || !report ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 size={24} className="animate-spin text-slate-300" />
        </div>
      ) : view === "month" ? (
        <>
          {/* month picker */}
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {MONTHS.map((label, i) => (
              <button key={label} onClick={() => setMonth(i)}
                className={cn("h-8 px-3 rounded-lg text-[10px] font-bold uppercase whitespace-nowrap transition-all shrink-0",
                  month === i ? "bg-blue-600 text-white" : "bg-white border border-slate-200 text-slate-500 hover:border-blue-300")}>
                {label}
              </button>
            ))}
          </div>

          {/* summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
              <div className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Entradas</div>
              <div className="text-2xl font-mono font-black text-emerald-600">R$ {fmt(m!.entradas.total)}</div>
              <div className="absolute right-4 top-4 w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-500"><TrendingUp size={20} /></div>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
              <div className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Custos (Fixo + Variável)</div>
              <div className="text-2xl font-mono font-black text-rose-600">R$ {fmt(m!.custoFixo.total + m!.custoVariavel.total)}</div>
              <div className="absolute right-4 top-4 w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center text-rose-500"><TrendingDown size={20} /></div>
            </div>
            <div className={cn("p-5 rounded-2xl shadow-xl relative overflow-hidden", resultado >= 0 ? "bg-slate-900" : "bg-rose-950")}>
              <div className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2">Resultado do Mês</div>
              <div className={cn("text-2xl font-mono font-black", resultado >= 0 ? "text-emerald-400" : "text-rose-400")}>R$ {fmt(resultado)}</div>
              <div className="absolute right-4 top-4 w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white/70"><Wallet size={20} /></div>
            </div>
          </div>

          {/* entradas table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100">
              <h3 className="text-[11px] font-black text-slate-700 uppercase tracking-widest">Entradas por Operador</h3>
            </div>
            <div className="overflow-x-auto">
              <div className="min-w-[680px]">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-100">
                      <th className="px-5 py-2.5 text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Operador</th>
                      {PM_KEYS.map(k => <th key={k} className="px-5 py-2.5 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right whitespace-nowrap">{PM_LABELS[k]}</th>)}
                      <th className="px-5 py-2.5 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right whitespace-nowrap">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(m!.entradas.byOperator).map(([op, pm]) => {
                      const total = PM_KEYS.reduce((s, k) => s + pm[k], 0);
                      return (
                        <tr key={op} className="border-b border-slate-50">
                          <td className="px-5 py-2.5 text-xs font-bold text-slate-700 whitespace-nowrap">{op}</td>
                          {PM_KEYS.map(k => <td key={k} className="px-5 py-2.5 text-xs font-mono text-slate-600 text-right whitespace-nowrap">R$ {fmt(pm[k])}</td>)}
                          <td className="px-5 py-2.5 text-xs font-mono font-black text-slate-800 text-right whitespace-nowrap">R$ {fmt(total)}</td>
                        </tr>
                      );
                    })}
                    {Object.keys(m!.entradas.byOperator).length === 0 && (
                      <tr><td colSpan={6} className="px-5 py-8 text-center text-[10px] font-black uppercase tracking-widest text-slate-300">Nenhuma entrada no período</td></tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="bg-emerald-50/60">
                      <td className="px-5 py-2.5 text-xs font-black text-emerald-700 uppercase whitespace-nowrap">Total</td>
                      {PM_KEYS.map(k => <td key={k} className="px-5 py-2.5 text-xs font-mono font-black text-emerald-700 text-right whitespace-nowrap">R$ {fmt(m!.entradas.totalByMethod[k])}</td>)}
                      <td className="px-5 py-2.5 text-xs font-mono font-black text-emerald-700 text-right whitespace-nowrap">R$ {fmt(m!.entradas.total)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>

          {/* custo variável + fixo */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {([
              ["Custo Variável", m!.custoVariavel, "amber"],
              ["Custo Fixo", m!.custoFixo, "violet"],
            ] as const).map(([label, data, accent]) => (
              <div key={label} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className={cn("px-5 py-3 border-b flex items-center justify-between",
                  accent === "amber" ? "bg-amber-50/60 border-amber-100" : "bg-violet-50/60 border-violet-100")}>
                  <h3 className="text-[11px] font-black text-slate-700 uppercase tracking-widest">{label}</h3>
                  <span className={cn("text-sm font-mono font-black", accent === "amber" ? "text-amber-700" : "text-violet-700")}>R$ {fmt(data.total)}</span>
                </div>
                <div className="max-h-72 overflow-y-auto divide-y divide-slate-50">
                  {data.items.length === 0 ? (
                    <div className="px-5 py-8 text-center text-[10px] font-black uppercase tracking-widest text-slate-300">Nenhum lançamento</div>
                  ) : data.items.map((it, i) => (
                    <div key={i} className="px-5 py-2.5 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-700 truncate">{it.description}</p>
                        <p className="text-[10px] text-slate-400">{fmtDateBR(it.date)} · {it.source === "contas_pagar" ? "Contas a Pagar" : "Financeiro"}</p>
                      </div>
                      <span className="text-xs font-mono font-bold text-slate-700 shrink-0">R$ {fmt(it.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        /* ── resumo anual ── */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-[11px] font-black text-slate-700 uppercase tracking-widest">Controle Mensal — {year}</h3>
            {yearTotals && (
              <span className="text-[10px] font-bold text-slate-400 uppercase">
                Total ano: <span className="text-emerald-600">R$ {fmt(yearTotals.entradas)}</span> entradas · <span className="text-rose-600">R$ {fmt(yearTotals.fixo + yearTotals.variavel)}</span> custos
              </span>
            )}
          </div>
          <div className="overflow-x-auto">
            <div className="min-w-[1320px]">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-100">
                    <th className="px-4 py-2.5 text-[9px] font-black text-slate-400 uppercase tracking-widest sticky left-0 bg-slate-50 whitespace-nowrap">&nbsp;</th>
                    {MONTHS_SHORT.map(lbl => <th key={lbl} className="px-4 py-2.5 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right whitespace-nowrap">{lbl}</th>)}
                    <th className="px-4 py-2.5 text-[9px] font-black text-slate-600 uppercase tracking-widest text-right whitespace-nowrap">Total Ano</th>
                  </tr>
                </thead>
                <tbody>
                  {([
                    ["Dinheiro", (mo: MonthReport) => mo.entradas.totalByMethod.money, ""],
                    ["PIX", (mo: MonthReport) => mo.entradas.totalByMethod.pix, ""],
                    ["Débito", (mo: MonthReport) => mo.entradas.totalByMethod.debit, ""],
                    ["Crédito", (mo: MonthReport) => mo.entradas.totalByMethod.credit, ""],
                    ["Total Entradas", (mo: MonthReport) => mo.entradas.total, "bg-emerald-50/60 text-emerald-700 font-black"],
                    ["Custo Fixo", (mo: MonthReport) => mo.custoFixo.total, "text-violet-700"],
                    ["Custo Variável", (mo: MonthReport) => mo.custoVariavel.total, "text-amber-700"],
                  ] as const).map(([label, getter, rowClass]) => {
                    const values = report.months.map(getter);
                    const total = values.reduce((a, b) => a + b, 0);
                    return (
                      <tr key={label} className={cn("border-b border-slate-50", rowClass)}>
                        <td className="px-4 py-2.5 text-xs font-bold sticky left-0 bg-white whitespace-nowrap">{label}</td>
                        {values.map((v, i) => <td key={i} className="px-4 py-2.5 text-xs font-mono text-right whitespace-nowrap">R$ {fmt(v)}</td>)}
                        <td className="px-4 py-2.5 text-xs font-mono font-black text-right whitespace-nowrap">R$ {fmt(total)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
