import type { Request, Response } from "express";

import { prisma } from "../config/prisma";
import type { AuthenticatedRequest } from "../types/auth";
import { localDateString } from "../utils/date";
import { computeMeasuredPrice } from "../utils/measurePricing";

function getTenantId(req: Request) {
  return (req as AuthenticatedRequest).user.tenantId;
}

function getActor(req: Request): string {
  const u = (req as AuthenticatedRequest).user;
  return (u as any).name ?? (u as any).email ?? "Sistema";
}

const ALLOWED_STATUSES = ["aberta", "em_analise", "em_conserto", "pronto_retirada", "entregue", "cancelada"];
const STATUS_ORDER = ["aberta", "em_analise", "em_conserto", "pronto_retirada", "entregue"];
const ALLOWED_PRIORITIES = ["normal", "urgente"];

async function logAction(
  tenantId: number,
  serviceOrderId: number,
  action: string,
  opts?: { fromStatus?: string; toStatus?: string; actor?: string; note?: string; meta?: object },
) {
  await prisma.serviceOrderAction.create({
    data: {
      tenant_id: tenantId,
      service_order_id: serviceOrderId,
      action,
      from_status: opts?.fromStatus ?? null,
      to_status: opts?.toStatus ?? null,
      actor: opts?.actor ?? null,
      note: opts?.note ?? null,
      meta: opts?.meta ?? undefined,
    },
  });
}

async function recomputeTotals(serviceOrderId: number) {
  const parts = await prisma.serviceOrderPart.findMany({ where: { service_order_id: serviceOrderId } });
  const partsTotal = parts.reduce((sum, p) => sum + Number(p.total), 0);
  const so = await prisma.serviceOrder.findUnique({ where: { id: serviceOrderId }, select: { service_value: true } });
  const serviceValue = Number(so?.service_value ?? 0);
  const totalAmount = Math.round((serviceValue + partsTotal) * 100) / 100;
  await prisma.serviceOrder.update({
    where: { id: serviceOrderId },
    data: { parts_total: partsTotal, total_amount: totalAmount },
  });
  return { partsTotal, totalAmount };
}

const SERVICE_ORDER_INCLUDE = {
  checklist_items: { orderBy: { position: "asc" as const } },
  parts: true,
  photos: { orderBy: { created_at: "asc" as const } },
};

export async function listServiceOrders(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const status = req.query.status as string | undefined;
    const orders = await prisma.serviceOrder.findMany({
      where: { tenant_id: tenantId, ...(status ? { status } : {}) },
      include: SERVICE_ORDER_INCLUDE,
      orderBy: { created_at: "desc" },
    });
    res.json(orders);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao listar ordens de serviço" });
  }
}

export async function getServiceOrderById(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const order = await prisma.serviceOrder.findFirst({
      where: { id: Number(req.params.id), tenant_id: tenantId },
      include: {
        ...SERVICE_ORDER_INCLUDE,
        actions: { orderBy: { created_at: "desc" } },
      },
    });
    if (!order) return res.status(404).json({ error: "Ordem de serviço não encontrada" });
    res.json(order);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao buscar ordem de serviço" });
  }
}

