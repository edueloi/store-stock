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
      select: { id: true, number: true, customer_name: true, total_amount: true, status: true },
      orderBy: { created_at: "desc" },
    });
    res.json(orders);
  } catch (err) {
    console.error("[getWorkflowBoard] error:", err);
    res.status(500).json({ error: "Falha ao carregar o quadro de produção" });
  }
}
