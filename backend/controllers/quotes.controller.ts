import crypto from "crypto";
import type { Request, Response } from "express";
import { prisma } from "../config/prisma";
import type { AuthenticatedRequest } from "../types/auth";
import { localDateString } from "../utils/date";
import { canMoveToStage, syncLinkedStatus } from "../utils/stage-permissions";
import { isWorkflowStage, WORKFLOW_STAGES, GRAFICA_ONLY_STAGES } from "../utils/workflow-stages";
import { emitToTenant } from "../services/realtime.service";
import { buildMethodSummary } from "../utils/payment-method";
import { computeSalePaymentTotals, assertCrediarioAllowed, createCrediarioDebt, SalePaymentError } from "../utils/sale-payment";

function getTenantId(req: Request) {
  return (req as AuthenticatedRequest).user.tenantId;
}

function getRole(req: Request): string {
  return (req as AuthenticatedRequest).user.role;
}

function getUserId(req: Request): number {
  return (req as AuthenticatedRequest).user.userId;
}

async function getActor(req: Request): Promise<string> {
  const u = (req as AuthenticatedRequest).user;
  if ((u as any).name || (u as any).email) return (u as any).name ?? (u as any).email;
  const user = await prisma.user.findFirst({
    where: { id: u.userId, tenant_id: u.tenantId },
    select: { name: true, email: true },
  });
  return user ? `${user.name} (${user.email})` : "Sistema";
}

const QUOTE_INCLUDE = {
  items: true,
  services: true,
  actions: { orderBy: { created_at: "desc" as const } },
  files: { orderBy: { created_at: "desc" as const } },
};

async function logQuoteAction(
  tenantId: number,
  quoteId: number,
  action: string,
  opts?: { fromStatus?: string; toStatus?: string; actor?: string; note?: string; meta?: object },
) {
  await prisma.quoteAction.create({
    data: {
      tenant_id: tenantId,
      quote_id: quoteId,
      action,
      from_status: opts?.fromStatus ?? null,
      to_status: opts?.toStatus ?? null,
      actor: opts?.actor ?? null,
      note: opts?.note ?? null,
      meta: opts?.meta ?? undefined,
    },
  });
}

async function recomputeQuoteTotals(quoteId: number) {
  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    include: { items: true, services: true },
  });
  if (!quote) return;
  const itemsSubtotal = quote.items.reduce((sum, i) => sum + Number(i.total), 0);
  const servicesSubtotal = quote.services.reduce((sum, s) => sum + Number(s.total), 0);
  const subtotal = itemsSubtotal + servicesSubtotal;
  const discountAmt = quote.discount_type === "percent"
    ? (subtotal * Number(quote.discount_value)) / 100
    : Math.min(Number(quote.discount_value), subtotal);
  const totalAmount = Math.max(0, Math.round((subtotal - discountAmt) * 100) / 100);
  await prisma.quote.update({
    where: { id: quoteId },
    data: { subtotal, total_amount: totalAmount },
  });
  return { subtotal, totalAmount };
}

type AuditChange = { field: string; label: string; before: string; after: string };

function auditText(value: unknown) {
  if (value === null || value === undefined || value === "") return "Não informado";
  return String(value);
}

function auditMoney(value: unknown) {
  return Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function auditItemsSummary(items: Array<{ name: string; quantity: number; unit_price: unknown }>, services: Array<{ name: string; quantity: number; unit_price: unknown }>) {
  const lines = [
    ...items.map((item) => `${item.name} × ${item.quantity} (${auditMoney(item.unit_price)})`),
    ...services.map((service) => `${service.name} × ${service.quantity} (${auditMoney(service.unit_price)})`),
  ];
  return lines.length ? lines.join("; ") : "Sem itens ou serviços";
}

export async function listQuotes(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const quotes = await prisma.quote.findMany({
      where: { tenant_id: tenantId },
      include: { items: true, services: true },
      orderBy: { created_at: "desc" },
    });
    res.json(quotes);
  } catch {
    res.status(500).json({ error: "Falha ao listar orçamentos" });
  }
}

