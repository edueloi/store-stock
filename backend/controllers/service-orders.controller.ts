import type { Request, Response } from "express";

import { prisma } from "../config/prisma";
import type { AuthenticatedRequest } from "../types/auth";
import { localDateString } from "../utils/date";
import { computeMeasuredPrice } from "../utils/measurePricing";
import { advanceServiceOrderToNotaEmitida, canMoveToStage } from "../utils/stage-permissions";
import { getWorkflowStagesForTenant } from "../utils/workflow-stages";
import { cancelarNfce } from "../services/nfce/cancelar";
import { emitToTenant } from "../services/realtime.service";

function getTenantId(req: Request) {
  return (req as AuthenticatedRequest).user.tenantId;
}

function getRole(req: Request): string {
  return (req as AuthenticatedRequest).user.role;
}

function getUserId(req: Request): number {
  return (req as AuthenticatedRequest).user.userId;
}

function getActor(req: Request): string {
  const u = (req as AuthenticatedRequest).user;
  return (u as any).name ?? (u as any).email ?? "Sistema";
}

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

// Aplica desconto percentual ou fixo sobre um valor, nunca deixando o resultado negativo
// (mesmo princípio usado em recomputeQuoteTotals, quotes.controller.ts).
function applyDiscount(amount: number, discountType: string, discountValue: number): number {
  const discountAmt = discountType === "percent" ? (amount * discountValue) / 100 : Math.min(discountValue, amount);
  return Math.max(0, Math.round((amount - discountAmt) * 100) / 100);
}

async function recomputeTotals(serviceOrderId: number) {
  const parts = await prisma.serviceOrderPart.findMany({ where: { service_order_id: serviceOrderId } });
  const partsTotal = parts.reduce((sum, p) => sum + Number(p.total), 0);
  const so = await prisma.serviceOrder.findUnique({
    where: { id: serviceOrderId },
    select: { service_value: true, discount_type: true, discount_value: true },
  });
  const serviceValue = Number(so?.service_value ?? 0);
  const subtotal = Math.round((serviceValue + partsTotal) * 100) / 100;
  const totalAmount = applyDiscount(subtotal, so?.discount_type ?? "percent", Number(so?.discount_value ?? 0));
  await prisma.serviceOrder.update({
    where: { id: serviceOrderId },
    data: { parts_total: partsTotal, subtotal, total_amount: totalAmount },
  });
  return { partsTotal, subtotal, totalAmount };
}

