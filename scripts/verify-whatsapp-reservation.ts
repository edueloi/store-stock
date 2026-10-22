import { test } from "node:test";
import assert from "node:assert/strict";
import { createHeldSaleFromWhatsapp, expireWhatsappReservations } from "../backend/services/whatsapp-held-sale.service";
import { whatsappReservationExpiry } from "../backend/services/whatsapp-reservation";
import { heldSaleMatchesSearch } from "../src/lib/heldSales";

type Row = Record<string, any>;
function fixture() {
  let state: Row = {
    product: { id: 1, tenant_id: 1, name: "Bolsa Ação", stock_quantity: 2, skus: [{ combo: { Cor: "Preto" }, stock: 2 }], variations: [], sale_unit: "unidade", price: 210, discount_price: 189.9 },
    sales: [], movements: [], actions: [],
  };
  let failMovement = false;
  const matches = (row: Row, where: Row = {}) => Object.entries(where).every(([key, value]) => {
    if (value && typeof value === "object") {
      if ("in" in value) return value.in.includes(row[key]);
      if ("startsWith" in value) return (row[key] || "").startsWith(value.startsWith);
      if ("contains" in value) return (row[key] || "").includes(value.contains);
    }
    return row[key] === value;
  });
  const model = (s: Row): any => ({
    product: {
      findFirst: async ({ where }: Row) => matches(s.product, where) ? structuredClone(s.product) : null,
      findUnique: async () => structuredClone(s.product),
      update: async ({ data }: Row) => { for (const [key, value] of Object.entries(data)) s.product[key] = key === "stock_quantity" ? s.product[key] + ((value as Row).increment || -(value as Row).decrement) : value; return s.product; },
    },
    heldSale: {
      findMany: async ({ where }: Row) => s.sales.filter((r: Row) => matches(r, where)),
      findFirst: async ({ where, orderBy }: Row) => orderBy ? s.sales.at(-1) || null : s.sales.find((r: Row) => matches(r, where)) || null,
      create: async ({ data }: Row) => { const row = { ...data, id: s.sales.length + 1, status: "held", items: data.items.create.map((it: Row, i: number) => ({ ...it, id: i + 1, held_sale_id: s.sales.length + 1, resolution: "pending" })) }; s.sales.push(row); return row; },
      updateMany: async ({ where, data }: Row) => { const row = s.sales.find((r: Row) => matches(r, where)); if (!row) return { count: 0 }; Object.assign(row, data); return { count: 1 }; },
    },
    heldSaleItem: {
      findMany: async ({ where }: Row) => s.sales.flatMap((r: Row) => r.items).filter((r: Row) => matches(r, where)),
      update: async ({ where, data }: Row) => Object.assign(s.sales.flatMap((r: Row) => r.items).find((r: Row) => matches(r, where)), data),
    },
    stockMovement: { create: async ({ data }: Row) => { if (failMovement) throw new Error("auditoria indisponível"); s.movements.push(data); return data; } },
    heldSaleAction: { create: async ({ data }: Row) => { s.actions.push(data); return data; } },
  });
  const database: any = {
    heldSale: { findMany: async (args: Row) => model(state).heldSale.findMany(args) },
    $transaction: async (fn: (tx: any) => Promise<any>) => { const copy = structuredClone(state); const result = await fn(model(copy)); state = copy; return result; },
  };
  return { database, get state() { return state; }, failMovement() { failMovement = true; } };
}
const request = (extra: Row = {}) => ({ tenantId: 1, customerName: "Karen Ação", customerPhone: "5515999999999", items: [{ id: 1, qty: 1, options: { Cor: "Preto" } }], ...extra });

test("balcão localiza por nome, telefone com máscara ou número impresso no PDF", () => {
  const sale = { number: 8, customer_name: "Karen Ação", customer_phone: "5515996093492" };
  for (const search of ["Karen", "acao", "(15) 99609-3492", "15996093492", "+55 (15) 99609-3492", "000008", "#000008"]) assert.ok(heldSaleMatchesSearch(sale, search), search);
  for (const search of ["Mariana", "11912345678", "#000009", "Karen999"]) assert.equal(heldSaleMatchesSearch(sale, search), false, search);
});

