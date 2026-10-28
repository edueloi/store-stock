import { createStoreCharge } from "../services/billing/store-charges.service";
import type { Request, Response } from "express";

import { prisma } from "../config/prisma";
import { storeSelectionLabel } from '../utils/store-selection';
import { decrementProductStock, returnProductStock } from "../utils/stock-adjust";
import { getTenantAccessState } from "../utils/tenant-access";
import { createStoreOrderPdf } from "../services/store-order-pdf.service";
import { baseTemplate, sendPlatformEmail } from "../services/mailer.service";
import { escapeHtml } from "../utils/html-escape";
import { env } from "../config/env";
import { emitToTenant } from "../services/realtime.service";
import { sanitizeStorefrontHeadings } from "../../shared/storefrontHeadings";
import {
  buildTenantAccessUrl,
  resolveTenantLookupFromRequest,
} from "../utils/tenant-domain";

interface CheckoutItemInput {
  id: number;
  quantity: number;
  selected_options?: Record<string, string>;
}

interface CheckoutOrderItem {
  product_id: number;
  quantity: number;
  unit_price: number;
  dimensions_label?: string | null;
}

type CepZone = { name?: string; from?: string; to?: string; fee?: number };
type StorefrontSettings = {
  checkout_mode?: "whatsapp" | "reservation" | "online" | "order_request";
  reservation_minutes?: number;
  checkout_payment_methods?: { pix?: boolean; cash_on_delivery?: boolean; card_on_delivery?: boolean; mercadopago?: boolean; asaas?: boolean };
  delivery?: { pickup_enabled?: boolean; delivery_enabled?: boolean; cep_zones?: CepZone[] };
  order_notification_emails?: string;
  hide_product_description?: boolean; // lojista não quer descrição dos produtos na vitrine
};

function digits(value: unknown) {
  return String(value || "").replace(/\D/g, "");
}

/** Compara telefones brasileiros mesmo quando um deles foi salvo com DDI. */
function comparablePhone(value: unknown) {
  const valueDigits = digits(value);
  return valueDigits.startsWith("55") && valueDigits.length >= 12
    ? valueDigits.slice(2)
    : valueDigits;
}

function checkoutSettings(tenant: { policies: unknown }) {
  return ((tenant.policies as Record<string, unknown> | null)?.storefront || {}) as StorefrontSettings;
}

function resolveDelivery(settings: StorefrontSettings, cep: unknown) {
  const delivery = settings.delivery || {};
  const normalizedCep = digits(cep);
  const zones = Array.isArray(delivery.cep_zones) ? delivery.cep_zones : [];
  const matchedZone = normalizedCep.length === 8
    ? zones.find((zone) => {
      const from = digits(zone.from);
      const to = digits(zone.to);
      return from.length === 8 && to.length === 8 && normalizedCep >= from && normalizedCep <= to;
    })
    : undefined;
  return {
    pickup_available: delivery.pickup_enabled !== false,
    delivery_available: Boolean(delivery.delivery_enabled && matchedZone),
    delivery_fee: matchedZone ? Math.max(0, Number(matchedZone.fee) || 0) : null,
    delivery_zone: matchedZone?.name || null,
  };
}

function publicTenant(tenant: any) {
  return {
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    subdomain: tenant.subdomain,
    whatsapp: tenant.whatsapp,
    document: tenant.document,
    logo_url: tenant.logo_url,
    banner_url: tenant.banner_url,
    instagram_url: tenant.instagram_url,
    facebook_url: tenant.facebook_url,
    address: tenant.address,
    address_street: tenant.address_street,
    address_number: tenant.address_number,
    address_complement: tenant.address_complement,
    address_district: tenant.address_district,
    address_city: tenant.address_city,
    address_state: tenant.address_state,
    address_zip: tenant.address_zip,
    show_address: tenant.show_address,
    template_id: tenant.template_id,
    about_text: tenant.about_text,
    hero_tagline: tenant.hero_tagline,
    footer_text: tenant.footer_text,
    primary_color: tenant.primary_color,
    featured_limit: tenant.featured_limit,
    bestseller_limit: tenant.bestseller_limit,
    business_hours: tenant.business_hours,
    sell_without_stock_control: Boolean(tenant.sell_without_stock_control),
    food_enabled: Boolean(tenant.food_enabled),
    policies: sanitizeStorefrontHeadings(tenant.policies),
    public_url: buildTenantAccessUrl(tenant.subdomain || tenant.slug),
  };
}

/** Libera reservas criadas pela loja online cuja janela já terminou. */
export async function releaseExpiredStoreReservations() {
  const candidates = await prisma.heldSale.findMany({ where: { status: "held" }, include: { items: true } });
  const now = Date.now();
  for (const sale of candidates) {
    const snapshot = sale.snapshot as Record<string, unknown> | null;
    if (snapshot?.source !== "storefront_reservation" || !snapshot.expires_at || new Date(String(snapshot.expires_at)).getTime() > now) continue;
    const claim = await prisma.heldSale.updateMany({ where: { id: sale.id, status: "held" }, data: { status: "cancelled", cancelled_by: "Reserva expirada", cancel_reason: "Prazo da reserva online expirou", cancelled_at: new Date() } });
    if (!claim.count) continue;
    if (snapshot.stock_tracked === false) continue;
    for (const item of sale.items) {
      await returnProductStock(item.product_id, item.quantity, item.selected_options as Record<string, string> | null);
      await prisma.stockMovement.create({ data: { tenant_id: sale.tenant_id, product_id: item.product_id, quantity: item.quantity, type: "held_sale_return", reason: "Reserva online expirada" } });
    }
  }
}

