import crypto from "crypto";
import fs from "fs";
import path from "path";

import { Router } from "express";
import type { NextFunction, Request, Response } from "express";

import { prisma } from "../config/prisma";

// Sincronização com o grafica-system (grafica.boxsys.com.br): clientes e usuários de UMA loja (a da Artes VA).
// Rotas internas — só respondem com o token compartilhado (SYNC_TOKEN) e sempre trabalham na loja fixada em
// GRAFICA_SYNC_TENANT_ID. Sem essas duas variáveis de ambiente, a integração fica desligada (404).
// Quem decide o que mudou é o grafica (compara o conteúdo dos dois lados); aqui só se lê e se grava.

const router = Router();

function gate(req: Request, res: Response, next: NextFunction) {
  const token = process.env.SYNC_TOKEN ?? "";
  const tenantId = Number(process.env.GRAFICA_SYNC_TENANT_ID);
  if (token.length < 24 || !Number.isInteger(tenantId) || tenantId <= 0) return res.status(404).json({ error: "Not found" });
  const sent = Buffer.from(String(req.headers["x-sync-token"] ?? ""));
  const want = Buffer.from(token);
  if (sent.length !== want.length || !crypto.timingSafeEqual(sent, want)) return res.status(401).json({ error: "Não autorizado" });
  (req as any).syncTenantId = tenantId;
  next();
}
router.use(gate);

const tid = (req: Request): number => (req as any).syncTenantId;
const text = (v: unknown, max = 255): string => String(v ?? "").trim().slice(0, max);
const digits = (v: unknown): string => String(v ?? "").replace(/\D/g, "");
// telefone "nacional": só dígitos e sem o 55 do país (o grafica guarda com 55)
const phoneNat = (v: unknown): string => { const d = digits(v); return d.length > 11 && d.startsWith("55") ? d.slice(2) : d; };

/** Campos que os dois sistemas compartilham, já normalizados (o grafica faz a mesma normalização do lado dele). */
function commonOf(c: any) {
  return {
    name: text(c.name, 160), email: text(c.email, 160).toLowerCase(), phone: phoneNat(c.phone), document: digits(c.document),
    street: text(c.address_street, 200), number: text(c.address_number, 20), district: text(c.address_district, 100), city: text(c.address_city, 100),
    state: text(c.address_state, 2).toUpperCase(), zip: digits(c.address_zip), notes: text(c.notes, 5000), active: c.status !== "inactive",
    complement: text(c.address_complement, 100), company: text(c.trade_name || c.legal_name, 160), contactName: text(c.contact_name, 160),
    stateRegistration: text(c.state_registration, 30), personType: c.person_type === "legal" ? "legal" : "physical",
    birthDate: c.birth_date ? new Date(c.birth_date).toISOString().slice(0, 10) : "", website: text(c.website, 200),
  };
}
type Common = ReturnType<typeof commonOf>;

router.get("/customers", async (req, res) => {
  try {
    const rows = await prisma.customer.findMany({ where: { tenant_id: tid(req) }, orderBy: { id: "asc" } });
    res.json({
      customers: rows.map((c) => ({
        id: c.id, fields: commonOf(c), company: text(c.trade_name || c.legal_name, 160),
      })),
    });
  } catch (e) { console.error("internal-sync GET customers:", e); res.status(500).json({ error: "Falha ao listar clientes." }); }
});

