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
//    Aqui a QUANTIDADE vem ANTES da unidade; depois da unidade vêm o valor unitário e o total.

export interface OrderRowItem { str: string; x: number }
export interface OrderRow { y: number; items: OrderRowItem[]; text: string }

export interface OrderTableProduct {
  sku: string; name: string; unit: string; qty: number; price: number; total: number;
}

const NUMBER = /^\d{1,3}(?:\.\d{3})*,\d+$|^\d+,\d+$|^\d+$/;
const UNITS = ["UN", "PC", "PÇ", "PÇA", "PEÇA", "PÇS", "PCS", "KG", "CX", "M", "MT", "M2", "PAR", "LT", "LIT", "RL", "JG", "KIT", "BR", "BARRA"];
const parseBr = (value: string) => Number(value.replace(/\./g, "").replace(",", "."));
const norm = (value: string) => value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
const has = (row: OrderRow, ...words: string[]) => words.every((w) => norm(row.text).includes(norm(w)));

interface Anchor { row: OrderRow; sku: string; unit: string; qty: number; price: number; total: number }
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

/** Procura a tabela de itens nas páginas. Retorna lista vazia se o PDF não tiver um layout conhecido. */
export function parseOrderTable(pages: OrderRow[][]): OrderTableProduct[] {
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
        const values = row.items.filter((i) => i.x >= current!.numbersX && NUMBER.test(i.str)).map((i) => parseBr(i.str));
        if (values.length < 3) continue;
        current.anchors.push({
          row, sku: first.str, unit: "UN",
          qty: values[0], total: values[values.length - 1], price: values.length >= 4 ? values[2] : values[values.length - 2],
        });
      } else {
        // código alfanumérico (pode ter - . / _) com pelo menos um dígito
        if (!/^[A-Za-z0-9][A-Za-z0-9._\/-]{2,}$/.test(first.str) || !/\d/.test(first.str)) continue;
        const unitItem = row.items.find((i) => i.x >= current!.numbersX && UNITS.includes(i.str.toUpperCase()));
        if (!unitItem) continue;
        const numbers = row.items.filter((i) => i.x >= current!.numbersX && NUMBER.test(i.str));
        const before = numbers.filter((i) => i.x < unitItem.x);
        const after = numbers.filter((i) => i.x > unitItem.x);
        const qtyItem = before[before.length - 1];   // o número colado na unidade, à esquerda dela
        if (!qtyItem || after.length < 1) continue;
        const total = parseBr(after[after.length - 1].str);
        const price = after.length >= 2 ? parseBr(after[0].str) : total / Math.max(1, parseBr(qtyItem.str));
        current.anchors.push({ row, sku: first.str, unit: unitItem.str.toUpperCase(), qty: parseBr(qtyItem.str), price, total });
      }
    }
  });

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

      if (!name || !(anchor.qty > 0) || !(anchor.price > 0)) return;

      const existing = merged.get(anchor.sku);
      if (existing) {
        existing.qty += anchor.qty;
        existing.total = Math.round((existing.total + anchor.total) * 100) / 100;
        existing.price = Math.round((existing.total / existing.qty) * 100) / 100;
      } else {
        merged.set(anchor.sku, { sku: anchor.sku, name, unit: anchor.unit, qty: anchor.qty, price: anchor.price, total: anchor.total });
      }
    });
  }

  return [...merged.values()];
}