export async function getQuoteById(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const quote = await prisma.quote.findFirst({
      where: { id: Number(req.params.id), tenant_id: tenantId },
      include: QUOTE_INCLUDE,
    });
    if (!quote) return res.status(404).json({ error: "Orçamento não encontrado" });
    res.json(quote);
  } catch {
    res.status(500).json({ error: "Falha ao buscar orçamento" });
  }
}

export async function createQuote(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);

    const last = await prisma.quote.findFirst({
      where: { tenant_id: tenantId },
      orderBy: { number: "desc" },
      select: { number: true },
    });
    const nextNumber = (last?.number ?? 0) + 1;

    const {
      customer_name,
      customer_phone,
      customer_email,
      customer_id,
      discount_type,
      discount_value,
      validity_days,
      notes,
      items,
      services,
    } = req.body as {
      customer_name?: string;
      customer_phone?: string;
      customer_email?: string;
      customer_id?: number;
      discount_type?: string;
      discount_value?: number;
      validity_days?: number;
      notes?: string;
      items?: Array<{ product_id?: number; name: string; quantity: number; unit_price: number; total: number; dimensions_label?: string | null }>;
      services?: Array<{ id: number; name: string; price: number; quantity?: number; dimensions_label?: string | null }>;
    };

    // Criar/preencher um orçamento não significa que ele foi entregue ao cliente.
    // Ele só sai de rascunho quando o envio é confirmado por e-mail ou manualmente.

    // Nunca confia no subtotal/total mandado pelo cliente — recalcula a partir
    // dos itens/serviços e do desconto, no mesmo padrão já usado em ServiceOrder.
    const itemRows = (items ?? []).map((i) => ({
      product_id: i.product_id || null,
      name: i.name,
      quantity: i.quantity,
      unit_price: i.unit_price,
      total: Math.round(i.unit_price * i.quantity * 100) / 100,
      dimensions_label: i.dimensions_label || null,
    }));
    const serviceRows = (services ?? []).map((s) => ({
      service_id: s.id,
      name: s.name,
      unit_price: s.price,
      quantity: s.quantity ?? 1,
      total: Math.round(s.price * (s.quantity ?? 1) * 100) / 100,
      dimensions_label: s.dimensions_label || null,
    }));
    const itemsSubtotal = itemRows.reduce((sum, i) => sum + i.total, 0);
    const servicesSubtotal = serviceRows.reduce((sum, s) => sum + s.total, 0);
    const subtotalComputed = itemsSubtotal + servicesSubtotal;
    const discountTypeVal = discount_type || "percent";
    const discountValueVal = Number(discount_value) || 0;
    const discountAmt = discountTypeVal === "percent"
      ? (subtotalComputed * discountValueVal) / 100
      : Math.min(discountValueVal, subtotalComputed);
    const totalAmountComputed = Math.max(0, Math.round((subtotalComputed - discountAmt) * 100) / 100);

    const quote = await prisma.quote.create({
      data: {
        tenant_id: tenantId,
        number: nextNumber,
        customer_name: customer_name || "",
        customer_phone: customer_phone || null,
        customer_email: customer_email || null,
        customer_id: customer_id || null,
        subtotal: subtotalComputed,
        discount_type: discountTypeVal,
        discount_value: discountValueVal,
        total_amount: totalAmountComputed,
        validity_days: validity_days || 7,
        notes: notes || null,
        status: "rascunho",
        items: { create: itemRows },
        ...(serviceRows.length > 0 ? { services: { create: serviceRows } } : {}),
      },
      include: { items: true, services: true },
    });

    const actor = await getActor(req);
    await logQuoteAction(tenantId, quote.id, "created", { toStatus: quote.status, actor });

    const tenantRow = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { grafica_enabled: true } });
    if (tenantRow?.grafica_enabled) {
      await createLinkedServiceOrder(tenantId, quote, actor);
    }

    res.json(quote);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao criar orçamento" });
  }
}

