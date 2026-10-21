import { test } from "node:test";
import assert from "node:assert/strict";
import { sanitizeStorefrontHeadings } from "../shared/storefrontHeadings";

test("remove e-mail isolado dos títulos sem alterar contatos e configurações da loja", () => {
  const policies = { returns: "Troca em 7 dias", storefront: {
    home_featured_title: "  acesso@example.test  ", catalog_title: "Catálogo da Ação", glass_quote_enabled: true,
    order_notification_emails: "pedidos@example.test", delivery: { pickup_enabled: true },
    glass_content: { intro_title: "acesso@example.test", closing_title: "Sua melhor escolha.", footer_description: "Contato: contato@example.test" },
  } };
  const result = sanitizeStorefrontHeadings(policies);
  const expected: any = structuredClone(policies);
  delete expected.storefront.home_featured_title; delete expected.storefront.glass_content.intro_title;
  assert.deepEqual(result, expected);
  assert.equal(policies.storefront.home_featured_title, "  acesso@example.test  ");
  assert.equal(policies.storefront.glass_content.intro_title, "acesso@example.test");
  assert.strictEqual(sanitizeStorefrontHeadings(result), result);
});

test("preserva títulos válidos, textos apagados e conteúdo com endereço de contato", () => {
  const policies = { storefront: { home_featured_title: "", catalog_title: "Seleção da loja", glass_content: { footer_tagline: "Fale com contato@example.test" } } };
  assert.strictEqual(sanitizeStorefrontHeadings(policies), policies);
  for (const value of [undefined, null, {}, { storefront: null }, { storefront: [] }]) assert.strictEqual(sanitizeStorefrontHeadings(value), value);
});