test("reserva usa preço real, grava 24 horas e reserva a SKU", async () => {
  const db = fixture();
  const receipt = await createHeldSaleFromWhatsapp(request(), db.database);
  assert.equal(receipt.total, 189.9);
  assert.equal(receipt.expiresAt.getTime() - receipt.createdAt.getTime(), 86_400_000);
  assert.equal(whatsappReservationExpiry(db.state.sales[0].snapshot)?.getTime(), receipt.expiresAt.getTime());
  assert.equal(db.state.product.stock_quantity, 1);
  assert.equal(db.state.product.skus[0].stock, 1);
  await assert.rejects(createHeldSaleFromWhatsapp(request(), db.database), /já tem a reserva/);
  assert.equal(db.state.sales.length, 1);
});

test("expiração no limite exato devolve estoque uma única vez e preserva antes do prazo", async () => {
  const db = fixture();
  const receipt = await createHeldSaleFromWhatsapp(request(), db.database);
  await expireWhatsappReservations({}, new Date(receipt.expiresAt.getTime() - 1), db.database);
  assert.equal(db.state.sales[0].status, "held");
  await expireWhatsappReservations({}, receipt.expiresAt, db.database);
  await expireWhatsappReservations({}, receipt.expiresAt, db.database);
  assert.equal(db.state.product.stock_quantity, 2);
  assert.equal(db.state.product.skus[0].stock, 2);
  assert.equal(db.state.sales[0].status, "cancelled");
  assert.equal(db.state.movements.filter((r: Row) => r.type === "held_sale_return").length, 1);
});

test("comanda comum, reserva concluída e outro tenant não são expirados", async () => {
  const db = fixture();
  const receipt = await createHeldSaleFromWhatsapp(request(), db.database);
  await expireWhatsappReservations({ tenantId: 2 }, receipt.expiresAt, db.database);
  assert.equal(db.state.sales[0].status, "held");
  db.state.sales[0].snapshot = {};
  await expireWhatsappReservations({}, receipt.expiresAt, db.database);
  assert.equal(db.state.sales[0].status, "held");
  db.state.sales[0].snapshot = { whatsappReservation: { expiresAt: receipt.expiresAt.toISOString() } };
  db.state.sales[0].status = "completed";
  await expireWhatsappReservations({}, receipt.expiresAt, db.database);
  assert.equal(db.state.product.stock_quantity, 1);
});

test("itens repetidos não excedem estoque; erro de auditoria desfaz toda a operação", async () => {
  const db = fixture();
  await assert.rejects(createHeldSaleFromWhatsapp(request({ items: [{ id: 1, qty: 2, options: { Cor: "Preto" } }, { id: 1, qty: 1, options: { Cor: "Preto" } }] }), db.database), /sem estoque/);
  assert.equal(db.state.product.stock_quantity, 2);
  assert.equal(db.state.sales.length, 0);
  db.failMovement();
  await assert.rejects(createHeldSaleFromWhatsapp(request(), db.database), /auditoria/);
  assert.equal(db.state.product.stock_quantity, 2);
  assert.equal(db.state.sales.length, 0);
});

test("variação legada e reserva retomada são liberadas sem perder opções", async () => {
  const db = fixture();
  db.state.product.skus = [];
  db.state.product.variations = [{ name: "Cor", options: [{ value: "Preto", stock: 2 }] }];
  const receipt = await createHeldSaleFromWhatsapp(request(), db.database);
  assert.equal(db.state.product.variations[0].options[0].stock, 1);
  db.state.sales[0].status = "resumed";
  await expireWhatsappReservations({}, receipt.expiresAt, db.database);
  assert.equal(db.state.product.variations[0].options[0].stock, 2);
});

test("falha durante expiração não cancela nem devolve estoque parcialmente", async () => {
  const db = fixture();
  const receipt = await createHeldSaleFromWhatsapp(request(), db.database);
  db.failMovement();
  await assert.rejects(expireWhatsappReservations({}, receipt.expiresAt, db.database), /auditoria/);
  assert.equal(db.state.sales[0].status, "held");
  assert.equal(db.state.sales[0].items[0].resolution, "pending");
  assert.equal(db.state.product.stock_quantity, 1);
  assert.equal(db.state.product.skus[0].stock, 1);
});
