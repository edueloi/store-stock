import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import ExcelJS from "exceljs";
import {
  Receipt,
  Search,
  Download,
  ChevronRight,
  Clock,
  CheckCircle2,
  XCircle,
  Package,
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
  FileText,
  RotateCcw,
  Gift,
  Plus,
  HelpCircle,
  Banknote as BanknoteIcon,
  Zap as ZapIcon,
  Wallet as WalletIcon,
} from "lucide-react";
import { Order, Product } from "../../types";
import { cn } from "../../lib/utils";
import { motion, AnimatePresence } from "motion/react";
import { downloadHtmlAsPdf } from "../../lib/pdf";
import { useToast } from "../../components/ui/Toast";
import { onRealtimeAny } from "../../lib/realtime";
import { fetchRemotePrintTerminals, requestRemotePrint, type RemotePrintTerminal } from "../../lib/remotePrint";
import { printThermalText, buildOrderReceiptText } from "../../lib/thermalReceipt";
import { buildWarrantyDocumentHtml } from "../../lib/warrantyDocument";
import { Printer } from "lucide-react";
import OrderReturnModal from "./OrderReturnModal";
import OrdersPageTour, { type OrdersPageTourHandle } from "../../components/onboarding/OrdersPageTour";
import {
  Button, IconButton, Input, Textarea, Select, Modal, ModalFooter, Alert, Badge, Tabs,
  SectionTitle, StatGrid, StatCard, ContentCard, PanelCard,
  FilterLine, FilterLineSection, FilterLineItem, FilterLineSearch, DatePicker,
} from "../../components/ui";
import { FilterPopover } from "../../components/ui/FilterPopover";

// Baixa um arquivo autenticado (Bearer token) via fetch+blob — um <a href> direto
// não envia o header Authorization e o backend responde 401.
async function downloadAuthenticated(url: string, token: string | null, filename: string) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    let message = "Falha ao baixar arquivo";
    try {
      const data = await res.json();
      if (data?.error) message = data.error;
    } catch { /* resposta sem corpo JSON */ }
    throw new Error(message);
  }
  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(blobUrl);
}

