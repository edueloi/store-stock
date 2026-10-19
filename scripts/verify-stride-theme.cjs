// Node 20+, Vite em execução e PLAYWRIGHT_MODULE apontando para playwright-core.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
const base = process.env.THEME_TEST_URL || 'http://127.0.0.1:4179';
const image = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500"><path d="M110 90 60 130 90 200 125 180 125 410 275 410 275 180 310 200 340 130 290 90 245 75Q200 125 155 75Z" fill="#383e35"/><text x="200" y="250" text-anchor="middle" fill="#c8ff31" font-size="24">MOVIMENTO</text></svg>');
const products = Array.from({ length: 8 }, (_, i) => ({
  id: i + 1, tenant_id: 1, name: i === 0 ? 'Camiseta Essential' : `Peça ${i + 1}`,
  sku: `SR-${i + 1}`, price: 129.9, discount_price: 99.9, stock_quantity: 10,
  type: 'sale', is_active: true, is_featured: i === 0, category_id: i % 3 + 1,
  image_url: image, images: [image], description: 'Descrição com ação, algodão e proteção.',
  attributes: i === 0 ? [{ name: 'Tamanho', values: ['P', 'G'] }] : [],
  skus: i === 0 ? [{ combo: { Tamanho: 'P' }, stock: 4 }, { combo: { Tamanho: 'G' }, stock: 0 }] : [],
}));

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
  try {
    const page = await browser.newPage({ serviceWorkers: 'block' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    let hidden = false, empty = false, custom = false, slides = false;
    await page.route('**/api/**', route => {
      if (route.request().url().includes('/api/public/store')) return route.fulfill({ json: {
        tenant: { id: 1, slug: 'demo', name: 'MOVIMENTO', template_id: 'minimal', primary_color: '', whatsapp: '5511999999999', show_address: true, address: 'Rua da Ação, 100', banner_url: custom ? image : '', hero_tagline: custom ? 'CAMPANHA DA LOJA' : '', policies: { storefront: { hide_prices: hidden, checkout_mode: 'online', cart_title: 'Sua sacola', hero_slides: slides ? [{ id: 'campaign', image, title: 'Banner personalizado', button_label: 'Ver coleção', button_url: '/catalogo' }] : [] } } },
        categories: [{ id: 1, name: 'Camisetas' }, { id: 2, name: 'Tênis' }, { id: 3, name: 'Roupas' }], products: empty ? [] : products,
      } });
      return route.fulfill({ json: { payment_methods: { pix: true }, delivery: { pickup_available: true, delivery_available: false, delivery_fee: 0 } } });
    });
    const goto = async (suffix = '') => {
      await page.goto(`${base}/s/demo${suffix}${suffix.includes('?') ? '&' : '?'}previewTheme=stride`);
      await page.locator('.sr-page').waitFor();
      await page.locator('#app-splash').waitFor({ state: 'hidden' });
    };
    for (const width of process.env.THEME_SKIP_RESPONSIVE ? [] : [375, 768, 1440]) {
      await page.setViewportSize({ width, height: 960 });
      for (const suffix of ['', '/catalogo', '/produto/camiseta-essential-1', '/sobre']) {
        await goto(suffix);
        await page.locator('.sr-page h1').waitFor();
        const size = await page.evaluate(() => ({ viewport: innerWidth, width: document.documentElement.scrollWidth }));
        assert.ok(size.width <= size.viewport + 2, `${width}/${suffix}: ${JSON.stringify(size)}`);
        assert.ok((await page.locator('body').innerText()).includes('MOVIMENTO'));
      }
      await goto();
      assert.equal(await page.locator('.sr-campaign-image').evaluate(img => img.complete && img.naturalWidth > 0), true);
      await page.screenshot({ path: path.join(os.tmpdir(), `boxsys-stride-${width}.png`), fullPage: true });
      console.log(`PASS ${width}px: início, catálogo, produto, sobre, imagem e largura`);
    }
    await page.setViewportSize({ width: 1440, height: 960 });
    await goto();
    const heart = page.getByRole('button', { name: 'Favoritar Camiseta Essential', exact: true });
    await heart.click();
    assert.equal(await page.getByRole('button', { name: 'Remover Camiseta Essential dos favoritos' }).getAttribute('aria-pressed'), 'true');
    await page.getByRole('link', { name: 'Encontre seu próximo favorito', exact: true }).click();
    assert.ok(page.url().includes('previewTheme=stride'));
    await page.getByRole('searchbox', { name: 'Buscar no catálogo' }).fill('inexistente');
    await page.getByText('Nenhuma peça encontrada', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Ver tudo', exact: true }).click();
    await page.getByRole('button', { name: 'Tênis 3', exact: true }).click();
    await page.waitForFunction(() => document.querySelectorAll('.sr-results .sr-card').length === 3);
    assert.equal(await page.locator('.sr-results .sr-card').count(), 3);
    await page.getByRole('button', { name: 'Buscar produtos', exact: true }).click();
    await page.getByRole('searchbox', { name: 'Buscar produtos', exact: true }).fill('Camiseta');
    await page.getByRole('button', { name: 'Buscar', exact: true }).click();
    await page.waitForFunction(() => document.querySelectorAll('.sr-results .sr-card').length === 1);
    assert.equal(await page.locator('.sr-results .sr-card').count(), 1);
    await goto('/produto/camiseta-essential-1');
    const add = page.getByRole('button', { name: 'Adicionar à sacola', exact: true });
    assert.ok(await add.isDisabled());
    await page.getByRole('button', { name: 'G', exact: true }).click();
    assert.ok(await page.getByRole('button', { name: 'Indisponível', exact: true }).isDisabled());
    await page.getByRole('button', { name: 'P', exact: true }).click();
    await add.click();
    await page.locator('.fragrance-cart-drawer').waitFor();
    assert.match(await page.locator('.fragrance-cart-item').innerText(), /Tamanho: P/i);
    assert.match(await page.locator('.fragrance-cart-item').innerText(), /99,90/);
    await page.getByRole('button', { name: 'Continuar para checkout', exact: true }).click();
    await page.getByPlaceholder('Seu nome *').waitFor();
    await page.getByRole('button', { name: 'Fechar carrinho', exact: true }).click();
    console.log('PASS favoritos, prévia, busca, categorias, variação, estoque, preço promocional, sacola e checkout');
    hidden = true;
    await goto('/produto/camiseta-essential-1');
    await page.getByText('Valor sob consulta', { exact: true }).waitFor();
    assert.ok(!(await page.locator('.sr-page').innerText()).includes('99,90'));
    hidden = false; empty = true;
    await goto();
    await page.getByText('O catálogo está sendo preparado. Volte em breve.', { exact: true }).waitFor();
    empty = false; custom = true;
    await goto();
    await page.getByRole('heading', { name: 'CAMPANHA DA LOJA', exact: true }).waitFor();
    assert.equal(await page.locator('.sr-campaign-image').getAttribute('src'), image);
    custom = false; slides = true;
    await goto();
    await page.getByRole('heading', { name: 'Banner personalizado' }).waitFor();
    await page.getByRole('link', { name: 'Ver coleção', exact: true }).click();
    await page.locator('.sr-catalog').waitFor();
    assert.ok(page.url().includes('previewTheme=stride'));
    slides = false;
    await page.setViewportSize({ width: 375, height: 960 });
    await goto();
    await page.getByRole('button', { name: 'Abrir menu', exact: true }).click();
    await page.getByRole('dialog', { name: 'Menu da loja' }).getByRole('link', { name: 'Tênis', exact: true }).click();
    await page.locator('.sr-catalog').waitFor();
    assert.equal(await page.getByRole('dialog', { name: 'Menu da loja' }).count(), 0);
    await page.getByRole('button', { name: 'Filtros', exact: true }).click();
    await page.getByRole('button', { name: 'Camisetas 3', exact: true }).click();
    await page.waitForFunction(() => document.querySelectorAll('.sr-results .sr-card').length === 3);
    assert.equal(await page.locator('.sr-results .sr-card').count(), 3);
    assert.deepEqual(errors, []);
    console.log('PASS preços ocultos, loja vazia, personalização, banners, menu e filtros móveis; sem erros de execução');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
