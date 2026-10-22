const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const base = process.env.AUTH_TEST_URL || 'http://127.0.0.1:4189';

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
  try {
    const page = await browser.newPage({ serviceWorkers: 'block' });
    let forgotStatus = 500, resetStatus = 400, resetCalls = 0, forgotBody;
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route('**/api/**', route => route.fulfill({ json: {} }));
    await page.route('**/api/auth/forgot-password', route => {
      forgotBody = route.request().postDataJSON();
      return route.fulfill({ status: forgotStatus, json: forgotStatus === 200 ? { message: 'Instruções enviadas.' } : { error: 'Falha temporária' } });
    });
    await page.route('**/api/auth/reset-password', route => {
      resetCalls++;
      assert.equal(route.request().postDataJSON().token, 'token-de-teste');
      return route.fulfill({ status: resetStatus, json: resetStatus === 200 ? { message: 'Senha redefinida.' } : { error: 'Link inválido ou expirado.' } });
    });
    const go = async url => {
      await page.goto(base + url, { waitUntil: 'domcontentloaded' });
      await page.locator('.ar-card').waitFor();
      await page.locator('#app-splash').waitFor({ state: 'hidden' });
    };
    for (const width of [1440, 375]) {
      await page.setViewportSize({ width, height: 1000 });
      await go('/forgot-password');
      assert.equal(await page.locator('img[src*="logo-boxsys-vazado"]').count(), 0);
      assert.ok(await page.locator('.ar-brand img').first().evaluate(img => img.complete && img.naturalWidth > 0));
      await page.getByLabel('E-mail da sua conta', { exact: true }).fill('karen@example.com');
      await page.getByRole('button', { name: 'Enviar link de recuperação' }).click();
      await page.getByRole('alert').waitFor();
      assert.equal(await page.getByRole('heading', { name: 'Confira seu e-mail' }).count(), 0);
      forgotStatus = 200;
      await page.getByRole('button', { name: 'Enviar link de recuperação' }).click();
      await page.getByRole('heading', { name: 'Confira seu e-mail' }).waitFor();
      assert.deepEqual(forgotBody, { email: 'karen@example.com' });
      assert.match(await page.locator('.ar-card').innerText(), /Se karen@example.com estiver cadastrado/);
      await page.getByRole('button', { name: 'Usar outro e-mail' }).click();
      await page.getByRole('heading', { name: 'Esqueceu a senha?' }).waitFor();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      await page.screenshot({ path: path.join(os.tmpdir(), `boxsys-forgot-${width}.png`), fullPage: true });
      await go('/reset-password/token-de-teste');
      await page.getByLabel('Nova senha', { exact: true }).fill('SenhaTeste123');
      await page.getByLabel('Confirme a nova senha', { exact: true }).fill('SenhaDiferente123');
      const callsBefore = resetCalls;
      await page.getByRole('button', { name: 'Salvar nova senha' }).click();
      assert.match(await page.getByRole('alert').innerText(), /não coincidem/);
      assert.equal(resetCalls, callsBefore);
      await page.getByLabel('Confirme a nova senha', { exact: true }).fill('SenhaTeste123');
      await page.getByRole('button', { name: 'Mostrar nova senha', exact: true }).click();
      assert.equal(await page.getByLabel('Nova senha', { exact: true }).getAttribute('type'), 'text');
      await page.getByRole('button', { name: 'Ocultar nova senha', exact: true }).click();
      await page.getByRole('button', { name: 'Salvar nova senha' }).click();
      await page.getByText('Link inválido ou expirado.', { exact: true }).waitFor();
      assert.equal(await page.getByRole('link', { name: 'Solicitar um novo link' }).count(), 1);
      await page.screenshot({ path: path.join(os.tmpdir(), `boxsys-reset-${width}.png`), fullPage: true });
      resetStatus = 200;
      await page.getByRole('button', { name: 'Salvar nova senha' }).click();
      await page.getByRole('heading', { name: 'Sua senha foi atualizada' }).waitFor();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      forgotStatus = 500; resetStatus = 400;
      console.log(`PASS ${width}px: marca atual, solicitação, falha HTTP, confirmação, senhas diferentes, link expirado e nova senha.`);
    }
    assert.deepEqual(errors, []);
    const email = await browser.newPage();
    for (const width of [720, 375]) {
      await email.setViewportSize({ width, height: 1000 });
      await email.goto(pathToFileURL(path.join(os.tmpdir(), 'boxsys-password-reset-preview.html')).href);
      assert.ok(await email.locator('img').evaluate(img => img.complete && img.naturalWidth > 0));
      assert.ok(await email.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      await email.screenshot({ path: path.join(os.tmpdir(), `boxsys-reset-email-${width}.png`), fullPage: true });
      console.log(`PASS e-mail ${width}px: logo novo, mensagem, botão e link alternativo sem corte.`);
    }
  } finally { await browser.close(); }
})().catch(err => { console.error(err); process.exitCode = 1; });
