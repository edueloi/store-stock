import axios from "axios";

// Código IBGE do município (7 dígitos): obrigatório no endereço do DESTINATÁRIO da NF-e (cMun).
// 1) ViaCEP devolve o código direto do CEP; 2) se não achar, a API oficial do IBGE por UF + nome do município.

const UA = "BoxSys/1.0 (+https://store.boxsys.com.br)";

const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

const citiesByUf = new Map<string, { id: number; nome: string }[]>();

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

export interface IbgeCity { code: string; city: string; state: string }

export async function ibgeCityCode(input: { zip?: string | null; city?: string | null; state?: string | null }): Promise<IbgeCity | null> {
  const zip = String(input.zip ?? "").replace(/\D/g, "");
  if (zip.length === 8) {
    try {
      const r = await axios.get(`https://viacep.com.br/ws/${zip}/json/`, { timeout: 8_000, headers: { "User-Agent": UA } });
      const d = r.data as { erro?: boolean; ibge?: string; localidade?: string; uf?: string } | null;
      if (d && !d.erro && d.ibge) return { code: String(d.ibge), city: String(d.localidade ?? ""), state: String(d.uf ?? "") };
    } catch { /* tenta o IBGE */ }
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
