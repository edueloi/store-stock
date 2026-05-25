import React, { useState, useEffect, useMemo, useRef } from "react";
import ExcelJS from "exceljs";
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
} from "lucide-react";
import { FinanceEntry, Tenant } from "../../types";
import { cn } from "../../lib/utils";
import Modal from "../../components/ui/Modal";

// ─── helpers ─────────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const today = () => new Date().toISOString().split("T")[0];

const monthStart = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
};

function formatDateBR(dateStr: string) {
  if (!dateStr) return "";
  // ISO string or "YYYY-MM-DD"
  const d = new Date(dateStr + (dateStr.length === 10 ? "T12:00:00" : ""));
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

  // ── column widths ──
  ws.columns = [
    { key: "seq",  width: 6  },
    { key: "desc", width: 42 },
    { key: "date", width: 14 },
    { key: "cat",  width: 20 },
    { key: "type", width: 14 },
    { key: "val",  width: 18 },
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
  for (let c = 1; c <= 6; c++) {
    ws.getRow(4).getCell(c).border = {
      bottom: { style: "medium", color: { argb: "FF1E3A5F" } },
    };
  }

  // ── ROWS 5–6: summary cards ──
  ws.getRow(5).height = 16;
  ws.getRow(6).height = 28;

  // Card labels (row 5)
  const cardLabels = [
    { col: 1, label: "TOTAL ENTRADAS", bg: "D1FAE5", fg: "065F46" },
    { col: 3, label: "TOTAL SAÍDAS",   bg: "FEE2E2", fg: "991B1B" },
    { col: 5, label: "SALDO CONSOLIDADO", bg: "1E293B", fg: "94A3B8" },
  ];
  for (const { col, label, bg, fg } of cardLabels) {
    const cell = ws.getRow(5).getCell(col);
    cell.value = label;
    cell.font  = font({ bold: true, size: 8, color: fg });
    cell.fill  = fill(bg);
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      top:   { style: "medium", color: { argb: `FF${fg}` } },
      left:  { style: "medium", color: { argb: `FF${fg}` } },
      right: { style: "medium", color: { argb: `FF${fg}` } },
    };
    // span the next column too
    ws.mergeCells(5, col, 5, col + 1);
  }

  // Card values (row 6)
  const balColor = balance >= 0 ? "34D399" : "F87171";
  const cardValues = [
    { col: 1, val: totalIncome,  bg: "D1FAE5", fg: "059669" },
    { col: 3, val: totalExpense, bg: "FEE2E2", fg: "DC2626" },
    { col: 5, val: balance,      bg: "1E293B", fg: balColor },
  ];
  for (const { col, val, bg, fg } of cardValues) {
    const cell = ws.getRow(6).getCell(col);
    cell.value      = val;
    cell.numFmt     = '"R$" #,##0.00';
    cell.font       = font({ bold: true, size: 16, color: fg });
    cell.fill       = fill(bg);
    cell.alignment  = { horizontal: "center", vertical: "middle" };
    cell.border = {
      bottom: { style: "medium", color: { argb: `FF${fg}` } },
      left:   { style: "medium", color: { argb: `FF${fg}` } },
      right:  { style: "medium", color: { argb: `FF${fg}` } },
    };
    ws.mergeCells(6, col, 6, col + 1);
  }

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
  const HEADERS = ["#", "Descrição", "Data", "Categoria", "Tipo", "Valor (R$)"];
  HEADERS.forEach((h, i) => {
    const cell = ws.getRow(9).getCell(i + 1);
    cell.value = h;
    cell.font  = font({ bold: true, size: 10, color: "FFFFFF" });
    cell.fill  = fill("1E3A5F");
    cell.alignment = {
      horizontal: i === 5 ? "right" : i === 0 ? "center" : "left",
      vertical: "middle",
    };
    cell.border = border("medium");
  });

  // ── DATA ROWS (10+) ──
  entries.forEach((e, i) => {
    const rowNum = 10 + i;
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

    // Data — real Date object so ExcelJS formats it natively
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

    // Tipo — coloured badge
    const cType = row.getCell(5);
    cType.value = isIncome ? "✦ Receita" : "▼ Despesa";
    cType.font  = font({ bold: true, size: 9, color: isIncome ? "059669" : "DC2626" });
    cType.fill  = fill(isIncome ? "D1FAE5" : "FEE2E2");
    cType.alignment = { horizontal: "center", vertical: "middle" };
    cType.border = border("thin");

    // Valor
    const cVal = row.getCell(6);
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

    for (let c = 1; c <= 4; c++) {
      const cell = row.getCell(c);
      cell.fill = fill(bg);
      cell.border = border("thin");
    }

    const lCell = row.getCell(5);
    lCell.value = label;
    lCell.font  = font({ bold: true, size: 10, color: fg });
    lCell.fill  = fill(bg);
    lCell.alignment = { horizontal: "right", vertical: "middle" };
    lCell.border = border("thin");

    const vCell = row.getCell(6);
    vCell.value  = val;
    vCell.numFmt = '"R$" #,##0.00';
    vCell.font   = font({ bold: true, size: 11, color: fg });
    vCell.fill   = fill(bg);
    vCell.alignment = { horizontal: "right", vertical: "middle" };
    vCell.border = border("medium");
  };

  addFooterRow(footerStart,     "TOTAL ENTRADAS", totalIncome,  "D1FAE5", "059669");
  addFooterRow(footerStart + 1, "TOTAL SAÍDAS",   totalExpense, "FEE2E2", "DC2626");
  addFooterRow(footerStart + 2, "SALDO FINAL",    balance,      "1E293B", balColor);

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

  const rows = entries
    .map(
      (e) => `
      <tr>
        <td>${e.description}</td>
        <td>${formatDateBR(e.date)}</td>
        <td>${e.category || "Operacional"}</td>
        <td class="${e.type === "income" ? "income" : "expense"}">
          ${e.type === "income" ? "+" : "−"} R$ ${Number(e.amount).toFixed(2)}
        </td>
      </tr>`
    )
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
  .summary { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 24px; }
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
    Sistema: Nexus ERP
  </div>
</div>
<div class="period">Período: ${period}</div>
<div class="summary">
  <div class="card income">
    <label>Total Entradas</label>
    <div class="val">R$ ${fmt(totalIncome)}</div>
  </div>
  <div class="card expense">
    <label>Total Saídas</label>
    <div class="val">R$ ${fmt(totalExpense)}</div>
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
      <th>Data</th>
      <th>Categoria</th>
      <th style="text-align:right">Valor</th>
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

// ─── PRESET PERIODS ──────────────────────────────────────────────────────────
type Preset = "today" | "week" | "month" | "quarter" | "year" | "custom";

function getPresetRange(preset: Preset): { from: string; to: string } {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const t = iso(now);

  if (preset === "today") return { from: t, to: t };
  if (preset === "week") {
    const day = now.getDay();
    const mon = new Date(now);
    mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
    return { from: iso(mon), to: t };
  }
  if (preset === "month") {
    return { from: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`, to: t };
  }
  if (preset === "quarter") {
    const q = Math.floor(now.getMonth() / 3);
    const qStart = new Date(now.getFullYear(), q * 3, 1);
    return { from: iso(qStart), to: t };
  }
  if (preset === "year") {
    return { from: `${now.getFullYear()}-01-01`, to: t };
  }
  return { from: monthStart(), to: t };
}

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
  const [dateFrom, setDateFrom] = useState(monthStart());
  const [dateTo, setDateTo] = useState(today());
  const [searchQ, setSearchQ] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "income" | "expense">("all");
  const [showFilters, setShowFilters] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

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
    if (p !== "custom") {
      const range = getPresetRange(p);
      setDateFrom(range.from);
      setDateTo(range.to);
    }
  };

  const openModal = (type: "income" | "expense") => {
    setModalType(type);
    setNewEntry({ type, date: today() });
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

  // Filtered entries
  const filtered = useMemo(() => {
    return entries.filter((e) => {
      const entryDate = e.date.substring(0, 10);
      if (entryDate < dateFrom || entryDate > dateTo) return false;
      if (typeFilter !== "all" && e.type !== typeFilter) return false;
      if (searchQ && !e.description.toLowerCase().includes(searchQ.toLowerCase())) return false;
      return true;
    });
  }, [entries, dateFrom, dateTo, typeFilter, searchQ]);

  const totalIncome = filtered.filter((e) => e.type === "income").reduce((a, e) => a + Number(e.amount), 0);
  const totalExpense = filtered.filter((e) => e.type === "expense").reduce((a, e) => a + Number(e.amount), 0);
  const balance = totalIncome - totalExpense;

  const periodLabel = (() => {
    if (preset === "today") return "Hoje";
    if (preset === "week") return "Esta Semana";
    if (preset === "month") return `${new Date(dateFrom + "T12:00:00").toLocaleString("pt-BR", { month: "long", year: "numeric" })}`;
    if (preset === "quarter") return "Este Trimestre";
    if (preset === "year") return `Ano ${new Date().getFullYear()}`;
    return `${formatDateBR(dateFrom)} a ${formatDateBR(dateTo)}`;
  })();

  const PRESETS: { key: Preset; label: string }[] = [
    { key: "today", label: "Hoje" },
    { key: "week", label: "Semana" },
    { key: "month", label: "Mês" },
    { key: "quarter", label: "Trimestre" },
    { key: "year", label: "Ano" },
    { key: "custom", label: "Personalizado" },
  ];

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
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group">
          <div className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">
            Total Entradas
          </div>
          <div className="text-2xl font-mono font-black text-emerald-600">
            R$ {fmt(totalIncome)}
          </div>
          <div className="mt-2 text-[9px] font-bold text-slate-400 uppercase">
            {filtered.filter((e) => e.type === "income").length} lançamentos
          </div>
          <div className="absolute right-4 top-4 w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-400">
            <ArrowUpRight size={20} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group">
          <div className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">
            Total Saídas
          </div>
          <div className="text-2xl font-mono font-black text-rose-600">
            R$ {fmt(totalExpense)}
          </div>
          <div className="mt-2 text-[9px] font-bold text-slate-400 uppercase">
            {filtered.filter((e) => e.type === "expense").length} lançamentos
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
                  "h-8 px-3 rounded-lg flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest border transition-all",
                  showFilters
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-slate-500 border-slate-200 hover:border-slate-400"
                )}
              >
                <SlidersHorizontal size={12} />
                <span className="hidden sm:block">Filtros</span>
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

          {/* Row 2: preset pills */}
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
            {PRESETS.map((p) => (
              <button
                key={p.key}
                onClick={() => applyPreset(p.key)}
                className={cn(
                  "shrink-0 h-7 px-3 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border",
                  preset === p.key
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-400 border-slate-200 hover:border-slate-400"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Row 3: expanded filters */}
          {showFilters && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
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
              {/* Date from */}
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => { setDateFrom(e.target.value); setPreset("custom"); }}
                  className="w-full pl-8 pr-3 h-9 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-bold focus:outline-none focus:border-blue-400 transition-all"
                />
              </div>
              {/* Date to */}
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => { setDateTo(e.target.value); setPreset("custom"); }}
                  className="w-full pl-8 pr-3 h-9 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-bold focus:outline-none focus:border-blue-400 transition-all"
                />
              </div>
            </div>
          )}
        </div>

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
                  <th className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest w-1/2">
                    Descrição
                  </th>
                  <th className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                    Data
                  </th>
                  <th className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                    Categoria
                  </th>
                  <th className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">
                    Valor
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((entry, idx) => (
                  <tr
                    key={entry.id}
                    className={cn(
                      "border-b border-slate-50 hover:bg-slate-50/50 transition-colors",
                      idx % 2 === 0 ? "" : "bg-slate-50/20"
                    )}
                  >
                    <td className="px-5 py-3">
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
                        <span className="text-[11px] font-bold text-slate-800 uppercase truncate max-w-[220px]">
                          {entry.description}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                        {formatDateBR(entry.date)}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-md">
                        {entry.category || "Operacional"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <span
                        className={cn(
                          "font-mono font-black text-sm",
                          entry.type === "income" ? "text-emerald-600" : "text-rose-600"
                        )}
                      >
                        {entry.type === "income" ? "+" : "−"} R$ {Number(entry.amount).toFixed(2)}
                      </span>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
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
                    <td className="px-5 py-3 text-[9px] font-black uppercase tracking-widest text-slate-400" colSpan={2}>
                      Totais do período
                    </td>
                    <td className="px-5 py-3 text-right">
                      <span className="text-[10px] font-black text-emerald-400 font-mono">
                        + R$ {fmt(totalIncome)}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <span
                        className={cn(
                          "text-sm font-mono font-black",
                          balance >= 0 ? "text-white" : "text-rose-400"
                        )}
                      >
                        R$ {fmt(balance)}
                      </span>
                    </td>
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
            filtered.map((entry) => (
              <div key={entry.id} className="px-4 py-3.5 flex items-center gap-3">
                <div
                  className={cn(
                    "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-white",
                    entry.type === "income" ? "bg-emerald-500" : "bg-rose-500"
                  )}
                >
                  {entry.type === "income" ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-bold text-slate-900 uppercase truncate">
                    {entry.description}
                  </p>
                  <p className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">
                    {formatDateBR(entry.date)} · {entry.category || "Operacional"}
                  </p>
                </div>
                <span
                  className={cn(
                    "text-sm font-mono font-black shrink-0",
                    entry.type === "income" ? "text-emerald-600" : "text-rose-600"
                  )}
                >
                  {entry.type === "income" ? "+" : "−"}R$ {Number(entry.amount).toFixed(2)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

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
        </form>
      </Modal>
    </div>
  );
}
