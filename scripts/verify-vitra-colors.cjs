const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),path=require('node:path'),os=require('node:os');
const base=process.env.THEME_TEST_URL||'http://127.0.0.1:4179';
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000},serviceWorkers:'block'}),errors=[],writes=[];
  page.on('pageerror',e=>errors.push(e.message));
  const product={id:1157,tenant_id:8,name:'BATE E FECHA',is_active:true,price:60,stock_quantity:50,track_stock:true,sale_unit:'unidade',attributes:[{name:'Cor',values:['Branco','Preto']}],skus:[]};
  await page.route('**/api/**',route=>{
   if(route.request().method()!=='GET'){writes.push(route.request().url());return route.abort();}
   if(new URL(route.request().url()).pathname.startsWith('/api/public/store'))return route.fulfill({json:{tenant:{id:8,name:'M&M VIDROS',slug:'cores',template_id:'vidracaria',policies:{storefront:{glass_quote_enabled:false}}},products:[product,{...product,id:1158,name:'VIDRO',attributes:[{name:'Espessura',values:['4 mm','6 mm']}]}],categories:[]}});
   return route.fulfill({json:[]});
  });
  const goto=async(id=1157)=>{await page.goto(`${base}/s/cores/produto/item-${id}`,{waitUntil:'domcontentloaded'});await page.locator('.vitra-config').waitFor();await page.locator('#app-splash').waitFor({state:'hidden'});};
  await goto();
  const group=page.getByRole('group',{name:'Cor',exact:true});await group.waitFor();
  assert.equal(await group.getByRole('radio').count(),2);assert.equal(await page.locator('.vitra-config select').count(),0);
  await page.getByRole('button',{name:'Adicionar ao carrinho',exact:true}).click();assert.equal(await page.locator('.fragrance-cart-drawer').count(),0);
  for(const [color,rgb] of [['Branco','rgb(255, 255, 255)'],['Preto','rgb(21, 21, 21)']]){
   const radio=group.getByRole('radio',{name:color,exact:true});await radio.check();assert.equal(await radio.isChecked(),true);
   assert.equal(await radio.locator('..').locator('.vitra-color-sample').evaluate(el=>getComputedStyle(el).backgroundColor),rgb);
   assert.match(await page.locator('.vitra-estimate').innerText(),/60,00/);
   await page.getByRole('button',{name:'Adicionar ao carrinho',exact:true}).click();await page.locator('.fragrance-cart-drawer').waitFor();
   assert.match(await page.locator('.fragrance-cart-drawer').innerText(),new RegExp(`Cor: ${color}`,'i'));
   await page.getByRole('button',{name:'Continuar comprando',exact:true}).click();
  }
  await page.getByRole('button',{name:'Carrinho, 2 itens',exact:true}).click();await page.locator('.fragrance-cart-drawer').waitFor();
  const cart=await page.locator('.fragrance-cart-drawer').innerText();assert.match(cart,/Cor: Branco/i);assert.match(cart,/Cor: Preto/i);assert.match(await page.locator('.fragrance-cart-total').innerText(),/120,00/);
  await page.getByRole('button',{name:'Continuar comprando',exact:true}).click();
  await group.getByRole('radio',{name:'Branco',exact:true}).check();await page.keyboard.press('ArrowRight');assert.equal(await group.getByRole('radio',{name:'Preto',exact:true}).isChecked(),true);
  for(const width of [1440,390]){await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));await page.screenshot({path:path.join(os.tmpdir(),`boxsys-vitra-colors-${width}.png`),fullPage:true});}
  await goto(1158);assert.equal(await page.getByLabel('Espessura',{exact:true}).count(),1);assert.equal(await page.getByRole('radio').count(),0);
  assert.deepEqual(writes,[]);assert.deepEqual(errors,[]);
  console.log('PASS cores: amostras branca/preta, seleção obrigatória, teclado, R$ 60 por cor, cores separadas no carrinho, sem pedidos, 390/1440px; demais variações preservadas');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
