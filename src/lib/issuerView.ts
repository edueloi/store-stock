// Visão por CNPJ (empresa) escolhida no topo do painel + pergunta "de qual CNPJ emitir" nas notas fiscais.
// Tudo passa por um único ponto: o fetch global recebe o cabeçalho da visão e, quando o servidor responde que precisa saber o CNPJ
// da nota (409 needIssuer), abre a escolha e repete o mesmo pedido já com o CNPJ — as telas de emissão nem precisam saber disso.

const VIEW_KEY = "issuer_view_v1";

export interface IssuerChoice { id: number; label: string; document: string }

export function getIssuerView(): string {
  try { return localStorage.getItem(VIEW_KEY) || "all"; } catch { return "all"; }
}
export function setIssuerView(v: string) {
  try { localStorage.setItem(VIEW_KEY, v); } catch { /* sem storage */ }
}

/** Abre a janela de escolha do CNPJ. Resolve com o id escolhido ou null se a pessoa cancelar. */
function askIssuer(issuers: IssuerChoice[]): Promise<number | null> {
  return new Promise((resolve) => {
    window.dispatchEvent(new CustomEvent("issuer:ask", { detail: { issuers, resolve } }));
  });
}

let installed = false;
export function installIssuerFetch() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  const orig = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const isApi = url.startsWith("/api") || url.startsWith(`${location.origin}/api`);
    if (!isApi || input instanceof Request) return orig(input, init);

    const headers = new Headers(init?.headers);
    const view = getIssuerView();
    if (view !== "all" && !headers.has("x-issuer-view")) headers.set("x-issuer-view", view);
    const res = await orig(input, { ...init, headers });

    const isNoteEmission = /\/api\/(nfce|nfse)\//.test(url) && (init?.method ?? "GET").toUpperCase() === "POST";
    if (res.status === 409 && isNoteEmission) {
      const data = await res.clone().json().catch(() => null) as { needIssuer?: boolean; issuers?: IssuerChoice[] } | null;
      if (data?.needIssuer && data.issuers?.length) {
        const chosen = await askIssuer(data.issuers);
        if (chosen == null) return res; // cancelou: a tela mostra o aviso padrão
        headers.set("x-issuer-id", String(chosen));
        return orig(input, { ...init, headers });
      }
    }
    return res;
  };
}
