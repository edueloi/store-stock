import { useEffect, useState } from "react";

// Quais documentos fiscais a loja emite. Guardado em tenant.policies.fiscal_documents (sem migração).
// Padrão = como o sistema sempre foi: NFC-e e NFS-e ligadas, NF-e desligada (só quem precisa liga em Configurações → Dados Fiscais).
export interface FiscalDocs { nfce: boolean; nfe: boolean; nfse: boolean }

export const DEFAULT_FISCAL_DOCS: FiscalDocs = { nfce: true, nfe: false, nfse: true };

export function fiscalDocsFromPolicies(policies: unknown): FiscalDocs {
  const d = ((policies as { fiscal_documents?: Partial<FiscalDocs> } | null | undefined)?.fiscal_documents ?? {}) as Partial<FiscalDocs>;
  return {
    nfce: typeof d.nfce === "boolean" ? d.nfce : DEFAULT_FISCAL_DOCS.nfce,
    nfe: typeof d.nfe === "boolean" ? d.nfe : DEFAULT_FISCAL_DOCS.nfe,
    nfse: typeof d.nfse === "boolean" ? d.nfse : DEFAULT_FISCAL_DOCS.nfse,
  };
}

let cache: FiscalDocs | null = null;
let inflight: Promise<FiscalDocs> | null = null;
const listeners = new Set<(d: FiscalDocs) => void>();

async function load(): Promise<FiscalDocs> {
  if (!inflight) {
    inflight = fetch("/api/tenant", { headers: { Authorization: `Bearer ${localStorage.getItem("token") ?? ""}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((t) => { cache = fiscalDocsFromPolicies(t?.policies); return cache; })
      .catch(() => DEFAULT_FISCAL_DOCS)
      .finally(() => { inflight = null; });
  }
  return inflight;
}

/** Chame depois de salvar as configurações para as telas abertas passarem a refletir a mudança. */
export function refreshFiscalDocs(next?: FiscalDocs) {
  cache = next ?? null;
  void (next ? Promise.resolve(next) : load()).then((d) => listeners.forEach((fn) => fn(d)));
}

/** Documentos fiscais que a loja usa (NFC-e, NF-e, NFS-e). Até carregar, vale o padrão. */
export function useFiscalDocs(): FiscalDocs {
  const [docs, setDocs] = useState<FiscalDocs>(cache ?? DEFAULT_FISCAL_DOCS);
  useEffect(() => {
    let alive = true;
    const fn = (d: FiscalDocs) => { if (alive) setDocs(d); };
    listeners.add(fn);
    if (cache) setDocs(cache); else void load().then(fn);
    return () => { alive = false; listeners.delete(fn); };
  }, []);
  return docs;
}