// Produto como a vitrine o enxerga: sem dados internos (custo, desconto máximo, estoque mínimo),
// com preço oculto quando o lojista marcou "ocultar preço no site" (-1 é o sinal que os temas
// exibem como "Sob consulta") e com estoque sempre disponível para produto sob encomenda.
const STORE_ALWAYS_AVAILABLE = 99;
function toPublicProduct(product: any) {
  const { cost_price: _cost, max_discount_pct: _maxDiscount, min_stock: _minStock, ...rest } = product;
  const out: any = { ...rest };
  if (product.track_stock === false) {
    out.stock_quantity = STORE_ALWAYS_AVAILABLE;
    if (product.sale_unit && product.sale_unit !== "unidade") out.measure_stock_quantity = STORE_ALWAYS_AVAILABLE;
    if (Array.isArray(product.skus)) out.skus = product.skus.map((s: any) => ({ ...s, stock: STORE_ALWAYS_AVAILABLE }));
    if (Array.isArray(product.variations)) {
      out.variations = product.variations.map((v: any) => ({ ...v, options: (v.options ?? []).map((o: any) => ({ ...o, stock: STORE_ALWAYS_AVAILABLE })) }));
    }
  }
  if (product.hide_price_on_site) {
    out.price = -1;
    out.discount_price = null;
    if (product.price_per_measure != null) out.price_per_measure = -1;
    out.price_hidden = true;
  }
  return out;
}

export async function getPublicStore(req: Request, res: Response) {
  try {
    await releaseExpiredStoreReservations();
    const tenantLookup = resolveTenantLookupFromRequest(req);

    if (!tenantLookup) {
      res.status(404).json({ error: "Store not found" });
      return;
    }

    const tenant = await prisma.tenant.findFirst({
      where: {
        OR: [{ slug: tenantLookup }, { subdomain: tenantLookup }],
      },
    });

    if (!tenant) {
      res.status(404).json({ error: "Store not found" });
      return;
    }

    const accessState = getTenantAccessState(tenant);

    if (!accessState.allowed) {
      res.status(403).json({ error: accessState.reason });
      return;
    }

    const [categories, products, soldRows] = await Promise.all([
      prisma.category.findMany({ where: { tenant_id: tenant.id }, orderBy: { name: "asc" } }),
      prisma.product.findMany({
        where: { tenant_id: tenant.id, is_active: true },
      }),
      // Unidades vendidas em pedidos concluídos: alimenta a seção "Mais vendidos" da vitrine.
      prisma.orderItem
        .groupBy({
          by: ["product_id"],
          where: { product_id: { not: null }, order: { tenant_id: tenant.id, status: "completed" } },
          _sum: { quantity: true },
        })
        .catch(() => [] as Array<{ product_id: number | null; _sum: { quantity: number | null } }>),
    ]);
    const soldByProduct = new Map<number, number>();
    for (const row of soldRows) if (row.product_id != null) soldByProduct.set(row.product_id, Number(row._sum.quantity) || 0);

    const hideDescription = Boolean(checkoutSettings(tenant).hide_product_description);

    res.json({
      tenant: publicTenant(tenant),
      categories,
      products: products.map((product) => {
        const publicProduct = { ...toPublicProduct(product), sold_count: soldByProduct.get(product.id) || 0 };
        return hideDescription ? { ...publicProduct, description: null } : publicProduct;
      }),
    });
  } catch {
    res.status(500).json({ error: "Failed to fetch store" });
  }
}

/** Opções seguras para o checkout; tokens e dados internos nunca chegam à vitrine. */
export async function getPublicCheckoutOptions(req: Request, res: Response) {
  try {
    const tenantId = Number(req.body?.tenantId);
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant || !getTenantAccessState(tenant).allowed) {
      res.status(404).json({ error: "Loja não encontrada." });
      return;
    }
    const settings = checkoutSettings(tenant);
    const configured = { pix: true, cash_on_delivery: false, card_on_delivery: false, ...(settings.checkout_payment_methods || {}) };
    const gateways = await (prisma as any).storePaymentGateway.findMany({
      where: { tenant_id: tenant.id, enabled: true },
      select: { provider: true, credentials: true },
    });
    const hasGateway = (provider: string) => gateways.some((gateway: any) =>
      gateway.provider === provider && Boolean((gateway.credentials as Record<string, unknown> | null)?.access_token),
    );
    res.json({
      checkout_enabled: settings.checkout_mode === "online",
      payment_methods: {
        pix: Boolean(configured.pix),
        cash_on_delivery: Boolean(configured.cash_on_delivery),
        card_on_delivery: Boolean(configured.card_on_delivery),
        mercadopago: Boolean(configured.mercadopago && hasGateway("mercadopago")),
        asaas: Boolean(configured.asaas && hasGateway("asaas")),
      },
      delivery: resolveDelivery(settings, req.body?.cep),
    });
  } catch (error) {
    console.error("Falha ao consultar opções de checkout", error);
    res.status(500).json({ error: "Não foi possível consultar as opções de entrega." });
  }
}

/** Consulta pública de empresa por CNPJ para agilizar o preenchimento do checkout. CPF nunca é consultado. */
export async function lookupPublicCompany(req: Request, res: Response) {
  const cnpj = digits(req.body?.cnpj);
  if (cnpj.length !== 14) {
    res.status(422).json({ error: "Informe um CNPJ com 14 dígitos." });
    return;
  }
  try {
    const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, {
      signal: AbortSignal.timeout(8_000),
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      res.status(response.status === 404 ? 404 : 502).json({ error: "Não foi possível localizar este CNPJ agora." });
      return;
    }
    const company = await response.json() as Record<string, unknown>;
    res.json({
      legal_name: company.razao_social || "",
      trade_name: company.nome_fantasia || "",
      cep: digits(company.cep),
      address: [company.descricao_tipo_de_logradouro, company.logradouro, company.numero, company.bairro, company.municipio, company.uf].filter(Boolean).join(", "),
    });
  } catch {
    res.status(502).json({ error: "A consulta de CNPJ está indisponível no momento." });
  }
}

/**
 * Identifica um cliente pelo WhatsApp e devolve somente os descontos de
 * fidelidade que ele pode usar. A validade é conferida novamente no pedido.
 */
