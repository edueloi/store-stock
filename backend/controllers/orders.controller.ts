import type { Request, Response } from "express";

import { prisma } from "../config/prisma";
import type { AuthenticatedRequest } from "../types/auth";
import { localDateString } from "../utils/date";
import { cancelarNfce } from "../services/nfce/cancelar";
import { emitToTenant } from "../services/realtime.service";
import { recalculateCashSessionSummary } from "./cash-sessions.controller";

function getTenantId(req: Request) {
  return (req as AuthenticatedRequest).user.tenantId;
}

function getActor(req: Request): string {
  const u = (req as AuthenticatedRequest).user;
  return (u as any).name ?? (u as any).email ?? "Sistema";
}

// ── helpers ──────────────────────────────────────────────────────────────────

async function logAction(
  tenantId: number,
  orderId: number,
  action: string,
  actor?: string,
  note?: string,
  meta?: object,
) {
  await (prisma as any).orderAction.create({
    data: { tenant_id: tenantId, order_id: orderId, action, actor: actor ?? null, note: note ?? null, meta: meta ?? null },
  });
}

// Reverts stock for all items of a completed order (cancel or delete).
// Also handles SKU/variation stock for items that carried selectedOptions in meta.
async function revertStock(items: { product_id: number | null; quantity: number; selected_options?: any }[]) {
  for (const item of items) {
    // Item avulso (sem produto no catálogo) nunca debitou estoque — nada a reverter.
    if (!item.product_id) continue;
    await prisma.product.update({
      where: { id: item.product_id },
      data: { stock_quantity: { increment: item.quantity } },
    });

    // Revert SKU-level stock if the item had specific variation options stored in meta
    const opts = item.selected_options as Record<string, string> | null | undefined;
    if (opts && Object.keys(opts).length > 0) {
      const product = await prisma.product.findUnique({
        where: { id: item.product_id },
        select: { skus: true, variations: true },
      });
      if (product?.skus) {
        type SkuEntry = { combo: Record<string, string>; stock: number };
        const skus = product.skus as SkuEntry[];
        const updated = skus.map((sku) => {
          const matches = Object.entries(opts).every(([k, v]) => sku.combo[k] === v);
          return matches ? { ...sku, stock: sku.stock + item.quantity } : sku;
        });
        await prisma.product.update({ where: { id: item.product_id }, data: { skus: updated } });
      } else if (product?.variations) {
        type LegacyVariation = { name: string; options: { value: string; stock: number }[] };
        const variations = product.variations as LegacyVariation[];
        const updated = variations.map((v) => ({
          ...v,
          options: v.options.map((o) => {
            const matches = opts[v.name] === o.value;
            return matches ? { ...o, stock: o.stock + item.quantity } : o;
          }),
        }));
        await prisma.product.update({ where: { id: item.product_id }, data: { variations: updated } });
      }
    }
  }
}

// ── Controllers ───────────────────────────────────────────────────────────────

export async function listOrders(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const orders = await prisma.order.findMany({
      where: { tenant_id: tenantId },
      orderBy: { created_at: "desc" },
      take: limit,
      include: {
        items: { include: { product: { select: { name: true, image_url: true } } } },
        services: true,
        nfce_invoice: { select: { status: true, access_key: true } },
      },
    });

    // Para pedidos sem documento avulso digitado na venda, completa com o CPF/CNPJ do
    // cliente cadastrado vinculado — usado para decidir se o pedido é elegível a NFC-e.
    const customerIds = [...new Set(
      orders.filter((o) => o.customer_id && !o.customer_document).map((o) => o.customer_id as number),
    )];
    const customers = customerIds.length
      ? await prisma.customer.findMany({ where: { id: { in: customerIds }, tenant_id: tenantId }, select: { id: true, document: true } })
      : [];
    const docByCustomerId = new Map(customers.map((c) => [c.id, c.document]));

    res.json(orders.map((order) => ({
      ...order,
      customer_document: order.customer_document ?? (order.customer_id ? docByCustomerId.get(order.customer_id) ?? null : null),
      items: order.items.map((item) => ({
        id: item.id,
        product_name: item.product?.name ?? item.name,
        image_url: item.product?.image_url ?? null,
        quantity: item.quantity,
        unit_price: item.unit_price,
      })),
      services: order.services.map((svc) => ({
        id: svc.id, service_id: svc.service_id, name: svc.name,
        unit_price: svc.unit_price, quantity: svc.quantity,
      })),
    })));
  } catch {
    res.status(500).json({ error: "Failed to fetch orders" });
  }
}

