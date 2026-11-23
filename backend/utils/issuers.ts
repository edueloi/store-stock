import { Prisma } from "@prisma/client";

import { prisma } from "../config/prisma";

// CNPJs emissores da loja: o ativo vive nas colunas fiscais do Tenant; os demais ficam guardados em TenantIssuer.snapshot.
// Trocar o ativo troca SÓ o conjunto fiscal abaixo (nada de clientes, produtos, orçamentos ou vendas).
export const FISCAL_KEYS = [
  "document", "razao_social", "inscricao_estadual", "inscricao_municipal", "cnae_fiscal", "tax_regime", "crt",
  "nfce_environment", "nfce_series", "nfce_next_number", "nfe_series", "nfe_next_number", "nfce_csc_id", "nfce_csc_token", "nfce_csc_id_homologacao", "nfce_csc_token_homologacao",
  "nfce_csc_id_producao", "nfce_csc_token_producao", "nfce_cert_path", "nfce_cert_password",
  "nfse_environment", "nfse_codigo_municipio", "nfse_inscricao_municipal", "nfse_serie", "nfse_next_number",
] as const;

/** Conjunto fiscal de um CNPJ recém-cadastrado (ambiente de teste, séries e numeração do zero). */
export const BLANK_FISCAL: Record<(typeof FISCAL_KEYS)[number], unknown> = {
  document: null, razao_social: null, inscricao_estadual: null, inscricao_municipal: null, cnae_fiscal: null, tax_regime: "simples_nacional", crt: 1,
  nfce_environment: "homologacao", nfce_series: 1, nfce_next_number: 1, nfe_series: 1, nfe_next_number: 1, nfce_csc_id: null, nfce_csc_token: null, nfce_csc_id_homologacao: null, nfce_csc_token_homologacao: null,
  nfce_csc_id_producao: null, nfce_csc_token_producao: null, nfce_cert_path: null, nfce_cert_password: null,
  nfse_environment: "homologacao", nfse_codigo_municipio: null, nfse_inscricao_municipal: null, nfse_serie: 1, nfse_next_number: 1,
};

export async function activeIssuerId(tenantId: number): Promise<number | null> {
  const i = await prisma.tenantIssuer.findFirst({ where: { tenant_id: tenantId, is_active: true }, select: { id: true } });
  return i?.id ?? null;
}

/** Filtro das listas de notas: com mais de um CNPJ, só as do ativo. Com um só (ou nenhum), não filtra. */
export async function issuerFilter(tenantId: number): Promise<{ issuer_id?: number }> {
  const n = await prisma.tenantIssuer.count({ where: { tenant_id: tenantId } });
  if (n < 2) return {};
  const id = await activeIssuerId(tenantId);
  return id ? { issuer_id: id } : {};
}

/**
 * Dados fiscais de UM CNPJ: a linha da loja com o conjunto fiscal do CNPJ pedido por cima (certificado, CSC, séries, inscrições…).
 * É assim que duas notas de CNPJs diferentes podem ser emitidas ao mesmo tempo, sem trocar o "ativo" da loja.
 * Sem CNPJ (loja com um só), ou se for o ativo, devolve a loja como está.
 */
export async function fiscalTenant(tenantId: number, issuerId?: number | null) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant || !issuerId) return tenant;
  const issuer = await prisma.tenantIssuer.findFirst({ where: { id: issuerId, tenant_id: tenantId } });
  if (!issuer || issuer.is_active) return tenant;
  const snap = { ...BLANK_FISCAL, ...((issuer.snapshot as Record<string, unknown>) ?? {}) } as Record<string, unknown>;
  return { ...tenant, ...Object.fromEntries(FISCAL_KEYS.map((k) => [k, snap[k] ?? null])) } as typeof tenant;
}

type Db = Pick<typeof prisma, "tenant" | "tenantIssuer">;
/** Soma 1 na numeração da NFC-e/NFS-e do CNPJ certo (a coluna da loja, se for o ativo; senão o conjunto guardado do CNPJ). */
export async function bumpNextNumber(db: Db, tenantId: number, issuerId: number | null | undefined, field: "nfce_next_number" | "nfse_next_number" | "nfe_next_number") {
  const issuer = issuerId ? await db.tenantIssuer.findFirst({ where: { id: issuerId, tenant_id: tenantId } }) : null;
  if (!issuer || issuer.is_active) { await db.tenant.update({ where: { id: tenantId }, data: { [field]: { increment: 1 } } }); return; }
  const snap = { ...BLANK_FISCAL, ...((issuer.snapshot as Record<string, unknown>) ?? {}) } as Record<string, unknown>;
  snap[field] = Number(snap[field] ?? 1) + 1;
  await db.tenantIssuer.update({ where: { id: issuer.id }, data: { snapshot: snap as any } });
}

