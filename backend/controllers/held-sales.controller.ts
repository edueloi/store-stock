import type { Request, Response } from "express";

import { prisma } from "../config/prisma";
import type { AuthenticatedRequest } from "../types/auth";
import { decrementProductStock, returnProductStock } from "../utils/stock-adjust";

function getTenantId(req: Request) {
  return (req as AuthenticatedRequest).user.tenantId;
}

function getActor(req: Request): string {
  const u = (req as AuthenticatedRequest).user;
  return (u as any).name ?? (u as any).email ?? "Sistema";
}

async function logAction(
  tenantId: number,
  heldSaleId: number,
  action: string,
  opts?: { fromStatus?: string; toStatus?: string; actor?: string; note?: string; meta?: object },
) {
  await prisma.heldSaleAction.create({
    data: {
      tenant_id: tenantId,
      held_sale_id: heldSaleId,
      action,
      from_status: opts?.fromStatus ?? null,
      to_status: opts?.toStatus ?? null,
      actor: opts?.actor ?? null,
      note: opts?.note ?? null,
      meta: opts?.meta ?? undefined,
    },
  });
}

const HELD_SALE_INCLUDE = {
  items: true,
};

export async function listHeldSales(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const status = req.query.status as string | undefined;

    const heldSales = await prisma.heldSale.findMany({
      where: {
        tenant_id: tenantId,
        ...(status ? { status } : { status: { in: ["held", "resumed"] } }),
      },
      include: HELD_SALE_INCLUDE,
      orderBy: { created_at: "desc" },
    });
    res.json(heldSales);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao listar vendas em espera" });
  }
}

export async function getOpenHeldSalesCount(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const count = await prisma.heldSale.count({
      where: { tenant_id: tenantId, status: { in: ["held", "resumed"] } },
    });
    res.json({ count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao contar vendas em espera" });
  }
}

export async function getHeldSaleById(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const heldSale = await prisma.heldSale.findFirst({
      where: { id: Number(req.params.id), tenant_id: tenantId },
      include: { ...HELD_SALE_INCLUDE, actions: { orderBy: { created_at: "desc" } } },
    });
    if (!heldSale) return res.status(404).json({ error: "Venda em espera não encontrada" });
    res.json(heldSale);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao buscar venda em espera" });
  }
}

export async function createHeldSale(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);

    const {
      customer_id,
      customer_name,
      customer_phone,
      seller_id,
      notes,
      snapshot,
      items,
    } = req.body as {
      customer_id?: number;
      customer_name?: string;
      customer_phone?: string;
      seller_id?: number;
      notes?: string;
      snapshot?: object;
      items: Array<{
        product_id: number;
        quantity: number;
        selectedOptions?: Record<string, string> | null;
        dimensionsLabel?: string | null;
      }>;
    };

    // items = só produtos (o que precisa de reserva de estoque); serviços não têm
    // estoque, então uma comanda só-de-serviços é válida com items = [] — o carrinho
    // completo (produtos + serviços) já foi validado como não-vazio no frontend.
    if (!Array.isArray(items)) {
      return res.status(400).json({ error: "Itens inválidos" });
    }

    // Resolve, valida e reserva estoque de cada item ANTES de criar a venda em espera —
    // mesmo princípio de createConsignment: nunca confia em preço/nome mandado pelo cliente.
    const itemRows: { product_id: number; name: string; quantity: number; unit_price: number; selected_options: any; dimensions_label: string | null }[] = [];
    for (const it of items) {
      const product = await prisma.product.findFirst({ where: { id: it.product_id, tenant_id: tenantId } });
      if (!product) return res.status(400).json({ error: `Produto ${it.product_id} não encontrado` });
      if (product.sale_unit && product.sale_unit !== "unidade") {
        return res.status(400).json({ error: `Produto "${product.name}" é vendido por medida e não pode ser segurado` });
      }
      if (product.stock_quantity < it.quantity) {
        return res.status(400).json({ error: `Estoque insuficiente para "${product.name}"` });
      }
      itemRows.push({
        product_id: product.id,
        name: product.name,
        quantity: it.quantity,
        unit_price: Number(product.discount_price ?? product.price),
        selected_options: it.selectedOptions ?? null,
        dimensions_label: it.dimensionsLabel ?? null,
      });
    }

    const last = await prisma.heldSale.findFirst({
      where: { tenant_id: tenantId },
      orderBy: { number: "desc" },
      select: { number: true },
    });
    const nextNumber = (last?.number ?? 0) + 1;

    let sellerName: string | null = null;
    if (seller_id) {
      const seller = await prisma.seller.findUnique({ where: { id: seller_id }, select: { name: true } });
      sellerName = seller?.name ?? null;
    }

    const heldSale = await prisma.heldSale.create({
      data: {
        tenant_id: tenantId,
        number: nextNumber,
        customer_id: customer_id || null,
        customer_name: customer_name || null,
        customer_phone: customer_phone || null,
        seller_id: seller_id || null,
        seller_name: sellerName,
        notes: notes || null,
        snapshot: snapshot ?? undefined,
        items: { create: itemRows },
      },
      include: HELD_SALE_INCLUDE,
    });

    // Reserva (debita) o estoque, com rastreio em StockMovement — só é devolvido se
    // esta venda em espera for cancelada (nunca ao retomar).
    for (const row of itemRows) {
      await decrementProductStock(row.product_id, row.quantity, row.selected_options);
      await prisma.stockMovement.create({
        data: {
          tenant_id: tenantId,
          product_id: row.product_id,
          quantity: -row.quantity,
          type: "held_sale_out",
          reason: `Venda em espera #${nextNumber}`,
        },
      });
    }

    await logAction(tenantId, heldSale.id, "created", { toStatus: heldSale.status, actor: getActor(req) });

    res.status(201).json(heldSale);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao segurar a venda" });
  }
}

