import type { Request, Response } from "express";

import { prisma } from "../config/prisma";
import type { AuthenticatedRequest } from "../types/auth";
import { getTenantEmailSendingStatus, loadEmailSignature, sendTenantEmail } from "../services/store-email.service";
import { buildCrediarioEmail, buildQuoteEmail, buildServiceOrderEmail, isValidEmail } from "../utils/document-email-text";
import { syncLinkedStatus } from "../utils/stage-permissions";

type DocumentKind = "quote" | "service_order";
const logKind = (kind: DocumentKind) => `${kind}_email`;

function tenantId(req: Request) { return (req as AuthenticatedRequest).user.tenantId; }
async function actor(req: Request) {
  const user = (req as AuthenticatedRequest).user as any;
  if (user.name || user.email) return user.name ?? user.email;
  const account = await prisma.user.findFirst({
    where: { id: user.userId, tenant_id: user.tenantId },
    select: { name: true, email: true },
  });
  return account ? `${account.name} (${account.email})` : "Sistema";
}

async function status(req: Request, res: Response, kind: DocumentKind) {
  const documentId = Number(req.params.id);
  const logs = await prisma.automatedMessageLog.findMany({
    where: { tenant_id: tenantId(req), kind: logKind(kind), summary: { contains: `#${documentId}` } },
    orderBy: { created_at: "desc" }, take: 10,
  });
  const last = logs[0];
  const sending = await getTenantEmailSendingStatus(tenantId(req));
  res.json({
    sent: last?.status === "sent", recipient: last?.recipient ?? null, sent_at: last?.status === "sent" ? last.created_at : null, attempts: logs.length, last_status: last?.status ?? null,
    // Envio liberado se o modo "sistema" estiver ativo OU a conta própria estiver conectada.
    can_send: sending.can_send, sender_mode: sending.mode,
  });
}

async function logDelivery(tenant_id: number, kind: DocumentKind, id: number, recipient: string, statusValue: "sent" | "failed", error?: string) {
  await prisma.automatedMessageLog.create({ data: {
    tenant_id, kind: logKind(kind), channel: "email", recipient, status: statusValue,
    summary: `${kind === "quote" ? "Orçamento" : "Ordem de serviço"} #${id}`,
    error: error?.slice(0, 1000) || null,
  } });
}

// O status representa a entrega ao cliente, não apenas o preenchimento do documento.
// Ao enviar com sucesso, avança o rascunho e sincroniza a OS/Orçamento vinculados.
async function markQuoteAsSent(tenant_id: number, quote: { id: number; status: string }, sentBy: string) {
  if (quote.status !== "rascunho") return;
  await prisma.quote.update({ where: { id: quote.id }, data: { status: "orcamento_enviado" } });
  await prisma.quoteAction.create({ data: {
    tenant_id,
    quote_id: quote.id,
    action: "sent_by_email",
    from_status: "rascunho",
    to_status: "orcamento_enviado",
    actor: sentBy,
  } });
  await syncLinkedStatus(tenant_id, "quote", quote.id, "orcamento_enviado", { actor: sentBy });
}

async function markServiceOrderAsSent(tenant_id: number, order: { id: number; status: string }, sentBy: string) {
  if (order.status !== "rascunho") return;
  await prisma.serviceOrder.update({ where: { id: order.id }, data: { status: "orcamento_enviado" } });
  await prisma.serviceOrderAction.create({ data: {
    tenant_id,
    service_order_id: order.id,
    action: "sent_by_email",
    from_status: "rascunho",
    to_status: "orcamento_enviado",
    actor: sentBy,
  } });
  await syncLinkedStatus(tenant_id, "service_order", order.id, "orcamento_enviado", { actor: sentBy });
}

export async function quoteEmailStatus(req: Request, res: Response) {
  try { await status(req, res, "quote"); } catch { res.status(500).json({ error: "Falha ao consultar envios de e-mail." }); }
}

export async function sendQuoteEmail(req: Request, res: Response) {
  const currentTenantId = tenantId(req);
  const quote = await prisma.quote.findFirst({
    where: { id: Number(req.params.id), tenant_id: currentTenantId }, include: { items: true, services: true },
  });
  if (!quote) { res.status(404).json({ error: "Orçamento não encontrado." }); return; }
  const customer = quote.customer_id ? await prisma.customer.findFirst({ where: { id: quote.customer_id, tenant_id: currentTenantId }, select: { email: true } }) : null;
  const recipient = (quote.customer_email || customer?.email || "").trim();
  if (!recipient) { res.status(422).json({ error: "Cadastre o e-mail do cliente antes de enviar o orçamento." }); return; }

  if (!isValidEmail(recipient)) { res.status(422).json({ error: "O e-mail cadastrado para o cliente é inválido. Corrija o cadastro antes de enviar o orçamento." }); return; }
  const { signature, replyTo } = await loadEmailSignature(currentTenantId, (req as AuthenticatedRequest).user.userId);
  const email = buildQuoteEmail({ customerName: quote.customer_name, number: quote.number, total: quote.total_amount, validityDays: quote.validity_days, notes: quote.notes, signature });
  try {
    await sendTenantEmail(currentTenantId, { to: recipient, subject: email.subject, text: email.text, replyTo });
    await logDelivery(currentTenantId, "quote", quote.id, recipient, "sent");
    await markQuoteAsSent(currentTenantId, quote, await actor(req));
    res.json({ success: true, recipient, sent_at: new Date() });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Não foi possível enviar o e-mail.";
    await logDelivery(currentTenantId, "quote", quote.id, recipient, "failed", message).catch(() => {});
    res.status(422).json({ error: message });
  }
}

