// Leitor de PDFs de "pedido de venda" de fornecedor em tabela. Dois layouts conhecidos:
//
// 1) Pedido com blocos por pedido (código só numérico, sem coluna de unidade):
//      Pedido | Pedido Cli. | Tipo | Funcionário | Data Pedido | ...        (cabeçalho cinza de cada pedido)
//      Cod | Produto | Largura x Altura | Qtde. | M2 | Valor Unit. | Total
//      72325001  CH KIT10 AL PLACA - BC - FECHADURA ...   20,00  20,00  63,98  1.279,57
//      Resumo:   (tabela que repete tudo agregado — ignorada para não duplicar)
//    O nome quebra em duas linhas e o código/números ficam centralizados verticalmente entre elas; as
//    linhas de pedido também começam com um número longo (o número do pedido) e não são produto.
//
// 2) Pedido de distribuidora (código alfanumérico, com unidade):
//      Cód. Fábrica | Discriminação | Larg. x Alt. | M2 | Qtde | UN | Vr.Unitário | Valor Total
//      BX-105/PRETO   CADEIRINHA BOX CANTO PRETO              2   UN   43,56   87,12
//    A QUANTIDADE vem ANTES da unidade; depois dela vêm o valor unitário e o total. Em alguns PDFs a
//    unidade ("UN") sai um pouco mais alta que o resto da linha e o código pode vir em pedaços: por isso a
//    unidade é procurada pela proximidade vertical, e o código é montado juntando os pedaços da coluna.

export interface OrderRowItem { str: string; x: number }
export interface OrderRow { y: number; items: OrderRowItem[]; text: string }

export interface OrderTableProduct {
  sku: string; name: string; unit: string; qty: number; price: number; total: number;
}

const NUMBER = /^\d{1,3}(?:\.\d{3})*,\d+$|^\d+,\d+$|^\d+$/;
const UNITS = ["UN", "UND", "PC", "PÇ", "PÇA", "PEÇA", "PÇS", "PCS", "KG", "CX", "M", "MT", "M2", "PAR", "LT", "LIT", "RL", "JG", "KIT", "BR", "BARRA"];
const SKU_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._\/-]{2,}$/;
const parseBr = (value: string) => Number(value.replace(/\./g, "").replace(",", "."));
const norm = (value: string) => value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
const has = (row: OrderRow, ...words: string[]) => words.every((w) => norm(row.text).includes(norm(w)));

interface Anchor { row: OrderRow; sku: string; numerics: OrderRowItem[] }
interface Section {
  kind: "numeric" | "distributor";
  header: OrderRow;
  nameX: number;      // início da coluna do nome
  nameEndX: number;   // o nome termina antes disso
  numbersX: number;   // a partir daqui ficam os números (qtde, preço, total)
  anchors: Anchor[];
  endY: number | null;
  rows: OrderRow[];
}

function findHeaderItem(row: OrderRow, pattern: RegExp): OrderRowItem | undefined {
  return row.items.find((i) => pattern.test(norm(i.str)));
}