/** Cria (sem id) ou atualiza (com id) um cliente a partir dos campos comuns. Só grava o que realmente mudou. */
router.post("/customers", async (req, res) => {
  try {
    const f = (req.body?.fields ?? {}) as Partial<Common>;
    const id = Number(req.body?.id) || null;
    const tenantId = tid(req);
    const data: Record<string, unknown> = {};
    const map: [keyof Common, string, (v: any) => unknown][] = [
      ["name", "name", (v) => text(v, 160)], ["email", "email", (v) => text(v, 160).toLowerCase() || null], ["phone", "phone", (v) => phoneNat(v) || null],
      ["document", "document", (v) => digits(v) || null], ["street", "address_street", (v) => text(v, 200) || null], ["number", "address_number", (v) => text(v, 20) || null],
      ["district", "address_district", (v) => text(v, 100) || null], ["city", "address_city", (v) => text(v, 100) || null],
      ["state", "address_state", (v) => text(v, 2).toUpperCase() || null], ["zip", "address_zip", (v) => digits(v) || null],
      ["notes", "notes", (v) => text(v, 5000) || null], ["active", "status", (v) => (v === false ? "inactive" : "active")],
      ["complement", "address_complement", (v) => text(v, 100) || null], ["company", "trade_name", (v) => text(v, 160) || null],
      ["contactName", "contact_name", (v) => text(v, 160) || null], ["stateRegistration", "state_registration", (v) => text(v, 30) || null],
      ["personType", "person_type", (v) => (v === "legal" ? "legal" : "physical")], ["website", "website", (v) => text(v, 200) || null],
      ["birthDate", "birth_date", (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v ?? "")) ? new Date(`${v}T12:00:00.000Z`) : null)],
    ];
    if (id) {
      const cur = await prisma.customer.findFirst({ where: { id, tenant_id: tenantId } });
      if (!cur) return res.status(404).json({ error: "Cliente não encontrado." });
      const now = commonOf(cur);
      for (const [k, col, conv] of map) {
        if (!(k in f)) continue;
        const next = commonOf({ ...cur, [col]: conv((f as any)[k]) })[k];
        if (next !== now[k]) data[col] = conv((f as any)[k]);
      }
      const updated = Object.keys(data).length ? await prisma.customer.update({ where: { id }, data }) : cur;
      return res.json({ id: updated.id, fields: commonOf(updated) });
    }
    if (!text(f.name)) return res.status(422).json({ error: "Informe o nome." });
    for (const [k, col, conv] of map) if (k in f) data[col] = conv((f as any)[k]);
    const created = await prisma.customer.create({ data: { ...(data as any), tenant_id: tenantId } });
    res.status(201).json({ id: created.id, fields: commonOf(created) });
  } catch (e) { console.error("internal-sync POST customers:", e); res.status(500).json({ error: "Falha ao gravar o cliente." }); }
});

// ── Produtos ────────────────────────────────────────────────────────────────
// O grafica traz o catálogo da loja e também manda para cá os produtos da empresa (inclusive os brindes da XBZ). O custo é
// interno e o preço de venda é o que a empresa define: produto sem preço de venda fica inativo (nunca vende a R$ 0).
const money = (v: unknown) => (v == null || v === "" ? "" : Number(v).toFixed(2));
function productOut(p: any, catName: Map<number, string>) {
  const imgs = [...new Set([p.image_url, ...(Array.isArray(p.images) ? (p.images as unknown[]).map((i) => (typeof i === "string" ? i : (i as { url?: string })?.url)) : [])].map((u) => text(u, 500)).filter(Boolean))].slice(0, 10);
  return {
    id: p.id,
    fields: {
      name: text(p.name, 160), description: text(p.description, 5000), category: text(p.category_id ? catName.get(p.category_id) : "", 80),
      price: money(p.price), costPrice: money(p.cost_price), offerPrice: Number(p.discount_price) > 0 ? money(p.discount_price) : "", active: !!p.is_active,
    },
    imageUrls: imgs,
  };
}
async function categoryNames(tenantId: number) {
  const cats = await prisma.category.findMany({ where: { tenant_id: tenantId }, select: { id: true, name: true } });
  return new Map(cats.map((c) => [c.id, c.name]));
}

