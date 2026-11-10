import type { Request, Response } from "express";

import { prisma } from "../config/prisma";
import type { AuthenticatedRequest } from "../types/auth";
import { BLANK_FISCAL, FISCAL_KEYS } from "../utils/issuers";

const tenantOf = (req: Request) => (req as AuthenticatedRequest).user.tenantId as number;
const isAdmin = (req: Request) => (req as AuthenticatedRequest).user.role === "admin";
const digits = (v: unknown) => String(v ?? "").replace(/\D/g, "");
const text = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
const pick = (t: any) => Object.fromEntries(FISCAL_KEYS.map((k) => [k, t[k] ?? null]));

/** A primeira vez que a loja abre a tela, o CNPJ atual vira o primeiro emissor (ativo) e as notas já emitidas ficam com ele. */
async function ensureIssuers(tenantId: number) {
  if (await prisma.tenantIssuer.count({ where: { tenant_id: tenantId } })) return;
  const t = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!t) return;
  const created = await prisma.tenantIssuer.create({
    data: {
      tenant_id: tenantId, label: text(t.razao_social || t.name, 120) || "Matriz", document: t.document ?? null, is_active: true, snapshot: {},
      address: { street: t.address_street ?? "", number: t.address_number ?? "", complement: t.address_complement ?? "", district: t.address_district ?? "", city: t.address_city ?? "", state: t.address_state ?? "", zip: t.address_zip ?? "" },
    },
  });
  await prisma.nfceInvoice.updateMany({ where: { tenant_id: tenantId, issuer_id: null }, data: { issuer_id: created.id } });
  await prisma.nfseInvoice.updateMany({ where: { tenant_id: tenantId, issuer_id: null }, data: { issuer_id: created.id } });
}

function out(i: any, tenant: any, notes: number) {
  const snap = (i.is_active ? tenant : i.snapshot) ?? {};
  return {
    id: i.id, label: i.label, isActive: i.is_active, document: snap.document ?? i.document ?? "", razaoSocial: snap.razao_social ?? "",
    nfceEnvironment: snap.nfce_environment ?? "homologacao", hasCertificate: !!snap.nfce_cert_path, address: i.address ?? null, notes,
  };
}

export async function listIssuers(req: Request, res: Response) {
  try {
    const tenantId = tenantOf(req);
    await ensureIssuers(tenantId);
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    const rows = await prisma.tenantIssuer.findMany({ where: { tenant_id: tenantId }, orderBy: { id: "asc" } });
    const result = [];
    for (const i of rows) {
      const [nfce, nfse] = await Promise.all([prisma.nfceInvoice.count({ where: { issuer_id: i.id } }), prisma.nfseInvoice.count({ where: { issuer_id: i.id } })]);
      result.push(out(i, tenant, nfce + nfse));
    }
    res.json({ issuers: result, canManage: isAdmin(req) });
  } catch (e) { console.error("listIssuers:", e); res.status(500).json({ error: "Falha ao listar os CNPJs." }); }
}

/** Resumo leve para o topo do painel (só administrador; não cria nada: se a loja não usa vários CNPJs, devolve lista vazia). */
export async function issuersSummary(req: Request, res: Response) {
  try {
    if (!isAdmin(req)) { res.json({ issuers: [] }); return; }
    const rows = await prisma.tenantIssuer.findMany({ where: { tenant_id: tenantOf(req) }, orderBy: { id: "asc" }, select: { id: true, label: true, is_active: true } });
    res.json({ issuers: rows.map((r) => ({ id: r.id, label: r.label, isActive: r.is_active })) });
  } catch (e) { console.error("issuersSummary:", e); res.json({ issuers: [] }); }
}

export async function createIssuer(req: Request, res: Response) {
  try {
    if (!isAdmin(req)) { res.status(403).json({ error: "Só o administrador cadastra CNPJs." }); return; }
    const tenantId = tenantOf(req);
    await ensureIssuers(tenantId);
    const label = text(req.body?.label, 120);
    const document = digits(req.body?.document);
    if (!label) { res.status(422).json({ error: "Informe um nome para identificar este CNPJ (ex.: Matriz, Filial Tatuí)." }); return; }
    if (document.length !== 14 && document.length !== 11) { res.status(422).json({ error: "Informe o CNPJ (14 dígitos) ou CPF (11)." }); return; }
    const t = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { document: true } });
    const all = await prisma.tenantIssuer.findMany({ where: { tenant_id: tenantId }, select: { document: true, is_active: true, snapshot: true } });
    const used = all.some((i) => digits(i.is_active ? t?.document : (i.snapshot as any)?.document ?? i.document) === document);
    if (used) { res.status(409).json({ error: "Este CNPJ já está cadastrado na loja." }); return; }
    // por padrão a empresa nova começa do zero (outro CNPJ = outro certificado, CSC e inscrições); opcionalmente parte dos dados do CNPJ ativo
    let snapshot: Record<string, unknown> = { ...BLANK_FISCAL, document };
    if (req.body?.copyFromActive) {
      const cur = await prisma.tenant.findUnique({ where: { id: tenantId } });
      snapshot = { ...pick(cur), document, nfce_next_number: 1, nfse_next_number: 1 };
    }
    const created = await prisma.tenantIssuer.create({
      data: { tenant_id: tenantId, label, document, is_active: false, snapshot: snapshot as any },
    });
    res.status(201).json({ id: created.id });
  } catch (e) { console.error("createIssuer:", e); res.status(500).json({ error: "Falha ao cadastrar o CNPJ." }); }
}

