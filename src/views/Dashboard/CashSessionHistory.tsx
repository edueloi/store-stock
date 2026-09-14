import { useState, useEffect, useMemo } from "react";
import ExcelJS from "exceljs";
import {
  Search, Wallet, CheckCircle2, Clock, X, Loader2, User, Calendar, ChevronRight, Printer,
  Download, ChevronDown, FileSpreadsheet, FileText,
} from "lucide-react";
import PageHeader from "../../components/layout/PageHeader";
import Button from "../../components/ui/Button";
import { cn } from "../../lib/utils";

// Mesmo padrão de filtro de período já usado em Fluxo de Caixa/Contas a
// Pagar/Contas a Receber — navegador de mês/ano com atalho pra período livre.
type PeriodPreset = "month" | "year" | "custom" | "all";
const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

function monthRange(year: number, month: number): { from: string; to: string } {
  const pad = (n: number) => String(n).padStart(2, "0");
  const lastDay = new Date(year, month + 1, 0).getDate();
  return { from: `${year}-${pad(month + 1)}-01`, to: `${year}-${pad(month + 1)}-${pad(lastDay)}` };
}

function yearRange(year: number): { from: string; to: string } {
  return { from: `${year}-01-01`, to: `${year}-12-31` };
}

const PM_LABEL: Record<string, string> = {
  money: "Dinheiro", pix: "PIX", debit: "Débito", credit: "Crédito", crediario: "Crediário",
};

// payment_method de um Order é "method-brand-installments:amount|..." (ex.:
// "credit-visa-2x:120.00|money:30.00") — já traz a bandeira do cartão, ao
// contrário do payment_breakdown da sessão (que só soma por método).
interface PaymentSegment { method: string; brand: string; amount: number }
function parseOrderPayments(pm: string): PaymentSegment[] {
  if (!pm) return [];
  return pm.split("|").map((seg) => {
    const [methodPart, amountStr] = seg.split(":");
    const tokens = methodPart.split("-");
    return { method: tokens[0] ?? "money", brand: tokens[1] ?? "other", amount: parseFloat(amountStr ?? "0") || 0 };
  });
}
function methodBrandLabel(method: string, brand: string): string {
  const base = PM_LABEL[method] ?? method;
  return brand && brand !== "other" ? `${base} · ${brand.toUpperCase()}` : base;
}

interface CashSessionPaymentBreakdownEntry {
  expected: number;
  counted?: number;
  difference?: number;
}

interface CashSession {
  id: number;
  opened_by_name: string;
  closed_by_name: string | null;
  opening_amount: string | number;
  opening_note: string | null;
  status: "open" | "closed";
  opened_at: string;
  closed_at: string | null;
  counted_amount: string | number | null;
  expected_amount: string | number | null;
  difference_amount: string | number | null;
  closing_note: string | null;
  payment_breakdown: Record<string, CashSessionPaymentBreakdownEntry> | null;
}

interface CashSessionOrderItem {
  quantity: number;
  unit_price: string | number;
  name: string | null;
  product: { name: string } | null;
}

interface CashSessionOrder {
  id: number;
  total_amount: string | number;
  gross_amount: string | number | null;
  discount_amount: string | number | null;
  fee_amount: string | number | null;
  payment_method: string;
  created_at: string;
  status: string;
  customer_name: string | null;
  seller_name: string | null;
  items: CashSessionOrderItem[];
}

// payment_method é salvo como "money:50.00|pix:20.00" (múltiplas formas numa
// venda) — mesmo formato usado no PDV, ver PaymentBadges em outras telas.
function parsePaymentMethods(raw: string): string[] {
  if (!raw) return [];
  return raw.split("|").map((seg) => {
    const method = seg.split(":")[0]?.split("-")[0] ?? seg;
    return PM_LABEL[method] ?? method;
  });
}

interface CashSessionDetail extends CashSession {
  orders: CashSessionOrder[];
}