router.get("/products", async (req, res) => {
  try {
    const tenantId = tid(req);
    const [rows, names] = await Promise.all([prisma.product.findMany({ where: { tenant_id: tenantId }, orderBy: { id: "asc" } }), categoryNames(tenantId)]);
    res.json({ products: rows.map((p) => productOut(p, names)) });
  } catch (e) { console.error("internal-sync GET products:", e); res.status(500).json({ error: "Falha ao listar produtos." }); }
});

// Fotos que vêm do grafica: só do endereço dele (GRAFICA_SYNC_ORIGIN) e só das rotas públicas de imagem.
async function pullImages(tenantId: number, urls: unknown, current: { image_url: string | null; images: unknown }) {
  const origin = process.env.GRAFICA_SYNC_ORIGIN || "http://127.0.0.1:3300";
  const list: string[] = Array.isArray(current.images) ? (current.images as unknown[]).filter((x): x is string => typeof x === "string") : [];
  const dir = path.join(process.cwd(), "public", "uploads", "products", String(tenantId));
  let changed = false;
  for (const raw of (Array.isArray(urls) ? urls : []).slice(0, 10)) {
    try {
      const u = new URL(String(raw));
      if (u.origin !== origin || !u.pathname.startsWith("/api/site/images/")) continue;
      const id = u.pathname.split("/").pop()!.replace(/[^a-zA-Z0-9-]/g, "");
      const rel = `/uploads/products/${tenantId}/sync-${id}.webp`;
      if (list.includes(rel)) continue;
      const r = await fetch(u, { signal: AbortSignal.timeout(20_000), redirect: "error" });
      const buf = Buffer.from(await r.arrayBuffer());
      if (!r.ok || buf.length === 0 || buf.length > 8 * 1024 * 1024 || !(r.headers.get("content-type") ?? "").startsWith("image/")) continue;
      await fs.promises.mkdir(dir, { recursive: true });
      await fs.promises.writeFile(path.join(dir, `sync-${id}.webp`), buf);
      list.push(rel); changed = true;
    } catch { /* foto indisponível: segue sem */ }
  }
  return changed ? { images: list, image_url: current.image_url || list[0] || null } : {};
}

/** Cria (sem id) ou atualiza (com id) um produto. Só grava o que mudou; categoria nova é criada na hora. */
router.post("/products", async (req, res) => {
  try {
    const tenantId = tid(req);
    const f = (req.body?.fields ?? {}) as Record<string, any>;
    const id = Number(req.body?.id) || null;
    const data: Record<string, any> = {};
    if ("name" in f && text(f.name, 160)) data.name = text(f.name, 160);
    if ("description" in f) data.description = text(f.description, 5000) || null;
    if ("price" in f) { const n = Number(f.price); if (Number.isFinite(n) && n >= 0) data.price = n.toFixed(2); }
    if ("costPrice" in f) { const n = Number(f.costPrice); data.cost_price = Number.isFinite(n) && n >= 0 ? n.toFixed(2) : "0.00"; }
    if ("offerPrice" in f) { const n = Number(f.offerPrice); data.discount_price = Number.isFinite(n) && n > 0 ? n.toFixed(2) : null; }
    if ("active" in f) data.is_active = f.active === true;
    if ("category" in f) {
      const name = text(f.category, 80);
      if (!name) data.category_id = null;
      else {
        const cat = (await prisma.category.findFirst({ where: { tenant_id: tenantId, name } })) ?? (await prisma.category.create({ data: { tenant_id: tenantId, name } }));
        data.category_id = cat.id;
      }
    }
    let saved;
    if (id) {
      const cur = await prisma.product.findFirst({ where: { id, tenant_id: tenantId } });
      if (!cur) return res.status(404).json({ error: "Produto não encontrado." });
      const img = await pullImages(tenantId, req.body?.imageUrls, cur);
      saved = Object.keys(data).length || Object.keys(img).length ? await prisma.product.update({ where: { id }, data: { ...data, ...img } }) : cur;
    } else {
      if (!data.name) return res.status(422).json({ error: "Informe o nome." });
      // produto da gráfica é feito sob encomenda: vende sem estoque e não entra nos alertas de esgotado
      const created = await prisma.product.create({ data: { price: "0.00", is_active: false, track_stock: false, ...data, tenant_id: tenantId } as any });
      const img = await pullImages(tenantId, req.body?.imageUrls, created);
      saved = Object.keys(img).length ? await prisma.product.update({ where: { id: created.id }, data: img }) : created;
    }
    res.status(id ? 200 : 201).json(productOut(saved, await categoryNames(tenantId)));
  } catch (e) { console.error("internal-sync POST products:", e); res.status(500).json({ error: "Falha ao gravar o produto." }); }
});