export async function lookupPublicCustomerRecognition(req: Request, res: Response) {
  try {
    const tenantId = Number(req.body?.tenantId);
    const phone = comparablePhone(req.body?.phone);
    if (!tenantId || phone.length < 10) {
      res.status(422).json({ error: "Informe um WhatsApp válido." });
      return;
    }

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant || !getTenantAccessState(tenant).allowed) {
      res.status(404).json({ error: "Loja não encontrada." });
      return;
    }

    const candidates = await prisma.customer.findMany({
      where: { tenant_id: tenant.id, status: "active", phone: { not: null } },
      select: { id: true, name: true, phone: true },
    });
    const customer = candidates.find((candidate) => comparablePhone(candidate.phone) === phone);
    if (!customer) {
      res.json({ recognized: false, rewards: [] });
      return;
    }

    const [program, latestPoints] = await Promise.all([
      prisma.loyaltyProgram.findFirst({
        where: { tenant_id: tenant.id, is_active: true },
        include: { rewards: { where: { is_active: true }, orderBy: { points_cost: "asc" } } },
      }),
      prisma.customerPoint.findFirst({
        where: { tenant_id: tenant.id, customer_id: customer.id },
        orderBy: { created_at: "desc" },
        select: { balance_after: true },
      }),
    ]);
    const balance = Number(latestPoints?.balance_after || 0);
    const rewards = (program?.rewards || [])
      .filter((reward) => reward.type === "discount" && reward.discount_value && reward.points_cost <= balance)
      .map((reward) => ({
        id: reward.id,
        name: reward.name,
        points_cost: reward.points_cost,
        discount_type: reward.discount_type === "fixed" ? "fixed" : "percent",
        discount_value: Number(reward.discount_value),
      }));

    res.json({
      recognized: true,
      customer: { first_name: customer.name.trim().split(/\s+/)[0] || "Cliente" },
      rewards,
    });
  } catch (error) {
    console.error("Falha ao reconhecer cliente da vitrine", error);
    res.status(500).json({ error: "Não foi possível reconhecer o cliente agora." });
  }
}

/** Avisa a equipe por e-mail (remetente BoxSys) sobre uma reserva feita na vitrine. Nunca derruba a reserva. */
async function notifyReservationByEmail(
  tenant: { name: string },
  settings: StorefrontSettings,
  number: number,
  expiresAt: Date,
  items: Array<{ name: string; sku: string | null; code: string | number; quantity: number; unitPrice: number }>,
  customer?: { name?: string; phone?: string },
) {
  const recipients = String(settings.order_notification_emails || "").split(/[,;\n]/).map((email) => email.trim().toLowerCase()).filter((email) => /^\S+@\S+\.\S+$/.test(email));
  if (!recipients.length) return;
  try {
    const code = `#${String(number).padStart(6, "0")}`;
    const total = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    const pdf = await createStoreOrderPdf({
      storeName: tenant.name,
      orderNumber: number,
      customerName: customer?.name || "Cliente da loja online",
      customerPhone: customer?.phone || "Não informado",
      createdAt: new Date(),
      total,
      items,
      title: "RESERVA DE ESTOQUE",
      footer: `Reserva válida até ${expiresAt.toLocaleString("pt-BR")}. Depois disso a equipe pode cancelar e devolver os itens ao estoque.`,
    });
    const link = `${env.appBaseUrl.replace(/\/+$/, "")}/admin/pdv`;
    const rows = items.map((item) => `<tr><td style="padding:7px 0;color:#334155">${escapeHtml(item.name)} × ${item.quantity}<br/><span style="font-size:11px;color:#64748b">${item.sku ? `SKU: ${escapeHtml(item.sku)} · ` : ""}Código: ${escapeHtml(String(item.code))}</span></td><td align="right" style="padding:7px 0;font-weight:700;color:#0f172a">R$ ${(item.unitPrice * item.quantity).toFixed(2).replace(".", ",")}</td></tr>`).join("");
    await sendPlatformEmail({
      to: recipients,
      subject: `Nova reserva ${code} · ${tenant.name}`,
      html: baseTemplate(`<p style="margin:0 0 8px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#2563eb">Nova reserva de estoque</p><h1 style="margin:0 0 14px;font-size:24px;color:#0f172a">Reserva ${code}</h1><p style="color:#475569;line-height:1.6">Itens separados até <strong>${expiresAt.toLocaleString("pt-BR")}</strong>.</p><table width="100%" cellspacing="0" cellpadding="0" style="margin:18px 0;border-top:1px solid #e2e8f0">${rows}</table><p style="margin:16px 0;text-align:right;font-size:18px;font-weight:900;color:#0f172a">Total: R$ ${total.toFixed(2).replace(".", ",")}</p><p style="margin:20px 0"><a href="${link}" style="display:inline-block;padding:12px 22px;background:#2563eb;color:#fff;border-radius:8px;font-weight:700;text-decoration:none">Abrir no sistema (PDV → Vendas em espera)</a></p><p style="color:#64748b;font-size:12px">O PDF com SKU e código dos itens está anexado.</p>`),
      attachments: [{ filename: `reserva-${String(number).padStart(6, "0")}.pdf`, content: pdf, contentType: "application/pdf" }],
    });
  } catch (error) {
    console.error(`Falha ao notificar reserva #${number} por e-mail`, error);
  }
}

