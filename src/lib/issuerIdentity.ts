import { useEffect, useMemo, useState } from "react";

/** Identidade do CNPJ usada no cabeçalho dos documentos (orçamento, O.S., PDF). Vem de GET /api/tenant/issuers/identity. */
export interface IssuerIdentity {
  issuer_id: number;
  label: string;
  document: string | null;
  razao_social: string | null;
  inscricao_estadual: string | null;
  inscricao_municipal: string | null;
  cnae_fiscal: string | null;
  address_street: string | null;
  address_number: string | null;
  address_complement: string | null;
  address_district: string | null;
  address_city: string | null;
  address_state: string | null;
  address_zip: string | null;
}

/**
 * Busca a identidade do CNPJ: o do próprio registro (`issuerId`, ex.: o CNPJ do orçamento) ou, sem isso, o escolhido no
 * topo do painel (o fetch global já manda o cabeçalho). Devolve null quando a loja tem um CNPJ só / nenhum foi escolhido
 * — o documento então usa os dados da loja como sempre.
 */
export function useIssuerIdentity(issuerId?: number | null): IssuerIdentity | null {
  const [identity, setIdentity] = useState<IssuerIdentity | null>(null);
  useEffect(() => {
    let alive = true;
    const qs = issuerId ? `?issuerId=${issuerId}` : "";
    fetch(`/api/tenant/issuers/identity${qs}`, { headers: { Authorization: `Bearer ${localStorage.getItem("token") ?? ""}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive) setIdentity(d?.identity ?? null); })
      .catch(() => { if (alive) setIdentity(null); });
    return () => { alive = false; };
  }, [issuerId]);
  return identity;
}

/** Sobrepõe a identidade do CNPJ aos dados da loja (só nos campos preenchidos); sem identidade devolve a loja como está. */
export function withIssuerIdentity<T extends object>(tenant: T | null, identity: IssuerIdentity | null): T | null {
  if (!tenant || !identity) return tenant;
  const { issuer_id: _id, label: _label, ...fields } = identity;
  const overlay = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== null && v !== ""));
  return { ...tenant, ...overlay } as T;
}

/** Hook de conveniência: o `tenant` das telas de documento já com o CNPJ certo. */
export function useTenantForDocuments<T extends object>(tenantRaw: T | null, issuerId?: number | null): T | null {
  const identity = useIssuerIdentity(issuerId);
  return useMemo(() => withIssuerIdentity(tenantRaw, identity), [tenantRaw, identity]);
}