const SERVICE_ORDER_INCLUDE = {
  checklist_items: { orderBy: { position: "asc" as const } },
  parts: true,
  photos: { orderBy: { created_at: "asc" as const } },
  technician: { select: { id: true, name: true } },
  accounts_receivable: { select: { id: true, status: true, due_date: true }, take: 1 },
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
      has_equipment,
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
      customer_name?: string;
      customer_phone?: string;
      has_equipment?: boolean;
      equipment_category?: string;
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

    const requiresEquipment = has_equipment !== false;

    // Sem cliente/categoria (quando o atendimento envolve equipamento): nasce como
    // rascunho, preenchido aos poucos na tela de detalhe.
    const isDraft = !customer_name || (requiresEquipment && !equipment_category);

    // Server-side checklist instantiation — never trust client-submitted labels
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { policies: true } });
    const policies = (tenant?.policies ?? {}) as { service_order_checklists?: Record<string, { label: string }[]> };
    const template = equipment_category ? (policies.service_order_checklists?.[equipment_category] ?? []) : [];

    // Resolve and validate parts (stock check) before creating anything
    const partRows: { product_id: number; name: string; quantity: number; unit_price: number; total_before_discount: number; total: number }[] = [];
    if (parts && parts.length > 0) {
      for (const p of parts) {
        const product = await prisma.product.findFirst({ where: { id: p.product_id, tenant_id: tenantId } });
        if (!product) return res.status(400).json({ error: `Produto ${p.product_id} não encontrado` });
        if (product.stock_quantity < p.quantity) {
          return res.status(400).json({ error: `Estoque insuficiente para "${product.name}"` });
        }
        const unitPrice = Number(product.price);
        const total = Math.round(unitPrice * p.quantity * 100) / 100;
        // Peças informadas na criação da OS nascem sem desconto — desconto por item
        // é aplicado depois, editando o item já criado na tela de detalhe.
        partRows.push({
          product_id: product.id,
          name: product.name,
          quantity: p.quantity,
          unit_price: unitPrice,
          total_before_discount: total,
          total,
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
        status: isDraft ? "rascunho" : "orcamento_enviado",
        customer_id: customer_id || null,
        customer_name: customer_name || "",
        customer_phone: customer_phone || null,
        has_equipment: requiresEquipment,
        equipment_category: equipment_category || "",
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
        subtotal: totalAmount,
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
      has_equipment,
      equipment_category,
      equipment_type,
      equipment_brand,
      equipment_model,
      equipment_serial,
      equipment_accessories,
      reported_issue,
      seller_id,
      technician_id,
      technician_name,
      priority,
      promised_at,
      service_value,
      service_description,
      discount_type,
      discount_value,
      warranty_days,
      warranty_terms,
      observations,
    } = req.body as Record<string, any>;

    const data: Record<string, any> = {};
    if (customer_id !== undefined) data.customer_id = customer_id || null;
    if (customer_name !== undefined) data.customer_name = customer_name;
    if (customer_phone !== undefined) data.customer_phone = customer_phone || null;
    if (has_equipment !== undefined) data.has_equipment = !!has_equipment;
    if (equipment_category !== undefined) data.equipment_category = equipment_category || "";
    if (equipment_type !== undefined) data.equipment_type = equipment_type || null;
    if (equipment_brand !== undefined) data.equipment_brand = equipment_brand || null;
    if (equipment_model !== undefined) data.equipment_model = equipment_model || null;
    if (equipment_serial !== undefined) data.equipment_serial = equipment_serial || null;
    if (equipment_accessories !== undefined) data.equipment_accessories = equipment_accessories || null;
    if (reported_issue !== undefined) data.reported_issue = reported_issue || null;
    // Responsável é sempre um dos três: vendedor cadastrado, técnico cadastrado, ou
    // nome livre de técnico externo — selecionar um zera os outros dois.
    if (seller_id !== undefined) { data.seller_id = seller_id || null; if (seller_id) { data.technician_id = null; data.technician_name = null; } }
    if (technician_id !== undefined) { data.technician_id = technician_id || null; if (technician_id) { data.seller_id = null; data.technician_name = null; } }
    if (technician_name !== undefined) { data.technician_name = technician_name || null; if (technician_name) { data.seller_id = null; data.technician_id = null; } }
    if (priority !== undefined) data.priority = ALLOWED_PRIORITIES.includes(priority) ? priority : "normal";
    if (promised_at !== undefined) data.promised_at = promised_at ? new Date(promised_at) : null;
    if (warranty_days !== undefined) data.warranty_days = warranty_days ? Number(warranty_days) : null;
    if (warranty_terms !== undefined) data.warranty_terms = warranty_terms || null;
    if (observations !== undefined) data.observations = observations || null;

    if (discount_type !== undefined) data.discount_type = discount_type === "fixed" ? "fixed" : "percent";
    if (discount_value !== undefined) data.discount_value = Math.max(0, Number(discount_value) || 0);
    if (service_value !== undefined) data.service_value = Number(service_value) || 0;
    if (service_description !== undefined) data.service_description = service_description || null;

    await prisma.serviceOrder.update({ where: { id }, data });

    if (service_value !== undefined || discount_type !== undefined || discount_value !== undefined) {
      await recomputeTotals(id);
    }

    // Enquanto ainda é rascunho, trocar a categoria reinstancia o checklist a partir
    // do novo template — depois de iniciado o atendimento, respostas já preenchidas são preservadas.
    if (existing.status === "rascunho" && equipment_category !== undefined && equipment_category !== existing.equipment_category) {
      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { policies: true } });
      const policies = (tenant?.policies ?? {}) as { service_order_checklists?: Record<string, { label: string }[]> };
      const template = equipment_category ? (policies.service_order_checklists?.[equipment_category] ?? []) : [];

      await prisma.serviceOrderChecklistItem.deleteMany({ where: { service_order_id: id } });
      if (template.length > 0) {
        await prisma.serviceOrderChecklistItem.createMany({
          data: template.map((item, idx) => ({
            tenant_id: tenantId,
            service_order_id: id,
            label: item.label,
            position: idx,
          })),
        });
      }
    }

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

    const tenantForStages = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { grafica_enabled: true } });
    const stagesForTenant: string[] = getWorkflowStagesForTenant(!!tenantForStages?.grafica_enabled);
    const allowedStatuses: string[] = [...stagesForTenant, "cancelada"];

    // Loja sem o módulo Gráfica habilitado: "aguardando_arte"/"arte_finalizada" nem
    // existem pra ela — bloqueado pra qualquer papel, inclusive admin.
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ error: "Status inválido" });
    }

    const order = await prisma.serviceOrder.findFirst({
      where: { id, tenant_id: tenantId },
      include: { parts: true },
    });
    if (!order) return res.status(404).json({ error: "Ordem de serviço não encontrada" });
    // Faturada só pode seguir para "entregue" ou ser cancelada (o que cancela o
    // pedido/nota gerados) — qualquer outra mudança depois de faturar é bloqueada.
    if (order.invoiced_order_id && status !== "entregue" && status !== "cancelada") {
      return res.status(400).json({ error: "Ordem de serviço já foi faturada" });
    }

    // Fluxo guiado: só avança uma etapa por vez (stepper na UI), exceto o
    // cancelamento, que continua acessível de qualquer estado não terminal.
    if (status !== "cancelada") {
      const fromIdx = stagesForTenant.indexOf(order.status);
      const toIdx = stagesForTenant.indexOf(status);
      if (fromIdx === -1 || toIdx !== fromIdx + 1) {
        return res.status(400).json({ error: "Só é possível avançar para a próxima etapa do fluxo" });
      }

      const allowed = await canMoveToStage(getUserId(req), getRole(req), status);
      if (!allowed) {
        return res.status(403).json({ error: "Seu papel não tem permissão para mover a ordem de serviço para esta etapa" });
      }
    }

    // Sair do rascunho exige os dados mínimos para iniciar o atendimento.
    if (order.status === "rascunho" && status === "orcamento_enviado") {
      const missingEquipment = order.has_equipment && !order.equipment_category;
      if (!order.customer_name || missingEquipment || !order.reported_issue) {
        return res.status(400).json({
          error: missingEquipment
            ? "Preencha cliente, categoria do equipamento e problema relatado antes de iniciar o atendimento"
            : "Preencha cliente e problema relatado antes de iniciar o atendimento",
        });
      }
    }

    const fromStatus = order.status;
    const data: Record<string, any> = { status };
    const warnings: string[] = [];

    if (status === "cancelada") {
      if (order.invoiced_order_id) {
        // OS já faturada: as peças viraram itens do pedido gerado — cancela esse
        // pedido (devolve estoque, remove financeiro, cancela a NFC-e se houver)
        // em vez de reverter o estoque das peças de novo aqui.
        const linkedOrder = await prisma.order.findFirst({
          where: { id: order.invoiced_order_id, tenant_id: tenantId },
          include: { items: true },
        });

        if (linkedOrder && linkedOrder.status !== "cancelled") {
          for (const item of linkedOrder.items) {
            await prisma.product.update({
              where: { id: item.product_id },
              data: { stock_quantity: { increment: item.quantity } },
            });
          }

          await prisma.order.update({
            where: { id: linkedOrder.id },
            data: {
              status:        "cancelled",
              cancelled_by:  getActor(req),
              cancel_reason: cancel_reason || "Ordem de serviço cancelada",
              cancelled_at:  new Date(),
            },
          });

          const deletedFinance = await (prisma.finance as any).deleteMany({
            where: { tenant_id: tenantId, order_id: linkedOrder.id },
          });
          if (deletedFinance.count === 0) {
            await prisma.finance.deleteMany({
              where: { tenant_id: tenantId, description: { contains: `#${linkedOrder.id}` }, type: "income" },
            });
          }

          const nfceInvoice = await prisma.nfceInvoice.findUnique({ where: { order_id: linkedOrder.id } });
          if (nfceInvoice && nfceInvoice.status === "authorized") {
            const result = await cancelarNfce(linkedOrder.id, cancel_reason || "Cancelamento da ordem de serviço");
            if (!result.success) {
              warnings.push(`Não foi possível cancelar a NFC-e das peças automaticamente: ${result.error}`);
            }
          }
        }

        const nfseInvoice = await prisma.nfseInvoice.findUnique({ where: { service_order_id: id } });
        if (nfseInvoice && nfseInvoice.status === "authorized") {
          warnings.push(
            "Esta OS tem uma NFS-e autorizada. O cancelamento automático da NFS-e ainda não é suportado pelo sistema — " +
            "cancele-a manualmente no portal da prefeitura/gov.br/nfse, se necessário.",
          );
        }
      } else {
        // Ainda não faturada: reverte estoque das peças anexadas normalmente.
        for (const p of order.parts) {
          if (p.product_id) {
            await prisma.product.update({
              where: { id: p.product_id },
              data: { stock_quantity: { increment: p.quantity } },
            });
          }
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

    emitToTenant(tenantId, "service-order:changed", { id, status });
    if (status === "cancelada") {
      emitToTenant(tenantId, "stock:changed", { serviceOrderId: id });
      if (order.invoiced_order_id) {
        emitToTenant(tenantId, "order:cancelled", { orderId: order.invoiced_order_id });
        emitToTenant(tenantId, "finance:changed", { orderId: order.invoiced_order_id });
      }
    }

    res.json(warnings.length > 0 ? { ...updated, warnings } : updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao atualizar status" });
  }
}

export async function addServiceOrderPart(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const id = Number(req.params.id);
    const {
      product_id, quantity, height, width, no_charge,
      name: freeName, unit: freeUnit, unit_price: freeUnitPrice,
      discount_type: discountType, discount_value: discountValueRaw,
    } = req.body as {
      product_id?: number; quantity?: number; height?: number; width?: number; no_charge?: boolean;
      name?: string; unit?: string; unit_price?: number;
      discount_type?: string; discount_value?: number;
    };

    const order = await prisma.serviceOrder.findFirst({ where: { id, tenant_id: tenantId } });
    if (!order) return res.status(404).json({ error: "Ordem de serviço não encontrada" });
    if (order.invoiced_order_id) return res.status(400).json({ error: "Ordem de serviço já foi faturada" });

    // Desconto por item nunca se aplica a itens de cortesia (no_charge já zera tudo).
    const itemDiscountType = discountType === "fixed" ? "fixed" : "percent";
    const itemDiscountValue = no_charge ? 0 : Math.max(0, Number(discountValueRaw) || 0);

    // Item livre: sem produto vinculado, nome/unidade/valor informados manualmente
    // (ex.: "Mão de obra extra", item de terceiro, cortesia) — sem controle de estoque.
    if (!product_id) {
      if (!freeName || !freeName.trim()) {
        return res.status(422).json({ error: "Informe a descrição do item" });
      }
      const qty = Math.max(1, Number(quantity) || 1);
      const unitPrice = no_charge ? 0 : Math.max(0, Number(freeUnitPrice) || 0);
      const totalBeforeDiscount = Math.round(unitPrice * qty * 100) / 100;
      const total = applyDiscount(totalBeforeDiscount, itemDiscountType, itemDiscountValue);

      await prisma.serviceOrderPart.create({
        data: {
          service_order_id: id,
          product_id: null,
          name: freeName.trim(),
          quantity: qty,
          unit: (freeUnit || "UN").trim().slice(0, 10).toUpperCase(),
          unit_price: unitPrice,
          total_before_discount: totalBeforeDiscount,
          discount_type: itemDiscountType,
          discount_value: itemDiscountValue,
          total,
          no_charge: !!no_charge,
        },
      });

      await recomputeTotals(id);
      await logAction(tenantId, id, "part_added", {
        actor: getActor(req),
        note: `${freeName.trim()} x${qty}${no_charge ? " (sem cobrança)" : ""}`,
        meta: { product_id: null, quantity: qty, no_charge: !!no_charge },
      });

      const updated = await prisma.serviceOrder.findFirst({
        where: { id, tenant_id: tenantId },
        include: SERVICE_ORDER_INCLUDE,
      });
      res.json(updated);
      return;
    }

    const product = await prisma.product.findFirst({ where: { id: product_id, tenant_id: tenantId } });
    if (!product) return res.status(404).json({ error: "Produto não encontrado" });

    const isMeasured = !!product.sale_unit && product.sale_unit !== "unidade";

    let qty = Number(quantity) || 1;
    let unitPrice = Number(product.price);
    let totalBeforeDiscount: number;
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
      totalBeforeDiscount = result.total;
      dimensionsLabel = result.label;
    } else {
      if (product.stock_quantity < qty) {
        return res.status(400).json({ error: `Estoque insuficiente para "${product.name}"` });
      }
      totalBeforeDiscount = Math.round(unitPrice * qty * 100) / 100;
    }

    let total = applyDiscount(totalBeforeDiscount, itemDiscountType, itemDiscountValue);

    if (no_charge) {
      unitPrice = 0;
      totalBeforeDiscount = 0;
      total = 0;
    }

    const unitLabel = product.sale_unit === "m2" ? "M²" : product.sale_unit === "linear" ? "M" : "UN";

    const part = await prisma.serviceOrderPart.create({
      data: {
        service_order_id: id,
        product_id: product.id,
        name: product.name,
        quantity: qty,
        unit: unitLabel,
        unit_price: unitPrice,
        total_before_discount: totalBeforeDiscount,
        discount_type: itemDiscountType,
        discount_value: itemDiscountValue,
        total,
        no_charge: !!no_charge,
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
      note: dimensionsLabel ? `${product.name} (${dimensionsLabel})` : `${product.name} x${qty}${no_charge ? " (sem cobrança)" : ""}`,
      meta: { product_id: product.id, quantity: qty, no_charge: !!no_charge },
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

// Edita o desconto de uma peça já adicionada — os demais dados do item (produto,
// quantidade, medida) não mudam aqui; para isso remove-se e adiciona-se de novo.
export async function updateServiceOrderPart(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const id = Number(req.params.id);
    const partId = Number(req.params.partId);
    const { discount_type: discountType, discount_value: discountValueRaw } = req.body as {
      discount_type?: string; discount_value?: number;
    };

    const order = await prisma.serviceOrder.findFirst({ where: { id, tenant_id: tenantId } });
    if (!order) return res.status(404).json({ error: "Ordem de serviço não encontrada" });
    if (order.invoiced_order_id) return res.status(400).json({ error: "Ordem de serviço já foi faturada" });

    const part = await prisma.serviceOrderPart.findFirst({ where: { id: partId, service_order_id: id } });
    if (!part) return res.status(404).json({ error: "Peça não encontrada" });
    if (part.no_charge) return res.status(400).json({ error: "Item sem cobrança não pode receber desconto" });

    const itemDiscountType = discountType === "fixed" ? "fixed" : "percent";
    const itemDiscountValue = Math.max(0, Number(discountValueRaw) || 0);
    const total = applyDiscount(Number(part.total_before_discount), itemDiscountType, itemDiscountValue);

    await prisma.serviceOrderPart.update({
      where: { id: partId },
      data: { discount_type: itemDiscountType, discount_value: itemDiscountValue, total },
    });

    await recomputeTotals(id);
    await logAction(tenantId, id, "part_discount_updated", {
      actor: getActor(req),
      note: `${part.name}: desconto ${itemDiscountType === "percent" ? `${itemDiscountValue}%` : `R$${itemDiscountValue.toFixed(2)}`}`,
    });

    const updated = await prisma.serviceOrder.findFirst({
      where: { id, tenant_id: tenantId },
      include: SERVICE_ORDER_INCLUDE,
    });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao atualizar desconto da peça" });
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
      include: { parts: true, nfse_invoice: true },
    });
    if (!order) return res.status(404).json({ error: "Ordem de serviço não encontrada" });
    if (order.invoiced_order_id) {
      return res.status(400).json({ error: "Não é possível excluir uma ordem de serviço já faturada" });
    }
    // NFS-e autorizada é documento fiscal válido — bloqueia a exclusão. Uma NFS-e
    // que só ficou registrada como tentativa (rejected/error/pending/cancelled,
    // nunca autorizada) não impede excluir a ordem; o registro é removido junto.
    if (order.nfse_invoice?.status === "authorized") {
      return res.status(400).json({ error: "Não é possível excluir uma ordem de serviço com NFS-e autorizada — cancele a nota antes" });
    }

    for (const p of order.parts) {
      if (p.product_id) {
        await prisma.product.update({
          where: { id: p.product_id },
          data: { stock_quantity: { increment: p.quantity } },
        });
      }
    }

    if (order.nfse_invoice) {
      await prisma.nfseInvoice.delete({ where: { id: order.nfse_invoice.id } });
    }
    await prisma.serviceOrder.delete({ where: { id } });
    emitToTenant(tenantId, "service-order:changed", { id });
    emitToTenant(tenantId, "stock:changed", { serviceOrderId: id });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao excluir ordem de serviço" });
  }
}

export async function bulkDeleteServiceOrders(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const { ids } = req.body as { ids: number[] };

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "IDs inválidos" });
    }

    const orders = await prisma.serviceOrder.findMany({
      where: { id: { in: ids }, tenant_id: tenantId },
      include: { parts: true, nfse_invoice: true },
    });
    if (orders.length === 0) return res.status(404).json({ error: "Nenhuma ordem de serviço encontrada" });

    // Faturada é um documento fiscal/financeiro vivo — não entra no bulk-delete,
    // precisa ser cancelada primeiro (ver updateServiceOrderStatus). Mesma coisa
    // para ordens com NFS-e autorizada (FK RESTRICT em NfseInvoice.service_order_id).
    // Uma NFS-e que ficou só como tentativa (rejected/error/pending/cancelled,
    // nunca autorizada) não bloqueia — o registro é removido junto com a ordem.
    const isBlocked = (o: (typeof orders)[number]) =>
      Boolean(o.invoiced_order_id) || o.nfse_invoice?.status === "authorized";
    const blocked = orders.filter(isBlocked);
    const deletable = orders.filter((o) => !isBlocked(o));

    for (const order of deletable) {
      for (const p of order.parts) {
        if (p.product_id) {
          await prisma.product.update({
            where: { id: p.product_id },
            data: { stock_quantity: { increment: p.quantity } },
          });
        }
      }
    }

    const deletableIds = deletable.map((o) => o.id);
    const nfseIdsToDelete = deletable.filter((o) => o.nfse_invoice).map((o) => o.nfse_invoice!.id);
    if (nfseIdsToDelete.length > 0) {
      await prisma.nfseInvoice.deleteMany({ where: { id: { in: nfseIdsToDelete } } });
    }
    await prisma.serviceOrder.deleteMany({ where: { id: { in: deletableIds } } });

    if (deletableIds.length > 0) {
      emitToTenant(tenantId, "service-order:changed", { ids: deletableIds });
      emitToTenant(tenantId, "stock:changed", { serviceOrderIds: deletableIds });
    }

    res.json({
      success: true,
      deleted: deletableIds.length,
      blocked: blocked.map((o) => ({
        id: o.id,
        reason: o.invoiced_order_id
          ? "Ordem de serviço já faturada — cancele antes de excluir"
          : "Ordem de serviço com NFS-e autorizada — cancele a nota antes de excluir",
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao excluir ordens de serviço" });
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
    if (order.status !== "finalizado" && order.status !== "nota_emitida") {
      return res.status(400).json({ error: "Só é possível faturar uma ordem de serviço finalizada" });
    }

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
      data: { invoiced_order_id: newOrder.id, invoiced_at: new Date() },
    });
    await logAction(tenantId, id, "invoiced", {
      actor: getActor(req),
      meta: { order_id: newOrder.id },
    });

    // Faturar (NFC-e das peças) avança para "nota_emitida" — não regride se a
    // NFS-e da mão de obra já tiver avançado a etapa antes.
    await advanceServiceOrderToNotaEmitida(id, getActor(req));

    // Se essa OS já tinha sido lançada em Contas a Receber (pagamento previsto pra
    // depois) e agora foi faturada (pagamento imediato capturado), a receivable
    // pendente precisa sumir — senão o mesmo dinheiro conta duas vezes (Finance +
    // Contas a Receber).
    await prisma.accountReceivable.deleteMany({
      where: { service_order_id: id, tenant_id: tenantId, status: "pending" },
    });

    emitToTenant(tenantId, "order:created", { orderId: newOrder.id, serviceOrderId: id });
    emitToTenant(tenantId, "service-order:changed", { id });
    emitToTenant(tenantId, "finance:changed", { orderId: newOrder.id });

    res.json({ success: true, orderId: newOrder.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao faturar ordem de serviço" });
  }
}

// "Lançar a Receber" — quando a OS foi finalizada (às vezes já com NFS-e emitida) mas o
// cliente só paga depois de um prazo, registra o valor pendente em Contas a Receber sem
// exigir forma de pagamento imediata (isso é o que "Faturar" faz). Nunca automático —
// só quando o operador escolhe explicitamente essa ação.
export async function createServiceOrderReceivable(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const id = Number(req.params.id);
    const { due_date } = req.body as { due_date?: string };

    if (!due_date) {
      res.status(422).json({ error: "Informe a data prevista de recebimento" });
      return;
    }

    const order = await prisma.serviceOrder.findFirst({ where: { id, tenant_id: tenantId } });
    if (!order) { res.status(404).json({ error: "Ordem de serviço não encontrada" }); return; }
    if (order.status === "cancelada") { res.status(400).json({ error: "Ordem de serviço está cancelada" }); return; }
    if (order.status !== "finalizado" && order.status !== "nota_emitida") {
      res.status(400).json({ error: "Só é possível lançar a receber uma ordem de serviço finalizada" });
      return;
    }
    if (order.invoiced_order_id) {
      res.status(400).json({ error: "Esta ordem já foi faturada — não é preciso lançar a receber" });
      return;
    }

    const existingReceivable = await prisma.accountReceivable.findFirst({ where: { service_order_id: id, tenant_id: tenantId } });
    if (existingReceivable) {
      res.status(400).json({ error: "Esta ordem já foi lançada em Contas a Receber" });
      return;
    }

    const receivable = await prisma.accountReceivable.create({
      data: {
        tenant_id: tenantId,
        description: `Serviço OS #${String(order.number).padStart(4, "0")} — ${order.customer_name}`,
        amount: order.total_amount,
        due_date: new Date(`${due_date}T12:00:00`),
        customer_name: order.customer_name,
        category: "Serviço",
        service_order_id: id,
      },
    });

    emitToTenant(tenantId, "finance:changed", { id: receivable.id });
    emitToTenant(tenantId, "service-order:changed", { id });

    res.json(receivable);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao lançar ordem de serviço em Contas a Receber" });
  }
}
