import type { Request, Response } from "express";

import { prisma } from "../config/prisma";
import type { AuthenticatedRequest } from "../types/auth";
import { loadCustomerStatement } from "../services/customer-statement.service";
import { buildDebtPaymentWhatsappText, createDebtPaymentReceiptPdf } from "../services/debt-payment-receipt.service";
import { sendWhatsappDocument } from "../services/whatsapp.service";

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  money: "Dinheiro", pix: "PIX", debit: "Débito", credit: "Crédito", crediario: "Crediário", transfer: "Transferência", boleto: "Boleto",
};

/** Só dígitos, com DDI 55 quando o número veio sem (10 ou 11 dígitos = DDD + número). */
function toWhatsappNumber(raw: string | null | undefined) {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) return digits;
  return "";
}

/**
 * Envia ao cliente, pelo WhatsApp da loja, o comprovante em PDF de um pagamento de crediário
 * com uma mensagem de "pagamento recebido" (mesmo conteúdo do e-mail de comprovante).
 * O número pode vir em body.number quando o cadastro do cliente não tiver telefone.
 */
export async function sendCrediarioPaymentWhatsapp(req: Request, res: Response) {
  const tenantId = (req as AuthenticatedRequest).user.tenantId;
  const customerId = Number(req.params.id);
  const debtId = Number(req.params.debtId);
  const paymentId = Number(req.body?.payment_id);
  let recipient = "";

  try {
    if (!Number.isInteger(paymentId)) { res.status(422).json({ error: "Informe o pagamento." }); return; }

    const debt = await prisma.customerDebt.findFirst({
      where: { id: debtId, customer_id: customerId, tenant_id: tenantId },
      include: { payments: { orderBy: [{ paid_at: "asc" }, { id: "asc" }] }, installments: { orderBy: { number: "asc" } } },
    });
    if (!debt) { res.status(404).json({ error: "Crediário não encontrado." }); return; }
    const index = debt.payments.findIndex((p) => p.id === paymentId);
    if (index < 0) { res.status(404).json({ error: "Pagamento não encontrado neste crediário." }); return; }
    const payment = debt.payments[index];

    const statement = await loadCustomerStatement(tenantId, customerId);
    if (!statement) { res.status(404).json({ error: "Cliente não encontrado." }); return; }

    const requested = String(req.body?.number ?? "").trim();
    recipient = toWhatsappNumber(requested || statement.customer.phone);
    if (!recipient) {
      res.status(422).json({
        code: "recipient_required",
        error: requested || statement.customer.phone
          ? "O número de WhatsApp informado é inválido. Use DDD + número (ex.: 11 91234-5678)."
          : "Cadastre o telefone do cliente ou informe o número de WhatsApp para enviar.",
      });
      return;
    }

    const total = Number(debt.amount);
    const paidTotal = debt.payments.slice(0, index + 1).reduce((sum, p) => sum + Number(p.amount), 0);
    const next = debt.installments.find((i) => i.status !== "paid" && Number(i.amount_paid) < Number(i.amount));
    const data = {
      store: statement.store,
      customerName: statement.customer.name,
      description: debt.description,
      paymentAmount: Number(payment.amount),
      paymentMethod: payment.payment_method ? PAYMENT_METHOD_LABELS[payment.payment_method] ?? payment.payment_method : null,
      paidAt: payment.paid_at,
      total,
      paidTotal,
      remaining: Math.max(0, total - paidTotal),
      receiptNumber: payment.id,
      nextInstallment: next ? { number: next.number, dueDate: next.due_date, amount: Number(next.amount) - Number(next.amount_paid) } : null,
    };

    const pdf = await createDebtPaymentReceiptPdf(data);
    const summary = `Comprovante de pagamento #${payment.id} (crediário #${debt.id})`;
    const log = (status: "sent" | "failed", error?: string) =>
      prisma.automatedMessageLog.create({ data: {
        tenant_id: tenantId, kind: "crediario_whatsapp", channel: "whatsapp", recipient, status, summary, error: error?.slice(0, 1000) || null,
      } }).catch(() => {});

    try {
      await sendWhatsappDocument(tenantId, recipient, pdf.toString("base64"), `comprovante-${payment.id}.pdf`, buildDebtPaymentWhatsappText(data));
      await log("sent");
      res.json({ success: true, recipient });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Não foi possível enviar pelo WhatsApp.";
      await log("failed", message);
      res.status(422).json({ error: message });
    }
  } catch (err) {
    console.error("sendCrediarioPaymentWhatsapp error:", err);
    res.status(500).json({ error: "Não foi possível preparar o comprovante." });
  }
}
