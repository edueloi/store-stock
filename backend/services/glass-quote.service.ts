import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";
import { glassOptions, glassPrice, glassMeasurements } from "../../shared/glassCatalog";
import { PIECE_KINDS, pieceAreaM2, pieceLabel, pieceSummary, sanitizePieceSpec } from "../utils/glassPieces";

export class GlassQuoteError extends Error { constructor(message: string, public status = 422) { super(message); } }
export function prepareGlassQuote(body: any, products: any[], services: any[], hidePrices = false) {
  const text = (v: unknown, max: number) => typeof v === "string" ? v.trim().slice(0, max) : "";
  const name = text(body?.customer?.name, 120), phone = text(body?.customer?.phone, 30), email = text(body?.customer?.email, 120).toLowerCase();
  if (name.length < 2 || !/^\d{10,13}$/.test(phone.replace(/\D/g, ""))) throw new GlassQuoteError("Informe seu nome e um WhatsApp com DDD.");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new GlassQuoteError("Confira o e-mail informado.");
  if (!Array.isArray(body.pieces) || !body.pieces.length || body.pieces.length > 30) throw new GlassQuoteError("Adicione de 1 a 30 peças ao orçamento.");
  const items: any[] = [], serviceRows: any[] = [];
  let publicTotal = true;
  for (const piece of body.pieces) {
    const productId = Number(piece?.product_id), serviceId = Number(piece?.service_id);
    if ((!!productId === !!serviceId) || (productId && !Number.isInteger(productId)) || (serviceId && !Number.isInteger(serviceId))) throw new GlassQuoteError("Escolha um produto ou serviço do catálogo para cada peça.");
    const isProduct = !!productId;
    const item = (isProduct ? products : services).find(p => p.id === (productId || serviceId));
    let spec = sanitizePieceSpec(piece?.spec);
    const quantity = Number(piece?.quantity ?? 1);
    const settings = item ? glassMeasurements(item) : { enabled: false, allowLater: false, kind: "fixo" };
    const later = settings.enabled && piece?.measure_later === true && settings.allowLater;
    if (!item || (settings.enabled && !spec && !later) || !Number.isInteger(quantity) || quantity < 1 || quantity > 99) throw new GlassQuoteError("Confira o produto, as medidas (50 a 10.000 mm) e a quantidade de cada peça.");
    if (!settings.enabled) spec = null;
    else if (spec && isProduct) spec.kind = PIECE_KINDS.find(k => k.value === settings.kind)?.value || "fixo";
    const options: Record<string, string> = {};
    const supplied = piece.selected_options || {};
    if (typeof supplied !== "object" || Array.isArray(supplied)) throw new GlassQuoteError("Confira as opções do produto.");
    for (const group of glassOptions(item)) {
      const selected = supplied[group.name];
      if (typeof selected !== "string" || !group.values.includes(selected)) throw new GlassQuoteError(`Selecione ${group.name} em ${item.name}.`);
      options[group.name] = selected;
    }
    // As opções vêm exclusivamente do catálogo. O desenho não cria acabamentos ou preços extras.
    if (spec && isProduct) { delete spec.glass; delete spec.finish; delete spec.thickness_mm; }
    const price = glassPrice(item, spec?.width_mm || 0, spec?.height_mm || 0, quantity);
    if (!spec && item.sale_unit !== "unidade") { price.unitPrice = 0; price.total = 0; price.known = false; }
    if (hidePrices || !price.known) publicTotal = false;
    const dimensions = !settings.enabled ? null : later ? "Medidas a conferir com a loja" : `${pieceSummary(spec!)} · ${pieceAreaM2(spec!).toLocaleString("pt-BR", { maximumFractionDigits: 4 })} m²${price.minimumApplied ? ` · mínimo faturável: ${price.billed} ${price.measure}` : ""}`;
    const row = { name: item.name, unit_price: price.unitPrice, quantity, total: price.total, dimensions_label: dimensions };
    if (!Number.isFinite(price.total) || price.total > 99999999.99 || price.unitPrice > 99999999.99) throw new GlassQuoteError("O valor desta peça excede o limite. Confira as medidas ou consulte a loja.");
    const pieceNotes = text(piece.selected_options?.["Observações da peça"] || spec?.notes, 300);
    if (isProduct) items.push({ ...row, product_id: item.id, selected_options: { ...options, ...(!later && spec ? { "Modelo da peça": pieceLabel(spec.kind), "Largura (mm)": String(spec.width_mm), "Altura (mm)": String(spec.height_mm), ...(spec.leaves ? { "Folhas": String(spec.leaves) } : {}) } : {}), ...(pieceNotes ? { "Observações da peça": pieceNotes } : {}) } });
    else serviceRows.push({ ...row, service_id: item.id, piece_spec: spec || undefined, dimensions_label: pieceNotes ? [dimensions, pieceNotes].filter(Boolean).join(" · ") : dimensions });
  }
  const total = Math.round([...items, ...serviceRows].reduce((sum, r) => sum + r.total, 0) * 100) / 100;
  if (total > 99999999.99) throw new GlassQuoteError("O valor do projeto excede o limite. Envie em solicitações separadas ou consulte a loja.");
  const notes = ["Solicitação de projeto pela vitrine. Medidas informadas pelo cliente, sujeitas à conferência técnica.", text(body.customer?.address, 350) && `Local do projeto: ${text(body.customer.address, 350)}`, body.installation === true && "Cliente solicita instalação / visita para conferência das medidas.", text(body.notes, 1000)].filter(Boolean).join("\n");
  return { name, phone, email, items, services: serviceRows, total, publicTotal, notes };
}