// Só lojas do ramo gráfico (Tenant.grafica_enabled): todo Orçamento já nasce com uma OS
// de produção vinculada (ServiceOrder.quote_id), pra não depender de um passo manual
// de "converter em OS" — o Orçamento vira a proposta/preço, a OS vira o card de produção
// no quadro (ver WorkflowBoard.tsx, modo unificado). has_equipment: false dispensa os
// campos de equipamento (categoria/marca/série) que não fazem sentido pra um trabalho
// gráfico; reported_issue é preenchido a partir do orçamento porque updateServiceOrderStatus
// exige esse campo pra sair de "rascunho" mesmo com has_equipment: false.
async function createLinkedServiceOrder(
  tenantId: number,
  quote: { id: number; number: number; status: string; customer_id: number | null; customer_name: string; customer_phone: string | null; notes: string | null; subtotal: any; total_amount: any },
  actor: string,
) {
  const last = await prisma.serviceOrder.findFirst({
    where: { tenant_id: tenantId },
    orderBy: { number: "desc" },
    select: { number: true },
  });
  const nextNumber = (last?.number ?? 0) + 1;

  const reportedIssue = quote.notes?.trim() || `Orçamento #${quote.number}`;

  const order = await prisma.serviceOrder.create({
    data: {
      tenant_id: tenantId,
      number: nextNumber,
      quote_id: quote.id,
      status: quote.status,
      customer_id: quote.customer_id,
      customer_name: quote.customer_name,
      customer_phone: quote.customer_phone,
      has_equipment: false,
      equipment_category: "",
      reported_issue: reportedIssue,
      subtotal: quote.subtotal,
      total_amount: quote.total_amount,
    },
  });

  await prisma.serviceOrderAction.create({
    data: {
      tenant_id: tenantId,
      service_order_id: order.id,
      action: "created_from_quote",
      to_status: order.status,
      actor,
      meta: { quote_id: quote.id },
    },
  });

  return order;
}

// Mantém a OS vinculada (ServiceOrder.quote_id) em sincronia sempre que o Orçamento
// é editado depois de criado — a criação (createLinkedServiceOrder) só roda uma vez,
// no instante em que o rascunho nasce vazio, então sem isso a OS nunca reflete
// cliente/itens/totais preenchidos depois via autosave (updateQuote).
// Observação: ServiceOrder não tem relação de itens/produtos própria (só ServiceOrderPart,
// que é independente do Quote) — quem abre a OS já vê os itens do orçamento vinculado
// via QUOTE_INCLUDE em getServiceOrderById (ver "Orçamento vinculado" em ServiceOrderDetail.tsx),
// então reported_issue aqui só precisa de um resumo textual de fallback.
async function syncLinkedServiceOrderFromQuote(tenantId: number, quoteId: number) {
  const linked = await prisma.serviceOrder.findFirst({ where: { quote_id: quoteId, tenant_id: tenantId } });
  if (!linked) return;

  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, tenant_id: tenantId },
    include: { items: true, services: true },
  });
  if (!quote) return;

  const itemsCount = quote.items.length;
  const servicesCount = quote.services.length;
  const summaryParts: string[] = [];
  if (itemsCount > 0) summaryParts.push(`${itemsCount} produto${itemsCount > 1 ? "s" : ""}`);
  if (servicesCount > 0) summaryParts.push(`${servicesCount} serviço${servicesCount > 1 ? "s" : ""}`);
  const fallback = summaryParts.length > 0
    ? `Orçamento #${quote.number} — ${summaryParts.join(", ")}`
    : `Orçamento #${quote.number}`;
  const reportedIssue = quote.notes?.trim() || fallback;

  await prisma.serviceOrder.update({
    where: { id: linked.id },
    data: {
      customer_id: quote.customer_id,
      customer_name: quote.customer_name,
      customer_phone: quote.customer_phone,
      reported_issue: reportedIssue,
      subtotal: quote.subtotal,
      total_amount: quote.total_amount,
    },
  });
}

