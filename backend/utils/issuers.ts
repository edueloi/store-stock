import { prisma } from "../config/prisma";

// CNPJs emissores da loja: o ativo vive nas colunas fiscais do Tenant; os demais ficam guardados em TenantIssuer.snapshot.
// Trocar o ativo troca SÓ o conjunto fiscal abaixo (nada de clientes, produtos, orçamentos ou vendas).
export const FISCAL_KEYS = [
  "document", "razao_social", "inscricao_estadual", "inscricao_municipal", "cnae_fiscal", "tax_regime", "crt",
  "nfce_environment", "nfce_series", "nfce_next_number", "nfce_csc_id", "nfce_csc_token", "nfce_csc_id_homologacao", "nfce_csc_token_homologacao",
  "nfce_csc_id_producao", "nfce_csc_token_producao", "nfce_cert_path", "nfce_cert_password",
  "nfse_environment", "nfse_codigo_municipio", "nfse_inscricao_municipal", "nfse_serie", "nfse_next_number",
] as const;

/** Conjunto fiscal de um CNPJ recém-cadastrado (ambiente de teste, séries e numeração do zero). */
export const BLANK_FISCAL: Record<(typeof FISCAL_KEYS)[number], unknown> = {
  document: null, razao_social: null, inscricao_estadual: null, inscricao_municipal: null, cnae_fiscal: null, tax_regime: "simples_nacional", crt: 1,
  nfce_environment: "homologacao", nfce_series: 1, nfce_next_number: 1, nfce_csc_id: null, nfce_csc_token: null, nfce_csc_id_homologacao: null, nfce_csc_token_homologacao: null,
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

/** Endereço do emitente DENTRO das notas: o do CNPJ ativo, se tiver; senão o da loja. O endereço da loja online não muda. */
export async function withIssuerAddress<T extends Record<string, any>>(tenant: T): Promise<T> {
  const i = await prisma.tenantIssuer.findFirst({ where: { tenant_id: tenant.id, is_active: true }, select: { address: true } });
  const a = (i?.address ?? null) as null | Record<string, string>;
  if (!a || !String(a.street ?? "").trim()) return tenant;
  return {
    ...tenant,
    address_street: a.street, address_number: a.number || tenant.address_number, address_complement: a.complement || null,
    address_district: a.district || tenant.address_district, address_city: a.city || tenant.address_city, address_state: a.state || tenant.address_state, address_zip: a.zip || tenant.address_zip,
  };
}