// Busca vendas já concluídas por número do pedido, nome do cliente ou nome de
// produto vendido — usado pelo PDV (interno e standalone) para o operador
// localizar e reimprimir o cupom de uma venda antiga sem precisar abrir a
// tela de Pedidos do dashboard admin (o PDV standalone nem tem acesso a ela).
export async function searchOrders(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const q = String(req.query.q ?? "").trim();
    if (!q) { res.json([]); return; }

    const asNumber = Number(q.replace(/\D/g, ""));
    const orders = await prisma.order.findMany({
      where: {
        tenant_id: tenantId,
        status: "completed",
        OR: [
          ...(q.replace(/\D/g, "") && !Number.isNaN(asNumber) ? [{ id: asNumber }] : []),
          { customer_name: { contains: q } },
          { items: { some: { name: { contains: q } } } },
          { items: { some: { product: { name: { contains: q } } } } },
        ],
      },
      orderBy: { created_at: "desc" },
      take: 30,
      include: {
        items: { include: { product: { select: { name: true } } } },
      },
    });

    res.json(orders.map((order) => ({
      id: order.id,
      created_at: order.created_at,
      customer_name: order.customer_name,
      total_amount: order.total_amount,
      payment_method: order.payment_method,
      items: order.items.map((item) => ({
        product_name: item.product?.name ?? item.name,
        quantity: item.quantity,
      })),
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao buscar vendas" });
  }
}

export async function getOrderById(req: Request, res: Response) {
  try {
    const order = await prisma.order.findFirst({
      where: { id: Number(req.params.id), tenant_id: getTenantId(req) },
      include: {
        items: { include: { product: { select: { name: true, image_url: true } } } },
        services: true,
      },
    });

    if (!order) { res.status(404).json({ error: "Order not found" }); return; }

    res.json({
      ...order,
      items: order.items.map((item) => ({
        ...item,
        product_name: item.product?.name ?? item.name,
        image_url: item.product?.image_url ?? null,
      })),
      services: order.services.map((svc) => ({
        id: svc.id, service_id: svc.service_id, name: svc.name,
        unit_price: svc.unit_price, quantity: svc.quantity,
      })),
    });
  } catch {
    res.status(500).json({ error: "Failed to fetch order details" });
  }
}

export async function getOrderActions(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const orderId  = Number(req.params.id);

    const order = await prisma.order.findFirst({ where: { id: orderId, tenant_id: tenantId }, select: { id: true } });
    if (!order) { res.status(404).json({ error: "Pedido não encontrado" }); return; }

    const actions = await (prisma as any).orderAction.findMany({
      where: { order_id: orderId, tenant_id: tenantId },
      orderBy: { created_at: "desc" },
    });

    res.json(actions);
  } catch {
    res.status(500).json({ error: "Falha ao buscar histórico" });
  }
}

export async function updateOrderStatus(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const orderId  = Number(req.params.id);
    const newStatus: string = req.body.status;

    const order = await prisma.order.findFirst({ where: { id: orderId, tenant_id: tenantId } });
    if (!order) { res.status(404).json({ error: "Order not found" }); return; }

    await prisma.order.update({ where: { id: orderId }, data: { status: newStatus } });

    // Log the status change
    await logAction(tenantId, orderId, "status_change", getActor(req), `Status alterado: ${order.status} → ${newStatus}`);

    // When a pending order is manually marked as completed, create the finance entry
    if (newStatus === "completed" && order.status !== "completed") {
      const total    = Number(order.total_amount);
      const fee      = Number(order.fee_amount ?? 0);
      const discount = Number(order.discount_amount ?? 0);
      const gross    = Number(order.gross_amount ?? total);
      const net      = Math.round((total - fee) * 100) / 100;

      const pm = order.payment_method ?? "money";
      const methodLabel: Record<string, string> = { money: "Dinheiro", pix: "PIX", debit: "Débito", credit: "Crédito" };
      const methodSummary = pm.split("|").map(seg => {
        const method = seg.split(":")[0].split("-")[0];
        return methodLabel[method] ?? method;
      }).join(" + ");
      const discountNote = discount > 0 ? ` (desc. R$ ${discount.toFixed(2)})` : "";

      await prisma.finance.create({
        data: {
          tenant_id: tenantId, type: "income",
          description: `Venda PDV #${orderId} — ${methodSummary}${discountNote}`,
          amount: net, gross_amount: gross,
          fee_amount: fee > 0 ? fee : null,
          discount_amount: discount > 0 ? discount : null,
          payment_method: pm,
          date: localDateString(),
        },
      });

      await logAction(tenantId, orderId, "finance_created", getActor(req), `Entrada financeira criada: R$ ${net.toFixed(2)}`);
      emitToTenant(tenantId, "finance:changed", { orderId });
    }

    emitToTenant(tenantId, "order:updated", { orderId, status: newStatus });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to update order status" });
  }
}

// Permite informar/corrigir o CPF/CNPJ do pedido depois da venda — necessário
// pra emitir NFC-e/NFS-e de um pedido de balcão feito sem documento (comum
// no PDV) sem precisar refazer a venda. Endpoint dedicado (em vez de um PUT
// genérico de pedido) pra não abrir superfície de edição em campos sensíveis
// como valor/itens/pagamento depois que a venda já foi efetivada.
export async function updateOrderDocument(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const orderId = Number(req.params.id);
    const { customer_document } = req.body as { customer_document?: string | null };

    const order = await prisma.order.findFirst({ where: { id: orderId, tenant_id: tenantId } });
    if (!order) { res.status(404).json({ error: "Pedido não encontrado" }); return; }

    const digits = (customer_document ?? "").replace(/\D/g, "");
    if (digits && digits.length !== 11 && digits.length !== 14) {
      res.status(422).json({ error: "Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido." });
      return;
    }

    await prisma.order.update({
      where: { id: orderId },
      data: { customer_document: digits || null },
    });

    emitToTenant(tenantId, "order:updated", { orderId });
    res.json({ success: true, customer_document: digits || null });
  } catch {
    res.status(500).json({ error: "Falha ao atualizar CPF/CNPJ do pedido" });
  }
}

