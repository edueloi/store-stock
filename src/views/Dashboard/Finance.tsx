import React, { useState, useEffect, useMemo, useRef } from "react";
import ExcelJS from "exceljs";
import { motion, AnimatePresence } from "motion/react";
import PageHeader from "../../components/layout/PageHeader";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Plus,
  Minus,
  Search,
  Download,
  FileText,
  ChevronDown,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  SlidersHorizontal,
  FileSpreadsheet,
  X,
  Tag,
  Trash2,
  Pencil,
  CreditCard,
} from "lucide-react";
import { FinanceEntry, Tenant } from "../../types";
import { cn } from "../../lib/utils";
import Modal from "../../components/ui/Modal";

// ─── helpers ─────────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ─── Payment badges ───────────────────────────────────────────────────────────
interface PmSeg { method: string; brand: string; installments: number; amount: number }

function parsePmString(pm: string): PmSeg[] {
  return pm.split("|").map((seg) => {
    const [methodPart, amtStr] = seg.split(":");
    const tokens = methodPart.split("-");
    return {
      method:       tokens[0] ?? "money",
      brand:        tokens[1] ?? "other",
      installments: tokens[2] ? parseInt(tokens[2].replace("x",""), 10) : 1,
      amount:       parseFloat(amtStr ?? "0") || 0,
    };
  });
}

const PM_STYLE: Record<string, { bg: string; text: string; dot: string }> = {
  money:  { bg: "bg-slate-100",   text: "text-slate-600",  dot: "bg-slate-400"  },
  pix:    { bg: "bg-violet-50",   text: "text-violet-700", dot: "bg-violet-500" },
  debit:  { bg: "bg-blue-50",     text: "text-blue-700",   dot: "bg-blue-500"   },
  credit: { bg: "bg-emerald-50",  text: "text-emerald-700",dot: "bg-emerald-500"},
};
const PM_LABEL: Record<string, string> = { money: "Dinheiro", pix: "PIX", debit: "Débito", credit: "Crédito" };
const BRAND_LABEL: Record<string, string> = { visa: "Visa", master: "Master", elo: "Elo", amex: "Amex", hipercard: "Hiper" };

function PaymentBadges({ pm }: { pm: string }) {
  const segs = parsePmString(pm);
  return (
    <div className="flex flex-wrap gap-1">
      {segs.map((s, i) => {
        const st = PM_STYLE[s.method] ?? PM_STYLE.money;
        const brand = s.brand && s.brand !== "other" ? BRAND_LABEL[s.brand] ?? s.brand.toUpperCase() : null;
        const inst  = s.method === "credit" && s.installments > 1 ? `${s.installments}x` : null;
        return (
          <span key={i} className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wide", st.bg, st.text)}>
            <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", st.dot)} />
            {PM_LABEL[s.method] ?? s.method}
            {brand && <span className="opacity-70">/{brand}</span>}
            {inst  && <span className="opacity-70">{inst}</span>}
          </span>
        );
      })}
    </div>
  );
}

// ─── Payment method picker (modal use) ───────────────────────────────────────
const BRANDS = ["visa", "master", "elo", "amex", "hipercard"];
const BRAND_DISPLAY: Record<string, string> = { visa: "Visa", master: "Master", elo: "Elo", amex: "Amex", hipercard: "Hiper" };

