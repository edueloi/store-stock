const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
const base = process.env.THEME_TEST_URL || 'http://127.0.0.1:4186';
const image = '/store-assets/tech-editorial-hero-v1.jpg';
const products = Array.from({ length: 10 }, (_, i) => ({
  id: i + 1, name: i ? `Produto ${i + 1}` : 'Fone Bluetooth', price: 199 + i,
  discount_price: i === 0 ? 149 : null, sold_count: 10 - i,
  stock_quantity: 10, track_stock: true, type: 'sale', is_active: true,
  is_featured: i === 0, category_id: i % 2 + 1, image_url: image, images: [image, '/store-assets/gadget-campaign-hero-v2.jpg'],
  description: 'Conexão e proteção para o seu dia.',
  storefront_details: { specifications: 'Conexão: Bluetooth\nCor: Preto' },
}));

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
  try {
    const page = await browser.newPage({ serviceWorkers: 'block' });
    page.setDefaultTimeout(15000);
    page.setDefaultNavigationTimeout(15000);
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    let empty = true, hidden = false, social = true, showAddress = true, color = '#000000';
    await page.route('**/api/**', route => route.request().url().includes('/api/public/store')
      ? route.fulfill({ json: { tenant: {
        id: 1, name: 'My House', slug: 'demo', template_id: 'gadget', primary_color: color,
        whatsapp: '15998521070', instagram_url: social ? '@myhouse' : '', facebook_url: social ? 'facebook.com/myhouse' : '',
        show_address: showAddress, address: 'Rua da Ação, 100',
        about_text: 'Bem-vindo à My House!\nDesde 2005, conectando você às melhores soluções em eletrônicos.\nAcreditamos que a tecnologia deve estar ao alcance de todos.',
        hero_tagline: 'Desde 2005, conectando você às melhores soluções em eletrônicos, informática e acessórios, com qualidade e atendimento de confiança.',
        business_hours: { monday: { open: '09:00', close: '18:00', closed: false }, sunday: { closed: true } },
        policies: { storefront: { hide_prices: hidden, checkout_mode: 'online' } },
      }, categories: [{ id: 1, name: 'Áudio' }, { id: 2, name: 'Informática' }], products: empty ? [] : products } })
      : route.fulfill({ json: {} }));
    const go = async (suffix = '') => {
      await page.goto(`${base}/s/demo${suffix}${suffix.includes('?') ? '&' : '?'}previewTheme=gadget`);
      await page.locator('.gd-page').waitFor();
      await page.locator('#app-splash').waitFor({ state: 'hidden' });
      await page.waitForTimeout(850);
    };
    const scrollAll = async () => {
      await page.evaluate(async () => { for (let y = 0; y < document.documentElement.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 60)); } window.scrollTo(0, 0); });
      await page.waitForTimeout(700);
    };
    for (const width of process.env.THEME_SKIP_RESPONSIVE ? [] : [375, 768, 1440]) {
      await page.setViewportSize({ width, height: 960 });
      for (const suffix of ['', '/sobre']) {
        await go(suffix);
        assert.equal(await page.locator('.gd-top').count(), 0);
        assert.equal(await page.locator('.gd-header-bottom').count(), 0);
        assert.equal(await page.locator('.gd-header').getByRole('link', { name: 'Todos os produtos', exact: true }).count(), 0);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${width}${suffix}: overflow`);
        assert.equal(await page.locator('main').getByRole('link', { name: 'Instagram', exact: true }).last().getAttribute('href'), 'https://instagram.com/myhouse');
        assert.equal(await page.locator('main').getByRole('link', { name: 'Facebook', exact: true }).last().getAttribute('href'), 'https://facebook.com/myhouse');
        const button = page.locator(suffix ? '.gd-about-card .gd-btn-accent' : '.gd-hero .gd-btn-electric').first();
        const style = await button.evaluate(el => ({ fg: getComputedStyle(el).color, bg: getComputedStyle(el).backgroundColor }));
        assert.equal(style.fg, 'rgb(255, 255, 255)');
        assert.equal(style.bg, suffix ? 'rgb(0, 0, 0)' : 'rgb(36, 89, 224)');
        const campaignImage = page.locator(suffix ? '.gd-about-visual > img' : '.gd-hero-art > img');
        assert.equal(await campaignImage.getAttribute('src'), suffix ? '/store-assets/tech-editorial-hero-v1.jpg' : '/store-assets/gadget-campaign-hero-v2.jpg');
        assert.ok(await campaignImage.evaluate(img => img.complete && img.naturalWidth > 0));
        await scrollAll();
        if (width !== 768) await page.screenshot({ path: path.join(os.tmpdir(), `gadget-${suffix ? 'sobre' : 'inicio'}-${width}.png`), fullPage: true });
      }
      await page.locator('.gd-about-card').getByText('(15) 99852-1070').waitFor();
      assert.equal(await page.locator('.gd-about-card .gd-btn').getAttribute('href'), 'https://wa.me/5515998521070');
      assert.match(await page.locator('.gd-about-hours').innerText(), /Segunda[\s\S]*09:00 às 18:00[\s\S]*Domingo[\s\S]*Fechado/);
      assert.match(await page.locator('.gd-about-text').innerText(), /Bem-vindo à My House![\s\S]*Desde 2005/);
      console.log(`PASS ${width}px: início e Sobre sem produtos, redes, telefone, horários, contraste e largura.`);
    }
    await page.setViewportSize({ width: 1440, height: 960 });
    empty = false;
    for (const suffix of ['', '/catalogo', '/produto/fone-bluetooth-1']) {
      await go(suffix);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    }
    await page.getByRole('button', { name: 'Ver foto 2', exact: true }).click();
    assert.match(await page.locator('.gd-prod-main > img').getAttribute('src'), /gadget-campaign/);
    await page.getByRole('tab', { name: 'Ficha técnica', exact: true }).click();
    assert.match(await page.getByRole('tabpanel').innerText(), /Bluetooth/);
    await page.screenshot({ path: path.join(os.tmpdir(), 'gadget-produto-1440.png'), fullPage: true });
    await page.getByRole('button', { name: 'Adicionar ao carrinho', exact: true }).first().click();
    await page.locator('.fragrance-cart-item').waitFor();
    assert.match(await page.locator('.fragrance-cart-item').innerText(), /149,00/);
    assert.equal(await page.locator('.fragrance-cart-image img').evaluate(el => getComputedStyle(el).objectFit), 'contain');
    await page.getByRole('button', { name: 'Aumentar quantidade no carrinho', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.fragrance-cart-prices')?.textContent.includes('298,00'));
    await page.waitForFunction(() => Math.abs(document.querySelector('.fragrance-cart-drawer').getBoundingClientRect().right - innerWidth) < 1);
    await page.screenshot({ path: path.join(os.tmpdir(), 'gadget-carrinho-1440.png') });
    await page.getByRole('button', { name: 'Diminuir quantidade no carrinho', exact: true }).click();
    await page.getByRole('button', { name: 'Fechar carrinho', exact: true }).click();
    await go('/catalogo?ofertas=1');
    assert.equal(await page.locator('.gd-card').count(), 1);
    await page.getByLabel('Só ofertas', { exact: true }).click();
    await page.waitForURL(url => !url.searchParams.has('ofertas'));
    await page.waitForFunction(() => document.querySelectorAll('.gd-card').length === 10);
    assert.equal(await page.locator('.gd-card').count(), 10);
    await go('/sobre');
    await page.locator('.gd-faq summary').first().click();
    assert.equal(await page.locator('.gd-faq details').first().getAttribute('open'), '');
    await page.setViewportSize({ width: 375, height: 960 });
    await go('/produto/fone-bluetooth-1');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.screenshot({ path: path.join(os.tmpdir(), 'gadget-produto-375.png'), fullPage: true });
    await page.getByRole('button', { name: 'Adicionar ao carrinho', exact: true }).first().click();
    await page.getByRole('dialog', { name: 'Seu carrinho', exact: true }).waitFor();
    await page.waitForFunction(() => Math.abs(document.querySelector('.fragrance-cart-drawer').getBoundingClientRect().left) < 1);
    await page.screenshot({ path: path.join(os.tmpdir(), 'gadget-carrinho-375.png') });
    await page.getByRole('button', { name: 'Remover Fone Bluetooth do carrinho', exact: true }).click();
    await page.waitForFunction(() => document.querySelectorAll('.fragrance-cart-item').length === 0);
    await page.getByRole('button', { name: 'Fechar carrinho', exact: true }).click();
    await page.setViewportSize({ width: 1440, height: 960 });
    color = '#ffffff'; await go('/sobre');
    assert.equal(await page.locator('.gd-about-card .gd-btn').evaluate(el => getComputedStyle(el).color), 'rgb(11, 13, 18)');
    hidden = true; await go();
    assert.equal(await page.getByRole('link', { name: 'Ver ofertas', exact: true }).count(), 0);
    assert.ok(!(await page.locator('.gd-page').innerText()).includes('149,00'));
    social = false; showAddress = false; await go('/sobre');
    assert.equal(await page.getByRole('link', { name: 'Instagram', exact: true }).count(), 0);
    assert.equal(await page.getByText('Rua da Ação, 100', { exact: true }).count(), 0);
    await page.setViewportSize({ width: 375, height: 960 });
    await go();
    await page.getByRole('button', { name: 'Abrir menu', exact: true }).click();
    await page.getByRole('dialog', { name: 'Menu', exact: true }).getByRole('link', { name: 'Sobre', exact: true }).click();
    await page.locator('.gd-about-intro').waitFor();
    assert.equal(await page.getByRole('dialog', { name: 'Menu', exact: true }).count(), 0);
    await page.emulateMedia({ reducedMotion: 'reduce' }); await go();
    assert.equal(await page.locator('.gd-hero-float').evaluate(el => getComputedStyle(el).animationName), 'none');
    assert.equal(await page.locator('.gd-page').evaluate(el => el.classList.contains('gd-motion-ready')), false);
    assert.deepEqual(errors, []);
    console.log('PASS catálogo, ofertas, carrinho, FAQ, preços ocultos, cores claras, privacidade do endereço, menu móvel e movimento reduzido.');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