export async function updateIssuer(req: Request, res: Response) {
  try {
    if (!isAdmin(req)) { res.status(403).json({ error: "Só o administrador altera CNPJs." }); return; }
    const tenantId = tenantOf(req);
    const cur = await prisma.tenantIssuer.findFirst({ where: { id: Number(req.params.id), tenant_id: tenantId } });
    if (!cur) { res.status(404).json({ error: "CNPJ não encontrado." }); return; }
    const data: Record<string, unknown> = {};
    if (typeof req.body?.label === "string" && text(req.body.label, 120)) data.label = text(req.body.label, 120);
    const a = req.body?.address;
    if (a && typeof a === "object") {
      data.address = {
        street: text(a.street, 200), number: text(a.number, 20), complement: text(a.complement, 100), district: text(a.district, 100),
        city: text(a.city, 100), state: text(a.state, 2).toUpperCase(), zip: digits(a.zip).slice(0, 8),
      };
    }
    await prisma.tenantIssuer.update({ where: { id: cur.id }, data });
    res.json({ ok: true });
  } catch (e) { console.error("updateIssuer:", e); res.status(500).json({ error: "Falha ao salvar o CNPJ." }); }
}

export async function activateIssuer(req: Request, res: Response) {
  try {
    if (!isAdmin(req)) { res.status(403).json({ error: "Só o administrador troca o CNPJ ativo." }); return; }
    const tenantId = tenantOf(req);
    await ensureIssuers(tenantId);
    const target = await prisma.tenantIssuer.findFirst({ where: { id: Number(req.params.id), tenant_id: tenantId } });
    if (!target) { res.status(404).json({ error: "CNPJ não encontrado." }); return; }
    if (target.is_active) { res.json({ ok: true }); return; }
    const pending = (await prisma.nfceInvoice.count({ where: { tenant_id: tenantId, status: "pending" } })) + (await prisma.nfseInvoice.count({ where: { tenant_id: tenantId, status: "pending" } }));
    if (pending > 0) { res.status(409).json({ error: "Há notas sendo emitidas agora. Espere terminarem e troque o CNPJ em seguida." }); return; }

    await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.findUnique({ where: { id: tenantId } });
      const current = await tx.tenantIssuer.findFirst({ where: { tenant_id: tenantId, is_active: true } });
      if (current) await tx.tenantIssuer.update({ where: { id: current.id }, data: { is_active: false, snapshot: pick(tenant) as any, document: tenant?.document ?? current.document } });
      const snap = { ...BLANK_FISCAL, ...((target.snapshot as Record<string, unknown>) ?? {}) } as Record<string, unknown>;
      await tx.tenant.update({ where: { id: tenantId }, data: Object.fromEntries(FISCAL_KEYS.map((k) => [k, snap[k] ?? null])) as any });
      await tx.tenantIssuer.update({ where: { id: target.id }, data: { is_active: true, snapshot: {} } });
    });
    res.json({ ok: true });
  } catch (e) { console.error("activateIssuer:", e); res.status(500).json({ error: "Falha ao trocar o CNPJ ativo." }); }
}

export async function deleteIssuer(req: Request, res: Response) {
  try {
    if (!isAdmin(req)) { res.status(403).json({ error: "Só o administrador remove CNPJs." }); return; }
    const tenantId = tenantOf(req);
    const cur = await prisma.tenantIssuer.findFirst({ where: { id: Number(req.params.id), tenant_id: tenantId } });
    if (!cur) { res.status(404).json({ error: "CNPJ não encontrado." }); return; }
    if (cur.is_active) { res.status(409).json({ error: "Este é o CNPJ ativo. Ative outro antes de remover." }); return; }
    const notes = (await prisma.nfceInvoice.count({ where: { issuer_id: cur.id } })) + (await prisma.nfseInvoice.count({ where: { issuer_id: cur.id } }));
    if (notes > 0) { res.status(409).json({ error: "Este CNPJ já emitiu notas e não pode ser removido." }); return; }
    await prisma.tenantIssuer.delete({ where: { id: cur.id } });
    res.json({ ok: true });
  } catch (e) { console.error("deleteIssuer:", e); res.status(500).json({ error: "Falha ao remover o CNPJ." }); }
}
