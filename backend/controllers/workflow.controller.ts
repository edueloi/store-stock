import type { Request, Response } from "express";

import { prisma } from "../config/prisma";
import type { AuthenticatedRequest } from "../types/auth";
import { getWorkflowStagesForTenant } from "../utils/workflow-stages";

function getTenantId(req: Request) {
  return (req as AuthenticatedRequest).user.tenantId;
}

async function actor(req: Request) {
  const user = (req as AuthenticatedRequest).user;
  const account = await prisma.user.findFirst({ where: { id: user.userId, tenant_id: user.tenantId }, select: { name: true } });
  return account?.name ?? "Sistema";
}

export async function listProductionTasks(req: Request, res: Response) {
  try {
    const tasks = await prisma.productionTask.findMany({ where: { tenant_id: getTenantId(req) }, orderBy: { updated_at: "desc" } });
    res.json(tasks);
  } catch { res.status(500).json({ error: "Falha ao carregar atividades." }); }
}

export async function createProductionTask(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const body = req.body as Record<string, unknown>;
    const title = String(body.title ?? "").trim();
    if (!title) { res.status(422).json({ error: "Informe o título da atividade." }); return; }
    const last = await prisma.productionTask.findFirst({ where: { tenant_id: tenantId }, orderBy: { number: "desc" }, select: { number: true } });
    const task = await prisma.productionTask.create({ data: {
      tenant_id: tenantId,
      number: (last?.number ?? 0) + 1,
      title,
      description: String(body.description ?? "").trim() || null,
      expected_result: String(body.expected_result ?? "").trim() || null,
      priority: body.priority === "urgente" ? "urgente" : "normal",
      customer_id: body.customer_id ? Number(body.customer_id) : null,
      customer_name: String(body.customer_name ?? "").trim() || null,
      customer_phone: String(body.customer_phone ?? "").trim() || null,
      customer_email: String(body.customer_email ?? "").trim() || null,
      assignee_id: body.assignee_id ? Number(body.assignee_id) : null,
      assignee_name: String(body.assignee_name ?? "").trim() || null,
      due_at: body.due_at ? new Date(String(body.due_at)) : null,
      planned_items: Array.isArray(body.planned_items) ? body.planned_items : [],
      created_by_id: (req as AuthenticatedRequest).user.userId,
      created_by_name: await actor(req),
    } });
    res.status(201).json(task);
  } catch { res.status(500).json({ error: "Falha ao criar atividade." }); }
}

export async function updateProductionTaskStatus(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const task = await prisma.productionTask.findFirst({ where: { id: Number(req.params.id), tenant_id: tenantId } });
    if (!task) { res.status(404).json({ error: "Atividade não encontrada." }); return; }
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { grafica_enabled: true } });
    const stages = getWorkflowStagesForTenant(!!tenant?.grafica_enabled);
    const status = String(req.body.status ?? "");
    if (!stages.includes(status as any) || stages.indexOf(status as any) !== stages.indexOf(task.status as any) + 1) {
      res.status(400).json({ error: "Só é possível avançar para a próxima etapa." }); return;
    }
    const updated = await prisma.productionTask.update({ where: { id: task.id }, data: { status } });
    res.json(updated);
  } catch { res.status(500).json({ error: "Falha ao mover atividade." }); }
}

export async function createServiceOrderFromTask(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const task = await prisma.productionTask.findFirst({ where: { id: Number(req.params.id), tenant_id: tenantId } });
    if (!task) { res.status(404).json({ error: "Atividade não encontrada." }); return; }
    if (task.service_order_id) { res.json({ service_order_id: task.service_order_id, existing: true }); return; }
    const last = await prisma.serviceOrder.findFirst({ where: { tenant_id: tenantId }, orderBy: { number: "desc" }, select: { number: true } });
    const order = await prisma.serviceOrder.create({ data: {
      tenant_id: tenantId,
      number: (last?.number ?? 0) + 1,
      status: "rascunho",
      customer_id: task.customer_id,
      customer_name: task.customer_name ?? "",
      customer_phone: task.customer_phone,
      has_equipment: false,
      equipment_category: "",
      reported_issue: task.description || task.title,
      technician_name: task.assignee_name,
      promised_at: task.due_at,
      service_description: task.expected_result,
    } });
    await prisma.productionTask.update({ where: { id: task.id }, data: { service_order_id: order.id } });
    res.status(201).json({ service_order_id: order.id });
  } catch { res.status(500).json({ error: "Falha ao criar Ordem de Serviço." }); }
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
