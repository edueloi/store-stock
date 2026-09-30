export interface WarrantyPolicy {
  warranty_days?: number;
  warranty_resolution_days?: number;
  warranty_title?: string;
  warranty_clauses?: string[];
}

export interface WarrantyDocumentTenant {
  name?: string;
  document?: string;
  logo_url?: string;
  whatsapp?: string;
  address?: string;
  address_street?: string;
  address_number?: string;
  address_complement?: string;
  address_district?: string;
  address_city?: string;
  address_state?: string;
  address_zip?: string;
  primary_color?: string;
  policies?: WarrantyPolicy;
}

export interface WarrantyDocumentItem {
  product_name?: string;
  name?: string;
  quantity: number;
  unit_price?: number | string;
  price?: number | string;
}

export interface WarrantyDocumentOrder {
  id: number;
  created_at?: string;
  customer_name?: string | null;
  customer_phone?: string | null;
  payment_method?: string | null;
  total_amount: number | string;
  items?: WarrantyDocumentItem[];
}

const escapeHtml = (value: unknown) => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/\"/g, "&quot;")
  .replace(/'/g, "&#039;");

const money = (value: number | string) => Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const formatQuantity = (value: number) => Number(value || 0).toLocaleString("pt-BR", { maximumFractionDigits: 3 });

function formatPayment(payment?: string | null) {
  if (!payment) return "Não informado";
  const labels: Record<string, string> = { money: "Dinheiro", pix: "PIX", debit: "Débito", credit: "Crédito", crediario: "Crediário" };
  return payment.split("|").map((segment) => {
    const [methodPart] = segment.trim().split(":");
    const [method, brand, installments] = methodPart.split("-");
    const brandLabel = brand && brand !== "other" ? ` · ${brand.toUpperCase()}` : "";
    const installmentLabel = method === "credit" && installments ? ` · ${installments.toUpperCase()}` : "";
    return `${labels[method] ?? method}${brandLabel}${installmentLabel}`;
  }).join(" + ");
}

function addressOf(tenant: WarrantyDocumentTenant) {
  if (!tenant.address_street) return tenant.address || "";
  return [
    `${tenant.address_street}${tenant.address_number ? `, ${tenant.address_number}` : ""}`,
    tenant.address_complement,
    tenant.address_district,
    tenant.address_city && tenant.address_state ? `${tenant.address_city} - ${tenant.address_state}` : (tenant.address_city || tenant.address_state),
    tenant.address_zip,
  ].filter(Boolean).join(" · ");
}

/** Documento A4 compacto e objetivo, compartilhado por Pedidos e pelo fechamento do PDV. */
export function buildWarrantyDocumentHtml(tenant: WarrantyDocumentTenant, order: WarrantyDocumentOrder) {
  const policy = tenant.policies ?? {};
  const warrantyDays = Number(policy.warranty_days) > 0 ? Number(policy.warranty_days) : 90;
  const resolutionDays = Number(policy.warranty_resolution_days) > 0 ? Number(policy.warranty_resolution_days) : 30;
  const title = policy.warranty_title?.trim() || "Garantia de compra";
  const issuedAt = order.created_at ? new Date(order.created_at) : new Date();
  const expiresAt = new Date(issuedAt);
  expiresAt.setDate(expiresAt.getDate() + warrantyDays);
  const storeName = tenant.name?.trim() || "Estabelecimento";
  const accent = /^#[0-9a-f]{6}$/i.test(tenant.primary_color ?? "") ? tenant.primary_color! : "#111827";
  const rawLogo = tenant.logo_url ?? "";
  const logo = rawLogo && !rawLogo.startsWith("http") ? `${window.location.origin}${rawLogo}` : rawLogo;
  const defaultClauses = [
    `Esta garantia cobre defeitos de fabricação pelo período de ${warrantyDays} dias, contado a partir da data da compra.`,
    "Para solicitar atendimento, apresente este certificado, o comprovante de compra e a identificação do titular.",
    "A garantia não cobre mau uso, quedas, umidade, desgaste natural ou reparos feitos por terceiros não autorizados.",
    `O atendimento será realizado conforme as condições aplicáveis e em até ${resolutionDays} dias após a análise do produto.`,
  ];
  const clauses = (policy.warranty_clauses?.filter(Boolean).length ? policy.warranty_clauses : defaultClauses)!
    .map((clause) => escapeHtml(clause)
      .replace(/\{\{warranty_days\}\}/g, String(warrantyDays))
      .replace(/\{\{resolution_days\}\}/g, String(resolutionDays))
      .replace(/\n/g, "<br/>")
    );
  const orderNumber = String(order.id).padStart(6, "0");
  const customerName = order.customer_name?.trim() || "Consumidor final";
  const items = Array.isArray(order.items) ? order.items.filter(Boolean) : [];
  const itemRows = items.length
    ? items.map((item) => {
      const name = item.product_name ?? item.name ?? "Item sem identificação";
      const unit = Number(item.unit_price ?? item.price ?? 0);
      const itemQuantity = Number(item.quantity ?? 0);
      return `<tr><td>${escapeHtml(name)}</td><td class="quantity">${formatQuantity(itemQuantity)}</td><td class="value">${money(unit)}</td><td class="value">${money(unit * itemQuantity)}</td></tr>`;
    }).join("")
    : `<tr><td colspan="4" class="empty">Itens não disponíveis neste pedido. Consulte o comprovante de venda.</td></tr>`;

  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"/><title>Garantia — Pedido #${orderNumber}</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#fff;color:#1f2937;font-family:Arial,Helvetica,sans-serif;font-size:10px;line-height:1.32}.sheet{width:794px;margin:0 auto;padding:26px 34px;background:#fff}.header{display:flex;justify-content:space-between;align-items:flex-start;gap:18px;padding-bottom:11px;border-bottom:2px solid ${accent}}.brand{display:flex;align-items:flex-start;gap:10px;min-width:0}.logo{width:40px;height:40px;object-fit:contain;flex:0 0 auto}.logo-placeholder{width:40px;height:40px;background:${accent};color:#fff;display:grid;place-items:center;font-size:16px;font-weight:700}.brand-name{font-size:16px;font-weight:700;line-height:1.18}.brand-meta{max-width:405px;margin-top:3px;color:#4b5563;font-size:8.5px;line-height:1.42}.document{text-align:right;white-space:nowrap}.document-label{font-size:8px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#4b5563}.document-number{margin-top:2px;font-size:14px;font-weight:700;color:#111827}.title{display:flex;align-items:baseline;justify-content:space-between;gap:18px;margin:17px 0 11px}.title h1{margin:0;color:#111827;font-size:20px;line-height:1.1;font-weight:700}.title p{margin:0;color:#4b5563;font-size:9px;text-align:right}.summary{display:grid;grid-template-columns:repeat(3,1fr);border-top:1px solid #9ca3af;border-bottom:1px solid #9ca3af}.summary div{padding:7px 10px}.summary div+div{border-left:1px solid #d1d5db}.summary span{display:block;color:#6b7280;font-size:7.5px;font-weight:700;letter-spacing:.8px;text-transform:uppercase}.summary strong{display:block;margin-top:2px;color:#111827;font-size:10px}.section{margin-top:15px}.section h2{margin:0 0 5px;color:#111827;font-size:9px;font-weight:700;letter-spacing:.75px;text-transform:uppercase}.details{display:grid;grid-template-columns:1fr 1fr;border-top:1px solid #9ca3af;border-left:1px solid #9ca3af}.detail{min-height:35px;padding:6px 8px;border-right:1px solid #d1d5db;border-bottom:1px solid #d1d5db}.detail span{display:inline;color:#6b7280;font-size:7.5px;font-weight:700;letter-spacing:.6px;text-transform:uppercase}.detail strong{margin-left:5px;font-size:9.5px;font-weight:700;color:#1f2937}.items{width:100%;border-collapse:collapse;border-top:1.5px solid ${accent};border-bottom:1.5px solid ${accent}}.items th{padding:6px 8px;text-align:left;font-size:7.5px;font-weight:700;letter-spacing:.7px;text-transform:uppercase;color:#374151;border-bottom:1px solid #9ca3af}.items td{padding:6px 8px;border-bottom:1px solid #e5e7eb;vertical-align:top}.items tbody tr:last-child td{border-bottom:1px solid #9ca3af}.items .quantity{text-align:center;width:50px}.items .value{text-align:right;white-space:nowrap;width:86px}.items tfoot td{padding:7px 8px;font-size:10px;font-weight:700}.empty{text-align:center;color:#6b7280;font-style:italic;padding:10px!important}.clauses{margin:0;padding-left:16px;border-top:1px solid #9ca3af}.clauses li{padding:5px 1px;border-bottom:1px solid #e5e7eb;color:#374151}.support{margin-top:15px;padding:8px 10px;border:1px solid #d1d5db;font-size:9px}.support strong{color:#111827}.support span{margin-left:4px;color:#4b5563}.footer{margin-top:18px;padding-top:8px;border-top:1px solid #d1d5db;text-align:center;color:#6b7280;font-size:8px}@media print{@page{size:A4;margin:0}body{background:#fff}.sheet{margin:0}}
</style></head><body><main class="sheet"><header class="header"><div class="brand">${logo ? `<img class="logo" src="${escapeHtml(logo)}" alt="Logo"/>` : `<div class="logo-placeholder">${escapeHtml(storeName.slice(0, 1).toUpperCase())}</div>`}<div><div class="brand-name">${escapeHtml(storeName)}</div><div class="brand-meta">${escapeHtml(addressOf(tenant))}${tenant.document ? `<br/>CNPJ/CPF: ${escapeHtml(tenant.document)}` : ""}${tenant.whatsapp ? `<br/>WhatsApp: ${escapeHtml(tenant.whatsapp)}` : ""}</div></div></div><div class="document"><div class="document-label">Certificado de garantia</div><div class="document-number">#${orderNumber}</div></div></header><section class="title"><h1>${escapeHtml(title)}</h1><p>Pedido #${orderNumber} · Emitido em ${issuedAt.toLocaleDateString("pt-BR")}</p></section><section class="summary"><div><span>Prazo de cobertura</span><strong>${warrantyDays} dias</strong></div><div><span>Válida até</span><strong>${expiresAt.toLocaleDateString("pt-BR")}</strong></div><div><span>Prazo de atendimento</span><strong>Até ${resolutionDays} dias</strong></div></section><section class="section"><h2>Dados da compra</h2><div class="details"><div class="detail"><span>Cliente:</span><strong>${escapeHtml(customerName)}</strong></div><div class="detail"><span>Contato:</span><strong>${escapeHtml(order.customer_phone || "Não informado")}</strong></div><div class="detail"><span>Data:</span><strong>${issuedAt.toLocaleDateString("pt-BR")}</strong></div><div class="detail"><span>Pagamento:</span><strong>${escapeHtml(formatPayment(order.payment_method))}</strong></div></div></section><section class="section"><h2>Itens cobertos</h2><table class="items"><thead><tr><th>Produto ou serviço</th><th class="quantity">Qtd.</th><th class="value">Unitário</th><th class="value">Total</th></tr></thead><tbody>${itemRows}</tbody><tfoot><tr><td colspan="3">Valor da compra</td><td class="value">${money(order.total_amount)}</td></tr></tfoot></table></section><section class="section"><h2>Condições da garantia</h2><ol class="clauses">${clauses.map((clause) => `<li>${clause}</li>`).join("")}</ol></section><section class="support"><strong>Atendimento:</strong><span>Fale com ${escapeHtml(storeName)}${tenant.whatsapp ? ` pelo WhatsApp ${escapeHtml(tenant.whatsapp)}` : ""} e informe o certificado #${orderNumber}.</span></section><footer class="footer">Documento emitido eletronicamente por ${escapeHtml(storeName)} · Vinculado ao pedido #${orderNumber}</footer></main></body></html>`;
}
