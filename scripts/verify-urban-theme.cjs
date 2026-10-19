// Node 20+, Vite na porta 4179, PLAYWRIGHT_MODULE apontando para Playwright.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const base = process.env.THEME_TEST_URL || 'http://127.0.0.1:4179';
const image = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500"><path d="M110 90 60 130 90 200 125 180 125 410 275 410 275 180 310 200 340 130 290 90 245 75Q200 125 155 75Z" fill="#b5b0a2"/><path d="M155 75Q200 125 245 75" fill="none" stroke="#8c8576" stroke-width="6"/></svg>');
const products = Array.from({ length: 8 }, (_, i) => ({
  id: i + 1, tenant_id: 1, name: i === 0 ? 'Camiseta de algodão' : `Peça ${i + 1}`,
  sku: `UR-${i + 1}`, price: 129.9 + i, discount_price: i === 0 ? 99.9 : i === 1 ? 0 : null,
  stock_quantity: 10, type: 'sale', is_active: true, is_featured: i === 0,
  category_id: i % 2 + 1, image_url: image, images: [image],
  description: 'Descrição com ação, algodão e proteção.',
  attributes: i === 0 ? [{ name: 'Tamanho', values: ['P', 'G'] }] : [],
  skus: i === 0 ? [{ combo: { Tamanho: 'P' }, stock: 4 }, { combo: { Tamanho: 'G' }, stock: 0 }] : [],
}));

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
  try {
    const page = await browser.newPage({ serviceWorkers: 'block' });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    let hidden = false, empty = false, custom = false, slides = false;
    await page.route('**/api/**', route => {
      if (route.request().url().includes('/api/public/store')) return route.fulfill({ json: {
        tenant: { id: 1, name: 'ESSÊNCIA', slug: 'demo', template_id: 'minimal', primary_color: '#2563eb', banner_url: custom ? image : '', hero_tagline: custom ? 'Campanha da loja' : '', whatsapp: '5511999999999', show_address: true, address: 'Rua da Ação, 100', policies: { storefront: { checkout_mode: 'online', hide_prices: hidden, hero_slides: slides ? [{ id: 'one', image, title: 'Campanha personalizada', button_label: 'Ver coleção', button_url: '/catalogo' }] : [] } } },
        categories: [{ id: 1, name: 'Camisetas' }, { id: 2, name: 'Roupas' }], products: empty ? [] : products,
      } });
      return route.fulfill({ json: { payment_methods: { pix: true }, delivery: { pickup_available: true, delivery_available: false, delivery_fee: 0 } } });
    });
    const goto = async (suffix = '') => {
      await page.goto(`${base}/s/demo${suffix}${suffix.includes('?') ? '&' : '?'}previewTheme=urban`);
      await page.locator('.ur-page').waitFor();
      await page.locator('#app-splash').waitFor({ state: 'hidden' });
    };
    for (const width of process.env.THEME_SKIP_RESPONSIVE ? [] : [375, 768, 1440]) {
      await page.setViewportSize({ width, height: 960 });
      for (const [suffix, name] of [['', 'inicio'], ['/catalogo', 'catalogo'], ['/produto/camiseta-algodao-1', 'produto'], ['/sobre', 'sobre']]) {
        await goto(suffix);
        await page.locator('.ur-page h1').waitFor();
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), `${width}/${suffix}: overflow`);
        assert.equal(await page.locator('.ur-mosaic,.ur-stories,.ur-rail,.ur-about-mosaic').count(), 0);
        assert.equal(await page.locator('.ur-footer h2').allTextContents().then(t => t.includes('Categorias')), false);
        assert.equal(await page.locator('.ur-page h1').evaluate(el => getComputedStyle(el).opacity), '1');
        if (width !== 768) await page.screenshot({ path: path.join(os.tmpdir(), `boxsys-urban-${name}-${width}.png`), fullPage: true });
      }
      console.log(`PASS ${width}px: início, catálogo, produto, sobre, rodapé, largura e ausência de mosaicos/animação`);
    }
    await page.setViewportSize({ width: 1440, height: 960 });
    await goto();
    await page.locator('.ur-hero-image').evaluate(img => img.decode());
    assert.equal(await page.locator('.ur-hero-image').getAttribute('src'), '/store-assets/urban-editorial-hero-v1.jpg');
    assert.equal(await page.locator('.ur-hero-image').evaluate(el => getComputedStyle(el).filter), 'grayscale(1)');
    assert.equal(await page.locator('.ur-header').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(250, 249, 246)');
    await page.getByRole('link', { name: 'Conheça a coleção', exact: true }).click();
    await page.locator('.ur-catalog').waitFor();
    assert.ok(page.url().includes('previewTheme=urban'));
    await page.getByRole('combobox', { name: 'Filtrar por categoria' }).selectOption('1');
    await page.waitForFunction(() => document.querySelectorAll('.ur-card').length === 4);
    await page.getByRole('searchbox', { name: 'Buscar no catálogo' }).fill('inexistente');
    await page.getByText('Nada encontrado', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Limpar filtros', exact: true }).click();
    await page.waitForFunction(() => document.querySelectorAll('.ur-card').length === 8);
    await page.getByRole('button', { name: 'Buscar produtos', exact: true }).click();
    await page.getByRole('searchbox', { name: 'Buscar produtos', exact: true }).fill('Camiseta');
    await page.getByRole('button', { name: 'Buscar', exact: true }).click();
    await page.waitForFunction(() => document.querySelectorAll('.ur-card').length === 1);
    await page.getByRole('button', { name: 'Favoritar Camiseta de algodão', exact: true }).click();
    assert.equal(await page.getByRole('button', { name: 'Remover Camiseta de algodão dos favoritos' }).getAttribute('aria-pressed'), 'true');
    await goto('/produto/camiseta-algodao-1');
    const add = page.getByRole('button', { name: 'Adicionar à sacola', exact: true });
    assert.ok(await add.isDisabled());
    await page.getByRole('button', { name: 'G', exact: true }).click();
    assert.ok(await page.getByRole('button', { name: 'Indisponível', exact: true }).isDisabled());
    await page.getByRole('button', { name: 'P', exact: true }).click();
    await add.click();
    await page.locator('.fragrance-cart-item').waitFor();
    assert.match(await page.locator('.fragrance-cart-item').innerText(), /Tamanho: P/i);
    assert.match(await page.locator('.fragrance-cart-item').innerText(), /99,90/);
    await page.getByRole('button', { name: 'Continuar para checkout', exact: true }).click();
    await page.getByPlaceholder('Seu nome *').waitFor();
    await page.getByRole('button', { name: 'Fechar carrinho', exact: true }).click();
    console.log('PASS prévia, categorias, busca, favoritos, variações, estoque, promoção, sacola e abertura do checkout');
    hidden = true;
    await goto('/produto/camiseta-algodao-1');
    await page.getByText('Valor sob consulta', { exact: true }).waitFor();
    assert.ok(!(await page.locator('.ur-page').innerText()).includes('99,90'));
    hidden = false; empty = true;
    await goto();
    await page.getByText('Uma nova coleção está chegando.', { exact: true }).waitFor();
    await page.locator('.ur-hero-image').evaluate(img => img.decode());
    empty = false; custom = true;
    await goto();
    await page.getByRole('heading', { name: 'Campanha da loja', exact: true }).waitFor();
    assert.equal(await page.locator('.ur-hero-image').getAttribute('src'), image);
    assert.equal(await page.locator('.ur-hero-image').evaluate(el => getComputedStyle(el).filter), 'none');
    custom = false; slides = true;
    await goto();
    await page.getByRole('heading', { name: 'Campanha personalizada', exact: true }).waitFor();
    await page.getByRole('link', { name: 'Ver coleção', exact: true }).click();
    await page.locator('.ur-catalog').waitFor();
    assert.ok(page.url().includes('previewTheme=urban'));
    slides = false;
    await page.setViewportSize({ width: 375, height: 960 });
    await goto();
    await page.getByRole('button', { name: 'Abrir menu', exact: true }).click();
    await page.getByRole('dialog', { name: 'Menu da loja' }).getByRole('link', { name: 'A coleção', exact: true }).click();
    await page.locator('.ur-catalog').waitFor();
    assert.equal(await page.getByRole('dialog', { name: 'Menu da loja' }).count(), 0);
    await page.getByRole('combobox', { name: 'Filtrar por categoria' }).selectOption('2');
    await page.waitForFunction(() => document.querySelectorAll('.ur-card').length === 4);
    await goto('/produto/camiseta-algodao-1');
    assert.ok(await page.evaluate(() => {
      const widget = document.querySelector('.store-theme-urban .fixed.bottom-6.right-6');
      const purchase = document.querySelector('.ur-buy-row');
      return widget && purchase && widget.getBoundingClientRect().bottom <= purchase.getBoundingClientRect().top;
    }), 'Atendimento não pode cobrir a barra de compra móvel');
    await goto('/catalogo');
    await page.locator('.ur-card').filter({ hasText: 'Peça 2' }).getByRole('button', { name: 'Adicionar', exact: true }).click();
    const regularItem = page.locator('.fragrance-cart-item').filter({ hasText: 'Peça 2' });
    await regularItem.waitFor();
    assert.match(await regularItem.innerText(), /130,90/);
    await page.getByRole('button', { name: 'Fechar carrinho', exact: true }).click();
    assert.deepEqual(errors, []);
    console.log('PASS preços ocultos, loja vazia com hero, banner próprio, slides, menu e filtro móvel; sem erros de execução');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