export async function serviceOrderEmailStatus(req: Request, res: Response) {
  try { await status(req, res, "service_order"); } catch { res.status(500).json({ error: "Falha ao consultar envios de e-mail." }); }
}

export async function sendServiceOrderEmail(req: Request, res: Response) {
  const currentTenantId = tenantId(req);
  const order = await prisma.serviceOrder.findFirst({ where: { id: Number(req.params.id), tenant_id: currentTenantId }, include: { parts: true } });
  if (!order) { res.status(404).json({ error: "Ordem de serviço não encontrada." }); return; }
  const customer = order.customer_id ? await prisma.customer.findFirst({ where: { id: order.customer_id, tenant_id: currentTenantId }, select: { email: true } }) : null;
  const recipient = customer?.email?.trim() || "";
  if (!recipient) { res.status(422).json({ error: "Cadastre o e-mail do cliente antes de enviar a ordem de serviço." }); return; }
  if (!isValidEmail(recipient)) { res.status(422).json({ error: "O e-mail cadastrado para o cliente é inválido. Corrija o cadastro antes de enviar a ordem de serviço." }); return; }
  const { signature, replyTo } = await loadEmailSignature(currentTenantId, (req as AuthenticatedRequest).user.userId);
  const email = buildServiceOrderEmail({ customerName: order.customer_name, number: order.number, total: order.total_amount, status: order.status, promisedAt: order.promised_at, serviceDescription: order.service_description, observations: order.observations, signature });
  try {
    await sendTenantEmail(currentTenantId, { to: recipient, subject: email.subject, text: email.text, replyTo });
    await logDelivery(currentTenantId, "service_order", order.id, recipient, "sent");
    await markServiceOrderAsSent(currentTenantId, order, await actor(req));
    res.json({ success: true, recipient, sent_at: new Date() });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Não foi possível enviar o e-mail.";
    await logDelivery(currentTenantId, "service_order", order.id, recipient, "failed", message).catch(() => {});
    res.status(422).json({ error: message });
  }
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  money: "Dinheiro", pix: "PIX", debit: "Débito", credit: "Crédito", crediario: "Crediário", transfer: "Transferência", boleto: "Boleto",
};

/**
 * Envia ao cliente o extrato de um crediário ou, informando payment_id, o comprovante
 * de um pagamento específico. O e-mail do cliente pode ser informado em body.email
 * quando o cadastro não tiver um.
 */
export async function sendCrediarioEmail(req: Request, res: Response) {
  const currentTenantId = tenantId(req);
  const customerId = Number(req.params.id);
  const debtId = Number(req.params.debtId);
  const requestedEmail = String(req.body?.email || "").trim().toLowerCase();
  const paymentId = req.body?.payment_id !== undefined && req.body?.payment_id !== null ? Number(req.body.payment_id) : null;

  const debt = await prisma.customerDebt.findFirst({
    where: { id: debtId, customer_id: customerId, tenant_id: currentTenantId },
    include: { payments: { orderBy: [{ paid_at: "asc" }, { id: "asc" }] }, installments: { orderBy: { number: "asc" } } },
  });
  if (!debt) { res.status(404).json({ error: "Crediário não encontrado." }); return; }
  const payment = paymentId ? debt.payments.find((p) => p.id === paymentId) : null;
  if (paymentId && !payment) { res.status(404).json({ error: "Pagamento não encontrado neste crediário." }); return; }

  const customer = await prisma.customer.findFirst({ where: { id: customerId, tenant_id: currentTenantId }, select: { name: true, email: true } });
  if (!customer) { res.status(404).json({ error: "Cliente não encontrado." }); return; }
  const recipient = requestedEmail || (customer.email || "").trim();
  if (!recipient) { res.status(422).json({ code: "recipient_required", error: "Cadastre o e-mail do cliente antes de enviar o crediário." }); return; }
  if (!isValidEmail(recipient)) { res.status(422).json({ code: "recipient_required", error: "O e-mail informado para o cliente é inválido." }); return; }

  const total = Number(debt.amount);
  const paidTotal = payment
    ? debt.payments.slice(0, debt.payments.findIndex((p) => p.id === payment.id) + 1).reduce((sum, p) => sum + Number(p.amount), 0)
    : Number(debt.amount_paid);
  const { signature, replyTo } = await loadEmailSignature(currentTenantId, (req as AuthenticatedRequest).user.userId);
  const email = buildCrediarioEmail({
    customerName: customer.name,
    description: debt.description,
    total,
    paid: paidTotal,
    remaining: Math.max(0, total - paidTotal),
    installments: debt.installments.map((inst) => ({
      number: inst.number,
      dueDate: inst.due_date,
      amount: inst.amount,
      paid: inst.status === "paid" || Number(inst.amount_paid) >= Number(inst.amount),
    })),
    payment: payment ? { amount: payment.amount, paidAt: payment.paid_at, method: payment.payment_method ? PAYMENT_METHOD_LABELS[payment.payment_method] ?? payment.payment_method : null } : null,
    signature,
  });

  const summary = `Crediário #${debt.id}`;
  const log = (statusValue: "sent" | "failed", error?: string) => prisma.automatedMessageLog.create({ data: {
    tenant_id: currentTenantId, kind: "crediario_email", channel: "email", recipient, status: statusValue, summary, error: error?.slice(0, 1000) || null,
  } }).catch(() => {});
  try {
    await sendTenantEmail(currentTenantId, { to: recipient, subject: email.subject, text: email.text, replyTo });
    await log("sent");
    res.json({ success: true, recipient, sent_at: new Date() });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Não foi possível enviar o e-mail.";
    await log("failed", message);
    res.status(422).json({ error: message });
  }
}
