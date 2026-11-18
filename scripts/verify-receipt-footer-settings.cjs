const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const esbuild = require('esbuild');
const root = path.resolve(__dirname, '..');
const { JSDOM } = require(process.env.JSDOM_MODULE || path.join(root, 'lojas/qa/node_modules/jsdom'));
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost/' });
Object.assign(global, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(global, 'navigator', { value: dom.window.navigator, configurable: true });
const out = path.join(root, 'tmp/receipt-footer-settings.cjs');
esbuild.buildSync({ absWorkingDir: root, entryPoints: ['src/components/settings/ReceiptFooterSettings.tsx'], bundle: true, platform: 'node', format: 'cjs', packages: 'external', outfile: out });
const React = require('react');
const { act } = React;
const { createRoot } = require('react-dom/client');
const Component = require(out).default;
let current;
function Harness() {
  const [value, setValue] = React.useState();
  current = value;
  return React.createElement(Component, { value, onChange: setValue });
}
(async () => {
  const renderer = createRoot(document.getElementById('root'));
  await act(async () => renderer.render(React.createElement(Harness)));
  assert.equal(document.querySelector('[role="switch"]').getAttribute('aria-checked'), 'false');
  const example = [...document.querySelectorAll('button')].find(button => button.textContent.startsWith('Usar exemplo'));
  await act(async () => example.click());
  assert.equal(current.enabled, true);
  assert.ok(current.message.includes('3 dias'));
  assert.ok(document.querySelector('pre').textContent.includes('POLÍTICA DE TROCA'));
  const textarea = document.querySelector('textarea');
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set.call(textarea, 'Ação e apresentação da nota.');
    textarea.dispatchEvent(new window.Event('input', { bubbles: true }));
  });
  assert.equal(current.message, 'Ação e apresentação da nota.');
  assert.ok(document.querySelector('pre').textContent.includes(current.message));
  await act(async () => document.querySelector('[role="switch"]').click());
  assert.equal(current.enabled, false);
  assert.equal(current.message, 'Ação e apresentação da nota.');
  assert.ok(document.querySelector('pre').textContent.includes('não será impressa'));
  await act(async () => document.querySelector('[role="switch"]').click());
  assert.ok(document.querySelector('pre').textContent.includes('apresentação'));
  await act(async () => renderer.unmount());
  dom.window.close();
  console.log('OK: configuração controlada, exemplo de troca, edição com acentos, prévia e ativação/desativação sem perder o texto.');
})().catch(error => { console.error(error); process.exit(1); });