export async function cancelOrder(req: Request, res: Response) {
  try {
    const tenantId  = getTenantId(req);
    const orderId   = Number(req.params.id);
    const { cancel_reason, cancelled_by } = req.body as { cancel_reason?: string; cancelled_by?: string };

    const order = await prisma.order.findFirst({
      where: { id: orderId, tenant_id: tenantId },
      include: { items: true },
    });

    if (!order) { res.status(404).json({ error: "Pedido não encontrado" }); return; }
    if (order.status === "cancelled") { res.status(400).json({ error: "Pedido já cancelado" }); return; }

    // Mark as cancelled
    await prisma.order.update({
      where: { id: orderId },
      data: {
        status:        "cancelled",
        cancelled_by:  cancelled_by || "Sistema",
        cancel_reason: cancel_reason || null,
        cancelled_at:  new Date(),
      },
    });

    // Revert stock (total + SKU/variation level)
    const itemsWithOptions = order.items.map((item) => ({
      product_id: item.product_id,
      quantity:   item.quantity,
      selected_options: (item as any).selected_options ?? null,
    }));
    await revertStock(itemsWithOptions);

    // Build stock revert summary for the log
    const stockNote = order.items.map(i => `#${i.product_id} +${i.quantity}`).join(", ");

    // Remove the original finance entry linked to this order (instead of creating a counter-entry)
    // This cleanly removes the sale from cash flow and the overview, as if it never happened.
    const deleted = await (prisma.finance as any).deleteMany({
      where: { tenant_id: tenantId, order_id: orderId },
    });

    // Fallback: if no order_id link found, try matching by description (legacy entries)
    if (deleted.count === 0) {
      await prisma.finance.deleteMany({
        where: {
          tenant_id:   tenantId,
          description: { contains: `#${orderId}` },
          type:        "income",
        },
      });
    }

    // Se este pedido pertencia a uma sessão de caixa (aberta ou já fechada), recalcula
    // o resumo dela agora — sem isso, cancelar uma venda em dinheiro de uma sessão já
    // fechada não tira o valor do "esperado", deixando a diferença do fechamento
    // desatualizada/errada para sempre (bug real visto em produção).
    if (order.cash_session_id) {
      await recalculateCashSessionSummary(tenantId, order.cash_session_id);
    }

    // Log the cancellation action
    await logAction(
      tenantId, orderId, "cancelled",
      cancelled_by || getActor(req),
      cancel_reason || undefined,
      { stock_reverted: stockNote, finance_entries_removed: deleted.count },
    );

    // Se houver NFC-e autorizada para este pedido, tenta cancelar o evento fiscal.
    // Não bloqueia o cancelamento do pedido em si — estoque/financeiro já revertidos acima
    // independentemente do resultado fiscal, que fica registrado no NfceInvoice.
    let nfceCancel: { attempted: boolean; success?: boolean; error?: string } = { attempted: false };
    const invoice = await prisma.nfceInvoice.findUnique({ where: { order_id: orderId } });
    if (invoice && invoice.status === "authorized") {
      nfceCancel.attempted = true;
      const result = await cancelarNfce(orderId, cancel_reason || "Cancelamento do pedido pelo operador");
      nfceCancel.success = result.success;
      if (!result.success) nfceCancel.error = result.error;
      emitToTenant(tenantId, "nfce:changed", { orderId });
    }

    emitToTenant(tenantId, "order:cancelled", { orderId });
    emitToTenant(tenantId, "stock:changed", { orderId });
    emitToTenant(tenantId, "finance:changed", { orderId });

    res.json({ success: true, nfce: nfceCancel });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao cancelar pedido" });
  }
}

