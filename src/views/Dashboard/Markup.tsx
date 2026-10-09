import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Calculator, Search, TrendingUp, TrendingDown, DollarSign,
  Download, RefreshCw, ChevronDown, Info, Package,
  BarChart2, AlertTriangle, CheckCircle2, X, ArrowRight, Save,
  HelpCircle,
} from "lucide-react";
import ExcelJS from "exceljs";
import { motion } from "motion/react";
import { cn } from "../../lib/utils";
import {
  Alert, Badge, Button, IconButton, Input, Modal, PageWrapper, PanelCard, SectionTitle,
  StatGrid, StatCard, GridTable, ContentCard, usePagination,
} from "../../components/ui";
import type { Column } from "../../components/ui";
import type { Product, Tenant } from "../../types";
import MarkupPageTour, { MARKUP_PAGE_TOUR_EVENTS, type MarkupPageTourHandle } from "../../components/onboarding/MarkupPageTour";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MarkupInputs {
  cost_price:   number;
  tax_pct:      number; // % Imposto sobre venda
  commission_pct: number; // % Comissão vendedor
  card_fee_pct: number;  // % Taxa de cartão
  other_var_pct: number; // % Outras despesas variáveis
  freight_pct:  number;  // % Frete
  fixed_cost_pct: number; // % Despesas Fixas
  loan_pct:     number;  // % Parcelas de empréstimos
  desired_margin: number; // % Margem de Lucro Bruta desejada
}

interface MarkupResult {
  markup_divisor:    number;
  suggested_price:   number;
  total_cost:        number;
  gross_margin_pct:  number;
  net_margin_pct:    number;
  // DRE breakdown
  tax_val:        number;
  commission_val: number;
  card_fee_val:   number;
  other_var_val:  number;
  freight_val:    number;
  fixed_cost_val: number;
  loan_val:       number;
  contribution_margin: number;
  contribution_pct:    number;
  operating_profit:    number;
  operating_pct:       number;
  net_profit:          number;
  net_pct:             number;
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_INPUTS: MarkupInputs = {
  cost_price:     0,
  tax_pct:        5,
  commission_pct: 0,
  card_fee_pct:   3,
  other_var_pct:  5,
  freight_pct:    0,
  fixed_cost_pct: 20,
  loan_pct:       0,
  desired_margin: 40,
};

const STORAGE_KEY = "markup_inputs_v1";

function loadSavedInputs(): MarkupInputs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_INPUTS;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_INPUTS, ...parsed };
  } catch {
    return DEFAULT_INPUTS;
  }
}

// ─── Calculator ───────────────────────────────────────────────────────────────

