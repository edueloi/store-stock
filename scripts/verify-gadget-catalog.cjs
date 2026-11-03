const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const base = process.env.THEME_TEST_URL || 'http://127.0.0.1:4186';
const output = path.resolve(__dirname, '../output/gadget-catalog');
const categories = Array.from({ length: 30 }, (_, i) => ({ id: i + 1, name: i ? `Categoria ${String(i + 1).padStart(2, '0')}` : 'Áudio e conexão' }));
const products = Array.from({ length: 180 }, (_, i) => ({
  id: i + 1, name: `Produto ${String(i + 1).padStart(3, '0')} — Ação`, sku: `SKU-${i + 1}`,
  price: i + 10, discount_price: i < 2 ? 5 : null, is_featured: false,
  stock_quantity: i % 2 ? 0 : 10, track_stock: true, type: 'sale', is_active: true,
  category_id: i % 30 + 1, image_url: '/store-assets/tech-editorial-hero-v1.jpg',
}));

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
  try {
    const page = await browser.newPage({ serviceWorkers: 'block', reducedMotion: 'reduce', viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/api/**', route => route.fulfill({ json: route.request().url().includes('/api/public/store') ? {
      tenant: { id: 1, name: 'My House', slug: 'demo', template_id: 'gadget', primary_color: '#4057ee', track_stock: true, policies: { storefront: { checkout_mode: 'online' } } },
      products, categories,
    } : {} }));
    const go = async (query = '') => {
      await page.goto(`${base}/s/demo/catalogo?previewTheme=gadget${query}`);
      await page.locator('.gd-card').first().waitFor();
      await page.locator('#app-splash').waitFor({ state: 'hidden' });
    };
    const nav = () => page.getByRole('navigation', { name: 'Paginação do catálogo' });
    const firstProduct = async (name) => {
      await page.waitForFunction(text => document.querySelector('.gd-card')?.textContent.includes(text), name);
      assert.ok((await page.locator('.gd-card').first().innerText()).includes(name));
    };
    const cardCount = async (count) => {
      await page.waitForFunction(n => document.querySelectorAll('.gd-card').length === n, count);
      assert.equal(await page.locator('.gd-card').count(), count);
    };
    await go();
    assert.equal(await page.locator('.gd-card').count(), 12);
    assert.match(await page.getByRole('status').innerText(), /1–12 de 180 produtos[\s\S]*Página 1 de 15/);
    assert.ok(await nav().getByLabel('Página anterior', { exact: true }).isDisabled());
    const side = page.getByRole('complementary', { name: 'Categorias e filtros' });
    assert.ok(await side.evaluate(el => el.scrollHeight > el.clientHeight));
    assert.ok(await side.evaluate(el => el.getBoundingClientRect().bottom <= innerHeight));
    await side.hover();
    const initialWindowY = await page.evaluate(() => scrollY);
    await page.mouse.wheel(0, 2000);
    await page.waitForFunction(() => document.querySelector('.gd-side').scrollTop > 0);
    assert.equal(await page.evaluate(() => scrollY), initialWindowY, 'A rolagem das categorias não move a página');
    await side.getByText('Só disponíveis', { exact: true }).waitFor();
    await side.evaluate(el => { el.scrollTop = 0; });
    await page.screenshot({ path: path.join(output, 'desktop.png') });
    await page.evaluate(() => window.scrollTo(0, 900));
    const top = await side.evaluate(el => ({ actual: el.getBoundingClientRect().top, expected: parseFloat(getComputedStyle(el).top) }));
    assert.ok(Math.abs(top.actual - top.expected) < 2, `Barra lateral permanece fixa: ${JSON.stringify(top)}`);
    await nav().getByLabel('Próxima página', { exact: true }).click();
    await page.waitForURL(/pagina=2/);
    assert.equal(await page.locator('.gd-card').count(), 12);
    await firstProduct('Produto 013');
    assert.ok(await page.locator('.gd-cat-main').evaluate(el => Math.abs(el.getBoundingClientRect().top - parseFloat(getComputedStyle(el).scrollMarginTop)) < 2));
    await nav().getByLabel('Página 15', { exact: true }).click();
    await firstProduct('Produto 169');
    assert.ok(await nav().getByLabel('Próxima página', { exact: true }).isDisabled());
    await page.goBack();
    await page.waitForURL(/pagina=2/);
    await firstProduct('Produto 013');
    await page.reload();
    await page.locator('.gd-card').first().waitFor();
    await firstProduct('Produto 013');
    await page.getByLabel('Ordenar por', { exact: true }).selectOption('maior');
    assert.equal(new URL(page.url()).searchParams.get('pagina'), null);
    await firstProduct('Produto 180');
    await page.getByLabel('Produtos por página', { exact: true }).selectOption('24');
    await cardCount(24);
    await side.getByRole('button', { name: 'Áudio e conexão', exact: false }).click();
    await cardCount(6);
    assert.equal(await nav().count(), 0);
    await side.getByRole('button', { name: 'Limpar filtros' }).click();
    await cardCount(24);
    await page.getByRole('textbox', { name: 'Buscar produto', exact: true }).fill('SKU-180');
    await page.getByRole('textbox', { name: 'Buscar produto', exact: true }).press('Enter');
    await cardCount(1);
    await page.getByRole('textbox', { name: 'Buscar produto', exact: true }).fill('inexistente');
    await page.getByRole('textbox', { name: 'Buscar produto', exact: true }).press('Enter');
    await page.getByText('Nenhum produto encontrado.', { exact: true }).waitFor();
    assert.equal(await nav().count(), 0);
    await go('&pagina=999');
    assert.match(await page.getByRole('status').innerText(), /Página 15 de 15/);
    await side.getByLabel('Preço máximo', { exact: true }).fill('12');
    assert.equal(new URL(page.url()).searchParams.get('pagina'), null);
    await cardCount(3);
    await go('&pagina=-2');
    assert.match(await page.getByRole('status').innerText(), /Página 1 de 15/);
    await side.getByLabel('Só ofertas', { exact: true }).click();
    await cardCount(2);
    assert.ok(await side.getByLabel('Só ofertas', { exact: true }).isChecked());
    await page.setViewportSize({ width: 1280, height: 640 });
    await go('&cat=30');
    await page.getByLabel('Ordenar por', { exact: true }).selectOption('menor');
    await firstProduct('Produto 030');
    assert.equal(new URL(page.url()).searchParams.get('categoria'), '30', 'Preserva categorias recebidas pelo parâmetro cat');
    await go();
    assert.ok(await side.evaluate(el => el.getBoundingClientRect().bottom <= innerHeight));
    await side.getByLabel('Só disponíveis', { exact: true }).click();
    await page.waitForFunction(() => document.querySelector('[role="status"]')?.textContent.includes('90 produtos'));
    console.log('PASS desktop: paginação, histórico, recarga, busca, ordenação, filtros e rolagem independente.');

    for (const width of [320, 375, 768]) {
      await page.setViewportSize({ width, height: 800 });
      await go();
      assert.ok(await side.isHidden());
      await nav().getByLabel('Próxima página', { exact: true }).click();
      await firstProduct('Produto 013');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.getByRole('button', { name: 'Filtros', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'Filtros', exact: true });
      await dialog.waitFor();
      assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden');
      await dialog.getByRole('button', { name: 'Categoria 30', exact: false }).click();
      await dialog.getByRole('button', { name: 'Ver 6 produtos', exact: true }).click();
      await cardCount(6);
      assert.equal(new URL(page.url()).searchParams.get('pagina'), null);
      assert.notEqual(await page.evaluate(() => document.body.style.overflow), 'hidden');
      await page.getByRole('button', { name: 'Filtros', exact: true }).click();
      await page.keyboard.press('Escape');
      assert.equal(await dialog.count(), 0);
      await go('&pagina=8');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await nav().scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(output, `mobile-${width}.png`) });
      console.log(`PASS ${width}px: paginação sem transbordamento, categorias no painel, fechamento por Escape.`);
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
