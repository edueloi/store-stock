const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const base = process.env.HISTORY_TEST_URL || 'http://127.0.0.1:4188';
const rows = Array.from({ length: 147 }, (_, index) => ({
  id: index + 1, conversation_id: index < 2 ? 88 : index + 90, phone: index < 2 ? '5515999999999' : `551199999${String(index).padStart(4, '0')}`,
  customer_name: index < 2 ? 'Karen Ação' : `Cliente ${index + 1}`, subject: index === 0 ? 'Preciso de uma bolsa preta para amanhã.' : index === 1 ? 'Preciso da segunda via da nota fiscal.' : `Consulta sobre produto ${index + 1}`,
  started_at: index === 0 ? '2026-10-22T12:00:00Z' : '2026-10-20T12:00:00Z', closed_at: index === 0 ? '2026-10-22T13:00:00Z' : '2026-10-20T13:00:00Z',
  department: index === 1 ? 'finance' : 'sales', department_label: index === 1 ? 'Financeiro' : 'Vendas', agent_id: index === 1 ? 6 : 5, agent_name: index === 1 ? 'Ana' : 'Edu', close_reason: index === 1 ? 'customer-request' : 'manual', message_count: 3, legacy_import: index === 3,
}));

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
  try {
    const page = await browser.newPage({ serviceWorkers: 'block' }); page.setDefaultTimeout(20000);
    const errors = [], requests = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => { localStorage.setItem('token', 'teste'); localStorage.setItem('user', JSON.stringify({ id: 1, name: 'Gestão', role: 'admin' })); });
    await page.route('**/api/**', async route => {
      const url = new URL(route.request().url()), q = url.searchParams;
      let json = [];
      if (url.pathname === '/api/whatsapp/history') {
        requests.push(url.search);
        const filtered = rows.filter(row => (!q.get('q') || row.customer_name.toLowerCase().includes(q.get('q').toLowerCase()) || row.phone.includes(q.get('q').replace(/\D/g, '') || q.get('q')))
          && (!q.get('subject') || row.subject.includes(q.get('subject')))
          && (!q.get('from') || row.closed_at.slice(0, 10) >= q.get('from')) && (!q.get('to') || row.closed_at.slice(0, 10) <= q.get('to'))
          && (!q.get('agent') || String(row.agent_id) === q.get('agent')) && (!q.get('department') || row.department === q.get('department'))
          && (!q.get('reason') || (q.get('reason') === 'team' ? row.close_reason === 'manual' : row.close_reason === 'customer-request')));
        const current = Number(q.get('page') || 1);
        json = { records: filtered.slice((current - 1) * 20, current * 20), page: current, page_size: 20, pages: Math.max(1, Math.ceil(filtered.length / 20)), total: filtered.length, clients: new Set(filtered.map(row => row.phone)).size, messages: filtered.length * 3, sectors: [{ key: 'sales', name: 'Vendas' }, { key: 'finance', name: 'Financeiro' }], agents: [{ id: 5, name: 'Edu' }, { id: 6, name: 'Ana' }] };
      } else if (/\/api\/whatsapp\/history\/\d+$/.test(url.pathname)) {
        const record = rows.find(row => row.id === Number(url.pathname.split('/').at(-1)));
        json = { record, messages: [{ id: record.id * 100, direction: 'customer', body: record.subject, message_type: 'text', created_at: record.started_at }, { id: record.id * 100 + 1, direction: 'agent', body: `Resposta preservada de ${record.agent_name}.`, message_type: 'text', created_at: record.closed_at }], next_cursor: null };
      } else if (url.pathname === '/api/whatsapp/overview') json = { stats: { bot_conversations: 0, queued_conversations: 0, assigned_conversations: 0, closed_conversations: 147 } };
      else if (url.pathname === '/api/tenant') json = { id: 1, name: 'Loja Ação', slug: 'loja-acao' };
      else if (url.pathname.startsWith('/api/preferences/')) json = { value: null };
      else if (url.pathname.endsWith('count')) json = { count: 0 };
      await route.fulfill({ json });
    });
    for (const width of [1440, 375]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(`${base}/admin/atendimento/finalizados`);
      await page.getByText('1–20 de 147 atendimentos', { exact: true }).waitFor();
      assert.equal(await page.locator('a[href="/admin/atendimento/finalizados"] .rounded-full').count(), 0);
      await page.getByLabel('Cliente ou telefone', { exact: true }).fill('Karen');
      await page.getByText('1–2 de 2 atendimentos', { exact: true }).waitFor();
      await page.getByLabel('Assunto', { exact: true }).fill('bolsa');
      await page.getByText('1–1 de 1 atendimentos', { exact: true }).waitFor();
      await page.getByLabel('Encerrados a partir de', { exact: true }).fill('2026-10-22');
      await page.getByLabel('Encerrados até', { exact: true }).fill('2026-10-22');
      await page.getByLabel('Setor', { exact: true }).selectOption('sales');
      await page.getByLabel('Responsável', { exact: true }).selectOption('5');
      await page.getByLabel('Encerramento', { exact: true }).selectOption('team');
      await page.waitForFunction(() => !document.querySelector('[aria-label="Atendimentos finalizados"]').getAttribute('aria-busy')?.includes('true'));
      for (const [key, value] of Object.entries({ q: 'Karen', subject: 'bolsa', from: '2026-10-22', to: '2026-10-22', department: 'sales', agent: '5', reason: 'team' })) assert.equal(new URL(page.url()).searchParams.get(key), value, `Filtro ${key} preservado`);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      await page.screenshot({ path: path.join(os.tmpdir(), `whatsapp-historico-${width}.png`), fullPage: true });
      await page.getByRole('button', { name: 'Ver conversa do atendimento #000001', exact: true }).click();
      await page.getByText('Resposta preservada de Edu.', { exact: true }).waitFor();
      assert.equal(await page.getByText('Preciso da segunda via da nota fiscal.', { exact: true }).count(), 0);
      assert.equal(await page.getByRole('button', { name: 'Enviar mensagem', exact: true }).count(), 0);
      await page.screenshot({ path: path.join(os.tmpdir(), `whatsapp-historico-conversa-${width}.png`), fullPage: true });
      await page.getByRole('button', { name: 'Voltar ao histórico', exact: true }).click();
      assert.equal(await page.getByLabel('Cliente ou telefone', { exact: true }).inputValue(), 'Karen');
      assert.equal(await page.getByLabel('Encerrados até', { exact: true }).inputValue(), '2026-10-22');
      await page.getByRole('button', { name: 'Limpar filtros', exact: true }).click();
      await page.getByText('1–20 de 147 atendimentos', { exact: true }).waitFor();
      await page.getByRole('button', { name: 'Próxima', exact: true }).click();
      await page.getByText('21–40 de 147 atendimentos', { exact: true }).waitFor();
      await page.getByLabel('Cliente ou telefone', { exact: true }).fill('Não existe');
      await page.getByRole('heading', { name: 'Nenhum atendimento encontrado', exact: true }).waitFor();
      console.log(`PASS ${width}px: filtros combinados, paginação além de 100, conversa separada, retorno preservando filtros, vazio e sem badge nos finalizados.`);
    }
    assert.ok(requests.some(q => q.includes('reason=team') && q.includes('agent=5') && q.includes('subject=bolsa')));
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
