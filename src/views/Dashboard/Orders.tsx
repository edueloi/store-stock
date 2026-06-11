import { useState, useEffect } from "react";
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

export default function Orders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [tenant, setTenant] = useState<TenantBasic | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<OrderDetail | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelledBy, setCancelledBy] = useState("");
  const [cancelling, setCancelling] = useState(false);

  const fetchOrders = async () => {
    try {
      const res = await fetch("/api/orders", {
        headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
      });
      const data = await res.json();
      setOrders(Array.isArray(data) ? data : []);
      setLoading(false);
    } catch (err) {
       console.error(err);
    }
  };

  const fetchTopSelling = async () => {
    try {
      const res = await fetch("/api/stats/top-selling", {
        headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
      });
      setTopProducts(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchOrders();
    fetchTopSelling();
    fetch("/api/tenant", { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } })
      .then((r) => r.json())
      .then((d) => setTenant(d))
      .catch(() => {});
  }, []);

  const fetchOrderDetails = async (id: number) => {
    try {
      const res = await fetch(`/api/orders/${id}`, {
        headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
      });
      const data = await res.json();
      setSelectedOrder(data);
      setIsDetailModalOpen(true);
    } catch (err) {
      console.error(err);
    }
  };

  const buildWarrantyHtml = (order: OrderDetail) => {
    const storeName   = tenant?.name ?? "Estabelecimento";
    const storeDoc    = tenant?.document ? `CPF/CNPJ: ${tenant.document}` : "";
    const storeAddr   = (() => {
      if (tenant?.address_street) {
        const parts = [
          `${tenant.address_street}${tenant.address_number ? ", " + tenant.address_number : ""}`,
          tenant.address_complement,
          tenant.address_district,
          tenant.address_city && tenant.address_state
            ? `${tenant.address_city} - ${tenant.address_state}`
            : (tenant?.address_city ?? tenant?.address_state ?? ""),
          tenant?.address_zip,
        ].filter(Boolean);
        return parts.join(", ");
      }
      return tenant?.address ?? "";
    })();
    const storePhone  = tenant?.whatsapp ? `WhatsApp: ${tenant.whatsapp}` : "";
    const rawLogo     = tenant?.logo_url ?? "";
    const storeLogo   = rawLogo && !rawLogo.startsWith("http")
      ? `${window.location.origin}${rawLogo}`
      : rawLogo;

    const wp = tenant?.policies ?? {};
    const warrantyDays     = wp.warranty_days ?? 90;
    const resolutionDays   = wp.warranty_resolution_days ?? 30;
    const warrantyTitle    = wp.warranty_title ?? "Termos e Condições de Garantia";
    const defaultClauses   = [
      `A garantia cobre defeitos de fabricação pelo período de <strong>${warrantyDays} dias</strong> a partir da data de emissão deste termo, conforme art. 26 do Código de Defesa do Consumidor (Lei 8.078/90).`,
      "Para acionar a garantia, o cliente deverá apresentar este documento juntamente com comprovante de compra e identificação pessoal.",
      "A garantia não cobre danos causados por uso inadequado, queda, umidade, mau uso, tentativa de conserto por terceiros não autorizados ou desgaste natural do produto.",
      "O produto defeituoso será reparado, substituído por outro de mesma espécie, ou o valor será devolvido, a critério do fornecedor e conforme disponibilidade de estoque.",
      `O prazo para atendimento e resolução é de até <strong>${resolutionDays} dias corridos</strong> após o acionamento da garantia.`,
      "Esta garantia é intransferível e válida somente para o comprador original identificado neste documento.",
    ];
    const rawClauses = wp.warranty_clauses ?? [];
    const clauses = rawClauses.length > 0
      ? rawClauses.map((c) =>
          c.replace(/\{\{warranty_days\}\}/g, String(warrantyDays))
           .replace(/\{\{resolution_days\}\}/g, String(resolutionDays))
        )
      : defaultClauses;
    const warrantyClausesHtml = clauses
      .map((c) => `<div class="warranty-item">${c}</div>`)
      .join("\n  ");

    const orderNum    = String(order.id).padStart(6, "0");
    const orderDate   = new Date(order.created_at).toLocaleDateString("pt-BR");
    const clientName  = order.customer_name || "Consumidor Final";
    const clientPhone = order.customer_phone || "";

    const itemsHtml = order.items.map(item => `
      <tr>
        <td style="padding:8px 10px;border-bottom:1px solid #f0f0f0">${item.product_name}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #f0f0f0;text-align:center">${item.quantity}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #f0f0f0;text-align:right">R$ ${Number(item.unit_price).toFixed(2)}</td>
      </tr>`).join("");

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
  ${storeLogo
    ? `<img src="${storeLogo}" class="logo" alt="Logo"/>`
    : `<div class="logo-placeholder">LOGO</div>`}
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
    const storeName  = tenant?.name ?? 'Estabelecimento';
    const storeDoc   = tenant?.document ? `CNPJ/CPF: ${tenant.document}` : '';
    const storePhone = tenant?.whatsapp ? `Tel/WhatsApp: ${tenant.whatsapp}` : '';
    const storeAddr  = (() => {
      if (tenant?.address_street) {
        const parts = [
          `${tenant.address_street}${tenant.address_number ? ', ' + tenant.address_number : ''}`,
          tenant.address_complement,
          tenant.address_district,
          tenant.address_city && tenant.address_state
            ? `${tenant.address_city} - ${tenant.address_state}`
            : (tenant?.address_city ?? tenant?.address_state ?? ''),
          tenant.address_zip ? `CEP: ${tenant.address_zip}` : '',
        ].filter(Boolean);
        return parts.join(' | ');
      }
      return tenant?.address ?? '';
    })();

    const statusLabel = order.status === 'completed' ? 'PAGO' : order.status === 'pending' ? 'PENDENTE' : 'CANCELADO';

    // Parse payment_method field (format: "method:amount" or "method:amount:installments:brand")
    const parsePayments = (raw?: string) => {
      if (!raw) return [{ label: 'Não informado', amount: '' }];
      return raw.split('|').map(seg => {
        const parts = seg.trim().split(':');
        const method = parts[0]?.toLowerCase() ?? '';
        const amount = parts[1] ? `R$ ${Number(parts[1]).toFixed(2)}` : '';
        const installments = parts[2] ? Number(parts[2]) : 1;
        const brand = parts[3] ?? '';
        let label = '';
        if (method === 'money' || method === 'dinheiro') {
          label = 'Dinheiro';
        } else if (method === 'pix') {
          label = 'PIX';
        } else if (method === 'debit' || method === 'debito') {
          label = brand ? `Débito (${brand})` : 'Cartão de Débito';
        } else if (method === 'credit' || method === 'credito') {
          label = installments > 1
            ? `Crédito ${brand ? '(' + brand + ') ' : ''}– ${installments}x de R$ ${(Number(parts[1]) / installments).toFixed(2)}`
            : brand ? `Crédito (${brand})` : 'Cartão de Crédito';
        } else {
          label = method.charAt(0).toUpperCase() + method.slice(1);
        }
        return { label, amount };
      });
    };

    const payments = parsePayments(order.payment_method);
    const hasDiscount  = order.discount_amount && Number(order.discount_amount) > 0;
    const hasFee       = order.fee_amount && Number(order.fee_amount) > 0;
    const grossAmount  = order.gross_amount ? Number(order.gross_amount) : Number(order.total_amount);

    return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<title>Comprovante #${String(order.id).padStart(5,'0')}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Courier New', monospace; font-size: 12px; width: 80mm; margin: 0 auto; padding: 8px 6px 16px; color: #000; background: #fff; }
  .store-name { font-size: 15px; font-weight: bold; text-align: center; text-transform: uppercase; letter-spacing: 1px; }
  .store-info { font-size: 10px; text-align: center; color: #333; line-height: 1.6; margin-top: 2px; }
  .doc-title { font-size: 13px; font-weight: bold; text-align: center; text-transform: uppercase; letter-spacing: 2px; margin: 8px 0 2px; }
  .doc-sub { font-size: 10px; text-align: center; color: #555; margin-bottom: 2px; }
  .divider { border: none; border-top: 1px dashed #000; margin: 6px 0; }
  .section-title { font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; margin: 4px 0 3px; }
  .row { display: flex; justify-content: space-between; align-items: flex-start; margin: 3px 0; font-size: 11px; }
  .row .lbl { color: #444; white-space: nowrap; margin-right: 6px; }
  .row .val { text-align: right; }
  .item-wrap { margin: 4px 0; }
  .item-name { font-weight: bold; font-size: 11px; }
  .item-qty  { font-size: 10px; color: #555; }
  .item-price { font-weight: bold; text-align: right; white-space: nowrap; font-size: 11px; }
  .total-row { display: flex; justify-content: space-between; font-size: 15px; font-weight: bold; margin: 5px 0; border-top: 1px solid #000; padding-top: 4px; }
  .status-box { text-align: center; font-weight: bold; font-size: 12px; padding: 3px 10px; border: 2px solid #000; display: inline-block; letter-spacing: 2px; }
  .status-wrap { text-align: center; margin: 6px 0 4px; }
  .pay-row { display: flex; justify-content: space-between; font-size: 11px; margin: 3px 0; }
  .pay-label { color: #222; }
  .pay-amount { font-weight: bold; }
  .footer { text-align: center; font-size: 10px; color: #555; margin-top: 12px; line-height: 1.7; }
  .footer strong { display: block; font-size: 11px; color: #000; margin-bottom: 2px; }
  @media print { @page { margin: 0; size: 80mm auto; } body { padding: 6px 4px 12px; } }
</style></head><body>

<div class="store-name">${storeName}</div>
<div class="store-info">
  ${storeDoc ? storeDoc + '<br/>' : ''}
  ${storeAddr ? storeAddr + '<br/>' : ''}
  ${storePhone ? storePhone : ''}
</div>

<hr class="divider"/>
<div class="doc-title">Comprovante de Venda</div>
<div class="doc-sub">Pedido #${String(order.id).padStart(5,'0')}</div>
<div class="doc-sub">${new Date(order.created_at).toLocaleString('pt-BR')}</div>
<div class="status-wrap"><div class="status-box">${statusLabel}</div></div>

<hr class="divider"/>
<div class="section-title">Dados do Cliente</div>
<div class="row"><span class="lbl">Cliente:</span><span class="val"><strong>${order.customer_name || 'Consumidor Final'}</strong></span></div>
${order.customer_phone ? `<div class="row"><span class="lbl">Telefone:</span><span class="val">${order.customer_phone}</span></div>` : ''}
${order.customer_address ? `<div class="row"><span class="lbl">Endereço:</span><span class="val">${order.customer_address}</span></div>` : ''}
${order.seller_name ? `<div class="row"><span class="lbl">Vendedor:</span><span class="val">${order.seller_name}</span></div>` : ''}

<hr class="divider"/>
<div class="section-title">Itens do Pedido</div>
${order.items.map(item => `
<div class="item-wrap">
  <div class="row">
    <span class="item-name">${item.product_name}</span>
    <span class="item-price">R$ ${(item.quantity * Number(item.unit_price)).toFixed(2)}</span>
  </div>
  <div class="item-qty">${item.quantity} un × R$ ${Number(item.unit_price).toFixed(2)}</div>
</div>`).join('')}

<hr class="divider"/>
${hasDiscount || hasFee ? `
<div class="row"><span class="lbl">Subtotal:</span><span class="val">R$ ${grossAmount.toFixed(2)}</span></div>
${hasDiscount ? `<div class="row"><span class="lbl">Desconto:</span><span class="val">- R$ ${Number(order.discount_amount).toFixed(2)}</span></div>` : ''}
${hasFee ? `<div class="row"><span class="lbl">Acréscimo:</span><span class="val">+ R$ ${Number(order.fee_amount).toFixed(2)}</span></div>` : ''}
<hr class="divider"/>` : ''}
<div class="total-row"><span>TOTAL</span><span>R$ ${Number(order.total_amount).toFixed(2)}</span></div>

<hr class="divider"/>
<div class="section-title">Pagamento</div>
${payments.map(p => `
<div class="pay-row">
  <span class="pay-label">${p.label}</span>
  <span class="pay-amount">${p.amount}</span>
</div>`).join('')}

<div class="footer">
  <strong>Obrigado pela preferência!</strong>
  Documento gerado em ${new Date().toLocaleString('pt-BR')}<br/>
  Este documento não tem valor fiscal.
</div>
</body></html>`;
  };

  const handlePrintReceipt = () => {
    if (!selectedOrder) return;
    const html = buildReceiptHtml(selectedOrder);
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
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
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `comprovante-pedido-${String(selectedOrder.id).padStart(6,'0')}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadWarranty = () => {
    if (!selectedOrder) return;
    const html = buildWarrantyHtml(selectedOrder);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `garantia-pedido-${String(selectedOrder.id).padStart(6,'0')}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrintWarranty = () => {
    if (!selectedOrder) return;
    const html = buildWarrantyHtml(selectedOrder);
    const win = window.open('', '_blank', 'width=850,height=1100');
    if (!win) return;
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.onload = () => { win.focus(); win.print(); };
  };

  const handleUpdateStatus = async (id: number, status: string) => {
    try {
      const res = await fetch(`/api/orders/${id}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify({ status })
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
          "Authorization": `Bearer ${localStorage.getItem("token")}`,
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

  const filteredOrders = orders.filter(o => {
    if (selectedStatus !== "all" && o.status !== selectedStatus) return false;
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

  const getStatusStyle = (status: string) => {
    switch(status) {
      case 'completed': return "bg-emerald-50 text-emerald-600 border-emerald-100";
      case 'pending': return "bg-amber-50 text-amber-600 border-amber-100";
      case 'cancelled': return "bg-red-50 text-red-600 border-red-100";
      default: return "bg-gray-50 text-gray-600 border-gray-100";
    }
  };

  const getStatusIcon = (status: string) => {
    switch(status) {
      case 'completed': return <CheckCircle2 size={14} />;
      case 'pending': return <Clock size={14} />;
      case 'cancelled': return <XCircle size={14} />;
      default: return null;
    }
  };

  if (loading) return <div className="p-8 text-center text-xs font-bold uppercase tracking-widest text-slate-400">Puxando Fluxo de Pedidos...</div>;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pedidos"
        subtitle="Gestão e acompanhamento de vendas"
        action={
          <button className="h-9 bg-white border border-slate-200 px-4 rounded-xl flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest hover:bg-slate-50 transition-all text-slate-600 shadow-sm">
            <Download size={13} /> Exportar
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
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6">Resumo de Pedidos</p>
               <div className="grid grid-cols-3 gap-4 sm:gap-12">
                  <div className="space-y-1">
                     <h3 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tighter">{orders.length}</h3>
                     <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total</p>
                  </div>
                  <div className="space-y-1">
                     <h3 className="text-2xl sm:text-4xl font-black text-amber-500 tracking-tighter">{orders.filter(o => o.status === 'pending').length}</h3>
                     <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Pendente</p>
                  </div>
                  <div className="space-y-1">
                     <h3 className="text-2xl sm:text-4xl font-black text-emerald-500 tracking-tighter">{orders.filter(o => o.status === 'completed').length}</h3>
                     <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Pago</p>
                  </div>
               </div>
            </div>
            <div className="mt-8 flex flex-wrap gap-2">
               {['all', 'pending', 'completed', 'cancelled'].map(status => (
                  <button 
                    key={status}
                    onClick={() => setSelectedStatus(status)}
                    className={cn(
                      "px-4 h-9 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border shrink-0",
                      selectedStatus === status ? "bg-slate-900 text-white border-slate-900 shadow-xl shadow-slate-200" : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                    )}
                  >
                    {status === 'all' ? 'Tudo' : status === 'pending' ? 'Pendentes' : status === 'completed' ? 'Efetivados' : 'Cancelados'}
                  </button>
               ))}
            </div>
         </div>

         <div className="bg-slate-900 rounded-[32px] p-6 lg:p-8 text-white shadow-2xl shadow-slate-200 flex flex-col justify-between">
            <div>
               <div className="flex items-center justify-between mb-6">
                  <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em]">Mais Vendidos</p>
                  <CartIcon size={16} className="text-blue-400" />
               </div>
               <div className="space-y-4">
                  {topProducts.map((p, i) => (
                    <div key={i} className="flex items-center justify-between group">
                       <div className="flex items-center gap-3">
                          <span className="text-[8px] font-black text-slate-500 w-4">0{i+1}</span>
                          <span className="text-[11px] font-bold uppercase truncate max-w-[120px] text-slate-300 group-hover:text-white transition-colors">{p.name}</span>
                       </div>
                       <span className="text-[10px] font-mono font-black text-blue-400 px-2.5 py-1 rounded-lg bg-blue-400/10 leading-none">{p.total_sold} UN</span>
                    </div>
                  ))}
                  {topProducts.length === 0 && (
                     <p className="text-[10px] text-slate-600 py-6 uppercase font-black tracking-widest text-center border border-dashed border-slate-800 rounded-2xl">Nenhuma venda ainda</p>
                  )}
               </div>
            </div>
            <button className="mt-8 w-full h-10 bg-white/5 hover:bg-white/10 text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border border-white/10">Ver Relatório</button>
         </div>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
        <input 
          type="text" 
          placeholder="Buscar Transação por ID ou Nome do Destinatário..." 
          className="w-full pl-12 pr-4 h-12 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 text-[10px] font-bold uppercase tracking-widest placeholder:text-slate-300 shadow-sm"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Desktop View Table */}
      <div className="hidden lg:block bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col transition-all hover:shadow-md">
        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Pedido</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Cliente</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Data</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Total</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Status</th>
                <th className="px-8 py-5 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-slate-700">
              {filteredOrders.map((order) => (
                <tr 
                  key={order.id} 
                  onClick={() => fetchOrderDetails(order.id)}
                  className="hover:bg-blue-50/30 transition-colors group cursor-pointer"
                >
                  <td className="px-8 py-6">
                    <span className="font-mono font-black text-xs text-slate-400 group-hover:text-blue-600 transition-colors">#{String(order.id).padStart(6, '0')}</span>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex flex-col">
                       <span className="font-black text-xs text-slate-900 uppercase tracking-tight">{order.customer_name || "Consumidor Final"}</span>
                       <span className="text-[9px] text-slate-400 font-bold uppercase mt-1 tracking-widest bg-slate-100 px-1.5 py-0.5 rounded w-fit">{order.customer_phone || "VENDA BALCÃO"}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-[10px] font-mono font-black text-slate-500 uppercase">
                    {new Date(order.created_at).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-8 py-6">
                    <span className="font-mono font-black text-sm text-slate-900 tracking-tighter">R$ {Number(order.total_amount).toFixed(2)}</span>
                  </td>
                  <td className="px-8 py-6">
                    <div className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border w-fit shadow-sm",
                      getStatusStyle(order.status)
                    )}>
                      {getStatusIcon(order.status)}
                      <span>{order.status === 'completed' ? 'PAGO' : order.status === 'pending' ? 'PENDENTE' : 'ESTORNO'}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-right">
                     <div className="flex justify-end opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
                        <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-lg">
                           <ChevronRight size={18} strokeWidth={3} />
                        </div>
                     </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Card-Based List */}
      <div className="lg:hidden space-y-4 pb-12">
        {filteredOrders.map((order) => (
          <motion.div 
            layout
            key={order.id}
            onClick={() => fetchOrderDetails(order.id)}
            className="bg-white p-5 rounded-[28px] border border-slate-200 shadow-sm active:scale-95 transition-all"
          >
            <div className="flex justify-between items-start mb-4">
              <div className="space-y-1">
                <span className="text-[10px] font-mono font-black text-slate-300">#{String(order.id).padStart(6, '0')}</span>
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-tight">{order.customer_name || "Cliente Balcão"}</h4>
              </div>
              <div className={cn(
                "px-3 py-1.5 rounded-xl text-[8px] font-black uppercase tracking-widest border shadow-sm flex items-center gap-1.5",
                getStatusStyle(order.status)
              )}>
                {getStatusIcon(order.status)}
                {order.status === 'completed' ? 'PAGO' : order.status === 'pending' ? 'PEND' : 'CANCL'}
              </div>
            </div>

            <div className="flex justify-between items-end pt-4 border-t border-slate-50">
               <div className="space-y-1">
                  <div className="flex items-center gap-2 text-slate-400">
                    <Clock size={10} />
                    <span className="text-[9px] font-mono font-bold uppercase">{new Date(order.created_at).toLocaleDateString('pt-BR')}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-400">
                    <CreditCard size={10} />
                    <span className="text-[9px] font-black uppercase tracking-tighter">{order.payment_method || 'Cartão'}</span>
                  </div>
               </div>
               <div className="text-right">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Montante Líquido</p>
                  <p className="text-xl font-mono font-black text-slate-900 tracking-tighter">R$ {Number(order.total_amount).toFixed(2)}</p>
               </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Details Modal */}
      <AnimatePresence>
         {isDetailModalOpen && selectedOrder && (
            <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-end bg-slate-900/40 backdrop-blur-xs">
               <motion.div
                 initial={{ y: "100%", x: 0 }}
                 animate={{ y: 0, x: 0 }}
                 exit={{ y: "100%", x: 0 }}
                 className="bg-white w-full max-h-[92dvh] sm:max-h-full sm:h-full sm:max-w-lg shadow-2xl flex flex-col rounded-t-2xl sm:rounded-none sm:border-l border-slate-200 overflow-hidden"
               >
                  <div className="px-8 py-6 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                     <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Detalhes do Pedido</p>
                        <h4 className="text-xl font-black text-slate-900 tracking-tighter">ORD #{String(selectedOrder.id).padStart(5, '0')}</h4>
                     </div>
                     <button onClick={() => setIsDetailModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-all text-slate-400"><X size={20} /></button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-6 space-y-5 no-scrollbar">

                     {/* Status bar */}
                     <div className={cn(
                       "p-4 rounded-2xl border flex items-center justify-between",
                       selectedOrder.status === 'completed' ? "bg-emerald-50 border-emerald-100" :
                       selectedOrder.status === 'cancelled' ? "bg-red-50 border-red-100" : "bg-amber-50 border-amber-100"
                     )}>
                        <div className="flex items-center gap-2.5">
                           <div className={cn("w-2.5 h-2.5 rounded-full", selectedOrder.status === 'completed' ? 'bg-emerald-500' : selectedOrder.status === 'pending' ? 'bg-amber-500' : 'bg-red-500')} />
                           <span className={cn("text-[10px] font-black uppercase tracking-widest", selectedOrder.status === 'completed' ? 'text-emerald-700' : selectedOrder.status === 'cancelled' ? 'text-red-700' : 'text-amber-700')}>
                             {selectedOrder.status === 'completed' ? 'Pago' : selectedOrder.status === 'pending' ? 'Pendente' : 'Cancelado / Estornado'}
                           </span>
                        </div>
                        <div className="flex gap-2">
                           {selectedOrder.status === 'pending' && (
                             <button onClick={() => handleUpdateStatus(selectedOrder.id, 'completed')}
                               className="px-3 h-8 bg-emerald-600 text-white rounded-lg text-[9px] font-black uppercase tracking-widest shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all">
                               Efetivar
                             </button>
                           )}
                           {selectedOrder.status !== 'cancelled' && (
                             <button onClick={() => setShowCancelModal(true)}
                               className="px-3 h-8 bg-red-50 text-red-600 border border-red-200 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-red-100 transition-all">
                               Cancelar
                             </button>
                           )}
                        </div>
                     </div>

                     {/* Cancelled info */}
                     {selectedOrder.status === 'cancelled' && (selectedOrder.cancel_reason || selectedOrder.cancelled_by) && (
                       <div className="p-4 bg-red-50 border border-red-100 rounded-2xl space-y-1.5">
                         <p className="text-[9px] font-black uppercase tracking-widest text-red-600 flex items-center gap-1.5"><AlertTriangle size={11} /> Motivo do Cancelamento</p>
                         {selectedOrder.cancelled_by && <p className="text-[10px] font-bold text-red-800">Por: {selectedOrder.cancelled_by}</p>}
                         {selectedOrder.cancel_reason && <p className="text-[10px] text-red-700">{selectedOrder.cancel_reason}</p>}
                         {selectedOrder.cancelled_at && <p className="text-[9px] text-red-400 font-mono">{new Date(selectedOrder.cancelled_at).toLocaleString("pt-BR")}</p>}
                       </div>
                     )}

                     {/* Customer + Seller */}
                     <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 bg-slate-50 rounded-xl space-y-1">
                           <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><User size={9} /> Cliente</p>
                           <p className="text-xs font-black text-slate-900 uppercase">{selectedOrder.customer_name || "Consumidor Final"}</p>
                           {selectedOrder.customer_phone && <p className="text-[10px] font-mono text-slate-500">{selectedOrder.customer_phone}</p>}
                        </div>
                        <div className="p-3 bg-slate-50 rounded-xl space-y-1">
                           <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Vendedor</p>
                           <p className="text-xs font-black text-slate-900 uppercase">{selectedOrder.seller_name || "—"}</p>
                           <p className="text-[9px] font-mono text-slate-400">{new Date(selectedOrder.created_at).toLocaleString("pt-BR")}</p>
                        </div>
                     </div>

                     {/* Items */}
                     <div className="space-y-2">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Package size={10} /> Itens ({selectedOrder.items.length})</p>
                        <div className="border border-slate-100 rounded-xl overflow-hidden divide-y divide-slate-50">
                           {selectedOrder.items.map(item => (
                             <div key={item.id} className="px-4 py-3 flex items-center justify-between">
                                <div>
                                   <p className="text-[11px] font-black text-slate-900 uppercase">{item.product_name}</p>
                                   <p className="text-[9px] font-bold text-slate-400 uppercase">{item.quantity} × R$ {Number(item.unit_price).toFixed(2)}</p>
                                </div>
                                <span className="font-mono font-black text-sm text-slate-900">R$ {(item.quantity * Number(item.unit_price)).toFixed(2)}</span>
                             </div>
                           ))}
                        </div>
                     </div>

                     {/* Payment method + installments breakdown */}
                     {(() => {
                       const pm = selectedOrder.payment_method ?? "";
                       const segs = pm.split("|").map(seg => {
                         const [mp, amt] = seg.split(":");
                         const toks = mp.split("-");
                         return { method: toks[0]??"-", brand: toks[1]??null, installments: toks[2] ? parseInt(toks[2]) : 1, amount: parseFloat(amt??"0")||0 };
                       });
                       const labels: Record<string,string> = { money:"Dinheiro", pix:"PIX", debit:"Débito", credit:"Crédito" };
                       return (
                         <div className="space-y-2">
                           <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><CreditCard size={10} /> Pagamento</p>
                           <div className="space-y-2">
                             {segs.map((s, i) => {
                               const perInst = s.installments > 1 ? s.amount / s.installments : 0;
                               return (
                                 <div key={i} className="p-3 bg-slate-50 rounded-xl flex items-center justify-between gap-2">
                                   <div>
                                     <p className="text-[10px] font-black text-slate-900 uppercase">
                                       {labels[s.method]??s.method}
                                       {s.brand && s.brand !== "other" ? ` / ${s.brand.toUpperCase()}` : ""}
                                       {s.method==="credit" && s.installments>1 ? ` · ${s.installments}×` : ""}
                                     </p>
                                     {s.installments > 1 && (
                                       <p className="text-[9px] font-bold text-slate-500">R$ {perInst.toFixed(2)}/parcela</p>
                                     )}
                                   </div>
                                   <span className="font-mono font-black text-slate-900">R$ {s.amount.toFixed(2)}</span>
                                 </div>
                               );
                             })}
                           </div>
                         </div>
                       );
                     })()}

                     {/* Financial summary */}
                     <div className="bg-slate-900 rounded-2xl p-5 space-y-3">
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Resumo Financeiro</p>
                        {selectedOrder.gross_amount != null && Number(selectedOrder.gross_amount) !== Number(selectedOrder.total_amount) && (
                          <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
                            <span className="text-slate-500">Subtotal Bruto</span>
                            <span className="font-mono text-slate-400">R$ {Number(selectedOrder.gross_amount).toFixed(2)}</span>
                          </div>
                        )}
                        {selectedOrder.discount_amount != null && Number(selectedOrder.discount_amount) > 0 && (
                          <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
                            <span className="text-rose-400">Desconto</span>
                            <span className="font-mono text-rose-400">− R$ {Number(selectedOrder.discount_amount).toFixed(2)}</span>
                          </div>
                        )}
                        {selectedOrder.fee_amount != null && Number(selectedOrder.fee_amount) > 0 && (
                          <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
                            <span className="text-amber-400">Taxa Maquininha</span>
                            <span className="font-mono text-amber-400">− R$ {Number(selectedOrder.fee_amount).toFixed(2)}</span>
                          </div>
                        )}
                        <div className="flex justify-between items-center pt-2 border-t border-slate-700">
                          <span className="text-[10px] font-black uppercase tracking-widest text-blue-400">Líquido</span>
                          <span className="text-2xl font-black font-mono text-white">R$ {Number(selectedOrder.total_amount).toFixed(2)}</span>
                        </div>
                     </div>

                  </div>

                  <div className="p-6 border-t border-slate-100 bg-slate-50 space-y-2">
                     {/* Comprovante row */}
                     <div className="flex gap-2">
                       <button
                         onClick={handleDownloadReceipt}
                         className="flex-1 h-10 bg-white border border-slate-200 rounded-xl text-[9px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-slate-50 transition-all text-slate-600 shadow-sm"
                       >
                         <Download size={13} /> Comprovante
                       </button>
                       <button
                         onClick={handlePrintReceipt}
                         className="flex-1 h-10 bg-slate-900 text-white rounded-xl text-[9px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-slate-800 transition-all shadow-lg"
                       >
                         <Receipt size={13} /> Imprimir
                       </button>
                     </div>
                     {/* Garantia row */}
                     <div className="flex gap-2">
                       <button
                         onClick={handleDownloadWarranty}
                         className="flex-1 h-10 bg-emerald-50 border border-emerald-200 rounded-xl text-[9px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-emerald-100 transition-all text-emerald-700 shadow-sm"
                       >
                         <Download size={13} /> Baixar Garantia
                       </button>
                       <button
                         onClick={handlePrintWarranty}
                         className="flex-1 h-10 bg-emerald-600 text-white rounded-xl text-[9px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200"
                       >
                         <ShieldCheck size={13} /> Imprimir Garantia
                       </button>
                     </div>
                  </div>
               </motion.div>
            </div>
         )}
      </AnimatePresence>

      {/* Cancel confirmation modal */}
      <AnimatePresence>
        {showCancelModal && selectedOrder && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center px-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.92 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden"
            >
              <div className="px-6 py-5 bg-red-50 border-b border-red-100 flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-red-100 flex items-center justify-center">
                  <AlertTriangle size={18} className="text-red-600" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest">Cancelar Pedido</p>
                  <p className="text-sm font-black text-red-900">#{String(selectedOrder.id).padStart(6, "0")}</p>
                </div>
              </div>
              <div className="p-6 space-y-4">
                <p className="text-[10px] text-slate-500 font-bold leading-relaxed">
                  Esta ação irá cancelar o pedido, reverter o estoque dos produtos e registrar um estorno no fluxo de caixa.
                </p>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Cancelado por</label>
                  <input
                    type="text"
                    value={cancelledBy}
                    onChange={e => setCancelledBy(e.target.value)}
                    placeholder="Nome do responsável"
                    className="w-full h-10 px-3 border border-slate-200 rounded-xl text-[11px] font-medium outline-none focus:border-red-400 bg-slate-50 transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Motivo do cancelamento</label>
                  <textarea
                    value={cancelReason}
                    onChange={e => setCancelReason(e.target.value)}
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
                    className="flex-1 h-10 bg-red-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {cancelling ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
                    Confirmar Cancelamento
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
