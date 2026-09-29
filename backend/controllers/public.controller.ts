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

type StorefrontSettings = { checkout_mode?: "whatsapp" | "reservation" | "online"; reservation_minutes?: number };

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
      tenant: {
        ...tenant,
        public_url: buildTenantAccessUrl(tenant.subdomain || tenant.slug),
      },
      categories,
      products,
    });
  } catch {
    res.status(500).json({ error: "Failed to fetch store" });
  }
}

export async function reserveStoreCart(req: Request, res: Response) {
  try {
    await releaseExpiredStoreReservations();
    const { tenantId, items, customer } = req.body as { tenantId: number; items: Array<{ product_id: number; quantity: number; selected_options?: Record<string, string> }>; customer?: { name?: string; phone?: string } };
    if (!tenantId || !Array.isArray(items) || !items.length) return res.status(400).json({ error: "Carrinho inválido." });
    const tenant = await prisma.tenant.findUnique({ where: { id: Number(tenantId) } });
    if (!tenant) return res.status(404).json({ error: "Loja não encontrada." });
    const settings = ((tenant.policies as Record<string, unknown> | null)?.storefront || {}) as StorefrontSettings;
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
    };
  };

  try {
    let total = 0;
    const orderItems: CheckoutOrderItem[] = [];

    for (const item of items) {
      const product = await prisma.product.findUnique({
        where: { id: item.id },
      });

      if (!product) {
        continue;
      }

      total += Number(product.price) * item.quantity;
      orderItems.push({
        product_id: product.id,
        quantity: item.quantity,
        unit_price: Number(product.price),
      });
    }

    const order = await prisma.order.create({
      data: {
        tenant_id: tenantId,
        customer_name: customerInfo.name,
        customer_phone: customerInfo.phone,
        customer_address: customerInfo.address,
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
