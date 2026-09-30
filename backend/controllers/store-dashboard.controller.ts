import type { Request, Response } from "express";

import { prisma } from "../config/prisma";
import type { AuthenticatedRequest } from "../types/auth";

const tenantIdOf = (req: Request) => (req as AuthenticatedRequest).user.tenantId;

/** Painel privado da vitrine: somente pedidos que nasceram na loja online. */
export async function getStorefrontDashboard(req: Request, res: Response) {
  try {
    const tenantId = tenantIdOf(req);
    const days = Math.min(365, Math.max(1, Number(req.query.days) || 30));
    const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const orders = await prisma.order.findMany({
      where: { tenant_id: tenantId, sales_channel: "storefront", created_at: { gte: from } },
      orderBy: { created_at: "desc" },
      // A central de vendas precisa permitir a conferência dos pedidos de um período inteiro.
      // O limite ainda protege o painel de uma consulta sem paginação infinita.
      take: 250,
      select: {
        id: true, customer_name: true, customer_phone: true, customer_document: true, customer_address: true, total_amount: true,
        gross_amount: true, discount_amount: true, payment_method: true,
        delivery_method: true, shipping_amount: true, status: true, created_at: true,
        items: { select: { product_id: true, name: true, quantity: true, unit_price: true, product: { select: { name: true, sku: true } } } },
      },
    });
    const confirmed = orders.filter((order) => order.status === "completed");
    const active = orders.filter((order) => !["cancelled", "canceled"].includes(order.status));
    const productMap = new Map<string, { name: string; sku: string | null; units: number; revenue: number }>();
    for (const order of active) {
      for (const item of order.items) {
        const name = item.product?.name || item.name || "Item removido";
        const key = `${item.product_id || name}`;
        const current = productMap.get(key) || { name, sku: item.product?.sku || null, units: 0, revenue: 0 };
        current.units += item.quantity;
        current.revenue += Number(item.unit_price) * item.quantity;
        productMap.set(key, current);
      }
    }
    res.json({
      period_days: days,
      summary: {
        orders: active.length,
        confirmed_orders: confirmed.length,
        pending_orders: orders.filter((order) => order.status === "pending").length,
        confirmed_revenue: confirmed.reduce((sum, order) => sum + Number(order.total_amount), 0),
        potential_revenue: active.reduce((sum, order) => sum + Number(order.total_amount), 0),
        discounts: active.reduce((sum, order) => sum + Number(order.discount_amount || 0), 0),
        units_sold: [...productMap.values()].reduce((sum, item) => sum + item.units, 0),
      },
      top_products: [...productMap.values()].sort((a, b) => b.units - a.units || b.revenue - a.revenue).slice(0, 8),
      recent_orders: orders.map((order) => ({
        ...order,
        total_amount: Number(order.total_amount),
        gross_amount: order.gross_amount === null ? null : Number(order.gross_amount),
        discount_amount: order.discount_amount === null ? null : Number(order.discount_amount),
        shipping_amount: order.shipping_amount === null ? 0 : Number(order.shipping_amount),
        items: order.items.map((item) => ({ ...item, unit_price: Number(item.unit_price) })),
      })),
    });
  } catch (error) {
    console.error("Falha ao carregar painel da loja online", error);
    res.status(500).json({ error: "Não foi possível carregar as vendas online." });
  }
}
