import type { Request, Response } from "express";

import { prisma } from "../config/prisma";
import { localDateString } from "../utils/date";
import type { AuthenticatedRequest } from "../types/auth";

function getTenantId(req: Request) {
  return (req as AuthenticatedRequest).user.tenantId;
}

export async function listFinanceEntries(req: Request, res: Response) {
  try {
    const entries = await prisma.finance.findMany({
      where: { tenant_id: getTenantId(req) },
      orderBy: { date: "desc" },
    });

    res.json(entries);
  } catch {
    res.status(500).json({ error: "Failed to fetch finance entries" });
  }
}

function parseDateField(raw: unknown): Date | undefined {
  if (!raw) return undefined;
  const s = String(raw).substring(0, 10);
  return new Date(s + "T00:00:00Z");
}

// Parses "credit-visa-2x:120.00|money:30.00" into structured segments
function parsePaymentMethod(pm: string) {
  return pm.split("|").map((seg) => {
    const [methodPart, amountStr] = seg.split(":");
    const tokens = methodPart.split("-");
    return {
      method:       tokens[0] ?? "money",
      brand:        tokens[1] ?? "other",
      installments: tokens[2] ? parseInt(tokens[2].replace("x", ""), 10) : 1,
      amount:       parseFloat(amountStr ?? "0") || 0,
    };
  });
}

// Recalcula a taxa da maquininha sobre o valor PAGO (gross - desconto),
// usando as taxas atuais do tenant. Dinheiro = sem taxa.
function computeMachineFee(pm: string, gross: number, discount: number, cardFees: Record<string, number[]>): number {
  const factor = gross > 0 ? Math.max(0, (gross - discount) / gross) : 1;
  const rateForSeg = (seg: ReturnType<typeof parsePaymentMethod>[number]): number => {
    if (seg.method === "credit") return cardFees[seg.brand]?.[seg.installments - 1] ?? 0;
    if (seg.method === "debit")  return cardFees[`debit_${seg.brand}`]?.[0] ?? 0;
    if (seg.method === "pix")    return cardFees["pix"]?.[0] ?? 0;
    return 0; // dinheiro e outros: sem taxa
  };
  const segs = parsePaymentMethod(pm);
  // base de cada segmento: usa o amount embutido se houver; senão rateia o gross
  const totalSegAmount = segs.reduce((s, x) => s + x.amount, 0);
  const fee = segs.reduce((sum, seg) => {
    const rawBase = seg.amount > 0 ? seg.amount : (totalSegAmount <= 0 ? gross : 0);
    return sum + rawBase * factor * (rateForSeg(seg) / 100);
  }, 0);
  return Math.round(fee * 100) / 100;
}

export async function createFinanceEntry(req: Request, res: Response) {
  try {
    const { date, ...rest } = req.body;
    const entry = await prisma.finance.create({
      data: {
        ...rest,
        tenant_id: getTenantId(req),
        date: parseDateField(date) ?? localDateString(),
      },
    });

    res.json({ id: entry.id });
  } catch (err) {
    console.error("[createFinanceEntry]", err);
    res.status(500).json({ error: "Failed to create finance entry" });
  }
}

export async function updateFinanceEntry(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const { id } = req.params;
    const existing = await prisma.finance.findFirst({ where: { id: Number(id), tenant_id: tenantId } });
    if (!existing) return res.status(404).json({ error: "Not found" });

    const { tenant_id, id: _id, created_at, updated_at, date, ...rest } = req.body;

    // É uma venda PDV? (descrição referencia #N) — se for, recalculamos a taxa
    // da maquininha conforme a forma de pagamento final, sobre o valor com desconto.
    const description: string = rest.description ?? existing.description ?? "";
    const orderMatch = description.match(/PDV\s*#(\d+)/i);

    // Valores finais (do edit ou do que já existia)
    const finalPm       = (rest.payment_method ?? existing.payment_method ?? "money") as string;
    const finalGross    = rest.gross_amount    != null ? Number(rest.gross_amount)
                        : existing.gross_amount != null ? Number(existing.gross_amount)
                        : Number(rest.amount ?? existing.amount);
    const finalDiscount = rest.discount_amount != null ? Number(rest.discount_amount)
                        : existing.discount_amount != null ? Number(existing.discount_amount) : 0;

    let recalculated: { fee: number; net: number } | null = null;
    if (orderMatch) {
      const tenantData = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { card_fees: true } });
      const cardFees = (tenantData?.card_fees ?? {}) as Record<string, number[]>;
      const fee = computeMachineFee(finalPm, finalGross, finalDiscount, cardFees);
      const net = Math.round((finalGross - finalDiscount - fee) * 100) / 100;
      recalculated = { fee, net };
    }

    await prisma.finance.update({
      where: { id: Number(id) },
      data: {
        ...rest,
        ...(recalculated ? { fee_amount: recalculated.fee > 0 ? recalculated.fee : null, amount: recalculated.net } : {}),
        ...(date ? { date: parseDateField(date) } : {}),
      },
    });

    // Sync back to the linked order
    if (orderMatch) {
      const orderId = Number(orderMatch[1]);
      const order = await prisma.order.findFirst({ where: { id: orderId, tenant_id: tenantId } });
      if (order) {
        const newDiscount = rest.discount_amount != null ? Number(rest.discount_amount) : undefined;
        const newGross    = rest.gross_amount    != null ? Number(rest.gross_amount)    : undefined;
        const newPm: string | undefined = rest.payment_method ?? undefined;

        await prisma.order.update({
          where: { id: orderId },
          data: {
            ...(recalculated ? {
              total_amount: recalculated.net,
              fee_amount:   recalculated.fee > 0 ? recalculated.fee : null,
            } : {}),
            ...(newGross    != null ? { gross_amount:    newGross    } : {}),
            ...(newDiscount != null ? { discount_amount: newDiscount } : {}),
            ...(newPm               ? { payment_method:  newPm       } : {}),
          },
        });
      }
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("[updateFinanceEntry]", err);
    res.status(500).json({ error: "Failed to update finance entry" });
  }
}

export async function deleteFinanceEntry(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const { id } = req.params;
    const existing = await prisma.finance.findFirst({ where: { id: Number(id), tenant_id: tenantId } });
    if (!existing) return res.status(404).json({ error: "Not found" });

    await prisma.finance.delete({ where: { id: Number(id) } });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to delete finance entry" });
  }
}

export async function deleteManyFinanceEntries(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const { ids } = req.body as { ids: number[] };
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: "ids required" });

    await prisma.finance.deleteMany({ where: { id: { in: ids }, tenant_id: tenantId } });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to delete finance entries" });
  }
}
