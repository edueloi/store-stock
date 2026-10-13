// Run with Node 20+, a running Vite server and PLAYWRIGHT_MODULE pointing to Playwright.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
const path = require("node:path");
const os = require("node:os");
const ids = process.env.THEME_IDS?.split(",") || [
  "agro",
  "feed",
  "garden",
  "auto_parts",
  "baby",
  "books",
  "coffee",
  "tools",
  "pharmacy",
  "care",
  "hospital",
  "organic",
  "cyber",
  "luxury",
  "tech",
];
const base = process.env.THEME_TEST_URL || "http://127.0.0.1:4179";
const art =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500"><rect x="70" y="65" width="260" height="365" rx="20" fill="#cadac5"/><path d="M70 160h260v150H70z" fill="#214b39"/><text x="200" y="240" text-anchor="middle" fill="white" font-size="30">SELEÇÃO</text><text x="200" y="380" text-anchor="middle" fill="#214b39" font-size="20">PRODUTO DA LOJA</text></svg>',
  );
const product = {
  id: 1,
  tenant_id: 1,
  name: "Produto com opções",
  sku: "AG-001",
  price: 45.9,
  stock_quantity: 10,
  type: "sale",
  is_active: true,
  is_featured: true,
  category_id: 1,
  image_url: art,
  images: [art, art + " "],
  description: "Descrição do produto. Conteúdo cadastrado pela loja.",
  attributes: [{ name: "Tamanho", values: ["P", "G"] }],
  skus: [
    { combo: { Tamanho: "P" }, stock: 4 },
    { combo: { Tamanho: "G" }, stock: 0 },
  ],
};
const products = [
  product,
  ...Array.from({ length: 7 }, (_, i) => ({
    ...product,
    id: i + 2,
    name: `Seleção ${i + 2}`,
    category_id: (i % 2) + 1,
    attributes: [],
    skus: [],
  })),
];
(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath:
      process.env.BROWSER_PATH ||
      "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  });
  const page = await browser.newPage({ serviceWorkers: "block" });
  const errors = [];
  page.on("pageerror", (e) => {
    errors.push(e.message);
    console.error("BROWSER:", e.message);
  });
  let theme = "agro",
    hidden = false,
    empty = false;
  await page.route("**/api/**", async (route) => {
    if (route.request().url().includes("/api/public/store"))
      return route.fulfill({
        json: {
          tenant: {
            id: 1,
            name: "Loja de Demonstração",
            slug: "demo",
            template_id: theme,
            primary_color: "",
            show_address: true,
            address: "Rua das Flores, 120",
            whatsapp: "5511999999999",
            policies: {
              storefront: {
                checkout_mode: "online",
                hide_prices: hidden,
                catalog_title: "Catálogo editado pela loja",
                segment_label: "Segmento personalizado",
                hero_button_label: "Conhecer produtos",
                about_title: "Nossa história editada",
                cart_title: "Meu pedido personalizado",
              },
            },
          },
          categories: [
            { id: 1, name: "Cuidados & Produtos" },
            { id: 2, name: "Acessórios" },
          ],
          products: empty ? [] : products,
        },
      });
    return route.fulfill({
      json: {
        payment_methods: { pix: true },
        delivery: {
          pickup_available: true,
          delivery_available: false,
          delivery_fee: 0,
        },
      },
    });
  });
  async function overflow(label) {
    const r = await page.evaluate(() => ({
      viewport: innerWidth,
      width: document.documentElement.scrollWidth,
      offenders: [...document.querySelectorAll(".seg-page *")]
        .filter(
          (e) =>
            e.getBoundingClientRect().right > innerWidth + 2 &&
            getComputedStyle(e).position !== "absolute",
        )
        .slice(0, 4)
        .map((e) => e.className),
    }));
    assert.ok(r.width <= r.viewport + 2, `${label}: ${JSON.stringify(r)}`);
  }
  for (const id of ids) {
    theme = id;
    console.log("CHECK", id);
    for (const width of [375, 1440]) {
      await page.setViewportSize({ width, height: 950 });
      for (const suffix of ["", "/catalogo", "/produto/item-1", "/sobre"]) {
        await page.goto(`${base}/s/demo${suffix}`);
        await page.locator(".seg-page h1").first().waitFor();
        await overflow(`${id}/${suffix}/${width}`);
      }
    }
    await page.goto(`${base}/s/demo/catalogo`);
    await page
      .getByText("Catálogo editado pela loja", { exact: true })
      .waitFor();
    await page.getByRole("button", { name: "Exibir em lista" }).click();
    assert.ok(await page.locator(".seg-list").count());
    await page
      .getByPlaceholder("Nome ou código do produto")
      .fill("sem resultado algum");
    await page
      .getByText("Nenhum produto encontrado", { exact: true })
      .waitFor();
    await page.goto(`${base}/s/demo/produto/item-1`);
    const add = page.getByRole("button", {
      name: "Adicionar ao pedido",
      exact: true,
    });
    assert.ok(await add.isDisabled());
    await page.getByRole("button", { name: "G", exact: true }).click();
    assert.ok(
      await page
        .getByRole("button", { name: "Indisponível", exact: true })
        .isDisabled(),
    );
    await page.getByRole("button", { name: "P", exact: true }).click();
    await add.click();
    await page.getByText("Meu pedido personalizado", { exact: true }).waitFor();
    assert.match(
      await page.locator(".fragrance-cart-item").innerText(),
      /Tamanho: P/i,
    );
    await page
      .getByRole("button", { name: "Continuar para checkout", exact: true })
      .click();
    await page.getByPlaceholder("Seu nome *").waitFor();
    await page
      .getByRole("button", { name: "Fechar carrinho", exact: true })
      .click();
    if (["agro", "hospital", "luxury", "garden"].includes(id)) {
      await page.goto(`${base}/s/demo`);
      await page.locator(".seg-hero").waitFor();
      await page.locator("#app-splash").waitFor({ state: "hidden" });
      await page.screenshot({
        path: path.join(os.tmpdir(), `boxsys-${id}.png`),
        fullPage: true,
      });
    }
    console.log(
      `PASS ${id}: desktop/mobile, 4 pages, filters, list, variation, cart, checkout`,
    );
  }
  theme = "agro";
  hidden = true;
  await page.goto(`${base}/s/demo/produto/item-1`);
  await page.getByText("Valor sob consulta", { exact: true }).waitFor();
  await page.getByRole("button", { name: "P", exact: true }).click();
  await page
    .getByRole("button", { name: "Adicionar ao pedido", exact: true })
    .click();
  assert.ok(
    !(await page.locator(".fragrance-cart-drawer").innerText()).includes(
      "45,90",
    ),
  );
  hidden = false;
  empty = true;
  await page.goto(`${base}/s/demo`);
  await page
    .getByText("O catálogo está sendo preparado. Volte em breve.", {
      exact: true,
    })
    .waitFor();
  empty = false;
  await page.goto(`${base}/s/demo?previewTheme=hospital`);
  await page.locator(".segment-hospital").waitFor();
  await page
    .getByRole("link", { name: "Conhecer produtos", exact: true })
    .click();
  await page.locator(".segment-hospital .seg-catalog").waitFor();
  assert.deepEqual(errors, []);
  console.log(
    "PASS hidden prices, empty catalogue, preview navigation; no runtime errors",
  );
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