export async function updateQuoteStatus(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const id = Number(req.params.id);
    const { status } = req.body as { status: string };

    const existing = await prisma.quote.findFirst({
      where: { id, tenant_id: tenantId },
      include: { items: true, services: true },
    });
    if (!existing) return res.status(404).json({ error: "Orçamento não encontrado" });

    const tenantRow = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { grafica_enabled: true } });

    // Etapas de arte só existem pra lojas do ramo gráfico (mesma regra da Ordem de
    // Serviço, ver Tenant.grafica_enabled) — nem admin passa por elas se desligado.
    if (GRAFICA_ONLY_STAGES.includes(status as any) && !tenantRow?.grafica_enabled) {
      return res.status(400).json({ error: "Status inválido" });
    }

    // Fluxo guiado: só avança uma etapa por vez dentro das 8 etapas do workflow,
    // igual à Ordem de Serviço. Estados terminais (cancelled/expired/converted) seguem
    // acessíveis livremente — não fazem parte do stepper.
    if (isWorkflowStage(status)) {
      const fromIdx = WORKFLOW_STAGES.indexOf(existing.status as any);
      const toIdx = WORKFLOW_STAGES.indexOf(status as any);
      if (fromIdx === -1 || toIdx !== fromIdx + 1) {
        return res.status(400).json({ error: "Só é possível avançar para a próxima etapa do fluxo" });
      }

      const allowed = await canMoveToStage(getUserId(req), getRole(req), status);
      if (!allowed) {
        return res.status(403).json({ error: "Seu papel não tem permissão para mover o orçamento para esta etapa" });
      }
    }

    await prisma.quote.update({ where: { id }, data: { status } });
    const actor = await getActor(req);
    await logQuoteAction(tenantId, id, "status_changed", {
      fromStatus: existing.status, toStatus: status, actor,
    });

    if (tenantRow?.grafica_enabled) {
      await syncLinkedStatus(tenantId, "quote", id, status, { actor });
    }

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Falha ao atualizar status" });
  }
}

