const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const os=require('node:os');
const base=process.env.THEME_TEST_URL || 'http://127.0.0.1:4179';
const image='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500"><rect width="400" height="500" fill="#e8e9e0"/><path d="M110 90 60 130 90 200 125 180 125 410 275 410 275 180 310 200 340 130 290 90 245 75Q200 125 155 75Z" fill="#343b29"/><text x="200" y="250" text-anchor="middle" fill="#c8ff31" font-size="24">MOVIMENTO</text></svg>');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 try{for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:1000},serviceWorkers:'block',locale:'pt-BR'});
  const page=await context.newPage(),errors=[],orders=[];let latest=null,failCep=false;
  page.on('pageerror',error=>{errors.push(error.message);console.error('PAGE',error.message);});
  const product={id:1,tenant_id:1,name:'Camiseta Essential',price:129.9,discount_price:99.9,sku:'SR-1',type:'sale',stock_quantity:3,is_active:true,is_featured:true,category_id:1,image_url:image,images:[image],description:'Algodão, conforto e ação.',attributes:[{name:'Tamanho',values:['P','G']}],skus:[{combo:{Tamanho:'P'},stock:2},{combo:{Tamanho:'G'},stock:0}]};
  await page.route('**/api/**',async route=>{
   const req=route.request(),url=new URL(req.url());
   const data=req.method()==='POST'?req.postDataJSON():null;
   if(url.pathname.startsWith('/api/public/store/') || url.pathname==='/api/public/store')return route.fulfill({json:{tenant:{id:1,slug:'demo',name:'MOVIMENTO',template_id:'stride',whatsapp:'5511999999999',primary_color:'',show_address:true,address:'Rua da Ação, 100',policies:{shipping:'Entrega mediante disponibilidade por CEP.',exchange:'Fale com a equipe para solicitar sua troca.',returns:'Entre em contato com a loja para combinar a devolução.',storefront:{checkout_mode:'online',checkout_payment_methods:{pix:true,cash_on_delivery:true},delivery:{pickup_enabled:true,delivery_enabled:true},checkout_payment_instructions:'Aguarde a conferência do pedido antes de pagar.'}}},categories:[{id:1,name:'Camisetas'}],products:[product]}});
   if(url.pathname==='/api/public/store-checkout/details'){
    const digits=String(data.cep||'').replace(/\D/g,'');const covered=digits==='01001000';
    return route.fulfill({json:{checkout_enabled:true,payment_methods:{pix:true,cash_on_delivery:true,card_on_delivery:false},delivery:{pickup_available:true,delivery_enabled:true,delivery_available:covered,delivery_fee:covered?15:null,delivery_zone:covered?'Centro':null}}});
   }
   if(url.pathname.includes('/postal-address/'))return route.fulfill(failCep ? {status:503,json:{error:'Busca indisponível. Preencha o endereço manualmente.'}} : {json:{cep:'01001000',street:'Praça da Sé',district:'Sé',city:'São Paulo',state:'SP'}});
   if(url.pathname==='/api/public/store-checkout'){orders.push(data);latest=data;return route.fulfill({status:201,json:{orderId:101,receiptToken:'a'.repeat(64),total:214.8}});}
   if(url.pathname==='/api/public/store-checkout/receipt')return route.fulfill({json:{id:101,status:'pending',created_at:new Date().toISOString(),customer_name:latest.customerInfo.name,customer_email:latest.customerInfo.email,customer_email_status:'sent',address:'Praça da Sé, 10 · Sé · São Paulo/SP · CEP 01001000',payment_method:'pix',delivery_method:'delivery',total:214.8,shipping:15,items:[{id:1,name:product.name,image,quantity:2,unit_price:99.9,options:'Tamanho: P'}]}});
   return route.fulfill({json:[]});
  });
  const goto=async suffix=>{await page.goto(`${base}/s/demo${suffix}?previewTheme=stride`);await page.locator('.sr-page').waitFor();await page.locator('#app-splash').waitFor({state:'hidden'});};
  await goto('/produto/camiseta-essential-1');
  await page.getByRole('button',{name:'P',exact:true}).click();
  await page.getByRole('button',{name:'Aumentar quantidade',exact:true}).click();
  await page.getByRole('button',{name:'Adicionar à sacola',exact:true}).click();
  await page.locator('.fragrance-cart-item').waitFor();
  assert.match(await page.locator('.fragrance-cart-item').innerText(),/199,80/);
  await page.reload();await page.locator('.sr-commerce-buy').waitFor();
  await page.getByRole('button',{name:'Abrir sacola, 2 itens',exact:true}).click();
  assert.match(await page.locator('.fragrance-cart-item').innerText(),/Tamanho: P/i);
  await page.getByRole('button',{name:'Continuar para checkout',exact:true}).click();
  assert.ok(page.url().includes('/checkout'));assert.ok(page.url().includes('previewTheme=stride'));
  await page.getByLabel('Nome completo',{exact:true}).fill('Maria da Ação');
  await page.getByLabel(/^E-mail/).fill('maria@example.com');
  await page.getByLabel(/^Telefone com DDD/).fill('11999999999');
  await page.screenshot({path:path.join(os.tmpdir(),`boxsys-stride-checkout-contact-${width}.png`),fullPage:true});
  await page.getByRole('button',{name:'Continuar',exact:true}).click();
  await page.getByLabel('Receber no endereço',{exact:false}).check();
  await page.getByLabel('CEP',{exact:true}).fill('99999999');
  await page.getByText('Este CEP não está na área de entrega da loja.',{exact:true}).waitFor();
  failCep=width===390; await page.getByLabel('CEP',{exact:true}).fill('01001000'); if(failCep){await page.getByText('Busca indisponível. Preencha o endereço manualmente.',{exact:true}).waitFor();await page.getByLabel('Rua / avenida',{exact:true}).fill('Praça da Sé');await page.getByLabel('Bairro',{exact:true}).fill('Sé');await page.getByLabel('Cidade',{exact:true}).fill('São Paulo');await page.getByLabel('UF',{exact:true}).fill('SP');}
  await page.waitForFunction(()=>Array.from(document.querySelectorAll('input')).some(input=>input.value==='Praça da Sé'));
  await page.getByLabel('Número',{exact:true}).fill('10');
  await page.getByLabel(/Observações do pedido/).fill('Deixar na portaria.');
  await page.screenshot({path:path.join(os.tmpdir(),`boxsys-stride-checkout-delivery-${width}.png`),fullPage:true});
  await page.getByRole('button',{name:'Continuar',exact:true}).click();
  await page.getByRole('checkbox').check();
  await page.getByText('R$ 214,80',{exact:true}).waitFor();
  await page.screenshot({path:path.join(os.tmpdir(),`boxsys-stride-checkout-review-${width}.png`),fullPage:true});
  await page.getByRole('button',{name:'Confirmar pedido',exact:true}).click();
  await page.getByText('Pedido recebido · aguardando confirmação',{exact:true}).waitFor();
  assert.equal(orders.length,1);assert.equal(orders[0].customerInfo.email,'maria@example.com');assert.equal(orders[0].items[0].quantity,2);assert.equal(orders[0].customerInfo.street,'Praça da Sé');assert.equal(orders[0].customerInfo.deliveryType,'delivery');
  await page.screenshot({path:path.join(os.tmpdir(),`boxsys-stride-checkout-receipt-${width}.png`),fullPage:true});
  await page.reload();await page.getByText('Pedido recebido · aguardando confirmação',{exact:true}).waitFor();assert.equal(orders.length,1);
  const storage=await page.evaluate(()=>localStorage.getItem('store_cart_v2:1'));assert.ok(!storage.includes('maria@example.com'));assert.equal(JSON.parse(storage).items.length,0);
  assert.ok(await page.getByRole('link',{name:'Continuar explorando',exact:true}).isVisible());
  const size=await page.evaluate(()=>({viewport:innerWidth,width:document.documentElement.scrollWidth}));assert.ok(size.width<=size.viewport+2,JSON.stringify(size));
  await goto('/ajuda');await page.getByRole('heading',{name:'ANTES, DURANTE. E DEPOIS DA COMPRA.'}).waitFor();
  assert.deepEqual(errors,[]);console.log(`PASS ${width}px: produto, sacola persistente, contato, CEP/endereço, frete, revisão, confirmação, atualização sem duplicar e políticas.`);
  await context.close();
 }}finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
