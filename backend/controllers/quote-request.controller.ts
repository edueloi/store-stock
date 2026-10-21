import type { Request, Response } from "express";
import { prisma } from "../config/prisma";
import { getTenantAccessState } from "../utils/tenant-access";
import { emitToTenant } from "../services/realtime.service";
import { saveGlassQuote, GlassQuoteError } from "../services/glass-quote.service";

async function findStore(slug: string) {
  const tenant = await prisma.tenant.findFirst({ where: { OR: [{ slug }, { subdomain: slug }] }, include: { platform_subscription: true } });
  return tenant && getTenantAccessState(tenant as any).allowed ? tenant : null;
}
export async function getQuoteRequestCatalog(req: Request, res: Response) {
  res.setHeader("Cache-Control", "no-store");
  try {
    const tenant = await findStore(String(req.params.slug || ""));
    if (!tenant || (tenant.policies as any)?.storefront?.glass_quote_enabled !== true) return res.status(404).json({ error: "Orçamento online não habilitado nesta loja." });
    const [products, services] = await Promise.all([
      prisma.product.findMany({ where: { tenant_id: tenant.id, is_active: true, type: "sale", sale_unit: { in: ["unidade", "m2", "linear"] } }, select: { id: true, name: true, description: true, price: true, discount_price: true, price_per_measure: true, min_billable_quantity: true, sale_unit: true, measure_unit: true, image_url: true, images: true, attributes: true, variations: true, hide_price_on_site: true, category_id: true, storefront_details: true }, orderBy: { name: "asc" } }),
      prisma.service.findMany({ where: { tenant_id: tenant.id, is_active: true, sale_unit: { in: ["unidade", "m2", "linear"] } }, select: { id: true, name: true, description: true, price: true, price_per_measure: true, min_billable_quantity: true, sale_unit: true, image_url: true }, orderBy: { name: "asc" } }),
    ]);
    const sf = (tenant.policies as any)?.storefront || {};
    const hidden = sf.hide_prices === true || sf.checkout_mode === "order_request";
    const publicItem = (item: any) => {
      const hide = hidden || item.hide_price_on_site === true;
      return { ...item, price: hide ? null : Number(item.price), discount_price: hide || item.discount_price == null ? null : Number(item.discount_price), price_per_measure: hide || item.price_per_measure == null ? null : Number(item.price_per_measure), min_billable_quantity: item.min_billable_quantity == null ? null : Number(item.min_billable_quantity), price_hidden: hide };
    };
    res.json({ store_name: tenant.name, products: products.map(publicItem), services: services.map(publicItem) });
  } catch (error) {
    console.error("Falha ao carregar catálogo de projetos", { code: (error as any)?.code });
    res.status(500).json({ error: "Não foi possível carregar o catálogo. Tente novamente." });
  }
}
const requests = new Map<string, { count: number; until: number }>();
export async function createQuoteRequest(req: Request, res: Response) {
  res.setHeader("Cache-Control", "no-store");
  try {
    const key = `${req.ip}:${req.params.slug}`, now = Date.now(), entry = requests.get(key);
    if (entry && entry.until > now && entry.count >= 8) return res.status(429).json({ error: "Muitas solicitações. Tente novamente em alguns minutos." });
    if (!entry || entry.until <= now) {
      if (requests.size >= 5000) requests.delete(requests.keys().next().value!);
      requests.set(key, { count: 1, until: now + 10 * 60_000 });
    } else entry.count++;
    const tenant = await findStore(String(req.params.slug || ""));
    if (!tenant || (tenant.policies as any)?.storefront?.glass_quote_enabled !== true) return res.status(404).json({ error: "Orçamento online não habilitado nesta loja." });
    const result = await saveGlassQuote(tenant.id, req.body);
    if (!result.duplicate) emitToTenant(tenant.id, "quote:requested", { quoteId: result.id });
    res.status(result.duplicate ? 200 : 201).json({ number: result.number, total: result.total });
  } catch (error) {
    if (error instanceof GlassQuoteError) return res.status(error.status).json({ error: error.message });
    console.error("Falha ao solicitar orçamento", { code: (error as any)?.code });
    res.status(500).json({ error: "Não foi possível enviar a solicitação. Suas peças continuam salvas; tente novamente." });
  }
}
