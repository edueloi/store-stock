// Verificações de componentes reais com DOM simulado; não automatiza navegador.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),esbuild=require('esbuild'),postcss=require('postcss');
const root=path.resolve(__dirname,'..'),out=path.join(root,'tmp/optical-qa');fs.mkdirSync(out,{recursive:true});
const {JSDOM}=require(process.env.JSDOM_MODULE||path.join(root,'lojas/qa/node_modules/jsdom'));
const dom=new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>',{url:'http://localhost/',pretendToBeVisual:true});
Object.assign(global,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,Node:dom.window.Node,requestAnimationFrame:dom.window.requestAnimationFrame.bind(dom.window),cancelAnimationFrame:dom.window.cancelAnimationFrame.bind(dom.window),IS_REACT_ACT_ENVIRONMENT:true});
Object.defineProperty(global,'navigator',{value:dom.window.navigator,configurable:true});
window.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});window.scrollTo=()=>{};
const entry=`import Front from '${path.join(root,'src/views/Store/themes/optical/StoreFront.tsx').replaceAll('\\','/')}';
import Catalog from '${path.join(root,'src/views/Store/themes/optical/StoreCatalog.tsx').replaceAll('\\','/')}';
import Product from '${path.join(root,'src/views/Store/themes/optical/StoreProduct.tsx').replaceAll('\\','/')}';
import About from '${path.join(root,'src/views/Store/themes/optical/StoreAbout.tsx').replaceAll('\\','/')}';
import Cart from '${path.join(root,'src/views/Store/themes/optical/Cart.tsx').replaceAll('\\','/')}';
import {Header,Footer} from '${path.join(root,'src/views/Store/themes/optical/Chrome.tsx').replaceAll('\\','/')}';
export {Front,Catalog,Product,About,Cart,Header,Footer};export {StoreContext} from 'test-store';`;
const fixture={tenant:{id:918,name:'Ótica Ação',slug:'otica-demo',template_id:'lumiere',primary_color:'#454c35',whatsapp:'5511000000000',show_address:true,address:'Rua da Ação, 100',banner_url:'/banner-da-loja.jpg',about_text:'História real da ótica.',policies:{storefront:{checkout_mode:'online',show_whatsapp_widget:false},shipping:'Entrega a combinar.'}},categories:[{id:1,name:'Armações de grau'},{id:2,name:'Óculos de sol'}],products:[{id:1,name:'Armação Éloise',sku:'ACAO-1',price:389,is_active:true,is_featured:true,stock_quantity:5,track_stock:true,category_id:1,image_url:'/store-assets/lumiere-campaign-portrait-v1.webp',images:['/frame-1.webp','/frame-2.webp'],attributes:[{name:'Cor',values:['Âmbar','Preto']}],skus:[{combo:{Cor:'Âmbar'},stock:3},{combo:{Cor:'Preto'},stock:0}],description:'Armação com medidas e descrição da loja.'},{id:2,name:'Óculos Solar',price:459,discount_price:399,is_active:true,is_featured:true,stock_quantity:8,track_stock:true,category_id:2,image_url:'/solar.webp'},{id:3,name:'Produto inativo',price:100,is_active:false,category_id:1}]};
(async()=>{
await esbuild.build({stdin:{contents:entry,resolveDir:root,loader:'tsx'},bundle:true,define:{'import.meta.env':'{}'},platform:'node',format:'cjs',jsx:'automatic',outfile:path.join(out,'cases.cjs'),external:['react','react-dom','react-dom/client','react/jsx-runtime','react-router-dom'],plugins:[{name:'context-and-styles',setup(build){build.onResolve({filter:/(?:StoreLayout$|^test-store$)/},()=>({path:'test-store',namespace:'fixture'}));build.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:"import {createContext,useContext} from 'react';export const StoreContext=createContext(null);export const useStore=()=>useContext(StoreContext);",resolveDir:root}));build.onLoad({filter:/\.css$/},()=>({contents:'',loader:'empty'}));}}]});
const React=require('react'),{act}=React,{createRoot}=require('react-dom/client'),{MemoryRouter,Routes,Route,useLocation}=require('react-router-dom'),C=require(path.join(out,'cases.cjs'));
const e=React.createElement,host=document.getElementById('root'),r=createRoot(host),calls=[];
const value=(brand)=>({...fixture,templateId:brand,tenant:{...fixture.tenant,template_id:brand},cart:[],wishlist:[2],style:{},addToCart:(...args)=>calls.push(args),openCart:()=>calls.push('open'),closeCart:()=>calls.push('close'),toggleWishlist:id=>calls.push(['favorite',id]),updateQuantity:(...args)=>calls.push(['quantity',...args]),removeFromCart:id=>calls.push(['remove',id])});
function Location(){return e('output',{'data-location':true},useLocation().pathname+useLocation().search);}
async function mount(brand,suffix='',extra={},component){const v={...value(brand),...extra};const content=e(C.StoreContext.Provider,{value:v},e(C.Header),component||e(Routes,null,e(Route,{index:true,element:e(C.Front)}),e(Route,{path:'catalogo',element:e(C.Catalog)}),e(Route,{path:'produto/:productId',element:e(C.Product)}),e(Route,{path:'sobre',element:e(C.About)})),e(C.Footer),e(Location));await act(async()=>{r.render(e(MemoryRouter,{key:brand+suffix+JSON.stringify(Object.keys(extra)),initialEntries:[`/s/otica-demo${suffix}`]},e(Routes,null,e(Route,{path:'/s/:slug/*',element:content}))));});return v;}
const click=async node=>{assert.ok(node,'Controle esperado');await act(async()=>node.click());};
for(const brand of ['lumiere','orbita']){
 await mount(brand,`?previewTheme=${brand}`);
 assert.match(document.querySelector('h1').textContent,brand==='lumiere'?/Um novo/:/SEU OLHAR/);
 const hero=document.querySelector(brand==='lumiere'?'.lumiere-hero':'.urban-hero');assert.ok(hero.querySelector('picture source'));assert.match(hero.querySelector('picture img').src,new RegExp(`${brand}-campaign-wide`));assert.equal(document.querySelectorAll('.product-card').length,2);
 await click(document.querySelector('.menu-btn'));assert.equal(document.querySelector('.menu-btn').getAttribute('aria-expanded'),'true');await click(document.querySelector('.mobile-nav a[href*="catalogo"]'));assert.equal(document.querySelector('.mobile-nav'),null);assert.match(document.querySelector('[data-location]').textContent,new RegExp(`previewTheme=${brand}`));
 await mount(brand,`/catalogo?q=eloise&previewTheme=${brand}`);assert.equal(document.querySelectorAll('.product-card').length,1,'Busca sem acentos');
 await mount(brand,`/catalogo?categoria=2&previewTheme=${brand}`);assert.equal(document.querySelectorAll('.product-card').length,1);assert.match(document.querySelector('.product-title').textContent,/Solar/);
 await mount(brand,`/catalogo?favoritos=1&previewTheme=${brand}`);assert.equal(document.querySelectorAll('.product-card').length,1);assert.match(document.querySelector('.product-title').textContent,/Solar/);
 await mount(brand,`/produto/armacao-eloise-1?previewTheme=${brand}`);assert.ok(document.querySelector('.buy-row>.btn').disabled,'Variação obrigatória');const options=[...document.querySelectorAll('.opt-variations button')];await click(options.find(x=>x.textContent.includes('Âmbar')));assert.equal(document.querySelector('.buy-row>.btn').disabled,false);await click(document.querySelector('.buy-row>.btn'));assert.equal(calls.at(-1)[1].Cor,'Âmbar');await click(options.find(x=>x.textContent.includes('Preto')));assert.ok(document.querySelector('.buy-row>.btn').disabled,'SKU sem saldo');
 await mount(brand,`/sobre?previewTheme=${brand}`);assert.match(document.querySelector('.opt-contact').textContent,/Rua da Ação/);
 await mount(brand,'');assert.equal(new URL(hero.querySelector('picture img').src).pathname,`/store-assets/${brand}-campaign-wide-v1.webp`);assert.equal(document.querySelector('picture img').getAttribute('src'),'/banner-da-loja.jpg','Banner real tem prioridade fora da prévia');
 const item={...fixture.products[1],quantity:2,cartItemId:'2',variationLabel:'',selectedOptions:{}};let checkout=0;await mount(brand,`?previewTheme=${brand}`,{cart:[item]},e(C.Cart,{isOpen:true,onCheckout:()=>checkout++,busy:false}));assert.match(document.querySelector('.cart-summary').textContent,/918,00/);await click(document.querySelector('#opt-cart .btn.primary'));assert.equal(checkout,1,'Checkout nativo');await click(document.querySelector('.remove-item'));assert.deepEqual(calls.at(-1),['remove','2']);await act(async()=>document.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Escape',bubbles:true})));assert.equal(calls.at(-1),'close');
 const css=postcss.parse(fs.readFileSync(path.join(root,`src/views/Store/themes/${brand}/styles.css`),'utf8'));css.walkRules(rule=>{let p=rule.parent;while(p){if(p.type==='atrule'&&p.name.includes('keyframes'))return;p=p.parent;}assert.ok(rule.selectors.every(s=>s.startsWith('.store-theme-'+brand)),'CSS isolado');});assert.ok(fs.existsSync(path.join(root,`public/store-assets/${brand}-campaign-wide-v1.webp`)));
 console.log(`PASS ${brand}: campanha, banner customizado, menu, preview preservado, catálogo real, acentos, categoria, favoritos, variação, SKU sem estoque, sacola e checkout.`);
}
for(const brand of ['lumiere','orbita']){
 const tenant={...value(brand).tenant,name:'Distribuidora de Armações Ferraro',hero_tagline:'Tradição\nno traço.',policies:{...fixture.tenant.policies,storefront:{...fixture.tenant.policies.storefront,brand_identity:'ferraro'}}};
 await mount(brand,`?previewTheme=${brand}`,{tenant});
 assert.equal(document.querySelector('.header .ferraro-signature img').getAttribute('src'),'/store-assets/ferraro/logo-black.png');
 assert.equal(document.querySelector('.header .ferraro-signature source').getAttribute('srcset'),'/store-assets/ferraro/wordmark-black.svg');
 assert.equal(document.querySelector('.footer .ferraro-signature img').getAttribute('src'),'/store-assets/ferraro/logo-white.png');
 assert.match(document.querySelector('h1').textContent,/Tradição/);assert.ok(!/\?\?|\uFFFD/.test(document.querySelector('h1').textContent));
 assert.match(document.querySelector('.opt-page picture img').src,/lumiere-campaign-wide/);
 assert.match(document.querySelector('.announcement').textContent,/DISTRIBUIDORA DE ARMAÇÕES/);
 await mount(brand,`/catalogo?previewTheme=${brand}`,{tenant});assert.equal(document.querySelectorAll('.product-card').length,2);
 await mount(brand,`/sobre?previewTheme=${brand}`,{tenant});assert.match(document.querySelector('h1').textContent,/Tradição/);
 console.log(`PASS Ferraro em ${brand}: logo original, assinatura móvel, contraste do rodapé, acentos, campanha neutra, catálogo e sobre.`);
}
const identity=postcss.parse(fs.readFileSync(path.join(root,'src/views/Store/themes/optical/ferraro.css'),'utf8'));identity.walkRules(rule=>assert.ok(rule.selectors.every(s=>s.startsWith('.store-brand-ferraro')),'Identidade deve ficar limitada à loja Ferraro'));
for(const file of ['logo-black.png','logo-white.png','wordmark-black.svg','DejaVuSerif.woff','DejaVuSans.woff','DejaVuSans-Bold.woff','LICENSE_DEJAVU.txt'])assert.ok(fs.existsSync(path.join(root,'public/store-assets/ferraro',file)));
const layout=fs.readFileSync(path.join(root,'src/views/Store/StoreLayout.tsx'),'utf8');assert.match(layout,/<OpticalCart/);assert.match(layout,/\["lumiere", "orbita"\]\.includes/);assert.match(layout,/storefront.brand_identity === "ferraro" && "store-brand-ferraro"/);const settings=fs.readFileSync(path.join(root,'src/views/Dashboard/Settings.tsx'),'utf8');assert.match(settings,/Óticas & Armações/);
await act(async()=>r.unmount());dom.window.close();console.log('PASS registro no seletor, sacola nativa, estilos isolados e assets.');
})().catch(error=>{console.error(error);dom.window.close();process.exitCode=1;});
