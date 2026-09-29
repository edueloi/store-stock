import type { Request, Response } from "express";

import { prisma } from "../config/prisma";
import type { AuthenticatedRequest } from "../types/auth";
import { escapeHtml } from "../utils/html-escape";
import { baseTemplate, } from "../services/mailer.service";
import { sendStoreEmail } from "../services/store-email.service";

type DocumentKind = "quote" | "service_order";
const logKind = (kind: DocumentKind) => `${kind}_email`;

function tenantId(req: Request) { return (req as AuthenticatedRequest).user.tenantId; }
function money(value: unknown) { return Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }

async function status(req: Request, res: Response, kind: DocumentKind) {
  const documentId = Number(req.params.id);
  const logs = await prisma.automatedMessageLog.findMany({
    where: { tenant_id: tenantId(req), kind: logKind(kind), summary: { contains: `#${documentId}` } },
    orderBy: { created_at: "desc" }, take: 10,
  });
  const last = logs[0];
  res.json({ sent: last?.status === "sent", recipient: last?.recipient ?? null, sent_at: last?.status === "sent" ? last.created_at : null, attempts: logs.length, last_status: last?.status ?? null });
}

async function logDelivery(tenant_id: number, kind: DocumentKind, id: number, recipient: string, statusValue: "sent" | "failed", error?: string) {
  await prisma.automatedMessageLog.create({ data: {
    tenant_id, kind: logKind(kind), channel: "email", recipient, status: statusValue,
    summary: `${kind === "quote" ? "Orçamento" : "Ordem de serviço"} #${id}`,
    error: error?.slice(0, 1000) || null,
  } });
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

  const lines = [...quote.items, ...quote.services].map((item: any) => `<tr><td style="padding:7px 0;color:#334155;">${escapeHtml(item.name)} × ${item.quantity}</td><td align="right" style="padding:7px 0;font-weight:700;color:#0f172a;">${money(item.total)}</td></tr>`).join("");
  const html = baseTemplate(`<p style="margin:0 0 8px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#2563eb;">Orçamento #${quote.number}</p><h1 style="margin:0 0 16px;font-size:24px;color:#0f172a;">Olá, ${escapeHtml(quote.customer_name || "cliente")}!</h1><p style="color:#475569;line-height:1.6;">Segue o seu orçamento. Validade: <strong>${quote.validity_days} dias</strong>.</p><table width="100%" cellspacing="0" cellpadding="0" style="margin:18px 0;border-top:1px solid #e2e8f0;">${lines}</table><p style="margin:16px 0 0;font-size:18px;font-weight:900;color:#0f172a;text-align:right;">Total: ${money(quote.total_amount)}</p>${quote.notes ? `<p style="margin-top:20px;color:#475569;line-height:1.5;"><strong>Observações:</strong><br/>${escapeHtml(quote.notes)}</p>` : ""}`);
  try {
    await sendStoreEmail(currentTenantId, { to: recipient, subject: `Orçamento #${quote.number} · ${money(quote.total_amount)}`, html });
    await logDelivery(currentTenantId, "quote", quote.id, recipient, "sent");
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
  const parts = order.parts.map((part: any) => `<tr><td style="padding:7px 0;color:#334155;">${escapeHtml(part.name)} × ${part.quantity}</td><td align="right" style="padding:7px 0;font-weight:700;color:#0f172a;">${money(part.total)}</td></tr>`).join("");
  const html = baseTemplate(`<p style="margin:0 0 8px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#2563eb;">Ordem de serviço #${order.number}</p><h1 style="margin:0 0 16px;font-size:24px;color:#0f172a;">Olá, ${escapeHtml(order.customer_name || "cliente")}!</h1><p style="color:#475569;line-height:1.6;">Status atual: <strong>${escapeHtml(order.status.replace(/_/g, " "))}</strong>.</p>${order.service_description ? `<p style="color:#475569;line-height:1.6;"><strong>Serviço:</strong> ${escapeHtml(order.service_description)}</p>` : ""}${parts ? `<table width="100%" cellspacing="0" cellpadding="0" style="margin:18px 0;border-top:1px solid #e2e8f0;">${parts}</table>` : ""}<p style="margin:16px 0 0;font-size:18px;font-weight:900;color:#0f172a;text-align:right;">Total: ${money(order.total_amount)}</p>${order.observations ? `<p style="margin-top:20px;color:#475569;line-height:1.5;"><strong>Observações:</strong><br/>${escapeHtml(order.observations)}</p>` : ""}`);
  try {
    await sendStoreEmail(currentTenantId, { to: recipient, subject: `Ordem de serviço #${order.number} · ${money(order.total_amount)}`, html });
    await logDelivery(currentTenantId, "service_order", order.id, recipient, "sent");
    res.json({ success: true, recipient, sent_at: new Date() });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Não foi possível enviar o e-mail.";
    await logDelivery(currentTenantId, "service_order", order.id, recipient, "failed", message).catch(() => {});
    res.status(422).json({ error: message });
  }
}
