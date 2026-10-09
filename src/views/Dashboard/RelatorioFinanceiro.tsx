import React, { useState, useEffect, useMemo, useRef } from "react";
import ExcelJS from "exceljs";
import { Badge, Button, EmptyState, FilterLine, FilterLineSection, FilterLineSegmented, PageWrapper, PanelCard, SectionTitle, Select, StatCard, StatGrid, Tabs } from "../../components/ui";
import {
  ChevronLeft, ChevronRight, Loader2, Download, FileSpreadsheet, FileText,
  ChevronDown, TrendingUp, TrendingDown, Wallet, Calendar, LayoutGrid, Printer,
  Package, Wrench, Layers, HelpCircle,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { Tenant } from "../../types";
import RelatorioFinanceiroPageTour, { RELATORIO_FINANCEIRO_PAGE_TOUR_EVENTS, type RelatorioFinanceiroPageTourHandle } from "../../components/onboarding/RelatorioFinanceiroPageTour";

// ── types (espelham backend/controllers/financial-reports.controller.ts) ─────
type PmKey = "money" | "pix" | "debit" | "credit";
type OrigemKey = "produtos" | "servicos" | "mista";
interface CostItem { description: string; amount: number; date: string; source: "financeiro" | "contas_pagar" }
interface EntradasBucket { byOperator: Record<string, Record<PmKey, number>>; totalByMethod: Record<PmKey, number>; total: number }
interface MonthReport {
  year: number;
  month: number; // 0-based
  entradas: EntradasBucket;
  entradasByDay: Record<number, EntradasBucket>;
  entradasByOrigem: Record<OrigemKey, EntradasBucket>;
  entradasByDayByOrigem: Record<number, Record<OrigemKey, EntradasBucket>>;
  custoFixo: { total: number; items: CostItem[] };
  custoVariavel: { total: number; items: CostItem[] };
}
interface YearlyReport { year: number; months: MonthReport[] }

// Filtro de origem da tela: "todas" soma produto+serviço+misto (comportamento
// de antes), "produtos"/"servicos" mostram só a origem escolhida (venda mista
// entra nos dois quando filtrado, já que tem os dois tipos de item).
type OrigemFiltro = "todas" | OrigemKey;
const ORIGEM_FILTROS: { key: OrigemFiltro; label: string; icon: typeof Package }[] = [
  { key: "todas", label: "Tudo", icon: Layers },
  { key: "produtos", label: "Catálogo", icon: Package },
  { key: "servicos", label: "Serviço", icon: Wrench },
];
const ORIGEM_LABELS: Record<OrigemFiltro, string> = { todas: "Tudo", produtos: "Catálogo", servicos: "Serviço", mista: "Mista" };

function pickBucket(entradas: EntradasBucket, byOrigem: Record<OrigemKey, EntradasBucket>, filtro: OrigemFiltro): EntradasBucket {
  if (filtro === "todas") return entradas;
  if (filtro === "produtos") return sumBuckets([byOrigem.produtos, byOrigem.mista]);
  return sumBuckets([byOrigem.servicos, byOrigem.mista]);
}

function emptyEntradasByOrigemLocal(): Record<OrigemKey, EntradasBucket> {
  const empty = (): EntradasBucket => ({ byOperator: {}, totalByMethod: { money: 0, pix: 0, debit: 0, credit: 0 }, total: 0 });
  return { produtos: empty(), servicos: empty(), mista: empty() };
}

function sumBuckets(buckets: EntradasBucket[]): EntradasBucket {
  const out: EntradasBucket = { byOperator: {}, totalByMethod: { money: 0, pix: 0, debit: 0, credit: 0 }, total: 0 };
  for (const b of buckets) {
    for (const [op, pm] of Object.entries(b.byOperator)) {
      if (!out.byOperator[op]) out.byOperator[op] = { money: 0, pix: 0, debit: 0, credit: 0 };
      for (const k of PM_KEYS) out.byOperator[op][k] += pm[k];
    }
    for (const k of PM_KEYS) out.totalByMethod[k] += b.totalByMethod[k];
    out.total += b.total;
  }
  return out;
}

const PM_KEYS: PmKey[] = ["money", "pix", "debit", "credit"];
const PM_LABELS: Record<PmKey, string> = { money: "Dinheiro", pix: "PIX", debit: "Débito", credit: "Crédito" };
const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const MONTHS_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDateBR = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("pt-BR");
const token = () => localStorage.getItem("token");

// Espelha exatamente o que a tela está mostrando no momento do export — a
// exportação (Excel/PDF) precisa refletir a view ativa (Dia/Mês/Resumo Anual),
// nunca sempre o mês inteiro independente do que o usuário está vendo.
interface DayExportData {
  dayKey: string;
  entradas: EntradasBucket;
  custoFixo: { total: number; items: CostItem[] };
  custoVariavel: { total: number; items: CostItem[] };
}
type ExportScope =
  | { view: "day"; data: DayExportData }
  | { view: "month"; month: number; entradas: EntradasBucket }
  | { view: "year"; entradasByMonth: EntradasBucket[] };

// ── Excel export ──────────────────────────────────────────────────────────────
async function exportToExcel(report: YearlyReport, tenant: Partial<Tenant> | null, scope: ExportScope, origemFiltro: OrigemFiltro) {
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

  // Monta a planilha de entradas+custos (usada tanto pra Dia quanto pra Mês —
  // a única diferença é qual EntradasBucket/custo é passado).
  function entradasCostSheet(
    sheetName: string, subtitle: string,
    entradas: EntradasBucket, custoVariavel: { total: number; items: CostItem[] }, custoFixo: { total: number; items: CostItem[] },
  ) {
    const ws1 = wb.addWorksheet(sheetName, { pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true } });
    ws1.columns = [{ width: 24 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 16 }];
    header(ws1, 6, subtitle);

    ws1.getRow(5).values = ["Operador", "Dinheiro", "PIX", "Débito", "Crédito", "Total"];
    ws1.getRow(5).eachCell((cell) => { cell.font = font({ bold: true, color: "FFFFFF" }); cell.fill = fill("1E3A5F"); cell.border = border(); cell.alignment = { horizontal: "center" }; });
    let r = 6;
    for (const [operator, pm] of Object.entries(entradas.byOperator)) {
      const total = PM_KEYS.reduce((s, k) => s + pm[k], 0);
      ws1.getRow(r).values = [operator, pm.money, pm.pix, pm.debit, pm.credit, total];
      ws1.getRow(r).eachCell((cell, col) => { cell.border = border(); if (col > 1) { cell.numFmt = '"R$" #,##0.00'; cell.alignment = { horizontal: "right" }; } });
      r++;
    }
    ws1.getRow(r).values = ["TOTAL ENTRADAS", entradas.totalByMethod.money, entradas.totalByMethod.pix, entradas.totalByMethod.debit, entradas.totalByMethod.credit, entradas.total];
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
    costSection("Custo Variável", custoVariavel.items, custoVariavel.total, "D97706", "FEF3C7");
    costSection("Custo Fixo", custoFixo.items, custoFixo.total, "7C3AED", "EDE9FE");

    const resultado = entradas.total - custoVariavel.total - custoFixo.total;
    ws1.getRow(r).values = ["RESULTADO DO PERÍODO", "", "", "", "", resultado];
    ws1.mergeCells(r, 1, r, 4);
    ws1.getRow(r).eachCell((cell) => {
      cell.font = font({ bold: true, size: 12, color: resultado >= 0 ? "065F46" : "9F1239" });
      cell.fill = fill(resultado >= 0 ? "D1FAE5" : "FFE4E6");
      cell.border = border();
    });
    ws1.getRow(r).getCell(6).numFmt = '"R$" #,##0.00';
    ws1.getRow(r).getCell(6).alignment = { horizontal: "right" };
  }

  function yearSheet(entradasByMonth: EntradasBucket[], subtitle: string) {
    const ws2 = wb.addWorksheet("Anual", { pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true } });
    ws2.columns = [{ width: 20 }, ...MONTHS_SHORT.map(() => ({ width: 12 })), { width: 14 }];
    header(ws2, 14, subtitle);

    const rows: [string, (mo: MonthReport, i: number) => number][] = [
      ["Dinheiro", (_mo, i) => entradasByMonth[i].totalByMethod.money],
      ["PIX", (_mo, i) => entradasByMonth[i].totalByMethod.pix],
      ["Débito", (_mo, i) => entradasByMonth[i].totalByMethod.debit],
      ["Crédito", (_mo, i) => entradasByMonth[i].totalByMethod.credit],
      ["Total Entradas", (_mo, i) => entradasByMonth[i].total],
      ["Custo Fixo", (mo) => mo.custoFixo.total],
      ["Custo Variável", (mo) => mo.custoVariavel.total],
      ["Resultado", (mo, i) => entradasByMonth[i].total - mo.custoFixo.total - mo.custoVariavel.total],
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
        if (label === "Resultado") { cell.font = font({ bold: true, color: yearTotal >= 0 ? "065F46" : "9F1239" }); cell.fill = fill(yearTotal >= 0 ? "D1FAE5" : "FFE4E6"); }
        if (col === 15) cell.font = font({ bold: true });
      });
      rr++;
    }
  }

  const origemSuffix = origemFiltro === "todas" ? "" : `_${ORIGEM_LABELS[origemFiltro]}`;
  const origemSubtitle = origemFiltro === "todas" ? "" : `· Origem: ${ORIGEM_LABELS[origemFiltro]}`;

  let filenameSuffix = "";
  if (scope.view === "day") {
    entradasCostSheet("Diário", `${fmtDateBR(scope.data.dayKey)}${origemSubtitle}`, scope.data.entradas, scope.data.custoVariavel, scope.data.custoFixo);
    filenameSuffix = scope.data.dayKey;
  } else if (scope.view === "month") {
    const m = report.months[scope.month];
    entradasCostSheet("Mensal", `${MONTHS[scope.month]}/${report.year}${origemSubtitle}`, scope.entradas, m.custoVariavel, m.custoFixo);
    filenameSuffix = `${MONTHS[scope.month]}_${report.year}`;
  } else {
    yearSheet(scope.entradasByMonth, `Ano ${report.year}${origemSubtitle}`);
    filenameSuffix = String(report.year);
  }

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `Relatorio_Financeiro_${filenameSuffix}${origemSuffix}.xlsx`; a.click();
  URL.revokeObjectURL(url);
}

