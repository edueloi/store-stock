import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import PDFDocument from "pdfkit";
import { buildReceiptFooterHtml, buildReceiptFooterText, getReceiptFooter, readReceiptFooterConfig, type ReceiptFooterConfig } from "../shared/receiptFooter";
import { buildOrderReceiptText, buildCashCloseReceiptText, type OrderReceiptOrder } from "../src/lib/thermalReceipt";
import { buildCupomText, generateDanfeA4Pdf, generateDanfePdf, type DanfeInput } from "../backend/services/nfce/danfe";
import { sanitizeStorefrontHeadings } from "../shared/storefrontHeadings";

const footer: ReceiptFooterConfig = { enabled: true, title: "POLÍTICA DE TROCA", message: "Trocas em até 3 dias após a compra, com a embalagem e a apresentação da nota." };
const policies = { receipt_footer: footer, warranty_days: 90, storefront: { hide_prices: false } };
const out = path.resolve("tmp/pdfs/receipt-footer");
await fs.mkdir(out, { recursive: true });
assert.deepEqual(sanitizeStorefrontHeadings(policies).receipt_footer, footer);

assert.equal(getReceiptFooter(undefined), null);
assert.equal(getReceiptFooter({ receipt_footer: { ...footer, enabled: false } }), null);
assert.equal(getReceiptFooter({ receipt_footer: { ...footer, message: "  " } }), null);
assert.equal(getReceiptFooter({ receipt_footer: "inválido" }), null);
assert.equal(buildReceiptFooterHtml({}), "");
assert.equal(buildReceiptFooterText({}), "");
for (const cols of [24, 32, 42, 64]) {
  const text = buildReceiptFooterText(policies, cols);
  assert.ok(text.split("\n").every(line => line.length <= cols));
  assert.ok(text.includes("POLÍTICA DE TROCA"));
  assert.ok(text.replace(/\s+/g, " ").includes(footer.message));
}
const escaped = buildReceiptFooterHtml({ receipt_footer: { ...footer, message: '<script>alert("teste")</script> & apresentação' } });
assert.ok(!escaped.includes("<script>"));
assert.ok(escaped.includes("&lt;script&gt;"));
assert.ok(escaped.includes("&amp; apresentação"));
assert.equal(readReceiptFooterConfig({ receipt_footer: { ...footer, message: "Ação\u001b\u0000" } }).message, "Ação");

const order: OrderReceiptOrder = { id: 1, created_at: "2026-11-18T15:30:00-03:00", customer_name: "Consumidor final", items: [{ product_name: "Produto de demonstração", quantity: 1, unit_price: 119.9 }], payment_method: "money:150", total_amount: 119.9 };
const saleText = buildOrderReceiptText({ name: "MY HOUSE - DEMONSTRAÇÃO", policies }, order);
assert.ok(saleText.includes("POLÍTICA DE TROCA"));
assert.ok(saleText.replace(/\s+/g, " ").includes(footer.message));
assert.ok(saleText.includes("119,90"));
assert.ok(saleText.includes("30,10"));
assert.ok(!buildOrderReceiptText({ name: "Outra loja" }, order).includes("POLÍTICA DE TROCA"));
assert.equal(buildOrderReceiptText({ name: "Outra loja", policies: { receipt_footer: { ...footer, enabled: false } } }, order), buildOrderReceiptText({ name: "Outra loja" }, order));
assert.ok(!buildCashCloseReceiptText("My House", "Operador", { opening_amount: 0, counted_amount: 0, expected_amount: 0, difference_amount: 0, payment_breakdown: {}, opened_at: order.created_at, closed_at: order.created_at }, {}).includes(footer.message));

const input: DanfeInput = {
  receiptFooter: getReceiptFooter(policies), storeName: "MY HOUSE - DEMONSTRAÇÃO", storeDocument: "CNPJ: 00.000.000/0000-00", storeAddress: "Rua de Exemplo, 100 - Cidade/UF",
  chaveAcesso: "35261100000000000000650010000000011000000010", numero: 1, serie: 1, emittedAt: new Date(order.created_at), environment: "homologacao", protocol: "000000000000000",
  items: [{ name: "Produto de demonstração", quantity: 1, unit: "UN", unitPrice: 119.9, total: 119.9 }], totalAmount: 119.9, changeAmount: 30.1,
  qrCodeUrl: "https://example.invalid/consulta", paymentSummary: "Dinheiro: R$ 150,00", customerLabel: "CONSUMIDOR NÃO IDENTIFICADO",
};
for (const cols of [24, 32, 42, 64]) {
  const text = buildCupomText(input, cols);
  assert.ok(text.replace(/\s+/g, " ").includes(footer.message));
  assert.ok(text.includes("[[QR:https://example.invalid/consulta]]"));
  assert.ok(text.indexOf("POLÍTICA DE TROCA") > text.indexOf("[[QR:"));
}
assert.ok(!buildCupomText({ ...input, receiptFooter: null }).includes("POLÍTICA DE TROCA"));

await fs.writeFile(path.join(out, "cupom-fiscal-80mm.pdf"), await generateDanfePdf(input));
await fs.writeFile(path.join(out, "danfe-a4.pdf"), await generateDanfeA4Pdf(input));
await fs.writeFile(path.join(out, "cupom-venda.txt"), saleText, "utf8");
await fs.writeFile(path.join(out, "rodape.html"), buildReceiptFooterHtml(policies), "utf8");
await new Promise<void>((resolve, reject) => {
  const doc = new PDFDocument({ size: [226.77, 650], margin: 10 });
  const chunks: Buffer[] = [];
  doc.on("data", chunk => chunks.push(chunk));
  doc.on("error", reject);
  doc.on("end", () => fs.writeFile(path.join(out, "cupom-venda-80mm.pdf"), Buffer.concat(chunks)).then(() => resolve(), reject));
  doc.font("Courier").fontSize(8).text(saleText, 10, 10, { width: 206.77, lineGap: 1 });
  doc.end();
});
console.log("OK: rodapé opcional por loja, desativação, UTF-8, escape HTML, quebra em 24/32/42/64 colunas, venda/reimpressão e NFC-e; totais e QR Code preservados.");
console.log(`Amostras de demonstração: ${out}`);
