// Node 20+, Vite em 4179 e PLAYWRIGHT_MODULE apontando para Playwright.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),path=require('node:path'),os=require('node:os');
const base=process.env.THEME_TEST_URL||'http://127.0.0.1:4179';
const image='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="#f1f4f5"/><rect x="110" y="60" width="180" height="270" rx="12" fill="#293b46"/><rect x="125" y="80" width="150" height="200" rx="4" fill="#b6ece2"/><circle cx="200" cy="306" r="10" fill="#fff"/></svg>');
const products=Array.from({length:12},(_,i)=>({id:i+1,name:i===0?'Seleção especial':'Produto '+(i+1),sku:'NX-'+i,price:99.9+i,discount_price:i===0?79.9:i===1?0:null,stock_quantity:8,type:'sale',is_active:true,is_featured:i===0,category_id:i%2+1,image_url:image,images:[image,image+' '],description:'Descrição com ação, proteção e composição.',attributes:i===0?[{name:'Cor',values:['Preto','Branco']}]:[],skus:i===0?[{combo:{Cor:'Preto'},stock:4},{combo:{Cor:'Branco'},stock:0}]:[]}));
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
try{const page=await browser.newPage({serviceWorkers:'block'}),errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});
let hidden=false,empty=false,slides=false,few=false;
const mock=async p=>{await p.route('**/api/**',r=>r.request().url().includes('/api/public/store')?r.fulfill({json:{tenant:{id:1,name:'MVS SOLUÇÕES',slug:'demo',template_id:'nexus_tech',whatsapp:'5511999999999',show_address:true,address:'Rua da Ação, 100',business_hours:{monday:{open:'09:00',close:'18:00',closed:false},sunday:{open:'',close:'',closed:true}},policies:{shipping:'Entrega conforme as opções da loja.',returns:'Consulte as condições de devolução.',storefront:{hide_prices:hidden,checkout_mode:'online',hero_slides:slides?[{id:'one',image,title:'Campanha da loja',button_label:'Ver campanha',button_url:'/catalogo?cat=2'}]:[]}}},categories:[{id:1,name:'Eletrônicos'},{id:2,name:'Acessórios'}],products:empty?[]:few?products.slice(0,1):[...products,{...products[1],id:99,name:'Uso interno',type:'internal'}]}}):r.fulfill({json:{payment_methods:{pix:true},delivery:{pickup_available:true,delivery_available:false}}}));};
await mock(page);
const go=async(suffix='')=>{await page.goto(base+'/s/demo'+suffix+(suffix.includes('?')?'&':'?')+'previewTheme=nexus_tech',{waitUntil:'domcontentloaded'});await page.locator('.nx-page').waitFor();await page.locator('#app-splash').waitFor({state:'hidden'});};
if(!process.env.THEME_SKIP_RESPONSIVE)for(const width of [375,768,1440]){
await page.setViewportSize({width,height:960});
for(const [suffix,name]of [['','inicio'],['/catalogo','catalogo'],['/produto/selecao-1','produto'],['/sobre','sobre']]){
await go(suffix);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),width+'/'+name+': overflow');
assert.equal(await page.locator('.nx-footer').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(13, 27, 42)');
assert.equal(await page.locator('.nx-foot-card').first().evaluate(el=>getComputedStyle(el).backgroundColor),'rgba(0, 0, 0, 0)');
assert.equal(await page.locator('.nx-foot-hero,.nx-cmp,.nx-tabs').count(),0);
if(width===375||width===1440){await page.waitForTimeout(1000);await page.screenshot({path:path.join(os.tmpdir(),'nexus-'+name+'-'+width+'.png'),fullPage:true});}
}
console.log('PASS Nexus '+width+'px: menu, início, catálogo, produto, sobre e rodapé.');
}
await page.setViewportSize({width:1440,height:960});await go();
assert.equal(await page.locator('.nx-marquee-set span').first().evaluate(el=>getComputedStyle(el).textTransform),'uppercase');
assert.equal(await page.locator('.nx-rail').evaluate(el=>getComputedStyle(el).scrollbarWidth),'none');
const rail=page.locator('.nx-rail');await rail.scrollIntoViewIfNeeded();await page.mouse.move(0,0);
await page.waitForFunction(()=>document.querySelector('.nx-rail').scrollLeft>100,null,{timeout:9000});
await page.getByRole('button',{name:'Próximo lançamento',exact:true}).click();await page.waitForTimeout(600);
await page.getByRole('button',{name:'Lançamento anterior',exact:true}).click();await page.waitForTimeout(600);
await rail.hover();const paused=await rail.evaluate(el=>el.scrollLeft);await page.waitForTimeout(4600);assert.ok(Math.abs(await rail.evaluate(el=>el.scrollLeft)-paused)<3,'Carrossel não pausou no hover');
await page.getByRole('button',{name:'Próximo lançamento',exact:true}).focus();const focused=await rail.evaluate(el=>el.scrollLeft);await page.mouse.move(0,0);await page.waitForTimeout(4600);assert.ok(Math.abs(await rail.evaluate(el=>el.scrollLeft)-focused)<3,'Carrossel não pausou no foco');
const reduced=await browser.newPage({viewport:{width:1440,height:960},reducedMotion:'reduce',serviceWorkers:'block'});await mock(reduced);await reduced.goto(base+'/s/demo?previewTheme=nexus_tech',{waitUntil:'domcontentloaded'});await reduced.locator('.nx-rail').scrollIntoViewIfNeeded();await reduced.waitForTimeout(4700);assert.equal(await reduced.locator('.nx-rail').evaluate(el=>el.scrollLeft),0);await reduced.getByRole('button',{name:'Próximo lançamento',exact:true}).click();assert.ok(await reduced.locator('.nx-rail').evaluate(el=>el.scrollLeft)>0);await reduced.close();
await go();await page.getByRole('button',{name:'Categorias',exact:true}).click();await page.locator('.nx-pop').getByRole('link',{name:'Acessórios',exact:true}).click();await page.locator('.nx-cat-body').waitFor();assert.equal(new URL(page.url()).searchParams.get('cat'),'2');assert.equal(await page.locator('.nx-pop').count(),0);
await go('/catalogo');await page.getByRole('combobox',{name:'Ordenar por'}).selectOption('menor');await page.waitForFunction(()=>document.querySelector('.nx-card-name')?.textContent==='Seleção especial');
const regular=page.locator('.nx-card').filter({hasText:'Produto 2'});assert.equal(await regular.locator('.nx-badge:not(.nx-badge-off)').count(),0);await regular.getByRole('button',{name:'Comprar',exact:true}).click();await page.locator('.fragrance-cart-item').waitFor();assert.match(await page.locator('.fragrance-cart-item').innerText(),/100,90/);
await page.getByRole('button',{name:'Continuar para checkout',exact:true}).click();await page.getByPlaceholder('Seu nome *').waitFor();await page.getByRole('button',{name:'Fechar carrinho',exact:true}).click();
await go('/produto/selecao-1');await page.locator('.nx-buy').getByRole('button',{name:/Preto/}).click();await page.locator('.nx-buy').getByRole('button',{name:'Adicionar ao carrinho',exact:true}).click();await page.locator('.fragrance-cart-item').waitFor();assert.match(await page.locator('.fragrance-cart-item').innerText(),/79,90/);await page.getByRole('button',{name:'Fechar carrinho',exact:true}).click();
hidden=true;await go('/produto/selecao-1');assert.ok(!(await page.locator('.nx-prod-page').innerText()).includes('79,90'));hidden=false;
few=true;await go();assert.equal(await page.locator('.nx-launch-arrow').count(),0);few=false;
empty=true;await go();await page.getByText('Em breve, novos produtos na vitrine.',{exact:true}).waitFor();empty=false;
slides=true;await go();await page.getByRole('heading',{name:'Campanha da loja',exact:true}).waitFor();await page.getByRole('link',{name:'Ver campanha',exact:true}).click();await page.locator('.nx-cat-body').waitFor();assert.equal(new URL(page.url()).searchParams.get('cat'),'2');assert.equal(new URL(page.url()).searchParams.get('previewTheme'),'nexus_tech');slides=false;
await page.setViewportSize({width:375,height:960});await go();await page.getByRole('button',{name:'Abrir menu',exact:true}).click();await page.getByRole('dialog',{name:'Menu',exact:true}).getByRole('link',{name:'Catálogo',exact:true}).click();await page.locator('.nx-cat-body').waitFor();
await go('/produto/selecao-1');assert.ok(await page.evaluate(()=>{const w=document.querySelector('.fixed.bottom-6.right-6').getBoundingClientRect(),b=document.querySelector('.nx-sticky').getBoundingClientRect();return w.bottom<=b.top;}));
assert.deepEqual(errors,[]);console.log('PASS Nexus: autoplay, setas, pausa por hover/foco, movimento reduzido, categorias, ordenação, preços, carrinho, checkout, banners e menu móvel.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
