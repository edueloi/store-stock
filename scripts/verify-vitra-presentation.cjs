const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),path=require('node:path'),os=require('node:os');
const base=process.env.THEME_TEST_URL||'http://127.0.0.1:4179';
const origin='https://distribuidora-de-vidros-claro-e-camargo.boxsys.com.br';
const asset=value=>typeof value==='string'&&value.startsWith('/')?origin+value:value;
(async()=>{
 const response=await fetch(origin+'/api/public/store/distribuidora-de-vidros-claro-e-camargo');assert.equal(response.status,200);
 const source=await response.json();
 const products=source.products.map(product=>({...product,image_url:asset(product.image_url),images:product.images?.map(asset)}));
 let tenant={...source.tenant,logo_url:asset(source.tenant.logo_url),banner_url:null,policies:{...source.tenant.policies,storefront:{...source.tenant.policies?.storefront,glass_gallery:[]}}};
 const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 try{
  const page=await browser.newPage({serviceWorkers:'block'}),errors=[],writes=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/**',route=>{
   if(route.request().method()!=='GET'){writes.push(route.request().url());return route.abort();}
   if(new URL(route.request().url()).pathname.startsWith('/api/public/store'))return route.fulfill({json:{tenant,products,categories:source.categories}});
   return route.fulfill({json:[]});
  });
  const goto=async(suffix='')=>{await page.goto(base+'/s/mm'+suffix,{waitUntil:'domcontentloaded'});await page.locator('.vitra-root h1').first().waitFor();await page.locator('#app-splash').waitFor({state:'hidden'});};
  for(const width of [1440,768,390]){
   await page.setViewportSize({width,height:1000});await goto();
   const gallery=page.locator('.vitra-catalog-presentation');await gallery.scrollIntoViewIfNeeded();assert.equal(await gallery.locator('.vitra-catalog-presentation-card').count(),3);
   await gallery.locator('img').first().evaluate(image=>image.complete?null:new Promise(resolve=>{image.onload=resolve;image.onerror=resolve;}));
   assert.equal(await gallery.locator('img').first().evaluate(image=>getComputedStyle(image).objectFit),'contain');
   assert.equal(await gallery.getByRole('link',{name:'Ver catálogo completo',exact:true}).getAttribute('href'),'/s/mm/catalogo');
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
   if(width===1440){for(const selector of ['.vitra-catalog-presentation-card','.vitra-catalog-presentation-image']){const cards=await gallery.locator(selector).evaluateAll(cards=>cards.map(card=>({top:card.getBoundingClientRect().top,height:card.getBoundingClientRect().height})));assert.ok(cards.every(card=>Math.abs(card.top-cards[0].top)<2&&Math.abs(card.height-cards[0].height)<2),selector);}}
   await gallery.screenshot({path:path.join(os.tmpdir(),`boxsys-vitra-presentation-${width}.png`)});
   await goto('/sobre');
   const story=page.locator('.vitra-about-story-text');const raw=source.tenant.about_text.trim();assert.equal((await story.textContent()).trim(),raw.startsWith('"')&&raw.endsWith('"')?raw.slice(1,-1):raw);
   assert.equal(await page.locator('.vitra-about-logo img').getAttribute('src'),asset(source.tenant.logo_url));
   assert.equal(await page.locator('.vitra-about-identity h2').innerText(),source.tenant.name);
   assert.ok(await page.locator('.vitra-about-categories a').count()>0);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
   await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(os.tmpdir(),`boxsys-vitra-about-${width}.png`),fullPage:true});
   console.log(`PASS ${width}px: catálogo com imagens inteiras e cards alinhados; Sobre com logo cadastrado e texto preservado; sem transbordamento`);
  }
  await goto();const first=page.locator('.vitra-catalog-presentation-card').first();const href=await first.getAttribute('href');await first.click();await page.waitForURL(base+href);await page.locator('.vitra-product-config h1').waitFor();
  tenant={...tenant,logo_url:null,about_text:'',whatsapp:'',show_address:false,policies:{...tenant.policies,storefront:{...tenant.policies.storefront,glass_gallery:[{id:'ambiente',image:products.find(product=>product.image_url).image_url,title:'Ambiente cadastrado'}]}}};
  await goto('/sobre');assert.equal(await page.locator('.vitra-about-logo img,.vitra-about-location,.vitra-about-contact,.vitra-about-story-text').count(),0);assert.equal(await page.locator('.vitra-about-photo img').count(),1);
  await goto();assert.equal(await page.locator('.vitra-catalog-presentation-card').count(),0);assert.equal(await page.locator('.vitra-portfolio-grid figure').count(),1);
  assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);console.log('PASS links dos produtos; fotos enviadas pela loja preservadas; campos ausentes e endereço oculto respeitados; nenhuma escrita na loja');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
