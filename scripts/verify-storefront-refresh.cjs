// Read-only browser checks with mocked store data. No orders reach production.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
const base = process.env.THEME_TEST_URL || 'http://127.0.0.1:4180';
const art = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200"><rect width="1200" height="1200" fill="#e8ebe5"/><rect x="300" y="250" width="600" height="650" rx="40" fill="#537263"/><text x="600" y="590" text-anchor="middle" font-size="60" fill="white">PRODUTO</text></svg>');
let theme = 'sport';
const products = Array.from({length:8},(_,i)=>({id:i+1,tenant_id:1,name:i?'Produto de demonstração '+(i+1):'Produto com opções',sku:'SKU-'+(i+1),price:89.9,stock:10,stock_quantity:10,sale_unit:'unidade',type:'sale',is_active:true,is_featured:true,category_id:i%2+1,images:[art],image_url:art,description:'Descrição cadastrada pela loja, com informações para escolher o produto.',attributes:i?[]:[{name:'Tamanho',values:['P','G']}],skus:i?[]:[{combo:{Tamanho:'P'},stock:4},{combo:{Tamanho:'G'},stock:0}]}));
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 try {
 const page=await browser.newPage({serviceWorkers:'block'});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/**',route=>route.fulfill({json:route.request().url().includes('/api/public/store')?{tenant:{id:1,name:'Loja de Demonstração',slug:'demo',template_id:theme,logo_url:art,primary_color:'',whatsapp:'5511999999999',policies:{storefront:{checkout_mode:'online',catalog_title:'Catálogo personalizado',segment_label:'Coleção da loja'}}},categories:[{id:1,name:'Produtos & Acessórios'},{id:2,name:'Seleção especial'}],products}:{payment_methods:{pix:true},delivery:{pickup_available:true,delivery_available:false,delivery_fee:0}}}));
 for(theme of (process.env.THEME_IDS || 'sport,coffee,agro,auto_parts,pet,baby,fragrance').split(',')) {
  for(const width of [320,375,768,1440]) {
   await page.setViewportSize({width,height:950});
   for(const suffix of ['', '/catalogo','/produto/item-1','/sobre']) {
    await page.goto(base+'/s/demo'+suffix);
    await page.locator('h1').first().waitFor();
    await page.locator('#app-splash').waitFor({state:'hidden'});
    await page.evaluate(()=>document.fonts.ready);
    const size=await page.evaluate(()=>({width:document.documentElement.scrollWidth,viewport:innerWidth}));
    assert.ok(size.width<=width+2,`${theme} ${suffix} ${width}: overflow ${JSON.stringify(size)}`);
    const logo=page.locator('header img').first();
    if(await logo.count()){const rect=await logo.boundingBox();assert.ok(rect.width<=150&&rect.height<=90,`${theme}: oversized logo ${JSON.stringify(rect)}`);}
    if(!suffix){
     assert.equal(await page.locator('header').getByText('Produtos & Acessórios',{exact:true}).count(),0,`${theme}: categories leaked into header`);
     await page.screenshot({path:path.join(os.tmpdir(),`refresh-${theme}-${width}.png`),fullPage:true});
    }
   }
  }
  await page.goto(base+'/s/demo/produto/item-1');
  const buy=page.getByRole('button',{name:/^Adicionar (ao pedido|ao carrinho|à sacola|à comanda)$/});
  assert.ok(await buy.isDisabled(),theme+': required options');
  await page.getByRole('button',{name:'P',exact:true}).click();
  assert.ok(await buy.isEnabled(),theme+': in-stock option');
  await buy.click();
  if(!await page.locator('.fragrance-cart-drawer').isVisible()) await page.getByRole('button',{name:/^Abrir (carrinho|pedido|sacola|comanda)/i}).click();
  await page.locator('.fragrance-cart-drawer').waitFor();
  assert.match(await page.locator('.fragrance-cart-item').first().innerText(),/Tamanho: P/i);
  await page.screenshot({path:path.join(os.tmpdir(),`refresh-${theme}-cart.png`),fullPage:false});
  await page.getByRole('button',{name:'Continuar para checkout',exact:true}).click();
  await page.getByPlaceholder('Seu nome *').waitFor();
  await page.getByRole('button',{name:'Fechar carrinho',exact:true}).click();
  await page.evaluate(()=>localStorage.clear());
  console.log('PASS',theme,'4 pages × 4 widths; logo bounded; simple header; required options; cart and checkout form');
 }
 theme='sport';
 await page.goto(base+'/s/demo/catalogo');
 await page.getByRole('button',{name:'Visualização em lista',exact:true}).click();
 assert.equal(await page.locator('.sv3-product-row').count(),8);
 await page.locator('.sv3-catalog-search input').fill('produto inexistente');
 await page.getByRole('heading',{name:'Nenhum produto encontrado'}).waitFor();
 await page.goto(base+'/s/demo/produto/item-1');
 const add=page.getByRole('button',{name:'Adicionar ao carrinho',exact:true});
 assert.ok(await add.isDisabled());
 await page.getByRole('button',{name:'P',exact:true}).click();
 await add.click();
 await page.locator('.fragrance-cart-drawer').waitFor();
 assert.match(await page.locator('.fragrance-cart-item').innerText(),/Tamanho: P/i);
 await page.getByRole('button',{name:'Continuar para checkout',exact:true}).click();
 await page.getByPlaceholder('Seu nome *').waitFor();
 await page.getByRole('button',{name:'Fechar carrinho',exact:true}).click();
 await page.setViewportSize({width:375,height:850});
 await page.goto(base+'/s/demo?previewTheme=sport');
 await page.getByRole('button',{name:'Abrir menu',exact:true}).click();
 await page.getByRole('navigation',{name:'Navegação móvel'}).getByRole('link',{name:/Catálogo/}).click();
 assert.match(page.url(),/previewTheme=sport/);
 await page.getByRole('heading',{name:'Catálogo personalizado'}).waitFor();
 assert.equal(await page.locator('.sv3-drawer').count(),0);
 assert.deepEqual(errors,[]);
 console.log('PASS sport: list, search, required options, cart, checkout form, mobile menu, preview navigation; no browser errors');
 } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1});
