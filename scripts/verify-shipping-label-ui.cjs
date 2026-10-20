const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const entry=path.join(__dirname,'.shipping-label-preview.tsx');
const base=process.env.THEME_TEST_URL||'http://127.0.0.1:4179';
(async()=>{
 fs.writeFileSync(entry,`import React from 'react';import {createRoot} from 'react-dom/client';import {BrowserRouter} from 'react-router-dom';import {ToastProvider} from '../src/components/ui/Toast';import Loja from '../src/views/Dashboard/MinhaLoja';import Orders from '../src/views/Dashboard/Orders';import '../src/index.css';const Page=location.hash==='#orders'?Orders:Loja;createRoot(document.getElementById('root')!).render(<BrowserRouter><ToastProvider><Page/></ToastProvider></BrowserRouter>);`,{flag:'wx'});
 let browser;
 try{
  browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
  for(const [view,width]of [['loja',1440],['loja',390],['orders',1440]]){
   const context=await browser.newContext({viewport:{width,height:1000},serviceWorkers:'block'}),page=await context.newPage(),errors=[],writes=[];
   page.on('pageerror',error=>{errors.push(error.message);console.error(error.message);});
   await context.addInitScript(()=>{localStorage.setItem('token','fixture');localStorage.setItem('user',JSON.stringify({role:'admin',tenantId:7}));});
   const order={id:123,tenant_id:7,sales_channel:'storefront',customer_name:'João da Conceição',customer_phone:'11999991234',customer_address:'Rua da Ação, 157 - São Paulo/SP',status:'pending',delivery_method:'delivery',shipping_amount:15,total_amount:114.9,created_at:new Date().toISOString(),items:[{id:1,product_id:1,name:'Camiseta',product_name:'Camiseta',quantity:1,unit_price:99.9,product:{name:'Camiseta',sku:'SR-1'},dimensions_label:'Tamanho: P'}],services:[]};
   const data={orderId:123,tenantId:7,method:'delivery',recipient:order.customer_name,phone:order.customer_phone,address:order.customer_address,cep:'01001000',sender:'Strid Sports',senderAddress:'Avenida São João, 100 - Centro - São Paulo/SP',senderPhone:'1133334444',units:1,format:'100x150',volumes:1};
   await page.route('**/api/**',async route=>{
    const req=route.request(),url=new URL(req.url());
    if(url.pathname.endsWith('/shipping-label')){
     assert.equal(req.headers().authorization,'Bearer fixture');
     if(req.method()==='GET')return route.fulfill({json:data});
     writes.push(req.postDataJSON());
     return route.fulfill({contentType:'application/pdf',body:fs.readFileSync(path.join(process.env.LABEL_PDF_FIXTURES||path.join(os.tmpdir(),'tmp/pdfs/store-label'),'etiqueta-a4.pdf'))});
    }
    if(url.pathname==='/api/tenant')return route.fulfill({json:{id:7,name:'Strid Sports',policies:{storefront:{checkout_mode:'online'}}}});
    if(url.pathname==='/api/store-dashboard')return route.fulfill({json:{summary:{orders:1,confirmed_orders:0,pending_orders:1,confirmed_revenue:0,potential_revenue:114.9,units_sold:1},top_products:[],recent_orders:[order]}});
    if(url.pathname==='/api/orders')return route.fulfill({json:[order]});
    if(url.pathname==='/api/orders/123')return route.fulfill({json:order});
    return route.fulfill({json:[]});
   });
   await page.route(base+'/label-preview',route=>route.fulfill({contentType:'text/html',body:`<html><meta charset="utf-8"><div id="root"></div><script type="module">import R from '/@react-refresh';R.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;</script><script type="module" src="/scripts/.shipping-label-preview.tsx"></script></html>`}));
   await page.goto(base+'/label-preview#'+view);
   if(view==='loja')await page.getByRole('tab',{name:'Vendas online',exact:true}).click();
   else await page.getByRole('row').filter({hasText:'João da Conceição'}).click();
   await page.getByRole('button',{name:'Gerar etiqueta de entrega',exact:true}).click();
   const dialog=page.getByRole('dialog',{name:'Etiqueta do pedido #123'});
   await dialog.getByLabel('Nome do destinatário',{exact:true}).fill('Maria da Ação');
   await dialog.getByLabel('Papel',{exact:true}).selectOption('a4');
   await dialog.getByLabel('Volumes',{exact:true}).fill('2');
   await page.screenshot({path:path.join(os.tmpdir(),`boxsys-label-${view}-${width}.png`)});
   await dialog.getByRole('button',{name:'Gerar etiqueta',exact:true}).click();
   await dialog.getByRole('link',{name:'Abrir para imprimir',exact:true}).waitFor();
   assert.equal(writes.length,1);assert.equal(writes[0].recipient,'Maria da Ação');assert.equal(writes[0].format,'a4');assert.equal(writes[0].volumes,2);
   await dialog.getByRole('button',{name:'Ajustar dados',exact:true}).click();assert.equal(await dialog.getByLabel('Nome do destinatário',{exact:true}).inputValue(),'Maria da Ação');
   await dialog.getByRole('button',{name:'Fechar',exact:true}).click();
   assert.deepEqual(errors,[]);console.log(`PASS ${view} ${width}px: botão, dados, formato, volumes e PDF autenticado.`);
   await context.close();
  }
 }finally{if(browser)await browser.close();fs.unlinkSync(entry);}
})().catch(error=>{console.error(error);process.exitCode=1;});