const money = (v: string | number | null | undefined) =>
  Number(v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function CashSessionHistory() {
  const [sessions, setSessions] = useState<CashSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "closed">("all");
  const [detail, setDetail] = useState<CashSessionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null);
  const [showExport, setShowExport] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Filtro de período — default "Tudo" preserva o comportamento atual.
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
      setNavYear(y); setPeriodPreset("year");
      const r = yearRange(y); setDateFrom(r.from); setDateTo(r.to);
      return;
    }
    let m = navMonth + delta; let y = navYear;
    if (m > 11) { m = 0; y++; } if (m < 0) { m = 11; y--; }
    setNavMonth(m); setNavYear(y); setPeriodPreset("month");
    const r = monthRange(y, m); setDateFrom(r.from); setDateTo(r.to);
  };

  const token = localStorage.getItem("token");

  useEffect(() => {
    fetch("/api/cash-sessions", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => setSessions(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    return sessions.filter((s) => {
      if (statusFilter !== "all" && s.status !== statusFilter) return false;
      if (periodPreset !== "all") {
        const opened = s.opened_at.substring(0, 10);
        if (opened < dateFrom || opened > dateTo) return false;
      }
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const haystack = `${s.opened_by_name} ${s.closed_by_name ?? ""}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [sessions, statusFilter, periodPreset, dateFrom, dateTo, searchTerm]);

  // Pedidos de todas as sessões filtradas — carregados sob demanda (o
  // /api/cash-sessions só traz o total por sessão, não os pedidos/itens; o
  // balanço por bandeira e a lista de itens vendidos precisam do detalhe de
  // cada sessão). Chave (ids ordenados) evita refetch se o filtro não mudou
  // de fato quais sessões estão na lista.
  const [ordersBySession, setOrdersBySession] = useState<Record<number, CashSessionOrder[]>>({});
  const [loadingReport, setLoadingReport] = useState(false);
  const filteredIdsKey = filtered.map((s) => s.id).sort((a, b) => a - b).join(",");

  useEffect(() => {
    if (filtered.length === 0) { setOrdersBySession({}); return; }
    let cancelled = false;
    setLoadingReport(true);
    Promise.all(
      filtered.map((s) =>
        fetch(`/api/cash-sessions/${s.id}`, { headers: { Authorization: `Bearer ${token}` } })
          .then((r) => (r.ok ? r.json() : null))
          .then((d: CashSessionDetail | null) => [s.id, d?.orders ?? []] as const)
          .catch(() => [s.id, []] as const)
      )
    ).then((pairs) => {
      if (cancelled) return;
      setOrdersBySession(Object.fromEntries(pairs));
    }).finally(() => { if (!cancelled) setLoadingReport(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredIdsKey]);

  const allOrders = useMemo(() => Object.values(ordersBySession).flat(), [ordersBySession]);

  // Balanço por forma de pagamento + bandeira, calculado direto dos pedidos
  // (payment_method já traz a bandeira) — mais preciso que o payment_breakdown
  // da sessão, que só agrega por método.
  const paymentByMethodBrand = useMemo(() => {
    const totals: Record<string, { method: string; brand: string; amount: number }> = {};
    allOrders.forEach((o) => {
      if (o.status === "cancelled") return;
      parseOrderPayments(o.payment_method).forEach((seg) => {
        const key = `${seg.method}-${seg.brand}`;
        if (!totals[key]) totals[key] = { method: seg.method, brand: seg.brand, amount: 0 };
        totals[key].amount += seg.amount;
      });
    });
    return Object.values(totals).sort((a, b) => b.amount - a.amount);
  }, [allOrders]);

  // Itens vendidos — uma linha por item, com pedido/produto/qtd/data/cliente/vendedor.
  const soldItems = useMemo(() => {
    return allOrders.flatMap((o) => {
      if (o.status === "cancelled") return [];
      return o.items.map((it) => ({
        orderId: o.id,
        productName: it.product?.name ?? it.name ?? "Item avulso",
        quantity: it.quantity,
        unitPrice: Number(it.unit_price),
        total: Number(it.unit_price) * it.quantity,
        createdAt: o.created_at,
        customerName: o.customer_name || "Balcão",
        sellerName: o.seller_name || "—",
        paymentLabel: parseOrderPayments(o.payment_method).map((s) => methodBrandLabel(s.method, s.brand)).join(" + "),
      }));
    });
  }, [allOrders]);

  const financeTotals = useMemo(() => allOrders.reduce((acc, o) => {
    if (o.status === "cancelled") return acc;
    acc.gross += Number(o.gross_amount ?? o.total_amount);
    acc.discount += Number(o.discount_amount ?? 0);
    acc.fee += Number(o.fee_amount ?? 0);
    acc.net += Number(o.total_amount);
    return acc;
  }, { gross: 0, discount: 0, fee: 0, net: 0 }), [allOrders]);

  const counts = useMemo(() => ({
    total: sessions.length,
    open: sessions.filter((s) => s.status === "open").length,
    closed: sessions.filter((s) => s.status === "closed").length,
    withDifference: sessions.filter((s) => s.status === "closed" && Number(s.difference_amount) !== 0).length,
  }), [sessions]);

  const printSessionReceipt = (session: CashSessionDetail) => {
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
    receipt += `${rule}\n${center("FECHAMENTO DE CAIXA")}\n${thin}\n`;
    receipt += row("Aberto por", session.opened_by_name) + "\n";
    receipt += row("Fechado por", session.closed_by_name ?? "-") + "\n";
    receipt += row("Abertura", new Date(session.opened_at).toLocaleString("pt-BR")) + "\n";
    if (session.closed_at) receipt += row("Fechamento", new Date(session.closed_at).toLocaleString("pt-BR")) + "\n";
    receipt += `${thin}\n`;
    receipt += row("Valor de abertura", `R$ ${money2(Number(session.opening_amount))}`) + "\n";
    if (session.payment_breakdown) {
      receipt += `${thin}\n${center("POR FORMA DE PAGAMENTO")}\n${thin}\n`;
      Object.entries(session.payment_breakdown).forEach(([method, entry]) => {
        receipt += row(PM_LABEL[method] ?? method, `R$ ${money2(entry.expected)}`) + "\n";
        if (entry.counted !== undefined) receipt += row("  Contado", `R$ ${money2(entry.counted)}`) + "\n";
        if (entry.difference !== undefined && entry.difference !== 0) {
          receipt += row("  Diferença", `${entry.difference > 0 ? "+" : ""}R$ ${money2(entry.difference)}`) + "\n";
        }
      });
    }
    receipt += `${rule}\n`;
    receipt += row("TOTAL ESPERADO", `R$ ${money2(Number(session.expected_amount))}`) + "\n";
    receipt += row("TOTAL CONTADO", `R$ ${money2(Number(session.counted_amount))}`) + "\n";
    const diff = Number(session.difference_amount);
    receipt += row(diff === 0 ? "CAIXA CONFERE" : diff > 0 ? "SOBRA" : "FALTA", `R$ ${money2(Math.abs(diff))}`) + "\n";
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

  const grandTotal = paymentByMethodBrand.reduce((a, v) => a + v.amount, 0);

  // Gráfico de pizza por forma de pagamento + bandeira — mesmo padrão (canvas
  // offscreen) já usado em Contas a Pagar (Fixo x Variável).
  function drawPaymentPieChart(): string | null {
    const entries = paymentByMethodBrand.filter((v) => v.amount > 0);
    if (entries.length === 0) return null;
    const baseColors: Record<string, string> = { money: "#059669", pix: "#7C3AED", debit: "#2563EB", credit: "#D97706", crediario: "#DC2626" };
    const canvas = document.createElement("canvas");
    canvas.width = 460; canvas.height = 300;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const cx = 140, cy = 150, r = 100;
    const total = entries.reduce((a, v) => a + v.amount, 0);
    let start = -Math.PI / 2;
    entries.forEach((seg) => {
      const angle = (seg.amount / total) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, start, start + angle);
      ctx.closePath();
      ctx.fillStyle = baseColors[seg.method] ?? "#64748B";
      ctx.fill();
      start += angle;
    });
    ctx.font = "bold 12px Arial";
    let ly = 30;
    entries.forEach((seg) => {
      ctx.fillStyle = baseColors[seg.method] ?? "#64748B";
      ctx.fillRect(300, ly, 14, 14);
      ctx.fillStyle = "#1E293B";
      const pct = total > 0 ? Math.round((seg.amount / total) * 100) : 0;
      ctx.fillText(`${methodBrandLabel(seg.method, seg.brand)} · ${pct}%`, 320, ly + 12);
      ly += 24;
    });
    return canvas.toDataURL("image/png").split(",")[1];
  }

  async function exportSessionsToExcel() {
    setExporting(true);
    try {
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

      const periodLabel = periodPreset === "month" ? `${MONTHS[navMonth]} ${navYear}`
        : periodPreset === "year" ? String(navYear)
        : periodPreset === "custom" ? `${dateFrom} a ${dateTo}`
        : "Todo o período";

      // ── Aba 1: Resumo (financeiro + forma de pagamento/bandeira) ──
      const wsResumo = wb.addWorksheet("Resumo", { pageSetup: { paperSize: 9, orientation: "portrait", fitToPage: true } });
      wsResumo.columns = [{ key: "a", width: 26 }, { key: "b", width: 20 }];
      wsResumo.getRow(1).getCell(1).value = "Histórico de Caixa — Resumo";
      wsResumo.getRow(1).getCell(1).font = font({ bold: true, size: 16, color: "1E3A5F" });
      wsResumo.getRow(2).getCell(1).value = `Período: ${periodLabel}  ·  Gerado em: ${new Date().toLocaleString("pt-BR")}`;
      wsResumo.getRow(2).getCell(1).font = font({ size: 9, italic: true, color: "94A3B8" });
      wsResumo.getRow(3).height = 4;

      // Totais financeiros (bruto/desconto/acréscimo/líquido)
      wsResumo.getRow(4).getCell(1).value = "TOTAIS FINANCEIROS";
      wsResumo.getRow(4).getCell(1).font = font({ bold: true, size: 11, color: "1E3A5F" });
      const finRows: [string, number][] = [
        ["Valor Bruto", financeTotals.gross],
        ["Descontos", -financeTotals.discount],
        ["Acréscimos/Taxas", financeTotals.fee],
        ["Valor Líquido", financeTotals.net],
      ];
      finRows.forEach(([label, val], i) => {
        const row = wsResumo.getRow(5 + i);
        row.getCell(1).value = label; row.getCell(1).font = font({ size: 10, bold: label === "Valor Líquido" });
        row.getCell(2).value = val; row.getCell(2).numFmt = '"R$" #,##0.00';
        row.getCell(2).alignment = { horizontal: "right" };
        row.getCell(2).font = font({ size: 10, bold: label === "Valor Líquido" });
        [1, 2].forEach((c) => { row.getCell(c).border = border(); row.getCell(c).fill = fill(label === "Valor Líquido" ? "F1F5F9" : "FFFFFF"); });
      });

      let r = 5 + finRows.length + 1;
      wsResumo.getRow(r).getCell(1).value = "POR FORMA DE PAGAMENTO";
      wsResumo.getRow(r).getCell(1).font = font({ bold: true, size: 11, color: "1E3A5F" });
      r += 1;

      const HEADERS_R = ["Forma de Pagamento", "Total (R$)"];
      HEADERS_R.forEach((h, i) => {
        const cell = wsResumo.getRow(r).getCell(i + 1);
        cell.value = h; cell.font = font({ bold: true, size: 10, color: "FFFFFF" });
        cell.fill = fill("1E3A5F"); cell.border = border();
        cell.alignment = { horizontal: i === 1 ? "right" : "left", vertical: "middle" };
      });
      const paymentHeaderRow = r;
      wsResumo.getRow(r).height = 20;
      r += 1;

      paymentByMethodBrand.forEach((seg, i) => {
        const row = wsResumo.getRow(r + i);
        const altBg = i % 2 === 0 ? "FFFFFF" : "F8FAFC";
        row.getCell(1).value = methodBrandLabel(seg.method, seg.brand);
        row.getCell(2).value = seg.amount;
        row.getCell(2).numFmt = '"R$" #,##0.00';
        row.getCell(2).alignment = { horizontal: "right" };
        [1, 2].forEach((c) => { row.getCell(c).fill = fill(altBg); row.getCell(c).border = border(); row.getCell(c).font = font({ size: 10 }); });
      });
      const totalRowIdx = r + paymentByMethodBrand.length;
      wsResumo.getRow(totalRowIdx).getCell(1).value = "TOTAL GERAL";
      wsResumo.getRow(totalRowIdx).getCell(1).font = font({ bold: true, size: 11 });
      wsResumo.getRow(totalRowIdx).getCell(2).value = grandTotal;
      wsResumo.getRow(totalRowIdx).getCell(2).numFmt = '"R$" #,##0.00';
      wsResumo.getRow(totalRowIdx).getCell(2).alignment = { horizontal: "right" };
      wsResumo.getRow(totalRowIdx).getCell(2).font = font({ bold: true, size: 11 });
      [1, 2].forEach((c) => { wsResumo.getRow(totalRowIdx).getCell(c).fill = fill("F1F5F9"); wsResumo.getRow(totalRowIdx).getCell(c).border = border(); });
      wsResumo.autoFilter = { from: { row: paymentHeaderRow, column: 1 }, to: { row: totalRowIdx - 1, column: 2 } };

      const chartBase64 = drawPaymentPieChart();
      if (chartBase64) {
        const imageId = wb.addImage({ base64: chartBase64, extension: "png" });
        wsResumo.addImage(imageId, { tl: { col: 0, row: totalRowIdx + 2 }, ext: { width: 460, height: 300 } });
      }

      // ── Aba 2: Sessões (cabeçalho + tabela detalhada) ──
      const wsSessions = wb.addWorksheet("Sessões de Caixa", { pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true } });
      wsSessions.columns = [
        { key: "id", width: 8 }, { key: "opened_by", width: 20 }, { key: "closed_by", width: 20 },
        { key: "opened_at", width: 18 }, { key: "closed_at", width: 18 }, { key: "status", width: 12 },
        { key: "opening", width: 14 }, { key: "expected", width: 14 }, { key: "counted", width: 14 }, { key: "diff", width: 14 },
      ];
      wsSessions.getRow(1).getCell(1).value = "Sessões de Caixa";
      wsSessions.getRow(1).getCell(1).font = font({ bold: true, size: 14, color: "1E3A5F" });
      wsSessions.getRow(2).getCell(1).value = `Período: ${periodLabel}  ·  ${filtered.length} sessão(ões)`;
      wsSessions.getRow(2).getCell(1).font = font({ size: 9, italic: true, color: "94A3B8" });
      wsSessions.getRow(3).height = 4;

      const HEADERS_S = ["#", "Aberto por", "Fechado por", "Abertura", "Fechamento", "Status", "Valor Inicial", "Esperado", "Contado", "Diferença"];
      HEADERS_S.forEach((h, i) => {
        const cell = wsSessions.getRow(4).getCell(i + 1);
        cell.value = h; cell.font = font({ bold: true, size: 10, color: "FFFFFF" });
        cell.fill = fill("1E3A5F"); cell.border = border();
        cell.alignment = { horizontal: i >= 6 ? "right" : "left", vertical: "middle" };
      });
      wsSessions.getRow(4).height = 20;

      filtered.forEach((s, i) => {
        const row = wsSessions.getRow(5 + i);
        const altBg = i % 2 === 0 ? "FFFFFF" : "F8FAFC";
        const cells = [
          s.id, s.opened_by_name, s.closed_by_name ?? "—",
          new Date(s.opened_at).toLocaleString("pt-BR"),
          s.closed_at ? new Date(s.closed_at).toLocaleString("pt-BR") : "—",
          s.status === "open" ? "Aberto" : "Fechado",
          Number(s.opening_amount), Number(s.expected_amount ?? 0), Number(s.counted_amount ?? 0), Number(s.difference_amount ?? 0),
        ];
        cells.forEach((val, ci) => {
          const cell = row.getCell(ci + 1);
          cell.value = val;
          cell.fill = fill(altBg); cell.border = border(); cell.font = font({ size: 10 });
          if (ci >= 6) { cell.numFmt = '"R$" #,##0.00'; cell.alignment = { horizontal: "right" }; }
          if (ci === 0) cell.alignment = { horizontal: "center" };
        });
      });
      if (filtered.length > 0) {
        wsSessions.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4 + filtered.length, column: 10 } };
      }

      // ── Aba 3: Itens Vendidos (produto, qtd, data, cliente, vendedor, pagamento) ──
      const wsItems = wb.addWorksheet("Itens Vendidos", { pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true } });
      wsItems.columns = [
        { key: "order", width: 10 }, { key: "product", width: 30 }, { key: "qty", width: 8 },
        { key: "unit", width: 12 }, { key: "total", width: 14 }, { key: "date", width: 18 },
        { key: "customer", width: 20 }, { key: "seller", width: 18 }, { key: "payment", width: 22 },
      ];
      wsItems.getRow(1).getCell(1).value = "Itens Vendidos";
      wsItems.getRow(1).getCell(1).font = font({ bold: true, size: 14, color: "1E3A5F" });
      wsItems.getRow(2).getCell(1).value = `Período: ${periodLabel}  ·  ${soldItems.length} item(ns)`;
      wsItems.getRow(2).getCell(1).font = font({ size: 9, italic: true, color: "94A3B8" });
      wsItems.getRow(3).height = 4;

      const HEADERS_I = ["Pedido", "Produto", "Qtd", "Unitário", "Total", "Data/Hora", "Cliente", "Vendedor", "Pagamento"];
      HEADERS_I.forEach((h, i) => {
        const cell = wsItems.getRow(4).getCell(i + 1);
        cell.value = h; cell.font = font({ bold: true, size: 10, color: "FFFFFF" });
        cell.fill = fill("1E3A5F"); cell.border = border();
        cell.alignment = { horizontal: [2, 3].includes(i) ? "right" : "left", vertical: "middle" };
      });
      wsItems.getRow(4).height = 20;

      soldItems.forEach((it, i) => {
        const row = wsItems.getRow(5 + i);
        const altBg = i % 2 === 0 ? "FFFFFF" : "F8FAFC";
        const cells = [
          `#${String(it.orderId).padStart(6, "0")}`, it.productName, it.quantity,
          it.unitPrice, it.total, new Date(it.createdAt).toLocaleString("pt-BR"),
          it.customerName, it.sellerName, it.paymentLabel,
        ];
        cells.forEach((val, ci) => {
          const cell = row.getCell(ci + 1);
          cell.value = val;
          cell.fill = fill(altBg); cell.border = border(); cell.font = font({ size: 10 });
          if (ci === 3 || ci === 4) { cell.numFmt = '"R$" #,##0.00'; cell.alignment = { horizontal: "right" }; }
          if (ci === 2) cell.alignment = { horizontal: "right" };
        });
      });
      if (soldItems.length > 0) {
        wsItems.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4 + soldItems.length, column: 9 } };
      }

      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `historico-caixa-${new Date().toISOString().substring(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
      setShowExport(false);
    }
  }

  function exportSessionsToPDF() {
    const periodLabel = periodPreset === "month" ? `${MONTHS[navMonth]} ${navYear}`
      : periodPreset === "year" ? String(navYear)
      : periodPreset === "custom" ? `${dateFrom} a ${dateTo}`
      : "Todo o período";

    const paymentRows = paymentByMethodBrand.map((seg) => `
      <tr><td>${methodBrandLabel(seg.method, seg.brand)}</td><td style="text-align:right;font-weight:700">${money(seg.amount)}</td></tr>`).join("");

    const sessionRows = filtered.map((s) => `
      <tr>
        <td>${s.opened_by_name}</td>
        <td>${s.closed_by_name ?? "—"}</td>
        <td style="text-align:center">${new Date(s.opened_at).toLocaleString("pt-BR")}</td>
        <td style="text-align:center">${s.closed_at ? new Date(s.closed_at).toLocaleString("pt-BR") : "—"}</td>
        <td style="text-align:center">${s.status === "open" ? "Aberto" : "Fechado"}</td>
        <td style="text-align:right">${money(s.expected_amount)}</td>
        <td style="text-align:right;font-weight:700">${money(s.counted_amount)}</td>
      </tr>`).join("");

    const itemRows = soldItems.map((it) => `
      <tr>
        <td>#${String(it.orderId).padStart(6, "0")}</td>
        <td>${it.productName}</td>
        <td style="text-align:center">${it.quantity}</td>
        <td style="text-align:right">${money(it.total)}</td>
        <td style="text-align:center">${new Date(it.createdAt).toLocaleString("pt-BR")}</td>
        <td>${it.customerName}</td>
        <td>${it.sellerName}</td>
        <td>${it.paymentLabel}</td>
      </tr>`).join("");

    const html = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"/><title>Histórico de Caixa</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; padding: 32px; font-size: 12px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; border-bottom: 3px solid #1e3a5f; padding-bottom: 16px; }
  .header h1 { font-size: 20px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.1em; }
  .meta { text-align: right; font-size: 10px; color: #64748b; }
  .summary-title { font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; margin: 20px 0 10px; color: #1e3a5f; }
  .fin-summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px; }
  .fin-card { padding: 12px 14px; border-radius: 10px; border: 1px solid #e2e8f0; }
  .fin-card label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; display: block; margin-bottom: 4px; color: #94a3b8; }
  .fin-card .val { font-size: 16px; font-weight: 900; font-family: monospace; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
  th { background: #f8fafc; border-bottom: 2px solid #e2e8f0; padding: 10px 12px; text-align: left; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #94a3b8; }
  td { padding: 9px 12px; border-bottom: 1px solid #f1f5f9; font-size: 11px; }
  .total-row td { font-weight: 900; background: #f1f5f9; border-top: 2px solid #1e3a5f; }
  @media print { body { padding: 16px; } table { page-break-inside: auto; } tr { page-break-inside: avoid; } }
</style></head>
<body>
<div class="header">
  <div><h1>Histórico de Caixa</h1></div>
  <div class="meta"><strong>Período: ${periodLabel}</strong><br/>Gerado em: ${new Date().toLocaleString("pt-BR")}</div>
</div>

<p class="summary-title">Totais Financeiros</p>
<div class="fin-summary">
  <div class="fin-card"><label>Bruto</label><div class="val">${money(financeTotals.gross)}</div></div>
  <div class="fin-card"><label>Descontos</label><div class="val">- ${money(financeTotals.discount)}</div></div>
  <div class="fin-card"><label>Acréscimos/Taxas</label><div class="val">+ ${money(financeTotals.fee)}</div></div>
  <div class="fin-card"><label>Líquido</label><div class="val">${money(financeTotals.net)}</div></div>
</div>

<p class="summary-title">Balanço por Forma de Pagamento</p>
<table>
  <thead><tr><th>Forma de Pagamento</th><th style="text-align:right">Total</th></tr></thead>
  <tbody>${paymentRows}
  <tr class="total-row"><td>TOTAL GERAL</td><td style="text-align:right">${money(grandTotal)}</td></tr>
  </tbody>
</table>

<p class="summary-title">Sessões de Caixa (${filtered.length})</p>
<table>
  <thead><tr><th>Aberto por</th><th>Fechado por</th><th style="text-align:center">Abertura</th><th style="text-align:center">Fechamento</th><th style="text-align:center">Status</th><th style="text-align:right">Esperado</th><th style="text-align:right">Contado</th></tr></thead>
  <tbody>${sessionRows}</tbody>
</table>

<p class="summary-title">Itens Vendidos (${soldItems.length})</p>
<table>
  <thead><tr><th>Pedido</th><th>Produto</th><th style="text-align:center">Qtd</th><th style="text-align:right">Total</th><th style="text-align:center">Data</th><th>Cliente</th><th>Vendedor</th><th>Pagamento</th></tr></thead>
  <tbody>${itemRows}</tbody>
</table>
</body></html>`;

    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
    setShowExport(false);
  }

  const openDetail = async (id: number) => {
    setDetailLoading(true);
    setDetail(null);
    setExpandedOrderId(null);
    try {
      const res = await fetch(`/api/cash-sessions/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setDetail(data);
    } catch {
      // ignore
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Histórico de Caixa"
        subtitle="Todas as aberturas e fechamentos de caixa — quem abriu, quem fechou e a diferença apurada"
        action={
          <div className="relative">
            <Button
              variant="secondary"
              icon={exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              onClick={() => setShowExport((v) => !v)}
              disabled={exporting || filtered.length === 0}
            >
              Exportar <ChevronDown size={12} />
            </Button>
            {showExport && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowExport(false)} />
                <div className="absolute right-0 top-11 w-56 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden">
                  <button
                    onClick={exportSessionsToExcel}
                    className="w-full flex items-center gap-3 px-4 py-3 text-[12px] font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <FileSpreadsheet size={15} className="text-emerald-600" /> Excel (.xlsx)
                  </button>
                  <button
                    onClick={exportSessionsToPDF}
                    className="w-full flex items-center gap-3 px-4 py-3 text-[12px] font-bold text-slate-700 hover:bg-slate-50 transition-colors border-t border-slate-100"
                  >
                    <FileText size={15} className="text-rose-600" /> PDF
                  </button>
                </div>
              </>
            )}
          </div>
        }
      />

      {/* Filtro de período */}
      <div className="flex items-center gap-2 flex-wrap">
        {(periodPreset === "month" || periodPreset === "year") && (
          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl p-1">
            <button onClick={() => navigatePeriod(-1)} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:bg-white hover:text-slate-900 transition-all">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <span className="px-3 h-7 flex items-center rounded-lg text-[11px] font-black uppercase tracking-widest bg-slate-900 text-white min-w-[140px] justify-center">
              {periodPreset === "year" ? navYear : `${MONTHS[navMonth]} ${navYear}`}
            </span>
            <button onClick={() => navigatePeriod(1)} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:bg-white hover:text-slate-900 transition-all">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>
        )}
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
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
              className="pl-3 pr-3 h-9 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-bold focus:outline-none focus:border-blue-400 transition-all w-[148px]" />
            <span className="text-[10px] font-black text-slate-300 uppercase">até</span>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
              className="pl-3 pr-3 h-9 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-bold focus:outline-none focus:border-blue-400 transition-all w-[148px]" />
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-0 border-b border-slate-100 divide-x divide-slate-100">
          {[
            { label: "Total",              value: counts.total,          color: "text-slate-900" },
            { label: "Caixas Abertos",     value: counts.open,           color: "text-blue-500" },
            { label: "Caixas Fechados",    value: counts.closed,         color: "text-emerald-500" },
            { label: "Com Diferença",      value: counts.withDifference, color: "text-rose-500" },
          ].map((k) => (
            <div key={k.label} className="flex-1 px-5 py-4 flex flex-col gap-0.5">
              <span className={cn("text-2xl font-black tracking-tight font-mono leading-none", k.color)}>{k.value}</span>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{k.label}</span>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 px-4 py-3 flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
            <input
              type="text"
              placeholder="Buscar por operador..."
              className="w-full pl-8 pr-3 h-9 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-400 text-[11px] font-medium placeholder:text-slate-300 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "all" | "open" | "closed")}
            className="h-9 px-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-bold outline-none focus:border-blue-400 transition-all"
          >
            <option value="all">Todos os status</option>
            <option value="open">Aberto</option>
            <option value="closed">Fechado</option>
          </select>
        </div>

        {/* Balanço por forma de pagamento/bandeira do período filtrado */}
        {(loadingReport || paymentByMethodBrand.length > 0) && (
          <div className="px-4 pb-4">
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2.5">
                Balanço por Forma de Pagamento {loadingReport && <Loader2 size={10} className="inline animate-spin ml-1" />}
              </p>
              {loadingReport && paymentByMethodBrand.length === 0 ? (
                <p className="text-[11px] text-slate-400">Carregando vendas do período...</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {paymentByMethodBrand.map((seg) => (
                    <div key={`${seg.method}-${seg.brand}`} className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">{methodBrandLabel(seg.method, seg.brand)}</span>
                      <span className="text-[12px] font-mono font-black text-slate-800">{money(seg.amount)}</span>
                    </div>
                  ))}
                  <div className="flex items-center gap-2 bg-slate-900 rounded-lg px-3 py-2">
                    <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wide">Total</span>
                    <span className="text-[12px] font-mono font-black text-white">{money(grandTotal)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-t border-slate-100 bg-slate-50/60">
                {["Abertura", "Aberto por", "Fechado por", "Status", "Valor Inicial", "Contado", "Diferença", ""].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-400 text-xs">Carregando...</td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-400 text-xs">Nenhuma sessão de caixa encontrada</td></tr>
              )}
              {!loading && filtered.map((s) => {
                const diff = Number(s.difference_amount ?? 0);
                return (
                  <tr key={s.id} onClick={() => openDetail(s.id)}
                    className="border-t border-slate-100 hover:bg-slate-50/60 transition-colors cursor-pointer">
                    <td className="px-4 py-2.5 text-xs text-slate-500 whitespace-nowrap">
                      {new Date(s.opened_at).toLocaleString("pt-BR")}
                    </td>
                    <td className="px-4 py-2.5 text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <User size={12} className="text-slate-400" /> {s.opened_by_name}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-500">{s.closed_by_name ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      {s.status === "open" ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide bg-blue-50 text-blue-600">
                          <Clock size={12} /> Aberto
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide bg-emerald-50 text-emerald-600">
                          <CheckCircle2 size={12} /> Fechado
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs font-mono text-slate-600">{money(s.opening_amount)}</td>
                    <td className="px-4 py-2.5 text-xs font-mono text-slate-600">{s.counted_amount != null ? money(s.counted_amount) : "—"}</td>
                    <td className="px-4 py-2.5 text-xs font-mono font-bold">
                      {s.status === "closed" ? (
                        <span className={diff === 0 ? "text-slate-400" : diff > 0 ? "text-emerald-600" : "text-rose-600"}>
                          {diff > 0 ? "+" : ""}{money(diff)}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <ChevronRight size={14} className="text-slate-300" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de detalhe */}
      {(detail || detailLoading) && (
        <>
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[500]" onClick={() => setDetail(null)} />
          <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white z-[510] shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 shrink-0">
              <div className="flex items-center gap-2">
                <Wallet size={16} className="text-blue-600" />
                <h2 className="font-black text-slate-900 text-[15px]">Sessão de Caixa</h2>
              </div>
              <div className="flex items-center gap-1">
                {detail && detail.status === "closed" && (
                  <button onClick={() => printSessionReceipt(detail)}
                    className="p-2 hover:bg-slate-100 rounded-lg text-slate-500" title="Imprimir via térmica">
                    <Printer size={16} />
                  </button>
                )}
                <button onClick={() => setDetail(null)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500"><X size={18} /></button>
              </div>
            </div>

            {detailLoading && (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 size={22} className="animate-spin text-slate-300" />
              </div>
            )}

            {detail && !detailLoading && (
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Aberto por</p>
                    <p className="text-[12px] font-bold text-slate-800">{detail.opened_by_name}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1"><Calendar size={9} /> {new Date(detail.opened_at).toLocaleString("pt-BR")}</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Fechado por</p>
                    <p className="text-[12px] font-bold text-slate-800">{detail.closed_by_name ?? "Ainda aberto"}</p>
                    {detail.closed_at && (
                      <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1"><Calendar size={9} /> {new Date(detail.closed_at).toLocaleString("pt-BR")}</p>
                    )}
                  </div>
                </div>

                <div className="bg-slate-900 rounded-2xl p-4 space-y-1.5">
                  <div className="flex justify-between text-[11px] font-bold text-slate-400">
                    <span>Valor inicial</span>
                    <span className="font-mono text-white">{money(detail.opening_amount)}</span>
                  </div>
                  {detail.status === "closed" && (
                    <>
                      <div className="flex justify-between text-[11px] font-bold text-slate-400">
                        <span>Esperado</span>
                        <span className="font-mono text-white">{money(detail.expected_amount)}</span>
                      </div>
                      <div className="flex justify-between text-[11px] font-bold text-slate-400">
                        <span>Contado</span>
                        <span className="font-mono text-white">{money(detail.counted_amount)}</span>
                      </div>
                      <div className="flex justify-between text-[13px] font-black pt-1.5 border-t border-slate-700">
                        <span className="text-white uppercase">Diferença</span>
                        <span className={cn("font-mono", Number(detail.difference_amount) === 0 ? "text-slate-300" : Number(detail.difference_amount) > 0 ? "text-emerald-400" : "text-rose-400")}>
                          {Number(detail.difference_amount) > 0 ? "+" : ""}{money(detail.difference_amount)}
                        </span>
                      </div>
                    </>
                  )}
                </div>

                {detail.status === "closed" && detail.payment_breakdown && (
                  <div className="rounded-xl border border-slate-200 overflow-hidden">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-3 py-2 bg-slate-50 border-b border-slate-100">
                      Por forma de pagamento
                    </p>
                    <table className="w-full text-[11px]">
                      <thead className="bg-slate-50 text-slate-400 uppercase tracking-widest text-[9px] font-bold">
                        <tr>
                          <td className="px-3 py-2">Forma</td>
                          <td className="px-3 py-2 text-right">Esperado</td>
                          <td className="px-3 py-2 text-right">Contado</td>
                          <td className="px-3 py-2 text-right">Diferença</td>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(detail.payment_breakdown).map(([method, entry]) => (
                          <tr key={method} className="border-t border-slate-100">
                            <td className="px-3 py-2 font-bold text-slate-700">{PM_LABEL[method] ?? method}</td>
                            <td className="px-3 py-2 text-right font-mono text-slate-600">{money(entry.expected)}</td>
                            <td className="px-3 py-2 text-right font-mono text-slate-600">
                              {entry.counted !== undefined ? money(entry.counted) : "—"}
                            </td>
                            <td className={cn(
                              "px-3 py-2 text-right font-mono font-bold",
                              entry.difference === undefined ? "text-slate-300" :
                              entry.difference === 0 ? "text-slate-500" : entry.difference > 0 ? "text-blue-600" : "text-rose-500",
                            )}>
                              {entry.difference !== undefined ? money(entry.difference) : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {detail.opening_note && (
                  <div className="text-[11px] text-slate-500"><span className="font-bold text-slate-700">Obs. abertura:</span> {detail.opening_note}</div>
                )}
                {detail.closing_note && (
                  <div className="text-[11px] text-slate-500"><span className="font-bold text-slate-700">Obs. fechamento:</span> {detail.closing_note}</div>
                )}

                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">
                    Vendas nesta sessão ({detail.orders.length})
                  </p>
                  <div className="space-y-1.5">
                    {detail.orders.length === 0 && (
                      <p className="text-[11px] text-slate-400 py-4 text-center">Nenhuma venda registrada nesta sessão.</p>
                    )}
                    {detail.orders.map((o) => {
                      const isOpen = expandedOrderId === o.id;
                      const methods = parsePaymentMethods(o.payment_method);
                      return (
                        <div key={o.id} className="bg-slate-50 rounded-xl border border-slate-100 overflow-hidden">
                          <button
                            onClick={() => setExpandedOrderId(isOpen ? null : o.id)}
                            className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-slate-100/60 transition-colors"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="text-[11px] font-bold text-slate-700">#{String(o.id).padStart(6, "0")}</p>
                                {methods.map((m, i) => (
                                  <span key={i} className="text-[8px] font-black uppercase tracking-widest text-blue-500 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded">
                                    {m}
                                  </span>
                                ))}
                              </div>
                              <p className="text-[9px] text-slate-400 truncate">
                                {new Date(o.created_at).toLocaleTimeString("pt-BR")}
                                {o.customer_name ? ` · ${o.customer_name}` : ""}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <p className="text-[11px] font-mono font-black text-slate-800">{money(o.total_amount)}</p>
                              <ChevronRight size={13} className={cn("text-slate-400 transition-transform", isOpen && "rotate-90")} />
                            </div>
                          </button>
                          {isOpen && (
                            <div className="px-3 pb-2.5 pt-0.5 space-y-1 border-t border-slate-200/70">
                              {o.items.length === 0 ? (
                                <p className="text-[10px] text-slate-400 py-1.5">Sem itens registrados.</p>
                              ) : o.items.map((item, i) => (
                                <div key={i} className="flex items-center justify-between text-[10px] py-1">
                                  <span className="text-slate-600 truncate pr-2">
                                    {item.quantity}× {item.product?.name ?? item.name ?? "Item avulso"}
                                  </span>
                                  <span className="font-mono font-bold text-slate-700 shrink-0">
                                    {money(Number(item.unit_price) * item.quantity)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
