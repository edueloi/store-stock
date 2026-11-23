import axios from "axios";

// Endereço por CEP + código IBGE do município (7 dígitos, obrigatório no endereço do DESTINATÁRIO da NF-e: cMun).
// 1) ViaCEP devolve rua, bairro, cidade, UF e o código IBGE de uma vez só; 2) se não achar, a API oficial do IBGE por UF + nome.
// Respostas ficam em memória: o mesmo CEP/cidade não é consultado de novo (deixa o modal bem mais rápido).

const UA = "BoxSys/1.0 (+https://store.boxsys.com.br)";
const TTL_MS = 24 * 60 * 60 * 1000;

const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

export interface IbgeCity { code: string; city: string; state: string; street?: string; district?: string }

const citiesByUf = new Map<string, { id: number; nome: string }[]>();
const zipCache = new Map<string, { at: number; value: IbgeCity | null }>();

async function citiesOf(uf: string): Promise<{ id: number; nome: string }[]> {
  const cached = citiesByUf.get(uf);
  if (cached) return cached;
  const r = await axios.get(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`, {
    timeout: 10_000, headers: { "User-Agent": UA, Accept: "application/json" },
  });
  const list = Array.isArray(r.data) ? (r.data as { id: number; nome: string }[]) : [];
  if (list.length) citiesByUf.set(uf, list);
  return list;
}

async function byZip(zip: string): Promise<IbgeCity | null> {
  const hit = zipCache.get(zip);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;
  let value: IbgeCity | null = null;
  try {
    const r = await axios.get(`https://viacep.com.br/ws/${zip}/json/`, { timeout: 6_000, headers: { "User-Agent": UA } });
    const d = r.data as { erro?: boolean; ibge?: string; localidade?: string; uf?: string; logradouro?: string; bairro?: string } | null;
    if (d && !d.erro && d.ibge) {
      value = { code: String(d.ibge), city: String(d.localidade ?? ""), state: String(d.uf ?? ""), street: String(d.logradouro ?? ""), district: String(d.bairro ?? "") };
    }
  } catch { /* cai para o IBGE por cidade */ }
  if (value) zipCache.set(zip, { at: Date.now(), value });
  return value;
}

export async function ibgeCityCode(input: { zip?: string | null; city?: string | null; state?: string | null }): Promise<IbgeCity | null> {
  const zip = String(input.zip ?? "").replace(/\D/g, "");
  if (zip.length === 8) {
    const found = await byZip(zip);
    if (found) return found;
  }
  const uf = String(input.state ?? "").trim().toUpperCase();
  const city = norm(String(input.city ?? ""));
  if (uf.length === 2 && city) {
    try {
      const hit = (await citiesOf(uf)).find((c) => norm(c.nome) === city);
      if (hit) return { code: String(hit.id), city: hit.nome, state: uf };
    } catch { /* sem resposta */ }
  }
  return null;
}
