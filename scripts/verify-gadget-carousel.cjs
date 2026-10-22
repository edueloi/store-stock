const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const base = process.env.THEME_TEST_URL || 'http://127.0.0.1:4186';
const products = Array.from({ length: 10 }, (_, i) => ({ id: i + 1, name: `Eletrônico ${i + 1}`, price: 100 + i, type: 'sale', is_active: true, is_featured: false, stock_quantity: 20, sold_count: 100 - i, image_url: '/store-assets/gadget-campaign-hero-v2.jpg' }));

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
  try {
    const page = await browser.newPage({ serviceWorkers: 'block' });
    page.setDefaultTimeout(30000);
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    let single = false, empty = false;
    await page.route('**/api/**', r => r.fulfill({ json: { tenant: { id: 1, name: 'Loja de tecnologia', slug: 'demo', template_id: 'gadget', featured_limit: 4, bestseller_limit: 8, policies: { storefront: {} } }, categories: [], products: empty ? [] : single ? products.slice(0, 1) : products } }));
    const go = async () => {
      await page.goto(`${base}/s/demo`, { waitUntil: 'domcontentloaded' });
      await page.locator('.gd-page').waitFor();
      await page.locator('#app-splash').waitFor({ state: 'hidden' });
    };
    const carousel = name => page.locator(`.gd-carousel[aria-label="${name}"]`);
    const position = async (name, target) => {
      await carousel(name).getByRole('button', { name: `Mostrar a partir do produto ${target} em ${name}`, exact: true }).click();
      await page.waitForTimeout(650);
      assert.equal(await carousel(name).locator('.gd-carousel-dots [aria-current="true"]').getAttribute('aria-label'), `Mostrar a partir do produto ${target} em ${name}`);
    };
    for (const [width, visible] of [[1440, 4], [768, 3], [375, 2]]) {
      await page.setViewportSize({ width, height: 1000 });
      await go();
      assert.equal(await page.locator('.gd-rail').count(), 0);
      for (const name of ['Em destaque', 'Mais vendidos']) {
        const root = carousel(name);
        await root.scrollIntoViewIfNeeded();
        await root.hover();
        await page.waitForTimeout(150);
        assert.equal(await root.locator('.gd-carousel-item[aria-hidden="false"]').count(), visible);
        assert.equal(await root.locator('.gd-carousel-viewport').evaluate(el => getComputedStyle(el).overflowX), 'hidden');
        await position(name, name === 'Em destaque' ? 4 : 8);
        await root.getByRole('button', { name: `Próximo produto em ${name}`, exact: true }).click();
        await page.waitForTimeout(700);
        assert.match(await root.locator('.gd-carousel-dots [aria-current="true"]').getAttribute('aria-label'), /produto 1 em/);
        const rectangles = await root.locator('.gd-carousel-item[aria-hidden="false"]').evaluateAll(nodes => nodes.map(node => { const r = node.getBoundingClientRect(); return { left: r.left, right: r.right, height: r.height }; }));
        assert.ok(rectangles[0].left >= -1 && rectangles.at(-1).right <= width + 1, `Alinhamento após a volta do carrossel em ${width}px`);
        assert.ok(rectangles.every(r => Math.abs(r.height - rectangles[0].height) < 1));
        assert.equal(await root.locator('.gd-carousel-viewport').evaluate(el => el.scrollLeft), 0);
        await root.getByRole('button', { name: `Produto anterior em ${name}`, exact: true }).click();
        await page.waitForTimeout(700);
        assert.match(await root.locator('.gd-carousel-dots [aria-current="true"]').getAttribute('aria-label'), name === 'Em destaque' ? /produto 4 em/ : /produto 8 em/);
      }
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      if (width !== 768) await page.screenshot({ path: path.join(os.tmpdir(), `gadget-carrosseis-${width}.png`) });
      console.log(`PASS ${width}px: bolinhas, setas, volta contínua, ranking e ${visible} produtos visíveis sem barra de rolagem.`);
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await go();
    const root = carousel('Mais vendidos');
    await root.scrollIntoViewIfNeeded();
    await page.mouse.move(0, 0);
    await page.waitForFunction(() => document.querySelector('[aria-label="Mais vendidos"] .gd-carousel-dots [aria-current="true"]')?.getAttribute('aria-label').includes('produto 2 em'), null, { timeout: 8000 });
    await root.hover();
    const held = await root.locator('.gd-carousel-dots [aria-current="true"]').getAttribute('aria-label');
    await page.waitForTimeout(5400);
    assert.equal(await root.locator('.gd-carousel-dots [aria-current="true"]').getAttribute('aria-label'), held);
    await root.locator('.gd-carousel-item[aria-hidden="false"] .gd-card-img').first().focus();
    await page.mouse.move(0, 0);
    await page.waitForTimeout(5400);
    assert.equal(await root.locator('.gd-carousel-dots [aria-current="true"]').getAttribute('aria-label'), held);
    await root.getByRole('button', { name: 'Pausar rotação automática em Mais vendidos', exact: true }).click();
    await page.locator('.gd-brand').focus();
    await page.mouse.move(0, 0);
    await page.waitForTimeout(5400);
    assert.equal(await root.locator('.gd-carousel-dots [aria-current="true"]').getAttribute('aria-label'), held);
    await root.getByRole('button', { name: 'Retomar rotação automática em Mais vendidos', exact: true }).click();
    await page.locator('.gd-brand').focus();
    await page.mouse.move(0, 0);
    await page.waitForTimeout(5900);
    assert.notEqual(await root.locator('.gd-carousel-dots [aria-current="true"]').getAttribute('aria-label'), held);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await go();
    await root.scrollIntoViewIfNeeded();
    await page.mouse.move(0, 0);
    await page.waitForTimeout(5400);
    assert.match(await root.locator('.gd-carousel-dots [aria-current="true"]').getAttribute('aria-label'), /produto 1 em/);
    assert.equal(await root.locator('.gd-carousel-play').count(), 0);
    await position('Mais vendidos', 3);
    await page.setViewportSize({ width: 375, height: 1000 });
    await page.waitForTimeout(150);
    assert.equal(await root.locator('.gd-carousel-item[aria-hidden="false"]').count(), 2);
    single = true; await go();
    assert.equal(await carousel('Em destaque').locator('.gd-carousel-item').count(), 1);
    assert.equal(await page.locator('.gd-carousel-controls').count(), 0);
    empty = true; await go();
    assert.equal(await page.locator('.gd-carousel').count(), 0);
    assert.deepEqual(errors, []);
    console.log('PASS reprodução automática, pausa por mouse/foco, pausar/retomar, movimento reduzido, redimensionamento e listas com zero/um produto.');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
