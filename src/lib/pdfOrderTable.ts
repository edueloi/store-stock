// Leitor do PDF de "pedido de venda" de fornecedor em tabela:
//
//   Pedido | Pedido Cli. | Tipo | Funcionário | Data Pedido | ...        (cabeçalho cinza de cada pedido)
//   Cod | Produto | Largura x Altura | Qtde. | M2 | Valor Unit. | Total  (cabeçalho dos itens)
//   72325001  CH KIT10 AL PLACA - BC - FECHADURA ...   20,00  20,00  63,98  1.279,57
//   ...
//   Resumo:   (tabela que repete tudo agregado — ignorada para não duplicar)
//
// Particularidades deste formato: não existe coluna de unidade; o nome do produto quebra em duas
// linhas e o código e os números ficam centralizados verticalmente entre elas; as linhas de pedido
// também começam com um número longo (o número do pedido) e não podem ser confundidas com produto.

export interface OrderRowItem { str: string; x: number }
export interface OrderRow { y: number; items: OrderRowItem[]; text: string }

export interface OrderTableProduct {
  sku: string; name: string; unit: string; qty: number; price: number; total: number;
}

const NUMBER = /^\d{1,3}(?:\.\d{3})*,\d+$|^\d+,\d+$|^\d+$/;
const parseBr = (value: string) => Number(value.replace(/\./g, "").replace(",", "."));
const has = (row: OrderRow, ...words: string[]) => words.every((w) => row.text.toLowerCase().includes(w.toLowerCase()));

interface Anchor { row: OrderRow; sku: string; values: number[]; page: number }
interface Section { header: OrderRow; produtoX: number; qtdX: number; anchors: Anchor[]; endY: number | null; page: number; rows: OrderRow[] }

/** Procura a tabela de itens nas páginas. Retorna lista vazia se o PDF não tiver esse formato. */
export function parseOrderTable(pages: OrderRow[][]): OrderTableProduct[] {
  const sections: Section[] = [];
  let current: Section | null = null;
  let stopped = false;

  pages.forEach((rows, pageIndex) => {
    if (stopped) return;
    // as linhas chegam de cima para baixo (y decrescente)
    const ordered = [...rows].sort((a, b) => b.y - a.y);
    // seção que continua na página seguinte começa de novo no topo, mas só vale se houver novo cabeçalho
    if (current) { current.endY = null; current = null; }

    for (const row of ordered) {
      if (/^\s*resumo\b/i.test(row.text)) { stopped = true; break; }

      if (has(row, "cod", "produto", "qtde")) {
        const produto = row.items.find((i) => /^produto$/i.test(i.str));
        const qtd = row.items.find((i) => /^qtde\.?$/i.test(i.str));
        if (!produto || !qtd) continue;
        current = { header: row, produtoX: produto.x, qtdX: qtd.x, anchors: [], endY: null, page: pageIndex, rows: [] };
        sections.push(current);
        continue;
      }

      // cabeçalho de pedido: encerra a seção de itens atual (as linhas seguintes são do pedido, não produtos)
      if (has(row, "pedido", "tipo") && has(row, "data")) {
        if (current && current.endY === null) current.endY = row.y;
        current = null;
        continue;
      }

      if (!current) continue;
      current.rows.push(row);

      // linha-âncora do item: começa por código numérico e tem valores nas colunas da direita
      const first = row.items[0];
      if (first && /^\d{4,}$/.test(first.str) && first.x < current.produtoX) {
        const values = row.items
          .filter((i) => i.x >= current!.qtdX - 12 && NUMBER.test(i.str))
          .map((i) => parseBr(i.str));
        if (values.length >= 3) current.anchors.push({ row, sku: first.str, values, page: pageIndex });
      }
    }
    if (current && current.endY === null) {
      // seção que vai até o fim da página
      current.endY = null;
    }
  });

  const merged = new Map<string, OrderTableProduct>();

  for (const section of sections) {
    const anchors = section.anchors;
    anchors.forEach((anchor, i) => {
      const y = anchor.row.y;
      const prev = anchors[i - 1];
      const next = anchors[i + 1];
      // o bloco do item vai até o meio do caminho para os vizinhos (o nome quebra acima e abaixo do código)
      const gapAbove = prev ? (prev.row.y - y) / 2 : Math.max(14, section.header.y - y - 4);
      const gapBelow = next ? (y - next.row.y) / 2 : Math.max(14, section.endY != null ? (y - section.endY) - 2 : 40);
      const top = y + gapAbove;
      const bottom = y - gapBelow;

      const nameParts = section.rows
        .filter((r) => r.y <= top + 0.5 && r.y > bottom - 0.5)
        .sort((a, b) => b.y - a.y)
        .map((r) => r.items
          .filter((i) => i.x >= section.produtoX - 4 && i.x < section.qtdX - 12 && !(r === anchor.row && NUMBER.test(i.str) && i.x >= section.qtdX - 12))
          .map((i) => i.str)
          .join(" "))
        .join(" ");

      const name = nameParts
        .replace(/\s*-?\s*lote\s+padr[aã]o\s*$/i, "")
        .replace(/\s+/g, " ")
        .trim();

      const values = anchor.values;
      const qty = values[0];
      const total = values[values.length - 1];
      const price = values.length >= 4 ? values[2] : values[values.length - 2];
      if (!name || !(qty > 0) || !(price > 0)) return;

      const existing = merged.get(anchor.sku);
      if (existing) {
        existing.qty += qty;
        existing.total = Math.round((existing.total + total) * 100) / 100;
        existing.price = Math.round((existing.total / existing.qty) * 100) / 100;
      } else {
        merged.set(anchor.sku, { sku: anchor.sku, name, unit: "UN", qty, price, total });
      }
    });
  }

  return [...merged.values()];
}