export async function updateQuote(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const id = Number(req.params.id);

    const existing = await prisma.quote.findFirst({
      where: { id, tenant_id: tenantId },
      include: { items: true, services: true },
    });
    if (!existing) return res.status(404).json({ error: "Orçamento não encontrado" });
    if (existing.status !== "orcamento_enviado" && existing.status !== "rascunho") {
      return res.status(400).json({ error: "Só é possível editar orçamentos em aberto ou rascunho" });
    }

    const {
      customer_id,
      customer_name,
      customer_phone,
      customer_email,
      discount_type,
      discount_value,
      validity_days,
      notes,
      items,
      services,
    } = req.body as {
      customer_id?: number;
      customer_name?: string;
      customer_phone?: string;
      customer_email?: string;
      discount_type?: string;
      discount_value?: number;
      validity_days?: number;
      notes?: string;
      items?: Array<{ product_id?: number; name: string; quantity: number; unit_price: number; dimensions_label?: string | null }>;
      services?: Array<{ id: number; name: string; price: number; quantity?: number; dimensions_label?: string | null }>;
    };

    const changes: AuditChange[] = [];
    const addChange = (field: string, label: string, before: unknown, after: unknown, format = auditText) => {
      const beforeText = format(before);
      const afterText = format(after);
      if (beforeText !== afterText) changes.push({ field, label, before: beforeText, after: afterText });
    };
    if (customer_name !== undefined) addChange("customer_name", "Cliente", existing.customer_name, customer_name);
    if (customer_phone !== undefined) addChange("customer_phone", "Telefone", existing.customer_phone, customer_phone);
    if (customer_email !== undefined) addChange("customer_email", "E-mail do cliente", existing.customer_email, customer_email);
    if (discount_type !== undefined) addChange("discount_type", "Tipo de desconto", existing.discount_type === "fixed" ? "Valor fixo" : "Percentual", discount_type === "fixed" ? "Valor fixo" : "Percentual");
    if (discount_value !== undefined) addChange("discount_value", "Desconto", existing.discount_value, discount_value, auditMoney);
    if (validity_days !== undefined) addChange("validity_days", "Validade", `${existing.validity_days} dias`, `${validity_days} dias`);
    if (notes !== undefined) addChange("notes", "Observações", existing.notes, notes);
    if (items !== undefined || services !== undefined) {
      const before = auditItemsSummary(existing.items, existing.services);
      const after = auditItemsSummary(
        (items ?? existing.items).map((item) => ({ ...item, unit_price: item.unit_price })),
        (services ?? existing.services).map((service) => ({ ...service, unit_price: "price" in service ? service.price : service.unit_price })),
      );
      if (before !== after) changes.push({ field: "items", label: "Itens e serviços", before, after });
    }

    // Substitui items/services por completo (delete + recreate) apenas quando o body
    // enviar essas listas — permite autosave de campos isolados (ex: notes) sem apagar
    // itens já salvos quando o front não os inclui no patch.
    if (items !== undefined) {
      await prisma.quoteItem.deleteMany({ where: { quote_id: id } });
    }
    if (services !== undefined) {
      await prisma.quoteService.deleteMany({ where: { quote_id: id } });
    }

    await prisma.quote.update({
      where: { id },
      data: {
        ...(customer_id !== undefined && { customer_id: customer_id || null }),
        ...(customer_name !== undefined && { customer_name }),
        ...(customer_phone !== undefined && { customer_phone: customer_phone || null }),
        ...(customer_email !== undefined && { customer_email: customer_email || null }),
        ...(discount_type !== undefined && { discount_type }),
        ...(discount_value !== undefined && { discount_value }),
        ...(validity_days !== undefined && { validity_days }),
        ...(notes !== undefined && { notes: notes || null }),
        ...(items !== undefined && {
          items: {
            create: items.map((i) => ({
              product_id: i.product_id || null,
              name: i.name,
              quantity: i.quantity,
              unit_price: i.unit_price,
              total: Math.round(i.unit_price * i.quantity * 100) / 100,
              dimensions_label: i.dimensions_label || null,
            })),
          },
        }),
        ...(services !== undefined && {
          services: {
            create: services.map((s) => ({
              service_id: s.id,
              name: s.name,
              unit_price: s.price,
              quantity: s.quantity ?? 1,
              total: Math.round(s.price * (s.quantity ?? 1) * 100) / 100,
              dimensions_label: s.dimensions_label || null,
            })),
          },
        }),
      },
    });

    const totals = await recomputeQuoteTotals(id);
    if (changes.length > 0 && totals) {
      addChange("total_amount", "Total do orçamento", existing.total_amount, totals.totalAmount, auditMoney);
    }
    if (changes.length > 0) {
      await logQuoteAction(tenantId, id, "edited", {
        actor: await getActor(req),
        meta: { changes },
      });
    }

    const tenantRow = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { grafica_enabled: true } });
    if (tenantRow?.grafica_enabled) {
      await syncLinkedServiceOrderFromQuote(tenantId, id);
    }

    const updated = await prisma.quote.findFirst({ where: { id, tenant_id: tenantId }, include: QUOTE_INCLUDE });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao atualizar orçamento" });
  }
}