router.get("/users", async (req, res) => {
  try {
    const rows = await prisma.user.findMany({ where: { tenant_id: tid(req) }, select: { id: true, email: true, name: true, phone: true, password: true } });
    res.json({ users: rows.map((u) => ({ id: u.id, email: u.email.toLowerCase(), name: text(u.name, 120), phone: phoneNat(u.phone), passwordHash: u.password })) });
  } catch (e) { console.error("internal-sync GET users:", e); res.status(500).json({ error: "Falha ao listar usuários." }); }
});

/** Atualiza um usuário JÁ existente (casado pelo e-mail). Não cria usuários nem mexe em perfil/permissões. */
router.post("/users", async (req, res) => {
  try {
    const email = text(req.body?.email, 160).toLowerCase();
    const cur = email ? await prisma.user.findFirst({ where: { email, tenant_id: tid(req) } }) : null;
    if (!cur) return res.status(404).json({ error: "Usuário não encontrado." });
    const data: Record<string, unknown> = {};
    if (typeof req.body?.name === "string" && text(req.body.name, 120) && text(req.body.name, 120) !== cur.name) data.name = text(req.body.name, 120);
    if (typeof req.body?.phone === "string" && phoneNat(req.body.phone) !== phoneNat(cur.phone)) data.phone = phoneNat(req.body.phone) || null;
    const hash = String(req.body?.passwordHash ?? "");
    if (hash && /^\$2[aby]\$\d\d\$.{53}$/.test(hash) && hash !== cur.password) data.password = hash;
    const u = Object.keys(data).length ? await prisma.user.update({ where: { id: cur.id }, data }) : cur;
    res.json({ id: u.id, email: u.email.toLowerCase(), name: text(u.name, 120), phone: phoneNat(u.phone), passwordHash: u.password });
  } catch (e) { console.error("internal-sync POST users:", e); res.status(500).json({ error: "Falha ao gravar o usuário." }); }
});

// ── Orçamentos e Ordens de Serviço ───────────────────────────────────────────
// Orçamento ↔ orçamento do grafica; O.S. (só as que nascem de um orçamento) ↔ pedido do grafica. O grafica decide o que mudou
// (hash dos campos); aqui só se lê e se grava. Estados "aguardando aprovação"/"convertido"/"expirado" são lidos como os vizinhos
// mais próximos (enviado/aprovado/cancelado) para os dois lados falarem a mesma língua.
const Q_NORM: Record<string, string> = { aguardando_aprovacao: "orcamento_enviado", converted: "aprovado", expired: "cancelled" };
const qNorm = (v: unknown) => Q_NORM[String(v)] ?? String(v);
const Q_STATUSES = new Set(["rascunho", "orcamento_enviado", "aprovado", "cancelled"]);
const OS_STATUSES = new Set(["rascunho", "orcamento_enviado", "aguardando_aprovacao", "aprovado", "aguardando_arte", "arte_finalizada", "em_producao", "finalizado", "nota_emitida", "entregue", "cancelada"]);
const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const r2 = (n: number) => Math.round(n * 100) / 100;
const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