interface OrderDetail extends Order {
  items: Array<{
    id: number;
    product_name: string;
    quantity: number;
    unit_price: number;
    returned_quantity?: number;
  }>;
  services?: Array<{
    id: number;
    name: string;
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
  return_deadline_days?: number | null;
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

// Crediário/fiado registra a venda como concluída (produto já saiu, estoque já
// baixou), mas o VALOR ainda não foi recebido — vira uma AccountReceivable em
// aberto, separada do Order. Sem essa checagem, o pedido aparecia como "Pago"
// igual a uma venda em dinheiro/cartão já quitada, contradizendo a própria
// ficha do cliente ("Deve R$ X em aberto").
function isCrediarioOrder(paymentMethod?: string | null): boolean {
  return !!paymentMethod && paymentMethod.split("|").some((seg) => seg.split(":")[0]?.split("-")[0] === "crediario");
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

const ORDER_TABS = [
  { id: "resumo", label: "Resumo", icon: User },
  { id: "itens", label: "Itens", icon: Package },
  { id: "pagamento", label: "Pagamento", icon: CreditCard },
] as const;
type OrderTabId = typeof ORDER_TABS[number]["id"];

export default function Orders() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [orders, setOrders] = useState<Order[]>([]);
  const [tenant, setTenant] = useState<TenantBasic | null>(null);
  const [printerSize, setPrinterSize] = useState<"58mm" | "80mm" | "A4">("58mm");
  const [loading, setLoading] = useState(true);
  const [detailTab, setDetailTab] = useState<OrderTabId>("resumo");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [showStatusDrop, setShowStatusDrop] = useState(false);
  const [showTypeDrop, setShowTypeDrop] = useState(false);
  const statusDropRef = useRef<HTMLDivElement>(null);
  const typeDropRef   = useRef<HTMLDivElement>(null);
  const [searchTerm, setSearchTerm] = useState(() => searchParams.get("search") ?? "");
  const [selectedOrder, setSelectedOrder] = useState<OrderDetail | null>(null);
  // Espelha selectedOrder?.id em ref pra ser lido dentro do listener de realtime
  // (useEffect com deps [], closure fixa) sem precisar re-registrar o listener a
  // cada troca de pedido selecionado.
  const selectedOrderIdRef = useRef<number | null>(null);
  useEffect(() => { selectedOrderIdRef.current = selectedOrder?.id ?? null; }, [selectedOrder?.id]);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [generatingWarrantyPdf, setGeneratingWarrantyPdf] = useState(false);
  const [generatingReceiptPdf, setGeneratingReceiptPdf] = useState(false);
  const [remoteTerminals, setRemoteTerminals] = useState<RemotePrintTerminal[]>([]);
  const [remotePrintSending, setRemotePrintSending] = useState<number | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelledBy, setCancelledBy] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnResult, setReturnResult] = useState<{ credit: { id: number; amount: number } | null; creditAmount: number } | null>(null);

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteRevertStock, setDeleteRevertStock] = useState(true);
  const [deleteRevertFinance, setDeleteRevertFinance] = useState(true);
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
  const [draftStatus, setDraftStatus] = useState("all");
  const [draftType, setDraftType] = useState("all");
  const [draftFrom, setDraftFrom] = useState("");
  const [draftTo, setDraftTo] = useState("");

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
  const notify = useToast();

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

  // ── NFC-e por pedido ─────────────────────────────────────────────────────
  const [emittingNfceId, setEmittingNfceId] = useState<number | null>(null);
  // Informar CPF/CNPJ depois da venda — necessário pra habilitar "Gerar NF" em
  // pedidos de balcão feitos sem documento, sem precisar refazer a venda.
  const [documentTarget, setDocumentTarget] = useState<Order | OrderDetail | null>(null);
  const [documentInput, setDocumentInput] = useState("");
  const [savingDocument, setSavingDocument] = useState(false);

  const ordersPageTourRef = useRef<OrdersPageTourHandle>(null);

  const handleSaveDocument = async (emitAfter: boolean) => {
    if (!documentTarget) return;
    setSavingDocument(true);
    try {
      const digits = documentInput.replace(/\D/g, "");
      const res = await fetch(`/api/orders/${documentTarget.id}/document`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ customer_document: digits }),
      });
      const data = await res.json();
      if (!res.ok) { notify.error(data.error || "Não foi possível salvar o documento."); return; }
      setOrders((prev) => prev.map((o) => (o.id === documentTarget.id ? { ...o, customer_document: digits } : o)));
      setSelectedOrder((prev) => (prev && prev.id === documentTarget.id ? { ...prev, customer_document: digits } : prev));
      const orderId = documentTarget.id;
      setDocumentTarget(null);
      if (emitAfter) await handleEmitNfce(orderId);
    } catch {
      notify.error("Erro de conexão ao salvar o documento.");
    } finally {
      setSavingDocument(false);
    }
  };

  const handleEmitNfce = async (orderId: number) => {
    setEmittingNfceId(orderId);
    try {
      const res = await fetch(`/api/nfce/${orderId}/emit`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token()}` },
      });
      const data = await res.json();
      if (!res.ok) { notify.error(data.error || "Não foi possível emitir a nota fiscal."); return; }
      const nfceUpdate = { nfce_invoice: { status: data.status, access_key: data.access_key } };
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, ...nfceUpdate } : o)));
      // O modal de detalhe (selectedOrder) é um estado separado da lista — sem isso o
      // painel aberto ficava com o status antigo até fechar/reabrir ou dar F5, mesmo
      // depois da nota ser emitida (o usuário só via a mudança recarregando a página).
      setSelectedOrder((prev) => (prev && prev.id === orderId ? { ...prev, ...nfceUpdate } : prev));
      notify.success("Emissão da NFC-e iniciada — atualize a lista em alguns segundos para ver o status.");
    } catch {
      notify.error("Erro ao solicitar a emissão da nota fiscal.");
    } finally {
      setEmittingNfceId(null);
    }
  };

  const handleDownloadDanfe = (orderId: number, accessKey?: string | null) =>
    downloadAuthenticated(`/api/nfce/${orderId}/danfe`, token(), `danfe-${accessKey ?? orderId}.pdf`)
      .catch((e) => notify.error(e instanceof Error ? e.message : "Não foi possível baixar o DANFE."));

  useEffect(() => { setCurrentPage(1); }, [selectedStatus, selectedType, searchTerm, dateFrom, dateTo, sortField, sortDir]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (statusDropRef.current && !statusDropRef.current.contains(e.target as Node)) setShowStatusDrop(false);
      if (typeDropRef.current   && !typeDropRef.current.contains(e.target as Node))   setShowTypeDrop(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    fetchOrders();
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

  // Terminais desktop pareados que tenham uma impressora "receipt" — só faz sentido
  // oferecer quando esta tela não roda dentro do app desktop (que já imprime local).
  useEffect(() => {
    if (window.boxsysDesktop) return;
    const t = token();
    if (!t) return;
    fetchRemotePrintTerminals(t)
      .then((terminals) => setRemoteTerminals(terminals.filter((rt) => rt.printers.some((p) => p.role === "receipt"))))
      .catch(() => {});
  }, []);

  // Reflete na hora pedidos criados/cancelados/excluídos em outro terminal/tela.
  useEffect(() => onRealtimeAny(
    ["order:created", "order:updated", "order:cancelled", "order:deleted", "order:returned", "nfce:changed"],
    (payload) => {
      fetchOrders();
      // A emissão de NFC-e roda em background (autorização/rejeição chega depois via
      // este evento) — sem isso, o modal de detalhe aberto (selectedOrder, estado
      // separado da lista) ficava com o status antigo até fechar/reabrir ou dar F5.
      const orderId = payload?.orderId;
      if (orderId != null && selectedOrderIdRef.current === orderId) {
        fetchOrderDetails(orderId);
      }
    },
  ), []);

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
    if (selectedType !== "all") {
      const ot = (o as any).order_type ?? "products";
      if (selectedType !== ot) return false;
    }
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
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({
          ids: Array.from(selectedIds),
          revertStock: deleteRevertStock,
          revertFinance: deleteRevertFinance,
        }),
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
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({
          revertStock: deleteRevertStock,
          revertFinance: deleteRevertFinance,
        }),
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

  const buildLegacyWarrantyHtml = (order: OrderDetail) => {
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
  .store-name { font-size: 18px; font-weight: 900; text-transform: ; letter-spacing: 1px; }
  .store-meta { font-size: 10px; color: #555; margin-top: 3px; line-height: 1.7; }
  .title-block { text-align: center; margin: 20px 0 28px; }
  .title-block h1 { font-size: 20px; font-weight: 900; text-transform: ; letter-spacing: 3px; border: 3px solid #1a1a1a; display: inline-block; padding: 8px 28px; }
  .section { margin-bottom: 22px; }
  .section-label { font-size: 9px; font-weight: 900; text-transform: ; letter-spacing: 2px; color: #555; margin-bottom: 8px; border-left: 3px solid #1a1a1a; padding-left: 8px; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 20px; }
  .info-row { font-size: 11px; }
  .info-row span { font-weight: 700; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  thead tr { background: #1a1a1a; color: #fff; }
  thead th { padding: 8px 10px; text-align: left; font-size: 10px; font-weight: 700; text-transform: ; letter-spacing: 1px; }
  thead th:last-child { text-align: right; }
  thead th:nth-child(2) { text-align: center; }
  .total-row td { padding: 10px; font-weight: 900; font-size: 13px; border-top: 2px solid #1a1a1a; }
  .warranty-box { border: 2px solid #1a1a1a; border-radius: 4px; padding: 16px 18px; margin: 20px 0; font-size: 11px; line-height: 1.8; background: #fafafa; }
  .warranty-box strong { font-size: 12px; display: block; margin-bottom: 8px; text-transform: ; letter-spacing: 1px; }
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

  // Mesmo certificado enviado pelo PDV: uma única versão visual para baixar,
  // imprimir ou mandar ao cliente depois pela tela de Pedidos.
  const buildWarrantyHtml = (order: OrderDetail) => buildWarrantyDocumentHtml(tenant ?? {}, {
    ...order,
    // Pedidos podem ter produtos, serviços ou ambos. A garantia precisa listar todos
    // os itens que foram vendidos — não só as linhas do catálogo.
    items: [
      ...(order.items ?? []),
      ...(order.services ?? []).map((service) => ({
        name: service.name,
        quantity: service.quantity,
        unit_price: service.unit_price,
      })),
    ],
  });

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
        ? (isCrediarioOrder(order.payment_method) ? "CREDIÁRIO EM ABERTO" : "PAGO")
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
    // Troco: recalculado da diferença real entre a soma dos pagamentos e o total —
    // não depende de order.change_amount (pode estar null caso o valor não tenha
    // sido persistido por algum motivo no momento da venda), então sempre bate com
    // o que o comprovante já mostra em "Pagamento" acima.
    const paidTotal = (order.payment_method || "").split("|").reduce((sum, seg) => {
      const amt = Number(seg.trim().split(":")[1]);
      return sum + (Number.isFinite(amt) ? amt : 0);
    }, 0);
    const changeAmount = Math.round((paidTotal - Number(order.total_amount)) * 100) / 100;
    const hasDiscount = order.discount_amount && Number(order.discount_amount) > 0;
    // A taxa de maquininha é custo interno. O cliente só vê a parcela que foi
    // marcada como repassada na finalização da venda.
    const passedFeeAmount = order.passed_fee_amount ? Number(order.passed_fee_amount) : 0;
    const hasFee = passedFeeAmount > 0;
    const grossAmount = order.gross_amount
      ? Number(order.gross_amount)
      : Number(order.total_amount);

    return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=${printerSize === "A4" ? "device-width": printerSize},initial-scale=1">
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
  .store-name { font-size: 11pt; font-weight: bold; text-align: center; text-transform: ; letter-spacing: 0.5px; }
  .store-info { font-size: 7pt; text-align: center; color: #222; line-height: 1.6; margin-top: 1mm; }
  .doc-title { font-size: 10pt; font-weight: bold; text-align: center; text-transform: ; letter-spacing: 1.5px; margin: 2mm 0 1mm; }
  .doc-sub   { font-size: 7.5pt; text-align: center; color: #555; }
  .status-wrap { text-align: center; margin: 1.5mm 0 1mm; }
  .status-box  { display: inline-block; font-weight: bold; font-size: 9pt; padding: 0.5mm 4mm; border: 1.5px solid #000; letter-spacing: 2px; }
  .section { font-size: 7.5pt; font-weight: bold; text-transform: ; letter-spacing: 1px; margin-bottom: 1mm; }
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
<div class="subtotal-row"><span class="lbl">Subtotal</span><span class="val">R$ ${Math.max(0, grossAmount - passedFeeAmount).toFixed(2)}</span></div>
${hasDiscount ? `<div class="subtotal-row"><span class="lbl">Desconto</span><span class="val">- R$ ${Number(order.discount_amount).toFixed(2)}</span></div>` : ""}
${hasFee ? `<div class="subtotal-row"><span class="lbl">Taxa de pagamento</span><span class="val">+ R$ ${passedFeeAmount.toFixed(2)}</span></div>` : ""}
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
${
  changeAmount > 0
    ? `<div class="pay-row">
  <span class="pay-label">Troco</span>
  <span class="pay-amount">R$ ${changeAmount.toFixed(2)}</span>
</div>`
    : ""
}

<div class="footer">
  <span class="thanks">Obrigado pela preferência!</span>
  Emitido em ${new Date().toLocaleString("pt-BR")}<br>
  Este documento não tem valor fiscal.
</div>
</body></html>`;
  };

  // Texto em colunas fixas (42 caracteres) para impressora térmica ESC/POS — mesmo
  // padrão de buildThermalText do PDV, adaptado aos campos disponíveis em OrderDetail
  // (não tem código/SKU por item, diferente do carrinho do PDV).
  const buildOrderThermalText = (order: OrderDetail): string => buildOrderReceiptText(tenant, order);

  const handleRemotePrintOrder = async (terminalId: number) => {
    if (!selectedOrder) return;
    setRemotePrintSending(terminalId);
    try {
      const result = await requestRemotePrint(token() || "", terminalId, "receipt", buildOrderThermalText(selectedOrder));
      if (!result.ok) notify.error(result.error || "Falha ao pedir impressão remota.");
    } catch {
      notify.error("Falha ao pedir impressão remota. Verifique sua conexão.");
    } finally {
      setRemotePrintSending(null);
    }
  };

  // Reimpressão do cupom — mesmo texto/formato de 42 colunas da venda original
  // (buildOrderThermalText), pra ir direto na impressora térmica igual saiu na
  // hora da venda, em vez do comprovante A4 aberto no navegador.
  const handlePrintReceipt = () => {
    if (!selectedOrder) return;
    printThermalText(buildOrderThermalText(selectedOrder), "Comprovante");
  };

  const handleDownloadReceipt = async () => {
    if (!selectedOrder || generatingReceiptPdf) return;
    setGeneratingReceiptPdf(true);
    try {
      const html = buildReceiptHtml(selectedOrder);
      await downloadHtmlAsPdf(html, `comprovante-pedido-${String(selectedOrder.id).padStart(6, "0")}.pdf`);
    } catch (err) {
      console.error(err);
    } finally {
      setGeneratingReceiptPdf(false);
    }
  };

  const handleDownloadWarranty = async () => {
    if (!selectedOrder || generatingWarrantyPdf) return;
    setGeneratingWarrantyPdf(true);
    try {
      const html = buildWarrantyHtml(selectedOrder);
      await downloadHtmlAsPdf(html, `garantia-pedido-${String(selectedOrder.id).padStart(6, "0")}.pdf`);
    } catch (err) {
      console.error(err);
    } finally {
      setGeneratingWarrantyPdf(false);
    }
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
      <div role="status" className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
        <Loader2 size={18} className="animate-spin" />Carregando pedidos…
      </div>
    );

  const datePresets = [
    { label: "Hoje", from: todayStr(), to: todayStr() },
    { label: "7d", from: (() => { const d = new Date(); d.setDate(d.getDate() - 6); return d.toISOString().slice(0, 10); })(), to: todayStr() },
    { label: "Mês", from: firstOfMonthStr(), to: lastOfMonthStr() },
    { label: "Tudo", from: "", to: "" },
  ];

  const monthFrom = firstOfMonthStr();
  const monthTo = lastOfMonthStr();
  const STATUS_OPTIONS = [
    { value: "all", label: "Todos os status" },
    { value: "pending", label: "Pendentes" },
    { value: "completed", label: "Efetivados" },
    { value: "cancelled", label: "Cancelados" },
  ];
  const TYPE_OPTIONS = [
    { value: "all", label: "Todos os tipos" },
    { value: "products", label: "Catálogo" },
    { value: "services", label: "Serviços" },
    { value: "mixed", label: "Misto" },
  ];
  const dateIsDefault = dateFrom === monthFrom && dateTo === monthTo;
  const dateLabel = (() => {
    const p = datePresets.find((x) => x.from === dateFrom && x.to === dateTo);
    if (p) return p.label === "Tudo" ? "Todo o período" : p.label === "Mês" ? "Este mês" : p.label === "7d" ? "Últimos 7 dias" : p.label;
    const f = (v: string) => v ? v.split("-").reverse().join("/") : "…";
    return `${f(dateFrom)} – ${f(dateTo)}`;
  })();
  const filterChips: { key: string; label: string; onRemove: () => void }[] = [];
  if (selectedStatus !== "all") filterChips.push({ key: "status", label: `Status: ${STATUS_OPTIONS.find((o) => o.value === selectedStatus)?.label ?? selectedStatus}`, onRemove: () => setSelectedStatus("all") });
  if (selectedType !== "all") filterChips.push({ key: "type", label: `Tipo: ${TYPE_OPTIONS.find((o) => o.value === selectedType)?.label ?? selectedType}`, onRemove: () => setSelectedType("all") });
  if (!dateIsDefault) filterChips.push({ key: "date", label: `Período: ${dateLabel}`, onRemove: () => { setDateFrom(monthFrom); setDateTo(monthTo); } });
  const activeFilterCount = filterChips.length;

  const openFilters = () => { setDraftStatus(selectedStatus); setDraftType(selectedType); setDraftFrom(dateFrom); setDraftTo(dateTo); };
  const applyFilters = () => { setSelectedStatus(draftStatus); setSelectedType(draftType); setDateFrom(draftFrom); setDateTo(draftTo); };
  const clearFilters = () => {
    setSelectedStatus("all"); setSelectedType("all"); setDateFrom(monthFrom); setDateTo(monthTo);
    setDraftStatus("all"); setDraftType("all"); setDraftFrom(monthFrom); setDraftTo(monthTo);
  };

  return (
    <div data-tour="orders-page" className="min-w-0 w-full space-y-4">
      <SectionTitle
        title="Pedidos"
        description="Gestão e acompanhamento de vendas"
        icon={Receipt}
        action={
          <>
            <Button variant="outline" size="sm" data-tour="orders-export-btn"
              iconLeft={<Download size={14} />}
              loading={exporting}
              onClick={async () => {
                setExporting(true);
                try { await exportOrdersToExcel(filteredOrders, tenant?.name ?? "BoxSys Store"); }
                finally { setExporting(false); }
              }}
              disabled={sortedOrders.length === 0}>
              Exportar
            </Button>
            <Button
              variant="outline"
              size="sm"
              iconLeft={<HelpCircle size={14} />}
              onClick={() => ordersPageTourRef.current?.start()}
              title="Tour guiado desta página"
            >
              <span className="sr-only sm:not-sr-only">Ajuda</span>
            </Button>
          </>
        }
      />

      <OrdersPageTour ref={ordersPageTourRef} />

      <StatGrid cols={4}>
        <StatCard title="Total" value={filteredOrders.length} icon={Receipt} color="info" />
        <StatCard title="Pendentes" value={filteredOrders.filter(o => o.status === "pending").length} icon={Clock} color="warning" />
        <StatCard title="Efetivados" value={filteredOrders.filter(o => o.status === "completed").length} icon={CheckCircle2} color="success" />
        <StatCard title="Cancelados" value={filteredOrders.filter(o => o.status === "cancelled").length} icon={XCircle} color="danger" />
      </StatGrid>

      <FilterLine>
        <FilterLineSection grow wrap className="gap-2">
          <FilterLineItem fullOnMobile={false} grow className="min-w-0 sm:max-w-[280px]">
            <FilterLineSearch
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Buscar pedido, cliente..."
              aria-label="Buscar pedidos"
              className="h-[34px]"
            />
          </FilterLineItem>
          <FilterPopover
            activeCount={activeFilterCount}
            onOpen={openFilters}
            onApply={applyFilters}
            onClear={clearFilters}
          >
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Status</label>
              <Select
                aria-label="Filtrar por status"
                value={draftStatus}
                onChange={(e) => setDraftStatus(e.target.value)}
                options={STATUS_OPTIONS}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Tipo</label>
              <Select
                aria-label="Filtrar por tipo"
                value={draftType}
                onChange={(e) => setDraftType(e.target.value)}
                options={TYPE_OPTIONS}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Período</label>
              <div className="grid grid-cols-2 gap-2">
                <div className="min-w-0"><DatePicker value={draftFrom || null} onChange={(v) => setDraftFrom(v ?? "")} /></div>
                <div className="min-w-0"><DatePicker value={draftTo || null} onChange={(v) => setDraftTo(v ?? "")} /></div>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {datePresets.map((p) => {
                  const active = p.from === draftFrom && p.to === draftTo;
                  return (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => { setDraftFrom(p.from); setDraftTo(p.to); }}
                      className={cn(
                        "rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors",
                        active ? "border-blue-200 bg-blue-50 text-blue-600" : "border-slate-200 text-slate-500 hover:bg-slate-50"
                      )}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </FilterPopover>
        </FilterLineSection>
      </FilterLine>

      {filterChips.length > 0 && (
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          {filterChips.map((chip) => (
            <span key={chip.key} className="inline-flex max-w-full items-center gap-1 rounded-lg border border-blue-100 bg-blue-50 py-0.5 pl-2 pr-1 text-[11px] font-medium text-blue-700">
              <span className="truncate">{chip.label}</span>
              <button type="button" onClick={chip.onRemove} aria-label={`Remover filtro ${chip.label}`}
                className="rounded p-0.5 hover:bg-blue-100">
                <X size={11} />
              </button>
            </span>
          ))}
          <button type="button" onClick={clearFilters} className="px-1 text-[11px] font-medium text-slate-500 hover:text-slate-800">
            Limpar filtros
          </button>
        </div>
      )}

      {/* Bulk action bar */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="flex flex-col justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 min-[480px]:flex-row min-[480px]:items-center"
          >
            <div className="flex min-w-0 items-center gap-3">
              <CheckSquare size={16} className="text-blue-600" />
              <span className="text-xs font-medium text-blue-700">
                {selectedIds.size} pedido{selectedIds.size !== 1 ? "s" : ""} selecionado
                {selectedIds.size !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="grid w-full grid-cols-2 gap-2 min-[480px]:flex min-[480px]:w-auto">
              <Button variant="ghost" size="sm" onClick={clearSelection}>
                Limpar
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setShowDeleteModal(true)} className="justify-center">
                <Trash2 size={13} /> Deletar
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Desktop Table */}
      <ContentCard padding="none" className="hidden xl:block overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-3 py-2.5 w-9">
                  <input type="checkbox" checked={allFilteredSelected} onChange={toggleSelectAll}
                    className="w-3.5 h-3.5 rounded accent-slate-900 cursor-pointer" />
                </th>
                <th className="px-3 py-2.5 w-24">
                  <Button variant="ghost" size="sm" onClick={() => toggleSort("id")}>
                    Pedido {sortField === "id" ? (sortDir === "asc" ? <ArrowUp size={10} /> : <ArrowDown size={10} />) : <ArrowUpDown size={10} className="opacity-30" />}
                  </Button>
                </th>
                <th className="px-3 py-2.5 text-[10px] font-semibold text-slate-400">Cliente</th>
                <th className="px-3 py-2.5 text-[10px] font-semibold text-slate-400">Pagamento</th>
                <th className="px-3 py-2.5 w-28">
                  <Button variant="ghost" size="sm" onClick={() => toggleSort("date")}>
                    Data {sortField === "date" ? (sortDir === "asc" ? <ArrowUp size={10} /> : <ArrowDown size={10} />) : <ArrowUpDown size={10} className="opacity-30" />}
                  </Button>
                </th>
                <th className="px-3 py-2.5 w-32 text-right">
                  <Button variant="ghost" size="sm" onClick={() => toggleSort("total")} className="ml-auto">
                    Total {sortField === "total" ? (sortDir === "asc" ? <ArrowUp size={10} /> : <ArrowDown size={10} />) : <ArrowUpDown size={10} className="opacity-30" />}
                  </Button>
                </th>
                <th className="px-3 py-2.5 text-[10px] font-semibold text-slate-400 text-center w-28">Status</th>
                <th className="px-3 py-2.5 text-[10px] font-semibold text-slate-400 text-center w-32">Nota Fiscal</th>
                <th className="px-3 py-2.5 w-20 text-[10px] font-semibold text-slate-400 text-center">Ações</th>
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
                      <span className="font-mono font-semibold text-[11px] text-blue-500">
                        #{String(order.id).padStart(6, "0")}
                      </span>
                      {(order as any).order_type === "services" && (
                        <span className="block text-[10px] font-semibold text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded mt-0.5 w-fit">Serviço</span>
                      )}
                      {(order as any).order_type === "mixed" && (
                        <span className="block text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded mt-0.5 w-fit">Misto</span>
                      )}
                    </td>
                    {/* cliente */}
                    <td className="px-3 py-2">
                      <p className="max-w-[200px] truncate text-[12px] font-semibold text-slate-800 leading-tight" title={order.customer_name || "Balcão"}>
                        {order.customer_name || "Balcão"}
                      </p>
                      {order.seller_name && (
                        <p className="max-w-[200px] truncate text-[11px] text-slate-400 leading-tight mt-0.5">
                          Vendedor: {order.seller_name}
                        </p>
                      )}
                    </td>
                    {/* pagamento */}
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {segs.length > 0 ? segs.map((s, i) => (
                          <span key={i} className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold", pmBadge[s.method] ?? "bg-slate-100 text-slate-600")}>
                            <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", pmDot[s.method] ?? "bg-slate-400")} />
                            {s.label}
                          </span>
                        )) : <span className="text-[11px] text-slate-400">—</span>}
                      </div>
                    </td>
                    {/* data */}
                    <td className="px-3 py-2">
                      <p className="text-[11px] font-semibold text-slate-700">{dateStr}</p>
                      <p className="text-[11px] text-slate-400">{timeStr}</p>
                    </td>
                    {/* total */}
                    <td className="px-3 py-2 text-right">
                      <span className={cn(
                        "font-mono font-semibold text-[13px]",
                        order.status === "cancelled" ? "text-slate-300 line-through" : "text-slate-900"
                      )}>
                        R$ {Number(order.total_amount).toFixed(2)}
                      </span>
                    </td>
                    {/* status */}
                    <td className="px-3 py-2 text-center">
                      {order.status === "completed" && isCrediarioOrder(order.payment_method) && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-violet-50 text-violet-600 border border-violet-100">
                          <Clock size={10} /> Crediário
                        </span>
                      )}
                      {order.status === "completed" && !isCrediarioOrder(order.payment_method) && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-600 border border-emerald-100">
                          <CheckCircle2 size={10} /> Pago
                        </span>
                      )}
                      {order.status === "pending" && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-600 border border-amber-100">
                          <Clock size={10} /> Pendente
                        </span>
                      )}
                      {order.status === "cancelled" && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-red-50 text-red-500 border border-red-100">
                          <XCircle size={10} /> Cancelado
                        </span>
                      )}
                    </td>
                    {/* nota fiscal */}
                    <td className="px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                      {order.status === "cancelled" ? (
                        <span className="text-[11px] text-slate-300">—</span>
                      ) : order.nfce_invoice?.status === "authorized" ? (
                        <button onClick={() => handleDownloadDanfe(order.id, order.nfce_invoice?.access_key)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-600 border border-emerald-100 hover:bg-emerald-100 transition-colors"
                          title="Baixar DANFE">
                          <FileText size={10} /> Emitida
                        </button>
                      ) : order.nfce_invoice?.status === "processing" || order.nfce_invoice?.status === "pending" ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-600 border border-blue-100">
                          <Loader2 size={10} className="animate-spin" /> Processando
                        </span>
                      ) : order.nfce_invoice?.status === "rejected" || order.nfce_invoice?.status === "error" ? (
                        <button onClick={() => handleEmitNfce(order.id)} disabled={emittingNfceId === order.id}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-red-50 text-red-500 border border-red-100 hover:bg-red-100 transition-colors disabled:opacity-50"
                          title="Tentar novamente">
                          {emittingNfceId === order.id ? <Loader2 size={10} className="animate-spin" /> : <AlertTriangle size={10} />} Reemitir
                        </button>
                      ) : order.customer_document && order.customer_document.trim() ? (
                        <button onClick={() => handleEmitNfce(order.id)} disabled={emittingNfceId === order.id}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-slate-900 text-white hover:bg-slate-700 transition-colors disabled:opacity-50">
                          {emittingNfceId === order.id ? <Loader2 size={10} className="animate-spin" /> : <FileText size={10} />} Gerar NF
                        </button>
                      ) : (
                        <button
                          onClick={(e) => { e.stopPropagation(); setDocumentTarget(order); setDocumentInput(""); }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] text-slate-400 hover:text-blue-600 hover:bg-blue-50 font-semibold transition-colors"
                          title="Informar CPF/CNPJ para gerar a nota fiscal"
                        >
                          <Plus size={10} /> Sem CPF/CNPJ
                        </button>
                      )}
                    </td>
                    {/* ações — sempre visíveis */}
                    <td className="px-3 py-2">
                      <div className="flex justify-center items-center gap-1.5">
                        <IconButton variant="outline" size="xs" onClick={(e) => { e.stopPropagation(); setSelectedIds(new Set([order.id])); setShowDeleteModal(true); }}
                          
                          title="Deletar" className="justify-center" aria-label="Deletar">
                          <Trash2 size={12} />
                        </IconButton>
                        <IconButton variant="primary" size="xs" onClick={() => fetchOrderDetails(order.id)}
                          
                          title="Ver detalhes" className="justify-center" aria-label="Ver detalhes">
                          <ChevronRight size={14} strokeWidth={2.5} />
                        </IconButton>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {sortedOrders.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-[11px] font-semibold text-slate-400">
                    Nenhum pedido encontrado
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {sortedOrders.length > 0 && (
          <div className="px-5 py-2.5 border-t border-slate-100 flex items-center justify-between bg-slate-50/50 gap-x-4 gap-y-2 flex-wrap">
            {/* info */}
            <span className="text-[11px] font-semibold text-slate-400 shrink-0">
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
                <Button variant="outline" size="xs" onClick={() => goToPage(1)}
                  disabled={safePage === 1}
                  
                  title="Primeira página" className="justify-center">
                  «
                </Button>
                <Button variant="outline" size="xs" onClick={() => goToPage(safePage - 1)}
                  disabled={safePage === 1}
                  
                  title="Anterior" className="justify-center">
                  ‹
                </Button>

                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
                  .reduce<(number | "…")[]>((acc, p, i, arr) => {
                    if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push("…");
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p, i) =>
                    p === "…" ? (
                      <span key={`e${i}`} className="w-7 h-7 flex items-center justify-center text-[11px] text-slate-300">…</span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => goToPage(p as number)}
                        className={cn(
                          "w-7 h-7 rounded-lg text-[11px] font-semibold transition-all",
                          safePage === p
                            ? "bg-slate-900 text-white shadow-sm"
                            : "text-slate-500 hover:bg-slate-100"
                        )}>
                        {p}
                      </button>
                    )
                  )}

                <Button variant="outline" size="xs" onClick={() => goToPage(safePage + 1)}
                  disabled={safePage === totalPages}
                  
                  title="Próxima" className="justify-center">
                  ›
                </Button>
                <Button variant="outline" size="xs" onClick={() => goToPage(totalPages)}
                  disabled={safePage === totalPages}
                  
                  title="Última página" className="justify-center">
                  »
                </Button>
              </div>
            )}

            {/* total */}
            <span className="text-[11px] font-semibold font-mono text-slate-600 shrink-0">
              Total: R$ {sortedOrders.reduce((a, o) => a + (o.status !== "cancelled" ? Number(o.total_amount) : 0), 0).toFixed(2)}
            </span>
          </div>
        )}
      </ContentCard>

      {/* Mobile Card-Based List */}
      <div className="xl:hidden min-w-0 space-y-3 pb-8">
        {pagedOrders.map((order) => {
          const isChecked = selectedIds.has(order.id);
          return (
            <motion.div
              layout
              key={order.id}
              className={cn(
                "bg-white p-4 rounded-lg border border-slate-200 shadow-sm transition-all sm:p-5 min-w-0",
                isChecked && "border-blue-300 ring-2 ring-blue-100"
              )}
            >
              <div className="flex items-start justify-between gap-3 mb-4">
                <div
                  className="flex min-w-0 flex-1 items-center gap-3 cursor-pointer"
                  onClick={() => fetchOrderDetails(order.id)}
                >
                  <div className="min-w-0 space-y-1">
                    <span className="text-[11px] font-mono font-semibold text-slate-300">
                      #{String(order.id).padStart(6, "0")}
                    </span>
                    <h4 className="truncate text-xs font-semibold text-slate-900">
                      {order.customer_name || "Cliente Balcão"}
                    </h4>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-[10px] font-semibold border shadow-sm flex items-center gap-1.5",
                      getStatusStyle(order.status)
                    )}
                  >
                    {getStatusIcon(order.status)}
                    {order.status === "completed"
                      ? (isCrediarioOrder(order.payment_method) ? "CREDIÁRIO" : "PAGO")
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
                    aria-label={`Selecionar pedido #${String(order.id).padStart(6, "0")}`}
                    className="w-4 h-4 rounded accent-slate-900 cursor-pointer"
                  />
                </div>
              </div>

              <div
                className="flex items-end justify-between gap-3 pt-4 border-t border-slate-50 cursor-pointer"
                onClick={() => fetchOrderDetails(order.id)}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-slate-400">
                    <Clock size={10} />
                    <span className="text-[10px] font-mono font-semibold">
                      {new Date(order.created_at).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-400">
                    <CreditCard size={10} />
                    <span className="max-w-[145px] truncate text-[10px] font-semibold">
                      {formatPaymentLabel(order.payment_method)}
                    </span>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[10px] font-semibold text-slate-400 mb-1">
                    Montante Líquido
                  </p>
                  <p className="text-xl font-mono font-semibold text-slate-900">
                    R$ {Number(order.total_amount).toFixed(2)}
                  </p>
                </div>
              </div>

              {order.status !== "cancelled" && (
                <div className="flex justify-end pt-3">
                  {order.nfce_invoice?.status === "authorized" ? (
                    <button onClick={() => handleDownloadDanfe(order.id, order.nfce_invoice?.access_key)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-600 border border-emerald-100">
                      <FileText size={10} /> Nota Emitida
                    </button>
                  ) : order.nfce_invoice?.status === "processing" || order.nfce_invoice?.status === "pending" ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-600 border border-blue-100">
                      <Loader2 size={10} className="animate-spin" /> Nota Processando
                    </span>
                  ) : order.nfce_invoice?.status === "rejected" || order.nfce_invoice?.status === "error" ? (
                    <button onClick={() => handleEmitNfce(order.id)} disabled={emittingNfceId === order.id}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-red-50 text-red-500 border border-red-100 disabled:opacity-50">
                      {emittingNfceId === order.id ? <Loader2 size={10} className="animate-spin" /> : <AlertTriangle size={10} />} Reemitir Nota
                    </button>
                  ) : order.customer_document && order.customer_document.trim() ? (
                    <button onClick={() => handleEmitNfce(order.id)} disabled={emittingNfceId === order.id}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-slate-900 text-white disabled:opacity-50">
                      {emittingNfceId === order.id ? <Loader2 size={10} className="animate-spin" /> : <FileText size={10} />} Gerar Nota Fiscal
                    </button>
                  ) : (
                    <button
                      onClick={() => { setDocumentTarget(order); setDocumentInput(""); }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] text-slate-400 hover:text-blue-600 hover:bg-blue-50 font-semibold transition-colors"
                    >
                      <Plus size={10} /> Sem CPF/CNPJ — informar
                    </button>
                  )}
                </div>
              )}
              <Button variant="outline" size="sm" onClick={() => fetchOrderDetails(order.id)} className="mt-3 w-full justify-center">
                Ver pedido <ChevronRight size={13} />
              </Button>
            </motion.div>
          );
        })}
        {sortedOrders.length === 0 && (
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-12 text-center text-[11px] font-semibold text-slate-400">
            Nenhum pedido encontrado
          </div>
        )}
        {totalPages > 1 && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
            <Button variant="outline" size="sm" onClick={() => goToPage(safePage - 1)}
              disabled={safePage === 1}>
              Anterior
            </Button>
            <span className="whitespace-nowrap text-[11px] font-semibold text-slate-500">
              {safePage} de {totalPages}
            </span>
            <Button variant="primary" size="sm" onClick={() => goToPage(safePage + 1)}
              disabled={safePage === totalPages}>
              Próximo
            </Button>
          </div>
        )}
      </div>

      {/* Detalhes do pedido */}
      <Modal
        open={isDetailModalOpen && !!selectedOrder}
        onClose={() => setIsDetailModalOpen(false)}
        position="right"
        size="lg"
        title={selectedOrder ? `Pedido #${String(selectedOrder.id).padStart(6, "0")}` : "Pedido"}
        subtitle={selectedOrder ? new Date(selectedOrder.created_at).toLocaleString("pt-BR") : undefined}
        footer={
          <div className="w-full space-y-2">
                <Button variant="primary" size="md" onClick={handlePrintReceipt} className="w-full justify-center">
                  <Receipt size={14} /> Imprimir cupom
                </Button>

                {remoteTerminals.length > 0 && (
                  <details className="group rounded-lg border border-blue-100 bg-blue-50/40 overflow-hidden">
                    <summary className="h-10 px-3 cursor-pointer list-none flex items-center justify-between text-[11px] font-semibold text-blue-700 select-none">
                      Imprimir em outro terminal
                      <ChevronRight size={14} className="transition-transform group-open:rotate-90" />
                    </summary>
                    <div className="px-2.5 pb-2.5 space-y-1.5 border-t border-blue-100">
                      {remoteTerminals.map((rt) => (
                        <Button variant="outline" size="sm" key={rt.id}
                          onClick={() => handleRemotePrintOrder(rt.id)}
                          disabled={remotePrintSending === rt.id} className="w-full mt-2.5">
                          {remotePrintSending === rt.id ? <Loader2 size={13} className="animate-spin" /> : <Printer size={13} />}
                          {rt.name}
                        </Button>
                      ))}
                    </div>
                  </details>
                )}
                <details className="group rounded-lg border border-slate-200 overflow-hidden">
                  <summary className="h-10 px-3 cursor-pointer list-none flex items-center justify-between text-[11px] font-semibold text-slate-600 select-none">
                    Mais opções
                    <ChevronRight size={14} className="transition-transform group-open:rotate-90" />
                  </summary>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-2.5 border-t border-slate-100 bg-slate-50">
                    <Button variant="outline" size="sm" onClick={handleDownloadReceipt} disabled={generatingReceiptPdf} className="justify-center">
                      {generatingReceiptPdf ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />} Baixar cupom
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleDownloadWarranty} disabled={generatingWarrantyPdf} className="justify-center">
                      {generatingWarrantyPdf ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />} Baixar garantia
                    </Button>
                    <Button variant="success" size="sm" onClick={handlePrintWarranty} className="justify-center">
                      <ShieldCheck size={13} /> Imprimir garantia
                    </Button>
                  </div>
                </details>
          </div>
        }
      >
        {selectedOrder && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Badge
                dot
                size="md"
                color={selectedOrder.status !== "completed"
                  ? (selectedOrder.status === "cancelled" ? "danger" : "warning")
                  : isCrediarioOrder(selectedOrder.payment_method) ? "purple" : "success"}
              >
                {selectedOrder.status === "completed"
                  ? (isCrediarioOrder(selectedOrder.payment_method) ? "Crediário" : "Pago")
                  : selectedOrder.status === "cancelled" ? "Cancelado" : "Pendente"}
              </Badge>
              <details className="group relative">
                      <summary className="h-8 px-2.5 cursor-pointer list-none flex items-center gap-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-[10px] font-semibold text-slate-600 select-none">
                        Ações <ChevronRight size={12} className="transition-transform group-open:rotate-90" />
                      </summary>
                      <div className="absolute right-0 top-10 z-20 w-48 rounded-lg border border-slate-200 bg-white p-1.5 shadow-sm">
                        {selectedOrder.status === "pending" && (
                          <button onClick={() => handleUpdateStatus(selectedOrder.id, "completed")}
                            className="w-full h-9 px-2.5 flex items-center rounded-lg text-left text-[11px] font-semibold text-emerald-700 hover:bg-emerald-50">
                            Efetivar pedido
                          </button>
                        )}
                        {selectedOrder.status === "completed" &&
                          selectedOrder.items.some((i) => i.quantity - (i.returned_quantity ?? 0) > 0) && (
                          <button onClick={() => { setReturnResult(null); setShowReturnModal(true); }}
                            className="w-full h-9 px-2.5 flex items-center rounded-lg text-left text-[11px] font-semibold text-amber-700 hover:bg-amber-50">
                            Devolver ou trocar
                          </button>
                        )}
                        {selectedOrder.status !== "cancelled" && (
                          <button onClick={() => setShowCancelModal(true)}
                            className="w-full h-9 px-2.5 flex items-center rounded-lg text-left text-[11px] font-semibold text-rose-600 hover:bg-rose-50">
                            Cancelar pedido
                          </button>
                        )}
                        <button onClick={() => { setSelectedIds(new Set([selectedOrder.id])); setShowDeleteModal(true); }}
                          className="w-full h-9 px-2.5 flex items-center gap-1.5 rounded-lg text-left text-[11px] font-semibold text-slate-500 hover:bg-slate-100">
                          <Trash2 size={12} /> Excluir pedido
                        </button>
                      </div>
                    </details>
            </div>

            <Tabs<OrderTabId> items={ORDER_TABS} value={detailTab} onChange={setDetailTab} label="Detalhes do pedido">
              {detailTab === "resumo" && (
                <div className="space-y-3">
                {/* Hero value card */}
                <div className={cn(
                  "rounded-lg px-4 py-3 flex items-center justify-between gap-4",
                  selectedOrder.status !== "completed" ? (selectedOrder.status === "cancelled" ? "bg-slate-800" : "bg-amber-500")
                    : isCrediarioOrder(selectedOrder.payment_method) ? "bg-violet-600" : "bg-emerald-600"
                )}>
                  <div>
                    <p className="text-[10px] font-semibold text-white/60 mb-1">
                      {selectedOrder.status === "completed"
                        ? (isCrediarioOrder(selectedOrder.payment_method) ? "Em Aberto (Crediário)" : "Total Pago")
                        : selectedOrder.status === "cancelled" ? "Valor Cancelado" : "Valor Pendente"}
                    </p>
                    <p className="text-2xl font-semibold font-mono text-white leading-none">
                      R$ {Number(selectedOrder.total_amount).toFixed(2)}
                    </p>
                    <p className="text-[11px] text-white/60 mt-1.5 font-medium">
                      {new Date(selectedOrder.created_at).toLocaleString("pt-BR")}
                    </p>
                  </div>
                  <div className="w-11 h-11 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
                    {selectedOrder.status === "completed" ? <CheckCircle2 size={22} className="text-white" /> :
                     selectedOrder.status === "cancelled"  ? <XCircle      size={22} className="text-white" /> :
                                                             <Clock        size={22} className="text-white" />}
                  </div>
                </div>

                {/* Cancel reason */}
                {selectedOrder.status === "cancelled" &&
                  (selectedOrder.cancel_reason || selectedOrder.cancelled_by) && (
                    <div className="p-4 bg-red-50 border border-red-100 rounded-lg">
                      <p className="text-[10px] font-semibold text-red-500 flex items-center gap-1.5 mb-2">
                        <AlertTriangle size={10} /> Motivo do Cancelamento
                      </p>
                      {selectedOrder.cancelled_by && (
                        <p className="text-[11px] font-semibold text-red-700">Por: {selectedOrder.cancelled_by}</p>
                      )}
                      {selectedOrder.cancel_reason && (
                        <p className="text-[11px] text-red-600 mt-0.5">{selectedOrder.cancel_reason}</p>
                      )}
                      {selectedOrder.cancelled_at && (
                        <p className="text-[11px] text-red-400 font-mono mt-1">
                          {new Date(selectedOrder.cancelled_at).toLocaleString("pt-BR")}
                        </p>
                      )}
                    </div>
                  )}

                {/* Cliente + Vendedor */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="bg-slate-50 rounded-lg px-3.5 py-3 border border-slate-100">
                    <p className="text-[10px] font-semibold text-slate-400 mb-1.5 flex items-center gap-1">
                      <User size={9} /> Cliente
                    </p>
                    <p className="text-[13px] font-semibold text-slate-900 leading-tight">
                      {selectedOrder.customer_name || "Consumidor Final"}
                    </p>
                    {selectedOrder.customer_phone && (
                      <p className="text-[11px] font-mono text-slate-500 mt-0.5">{selectedOrder.customer_phone}</p>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => { setDocumentTarget(selectedOrder); setDocumentInput(selectedOrder.customer_document || ""); }} className="mt-1.5">
                      {selectedOrder.customer_document?.trim() ? `CPF/CNPJ: ${selectedOrder.customer_document}` : "+ Informar CPF/CNPJ"}
                    </Button>
                  </div>
                  <div className="bg-slate-50 rounded-lg px-3.5 py-3 border border-slate-100">
                    <p className="text-[10px] font-semibold text-slate-400 mb-1.5">Vendedor</p>
                    <p className="text-[13px] font-semibold text-slate-900 leading-tight">
                      {selectedOrder.seller_name || "—"}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {selectedOrder.seller_name ? "Responsável" : "Não atribuído"}
                    </p>
                  </div>
                </div>

                </div>
              )}
              {detailTab === "itens" && (
                <div className="space-y-3">
                {/* Itens */}
                <div className="">
                  <p className="text-[10px] font-semibold text-slate-400 mb-2 flex items-center gap-1.5">
                    <Package size={9} /> Itens do Pedido
                    <span className="ml-0.5 px-1.5 py-0.5 bg-slate-100 rounded-md text-slate-500">{selectedOrder.items.length}</span>
                  </p>
                  <div className="rounded-lg border border-slate-100 overflow-hidden">
                    {selectedOrder.items.map((item, i) => (
                      <div key={item.id} className={cn(
                        "px-4 py-3 flex items-center justify-between gap-3",
                        i < selectedOrder.items.length - 1 && "border-b border-slate-50"
                      )}>
                        <div className="min-w-0 flex-1">
                          <p className="text-[12px] font-semibold text-slate-800 truncate">{item.product_name}</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {item.quantity} un × R$ {Number(item.unit_price).toFixed(2)}
                          </p>
                        </div>
                        <span className="font-mono font-semibold text-[13px] text-slate-900 shrink-0">
                          R$ {(item.quantity * Number(item.unit_price)).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Subtotal / desconto / acréscimo / taxa / total */}
                {(() => {
                  const passedFee = Number(selectedOrder.passed_fee_amount ?? 0);
                  const hasGross = selectedOrder.gross_amount != null && (
                    Number(selectedOrder.gross_amount) !== Number(selectedOrder.total_amount) || passedFee > 0
                  );
                  const hasDisc  = selectedOrder.discount_amount != null && Number(selectedOrder.discount_amount) > 0;
                  const hasFee   = passedFee > 0;
                  const surchargeRaw = selectedOrder.surcharge_amount != null
                    ? Number(selectedOrder.surcharge_amount)
                    : 0;
                  const hasSurcharge = surchargeRaw > 0.009;
                  if (!hasGross && !hasDisc && !hasFee && !hasSurcharge) return null;
                  return (
                    <div className="rounded-lg border border-slate-100 overflow-hidden">
                      {hasGross && (
                        <div className="px-4 py-2.5 flex justify-between items-center border-b border-slate-50">
                          <span className="text-[11px] font-semibold text-slate-500">Subtotal</span>
                          <span className="font-mono text-[11px] font-semibold text-slate-700">R$ {Math.max(0, Number(selectedOrder.gross_amount) - passedFee).toFixed(2)}</span>
                        </div>
                      )}
                      {hasDisc && (
                        <div className="px-4 py-2.5 flex justify-between items-center border-b border-slate-50">
                          <span className="text-[11px] font-semibold text-rose-500">Desconto</span>
                          <span className="font-mono text-[11px] font-semibold text-rose-500">− R$ {Number(selectedOrder.discount_amount).toFixed(2)}</span>
                        </div>
                      )}
                      {hasSurcharge && (
                        <div className="px-4 py-2.5 flex justify-between items-center border-b border-slate-50">
                          <span className="text-[11px] font-semibold text-amber-600">Acréscimo</span>
                          <span className="font-mono text-[11px] font-semibold text-amber-600">+ R$ {surchargeRaw.toFixed(2)}</span>
                        </div>
                      )}
                      {hasFee && (
                        <div className="px-4 py-2.5 flex justify-between items-center border-b border-slate-50">
                          <span className="text-[11px] font-semibold text-amber-600">Taxa de pagamento</span>
                          <span className="font-mono text-[11px] font-semibold text-amber-600">+ R$ {passedFee.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="px-4 py-3 flex justify-between items-center bg-slate-50">
                        <span className="text-[12px] font-semibold text-slate-800">Total</span>
                        <span className="font-mono text-[14px] font-semibold text-slate-900">R$ {Number(selectedOrder.total_amount).toFixed(2)}</span>
                      </div>
                    </div>
                  );
                })()}

                </div>
              )}
              {detailTab === "pagamento" && (
                <div className="space-y-3">
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
                  const methodStyle: Record<string, { bg: string; icon: React.ReactNode }> = {
                    money: { bg: "bg-slate-100", icon: <BanknoteIcon size={18} className="text-slate-600" /> },
                    pix:   { bg: "bg-violet-50", icon: <ZapIcon size={18} className="text-violet-600" /> },
                    debit: { bg: "bg-blue-50",   icon: <CreditCard size={18} className="text-blue-600" /> },
                    credit:{ bg: "bg-emerald-50",icon: <CreditCard size={18} className="text-emerald-600" /> },
                  };
                  return (
                    <div className="">
                      <p className="text-[10px] font-semibold text-slate-400 mb-2 flex items-center gap-1.5">
                        <CreditCard size={9} /> Pagamento
                      </p>
                      <div className="space-y-2">
                        {segs.map((s, i) => {
                          const style = methodStyle[s.method] ?? { bg: "bg-slate-50", icon: <WalletIcon size={18} className="text-slate-600" /> };
                          const perInst = s.installments > 1 ? s.amount / s.installments : 0;
                          return (
                            <div key={i} className={cn("rounded-lg px-4 py-3 flex items-center justify-between gap-3 border border-slate-100", style.bg)}>
                              <div className="flex items-center gap-3">
                                <span className="flex items-center">{style.icon}</span>
                                <div>
                                  <p className="text-[12px] font-semibold text-slate-900 leading-tight">
                                    {labels[s.method] ?? s.method}
                                    {s.brand && s.brand !== "other" ? ` · ${s.brand.toUpperCase()}` : ""}
                                  </p>
                                  <p className="text-[11px] text-slate-500 mt-0.5">
                                    {s.method === "credit" && s.installments > 1
                                      ? `${s.installments}× de R$ ${perInst.toFixed(2)}`
                                      : "À vista"}
                                  </p>
                                </div>
                              </div>
                              <span className="font-mono font-semibold text-[13px] text-slate-900 shrink-0">
                                R$ {s.amount.toFixed(2)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                </div>
              )}
            </Tabs>
          </div>
        )}
      </Modal>

      {/* Devolução/troca */}
      {showReturnModal && selectedOrder && !returnResult && (
        <OrderReturnModal
          orderId={selectedOrder.id}
          orderCreatedAt={selectedOrder.created_at}
          customerId={selectedOrder.customer_id}
          customerName={selectedOrder.customer_name}
          items={selectedOrder.items}
          returnDeadlineDays={tenant?.return_deadline_days}
          onClose={() => setShowReturnModal(false)}
          onSuccess={(result) => {
            setReturnResult(result);
            fetchOrderDetails(selectedOrder.id);
            fetchOrders();
          }}
        />
      )}

      {/* Resultado pós-devolução — oferece "usar crédito agora" quando houve crédito */}
      <Modal
        open={!!(showReturnModal && selectedOrder && returnResult)}
        onClose={() => { setShowReturnModal(false); setReturnResult(null); }}
        size="sm"
        title="Devolução registrada"
        subtitle={returnResult ? `R$ ${returnResult.creditAmount.toFixed(2)}` : undefined}
        footer={
          <ModalFooter>
            <Button variant="outline" onClick={() => { setShowReturnModal(false); setReturnResult(null); }}>
              Fechar
            </Button>
            {returnResult?.credit && selectedOrder && (
              <Button onClick={() => navigate(`/admin/pdv?customerId=${selectedOrder.customer_id}&creditId=${returnResult.credit!.id}`)}>
                Usar crédito agora
              </Button>
            )}
          </ModalFooter>
        }
      >
        {returnResult && selectedOrder && (
          returnResult.credit ? (
            <Alert variant="info">
              Crédito de R$ {returnResult.credit.amount.toFixed(2)} gerado para {selectedOrder.customer_name || "o cliente"}.
            </Alert>
          ) : (
            <p className="text-xs leading-relaxed text-slate-500">
              Valor devolvido em dinheiro/estorno — sem cliente identificado nesta venda para vincular um crédito.
            </p>
          )
        )}
      </Modal>

      {/* Cancelar pedido */}
      <Modal
        open={!!(showCancelModal && selectedOrder)}
        onClose={() => setShowCancelModal(false)}
        size="sm"
        title="Cancelar pedido"
        subtitle={selectedOrder ? `#${String(selectedOrder.id).padStart(6, "0")}` : undefined}
        footer={
          <ModalFooter>
            <Button variant="outline" onClick={() => setShowCancelModal(false)}>Voltar</Button>
            <Button variant="danger" onClick={handleCancelOrder} loading={cancelling} iconLeft={<XCircle size={14} />}>
              Confirmar
            </Button>
          </ModalFooter>
        }
      >
        <div className="space-y-3">
          <p className="text-xs leading-relaxed text-slate-500">
            Esta ação irá cancelar o pedido, reverter o estoque dos produtos e registrar um estorno no fluxo de caixa.
          </p>
          <Input
            label="Cancelado por"
            type="text"
            value={cancelledBy}
            onChange={(e) => setCancelledBy(e.target.value)}
            placeholder="Nome do responsável"
          />
          <Textarea
            label="Motivo do cancelamento"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Ex: Cliente solicitou estorno, produto com defeito..."
            rows={3}
          />
        </div>
      </Modal>

      {/* CPF/CNPJ — informa/corrige o documento pra habilitar "Gerar NF" */}
      <Modal
        open={!!documentTarget}
        onClose={() => setDocumentTarget(null)}
        size="sm"
        title="CPF/CNPJ do pedido"
        subtitle={documentTarget ? `#${String(documentTarget.id).padStart(6, "0")}` : undefined}
        footer={
          <ModalFooter>
            <Button variant="outline" onClick={() => setDocumentTarget(null)} disabled={savingDocument}>Voltar</Button>
            <Button variant="outline" onClick={() => handleSaveDocument(false)}
              disabled={savingDocument || documentInput.replace(/\D/g, "").length < 11}>
              Só salvar
            </Button>
            <Button onClick={() => handleSaveDocument(true)} loading={savingDocument}
              disabled={documentInput.replace(/\D/g, "").length < 11} iconLeft={<FileText size={14} />}>
              Salvar e gerar NF
            </Button>
          </ModalFooter>
        }
      >
        <div className="space-y-3">
          <p className="text-xs leading-relaxed text-slate-500">
            Informe o CPF ou CNPJ do cliente para habilitar a emissão da nota fiscal deste pedido.
          </p>
          <Input
            label="CPF ou CNPJ"
            type="text"
            autoFocus
            value={documentInput}
            onChange={(e) => setDocumentInput(e.target.value)}
            placeholder="000.000.000-00 ou 00.000.000/0000-00"
          />
        </div>
      </Modal>

      {/* Excluir pedido(s) */}
      {showDeleteModal && (() => {
        // Check if any of the selected orders are completed (not cancelled/pending)
        const selectedOrders = orders.filter(o => selectedIds.has(o.id));
        const hasCompleted = selectedOrders.some(o => o.status === "completed");
        const allCancelled = selectedOrders.every(o => o.status === "cancelled");

        return (
          <Modal
            open
            onClose={() => { setShowDeleteModal(false); if (!isDetailModalOpen) clearSelection(); }}
            size="sm"
            title={`Deletar pedido${selectedIds.size > 1 ? "s" : ""}`}
            subtitle={selectedIds.size === 1
              ? `#${String(Array.from(selectedIds)[0]).padStart(6, "0")}`
              : `${selectedIds.size} pedidos selecionados`}
            footer={
              <ModalFooter>
                <Button variant="outline" onClick={() => { setShowDeleteModal(false); if (!isDetailModalOpen) clearSelection(); }}>
                  Cancelar
                </Button>
                <Button variant="danger" loading={deleting} iconLeft={<Trash2 size={14} />}
                  onClick={() => {
                    if (selectedIds.size === 1 && isDetailModalOpen) {
                      handleDeleteSingle(Array.from(selectedIds)[0]);
                    } else {
                      handleBulkDelete();
                    }
                  }}>
                  Deletar
                </Button>
              </ModalFooter>
            }
          >
            <div className="space-y-3">
              <p className="text-xs leading-relaxed text-slate-500">
                Esta ação é <span className="font-medium text-red-600">permanente e irreversível</span>.{" "}
                O pedido será removido completamente do sistema.
              </p>

              {!allCancelled && hasCompleted && (
                <div className="space-y-2">
                  <p className="text-[11px] text-slate-500">Ao deletar, também:</p>
                  <label className="flex cursor-pointer items-center gap-3 rounded-lg bg-slate-50 p-3 transition-colors hover:bg-slate-100">
                    <input type="checkbox" className="h-4 w-4 accent-blue-600" checked={deleteRevertStock} onChange={() => setDeleteRevertStock(v => !v)} />
                    <div>
                      <p className="text-xs font-medium text-slate-700">Devolver ao estoque</p>
                      <p className="text-[11px] text-slate-500">Reverte a quantidade dos itens</p>
                    </div>
                  </label>
                  <label className="flex cursor-pointer items-center gap-3 rounded-lg bg-slate-50 p-3 transition-colors hover:bg-slate-100">
                    <input type="checkbox" className="h-4 w-4 accent-blue-600" checked={deleteRevertFinance} onChange={() => setDeleteRevertFinance(v => !v)} />
                    <div>
                      <p className="text-xs font-medium text-slate-700">Remover do financeiro</p>
                      <p className="text-[11px] text-slate-500">Exclui a entrada no Fluxo de Caixa e Visão Geral</p>
                    </div>
                  </label>
                </div>
              )}

              {allCancelled && (
                <Alert variant="info">
                  Pedido já cancelado — estoque e financeiro já foram revertidos no cancelamento.
                </Alert>
              )}
            </div>
          </Modal>
        );
      })()}
    </div>
  );
}
