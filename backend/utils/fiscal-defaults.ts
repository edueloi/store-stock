import { prisma } from "../config/prisma";

// Sugestão de dados fiscais (NCM/CEST) a partir do NOME do produto.
// 1) produtos parecidos da PRÓPRIA loja (mesmas 2 primeiras palavras, ou 1ª palavra dominante) → copia NCM e CEST;
// 2) dicionário padrão por palavra-chave (NCMs conferidos na tabela oficial).
// É só uma sugestão: o contador da loja deve confirmar. CFOP/CSOSN/origem já têm padrão no cadastro.

export interface FiscalSuggestion {
  ncm: string;
  cest: string | null;
  source: "loja" | "padrao";
  /** texto curto do que foi usado (nome do produto parecido ou categoria do dicionário) */
  label: string;
}

const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

// [palavra-chave sobre o nome normalizado, NCM, descrição]. A primeira que casar vence.
const DEFAULTS: [RegExp, string, string][] = [
  [/\bcarimbo\b/, "96110000", "Carimbos"],
  [/\bcaneta\b/, "96081000", "Canetas esferográficas"],
  [/\bcaderno\b|\bcaderneta\b/, "48202000", "Cadernos"],
  [/\bagenda\b|\bplanner\b/, "48201000", "Agendas e blocos"],
  [/\b(bolsa|mochila|sacola|necessaire|estojo|mala)\b/, "42029200", "Bolsas e mochilas"],
  [/\bguarda chuva\b/, "66019900", "Guarda-chuvas"],
  [/\bcamiseta\b/, "61091000", "Camisetas de algodão"],
  [/\bpolo\b/, "61051000", "Camisas polo"],
  [/\bgarrafa (termica|inox)\b|\bcopo termico\b/, "96170010", "Garrafas e copos térmicos"],
  [/\bcaneca\b.*\bporcelana\b/, "69111090", "Louça de porcelana"],
  [/\bcopo twister\b/, "39241000", "Utensílios de mesa de plástico"],
  [/\btaca\b|\blong drink\b/, "70133700", "Copos e taças de vidro"],
  [/\bfolheto\b|\bcartao de visita\b/, "49111090", "Impressos publicitários"],
  [/\bbanner\b|\bfaixa\b/, "49119900", "Outros impressos"],
  [/\badesivo\b/, "39199090", "Adesivos de plástico"],
  [/\bmouse pad\b|\bmousepad\b/, "40169990", "Mouse pad de borracha"],
  [/\bmouse\b/, "84716053", "Mouse"],
  [/\bteclado\b/, "84716052", "Teclado"],
  [/\bfone\b|\bheadset\b|\bheadphone\b/, "85183000", "Fones de ouvido"],
  [/\bpower ?bank\b/, "85076000", "Acumuladores de íon de lítio"],
  [/\bcarregador\b/, "85044010", "Carregadores de acumuladores"],
  [/\bcabo\b/, "85444200", "Cabos com conectores"],
  [/\bpilha\b/, "85061019", "Pilhas"],
  [/\bcapinha\b|\bcapa (de|para) celular\b/, "39269090", "Outras obras de plástico"],
  [/\bcadeado\b/, "83011000", "Cadeados"],
  [/\bfechadura\b/, "83014000", "Fechaduras"],
  [/\bdobradica\b/, "83021000", "Dobradiças"],
  [/\broldana\b|\bcarrinho\b.*\btrilho\b/, "83024900", "Roldanas e rodízios"],
  [/\bbox\b.*\b(vidro|temperado|incolor)\b|\bvidro temperado\b/, "70071900", "Vidro temperado"],
  [/\bsilicone\b|\bselante\b/, "32141010", "Mástique e selantes"],
  [/\bbroca\b/, "82075019", "Brocas"],
  [/\btubo\b.*\balumin/, "76042100", "Perfis ocos de alumínio"],
  [/\btrilho\b|\bperfil\b.*\balumin/, "76042920", "Perfis de alumínio"],
  [/\bcaixa de som\b|\bspeaker\b/, "85182200", "Alto-falantes"],
  [/\bnotebook\b/, "84713012", "Notebooks"],
  [/\bmonitor\b/, "85285200", "Monitores"],
  [/\bcalculadora\b/, "84701000", "Calculadoras"],
];

type Counts = Map<string, number>;
function topOf(map: Map<string, Counts>, key: string) {
  const c = map.get(key);
  if (!c) return null;
  const tot = [...c.values()].reduce((a, b) => a + b, 0);
  const [ncm, cnt] = [...c.entries()].sort((a, b) => b[1] - a[1])[0];
  return { ncm, share: cnt / tot, tot };
}

export async function suggestFiscal(tenantId: number, rawName: string): Promise<FiscalSuggestion | null> {
  const name = norm(rawName);
  const words = name.split(" ").filter(Boolean);
  if (name.length < 3) return null;

  // 1) produtos parecidos da loja
  if (words[0].length >= 3) {
    const rows = await prisma.product.findMany({
      where: { tenant_id: tenantId, name: { startsWith: rawName.trim().split(/\s+/)[0] }, ncm: { not: null } },
      select: { name: true, ncm: true, cest: true },
      take: 400,
    });
    const known = rows
      .map((r) => ({ n: norm(r.name), ncm: String(r.ncm ?? ""), cest: r.cest ? String(r.cest) : null }))
      .filter((r) => /^\d{8}$/.test(r.ncm) && r.ncm !== "00000000");
    if (known.length) {
      const build = (keyFn: (n: string) => string) => {
        const m = new Map<string, Counts>();
        for (const k of known) {
          const key = keyFn(k.n);
          const c = m.get(key) ?? new Map<string, number>();
          c.set(k.ncm, (c.get(k.ncm) ?? 0) + 1);
          m.set(key, c);
        }
        return m;
      };
      const first2 = build((n) => n.split(" ").slice(0, 2).join(" "));
      const first1 = build((n) => n.split(" ")[0]);
      const a = topOf(first2, words.slice(0, 2).join(" "));
      const b = topOf(first1, words[0]);
      const pick = a && a.share >= 0.7 ? a : b && b.tot >= 3 && b.share >= 0.8 ? b : null;
      if (pick) {
        const cestCounts = new Map<string, number>();
        for (const k of known) if (k.ncm === pick.ncm && k.cest) cestCounts.set(k.cest, (cestCounts.get(k.cest) ?? 0) + 1);
        const cest = [...cestCounts.entries()].sort((x, y) => y[1] - x[1])[0]?.[0] ?? null;
        const sample = known.find((k) => k.ncm === pick.ncm);
        return { ncm: pick.ncm, cest, source: "loja", label: sample ? `produtos parecidos da sua loja (ex.: ${rows.find((r) => norm(r.name) === sample.n)?.name ?? "—"})` : "produtos parecidos da sua loja" };
      }
    }
  }

  // 2) dicionário padrão
  const hit = DEFAULTS.find(([rx]) => rx.test(name));
  return hit ? { ncm: hit[1], cest: null, source: "padrao", label: hit[2] } : null;
}