/** Lock por loja evita colisão na numeração e duplicação em tentativas de reenvio. */
export async function saveGlassQuote(tenantId: number, body: any, database = prisma) {
  const requestId = body?.request_id == null ? crypto.randomUUID() : String(body.request_id);
  if (!/^[a-zA-Z0-9-]{16,80}$/.test(requestId)) throw new GlassQuoteError("Atualize a página e tente enviar novamente.");
  const signature = crypto.createHash("sha256").update(JSON.stringify({ customer: body.customer, pieces: body.pieces, notes: body.notes, installation: body.installation })).digest("hex");
  const write = () => database.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM tenants WHERE id = ${tenantId} FOR UPDATE`;
    const previous = await tx.quoteAction.findFirst({ where: { tenant_id: tenantId, action: "solicitado_vitrine", meta: { path: "$.request_id", equals: requestId } }, include: { quote: true } });
    if (previous) {
      const meta = previous.meta as any;
      if (meta.signature !== signature) throw new GlassQuoteError("Esta solicitação já foi enviada. Inicie um novo projeto para alterar as peças.", 409);
      return { number: previous.quote.number, total: meta.public_total ? Number(previous.quote.total_amount) : null, duplicate: true, id: previous.quote.id };
    }
    const tenant = await tx.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { policies: true } });
    const sf = (tenant.policies as any)?.storefront || {};
    if (sf.glass_quote_enabled !== true) throw new GlassQuoteError("Orçamento online não habilitado nesta loja.", 404);
    const pieces = Array.isArray(body?.pieces) ? body.pieces : [];
    const ids = (key: string) => pieces.map((p: any) => Number(p?.[key])).filter(Number.isInteger);
    const [products, services] = await Promise.all([
      tx.product.findMany({ where: { tenant_id: tenantId, is_active: true, type: "sale", sale_unit: { in: ["unidade", "m2", "linear"] }, id: { in: ids("product_id") } } }),
      tx.service.findMany({ where: { tenant_id: tenantId, is_active: true, sale_unit: { in: ["unidade", "m2", "linear"] }, id: { in: ids("service_id") } } }),
    ]);
    const data = prepareGlassQuote(body, products, services, sf.hide_prices === true || sf.checkout_mode === "order_request");
    const last = await tx.quote.findFirst({ where: { tenant_id: tenantId }, orderBy: { number: "desc" }, select: { number: true } });
    const quote = await tx.quote.create({ data: { tenant_id: tenantId, number: (last?.number || 0) + 1, customer_name: data.name, customer_phone: data.phone, customer_email: data.email || null, subtotal: data.total, total_amount: data.total, notes: data.notes, status: "rascunho", source: "vitrine", items: { create: data.items }, services: { create: data.services } } });
    await tx.quoteAction.create({ data: { tenant_id: tenantId, quote_id: quote.id, action: "solicitado_vitrine", actor: data.name, note: "Projeto solicitado pelo catálogo da loja online", meta: { request_id: requestId, signature, public_total: data.publicTotal } as Prisma.InputJsonValue } });
    return { number: quote.number, total: data.publicTotal ? data.total : null, duplicate: false, id: quote.id };
  });
  for (let attempt = 0; ; attempt++) {
    try { return await write(); } catch (error) { if ((error as any)?.code !== "P2002" || attempt >= 2) throw error; }
  }
}
