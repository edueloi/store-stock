const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const base = process.env.LABEL_TEST_URL || 'http://127.0.0.1:4190';
const mm = value => value * 96 / 25.4;

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
  try {
    const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1440, height: 1000 } });
    await context.addInitScript(() => {
      window.print = () => { window.__printCalls = (window.__printCalls || 0) + 1; };
      const open = window.open.bind(window);
      window.open = (...args) => { const popup = open(...args); if (popup) popup.print = () => { popup.__printCalls = (popup.__printCalls || 0) + 1; }; return popup; };
      try { localStorage.setItem('token', 'teste'); localStorage.setItem('user', JSON.stringify({ id: 1, tenant_id: 11, name: 'Gestão', role: 'admin' })); } catch { /* Prévia isolada não acessa o armazenamento do sistema. */ }
    });
    const page = await context.newPage(); page.setDefaultTimeout(30000);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.route('**/api/**', async route => {
      const url = new URL(route.request().url()); let json = [];
      if (url.pathname === '/api/products') json = [{ id: 1, name: 'Câmera Ação & Conexão <Loja>', price: 149.99, sku: 'CAM-123', barcode: '7891234567895', is_active: true, stock_quantity: 10 }];
      else if (url.pathname === '/api/tenant') json = { id: 11, name: 'Loja Ação', slug: 'loja-acao' };
      else if (url.pathname === '/api/whatsapp/overview') json = { stats: {} };
      else if (url.pathname.startsWith('/api/preferences/')) json = { value: null };
      else if (url.pathname.endsWith('count')) json = { count: 0 };
      await route.fulfill({ json });
    });
    await page.goto(`${base}/admin/etiquetas`);
    await page.getByRole('button', { name: 'Configurar medidas', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Configurar etiquetas', exact: true });
    await dialog.waitFor();
    await page.getByLabel('Impressora / limite de largura', { exact: true }).selectOption('elgin-btp-l42');
    assert.equal(await page.getByLabel('Colunas lado a lado', { exact: true }).inputValue(), '3');
    const testJob = async (columns, width, height) => {
      await page.getByLabel('Modelo de partida', { exact: true }).selectOption(`roll-${columns}`);
      const popupPromise = context.waitForEvent('page');
      await page.getByRole('button', { name: 'Teste de alinhamento', exact: true }).click();
      const popup = await popupPromise; popup.setDefaultTimeout(15000);
      await popup.waitForFunction(() => window.__labelsReady && window.__printCalls > 0);
      await popup.emulateMedia({ media: 'print' });
      assert.equal(await popup.locator('.print-sheet').count(), 2);
      assert.equal(await popup.locator('.label').count(), columns * 2);
      const rects = await popup.locator('.label').evaluateAll(nodes => nodes.map(node => { const r = node.getBoundingClientRect(), sheet = node.closest('.print-sheet').getBoundingClientRect(); return { x: r.x - sheet.x, y: r.y - sheet.y, width: r.width, height: r.height }; }));
      for (const r of rects) { assert.ok(Math.abs(r.width - mm(width)) < 0.1); assert.ok(Math.abs(r.height - mm(height)) < 0.1); assert.equal(r.y, 0); }
      const pageHeight = await popup.locator('.print-sheet').first().evaluate(node => node.getBoundingClientRect().height);
      assert.ok(Math.abs(pageHeight - mm(height)) < 0.1, 'O GAP não é somado à página de etiquetas com sensor');
      const ruler = await popup.locator('.calibration-svg path').first().evaluate(node => node.getBBox().width * node.getScreenCTM().a);
      assert.ok(Math.abs(ruler - mm(10)) < .15, 'A régua continua com 10 mm físicos');
      assert.equal(await popup.locator('.print-help').evaluate(node => getComputedStyle(node).display), 'none');
      await popup.screenshot({ path: path.join(os.tmpdir(), `etiquetas-teste-${columns}-colunas.png`), fullPage: true });
      await popup.close();
      console.log(`PASS bobina ${columns} coluna(s), ${width} × ${height} mm, GAP no driver, régua de 10 mm e duas páginas.`);
    };
    if (!process.env.LABEL_QUICK_TEST) { await testJob(1, 100, 50); await testJob(2, 50, 30); await testJob(3, 32, 25); }
    await page.getByLabel('Largura da etiqueta (mm)', { exact: true }).fill('60');
    assert.equal(await page.getByRole('button', { name: 'Teste de alinhamento', exact: true }).isDisabled(), true);
    await page.getByText(/As colunas, espaços e margens precisam/).waitFor();
    await page.getByLabel('Largura da etiqueta (mm)', { exact: true }).fill('32');
    await page.getByLabel('Deslocamento horizontal (mm)', { exact: true }).fill('-0.5');
    await page.getByLabel('Deslocamento vertical (mm)', { exact: true }).fill('0.3');
    await page.getByLabel('Escala do conteúdo (%)', { exact: true }).fill('90');
    await page.getByLabel('Nome do perfil', { exact: true }).fill('Elgin balcão 3 colunas');
    await page.getByRole('button', { name: 'Salvar e aplicar', exact: true }).click();
    await dialog.waitFor({ state: 'detached' });
    await page.getByText('Configuração salva e aplicada: Elgin balcão 3 colunas.', { exact: true }).waitFor();
    await page.getByText('Perfil ativo: Elgin balcão 3 colunas', { exact: true }).waitFor();
    await page.reload();
    await page.getByRole('button', { name: 'Configurar medidas', exact: true }).click();
    assert.equal(await page.getByLabel('Deslocamento horizontal (mm)', { exact: true }).inputValue(), '-0.5');
    await page.getByLabel('Modelo de partida', { exact: true }).selectOption('roll-1');
    await page.getByLabel('Carregar perfil deste navegador', { exact: true }).selectOption('0');
    assert.equal(await page.getByLabel('Colunas lado a lado', { exact: true }).inputValue(), '3');
    await page.getByRole('button', { name: 'Salvar e aplicar', exact: true }).click();
    await dialog.waitFor({ state: 'detached' });
    await page.getByRole('button', { name: 'Configurar medidas', exact: true }).click();
    await page.getByLabel('Largura da etiqueta (mm)', { exact: true }).fill('31');
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await page.getByRole('button', { name: 'Configurar medidas', exact: true }).click();
    assert.equal(await page.getByLabel('Largura da etiqueta (mm)', { exact: true }).inputValue(), '32', 'Cancelar descarta o rascunho');
    await page.getByLabel('Largura da etiqueta (mm)', { exact: true }).fill('31');
    await page.evaluate(() => { window.__storageSetItem = Storage.prototype.setItem; Storage.prototype.setItem = function (key, value) { if (key.endsWith(':profiles')) throw new Error('Armazenamento indisponível no teste'); return window.__storageSetItem.call(this, key, value); }; });
    await page.getByRole('button', { name: 'Salvar e aplicar', exact: true }).click();
    await dialog.getByRole('alert').filter({ hasText: /Não foi possível salvar/ }).waitFor();
    assert.equal(await dialog.isVisible(), true, 'Falha no armazenamento mantém a configuração aberta');
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('boxsys-label-print:v1:11:1')).width), 32);
    await page.evaluate(() => { Storage.prototype.setItem = window.__storageSetItem; });
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'detached' });
    await page.getByRole('button', { name: 'Selecionar produto', exact: true }).click();
    const preview = page.frameLocator('iframe[title="Prévia real da primeira página de etiquetas"]').first();
    try { await preview.locator('svg[viewBox]').first().waitFor(); }
    catch (error) { console.log(await preview.locator('body').evaluate(body => [...body.querySelectorAll('section,.label,.label-safe,.label-content,svg')].map(n => ({ tag: n.tagName, cls: n.getAttribute('class'), rect: n.getBoundingClientRect().toJSON(), display: getComputedStyle(n).display, transform: getComputedStyle(n).transform })))); await page.screenshot({path:path.join(os.tmpdir(),'etiquetas-debug.png'),fullPage:true}); throw error; }
    assert.equal(await preview.locator('.label:not(.empty-slot)').count(), 1);
    assert.equal(await preview.locator('.empty-slot').count(), 2);
    await page.evaluate(() => { document.querySelector('iframe[title="Prévia real da primeira página de etiquetas"]').parentElement.style.display = 'none'; });
    await preview.locator('.label-safe').first().evaluate(node => { if (node.clientWidth !== 0) throw new Error('A prévia deveria estar oculta neste ponto do teste'); });
    await page.evaluate(() => { document.querySelector('iframe[title="Prévia real da primeira página de etiquetas"]').parentElement.style.display = ''; });
    await preview.locator('.label-content[data-scale]:not([data-scale="0"])').first().waitFor();
    const initialHeight = await preview.locator('.label').first().evaluate(node => node.getBoundingClientRect().height);
    await page.getByRole('button', { name: 'Número/SKU', exact: true }).click();
    await page.getByRole('button', { name: 'QR Code', exact: true }).first().click();
    await preview.locator('.label-qr').waitFor();
    assert.ok(Math.abs(await preview.locator('.label').first().evaluate(node => node.getBoundingClientRect().height) - initialHeight) < .1, 'Adicionar campos mantém a altura física');
    await page.getByRole('button', { name: 'Preencher fileira com 3 cópias', exact: true }).click();
    assert.equal(await page.getByLabel('Quantidade de etiquetas de Câmera Ação & Conexão <Loja>', { exact: true }).inputValue(), '3');
    const rowPromise = context.waitForEvent('page');
    await page.getByRole('button', { name: 'Imprimir 3 etiquetas', exact: true }).click();
    const rowJob = await rowPromise; await rowJob.waitForFunction(() => window.__labelsReady && window.__printCalls > 0);
    assert.equal(await rowJob.locator('.print-sheet').count(), 1); assert.equal(await rowJob.locator('.label').count(), 3);
    const xs = await rowJob.locator('.label').evaluateAll(nodes => nodes.map(n => n.getBoundingClientRect().x)); assert.ok(xs[0] < xs[1] && xs[1] < xs[2]);
    await rowJob.close();
    await page.getByLabel('Quantidade de etiquetas de Câmera Ação & Conexão <Loja>', { exact: true }).fill('4');
    await page.waitForFunction(() => { const f = document.querySelector('iframe[title="Prévia real da primeira página de etiquetas"]'); return f && (f.srcdoc.match(/class="label" data-index/g) || []).length === 3; });
    const productPromise = context.waitForEvent('page');
    await page.getByRole('button', { name: 'Imprimir 4 etiquetas', exact: true }).click();
    const job = await productPromise; await job.waitForFunction(() => window.__labelsReady && window.__printCalls > 0);
    await job.emulateMedia({ media: 'print' });
    assert.equal(await job.locator('.print-sheet').count(), 2); assert.equal(await job.locator('.label').count(), 4);
    assert.equal(await job.locator('.label-name').first().textContent(), 'Câmera Ação & Conexão <Loja>');
    assert.equal(await job.locator('.label-price').first().textContent(), 'R$ 149,99');
    assert.ok((await job.locator('svg').first().getAttribute('viewBox')).startsWith('0 0 '));
    assert.equal(await job.locator('svg').first().getAttribute('preserveAspectRatio'), 'xMidYMid meet');
    const fits = await job.locator('.label-safe').evaluateAll(nodes => nodes.every(box => { const b = box.getBoundingClientRect(), c = box.firstElementChild.getBoundingClientRect(), m = new DOMMatrix(getComputedStyle(box.firstElementChild).transform); return c.left >= b.left - .5 && c.top >= b.top - .5 && c.right <= b.right + .5 && c.bottom <= b.bottom + .5 && Math.abs(m.a - m.d) < .0001; }));
    assert.ok(fits, 'Conteúdo e barras cabem na segurança sem distorção');
    await job.screenshot({ path: path.join(os.tmpdir(), 'etiquetas-produtos-3-colunas.png'), fullPage: true }); await job.close();
    for (const width of [1440, 375]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.getByText('Confira sua impressão', { exact: true }).scrollIntoViewIfNeeded();
      await preview.locator('svg[viewBox]').first().waitFor();
      await page.screenshot({ path: path.join(os.tmpdir(), `etiquetas-tela-${width}.png`), fullPage: true, animations: 'disabled' });
      assert.ok(await preview.locator('body').evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), 'A fileira inteira cabe sem rolagem horizontal');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByRole('tab', { name: 'Criar etiqueta própria', exact: true }).click();
    await page.getByLabel('Título da etiqueta', { exact: true }).fill('Retirada Ação & Conexão');
    await page.getByLabel('Pedido, OS ou orçamento', { exact: true }).fill('PED-1042');
    await page.getByRole('button', { name: 'QR Code', exact: true }).click();
    try { await page.frameLocator('iframe[title="Prévia real da primeira página de etiquetas"]').locator('.label-qr').waitFor(); }
    catch (error) { console.log({ errors, debug: await page.evaluate(() => ({ qrLibrary: typeof window.QRCode?.toCanvas, canvas: [...document.querySelectorAll('canvas')].map(c => ({ code: c.dataset.code, w: c.width, h: c.height })), iframes: [...document.querySelectorAll('iframe')].map(f => ({ qr: f.srcdoc.includes('label-qr"'), size: f.srcdoc.length })) })) }); throw error; }
    const customPromise = context.waitForEvent('page');
    await page.getByRole('button', { name: 'Imprimir 1 etiqueta', exact: true }).click();
    const custom = await customPromise; await custom.waitForFunction(() => window.__labelsReady && window.__printCalls > 0);
    assert.equal(await custom.locator('.label-title').textContent(), 'Retirada Ação & Conexão');
    assert.equal(await custom.locator('.label-qr').count(), 1); await custom.close();
    await page.getByRole('button', { name: 'Configurar medidas', exact: true }).click();
    for (const width of [1440, 375]) {
      await page.setViewportSize({ width, height: 1000 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      await page.getByLabel('Colunas lado a lado', { exact: true }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(os.tmpdir(), `etiquetas-configuracao-${width}.png`), fullPage: true, animations: 'disabled' });
      const bounds = await dialog.boundingBox(); assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width + 1);
      assert.ok(await dialog.getByRole('button', { name: 'Salvar e aplicar', exact: true }).isVisible());
    }
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await page.evaluate(() => { window.boxsysDesktop = { isDesktop: true, listUsbPrinters: async () => [{ name: 'BTP-L42-U', displayName: 'Elgin BTP-L42(U)', isDefault: true }, { name: 'PDF', displayName: 'Microsoft Print to PDF', isDefault: false }] }; });
    await page.getByRole('button', { name: 'Configurar medidas', exact: true }).click();
    await dialog.getByText('Elgin BTP-L42(U) · Padrão do Windows', { exact: true }).waitFor();
    await dialog.getByText('Microsoft Print to PDF', { exact: true }).waitFor();
    assert.ok(await dialog.getByLabel('Modelo de partida', { exact: true }).locator('option').count() >= 10);
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
    assert.deepEqual(errors, []);
    console.log('PASS modal, salvar/aplicar/fechar, cancelar, falha de armazenamento, perfis após recarga, teste com rascunho, produtos, cópias, UTF-8, códigos e telas desktop/celular. Nenhum trabalho enviado à impressora física.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