function quoteOut(q: any) {
  const items = [
    ...q.items.map((i: any) => ({ name: text(i.name, 300), quantity: i.quantity, unitPrice: money(i.unit_price), total: money(i.total) })),
    ...q.services.map((i: any) => ({ name: text(i.name, 300), quantity: i.quantity, unitPrice: money(i.unit_price), total: money(i.total) })),
  ];
  const sub = num(q.subtotal);
  const discount = q.discount_type === "percent" ? r2((sub * num(q.discount_value)) / 100) : Math.min(num(q.discount_value), sub);
  return { id: q.id, number: q.number, customerId: q.customer_id, hasServices: q.services.length > 0, fields: { status: qNorm(q.status), items, discount: money(discount), notes: text(q.notes, 5000) } };
}
const QUOTE_INCLUDE = { items: { orderBy: { id: "asc" as const } }, services: { orderBy: { id: "asc" as const } } };

router.get("/quotes", async (req, res) => {
  try {
    const rows = await prisma.quote.findMany({ where: { tenant_id: tid(req), customer_id: { not: null } }, include: QUOTE_INCLUDE, orderBy: { id: "asc" } });
    res.json({ quotes: rows.map(quoteOut) });
  } catch (e) { console.error("internal-sync GET quotes:", e); res.status(500).json({ error: "Falha ao listar orçamentos." }); }
});

router.post("/quotes", async (req, res) => {
  try {
    const tenantId = tid(req);
    const f = (req.body?.fields ?? {}) as { status?: string; items?: any[]; discount?: string; notes?: string };
    const id = Number(req.body?.id) || null;
    const items = (Array.isArray(f.items) ? f.items : []).slice(0, 200).map((i) => ({
      name: text(i?.name, 250) || "Item", quantity: Math.max(1, Math.round(num(i?.quantity))), unit_price: r2(num(i?.unitPrice)), total: r2(num(i?.total)),
    }));
    const status = Q_STATUSES.has(String(f.status)) ? String(f.status) : null;
    const itemsTotal = r2(items.reduce((a, i) => a + i.total, 0));

    if (id) {
      const cur = await prisma.quote.findFirst({ where: { id, tenant_id: tenantId }, include: QUOTE_INCLUDE });
      if (!cur) return res.status(404).json({ error: "Orçamento não encontrado." });
      const data: Record<string, unknown> = {};
      const qLocked = (await prisma.serviceOrder.count({ where: { quote_id: cur.id } })) > 0 || ["converted", "cancelled", "expired"].includes(cur.status);
      if (status && status !== qNorm(cur.status) && !qLocked) { data.status = status; if (status === "aprovado" && !cur.approved_at) data.approved_at = new Date(); }
      if (typeof f.notes === "string" && text(f.notes, 5000) !== text(cur.notes, 5000)) data.notes = text(f.notes, 5000) || null;
      const editable = cur.services.length === 0 && Array.isArray(f.items) && !["converted", "cancelled", "expired"].includes(cur.status);
      if (editable) {
        const same = cur.items.length === items.length && cur.items.every((c, n) => text(c.name, 250) === items[n].name && c.quantity === items[n].quantity && r2(num(c.unit_price)) === items[n].unit_price && r2(num(c.total)) === items[n].total);
        const disc = Math.min(Math.max(0, r2(num(f.discount))), itemsTotal);
        const curDisc = quoteOut(cur).fields.discount;
        if (!same || money(disc) !== curDisc) {
          await prisma.$transaction(async (tx) => {
            if (!same) { await tx.quoteItem.deleteMany({ where: { quote_id: cur.id } }); if (items.length) await tx.quoteItem.createMany({ data: items.map((i) => ({ ...i, quote_id: cur.id })) }); }
            await tx.quote.update({ where: { id: cur.id }, data: { subtotal: itemsTotal, discount_type: "fixed", discount_value: disc, total_amount: r2(itemsTotal - disc) } });
          });
        }
      }
      if (Object.keys(data).length) await prisma.quote.update({ where: { id: cur.id }, data });
      const fresh = await prisma.quote.findFirst({ where: { id: cur.id }, include: QUOTE_INCLUDE });
      return res.json(quoteOut(fresh));
    }

    const customer = await prisma.customer.findFirst({ where: { id: Number(req.body?.customerId) || 0, tenant_id: tenantId } });
    if (!customer) return res.status(422).json({ error: "Cliente não encontrado na loja." });
    const disc = Math.min(Math.max(0, r2(num(f.discount))), itemsTotal);
    let created: any = null;
    for (let attempt = 0; attempt < 4 && !created; attempt++) {
      const last = await prisma.quote.findFirst({ where: { tenant_id: tenantId }, orderBy: { number: "desc" }, select: { number: true } });
      try {
        created = await prisma.quote.create({
          data: {
            tenant_id: tenantId, number: (last?.number ?? 0) + 1, customer_id: customer.id, customer_name: text(customer.name, 160), customer_phone: customer.phone ?? null, customer_email: customer.email ?? null,
            subtotal: itemsTotal, discount_type: "fixed", discount_value: disc, total_amount: r2(itemsTotal - disc), notes: text(f.notes, 5000) || null,
            status: status ?? "rascunho", source: "grafica", ...(status === "aprovado" ? { approved_at: new Date() } : {}),
            items: { create: items },
          },
          include: QUOTE_INCLUDE,
        });
      } catch (e: any) { if (e?.code !== "P2002") throw e; }
    }
    if (!created) return res.status(409).json({ error: "Não foi possível numerar o orçamento." });
    res.status(201).json(quoteOut(created));
  } catch (e) { console.error("internal-sync POST quotes:", e); res.status(500).json({ error: "Falha ao gravar o orçamento." }); }
});