export async function recordQuoteDeposit(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const id = Number(req.params.id);

    const quote = await prisma.quote.findFirst({ where: { id, tenant_id: tenantId } });
    if (!quote) return res.status(404).json({ error: "Orçamento não encontrado" });
    if (quote.status !== "orcamento_enviado") {
      return res.status(400).json({ error: "Só é possível registrar entrada em orçamentos em aberto" });
    }

    const { amount, payment_method } = req.body as { amount: number; payment_method?: string };
    const depositAmount = Number(amount) || 0;
    if (depositAmount <= 0) return res.status(400).json({ error: "Valor da entrada inválido" });
    if (depositAmount > Number(quote.total_amount)) {
      return res.status(400).json({ error: "A entrada não pode ser maior que o total do orçamento" });
    }

    const pmString = payment_method || "money";
    const now = new Date();

    await prisma.quote.update({
      where: { id },
      data: {
        deposit_amount: depositAmount,
        deposit_payment_method: pmString,
        deposit_paid_at: now,
      },
    });

    const methodSummary = buildMethodSummary(pmString);
    await prisma.finance.create({
      data: {
        tenant_id: tenantId,
        type: "income",
        description: `Entrada — Orç. #${quote.number} — ${methodSummary}`,
        amount: depositAmount,
        gross_amount: depositAmount,
        date: localDateString(),
      },
    });

    await logQuoteAction(tenantId, id, "deposit_recorded", {
      actor: await getActor(req),
      note: `Entrada de ${depositAmount.toFixed(2)} (${methodSummary})`,
      meta: { amount: depositAmount, payment_method: pmString },
    });

    const updated = await prisma.quote.findFirst({ where: { id, tenant_id: tenantId }, include: QUOTE_INCLUDE });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao registrar entrada" });
  }
}

export async function deleteQuote(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    await prisma.quote.deleteMany({
      where: { id: Number(req.params.id), tenant_id: tenantId },
    });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Falha ao deletar orçamento" });
  }
}

// Anexos do Orçamento (referência do cliente, arte final, prova de aprovação) —
// mesmo padrão de attachServiceOrderPhoto/deleteServiceOrderPhoto em service-orders.controller.ts.
export async function attachQuoteFile(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const id = Number(req.params.id);
    const { url, caption, kind } = req.body as { url: string; caption?: string; kind?: string };

    const quote = await prisma.quote.findFirst({ where: { id, tenant_id: tenantId } });
    if (!quote) return res.status(404).json({ error: "Orçamento não encontrado" });
    if (!url) return res.status(400).json({ error: "URL do arquivo é obrigatória" });

    const validKinds = ["referencia", "arte", "prova"];
    const file = await prisma.quoteFile.create({
      data: {
        tenant_id: tenantId,
        quote_id: id,
        url,
        caption: caption || null,
        kind: validKinds.includes(kind ?? "") ? (kind as string) : "referencia",
      },
    });
    res.json(file);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao anexar arquivo" });
  }
}

export async function deleteQuoteFileHandler(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const id = Number(req.params.id);
    const fileId = Number(req.params.fileId);

    const file = await prisma.quoteFile.findFirst({ where: { id: fileId, quote_id: id, tenant_id: tenantId } });
    if (!file) return res.status(404).json({ error: "Arquivo não encontrado" });

    await prisma.quoteFile.delete({ where: { id: fileId } });

    const { deleteQuoteFile } = await import("./upload.controller");
    deleteQuoteFile(file.url);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao remover arquivo" });
  }
}

