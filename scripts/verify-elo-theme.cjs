const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/Eduardo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const output = path.resolve('output/elo');
fs.mkdirSync(output, { recursive: true });
const base = process.env.THEME_TEST_URL || 'http://127.0.0.1:4191';
const art = '/store-assets/elo-campaign-v1.webp';
const wine = '/store-assets/elo-editorial-v1.webp';
const names = ['Blusa Linho Branco', 'Vestido Brisa Rosé', 'Calça & bons encontros', 'Saia Midi Plissada', 'Camisa Algodão', 'Vestido Essência', 'Blusa Manga Longa', 'Bolsa Rosé'];
const fixture = {
  tenant: { id: 960, name: 'Élo Studio', slug: 'elo-demo', template_id: 'elo', primary_color: '#8a626d', whatsapp: '5511000000000', show_address: true, address: 'Rua da Ação, 100', business_hours: { friday: { open: '18:00', close: '02:00', closed: false }, saturday: { open: '16:00', close: '03:00', closed: false } }, policies: { storefront: { checkout_mode: 'whatsapp', show_whatsapp_widget: false }, shipping: 'Consulte a região de entrega e o valor com a equipe.' } },
  categories: [{id:1,name:'Blusas'},{id:2,name:'Vestidos'},{id:3,name:'Alfaiataria'},{id:4,name:'Acessórios'}],
  products: names.map((name,i)=>({id:i+1,name,sku:`ELO-${i+1}`,price:i===0?15:29.9+i*3,discount_price:i===0?12:null,is_active:true,is_featured:true,stock_quantity:i===0?3:12,track_stock:true,type:'sale',category_id:i%4+1,image_url:i%2?wine:art,images:[i%2?wine:art],description:'Tecido leve e detalhes delicados. Consulte as medidas com a equipe.'}))
};
fixture.products[1].attributes = [{name:'Tamanho',values:['P','M']}];
fixture.products[1].skus = [{combo:{Tamanho:'P'},stock:2},{combo:{Tamanho:'M'},stock:0}];
fixture.products[0].images = [art, wine];
fixture.products[2].discount_price = 0;
let empty = false, hidden = false, custom = false, mode = 'whatsapp';
const store = () => ({ ...fixture, tenant:{...fixture.tenant,policies:{...fixture.tenant.policies,storefront:{...fixture.tenant.policies.storefront,hide_prices:hidden,checkout_mode:mode,...(custom?{hero_slides:[{id:'custom',image:art,title:'Sua campanha, sua imagem',subtitle:'Descrição editada pela loja.',button_label:'Minha coleção',button_url:'/catalogo'}]}:{})}}}, products:empty?[]:fixture.products });
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 try {
  const page=await browser.newPage({serviceWorkers:'block'});
  await page.addInitScript(() => { window.open = (url) => { window.__eloOpened = String(url); return null; }; });
  page.setDefaultTimeout(18000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/**', route => route.request().url().includes('/api/public/store/') ? route.fulfill({json:store()}) : route.fulfill({json:{payment_methods:{pix:true,cash_on_delivery:true,card_on_delivery:true},delivery:{pickup_available:true,delivery_available:true,delivery_fee:7}}}));
  const go=async(suffix='')=>{await page.goto(`${base}/s/elo-demo${suffix}${suffix.includes('?')?'&':'?'}previewTheme=elo`);await page.locator('.els-page').waitFor();await page.locator('#app-splash').waitFor({state:'hidden'});await page.locator('.els-footer').waitFor();await page.evaluate(()=>document.fonts.ready);};
  const noOverflow=async(label)=>assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`Overflow: ${label}`);
  for(const width of process.env.THEME_SKIP_RESPONSIVE ? [] : [320,390,768,1440]){
   await page.setViewportSize({width,height:width<768?844:960});
   for(const suffix of ['', '/catalogo', '/produto/1', '/sobre']){
    await go(suffix);await noOverflow(`${width}${suffix}`);
    assert.equal(await page.locator('.els-page').evaluate(el=>/\uFFFD|Ã§|Ã£/.test(el.innerText)),false,'Português em UTF-8');
    if(!suffix){assert.ok(await page.locator('.els-scene-photo').first().evaluate(el=>el.complete&&el.naturalWidth>0));}
    if(width===390||width===1440){await page.screenshot({path:path.join(output,`${suffix.replace(/\W/g,'')||'inicio'}-${width}.png`),fullPage:true});}
   }
   console.log(`PASS ${width}px: início, catálogo, produto e sobre sem overflow.`);
  }
  await page.setViewportSize({width:390,height:844});await go();
  await page.getByRole('button',{name:'Abrir menu',exact:true}).click();
  await page.locator('.els-drawer').getByRole('link',{name:'Vestidos',exact:true}).click();
  await page.locator('.els-drawer').waitFor({state:'hidden'});
  assert.ok(page.url().includes('categoria=2'));
  assert.ok(page.url().includes('previewTheme=elo'));
  await page.locator('.els-header').getByRole('button',{name:'Buscar',exact:true}).click();
  await page.locator('.els-find').getByRole('searchbox',{name:'Buscar peças',exact:true}).fill('Saia');
  await page.locator('.els-find').getByRole('button',{name:'Buscar',exact:true}).click();
  await page.locator('.els-find').waitFor({state:'hidden'});
  await page.locator('.els-card-name').filter({hasText:'Saia Midi'}).waitFor();
  console.log('PASS menu e busca do celular com navegação preservada.');
  await page.setViewportSize({width:1440,height:960});
  await page.locator('.els-brand').click();
  await page.locator('.els-collection').first().waitFor();
  assert.ok(await page.locator('.els-hero').evaluate(el => Math.abs(el.getBoundingClientRect().width - innerWidth) < 1), 'Hero ocupa a largura da tela.');
  await page.screenshot({path:path.join(output,'inicio-1440.png'),fullPage:true});
  await page.getByRole('button',{name:'Pausar banners',exact:true}).click();
  await page.getByRole('button',{name:'Próximo banner',exact:true}).click();
  await page.locator('.els-scene.is-active h1').filter({hasText:'Delicada no toque.'}).waitFor();
  await page.getByRole('button',{name:'Banner anterior',exact:true}).click();
  await page.locator('.els-scene.is-active h1').filter({hasText:'Vista a leveza.'}).waitFor();
  await page.getByRole('button',{name:'Próximas peças',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('.els-product-rail').scrollLeft>10);
  await go('/catalogo');
  await page.getByRole('button',{name:'Favoritar Blusa Linho Branco',exact:true}).click();
  await page.reload();await page.locator('.els-grid-cat').waitFor();
  assert.equal(await page.getByRole('button',{name:'Remover Blusa Linho Branco dos favoritos',exact:true}).getAttribute('aria-pressed'),'true');
  console.log('PASS carrosséis de banner e produtos.');
  await go('/catalogo');
  await page.getByRole('searchbox',{name:'Buscar produtos',exact:true}).fill('Bolsa');
  await page.waitForFunction(()=>document.querySelectorAll('.els-grid-cat .els-card').length===1);
  await page.getByRole('searchbox',{name:'Buscar produtos',exact:true}).fill('');
  await page.getByRole('button',{name:'Vestidos',exact:true}).click();
  await page.waitForFunction(()=>document.querySelectorAll('.els-grid-cat .els-card').length===2);
  await page.getByRole('button',{name:'Tudo',exact:true}).click();
  await page.waitForFunction(()=>document.querySelectorAll('.els-grid-cat .els-card').length===8);
  await page.getByRole('combobox').selectOption('maior');
  await page.waitForFunction(()=>document.querySelector('.els-card-name')?.textContent.includes('Rosé'));
  await go('/produto/1');
  await page.getByRole('button',{name:'Ver foto 2',exact:true}).click();
  assert.equal(await page.locator('.els-gallery-main > img').getAttribute('src'),wine);
  await page.getByRole('button',{name:'Adicionar à sacola',exact:true}).first().click();
  const cart=page.getByRole('dialog',{name:'Sua sacola',exact:true});await cart.waitFor();
  await page.waitForFunction(()=>Math.abs(document.querySelector('.els-cart-dialog').getBoundingClientRect().right-innerWidth)<1);
  assert.match(await cart.locator('.els-cart-summary strong').innerText(),/12,00/);
  await cart.getByRole('button',{name:'Aumentar Blusa Linho Branco',exact:true}).click();
  await cart.getByRole('button',{name:'Aumentar Blusa Linho Branco',exact:true}).click();
  assert.match(await cart.locator('.els-cart-summary strong').innerText(),/36,00/);
  assert.ok(await cart.getByRole('button',{name:'Aumentar Blusa Linho Branco',exact:true}).isDisabled());
  assert.equal(await page.evaluate(()=>document.body.style.overflow),'hidden');
  await cart.getByRole('button',{name:'Pedir pelo WhatsApp',exact:true}).click();
  const opened = await page.evaluate(()=>window.__eloOpened);
  assert.equal(new URL(opened).hostname, 'wa.me');
  assert.match(new URL(opened).searchParams.get('text'), /3x Blusa Linho Branco/);
  assert.match(new URL(opened).searchParams.get('text'), /36,00/);
  await page.screenshot({path:path.join(output,'carrinho-1440.png')});
  await page.setViewportSize({width:390,height:844});await noOverflow('carrinho 390');
  await page.screenshot({path:path.join(output,'carrinho-390.png')});
  await page.keyboard.press('Escape');await cart.waitFor({state:'hidden'});
  assert.notEqual(await page.evaluate(()=>document.body.style.overflow),'hidden');
  await page.reload();await page.locator('.els-bottom-nav').waitFor();
  await page.locator('.els-bottom-nav').getByRole('button',{name:'Abrir sacola, 3 itens',exact:true}).click();
  await cart.getByRole('button',{name:'Diminuir Blusa Linho Branco',exact:true}).click();
  assert.match(await cart.locator('.els-cart-summary strong').innerText(),/24,00/);
  await cart.getByRole('button',{name:'Remover Blusa Linho Branco',exact:true}).click();
  await cart.getByRole('heading',{name:'Uma sacola vazia. Tantas possibilidades.'}).waitFor();
  await page.screenshot({path:path.join(output,'carrinho-vazio-390.png')});
  await cart.getByRole('link',{name:'Explorar a coleção',exact:true}).click();
  assert.ok(page.url().includes('previewTheme=elo'));
  await go('/produto/2');
  assert.ok(await page.getByRole('button',{name:'Adicionar à sacola',exact:true}).first().isDisabled());
  await page.getByRole('button',{name:'Escolher opções',exact:true}).click();
  assert.equal(await page.getByRole('button',{name:'P',exact:true}).evaluate(el=>el===document.activeElement),true);
  await page.getByRole('button',{name:'M',exact:true}).click();
  assert.ok(await page.getByRole('button',{name:'Indisponível',exact:true}).first().isDisabled());
  await page.getByRole('button',{name:'P',exact:true}).click();
  await page.getByRole('button',{name:'Adicionar à sacola',exact:true}).first().click();
  await cart.getByText('Tamanho: P',{exact:true}).waitFor();
  await cart.getByRole('button',{name:'Remover Vestido Brisa Rosé',exact:true}).click();
  await page.keyboard.press('Escape');
  await go('/produto/3');
  await page.getByRole('button',{name:'Adicionar à sacola',exact:true}).first().click();
  assert.match(await cart.locator('.els-cart-summary strong').innerText(),/35,90/);
  await cart.getByRole('button',{name:'Pedir pelo WhatsApp',exact:true}).click();
  const specialMessage = new URL(await page.evaluate(()=>window.__eloOpened));
  assert.ok(specialMessage.searchParams.get('text').includes('Calça & bons encontros'));
  assert.equal(specialMessage.searchParams.size,1);
  await cart.getByRole('button',{name:'Remover Calça & bons encontros',exact:true}).click();
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
  assert.equal(await page.locator('.els-scene').count(),1);
  assert.equal(await page.locator('.els-scene h1').innerText(),'Sua campanha, sua imagem');
  assert.equal(await page.locator('.els-scene-photo').getAttribute('src'),art);
  console.log('PASS imagem e textos personalizados substituem a campanha padrão.');
  hidden=true;await go('/catalogo');
  assert.equal(await page.locator('.els-price strong').first().innerText(),'Sob consulta');
  assert.equal(await page.getByRole('option',{name:'Menor preço'}).count(),0);
  empty=true;await go();await noOverflow('loja vazia');
  await go('/catalogo');await page.getByRole('heading',{name:'Em breve por aqui',exact:true}).waitFor();
  empty=false;hidden=false;custom=false;await page.goto(`${base}/s/elo-demo`);
  await page.locator('.els-home').waitFor();
  assert.equal(new URL(page.url()).search,'');
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