/** CNPJ da nota: o escolhido na hora (cabeçalho x-issuer-id); o ativo se a loja tem um só. Com vários e sem escolha: pergunta (needChoice). */
export async function issuerForNote(req: { headers: Record<string, unknown>; body?: any }, tenantId: number, recordIssuerId?: number | null): Promise<{ id: number | null; needChoice?: { id: number; label: string; document: string }[] }> {
  const rows = await prisma.tenantIssuer.findMany({ where: { tenant_id: tenantId }, orderBy: { id: "asc" }, select: { id: true, label: true, document: true, is_active: true, snapshot: true } });
  if (rows.length < 2) return { id: rows[0]?.id ?? null };
  const asked = Number(req.headers["x-issuer-id"] ?? req.body?.issuer_id);
  const picked = rows.find((r) => r.id === asked);
  if (picked) return { id: picked.id };
  // CNPJ do próprio pedido/O.S.: a venda pertence a ele, então a nota sai por ele (antes seguia o seletor do topo e mandava
  // por outro CNPJ pedidos de uma empresa diferente da escolhida no topo)
  const own = recordIssuerId ? rows.find((r) => r.id === Number(recordIssuerId)) : undefined;
  if (own) return { id: own.id };
  // CNPJ escolhido no seletor do topo do painel: emite por ele, sem perguntar de novo
  const viewId = await issuerView(req, tenantId);
  const viewRow = viewId ? rows.find((r) => r.id === viewId) : undefined;
  if (viewRow) return { id: viewRow.id };
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { document: true } });
  return { id: null, needChoice: rows.map((r) => ({ id: r.id, label: r.label, document: String((r.is_active ? tenant?.document : (r.snapshot as any)?.document) ?? r.document ?? "") })) };
}

/** CNPJ "padrão" da loja: o primeiro cadastrado. Registros sem CNPJ marcado (antigos ou criados sem escolha) contam como dele nos relatórios. */
export async function principalIssuerId(tenantId: number): Promise<number | null> {
  const i = await prisma.tenantIssuer.findFirst({ where: { tenant_id: tenantId }, orderBy: { id: "asc" }, select: { id: true } });
  return i?.id ?? null;
}

/** Visão escolhida no topo do painel (cabeçalho x-issuer-view): "all"/vazio = todos; número = um CNPJ. */
export async function issuerView(req: { headers: Record<string, unknown> }, tenantId: number): Promise<number | null> {
  const raw = String(req.headers["x-issuer-view"] ?? "");
  const id = Number(raw);
  if (!raw || raw === "all" || !Number.isInteger(id) || id <= 0) return null;
  const ok = await prisma.tenantIssuer.count({ where: { id, tenant_id: tenantId } });
  return ok ? id : null;
}

/** Condição para as listas/relatórios (vai dentro de AND): vazia para "todos"; para o CNPJ padrão inclui também o que não tem CNPJ marcado. */
export async function issuerClause(req: { headers: Record<string, unknown> }, tenantId: number): Promise<Record<string, unknown>[]> {
  const view = await issuerView(req, tenantId);
  if (!view) return [];
  const principal = await principalIssuerId(tenantId);
  return [view === principal ? { OR: [{ issuer_id: view }, { issuer_id: null }] } : { issuer_id: view }];
}

/** CNPJ a gravar num registro novo: o da visão escolhida no topo; em "todos" não marca (conta como do padrão). */
export async function issuerForNew(req: { headers: Record<string, unknown> }, tenantId: number): Promise<number | null> {
  return issuerView(req, tenantId);
}

/** Endereço do emitente DENTRO das notas: o do CNPJ ativo, se tiver; senão o da loja. O endereço da loja online não muda. */
export async function withIssuerAddress<T extends Record<string, any>>(tenant: T, issuerId?: number | null): Promise<T> {
  const i = await prisma.tenantIssuer.findFirst({ where: { tenant_id: tenant.id, ...(issuerId ? { id: issuerId } : { is_active: true }) }, select: { address: true } });
  const a = (i?.address ?? null) as null | Record<string, string>;
  if (!a || !String(a.street ?? "").trim()) return tenant;
  return {
    ...tenant,
    address_street: a.street, address_number: a.number || tenant.address_number, address_complement: a.complement || null,
    address_district: a.district || tenant.address_district, address_city: a.city || tenant.address_city, address_state: a.state || tenant.address_state, address_zip: a.zip || tenant.address_zip,
  };
}

/** Mesma condição de issuerClause para consultas SQL cruas (alias da tabela de vendas/lançamentos). */
export async function issuerSql(req: { headers: Record<string, unknown> }, tenantId: number, alias: string): Promise<Prisma.Sql> {
  const view = await issuerView(req, tenantId);
  if (!view) return Prisma.empty;
  const principal = await principalIssuerId(tenantId);
  const col = Prisma.raw(`${alias}.issuer_id`);
  return view === principal ? Prisma.sql`AND (${col} = ${view} OR ${col} IS NULL)` : Prisma.sql`AND ${col} = ${view}`;
}