export async function reserveStoreCart(req: Request, res: Response) {
  try {
    await releaseExpiredStoreReservations();
    const { tenantId, items, customer } = req.body as { tenantId: number; items: Array<{ product_id: number; quantity: number; selected_options?: Record<string, string> }>; customer?: { name?: string; phone?: string } };
    if (!tenantId || !Array.isArray(items) || !items.length) return res.status(400).json({ error: "Carrinho inválido." });
    const tenant = await prisma.tenant.findUnique({ where: { id: Number(tenantId) } });
    if (!tenant) return res.status(404).json({ error: "Loja não encontrada." });
    const settings = checkoutSettings(tenant);
    if (settings.checkout_mode !== "reservation") return res.status(400).json({ error: "Esta loja não está configurada para reservas." });
    const rows: { product_id: number; name: string; quantity: number; unit_price: number; selected_options: Record<string, string> | null }[] = [];
    const mailItems: Array<{ name: string; sku: string | null; code: string | number; quantity: number; unitPrice: number }> = [];
    // Lojas que não controlam estoque no sistema reservam sem validar nem baixar saldo.
    const trackStock = !tenant.sell_without_stock_control;
    for (const item of items) {
      const quantity = Number(item.quantity);
      const product = await prisma.product.findFirst({ where: { id: Number(item.product_id), tenant_id: tenant.id, is_active: true } });
      if (!product || !Number.isInteger(quantity) || quantity < 1) return res.status(409).json({ error: `Um dos itens não está mais disponível.` });
      if (trackStock && product.track_stock !== false && product.stock_quantity < quantity) return res.status(409).json({ error: `Estoque insuficiente para ${product.name}: restam ${Math.max(0, product.stock_quantity)} un.` });
      const unitPrice = Number(product.discount_price ?? product.price);
      rows.push({ product_id: product.id, name: product.name, quantity, unit_price: unitPrice, selected_options: item.selected_options ?? null });
      const options = item.selected_options ? Object.entries(item.selected_options).map(([k, v]) => `${k}: ${v}`).join(" · ") : "";
      mailItems.push({ name: options ? `${product.name} (${options})` : product.name, sku: product.sku, code: product.barcode || product.id, quantity, unitPrice });
    }
    const latest = await prisma.heldSale.findFirst({ where: { tenant_id: tenant.id }, orderBy: { number: "desc" }, select: { number: true } });
    const minutes = Math.max(5, Math.min(120, Number(settings.reservation_minutes) || 20));
    const expiresAt = new Date(Date.now() + minutes * 60_000);
    const heldSale = await prisma.heldSale.create({ data: { tenant_id: tenant.id, number: (latest?.number || 0) + 1, customer_name: customer?.name || null, customer_phone: customer?.phone || null, notes: "Reserva criada pela loja online", snapshot: { source: "storefront_reservation", expires_at: expiresAt.toISOString(), stock_tracked: trackStock }, items: { create: rows } } });
    if (trackStock) {
      for (const row of rows) {
        await decrementProductStock(row.product_id, row.quantity, row.selected_options);
        await prisma.stockMovement.create({ data: { tenant_id: tenant.id, product_id: row.product_id, quantity: -row.quantity, type: "held_sale_out", reason: `Reserva online #${heldSale.number}` } });
      }
    }
    await notifyReservationByEmail(tenant, settings, heldSale.number, expiresAt, mailItems, customer);
    res.status(201).json({ reservation_id: heldSale.id, number: heldSale.number, expires_at: expiresAt.toISOString() });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Não foi possível reservar os itens agora." });
  }
}

/**
 * Pedido feito pelo CARDÁPIO DIGITAL (QR Code) de estabelecimentos alimentícios — produto
 * separado do site/catálogo. Vira uma COMANDA aberta (HeldSale):
 *  - mode "mesa": identificada pela mesa; novos pedidos da mesma mesa somam na comanda aberta;
 *  - mode "balcao": uma comanda nova por pedido, identificada pelo nome do cliente.
 * A equipe fecha a conta no PDV (Comandas). O estoque dos itens é separado no pedido.
 */