export async function createServiceOrder(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);

    const last = await prisma.serviceOrder.findFirst({
      where: { tenant_id: tenantId },
      orderBy: { number: "desc" },
      select: { number: true },
    });
    const nextNumber = (last?.number ?? 0) + 1;

    const {
      customer_id,
      customer_name,
      customer_phone,
      equipment_category,
      equipment_type,
      equipment_brand,
      equipment_model,
      equipment_serial,
      equipment_accessories,
      reported_issue,
      seller_id,
      technician_name,
      priority,
      promised_at,
      service_value,
      warranty_days,
      warranty_terms,
      observations,
      parts,
    } = req.body as {
      customer_id?: number;
      customer_name: string;
      customer_phone?: string;
      equipment_category: string;
      equipment_type?: string;
      equipment_brand?: string;
      equipment_model?: string;
      equipment_serial?: string;
      equipment_accessories?: string;
      reported_issue?: string;
      seller_id?: number;
      technician_name?: string;
      priority?: string;
      promised_at?: string;
      service_value?: number;
      warranty_days?: number;
      warranty_terms?: string;
      observations?: string;
      parts?: Array<{ product_id: number; quantity: number }>;
    };

    if (!customer_name || !equipment_category) {
      return res.status(400).json({ error: "Cliente e categoria do equipamento são obrigatórios" });
    }

    // Server-side checklist instantiation — never trust client-submitted labels
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { policies: true } });
    const policies = (tenant?.policies ?? {}) as { service_order_checklists?: Record<string, { label: string }[]> };
    const template = policies.service_order_checklists?.[equipment_category] ?? [];

    // Resolve and validate parts (stock check) before creating anything
    const partRows: { product_id: number; name: string; quantity: number; unit_price: number; total: number }[] = [];
    if (parts && parts.length > 0) {
      for (const p of parts) {
        const product = await prisma.product.findFirst({ where: { id: p.product_id, tenant_id: tenantId } });
        if (!product) return res.status(400).json({ error: `Produto ${p.product_id} não encontrado` });
        if (product.stock_quantity < p.quantity) {
          return res.status(400).json({ error: `Estoque insuficiente para "${product.name}"` });
        }
        const unitPrice = Number(product.price);
        partRows.push({
          product_id: product.id,
          name: product.name,
          quantity: p.quantity,
          unit_price: unitPrice,
          total: Math.round(unitPrice * p.quantity * 100) / 100,
        });
      }
    }

    const serviceValueNum = Number(service_value) || 0;
    const partsTotal = partRows.reduce((sum, p) => sum + p.total, 0);
    const totalAmount = Math.round((serviceValueNum + partsTotal) * 100) / 100;

    const order = await prisma.serviceOrder.create({
      data: {
        tenant_id: tenantId,
        number: nextNumber,
        customer_id: customer_id || null,
        customer_name,
        customer_phone: customer_phone || null,
        equipment_category,
        equipment_type: equipment_type || null,
        equipment_brand: equipment_brand || null,
        equipment_model: equipment_model || null,
        equipment_serial: equipment_serial || null,
        equipment_accessories: equipment_accessories || null,
        reported_issue: reported_issue || null,
        seller_id: seller_id || null,
        technician_name: technician_name || null,
        priority: ALLOWED_PRIORITIES.includes(priority ?? "") ? priority! : "normal",
        promised_at: promised_at ? new Date(promised_at) : null,
        service_value: serviceValueNum,
        parts_total: partsTotal,
        total_amount: totalAmount,
        warranty_days: warranty_days ? Number(warranty_days) : null,
        warranty_terms: warranty_terms || null,
        observations: observations || null,
        checklist_items: {
          create: template.map((item, idx) => ({
            tenant_id: tenantId,
            label: item.label,
            position: idx,
          })),
        },
        ...(partRows.length > 0 ? { parts: { create: partRows } } : {}),
      },
      include: SERVICE_ORDER_INCLUDE,
    });

    // Decrement stock immediately for parts used at creation
    for (const p of partRows) {
      await prisma.product.update({
        where: { id: p.product_id },
        data: { stock_quantity: { decrement: p.quantity } },
      });
    }

    await logAction(tenantId, order.id, "created", { toStatus: order.status, actor: getActor(req) });

    res.json(order);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao criar ordem de serviço" });
  }
}

