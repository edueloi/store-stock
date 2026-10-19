// Node 20+, Vite na porta 4179 e PLAYWRIGHT_MODULE apontando para Playwright.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const base = process.env.THEME_TEST_URL || 'http://127.0.0.1:4179';
const image = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500"><path d="M110 90 60 130 90 200 125 180 125 410 275 410 275 180 310 200 340 130 290 90 245 75Q200 125 155 75Z" fill="#b5b0a2"/><path d="M155 75Q200 125 245 75" fill="none" stroke="#8c8576" stroke-width="6"/></svg>');
const products = Array.from({ length: 8 }, (_, i) => ({
  id: i + 1, tenant_id: 1, name: i === 0 ? 'Camiseta especial' : `Peça ${i + 1}`, sku: `ES-${i + 1}`,
  price: 129.9 + i, discount_price: i === 0 ? 99.9 : i === 1 ? 0 : null,
  stock_quantity: 10, type: 'sale', is_active: true, is_featured: i === 0, category_id: i % 2 + 1,
  image_url: image, images: [image, image + ' '], description: 'Descrição cadastrada com ação, composição e proteção.',
  attributes: i === 0 ? [{ name: 'Tamanho', values: ['P', 'G'] }] : [],
  skus: i === 0 ? [{ combo: { Tamanho: 'P' }, stock: 4 }, { combo: { Tamanho: 'G' }, stock: 0 }] : [],
}));

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
  try {
    for (const theme of (process.env.THEME_IDS || 'street,streetwear').split(',')) {
      const p = theme === 'street' ? 'sd' : 'sw';
      const cta = theme === 'street' ? 'Explorar o drop' : 'Conhecer a coleção';
      const menuLink = 'A coleção';
      const asset = `/store-assets/${theme}-editorial-hero-v1.jpg`;
      const page = await browser.newPage({ serviceWorkers: 'block' });
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      let hidden = false, empty = false, custom = false, slides = false, order = false;
      await page.route('**/api/**', route => {
        if (route.request().url().includes('/api/public/store')) return route.fulfill({ json: {
          tenant: { id: 1, name: theme === 'street' ? 'STREET DROP' : 'STREETWEAR & SKATE', slug: 'demo', template_id: 'minimal', primary_color: '#2563eb', banner_url: custom ? image : '', hero_tagline: custom ? 'Campanha da loja' : '', whatsapp: '5511999999999', show_address: true, address: 'Rua da Ação, 100', business_hours: { monday: { open: '09:00', close: '18:00', closed: false } }, policies: { shipping: 'Entrega conforme as opções da loja.', returns: 'Consulte as condições de devolução.', exchange: 'Trocas mediante contato.', storefront: { checkout_mode: order ? 'order_request' : 'online', hide_prices: hidden, hero_slides: slides ? [{ id: 'one', image, title: 'Campanha personalizada', button_label: 'Ver coleção', button_url: '/catalogo' }] : [] } } },
          categories: [{ id: 1, name: 'Essenciais' }, { id: 2, name: 'Presentes' }], products: empty ? [] : products,
        } });
        return route.fulfill({ json: { payment_methods: { pix: true }, delivery: { pickup_available: true, delivery_available: false, delivery_fee: 0 } } });
      });
      const goto = async (suffix = '') => {
        await page.goto(`${base}/s/demo${suffix}${suffix.includes('?') ? '&' : '?'}previewTheme=${theme}`);
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
      assert.equal(tones.background, theme === 'street' ? 'rgb(247, 247, 245)' : 'rgb(245, 242, 236)');
      assert.equal(tones.icon, theme === 'street' ? 'rgb(29, 31, 28)' : 'rgb(40, 39, 35)');
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
      await page.getByRole('combobox', { name: 'Ordenar por' }).selectOption('maior');
      await page.waitForFunction(p => document.querySelector(`.${p}-card-name`)?.textContent === 'Peça 8', p);
      await page.getByRole('button', { name: 'Buscar produtos', exact: true }).click();
      await page.getByRole('searchbox', { name: 'Buscar produtos', exact: true }).fill('especial');
      await page.getByRole('button', { name: 'Buscar', exact: true }).click();
      await page.waitForFunction(p => document.querySelectorAll(`.${p}-card`).length === 1, p);
      await page.getByRole('button', { name: 'Favoritar Camiseta especial', exact: true }).click();
      assert.equal(await page.getByRole('button', { name: 'Remover Camiseta especial dos favoritos' }).getAttribute('aria-pressed'), 'true');
      await goto('/produto/selecao-1');
      const add = page.getByRole('button', { name: 'Adicionar à sacola', exact: true });
      assert.ok(await add.isDisabled());
      await page.getByRole('button', { name: 'Ver foto 2', exact: true }).click();
      assert.equal(await page.getByRole('button', { name: 'Ver foto 2', exact: true }).getAttribute('aria-pressed'), 'true');
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
      await page.getByText('Valor sob consulta', { exact: true }).waitFor();
      assert.ok(!(await page.locator(`.${p}-page`).innerText()).includes('99,90'));
      hidden = false; order = true;
      await goto('/produto/selecao-1');
      await page.getByText('Valor sob consulta', { exact: true }).waitFor();
      assert.ok(await page.locator(`.${p}-buy`).getByRole('button', { name: 'Incluir no pedido', exact: true }).isDisabled());
      order = false; empty = true;
      await goto();
      await page.getByText('Uma nova coleção está chegando.', { exact: true }).waitFor();
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
        const purchase = document.querySelector(`.${p}-buy-row`);
        return widget && purchase && widget.getBoundingClientRect().bottom <= purchase.getBoundingClientRect().top;
      }, p), 'Atendimento não pode cobrir a compra móvel');
      await goto('/catalogo');
      await page.locator(`.${p}-card`).filter({ hasText: 'Peça 2' }).getByRole('button', { name: 'Adicionar', exact: true }).click();
      const regular = page.locator('.fragrance-cart-item').filter({ hasText: 'Peça 2' });
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
