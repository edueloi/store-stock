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

export interface WarrantyDocumentOrder {
  id: number;
  created_at?: string;
  customer_name?: string | null;
  customer_phone?: string | null;
  payment_method?: string | null;
  total_amount: number | string;
  items: Array<{ product_name?: string; name?: string; quantity: number; unit_price?: number | string; price?: number | string }>;
}

const escapeHtml = (value: unknown) => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/\"/g, "&quot;")
  .replace(/'/g, "&#039;");

const money = (value: number | string) => Number(value || 0).toLocaleString("pt-BR", {
  style: "currency", currency: "BRL",
});

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

/** Documento A4 de garantia compartilhado por Pedidos e pelo fechamento do PDV. */
export function buildWarrantyDocumentHtml(tenant: WarrantyDocumentTenant, order: WarrantyDocumentOrder) {
  const policy = tenant.policies ?? {};
  const warrantyDays = Number(policy.warranty_days) > 0 ? Number(policy.warranty_days) : 90;
  const resolutionDays = Number(policy.warranty_resolution_days) > 0 ? Number(policy.warranty_resolution_days) : 30;
  const title = policy.warranty_title?.trim() || "Garantia de compra";
  const issuedAt = order.created_at ? new Date(order.created_at) : new Date();
  const expiresAt = new Date(issuedAt);
  expiresAt.setDate(expiresAt.getDate() + warrantyDays);
  const storeName = tenant.name?.trim() || "Estabelecimento";
  const accent = /^#[0-9a-f]{6}$/i.test(tenant.primary_color ?? "") ? tenant.primary_color! : "#2563eb";
  const rawLogo = tenant.logo_url ?? "";
  const logo = rawLogo && !rawLogo.startsWith("http") ? `${window.location.origin}${rawLogo}` : rawLogo;
  const defaultClauses = [
    `Cobertura para defeitos de fabricação pelo período indicado neste certificado, contado a partir da data da compra.`,
    `Para solicitar atendimento, apresente este certificado junto com o comprovante de compra e uma identificação do titular.`,
    `A garantia não cobre danos por mau uso, quedas, umidade, desgaste natural ou reparos feitos por terceiros não autorizados.`,
    `Após a análise, o atendimento seguirá as condições aplicáveis ao produto e os direitos previstos no Código de Defesa do Consumidor.`,
  ];
  const clauses = (policy.warranty_clauses?.filter(Boolean).length ? policy.warranty_clauses : defaultClauses)!
    .map((clause) => escapeHtml(clause)
      .replace(/\{\{warranty_days\}\}/g, String(warrantyDays))
      .replace(/\{\{resolution_days\}\}/g, String(resolutionDays))
      .replace(/\n/g, "<br/>")
    );
  const orderNumber = String(order.id).padStart(6, "0");
  const customerName = order.customer_name?.trim() || "Consumidor final";
  const itemRows = order.items.map((item) => {
    const name = item.product_name ?? item.name ?? "Item";
    const unit = Number(item.unit_price ?? item.price ?? 0);
    const quantity = Number(item.quantity ?? 0);
    return `<tr><td>${escapeHtml(name)}</td><td class="quantity">${quantity}</td><td class="value">${money(unit)}</td><td class="value">${money(unit * quantity)}</td></tr>`;
  }).join("");

  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"/><title>Garantia — Pedido #${orderNumber}</title>
<style>
*{box-sizing:border-box} body{margin:0;background:#eef2f7;color:#172033;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.45}.sheet{width:794px;min-height:1123px;margin:0 auto;background:#fff;padding:42px 46px}.topline{height:7px;background:${accent};margin:-42px -46px 30px}.header{display:flex;justify-content:space-between;gap:24px;align-items:flex-start}.brand{display:flex;align-items:center;gap:14px;min-width:0}.logo{width:52px;height:52px;object-fit:contain;border-radius:12px;border:1px solid #e5e7eb}.logo-placeholder{width:52px;height:52px;border-radius:12px;background:#172033;color:#fff;display:grid;place-items:center;font-weight:800;letter-spacing:.12em}.brand-name{font-size:20px;font-weight:800;letter-spacing:-.5px}.brand-meta{color:#64748b;font-size:10px;line-height:1.55;margin-top:3px;max-width:360px}.certificate{text-align:right}.certificate small{display:block;color:#64748b;text-transform:uppercase;letter-spacing:1.8px;font-weight:700;font-size:9px}.certificate strong{font-size:16px;letter-spacing:.8px}.hero{margin:31px 0 22px;border-radius:18px;padding:25px 27px;color:#fff;background:linear-gradient(125deg,#172033 0%,#172033 57%,${accent} 170%)}.hero-kicker{font-size:9px;font-weight:800;letter-spacing:2px;text-transform:uppercase;opacity:.72}.hero h1{font-size:28px;letter-spacing:-.8px;margin:7px 0 5px}.hero p{margin:0;opacity:.84;font-size:12px}.facts{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:0 0 26px}.fact{border:1px solid #dbe3ee;border-radius:12px;padding:13px 14px;background:#fbfcfe}.fact-label{font-size:9px;letter-spacing:1.2px;text-transform:uppercase;color:#64748b;font-weight:800}.fact-value{font-size:14px;font-weight:800;margin-top:4px;color:#172033}.fact-accent .fact-value{color:${accent}}.section-title{font-size:10px;text-transform:uppercase;letter-spacing:1.6px;font-weight:800;color:#475569;margin:24px 0 9px;display:flex;align-items:center;gap:8px}.section-title:before{content:"";display:block;width:20px;height:3px;border-radius:2px;background:${accent}}.client{display:grid;grid-template-columns:1fr 1fr;gap:9px 25px;border:1px solid #e2e8f0;border-radius:14px;padding:17px 18px}.client-item span{display:block;font-size:9px;text-transform:uppercase;letter-spacing:1.1px;color:#64748b;font-weight:800;margin-bottom:3px}.client-item strong{font-size:12px}.items{width:100%;border-collapse:separate;border-spacing:0;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden}.items th{background:#f1f5f9;text-align:left;color:#475569;font-size:9px;text-transform:uppercase;letter-spacing:1px;padding:10px 12px}.items td{padding:11px 12px;border-top:1px solid #eef2f7}.items .quantity{text-align:center;width:58px}.items .value{text-align:right;white-space:nowrap;width:108px}.items tfoot td{font-weight:800;border-top:2px solid #dbe3ee;background:#fbfcfe}.coverage{border:1px solid #dbe3ee;border-radius:14px;padding:18px;background:#fbfcfe}.coverage-head{display:flex;justify-content:space-between;gap:16px;align-items:center;padding-bottom:14px;border-bottom:1px solid #e2e8f0}.coverage-title{font-size:15px;font-weight:800}.coverage-copy{color:#64748b;font-size:11px;margin-top:3px}.badge{background:${accent};color:#fff;padding:7px 10px;border-radius:999px;font-weight:800;font-size:10px;white-space:nowrap}.clauses{margin-top:13px}.clause{display:flex;gap:10px;margin:10px 0;color:#334155}.clause-number{flex:0 0 20px;height:20px;border-radius:50%;background:#e8f0ff;color:${accent};font-size:10px;font-weight:800;display:grid;place-items:center}.support{margin-top:25px;padding:15px 17px;border-left:4px solid ${accent};background:#f8fafc;border-radius:0 12px 12px 0}.support strong{display:block;font-size:12px}.support span{display:block;color:#64748b;font-size:11px;margin-top:3px}.signatures{display:grid;grid-template-columns:1fr 1fr;gap:50px;margin-top:48px}.signature{padding-top:10px;border-top:1px solid #94a3b8;text-align:center;color:#64748b;font-size:10px}.signature strong{display:block;color:#334155;font-size:11px;margin-bottom:2px}.footer{margin-top:34px;padding-top:14px;border-top:1px solid #e2e8f0;text-align:center;color:#94a3b8;font-size:9px}.footer b{color:#64748b}@media print{@page{size:A4;margin:0}body{background:#fff}.sheet{margin:0;box-shadow:none}}
</style></head><body><main class="sheet"><div class="topline"></div><header class="header"><div class="brand">${logo ? `<img class="logo" src="${escapeHtml(logo)}" alt="Logo"/>` : `<div class="logo-placeholder">${escapeHtml(storeName.slice(0, 1).toUpperCase())}</div>`}<div><div class="brand-name">${escapeHtml(storeName)}</div><div class="brand-meta">${escapeHtml(addressOf(tenant))}${tenant.document ? `<br/>CNPJ/CPF: ${escapeHtml(tenant.document)}` : ""}${tenant.whatsapp ? `<br/>WhatsApp: ${escapeHtml(tenant.whatsapp)}` : ""}</div></div></div><div class="certificate"><small>Certificado de garantia</small><strong>#${orderNumber}</strong></div></header><section class="hero"><div class="hero-kicker">Compra protegida</div><h1>${escapeHtml(title)}</h1><p>Guarde este documento. Ele identifica a sua compra e as condições de atendimento.</p></section><section class="facts"><div class="fact fact-accent"><div class="fact-label">Cobertura</div><div class="fact-value">${warrantyDays} dias</div></div><div class="fact"><div class="fact-label">Válida até</div><div class="fact-value">${expiresAt.toLocaleDateString("pt-BR")}</div></div><div class="fact"><div class="fact-label">Atendimento</div><div class="fact-value">Até ${resolutionDays} dias</div></div></section><div class="section-title">Titular e compra</div><section class="client"><div class="client-item"><span>Cliente</span><strong>${escapeHtml(customerName)}</strong></div>${order.customer_phone ? `<div class="client-item"><span>Contato</span><strong>${escapeHtml(order.customer_phone)}</strong></div>` : ""}<div class="client-item"><span>Data da compra</span><strong>${issuedAt.toLocaleDateString("pt-BR")}</strong></div><div class="client-item"><span>Pagamento</span><strong>${escapeHtml(formatPayment(order.payment_method))}</strong></div></section><div class="section-title">Itens cobertos</div><table class="items"><thead><tr><th>Produto</th><th class="quantity">Qtd.</th><th class="value">Unitário</th><th class="value">Total</th></tr></thead><tbody>${itemRows}</tbody><tfoot><tr><td colspan="3">Valor da compra</td><td class="value">${money(order.total_amount)}</td></tr></tfoot></table><div class="section-title">Condições da garantia</div><section class="coverage"><div class="coverage-head"><div><div class="coverage-title">${escapeHtml(title)}</div><div class="coverage-copy">Consulte as condições abaixo antes de solicitar atendimento.</div></div><span class="badge">${warrantyDays} dias</span></div><div class="clauses">${clauses.map((clause, index) => `<div class="clause"><span class="clause-number">${index + 1}</span><span>${clause}</span></div>`).join("")}</div></section><section class="support"><strong>Precisa acionar a garantia?</strong><span>Fale com ${escapeHtml(storeName)}${tenant.whatsapp ? ` pelo WhatsApp ${escapeHtml(tenant.whatsapp)}` : ""} e informe o certificado #${orderNumber}.</span></section><section class="signatures"><div class="signature"><strong>${escapeHtml(storeName)}</strong>Estabelecimento</div><div class="signature"><strong>${escapeHtml(customerName)}</strong>Cliente / titular da garantia</div></section><footer class="footer">Emitido em ${new Date().toLocaleString("pt-BR")} · <b>${escapeHtml(storeName)}</b><br/>Documento de garantia vinculado ao pedido #${orderNumber}.</footer></main></body></html>`;
}
