// Componentes reais com DOM simulado; não controla navegador.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const esbuild = require('esbuild'), postcss = require('postcss');
const root = path.resolve(__dirname, '..'), out = path.join(root, 'tmp/mm-qa');
fs.mkdirSync(out, { recursive: true });
const { JSDOM } = require(process.env.JSDOM_MODULE || path.join(root, 'lojas/qa/node_modules/jsdom'));
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost/', pretendToBeVisual: true });
Object.assign(global, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, sessionStorage: dom.window.sessionStorage, requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window), cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window), IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(global, 'navigator', { value: dom.window.navigator, configurable: true });
window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
window.scrollTo = () => {};
const entry = ['StoreFront', 'StoreCatalog', 'StoreProduct', 'StoreAbout'].map(name => `export {default as ${name}} from '${path.join(root, 'src/views/Store/themes/vidracaria', name + '.tsx').replaceAll('\\', '/')}';`).join('\n') + `\nexport {Header,Footer} from '${path.join(root, 'src/views/Store/themes/vidracaria/Chrome.tsx').replaceAll('\\', '/')}'; export {StoreContext} from 'test-store';`;
const tenant = { id: 8, name: 'M&M DISTRIBUIDORA DE VIDROS E ALUMÍNIOS', slug: 'mm-demo', template_id: 'vidracaria', logo_url: '/mm-logo.jpg', whatsapp: '5515999990000', show_address: true, address: 'Rua da Ação, Tatuí', about_text: 'História da loja. Distribuição de vidros e ferragens.', policies: { storefront: { brand_identity: 'mm-glass', checkout_mode: 'reservation' } } };
const products = [
  { id: 1, name: 'Dobradiça cromada', price: 79.9, is_active: true, is_featured: true, category_id: 1, image_url: '/dobradica.png', attributes: [{ name: 'Cor', values: ['Cromado', 'Preto'] }], description: 'Ferragem para vidro.', stock_quantity: 20, sale_unit: 'unidade' },
  { id: 2, name: 'Perfil de alumínio', price: 120, is_active: true, category_id: 2, image_url: '/perfil.png', sale_unit: 'unidade' },
  { id: 3, name: 'Peça inativa', price: 50, is_active: false, category_id: 1 },
];
(async () => {
  await esbuild.build({ stdin: { contents: entry, resolveDir: root, loader: 'tsx' }, bundle: true, define: { 'import.meta.env': '{}' }, platform: 'node', format: 'cjs', jsx: 'automatic', outfile: path.join(out, 'cases.cjs'), external: ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime', 'react-router-dom'], plugins: [{ name: 'context', setup(build) { build.onResolve({ filter: /(?:StoreLayout$|^test-store$)/ }, () => ({ path: 'test-store', namespace: 'fixture' })); build.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: "import {createContext,useContext} from 'react';export const StoreContext=createContext(null);export const useStore=()=>useContext(StoreContext);", resolveDir: root })); build.onLoad({ filter: /\.css$/ }, () => ({ contents: '', loader: 'empty' })); } }] });
  const React = require('react'), { act } = React, { createRoot } = require('react-dom/client'), { MemoryRouter, Routes, Route } = require('react-router-dom'), C = require(path.join(out, 'cases.cjs'));
  const e = React.createElement, renderer = createRoot(document.getElementById('root')), calls = [];
  async function mount(suffix = '', currentTenant = tenant) {
    const v = { tenant: currentTenant, products, categories: [{ id: 1, name: 'Ferragens' }, { id: 2, name: 'Alumínios' }], cart: [], openCart: () => calls.push('open'), addToCart: (...args) => calls.push(args) };
    await act(async () => renderer.render(e(MemoryRouter, { key: suffix + JSON.stringify(currentTenant), initialEntries: ['/s/mm-demo' + suffix] }, e(Routes, null, e(Route, { path: '/s/:slug/*', element: e(C.StoreContext.Provider, { value: v }, e(C.Header), e(Routes, null, e(Route, { index: true, element: e(C.StoreFront) }), e(Route, { path: 'catalogo', element: e(C.StoreCatalog) }), e(Route, { path: 'produto/:productId', element: e(C.StoreProduct) }), e(Route, { path: 'sobre', element: e(C.StoreAbout) })), e(C.Footer)) })))));
  }
  const click = async node => { assert.ok(node, 'Controle presente'); await act(async () => node.click()); };
  await mount();
  assert.match(document.querySelector('h1').textContent, /Transparência/);
  assert.match(document.querySelector('.mm-hero picture img').src, /shower-hero-v1/);
  assert.match(document.querySelector('.mm-hero source').srcset, /windows-portrait/);
  assert.equal(document.querySelector('.mm-hero p').textContent.includes(tenant.about_text), false, 'História longa fica na página sobre');
  assert.equal(document.querySelectorAll('.vitra-product-card').length, 1, 'Seleção de destaques respeitada');
  assert.match(document.querySelector('.mm-footer-heading').textContent, /projeto inteiro/);
  assert.equal(document.querySelector('.mm-footer-logo').getAttribute('src'), '/mm-logo.jpg');
  await click(document.querySelector('[aria-label="Abrir menu"]'));
  assert.equal(document.querySelector('.vitra-mobile-menu').classList.contains('open'), true);
  await click(document.querySelector('#vitra-header-menu a[href$="catalogo"]'));
  assert.match(document.querySelector('h1').textContent, /Soluções/);
  await click(document.querySelector('[aria-label="Carrinho, 0 itens"]'));
  assert.equal(calls.at(-1), 'open');
  await mount('/catalogo?cat=2');
  assert.equal(document.querySelectorAll('.vitra-product-card').length, 1);
  assert.match(document.querySelector('.vitra-product-name').textContent, /Perfil/);
  await mount('/produto/dobradica-cromada-1');
  assert.match(document.querySelector('h1').textContent, /Dobradiça/);
  assert.ok(document.querySelector('.mm-product-service'));
  await act(async () => document.querySelector('.vitra-config').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })));
  assert.ok(document.querySelector('[role="alert"]'), 'Opção obrigatória validada');
  const color = document.querySelector('input[type="radio"][value="Cromado"]');
  await click(color);
  await act(async () => document.querySelector('.vitra-config').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })));
  assert.equal(calls.at(-1)[0].id, 1);
  assert.equal(calls.at(-1)[1].Cor, 'Cromado', 'Opção real enviada ao carrinho nativo');
  assert.match(document.querySelector('[role="status"]').textContent, /adicionado ao carrinho/);
  await click(document.querySelector('[role="status"] button'));
  assert.equal(calls.at(-1), 'open');
  await mount('/sobre');
  assert.match(document.querySelector('.vitra-about-story').textContent, /História da loja/);
  await mount('', { ...tenant, banner_url: '/banner-proprio.jpg' });
  assert.equal(document.querySelector('.mm-hero img').getAttribute('src'), '/banner-proprio.jpg');
  assert.equal(document.querySelector('.mm-hero source'), null, 'Banner escolhido pela loja tem prioridade');
  await mount('', { ...tenant, policies: { storefront: {} } });
  assert.equal(document.querySelector('.mm-hero'), null, 'Outras lojas Vitra mantêm seu modelo');
  assert.ok(document.querySelector('.vitra-editorial-hero'));
  const css = postcss.parse(fs.readFileSync(path.join(root, 'src/views/Store/themes/vidracaria/mm.css'), 'utf8'));
  css.walkRules(rule => { if (rule.parent.type === 'atrule' && rule.parent.name.includes('keyframes')) return; assert.ok(rule.selectors.every(selector => selector.startsWith('.store-brand-mm')), 'Estilos exclusivos M&M'); });
  for (const file of ['shower-hero-v1.webp', 'windows-portrait-v1.webp']) assert.ok(fs.statSync(path.join(root, 'public/store-assets/mm-glass', file)).size > 10000);
  await act(async () => renderer.unmount()); dom.window.close();
  console.log('PASS M&M: campanha desktop/mobile, banner próprio, destaques, categorias, navegação, produto com opção obrigatória, carrinho nativo, sobre, rodapé e estilos exclusivos.');
})().catch(error => { console.error(error); dom.window.close(); process.exitCode = 1; });