export async function updateServiceOrder(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const id = Number(req.params.id);

    const existing = await prisma.serviceOrder.findFirst({ where: { id, tenant_id: tenantId } });
    if (!existing) return res.status(404).json({ error: "Ordem de serviço não encontrada" });

    const {
      customer_id,
      customer_name,
      customer_phone,
      equipment_type,
      equipment_brand,
      equipment_model,
      equipment_serial,
      equipment_accessories,
      reported_issue,
      seller_id,
      technician_name,
      priority,
      promised_at,
      service_value,
      warranty_days,
      warranty_terms,
      observations,
    } = req.body as Record<string, any>;

    const data: Record<string, any> = {};
    if (customer_id !== undefined) data.customer_id = customer_id || null;
    if (customer_name !== undefined) data.customer_name = customer_name;
    if (customer_phone !== undefined) data.customer_phone = customer_phone || null;
    if (equipment_type !== undefined) data.equipment_type = equipment_type || null;
    if (equipment_brand !== undefined) data.equipment_brand = equipment_brand || null;
    if (equipment_model !== undefined) data.equipment_model = equipment_model || null;
    if (equipment_serial !== undefined) data.equipment_serial = equipment_serial || null;
    if (equipment_accessories !== undefined) data.equipment_accessories = equipment_accessories || null;
    if (reported_issue !== undefined) data.reported_issue = reported_issue || null;
    if (seller_id !== undefined) { data.seller_id = seller_id || null; if (seller_id) data.technician_name = null; }
    if (technician_name !== undefined) { data.technician_name = technician_name || null; if (technician_name) data.seller_id = null; }
    if (priority !== undefined) data.priority = ALLOWED_PRIORITIES.includes(priority) ? priority : "normal";
    if (promised_at !== undefined) data.promised_at = promised_at ? new Date(promised_at) : null;
    if (warranty_days !== undefined) data.warranty_days = warranty_days ? Number(warranty_days) : null;
    if (warranty_terms !== undefined) data.warranty_terms = warranty_terms || null;
    if (observations !== undefined) data.observations = observations || null;

    if (service_value !== undefined) {
      const newServiceValue = Number(service_value) || 0;
      data.service_value = newServiceValue;
      data.total_amount = Math.round((newServiceValue + Number(existing.parts_total)) * 100) / 100;
    }

    await prisma.serviceOrder.update({ where: { id }, data });

    const updated = await prisma.serviceOrder.findFirst({
      where: { id, tenant_id: tenantId },
      include: SERVICE_ORDER_INCLUDE,
    });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao atualizar ordem de serviço" });
  }
}

export async function updateChecklist(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const id = Number(req.params.id);

    const order = await prisma.serviceOrder.findFirst({ where: { id, tenant_id: tenantId } });
    if (!order) return res.status(404).json({ error: "Ordem de serviço não encontrada" });

    const { items } = req.body as { items: Array<{ id: number; answer?: string | null; observation?: string | null }> };
    if (!Array.isArray(items)) return res.status(400).json({ error: "Lista de itens inválida" });

    for (const item of items) {
      await prisma.serviceOrderChecklistItem.updateMany({
        where: { id: item.id, service_order_id: id, tenant_id: tenantId },
        data: {
          ...(item.answer !== undefined ? { answer: item.answer } : {}),
          ...(item.observation !== undefined ? { observation: item.observation } : {}),
        },
      });
    }

    const updated = await prisma.serviceOrder.findFirst({
      where: { id, tenant_id: tenantId },
      include: SERVICE_ORDER_INCLUDE,
    });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao atualizar checklist" });
  }
}

export async function updateServiceOrderStatus(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const id = Number(req.params.id);
    const { status, note, cancel_reason } = req.body as { status: string; note?: string; cancel_reason?: string };

    if (!ALLOWED_STATUSES.includes(status)) {
      return res.status(400).json({ error: "Status inválido" });
    }

    const order = await prisma.serviceOrder.findFirst({
      where: { id, tenant_id: tenantId },
      include: { parts: true },
    });
    if (!order) return res.status(404).json({ error: "Ordem de serviço não encontrada" });
    if (order.invoiced_order_id) {
      return res.status(400).json({ error: "Ordem de serviço já foi faturada" });
    }

    // Fluxo guiado: só avança uma etapa por vez (stepper na UI), exceto o
    // cancelamento, que continua acessível de qualquer estado não terminal.
    if (status !== "cancelada") {
      const fromIdx = STATUS_ORDER.indexOf(order.status);
      const toIdx = STATUS_ORDER.indexOf(status);
      if (fromIdx === -1 || toIdx !== fromIdx + 1) {
        return res.status(400).json({ error: "Só é possível avançar para a próxima etapa do fluxo" });
      }
    }

    const fromStatus = order.status;
    const data: Record<string, any> = { status };

    if (status === "cancelada") {
      // Revert stock for any parts still attached
      for (const p of order.parts) {
        if (p.product_id) {
          await prisma.product.update({
            where: { id: p.product_id },
            data: { stock_quantity: { increment: p.quantity } },
          });
        }
      }
      data.cancelled_by = getActor(req);
      data.cancel_reason = cancel_reason || null;
      data.cancelled_at = new Date();
    }

    await prisma.serviceOrder.update({ where: { id }, data });
    await logAction(tenantId, id, "status_changed", {
      fromStatus, toStatus: status, actor: getActor(req), note,
    });

    const updated = await prisma.serviceOrder.findFirst({
      where: { id, tenant_id: tenantId },
      include: SERVICE_ORDER_INCLUDE,
    });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao atualizar status" });
  }
}