/** Percorre as páginas e devolve as seções de tabela encontradas (cabeçalho + linhas de item candidatas). */
function scan(pages: OrderRow[][]): Section[] {
  const sections: Section[] = [];
  let current: Section | null = null;
  let stopped = false;

  pages.forEach((rows) => {
    if (stopped) return;
    // as linhas chegam de cima para baixo (y decrescente)
    const ordered = [...rows].sort((a, b) => b.y - a.y);
    current = null; // a tabela só continua na página seguinte se o cabeçalho for repetido

    for (const row of ordered) {
      if (/^\s*resumo\b/i.test(row.text)) { stopped = true; break; }

      // layout 1: Cod | Produto | ... | Qtde.
      if (has(row, "cod", "produto", "qtde")) {
        const produto = findHeaderItem(row, /^produto$/);
        const qtd = findHeaderItem(row, /^qtde\.?$/);
        if (!produto || !qtd) continue;
        current = { kind: "numeric", header: row, nameX: produto.x, nameEndX: qtd.x - 12, numbersX: qtd.x - 12, anchors: [], endY: null, rows: [] };
        sections.push(current);
        continue;
      }

      // layout 2: Cód. Fábrica | Discriminação | ... | Qtde | UN | Vr.Unitário | Valor Total
      if (has(row, "discrimina", "qtde") && has(row, "unit")) {
        const nome = findHeaderItem(row, /^discrimina/);
        const qtd = findHeaderItem(row, /^qtde\.?$/);
        if (!nome || !qtd) continue;
        // o nome termina antes da primeira coluna à direita dele (Larg. x Alt., M2 ou Qtde)
        const rightColumns = row.items.filter((i) => i.x > nome.x + 20 && /^(larg|m2$|qtde)/.test(norm(i.str))).map((i) => i.x);
        const nameEnd = Math.min(qtd.x, ...rightColumns) - 6;
        current = { kind: "distributor", header: row, nameX: nome.x, nameEndX: nameEnd, numbersX: qtd.x - 25, anchors: [], endY: null, rows: [] };
        sections.push(current);
        continue;
      }

      // cabeçalho de pedido (layout 1): as linhas seguintes são do pedido, não produtos
      if (has(row, "pedido", "tipo") && has(row, "data")) {
        if (current && current.endY === null) current.endY = row.y;
        current = null;
        continue;
      }

      if (!current) continue;
      current.rows.push(row);

      const first = row.items[0];
      if (!first || first.x >= current.nameX) continue;

      if (current.kind === "numeric") {
        // código só numérico; valores: [qtde, m2, unitário, total]
        if (!/^\d{4,}$/.test(first.str)) continue;
        const numerics = row.items.filter((i) => i.x >= current!.numbersX && NUMBER.test(i.str));
        if (numerics.length < 3) continue;
        current.anchors.push({ row, sku: first.str, numerics });
      } else {
        // O código pode vir em pedaços ("BX-105" + "/PRETO"): junta tudo que está na coluna do código.
        const sku = row.items.filter((i) => i.x < current!.nameX - 4).map((i) => i.str).join("").trim();
        if (!SKU_PATTERN.test(sku) || !/\d/.test(sku)) continue;
        const numerics = row.items.filter((i) => i.x >= current!.numbersX && NUMBER.test(i.str));
        if (numerics.length < 2) continue;
        current.anchors.push({ row, sku, numerics });
      }
    }
  });
  return sections;
}

/** Quantidade, unidade, valor unitário e total de um item, conforme o layout da tabela. */
function readValues(section: Section, anchor: Anchor): { qty: number; unit: string; price: number; total: number } | null {
  const nums = [...anchor.numerics].sort((a, b) => a.x - b.x);

  if (section.kind === "numeric") {
    const values = nums.map((i) => parseBr(i.str));
    return { qty: values[0], unit: "UN", total: values[values.length - 1], price: values.length >= 4 ? values[2] : values[values.length - 2] };
  }

  // Distribuidora: a unidade fica entre a quantidade e o valor unitário. Procura pela proximidade vertical
  // (ela pode sair deslocada da linha do código), não exigindo que esteja na mesma linha.
  const y = anchor.row.y;
  let unitItem: OrderRowItem | undefined;
  let bestDy = Infinity;
  for (const r of section.rows) {
    const dy = Math.abs(r.y - y);
    if (dy > 14 || dy >= bestDy) continue;
    const hit = r.items.find((i) => i.x >= section.numbersX && UNITS.includes(i.str.trim().toUpperCase()));
    if (hit) { unitItem = hit; bestDy = dy; }
  }

  const values = nums.map((i) => ({ x: i.x, v: parseBr(i.str) }));
  if (unitItem) {
    const left = values.filter((n) => n.x < unitItem!.x);
    const right = values.filter((n) => n.x > unitItem!.x);
    const qty = left[left.length - 1]?.v;
    if (qty != null && right.length >= 1) {
      const total = right[right.length - 1].v;
      return { qty, unit: unitItem.str.trim().toUpperCase(), total, price: right.length >= 2 ? right[0].v : total / Math.max(1, qty) };
    }
  }
  // Sem unidade reconhecível: os três últimos números são quantidade, unitário e total.
  if (values.length >= 3) {
    const [q, p, t] = values.slice(-3).map((n) => n.v);
    return { qty: q, unit: "UN", price: p, total: t };
  }
  if (values.length === 2) return { qty: values[0].v, unit: "UN", price: values[1].v / Math.max(1, values[0].v), total: values[1].v };
  return null;
}

