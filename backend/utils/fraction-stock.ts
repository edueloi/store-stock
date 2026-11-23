import type { Prisma } from "@prisma/client";

import { prisma } from "../config/prisma";

// Estoque de FRAÇÃO de unidade (ex.: meia barra).
// O estoque do produto continua em unidades inteiras (stock_quantity). Quando se vende só uma parte, a outra parte
// fica como "sobra" em products.fraction_leftover (0 a <1): a próxima fração sai primeiro da sobra e só abre uma
// unidade nova quando a sobra não basta. Ao devolver/cancelar, a fração volta para a sobra e, ao completar uma
// unidade inteira, ela volta para stock_quantity.

type Db = Prisma.TransactionClient | typeof prisma;

const r4 = (n: number) => Math.round(n * 10000) / 10000;
const EPS = 1e-6;

async function withLock<T>(db: Db, fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  if ("$transaction" in db) return (db as typeof prisma).$transaction(fn);
  return fn(db as Prisma.TransactionClient);
}

/** Quanto do produto ainda dá para vender, em unidades (inteiras + sobra). */
export async function fractionAvailable(productId: number, tenantId: number, db: Db = prisma): Promise<number> {
  const p = await db.product.findFirst({ where: { id: productId, tenant_id: tenantId }, select: { stock_quantity: true, fraction_leftover: true } });
  return p ? p.stock_quantity + Number(p.fraction_leftover) : 0;
}

/** Baixa `units` (ex.: 0.5) do estoque. Devolve false se não houver saldo suficiente (nada é alterado). */
export async function consumeFractionStock(productId: number, tenantId: number, units: number, db: Db = prisma): Promise<boolean> {
  if (!(units > 0)) return true;
  return withLock(db, async (tx) => {
    const rows = await tx.$queryRaw<{ stock_quantity: number; fraction_leftover: unknown }[]>`
      SELECT stock_quantity, fraction_leftover FROM products WHERE id = ${productId} AND tenant_id = ${tenantId} FOR UPDATE`;
    const row = rows[0];
    if (!row) return false;
    let stock = Number(row.stock_quantity);
    let leftover = Number(row.fraction_leftover);
    if (leftover + EPS >= units) {
      leftover -= units;
    } else {
      const bars = Math.ceil(units - leftover - EPS); // unidades inteiras que precisam ser abertas
      if (bars > stock) return false;
      stock -= bars;
      leftover = leftover + bars - units;
    }
    if (leftover < 0.0005) leftover = 0; // resíduo de arredondamento (ex.: 3 × 1/3)
    await tx.product.update({ where: { id: productId }, data: { stock_quantity: stock, fraction_leftover: r4(Math.max(0, leftover)) } });
    return true;
  });
}

/** Devolve `units` ao estoque (cancelamento/devolução). A sobra que completa uma unidade volta para o estoque inteiro. */
export async function restoreFractionStock(productId: number, tenantId: number, units: number, db: Db = prisma): Promise<void> {
  if (!(units > 0)) return;
  await withLock(db, async (tx) => {
    const rows = await tx.$queryRaw<{ stock_quantity: number; fraction_leftover: unknown }[]>`
      SELECT stock_quantity, fraction_leftover FROM products WHERE id = ${productId} AND tenant_id = ${tenantId} FOR UPDATE`;
    const row = rows[0];
    if (!row) return;
    let leftover = Number(row.fraction_leftover) + units;
    const whole = Math.floor(leftover + EPS);
    leftover -= whole;
    await tx.product.update({
      where: { id: productId },
      data: { stock_quantity: Number(row.stock_quantity) + whole, fraction_leftover: r4(Math.max(0, leftover)) },
    });
  });
}

/** Valida e normaliza a fração enviada pelo PDV (0 < f < 1, 4 casas) — null se não for fração. */
export function normalizeFraction(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const f = r4(Number(value));
  return Number.isFinite(f) && f > 0 && f < 1 ? f : null;
}
