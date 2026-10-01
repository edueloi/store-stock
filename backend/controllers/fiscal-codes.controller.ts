import type { Request, Response } from "express";

const NFS_E_SERVICE_LIST_URL = "https://www.gov.br/nfse/pt-br/mei-e-demais-empresas/codigos-de-tributacao-nacional-nbs";

type ServiceCode = { code: string; description: string };
let serviceCodesCache: { loadedAt: number; codes: ServiceCode[] } | null = null;

function decodeHtml(value: string) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, decimal) => String.fromCharCode(Number(decimal)))
    .replace(/\s+/g, " ")
    .trim();
}

async function getOfficialServiceCodes() {
  const tenMinutes = 10 * 60 * 1000;
  if (serviceCodesCache && Date.now() - serviceCodesCache.loadedAt < tenMinutes) {
    return serviceCodesCache.codes;
  }

  const response = await fetch(NFS_E_SERVICE_LIST_URL, {
    headers: { Accept: "text/html", "User-Agent": "BoxSys Fiscal Catalog" },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`Lista oficial indisponível (${response.status})`);
  const html = await response.text();
  const codes = Array.from(html.matchAll(/<td[^>]*>\s*(\d{6})\s*-\s*([^<]+)<\/td>/gi))
    .map((match) => ({ code: match[1], description: decodeHtml(match[2]) }))
    .filter((item, index, list) => item.description && list.findIndex((other) => other.code === item.code) === index);
  if (!codes.length) throw new Error("Não foi possível ler a lista oficial de serviços.");
  serviceCodesCache = { loadedAt: Date.now(), codes };
  return codes;
}

/** Lista pesquisável do Código de Tributação Nacional da NFS-e (fonte gov.br). */
export async function listNfseServiceCodes(req: Request, res: Response) {
  try {
    const term = String(req.query.search || "").trim().toLocaleLowerCase("pt-BR");
    const codes = await getOfficialServiceCodes();
    const filtered = term
      ? codes.filter((item) => item.code.includes(term.replace(/\D/g, "")) || item.description.toLocaleLowerCase("pt-BR").includes(term))
      : codes;
    res.json({ items: filtered.slice(0, 120), total: filtered.length, source_url: NFS_E_SERVICE_LIST_URL });
  } catch (error) {
    console.error("Falha ao consultar lista oficial de serviços NFS-e", error);
    res.status(502).json({ error: "A lista oficial de códigos de serviço está indisponível agora." });
  }
}

/** Consulta NCM vigente via catálogo público; a escolha final continua sendo do emissor. */
export async function searchNcmCodes(req: Request, res: Response) {
  const search = String(req.query.search || "").trim().slice(0, 80);
  if (search.length < 2) {
    res.status(422).json({ error: "Digite ao menos 2 caracteres para consultar NCM." });
    return;
  }
  try {
    const response = await fetch(`https://brasilapi.com.br/api/ncm/v1?search=${encodeURIComponent(search)}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new Error(`NCM ${response.status}`);
    const payload = await response.json() as Array<{ codigo?: string; descricao?: string }>;
    res.json({
      items: (Array.isArray(payload) ? payload : []).slice(0, 80).map((item) => ({
        code: String(item.codigo || "").replace(/\D/g, ""),
        formatted_code: item.codigo || "",
        description: item.descricao || "",
      })).filter((item) => item.code.length === 8),
    });
  } catch (error) {
    console.error("Falha ao consultar NCM", error);
    res.status(502).json({ error: "A consulta de NCM está indisponível agora." });
  }
}
