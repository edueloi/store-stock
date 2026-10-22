const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
const base = process.env.ATTENDANCE_TEST_URL || 'http://127.0.0.1:4187';

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
  try {
    const page = await browser.newPage({ serviceWorkers: 'block' });
    const errors = [], writes = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      localStorage.setItem('token', 'token-falso-de-teste');
      localStorage.setItem('user', JSON.stringify({ id: 1, name: 'Gestão', role: 'admin' }));
    });
    const agent = { id: 1, name: 'Edu', department: 'sales', phone: '11999999999', email: '', is_active: true, is_online: true, can_receive_transfer: true, current_load: 0, max_concurrent_chats: 3, is_available: false, business_hours: null, attendance_hours: { openNow: false, today: 'Quinta: 09:00 às 17:00', text: 'Quinta: 09:00 às 17:00' } };
    const overview = { workspace: { is_enabled: true, settings: { ai_provider: 'rules' }, menus: [], templates: {} }, sectors: [{ id: 1, key: 'sales', name: 'Vendas', is_active: true }], agents: [agent], stats: { bot_conversations: 0, queued_conversations: 0, assigned_conversations: 0, online_agents: 0 } };
    await page.route('**/api/**', async route => {
      const req = route.request(), url = new URL(req.url());
      let body = [];
      if (url.pathname === '/api/whatsapp/overview') body = overview;
      else if (url.pathname === '/api/whatsapp/connection-status') body = { connected: false };
      else if (url.pathname === '/api/tenant') body = { id: 1, name: 'Loja Ação', slug: 'loja-acao' };
      else if (url.pathname === '/api/whatsapp/agents/1' && req.method() === 'PATCH') {
        const payload = req.postDataJSON(); writes.push(payload); Object.assign(agent, payload); body = agent;
      } else if (url.pathname.startsWith('/api/preferences/')) body = { value: null };
      else if (url.pathname.endsWith('count')) body = { count: 0 };
      await route.fulfill({ json: body });
    });
    for (const width of [1440, 375]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(`${base}/admin/whatsapp`);
      await page.getByRole('tab', { name: 'Setores e equipe' }).click();
      await page.getByRole('button', { name: 'Editar expediente' }).click();
      assert.equal(await page.getByRole('switch', { name: 'Usar o horário da loja', exact: true }).getAttribute('aria-checked'), 'true');
      await page.getByRole('switch', { name: 'Usar o horário da loja', exact: true }).click();
      await page.getByRole('switch', { name: 'Quinta', exact: true }).click();
      await page.getByLabel('Entrada de Quinta', { exact: true }).fill('09:00');
      await page.getByLabel('Saída de Quinta', { exact: true }).fill('17:00');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      await page.screenshot({ path: path.join(os.tmpdir(), `whatsapp-expediente-${width}.png`) });
      await page.getByRole('button', { name: 'Salvar atendente e expediente', exact: true }).click();
      await page.getByRole('button', { name: 'Editar expediente' }).waitFor();
      const payload = writes.at(-1);
      assert.deepEqual(payload.business_hours.qui, { open: '09:00', close: '17:00', closed: false });
      assert.equal(payload.business_hours.dom.closed, true);
      assert.equal(payload.is_online, undefined); // editar não muda o status existente
      await page.getByRole('button', { name: 'Editar expediente' }).click();
      assert.equal(await page.getByLabel('Saída de Quinta', { exact: true }).inputValue(), '17:00');
      await page.getByRole('switch', { name: 'Usar o horário da loja', exact: true }).click();
      await page.getByRole('button', { name: 'Salvar atendente e expediente', exact: true }).click();
      await page.getByRole('button', { name: 'Editar expediente' }).waitFor();
      assert.equal(writes.at(-1).business_hours, null);
      console.log(`PASS ${width}px: editar, salvar 09h–17h, reabrir e herdar horário da loja, sem mudar status do atendente.`);
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