function calcMarkup(inp: MarkupInputs): MarkupResult {
  const totalDeductPct =
    inp.tax_pct + inp.commission_pct + inp.card_fee_pct +
    inp.other_var_pct + inp.freight_pct + inp.fixed_cost_pct +
    inp.loan_pct + inp.desired_margin;

  const divisor = 1 - totalDeductPct / 100;
  const suggested = divisor > 0 ? inp.cost_price / divisor : 0;

  const pct = (v: number) => (suggested * v) / 100;

  const tax_val        = pct(inp.tax_pct);
  const commission_val = pct(inp.commission_pct);
  const card_fee_val   = pct(inp.card_fee_pct);
  const other_var_val  = pct(inp.other_var_pct);
  const freight_val    = pct(inp.freight_pct);
  const fixed_cost_val = pct(inp.fixed_cost_pct);
  const loan_val       = pct(inp.loan_pct);

  const contribution_margin = suggested - tax_val - inp.cost_price - commission_val - card_fee_val - other_var_val - freight_val;
  const contribution_pct    = suggested > 0 ? (contribution_margin / suggested) * 100 : 0;
  const operating_profit    = contribution_margin - fixed_cost_val;
  const operating_pct       = suggested > 0 ? (operating_profit / suggested) * 100 : 0;
  const net_profit          = operating_profit - loan_val;
  const net_pct             = suggested > 0 ? (net_profit / suggested) * 100 : 0;

  const gross_margin_pct = suggested > 0 ? ((suggested - inp.cost_price) / suggested) * 100 : 0;

  return {
    markup_divisor: divisor,
    suggested_price: suggested,
    total_cost: inp.cost_price + tax_val + commission_val + card_fee_val + other_var_val + freight_val + fixed_cost_val + loan_val,
    gross_margin_pct,
    net_margin_pct: net_pct,
    tax_val, commission_val, card_fee_val, other_var_val, freight_val,
    fixed_cost_val, loan_val,
    contribution_margin, contribution_pct,
    operating_profit, operating_pct,
    net_profit, net_pct,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtPct = (v: number) => `${v.toFixed(1)}%`;

const authH = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}` });

// ─── Donut Chart (pure SVG) ───────────────────────────────────────────────────

function DonutChart({ segments }: {
  segments: { label: string; value: number; color: string }[];
}) {
  const total = segments.reduce((s, x) => s + Math.max(0, x.value), 0);
  if (total <= 0) return null;

  const r = 70; const cx = 80; const cy = 80; const stroke = 22;
  let cumAngle = -90;

  const arcs = segments
    .filter((s) => s.value > 0)
    .map((s) => {
      const angle = (s.value / total) * 360;
      const startAngle = (cumAngle * Math.PI) / 180;
      const endAngle = ((cumAngle + angle) * Math.PI) / 180;
      cumAngle += angle;
      const x1 = cx + r * Math.cos(startAngle);
      const y1 = cy + r * Math.sin(startAngle);
      const x2 = cx + r * Math.cos(endAngle);
      const y2 = cy + r * Math.sin(endAngle);
      const large = angle > 180 ? 1 : 0;
      return { ...s, path: `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`, pct: (s.value / total) * 100 };
    });

  return (
    <div className="flex flex-col sm:flex-row items-center gap-4">
      <svg viewBox="0 0 160 160" className="w-36 h-36 shrink-0">
        {arcs.map((arc, i) => (
          <path key={i} d={arc.path} fill="none" stroke={arc.color} strokeWidth={stroke} strokeLinecap="butt" />
        ))}
        <text x={cx} y={cy - 6} textAnchor="middle" fontSize="10" fill="#64748b" fontWeight="700">PREÇO</text>
        <text x={cx} y={cy + 8} textAnchor="middle" fontSize="8" fill="#94a3b8">distribuição</text>
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {arcs.map((arc, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: arc.color }} />
            <span className="text-[11px] text-slate-600 font-semibold">{arc.label}</span>
            <span className="text-[11px] font-semibold text-slate-800">{fmtPct(arc.pct)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Mini bar (horizontal) ────────────────────────────────────────────────────

function ProfitBar({ pct, color }: { pct: number; color: string }) {
  const w = Math.max(0, Math.min(100, pct));
  return (
    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
      <motion.div
        initial={{ width: 0 }} animate={{ width: `${w}%` }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="h-full rounded-full"
        style={{ background: color }}
      />
    </div>
  );
}

// ─── Input row ────────────────────────────────────────────────────────────────

function InputRow({
  label, tooltip, value, onChange, isCurrency, readOnly,
}: {
  label: string; tooltip?: string; value: number;
  onChange: (v: number) => void; isCurrency?: boolean; readOnly?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 py-1.5 border-b border-slate-100 last:border-0">
      <div className="flex items-center gap-1 flex-1 min-w-0">
        <span className="text-[12px] text-slate-700 truncate">{label}</span>
        {tooltip && (
          <span title={tooltip} className="text-slate-300 hover:text-slate-500 cursor-help shrink-0">
            <Info size={11} />
          </span>
        )}
      </div>
      <Input
        type="number"
        size="sm"
        min={0}
        step={isCurrency ? "0.01" : "0.1"}
        value={value || ""}
        readOnly={readOnly}
        onChange={(e) => onChange(Number(e.target.value))}
        addonLeft={isCurrency ? "R$" : "%"}
        wrapperClassName="w-32 shrink-0"
        className={cn("text-right font-semibold", readOnly && "cursor-not-allowed bg-slate-50 text-slate-500")}
      />
    </div>
  );
}

// ─── Excel Export ─────────────────────────────────────────────────────────────

async function exportMarkupExcel(
  products: Product[],
  tenant: Partial<Tenant> | null,
  inputs: MarkupInputs,
) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "BoxSys Store";
  wb.created = new Date();

  // ── Sheet 1: Parameters
  const ws1 = wb.addWorksheet("Parâmetros Markup");
  ws1.columns = [
    { key: "A", width: 36 },
    { key: "B", width: 16 },
    { key: "C", width: 20 },
  ];

  const H1_FILL: ExcelJS.Fill = {
    type: "pattern", pattern: "solid",
    fgColor: { argb: "FF1E3A5F" },
  };
  const H1_FONT: Partial<ExcelJS.Font> = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
  const YELLOW_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF3CD" } };
  const GREEN_FILL: ExcelJS.Fill  = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD4EDDA" } };
  const RED_FILL: ExcelJS.Fill    = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8D7DA" } };
  const GRAY_FILL: ExcelJS.Fill   = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8F9FA" } };
  const BORDER: Partial<ExcelJS.Borders> = {
    top: { style: "thin", color: { argb: "FFD1D5DB" } },
    left: { style: "thin", color: { argb: "FFD1D5DB" } },
    bottom: { style: "thin", color: { argb: "FFD1D5DB" } },
    right: { style: "thin", color: { argb: "FFD1D5DB" } },
  };
  const applyBorder = (row: ExcelJS.Row) => {
    row.eachCell((cell) => { cell.border = BORDER; });
  };

  // Title
  ws1.mergeCells("A1:C1");
  const t1 = ws1.getCell("A1");
  t1.value = "Calculadora de Markup — " + (tenant?.name ?? "Minha Loja");
  t1.font = { bold: true, size: 14, color: { argb: "FF1E3A5F" } };
  t1.alignment = { horizontal: "center", vertical: "middle" };
  ws1.getRow(1).height = 28;

  ws1.mergeCells("A2:C2");
  ws1.getCell("A2").value = `Gerado em: ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
  ws1.getCell("A2").font = { italic: true, size: 9, color: { argb: "FF6B7280" } };
  ws1.getCell("A2").alignment = { horizontal: "center" };

  ws1.addRow([]);

  // Headers
  const hRow = ws1.addRow(["Parâmetro", "Valor", "Observação"]);
  hRow.eachCell((cell) => {
    cell.fill = H1_FILL; cell.font = H1_FONT;
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = BORDER;
  });
  ws1.getRow(hRow.number).height = 20;

  const params: [string, string, string, ExcelJS.Fill?][] = [
    ["(-) Custo do Produto",          `R$ ${inputs.cost_price.toFixed(2)}`, "Inserir o valor de compra do produto",                  YELLOW_FILL],
    ["% Imposto Sobre a Venda",       `${inputs.tax_pct}%`,                  "Inserir o percentual de imposto pago",                  undefined],
    ["% Comissão",                    `${inputs.commission_pct}%`,           "Inserir o percentual de comissão pago ao vendedor",     undefined],
    ["% Taxa de Cartão",              `${inputs.card_fee_pct}%`,             "Inserir o percentual da taxa de cartão",                undefined],
    ["% Outras Despesas Variáveis",   `${inputs.other_var_pct}%`,            "Inserir o percentual de outras despesas variáveis",     undefined],
    ["% Frete",                       `${inputs.freight_pct}%`,              "Inserir o percentual do frete pago se existir",         undefined],
    ["% Despesas Fixas",              `${inputs.fixed_cost_pct}%`,           "Inserir o percentual das despesas fixas",               undefined],
    ["% Parcelas de Empréstimos",     `${inputs.loan_pct}%`,                 "Inserir o percentual da despesa financeira",            undefined],
    ["% Margem de Lucro Desejada",    `${inputs.desired_margin}%`,           "Inserir a margem de lucro bruta desejada",              GREEN_FILL],
  ];

  for (const [name, val, obs, fill] of params) {
    const r = ws1.addRow([name, val, obs]);
    if (fill) r.eachCell((c) => { c.fill = fill!; });
    r.getCell(2).alignment = { horizontal: "right" };
    applyBorder(r);
  }

  ws1.addRow([]);

  // Indicators
  const res = calcMarkup(inputs);
  const indHdr = ws1.addRow(["Indicadores Estratégicos", "Valores", ""]);
  indHdr.eachCell((c) => {
    c.fill = H1_FILL; c.font = H1_FONT;
    c.alignment = { horizontal: "center" }; c.border = BORDER;
  });

  const indicators: [string, string, ExcelJS.Fill][] = [
    ["Custo Total do Produto",   fmt(res.total_cost),      GRAY_FILL],
    ["Margem de Lucro Bruta",    fmtPct(res.gross_margin_pct), GREEN_FILL],
    ["Preço de Venda Sugerido",  fmt(res.suggested_price),    { type: "pattern", pattern: "solid", fgColor: { argb: "FFCCE5FF" } }],
    ["Margem de Contribuição",   fmtPct(res.contribution_pct), GRAY_FILL],
    ["Lucro Líquido",            fmt(res.net_profit),         res.net_profit >= 0 ? GREEN_FILL : RED_FILL],
    ["Margem Líquida",           fmtPct(res.net_pct),         res.net_pct >= 0 ? GREEN_FILL : RED_FILL],
  ];
  for (const [n, v, fill] of indicators) {
    const r = ws1.addRow([n, v, ""]);
    r.eachCell((c) => { c.fill = fill; });
    r.getCell(2).alignment = { horizontal: "right" };
    applyBorder(r);
  }

  // ── Sheet 2: DRE
  const ws2 = wb.addWorksheet("DRE da Precificação");
  ws2.columns = [{ key: "A", width: 36 }, { key: "B", width: 18 }, { key: "C", width: 14 }];

  ws2.mergeCells("A1:C1");
  const t2 = ws2.getCell("A1");
  t2.value = "DRE da Precificação — " + (tenant?.name ?? "Minha Loja");
  t2.font = { bold: true, size: 14, color: { argb: "FF1E3A5F" } };
  t2.alignment = { horizontal: "center", vertical: "middle" };
  ws2.getRow(1).height = 28;

  ws2.addRow([]);
  const dreHdr = ws2.addRow(["DRE da Precificação", "Valores", "Indicador"]);
  dreHdr.eachCell((c) => {
    c.fill = H1_FILL; c.font = H1_FONT;
    c.alignment = { horizontal: "center" }; c.border = BORDER;
  });

  const dre: [string, number, string, ExcelJS.Fill?][] = [
    ["Preço de Venda",            res.suggested_price, "100%",                   undefined],
    ["(-) Imposto",               -res.tax_val,        fmtPct(-inputs.tax_pct),     undefined],
    ["(-) Valor Custos do Produto", -inputs.cost_price, fmtPct(res.suggested_price > 0 ? -(inputs.cost_price / res.suggested_price) * 100 : 0), YELLOW_FILL],
    ["(-) Comissão",              -res.commission_val, fmtPct(-inputs.commission_pct), undefined],
    ["(-) Taxa do Cartão",        -res.card_fee_val,   fmtPct(-inputs.card_fee_pct),   undefined],
    ["(-) Outras Despesas Variáveis", -res.other_var_val, fmtPct(-inputs.other_var_pct), undefined],
    ["(-) Frete/Combustível",     -res.freight_val,    fmtPct(-inputs.freight_pct),    undefined],
    ["(=) Margem de Contribuição", res.contribution_margin, fmtPct(res.contribution_pct), GREEN_FILL],
    ["(-) Despesas Fixas",        -res.fixed_cost_val, fmtPct(-inputs.fixed_cost_pct), GRAY_FILL],
    ["Lucro Operacional",         res.operating_profit, fmtPct(res.operating_pct), res.operating_profit >= 0 ? GREEN_FILL : RED_FILL],
    ["(-) Parcelas de Empréstimos", -res.loan_val,     fmtPct(-inputs.loan_pct),       undefined],
    ["Lucro Líquido com o PREÇO", res.net_profit,      fmtPct(res.net_pct),         res.net_profit >= 0 ? GREEN_FILL : RED_FILL],
  ];

  for (const [name, val, pct, fill] of dre) {
    const r = ws2.addRow([name, val, pct]);
    r.getCell(2).numFmt = "R$ #,##0.00";
    r.getCell(2).alignment = { horizontal: "right" };
    r.getCell(3).alignment = { horizontal: "right" };
    if (fill) r.eachCell((c) => { c.fill = fill!; });
    if (val < 0) r.getCell(2).font = { color: { argb: "FFDC2626" } };
    if (val > 0 && name.includes("Lucro")) r.getCell(2).font = { bold: true, color: { argb: "FF16A34A" } };
    applyBorder(r);
  }

  // ── Sheet 3: Product Comparison
  if (products.length > 0) {
    const ws3 = wb.addWorksheet("Análise de Produtos");
    ws3.columns = [
      { key: "name",       width: 30, header: "Produto" },
      { key: "cost",       width: 14, header: "Custo (R$)" },
      { key: "price",      width: 14, header: "Preço Atual (R$)" },
      { key: "suggested",  width: 16, header: "Preço Sugerido (R$)" },
      { key: "margin",     width: 14, header: "Margem Atual (%)" },
      { key: "net",        width: 14, header: "Lucro Líquido (R$)" },
      { key: "status",     width: 16, header: "Situação" },
    ];

    const hRow3 = ws3.getRow(1);
    hRow3.eachCell((c) => {
      c.fill = H1_FILL; c.font = H1_FONT;
      c.alignment = { horizontal: "center" }; c.border = BORDER;
    });
    hRow3.height = 20;

    for (const p of products) {
      const cost = Number(p.cost_price ?? 0);
      const price = Number(p.price ?? 0);
      const pInputs = { ...inputs, cost_price: cost };
      const pRes = calcMarkup(pInputs);
      const currentMargin = price > 0 && cost > 0 ? ((price - cost) / price) * 100 : 0;
      const isOk = price >= pRes.suggested_price * 0.95;

      const row = ws3.addRow({
        name: p.name,
        cost,
        price,
        suggested: pRes.suggested_price,
        margin: currentMargin,
        net: price - (pRes.total_cost - pRes.suggested_price + price) < 0 ? price - cost : price - pRes.total_cost + pRes.suggested_price - price,
        status: isOk ? "✅ OK" : cost === 0 ? "⚠️ Sem custo" : "❌ Abaixo",
      });

      row.getCell("cost").numFmt      = "R$ #,##0.00";
      row.getCell("price").numFmt     = "R$ #,##0.00";
      row.getCell("suggested").numFmt = "R$ #,##0.00";
      row.getCell("margin").numFmt    = "0.0%";
      row.getCell("net").numFmt       = "R$ #,##0.00";
      row.getCell("margin").value     = currentMargin / 100;

      if (!isOk && cost > 0)      row.fill = RED_FILL;
      else if (cost === 0)        row.fill = YELLOW_FILL;
      else                        row.fill = GREEN_FILL;
      applyBorder(row);
    }

    // Auto-filter
    ws3.autoFilter = { from: "A1", to: "G1" };
  }

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `markup-${(tenant?.name ?? "loja").replace(/\s+/g, "-").toLowerCase()}-${new Date().toISOString().split("T")[0]}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── PDF Export ───────────────────────────────────────────────────────────────

async function exportMarkupPDF(
  inputs: MarkupInputs,
  res: MarkupResult,
  tenant: Partial<Tenant> | null,
  productName?: string,
) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  const pW = 210; const pH = 297;
  const mg = 16; const cW = pW - mg * 2;
  const primary = "#1e3a5f";
  const pc = { r: 30, g: 58, b: 95 };

  // ── Header band
  doc.setFillColor(pc.r, pc.g, pc.b);
  doc.rect(0, 0, pW, 38, "F");

  // Logo attempt
  if (tenant?.logo_url) {
    try {
      const abs = tenant.logo_url.startsWith("http") ? tenant.logo_url : `${window.location.origin}${tenant.logo_url}`;
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const img = new Image(); img.crossOrigin = "anonymous";
        img.onload = () => {
          const c = document.createElement("canvas");
          c.width = img.naturalWidth; c.height = img.naturalHeight;
          c.getContext("2d")!.drawImage(img, 0, 0);
          resolve(c.toDataURL("image/png"));
        };
        img.onerror = reject; img.src = abs;
      });
      doc.addImage(dataUrl, "PNG", mg, 8, 20, 20);
    } catch { /* ignore */ }
  }

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16); doc.setFont("helvetica", "bold");
  doc.text(tenant?.name ?? "Minha Loja", mg + 24, 18);
  doc.setFontSize(9); doc.setFont("helvetica", "normal");
  doc.text("Calculadora de Markup — DRE da Precificação", mg + 24, 25);
  doc.text(`Gerado em ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`, mg + 24, 31);

  // Right: Product / Preço
  doc.setFontSize(18); doc.setFont("helvetica", "bold");
  doc.text(fmt(res.suggested_price), pW - mg, 18, { align: "right" });
  doc.setFontSize(8); doc.setFont("helvetica", "normal");
  doc.text("PREÇO SUGERIDO", pW - mg, 24, { align: "right" });
  if (productName) doc.text(productName, pW - mg, 30, { align: "right" });

  let y = 46;

  // ── Parameters block
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(209, 213, 219);
  doc.roundedRect(mg, y, cW / 2 - 2, 76, 2, 2, "FD");

  doc.setTextColor(pc.r, pc.g, pc.b);
  doc.setFontSize(8); doc.setFont("helvetica", "bold");
  doc.text("PARÂMETROS", mg + 4, y + 7);

  const params: [string, string][] = [
    ["Custo do Produto",         fmt(inputs.cost_price)],
    ["% Imposto",                `${inputs.tax_pct}%`],
    ["% Comissão",               `${inputs.commission_pct}%`],
    ["% Taxa de Cartão",         `${inputs.card_fee_pct}%`],
    ["% Outras Desp. Variáveis", `${inputs.other_var_pct}%`],
    ["% Frete",                  `${inputs.freight_pct}%`],
    ["% Despesas Fixas",         `${inputs.fixed_cost_pct}%`],
    ["% Empréstimos",            `${inputs.loan_pct}%`],
    ["% Margem Desejada",        `${inputs.desired_margin}%`],
  ];
  doc.setFont("helvetica", "normal"); doc.setFontSize(7.5);
  let py = y + 13;
  for (const [label, val] of params) {
    doc.setTextColor(100, 116, 139); doc.text(label, mg + 4, py);
    doc.setTextColor(30, 41, 59); doc.setFont("helvetica", "bold");
    doc.text(val, mg + cW / 2 - 6, py, { align: "right" });
    doc.setFont("helvetica", "normal");
    py += 6.5;
  }

  // ── Key indicators block (right side)
  const rx = mg + cW / 2 + 2;
  const rw = cW / 2 - 2;

  const kpis: [string, string, [number,number,number], [number,number,number]][] = [
    ["Preço de Venda Sugerido", fmt(res.suggested_price), [219,234,254], [30,64,175]],
    ["Custo Total do Produto",  fmt(res.total_cost),      [254,226,226], [185,28,28]],
    ["Margem de Contribuição",  `${fmtPct(res.contribution_pct)} · ${fmt(res.contribution_margin)}`, [219,234,254], [29,78,216]],
    ["Lucro Operacional",       `${fmtPct(res.operating_pct)} · ${fmt(res.operating_profit)}`,
      res.operating_profit >= 0 ? [220,252,231] : [254,226,226],
      res.operating_profit >= 0 ? [22,101,52]  : [185,28,28]],
    ["Lucro Líquido Final",     `${fmtPct(res.net_pct)} · ${fmt(res.net_profit)}`,
      res.net_profit >= 0 ? [220,252,231] : [254,226,226],
      res.net_profit >= 0 ? [22,101,52]  : [185,28,28]],
  ];

  let ky = y;
  for (const [label, val, bg, fg] of kpis) {
    const kh = 14;
    doc.setFillColor(bg[0], bg[1], bg[2]);
    doc.setDrawColor(209, 213, 219);
    doc.roundedRect(rx, ky, rw, kh, 2, 2, "FD");
    doc.setTextColor(100, 116, 139); doc.setFontSize(6.5); doc.setFont("helvetica", "normal");
    doc.text(label.toUpperCase(), rx + 4, ky + 5);
    doc.setTextColor(fg[0], fg[1], fg[2]); doc.setFontSize(9); doc.setFont("helvetica", "bold");
    doc.text(val, rx + 4, ky + 11);
    ky += kh + 2;
  }

  y += 82;

  // ── DRE Table
  doc.setFillColor(pc.r, pc.g, pc.b);
  doc.rect(mg, y, cW, 8, "F");
  doc.setTextColor(255, 255, 255); doc.setFontSize(8); doc.setFont("helvetica", "bold");
  doc.text("DRE DA PRECIFICAÇÃO", mg + 3, y + 5.5);
  doc.text("VALOR", mg + 120, y + 5.5, { align: "right" });
  doc.text("%", pW - mg - 3, y + 5.5, { align: "right" });

  y += 8;

  const dreRows: [string, number, number, boolean, [number,number,number]?][] = [
    ["Preço de Venda",             res.suggested_price,        100,                           true,  [240,249,255]],
    ["(-) Imposto",               -res.tax_val,               -inputs.tax_pct,               false, undefined],
    ["(-) Custo do Produto",      -inputs.cost_price,          inputs.cost_price > 0 ? -(inputs.cost_price / (res.suggested_price||1))*100 : 0, true, [255,251,235]],
    ["(-) Comissão",              -res.commission_val,        -inputs.commission_pct,         false, undefined],
    ["(-) Taxa do Cartão",        -res.card_fee_val,          -inputs.card_fee_pct,           false, undefined],
    ["(-) Outras Desp. Variáveis",-res.other_var_val,         -inputs.other_var_pct,          false, undefined],
    ["(-) Frete/Combustível",     -res.freight_val,           -inputs.freight_pct,            false, undefined],
    ["(=) Margem de Contribuição", res.contribution_margin,    res.contribution_pct,          true,  [239,246,255]],
    ["(-) Despesas Fixas",        -res.fixed_cost_val,        -inputs.fixed_cost_pct,         false, [248,250,252]],
    ["Lucro Operacional",          res.operating_profit,       res.operating_pct,             true,  res.operating_profit>=0 ? [240,253,244] : [254,242,242]],
    ["(-) Parcelas de Empréstimos",-res.loan_val,             -inputs.loan_pct,               false, undefined],
    ["Lucro Líquido com o PREÇO",  res.net_profit,             res.net_pct,                   true,  res.net_profit>=0 ? [220,252,231] : [254,226,226]],
  ];

  for (let i = 0; i < dreRows.length; i++) {
    const [label, val, pct, isBold, bg] = dreRows[i];
    const rh = 7;
    if (bg) { doc.setFillColor(bg[0],bg[1],bg[2]); doc.rect(mg, y, cW, rh, "F"); }
    else if (i % 2 === 0) { doc.setFillColor(250,250,250); doc.rect(mg, y, cW, rh, "F"); }

    doc.setDrawColor(229,231,235); doc.line(mg, y+rh, mg+cW, y+rh);

    const valColor: [number,number,number] = val < 0 ? [220,38,38] : val > 0 && isBold ? [22,163,74] : [30,41,59];
    doc.setTextColor(30,41,59); doc.setFontSize(7.5);
    doc.setFont("helvetica", isBold ? "bold" : "normal");
    doc.text(label, mg + 3, y + 4.8);
    doc.setTextColor(...valColor); doc.setFont("helvetica", "bold");
    doc.text(val !== 0 ? fmt(val) : "R$ —", mg + 120, y + 4.8, { align: "right" });
    doc.setTextColor(100,116,139); doc.setFont("helvetica", "normal");
    doc.text(fmtPct(pct), pW - mg - 3, y + 4.8, { align: "right" });
    y += rh;
  }

  // ── Footer
  y += 8;
  doc.setDrawColor(pc.r, pc.g, pc.b); doc.setLineWidth(0.4);
  doc.line(mg, y, pW - mg, y);
  doc.setTextColor(pc.r, pc.g, pc.b); doc.setFontSize(7); doc.setFont("helvetica", "bold");
  doc.text(tenant?.name ?? "Minha Loja", mg, y + 5);
  doc.setFont("helvetica", "normal"); doc.setTextColor(150,150,150);
  doc.text(`Relatório de Markup · BoxSys Store`, pW - mg, y + 5, { align: "right" });

  const storeName = (tenant?.name ?? "loja").replace(/\s+/g, "-").toLowerCase();
  doc.save(`markup-${storeName}-${new Date().toISOString().split("T")[0]}.pdf`);
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Markup() {
  const [products, setProducts]   = useState<Product[]>([]);
  const [tenant, setTenant]       = useState<Partial<Tenant> | null>(null);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState("");
  const [inputs, setInputs]       = useState<MarkupInputs>(loadSavedInputs);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [applyingPrice, setApplyingPrice] = useState(false);
  const [appliedMsg, setAppliedMsg] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const markupPageTourRef = useRef<MarkupPageTourHandle>(null);

  const fetchAll = useCallback(async () => {
    const h = { Authorization: `Bearer ${localStorage.getItem("token")}` };
    try {
      const [pRes, tRes] = await Promise.all([
        fetch("/api/products", { headers: h }),
        fetch("/api/tenant",   { headers: h }),
      ]);
      const pd = await pRes.json();
      setProducts(Array.isArray(pd) ? pd.filter((p: Product) => p.type !== "internal") : []);
      setTenant(await tRes.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, []);

  function saveInputs(vals: MarkupInputs) {
    const { cost_price: _cp, ...toSave } = vals;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    setSavedMsg(true);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => setSavedMsg(false), 2500);
  }

  const set = (key: keyof MarkupInputs) => (v: number) =>
    setInputs((prev) => ({ ...prev, [key]: v }));

  // When product selected, fill cost_price
  function selectProduct(p: Product) {
    setSelectedProduct(p);
    setInputs((prev) => ({ ...prev, cost_price: Number(p.cost_price ?? 0) }));
    setShowProductPicker(false);
    setAppliedMsg(false);
  }

  // ── Canal de comunicação do TOUR DE PÁGINA (MarkupPageTour) ───────────────
  // Markup.tsx não tinha nenhum canal de tour antes; este é o primeiro. Abre
  // o seletor de produto de verdade via setShowProductPicker e seleciona o
  // primeiro produto disponível via selectProduct — o mesmo que clicar num
  // item da lista faria. Nunca chama applyPrice (que faz o PUT real em
  // /api/products/:id, aplicando o preço sugerido ao catálogo).
  useEffect(() => {
    const onOpenProductPicker = () => setShowProductPicker(true);
    const onSelectSampleProduct = () => {
      const list = Array.isArray(products) ? products : [];
      if (list.length > 0) selectProduct(list[0]);
    };
    const onCloseProductPicker = () => setShowProductPicker(false);

    window.addEventListener(MARKUP_PAGE_TOUR_EVENTS.openProductPicker, onOpenProductPicker);
    window.addEventListener(MARKUP_PAGE_TOUR_EVENTS.selectSampleProduct, onSelectSampleProduct);
    window.addEventListener(MARKUP_PAGE_TOUR_EVENTS.closeProductPicker, onCloseProductPicker);
    return () => {
      window.removeEventListener(MARKUP_PAGE_TOUR_EVENTS.openProductPicker, onOpenProductPicker);
      window.removeEventListener(MARKUP_PAGE_TOUR_EVENTS.selectSampleProduct, onSelectSampleProduct);
      window.removeEventListener(MARKUP_PAGE_TOUR_EVENTS.closeProductPicker, onCloseProductPicker);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products]);

  const result = useMemo(() => calcMarkup(inputs), [inputs]);

  // Apply suggested price to product
  async function applyPrice() {
    if (!selectedProduct) return;
    setApplyingPrice(true);
    try {
      await fetch(`/api/products/${selectedProduct.id}`, {
        method: "PUT",
        headers: { ...authH(), "Content-Type": "application/json" },
        body: JSON.stringify({ price: parseFloat(result.suggested_price.toFixed(2)) }),
      });
      setAppliedMsg(true);
      await fetchAll();
      setTimeout(() => setAppliedMsg(false), 3000);
    } finally {
      setApplyingPrice(false);
    }
  }

  async function handleExport() {
    setExporting(true);
    try {
      await exportMarkupExcel(products, tenant, inputs);
    } finally {
      setExporting(false);
    }
  }

  async function handleExportPDF() {
    setExportingPdf(true);
    try {
      await exportMarkupPDF(inputs, result, tenant, selectedProduct?.name);
    } finally {
      setExportingPdf(false);
    }
  }

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  // Donut chart segments
  const donutSegments = result.suggested_price > 0 ? [
    { label: "Custo Produto",   value: inputs.cost_price,      color: "#ef4444" },
    { label: "Imposto",         value: result.tax_val,         color: "#f97316" },
    { label: "Comissão",        value: result.commission_val,  color: "#eab308" },
    { label: "Taxa Cartão",     value: result.card_fee_val,    color: "#a855f7" },
    { label: "Outras Var.",     value: result.other_var_val,   color: "#6366f1" },
    { label: "Frete",           value: result.freight_val,     color: "#14b8a6" },
    { label: "Despesas Fixas",  value: result.fixed_cost_val,  color: "#64748b" },
    { label: "Empréstimos",     value: result.loan_val,        color: "#dc2626" },
    { label: "Lucro Líquido",   value: Math.max(0, result.net_profit), color: "#22c55e" },
  ].filter((s) => s.value > 0) : [];

  // Product health analysis
  const productsWithCost = products.filter((p) => Number(p.cost_price ?? 0) > 0);
  const belowSuggested = productsWithCost.filter((p) => {
    const r = calcMarkup({ ...inputs, cost_price: Number(p.cost_price) });
    return Number(p.price) < r.suggested_price * 0.95;
  });
  const noCost = products.filter((p) => !p.cost_price || Number(p.cost_price) === 0);

  const analysisPagination = usePagination(productsWithCost, 15);

  const analysisColumns: Column<Product>[] = [
    {
      header: "Produto",
      render: (p) => (
        <div className="flex items-center gap-2">
          {p.image_url
            ? <img src={p.image_url} className="h-7 w-7 shrink-0 rounded-lg border border-slate-100 object-cover" />
            : <div className="h-7 w-7 shrink-0 rounded-lg bg-slate-100" />}
          <span className="max-w-[200px] truncate text-xs font-medium text-slate-800">{p.name}</span>
        </div>
      ),
    },
    { header: "Custo", headerClassName: "text-right", className: "text-right text-slate-500 tabular-nums", render: (p) => fmt(Number(p.cost_price)) },
    { header: "Preço Atual", headerClassName: "text-right", className: "text-right font-semibold text-slate-800 tabular-nums", render: (p) => fmt(Number(p.price)) },
    {
      header: "Preço Sugerido", headerClassName: "text-right", className: "text-right font-semibold text-blue-600 tabular-nums",
      render: (p) => fmt(calcMarkup({ ...inputs, cost_price: Number(p.cost_price) }).suggested_price),
    },
    {
      header: "Margem Atual", headerClassName: "text-right", className: "text-right",
      render: (p) => {
        const price = Number(p.price);
        const currentMargin = price > 0 ? ((price - Number(p.cost_price)) / price) * 100 : 0;
        return <span className={cn("text-[11px] font-medium", currentMargin >= inputs.desired_margin ? "text-emerald-600" : "text-red-500")}>{fmtPct(currentMargin)}</span>;
      },
    },
    {
      header: "Lucro Líq.", headerClassName: "text-right", className: "text-right",
      render: (p) => {
        const diff = Number(p.price) - Number(p.cost_price);
        return <span className={cn("text-[11px] font-medium", diff >= 0 ? "text-emerald-600" : "text-red-500")}>{fmt(diff)}</span>;
      },
    },
    {
      header: "Situação", headerClassName: "text-right", className: "text-right",
      render: (p) => {
        const suggested = calcMarkup({ ...inputs, cost_price: Number(p.cost_price) }).suggested_price;
        const price = Number(p.price);
        const isOk = price >= suggested * 0.95;
        const isWarn = price >= suggested * 0.8 && !isOk;
        return <Badge size="sm" color={isOk ? "success" : isWarn ? "warning" : "danger"}>{isOk ? "✓ OK" : isWarn ? "⚠ Atenção" : "✗ Baixo"}</Badge>;
      },
    },
  ];

  return (
    <PageWrapper data-tour="markup-page">
    <div className="space-y-4">
      <SectionTitle
        title="Calculadora de Markup"
        description="Precificação estratégica com DRE completo e análise de produtos"
        icon={Calculator}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              data-tour="markup-save-btn"
              size="sm"
              variant={savedMsg ? "success" : "primary"}
              onClick={() => saveInputs(inputs)}
              iconLeft={savedMsg ? <CheckCircle2 size={14} /> : <Save size={14} />}
            >
              {savedMsg ? "Salvo!" : "Salvar Config."}
            </Button>
            <Button size="sm" variant="danger" onClick={handleExportPDF} disabled={exportingPdf} iconLeft={<Download size={14} />}>
              {exportingPdf ? "…" : "PDF"}
            </Button>
            <Button size="sm" variant="success" onClick={handleExport} disabled={exporting} iconLeft={<Download size={14} />}>
              {exporting ? "…" : "Excel"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              iconLeft={<HelpCircle size={14} />}
              onClick={() => markupPageTourRef.current?.start()}
              title="Tour guiado desta página"
            >
              <span className="sr-only sm:not-sr-only">Ajuda</span>
            </Button>
          </div>
        }
      />

      <MarkupPageTour ref={markupPageTourRef} />

      {/* Alerts */}
      {!loading && (belowSuggested.length > 0 || noCost.length > 0) && (
        <div className="flex flex-col gap-2 sm:flex-row">
          {belowSuggested.length > 0 && (
            <Alert variant="error" className="flex-1">
              <strong>{belowSuggested.length}</strong> produto(s) com preço abaixo do markup recomendado
            </Alert>
          )}
          {noCost.length > 0 && (
            <Alert variant="warning" className="flex-1">
              <strong>{noCost.length}</strong> produto(s) sem custo cadastrado
            </Alert>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">

        {/* ── LEFT: Inputs ──────────────────────────────────────────────────── */}
        <div className="space-y-4">

          {/* Product selector */}
          <PanelCard
            title="Produto (opcional)"
            icon={Package}
            action={selectedProduct ? (
              <IconButton size="xs" variant="ghost" aria-label="Remover produto selecionado" onClick={() => { setSelectedProduct(null); setAppliedMsg(false); }}>
                <X size={14} />
              </IconButton>
            ) : undefined}
          >
            {selectedProduct ? (
              <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-blue-200 bg-white">
                  {selectedProduct.image_url
                    ? <img src={selectedProduct.image_url} className="h-full w-full object-cover" />
                    : <Package size={16} className="text-blue-400" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-slate-800">{selectedProduct.name}</p>
                  <p className="text-[11px] text-slate-500">
                    Preço atual: <strong>{fmt(Number(selectedProduct.price))}</strong>
                    {selectedProduct.cost_price && <> · Custo: <strong>{fmt(Number(selectedProduct.cost_price))}</strong></>}
                  </p>
                </div>
              </div>
            ) : (
              <Button
                data-tour="markup-select-product-btn"
                variant="outline"
                fullWidth
                iconLeft={<Search size={13} />}
                onClick={() => setShowProductPicker(true)}
              >
                Selecionar produto do catálogo
              </Button>
            )}
          </PanelCard>

          {/* Inputs: Costs */}
          <PanelCard title="Custos e Despesas" icon={DollarSign}>
            <InputRow label="(-) Custo do Produto" tooltip="Valor de compra/fabricação do produto" value={inputs.cost_price} onChange={set("cost_price")} isCurrency />
            <div className="mt-3 pt-3 border-t border-slate-100">
              <p className="text-[11px] font-medium text-slate-500 mb-2">Despesas Variáveis (%)</p>
              <div data-tour="markup-tax-field">
                <InputRow label="% Imposto Sobre a Venda" tooltip="Simples, ISS, ICMS, etc." value={inputs.tax_pct} onChange={set("tax_pct")} />
              </div>
              <InputRow label="% Comissão" tooltip="Comissão paga ao vendedor" value={inputs.commission_pct} onChange={set("commission_pct")} />
              <InputRow label="% Taxa de Cartão" tooltip="Taxa da maquininha" value={inputs.card_fee_pct} onChange={set("card_fee_pct")} />
              <InputRow label="% Outras Despesas Variáveis" tooltip="Embalagem, perdas, etc." value={inputs.other_var_pct} onChange={set("other_var_pct")} />
              <InputRow label="% Frete" tooltip="Frete de entrega ao cliente" value={inputs.freight_pct} onChange={set("freight_pct")} />
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100">
              <p className="text-[11px] font-medium text-slate-500 mb-2">Despesa Fixa (%)</p>
              <InputRow label="% Despesas Fixas" tooltip="Aluguel, luz, funcionários, etc. rateados" value={inputs.fixed_cost_pct} onChange={set("fixed_cost_pct")} />
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100">
              <p className="text-[11px] font-medium text-slate-500 mb-2">Despesa Financeira (%)</p>
              <InputRow label="% Parcelas de Empréstimos" tooltip="Financiamentos e empréstimos" value={inputs.loan_pct} onChange={set("loan_pct")} />
            </div>
          </PanelCard>

          {/* Margin */}
          <PanelCard title="Margem de Lucro Desejada" icon={TrendingUp}>
            <div data-tour="markup-margin-field">
              <InputRow label="% Margem de Lucro Bruta" tooltip="Percentual de lucro sobre o preço de venda" value={inputs.desired_margin} onChange={set("desired_margin")} />
            </div>
            <div className="mt-2">
              <ProfitBar pct={inputs.desired_margin} color="#22c55e" />
            </div>
            <Button
              className="mt-3"
              fullWidth
              variant={savedMsg ? "success" : "primary"}
              onClick={() => saveInputs(inputs)}
              iconLeft={savedMsg ? <CheckCircle2 size={14} /> : <Save size={14} />}
            >
              {savedMsg ? "Salvo!" : "Salvar Config."}
            </Button>
          </PanelCard>
        </div>

        {/* ── RIGHT: Results ────────────────────────────────────────────────── */}
        <div className="space-y-4">

          {/* Suggested Price highlight */}
          <motion.div
            key={result.suggested_price.toFixed(2)}
            initial={{ scale: 0.98 }} animate={{ scale: 1 }}
            className={cn(
              "rounded-lg border shadow-sm p-5 flex flex-col gap-1",
              result.net_profit >= 0 ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"
            )}
          >
            <p className="text-[11px] font-semibold text-slate-500">Preço de Venda Sugerido</p>
            <p className={cn("text-4xl font-semibold", result.net_profit >= 0 ? "text-emerald-700" : "text-red-600")}>
              {fmt(result.suggested_price)}
            </p>
            <div className="flex flex-wrap gap-3 mt-1">
              <span className="text-[11px] font-semibold text-slate-600">
                Margem Bruta: <strong className="text-emerald-600">{fmtPct(result.gross_margin_pct)}</strong>
              </span>
              <span className="text-[11px] font-semibold text-slate-600">
                Lucro Líq.: <strong className={result.net_profit >= 0 ? "text-emerald-600" : "text-red-600"}>
                  {fmt(result.net_profit)} ({fmtPct(result.net_pct)})
                </strong>
              </span>
            </div>
            {selectedProduct && (
              <div className="flex flex-wrap items-center gap-2 mt-2 pt-2 border-t border-slate-200">
                <span className="text-[11px] text-slate-500">
                  Preço atual: <strong>{fmt(Number(selectedProduct.price))}</strong>
                  {Number(selectedProduct.price) < result.suggested_price * 0.95 && (
                    <span className="ml-1 text-red-500 font-semibold">(abaixo ↓)</span>
                  )}
                </span>
                {appliedMsg ? (
                  <span className="flex items-center gap-1 text-[11px] text-emerald-600 font-semibold bg-emerald-50 px-2 py-1 rounded-lg">
                    <CheckCircle2 size={12} /> Preço aplicado!
                  </span>
                ) : (
                  <Button size="xs" onClick={applyPrice} disabled={applyingPrice} iconLeft={<ArrowRight size={11} />}>
                    {applyingPrice ? "Aplicando…" : "Aplicar ao produto"}
                  </Button>
                )}
              </div>
            )}
          </motion.div>

          {/* Summary indicators */}
          <StatGrid cols={2}>
            <StatCard title="Custo Total" value={fmt(result.total_cost)} icon={DollarSign} color="danger" />
            <StatCard title="Margem Contribuição" value={fmtPct(result.contribution_pct)} icon={TrendingUp} color="info" />
            <StatCard title="Lucro Operacional" value={fmt(result.operating_profit)} icon={BarChart2} color="purple" />
            <StatCard title="Markup Divisor" value={result.markup_divisor.toFixed(4)} icon={Calculator} color="default" />
          </StatGrid>

          {/* Donut */}
          <PanelCard data-tour="markup-donut-chart" title="Distribuição do Preço" icon={BarChart2}>
            {inputs.cost_price > 0 ? (
              <DonutChart segments={donutSegments} />
            ) : (
              <p className="text-xs text-slate-500 text-center py-4">Informe o custo do produto para ver o gráfico</p>
            )}
          </PanelCard>

          {/* DRE */}
          <PanelCard title="DRE da Precificação" icon={Calculator} contentClassName="p-0">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-zinc-50 text-slate-500">
                  <th className="px-4 py-2 text-left text-[11px] font-semibold">Item</th>
                  <th className="px-4 py-2 text-right text-[11px] font-semibold">Valor</th>
                  <th className="px-4 py-2 text-right text-[11px] font-semibold">%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[
                  { label: "Preço de Venda",              val: result.suggested_price,      pct: 100,                        bold: true,   bg: "" },
                  { label: "(-) Imposto",                 val: -result.tax_val,             pct: -inputs.tax_pct,            bold: false,  bg: "" },
                  { label: "(-) Custo do Produto",        val: -inputs.cost_price,          pct: inputs.cost_price > 0 ? -(inputs.cost_price / (result.suggested_price || 1)) * 100 : 0, bold: true, bg: "bg-yellow-50" },
                  { label: "(-) Comissão",                val: -result.commission_val,      pct: -inputs.commission_pct,     bold: false,  bg: "" },
                  { label: "(-) Taxa do Cartão",          val: -result.card_fee_val,        pct: -inputs.card_fee_pct,       bold: false,  bg: "" },
                  { label: "(-) Outras Desp. Variáveis",  val: -result.other_var_val,       pct: -inputs.other_var_pct,      bold: false,  bg: "" },
                  { label: "(-) Frete/Combustível",       val: -result.freight_val,         pct: -inputs.freight_pct,        bold: false,  bg: "" },
                  { label: "(=) Margem de Contribuição",  val: result.contribution_margin,  pct: result.contribution_pct,    bold: true,   bg: "bg-blue-50" },
                  { label: "(-) Despesas Fixas",          val: -result.fixed_cost_val,      pct: -inputs.fixed_cost_pct,     bold: false,  bg: "bg-slate-50" },
                  { label: "Lucro Operacional",           val: result.operating_profit,     pct: result.operating_pct,       bold: true,   bg: result.operating_profit >= 0 ? "bg-emerald-50" : "bg-red-50" },
                  { label: "(-) Parcelas Empréstimos",    val: -result.loan_val,            pct: -inputs.loan_pct,           bold: false,  bg: "" },
                  { label: "Lucro Líquido",               val: result.net_profit,           pct: result.net_pct,             bold: true,   bg: result.net_profit >= 0 ? "bg-emerald-100" : "bg-red-100" },
                ].map((row) => (
                  <tr key={row.label} className={cn("transition-colors", row.bg)}>
                    <td className={cn("px-4 py-2 text-[12px] text-slate-700", row.bold && "font-semibold text-slate-900")}>
                      {row.label}
                    </td>
                    <td className={cn(
                      "px-4 py-2 text-right text-[12px] font-semibold tabular-nums",
                      row.val < 0 ? "text-red-500" : row.val > 0 && row.bold ? "text-emerald-600" : "text-slate-700"
                    )}>
                      {row.val !== 0 ? fmt(row.val) : "R$ —"}
                    </td>
                    <td className={cn(
                      "px-4 py-2 text-right text-[11px] font-semibold tabular-nums",
                      row.pct < 0 ? "text-red-400" : "text-slate-500"
                    )}>
                      {fmtPct(row.pct)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </PanelCard>
        </div>
      </div>

      {/* ── Product Analysis Table ─────────────────────────────────────────── */}
      {!loading && productsWithCost.length > 0 && (
        <PanelCard
          data-tour="markup-analysis-table"
          title="Análise do Catálogo com Parâmetros Atuais"
          icon={Package}
          action={<span className="text-[11px] text-slate-500">{productsWithCost.length} produtos com custo</span>}
          contentClassName="p-0"
        >
          <GridTable<Product>
            noDesktopCard
            data={analysisPagination.paginatedData}
            keyExtractor={(p) => p.id}
            columns={analysisColumns}
            tableMinWidth={600}
            pagination={{
              total: productsWithCost.length,
              page: analysisPagination.page,
              pageSize: analysisPagination.pageSize,
              onPageChange: analysisPagination.setPage,
              onPageSizeChange: analysisPagination.setPageSize,
            }}
          />
        </PanelCard>
      )}

      {/* ── Product Picker Modal ──────────────────────────────────────────── */}
      <Modal open={showProductPicker} onClose={() => setShowProductPicker(false)} title="Selecionar Produto" size="md">
        <div data-tour="markup-product-picker" className="space-y-3">
          <Input
            autoFocus
            iconLeft={<Search size={14} />}
            aria-label="Buscar produto"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar produto…"
          />
          <div className="max-h-72 space-y-1 overflow-y-auto">
            {loading ? (
              <p className="py-4 text-center text-xs text-slate-500">Carregando…</p>
            ) : filteredProducts.length === 0 ? (
              <p className="py-4 text-center text-xs text-slate-500">Nenhum produto encontrado</p>
            ) : (
              filteredProducts.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => selectProduct(p)}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-slate-50"
                >
                  <div className="h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                    {p.image_url
                      ? <img src={p.image_url} className="h-full w-full object-cover" />
                      : <Package size={14} className="m-auto mt-2 text-slate-400" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-slate-800">{p.name}</p>
                    <p className="text-[11px] text-slate-500">
                      Preço: {fmt(Number(p.price))}
                      {p.cost_price ? `· Custo: ${fmt(Number(p.cost_price))}` : " · Sem custo"}
                    </p>
                  </div>
                  {!p.cost_price && <Badge size="sm" color="warning">Sem custo</Badge>}
                </button>
              ))
            )}
          </div>
        </div>
      </Modal>
    </div>
    </PageWrapper>
  );
}
