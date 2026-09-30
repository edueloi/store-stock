import type { Request, Response } from "express";

import { prisma } from "../config/prisma";
import { decrementProductStock, returnProductStock } from "../utils/stock-adjust";
import { getTenantAccessState } from "../utils/tenant-access";
import {
  buildTenantAccessUrl,
  resolveTenantLookupFromRequest,
} from "../utils/tenant-domain";

interface CheckoutItemInput {
  id: number;
  quantity: number;
}

interface CheckoutOrderItem {
  product_id: number;
  quantity: number;
  unit_price: number;
}

type CepZone = { name?: string; from?: string; to?: string; fee?: number };
type StorefrontSettings = {
  checkout_mode?: "whatsapp" | "reservation" | "online";
  reservation_minutes?: number;
  checkout_payment_methods?: { pix?: boolean; cash_on_delivery?: boolean; card_on_delivery?: boolean; mercadopago?: boolean; asaas?: boolean };
  delivery?: { pickup_enabled?: boolean; delivery_enabled?: boolean; cep_zones?: CepZone[] };
};

function digits(value: unknown) {
  return String(value || "").replace(/\D/g, "");
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
    policies: tenant.policies,
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
    for (const item of sale.items) {
      await returnProductStock(item.product_id, item.quantity, item.selected_options as Record<string, string> | null);
      await prisma.stockMovement.create({ data: { tenant_id: sale.tenant_id, product_id: item.product_id, quantity: item.quantity, type: "held_sale_return", reason: "Reserva online expirada" } });
    }
  }
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

    const [categories, products] = await Promise.all([
      prisma.category.findMany({ where: { tenant_id: tenant.id }, orderBy: { name: "asc" } }),
      prisma.product.findMany({
        where: { tenant_id: tenant.id, is_active: true },
      }),
    ]);

    res.json({
      tenant: publicTenant(tenant),
      categories,
      products,
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
    for (const item of items) {
      const product = await prisma.product.findFirst({ where: { id: Number(item.product_id), tenant_id: tenant.id, is_active: true } });
      if (!product || item.quantity < 1 || product.stock_quantity < item.quantity) return res.status(409).json({ error: `Estoque indisponível para um dos itens do carrinho.` });
      rows.push({ product_id: product.id, name: product.name, quantity: item.quantity, unit_price: Number(product.discount_price ?? product.price), selected_options: item.selected_options ?? null });
    }
    const latest = await prisma.heldSale.findFirst({ where: { tenant_id: tenant.id }, orderBy: { number: "desc" }, select: { number: true } });
    const minutes = Math.max(5, Math.min(120, Number(settings.reservation_minutes) || 20));
    const expiresAt = new Date(Date.now() + minutes * 60_000);
    const heldSale = await prisma.heldSale.create({ data: { tenant_id: tenant.id, number: (latest?.number || 0) + 1, customer_name: customer?.name || null, customer_phone: customer?.phone || null, notes: "Reserva criada pela loja online", snapshot: { source: "storefront_reservation", expires_at: expiresAt.toISOString() }, items: { create: rows } } });
    for (const row of rows) {
      await decrementProductStock(row.product_id, row.quantity, row.selected_options);
      await prisma.stockMovement.create({ data: { tenant_id: tenant.id, product_id: row.product_id, quantity: -row.quantity, type: "held_sale_out", reason: `Reserva online #${heldSale.number}` } });
    }
    res.status(201).json({ reservation_id: heldSale.id, number: heldSale.number, expires_at: expiresAt.toISOString() });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Não foi possível reservar os itens agora." });
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
    const manualPaymentAllowed = customerInfo.paymentMethod === "pix" ? paymentMethods.pix
      : customerInfo.paymentMethod === "cash_on_delivery" ? paymentMethods.cash_on_delivery
        : customerInfo.paymentMethod === "card_on_delivery" ? paymentMethods.card_on_delivery
          : false;
    if (!manualPaymentAllowed) {
      res.status(422).json({ error: "Escolha uma forma de pagamento disponível para esta loja." });
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
    let total = Number(delivery.delivery_fee || 0);
    const orderItems: CheckoutOrderItem[] = [];

    for (const item of items) {
      const product = await prisma.product.findFirst({ where: { id: Number(item.id), tenant_id: tenant.id, is_active: true } });

      if (!product || !Number.isInteger(item.quantity) || item.quantity < 1 || product.stock_quantity < item.quantity) {
        res.status(409).json({ error: "Um dos itens não está mais disponível." });
        return;
      }

      const unitPrice = Number(product.discount_price ?? product.price);
      total += unitPrice * item.quantity;
      orderItems.push({
        product_id: product.id,
        quantity: item.quantity,
        unit_price: unitPrice,
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
        status: "pending",
        payment_method: customerInfo.paymentMethod,
        items: { create: orderItems },
      },
    });

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

    res.json({ success: true, orderId: order.id });
  } catch {
    res.status(500).json({ error: "Checkout failed" });
  }
}
