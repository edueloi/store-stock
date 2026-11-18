import { useCallback, useEffect, useState } from "react";

// Abre a vitrine pública da loja (/s/<slug>/catalogo) já filtrada pelo produto, para conferir como ele aparece para o cliente.
// O slug vem de /api/tenant e fica em cache no módulo (uma única busca por sessão).
let cachedSlug: string | null = null;
let pending: Promise<string | null> | null = null;

function loadSlug(): Promise<string | null> {
  if (cachedSlug) return Promise.resolve(cachedSlug);
  if (!pending) {
    pending = fetch("/api/tenant", { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { cachedSlug = d?.slug || null; return cachedSlug; })
      .catch(() => null)
      .finally(() => { pending = null; });
  }
  return pending;
}

export function useCatalogLink() {
  const [slug, setSlug] = useState<string | null>(cachedSlug);
  useEffect(() => { if (!slug) loadSlug().then(setSlug); }, [slug]);

  const openInCatalog = useCallback((product: { name: string }) => {
    if (!slug) { alert("A loja ainda não tem um endereço (slug) configurado."); return; }
    window.open(`${window.location.origin}/s/${slug}/catalogo?q=${encodeURIComponent(product.name)}`, "_blank", "noopener");
  }, [slug]);

  return { openInCatalog, catalogReady: !!slug };
}