// Itens da O.S. (peças e serviços) + valor do serviço, para o grafica montar o pedido quando a O.S. nasce direto na loja (sem orçamento).
function orderItems(o: any) {
  const items = (Array.isArray(o.parts) ? o.parts : []).map((p: any) => ({ name: text(p.name, 300) || "Item", quantity: Math.max(1, Math.round(num(p.quantity))), unitPrice: money(p.unit_price), total: money(p.total) }));
  if (num(o.service_value) > 0) items.unshift({ name: text(o.service_description, 300) || "Serviço", quantity: 1, unitPrice: money(o.service_value), total: money(o.service_value) });
  return items;
}
function orderOut(o: any) {
  const items = orderItems(o);
  const total = money(o.total_amount);
  const sig = crypto.createHash("sha1").update(JSON.stringify([items, total, o.customer_id])).digest("hex").slice(0, 16);
  return { id: o.id, number: o.number, quoteId: o.quote_id, customerId: o.customer_id, fields: { status: o.status, dueDate: day(o.promised_at), notes: text(o.observations, 5000), sig }, items, total };
}
const loadOrder = (id: number) => prisma.serviceOrder.findFirst({ where: { id }, include: { parts: true } });

router.get("/orders", async (req, res) => {
  try {
    const rows = await prisma.serviceOrder.findMany({ where: { tenant_id: tid(req) }, include: { parts: true }, orderBy: { id: "asc" } });
    res.json({ orders: rows.map(orderOut) });
  } catch (e) { console.error("internal-sync GET orders:", e); res.status(500).json({ error: "Falha ao listar ordens de serviço." }); }
});

