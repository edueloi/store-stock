import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import ExcelJS from "exceljs";
import {
  Receipt,
  Search,
  Download,
  ChevronRight,
  Clock,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Package,
  ShoppingCart as CartIcon,
  X,
  CreditCard,
  ShieldCheck,
  User,
  AlertTriangle,
  Loader2,
  Trash2,
  CheckSquare,
  Calendar,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import PageHeader from "../../components/layout/PageHeader";
import { Order, Product } from "../../types";
import { cn } from "../../lib/utils";
import { motion, AnimatePresence } from "motion/react";

interface OrderDetail extends Order {
  items: Array<{
    id: number;
    product_name: string;
    quantity: number;
    unit_price: number;
  }>;
}

interface TenantBasic {
  name: string;
  document?: string;
  logo_url?: string;
  whatsapp?: string;
  address_street?: string;
  address_number?: string;
  address_complement?: string;
  address_district?: string;
  address_city?: string;
  address_state?: string;
  address_zip?: string;
  address?: string;
  policies?: {
    returns?: string;
    shipping?: string;
    exchange?: string;
    warranty_days?: number;
    warranty_resolution_days?: number;
    warranty_title?: string;
    warranty_clauses?: string[];
  };
}

function formatPaymentLabel(pm?: string | null) {
  if (!pm) return "—";
  const labels: Record<string, string> = { money: "Dinheiro", pix: "PIX", debit: "Débito", credit: "Crédito" };
  return pm.split("|").map((seg) => {
    const [methodPart, amountStr] = seg.split(":");
    const tokens = methodPart.split("-");
    const method = tokens[0] ?? "money";
    const brand  = tokens[1] && tokens[1] !== "other" ? `/${tokens[1].toUpperCase()}` : "";
    const inst   = tokens[2] ? ` ${tokens[2].toUpperCase()}` : "";
    const amt    = amountStr ? ` R$ ${parseFloat(amountStr).toFixed(2)}` : "";
    return `${labels[method] ?? method}${brand}${inst}${amt}`;
  }).join(" + ");
}

async function exportOrdersToExcel(orders: Order[], tenantName: string) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "BoxSys Store";
  wb.created = new Date();

  const ws = wb.addWorksheet("Pedidos", {
    pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true },
    views: [{ state: "frozen", ySplit: 7 }],
  });

  ws.columns = [
    { key: "id",       width: 10 },
    { key: "date",     width: 14 },
    { key: "customer", width: 28 },
    { key: "seller",   width: 18 },
    { key: "payment",  width: 32 },
    { key: "gross",    width: 14 },
    { key: "discount", width: 14 },
    { key: "fee",      width: 14 },
    { key: "total",    width: 14 },
    { key: "status",   width: 14 },
  ];

  const border = (style: "thin" | "medium" = "thin"): Partial<ExcelJS.Borders> => ({
    top:    { style, color: { argb: style === "medium" ? "FF0F172A" : "FFE2E8F0" } },
    bottom: { style, color: { argb: style === "medium" ? "FF0F172A" : "FFE2E8F0" } },
    left:   { style, color: { argb: style === "medium" ? "FF0F172A" : "FFE2E8F0" } },
    right:  { style, color: { argb: style === "medium" ? "FF0F172A" : "FFE2E8F0" } },
  });
  const fill = (hex: string): ExcelJS.Fill => ({
    type: "pattern", pattern: "solid", fgColor: { argb: `FF${hex}` },
  });
  const font = (opts: { bold?: boolean; size?: number; color?: string; italic?: boolean }): Partial<ExcelJS.Font> => ({
    name: "Calibri", size: opts.size ?? 11,
    bold: opts.bold ?? false, italic: opts.italic ?? false,
    color: { argb: `FF${opts.color ?? "1E293B"}` },
  });

  // Row 1 — título
  ws.getRow(1).height = 30;
  const c1 = ws.getRow(1).getCell(1);
  c1.value = tenantName;
  c1.font  = font({ bold: true, size: 20, color: "1E3A5F" });
  c1.alignment = { vertical: "middle" };

  // Row 2 — subtítulo
  ws.getRow(2).height = 16;
  const c2 = ws.getRow(2).getCell(1);
  c2.value = `Relatório de Pedidos  ·  ${orders.length} pedidos exportados`;
  c2.font  = font({ italic: true, size: 10, color: "64748B" });
  const c2g = ws.getRow(2).getCell(8);
  c2g.value = `Gerado em: ${new Date().toLocaleString("pt-BR")}`;
  c2g.font  = font({ italic: true, size: 9, color: "94A3B8" });
  c2g.alignment = { horizontal: "right", vertical: "middle" };

  // Row 3 — separator
  ws.getRow(3).height = 4;
  for (let c = 1; c <= 10; c++) {
    ws.getRow(3).getCell(c).border = { bottom: { style: "medium", color: { argb: "FF1E3A5F" } } };
  }

  // Rows 4–5 — summary cards
  const completed = orders.filter(o => o.status === "completed");
  const totalBruto   = completed.reduce((a, o) => a + Number(o.gross_amount   ?? o.total_amount), 0);
  const totalDesconto = completed.reduce((a, o) => a + Number(o.discount_amount ?? 0), 0);
  const totalTaxa     = completed.reduce((a, o) => a + Number(o.fee_amount     ?? 0), 0);
  const totalLiquido  = completed.reduce((a, o) => a + Number(o.total_amount), 0);

  ws.getRow(4).height = 16;
  ws.getRow(5).height = 28;
  const cards = [
    { col: 1, span: 2, label: "TOTAL PEDIDOS",      bg: "EFF6FF", fg: "1D4ED8", val: orders.length,   fmt: "0",                vfg: "2563EB" },
    { col: 3, span: 2, label: "PEDIDOS PAGOS",       bg: "ECFDF5", fg: "065F46", val: completed.length, fmt: "0",               vfg: "059669" },
    { col: 5, span: 2, label: "BRUTO (PAGOS)",       bg: "F0FDF4", fg: "166534", val: totalBruto,      fmt: '"R$" #,##0.00',   vfg: "16A34A" },
    { col: 7, span: 2, label: "DESCONTOS + TAXAS",   bg: "FFF1F2", fg: "9F1239", val: -(totalDesconto + totalTaxa), fmt: '"R$" #,##0.00', vfg: "E11D48" },
    { col: 9, span: 2, label: "LÍQUIDO RECEBIDO",    bg: "1E293B", fg: "94A3B8", val: totalLiquido,    fmt: '"R$" #,##0.00',   vfg: "34D399" },
  ];
  for (const { col, span, label, bg, fg, val, fmt, vfg } of cards) {
    const l4 = ws.getRow(4).getCell(col);
    l4.value = label;
    l4.font  = font({ bold: true, size: 8, color: fg });
    l4.fill  = fill(bg);
    l4.alignment = { horizontal: "center", vertical: "middle" };
    l4.border = { top: { style: "medium", color: { argb: `FF${fg}` } }, left: { style: "medium", color: { argb: `FF${fg}` } }, right: { style: "medium", color: { argb: `FF${fg}` } } };
    if (span > 1) ws.mergeCells(4, col, 4, col + span - 1);

    const l5 = ws.getRow(5).getCell(col);
    l5.value  = val;
    l5.numFmt = fmt;
    l5.font   = font({ bold: true, size: 13, color: vfg });
    l5.fill   = fill(bg);
    l5.alignment = { horizontal: "center", vertical: "middle" };
    l5.border = { bottom: { style: "medium", color: { argb: `FF${fg}` } }, left: { style: "medium", color: { argb: `FF${fg}` } }, right: { style: "medium", color: { argb: `FF${fg}` } } };
    if (span > 1) ws.mergeCells(5, col, 5, col + span - 1);
  }

  // Row 6 — gap
  ws.getRow(6).height = 6;

  // Row 7 — header
  ws.getRow(7).height = 22;
  const HEADERS = ["Pedido", "Data", "Cliente", "Vendedor", "Pagamento", "Bruto (R$)", "Desc. (R$)", "Taxa (R$)", "Total (R$)", "Status"];
  HEADERS.forEach((h, i) => {
    const cell = ws.getRow(7).getCell(i + 1);
    cell.value = h;
    cell.font  = font({ bold: true, size: 10, color: "FFFFFF" });
    cell.fill  = fill("1E3A5F");
    cell.alignment = { horizontal: i >= 5 ? "right" : i === 0 ? "center" : "left", vertical: "middle" };
    cell.border = border("medium");
  });

  // Data rows
  orders.forEach((o, i) => {
    const rowNum = 8 + i;
    const altBg  = i % 2 === 0 ? "FFFFFF" : "F8FAFC";
    const row    = ws.getRow(rowNum);
    row.height   = 20;

    const s = (cell: ExcelJS.Cell, align: ExcelJS.Alignment["horizontal"] = "left") => {
      cell.fill      = fill(altBg);
      cell.alignment = { horizontal: align, vertical: "middle" };
      cell.border    = border("thin");
    };

    // Pedido
    const cId = row.getCell(1);
    cId.value = `#${String(o.id).padStart(6, "0")}`;
    cId.font  = font({ bold: true, size: 10, color: "2563EB" });
    s(cId, "center");

    // Data
    const cDate = row.getCell(2);
    const d = new Date(o.created_at);
    cDate.value  = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    cDate.numFmt = "DD/MM/YYYY";
    cDate.font   = font({ size: 10, color: "475569" });
    s(cDate, "center");

    // Cliente
    const cCust = row.getCell(3);
    cCust.value = o.customer_name || "Balcão";
    cCust.font  = font({ size: 10, bold: true });
    s(cCust, "left");

    // Vendedor
    const cSeller = row.getCell(4);
    cSeller.value = o.seller_name || "—";
    cSeller.font  = font({ size: 10, color: "6366F1" });
    s(cSeller, "left");

    // Pagamento
    const cPay = row.getCell(5);
    cPay.value = formatPaymentLabel(o.payment_method);
    cPay.font  = font({ size: 9, color: "475569" });
    s(cPay, "left");

    // Bruto
    const cGross = row.getCell(6);
    if (o.gross_amount != null) {
      cGross.value  = Number(o.gross_amount);
      cGross.numFmt = '"R$" #,##0.00';
      cGross.font   = font({ size: 10, color: "475569" });
    } else {
      cGross.value = "—";
      cGross.font  = font({ size: 10, color: "CBD5E1" });
    }
    s(cGross, "right");

    // Desconto
    const cDisc = row.getCell(7);
    const discVal = Number(o.discount_amount ?? 0);
    if (discVal > 0) {
      cDisc.value  = -discVal;
      cDisc.numFmt = '"R$" #,##0.00;[Red]"R$" -#,##0.00';
      cDisc.font   = font({ bold: true, size: 10, color: "E11D48" });
    } else {
      cDisc.value = "—";
      cDisc.font  = font({ size: 10, color: "CBD5E1" });
    }
    s(cDisc, "right");

    // Taxa
    const cFee = row.getCell(8);
    const feeVal = Number(o.fee_amount ?? 0);
    if (feeVal > 0) {
      cFee.value  = -feeVal;
      cFee.numFmt = '"R$" #,##0.00;[Red]"R$" -#,##0.00';
      cFee.font   = font({ bold: true, size: 10, color: "D97706" });
    } else {
      cFee.value = "—";
      cFee.font  = font({ size: 10, color: "CBD5E1" });
    }
    s(cFee, "right");

    // Total
    const cTotal = row.getCell(9);
    const statusColor = o.status === "cancelled" ? "DC2626" : "059669";
    cTotal.value  = Number(o.total_amount);
    cTotal.numFmt = '"R$" #,##0.00';
    cTotal.font   = font({ bold: true, size: 11, color: statusColor });
    s(cTotal, "right");

    // Status
    const cStatus = row.getCell(10);
    const statusMap: Record<string, { label: string; bg: string; fg: string }> = {
      completed: { label: "✔ Pago",      bg: "D1FAE5", fg: "065F46" },
      pending:   { label: "⏳ Pendente", bg: "FEF3C7", fg: "92400E" },
      cancelled: { label: "✖ Cancelado", bg: "FEE2E2", fg: "991B1B" },
    };
    const st = statusMap[o.status] ?? { label: o.status, bg: "F1F5F9", fg: "475569" };
    cStatus.value = st.label;
    cStatus.font  = font({ bold: true, size: 9, color: st.fg });
    cStatus.fill  = fill(st.bg);
    cStatus.alignment = { horizontal: "center", vertical: "middle" };
    cStatus.border = border("thin");
  });

  // Footer totals
  const footerRow = 8 + orders.length + 1;
  const addFooter = (rowN: number, label: string, val: number | string, bg: string, fg: string, fmt = '"R$" #,##0.00') => {
    const row = ws.getRow(rowN);
    row.height = 20;
    for (let c = 1; c <= 8; c++) {
      const cell = row.getCell(c);
      cell.fill   = fill(bg);
      cell.border = border("thin");
    }
    const lCell = row.getCell(9);
    lCell.value = label;
    lCell.font  = font({ bold: true, size: 10, color: fg });
    lCell.fill  = fill(bg);
    lCell.alignment = { horizontal: "right", vertical: "middle" };
    lCell.border = border("thin");
    const vCell = row.getCell(10);
    vCell.value  = val;
    if (typeof val === "number") vCell.numFmt = fmt;
    vCell.font   = font({ bold: true, size: 11, color: fg });
    vCell.fill   = fill(bg);
    vCell.alignment = { horizontal: "right", vertical: "middle" };
    vCell.border = border("medium");
  };
  addFooter(footerRow,     "BRUTO TOTAL",      totalBruto,                "ECFDF5", "059669");
  addFooter(footerRow + 1, "DESCONTOS",        -totalDesconto,            "FFF1F2", "E11D48");
  addFooter(footerRow + 2, "TAXAS MAQUININHA", -totalTaxa,                "FFFBEB", "D97706");
  addFooter(footerRow + 3, "LÍQUIDO RECEBIDO", totalLiquido,              "D1FAE5", "059669");
  addFooter(footerRow + 4, "PEDIDOS CANCELADOS", orders.filter(o => o.status === "cancelled").length, "FEE2E2", "DC2626", "0");

  // Download
  const buf  = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `Pedidos_${new Date().toLocaleDateString("pt-BR").replace(/\//g, "-")}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Orders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [tenant, setTenant] = useState<TenantBasic | null>(null);
  const [printerSize, setPrinterSize] = useState<"58mm" | "80mm" | "A4">("58mm");
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<OrderDetail | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelledBy, setCancelledBy] = useState("");
  const [cancelling, setCancelling] = useState(false);

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Date filter — default: first → last day of current month
  const todayStr = () => new Date().toISOString().slice(0, 10);
  const firstOfMonthStr = (d = new Date()) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  const lastOfMonthStr = (d = new Date()) => {
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, "0")}-${String(last.getDate()).padStart(2, "0")}`;
  };
  const [dateFrom, setDateFrom] = useState(firstOfMonthStr());
  const [dateTo,   setDateTo]   = useState(lastOfMonthStr());

  // Sort
  type SortField = "id" | "date" | "total";
  type SortDir = "asc" | "desc";
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir,   setSortDir]   = useState<SortDir>("desc");

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("desc"); }
  };

  // Pagination
  const PAGE_SIZE = 15;
  const [currentPage, setCurrentPage] = useState(1);

  const token = () => localStorage.getItem("token");

  const fetchOrders = async () => {
    try {
      const res = await fetch("/api/orders", {
        headers: { Authorization: `Bearer ${token()}` },
      });
      const data = await res.json();
      setOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTopSelling = async () => {
    try {
      const res = await fetch("/api/stats/top-selling", {
        headers: { Authorization: `Bearer ${token()}` },
      });
      setTopProducts(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => { setCurrentPage(1); }, [selectedStatus, searchTerm, dateFrom, dateTo, sortField, sortDir]);

  useEffect(() => {
    fetchOrders();
    fetchTopSelling();
    fetch("/api/tenant", { headers: { Authorization: `Bearer ${token()}` } })
      .then((r) => r.json())
      .then((d) => setTenant(d))
      .catch(() => {});
    fetch("/api/preferences/receipt_printer_size", {
      headers: { Authorization: `Bearer ${token()}` },
    })
      .then((r) => r.json())
      .then((v) => {
        if (v) setPrinterSize(v as "58mm" | "80mm" | "A4");
      })
      .catch(() => {});
  }, []);

  const fetchOrderDetails = async (id: number) => {
    try {
      const res = await fetch(`/api/orders/${id}`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      const data = await res.json();
      setSelectedOrder(data);
      setIsDetailModalOpen(true);
    } catch (err) {
      console.error(err);
    }
  };

  // ── Bulk selection helpers ──────────────────────────────────────────────────

  const filteredOrders = orders.filter((o) => {
    if (selectedStatus !== "all" && o.status !== selectedStatus) return false;
    // Convert to local date string to avoid UTC offset shifting the day
    const d = new Date(o.created_at);
    const oDate = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
    if (dateFrom && oDate < dateFrom) return false;
    if (dateTo   && oDate > dateTo)   return false;
    if (searchTerm === "") return true;
    const q = searchTerm.replace(/^#/, "").toLowerCase().trim();
    return (
      String(o.id).padStart(6, "0").includes(q) ||
      String(o.id).includes(q) ||
      (o.customer_name?.toLowerCase().includes(q) ?? false) ||
      (o.customer_phone?.toLowerCase().includes(q) ?? false) ||
      (o.payment_method?.toLowerCase().includes(q) ?? false)
    );
  });

  const sortedOrders = [...filteredOrders].sort((a, b) => {
    let cmp = 0;
    if (sortField === "id")    cmp = a.id - b.id;
    if (sortField === "date")  cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    if (sortField === "total") cmp = Number(a.total_amount) - Number(b.total_amount);
    return sortDir === "asc" ? cmp : -cmp;
  });

  const totalPages = Math.max(1, Math.ceil(sortedOrders.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pagedOrders = sortedOrders.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const goToPage = (p: number) => setCurrentPage(Math.max(1, Math.min(p, totalPages)));

  const allFilteredSelected =
    sortedOrders.length > 0 &&
    sortedOrders.every((o) => selectedIds.has(o.id));

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        sortedOrders.forEach((o) => next.delete(o.id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        sortedOrders.forEach((o) => next.add(o.id));
        return next;
      });
    }
  };

  const toggleSelect = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  // ── Delete handlers ─────────────────────────────────────────────────────────

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/orders/bulk", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token()}`,
        },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      if (res.ok) {
        setShowDeleteModal(false);
        clearSelection();
        fetchOrders();
      }
    } catch (err) {
      console.error(err);
    }
    setDeleting(false);
  };

  const handleDeleteSingle = async (id: number) => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/orders/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (res.ok) {
        setShowDeleteModal(false);
        setIsDetailModalOpen(false);
        setSelectedOrder(null);
        fetchOrders();
      }
    } catch (err) {
      console.error(err);
    }
    setDeleting(false);
  };

  // ── Warranty / Receipt builders (unchanged) ─────────────────────────────────

  const buildWarrantyHtml = (order: OrderDetail) => {
    const storeName = tenant?.name ?? "Estabelecimento";
    const storeDoc = tenant?.document ? `CPF/CNPJ: ${tenant.document}` : "";
    const storeAddr = (() => {
      if (tenant?.address_street) {
        const parts = [
          `${tenant.address_street}${tenant.address_number ? ", " + tenant.address_number : ""}`,
          tenant.address_complement,
          tenant.address_district,
          tenant.address_city && tenant.address_state
            ? `${tenant.address_city} - ${tenant.address_state}`
            : tenant?.address_city ?? tenant?.address_state ?? "",
          tenant?.address_zip,
        ].filter(Boolean);
        return parts.join(", ");
      }
      return tenant?.address ?? "";
    })();
    const storePhone = tenant?.whatsapp ? `WhatsApp: ${tenant.whatsapp}` : "";
    const rawLogo = tenant?.logo_url ?? "";
    const storeLogo =
      rawLogo && !rawLogo.startsWith("http")
        ? `${window.location.origin}${rawLogo}`
        : rawLogo;

    const wp = tenant?.policies ?? {};
    const warrantyDays = wp.warranty_days ?? 90;
    const resolutionDays = wp.warranty_resolution_days ?? 30;
    const warrantyTitle = wp.warranty_title ?? "Termos e Condições de Garantia";
    const defaultClauses = [
      `A garantia cobre defeitos de fabricação pelo período de <strong>${warrantyDays} dias</strong> a partir da data de emissão deste termo, conforme art. 26 do Código de Defesa do Consumidor (Lei 8.078/90).`,
      "Para acionar a garantia, o cliente deverá apresentar este documento juntamente com comprovante de compra e identificação pessoal.",
      "A garantia não cobre danos causados por uso inadequado, queda, umidade, mau uso, tentativa de conserto por terceiros não autorizados ou desgaste natural do produto.",
      "O produto defeituoso será reparado, substituído por outro de mesma espécie, ou o valor será devolvido, a critério do fornecedor e conforme disponibilidade de estoque.",
      `O prazo para atendimento e resolução é de até <strong>${resolutionDays} dias corridos</strong> após o acionamento da garantia.`,
      "Esta garantia é intransferível e válida somente para o comprador original identificado neste documento.",
    ];
    const rawClauses = wp.warranty_clauses ?? [];
    const clauses =
      rawClauses.length > 0
        ? rawClauses.map((c) =>
            c
              .replace(/\{\{warranty_days\}\}/g, String(warrantyDays))
              .replace(/\{\{resolution_days\}\}/g, String(resolutionDays))
          )
        : defaultClauses;
    const warrantyClausesHtml = clauses
      .map((c) => `<div class="warranty-item">${c}</div>`)
      .join("\n  ");

    const orderNum = String(order.id).padStart(6, "0");
    const orderDate = new Date(order.created_at).toLocaleDateString("pt-BR");
    const clientName = order.customer_name || "Consumidor Final";
    const clientPhone = order.customer_phone || "";

    const itemsHtml = order.items
      .map(
        (item) => `
      <tr>
        <td style="padding:8px 10px;border-bottom:1px solid #f0f0f0">${item.product_name}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #f0f0f0;text-align:center">${item.quantity}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #f0f0f0;text-align:right">R$ ${Number(item.unit_price).toFixed(2)}</td>
      </tr>`
      )
      .join("");

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8"/>
<title>Termo de Garantia — Pedido #${orderNum}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 12px; color: #1a1a1a; background: #fff; padding: 40px 48px; max-width: 794px; margin: 0 auto; }
  .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 3px solid #1a1a1a; padding-bottom: 18px; margin-bottom: 24px; }
  .logo { width: 80px; height: 80px; object-fit: contain; }
  .logo-placeholder { width: 80px; height: 80px; background: #f5f5f5; border: 1px solid #ddd; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 9px; color: #aaa; text-align: center; }
  .store-info { text-align: right; }
  .store-name { font-size: 18px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; }
  .store-meta { font-size: 10px; color: #555; margin-top: 3px; line-height: 1.7; }
  .title-block { text-align: center; margin: 20px 0 28px; }
  .title-block h1 { font-size: 20px; font-weight: 900; text-transform: uppercase; letter-spacing: 3px; border: 3px solid #1a1a1a; display: inline-block; padding: 8px 28px; }
  .section { margin-bottom: 22px; }
  .section-label { font-size: 9px; font-weight: 900; text-transform: uppercase; letter-spacing: 2px; color: #555; margin-bottom: 8px; border-left: 3px solid #1a1a1a; padding-left: 8px; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 20px; }
  .info-row { font-size: 11px; }
  .info-row span { font-weight: 700; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  thead tr { background: #1a1a1a; color: #fff; }
  thead th { padding: 8px 10px; text-align: left; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }
  thead th:last-child { text-align: right; }
  thead th:nth-child(2) { text-align: center; }
  .total-row td { padding: 10px; font-weight: 900; font-size: 13px; border-top: 2px solid #1a1a1a; }
  .warranty-box { border: 2px solid #1a1a1a; border-radius: 4px; padding: 16px 18px; margin: 20px 0; font-size: 11px; line-height: 1.8; background: #fafafa; }
  .warranty-box strong { font-size: 12px; display: block; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px; }
  .warranty-item { margin-bottom: 6px; padding-left: 14px; position: relative; }
  .warranty-item::before { content: "✓"; position: absolute; left: 0; font-weight: 900; }
  .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 48px; }
  .sig-block { border-top: 1px solid #1a1a1a; padding-top: 8px; text-align: center; font-size: 10px; color: #555; }
  .footer { text-align: center; font-size: 9px; color: #aaa; margin-top: 36px; border-top: 1px dashed #ddd; padding-top: 14px; line-height: 1.8; }
  @media print { @page { margin: 20mm; size: A4; } body { padding: 0; } }
</style>
</head>
<body>

<div class="header">
  ${
    storeLogo
      ? `<img src="${storeLogo}" class="logo" alt="Logo"/>`
      : `<div class="logo-placeholder">LOGO</div>`
  }
  <div class="store-info">
    <div class="store-name">${storeName}</div>
    <div class="store-meta">
      ${storeDoc ? storeDoc + "<br/>" : ""}
      ${storeAddr ? storeAddr + "<br/>" : ""}
      ${storePhone ? storePhone : ""}
    </div>
  </div>
</div>

<div class="title-block">
  <h1>Termo de Garantia</h1>
</div>

<div class="section">
  <div class="section-label">Dados do Pedido</div>
  <div class="info-grid">
    <div class="info-row">Nº do Pedido: <span>#${orderNum}</span></div>
    <div class="info-row">Data de Emissão: <span>${orderDate}</span></div>
    <div class="info-row">Cliente: <span>${clientName}</span></div>
    ${clientPhone ? `<div class="info-row">Contato: <span>${clientPhone}</span></div>` : ""}
    <div class="info-row">Pagamento: <span>${order.payment_method || "—"}</span></div>
    <div class="info-row">Valor Total: <span>R$ ${Number(order.total_amount).toFixed(2)}</span></div>
  </div>
</div>

<div class="section">
  <div class="section-label">Produtos Cobertos</div>
  <table>
    <thead>
      <tr>
        <th>Produto</th>
        <th style="text-align:center">Qtd</th>
        <th style="text-align:right">Valor Unit.</th>
      </tr>
    </thead>
    <tbody>
      ${itemsHtml}
    </tbody>
    <tfoot>
      <tr class="total-row">
        <td colspan="2">TOTAL</td>
        <td style="text-align:right">R$ ${Number(order.total_amount).toFixed(2)}</td>
      </tr>
    </tfoot>
  </table>
</div>

<div class="warranty-box">
  <strong>${warrantyTitle}</strong>
  ${warrantyClausesHtml}
</div>

<div class="signatures">
  <div class="sig-block">
    <br/><br/>
    ${storeName}<br/>Vendedor / Estabelecimento
  </div>
  <div class="sig-block">
    <br/><br/>
    ${clientName}<br/>Cliente / Comprador
  </div>
</div>

<div class="footer">
  Documento emitido em ${new Date().toLocaleString("pt-BR")} &nbsp;|&nbsp; ${storeName}
  ${storeDoc ? "&nbsp;|&nbsp; " + storeDoc : ""}
  <br/>Este termo é válido como comprovante de garantia nos termos da Lei Federal 8.078/1990 (Código de Defesa do Consumidor).
</div>

</body>
</html>`;
  };

  const buildReceiptHtml = (order: OrderDetail) => {
    const storeName = tenant?.name ?? "Estabelecimento";
    const storeDoc = tenant?.document ? `CNPJ/CPF: ${tenant.document}` : "";
    const storePhone = tenant?.whatsapp ? `Tel/WhatsApp: ${tenant.whatsapp}` : "";
    const storeAddr = (() => {
      if (tenant?.address_street) {
        const parts = [
          `${tenant.address_street}${tenant.address_number ? ", " + tenant.address_number : ""}`,
          tenant.address_complement,
          tenant.address_district,
          tenant.address_city && tenant.address_state
            ? `${tenant.address_city} - ${tenant.address_state}`
            : tenant?.address_city ?? tenant?.address_state ?? "",
          tenant.address_zip ? `CEP: ${tenant.address_zip}` : "",
        ].filter(Boolean);
        return parts.join(" | ");
      }
      return tenant?.address ?? "";
    })();

    const statusLabel =
      order.status === "completed"
        ? "PAGO"
        : order.status === "pending"
        ? "PENDENTE"
        : "CANCELADO";

    const parsePayments = (raw?: string) => {
      if (!raw) return [{ label: "Não informado", amount: "" }];
      return raw.split("|").map((seg) => {
        const parts = seg.trim().split(":");
        const method = parts[0]?.toLowerCase() ?? "";
        const amount = parts[1] ? `R$ ${Number(parts[1]).toFixed(2)}` : "";
        const installments = parts[2] ? Number(parts[2]) : 1;
        const brand = parts[3] ?? "";
        let label = "";
        if (method === "money" || method === "dinheiro") {
          label = "Dinheiro";
        } else if (method === "pix") {
          label = "PIX";
        } else if (method === "debit" || method === "debito") {
          label = brand ? `Débito (${brand})` : "Cartão de Débito";
        } else if (method === "credit" || method === "credito") {
          label =
            installments > 1
              ? `Crédito ${brand ? "(" + brand + ") " : ""}– ${installments}x de R$ ${(Number(parts[1]) / installments).toFixed(2)}`
              : brand
              ? `Crédito (${brand})`
              : "Cartão de Crédito";
        } else {
          label = method.charAt(0).toUpperCase() + method.slice(1);
        }
        return { label, amount };
      });
    };

    const payments = parsePayments(order.payment_method);
    const hasDiscount = order.discount_amount && Number(order.discount_amount) > 0;
    const hasFee = order.fee_amount && Number(order.fee_amount) > 0;
    const grossAmount = order.gross_amount
      ? Number(order.gross_amount)
      : Number(order.total_amount);

    return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=${printerSize === "A4" ? "device-width" : printerSize},initial-scale=1">
<title>Comprovante #${String(order.id).padStart(5, "0")}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: ${printerSize === "A4" ? "100%" : printerSize}; background: #fff; color: #000; }
  body {
    font-family: 'Courier New', Courier, monospace;
    font-size: ${printerSize === "A4" ? "11pt" : printerSize === "80mm" ? "10pt" : "9pt"};
    padding: ${printerSize === "A4" ? "0" : "3mm 3mm 6mm"};
    line-height: 1.35;
  }
  .center  { text-align: center; }
  .bold    { font-weight: bold; }
  .small   { font-size: 9pt; }
  .xsmall  { font-size: 8pt; color: #555; }
  .divider { border: none; border-top: 1px dashed #000; margin: 4mm 0; }
  .solid   { border-top-style: solid; }
  .store-name { font-size: 11pt; font-weight: bold; text-align: center; text-transform: uppercase; letter-spacing: 0.5px; }
  .store-info { font-size: 7pt; text-align: center; color: #222; line-height: 1.6; margin-top: 1mm; }
  .doc-title { font-size: 10pt; font-weight: bold; text-align: center; text-transform: uppercase; letter-spacing: 1.5px; margin: 2mm 0 1mm; }
  .doc-sub   { font-size: 7.5pt; text-align: center; color: #555; }
  .status-wrap { text-align: center; margin: 1.5mm 0 1mm; }
  .status-box  { display: inline-block; font-weight: bold; font-size: 9pt; padding: 0.5mm 4mm; border: 1.5px solid #000; letter-spacing: 2px; }
  .section { font-size: 7.5pt; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 1mm; }
  .row      { display: table; width: 100%; margin: 0.8mm 0; font-size: 8pt; }
  .row .lbl { display: table-cell; color: #444; white-space: nowrap; padding-right: 2mm; }
  .row .val { display: table-cell; text-align: right; font-weight: bold; }
  .item       { margin: 1.5mm 0; }
  .item-line  { display: table; width: 100%; }
  .item-name  { display: table-cell; font-weight: bold; font-size: 8.5pt; padding-right: 2mm; word-break: break-word; }
  .item-price { display: table-cell; text-align: right; font-weight: bold; font-size: 8.5pt; white-space: nowrap; }
  .item-qty   { font-size: 7pt; color: #555; padding-top: 0.3mm; }
  .subtotal-row { display: table; width: 100%; font-size: 8pt; margin: 0.8mm 0; }
  .subtotal-row .lbl { display: table-cell; color: #555; }
  .subtotal-row .val { display: table-cell; text-align: right; }
  .total-line { display: table; width: 100%; margin: 1.5mm 0 0; border-top: 1.5px solid #000; padding-top: 1.5mm; }
  .total-lbl  { display: table-cell; font-size: 12pt; font-weight: bold; }
  .total-val  { display: table-cell; text-align: right; font-size: 12pt; font-weight: bold; }
  .pay-row      { display: table; width: 100%; margin: 1mm 0; font-size: 8pt; }
  .pay-label    { display: table-cell; }
  .pay-amount   { display: table-cell; text-align: right; font-weight: bold; }
  .footer { text-align: center; font-size: 7pt; color: #555; margin-top: 4mm; line-height: 1.7; }
  .footer .thanks { font-size: 9pt; font-weight: bold; color: #000; display: block; margin-bottom: 1mm; }
  @media print {
    @page { size: ${printerSize === "A4" ? "A4" : printerSize + " auto"}; margin: ${printerSize === "A4" ? "15mm 12mm" : "2mm 2mm"}; }
    html, body { width: ${printerSize === "A4" ? "100%" : printerSize}; }
  }
</style></head><body>

<div class="store-name">${storeName}</div>
<div class="store-info">
  ${storeDoc ? storeDoc + "<br>" : ""}${storeAddr ? storeAddr + "<br>" : ""}${storePhone || ""}
</div>

<hr class="divider"/>

<div class="doc-title">Comprovante de Venda</div>
<div class="doc-sub">Pedido #${String(order.id).padStart(5, "0")} &nbsp;|&nbsp; ${new Date(order.created_at).toLocaleString("pt-BR")}</div>
<div class="status-wrap"><span class="status-box">${statusLabel}</span></div>

<hr class="divider"/>

<div class="section">Cliente</div>
<div class="row"><span class="lbl">Nome:</span><span class="val">${order.customer_name || "Consumidor Final"}</span></div>
${order.customer_phone ? `<div class="row"><span class="lbl">Telefone:</span><span class="val">${order.customer_phone}</span></div>` : ""}
${order.customer_address ? `<div class="row"><span class="lbl">Endereço:</span><span class="val">${order.customer_address}</span></div>` : ""}
${order.seller_name ? `<div class="row"><span class="lbl">Vendedor:</span><span class="val">${order.seller_name}</span></div>` : ""}

<hr class="divider"/>

<div class="section">Itens do Pedido</div>
${order.items
  .map(
    (item) => `<div class="item">
  <div class="item-line">
    <span class="item-name">${item.product_name}</span>
    <span class="item-price">R$ ${(item.quantity * Number(item.unit_price)).toFixed(2)}</span>
  </div>
  <div class="item-qty">${item.quantity} un &times; R$ ${Number(item.unit_price).toFixed(2)}</div>
</div>`
  )
  .join("")}

<hr class="divider"/>

${
  hasDiscount || hasFee
    ? `
<div class="subtotal-row"><span class="lbl">Subtotal</span><span class="val">R$ ${grossAmount.toFixed(2)}</span></div>
${hasDiscount ? `<div class="subtotal-row"><span class="lbl">Desconto</span><span class="val">- R$ ${Number(order.discount_amount).toFixed(2)}</span></div>` : ""}
${hasFee ? `<div class="subtotal-row"><span class="lbl">Acréscimo</span><span class="val">+ R$ ${Number(order.fee_amount).toFixed(2)}</span></div>` : ""}
`
    : ""
}
<div class="total-line">
  <span class="total-lbl">TOTAL</span>
  <span class="total-val">R$ ${Number(order.total_amount).toFixed(2)}</span>
</div>

<hr class="divider"/>

<div class="section">Pagamento</div>
${payments
  .map(
    (p) => `<div class="pay-row">
  <span class="pay-label">${p.label}</span>
  <span class="pay-amount">${p.amount}</span>
</div>`
  )
  .join("")}

<div class="footer">
  <span class="thanks">Obrigado pela preferência!</span>
  Emitido em ${new Date().toLocaleString("pt-BR")}<br>
  Este documento não tem valor fiscal.
</div>
</body></html>`;
  };

  const handlePrintReceipt = () => {
    if (!selectedOrder) return;
    const html = buildReceiptHtml(selectedOrder);
    const iframe = document.createElement("iframe");
    iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:none";
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return;
    doc.open();
    doc.write(html);
    doc.close();
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => document.body.removeChild(iframe), 1000);
    }, 400);
  };

  const handleDownloadReceipt = () => {
    if (!selectedOrder) return;
    const html = buildReceiptHtml(selectedOrder);
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `comprovante-pedido-${String(selectedOrder.id).padStart(6, "0")}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadWarranty = () => {
    if (!selectedOrder) return;
    const html = buildWarrantyHtml(selectedOrder);
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `garantia-pedido-${String(selectedOrder.id).padStart(6, "0")}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrintWarranty = () => {
    if (!selectedOrder) return;
    const html = buildWarrantyHtml(selectedOrder);
    const win = window.open("", "_blank", "width=850,height=1100");
    if (!win) return;
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.onload = () => {
      win.focus();
      win.print();
    };
  };

  const handleUpdateStatus = async (id: number, status: string) => {
    try {
      const res = await fetch(`/api/orders/${id}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token()}`,
        },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setIsDetailModalOpen(false);
        fetchOrders();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCancelOrder = async () => {
    if (!selectedOrder) return;
    setCancelling(true);
    try {
      const res = await fetch(`/api/orders/${selectedOrder.id}/cancel`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token()}`,
        },
        body: JSON.stringify({ cancel_reason: cancelReason, cancelled_by: cancelledBy }),
      });
      if (res.ok) {
        setShowCancelModal(false);
        setIsDetailModalOpen(false);
        setCancelReason("");
        setCancelledBy("");
        fetchOrders();
      }
    } catch (err) {
      console.error(err);
    }
    setCancelling(false);
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-emerald-50 text-emerald-600 border-emerald-100";
      case "pending":
        return "bg-amber-50 text-amber-600 border-amber-100";
      case "cancelled":
        return "bg-red-50 text-red-600 border-red-100";
      default:
        return "bg-gray-50 text-gray-600 border-gray-100";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 size={14} />;
      case "pending":
        return <Clock size={14} />;
      case "cancelled":
        return <XCircle size={14} />;
      default:
        return null;
    }
  };

  if (loading)
    return (
      <div className="p-8 text-center text-xs font-bold uppercase tracking-widest text-slate-400">
        Puxando Fluxo de Pedidos...
      </div>
    );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pedidos"
        subtitle="Gestão e acompanhamento de vendas"
        action={
          <button
            onClick={async () => {
              setExporting(true);
              try { await exportOrdersToExcel(filteredOrders, tenant?.name ?? "BoxSys Store"); }
              finally { setExporting(false); }
            }}
            disabled={exporting || sortedOrders.length === 0}
            className="h-9 bg-white border border-slate-200 px-4 rounded-xl flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest hover:bg-slate-50 transition-all text-slate-600 shadow-sm disabled:opacity-40">
            {exporting ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />} Exportar
          </button>
        }
      />

      {/* Analytics Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
        <div className="md:col-span-2 bg-white rounded-[32px] border border-slate-200 p-6 lg:p-8 shadow-sm flex flex-col justify-between overflow-hidden relative group">
          <div className="absolute right-0 top-0 p-8 text-slate-50 opacity-10 group-hover:opacity-20 transition-opacity hidden sm:block">
            <TrendingUp size={120} strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6">
              Resumo de Pedidos
            </p>
            <div className="grid grid-cols-3 gap-4 sm:gap-12">
              <div className="space-y-1">
                <h3 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tighter">
                  {filteredOrders.length}
                </h3>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  Total
                </p>
              </div>
              <div className="space-y-1">
                <h3 className="text-2xl sm:text-4xl font-black text-amber-500 tracking-tighter">
                  {filteredOrders.filter((o) => o.status === "pending").length}
                </h3>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  Pendente
                </p>
              </div>
              <div className="space-y-1">
                <h3 className="text-2xl sm:text-4xl font-black text-emerald-500 tracking-tighter">
                  {filteredOrders.filter((o) => o.status === "completed").length}
                </h3>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  Pago
                </p>
              </div>
            </div>
          </div>
          <div className="mt-8 flex flex-wrap gap-2">
            {["all", "pending", "completed", "cancelled"].map((status) => (
              <button
                key={status}
                onClick={() => setSelectedStatus(status)}
                className={cn(
                  "px-4 h-9 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border shrink-0",
                  selectedStatus === status
                    ? "bg-slate-900 text-white border-slate-900 shadow-xl shadow-slate-200"
                    : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                )}
              >
                {status === "all"
                  ? "Tudo"
                  : status === "pending"
                  ? "Pendentes"
                  : status === "completed"
                  ? "Efetivados"
                  : "Cancelados"}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-slate-900 rounded-[32px] p-6 lg:p-8 text-white shadow-2xl shadow-slate-200 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-6">
              <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em]">
                Mais Vendidos
              </p>
              <CartIcon size={16} className="text-blue-400" />
            </div>
            <div className="space-y-4">
              {topProducts.map((p, i) => (
                <div key={i} className="flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <span className="text-[8px] font-black text-slate-500 w-4">0{i + 1}</span>
                    <span className="text-[11px] font-bold uppercase truncate max-w-[120px] text-slate-300 group-hover:text-white transition-colors">
                      {p.name}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono font-black text-blue-400 px-2.5 py-1 rounded-lg bg-blue-400/10 leading-none">
                    {p.total_sold} UN
                  </span>
                </div>
              ))}
              {topProducts.length === 0 && (
                <p className="text-[10px] text-slate-600 py-6 uppercase font-black tracking-widest text-center border border-dashed border-slate-800 rounded-2xl">
                  Nenhuma venda ainda
                </p>
              )}
            </div>
          </div>
          <button
            onClick={() => navigate("/admin/analytics")}
            className="mt-8 w-full h-10 bg-white/5 hover:bg-white/10 text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border border-white/10">
            Ver Relatório
          </button>
        </div>
      </div>

      {/* Search + Date filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
          <input
            type="text"
            placeholder="Buscar por ID, cliente, telefone..."
            className="w-full pl-11 pr-4 h-10 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-400 text-[11px] font-medium placeholder:text-slate-300 shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Date range */}
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 h-10 shadow-sm shrink-0">
          <Calendar size={14} className="text-slate-400 shrink-0" />
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="text-[11px] font-medium text-slate-700 outline-none bg-transparent cursor-pointer w-[110px]"
            title="De"
          />
          <span className="text-slate-300 font-bold text-[11px] shrink-0">—</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="text-[11px] font-medium text-slate-700 outline-none bg-transparent cursor-pointer w-[110px]"
            title="Até"
          />
        </div>

        {/* Quick presets */}
        <div className="flex items-center gap-1 shrink-0">
          {[
            { label: "Hoje", from: todayStr(),        to: todayStr() },
            { label: "7d",   from: (() => { const d = new Date(); d.setDate(d.getDate() - 6); return d.toISOString().slice(0,10); })(), to: todayStr() },
            { label: "Mês",  from: firstOfMonthStr(), to: lastOfMonthStr() },
            { label: "Tudo", from: "",                to: "" },
          ].map((p) => {
            const active = dateFrom === p.from && dateTo === p.to;
            return (
              <button
                key={p.label}
                onClick={() => { setDateFrom(p.from); setDateTo(p.to); }}
                className={cn(
                  "h-10 px-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border shrink-0",
                  active
                    ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                    : "bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                )}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Bulk action bar */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="flex items-center justify-between bg-slate-900 text-white rounded-2xl px-5 py-3 shadow-xl shadow-slate-900/20"
          >
            <div className="flex items-center gap-3">
              <CheckSquare size={16} className="text-blue-400" />
              <span className="text-[11px] font-black uppercase tracking-widest">
                {selectedIds.size} pedido{selectedIds.size !== 1 ? "s" : ""} selecionado
                {selectedIds.size !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={clearSelection}
                className="h-8 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-[10px] font-black uppercase tracking-widest transition-all"
              >
                Limpar
              </button>
              <button
                onClick={() => setShowDeleteModal(true)}
                className="h-8 px-4 rounded-xl bg-red-500 hover:bg-red-600 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all shadow-lg shadow-red-500/30"
              >
                <Trash2 size={13} /> Deletar
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Desktop Table */}
      <div className="hidden lg:block bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-3 py-2.5 w-9">
                  <input type="checkbox" checked={allFilteredSelected} onChange={toggleSelectAll}
                    className="w-3.5 h-3.5 rounded accent-slate-900 cursor-pointer" />
                </th>
                <th className="px-3 py-2.5 w-24">
                  <button onClick={() => toggleSort("id")} className="flex items-center gap-1 text-[9px] font-black text-slate-400 uppercase tracking-[0.18em] hover:text-slate-700 transition-colors">
                    Pedido {sortField === "id" ? (sortDir === "asc" ? <ArrowUp size={10} /> : <ArrowDown size={10} />) : <ArrowUpDown size={10} className="opacity-30" />}
                  </button>
                </th>
                <th className="px-3 py-2.5 text-[9px] font-black text-slate-400 uppercase tracking-[0.18em]">Cliente</th>
                <th className="px-3 py-2.5 text-[9px] font-black text-slate-400 uppercase tracking-[0.18em]">Pagamento</th>
                <th className="px-3 py-2.5 w-28">
                  <button onClick={() => toggleSort("date")} className="flex items-center gap-1 text-[9px] font-black text-slate-400 uppercase tracking-[0.18em] hover:text-slate-700 transition-colors">
                    Data {sortField === "date" ? (sortDir === "asc" ? <ArrowUp size={10} /> : <ArrowDown size={10} />) : <ArrowUpDown size={10} className="opacity-30" />}
                  </button>
                </th>
                <th className="px-3 py-2.5 w-32 text-right">
                  <button onClick={() => toggleSort("total")} className="flex items-center gap-1 text-[9px] font-black text-slate-400 uppercase tracking-[0.18em] hover:text-slate-700 transition-colors ml-auto">
                    Total {sortField === "total" ? (sortDir === "asc" ? <ArrowUp size={10} /> : <ArrowDown size={10} />) : <ArrowUpDown size={10} className="opacity-30" />}
                  </button>
                </th>
                <th className="px-3 py-2.5 text-[9px] font-black text-slate-400 uppercase tracking-[0.18em] text-center w-28">Status</th>
                <th className="px-3 py-2.5 w-20 text-[9px] font-black text-slate-400 uppercase tracking-[0.18em] text-center">Ações</th>
              </tr>
            </thead>
            <tbody>
              {pagedOrders.map((order) => {
                const isChecked = selectedIds.has(order.id);
                const pm = order.payment_method || "";
                const pmDot: Record<string, string> = { money: "bg-slate-400", pix: "bg-violet-500", debit: "bg-blue-500", credit: "bg-emerald-500" };
                const pmBadge: Record<string, string> = { money: "bg-slate-100 text-slate-600", pix: "bg-violet-50 text-violet-700", debit: "bg-blue-50 text-blue-700", credit: "bg-emerald-50 text-emerald-700" };
                const pmLabel: Record<string, string> = { money: "Dinheiro", pix: "PIX", debit: "Débito", credit: "Crédito" };
                const segs = pm ? pm.split("|").map(seg => {
                  const method = seg.split(":")[0].split("-")[0];
                  return { method, label: pmLabel[method] ?? method };
                }) : [];
                const firstMethod = segs[0]?.method ?? "money";
                const d = new Date(order.created_at);
                const dateStr = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
                const timeStr = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
                return (
                  <tr key={order.id} onClick={() => fetchOrderDetails(order.id)}
                    className={cn(
                      "border-b border-slate-50 last:border-0 cursor-pointer transition-colors duration-100",
                      isChecked ? "bg-blue-50/60 hover:bg-blue-50" : "bg-white hover:bg-slate-50/80"
                    )}>
                    {/* checkbox */}
                    <td className="px-3 py-2" onClick={(e) => toggleSelect(order.id, e)}>
                      <input type="checkbox" checked={isChecked} onChange={() => {}}
                        className="w-3.5 h-3.5 rounded accent-slate-900 cursor-pointer" />
                    </td>
                    {/* pedido */}
                    <td className="px-3 py-2">
                      <span className="font-mono font-bold text-[11px] text-blue-500">
                        #{String(order.id).padStart(6, "0")}
                      </span>
                    </td>
                    {/* cliente */}
                    <td className="px-3 py-2">
                      <p className="text-[12px] font-bold text-slate-800 leading-tight">
                        {order.customer_name || "Balcão"}
                      </p>
                      {order.seller_name && (
                        <p className="text-[10px] text-slate-400 leading-tight mt-0.5">
                          Vendedor: {order.seller_name}
                        </p>
                      )}
                    </td>
                    {/* pagamento */}
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {segs.length > 0 ? segs.map((s, i) => (
                          <span key={i} className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold", pmBadge[s.method] ?? "bg-slate-100 text-slate-600")}>
                            <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", pmDot[s.method] ?? "bg-slate-400")} />
                            {s.label}
                          </span>
                        )) : <span className="text-[10px] text-slate-400">—</span>}
                      </div>
                    </td>
                    {/* data */}
                    <td className="px-3 py-2">
                      <p className="text-[11px] font-bold text-slate-700">{dateStr}</p>
                      <p className="text-[10px] text-slate-400">{timeStr}</p>
                    </td>
                    {/* total */}
                    <td className="px-3 py-2 text-right">
                      <span className={cn(
                        "font-mono font-black text-[13px] tracking-tight",
                        order.status === "cancelled" ? "text-slate-300 line-through" : "text-slate-900"
                      )}>
                        R$ {Number(order.total_amount).toFixed(2)}
                      </span>
                    </td>
                    {/* status */}
                    <td className="px-3 py-2 text-center">
                      {order.status === "completed" && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-600 border border-emerald-100">
                          <CheckCircle2 size={10} /> Pago
                        </span>
                      )}
                      {order.status === "pending" && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-50 text-amber-600 border border-amber-100">
                          <Clock size={10} /> Pendente
                        </span>
                      )}
                      {order.status === "cancelled" && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-red-50 text-red-500 border border-red-100">
                          <XCircle size={10} /> Cancelado
                        </span>
                      )}
                    </td>
                    {/* ações — sempre visíveis */}
                    <td className="px-3 py-2">
                      <div className="flex justify-center items-center gap-1.5">
                        <button onClick={(e) => { e.stopPropagation(); setSelectedIds(new Set([order.id])); setShowDeleteModal(true); }}
                          className="w-7 h-7 rounded-lg bg-red-50 border border-red-100 text-red-400 flex items-center justify-center hover:bg-red-100 hover:text-red-600 transition-all"
                          title="Deletar">
                          <Trash2 size={12} />
                        </button>
                        <button onClick={() => fetchOrderDetails(order.id)}
                          className="w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center hover:bg-slate-700 transition-all"
                          title="Ver detalhes">
                          <ChevronRight size={14} strokeWidth={2.5} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {sortedOrders.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                    Nenhum pedido encontrado
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {sortedOrders.length > 0 && (
          <div className="px-5 py-2.5 border-t border-slate-100 flex items-center justify-between bg-slate-50/50 gap-4">
            {/* info */}
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest shrink-0">
              {sortedOrders.length} pedido{sortedOrders.length !== 1 ? "s" : ""}
              {totalPages > 1 && (
                <span className="ml-1 text-slate-300">
                  · {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, sortedOrders.length)}
                </span>
              )}
            </span>

            {/* pagination */}
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => goToPage(1)}
                  disabled={safePage === 1}
                  className="w-7 h-7 rounded-lg text-[10px] font-black text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-default flex items-center justify-center transition-all"
                  title="Primeira página">
                  «
                </button>
                <button
                  onClick={() => goToPage(safePage - 1)}
                  disabled={safePage === 1}
                  className="w-7 h-7 rounded-lg text-[10px] font-black text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-default flex items-center justify-center transition-all"
                  title="Anterior">
                  ‹
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
                  .reduce<(number | "…")[]>((acc, p, i, arr) => {
                    if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push("…");
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p, i) =>
                    p === "…" ? (
                      <span key={`e${i}`} className="w-7 h-7 flex items-center justify-center text-[10px] text-slate-300">…</span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => goToPage(p as number)}
                        className={cn(
                          "w-7 h-7 rounded-lg text-[10px] font-black transition-all",
                          safePage === p
                            ? "bg-slate-900 text-white shadow-sm"
                            : "text-slate-500 hover:bg-slate-100"
                        )}>
                        {p}
                      </button>
                    )
                  )}

                <button
                  onClick={() => goToPage(safePage + 1)}
                  disabled={safePage === totalPages}
                  className="w-7 h-7 rounded-lg text-[10px] font-black text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-default flex items-center justify-center transition-all"
                  title="Próxima">
                  ›
                </button>
                <button
                  onClick={() => goToPage(totalPages)}
                  disabled={safePage === totalPages}
                  className="w-7 h-7 rounded-lg text-[10px] font-black text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-default flex items-center justify-center transition-all"
                  title="Última página">
                  »
                </button>
              </div>
            )}

            {/* total */}
            <span className="text-[10px] font-black font-mono text-slate-600 shrink-0">
              Total: R$ {sortedOrders.reduce((a, o) => a + (o.status !== "cancelled" ? Number(o.total_amount) : 0), 0).toFixed(2)}
            </span>
          </div>
        )}
      </div>

      {/* Mobile Card-Based List */}
      <div className="lg:hidden space-y-4 pb-12">
        {pagedOrders.map((order) => {
          const isChecked = selectedIds.has(order.id);
          return (
            <motion.div
              layout
              key={order.id}
              className={cn(
                "bg-white p-5 rounded-[28px] border border-slate-200 shadow-sm transition-all",
                isChecked && "border-blue-300 ring-2 ring-blue-100"
              )}
            >
              <div className="flex justify-between items-start mb-4">
                <div
                  className="flex items-center gap-3 flex-1 cursor-pointer"
                  onClick={() => fetchOrderDetails(order.id)}
                >
                  <div className="space-y-1">
                    <span className="text-[10px] font-mono font-black text-slate-300">
                      #{String(order.id).padStart(6, "0")}
                    </span>
                    <h4 className="text-xs font-black text-slate-900 uppercase tracking-tight">
                      {order.customer_name || "Cliente Balcão"}
                    </h4>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div
                    className={cn(
                      "px-3 py-1.5 rounded-xl text-[8px] font-black uppercase tracking-widest border shadow-sm flex items-center gap-1.5",
                      getStatusStyle(order.status)
                    )}
                  >
                    {getStatusIcon(order.status)}
                    {order.status === "completed"
                      ? "PAGO"
                      : order.status === "pending"
                      ? "PEND"
                      : "CANCL"}
                  </div>
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={(e) => {
                      e.stopPropagation();
                      setSelectedIds((prev) => {
                        const next = new Set(prev);
                        if (next.has(order.id)) next.delete(order.id);
                        else next.add(order.id);
                        return next;
                      });
                    }}
                    className="w-4 h-4 rounded accent-slate-900 cursor-pointer"
                  />
                </div>
              </div>

              <div
                className="flex justify-between items-end pt-4 border-t border-slate-50 cursor-pointer"
                onClick={() => fetchOrderDetails(order.id)}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-slate-400">
                    <Clock size={10} />
                    <span className="text-[9px] font-mono font-bold uppercase">
                      {new Date(order.created_at).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-400">
                    <CreditCard size={10} />
                    <span className="text-[9px] font-black uppercase tracking-tighter">
                      {order.payment_method || "Cartão"}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                    Montante Líquido
                  </p>
                  <p className="text-xl font-mono font-black text-slate-900 tracking-tighter">
                    R$ {Number(order.total_amount).toFixed(2)}
                  </p>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Details Modal */}
      <AnimatePresence>
        {isDetailModalOpen && selectedOrder && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDetailModalOpen(false)}
              className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
            />

            {/* Panel — bottom sheet on mobile, side drawer on desktop */}
            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 30, stiffness: 280 }}
              className="fixed inset-x-0 bottom-0 z-50 flex flex-col bg-white rounded-t-[28px] shadow-2xl max-h-[92dvh]
                         sm:inset-auto sm:right-0 sm:top-0 sm:bottom-0 sm:w-[460px] sm:rounded-none sm:rounded-l-[28px] sm:max-h-full sm:border-l border-slate-200"
            >
              {/* Drag handle — mobile only */}
              <div className="sm:hidden flex justify-center pt-2.5 pb-1 shrink-0">
                <div className="w-8 h-1 rounded-full bg-slate-200" />
              </div>

              {/* ── Header ── */}
              <div className="shrink-0 px-5 pt-4 pb-3 flex items-center justify-between gap-3 border-b border-slate-100">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={cn(
                    "w-10 h-10 rounded-2xl flex items-center justify-center shrink-0",
                    selectedOrder.status === "completed" ? "bg-emerald-100" :
                    selectedOrder.status === "cancelled"  ? "bg-red-100"     : "bg-amber-100"
                  )}>
                    {selectedOrder.status === "completed" ? <CheckCircle2 size={20} className="text-emerald-600" /> :
                     selectedOrder.status === "cancelled"  ? <XCircle      size={20} className="text-red-600"     /> :
                                                             <Clock        size={20} className="text-amber-600"   />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] leading-none mb-1">Pedido</p>
                    <h4 className="text-xl font-black text-slate-900 leading-none tracking-tight">
                      #{String(selectedOrder.id).padStart(6, "0")}
                    </h4>
                  </div>
                  <span className={cn(
                    "ml-1 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border shrink-0",
                    selectedOrder.status === "completed" ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                    selectedOrder.status === "cancelled"  ? "bg-red-50 text-red-500 border-red-100"             :
                                                           "bg-amber-50 text-amber-600 border-amber-100"
                  )}>
                    {selectedOrder.status === "completed" ? <><CheckCircle2 size={9} /> Pago</> :
                     selectedOrder.status === "cancelled"  ? <><XCircle      size={9} /> Cancelado</> :
                                                             <><Clock        size={9} /> Pendente</>}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {selectedOrder.status === "pending" && (
                    <button onClick={() => handleUpdateStatus(selectedOrder.id, "completed")}
                      className="h-8 px-3 bg-emerald-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-emerald-700 active:scale-95 transition-all shadow-md shadow-emerald-200">
                      Efetivar
                    </button>
                  )}
                  {selectedOrder.status !== "cancelled" && (
                    <button onClick={() => setShowCancelModal(true)}
                      className="h-8 px-3 bg-red-50 text-red-500 border border-red-100 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-red-100 active:scale-95 transition-all">
                      Cancelar
                    </button>
                  )}
                  <button onClick={() => { setSelectedIds(new Set([selectedOrder.id])); setShowDeleteModal(true); }}
                    className="w-8 h-8 flex items-center justify-center rounded-xl bg-red-50 border border-red-100 text-red-400 hover:bg-red-100 hover:text-red-600 transition-all" title="Deletar">
                    <Trash2 size={14} />
                  </button>
                  <button onClick={() => setIsDetailModalOpen(false)}
                    className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 transition-all">
                    <X size={15} />
                  </button>
                </div>
              </div>

              {/* ── Scrollable body ── */}
              <div className="flex-1 overflow-y-auto overscroll-contain">

                {/* Hero value card */}
                <div className={cn(
                  "mx-4 mt-4 rounded-2xl px-5 py-4 flex items-center justify-between gap-4",
                  selectedOrder.status === "completed" ? "bg-emerald-600" :
                  selectedOrder.status === "cancelled"  ? "bg-slate-800"   : "bg-amber-500"
                )}>
                  <div>
                    <p className="text-[9px] font-black text-white/60 uppercase tracking-[0.2em] mb-1">
                      {selectedOrder.status === "completed" ? "Total Pago" :
                       selectedOrder.status === "cancelled"  ? "Valor Cancelado" : "Valor Pendente"}
                    </p>
                    <p className="text-3xl font-black font-mono text-white leading-none tracking-tight">
                      R$ {Number(selectedOrder.total_amount).toFixed(2)}
                    </p>
                    <p className="text-[10px] text-white/60 mt-1.5 font-medium">
                      {new Date(selectedOrder.created_at).toLocaleString("pt-BR")}
                    </p>
                  </div>
                  <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
                    {selectedOrder.status === "completed" ? <CheckCircle2 size={28} className="text-white" /> :
                     selectedOrder.status === "cancelled"  ? <XCircle      size={28} className="text-white" /> :
                                                             <Clock        size={28} className="text-white" />}
                  </div>
                </div>

                {/* Cancel reason */}
                {selectedOrder.status === "cancelled" &&
                  (selectedOrder.cancel_reason || selectedOrder.cancelled_by) && (
                    <div className="mx-4 mt-3 p-4 bg-red-50 border border-red-100 rounded-2xl">
                      <p className="text-[9px] font-black text-red-500 uppercase tracking-[0.18em] flex items-center gap-1.5 mb-2">
                        <AlertTriangle size={10} /> Motivo do Cancelamento
                      </p>
                      {selectedOrder.cancelled_by && (
                        <p className="text-[11px] font-bold text-red-700">Por: {selectedOrder.cancelled_by}</p>
                      )}
                      {selectedOrder.cancel_reason && (
                        <p className="text-[11px] text-red-600 mt-0.5">{selectedOrder.cancel_reason}</p>
                      )}
                      {selectedOrder.cancelled_at && (
                        <p className="text-[10px] text-red-400 font-mono mt-1">
                          {new Date(selectedOrder.cancelled_at).toLocaleString("pt-BR")}
                        </p>
                      )}
                    </div>
                  )}

                {/* Cliente + Vendedor */}
                <div className="mx-4 mt-3 grid grid-cols-2 gap-2">
                  <div className="bg-slate-50 rounded-2xl px-4 py-3 border border-slate-100">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.18em] mb-1.5 flex items-center gap-1">
                      <User size={9} /> Cliente
                    </p>
                    <p className="text-[13px] font-black text-slate-900 leading-tight">
                      {selectedOrder.customer_name || "Consumidor Final"}
                    </p>
                    {selectedOrder.customer_phone && (
                      <p className="text-[10px] font-mono text-slate-500 mt-0.5">{selectedOrder.customer_phone}</p>
                    )}
                  </div>
                  <div className="bg-slate-50 rounded-2xl px-4 py-3 border border-slate-100">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.18em] mb-1.5">Vendedor</p>
                    <p className="text-[13px] font-black text-slate-900 leading-tight">
                      {selectedOrder.seller_name || "—"}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {selectedOrder.seller_name ? "Responsável" : "Não atribuído"}
                    </p>
                  </div>
                </div>

                {/* Itens */}
                <div className="mx-4 mt-4">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.18em] mb-2 flex items-center gap-1.5">
                    <Package size={9} /> Itens do Pedido
                    <span className="ml-0.5 px-1.5 py-0.5 bg-slate-100 rounded-md text-slate-500">{selectedOrder.items.length}</span>
                  </p>
                  <div className="rounded-2xl border border-slate-100 overflow-hidden">
                    {selectedOrder.items.map((item, i) => (
                      <div key={item.id} className={cn(
                        "px-4 py-3 flex items-center justify-between gap-3",
                        i < selectedOrder.items.length - 1 && "border-b border-slate-50"
                      )}>
                        <div className="min-w-0 flex-1">
                          <p className="text-[12px] font-bold text-slate-800 truncate">{item.product_name}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            {item.quantity} un × R$ {Number(item.unit_price).toFixed(2)}
                          </p>
                        </div>
                        <span className="font-mono font-black text-[13px] text-slate-900 shrink-0">
                          R$ {(item.quantity * Number(item.unit_price)).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Subtotal / desconto / taxa / total */}
                {(() => {
                  const hasGross = selectedOrder.gross_amount != null && Number(selectedOrder.gross_amount) !== Number(selectedOrder.total_amount);
                  const hasDisc  = selectedOrder.discount_amount != null && Number(selectedOrder.discount_amount) > 0;
                  const hasFee   = selectedOrder.fee_amount != null && Number(selectedOrder.fee_amount) > 0;
                  if (!hasGross && !hasDisc && !hasFee) return null;
                  return (
                    <div className="mx-4 mt-2 rounded-2xl border border-slate-100 overflow-hidden">
                      {hasGross && (
                        <div className="px-4 py-2.5 flex justify-between items-center border-b border-slate-50">
                          <span className="text-[11px] font-bold text-slate-500">Subtotal</span>
                          <span className="font-mono text-[11px] font-bold text-slate-700">R$ {Number(selectedOrder.gross_amount).toFixed(2)}</span>
                        </div>
                      )}
                      {hasDisc && (
                        <div className="px-4 py-2.5 flex justify-between items-center border-b border-slate-50">
                          <span className="text-[11px] font-bold text-rose-500">Desconto</span>
                          <span className="font-mono text-[11px] font-bold text-rose-500">− R$ {Number(selectedOrder.discount_amount).toFixed(2)}</span>
                        </div>
                      )}
                      {hasFee && (
                        <div className="px-4 py-2.5 flex justify-between items-center border-b border-slate-50">
                          <span className="text-[11px] font-bold text-amber-600">Taxa Maquininha</span>
                          <span className="font-mono text-[11px] font-bold text-amber-600">+ R$ {Number(selectedOrder.fee_amount).toFixed(2)}</span>
                        </div>
                      )}
                      <div className="px-4 py-3 flex justify-between items-center bg-slate-50">
                        <span className="text-[12px] font-black text-slate-800">Total</span>
                        <span className="font-mono text-[14px] font-black text-slate-900">R$ {Number(selectedOrder.total_amount).toFixed(2)}</span>
                      </div>
                    </div>
                  );
                })()}

                {/* Pagamento */}
                {(() => {
                  const pm = selectedOrder.payment_method ?? "";
                  if (!pm) return null;
                  const segs = pm.split("|").map((seg) => {
                    const [mp, amt] = seg.split(":");
                    const toks = mp.split("-");
                    return {
                      method: toks[0] ?? "-",
                      brand: toks[1] ?? null,
                      installments: toks[2] ? parseInt(toks[2]) : 1,
                      amount: parseFloat(amt ?? "0") || 0,
                    };
                  });
                  const labels: Record<string, string> = { money: "Dinheiro", pix: "PIX", debit: "Débito", credit: "Crédito" };
                  const methodStyle: Record<string, { bg: string; icon: string }> = {
                    money: { bg: "bg-slate-100", icon: "💵" },
                    pix:   { bg: "bg-violet-50", icon: "⚡" },
                    debit: { bg: "bg-blue-50",   icon: "💳" },
                    credit:{ bg: "bg-emerald-50",icon: "💳" },
                  };
                  return (
                    <div className="mx-4 mt-4 mb-2">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.18em] mb-2 flex items-center gap-1.5">
                        <CreditCard size={9} /> Pagamento
                      </p>
                      <div className="space-y-2">
                        {segs.map((s, i) => {
                          const style = methodStyle[s.method] ?? { bg: "bg-slate-50", icon: "💰" };
                          const perInst = s.installments > 1 ? s.amount / s.installments : 0;
                          return (
                            <div key={i} className={cn("rounded-2xl px-4 py-3 flex items-center justify-between gap-3 border border-slate-100", style.bg)}>
                              <div className="flex items-center gap-3">
                                <span className="text-lg leading-none">{style.icon}</span>
                                <div>
                                  <p className="text-[12px] font-black text-slate-900 leading-tight">
                                    {labels[s.method] ?? s.method}
                                    {s.brand && s.brand !== "other" ? ` · ${s.brand.toUpperCase()}` : ""}
                                  </p>
                                  <p className="text-[10px] text-slate-500 mt-0.5">
                                    {s.method === "credit" && s.installments > 1
                                      ? `${s.installments}× de R$ ${perInst.toFixed(2)}`
                                      : "À vista"}
                                  </p>
                                </div>
                              </div>
                              <span className="font-mono font-black text-[13px] text-slate-900 shrink-0">
                                R$ {s.amount.toFixed(2)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                <div className="h-5" />
              </div>

              {/* ── Footer actions ── */}
              <div className="shrink-0 px-4 pt-3 pb-4 border-t border-slate-100 bg-white safe-area-bottom">
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <button onClick={handleDownloadReceipt}
                    className="h-11 bg-slate-100 hover:bg-slate-200 active:scale-95 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all text-slate-700">
                    <Download size={13} /> Baixar
                  </button>
                  <button onClick={handlePrintReceipt}
                    className="h-11 bg-slate-900 hover:bg-slate-700 active:scale-95 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-lg shadow-slate-900/20">
                    <Receipt size={13} /> Comprovante
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={handleDownloadWarranty}
                    className="h-11 bg-emerald-50 hover:bg-emerald-100 active:scale-95 border border-emerald-200 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all text-emerald-700">
                    <Download size={13} /> Garantia
                  </button>
                  <button onClick={handlePrintWarranty}
                    className="h-11 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/25">
                    <ShieldCheck size={13} /> Imprimir
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Cancel confirmation modal */}
      <AnimatePresence>
        {showCancelModal && selectedOrder && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center px-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden"
            >
              <div className="px-6 py-5 bg-red-50 border-b border-red-100 flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-red-100 flex items-center justify-center">
                  <AlertTriangle size={18} className="text-red-600" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest">
                    Cancelar Pedido
                  </p>
                  <p className="text-sm font-black text-red-900">
                    #{String(selectedOrder.id).padStart(6, "0")}
                  </p>
                </div>
              </div>
              <div className="p-6 space-y-4">
                <p className="text-[10px] text-slate-500 font-bold leading-relaxed">
                  Esta ação irá cancelar o pedido, reverter o estoque dos produtos e registrar um
                  estorno no fluxo de caixa.
                </p>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                    Cancelado por
                  </label>
                  <input
                    type="text"
                    value={cancelledBy}
                    onChange={(e) => setCancelledBy(e.target.value)}
                    placeholder="Nome do responsável"
                    className="w-full h-10 px-3 border border-slate-200 rounded-xl text-[11px] font-medium outline-none focus:border-red-400 bg-slate-50 transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                    Motivo do cancelamento
                  </label>
                  <textarea
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="Ex: Cliente solicitou estorno, produto com defeito..."
                    rows={3}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-[11px] font-medium outline-none focus:border-red-400 bg-slate-50 transition-all resize-none"
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => setShowCancelModal(false)}
                    className="flex-1 h-10 border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all text-slate-500"
                  >
                    Voltar
                  </button>
                  <button
                    onClick={handleCancelOrder}
                    disabled={cancelling}
                    className="flex-1 h-10 bg-red-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wide hover:bg-red-700 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 whitespace-nowrap"
                  >
                    {cancelling ? (
                      <Loader2 size={13} className="animate-spin shrink-0" />
                    ) : (
                      <XCircle size={13} className="shrink-0" />
                    )}
                    Confirmar
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete confirmation modal */}
      <AnimatePresence>
        {showDeleteModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center px-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden"
            >
              <div className="px-6 py-5 bg-red-50 border-b border-red-100 flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-red-100 flex items-center justify-center">
                  <Trash2 size={18} className="text-red-600" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest">
                    Deletar Pedido{selectedIds.size > 1 ? "s" : ""}
                  </p>
                  <p className="text-sm font-black text-red-900">
                    {selectedIds.size === 1
                      ? `#${String(Array.from(selectedIds)[0]).padStart(6, "0")}`
                      : `${selectedIds.size} pedidos selecionados`}
                  </p>
                </div>
              </div>
              <div className="p-6 space-y-4">
                <p className="text-[10px] text-slate-500 font-bold leading-relaxed">
                  Esta ação é <span className="text-red-600">permanente e irreversível</span>.{" "}
                  {selectedIds.size === 1
                    ? "O pedido será removido completamente do sistema."
                    : `Os ${selectedIds.size} pedidos selecionados serão removidos completamente do sistema.`}
                </p>
                <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex items-start gap-2.5">
                  <AlertTriangle size={14} className="text-amber-600 mt-0.5 shrink-0" />
                  <p className="text-[10px] text-amber-700 font-bold leading-relaxed">
                    Diferente do cancelamento, a deleção não reverte estoque nem gera estorno no
                    financeiro.
                  </p>
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => {
                      setShowDeleteModal(false);
                      if (!isDetailModalOpen) clearSelection();
                    }}
                    className="flex-1 h-10 border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all text-slate-500"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => {
                      if (selectedIds.size === 1 && isDetailModalOpen) {
                        handleDeleteSingle(Array.from(selectedIds)[0]);
                      } else {
                        handleBulkDelete();
                      }
                    }}
                    disabled={deleting}
                    className="flex-1 h-10 bg-red-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {deleting ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Trash2 size={14} />
                    )}
                    Confirmar Deleção
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
