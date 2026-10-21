import type { Request, Response } from "express";

import { prisma } from "../config/prisma";
import { getTenantAccessState } from "../utils/tenant-access";
import { pieceAreaM2, pieceSummary, sanitizePieceSpec } from "../utils/glassPieces";
import { emitToTenant } from "../services/realtime.service";

// Solicitação de orçamento feita pelo cliente na vitrine (vidraçaria): ele monta as peças
// com medidas e o desenho, o preço estimado é calculado aqui (nunca confia no cliente) e
// o orçamento nasce como rascunho com source = "vitrine" para a loja revisar e enviar.

async function findStore(slug: string) {
  const tenant = await prisma.tenant.findFirst({
    where: { OR: [{ slug }, { subdomain: slug }] },
    include: { platform_subscription: true },
  });
  if (!tenant || !getTenantAccessState(tenant as any).allowed) return null;
  return tenant;
}

export async function getQuoteRequestCatalog(req: Request, res: Response) {
  try {
    const tenant = await findStore(String(req.params.slug || ""));
    if (!tenant) return res.status(404).json({ error: "Loja não encontrada." });
    const services = await prisma.service.findMany({
      where: { tenant_id: tenant.id, is_active: true, sale_unit: "m2" },
      select: { id: true, name: true, description: true, price_per_measure: true, min_billable_quantity: true, image_url: true },
      orderBy: { name: "asc" },
    });
    res.json({
      store_name: tenant.name,
      services: services.map((s) => ({
        ...s,
        price_per_measure: Number(s.price_per_measure ?? 0),
        min_billable_quantity: s.min_billable_quantity == null ? null : Number(s.min_billable_quantity),
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao carregar serviços." });
  }
}

const requests = new Map<string, { count: number; until: number }>();

export async function createQuoteRequest(req: Request, res: Response) {
  try {
    const key = `${req.ip}:${req.params.slug}`, now = Date.now(), entry = requests.get(key);
    if (entry && entry.until > now && entry.count >= 8) return res.status(429).json({ error: "Muitas solicitações. Tente novamente em alguns minutos." });
    if (!entry || entry.until <= now) {
      if (requests.size >= 5000) requests.delete(requests.keys().next().value!);
      requests.set(key, { count: 1, until: now + 10 * 60_000 });
    } else entry.count++;

    const tenant = await findStore(String(req.params.slug || ""));
    if (!tenant) return res.status(404).json({ error: "Loja não encontrada." });

    const { customer, pieces, notes } = req.body as {
      customer?: { name?: string; phone?: string; email?: string };
      pieces?: Array<{ service_id: number; quantity?: number; spec?: unknown }>;
      notes?: string;
    };
    const name = String(customer?.name || "").trim().slice(0, 120);
    const phone = String(customer?.phone || "").trim().slice(0, 30);
    const email = String(customer?.email || "").trim().toLowerCase().slice(0, 120);
    if (!name || phone.replace(/\D/g, "").length < 10) return res.status(422).json({ error: "Informe seu nome e um WhatsApp com DDD." });
    if (email && !/^\S+@\S+\.\S+$/.test(email)) return res.status(422).json({ error: "Informe um e-mail válido ou deixe em branco." });
    if (!Array.isArray(pieces) || pieces.length === 0 || pieces.length > 30) return res.status(422).json({ error: "Adicione ao menos uma peça ao orçamento." });

    const serviceIds = [...new Set(pieces.map((p) => Number(p.service_id)))];
    const services = await prisma.service.findMany({ where: { tenant_id: tenant.id, is_active: true, sale_unit: "m2", id: { in: serviceIds } } });
    const rows = [];
    for (const piece of pieces) {
      const service = services.find((s) => s.id === Number(piece.service_id));
      const spec = sanitizePieceSpec(piece.spec);
      if (!service || !spec) return res.status(422).json({ error: "Confira as medidas e o serviço de cada peça." });
      const quantity = Math.min(99, Math.max(1, Math.round(Number(piece.quantity) || 1)));
      const area = pieceAreaM2(spec);
      const billed = Math.max(area, Number(service.min_billable_quantity ?? 0));
      const unit = Math.round(billed * Number(service.price_per_measure ?? 0) * 100) / 100;
      rows.push({
        service_id: service.id,
        name: service.name,
        unit_price: unit,
        quantity,
        total: Math.round(unit * quantity * 100) / 100,
        dimensions_label: `${pieceSummary(spec)} · ${area.toFixed(2)}m²`,
        piece_spec: spec as any,
      });
    }
    const subtotal = rows.reduce((sum, r) => sum + r.total, 0);

    const quote = await prisma.$transaction(async (tx) => {
      const last = await tx.quote.findFirst({ where: { tenant_id: tenant.id }, orderBy: { number: "desc" }, select: { number: true } });
      const created = await tx.quote.create({
        data: {
          tenant_id: tenant.id,
          number: (last?.number ?? 0) + 1,
          customer_name: name,
          customer_phone: phone,
          customer_email: email || null,
          subtotal,
          total_amount: subtotal,
          notes: notes ? `Solicitação pela vitrine: ${String(notes).trim().slice(0, 500)}` : "Solicitação pela vitrine",
          status: "rascunho",
          source: "vitrine",
          services: { create: rows },
        },
      });
      await tx.quoteAction.create({ data: { tenant_id: tenant.id, quote_id: created.id, action: "solicitado_vitrine", actor: name, note: "Cliente solicitou orçamento pela vitrine" } });
      return created;
    });

    emitToTenant(tenant.id, "quote:requested", { quoteId: quote.id });
    res.status(201).json({ number: quote.number, total: subtotal });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Não foi possível enviar a solicitação." });
  }
}
