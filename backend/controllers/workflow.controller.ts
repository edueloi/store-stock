import type { Request, Response } from "express";

import { prisma } from "../config/prisma";
import type { AuthenticatedRequest } from "../types/auth";

function getTenantId(req: Request) {
  return (req as AuthenticatedRequest).user.tenantId;
}

// Board do módulo "Fluxo de Produção" (Kanban) — só serve leitura já formatada
// para as colunas; mudar de etapa continua batendo em PUT /api/service-orders/:id/status
// e PUT /api/quotes/:id/status, que já concentram a lógica de permissão/validação.
export async function getWorkflowBoard(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const type = req.query.type === "orcamentos" ? "orcamentos" : "ordens_servico";

    if (type === "orcamentos") {
      const quotes = await prisma.quote.findMany({
        where: { tenant_id: tenantId },
        select: { id: true, number: true, customer_name: true, total_amount: true, status: true },
        orderBy: { created_at: "desc" },
      });
      res.json(quotes);
      return;
    }

    const orders = await prisma.serviceOrder.findMany({
      where: { tenant_id: tenantId },
      select: {
        id: true, number: true, customer_name: true, total_amount: true, status: true,
        quote_id: true, quote: { select: { number: true } },
      },
      orderBy: { created_at: "desc" },
    });
    res.json(orders);
  } catch (err) {
    console.error("[getWorkflowBoard] error:", err);
    res.status(500).json({ error: "Falha ao carregar o quadro de produção" });
  }
}

const OS_TERMINAL_STATUSES = ["entregue", "cancelada"];
const QUOTE_TERMINAL_STATUSES = ["entregue", "cancelled", "expired"];

// Aba "Concluídos" do quadro: histórico de cards que já saíram do fluxo ativo,
// filtrável por período. Usa updated_at (não created_at) porque o que importa aqui é
// quando o card chegou/saiu do fluxo, não quando foi aberto.
export async function getWorkflowHistory(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const type = req.query.type === "orcamentos" ? "orcamentos" : "ordens_servico";
    const { from, to } = req.query as { from?: string; to?: string };

    const updatedAtFilter: Record<string, Date> = {};
    if (from) updatedAtFilter.gte = new Date(`${from}T00:00:00`);
    if (to) updatedAtFilter.lte = new Date(`${to}T23:59:59.999`);

    if (type === "orcamentos") {
      const quotes = await prisma.quote.findMany({
        where: {
          tenant_id: tenantId,
          status: { in: QUOTE_TERMINAL_STATUSES },
          ...(from || to ? { updated_at: updatedAtFilter } : {}),
        },
        select: { id: true, number: true, customer_name: true, total_amount: true, status: true, updated_at: true },
        orderBy: { updated_at: "desc" },
      });
      res.json(quotes);
      return;
    }

    const orders = await prisma.serviceOrder.findMany({
      where: {
        tenant_id: tenantId,
        status: { in: OS_TERMINAL_STATUSES },
        ...(from || to ? { updated_at: updatedAtFilter } : {}),
      },
      select: {
        id: true, number: true, customer_name: true, total_amount: true, status: true, updated_at: true,
        quote_id: true, quote: { select: { number: true } },
      },
      orderBy: { updated_at: "desc" },
    });
    res.json(orders);
  } catch (err) {
    console.error("[getWorkflowHistory] error:", err);
    res.status(500).json({ error: "Falha ao carregar o histórico" });
  }
}
