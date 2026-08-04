import crypto from "crypto";
import type { Request, Response } from "express";

import { prisma } from "../config/prisma";
import type { AuthenticatedRequest } from "../types/auth";

const QUOTE_INCLUDE = { items: true, services: true };

// Gera (ou retorna o já existente) link público de aprovação — chamado pela tela
// interna de detalhe do orçamento, autenticado.
export async function createQuoteApprovalLink(req: Request, res: Response) {
  try {
    const tenantId = (req as AuthenticatedRequest).user.tenantId;
    const id = Number(req.params.id);

    const quote = await prisma.quote.findFirst({ where: { id, tenant_id: tenantId } });
    if (!quote) return res.status(404).json({ error: "Orçamento não encontrado" });

    const token = quote.approval_token ?? crypto.randomBytes(24).toString("hex");
    if (!quote.approval_token) {
      await prisma.quote.update({ where: { id }, data: { approval_token: token } });
    }

    res.json({ token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao gerar link de aprovação" });
  }
}

// Rota pública (sem autenticação): o cliente abre o link recebido e vê os dados
// do orçamento para decidir se aprova.
export async function getQuoteByApprovalToken(req: Request, res: Response) {
  try {
    const { token } = req.params;
    const quote = await prisma.quote.findFirst({
      where: { approval_token: token },
      include: QUOTE_INCLUDE,
    });
    if (!quote) return res.status(404).json({ error: "Link de aprovação inválido" });

    res.json({
      number: quote.number,
      customer_name: quote.customer_name,
      subtotal: quote.subtotal,
      discount_type: quote.discount_type,
      discount_value: quote.discount_value,
      total_amount: quote.total_amount,
      validity_days: quote.validity_days,
      notes: quote.notes,
      status: quote.status,
      approved_by_client: quote.approved_by_client,
      approved_at: quote.approved_at,
      created_at: quote.created_at,
      items: quote.items,
      services: quote.services,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao buscar orçamento" });
  }
}

// Rota pública: o cliente aprova o orçamento pelo link. Só funciona enquanto o
// orçamento estiver na etapa "aguardando_aprovacao" — evita aprovar um rascunho
// ou um orçamento que já seguiu adiante por outro caminho.
export async function approveQuoteByToken(req: Request, res: Response) {
  try {
    const { token } = req.params;
    const quote = await prisma.quote.findFirst({ where: { approval_token: token } });
    if (!quote) return res.status(404).json({ error: "Link de aprovação inválido" });
    if (quote.approved_by_client) return res.status(400).json({ error: "Orçamento já foi aprovado" });
    if (quote.status !== "aguardando_aprovacao") {
      return res.status(400).json({ error: "Este orçamento não está aguardando aprovação no momento" });
    }

    await prisma.quote.update({
      where: { id: quote.id },
      data: { status: "aprovado", approved_by_client: true, approved_at: new Date() },
    });
    await prisma.quoteAction.create({
      data: {
        tenant_id: quote.tenant_id,
        quote_id: quote.id,
        action: "status_changed",
        from_status: "aguardando_aprovacao",
        to_status: "aprovado",
        actor: "Cliente (link público)",
      },
    });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao aprovar orçamento" });
  }
}
