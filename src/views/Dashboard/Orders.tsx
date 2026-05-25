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
  <strong>Termos e Condições de Garantia</strong>
  <div class="warranty-item">A garantia cobre defeitos de fabricação pelo período de <strong>90 (noventa) dias</strong> a partir da data de emissão deste termo, conforme art. 26 do Código de Defesa do Consumidor (Lei 8.078/90).</div>
  <div class="warranty-item">Para acionar a garantia, o cliente deverá apresentar este documento juntamente com comprovante de compra e identificação pessoal.</div>
  <div class="warranty-item">A garantia não cobre danos causados por uso inadequado, queda, umidade, mau uso, tentativa de conserto por terceiros não autorizados ou desgaste natural do produto.</div>
  <div class="warranty-item">O produto defeituoso será reparado, substituído por outro de mesma espécie, ou o valor será devolvido, a critério do fornecedor e conforme disponibilidade de estoque.</div>
  <div class="warranty-item">O prazo para atendimento e resolução é de até <strong>30 (trinta) dias corridos</strong> após o acionamento da garantia.</div>
  <div class="warranty-item">Esta garantia é intransferível e válida somente para o comprador original identificado neste documento.</div>
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
    const statusLabel = order.status === 'completed' ? 'PAGO' : order.status === 'pending' ? 'PENDENTE' : 'CANCELADO';
    const paymentLabel = order.payment_method || 'Não informado';
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Comprovante #${String(order.id).padStart(5,'0')}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Courier New', monospace; font-size: 13px; max-width: 320px; margin: 0 auto; padding: 20px 16px; color: #000; background: #fff; }
  h1 { font-size: 15px; text-align: center; margin: 0 0 2px; text-transform: uppercase; letter-spacing: 2px; }
  .subtitle { text-align: center; font-size: 11px; color: #555; margin: 0 0 4px; }
  .center { text-align: center; }
  .divider { border: none; border-top: 1px dashed #000; margin: 10px 0; }
  .row { display: flex; justify-content: space-between; align-items: flex-start; margin: 4px 0; font-size: 12px; }
  .row .label { color: #555; }
  .item-name { font-weight: bold; font-size: 12px; }
  .item-sub { font-size: 11px; color: #555; }
  .item-price { font-weight: bold; text-align: right; white-space: nowrap; }
  .total-row { display: flex; justify-content: space-between; font-size: 15px; font-weight: bold; margin: 6px 0; }
  .status-box { text-align: center; font-weight: bold; font-size: 13px; padding: 5px 10px; border: 2px solid #000; display: inline-block; margin: 6px auto; }
  .status-wrap { text-align: center; margin: 8px 0; }
  .footer { text-align: center; font-size: 10px; color: #777; margin-top: 18px; line-height: 1.6; }
  @media print { @page { margin: 0; size: 80mm auto; } body { padding: 10px 8px; } }
</style></head><body>
<h1>Comprovante de Venda</h1>
<p class="subtitle">Pedido #${String(order.id).padStart(5,'0')}</p>
<p class="subtitle">${new Date(order.created_at).toLocaleString('pt-BR')}</p>
<div class="status-wrap"><div class="status-box">${statusLabel}</div></div>
<hr class="divider"/>
<div class="row"><span class="label">Cliente:</span><span><strong>${order.customer_name || 'Consumidor Final'}</strong></span></div>
${order.customer_phone ? `<div class="row"><span class="label">Telefone:</span><span>${order.customer_phone}</span></div>` : ''}
${order.customer_address ? `<div class="row"><span class="label">Endereço:</span><span>${order.customer_address}</span></div>` : ''}
<hr class="divider"/>
<p style="font-weight:bold;margin:4px 0;font-size:11px;text-transform:uppercase;letter-spacing:1px">Itens do Pedido</p>
${order.items.map(item => `
<div style="margin:6px 0">
  <div class="row"><span class="item-name">${item.product_name}</span><span class="item-price">R$ ${(item.quantity * Number(item.unit_price)).toFixed(2)}</span></div>
  <div class="item-sub">${item.quantity} un × R$ ${Number(item.unit_price).toFixed(2)}</div>
</div>`).join('')}
<hr class="divider"/>
<div class="row"><span class="label">Pagamento:</span><span><strong>${paymentLabel}</strong></span></div>
<hr class="divider"/>
<div class="total-row"><span>TOTAL</span><span>R$ ${Number(order.total_amount).toFixed(2)}</span></div>
<p class="footer">Obrigado pela preferência!<br/>Documento gerado em ${new Date().toLocaleString('pt-BR')}</p>
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

                  <div className="flex-1 overflow-y-auto p-8 space-y-8 no-scrollbar">
                     {/* Status Control */}
                     <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                           <div className={cn("w-3 h-3 rounded-full", selectedOrder.status === 'completed' ? 'bg-emerald-500' : selectedOrder.status === 'pending' ? 'bg-amber-500' : 'bg-red-500')}></div>
                           <span className="text-[10px] font-bold uppercase tracking-widest text-slate-600">Status: {selectedOrder.status === 'completed' ? 'Pago' : selectedOrder.status === 'pending' ? 'Pendente' : 'Cancelado'}</span>
                        </div>
                        <div className="flex gap-2">
                           {selectedOrder.status === 'pending' && (
                             <button 
                               onClick={() => handleUpdateStatus(selectedOrder.id, 'completed')}
                               className="px-3 h-8 bg-emerald-600 text-white rounded text-[9px] font-bold uppercase tracking-widest shadow-lg shadow-emerald-200"
                             >Efetivar</button>
                           )}
                           {selectedOrder.status !== 'cancelled' && (
                             <button 
                               onClick={() => handleUpdateStatus(selectedOrder.id, 'cancelled')}
                               className="px-3 h-8 bg-red-50 text-red-600 border border-red-100 rounded text-[9px] font-bold uppercase tracking-widest"
                             >Cancelar</button>
                           )}
                        </div>
                     </div>

                     {/* Customer Info */}
                     <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-1">
                           <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Cliente</p>
                           <p className="text-xs font-bold text-slate-900 uppercase">{selectedOrder.customer_name || "Consumidor Final"}</p>
                        </div>
                        <div className="space-y-1">
                           <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Contato</p>
                           <p className="text-xs font-mono font-bold text-slate-900">{selectedOrder.customer_phone || "--"}</p>
                        </div>
                        <div className="space-y-1 col-span-2">
                           <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Endereço</p>
                           <p className="text-xs font-medium text-slate-600 leading-relaxed uppercase">{selectedOrder.customer_address || "Retirada em loja / Balcão"}</p>
                        </div>
                     </div>

                     {/* Items List */}
                     <div className="space-y-4">
                        <p className="text-[10px] font-bold text-slate-900 uppercase tracking-widest flex items-center gap-2">
                           <Package size={14} className="text-slate-400" /> Itens do Pedido ({selectedOrder.items.length})
                        </p>
                        <div className="border border-slate-100 rounded-xl overflow-hidden divide-y divide-slate-50">
                           {selectedOrder.items.map(item => (
                             <div key={item.id} className="p-4 flex items-center justify-between text-xs">
                                <div className="flex flex-col">
                                   <span className="font-bold text-slate-900 uppercase tracking-tight">{item.product_name}</span>
                                   <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{item.quantity} x R$ {Number(item.unit_price).toFixed(2)}</span>
                                </div>
                                <span className="font-mono font-bold text-slate-900 bg-slate-50 px-2 py-1 rounded">R$ {(item.quantity * Number(item.unit_price)).toFixed(2)}</span>
                             </div>
                           ))}
                        </div>
                     </div>

                     {/* Financial Info */}
                     <div className="p-6 bg-slate-900 rounded-2xl text-white space-y-4">
                        <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-slate-400">
                           <span>Método</span>
                           <span className="flex items-center gap-2 text-white"><CreditCard size={12} /> {selectedOrder.payment_method}</span>
                        </div>
                        <div className="flex justify-between items-center">
                           <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-blue-400">Total</span>
                           <span className="text-2xl font-black font-mono tracking-tighter">R$ {Number(selectedOrder.total_amount).toFixed(2)}</span>
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
    </div>
  );
}