router.post("/orders", async (req, res) => {
  try {
    const tenantId = tid(req);
    const f = (req.body?.fields ?? {}) as { status?: string; dueDate?: string; notes?: string };
    const id = Number(req.body?.id) || null;
    const status = OS_STATUSES.has(String(f.status)) ? String(f.status) : null;
    const due = /^\d{4}-\d{2}-\d{2}$/.test(String(f.dueDate ?? "")) ? new Date(`${f.dueDate}T00:00:00.000Z`) : null;

    if (id) {
      const cur = await prisma.serviceOrder.findFirst({ where: { id, tenant_id: tenantId } });
      if (!cur) return res.status(404).json({ error: "Ordem de serviço não encontrada." });
      const data: Record<string, unknown> = {};
      // O.S. já faturada, entregue ou cancelada não volta de etapa por causa do grafica (o grafica passa a refletir o status daqui).
      const locked = !!cur.invoiced_order_id || ["entregue", "cancelada", "nota_emitida"].includes(cur.status);
      if (status && status !== cur.status && !locked) data.status = status;
      if ("dueDate" in f && day(due) !== day(cur.promised_at)) data.promised_at = due;
      if (typeof f.notes === "string" && text(f.notes, 5000) !== text(cur.observations, 5000)) data.observations = text(f.notes, 5000) || null;
      const updated = Object.keys(data).length ? await prisma.serviceOrder.update({ where: { id: cur.id }, data }) : cur;
      if (data.status) await prisma.serviceOrderAction.create({ data: { tenant_id: tenantId, service_order_id: cur.id, action: "status", from_status: cur.status, to_status: String(data.status), actor: "Sistema Gráfica" } });
      return res.json(orderOut(await loadOrder(updated.id)));
    }

    const quote = await prisma.quote.findFirst({ where: { id: Number(req.body?.quoteId) || 0, tenant_id: tenantId } });
    if (!quote) return res.status(422).json({ error: "Orçamento não encontrado na loja." });
    if (await prisma.serviceOrder.findFirst({ where: { quote_id: quote.id } })) return res.status(409).json({ error: "Este orçamento já tem ordem de serviço." });
    let created: any = null;
    for (let attempt = 0; attempt < 4 && !created; attempt++) {
      const last = await prisma.serviceOrder.findFirst({ where: { tenant_id: tenantId }, orderBy: { number: "desc" }, select: { number: true } });
      try {
        created = await prisma.serviceOrder.create({
          data: {
            tenant_id: tenantId, number: (last?.number ?? 0) + 1, customer_id: quote.customer_id, customer_name: text(quote.customer_name, 160), customer_phone: quote.customer_phone ?? null,
            has_equipment: false, equipment_category: "", status: status ?? "aprovado", promised_at: due, observations: text(f.notes, 5000) || null, quote_id: quote.id,
            subtotal: quote.total_amount, total_amount: quote.total_amount,
          },
        });
      } catch (e: any) { if (e?.code !== "P2002") throw e; }
    }
    if (!created) return res.status(409).json({ error: "Não foi possível numerar a ordem de serviço." });
    await prisma.serviceOrderAction.create({ data: { tenant_id: tenantId, service_order_id: created.id, action: "created", to_status: created.status, actor: "Sistema Gráfica", note: "Criada a partir do pedido no Sistema Gráfica" } });
    res.status(201).json(orderOut(await loadOrder(created.id)));
  } catch (e) { console.error("internal-sync POST orders:", e); res.status(500).json({ error: "Falha ao gravar a ordem de serviço." }); }
});

// ── Exclusões espelhadas ─────────────────────────────────────────────────────
// O grafica pede para apagar aqui o que foi apagado lá. Só apaga registro SEM histórico: cliente, produto, orçamento ou O.S.
// já usados em venda, financeiro, O.S. faturada etc. respondem 409 e ficam como estão (o grafica só registra o aviso).
const blocked = (res: Response, why: string) => res.status(409).json({ error: why });

