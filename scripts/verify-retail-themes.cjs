// Node 20+, Vite na porta 4179 e PLAYWRIGHT_MODULE apontando para Playwright.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),path=require('node:path'),os=require('node:os');
const base=process.env.THEME_TEST_URL||'http://127.0.0.1:4179';
const image='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500"><rect x="90" y="75" width="220" height="350" rx="8" fill="#b9b5a3"/><rect x="120" y="150" width="160" height="130" fill="#ede9dd"/><path d="m165 240 35-55 35 55z" fill="#657264"/></svg>');
const products=Array.from({length:8},(_,i)=>({
id:i+1,tenant_id:1,name:i===0?'Seleção especial':'Produto '+(i+1),sku:'ES-'+(i+1),price:129.9+i,discount_price:i===0?99.9:i===1?0:null,
stock_quantity:10,type:'sale',is_active:true,is_featured:i===0,category_id:i%2+1,image_url:image,images:i===1?[image]:[image,image+' '],
description:'Descrição cadastrada com ação, composição e proteção.',attributes:i===0?[{name:'Tamanho',values:['P','G']}]:[],
skus:i===0?[{combo:{Tamanho:'P'},stock:4},{combo:{Tamanho:'G'},stock:0}]:[]
}));
const themes={
electric:{p:'ep',card:'.ep-row',name:'.ep-row-name',buy:'.ep-buy',main:'.ep-buy-btn',bar:'.ep-sticky',thumb:'Ver foto 2',quick:'Adicionar',cta:'Explorar materiais',menu:'Produtos'},
toys:{p:'toys',card:'.toys-card',name:'.toys-card-name',buy:'.toys-buy',main:'.toys-add',bar:'.toys-buy-row',thumb:'Ver foto 2',quick:'Adicionar',cta:'Descobrir os brinquedos',menu:'Produtos'},
variety:{p:'variety',card:'.variety-card',name:'.variety-card-name',buy:'.variety-buy',main:'.variety-buy-btn',bar:'.variety-buyrow',thumb:'Foto 2',quick:'Adicionar',cta:'Encontrar boas descobertas',menu:'Produtos'},
aura:{p:'au',card:'.au-card',name:'.au-card-name',buy:'.au-buy',main:'.au-buybtn',bar:'.au-buybar',thumb:'Ver imagem 2',quick:'Adicionar Produto 2 à sacola',cta:'Explorar a coleção',menu:'A coleção'}
};
(async()=>{
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
try{
for(const id of (process.env.THEME_IDS||'electric,toys,variety,aura').split(',')){
const t=themes[id],p=t.p,page=await browser.newPage({serviceWorkers:'block'}),errors=[];
page.on('pageerror',e=>{errors.push(e.message);console.error(id+': '+e.message);});
await page.route('**/fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:''}));
await page.route('**/fonts.gstatic.com/**',r=>r.abort());
let hidden=false,empty=false,custom=false,slides=false,order=false;
await page.route('**/api/**',r=>r.request().url().includes('/api/public/store')?r.fulfill({json:{
tenant:{id:1,name:{electric:'ELÉTRICA PRO',toys:'MUNDO DE BRINCAR',variety:'VITRINE MIX',aura:'AURA FEMININA'}[id],slug:'demo',template_id:'minimal',primary_color:'#2563eb',
banner_url:custom?image:'',hero_tagline:custom?'Campanha da loja':'',whatsapp:'5511999999999',show_address:true,address:'Rua da Ação, 100',
business_hours:{monday:{open:'09:00',close:'18:00',closed:false}},
policies:{shipping:'Entrega conforme as opções da loja.',returns:'Consulte as condições de devolução.',exchange:'Trocas mediante contato.',storefront:{hide_prices:hidden,checkout_mode:order?'order_request':'online',hero_slides:slides?[{id:'one',image,title:'Campanha personalizada',button_label:'Ver campanha',button_url:'/catalogo?categoria=2'}]:[]}}},
categories:[{id:1,name:'Essenciais'},{id:2,name:'Presentes'}],products:empty?[]:products
}}):r.fulfill({json:{payment_methods:{pix:true},delivery:{pickup_available:true,delivery_available:false,delivery_fee:0}}}));
const go=async(suffix='')=>{
await page.goto(base+'/s/demo'+suffix+(suffix.includes('?')?'&':'?')+'previewTheme='+id,{waitUntil:'domcontentloaded'});
await page.locator('.'+p+'-page').waitFor();await page.locator('#app-splash').waitFor({state:'hidden'});
};
if(!process.env.THEME_SKIP_RESPONSIVE)for(const width of [375,768,1440]){
await page.setViewportSize({width,height:960});
for(const [suffix,name]of [['','inicio'],['/catalogo','catalogo'],['/produto/selecao-1','produto'],['/sobre','sobre']]){
await go(suffix);await page.locator('.'+p+'-page h1').waitFor({timeout:10000}).catch(async e=>{await page.screenshot({path:path.join(os.tmpdir(),'boxsys-'+id+'-failure.png'),fullPage:true});throw new Error(id+'/'+width+'/'+name+': '+e.message);});
assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),id+'/'+width+'/'+name+': overflow');
assert.equal(await page.locator('.'+p+'-page h1').evaluate(el=>getComputedStyle(el).opacity),'1');
assert.equal(await page.locator('.'+p+'-marquee,.'+p+'-orb,.'+p+'-shapes').count(),0);
if(name==='inicio'){await page.locator('.'+p+'-hero-image').evaluate(el=>el.decode());assert.equal(await page.locator('.'+p+'-hero-image').getAttribute('src'),'/store-assets/'+id+'-editorial-hero-v1.jpg');assert.ok(await page.locator('.'+p+'-hero-image').evaluate(el=>el.getBoundingClientRect().height>150),'Hero precisa ter uma fotografia visível');}
if(name==='inicio'){
const tone=await page.locator(t.card).filter({hasText:'Produto 2'}).getByRole('button',{name:t.quick,exact:true}).evaluate(el=>({ink:getComputedStyle(el).color,surface:getComputedStyle(el).backgroundColor}));
assert.notEqual(tone.ink,tone.surface,id+': ação do cartão precisa ficar visível');
}
if(width!==768)await page.screenshot({path:path.join(os.tmpdir(),'boxsys-'+id+'-'+name+'-'+width+'.png'),fullPage:true});
}
console.log('PASS '+id+' '+width+'px: início, catálogo, produto e sobre; largura, hero e rodapé');
}
await page.setViewportSize({width:1440,height:960});await go();
const cardTone=await page.locator(t.card).filter({hasText:'Produto 2'}).getByRole('button',{name:t.quick,exact:true}).evaluate(el=>({ink:getComputedStyle(el).color,surface:getComputedStyle(el).backgroundColor}));
assert.notEqual(cardTone.ink,cardTone.surface,id+': ação do cartão precisa ficar visível');
await page.getByRole('link',{name:t.cta,exact:true}).click();await page.locator('.'+p+'-catalog').waitFor();
await page.getByRole('combobox',{name:'Filtrar por categoria'}).selectOption('1');
await page.waitForFunction(sel=>document.querySelectorAll(sel).length===4,t.card);
await page.getByRole('searchbox',{name:'Buscar no catálogo'}).fill('inexistente');
await page.getByText('Nada encontrado',{exact:true}).waitFor();
await page.getByRole('button',{name:'Limpar filtros',exact:true}).click();
await page.waitForFunction(sel=>document.querySelectorAll(sel).length===8,t.card);
await page.getByRole('combobox',{name:'Ordenar por'}).selectOption('maior');
await page.waitForFunction(sel=>document.querySelector(sel)?.textContent.trim()==='Produto 8',t.name);
if(!(await page.getByRole('searchbox',{name:'Buscar produtos',exact:true}).isVisible()))await page.getByRole('button',{name:'Buscar produtos',exact:true}).click();
await page.getByRole('searchbox',{name:'Buscar produtos',exact:true}).fill('especial');
await page.getByRole('button',{name:'Buscar',exact:true}).click();
await page.waitForFunction(sel=>document.querySelectorAll(sel).length===1,t.card);
if(id==='electric'){await page.getByRole('button',{name:'Adicionar aos favoritos',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Remover dos favoritos',exact:true}).getAttribute('aria-pressed'),'true');}
else{await page.getByRole('button',{name:'Favoritar Seleção especial',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Remover Seleção especial dos favoritos',exact:true}).getAttribute('aria-pressed'),'true');}
await go('/produto/selecao-1');
const purchaseTone=await page.locator(t.buy).locator(t.main).evaluate(el=>({ink:getComputedStyle(el).color,surface:getComputedStyle(el).backgroundColor}));
assert.notEqual(purchaseTone.ink,purchaseTone.surface,id+': texto da compra precisa ficar visível');
const thumb=page.getByRole('button',{name:t.thumb,exact:true});await thumb.click();
const g=page.locator(t.buy).getByRole('button',{name:id==='aura'?'Tamanho: G':'G',exact:true});
if(!(await g.isDisabled())){await g.click();assert.ok(await page.locator(t.buy).locator(t.main).isDisabled());}
await page.locator(t.buy).getByRole('button',{name:id==='aura'?'Tamanho: P':'P',exact:true}).click();
await page.locator(t.buy).locator(t.main).click();
await page.locator('.fragrance-cart-item').waitFor();
assert.match(await page.locator('.fragrance-cart-item').innerText(),/Tamanho: P/i);
assert.match(await page.locator('.fragrance-cart-item').innerText(),/99,90/);
await page.getByRole('button',{name:'Continuar para checkout',exact:true}).click();await page.getByPlaceholder('Seu nome *').waitFor();
await page.getByRole('button',{name:'Fechar carrinho',exact:true}).click();
hidden=true;await go('/produto/selecao-1');
assert.ok(!(await page.locator('.'+p+'-page').innerText()).includes('99,90'));
hidden=false;order=true;await go('/produto/selecao-1');assert.ok(!(await page.locator('.'+p+'-page').innerText()).includes('99,90'));
order=false;empty=true;await go();await page.getByText('Novos produtos estão chegando.',{exact:true}).waitFor();await page.locator('.'+p+'-hero-image').evaluate(el=>el.decode());
empty=false;custom=true;await go();await page.getByRole('heading',{name:'Campanha da loja',exact:true}).waitFor();assert.equal(await page.locator('.'+p+'-hero-image').getAttribute('src'),image);
custom=false;slides=true;await go();await page.getByRole('heading',{name:'Campanha personalizada',exact:true}).waitFor();await page.getByRole('link',{name:'Ver campanha',exact:true}).click();await page.locator('.'+p+'-catalog').waitFor();assert.equal(new URL(page.url()).searchParams.get('categoria'),'2');assert.equal(new URL(page.url()).searchParams.get('previewTheme'),id);
slides=false;await page.setViewportSize({width:375,height:960});await go();
await page.getByRole('button',{name:'Abrir menu',exact:true}).click();await page.getByRole('dialog',{name:'Menu da loja'}).getByRole('link',{name:t.menu,exact:true}).click();await page.locator('.'+p+'-catalog').waitFor();assert.equal(await page.getByRole('dialog',{name:'Menu da loja'}).count(),0);
await go('/produto/selecao-1');
assert.ok(await page.evaluate(sel=>{const w=document.querySelector('.fixed.bottom-6.right-6'),b=document.querySelector(sel);return w&&b&&w.getBoundingClientRect().bottom<=b.getBoundingClientRect().top;},t.bar),id+': WhatsApp não pode cobrir a compra');
await go('/catalogo');await page.locator(t.card).filter({hasText:'Produto 2'}).getByRole('button',{name:t.quick,exact:true}).click();
const regular=page.locator('.fragrance-cart-item').filter({hasText:'Produto 2'});await regular.waitFor();assert.match(await regular.innerText(),/130,90/);await page.getByRole('button',{name:'Fechar carrinho',exact:true}).click();
await go('/sobre');await page.getByRole('heading',{name:'Trocas e devoluções',exact:true}).waitFor();assert.ok((await page.locator('.'+p+'-footer').innerText()).includes('09:00 às 18:00'));
assert.deepEqual(errors,[]);console.log('PASS '+id+': filtros, busca, favoritos, opções, estoque, promoção, sacola, checkout, preços ocultos, banners, menu, compra móvel, política e horários');await page.close();
}
}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