export async function addServiceOrderPart(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const id = Number(req.params.id);
    const { product_id, quantity, height, width } = req.body as {
      product_id: number; quantity?: number; height?: number; width?: number;
    };

    const order = await prisma.serviceOrder.findFirst({ where: { id, tenant_id: tenantId } });
    if (!order) return res.status(404).json({ error: "Ordem de serviço não encontrada" });
    if (order.invoiced_order_id) return res.status(400).json({ error: "Ordem de serviço já foi faturada" });

    const product = await prisma.product.findFirst({ where: { id: product_id, tenant_id: tenantId } });
    if (!product) return res.status(404).json({ error: "Produto não encontrado" });

    const isMeasured = !!product.sale_unit && product.sale_unit !== "unidade";

    let qty = Number(quantity) || 1;
    let unitPrice = Number(product.price);
    let total: number;
    let dimensionsLabel: string | null = null;

    if (isMeasured) {
      // Nunca confia em preço mandado pelo cliente — recalcula a partir das
      // dimensões brutas recebidas, mesmo princípio de recomputeTotals/recomputeQuoteTotals.
      const result = computeMeasuredPrice(
        product.sale_unit as "m2" | "linear",
        Number(product.price_per_measure) || 0,
        product.min_billable_quantity ? Number(product.min_billable_quantity) : null,
        Number(height) || 0,
        Number(width) || 0,
      );
      qty = 1;
      unitPrice = result.total;
      total = result.total;
      dimensionsLabel = result.label;
    } else {
      if (product.stock_quantity < qty) {
        return res.status(400).json({ error: `Estoque insuficiente para "${product.name}"` });
      }
      total = Math.round(unitPrice * qty * 100) / 100;
    }

    const part = await prisma.serviceOrderPart.create({
      data: {
        service_order_id: id,
        product_id: product.id,
        name: product.name,
        quantity: qty,
        unit_price: unitPrice,
        total,
        dimensions_label: dimensionsLabel,
      },
    });

    // Produtos por medida (m²/linear) não têm controle de estoque.
    if (!isMeasured) {
      await prisma.product.update({
        where: { id: product.id },
        data: { stock_quantity: { decrement: qty } },
      });
    }

    await recomputeTotals(id);
    await logAction(tenantId, id, "part_added", {
      actor: getActor(req),
      note: dimensionsLabel ? `${product.name} (${dimensionsLabel})` : `${product.name} x${qty}`,
      meta: { product_id: product.id, quantity: qty },
    });

    const updated = await prisma.serviceOrder.findFirst({
      where: { id, tenant_id: tenantId },
      include: SERVICE_ORDER_INCLUDE,
    });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao adicionar peça" });
  }
}

