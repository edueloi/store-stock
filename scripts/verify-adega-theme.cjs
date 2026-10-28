const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/Eduardo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const output = path.resolve('output/adega');
fs.mkdirSync(output, { recursive: true });
const base = process.env.THEME_TEST_URL || 'http://127.0.0.1:4188';
const art = '/store-assets/adega-night-hero-v1.webp';
const wine = '/store-assets/adega-wine-hero-v1.webp';
const names = ['Cerveja Premium 350 ml', 'Vinho Tinto Reserva', 'Whisky & bons momentos', 'Gelo em cubos 5 kg', 'Água com gás', 'Energético Original', 'Cerveja Pilsen 600 ml', 'Vinho Rosé'];
const fixture = {
  tenant: { id: 912, name: 'Adega Noturna', slug: 'adega-demo', template_id: 'adega', primary_color: '#d8b36c', whatsapp: '5511000000000', show_address: true, address: 'Rua da Ação, 100', business_hours: { friday: { open: '18:00', close: '02:00', closed: false }, saturday: { open: '16:00', close: '03:00', closed: false } }, policies: { storefront: { checkout_mode: 'whatsapp', show_whatsapp_widget: false }, shipping: 'Consulte a região de entrega e o valor com a equipe.' } },
  categories: [{id:1,name:'Cervejas'},{id:2,name:'Vinhos'},{id:3,name:'Destilados'},{id:4,name:'Conveniência'}],
  products: names.map((name,i)=>({id:i+1,name,sku:`ADG-${i+1}`,price:i===0?15:29.9+i*3,discount_price:i===0?12:null,is_active:true,is_featured:true,stock_quantity:i===0?3:12,track_stock:true,type:'sale',category_id:i%4+1,image_url:i%2?wine:art,images:[i%2?wine:art],description:'Seleção da casa. Ótima companhia para o seu próximo brinde.'}))
};
fixture.products[1].attributes = [{name:'Volume',values:['750 ml','1,5 L']}];
fixture.products[1].skus = [{combo:{Volume:'750 ml'},stock:2},{combo:{Volume:'1,5 L'},stock:0}];
let empty = false, hidden = false, custom = false, mode = 'whatsapp';
const store = () => ({ ...fixture, tenant:{...fixture.tenant,policies:{...fixture.tenant.policies,storefront:{...fixture.tenant.policies.storefront,hide_prices:hidden,checkout_mode:mode,...(custom?{hero_slides:[{id:'custom',image:art,title:'Sua campanha, sua imagem',subtitle:'Descrição editada pela loja.',button_label:'Meu cardápio',button_url:'/catalogo'}]}:{})}}}, products:empty?[]:fixture.products });
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 try {
  const page=await browser.newPage({serviceWorkers:'block'});
  await page.addInitScript(() => { window.open = (url) => { window.__adegaOpened = String(url); return null; }; });
  page.setDefaultTimeout(18000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/**', route => route.request().url().includes('/api/public/store/') ? route.fulfill({json:store()}) : route.fulfill({json:{payment_methods:{pix:true,cash_on_delivery:true,card_on_delivery:true},delivery:{pickup_available:true,delivery_available:true,delivery_fee:7}}}));
  const go=async(suffix='')=>{await page.goto(`${base}/s/adega-demo${suffix}${suffix.includes('?')?'&':'?'}previewTheme=adega`);await page.locator('.adg-page').waitFor();await page.locator('#app-splash').waitFor({state:'hidden'});await page.locator('.adg-footer').waitFor();await page.evaluate(()=>document.fonts.ready);};
  const noOverflow=async(label)=>assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`Overflow: ${label}`);
  for(const width of process.env.THEME_SKIP_RESPONSIVE ? [] : [320,390,768,1440]){
   await page.setViewportSize({width,height:width<768?844:960});
   for(const suffix of ['', '/catalogo', '/produto/1', '/sobre']){
    await go(suffix);await noOverflow(`${width}${suffix}`);
    assert.equal(await page.locator('.adg-page').evaluate(el=>/\uFFFD|Ã§|Ã£/.test(el.innerText)),false,'Português em UTF-8');
    if(!suffix){assert.ok(await page.locator('.adg-scene-photo').first().evaluate(el=>el.complete&&el.naturalWidth>0));}
    if(width===390||width===1440){await page.screenshot({path:path.join(output,`${suffix.replace(/\W/g,'')||'inicio'}-${width}.png`),fullPage:true});}
   }
   console.log(`PASS ${width}px: início, catálogo, produto e sobre sem overflow.`);
  }
  await page.setViewportSize({width:390,height:844});await go();
  await page.getByRole('button',{name:'Abrir menu',exact:true}).click();
  await page.locator('.adg-drawer').getByRole('link',{name:'Vinhos',exact:true}).click();
  await page.locator('.adg-drawer').waitFor({state:'hidden'});
  assert.ok(page.url().includes('categoria=2'));
  assert.ok(page.url().includes('previewTheme=adega'));
  await page.locator('.adg-header').getByRole('button',{name:'Buscar',exact:true}).click();
  await page.locator('.adg-find').getByRole('searchbox',{name:'Buscar produtos',exact:true}).fill('Gelo');
  await page.locator('.adg-find').getByRole('button',{name:'Buscar',exact:true}).click();
  await page.locator('.adg-find').waitFor({state:'hidden'});
  await page.locator('.adg-card-name').filter({hasText:'Gelo em cubos'}).waitFor();
  console.log('PASS menu e busca do celular com navegação preservada.');
  await page.setViewportSize({width:1440,height:960});
  await page.locator('.adg-brand').click();
  await page.locator('.adg-category-card').first().waitFor();
  assert.ok(await page.locator('.adg-category-card').first().evaluate(el => el.querySelector('img').getBoundingClientRect().bottom <= el.querySelector('.adg-category-label').getBoundingClientRect().top), 'A foto não deve cobrir o nome da categoria.');
  await page.screenshot({path:path.join(output,'inicio-1440.png'),fullPage:true});
  await page.getByRole('button',{name:'Pausar banners',exact:true}).click();
  await page.getByRole('button',{name:'Próximo banner',exact:true}).click();
  await page.locator('.adg-scene.is-active h1').filter({hasText:'Boas conversas.'}).waitFor();
  await page.getByRole('button',{name:'Banner anterior',exact:true}).click();
  await page.locator('.adg-scene.is-active h1').filter({hasText:'A noite é sua.'}).waitFor();
  await page.getByRole('button',{name:'Próximos produtos',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('.adg-product-rail').scrollLeft>10);
  console.log('PASS carrosséis de banner e produtos.');
  await go('/catalogo');
  await page.getByRole('searchbox',{name:'Buscar produtos',exact:true}).fill('Rosé');
  await page.waitForFunction(()=>document.querySelectorAll('.adg-grid-cat .adg-card').length===1);
  await page.getByRole('searchbox',{name:'Buscar produtos',exact:true}).fill('');
  await page.getByRole('button',{name:'Vinhos',exact:true}).click();
  await page.waitForFunction(()=>document.querySelectorAll('.adg-grid-cat .adg-card').length===2);
  await page.getByRole('button',{name:'Tudo',exact:true}).click();
  await page.waitForFunction(()=>document.querySelectorAll('.adg-grid-cat .adg-card').length===8);
  await page.getByRole('combobox').selectOption('maior');
  await page.waitForFunction(()=>document.querySelector('.adg-card-name')?.textContent.includes('Rosé'));
  await go('/produto/1');
  await page.getByRole('button',{name:'Adicionar à sacola',exact:true}).first().click();
  const cart=page.getByRole('dialog',{name:'Sua sacola de bons momentos',exact:true});await cart.waitFor();
  await page.waitForFunction(()=>Math.abs(document.querySelector('.adg-cart-dialog').getBoundingClientRect().right-innerWidth)<1);
  assert.match(await cart.locator('.adg-cart-summary strong').innerText(),/12,00/);
  await cart.getByRole('button',{name:'Aumentar Cerveja Premium 350 ml',exact:true}).click();
  await cart.getByRole('button',{name:'Aumentar Cerveja Premium 350 ml',exact:true}).click();
  assert.match(await cart.locator('.adg-cart-summary strong').innerText(),/36,00/);
  assert.ok(await cart.getByRole('button',{name:'Aumentar Cerveja Premium 350 ml',exact:true}).isDisabled());
  assert.equal(await page.evaluate(()=>document.body.style.overflow),'hidden');
  await cart.getByRole('button',{name:'Pedir pelo WhatsApp',exact:true}).click();
  const opened = await page.evaluate(()=>window.__adegaOpened);
  assert.equal(new URL(opened).hostname, 'wa.me');
  assert.match(new URL(opened).searchParams.get('text'), /3x Cerveja Premium 350 ml/);
  assert.match(new URL(opened).searchParams.get('text'), /36,00/);
  await page.screenshot({path:path.join(output,'carrinho-1440.png')});
  await page.setViewportSize({width:390,height:844});await noOverflow('carrinho 390');
  await page.screenshot({path:path.join(output,'carrinho-390.png')});
  await page.keyboard.press('Escape');await cart.waitFor({state:'hidden'});
  assert.notEqual(await page.evaluate(()=>document.body.style.overflow),'hidden');
  await page.reload();await page.locator('.adg-bottom-nav').waitFor();
  await page.locator('.adg-bottom-nav').getByRole('button',{name:'Abrir sacola, 3 itens',exact:true}).click();
  await cart.getByRole('button',{name:'Diminuir Cerveja Premium 350 ml',exact:true}).click();
  assert.match(await cart.locator('.adg-cart-summary strong').innerText(),/24,00/);
  await cart.getByRole('button',{name:'Remover Cerveja Premium 350 ml',exact:true}).click();
  await cart.getByRole('heading',{name:'Falta só escolher o primeiro brinde.'}).waitFor();
  await page.screenshot({path:path.join(output,'carrinho-vazio-390.png')});
  await cart.getByRole('link',{name:'Descobrir o cardápio',exact:true}).click();
  assert.ok(page.url().includes('previewTheme=adega'));
  await go('/produto/2');
  assert.ok(await page.getByRole('button',{name:'Adicionar à sacola',exact:true}).first().isDisabled());
  await page.getByRole('button',{name:'750 ml',exact:true}).click();
  await page.getByRole('button',{name:'Adicionar à sacola',exact:true}).first().click();
  await cart.getByText('Volume: 750 ml',{exact:true}).waitFor();
  await cart.getByRole('button',{name:'Remover Vinho Tinto Reserva',exact:true}).click();
  await page.keyboard.press('Escape');
  console.log('PASS busca, categorias, ordenação, carrinho exclusivo, desconto, estoque, remoção e navegação.');
  mode='online';await go('/produto/1');
  await page.getByRole('button',{name:'Adicionar à sacola',exact:true}).first().click();
  await cart.getByRole('button',{name:'Continuar meu pedido',exact:true}).click();
  await cart.getByPlaceholder('Seu nome *').waitFor();
  await cart.getByPlaceholder('Seu nome *').fill('Cliente de teste');
  await cart.getByRole('button',{name:'Entrega R$ 7.00',exact:true}).waitFor();
  await page.screenshot({path:path.join(output,'checkout-390.png')});
  console.log('PASS checkout online integrado; nenhum pedido enviado.');
  await page.keyboard.press('Escape');
  custom=true;await go();
  assert.equal(await page.locator('.adg-scene').count(),1);
  assert.equal(await page.locator('.adg-scene h1').innerText(),'Sua campanha, sua imagem');
  assert.equal(await page.locator('.adg-scene-photo').getAttribute('src'),art);
  console.log('PASS imagem e textos personalizados substituem a campanha padrão.');
  hidden=true;await go('/catalogo');
  assert.equal(await page.locator('.adg-price strong').first().innerText(),'Sob consulta');
  assert.equal(await page.getByRole('option',{name:'Menor preço'}).count(),0);
  empty=true;await go();await noOverflow('loja vazia');
  await go('/catalogo');await page.getByRole('heading',{name:'Em breve por aqui',exact:true}).waitFor();
  assert.deepEqual(errors,[]);
  console.log('PASS preços ocultos, loja vazia e ausência de erros JavaScript.');
 } catch (error) {
  for (const page of browser.contexts().flatMap(context => context.pages())) {
   await page.screenshot({path:path.join(output,'falha.png'),fullPage:true}).catch(()=>{});
   console.error('Página:',page.url(),await page.locator('body').innerText().catch(()=>''));
  }
  throw error;
 } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
