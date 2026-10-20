// Node 20+, Vite na porta 4179 e PLAYWRIGHT_MODULE apontando para Playwright.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const base = process.env.THEME_TEST_URL || 'http://127.0.0.1:4179';
const image = 'data:image/svg+xml,' + encodeURIComponent("<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"400\" height=\"500\"><path d=\"M100 70h200v360H100z\" fill=\"#b9b5a3\"/><path d=\"M100 70l20-20h160l20 20\" fill=\"#ddd8c9\"/><rect x=\"125\" y=\"150\" width=\"150\" height=\"140\" fill=\"#f6f3e9\"/><path d=\"M200 260v-90m0 50q-60-10-45-45 45 0 45 45m0-15q55-15 45-40-40 0-45 40\" fill=\"#61735b\" stroke=\"#61735b\" stroke-width=\"5\"/></svg>");
const products = Array.from({ length: 8 }, (_, i) => ({
  id: i + 1, tenant_id: 1, name: i === 0 ? 'Seleção especial' : `Produto ${i + 1}`, sku: `ES-${i + 1}`,
  price: 129.9 + i, discount_price: i === 0 ? 99.9 : i === 1 ? 0 : null,
  stock_quantity: 10, type: 'sale', is_active: true, is_featured: i === 0, category_id: i % 2 + 1,
  image_url: image, images: [image, image + ' '], description: 'Descrição cadastrada com ação, composição e proteção.',
  attributes: i === 0 ? [{ name: 'Tamanho', values: ['P', 'G'] }] : [],
  skus: i === 0 ? [{ combo: { Tamanho: 'P' }, stock: 4 }, { combo: { Tamanho: 'G' }, stock: 0 }] : [],
}));

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
  try {
    for (const theme of (process.env.THEME_IDS || 'agro,feed,garden').split(',')) {
      const p = theme;
      const cta = {agro:'Explorar o campo',feed:'Explorar os cuidados',garden:'Explorar o jardim'}[theme];
      const menuLink = 'Produtos';
      const asset = `/store-assets/${theme}-editorial-hero-v1.jpg`;
      const page = await browser.newPage({ serviceWorkers: 'block' });
      await page.route('**/fonts.googleapis.com/**', route => route.fulfill({ contentType: 'text/css', body: '' }));
      await page.route('**/fonts.gstatic.com/**', route => route.abort());
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      let hidden = false, empty = false, custom = false, slides = false, order = false;
      await page.route('**/api/**', route => {
        if (route.request().url().includes('/api/public/store')) return route.fulfill({ json: {
          tenant: { id: 1, name: {agro:'FAZENDA FORTE',feed:'RANCHO & RAÇÃO',garden:'HORTA VIVA'}[theme], slug: 'demo', template_id: 'minimal', primary_color: '#2563eb', banner_url: custom ? image : '', hero_tagline: custom ? 'Campanha da loja' : '', whatsapp: '5511999999999', show_address: true, address: 'Rua da Ação, 100', business_hours: { monday: { open: '09:00', close: '18:00', closed: false } }, policies: { shipping: 'Entrega conforme as opções da loja.', returns: 'Consulte as condições de devolução.', exchange: 'Trocas mediante contato.', storefront: { checkout_mode: order ? 'order_request' : 'online', hide_prices: hidden, hero_slides: slides ? [{ id: 'one', image, title: 'Campanha personalizada', button_label: 'Ver coleção', button_url: '/catalogo?categoria=2' }] : [] } } },
          categories: [{ id: 1, name: 'Essenciais' }, { id: 2, name: 'Presentes' }], products: empty ? [] : products,
        } });
        return route.fulfill({ json: { payment_methods: { pix: true }, delivery: { pickup_available: true, delivery_available: false, delivery_fee: 0 } } });
      });
      const goto = async (suffix = '') => {
        await page.goto(`${base}/s/demo${suffix}${suffix.includes('?') ? '&' : '?'}previewTheme=${theme}`, { waitUntil: 'domcontentloaded' });
        await page.locator(`.${p}-page`).waitFor();
        await page.locator('#app-splash').waitFor({ state: 'hidden' });
      };
      for (const width of process.env.THEME_SKIP_RESPONSIVE ? [] : [375, 768, 1440]) {
        await page.setViewportSize({ width, height: 960 });
        for (const [suffix, name] of [['', 'inicio'], ['/catalogo', 'catalogo'], ['/produto/selecao-1', 'produto'], ['/sobre', 'sobre']]) {
          await goto(suffix);
          await page.locator(`.${p}-page h1`).waitFor();
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), `${theme}/${width}/${suffix}: overflow`);
          assert.equal(await page.locator(`.${p}-hero-art,.${p}-marquee,.${p}-rail,.${p}-float,.${p}-arch-ring`).count(), 0);
          assert.equal(await page.locator(`.${p}-page h1`).evaluate(el => getComputedStyle(el).opacity), '1');
          if (name === 'inicio') {
            await page.locator(`.${p}-hero-image`).evaluate(img => img.decode());
            assert.equal(await page.locator(`.${p}-hero-image`).getAttribute('src'), asset);
          }
          if (width !== 768) await page.screenshot({ path: path.join(os.tmpdir(), `boxsys-${theme}-${name}-${width}.png`), fullPage: true });
        }
        console.log(`PASS ${theme} ${width}px: 4 páginas, hero, rodapé, largura e apresentação estática`);
      }
      await page.setViewportSize({ width: 1440, height: 960 });
      await goto();
      const tones = await page.locator(`.${p}-header`).evaluate(el => ({ background: getComputedStyle(el).backgroundColor, icon: getComputedStyle(el.querySelector('button')).color }));
      assert.equal(tones.background, {agro:'rgb(32, 59, 43)',feed:'rgb(248, 245, 239)',garden:'rgb(255, 255, 255)'}[theme]);
      assert.equal(tones.icon, {agro:'rgb(246, 243, 231)',feed:'rgb(72, 59, 46)',garden:'rgb(48, 67, 54)'}[theme]);
      if (process.env.THEME_SKIP_RESPONSIVE) {
        await page.locator(`.${p}-hero-image`).evaluate(img => img.decode());
        await page.screenshot({ path: path.join(os.tmpdir(), `boxsys-${theme}-inicio-1440.png`), fullPage: true });
      }
      await page.getByRole('link', { name: cta, exact: true }).click();
      await page.locator(`.${p}-catalog`).waitFor();
      assert.ok(page.url().includes(`previewTheme=${theme}`));
      await page.getByRole('combobox', { name: 'Filtrar por categoria' }).selectOption('1');
      await page.waitForFunction(p => document.querySelectorAll(`.${p}-card`).length === 4, p);
      await page.getByRole('searchbox', { name: 'Buscar no catálogo' }).fill('inexistente');
      await page.getByText('Nada encontrado', { exact: true }).waitFor();
      await page.getByRole('button', { name: 'Limpar filtros', exact: true }).click();
      await page.waitForFunction(p => document.querySelectorAll(`.${p}-card`).length === 8, p);
      await page.getByRole('combobox', { name: 'Ordenar por' }).selectOption('price_down');
      await page.waitForFunction(p => document.querySelector(`.${p}-card-body h3 a`)?.textContent === 'Produto 8', p);
      await page.getByRole('button', { name: 'Buscar produtos', exact: true }).click();
      await page.getByRole('searchbox', { name: 'Buscar produtos', exact: true }).fill('especial');
      await page.getByRole('button', { name: 'Buscar', exact: true }).click();
      await page.waitForFunction(p => document.querySelectorAll(`.${p}-card`).length === 1, p);
      await page.getByRole('button', { name: 'Favoritar Seleção especial', exact: true }).click();
      assert.equal(await page.getByRole('button', { name: 'Remover Seleção especial dos favoritos' }).getAttribute('aria-pressed'), 'true');
      await goto('/produto/selecao-1');
      const add = page.getByRole('button', { name: theme === 'agro' ? 'Adicionar ao pedido' : 'Adicionar à sacola', exact: true });
      assert.ok(await add.isDisabled());
      await page.getByRole('button', { name: 'Ver foto 2', exact: true }).click();
      assert.equal(await page.getByRole('button', { name: 'Ver foto 2', exact: true }).getAttribute('aria-current'), 'true');
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
      hidden = true;
      await goto('/produto/selecao-1');
      await page.getByText('Sob consulta', { exact: true }).first().waitFor();
      assert.ok(!(await page.locator(`.${p}-page`).innerText()).includes('99,90'));
      hidden = false; order = true;
      await goto('/produto/selecao-1');
      await page.getByText('Sob consulta', { exact: true }).first().waitFor();
      assert.ok(await page.locator(`.${p}-panel`).getByRole('button', { name: 'Incluir no pedido', exact: true }).isDisabled());
      order = false; empty = true;
      await goto();
      await page.getByText('Novos produtos estão chegando.', { exact: true }).waitFor();
      await page.locator(`.${p}-hero-image`).evaluate(img => img.decode());
      empty = false; custom = true;
      await goto();
      await page.getByRole('heading', { name: 'Campanha da loja', exact: true }).waitFor();
      assert.equal(await page.locator(`.${p}-hero-image`).getAttribute('src'), image);
      custom = false; slides = true;
      await goto();
      await page.getByRole('heading', { name: 'Campanha personalizada', exact: true }).waitFor();
      await page.getByRole('link', { name: 'Ver coleção', exact: true }).click();
      await page.locator(`.${p}-catalog`).waitFor();
      assert.equal(new URL(page.url()).searchParams.get('categoria'),'2');
      assert.equal(new URL(page.url()).searchParams.get('previewTheme'),theme);
      slides = false;
      await page.setViewportSize({ width: 375, height: 960 });
      await goto();
      if (process.env.THEME_SKIP_RESPONSIVE) {
        await page.locator(`.${p}-hero-image`).evaluate(img => img.decode());
        await page.screenshot({ path: path.join(os.tmpdir(), `boxsys-${theme}-inicio-375.png`), fullPage: true });
      }
      await page.getByRole('button', { name: 'Abrir menu', exact: true }).click();
      await page.getByRole('dialog', { name: 'Menu da loja' }).getByRole('link', { name: menuLink, exact: true }).click();
      await page.locator(`.${p}-catalog`).waitFor();
      assert.equal(await page.getByRole('dialog', { name: 'Menu da loja' }).count(), 0);
      await goto('/produto/selecao-1');
      assert.ok(await page.evaluate(p => {
        const widget = document.querySelector('.fixed.bottom-6.right-6');
        const purchase = document.querySelector(`.${p}-buyrow`);
        return widget && purchase && widget.getBoundingClientRect().bottom <= purchase.getBoundingClientRect().top;
      }, p), 'Atendimento não pode cobrir a compra móvel');
      await goto('/catalogo');
      await page.locator(`.${p}-card`).filter({ hasText: 'Produto 2' }).getByRole('button', { name: theme === 'feed' ? 'Adicionar Produto 2' : 'Adicionar', exact: true }).click();
      const regular = page.locator('.fragrance-cart-item').filter({ hasText: 'Produto 2' });
      await regular.waitFor();
      assert.match(await regular.innerText(), /130,90/);
      await page.getByRole('button', { name: 'Fechar carrinho', exact: true }).click();
      await goto('/sobre');
      await page.getByRole('heading', { name: 'Trocas e devoluções', exact: true }).waitFor();
      assert.ok((await page.locator(`.${p}-footer`).innerText()).includes('09:00 às 18:00'));
      assert.deepEqual(errors, []);
      console.log(`PASS ${theme}: prévia, categorias, ordenação, busca, favoritos, galeria, tamanho, estoque, promoções, sacola, checkout, preços ocultos, encomenda, loja vazia, banners, menu móvel, políticas e horários; sem erros`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