export async function convertToOrder(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const quoteId  = Number(req.params.id);

    const quote = await prisma.quote.findFirst({
      where: { id: quoteId, tenant_id: tenantId },
      include: { items: true, services: true },
    });
    if (!quote) return res.status(404).json({ error: "Orçamento não encontrado" });
    if (quote.status === "converted") return res.status(400).json({ error: "Orçamento já foi convertido em venda" });

    const body = req.body as {
      payment_method?: string;
      seller_id?: number;
      discount?: number; surcharge?: number; change_amount?: number;
      crediario_installments?: number; crediario_first_due_date?: string;
    };
    const { seller_id } = body;

    const pmString = body.payment_method || "money";

    // Load tenant card fees to compute machine fee
    const tenantData = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { card_fees: true, pass_fee_to_customer: true, pass_fee_by_method: true },
    });
    const cardFees = (tenantData?.card_fees ?? {}) as Record<string, number[]>;

    const quoteTotal    = Number(quote.total_amount);
    const depositAmount = Number(quote.deposit_amount ?? 0);
    const amountDue     = Math.max(0, Math.round((quoteTotal - depositAmount) * 100) / 100);
    const quoteDiscount = Number(quote.discount_value ?? 0);

    // Mesmo cálculo do PDV: taxa de maquininha (crédito/débito/PIX), repasse ao cliente,
    // desconto/acréscimo extra e parte fiada (crediário).
    const calc = computeSalePaymentTotals({
      baseAmount: amountDue,
      pmString,
      cardFees,
      discount: body.discount,
      surcharge: body.surcharge,
      passFeeToCustomer: tenantData?.pass_fee_to_customer,
      passFeeByMethod: (tenantData?.pass_fee_by_method ?? null) as Record<string, boolean> | null,
    });
    const { crediarioAmount, discountVal: extraDiscount, surchargeVal, roundedFee, roundedPassedFee } = calc;
    await assertCrediarioAllowed(tenantId, quote.customer_id, crediarioAmount);

    // Total do pedido = total do orçamento ajustado pelo que mudou neste pagamento.
    const totalAmount = Math.round((quoteTotal - extraDiscount + surchargeVal + roundedPassedFee) * 100) / 100;
    const discountVal = Math.round((quoteDiscount + extraDiscount) * 100) / 100;
    const grossAmount = Math.round((totalAmount + discountVal - surchargeVal) * 100) / 100;
    const netAmount   = calc.netAmount;
    const changeAmount = Number(body.change_amount) > 0 ? Number(body.change_amount) : 0;

    // Load seller name
    let sellerName: string | null = null;
    if (seller_id) {
      const seller = await prisma.seller.findUnique({ where: { id: seller_id }, select: { name: true } });
      sellerName = seller?.name ?? null;
    }

    const order = await prisma.order.create({
      data: {
        tenant_id:       tenantId,
        seller_id:       seller_id ?? null,
        seller_name:     sellerName,
        customer_name:   quote.customer_name,
        customer_id:     quote.customer_id ?? null,
        customer_phone:  quote.customer_phone || undefined,
        total_amount:    totalAmount,
        gross_amount:    grossAmount,
        discount_amount: discountVal > 0 ? discountVal : null,
        surcharge_amount: surchargeVal > 0 ? surchargeVal : null,
        passed_fee_amount: roundedPassedFee > 0 ? roundedPassedFee : null,
        change_amount:   changeAmount > 0 ? changeAmount : null,
        fee_amount:      roundedFee > 0 ? roundedFee : null,
        status:          "completed",
        payment_method:  pmString,
        items: {
          create: quote.items.filter((i) => i.product_id).map((i) => ({
            product_id: i.product_id!,
            quantity:   i.quantity,
            unit_price: i.unit_price,
            dimensions_label: i.dimensions_label,
          })),
        },
        ...(quote.services.length > 0 ? {
          services: {
            create: quote.services.map((s) => ({
              service_id: s.service_id,
              name:       s.name,
              unit_price: s.unit_price,
              quantity:   s.quantity,
            })),
          },
        } : {}),
      },
    });

    for (const item of quote.items) {
      if (item.product_id) {
        const product = await prisma.product.findUnique({
          where: { id: item.product_id },
          select: { sale_unit: true },
        });
        // Produtos por medida (m²/linear) não têm controle de estoque.
        if (product?.sale_unit && product.sale_unit !== "unidade") continue;
        await prisma.product.update({
          where: { id: item.product_id },
          data: { stock_quantity: { decrement: item.quantity } },
        });
      }
    }

    const methodSummary = buildMethodSummary(pmString);
    const depositNote = depositAmount > 0 ? ` (saldo após entrada de ${depositAmount.toFixed(2)})` : "";
    const extraNote = `${extraDiscount > 0 ? ` (desc. R$ ${extraDiscount.toFixed(2)})` : ""}${surchargeVal > 0 ? ` (acrés. R$ ${surchargeVal.toFixed(2)})` : ""}${roundedPassedFee > 0 ? ` (taxa repassada R$ ${roundedPassedFee.toFixed(2)})` : ""}`;
    // A parte fiada (crediário) só vira receita quando o cliente pagar a dívida.
    const nonCrediarioNet = Math.round((netAmount - crediarioAmount) * 100) / 100;
    if (nonCrediarioNet > 0.009) {
      await prisma.finance.create({
        data: {
          tenant_id:       tenantId,
          type:            "income",
          description:     `Venda (Orç. #${quote.number}) — ${methodSummary}${depositNote}${extraNote}`,
          amount:          nonCrediarioNet,
          gross_amount:    Math.round((grossAmount - crediarioAmount) * 100) / 100,
          fee_amount:      roundedFee > 0 ? roundedFee : null,
          discount_amount: discountVal > 0 ? discountVal : null,
          payment_method:  pmString,
          date:            localDateString(),
        },
      });
    }

    if (crediarioAmount > 0 && quote.customer_id) {
      await createCrediarioDebt({
        tenantId,
        customerId: quote.customer_id,
        orderId: order.id,
        description: `Venda (Orç. #${quote.number})`,
        crediarioAmount,
        installments: body.crediario_installments,
        firstDueDate: body.crediario_first_due_date,
      });
    }

    await prisma.quote.update({
      where: { id: quoteId },
      data: { status: "converted", converted_order_id: order.id },
    });

    await logQuoteAction(tenantId, quoteId, "converted", {
      fromStatus: quote.status, toStatus: "converted", actor: await getActor(req), meta: { order_id: order.id },
    });

    emitToTenant(tenantId, "order:created", { orderId: order.id, quoteId });
    emitToTenant(tenantId, "stock:changed", { orderId: order.id });

    res.json({ success: true, orderId: order.id });
  } catch (err) {
    if (err instanceof SalePaymentError) {
      return res.status(err.status).json({ error: err.message, ...(err.extra ?? {}) });
    }
    console.error(err);
    res.status(500).json({ error: "Falha ao converter orçamento" });
  }
}