/** Procura a tabela de itens nas páginas. Retorna lista vazia se o PDF não tiver um layout conhecido. */
export function parseOrderTable(pages: OrderRow[][]): OrderTableProduct[] {
  const sections = scan(pages);
  const merged = new Map<string, OrderTableProduct>();

  for (const section of sections) {
    const anchors = section.anchors;
    anchors.forEach((anchor, i) => {
      const y = anchor.row.y;
      const prev = anchors[i - 1];
      const next = anchors[i + 1];
      // o bloco do item vai até o meio do caminho para os vizinhos (o nome pode quebrar acima e abaixo do código)
      const gapAbove = prev ? (prev.row.y - y) / 2 : Math.max(14, section.header.y - y - 4);
      const gapBelow = next ? (y - next.row.y) / 2 : Math.max(14, section.endY != null ? (y - section.endY) - 2 : 22);
      const top = y + gapAbove;
      const bottom = y - gapBelow;

      const name = section.rows
        .filter((r) => r.y <= top + 0.5 && r.y > bottom - 0.5)
        .sort((a, b) => b.y - a.y)
        .map((r) => r.items.filter((it) => it.x >= section.nameX - 4 && it.x < section.nameEndX).map((it) => it.str).join(" "))
        .join(" ")
        .replace(/\s*-?\s*lote\s+padr[aã]o\s*$/i, "")
        .replace(/\s+/g, " ")
        .trim();

      const vals = readValues(section, anchor);
      if (!vals || !name || !(vals.qty > 0) || !(vals.price > 0)) return;

      const existing = merged.get(anchor.sku);
      if (existing) {
        existing.qty += vals.qty;
        existing.total = Math.round((existing.total + vals.total) * 100) / 100;
        existing.price = Math.round((existing.total / existing.qty) * 100) / 100;
      } else {
        merged.set(anchor.sku, { sku: anchor.sku, name, unit: vals.unit, qty: vals.qty, price: vals.price, total: vals.total });
      }
    });
  }

  return [...merged.values()];
}

/**
 * Texto curto para o suporte quando nenhum produto é encontrado: diz o que o leitor enxergou
 * (cabeçalho reconhecido? quantas linhas de item? o PDF tem texto?), sem precisar abrir o arquivo.
 */
export function explainOrderTable(pages: OrderRow[][]): string {
  const rowCount = pages.reduce((n, p) => n + p.length, 0);
  if (rowCount === 0) return "O PDF não tem texto selecionável (parece uma imagem ou documento escaneado) — não é possível ler os produtos dele.";
  const sections = scan(pages);
  const sample = (rows: OrderRow[], n = 6) => rows.slice(0, n).map((r) => `«${r.text.slice(0, 90)}»`).join(" ");
  if (sections.length === 0) {
    const first = [...(pages[0] ?? [])].sort((a, b) => b.y - a.y);
    return `Cabeçalho da tabela não reconhecido (esperado: Cód./Produto ou Discriminação, Qtde e valor unitário). Linhas lidas no topo: ${sample(first, 8)}`;
  }
  const s = sections[0];
  const anchors = sections.reduce((n, x) => n + x.anchors.length, 0);
  const layout = s.kind === "distributor" ? "distribuidora (Discriminação)" : "pedido numérico (Cod/Produto)";
  return `Cabeçalho reconhecido (${layout}), mas ${anchors === 0 ? "nenhuma linha de item bateu com o formato" : "os itens não tinham quantidade/valor válidos"}. Linhas após o cabeçalho: ${sample(s.rows)}`;
}