// ── PDF export (mesmo padrão de Finance.tsx — HTML + print) ─────────────────
function exportToPDF(report: YearlyReport, tenant: Partial<Tenant> | null, scope: ExportScope, origemFiltro: OrigemFiltro) {
  const operatorRowsOf = (entradas: EntradasBucket) => Object.entries(entradas.byOperator).map(([op, pm]) => {
    const total = PM_KEYS.reduce((s, k) => s + pm[k], 0);
    return `<tr><td>${op}</td><td>R$ ${fmt(pm.money)}</td><td>R$ ${fmt(pm.pix)}</td><td>R$ ${fmt(pm.debit)}</td><td>R$ ${fmt(pm.credit)}</td><td class="tot">R$ ${fmt(total)}</td></tr>`;
  }).join("");

  const costRows = (items: CostItem[]) => items.map(it =>
    `<tr><td>${it.description}</td><td style="text-align:center">${fmtDateBR(it.date)}</td><td class="tot">R$ ${fmt(it.amount)}</td></tr>`
  ).join("");

  const entradasSection = (title: string, entradas: EntradasBucket) => `
  <h2>Entradas — ${title}</h2>
  <table><thead><tr><th>Operador</th><th>Dinheiro</th><th>PIX</th><th>Débito</th><th>Crédito</th><th>Total</th></tr></thead>
  <tbody>${operatorRowsOf(entradas)}<tr><td class="tot">TOTAL</td><td class="tot">R$ ${fmt(entradas.totalByMethod.money)}</td><td class="tot">R$ ${fmt(entradas.totalByMethod.pix)}</td><td class="tot">R$ ${fmt(entradas.totalByMethod.debit)}</td><td class="tot">R$ ${fmt(entradas.totalByMethod.credit)}</td><td class="tot">R$ ${fmt(entradas.total)}</td></tr></tbody></table>`;

  const custoSection = (title: string, items: CostItem[], total: number) => `
  <h2>${title}</h2>
  <table><thead><tr><th>Descrição</th><th style="text-align:center">Data</th><th>Valor</th></tr></thead>
  <tbody>${costRows(items)}<tr><td class="tot">TOTAL</td><td></td><td class="tot">R$ ${fmt(total)}</td></tr></tbody></table>`;

  const resultadoSection = (resultado: number) => `
  <div class="resultado ${resultado >= 0 ? "pos":"neg"}">RESULTADO DO PERÍODO: R$ ${fmt(resultado)}</div>`;

  const yearSection = (entradasByMonth: EntradasBucket[]) => {
    const yearRows = ([
      ["Dinheiro", (_mo: MonthReport, i: number) => entradasByMonth[i].totalByMethod.money],
      ["PIX", (_mo: MonthReport, i: number) => entradasByMonth[i].totalByMethod.pix],
      ["Débito", (_mo: MonthReport, i: number) => entradasByMonth[i].totalByMethod.debit],
      ["Crédito", (_mo: MonthReport, i: number) => entradasByMonth[i].totalByMethod.credit],
      ["Total Entradas", (_mo: MonthReport, i: number) => entradasByMonth[i].total],
      ["Custo Fixo", (mo: MonthReport) => mo.custoFixo.total],
      ["Custo Variável", (mo: MonthReport) => mo.custoVariavel.total],
      ["Resultado", (mo: MonthReport, i: number) => entradasByMonth[i].total - mo.custoFixo.total - mo.custoVariavel.total],
    ] as const).map(([label, getter]) => {
      const values = report.months.map(getter);
      const total = values.reduce((a, b) => a + b, 0);
      const isHighlight = label === "Total Entradas" || label === "Resultado";
      return `<tr><td class="${isHighlight ? "tot":""}">${label}</td>${values.map(v => `<td>R$ ${fmt(v)}</td>`).join("")}<td class="tot">R$ ${fmt(total)}</td></tr>`;
    }).join("");
    return `
  <h2>Resumo Anual — ${report.year}</h2>
  <table><thead><tr><th>&nbsp;</th>${MONTHS_SHORT.map(m2 => `<th>${m2}</th>`).join("")}<th>Total Ano</th></tr></thead>
  <tbody>${yearRows}</tbody></table>`;
  };

  const origemMeta = origemFiltro === "todas" ? "" : `· Origem: ${ORIGEM_LABELS[origemFiltro]}`;

  let body = "";
  if (scope.view === "day") {
    const resultado = scope.data.entradas.total - scope.data.custoVariavel.total - scope.data.custoFixo.total;
    body = entradasSection(fmtDateBR(scope.data.dayKey), scope.data.entradas)
      + custoSection("Custo Variável", scope.data.custoVariavel.items, scope.data.custoVariavel.total)
      + custoSection("Custo Fixo", scope.data.custoFixo.items, scope.data.custoFixo.total)
      + resultadoSection(resultado);
  } else if (scope.view === "month") {
    const m = report.months[scope.month];
    const resultado = scope.entradas.total - m.custoVariavel.total - m.custoFixo.total;
    body = entradasSection(`${MONTHS[scope.month]}/${report.year}`, scope.entradas)
      + custoSection("Custo Variável", m.custoVariavel.items, m.custoVariavel.total)
      + custoSection("Custo Fixo", m.custoFixo.items, m.custoFixo.total)
      + resultadoSection(resultado);
  } else {
    body = yearSection(scope.entradasByMonth);
  }

  const html = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>Relatório Financeiro</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; padding: 32px; font-size: 11px; }
  h1 { font-size: 20px; font-weight: 900; text-transform: ; letter-spacing: 0.08em; }
  .meta { font-size: 10px; color: #64748b; margin-top: 4px; }
  .header { border-bottom: 3px solid #1e40af; padding-bottom: 12px; margin-bottom: 20px; }
  h2 { font-size: 13px; text-transform: ; letter-spacing: 0.1em; margin: 20px 0 8px; color: #1e293b; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
  th { background: #1e3a5f; color: #fff; padding: 6px 10px; text-align: right; font-size: 9px; text-transform: ; letter-spacing: 0.08em; }
  th:first-child, td:first-child { text-align: left; }
  td { padding: 6px 10px; border-bottom: 1px solid #f1f5f9; text-align: right; }
  td.tot { font-weight: 700; }
  tr:last-child td { border-top: 2px solid #1e293b; font-weight: 700; }
  .resultado { margin-top: 16px; padding: 12px 16px; border-radius: 6px; font-size: 13px; font-weight: 900; text-transform: ; letter-spacing: 0.06em; text-align: right; }
  .resultado.pos { background: #d1fae5; color: #065f46; }
  .resultado.neg { background: #ffe4e6; color: #9f1239; }
  @media print { body { padding: 16px; } }
  @media screen and (max-width: 640px) {
    body { padding: 16px; font-size: 12px; }
    h1 { font-size: 16px; }
    table { display: block; overflow-x: auto; white-space: nowrap; }
  }
</style></head>
<body>
  <div class="header">
    <h1>${tenant?.name || "BoxSys Store"}</h1>
    <p class="meta">${(tenant as any)?.cnpj ? `CNPJ: ${(tenant as any).cnpj} ·` : ""}Relatório Financeiro${origemMeta} · Gerado em ${new Date().toLocaleString("pt-BR")}</p>
  </div>
  ${body}
</body></html>`;

  const win = window.open("", "_blank");
  if (!win) {
    alert("Não foi possível abrir a janela de impressão. Verifique se o bloqueador de pop-ups está desativado para este site.");
    return;
  }
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 400);
}

// ── sub-componentes reaproveitados entre as visões Dia/Mês ──────────────────
const thClass = "px-3 py-2 text-[11px] font-medium text-slate-500 whitespace-nowrap";

function EntradasTable({ data, onPrint }: { data: EntradasBucket; onPrint?: () => void }) {
  return (
    <PanelCard
      title="Entradas por Operador"
      contentClassName="p-0"
      action={onPrint ? <Button variant="outline" size="xs" iconLeft={<Printer size={12} />} onClick={onPrint}>Imprimir</Button> : undefined}
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-left">
          <thead>
            <tr className="border-b border-slate-100 bg-zinc-50">
              <th className={thClass}>Operador</th>
              {PM_KEYS.map(k => <th key={k} className={cn(thClass, "text-right")}>{PM_LABELS[k]}</th>)}
              <th className={cn(thClass, "text-right")}>Total</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(data.byOperator).map(([op, pm]) => {
              const total = PM_KEYS.reduce((s, k) => s + pm[k], 0);
              return (
                <tr key={op} className="border-b border-slate-50">
                  <td className="whitespace-nowrap px-3 py-2 text-xs font-medium text-slate-700">{op}</td>
                  {PM_KEYS.map(k => <td key={k} className="whitespace-nowrap px-3 py-2 text-right text-xs tabular-nums text-slate-600">R$ {fmt(pm[k])}</td>)}
                  <td className="whitespace-nowrap px-3 py-2 text-right text-xs font-semibold tabular-nums text-slate-800">R$ {fmt(total)}</td>
                </tr>
              );
            })}
            {Object.keys(data.byOperator).length === 0 && (
              <tr><td colSpan={6} className="p-3"><EmptyState title="Nenhuma entrada no período" /></td></tr>
            )}
          </tbody>
          <tfoot>
            <tr className="bg-emerald-50/60">
              <td className="whitespace-nowrap px-3 py-2 text-xs font-medium text-emerald-700">Total</td>
              {PM_KEYS.map(k => <td key={k} className="whitespace-nowrap px-3 py-2 text-right text-xs font-semibold tabular-nums text-emerald-700">R$ {fmt(data.totalByMethod[k])}</td>)}
              <td className="whitespace-nowrap px-3 py-2 text-right text-xs font-semibold tabular-nums text-emerald-700">R$ {fmt(data.total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </PanelCard>
  );
}

function CustoCards({ custoVariavel, custoFixo }: { custoVariavel: { total: number; items: CostItem[] }; custoFixo: { total: number; items: CostItem[] } }) {
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {([
        ["Custo Variável", custoVariavel, "warning"],
        ["Custo Fixo", custoFixo, "purple"],
      ] as const).map(([label, data, tone]) => (
        <PanelCard key={label} title={label} contentClassName="p-0"
          action={<Badge color={tone} size="md">R$ {fmt(data.total)}</Badge>}>
          <div className="max-h-72 divide-y divide-slate-100 overflow-y-auto">
            {data.items.length === 0 ? (
              <div className="p-3"><EmptyState title="Nenhum lançamento" /></div>
            ) : data.items.map((it, i) => (
              <div key={i} className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-slate-700">{it.description}</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">{fmtDateBR(it.date)} · {it.source === "contas_pagar" ? "Contas a Pagar" : "Financeiro"}</p>
                </div>
                <span className="shrink-0 text-xs font-semibold tabular-nums text-slate-700">R$ {fmt(it.amount)}</span>
              </div>
            ))}
          </div>
        </PanelCard>
      ))}
    </div>
  );
}

function ResumoCards({ entradasLabel, custosLabel, resultadoLabel, entradas, custos, resultado }: { entradasLabel: string; custosLabel: string; resultadoLabel: string; entradas: number; custos: number; resultado: number }) {
  return (
    <StatGrid cols={3}>
      <StatCard title={entradasLabel} value={`R$ ${fmt(entradas)}`} icon={TrendingUp} color="success" />
      <StatCard title={custosLabel} value={`R$ ${fmt(custos)}`} icon={TrendingDown} color="danger" />
      <StatCard className="col-span-2 sm:col-span-1" title={resultadoLabel} value={`R$ ${fmt(resultado)}`} icon={Wallet} color={resultado >= 0 ? "info" : "danger"} />
    </StatGrid>
  );
}

const VIEW_TABS = [
  { id: "day", label: "Dia", icon: Calendar, dataTour: "relatorio-day-view-btn" },
  { id: "month", label: "Mês", icon: Calendar, dataTour: "relatorio-month-view-btn" },
  { id: "year", label: "Resumo Anual", icon: LayoutGrid, dataTour: "relatorio-year-view-btn" },
] as const;
type ViewId = typeof VIEW_TABS[number]["id"];

// ── component ───────────────────────────────────────────────────────────────
export default function RelatorioFinanceiro() {
  const [tenant, setTenant] = useState<Partial<Tenant> | null>(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());
  const [day, setDay] = useState(new Date().getDate());
  const [view, setView] = useState<ViewId>("month");
  const [origemFiltro, setOrigemFiltro] = useState<OrigemFiltro>("todas");
  const [report, setReport] = useState<YearlyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [showExport, setShowExport] = useState(false);
  const tourRef = useRef<RelatorioFinanceiroPageTourHandle>(null);

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
  const mEntradas = m ? pickBucket(m.entradas, m.entradasByOrigem, origemFiltro) : null;

  const monthEntradasTotal = (mo: MonthReport) => pickBucket(mo.entradas, mo.entradasByOrigem, origemFiltro).total;

  const yearTotals = useMemo(() => {
    if (!report) return null;
    const entradas = report.months.reduce((s, mo) => s + monthEntradasTotal(mo), 0);
    const fixo = report.months.reduce((s, mo) => s + mo.custoFixo.total, 0);
    const variavel = report.months.reduce((s, mo) => s + mo.custoVariavel.total, 0);
    return { entradas, fixo, variavel };
  }, [report, origemFiltro]);

  const resultado = m && mEntradas ? mEntradas.total - m.custoFixo.total - m.custoVariavel.total : 0;

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const dayKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const emptyEntradas: EntradasBucket = { byOperator: {}, totalByMethod: { money: 0, pix: 0, debit: 0, credit: 0 }, total: 0 };
  const dEntradas = m ? pickBucket(m.entradasByDay[day] ?? emptyEntradas, m.entradasByDayByOrigem[day] ?? emptyEntradasByOrigemLocal(), origemFiltro) : emptyEntradas;
  const dCustoFixo = m ? m.custoFixo.items.filter(it => it.date === dayKey) : [];
  const dCustoVariavel = m ? m.custoVariavel.items.filter(it => it.date === dayKey) : [];
  const dCustoFixoTotal = dCustoFixo.reduce((s, it) => s + it.amount, 0);
  const dCustoVariavelTotal = dCustoVariavel.reduce((s, it) => s + it.amount, 0);
  const dResultado = dEntradas.total - dCustoFixoTotal - dCustoVariavelTotal;

  // A exportação (Excel/PDF) precisa refletir exatamente a view ativa — nunca
  // sempre o mês inteiro, senão o botão "Exportar" mostra algo diferente do
  // que a tela está exibindo (ex.: usuário na visão "Dia" exportando o mês todo).
  const buildExportScope = (): ExportScope => {
    if (view === "day") {
      return {
        view: "day",
        data: {
          dayKey,
          entradas: dEntradas,
          custoVariavel: { total: dCustoVariavelTotal, items: dCustoVariavel },
          custoFixo: { total: dCustoFixoTotal, items: dCustoFixo },
        },
      };
    }
    if (view === "year") {
      return {
        view: "year",
        entradasByMonth: report!.months.map(mo => pickBucket(mo.entradas, mo.entradasByOrigem, origemFiltro)),
      };
    }
    return { view: "month", month, entradas: mEntradas! };
  };

  const origemSuffixLabel = origemFiltro === "todas" ? "" : ` · ${ORIGEM_LABELS[origemFiltro]}`;
  const exportScopeLabel =
    view === "day" ? `Dia ${fmtDateBR(dayKey)}${origemSuffixLabel}`
    : view === "month" ? `${MONTHS[month]}/${year}${origemSuffixLabel}`
    : `Resumo Anual ${year}${origemSuffixLabel}`;

  const printDayReport = () => {
    const W = 42;
    const rule = "=".repeat(W);
    const thin = "-".repeat(W);
    const money2 = (v: number) => v.toFixed(2).replace(".", ",");
    const truncate = (v: string, max = W) => String(v || "").slice(0, max);
    const center = (v: string) => {
      const text = truncate(v);
      return " ".repeat(Math.max(0, Math.floor((W - text.length) / 2))) + text;
    };
    const row = (left: string, right = "") => {
      const rightText = truncate(right, 15);
      const leftText = truncate(left, W - rightText.length - 1);
      return `${leftText}${" ".repeat(Math.max(1, W - leftText.length - rightText.length))}${rightText}`;
    };

    let receipt = "\n";
    if (tenant?.name) receipt += `${center(tenant.name.toUpperCase())}\n`;
    receipt += `${rule}\n${center("RELATÓRIO FINANCEIRO DO DIA")}\n${center(fmtDateBR(dayKey))}\n${thin}\n`;
    receipt += `${center("ENTRADAS POR OPERADOR")}\n${thin}\n`;
    Object.entries(dEntradas.byOperator).forEach(([op, pm]) => {
      const total = PM_KEYS.reduce((s, k) => s + pm[k], 0);
      receipt += `${op}\n`;
      PM_KEYS.forEach((k) => { if (pm[k] > 0) receipt += row(`  ${PM_LABELS[k]}`, `R$ ${money2(pm[k])}`) + "\n"; });
      receipt += row("  Total", `R$ ${money2(total)}`) + "\n";
    });
    receipt += `${thin}\n`;
    receipt += row("TOTAL ENTRADAS", `R$ ${money2(dEntradas.total)}`) + "\n";
    receipt += `${rule}\n`;
    receipt += row("Custo fixo", `R$ ${money2(dCustoFixoTotal)}`) + "\n";
    receipt += row("Custo variável", `R$ ${money2(dCustoVariavelTotal)}`) + "\n";
    receipt += `${thin}\n`;
    receipt += row("RESULTADO DO DIA", `R$ ${money2(dResultado)}`) + "\n";
    receipt += `${rule}\n\n\n`;

    if (window.boxsysDesktop?.printReceipt) {
      window.boxsysDesktop.printReceipt(receipt).catch(() => {});
      return;
    }
    const iframe = document.createElement("iframe");
    Object.assign(iframe.style, { position: "fixed", right: "0", bottom: "0", width: "0", height: "0", border: "none" });
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return;
    doc.open();
    doc.write(`<pre style="font-family:'Courier New',monospace;font-size:12px;white-space:pre-wrap">${receipt}</pre>`);
    doc.close();
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => document.body.removeChild(iframe), 1500);
    }, 400);
  };

  // ── Canal de comunicação do TOUR DE PÁGINA (RelatorioFinanceiroPageTour) ──
  // Tela 100% leitura/relatório — o único estado real trocado é a visão ativa
  // (view), o mesmo que clicar no botão "Mês" faria. Nunca chama
  // exportToExcel/exportToPDF/printDayReport de verdade.
  useEffect(() => {
    const onGoToMonthView = () => setView("month");
    window.addEventListener(RELATORIO_FINANCEIRO_PAGE_TOUR_EVENTS.goToMonthView, onGoToMonthView);
    return () => window.removeEventListener(RELATORIO_FINANCEIRO_PAGE_TOUR_EVENTS.goToMonthView, onGoToMonthView);
  }, []);

  const monthOptions = MONTHS.map((label, i) => ({ value: i, label }));

  return (
    <PageWrapper data-tour="relatorio-financeiro-page">
      <div className="space-y-4">
        <SectionTitle
          icon={FileText}
          title="Relatório Financeiro"
          description="Entradas, custo fixo e custo variável — mensal e anual"
          action={
            <>
              <div data-tour="relatorio-year-nav" className="flex h-8 shrink-0 items-center gap-1 rounded-md border border-slate-200 bg-white px-1">
                <button type="button" aria-label="Ano anterior" onClick={() => setYear(y => y - 1)} className="flex h-6 w-6 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100">
                  <ChevronLeft size={14} />
                </button>
                <span className="w-12 text-center text-xs font-medium text-slate-700">{year}</span>
                <button type="button" aria-label="Próximo ano" onClick={() => setYear(y => y + 1)} className="flex h-6 w-6 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100">
                  <ChevronRight size={14} />
                </button>
              </div>
              <div className="relative min-w-0 flex-1 sm:flex-none">
                <Button
                  data-tour="relatorio-export-btn"
                  variant="outline"
                  size="sm"
                  fullWidth
                  onClick={() => setShowExport(v => !v)}
                  disabled={!report}
                  iconLeft={<Download size={14} />}
                  iconRight={<ChevronDown size={12} className={cn("transition-transform", showExport && "rotate-180")} />}
                >
                  Exportar
                </Button>
                {showExport && report && (
                  <div className="absolute right-0 top-9 z-50 w-64 max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
                    <div className="border-b border-slate-100 bg-zinc-50 px-3 py-2">
                      <p className="text-[11px] text-slate-500">Escopo do arquivo</p>
                      <p className="mt-0.5 text-xs font-medium text-slate-700">{exportScopeLabel}</p>
                    </div>
                    <button
                      onClick={() => { exportToExcel(report, tenant, buildExportScope(), origemFiltro); setShowExport(false); }}
                      className="flex w-full items-center gap-3 px-3 py-2.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
                    >
                      <FileSpreadsheet size={14} className="shrink-0 text-emerald-600" /> Excel (.xlsx)
                    </button>
                    <div className="mx-3 h-px bg-slate-100" />
                    <button
                      onClick={() => { exportToPDF(report, tenant, buildExportScope(), origemFiltro); setShowExport(false); }}
                      className="flex w-full items-center gap-3 px-3 py-2.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
                    >
                      <FileText size={14} className="shrink-0 text-rose-600" /> PDF / Imprimir
                    </button>
                  </div>
                )}
              </div>
              <Button variant="outline" size="sm" iconLeft={<HelpCircle size={14} />} onClick={() => tourRef.current?.start()} title="Tour guiado desta página">
                <span className="sr-only sm:not-sr-only">Ajuda</span>
              </Button>
            </>
          }
        />

        <RelatorioFinanceiroPageTour ref={tourRef} />

        {/* filtro de origem (Tudo/Catálogo/Serviço) — filtro real, não troca de seção */}
        <div data-tour="relatorio-origem-filtro">
          <FilterLine>
            <FilterLineSection>
              <FilterLineSegmented value={origemFiltro as string} onChange={(v) => setOrigemFiltro(v as OrigemFiltro)}
                options={ORIGEM_FILTROS.map(({ key, label, icon: Icon }) => ({ value: key, label, icon: <Icon size={13} /> }))} />
            </FilterLineSection>
          </FilterLine>
        </div>

        <div data-tour="relatorio-view-toggle">
          <Tabs<ViewId> items={VIEW_TABS} value={view} onChange={setView} label="Visão do relatório financeiro">
            {loading || !report ? (
              <div role="status" className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
                <Loader2 size={18} className="animate-spin" />Carregando relatório…
              </div>
            ) : view === "month" ? (
              <div className="space-y-3">
                <Select aria-label="Mês" size="sm" wrapperClassName="w-40" value={month} onChange={(e) => setMonth(Number(e.target.value))} options={monthOptions} />

                <div data-tour="relatorio-summary-cards">
                  <ResumoCards entradasLabel="Entradas" custosLabel="Custos (Fixo + Variável)" resultadoLabel="Resultado do Mês"
                    entradas={mEntradas!.total} custos={m!.custoFixo.total + m!.custoVariavel.total} resultado={resultado} />
                </div>

                <div data-tour="relatorio-entradas-table">
                  <EntradasTable data={mEntradas!} />
                </div>
                <div data-tour="relatorio-custo-cards">
                  <CustoCards custoVariavel={m!.custoVariavel} custoFixo={m!.custoFixo} />
                </div>
              </div>
            ) : view === "day" ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Select aria-label="Mês" size="sm" wrapperClassName="w-40" value={month} onChange={(e) => { setMonth(Number(e.target.value)); setDay(1); }} options={monthOptions} />
                  <div className="flex h-8 items-center gap-1 rounded-md border border-slate-200 bg-white px-1">
                    <button type="button" aria-label="Dia anterior" onClick={() => setDay(d => Math.max(1, d - 1))} className="flex h-6 w-6 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100">
                      <ChevronLeft size={14} />
                    </button>
                    <span className="w-8 text-center text-xs font-medium text-slate-700">{day}</span>
                    <button type="button" aria-label="Próximo dia" onClick={() => setDay(d => Math.min(daysInMonth, d + 1))} className="flex h-6 w-6 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100">
                      <ChevronRight size={14} />
                    </button>
                  </div>
                  <span className="text-[11px] text-slate-500">{fmtDateBR(dayKey)}</span>
                </div>

                <ResumoCards entradasLabel="Entradas" custosLabel="Custos (Fixo + Variável)" resultadoLabel="Resultado do Dia"
                  entradas={dEntradas.total} custos={dCustoFixoTotal + dCustoVariavelTotal} resultado={dResultado} />

                <EntradasTable data={dEntradas} onPrint={printDayReport} />
                <CustoCards custoVariavel={{ total: dCustoVariavelTotal, items: dCustoVariavel }} custoFixo={{ total: dCustoFixoTotal, items: dCustoFixo }} />
              </div>
            ) : (
              /* ── resumo anual ── */
              <div className="space-y-3">
                {yearTotals && (
                  <ResumoCards entradasLabel="Entradas do Ano" custosLabel="Custos do Ano (Fixo + Variável)" resultadoLabel="Resultado do Ano"
                    entradas={yearTotals.entradas} custos={yearTotals.fixo + yearTotals.variavel} resultado={yearTotals.entradas - yearTotals.fixo - yearTotals.variavel} />
                )}

                {/* Mobile: cards por mês (a tabela de 14 colunas não cabe em telas pequenas) */}
                <div className="grid grid-cols-1 gap-2 sm:hidden">
                  {report.months.map((mo, i) => {
                    const entradas = pickBucket(mo.entradas, mo.entradasByOrigem, origemFiltro);
                    const custos = mo.custoFixo.total + mo.custoVariavel.total;
                    const resultadoMes = entradas.total - custos;
                    const isCurrent = i === month;
                    return (
                      <button
                        key={i}
                        onClick={() => { setMonth(i); setView("month"); }}
                        className={cn(
                          "rounded-lg border bg-white p-3 text-left transition-all",
                          isCurrent ? "border-blue-400 ring-1 ring-blue-400" : "border-slate-200"
                        )}
                      >
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-xs font-medium text-slate-800">{MONTHS[i]}</span>
                          <span className={cn("text-xs font-semibold tabular-nums", resultadoMes >= 0 ? "text-emerald-600" : "text-rose-600")}>
                            R$ {fmt(resultadoMes)}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[11px]">
                          <div>
                            <p className="mb-0.5 text-[11px] text-slate-500">Entradas</p>
                            <p className="font-semibold tabular-nums text-emerald-600">R$ {fmt(entradas.total)}</p>
                          </div>
                          <div>
                            <p className="mb-0.5 text-[11px] text-slate-500">Custos</p>
                            <p className="font-semibold tabular-nums text-rose-600">R$ {fmt(custos)}</p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Desktop/tablet largo: tabela completa */}
                <div className="hidden sm:block">
                  <PanelCard
                    title={`Controle Mensal — ${year}`}
                    contentClassName="p-0"
                    action={yearTotals ? (
                      <span className="text-[11px] text-slate-500">
                        Total ano: <span className="text-emerald-600">R$ {fmt(yearTotals.entradas)}</span> entradas · <span className="text-rose-600">R$ {fmt(yearTotals.fixo + yearTotals.variavel)}</span> custos
                      </span>
                    ) : undefined}
                  >
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[1320px] border-collapse text-left">
                        <thead>
                          <tr className="border-b border-slate-100 bg-zinc-50">
                            <th className={cn(thClass, "sticky left-0 bg-zinc-50")}>&nbsp;</th>
                            {MONTHS_SHORT.map(lbl => <th key={lbl} className={cn(thClass, "text-right")}>{lbl}</th>)}
                            <th className={cn(thClass, "text-right text-slate-700")}>Total Ano</th>
                          </tr>
                        </thead>
                        <tbody>
                          {([
                            ["Dinheiro", (mo: MonthReport) => pickBucket(mo.entradas, mo.entradasByOrigem, origemFiltro).totalByMethod.money, ""],
                            ["PIX", (mo: MonthReport) => pickBucket(mo.entradas, mo.entradasByOrigem, origemFiltro).totalByMethod.pix, ""],
                            ["Débito", (mo: MonthReport) => pickBucket(mo.entradas, mo.entradasByOrigem, origemFiltro).totalByMethod.debit, ""],
                            ["Crédito", (mo: MonthReport) => pickBucket(mo.entradas, mo.entradasByOrigem, origemFiltro).totalByMethod.credit, ""],
                            ["Total Entradas", (mo: MonthReport) => pickBucket(mo.entradas, mo.entradasByOrigem, origemFiltro).total, "bg-emerald-50/60 text-emerald-700 font-semibold"],
                            ["Custo Fixo", (mo: MonthReport) => mo.custoFixo.total, "text-violet-700"],
                            ["Custo Variável", (mo: MonthReport) => mo.custoVariavel.total, "text-amber-700"],
                            ["Resultado", (mo: MonthReport) => pickBucket(mo.entradas, mo.entradasByOrigem, origemFiltro).total - mo.custoFixo.total - mo.custoVariavel.total, "bg-slate-50 font-semibold"],
                          ] as const).map(([label, getter, rowClass]) => {
                            const values = report.months.map(getter);
                            const total = values.reduce((a, b) => a + b, 0);
                            return (
                              <tr key={label} className={cn("border-b border-slate-50", rowClass)}>
                                <td className="sticky left-0 whitespace-nowrap bg-white px-3 py-2 text-xs font-medium">{label}</td>
                                {values.map((v, i) => (
                                  <td key={i} className={cn("whitespace-nowrap px-3 py-2 text-right text-xs tabular-nums", label === "Resultado" && (v >= 0 ? "text-emerald-700" : "text-rose-700"))}>
                                    R$ {fmt(v)}
                                  </td>
                                ))}
                                <td className={cn("whitespace-nowrap px-3 py-2 text-right text-xs font-semibold tabular-nums", label === "Resultado" && (total >= 0 ? "text-emerald-700" : "text-rose-700"))}>
                                  R$ {fmt(total)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </PanelCard>
                </div>
              </div>
            )}
          </Tabs>
        </div>
      </div>
    </PageWrapper>
  );
}
