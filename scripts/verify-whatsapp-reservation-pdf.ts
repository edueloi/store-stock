import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { createWhatsappReservationPdf } from "../backend/services/whatsapp-reservation-pdf.service";

const directory = path.resolve(process.env.RESERVATION_PDF_OUTPUT || "tmp/pdfs/whatsapp-reservation");
await mkdir(directory, { recursive: true });
const logo = await sharp(Buffer.from('<svg width="150" height="100"><rect width="150" height="100" fill="white"/><text x="15" y="60" font-family="sans-serif" font-size="30">DEMO</text></svg>')).webp().toBuffer();
const input = {
  storeName: "Loja Demonstração - Ação e Conexão",
  storePhone: "5515998521070", storeDocument: "12345678000190",
  storeAddress: "Rua da Inovação, 120, Sala 2 - Centro - São Paulo/SP - CEP 01001-000",
  logoBuffer: logo, number: 8, customerName: "Karen Ação", customerPhone: "5515999999999",
  createdAt: new Date("2026-10-22T17:41:00Z"), expiresAt: new Date("2026-10-23T17:41:00Z"),
  items: [{ name: "Bolsa Shoulder Luna", quantity: 1, unit_price: 189.9, selected_options: { Cor: "Preto" } }], total: 189.9,
};
if (process.env.WHATSAPP_PDF_STORE) {
  const store = JSON.parse((await readFile(process.env.WHATSAPP_PDF_STORE, "utf8")).replace(/^\uFEFF/, ""));
  input.storeName = store.name;
  input.storePhone = store.whatsapp || "";
  input.storeDocument = store.document || "";
  input.storeAddress = [
    [store.address_street, store.address_number, store.address_complement].filter(Boolean).join(", "),
    store.address_district, [store.address_city, store.address_state].filter(Boolean).join("/"),
    store.address_zip ? `CEP ${String(store.address_zip).replace(/\D/g, "").replace(/^(\d{5})(\d{3})$/, "$1-$2")}` : "",
  ].filter(Boolean).join(" - ") || store.address || "";
  input.logoBuffer = process.env.WHATSAPP_PDF_LOGO ? await readFile(process.env.WHATSAPP_PDF_LOGO) : Buffer.alloc(0);
}
const simple = await createWhatsappReservationPdf(input);
assert.equal(simple.subarray(0, 5).toString(), "%PDF-");
await writeFile(path.join(directory, "comprovante-reserva.pdf"), simple);
const items = Array.from({ length: 8 }, (_, i) => ({
  name: `Produto ${i + 1} - Bolsa Ação com compartimentos, alça ajustável, acabamento especial e acessórios para uso diário`,
  quantity: 2, unit_price: 189.9, selected_options: { Cor: "Caramelo", Tamanho: "Grande", Acabamento: "Personalização especial" },
}));
await writeFile(path.join(directory, "comprovante-reserva-multipagina.pdf"), await createWhatsappReservationPdf({ ...input, items, total: 3038.4 }));
await writeFile(path.join(directory, "comprovante-reserva-sem-logo.pdf"), await createWhatsappReservationPdf({ ...input, logoBuffer: Buffer.from("imagem inválida"), storeAddress: "", storeDocument: "" }));
console.log("Comprovantes de teste gerados em", directory);
