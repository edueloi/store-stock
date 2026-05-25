import type { Request, Response } from "express";

import { prisma } from "../config/prisma";
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

export async function getPublicStore(req: Request, res: Response) {
  try {
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
      prisma.category.findMany({ where: { tenant_id: tenant.id } }),
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