function PaymentMethodPicker({
  value, onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  // Parse current value into segments
  const segs = value ? parsePmString(value) : [];
  const primarySeg = segs[0] ?? { method: "money", brand: "other", installments: 1, amount: 0 };
  const method = primarySeg.method;
  const brand  = primarySeg.brand === "other" ? "" : primarySeg.brand;
  const inst   = primarySeg.installments ?? 1;

  const build = (m: string, b: string, i: number) => {
    const brandPart = (m === "credit" || m === "debit") && b ? `-${b}` : "";
    const instPart  = m === "credit" && i > 1 ? `-${i}x` : "";
    return `${m}${brandPart}${instPart}`;
  };

  const setMethod = (m: string) => onChange(build(m, brand, inst));
  const setBrand  = (b: string) => onChange(build(method, b, inst));
  const setInst   = (i: number) => onChange(build(method, brand, i));

  const needsBrand = method === "credit" || method === "debit";
  const needsInst  = method === "credit";

  const methodBtns: { key: string; label: string; color: string }[] = [
    { key: "money",  label: "Dinheiro", color: "slate"   },
    { key: "pix",    label: "PIX",      color: "violet"  },
    { key: "debit",  label: "Débito",   color: "blue"    },
    { key: "credit", label: "Crédito",  color: "emerald" },
  ];

  const activeColor: Record<string, string> = {
    slate:   "bg-slate-700 text-white border-slate-700",
    violet:  "bg-violet-600 text-white border-violet-600",
    blue:    "bg-blue-600 text-white border-blue-600",
    emerald: "bg-emerald-600 text-white border-emerald-600",
  };

  return (
    <div className="space-y-2">
      {/* Method buttons */}
      <div className="grid grid-cols-4 gap-1.5">
        {methodBtns.map(({ key, label, color }) => (
          <button
            key={key} type="button"
            onClick={() => setMethod(key)}
            className={cn(
              "h-9 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all",
              method === key ? activeColor[color] : "bg-white text-slate-400 border-slate-200 hover:border-slate-400"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Brand (card only) */}
      {needsBrand && (
        <div className="flex gap-1.5 flex-wrap">
          {BRANDS.map((b) => (
            <button
              key={b} type="button"
              onClick={() => setBrand(b)}
              className={cn(
                "h-7 px-2.5 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all",
                brand === b
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-400 border-slate-200 hover:border-slate-400"
              )}
            >
              {BRAND_DISPLAY[b]}
            </button>
          ))}
        </div>
      )}

      {/* Installments (credit only) */}
      {needsInst && (
        <div className="flex gap-1.5 flex-wrap">
          {[1,2,3,4,5,6,7,8,9,10,11,12].map((n) => (
            <button
              key={n} type="button"
              onClick={() => setInst(n)}
              className={cn(
                "h-7 w-9 rounded-lg text-[9px] font-black border transition-all",
                inst === n
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-400 border-slate-200 hover:border-slate-400"
              )}
            >
              {n}x
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};


function formatDateBR(dateStr: string) {
  if (!dateStr) return "";
  const d = new Date(dateStr.substring(0, 10) + "T12:00:00");
  return d.toLocaleDateString("pt-BR");
}

// ─── Excel export — ExcelJS com estilos completos ────────────────────────────
async function exportToExcel(entries: FinanceEntry[], tenant: Partial<Tenant> | null, period: string) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Nexus ERP";
  wb.created = new Date();

  const ws = wb.addWorksheet("Financeiro", {
    pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true },
    views: [{ state: "frozen", ySplit: 9 }],
  });

  const totalIncome  = entries.filter(e => e.type === "income").reduce((a, e) => a + Number(e.amount), 0);
  const totalExpense = entries.filter(e => e.type === "expense").reduce((a, e) => a + Number(e.amount), 0);
  const balance      = totalIncome - totalExpense;

  const totalGrossExcel = entries.filter(e => e.type === "income").reduce((a, e) => a + Number(e.gross_amount ?? e.amount), 0);
  const totalDiscExcel  = entries.filter(e => e.type === "income").reduce((a, e) => a + Number(e.discount_amount ?? 0), 0);
  const totalFeesExcel  = entries.filter(e => e.type === "income").reduce((a, e) => a + Number(e.fee_amount ?? 0), 0);

  // ── column widths ──
  ws.columns = [
    { key: "seq",   width: 6  },
    { key: "desc",  width: 36 },
    { key: "date",  width: 14 },
    { key: "cat",   width: 16 },
    { key: "type",  width: 12 },
    { key: "gross", width: 15 },
    { key: "disc",  width: 14 },
    { key: "fee",   width: 14 },
    { key: "val",   width: 16 },
  ];

  // ── helper: apply border to a cell ──
  const border = (style: "thin" | "medium" = "thin"): Partial<ExcelJS.Borders> => ({
    top:    { style, color: { argb: style === "medium" ? "FF0F172A" : "FFE2E8F0" } },
    bottom: { style, color: { argb: style === "medium" ? "FF0F172A" : "FFE2E8F0" } },
    left:   { style, color: { argb: style === "medium" ? "FF0F172A" : "FFE2E8F0" } },
    right:  { style, color: { argb: style === "medium" ? "FF0F172A" : "FFE2E8F0" } },
  });

  const fill = (hex: string): ExcelJS.Fill => ({
    type: "pattern", pattern: "solid", fgColor: { argb: `FF${hex}` },
  });

  const font = (opts: {
    bold?: boolean; italic?: boolean; size?: number; color?: string; name?: string;
  }): Partial<ExcelJS.Font> => ({
    name: opts.name ?? "Calibri",
    size: opts.size ?? 11,
    bold: opts.bold ?? false,
    italic: opts.italic ?? false,
    color: { argb: `FF${opts.color ?? "1E293B"}` },
  });

  // ── ROW 1: company name ──
  ws.getRow(1).height = 30;
  const r1 = ws.getRow(1);
  const c1 = r1.getCell(1);
  c1.value = tenant?.name || "Nexus ERP";
  c1.font  = font({ bold: true, size: 20, color: "1E3A5F" });
  c1.alignment = { vertical: "middle" };

  // ── ROW 2: period + generated ──
  ws.getRow(2).height = 16;
  const r2 = ws.getRow(2);
  r2.getCell(1).value = `Relatório Financeiro  ·  Período: ${period}`;
  r2.getCell(1).font  = font({ italic: true, size: 10, color: "64748B" });
  r2.getCell(1).alignment = { vertical: "middle" };
  r2.getCell(6).value = `Gerado em: ${new Date().toLocaleString("pt-BR")}`;
  r2.getCell(6).font  = font({ italic: true, size: 9, color: "94A3B8" });
  r2.getCell(6).alignment = { horizontal: "right", vertical: "middle" };

  // ── ROW 3: meta (address / CNPJ / whatsapp) ──
  ws.getRow(3).height = 14;
  const metaParts: string[] = [];
  if (tenant?.address)       metaParts.push(`Endereço: ${tenant.address}`);
  if ((tenant as any)?.cnpj) metaParts.push(`CNPJ: ${(tenant as any).cnpj}`);
  if (tenant?.whatsapp)      metaParts.push(`WhatsApp: ${tenant.whatsapp}`);
  if (metaParts.length) {
    const c3 = ws.getRow(3).getCell(1);
    c3.value = metaParts.join("   |   ");
    c3.font  = font({ size: 9, color: "94A3B8" });
    c3.alignment = { vertical: "middle" };
  }

  // ── ROW 4: thin separator line ──
  ws.getRow(4).height = 4;
  for (let c = 1; c <= 9; c++) {
    ws.getRow(4).getCell(c).border = {
      bottom: { style: "medium", color: { argb: "FF1E3A5F" } },
    };
  }

  // ── ROWS 5–6: summary cards ──
  ws.getRow(5).height = 16;
  ws.getRow(6).height = 28;

  // Card labels (row 5) — 5 cards: Bruto / Descontos / Taxas / Líquido / Saldo
  // cols 1-2, 3-3, 4-4, 5-6, 7-8, 9 → use spans: [1,1],[2,1],[3,1],[4,2],[6,2],[8,2]
  // Simpler: 5 cards across 9 cols with varying spans
  const cardDefs = [
    { col: 1, span: 2, label: "ENTRADAS BRUTAS",   bg: "ECFDF5", fg: "065F46", val: totalGrossExcel, vfg: "059669" },
    { col: 3, span: 1, label: "DESCONTOS",         bg: "FFF1F2", fg: "9F1239", val: -totalDiscExcel, vfg: "E11D48" },
    { col: 4, span: 1, label: "TAXAS",             bg: "FFFBEB", fg: "92400E", val: -totalFeesExcel, vfg: "D97706" },
    { col: 5, span: 2, label: "ENTRADAS LÍQUIDAS", bg: "D1FAE5", fg: "065F46", val: totalIncome,     vfg: "059669" },
    { col: 7, span: 3, label: "SALDO CONSOLIDADO", bg: "1E293B", fg: "94A3B8", val: balance,         vfg: balance >= 0 ? "34D399" : "F87171" },
  ];
  for (const { col, span, label, bg, fg, val, vfg } of cardDefs) {
    const l5 = ws.getRow(5).getCell(col);
    l5.value = label;
    l5.font  = font({ bold: true, size: 8, color: fg });
    l5.fill  = fill(bg);
    l5.alignment = { horizontal: "center", vertical: "middle" };
    l5.border = { top: { style: "medium", color: { argb: `FF${fg}` } }, left: { style: "medium", color: { argb: `FF${fg}` } }, right: { style: "medium", color: { argb: `FF${fg}` } } };
    if (span > 1) ws.mergeCells(5, col, 5, col + span - 1);

    const l6 = ws.getRow(6).getCell(col);
    l6.value     = val;
    l6.numFmt    = '"R$" #,##0.00';
    l6.font      = font({ bold: true, size: 13, color: vfg });
    l6.fill      = fill(bg);
    l6.alignment = { horizontal: "center", vertical: "middle" };
    l6.border = { bottom: { style: "medium", color: { argb: `FF${fg}` } }, left: { style: "medium", color: { argb: `FF${fg}` } }, right: { style: "medium", color: { argb: `FF${fg}` } } };
    if (span > 1) ws.mergeCells(6, col, 6, col + span - 1);
  }
  const balColor = balance >= 0 ? "34D399" : "F87171";

  // ── ROW 7: blank gap ──
  ws.getRow(7).height = 6;

  // ── ROW 8: stats bar ──
  ws.getRow(8).height = 14;
  const statsCell = ws.getRow(8).getCell(1);
  statsCell.value = `${entries.length} lançamentos no período  ·  ${entries.filter(e => e.type === "income").length} receitas  ·  ${entries.filter(e => e.type === "expense").length} despesas`;
  statsCell.font  = font({ size: 9, color: "94A3B8", italic: true });
  statsCell.alignment = { vertical: "middle" };

  // ── ROW 9: table header ──
  ws.getRow(9).height = 22;
  const HEADERS = ["#", "Descrição", "Data", "Categoria", "Tipo", "Bruto (R$)", "Desc. (R$)", "Taxa (R$)", "Líquido (R$)"];
  HEADERS.forEach((h, i) => {
    const cell = ws.getRow(9).getCell(i + 1);
    cell.value = h;
    cell.font  = font({ bold: true, size: 10, color: "FFFFFF" });
    cell.fill  = fill("1E3A5F");
    cell.alignment = {
      horizontal: i >= 5 ? "right" : i === 0 ? "center" : "left",
      vertical: "middle",
    };
    cell.border = border("medium");
  });

  // ── DATA ROWS (10+) ──
  entries.forEach((e, i) => {
    const rowNum   = 10 + i;
    const isIncome = e.type === "income";
    const altBg    = i % 2 === 0 ? "FFFFFF" : "F8FAFC";
    const row      = ws.getRow(rowNum);
    row.height     = 20;

    const styleCell = (cell: ExcelJS.Cell, align: ExcelJS.Alignment["horizontal"] = "left") => {
      cell.fill      = fill(altBg);
      cell.alignment = { horizontal: align, vertical: "middle" };
      cell.border    = border("thin");
    };

    // # seq
    const cSeq = row.getCell(1);
    cSeq.value = i + 1;
    cSeq.font  = font({ size: 9, color: "94A3B8" });
    styleCell(cSeq, "center");

    // Descrição
    const cDesc = row.getCell(2);
    cDesc.value = e.description;
    cDesc.font  = font({ size: 10, bold: true });
    styleCell(cDesc, "left");

    // Data
    const cDate = row.getCell(3);
    cDate.value  = new Date(e.date + (e.date.length === 10 ? "T12:00:00" : ""));
    cDate.numFmt = "DD/MM/YYYY";
    cDate.font   = font({ size: 10, color: "475569" });
    styleCell(cDate, "center");

    // Categoria
    const cCat = row.getCell(4);
    cCat.value = e.category || "Operacional";
    cCat.font  = font({ size: 9, color: "6366F1" });
    styleCell(cCat, "center");

    // Tipo
    const cType = row.getCell(5);
    cType.value = isIncome ? "✦ Receita" : "▼ Despesa";
    cType.font  = font({ bold: true, size: 9, color: isIncome ? "059669" : "DC2626" });
    cType.fill  = fill(isIncome ? "D1FAE5" : "FEE2E2");
    cType.alignment = { horizontal: "center", vertical: "middle" };
    cType.border = border("thin");

    // Bruto
    const cGross = row.getCell(6);
    if (isIncome && e.gross_amount != null) {
      cGross.value  = Number(e.gross_amount);
      cGross.numFmt = '"R$" #,##0.00';
      cGross.font   = font({ size: 10, color: "475569" });
    } else {
      cGross.value = "—";
      cGross.font  = font({ size: 10, color: "CBD5E1" });
    }
    styleCell(cGross, "right");

    // Desconto
    const cDisc = row.getCell(7);
    const discVal = e.discount_amount != null ? Number(e.discount_amount) : 0;
    if (isIncome && discVal > 0) {
      cDisc.value  = -discVal;
      cDisc.numFmt = '"R$" #,##0.00;[Red]"R$" -#,##0.00';
      cDisc.font   = font({ bold: true, size: 10, color: "E11D48" });
    } else {
      cDisc.value = "—";
      cDisc.font  = font({ size: 10, color: "CBD5E1" });
    }
    styleCell(cDisc, "right");

    // Taxa
    const cFee = row.getCell(8);
    const feeVal = e.fee_amount != null ? Number(e.fee_amount) : 0;
    if (isIncome && feeVal > 0) {
      cFee.value  = -feeVal;
      cFee.numFmt = '"R$" #,##0.00;[Red]"R$" -#,##0.00';
      cFee.font   = font({ bold: true, size: 10, color: "D97706" });
    } else {
      cFee.value = "—";
      cFee.font  = font({ size: 10, color: "CBD5E1" });
    }
    styleCell(cFee, "right");

    // Líquido
    const cVal = row.getCell(9);
    cVal.value  = isIncome ? Number(e.amount) : -Number(e.amount);
    cVal.numFmt = isIncome ? '"R$" #,##0.00' : '"R$" #,##0.00;[Red]"R$" -#,##0.00';
    cVal.font   = font({ bold: true, size: 11, color: isIncome ? "059669" : "DC2626" });
    styleCell(cVal, "right");
  });

  // ── FOOTER TOTALS ──
  const footerStart = 10 + entries.length + 1;

  const addFooterRow = (rowN: number, label: string, val: number, bg: string, fg: string) => {
    const row = ws.getRow(rowN);
    row.height = 20;

    for (let c = 1; c <= 7; c++) {
      const cell = row.getCell(c);
      cell.fill = fill(bg);
      cell.border = border("thin");
    }

    const lCell = row.getCell(8);
    lCell.value = label;
    lCell.font  = font({ bold: true, size: 10, color: fg });
    lCell.fill  = fill(bg);
    lCell.alignment = { horizontal: "right", vertical: "middle" };
    lCell.border = border("thin");

    const vCell = row.getCell(9);
    vCell.value  = val;
    vCell.numFmt = '"R$" #,##0.00';
    vCell.font   = font({ bold: true, size: 11, color: fg });
    vCell.fill   = fill(bg);
    vCell.alignment = { horizontal: "right", vertical: "middle" };
    vCell.border = border("medium");
  };

  addFooterRow(footerStart,     "ENTRADAS BRUTAS",   totalGrossExcel,  "ECFDF5", "059669");
  addFooterRow(footerStart + 1, "DESCONTOS",         -totalDiscExcel,  "FFF1F2", "E11D48");
  addFooterRow(footerStart + 2, "TAXAS MAQUININHA",  -totalFeesExcel,  "FFFBEB", "D97706");
  addFooterRow(footerStart + 3, "ENTRADAS LÍQUIDAS", totalIncome,      "D1FAE5", "059669");
  addFooterRow(footerStart + 4, "TOTAL SAÍDAS",      totalExpense,     "FEE2E2", "DC2626");
  addFooterRow(footerStart + 5, "SALDO FINAL",       balance,          "1E293B", balColor);

  // ── download ──
  const buf  = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `Relatorio_Financeiro_${period.replace(/[^a-zA-Z0-9_-]/g, "_")}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── PDF export (print-based, no lib needed) ─────────────────────────────────
function exportToPDF(entries: FinanceEntry[], tenant: Partial<Tenant> | null, period: string) {
  const totalIncome = entries
    .filter((e) => e.type === "income")
    .reduce((a, e) => a + Number(e.amount), 0);
  const totalExpense = entries
    .filter((e) => e.type === "expense")
    .reduce((a, e) => a + Number(e.amount), 0);
  const balance = totalIncome - totalExpense;

  const totalGrossPDF = entries.filter(e => e.type === "income").reduce((a, e) => a + Number(e.gross_amount ?? e.amount), 0);
  const totalDiscPDF  = entries.filter(e => e.type === "income").reduce((a, e) => a + Number(e.discount_amount ?? 0), 0);
  const totalFeesPDF  = entries.filter(e => e.type === "income").reduce((a, e) => a + Number(e.fee_amount ?? 0), 0);

  const rows = entries
    .map((e) => {
      const gross    = e.gross_amount    != null ? Number(e.gross_amount)    : null;
      const discount = e.discount_amount != null ? Number(e.discount_amount) : null;
      const fee      = e.fee_amount      != null ? Number(e.fee_amount)      : null;
      return `
      <tr>
        <td>${e.description}</td>
        <td style="text-align:center">${formatDateBR(e.date)}</td>
        <td style="text-align:center">${e.category || "Operacional"}</td>
        <td style="text-align:right;color:#64748b">${gross != null ? "R$ " + fmt(gross) : "—"}</td>
        <td style="text-align:right;color:#e11d48;font-weight:700">${discount != null && discount > 0 ? "− R$ " + fmt(discount) : "—"}</td>
        <td style="text-align:right;color:#d97706;font-weight:700">${fee != null && fee > 0 ? "− R$ " + fmt(fee) : "—"}</td>
        <td class="${e.type === "income" ? "income" : "expense"}">
          ${e.type === "income" ? "+" : "−"} R$ ${fmt(Number(e.amount))}
        </td>
      </tr>`;
    })
    .join("");

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<title>Relatório Financeiro</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; padding: 32px; font-size: 12px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; border-bottom: 3px solid #1e40af; padding-bottom: 16px; }
  .brand h1 { font-size: 20px; font-weight: 900; color: #1e293b; text-transform: uppercase; letter-spacing: 0.1em; }
  .brand p { font-size: 10px; color: #64748b; margin-top: 2px; }
  .brand .logo { width: 48px; height: 48px; background: #2563eb; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 22px; font-weight: 900; margin-bottom: 8px; }
  .meta { text-align: right; font-size: 10px; color: #64748b; line-height: 1.8; }
  .meta strong { color: #1e293b; font-size: 11px; }
  .period { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 6px 14px; display: inline-block; font-size: 10px; font-weight: 700; color: #1d4ed8; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 20px; }
  .summary { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr 1fr; gap: 10px; margin-bottom: 24px; }
  .card.fees .val { color: #d97706; }
  .card.fees { background: #fffbeb; border-color: #fde68a; }
  .card.disc .val { color: #e11d48; }
  .card.disc { background: #fff1f2; border-color: #fecdd3; }
  .card { padding: 14px 16px; border-radius: 10px; border: 1px solid #e2e8f0; }
  .card label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.15em; display: block; margin-bottom: 4px; color: #94a3b8; }
  .card .val { font-size: 18px; font-weight: 900; font-family: monospace; }
  .card.income .val { color: #059669; }
  .card.expense .val { color: #dc2626; }
  .card.balance { background: #1e293b; border-color: #1e293b; }
  .card.balance label { color: #64748b; }
  .card.balance .val { color: #fff; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #f8fafc; border-bottom: 2px solid #e2e8f0; padding: 10px 12px; text-align: left; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.15em; color: #94a3b8; }
  td { padding: 9px 12px; border-bottom: 1px solid #f1f5f9; font-size: 11px; }
  tr:hover td { background: #f8fafc; }
  td.income { color: #059669; font-weight: 700; font-family: monospace; text-align: right; }
  td.expense { color: #dc2626; font-weight: 700; font-family: monospace; text-align: right; }
  th:last-child { text-align: right; }
  .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 9px; color: #94a3b8; display: flex; justify-content: space-between; }
  @media print { body { padding: 16px; } }
</style>
</head>
<body>
<div class="header">
  <div class="brand">
    ${tenant?.logo_url ? `<img src="${tenant.logo_url}" style="height:48px;margin-bottom:8px;border-radius:8px;" />` : `<div class="logo">N</div>`}
    <h1>${tenant?.name || "Nexus ERP"}</h1>
    <p>${tenant?.address || ""}</p>
    ${(tenant as any)?.cnpj ? `<p>CNPJ: ${(tenant as any).cnpj}</p>` : ""}
    ${tenant?.whatsapp ? `<p>WhatsApp: ${tenant.whatsapp}</p>` : ""}
  </div>
  <div class="meta">
    <strong>Relatório Financeiro</strong><br/>
    Gerado em: ${new Date().toLocaleString("pt-BR")}<br/>
    Sistema: Store BoxSys
  </div>
</div>
<div class="period">Período: ${period}</div>
<div class="summary">
  <div class="card income">
    <label>Entradas Brutas</label>
    <div class="val">R$ ${fmt(totalGrossPDF)}</div>
  </div>
  <div class="card disc">
    <label>Descontos</label>
    <div class="val">− R$ ${fmt(totalDiscPDF)}</div>
  </div>
  <div class="card fees">
    <label>Taxas Maquininha</label>
    <div class="val">− R$ ${fmt(totalFeesPDF)}</div>
  </div>
  <div class="card income">
    <label>Entradas Líquidas</label>
    <div class="val">R$ ${fmt(totalIncome)}</div>
  </div>
  <div class="card balance">
    <label>Saldo Consolidado</label>
    <div class="val" style="color:${balance >= 0 ? "#34d399" : "#f87171"}">R$ ${fmt(balance)}</div>
  </div>
</div>
<table>
  <thead>
    <tr>
      <th>Descrição</th>
      <th style="text-align:center">Data</th>
      <th style="text-align:center">Categoria</th>
      <th style="text-align:right">Bruto</th>
      <th style="text-align:right">Desc.</th>
      <th style="text-align:right">Taxa</th>
      <th style="text-align:right">Líquido</th>
    </tr>
  </thead>
  <tbody>${rows}</tbody>
</table>
<div class="footer">
  <span>${tenant?.name || "Nexus ERP"} · Relatório gerado pelo sistema Nexus</span>
  <span>Total de lançamentos: ${entries.length}</span>
</div>
</body>
</html>`;

  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 400);
}

// Payment keyword map — matches description text produced by sales.controller
const PAYMENT_KEYWORDS: Record<string, string[]> = {
  credit:  ["crédito", "credito"],
  debit:   ["débito", "debito"],
  pix:     ["pix"],
  money:   ["dinheiro"],
  boleto:  ["boleto"],
};

// ─── MONTH NAVIGATION ────────────────────────────────────────────────────────
type Preset = "month" | "custom";

function monthRange(year: number, month: number): { from: string; to: string } {
  const pad = (n: number) => String(n).padStart(2, "0");
  const lastDay = new Date(year, month + 1, 0).getDate();
  return {
    from: `${year}-${pad(month + 1)}-01`,
    to:   `${year}-${pad(month + 1)}-${pad(lastDay)}`,
  };
}


const MONTH_NAMES = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
export default function Finance() {
  const [entries, setEntries] = useState<FinanceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<"income" | "expense">("income");
  const [newEntry, setNewEntry] = useState<Partial<FinanceEntry>>({
    type: "income",
    date: today(),
  });
  const [saving, setSaving] = useState(false);
  const [tenant, setTenant] = useState<Partial<Tenant> | null>(null);

  // Filters
  const [preset, setPreset] = useState<Preset>("month");
  // current month navigation
  const nowRef = new Date();
  const [navYear, setNavYear]   = useState(nowRef.getFullYear());
  const [navMonth, setNavMonth] = useState(nowRef.getMonth()); // 0-based
  const [dateFrom, setDateFrom] = useState(() => monthRange(nowRef.getFullYear(), nowRef.getMonth()).from);
  const [dateTo,   setDateTo]   = useState(() => monthRange(nowRef.getFullYear(), nowRef.getMonth()).to);
  const [searchQ, setSearchQ] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "income" | "expense">("all");
  const [paymentFilter, setPaymentFilter] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);
  const [selectedEntry, setSelectedEntry] = useState<FinanceEntry | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<number>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ ids: number[]; bulk: boolean } | null>(null);
  const [editingEntry, setEditingEntry] = useState<FinanceEntry | null>(null);
  const [editForm, setEditForm] = useState<Partial<FinanceEntry>>({});
  const [editSaving, setEditSaving] = useState(false);

  const token = () => localStorage.getItem("token");

  // Close export dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setShowExport(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const fetchFinance = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/finance", {
        headers: { Authorization: `Bearer ${token()}` },
      });
      const data = await res.json();
      setEntries(Array.isArray(data) ? data : []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    fetchFinance();
    fetch("/api/tenant", { headers: { Authorization: `Bearer ${token()}` } })
      .then((r) => r.json())
      .then((d) => setTenant(d))
      .catch(() => {});
  }, []);

  const applyPreset = (p: Preset) => {
    setPreset(p);
    if (p === "month") {
      const range = monthRange(navYear, navMonth);
      setDateFrom(range.from);
      setDateTo(range.to);
    }
  };

  const navigateMonth = (delta: number) => {
    let m = navMonth + delta;
    let y = navYear;
    if (m > 11) { m = 0;  y++; }
    if (m < 0)  { m = 11; y--; }
    setNavMonth(m);
    setNavYear(y);
    setPreset("month");
    const range = monthRange(y, m);
    setDateFrom(range.from);
    setDateTo(range.to);
  };

  const openModal = (type: "income" | "expense") => {
    setModalType(type);
    setNewEntry({ type, date: today(), payment_method: "money" } as any);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/finance", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify(newEntry),
      });
      if (res.ok) {
        setIsModalOpen(false);
        fetchFinance();
      }
    } catch {}
    setSaving(false);
  };

  const handleDeleteOne = (id: number) => {
    setConfirmDelete({ ids: [id], bulk: false });
  };

  const handleDeleteBulk = () => {
    if (checkedIds.size === 0) return;
    setConfirmDelete({ ids: [...checkedIds], bulk: true });
  };

  const executeDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      if (confirmDelete.bulk || confirmDelete.ids.length > 1) {
        const res = await fetch("/api/finance/bulk", {
          method: "DELETE",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
          body: JSON.stringify({ ids: confirmDelete.ids }),
        });
        if (res.ok) {
          setCheckedIds(new Set());
          fetchFinance();
        }
      } else {
        const res = await fetch(`/api/finance/${confirmDelete.ids[0]}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token()}` },
        });
        if (res.ok) {
          setSelectedEntry(null);
          setCheckedIds((prev) => { const s = new Set(prev); s.delete(confirmDelete.ids[0]); return s; });
          fetchFinance();
        }
      }
    } catch {}
    setDeleting(false);
    setConfirmDelete(null);
  };

  const openEdit = (entry: FinanceEntry) => {
    setEditingEntry(entry);
    setEditForm({ ...entry });
    setSelectedEntry(null);
  };

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEntry) return;
    setEditSaving(true);
    try {
      const res = await fetch(`/api/finance/${editingEntry.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify(editForm),
      });
      if (res.ok) {
        setEditingEntry(null);
        fetchFinance();
      }
    } catch {}
    setEditSaving(false);
  };

  const toggleCheck = (id: number) => {
    setCheckedIds((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });
  };

  const toggleCheckAll = () => {
    if (checkedIds.size === filtered.length) {
      setCheckedIds(new Set());
    } else {
      setCheckedIds(new Set(filtered.map((e) => e.id)));
    }
  };

  // Filtered entries
  const filtered = useMemo(() => {
    return entries.filter((e) => {
      const entryDate = e.date.substring(0, 10);
      if (entryDate < dateFrom || entryDate > dateTo) return false;
      if (typeFilter !== "all" && e.type !== typeFilter) return false;
      if (searchQ && !e.description.toLowerCase().includes(searchQ.toLowerCase())) return false;
      if (paymentFilter.size > 0) {
        let matched = false;
        if (e.payment_method) {
          // Use payment_method field (source of truth after edits)
          const segs = parsePmString(e.payment_method);
          matched = [...paymentFilter].some((key) => segs.some((s) => s.method === key));
        } else {
          // Fallback: scan description text
          const desc = e.description.toLowerCase();
          matched = [...paymentFilter].some((key) =>
            (PAYMENT_KEYWORDS[key] ?? [key]).some((kw) => desc.includes(kw))
          );
        }
        if (!matched) return false;
      }
      return true;
    });
  }, [entries, dateFrom, dateTo, typeFilter, searchQ, paymentFilter]);

  const incomeEntries    = filtered.filter((e) => e.type === "income");
  const expenseEntries   = filtered.filter((e) => e.type === "expense");
  const totalIncome      = incomeEntries.reduce((a, e) => a + Number(e.amount), 0);
  const totalGross       = incomeEntries.reduce((a, e) => a + Number(e.gross_amount ?? e.amount), 0);
  const totalFees        = incomeEntries.reduce((a, e) => a + Number(e.fee_amount ?? 0), 0);
  const totalDiscounts   = incomeEntries.reduce((a, e) => a + Number(e.discount_amount ?? 0), 0);
  const totalExpense     = expenseEntries.reduce((a, e) => a + Number(e.amount), 0);
  const balance          = totalIncome - totalExpense;

  const periodLabel = preset === "month"
    ? `${MONTH_NAMES[navMonth]} ${navYear}`
    : `${formatDateBR(dateFrom)} a ${formatDateBR(dateTo)}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fluxo de Caixa"
        subtitle="Controle de tesouraria & lançamentos"
        action={
          <div className="flex gap-2">
            <button
              onClick={() => openModal("income")}
              className="h-9 px-4 bg-emerald-600 text-white rounded-xl flex items-center gap-2 text-[10px] font-black uppercase tracking-widest hover:bg-emerald-500 transition-all active:scale-95"
            >
              <Plus size={13} strokeWidth={3} /> Receita
            </button>
            <button
              onClick={() => openModal("expense")}
              className="h-9 px-4 bg-rose-600 text-white rounded-xl flex items-center gap-2 text-[10px] font-black uppercase tracking-widest hover:bg-rose-500 transition-all active:scale-95"
            >
              <Minus size={13} strokeWidth={3} /> Despesa
            </button>
          </div>
        }
      />

      {/* ── SUMMARY CARDS ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Entradas card — shows gross + fee breakdown */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">
            Total Entradas
          </div>
          <div className="text-2xl font-mono font-black text-emerald-600">
            R$ {fmt(totalIncome)}
          </div>
          {(totalFees > 0 || totalDiscounts > 0) ? (
            <div className="mt-2 flex flex-col gap-0.5">
              <div className="flex items-center justify-between text-[9px] font-bold uppercase">
                <span className="text-slate-400">Bruto</span>
                <span className="text-slate-500 font-mono">R$ {fmt(totalGross)}</span>
              </div>
              {totalDiscounts > 0 && (
                <div className="flex items-center justify-between text-[9px] font-bold uppercase">
                  <span className="text-rose-400">Descontos</span>
                  <span className="text-rose-400 font-mono">− R$ {fmt(totalDiscounts)}</span>
                </div>
              )}
              {totalFees > 0 && (
                <div className="flex items-center justify-between text-[9px] font-bold uppercase">
                  <span className="text-amber-500">Taxas</span>
                  <span className="text-amber-500 font-mono">− R$ {fmt(totalFees)}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="mt-2 text-[9px] font-bold text-slate-400 uppercase">
              {incomeEntries.length} lançamentos
            </div>
          )}
          <div className="absolute right-4 top-4 w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-400">
            <ArrowUpRight size={20} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">
            Total Saídas
          </div>
          <div className="text-2xl font-mono font-black text-rose-600">
            R$ {fmt(totalExpense)}
          </div>
          <div className="mt-2 text-[9px] font-bold text-slate-400 uppercase">
            {expenseEntries.length} lançamentos
          </div>
          <div className="absolute right-4 top-4 w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center text-rose-400">
            <ArrowDownRight size={20} />
          </div>
        </div>

        <div
          className={cn(
            "p-5 rounded-2xl shadow-xl relative overflow-hidden",
            balance >= 0 ? "bg-slate-900" : "bg-rose-900"
          )}
        >
          <div className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2">
            Saldo Consolidado
          </div>
          <div
            className={cn(
              "text-2xl font-mono font-black",
              balance >= 0 ? "text-white" : "text-rose-300"
            )}
          >
            R$ {fmt(balance)}
          </div>
          <div className="mt-2 text-[9px] font-bold text-slate-600 uppercase">
            Período: {periodLabel}
          </div>
          <div className="absolute right-4 top-4 w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-slate-600">
            <Wallet size={20} />
          </div>
        </div>
      </div>

      {/* ── TRANSACTION TABLE ───────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        {/* Toolbar */}
        <div className="px-5 py-3 border-b border-slate-100 flex flex-col gap-3">
          {/* Row 1: title + actions */}
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-800 flex items-center gap-2">
              <FileText size={13} className="text-blue-600" />
              Histórico de Movimentações
              <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md font-mono text-[9px]">
                {filtered.length}
              </span>
            </h3>
            <div className="flex items-center gap-2">
              {/* Filter toggle */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={cn(
                  "h-8 px-3 rounded-lg flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest border transition-all relative",
                  showFilters || paymentFilter.size > 0
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-slate-500 border-slate-200 hover:border-slate-400"
                )}
              >
                <SlidersHorizontal size={12} />
                <span className="hidden sm:block">Filtros</span>
                {paymentFilter.size > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white rounded-full text-[8px] font-black flex items-center justify-center">
                    {paymentFilter.size}
                  </span>
                )}
              </button>

              {/* Export dropdown */}
              <div className="relative" ref={exportRef}>
                <button
                  onClick={() => setShowExport(!showExport)}
                  className="h-8 px-3 rounded-lg flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest border border-slate-200 bg-white text-slate-500 hover:border-slate-400 transition-all"
                >
                  <Download size={12} />
                  <span className="hidden sm:block">Exportar</span>
                  <ChevronDown size={10} />
                </button>
                {showExport && (
                  <div className="absolute right-0 top-10 w-48 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden">
                    <button
                      onClick={() => {
                        exportToExcel(filtered, tenant, periodLabel);
                        setShowExport(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      <FileSpreadsheet size={14} className="text-emerald-600" />
                      Excel (.xlsx)
                    </button>
                    <div className="h-px bg-slate-100 mx-3" />
                    <button
                      onClick={() => {
                        exportToPDF(filtered, tenant, periodLabel);
                        setShowExport(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      <FileText size={14} className="text-rose-600" />
                      PDF / Imprimir
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Row 2: month navigator + mode toggle */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* ← Mês → navigator */}
            <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl p-1">
              <button
                onClick={() => navigateMonth(-1)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:bg-white hover:text-slate-900 transition-all"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <button
                onClick={() => setPreset("month")}
                className={cn(
                  "px-4 h-7 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all min-w-[160px] text-center",
                  preset === "month"
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-white"
                )}
              >
                {MONTH_NAMES[navMonth]} {navYear}
              </button>
              <button
                onClick={() => navigateMonth(1)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:bg-white hover:text-slate-900 transition-all"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            </div>

            {/* Custom range toggle */}
            <button
              onClick={() => setPreset(preset === "custom" ? "month" : "custom")}
              className={cn(
                "h-9 px-3 rounded-xl flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest border transition-all",
                preset === "custom"
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-slate-400 border-slate-200 hover:border-slate-400"
              )}
            >
              <Calendar size={12} /> Período Livre
            </button>

            {/* Custom date inputs (only visible when custom) */}
            {preset === "custom" && (
              <div className="flex items-center gap-2">
                <div className="relative">
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="pl-3 pr-3 h-9 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-bold focus:outline-none focus:border-blue-400 transition-all w-[148px]"
                  />
                </div>
                <span className="text-[10px] font-black text-slate-300 uppercase">até</span>
                <div className="relative">
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="pl-3 pr-3 h-9 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-bold focus:outline-none focus:border-blue-400 transition-all w-[148px]"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Row 3: expanded filters */}
          {showFilters && (
            <div className="flex flex-col gap-3 pt-2 border-t border-slate-100">
              {/* Row A: search + type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
                  <input
                    type="text"
                    placeholder="Pesquisar descrição..."
                    value={searchQ}
                    onChange={(e) => setSearchQ(e.target.value)}
                    className="w-full pl-8 pr-3 h-9 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-bold uppercase tracking-widest placeholder:text-slate-300 focus:outline-none focus:border-blue-400 transition-all"
                  />
                </div>
                {/* Type filter */}
                <div className="flex gap-1.5">
                  {(["all", "income", "expense"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setTypeFilter(t)}
                      className={cn(
                        "flex-1 h-9 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all",
                        typeFilter === t
                          ? t === "income"
                            ? "bg-emerald-600 text-white border-emerald-600"
                            : t === "expense"
                            ? "bg-rose-600 text-white border-rose-600"
                            : "bg-slate-900 text-white border-slate-900"
                          : "bg-white text-slate-400 border-slate-200 hover:border-slate-400"
                      )}
                    >
                      {t === "all" ? "Todos" : t === "income" ? "Receitas" : "Despesas"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Row B: payment method chips (multi-select) */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest shrink-0">
                  Pagamento:
                </span>
                {([
                  { key: "credit", label: "Crédito",  color: "blue"   },
                  { key: "debit",  label: "Débito",   color: "violet" },
                  { key: "pix",    label: "PIX",      color: "emerald"},
                  { key: "money",  label: "Dinheiro", color: "slate"  },
                  { key: "boleto", label: "Boleto",   color: "amber"  },
                ] as const).map(({ key, label, color }) => {
                  const active = paymentFilter.has(key);
                  const toggle = () => {
                    setPaymentFilter((prev) => {
                      const next = new Set(prev);
                      if (next.has(key)) next.delete(key); else next.add(key);
                      return next;
                    });
                  };
                  const activeClass =
                    color === "blue"    ? "bg-blue-600 text-white border-blue-600" :
                    color === "violet"  ? "bg-violet-600 text-white border-violet-600" :
                    color === "emerald" ? "bg-emerald-600 text-white border-emerald-600" :
                    color === "amber"   ? "bg-amber-500 text-white border-amber-500" :
                                          "bg-slate-700 text-white border-slate-700";
                  return (
                    <button
                      key={key}
                      onClick={toggle}
                      className={cn(
                        "h-7 px-3 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all",
                        active ? activeClass : "bg-white text-slate-400 border-slate-200 hover:border-slate-400"
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
                {paymentFilter.size > 0 && (
                  <button
                    onClick={() => setPaymentFilter(new Set())}
                    className="h-7 px-2 rounded-lg text-[9px] font-black text-slate-400 hover:text-slate-700 transition-colors flex items-center gap-1"
                  >
                    <X size={10} /> Limpar
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Bulk action bar */}
        {checkedIds.size > 0 && (
          <div className="flex items-center gap-3 px-4 py-2 bg-rose-50 border border-rose-200 rounded-xl mx-0">
            <span className="text-[10px] font-black text-rose-700 uppercase tracking-widest">
              {checkedIds.size} selecionado(s)
            </span>
            <button
              onClick={handleDeleteBulk}
              disabled={deleting}
              className="ml-auto flex items-center gap-1.5 h-8 px-3 bg-rose-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-rose-500 transition-colors disabled:opacity-50"
            >
              {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
              Excluir selecionados
            </button>
            <button
              onClick={() => setCheckedIds(new Set())}
              className="h-8 px-2 text-rose-500 hover:text-rose-700 transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Desktop Table */}
        <div className="hidden sm:block overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={22} className="animate-spin text-slate-300" />
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100">
                  <th className="px-3 py-3 w-8">
                    <input
                      type="checkbox"
                      checked={filtered.length > 0 && checkedIds.size === filtered.length}
                      onChange={toggleCheckAll}
                      className="w-3.5 h-3.5 rounded accent-slate-700 cursor-pointer"
                    />
                  </th>
                  <th className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest w-2/5">
                    Descrição
                  </th>
                  <th className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                    Data
                  </th>
                  <th className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                    Categoria
                  </th>
                  <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">
                    Bruto
                  </th>
                  <th className="px-4 py-3 text-[9px] font-black text-rose-400 uppercase tracking-widest text-right">
                    Desc.
                  </th>
                  <th className="px-4 py-3 text-[9px] font-black text-amber-400 uppercase tracking-widest text-right">
                    Taxa
                  </th>
                  <th className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">
                    Líquido
                  </th>
                  <th className="px-3 py-3 w-16" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((entry, idx) => {
                  const gross    = entry.gross_amount    != null ? Number(entry.gross_amount)    : null;
                  const discount = entry.discount_amount != null ? Number(entry.discount_amount) : null;
                  const fee      = entry.fee_amount      != null ? Number(entry.fee_amount)      : null;
                  const checked  = checkedIds.has(entry.id);
                  return (
                    <tr
                      key={entry.id}
                      className={cn(
                        "border-b border-slate-50 hover:bg-blue-50/30 transition-colors",
                        idx % 2 === 0 ? "" : "bg-slate-50/20",
                        checked ? "bg-blue-50/40" : ""
                      )}
                    >
                      <td className="px-3 py-3" onClick={(ev) => ev.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleCheck(entry.id)}
                          className="w-3.5 h-3.5 rounded accent-slate-700 cursor-pointer"
                        />
                      </td>
                      <td className="px-5 py-3 cursor-pointer" onClick={() => setSelectedEntry(entry)}>
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-white",
                              entry.type === "income" ? "bg-emerald-500" : "bg-rose-500"
                            )}
                          >
                            {entry.type === "income" ? (
                              <TrendingUp size={12} />
                            ) : (
                              <TrendingDown size={12} />
                            )}
                          </div>
                          <div className="flex flex-col gap-1 min-w-0">
                            <span className="text-[11px] font-bold text-slate-800 uppercase truncate max-w-[280px]">
                              {entry.description.split(" — ")[0]}
                            </span>
                            {entry.payment_method
                              ? <PaymentBadges pm={entry.payment_method} />
                              : entry.description.includes(" — ") && (
                                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide truncate max-w-[280px]">
                                    {entry.description.split(" — ").slice(1).join(" — ")}
                                  </span>
                                )
                            }
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 cursor-pointer" onClick={() => setSelectedEntry(entry)}>
                        <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                          {formatDateBR(entry.date)}
                        </span>
                      </td>
                      <td className="px-5 py-3 cursor-pointer" onClick={() => setSelectedEntry(entry)}>
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-md">
                          {entry.category || "Operacional"}
                        </span>
                      </td>
                      {/* Bruto */}
                      <td className="px-4 py-3 text-right cursor-pointer" onClick={() => setSelectedEntry(entry)}>
                        {gross != null ? (
                          <span className="font-mono text-[11px] font-bold text-slate-500">
                            R$ {fmt(gross)}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-200">—</span>
                        )}
                      </td>
                      {/* Desconto */}
                      <td className="px-4 py-3 text-right cursor-pointer" onClick={() => setSelectedEntry(entry)}>
                        {discount != null && discount > 0 ? (
                          <span className="font-mono text-[11px] font-bold text-rose-400">
                            − R$ {fmt(discount)}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-200">—</span>
                        )}
                      </td>
                      {/* Taxa */}
                      <td className="px-4 py-3 text-right cursor-pointer" onClick={() => setSelectedEntry(entry)}>
                        {fee != null && fee > 0 ? (
                          <span className="font-mono text-[11px] font-bold text-amber-500">
                            − R$ {fmt(fee)}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-200">—</span>
                        )}
                      </td>
                      {/* Líquido */}
                      <td className="px-5 py-3 text-right cursor-pointer" onClick={() => setSelectedEntry(entry)}>
                        <span
                          className={cn(
                            "font-mono font-black text-sm",
                            entry.type === "income" ? "text-emerald-600" : "text-rose-600"
                          )}
                        >
                          {entry.type === "income" ? "+" : "−"} R$ {fmt(Number(entry.amount))}
                        </span>
                      </td>
                      {/* Ações */}
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(ev) => { ev.stopPropagation(); openEdit(entry); }}
                            className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all"
                            title="Editar"
                          >
                            <Pencil size={11} />
                          </button>
                          <button
                            onClick={(ev) => { ev.stopPropagation(); handleDeleteOne(entry.id); }}
                            disabled={deleting}
                            className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all disabled:opacity-40"
                            title="Excluir"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-5 py-14 text-center text-[10px] font-black uppercase tracking-widest text-slate-300"
                    >
                      Nenhum lançamento no período selecionado
                    </td>
                  </tr>
                )}
              </tbody>
              {filtered.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-900 text-white">
                    <td className="px-3 py-3" />
                    <td className="px-5 py-3 text-[9px] font-black uppercase tracking-widest text-slate-400" colSpan={2}>
                      Totais do período
                    </td>
                    <td className="px-5 py-3" />
                    <td className="px-4 py-3 text-right">
                      {totalGross > totalIncome && (
                        <span className="text-[10px] font-black text-slate-400 font-mono">
                          R$ {fmt(totalGross)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {totalDiscounts > 0 && (
                        <span className="text-[10px] font-black text-rose-400 font-mono">
                          − R$ {fmt(totalDiscounts)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {totalFees > 0 && (
                        <span className="text-[10px] font-black text-amber-400 font-mono">
                          − R$ {fmt(totalFees)}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <span className="text-[10px] font-black text-emerald-400 font-mono block">
                        + R$ {fmt(totalIncome)}
                      </span>
                      <span
                        className={cn(
                          "text-sm font-mono font-black block",
                          balance >= 0 ? "text-white" : "text-rose-400"
                        )}
                      >
                        R$ {fmt(balance)}
                      </span>
                    </td>
                    <td className="px-3 py-3" />
                  </tr>
                </tfoot>
              )}
            </table>
          )}
        </div>

        {/* Mobile list */}
        <div className="sm:hidden divide-y divide-slate-50">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 size={20} className="animate-spin text-slate-300" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-4 py-12 text-center text-[10px] font-black uppercase tracking-widest text-slate-300">
              Nenhum lançamento no período
            </div>
          ) : (
            filtered.map((entry) => {
              const gross    = entry.gross_amount    != null ? Number(entry.gross_amount)    : null;
              const discount = entry.discount_amount != null ? Number(entry.discount_amount) : null;
              const fee      = entry.fee_amount      != null ? Number(entry.fee_amount)      : null;
              const checked  = checkedIds.has(entry.id);
              return (
                <div key={entry.id} className={cn("px-4 py-3.5 flex items-center gap-3 hover:bg-blue-50/30 transition-colors", checked ? "bg-blue-50/40" : "")}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleCheck(entry.id)}
                    className="w-4 h-4 rounded accent-slate-700 cursor-pointer shrink-0"
                  />
                  <div
                    onClick={() => setSelectedEntry(entry)}
                    className={cn(
                      "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-white cursor-pointer",
                      entry.type === "income" ? "bg-emerald-500" : "bg-rose-500"
                    )}
                  >
                    {entry.type === "income" ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
                  </div>
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setSelectedEntry(entry)}>
                    <p className="text-[11px] font-bold text-slate-900 uppercase truncate">
                      {entry.description}
                    </p>
                    <p className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">
                      {formatDateBR(entry.date)} · {entry.category || "Operacional"}
                    </p>
                    {(gross != null || (discount != null && discount > 0) || (fee != null && fee > 0)) && (
                      <p className="text-[9px] font-bold mt-0.5 flex gap-2 flex-wrap">
                        {gross != null && <span className="text-slate-400">Bruto R$ {fmt(gross)}</span>}
                        {discount != null && discount > 0 && <span className="text-rose-400">Desc. − R$ {fmt(discount)}</span>}
                        {fee != null && fee > 0 && <span className="text-amber-500">Taxa − R$ {fmt(fee)}</span>}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span
                      className={cn(
                        "text-sm font-mono font-black",
                        entry.type === "income" ? "text-emerald-600" : "text-rose-600"
                      )}
                    >
                      {entry.type === "income" ? "+" : "−"}R$ {fmt(Number(entry.amount))}
                    </span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => openEdit(entry)}
                        className="w-6 h-6 rounded-md bg-slate-100 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all"
                      >
                        <Pencil size={10} />
                      </button>
                      <button
                        onClick={() => handleDeleteOne(entry.id)}
                        disabled={deleting}
                        className="w-6 h-6 rounded-md bg-slate-100 flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all disabled:opacity-40"
                      >
                        <Trash2 size={10} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── ENTRY DETAIL PANEL ─────────────────────────────────────────── */}
      <AnimatePresence>
        {selectedEntry && (() => {
          const e = selectedEntry;
          const gross    = e.gross_amount    != null ? Number(e.gross_amount)    : null;
          const discount = e.discount_amount != null ? Number(e.discount_amount) : null;
          const fee      = e.fee_amount      != null ? Number(e.fee_amount)      : null;
          const net      = Number(e.amount);
          const isIncome = e.type === "income";

          // Parse date — always use only YYYY-MM-DD to avoid UTC conversion shifting the day
          const rawDate = e.date;
          const dateObj = new Date(rawDate.substring(0, 10) + "T12:00:00");
          const dateFormatted = dateObj.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
          const timeFormatted = null;

          return (
            <>
              {/* backdrop */}
              <motion.div
                key="finance-detail-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
                onClick={() => setSelectedEntry(null)}
              />
              {/* panel */}
              <motion.div
                key="finance-detail-panel"
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "spring", damping: 28, stiffness: 300 }}
                className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col overflow-hidden"
              >
                {/* Header */}
                <div className={cn(
                  "px-6 py-5 flex items-start justify-between border-b border-slate-100",
                  isIncome ? "bg-emerald-50" : "bg-rose-50"
                )}>
                  <div className="flex-1 min-w-0">
                    <div className={cn(
                      "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest mb-2",
                      isIncome ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                    )}>
                      {isIncome ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                      {isIncome ? "Receita" : "Despesa"}
                    </div>
                    <p className="text-[13px] font-black text-slate-900 uppercase leading-tight">
                      {e.description}
                    </p>
                    <p className="text-[10px] text-slate-500 font-bold mt-1">
                      {dateFormatted}{timeFormatted ? ` · ${timeFormatted}` : ""}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedEntry(null)}
                    className="ml-4 w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:border-slate-400 transition-all shrink-0"
                  >
                    <X size={14} />
                  </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

                  {/* Category */}
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                      <Tag size={14} />
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Categoria</p>
                      <p className="text-[12px] font-bold text-slate-800 uppercase">{e.category || "Operacional"}</p>
                    </div>
                  </div>

                  {/* Payment method */}
                  {e.payment_method && (
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                        <CreditCard size={14} />
                      </div>
                      <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Pagamento</p>
                        <PaymentBadges pm={e.payment_method} />
                      </div>
                    </div>
                  )}

                  {/* Financial breakdown */}
                  {(gross != null || discount != null || fee != null) ? (
                    <div className="bg-slate-50 rounded-2xl border border-slate-100 overflow-hidden">
                      <div className="px-4 py-2 border-b border-slate-100 bg-slate-100/60">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Composição do Valor</p>
                      </div>
                      <div className="divide-y divide-slate-100">
                        {gross != null && (
                          <div className="flex items-center justify-between px-4 py-3">
                            <span className="text-[10px] font-bold text-slate-500 uppercase">Bruto</span>
                            <span className="font-mono text-[12px] font-bold text-slate-700">R$ {fmt(gross)}</span>
                          </div>
                        )}
                        {discount != null && discount > 0 && (
                          <div className="flex items-center justify-between px-4 py-3">
                            <span className="text-[10px] font-bold text-rose-400 uppercase">Desconto</span>
                            <span className="font-mono text-[12px] font-bold text-rose-500">− R$ {fmt(discount)}</span>
                          </div>
                        )}
                        {fee != null && fee > 0 && (
                          <div className="flex items-center justify-between px-4 py-3">
                            <span className="text-[10px] font-bold text-amber-500 uppercase">Taxa Maquininha</span>
                            <span className="font-mono text-[12px] font-bold text-amber-600">− R$ {fmt(fee)}</span>
                          </div>
                        )}
                        <div className={cn(
                          "flex items-center justify-between px-4 py-3",
                          isIncome ? "bg-emerald-50" : "bg-rose-50"
                        )}>
                          <span className={cn("text-[10px] font-black uppercase tracking-wider", isIncome ? "text-emerald-700" : "text-rose-700")}>
                            Líquido
                          </span>
                          <span className={cn("font-mono text-[15px] font-black", isIncome ? "text-emerald-600" : "text-rose-600")}>
                            {isIncome ? "+" : "−"} R$ {fmt(net)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Simple entry — just show the amount big */
                    <div className={cn(
                      "rounded-2xl border p-5 text-center",
                      isIncome ? "bg-emerald-50 border-emerald-100" : "bg-rose-50 border-rose-100"
                    )}>
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Valor</p>
                      <p className={cn("text-3xl font-mono font-black", isIncome ? "text-emerald-600" : "text-rose-600")}>
                        {isIncome ? "+" : "−"} R$ {fmt(net)}
                      </p>
                    </div>
                  )}

                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-100 flex gap-2">
                  <button
                    onClick={() => openEdit(e)}
                    className="flex-1 h-11 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-500 transition-colors flex items-center justify-center gap-2"
                  >
                    <Pencil size={13} /> Editar
                  </button>
                  <button
                    onClick={() => handleDeleteOne(e.id)}
                    disabled={deleting}
                    className="flex-1 h-11 bg-rose-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-500 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Trash2 size={13} /> Excluir
                  </button>
                  <button
                    onClick={() => setSelectedEntry(null)}
                    className="h-11 px-4 border border-slate-200 text-slate-500 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              </motion.div>
            </>
          );
        })()}
      </AnimatePresence>

      {/* ── CONFIRM DELETE MODAL ─────────────────────────────────────────── */}
      <AnimatePresence>
        {confirmDelete && (
          <>
            <motion.div
              key="confirm-delete-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60]"
              onClick={() => !deleting && setConfirmDelete(null)}
            />
            <motion.div
              key="confirm-delete-modal"
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: "spring", damping: 25, stiffness: 350 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[61] w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="px-6 pt-6 pb-2 flex items-start gap-4">
                <div className="w-11 h-11 rounded-xl bg-rose-100 flex items-center justify-center shrink-0">
                  <Trash2 size={20} className="text-rose-600" />
                </div>
                <div>
                  <p className="text-[13px] font-black text-slate-900 uppercase tracking-wide">
                    {confirmDelete.ids.length > 1 ? `Excluir ${confirmDelete.ids.length} lançamentos?` : "Excluir lançamento?"}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {confirmDelete.ids.length > 1
                      ? "Essa ação não pode ser desfeita. Os registros serão removidos permanentemente."
                      : "Essa ação não pode ser desfeita. O registro será removido permanentemente."}
                  </p>
                </div>
              </div>
              <div className="px-6 py-5 flex gap-2">
                <button
                  onClick={() => setConfirmDelete(null)}
                  disabled={deleting}
                  className="flex-1 h-11 border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={executeDelete}
                  disabled={deleting}
                  className="flex-1 h-11 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={13} />}
                  {deleting ? "Excluindo..." : "Excluir"}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── EDIT ENTRY MODAL ─────────────────────────────────────────────── */}
      <Modal
        open={!!editingEntry}
        onClose={() => setEditingEntry(null)}
        title="Editar Lançamento"
        size="sm"
        footer={
          <>
            <button
              type="button"
              onClick={() => setEditingEntry(null)}
              className="flex-1 h-10 border border-slate-200 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              form="edit-finance-form"
              type="submit"
              disabled={editSaving}
              className="flex-1 h-10 text-white rounded-xl text-[10px] font-black uppercase tracking-widest bg-blue-600 hover:bg-blue-500 transition-all shadow-lg shadow-blue-200 flex items-center justify-center gap-2"
            >
              {editSaving ? <Loader2 size={14} className="animate-spin" /> : "Salvar"}
            </button>
          </>
        }
      >
        <form id="edit-finance-form" onSubmit={handleEditSave} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.18em] px-1 block">
              Descrição
            </label>
            <input
              type="text"
              required
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 h-11 text-xs font-bold focus:ring-2 focus:ring-blue-500/10 focus:border-blue-400 outline-none transition-all"
              value={editForm.description || ""}
              onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.18em] px-1 block">
              Valor (R$)
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              required
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 h-11 text-sm font-mono font-bold focus:ring-2 focus:ring-blue-500/10 focus:border-blue-400 outline-none transition-all"
              value={editForm.amount || ""}
              onChange={(e) => setEditForm({ ...editForm, amount: Number(e.target.value) })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.18em] px-1 block">
                Data
              </label>
              <input
                type="date"
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 h-11 text-xs font-bold focus:ring-2 focus:ring-blue-500/10 focus:border-blue-400 outline-none transition-all"
                value={editForm.date ? editForm.date.substring(0, 10) : ""}
                onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.18em] px-1 block">
                Categoria
              </label>
              <input
                type="text"
                placeholder="Operacional"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 h-11 text-xs font-bold focus:ring-2 focus:ring-blue-500/10 focus:border-blue-400 outline-none transition-all"
                value={editForm.category || ""}
                onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.18em] px-1 block">
              Tipo
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setEditForm({ ...editForm, type: "income" })}
                className={cn(
                  "h-10 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all",
                  editForm.type === "income"
                    ? "bg-emerald-600 text-white border-emerald-600"
                    : "bg-white text-slate-400 border-slate-200 hover:border-emerald-300"
                )}
              >
                + Receita
              </button>
              <button
                type="button"
                onClick={() => setEditForm({ ...editForm, type: "expense" })}
                className={cn(
                  "h-10 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all",
                  editForm.type === "expense"
                    ? "bg-rose-600 text-white border-rose-600"
                    : "bg-white text-slate-400 border-slate-200 hover:border-rose-300"
                )}
              >
                − Despesa
              </button>
            </div>
          </div>

          {/* Payment method picker */}
          <div className="space-y-1.5">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.18em] px-1 block">
              Forma de Pagamento
            </label>
            <PaymentMethodPicker
              value={editForm.payment_method ?? "money"}
              onChange={(v) => setEditForm({ ...editForm, payment_method: v })}
            />
          </div>
        </form>
      </Modal>

      {/* ── ADD ENTRY MODAL ─────────────────────────────────────────────── */}
      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={`Novo Lançamento — ${modalType === "income" ? "Receita" : "Despesa"}`}
        size="sm"
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="flex-1 h-10 border border-slate-200 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              form="finance-form"
              type="submit"
              disabled={saving}
              className={cn(
                "flex-1 h-10 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg flex items-center justify-center gap-2",
                modalType === "income"
                  ? "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-200"
                  : "bg-rose-600 hover:bg-rose-500 shadow-rose-200"
              )}
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : "Efetivar"}
            </button>
          </>
        }
      >
        <form id="finance-form" onSubmit={handleSave} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.18em] px-1 block">
              Descrição
            </label>
            <input
              type="text"
              required
              placeholder="Ex: Venda balcão, aluguel, etc."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 h-11 text-xs font-bold focus:ring-2 focus:ring-blue-500/10 focus:border-blue-400 outline-none transition-all"
              value={newEntry.description || ""}
              onChange={(e) => setNewEntry({ ...newEntry, description: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.18em] px-1 block">
              Valor (R$)
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              required
              placeholder="0,00"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 h-11 text-sm font-mono font-bold focus:ring-2 focus:ring-blue-500/10 focus:border-blue-400 outline-none transition-all"
              value={newEntry.amount || ""}
              onChange={(e) => setNewEntry({ ...newEntry, amount: Number(e.target.value) })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.18em] px-1 block">
                Data
              </label>
              <input
                type="date"
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 h-11 text-xs font-bold focus:ring-2 focus:ring-blue-500/10 focus:border-blue-400 outline-none transition-all"
                value={newEntry.date || ""}
                onChange={(e) => setNewEntry({ ...newEntry, date: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.18em] px-1 block">
                Categoria
              </label>
              <input
                type="text"
                placeholder="Operacional"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 h-11 text-xs font-bold focus:ring-2 focus:ring-blue-500/10 focus:border-blue-400 outline-none transition-all"
                value={newEntry.category || ""}
                onChange={(e) => setNewEntry({ ...newEntry, category: e.target.value })}
              />
            </div>
          </div>
          {/* Type toggle inside modal */}
          <div className="space-y-1.5">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.18em] px-1 block">
              Tipo
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setNewEntry({ ...newEntry, type: "income" })}
                className={cn(
                  "h-10 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all",
                  newEntry.type === "income"
                    ? "bg-emerald-600 text-white border-emerald-600"
                    : "bg-white text-slate-400 border-slate-200 hover:border-emerald-300"
                )}
              >
                + Receita
              </button>
              <button
                type="button"
                onClick={() => setNewEntry({ ...newEntry, type: "expense" })}
                className={cn(
                  "h-10 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all",
                  newEntry.type === "expense"
                    ? "bg-rose-600 text-white border-rose-600"
                    : "bg-white text-slate-400 border-slate-200 hover:border-rose-300"
                )}
              >
                − Despesa
              </button>
            </div>
          </div>

          {/* Payment method picker */}
          <div className="space-y-1.5">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.18em] px-1 block">
              Forma de Pagamento
            </label>
            <PaymentMethodPicker
              value={(newEntry as any).payment_method ?? "money"}
              onChange={(v) => setNewEntry({ ...newEntry, payment_method: v } as any)}
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
