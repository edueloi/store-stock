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

export default router;
