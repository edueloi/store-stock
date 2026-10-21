const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const base=process.env.THEME_TEST_URL||'http://127.0.0.1:4179';
const fixture=(text,color)=>'data:image/svg+xml,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="700" height="700"><rect width="700" height="700" fill="#ecf1ee"/><rect x="100" y="80" width="500" height="540" fill="${color}" stroke="#52686d" stroke-width="8"/><path d="M140 120H440L140 480Z" fill="white" opacity=".3"/><text x="350" y="370" fill="#17313b" text-anchor="middle" font-size="30">${text}</text></svg>`);
const img=fixture('VIDRO','#cfe1df'),img2=fixture('DETALHE','#e2d8cc');
const products=[{id:1,tenant_id:7,name:'ESPELHO SOB MEDIDA',category_id:1,type:'sale',is_active:true,is_featured:true,stock_quantity:10,track_stock:false,sale_unit:'m2',measure_unit:'m2',price:20,price_per_measure:150,min_billable_quantity:.5,attributes:[{name:'Espessura',values:['4 mm','6 mm']}],image_url:img,images:[img,img2],description:'Descrição cadastrada: vidro com ação e proteção.\nTexto da loja.',storefront_details:{specifications:'Espessura de fábrica: 4 mm.\nAcabamento lapidado.',delivery_installation:'Retirada em São Paulo.\nInstalação mediante agendamento.',measurements:{enabled:true,kind:'espelho'}}},{id:2,tenant_id:7,name:'KIT 01 AL',category_id:2,type:'sale',is_active:true,stock_quantity:10,sale_unit:'unidade',price:95.77,attributes:[],image_url:img2,images:[img2],description:''}];
const entry=path.join(__dirname,'.glass-product-preview.tsx');
(async()=>{
 let browser;
 try{
  browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
  const page=await browser.newPage({viewport:{width:1440,height:1000},serviceWorkers:'block'}),errors=[],sent=[];
  page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});
  let enabled=true,failSend=true;
  await page.route('**/api/**',route=>{
   const url=new URL(route.request().url());
   if(url.pathname.endsWith('/quote-catalog'))return route.fulfill({json:{products,services:[]}});
   if(url.pathname.endsWith('/quote-request')){sent.push(route.request().postDataJSON());if(failSend){failSend=false;return route.abort('failed');}return route.fulfill({status:201,json:{number:42,total:455.77}});}
   if(url.pathname.startsWith('/api/public/store'))return route.fulfill({json:{tenant:{id:7,slug:'vidros',name:'VIDROS AÇÃO',template_id:'vidracaria',whatsapp:'5511999999999',show_address:true,address:'Rua São José, 100',banner_url:img,policies:{storefront:{glass_quote_enabled:enabled,glass_gallery:[{id:'foto',image:img2,title:'Ambiente da loja',subtitle:'Foto cadastrada'}]}}},products,categories:[{id:1,name:'Espelhos'},{id:2,name:'Ferragens'}]}});
   return route.fulfill({json:[]});
  });
  const goto=async(suffix='')=>{await page.goto(base+'/s/vidros'+suffix);await page.locator('.vitra-root h1').first().waitFor();await page.locator('#app-splash').waitFor({state:'hidden'});};
  for(const width of process.env.THEME_SKIP_RESPONSIVE ? [] : [390,768,1440]){
   await page.setViewportSize({width,height:1000});
   for(const suffix of ['','/catalogo','/produto/espelho-sob-medida-1','/produto/kit-01-al-2','/orcamento']){
    await goto(suffix);const size=await page.evaluate(()=>({width:document.documentElement.scrollWidth,viewport:innerWidth}));assert.ok(size.width<=size.viewport+2,JSON.stringify({suffix,...size}));
   }
   await goto();await page.screenshot({path:path.join(os.tmpdir(),`boxsys-glass-home-${width}.png`),fullPage:true});
   console.log(`PASS ${width}px: home, catálogo, dois produtos e projeto sem transbordamento`);
  }
  await page.setViewportSize({width:1440,height:1000});
  await goto('/produto/espelho-sob-medida-1');
  await page.getByRole('tab',{name:'Especificações',exact:true}).click();assert.ok((await page.getByRole('tabpanel').innerText()).includes('Espessura de fábrica: 4 mm.'));
  await page.getByRole('tab',{name:'Entrega e instalação',exact:true}).click();assert.ok((await page.getByRole('tabpanel').innerText()).includes('Instalação mediante agendamento.'));
  assert.equal(await page.getByRole('button',{name:/^Linhas/}).count(),0);
  await page.getByLabel('Espessura',{exact:true}).selectOption('4 mm');
  await page.getByLabel('Largura (cm)',{exact:true}).fill('120');await page.getByLabel('Altura (cm)',{exact:true}).fill('100');
  await page.getByLabel('Unidade das medidas',{exact:true}).selectOption('m');assert.equal(await page.getByLabel('Largura (m)',{exact:true}).inputValue(),'1.2');
  await page.getByLabel('Quantidade de peças iguais').fill('2');
  await page.screenshot({path:path.join(os.tmpdir(),'boxsys-glass-product-1440.png'),fullPage:true});
  await page.getByRole('button',{name:'Adicionar ao projeto',exact:true}).click();await page.getByRole('link',{name:'Ver projeto e enviar orçamento'}).click();
  await page.locator('.vitra-piece-row').waitFor();await page.reload();await page.locator('.vitra-piece-row').waitFor();assert.equal(await page.locator('.vitra-piece-row').count(),1);
  await page.getByRole('button',{name:/KIT 01 AL/}).click();
  assert.equal(await page.locator('.vitra-config-panel').getByLabel(/Largura/).count(),0);assert.equal(await page.locator('.vitra-config-panel').getByLabel('Espessura',{exact:true}).count(),0);
  await page.locator('.vitra-config-panel').getByRole('button',{name:'Adicionar ao projeto',exact:true}).click();assert.equal(await page.locator('.vitra-piece-row').count(),2);
  await page.locator('.vitra-piece-row').first().getByRole('button',{name:'Duplicar'}).click();assert.equal(await page.locator('.vitra-piece-row').count(),3);
  await page.locator('.vitra-piece-row').last().getByRole('button',{name:'Remover'}).click();assert.equal(await page.locator('.vitra-piece-row').count(),2);
  await page.getByLabel('Seu nome',{exact:true}).fill('João da Ação');await page.getByLabel('WhatsApp com DDD',{exact:true}).fill('11999999999');
  await page.getByLabel(/Local do projeto/).fill('Rua São José, 10');await page.getByLabel('Preciso de instalação ou visita para medir').check();
  const send=page.getByRole('button',{name:'Enviar projeto para orçamento',exact:true});await send.click();await page.getByRole('alert').waitFor();assert.equal(await page.locator('.vitra-piece-row').count(),2);await send.click();
  await page.getByRole('heading',{name:'Vamos dar forma à sua ideia.'}).waitFor();assert.equal(sent.length,2);assert.equal(sent[0].request_id,sent[1].request_id);assert.equal(sent[1].pieces[0].spec.width_mm,1200);assert.equal(sent[1].pieces[1].spec,null);assert.equal(sent[1].pieces[0].quantity,2);
  console.log('PASS projeto: opções reais, unidades, persistência, duplicar/remover, reenvio e confirmação');
  enabled=false;await goto();assert.equal(await page.locator('a[href*="/orcamento"]').count(),0);await goto('/orcamento');await page.waitForURL('**/catalogo');
  await goto('/produto/kit-01-al-2');assert.equal(await page.getByRole('tab').count(),0);assert.equal(await page.getByLabel(/Largura/).count(),0);assert.equal(await page.getByLabel('Espessura',{exact:true}).count(),0);await page.getByRole('button',{name:'Adicionar ao carrinho',exact:true}).click();await page.locator('.fragrance-cart-drawer').waitFor();
  await page.setViewportSize({width:390,height:1000});await goto('/produto/kit-01-al-2');await page.screenshot({path:path.join(os.tmpdir(),'boxsys-glass-kit-390.png'),fullPage:true});
  console.log('PASS orçamento desativado: menu, links e rota ocultos; kit sem medidas e abas inventadas; carrinho preservado');
  fs.writeFileSync(entry,`import React,{useState} from 'react';import{createRoot}from'react-dom/client';import{BrowserRouter}from'react-router-dom';import{ToastProvider}from'../src/components/ui/Toast';import ProductForm from '../src/views/Dashboard/ProductForm';import '../src/index.css';function App(){const[p,setP]=useState<any>({id:2,name:'KIT 01 AL',type:'sale',price:95.77,stock_quantity:10,sale_unit:'unidade'});return <ProductForm product={p} onProductChange={setP} images={[]} onImagesChange={()=>{}} categories={[]} onCategoryCreated={()=>{}} taxRegime="simples" saving={false} onSave={()=>{(window as any).savedProduct=p}} onCancel={()=>{}}/>}createRoot(document.getElementById('root')!).render(<BrowserRouter><ToastProvider><App/></ToastProvider></BrowserRouter>);`,{flag:'wx'});
  await page.route('**/glass-editor-preview',route=>route.fulfill({contentType:'text/html',body:`<div id="root"></div><script type="module">import RefreshRuntime from "/@react-refresh"; RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$=()=>{}; window.$RefreshSig$=()=>type=>type; window.__vite_plugin_react_preamble_installed__=true;</script><script type="module" src="/scripts/.glass-product-preview.tsx"></script>`}));
  await page.goto(base+'/glass-editor-preview');await page.getByRole('tab',{name:'Catálogo virtual',exact:true}).click();
  await page.getByLabel('Especificações',{exact:true}).fill('Espessura e dimensões cadastradas pela loja.');await page.getByLabel('Entrega e instalação',{exact:true}).fill('Entrega por agendamento.');
  const toggle=page.getByRole('switch',{name:'Cliente pode informar medidas neste produto'});await toggle.click();await page.getByLabel('Modelo do desenho da peça').selectOption('espelho');
  await page.locator('button[type="submit"]').click();const saved=await page.evaluate(()=>window.savedProduct);assert.equal(saved.storefront_details.specifications,'Espessura e dimensões cadastradas pela loja.');assert.equal(saved.storefront_details.measurements.enabled,true);assert.equal(saved.storefront_details.measurements.kind,'espelho');
  assert.deepEqual(errors,[]);console.log('PASS cadastro: conteúdo por produto e configuração de medidas preservados no salvamento');
  if(process.env.THEME_VISUAL_REVIEW){
   enabled=true;
   for(const width of [390,1440]){await page.setViewportSize({width,height:1000});await goto();await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(os.tmpdir(),`boxsys-glass-final-home-${width}.png`),fullPage:true});}
   await goto('/produto/espelho-sob-medida-1');await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(os.tmpdir(),'boxsys-glass-final-product.png'),fullPage:true});
   await goto('/orcamento');await page.screenshot({path:path.join(os.tmpdir(),'boxsys-glass-final-project.png'),fullPage:true});
  }
 }finally{if(browser)await browser.close();if(fs.existsSync(entry))fs.unlinkSync(entry);}
})().catch(e=>{console.error(e);process.exitCode=1;});