export async function removeServiceOrderPart(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const id = Number(req.params.id);
    const partId = Number(req.params.partId);

    const order = await prisma.serviceOrder.findFirst({ where: { id, tenant_id: tenantId } });
    if (!order) return res.status(404).json({ error: "Ordem de serviço não encontrada" });
    if (order.invoiced_order_id) return res.status(400).json({ error: "Ordem de serviço já foi faturada" });

    const part = await prisma.serviceOrderPart.findFirst({ where: { id: partId, service_order_id: id } });
    if (!part) return res.status(404).json({ error: "Peça não encontrada" });

    if (part.product_id) {
      await prisma.product.update({
        where: { id: part.product_id },
        data: { stock_quantity: { increment: part.quantity } },
      });
    }

    await prisma.serviceOrderPart.delete({ where: { id: partId } });
    await recomputeTotals(id);
    await logAction(tenantId, id, "part_removed", {
      actor: getActor(req),
      note: `${part.name} x${part.quantity}`,
      meta: { product_id: part.product_id, quantity: part.quantity },
    });

    const updated = await prisma.serviceOrder.findFirst({
      where: { id, tenant_id: tenantId },
      include: SERVICE_ORDER_INCLUDE,
    });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao remover peça" });
  }
}

export async function attachServiceOrderPhoto(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const id = Number(req.params.id);
    const { url, caption, kind } = req.body as { url: string; caption?: string; kind?: string };

    const order = await prisma.serviceOrder.findFirst({ where: { id, tenant_id: tenantId } });
    if (!order) return res.status(404).json({ error: "Ordem de serviço não encontrada" });
    if (!url) return res.status(400).json({ error: "URL da foto é obrigatória" });

    const photo = await prisma.serviceOrderPhoto.create({
      data: {
        tenant_id: tenantId,
        service_order_id: id,
        url,
        caption: caption || null,
        kind: kind === "damage" ? "damage" : "intake",
      },
    });
    res.json(photo);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao anexar foto" });
  }
}

export async function deleteServiceOrderPhoto(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const id = Number(req.params.id);
    const photoId = Number(req.params.photoId);

    const photo = await prisma.serviceOrderPhoto.findFirst({
      where: { id: photoId, service_order_id: id, tenant_id: tenantId },
    });
    if (!photo) return res.status(404).json({ error: "Foto não encontrada" });

    await prisma.serviceOrderPhoto.delete({ where: { id: photoId } });

    const { deleteServiceOrderPhoto: deletePhotoFile } = await import("./upload.controller");
    deletePhotoFile(photo.url);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao remover foto" });
  }
}

export async function deleteServiceOrder(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const id = Number(req.params.id);

    const order = await prisma.serviceOrder.findFirst({
      where: { id, tenant_id: tenantId },
      include: { parts: true },
    });
    if (!order) return res.status(404).json({ error: "Ordem de serviço não encontrada" });
    if (order.invoiced_order_id) {
      return res.status(400).json({ error: "Não é possível excluir uma ordem de serviço já faturada" });
    }

    for (const p of order.parts) {
      if (p.product_id) {
        await prisma.product.update({
          where: { id: p.product_id },
          data: { stock_quantity: { increment: p.quantity } },
        });
      }
    }

    await prisma.serviceOrder.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao excluir ordem de serviço" });
  }
}

// ── Invoicing ("Faturar") ────────────────────────────────────────────────────
// Mirrors quotes.controller.ts convertToOrder

function parsePaymentMethod(pm: string) {
  return pm.split("|").map((seg) => {
    const [methodPart, amountStr] = seg.split(":");
    const tokens = methodPart.split("-");
    return {
      method: tokens[0] ?? "money",
      brand: tokens[1] ?? "other",
      installments: tokens[2] ? parseInt(tokens[2].replace("x", ""), 10) : 1,
      amount: parseFloat(amountStr ?? "0") || 0,
    };
  });
}

function buildMethodSummary(pm: string) {
  const labels: Record<string, string> = { money: "Dinheiro", pix: "PIX", debit: "Débito", credit: "Crédito" };
  return parsePaymentMethod(pm).map(({ method, brand, installments }) => {
    const b = brand && brand !== "other" ? `/${brand.toUpperCase()}` : "";
    const i = method === "credit" && installments > 1 ? ` ${installments}X` : "";
    return `${labels[method] ?? method}${b}${i}`;
  }).join(" + ");
}

const LABOR_SERVICE_NAME = "Mão de obra técnica";

