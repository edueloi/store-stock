import type { Request, Response } from "express";
import { prisma } from "../config/prisma";
import type { AuthenticatedRequest } from "../types/auth";

function getTenantId(req: Request) {
  return (req as AuthenticatedRequest).user.tenantId;
}

type Role = "technician" | "seller";
const DONE_STATUSES = ["finalizado", "nota_emitida", "entregue"];
const r2 = (n: number) => Math.round(n * 100) / 100;

function parseRole(v: unknown): Role | null {
  return v === "technician" || v === "seller" ? v : null;
}

// Base da comissão = valor do SERVIÇO da O.S. já líquido do desconto geral (rateado), sem peças.
function serviceBase(o: { service_value: unknown; subtotal: unknown; total_amount: unknown }) {
  const service = Number(o.service_value) || 0;
  const subtotal = Number(o.subtotal) || 0;
  const total = Number(o.total_amount) || 0;
  const ratio = subtotal > 0 ? Math.min(1, total / subtotal) : 1;
  return r2(service * ratio);
}

function commissionOf(type: string, value: number, base: number) {
  return r2(type === "fixed" ? value : (base * value) / 100);
}

// Lista as O.S. concluídas do período com a comissão de cada uma (técnico ou vendedor).
export async function listServiceCommissions(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const role = parseRole(req.query.role);
    if (!role) { res.status(400).json({ error: "role inválido" }); return; }
    const from = req.query.from ? new Date(`${String(req.query.from)}T00:00:00`) : null;
    const to = req.query.to ? new Date(`${String(req.query.to)}T23:59:59.999`) : null;
    const range = from || to ? { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } : null;
    const person = String(req.query.person ?? "all"); // all | none | <id>
    const personField = role === "technician" ? "technician_id" : "seller_id";

    const orders = await prisma.serviceOrder.findMany({
      where: {
        tenant_id: tenantId,
        status: { in: DONE_STATUSES },
        ...(range ? { OR: [{ invoiced_at: range }, { invoiced_at: null, updated_at: range }] } : {}),
        ...(person === "none" ? { [personField]: null } : /^\d+$/.test(person) ? { [personField]: Number(person) } : {}),
      },
      select: {
        id: true, number: true, customer_name: true, status: true, invoiced_at: true, updated_at: true,
        service_value: true, subtotal: true, total_amount: true,
        technician_id: true, seller_id: true,
        commission_technician_type: true, commission_technician_value: true,
        commission_seller_type: true, commission_seller_value: true,
        technician_commission_paid_at: true, seller_commission_paid_at: true,
      },
      orderBy: { updated_at: "desc" },
      take: 1000,
    });

    const [technicians, sellers] = await Promise.all([
      prisma.technician.findMany({ where: { tenant_id: tenantId }, select: { id: true, name: true, service_commission_type: true, service_commission_value: true } }),
      prisma.seller.findMany({ where: { tenant_id: tenantId }, select: { id: true, name: true, service_commission_type: true, service_commission_value: true } }),
    ]);
    const people = new Map((role === "technician" ? technicians : sellers).map((p) => [p.id, p]));

    const rows = orders.map((o) => {
      const pid = role === "technician" ? o.technician_id : o.seller_id;
      const p = pid ? people.get(pid) : undefined;
      const ovType = role === "technician" ? o.commission_technician_type : o.commission_seller_type;
      const ovValue = role === "technician" ? o.commission_technician_value : o.commission_seller_value;
      const paidAt = role === "technician" ? o.technician_commission_paid_at : o.seller_commission_paid_at;
      const override = ovType != null && ovValue != null;
      const type = override ? String(ovType) : p?.service_commission_type ?? "percent";
      const value = override ? Number(ovValue) : Number(p?.service_commission_value ?? 0);
      const base = serviceBase(o);
      return {
        id: o.id,
        number: o.number,
        customer_name: o.customer_name,
        status: o.status,
        date: (o.invoiced_at ?? o.updated_at).toISOString(),
        service_base: base,
        total_amount: Number(o.total_amount),
        person_id: pid ?? null,
        person_name: p?.name ?? null,
        rule_type: type,
        rule_value: value,
        overridden: override,
        commission: pid ? commissionOf(type, value, base) : 0,
        paid_at: paidAt ? paidAt.toISOString() : null,
      };
    });

    res.json({ role, rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao listar comissões de serviços" });
  }
}

// Ajusta a comissão de UMA O.S. (type/value; type=null volta para a regra padrão) e/ou vincula quem executou/vendeu.
export async function updateServiceOrderCommission(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const id = Number(req.params.id);
    const role = parseRole(req.body.role);
    if (!role) { res.status(400).json({ error: "role inválido" }); return; }
    const order = await prisma.serviceOrder.findFirst({ where: { id, tenant_id: tenantId }, select: { id: true } });
    if (!order) { res.status(404).json({ error: "O.S. não encontrada" }); return; }

    const data: Record<string, unknown> = {};
    if (req.body.person_id !== undefined) {
      const pid = req.body.person_id ? Number(req.body.person_id) : null;
      if (pid) {
        const exists = role === "technician"
          ? await prisma.technician.findFirst({ where: { id: pid, tenant_id: tenantId }, select: { id: true } })
          : await prisma.seller.findFirst({ where: { id: pid, tenant_id: tenantId }, select: { id: true } });
        if (!exists) { res.status(422).json({ error: "Pessoa não encontrada" }); return; }
      }
      data[role === "technician" ? "technician_id" : "seller_id"] = pid;
      if (role === "technician") data.technician_name = null;
    }
    if (req.body.type !== undefined) {
      if (req.body.type === null) {
        data[`commission_${role}_type`] = null;
        data[`commission_${role}_value`] = null;
      } else {
        const type = req.body.type === "fixed" ? "fixed" : "percent";
        const value = Math.max(0, Number(req.body.value) || 0);
        if (type === "percent" && value > 100) { res.status(422).json({ error: "Percentual não pode passar de 100%" }); return; }
        data[`commission_${role}_type`] = type;
        data[`commission_${role}_value`] = value;
      }
    }
    await prisma.serviceOrder.update({ where: { id }, data });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao atualizar comissão" });
  }
}

// Marca como paga (ou desfaz) a comissão de várias O.S. de uma vez.
export async function payServiceCommissions(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const role = parseRole(req.body.role);
    const ids: number[] = Array.isArray(req.body.ids) ? req.body.ids.map(Number).filter(Boolean) : [];
    if (!role || ids.length === 0) { res.status(400).json({ error: "role e ids são obrigatórios" }); return; }
    const paid = req.body.paid !== false;
    const field = role === "technician" ? "technician_commission_paid_at" : "seller_commission_paid_at";
    const r = await prisma.serviceOrder.updateMany({
      where: { id: { in: ids }, tenant_id: tenantId },
      data: { [field]: paid ? new Date() : null },
    });
    res.json({ success: true, updated: r.count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao registrar pagamento" });
  }
}