// ── Auto-expiração de orçamentos ──────────────────────────────────────────────
// Mesmo padrão do único job em background já existente no projeto
// (startWhatsappMaintenanceLoop, backend/services/whatsapp.service.ts).

const QUOTE_EXPIRATION_INTERVAL_MS = 24 * 60 * 60 * 1000;
let quoteExpirationStarted = false;

export async function runQuoteExpirationJob() {
  try {
    const openQuotes = await prisma.quote.findMany({
      where: { status: "orcamento_enviado" },
      select: { id: true, tenant_id: true, created_at: true, validity_days: true },
    });

    const now = Date.now();
    for (const q of openQuotes) {
      const expiresAt = new Date(q.created_at).getTime() + q.validity_days * 24 * 60 * 60 * 1000;
      if (expiresAt >= now) continue;

      await prisma.quote.update({ where: { id: q.id }, data: { status: "expired" } });
      await logQuoteAction(q.tenant_id, q.id, "expired", { fromStatus: "orcamento_enviado", toStatus: "expired" });

      // Job em background não passa pelo updateQuoteStatus (rota HTTP) — sincroniza a OS
      // vinculada aqui também, senão a expiração automática nunca cancela a produção.
      const tenantRow = await prisma.tenant.findUnique({ where: { id: q.tenant_id }, select: { grafica_enabled: true } });
      if (tenantRow?.grafica_enabled) {
        await syncLinkedStatus(q.tenant_id, "quote", q.id, "expired", { actor: "Sistema (expiração automática)" });
      }
    }
  } catch (err) {
    console.error("Quote expiration job failed:", err);
  }
}

export function startQuoteExpirationLoop() {
  if (quoteExpirationStarted) return;
  quoteExpirationStarted = true;

  const timer = setInterval(() => {
    runQuoteExpirationJob().catch((error) => {
      console.error("Quote expiration job failed:", error);
    });
  }, QUOTE_EXPIRATION_INTERVAL_MS);

  timer.unref?.();
}