interface OrderReturnLineInput {
  order_item_id: number;
  quantity: number;
  restock: boolean;
}

// Devolução/troca de item(ns) de um pedido — granularidade por item e quantidade
// parcial (diferente de cancelOrder, que só reverte o pedido inteiro). Uma
// operação = um OrderReturn com N OrderReturnItem, um único crédito resultante,
// um único lançamento de estorno no financeiro (não apaga a venda original,
// diferente de cancelOrder — mesmo padrão auditável de reverseDebtPayment em
// customers.controller.ts).
export async function createOrderReturn(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const orderId = Number(req.params.id);
    const { items, reason } = req.body as { items: OrderReturnLineInput[]; reason?: string };

    if (!Array.isArray(items) || items.length === 0) {
      res.status(422).json({ error: "Informe ao menos um item para devolver" });
      return;
    }

    const order = await prisma.order.findFirst({ where: { id: orderId, tenant_id: tenantId } });
    if (!order) { res.status(404).json({ error: "Pedido não encontrado" }); return; }
    if (order.status === "cancelled") {
      res.status(400).json({ error: "Pedido já cancelado — estoque e financeiro já foram revertidos por inteiro" });
      return;
    }
    if (order.status !== "completed") {
      res.status(400).json({ error: "Só é possível devolver itens de um pedido já efetivado" });
      return;
    }

    const actor = getActor(req);

    const result = await prisma.$transaction(async (tx) => {
      // Relê os OrderItem de dentro da transação — evita que duas devoluções
      // concorrentes do mesmo item validem contra o mesmo returned_quantity
      // desatualizado e juntas somem mais do que foi vendido.
      const orderItemIds = items.map((l) => l.order_item_id);
      const orderItems = await tx.orderItem.findMany({
        where: { id: { in: orderItemIds }, order_id: orderId },
      });
      const orderItemById = new Map(orderItems.map((oi) => [oi.id, oi]));

      for (const line of items) {
        const oi = orderItemById.get(line.order_item_id);
        if (!oi) throw new Error(`ITEM_NOT_FOUND:${line.order_item_id}`);
        const available = oi.quantity - oi.returned_quantity;
        if (!Number.isInteger(line.quantity) || line.quantity <= 0 || line.quantity > available) {
          throw new Error(`INVALID_QUANTITY:${line.order_item_id}`);
        }
      }

      const orderReturn = await tx.orderReturn.create({
        data: { tenant_id: tenantId, order_id: orderId, reason: reason || null, created_by: actor },
      });

      let creditAmount = 0;
      for (const line of items) {
        const oi = orderItemById.get(line.order_item_id)!;
        const unitPrice = Number(oi.unit_price);

        await tx.orderReturnItem.create({
          data: {
            order_return_id: orderReturn.id,
            order_item_id: oi.id,
            quantity: line.quantity,
            unit_price: unitPrice,
            restock: line.restock,
          },
        });

        await tx.orderItem.update({
          where: { id: oi.id },
          data: { returned_quantity: { increment: line.quantity } },
        });

        // Item avulso (product_id null) nunca debitou estoque — nunca reverte,
        // mesma regra de revertStock (linha 38). Descarte (restock false) também
        // não reverte: produto com defeito não deve voltar a ser vendável.
        if (line.restock && oi.product_id) {
          await tx.product.update({
            where: { id: oi.product_id },
            data: { stock_quantity: { increment: line.quantity } },
          });
          await tx.stockMovement.create({
            data: {
              tenant_id: tenantId,
              product_id: oi.product_id,
              quantity: line.quantity,
              type: "order_return",
              reason: reason || `Devolução — Pedido #${orderId}`,
            },
          });
        }

        // Restock só controla se o item físico volta ao estoque vendável — o
        // valor sempre é reembolsado/vira crédito pra todo item devolvido,
        // independente da condição em que voltou.
        creditAmount += unitPrice * line.quantity;
      }
      creditAmount = Math.round(creditAmount * 100) / 100;

      const finance = await tx.finance.create({
        data: {
          tenant_id: tenantId,
          type: "expense",
          description: `Devolução — Pedido #${orderId}`,
          amount: creditAmount,
          source: "order_return",
          order_id: orderId,
          date: localDateString(),
        },
      });

      let credit: { id: number; amount: number } | null = null;
      if (order.customer_id && creditAmount > 0) {
        const created = await tx.customerCredit.create({
          data: {
            tenant_id: tenantId,
            customer_id: order.customer_id,
            amount: creditAmount,
            balance: creditAmount,
            source: "order_return",
            order_return_id: orderReturn.id,
          },
        });
        credit = { id: created.id, amount: creditAmount };
      }

      await tx.orderReturn.update({ where: { id: orderReturn.id }, data: { credit_amount: creditAmount } });

      await tx.orderAction.create({
        data: {
          tenant_id: tenantId,
          order_id: orderId,
          action: "returned",
          actor,
          note: reason || null,
          meta: { order_return_id: orderReturn.id, credit_amount: creditAmount, finance_id: finance.id, credit_id: credit?.id ?? null },
        },
      });

      return { orderReturnId: orderReturn.id, creditAmount, credit };
    });

    emitToTenant(tenantId, "order:returned", { orderId });
    emitToTenant(tenantId, "stock:changed", { orderId });
    emitToTenant(tenantId, "finance:changed", { orderId });
    if (result.credit) emitToTenant(tenantId, "customer-credit:changed", { customerId: order.customer_id });

    res.json({ success: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.startsWith("ITEM_NOT_FOUND")) { res.status(404).json({ error: "Item do pedido não encontrado" }); return; }
    if (msg.startsWith("INVALID_QUANTITY")) { res.status(422).json({ error: "Quantidade a devolver inválida ou maior que a disponível" }); return; }
    console.error(err);
    res.status(500).json({ error: "Falha ao registrar devolução" });
  }
}