// Não-exclusivo: pode ser retomada mais de uma vez (ex.: outro caixa, ou reabrir depois
// de já ter sido carregada) — só marca quem/quando pra exibir um aviso na UI, nunca
// bloqueia. O bloqueio de verdade (evitar duas finalizações/cancelamentos concorrentes)
// acontece em cancelHeldSale e no finalize de /api/sales, que são exclusivos.
export async function resumeHeldSale(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const id = Number(req.params.id);

    const existing = await prisma.heldSale.findFirst({ where: { id, tenant_id: tenantId } });
    if (!existing) return res.status(404).json({ error: "Venda em espera não encontrada" });
    if (!["held", "resumed"].includes(existing.status)) {
      return res.status(400).json({ error: "Esta venda em espera já foi cancelada ou finalizada." });
    }

    const actor = getActor(req);
    const updated = await prisma.heldSale.update({
      where: { id },
      data: { status: "resumed", resumed_by: actor, resumed_at: new Date() },
      include: { ...HELD_SALE_INCLUDE, actions: { orderBy: { created_at: "desc" } } },
    });

    await logAction(tenantId, id, "resumed", { fromStatus: existing.status, toStatus: "resumed", actor });

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao retomar a venda em espera" });
  }
}

export async function cancelHeldSale(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const id = Number(req.params.id);
    const { cancel_reason } = req.body as { cancel_reason?: string };
    const actor = getActor(req);

    // Trava atômica: só cancela se ainda estiver held/resumed. `status` não é chave única,
    // então o guard precisa ser via updateMany + checar count (update() por id não permite
    // condicionar em outra coluna).
    const claim = await prisma.heldSale.updateMany({
      where: { id, tenant_id: tenantId, status: { in: ["held", "resumed"] } },
      data: { status: "cancelled", cancelled_by: actor, cancel_reason: cancel_reason || null, cancelled_at: new Date() },
    });
    if (claim.count === 0) {
      return res.status(409).json({ error: "Esta venda em espera já foi cancelada ou finalizada." });
    }

    const items = await prisma.heldSaleItem.findMany({ where: { held_sale_id: id, resolution: "pending" } });
    for (const item of items) {
      await returnProductStock(item.product_id, item.quantity, item.selected_options as Record<string, string> | null);
      await prisma.stockMovement.create({
        data: {
          tenant_id: tenantId,
          product_id: item.product_id,
          quantity: item.quantity,
          type: "held_sale_return",
          reason: "Cancelamento de venda em espera",
        },
      });
      await prisma.heldSaleItem.update({ where: { id: item.id }, data: { resolution: "returned", resolved_at: new Date() } });
    }

    await logAction(tenantId, id, "cancelled", { toStatus: "cancelled", actor, note: cancel_reason });

    const updated = await prisma.heldSale.findFirst({
      where: { id, tenant_id: tenantId },
      include: { ...HELD_SALE_INCLUDE, actions: { orderBy: { created_at: "desc" } } },
    });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao cancelar a venda em espera" });
  }
}