export async function createTableOrder(req: Request, res: Response) {
  try {
    const { tenantId, mesa, people, mode: rawMode, items, customer, note } = req.body as {
      tenantId: number;
      mesa?: string | number;
      people?: number;
      mode?: "mesa" | "balcao";
      items: Array<{ product_id: number; quantity: number; selected_options?: Record<string, string>; note?: string }>;
      customer?: { name?: string; phone?: string };
      note?: string;
    };
    const mode: "mesa" | "balcao" = rawMode === "balcao" ? "balcao" : "mesa";
    const table = String(mesa ?? "").trim().slice(0, 20);
    if (!tenantId || (mode === "mesa" && !table) || !Array.isArray(items) || !items.length || items.length > 40) {
      return res.status(400).json({ error: "Pedido inválido." });
    }
    const guestName = String(customer?.name ?? "").trim().slice(0, 60);
    if (mode === "balcao" && !guestName) return res.status(400).json({ error: "Informe seu nome para o pedido." });
    const tenant = await prisma.tenant.findUnique({ where: { id: Number(tenantId) } });
    if (!tenant || !getTenantAccessState(tenant).allowed) return res.status(404).json({ error: "Loja não encontrada." });
    if (!tenant.food_enabled) return res.status(400).json({ error: "Esta loja não recebe pedidos por mesa." });
    const acceptsTable = { mesa: true, balcao: true, ...(menuSettings(tenant).accepts || {}) };
    if (!acceptsTable[mode]) return res.status(400).json({ error: mode === "mesa" ? "O pedido pela mesa não está ativo nesta loja." : "O pedido pelo balcão não está ativo nesta loja." });

    const trackStock = !tenant.sell_without_stock_control;
    const rows: { product_id: number; name: string; quantity: number; unit_price: number; selected_options: Record<string, string> | null }[] = [];
    for (const item of items) {
      const quantity = Number(item.quantity);
      const product = await prisma.product.findFirst({ where: { id: Number(item.product_id), tenant_id: tenant.id, is_active: true } });
      if (!product || !Number.isInteger(quantity) || quantity < 1 || quantity > 50) {
        return res.status(409).json({ error: "Um dos itens não está mais disponível." });
      }
      if (trackStock && product.track_stock !== false && product.stock_quantity < quantity) {
        return res.status(409).json({ error: `Estoque insuficiente para ${product.name}: restam ${Math.max(0, product.stock_quantity)} un.` });
      }
      const itemNote = String(item.note ?? "").trim().slice(0, 140);
      rows.push({
        product_id: product.id,
        name: itemNote ? `${product.name} — obs: ${itemNote}` : product.name,
        quantity,
        unit_price: Number(product.discount_price ?? product.price),
        selected_options: item.selected_options ?? null,
      });
    }

    const guest = guestName;
    const orderNote = String(note ?? "").trim().slice(0, 200);
    const peopleCount = Math.max(0, Math.min(30, Math.floor(Number(people) || 0)));
    const label = mode === "balcao" ? `Balcão · ${guest}` : `Mesa ${table}${guest ? ` · ${guest}` : ""}`;
    const source = mode === "balcao" ? "Balcão" : `Mesa ${table}`;

    // Mesa: comanda já aberta para esta mesa? Soma os itens nela em vez de abrir outra.
    const existing = mode === "mesa"
      ? await prisma.heldSale.findFirst({
          where: { tenant_id: tenant.id, status: "held", snapshot: { path: "$.table", equals: table } },
          orderBy: { id: "desc" },
        })
      : null;

    let heldSale;
    if (existing) {
      heldSale = await prisma.heldSale.update({
        where: { id: existing.id },
        data: {
          customer_name: guest && !String(existing.customer_name ?? "").includes(guest) ? `${existing.customer_name ?? `Mesa ${table}`} · ${guest}` : existing.customer_name,
          items: { create: rows },
        },
      });
    } else {
      const latest = await prisma.heldSale.findFirst({ where: { tenant_id: tenant.id }, orderBy: { number: "desc" }, select: { number: true } });
      heldSale = await prisma.heldSale.create({
        data: {
          tenant_id: tenant.id,
          number: (latest?.number || 0) + 1,
          customer_name: label,
          customer_phone: String(customer?.phone ?? "").replace(/\D/g, "").slice(0, 15) || null,
          notes: `Pedido pelo cardápio digital — ${source}${mode === "mesa" && peopleCount ? ` · ${peopleCount} ${peopleCount === 1 ? "pessoa" : "pessoas"}` : ""}${orderNote ? ` · ${orderNote}` : ""}`,
          snapshot: { source: "table_qr", mode, ...(mode === "mesa" ? { table } : {}), stock_tracked: trackStock },
          items: { create: rows },
        },
      });
    }

    if (trackStock) {
      for (const row of rows) {
        await decrementProductStock(row.product_id, row.quantity, row.selected_options);
        await prisma.stockMovement.create({
          data: { tenant_id: tenant.id, product_id: row.product_id, quantity: -row.quantity, type: "held_sale_out", reason: `Comanda #${heldSale.number} — ${source}` },
        });
      }
    }

    emitToTenant(tenant.id, "order:updated", { heldSaleId: heldSale.id });
    emitToTenant(tenant.id, "stock:changed", { heldSaleId: heldSale.id });
    const total = rows.reduce((sum, r) => sum + r.unit_price * r.quantity, 0);
    res.status(201).json({ comanda_id: heldSale.id, number: heldSale.number, mode, table: mode === "mesa" ? table : null, total, appended: Boolean(existing) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Não foi possível enviar o pedido agora." });
  }
}

type MenuSettings = {
  accepts?: { mesa?: boolean; balcao?: boolean; delivery?: boolean; pickup?: boolean };
  delivery?: {
    fee_mode?: "fixed" | "neighborhood";
    fixed_fee?: number;
    free_above?: number;
    min_order?: number;
    neighborhoods?: Array<{ name?: string; fee?: number }>;
    eta?: string;
  };
  pickup_eta?: string;
  payments?: { pix?: boolean; money?: boolean; card?: boolean };
};

function menuSettings(tenant: { policies: unknown }): MenuSettings {
  return ((tenant.policies as Record<string, unknown> | null)?.menu || {}) as MenuSettings;
}

/**
 * Pedido do CARDÁPIO DIGITAL. Mesa e balcão viram comanda aberta (createTableOrder); entrega e
 * retirada viram um pedido pendente (aparece em Pedidos), com taxa de entrega calculada no servidor
 * a partir da configuração do cardápio (taxa fixa ou por bairro, frete grátis acima de X, mínimo).
 */
export async function createMenuOrder(req: Request, res: Response) {
  const mode = String(req.body?.mode || "mesa");
  if (mode === "mesa" || mode === "balcao") return createTableOrder(req, res);
  if (mode !== "delivery" && mode !== "pickup") return res.status(400).json({ error: "Modo de pedido inválido." });

  try {
    const { tenantId, items, customer, address, payment, note } = req.body as {
      tenantId: number;
      items: Array<{ product_id: number; quantity: number; note?: string }>;
      customer?: { name?: string; phone?: string };
      address?: { street?: string; number?: string; district?: string; complement?: string; reference?: string };
      payment?: { method?: string; change_for?: number };
      note?: string;
    };
    if (!tenantId || !Array.isArray(items) || !items.length || items.length > 40) return res.status(400).json({ error: "Pedido inválido." });
    const tenant = await prisma.tenant.findUnique({ where: { id: Number(tenantId) } });
    if (!tenant || !getTenantAccessState(tenant).allowed) return res.status(404).json({ error: "Loja não encontrada." });
    if (!tenant.food_enabled) return res.status(400).json({ error: "Esta loja não recebe pedidos pelo cardápio." });

    const cfg = menuSettings(tenant);
    const accepts = { mesa: true, balcao: true, pickup: true, delivery: false, ...(cfg.accepts || {}) };
    if (!accepts[mode]) return res.status(400).json({ error: mode === "delivery" ? "Esta loja não faz entregas pelo cardápio." : "A retirada não está disponível." });

    const name = String(customer?.name ?? "").trim().slice(0, 80);
    const phone = digits(customer?.phone);
    if (!name || phone.length < 10) return res.status(422).json({ error: "Informe seu nome e um WhatsApp válido." });

    const payMethod = String(payment?.method || "");
    const allowedPay = { pix: true, money: true, card: true, ...(cfg.payments || {}) } as Record<string, boolean>;
    if (!["pix", "money", "card"].includes(payMethod) || !allowedPay[payMethod]) return res.status(422).json({ error: "Escolha uma forma de pagamento disponível." });

    const trackStock = !tenant.sell_without_stock_control;
    const rows: Array<{ product_id: number; quantity: number; unit_price: number; dimensions_label: string | null; name: string }> = [];
    let subtotal = 0;
    let gross = 0;
    for (const item of items) {
      const quantity = Number(item.quantity);
      const product = await prisma.product.findFirst({ where: { id: Number(item.product_id), tenant_id: tenant.id, is_active: true } });
      if (!product || !Number.isInteger(quantity) || quantity < 1 || quantity > 50) return res.status(409).json({ error: "Um dos itens não está mais disponível." });
      if (trackStock && product.track_stock !== false && product.stock_quantity < quantity) {
        return res.status(409).json({ error: `Estoque insuficiente para ${product.name}: restam ${Math.max(0, product.stock_quantity)} un.` });
      }
      const unit = Number(product.discount_price ?? product.price);
      subtotal += unit * quantity;
      gross += Number(product.price) * quantity;
      rows.push({ product_id: product.id, quantity, unit_price: unit, dimensions_label: String(item.note ?? "").trim().slice(0, 140) || null, name: product.name });
    }
    subtotal = Math.round(subtotal * 100) / 100;
    gross = Math.round(gross * 100) / 100;

    const delivery = cfg.delivery || {};
    let fee = 0;
    let addressText = "Retirada na loja";
    let district = "";
    if (mode === "delivery") {
      const street = String(address?.street ?? "").trim().slice(0, 120);
      const number = String(address?.number ?? "").trim().slice(0, 20);
      district = String(address?.district ?? "").trim().slice(0, 80);
      if (!street || !number || !district) return res.status(422).json({ error: "Informe rua, número e bairro para a entrega." });
      const minOrder = Math.max(0, Number(delivery.min_order) || 0);
      if (minOrder > 0 && subtotal < minOrder) return res.status(422).json({ error: `Pedido mínimo para entrega: R$ ${minOrder.toFixed(2).replace(".", ",")}.` });
      if (delivery.fee_mode === "neighborhood") {
        const hood = (delivery.neighborhoods || []).find((n) => String(n.name || "").trim().toLowerCase() === district.toLowerCase());
        if (!hood) return res.status(422).json({ error: "Ainda não entregamos neste bairro." });
        fee = Math.max(0, Number(hood.fee) || 0);
      } else {
        fee = Math.max(0, Number(delivery.fixed_fee) || 0);
      }
      const freeAbove = Math.max(0, Number(delivery.free_above) || 0);
      if (freeAbove > 0 && subtotal >= freeAbove) fee = 0;
      addressText = [`${street}, ${number}`, district, String(address?.complement ?? "").trim().slice(0, 80), address?.reference ? `Ref.: ${String(address.reference).trim().slice(0, 100)}` : ""].filter(Boolean).join(" · ");
    }
    const total = Math.round((subtotal + fee) * 100) / 100;
    const changeFor = payMethod === "money" && Number(payment?.change_for) > total ? Math.round(Number(payment?.change_for) * 100) / 100 : null;

    const order = await prisma.order.create({
      data: {
        tenant_id: tenant.id,
        customer_name: name,
        customer_phone: phone,
        customer_address: addressText,
        total_amount: total,
        gross_amount: Math.round((gross + fee) * 100) / 100,
        discount_amount: Math.max(0, Math.round((gross - subtotal) * 100) / 100),
        status: "pending",
        sales_channel: "menu",
        delivery_method: mode,
        shipping_amount: fee,
        payment_method: payMethod === "pix" ? "pix" : payMethod === "money" ? "cash_on_delivery" : "card_on_delivery",
        storefront_details: { source: "menu", mode, district: district || null, change_for: changeFor, note: String(note ?? "").trim().slice(0, 200) || null, eta: (mode === "delivery" ? delivery.eta : cfg.pickup_eta) || null, stock_tracked: trackStock },
        items: { create: rows.map(({ name: _n, ...r }) => r) },
      },
    });

    if (trackStock) {
      for (const row of rows) {
        await decrementProductStock(row.product_id, row.quantity, null);
        await prisma.stockMovement.create({
          data: { tenant_id: tenant.id, product_id: row.product_id, quantity: -row.quantity, type: "sale", reason: `Pedido #${order.id} — cardápio digital` },
        });
      }
    }
    emitToTenant(tenant.id, "order:created", { orderId: order.id });
    emitToTenant(tenant.id, "stock:changed", { orderId: order.id });
    res.status(201).json({ order_id: order.id, mode, subtotal, fee, total, eta: (mode === "delivery" ? delivery.eta : cfg.pickup_eta) || null });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Não foi possível enviar o pedido agora." });
  }
}

/**
 * Solicitação para catálogos de fabricação/encomenda. Não consulta, reserva ou
 * baixa estoque: o catálogo representa o que a fábrica produz sob demanda.
 */
export async function requestStoreOrder(req: Request, res: Response) {
  const { tenantId, items, customerInfo, loyaltyRewardId } = req.body as {
    tenantId: number;
    items: CheckoutItemInput[];
    customerInfo: { name?: string; phone?: string; email?: string };
    loyaltyRewardId?: number;
  };
  try {
    const tenant = await prisma.tenant.findUnique({ where: { id: Number(tenantId) } });
    if (!tenant || !getTenantAccessState(tenant).allowed) {
      res.status(404).json({ error: "Loja não encontrada." });
      return;
    }
    const settings = checkoutSettings(tenant);
    if (settings.checkout_mode !== "order_request") {
      res.status(400).json({ error: "Esta loja não recebe solicitações de encomenda pela vitrine." });
      return;
    }
    if (!Array.isArray(items) || !items.length || !customerInfo?.name?.trim() || !customerInfo?.phone?.trim()) {
      res.status(422).json({ error: "Informe nome, WhatsApp e os itens da solicitação." });
      return;
    }
    const cleanEmail = String(customerInfo.email || "").trim().toLowerCase();
    if (cleanEmail && !/^\S+@\S+\.\S+$/.test(cleanEmail)) {
      res.status(422).json({ error: "Informe um e-mail válido ou deixe o campo em branco." });
      return;
    }

    const orderItems: Array<{ product_id: number; quantity: number; unit_price: number; name: string; sku: string | null; dimensions_label: string | null }> = [];
    let total = 0;
    for (const item of items) {
      if (!Number.isInteger(item.quantity) || item.quantity < 1) {
        res.status(422).json({ error: "A quantidade de cada item precisa ser maior que zero." });
        return;
      }
      const product = await prisma.product.findFirst({ where: { id: Number(item.id), tenant_id: tenant.id, is_active: true } });
      if (!product) {
        res.status(409).json({ error: "Um dos itens não está mais disponível no catálogo." });
        return;
      }
      const unitPrice = Number(product.discount_price ?? product.price);
      total += unitPrice * item.quantity;
      const selection = storeSelectionLabel(product, item.selected_options);
      if (selection === false) { res.status(422).json({ error: 'Confira as opções selecionadas do produto.' }); return; }
      orderItems.push({ product_id: product.id, quantity: item.quantity, unit_price: unitPrice, name: selection ? `${product.name} (${selection})` : product.name, sku: product.sku, dimensions_label: selection });
    }

    const phone = comparablePhone(customerInfo.phone);
    const customerCandidates = await prisma.customer.findMany({
      where: { tenant_id: tenant.id, status: "active", phone: { not: null } },
      select: { id: true, phone: true },
    });
    const recognizedCustomer = customerCandidates.find((candidate) => comparablePhone(candidate.phone) === phone);
    let appliedReward: { id: number; name: string; points_cost: number; discount_type: string | null; discount_value: number | null } | null = null;
    let discount = 0;

    if (recognizedCustomer && Number.isInteger(Number(loyaltyRewardId))) {
      const reward = await prisma.loyaltyReward.findFirst({
        where: { id: Number(loyaltyRewardId), tenant_id: tenant.id, is_active: true, type: "discount" },
        select: { id: true, name: true, points_cost: true, discount_type: true, discount_value: true },
      });
      const latestPoints = reward
        ? await prisma.customerPoint.findFirst({
            where: { tenant_id: tenant.id, customer_id: recognizedCustomer.id },
            orderBy: { created_at: "desc" },
            select: { balance_after: true },
          })
        : null;
      if (reward && Number(latestPoints?.balance_after || 0) >= reward.points_cost && Number(reward.discount_value || 0) > 0) {
        appliedReward = reward;
        discount = reward.discount_type === "fixed"
          ? Math.min(total, Number(reward.discount_value))
          : Math.min(total, total * (Number(reward.discount_value) / 100));
        discount = Math.round(discount * 100) / 100;
      }
    }
    const orderTotal = Math.max(0, total - discount);

    const order = await prisma.order.create({
      data: {
        tenant_id: tenant.id,
        customer_id: recognizedCustomer?.id || null,
        customer_name: customerInfo.name.trim(),
        customer_phone: customerInfo.phone.trim(),
        customer_address: cleanEmail ? `E-mail: ${cleanEmail}` : null,
        total_amount: orderTotal,
        gross_amount: total,
        discount_amount: discount,
        status: "pending",
        sales_channel: "storefront",
        delivery_method: "to_confirm",
        shipping_amount: 0,
        payment_method: "to_confirm",
        items: { create: orderItems.map(({ product_id, quantity, unit_price, dimensions_label }) => ({ product_id, quantity, unit_price, dimensions_label })) },
        actions: appliedReward ? {
          create: {
            tenant_id: tenant.id,
            action: "storefront_loyalty_reward",
            actor: "Vitrine pública",
            note: `Benefício solicitado: ${appliedReward.name}`,
            meta: { reward_id: appliedReward.id, points_cost: appliedReward.points_cost, discount_amount: discount },
          },
        } : undefined,
      },
    });

    const recipients = String(settings.order_notification_emails || "").split(/[,;\n]/).map((email) => email.trim().toLowerCase()).filter((email) => /^\S+@\S+\.\S+$/.test(email));
    let emailSent = false;
    if (recipients.length) {
      try {
        const pdf = await createStoreOrderPdf({
          storeName: tenant.name,
          orderNumber: order.id,
          customerName: order.customer_name || "Cliente",
          customerPhone: order.customer_phone || "Não informado",
          customerEmail: cleanEmail || undefined,
          createdAt: order.created_at,
          total: orderTotal,
          items: orderItems.map((item) => ({ name: item.name, sku: item.sku, code: item.product_id, quantity: item.quantity, unitPrice: item.unit_price })),
        });
        const itemLines = orderItems.map((item) => `<tr><td style="padding:7px 0;color:#334155">${escapeHtml(item.name)} × ${item.quantity}</td><td align="right" style="padding:7px 0;font-weight:700;color:#0f172a">R$ ${(item.unit_price * item.quantity).toFixed(2).replace(".", ",")}</td></tr>`).join("");
        await sendPlatformEmail({
          to: recipients,
          subject: `Nova encomenda #${String(order.id).padStart(6, "0")} · ${tenant.name}`,
          html: baseTemplate(`<p style="margin:0 0 8px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#db2777">Nova solicitação de encomenda</p><h1 style="margin:0 0 14px;font-size:24px;color:#0f172a">Pedido #${String(order.id).padStart(6, "0")}</h1><p style="color:#475569;line-height:1.6">Cliente: <strong>${escapeHtml(order.customer_name || "Cliente")}</strong><br/>WhatsApp: <strong>${escapeHtml(order.customer_phone || "Não informado")}</strong></p><table width="100%" cellspacing="0" cellpadding="0" style="margin:18px 0;border-top:1px solid #e2e8f0">${itemLines}</table><p style="margin:16px 0 0;text-align:right;font-size:18px;font-weight:900;color:#0f172a">Total estimado: R$ ${total.toFixed(2).replace(".", ",")}</p><p style="margin-top:18px;color:#64748b;font-size:12px">O PDF completo está anexado para separação e confirmação.</p>`),
          attachments: [{ filename: `encomenda-${String(order.id).padStart(6, "0")}.pdf`, content: pdf, contentType: "application/pdf" }],
        });
        emailSent = true;
      } catch (error) {
        console.error(`Falha ao notificar encomenda #${order.id} por e-mail`, error);
      }
    }

    const whatsapp = digits(tenant.whatsapp);
    const whatsappText = [`Olá! Acabei de enviar a solicitação de encomenda *#${String(order.id).padStart(6, "0")}* pela loja ${tenant.name}.`, "", ...orderItems.map((item) => `• ${item.quantity}x ${item.name}`), "", `Total estimado: R$ ${total.toFixed(2).replace(".", ",")}`, "", "Gostaria de confirmar disponibilidade e prazo de produção."].join("\n");
    res.status(201).json({ success: true, orderId: order.id, email_sent: emailSent, whatsapp_url: whatsapp ? `https://wa.me/${whatsapp}?text=${encodeURIComponent(whatsappText)}` : null });
  } catch (error) {
    console.error("Falha ao receber solicitação de encomenda", error);
    res.status(500).json({ error: "Não foi possível enviar a solicitação agora." });
  }
}

export async function checkout(req: Request, res: Response) {
  const { tenantId, items, customerInfo } = req.body as {
    tenantId: number;
    items: CheckoutItemInput[];
    customerInfo: {
      name?: string;
      phone?: string;
      address?: string;
      paymentMethod?: string;
      document?: string;
      cep?: string;
      deliveryType?: "pickup" | "delivery";
    };
  };

  try {
    const tenant = await prisma.tenant.findUnique({ where: { id: Number(tenantId) } });
    if (!tenant || !getTenantAccessState(tenant).allowed) {
      res.status(404).json({ error: "Loja não encontrada." });
      return;
    }
    const settings = checkoutSettings(tenant);
    if (settings.checkout_mode !== "online") {
      res.status(400).json({ error: "O checkout online não está ativo para esta loja." });
      return;
    }
    if (!Array.isArray(items) || !items.length || !customerInfo?.name || !customerInfo?.phone) {
      res.status(422).json({ error: "Informe nome, telefone e os itens do pedido." });
      return;
    }
    const paymentMethods = { pix: true, cash_on_delivery: false, card_on_delivery: false, ...(settings.checkout_payment_methods || {}) };
    const asaasAllowed = customerInfo.paymentMethod === "asaas" && Boolean((paymentMethods as { asaas?: boolean }).asaas);
    const manualPaymentAllowed = asaasAllowed ? true
      : customerInfo.paymentMethod === "pix" ? paymentMethods.pix
      : customerInfo.paymentMethod === "cash_on_delivery" ? paymentMethods.cash_on_delivery
        : customerInfo.paymentMethod === "card_on_delivery" ? paymentMethods.card_on_delivery
          : false;
    if (!manualPaymentAllowed) {
      res.status(422).json({ error: "Escolha uma forma de pagamento disponível para esta loja." });
      return;
    }
    if (asaasAllowed && ![11, 14].includes(digits(customerInfo.document).length)) {
      res.status(422).json({ error: "Informe um CPF ou CNPJ válido para pagar online." });
      return;
    }
    const delivery = resolveDelivery(settings, customerInfo.cep);
    if (customerInfo.deliveryType === "delivery" && !delivery.delivery_available) {
      res.status(422).json({ error: "Este CEP ainda não é atendido para entrega." });
      return;
    }
    if (customerInfo.deliveryType === "pickup" && !delivery.pickup_available) {
      res.status(422).json({ error: "A retirada não está disponível nesta loja." });
      return;
    }
    const deliveryFee = Number(delivery.delivery_fee || 0);
    let total = deliveryFee;
    let grossAmount = deliveryFee;
    let discountAmount = 0;
    const orderItems: CheckoutOrderItem[] = [];

    for (const item of items) {
      const product = await prisma.product.findFirst({ where: { id: Number(item.id), tenant_id: tenant.id, is_active: true } });

      if (product?.hide_price_on_site) {
        res.status(422).json({ error: `"${product.name}" é vendido sob orçamento. Fale com a loja para combinar o valor.` });
        return;
      }
      if (!product || !Number.isInteger(item.quantity) || item.quantity < 1 || (product.track_stock !== false && product.stock_quantity < item.quantity)) {
        res.status(409).json({ error: "Um dos itens não está mais disponível." });
        return;
      }

      const unitPrice = Number(product.discount_price ?? product.price);
      total += unitPrice * item.quantity;
      grossAmount += Number(product.price) * item.quantity;
      discountAmount += Math.max(0, Number(product.price) - unitPrice) * item.quantity;
      const selection = storeSelectionLabel(product, item.selected_options);
      if (selection === false) { res.status(422).json({ error: 'Confira as opções selecionadas do produto.' }); return; }
      orderItems.push({
        product_id: product.id,
        quantity: item.quantity,
        unit_price: unitPrice,
        dimensions_label: selection,
      });
    }

    const order = await prisma.order.create({
      data: {
        tenant_id: tenantId,
        customer_name: customerInfo.name,
        customer_phone: customerInfo.phone,
        customer_address: [customerInfo.address, customerInfo.cep ? `CEP ${digits(customerInfo.cep)}` : "", customerInfo.deliveryType === "pickup" ? "Retirada na loja" : ""].filter(Boolean).join(" \u00b7 "),
        customer_document: digits(customerInfo.document) || null,
        total_amount: total,
        gross_amount: grossAmount,
        discount_amount: discountAmount,
        status: "pending",
        sales_channel: "storefront",
        delivery_method: customerInfo.deliveryType || "pickup",
        shipping_amount: deliveryFee,
        payment_method: customerInfo.paymentMethod,
        items: { create: orderItems },
      },
    });

    let paymentUrl: string | undefined;
    if (asaasAllowed) {
      try {
        const charge = await createStoreCharge({
          tenantId: tenant.id,
          value: total,
          customerName: customerInfo.name,
          customerCpfCnpj: digits(customerInfo.document),
          customerPhone: customerInfo.phone,
          description: `Pedido #${order.id}`,
          orderId: order.id,
        });
        paymentUrl = charge.invoice_url ?? undefined;
      } catch (error) {
        await prisma.order.delete({ where: { id: order.id } });
        res.status(422).json({ error: error instanceof Error ? error.message : "Não foi possível gerar o pagamento." });
        return;
      }
    }

    for (const item of orderItems) {
      await prisma.product.update({
        where: { id: item.product_id },
        data: {
          stock_quantity: {
            decrement: item.quantity,
          },
        },
      });
    }

    res.json({ success: true, orderId: order.id, paymentUrl });
  } catch {
    res.status(500).json({ error: "Checkout failed" });
  }
}
