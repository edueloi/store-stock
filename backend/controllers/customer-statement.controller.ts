import type { Request, Response } from "express";

import { prisma } from "../config/prisma";
import type { AuthenticatedRequest } from "../types/auth";
import { createCustomerStatementPdf } from "../services/customer-statement-pdf.service";
import { buildStatementWhatsappText, loadCustomerStatement } from "../services/customer-statement.service";
import { sendWhatsappDocument } from "../services/whatsapp.service";

function tenantIdOf(req: Request) {
  return (req as AuthenticatedRequest).user.tenantId;
}

/** Só dígitos, com DDI 55 quando o número veio sem (10 ou 11 dígitos = DDD + número). */
function toWhatsappNumber(raw: string | null | undefined) {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) return digits;
  return "";
}

const pdfFileName = (customerName: string) =>
  `extrato-${customerName.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "cliente"}.pdf`;

/** PDF do extrato do cliente (posição do crediário, compras e pagamentos), para visualizar/baixar. */
export async function downloadCustomerStatementPdf(req: Request, res: Response) {
  try {
    const data = await loadCustomerStatement(tenantIdOf(req), Number(req.params.id));
    if (!data) { res.status(404).json({ error: "Cliente não encontrado." }); return; }
    const pdf = await createCustomerStatementPdf(data);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${pdfFileName(data.customer.name)}"`);
    res.send(pdf);
  } catch (err) {
    console.error("downloadCustomerStatementPdf error:", err);
    res.status(500).json({ error: "Não foi possível gerar o extrato do cliente." });
  }
}

/**
 * Envia ao cliente, pelo WhatsApp da loja, o extrato em PDF acompanhado de uma mensagem com
 * o resumo (total, já pago, falta pagar, atraso e próximo vencimento). O número pode vir em
 * body.number quando o cadastro do cliente não tiver telefone.
 */
export async function sendCustomerStatementWhatsapp(req: Request, res: Response) {
  const tenantId = tenantIdOf(req);
  const customerId = Number(req.params.id);
  let recipient = "";

  try {
    const data = await loadCustomerStatement(tenantId, customerId);
    if (!data) { res.status(404).json({ error: "Cliente não encontrado." }); return; }

    const requested = String(req.body?.number ?? "").trim();
    recipient = toWhatsappNumber(requested || data.customer.phone);
    if (!recipient) {
      res.status(422).json({
        code: "recipient_required",
        error: requested || data.customer.phone
          ? "O número de WhatsApp informado é inválido. Use DDD + número (ex.: 11 91234-5678)."
          : "Cadastre o telefone do cliente ou informe o número de WhatsApp para enviar.",
      });
      return;
    }

    const pdf = await createCustomerStatementPdf(data);
    const caption = buildStatementWhatsappText(data);
    const summary = `Extrato do cliente #${customerId}: pendente R$ ${data.summary.pending.toFixed(2)}`;
    const log = (status: "sent" | "failed", error?: string) =>
      prisma.automatedMessageLog.create({ data: {
        tenant_id: tenantId, kind: "crediario_whatsapp", channel: "whatsapp", recipient, status, summary, error: error?.slice(0, 1000) || null,
      } }).catch(() => {});

    try {
      await sendWhatsappDocument(tenantId, recipient, pdf.toString("base64"), pdfFileName(data.customer.name), caption);
      await log("sent");
      res.json({ success: true, recipient, pending: data.summary.pending });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Não foi possível enviar pelo WhatsApp.";
      await log("failed", message);
      res.status(422).json({ error: message });
    }
  } catch (err) {
    console.error("sendCustomerStatementWhatsapp error:", err);
    res.status(500).json({ error: "Não foi possível preparar o extrato do cliente." });
  }
}