export async function listOrderReturns(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const orderId = Number(req.params.id);
    const returns = await prisma.orderReturn.findMany({
      where: { order_id: orderId, tenant_id: tenantId },
      include: { items: true, credit: true },
      orderBy: { created_at: "desc" },
    });
    res.json(returns);
  } catch {
    res.status(500).json({ error: "Falha ao buscar devoluções" });
  }
}

export async function deleteOrder(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const orderId  = Number(req.params.id);
    const shouldRevertStock   = req.body?.revertStock   !== false;
    const shouldRevertFinance = req.body?.revertFinance !== false;

    const order = await prisma.order.findFirst({
      where: { id: orderId, tenant_id: tenantId },
      include: { items: true, nfce_invoice: true },
    });

    if (!order) { res.status(404).json({ error: "Pedido não encontrado" }); return; }

    // Uma NFC-e autorizada é um documento fiscal válido perante a SEFAZ — não dá
    // pra simplesmente apagar o pedido por baixo dela. É preciso cancelar a nota
    // primeiro (via "Cancelar pedido", que já faz esse evento fiscal).
    if (order.nfce_invoice && order.nfce_invoice.status === "authorized") {
      res.status(409).json({
        error: "Este pedido tem uma NFC-e autorizada. Cancele o pedido (o que também cancela a nota fiscal) antes de excluí-lo.",
      });
      return;
    }

    // "completed" (venda no PDV) e "pending" (pedido da loja online, ainda não
    // confirmado) já debitam estoque na criação — precisam devolver ao excluir.
    // "cancelled" já teve o estoque revertido pelo cancelamento, não reverte de novo.
    if (order.status === "completed" || order.status === "pending") {
      if (shouldRevertStock) {
        const itemsWithOptions = order.items.map((item) => ({
          product_id: item.product_id,
          quantity:   item.quantity,
          selected_options: (item as any).selected_options ?? null,
        }));
        await revertStock(itemsWithOptions);
      }

      if (shouldRevertFinance) {
        const deleted = await (prisma.finance as any).deleteMany({
          where: { tenant_id: tenantId, order_id: orderId },
        });
        if (deleted.count === 0) {
          await prisma.finance.deleteMany({
            where: { tenant_id: tenantId, description: { contains: `#${orderId}` }, type: "income" },
          });
        }
      }
    }

    // Nota não-autorizada (pending/rejected/error/cancelled) não tem validade fiscal —
    // pode ser removida junto com o pedido, senão a FK trava a exclusão do pedido.
    if (order.nfce_invoice) {
      await prisma.nfceInvoice.delete({ where: { id: order.nfce_invoice.id } });
    }

    await prisma.orderItem.deleteMany({ where: { order_id: orderId } });
    await prisma.orderService.deleteMany({ where: { order_id: orderId } });
    await prisma.order.delete({ where: { id: orderId } });

    // Se este pedido pertencia a uma sessão de caixa (aberta ou já fechada), recalcula
    // o resumo dela agora que o pedido não existe mais — mesma razão do cancelamento:
    // sem isso, excluir uma venda em dinheiro de uma sessão já fechada não tira o valor
    // do "esperado", deixando a diferença do fechamento errada para sempre.
    if (order.cash_session_id) {
      await recalculateCashSessionSummary(tenantId, order.cash_session_id);
    }

    emitToTenant(tenantId, "order:deleted", { orderId });
    emitToTenant(tenantId, "stock:changed", { orderId });
    emitToTenant(tenantId, "finance:changed", { orderId });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao deletar pedido" });
  }
}

