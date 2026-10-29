const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/Eduardo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = process.env.MENU_TEST_URL || 'http://127.0.0.1:4190';
const output = path.resolve('output/cardapios');
fs.mkdirSync(output,{recursive:true});
const categories=[{id:1,name:'Cervejas'},{id:2,name:'Destilados'},{id:3,name:'Vinhos e Espumantes'},{id:4,name:'Refrigerantes e Sucos'},{id:5,name:'Gelo e Conveniência'}];
const products=[
 {id:1,name:'Heineken Long Neck 330 ml',price:9.90,category_id:1,description:'Leve, refrescante e no ponto para acompanhar o seu pedido.',is_featured:true},
 {id:2,name:'Budweiser Lata 350 ml',price:4.99,category_id:1},
 {id:3,name:'Cerveja Original 600 ml',price:13.90,category_id:1},
 {id:4,name:'Corona Extra 330 ml',price:10.90,category_id:1},
 {id:5,name:'Vodka Smirnoff 998 ml',price:39.90,category_id:2,description:'A escolha para preparar o seu drink favorito.'},
 {id:6,name:'Gin Seagers 980 ml',price:39.90,category_id:2},
 {id:7,name:'Whisky Jack Daniel’s 1 L',price:179.90,category_id:2},
 {id:8,name:'Vinho Rosé',price:49.90,category_id:3,image_url:'/store-assets/adega-brisa-hero-v1.webp',description:'Para acompanhar bons encontros.'},
 {id:9,name:'Vinho Tinto Reserva 750 ml',price:59.90,category_id:3},
 {id:10,name:'Coca-Cola 2 L',price:12.90,category_id:4},
 {id:11,name:'Água com gás 500 ml',price:3.90,category_id:4},
 {id:12,name:'Gelo em cubos 5 kg',price:15,category_id:5},
 {id:13,name:'Porção de amendoim',price:6.90,category_id:5},
 {id:14,name:'Produto esgotado',price:9,category_id:5,stock_quantity:0},
].map(p=>({stock_quantity:100,track_stock:true,is_active:true,...p}));
const fixture={tenant:{id:630,name:'Empório Barreto',template_id:'adega',primary_color:'#d9a62e',food_enabled:true,whatsapp:'5511000000000',address_street:'Rua da Ação',address_number:'100',address_district:'Centro',address_city:'São Paulo',business_hours:Object.fromEntries(['seg','ter','qua','qui','sex','sab','dom'].map(day=>[day,{open:'00:00',close:'23:59',closed:false}])),policies:{menu:{accepts:{mesa:true,balcao:true,delivery:true,pickup:true},pickup_eta:'15–20 min',delivery:{fixed_fee:6,min_order:20,free_above:100,eta:'40–60 min'},payments:{pix:true,money:true,card:true}}}},categories,products};
const routes={delivery:'',balcao:'/balcao',mesa:'/mesa/7'};
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 const errors=[], requests=[];
 const page=await browser.newPage({serviceWorkers:'block',timezoneId:'America/Sao_Paulo',reducedMotion:'reduce'});
 page.setDefaultTimeout(15000);
 page.setDefaultNavigationTimeout(45000);
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/**', async route=>{
  if(route.request().url().includes('/api/public/menu-order')){
   const body=route.request().postDataJSON();requests.push(body);
   const subtotal=body.items.reduce((sum,item)=>sum+Number(products.find(p=>p.id===item.product_id).price)*item.quantity,0);
   return route.fulfill({json:{number:104,order_id:911,total:subtotal+(body.mode==='delivery'?6:0),fee:body.mode==='delivery'?6:0,eta:'40–60 min'}});
  }
  return route.fulfill({json:route.request().url().includes('/api/public/store')?fixture:{}});
 });
 const go=async(mode)=>{
  await page.goto(`${base}/s/menu-demo/cardapio${routes[mode]}`,{waitUntil:'domcontentloaded'});
  await page.locator('.mnu-app, .mnu-gate').waitFor();
  await page.locator('#app-splash').waitFor({state:'hidden'});
  if(await page.locator('.mnu-gate').count()){
   await page.getByLabel('Seu nome',{exact:true}).fill('Cliente Ação');
   if(mode==='mesa') await page.getByRole('button',{name:'Mais',exact:true}).click();
   await page.getByRole('button',{name:mode==='mesa'?'Ver cardápio da mesa':'Começar meu pedido',exact:true}).click();
  }
  await page.locator('.mnu-app').waitFor();await page.evaluate(()=>document.fonts.ready);
 };
 const widthOK=async(label)=>assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`Largura: ${label}`);
 try{
  for(const width of process.env.MENU_SKIP_RESPONSIVE?[]:[320,390,768,1440]){
   await page.setViewportSize({width,height:width<768?844:960});
   for(const mode of Object.keys(routes)){
    await go(mode);await widthOK(`${mode} ${width}`);
    assert.equal(await page.locator('.mnu-grid .mnu-ph').first().evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(242, 244, 247)');
    assert.ok(await page.locator('.mnu-app').evaluate(el=>getComputedStyle(el).fontFamily.includes('Manrope')));
    assert.equal(await page.locator('.mnu-app').evaluate(el=>/\uFFFD|Ã§|Ã£/.test(el.textContent)),false);
    if(width===1440){assert.equal(await page.locator('.mnu-side').isVisible(),mode==='balcao');assert.equal(await page.locator('.mnu-cart').count(),mode==='mesa'?0:1);}
    if(width===390||width===1440)await page.screenshot({path:path.join(output,`${mode}-${width}.png`),fullPage:true});
   }
   console.log(`PASS ${width}px: três composições, base neutra, fontes e largura.`);
  }
  for(const width of [390,1440]){
   await page.setViewportSize({width,height:width<768?844:960});
   for(const mode of Object.keys(routes)){
    await go(mode);
    await page.screenshot({path:path.join(output,`${mode}-${width}.png`),fullPage:true});
    const search=page.getByRole('searchbox',{name:'Buscar no cardápio',exact:true}).filter({visible:true});
    await search.fill('Vodka');await page.waitForFunction(()=>document.querySelectorAll('.mnu-grid .mnu-item').length===1);
    await search.fill('');await page.waitForFunction(()=>document.querySelectorAll('.mnu-grid .mnu-item').length===14);
    const categorySelector=mode==='balcao'&&width>=900?'.mnu-side-nav .mnu-nav':'.mnu-tabs .mnu-tab';
    await page.locator(categorySelector).filter({hasText:'Vinhos e Espumantes'}).click();
    await page.waitForFunction(selector=>Array.from(document.querySelectorAll(selector)).some(el=>el.textContent.includes('Vinhos e Espumantes')&&el.classList.contains('is-on')),categorySelector);
    await page.locator('.mnu-grid').getByRole('button',{name:'Ver Heineken Long Neck 330 ml',exact:true}).click();
    const product=page.getByRole('dialog',{name:'Heineken Long Neck 330 ml',exact:true});
    await product.waitFor();assert.equal(await page.evaluate(()=>document.body.style.overflow),'hidden');
    assert.equal(await product.locator('.mnu-cta').evaluate(el=>getComputedStyle(el).color),'rgb(255, 255, 255)');
    assert.ok(await product.locator('.mnu-sheet-img').evaluate(el=>el.getBoundingClientRect().height<90));
    await product.getByRole('button',{name:'Mais',exact:true}).click();await product.getByRole('button',{name:'Mais',exact:true}).click();
    await product.getByRole('textbox',{name:'Alguma observação?',exact:true}).fill('Bem gelada, sem limão & gelo.');
    await page.screenshot({path:path.join(output,`${mode}-produto-${width}.png`)});
    await product.getByRole('button',{name:/Adicionar/}).click();await product.waitFor({state:'hidden'});
    const inline=width>=1200&&mode!=='mesa';
    if(!inline) await page.locator('.mnu-bagbtn').click();
    const bag=inline?page.locator('.mnu-cart'):page.getByRole('dialog',{name:'Sacola',exact:true});
    await bag.waitFor();
    assert.ok((await bag.locator('.mnu-sum').innerText()).includes('29,70'));
    if(mode==='delivery'){
     assert.equal(await bag.getByLabel('Seu nome',{exact:true}).isVisible(),false);
     await bag.getByRole('button',{name:'Continuar pedido',exact:true}).click();
     await bag.getByLabel('Seu nome',{exact:true}).fill('Cliente Ação');
     await bag.getByLabel('WhatsApp',{exact:true}).fill('11900000000');
     await bag.getByLabel('Rua',{exact:true}).fill('Rua da Ação');
     await bag.getByLabel('Número',{exact:true}).fill('123');
     await bag.getByLabel('Bairro',{exact:true}).fill('Centro');
     await bag.getByRole('button',{name:'Retirar na loja',exact:true}).click();
     assert.equal(await bag.getByLabel('Rua',{exact:true}).isVisible(),false);
     await bag.getByRole('button',{name:'Entrega',exact:true}).click();
     await bag.getByRole('button',{name:'Cartão',exact:true}).click();
    }
    await page.screenshot({path:path.join(output,`${mode}-pedido-${width}.png`)});
    const submit=bag.locator('.mnu-bag-foot .mnu-cta');
    assert.ok(await submit.evaluate(el=>{const r=el.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight+1;}),'Confirmação deve ficar acessível.');
    await submit.click();await bag.getByRole('heading',{name:mode==='delivery'?'Pedido recebido!':'Pedido enviado!',exact:true}).waitFor();
    const body=requests.at(-1);assert.equal(body.mode,mode);assert.equal(body.items[0].quantity,3);assert.equal(body.items[0].note,'Bem gelada, sem limão & gelo.');
    if(mode==='mesa'){assert.equal(body.mesa,'7');assert.equal(body.people,2);assert.equal(body.address,undefined);assert.equal(body.payment,undefined);}
    if(mode==='balcao'){assert.equal(body.address,undefined);assert.equal(body.payment,undefined);}
    if(mode==='delivery'){assert.equal(body.address.street,'Rua da Ação');assert.equal(body.payment.method,'card');}
    if(!inline)await bag.getByRole('button',{name:'Voltar ao cardápio',exact:true}).click();
    console.log(`PASS ${mode} ${width}px: busca, produto, observação, sacola e pedido simulado.`);
   }
  }
  await go('delivery');await page.getByRole('button',{name:'Sobre a loja',exact:true}).filter({visible:true}).click();await page.getByRole('dialog',{name:'Info da loja'}).waitFor();await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog').count(),0);
  assert.deepEqual(errors,[]);assert.equal(requests.length,6);
  console.log('PASS modalidades preservadas, modais por teclado e ausência de erros JavaScript. Nenhum pedido real enviado.');
 }catch(error){await page.screenshot({path:path.join(output,'falha.png'),fullPage:true}).catch(()=>{});console.error(page.url(),await page.locator('body').innerText());throw error;}
 finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