export async function invoiceServiceOrder(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const id = Number(req.params.id);

    const order = await prisma.serviceOrder.findFirst({
      where: { id, tenant_id: tenantId },
      include: { parts: true },
    });
    if (!order) return res.status(404).json({ error: "Ordem de serviço não encontrada" });
    if (order.invoiced_order_id) return res.status(400).json({ error: "Ordem de serviço já foi faturada" });
    if (order.status === "cancelada") return res.status(400).json({ error: "Ordem de serviço está cancelada" });

    const { payment_method, seller_id } = req.body as { payment_method?: string; seller_id?: number };
    const pmString = payment_method || "money";

    const tenantData = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { card_fees: true } });
    const cardFees = (tenantData?.card_fees ?? {}) as Record<string, number[]>;

    const pmSegments = parsePaymentMethod(pmString);
    const machineFee = pmSegments.reduce((sum, seg) => {
      if (seg.method !== "credit" || seg.amount <= 0) return sum;
      const rate = cardFees[seg.brand]?.[seg.installments - 1] ?? 0;
      return sum + seg.amount * (rate / 100);
    }, 0);
    const roundedFee = Math.round(machineFee * 100) / 100;
    const totalAmount = Number(order.total_amount);
    const netAmount = Math.round((totalAmount - roundedFee) * 100) / 100;

    let sellerName: string | null = null;
    const effectiveSellerId = seller_id ?? order.seller_id ?? undefined;
    if (effectiveSellerId) {
      const seller = await prisma.seller.findUnique({ where: { id: effectiveSellerId }, select: { name: true } });
      sellerName = seller?.name ?? null;
    }

    // Find-or-create the generic labor service catalog entry
    let laborService = await prisma.service.findFirst({
      where: { tenant_id: tenantId, name: LABOR_SERVICE_NAME },
    });
    if (!laborService && Number(order.service_value) > 0) {
      laborService = await prisma.service.create({
        data: {
          tenant_id: tenantId,
          name: LABOR_SERVICE_NAME,
          price: order.service_value,
          unit: "unidade",
          category: "Ordem de Serviço",
          is_active: true,
        },
      });
    }

    const newOrder = await prisma.order.create({
      data: {
        tenant_id: tenantId,
        seller_id: effectiveSellerId ?? null,
        seller_name: sellerName,
        customer_id: order.customer_id ?? null,
        customer_name: order.customer_name,
        customer_phone: order.customer_phone || undefined,
        total_amount: totalAmount,
        gross_amount: totalAmount,
        fee_amount: roundedFee > 0 ? roundedFee : null,
        status: "completed",
        order_type: "service",
        payment_method: pmString,
        items: {
          create: order.parts.filter((p) => p.product_id).map((p) => ({
            product_id: p.product_id!,
            quantity: p.quantity,
            unit_price: p.unit_price,
            dimensions_label: p.dimensions_label,
          })),
        },
        ...(Number(order.service_value) > 0 && laborService ? {
          services: {
            create: [{
              service_id: laborService.id,
              name: LABOR_SERVICE_NAME,
              unit_price: order.service_value,
              quantity: 1,
            }],
          },
        } : {}),
      },
    });

    // Stock for parts was already decremented when each part was added to the OS — no decrement here.

    const methodSummary = buildMethodSummary(pmString);
    await prisma.finance.create({
      data: {
        tenant_id: tenantId,
        type: "income",
        description: `Faturamento OS #${order.number} — ${methodSummary}`,
        amount: netAmount,
        gross_amount: totalAmount,
        fee_amount: roundedFee > 0 ? roundedFee : null,
        date: localDateString(),
        order_id: newOrder.id,
      },
    });

    await prisma.serviceOrder.update({
      where: { id },
      data: { invoiced_order_id: newOrder.id, invoiced_at: new Date(), status: "entregue" },
    });

    await logAction(tenantId, id, "invoiced", {
      fromStatus: order.status, toStatus: "entregue", actor: getActor(req),
      meta: { order_id: newOrder.id },
    });

    res.json({ success: true, orderId: newOrder.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao faturar ordem de serviço" });
  }
}