export async function bulkDeleteOrders(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const { ids } = req.body as { ids: number[] };
    const shouldRevertStock   = req.body?.revertStock   !== false;
    const shouldRevertFinance = req.body?.revertFinance !== false;

    if (!Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ error: "IDs inválidos" }); return;
    }

    const orders = await prisma.order.findMany({
      where: { id: { in: ids }, tenant_id: tenantId },
      include: { items: true, nfce_invoice: true },
    });

    if (orders.length === 0) { res.status(404).json({ error: "Nenhum pedido encontrado" }); return; }

    // Pedidos com NFC-e autorizada são documentos fiscais válidos — não entram no
    // hard-delete. Precisam ser cancelados primeiro (o que cancela a nota também).
    const blocked  = orders.filter((o) => o.nfce_invoice && o.nfce_invoice.status === "authorized");
    const deletable = orders.filter((o) => !blocked.includes(o));
    const validIds = deletable.map((o) => o.id);

    for (const order of deletable) {
      if (order.status === "completed" || order.status === "pending") {
        if (shouldRevertStock) {
          const itemsWithOptions = order.items.map((item) => ({
            product_id: item.product_id,
            quantity:   item.quantity,
            selected_options: (item as any).selected_options ?? null,
          }));
          await revertStock(itemsWithOptions);
        }

        if (shouldRevertFinance) {
          const deleted = await (prisma.finance as any).deleteMany({
            where: { tenant_id: tenantId, order_id: order.id },
          });
          if (deleted.count === 0) {
            await prisma.finance.deleteMany({
              where: { tenant_id: tenantId, description: { contains: `#${order.id}` }, type: "income" },
            });
          }
        }
      }

      // Nota não-autorizada não tem validade fiscal — some junto com o pedido,
      // senão a FK do nfce_invoices trava o delete do pedido.
      if (order.nfce_invoice) {
        await prisma.nfceInvoice.delete({ where: { id: order.nfce_invoice.id } });
      }
    }

    await prisma.orderItem.deleteMany({ where: { order_id: { in: validIds } } });
    await prisma.orderService.deleteMany({ where: { order_id: { in: validIds } } });
    await prisma.order.deleteMany({ where: { id: { in: validIds } } });

    if (validIds.length > 0) {
      emitToTenant(tenantId, "order:deleted", { orderIds: validIds });
      emitToTenant(tenantId, "stock:changed", { orderIds: validIds });
      emitToTenant(tenantId, "finance:changed", { orderIds: validIds });
    }

    res.json({
      success: true,
      deleted: validIds.length,
      blocked: blocked.map((o) => ({ id: o.id, reason: "NFC-e autorizada — cancele o pedido antes de excluir" })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao deletar pedidos" });
  }
}