router.delete("/customers/:id", async (req, res) => {
  try {
    const tenantId = tid(req), id = Number(req.params.id);
    const cur = await prisma.customer.findFirst({ where: { id, tenant_id: tenantId } });
    if (!cur) return res.json({ deleted: false, gone: true });
    const used = await Promise.all([
      prisma.order.count({ where: { customer_id: id } }), prisma.serviceOrder.count({ where: { customer_id: id } }), prisma.quote.count({ where: { customer_id: id } }),
      prisma.accountReceivable.count({ where: { tenant_id: tenantId, customer_name: cur.name } }), prisma.customerDebt.count({ where: { customer_id: id } }), prisma.customerPoint.count({ where: { customer_id: id } }),
      prisma.customerCredit.count({ where: { customer_id: id } }), prisma.pointRedemption.count({ where: { customer_id: id } }),
    ]);
    if (used.some((n) => n > 0)) return blocked(res, "Cliente com vendas, O.S., orçamentos ou financeiro não é apagado.");
    await prisma.customerNote.deleteMany({ where: { customer_id: id } });
    await prisma.customer.delete({ where: { id } });
    res.json({ deleted: true });
  } catch (e) { console.error("internal-sync DELETE customers:", e); res.status(500).json({ error: "Falha ao apagar o cliente." }); }
});

router.delete("/products/:id", async (req, res) => {
  try {
    const tenantId = tid(req), id = Number(req.params.id);
    const cur = await prisma.product.findFirst({ where: { id, tenant_id: tenantId } });
    if (!cur) return res.json({ deleted: false, gone: true });
    const used = await Promise.all([prisma.orderItem.count({ where: { product_id: id } }), prisma.serviceOrderPart.count({ where: { product_id: id } }), prisma.consignmentItem.count({ where: { product_id: id } })]);
    if (used.some((n) => n > 0)) return blocked(res, "Produto com vendas, O.S. ou consignação não é apagado.");
    await prisma.product.delete({ where: { id } });
    res.json({ deleted: true });
  } catch (e) { console.error("internal-sync DELETE products:", e); res.status(500).json({ error: "Falha ao apagar o produto." }); }
});

router.delete("/quotes/:id", async (req, res) => {
  try {
    const tenantId = tid(req), id = Number(req.params.id);
    const cur = await prisma.quote.findFirst({ where: { id, tenant_id: tenantId } });
    if (!cur) return res.json({ deleted: false, gone: true });
    if ((await prisma.serviceOrder.count({ where: { quote_id: id } })) > 0) return blocked(res, "Orçamento com O.S. não é apagado.");
    await prisma.$transaction(async (tx) => {
      await tx.quoteItem.deleteMany({ where: { quote_id: id } });
      await tx.quoteService.deleteMany({ where: { quote_id: id } });
      await tx.quote.delete({ where: { id } });
    });
    res.json({ deleted: true });
  } catch (e) { console.error("internal-sync DELETE quotes:", e); res.status(500).json({ error: "Falha ao apagar o orçamento." }); }
});

router.delete("/orders/:id", async (req, res) => {
  try {
    const tenantId = tid(req), id = Number(req.params.id);
    const cur = await prisma.serviceOrder.findFirst({ where: { id, tenant_id: tenantId } });
    if (!cur) return res.json({ deleted: false, gone: true });
    const [receivables, nfse] = await Promise.all([prisma.accountReceivable.count({ where: { service_order_id: id } }), prisma.nfseInvoice.count({ where: { service_order_id: id } })]);
    if (cur.invoiced_order_id || receivables > 0 || nfse > 0 || Number(cur.deposit_amount ?? 0) > 0 || ["entregue", "nota_emitida"].includes(cur.status)) return blocked(res, "O.S. faturada, entregue ou com financeiro não é apagada.");
    await prisma.$transaction(async (tx) => {
      await tx.serviceOrderPart.deleteMany({ where: { service_order_id: id } });
      await tx.serviceOrderChecklistItem.deleteMany({ where: { service_order_id: id } });
      await tx.serviceOrderPhoto.deleteMany({ where: { service_order_id: id } });
      await tx.serviceOrderAction.deleteMany({ where: { service_order_id: id } });
      await tx.serviceOrder.delete({ where: { id } });
    });
    res.json({ deleted: true });
  } catch (e) { console.error("internal-sync DELETE orders:", e); res.status(500).json({ error: "Falha ao apagar a O.S." }); }
});

export default router;
