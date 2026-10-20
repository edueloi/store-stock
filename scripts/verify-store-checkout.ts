import { test } from "node:test";
import assert from "node:assert/strict";
import { createStoreCheckout, getStoreCheckoutReceipt } from "../backend/services/store-checkout.service";
import { storeOrderEmailContent, flushStoreOrderEmails } from "../backend/services/store-order-email.service";
import { checkoutContact, storeDelivery } from "../backend/utils/store-checkout";
import { restoreStoreCart, serializeStoreCart } from "../src/lib/store-cart";
import { adjustStoreCheckoutStock } from "../backend/services/store-checkout-stock";
import { storePostalAddress } from "../backend/controllers/store-checkout.controller";

type Row=Record<string,any>;
function fixture() {
  let products:Row[]=[{id:1,tenant_id:1,name:"Camiseta Ação",sku:"SR-1",price:129.90,discount_price:99.90,stock_quantity:3,is_active:true,sale_unit:"unidade",attributes:[{name:"Tamanho",values:["P","G"]}],skus:[{combo:{Tamanho:"P"},stock:2},{combo:{Tamanho:"G"},stock:1}],image_url:"",images:[]}];
  let orders:Row[]=[],emails:Row[]=[],movements:Row[]=[];
  const tenant:any={id:1,name:"Stride Teste",slug:"stride",subdomain:"stride",whatsapp:"5511999999999",status:"active",sell_without_stock_control:false,policies:{storefront:{checkout_mode:"online",checkout_payment_methods:{pix:true},delivery:{pickup_enabled:true,delivery_enabled:true,cep_zones:[{name:"Centro",from:"01000000",to:"01999999",fee:15}]}}}};
  const match=(row:Row,where:Row={})=>Object.entries(where).every(([key,value])=>value && typeof value === "object" && !(value instanceof Date) ? Object.entries(value).every(([op,want])=>op === "gte" ? row[key]>=want : op === "lt" ? row[key]<want : op === "lte" ? row[key]<=want : true) : row[key]===value);
  const apply=(row:Row,data:Row)=>{for(const [key,value]of Object.entries(data)){row[key]=value && typeof value === "object" && "increment" in value ? row[key]+value.increment : value && typeof value === "object" && "decrement" in value ? row[key]-value.decrement : value;}return row;};
  const database:any={tenant:{findUnique:async({where}:Row)=>where.id===tenant.id?tenant:null},user:{findFirst:async()=>({email:"dono@example.com"})},
    product:{findFirst:async({where}:Row)=>products.find(row=>match(row,where))||null,update:async({where,data}:Row)=>apply(products.find(row=>match(row,where))!,data),updateMany:async({where,data}:Row)=>{const rows=products.filter(row=>match(row,where));rows.forEach(row=>apply(row,data));return{count:rows.length};}},
    order:{findUnique:async({where}:Row)=>orders.find(row=>match(row,where))||null,findFirst:async({where}:Row)=>{const order=orders.find(row=>match(row,where));return order?{...order,store_emails:emails.filter(row=>row.order_id===order.id)}:null;},create:async({data}:Row)=>{const order={...data,id:orders.length+1,created_at:new Date()};orders.push(order);return order;}},
    stockMovement:{create:async({data}:Row)=>{movements.push(data);return data;}},
    storeOrderEmail:{createMany:async({data}:Row)=>{for(const row of data)emails.push({id:emails.length+1,status:"pending",attempts:0,created_at:new Date(),updated_at:new Date(),next_attempt_at:new Date(),...row});return{count:data.length};},findMany:async({where}:Row)=>emails.filter(row=>match(row,where)),updateMany:async({where,data}:Row)=>{const rows=emails.filter(row=>match(row,where));rows.forEach(row=>apply(row,data));return{count:rows.length};},update:async({where,data}:Row)=>apply(emails.find(row=>match(row,where))!,data)},
    $transaction:async(callback:any)=>{const before=structuredClone({products,orders,emails,movements});try{return await callback(database);}catch(error){products=before.products;orders=before.orders;emails=before.emails;movements=before.movements;throw error;}}
  };
  return {database,tenant,get products(){return products;},get orders(){return orders;},get emails(){return emails;},get movements(){return movements;}};
}
const contact={name:"Maria da Ação",email:"maria@example.com",phone:"(11) 99999-9999",deliveryType:"pickup",paymentMethod:"pix",cep:"01001-000",street:"Praça da Sé",number:"10",complement:"",district:"Sé",city:"São Paulo",state:"SP",notes:"Portaria"};
const request=(extra:any={})=>({tenantId:1,requestId:"12345678-1234-4567-890a-123456789012",customerInfo:contact,items:[{id:1,quantity:1,price:.01,selected_options:{Tamanho:"P"}}],...extra});
test("preço, estoque da SKU e frete de retirada conferidos no servidor",async()=>{
  const db=fixture();const result=await createStoreCheckout(request(),db.database);
  assert.equal(result.total,99.9);assert.equal(db.orders[0].shipping_amount,0);assert.equal(db.products[0].stock_quantity,2);assert.equal(db.products[0].skus[0].stock,1);
  assert.equal(db.emails.length,2);assert.equal(db.emails[0].recipient,contact.email);assert.equal(db.emails[1].recipient,"dono@example.com");assert.equal(db.orders[0].customer_email,contact.email);assert.equal(db.movements.length,1);
});
test("reenvio do mesmo pedido não duplica compra, estoque ou e-mails",async()=>{
  const db=fixture();const one=await createStoreCheckout(request(),db.database),two=await createStoreCheckout(request(),db.database);
  assert.equal(one.orderId,two.orderId);assert.equal(one.receiptToken,two.receiptToken);assert.equal(two.repeated,true);assert.equal(db.orders.length,1);assert.equal(db.emails.length,2);assert.equal(db.products[0].stock_quantity,2);
  await assert.rejects(createStoreCheckout(request({customerInfo:{...contact,name:"Outro nome"}}),db.database),{status:409});
});
test("entrega soma apenas a taxa cadastrada e preserva endereço",async()=>{
  const db=fixture();const result=await createStoreCheckout(request({customerInfo:{...contact,deliveryType:"delivery"}}),db.database);
  assert.equal(result.total,114.9);assert.equal(db.orders[0].shipping_amount,15);assert.match(db.orders[0].customer_address,/Praça da Sé, 10/);
  await assert.rejects(createStoreCheckout(request({requestId:"22345678-1234-4567-890a-123456789012",customerInfo:{...contact,deliveryType:"delivery",cep:"99999-999"}}),db.database));
  assert.equal(db.orders.length,1);
});
test("variação obrigatória, saldo e transação impedem baixa parcial",async()=>{
  const db=fixture();
  await assert.rejects(createStoreCheckout(request({items:[{id:1,quantity:1}]}),db.database));
  await assert.rejects(createStoreCheckout(request({items:[{id:1,quantity:3,selected_options:{Tamanho:"P"}}]}),db.database),{status:409});
  await assert.rejects(createStoreCheckout(request({items:[{id:1,quantity:1,selected_options:{Tamanho:"P"}},{id:2,quantity:1}]}),db.database),{status:409});
  assert.equal(db.products[0].stock_quantity,3);assert.equal(db.products[0].skus[0].stock,2);assert.equal(db.orders.length,0);assert.equal(db.emails.length,0);
});
test("loja sem controle não baixa estoque; destinatários configurados são usados",async()=>{
  const db=fixture();db.tenant.sell_without_stock_control=true;db.products[0].stock_quantity=0;
  db.tenant.policies.storefront.order_notification_emails="pedidos@example.com; pedidos@example.com";
  await createStoreCheckout(request(),db.database);assert.equal(db.products[0].stock_quantity,0);assert.equal(db.movements.length,0);assert.equal(db.emails.length,2);assert.equal(db.emails[1].recipient,"pedidos@example.com");
});
test("confirmação exige token privado da loja e não expõe metadados internos",async()=>{
  const db=fixture();const result=await createStoreCheckout(request(),db.database);
  const receipt=await getStoreCheckoutReceipt(1,result.orderId,result.receiptToken,db.database);assert.equal(receipt.customer_email,contact.email);assert.equal((receipt as any).storefront_details,undefined);
  await assert.rejects(getStoreCheckoutReceipt(2,result.orderId,result.receiptToken,db.database),{status:404});
  await assert.rejects(getStoreCheckoutReceipt(1,result.orderId,"a".repeat(64),db.database),{status:404});
});
test("formulário valida e-mail, telefone, endereço e meios habilitados",async()=>{
  assert.throws(()=>checkoutContact({...contact,email:"sem-email"}));assert.throws(()=>checkoutContact({...contact,phone:"123"}));assert.throws(()=>checkoutContact({...contact,deliveryType:"delivery",number:""}));
  const db=fixture();await assert.rejects(createStoreCheckout(request({customerInfo:{...contact,paymentMethod:"card_on_delivery"}}),db.database));assert.equal(db.orders.length,0);
  assert.equal(storeDelivery(db.tenant.policies.storefront,"01001000").delivery_fee,15);
});
test("e-mail escapa conteúdo e distingue pedido recebido de pagamento",async()=>{
  const db=fixture();await createStoreCheckout(request(),db.database);
  const payload={...db.emails[0].payload,store_name:"<script>alert(1)</script>"};
  const content=storeOrderEmailContent(payload,false);assert.ok(!content.html.includes("<script>"));assert.match(content.html,/pagamento pendente/);assert.ok(content.html.includes("Confirmação")||content.html.includes("confirmação"));
});
test("falha de SMTP mantém a compra e agenda uma nova tentativa",async()=>{
  const db=fixture();await createStoreCheckout(request(),db.database);db.emails.splice(1);let attempts=0;
  await flushStoreOrderEmails(db.database,async()=>{attempts++;throw new Error("SMTP indisponível");});
  assert.equal(attempts,1);assert.equal(db.orders.length,1);assert.equal(db.emails[0].status,"pending");assert.equal(db.emails[0].attempts,1);
  db.emails[0].next_attempt_at=new Date(0);
  await flushStoreOrderEmails(db.database,async()=>{attempts++;});assert.equal(db.emails[0].status,"sent");assert.equal(attempts,2);
});
test("sacola salva só itens, isola preços e recupera saldo atual",()=>{
  const db=fixture();const raw=serializeStoreCart([{id:1,quantity:9,selectedOptions:{Tamanho:"P"}}]);assert.ok(!raw.includes("email"));assert.ok(!raw.includes("price"));
  const restored=restoreStoreCart(raw,db.products as any,true);assert.equal(restored[0].quantity,2);assert.equal(restored[0].price,99.9);
  assert.equal(restoreStoreCart(JSON.stringify({updated_at:0,items:[{id:1,quantity:1}]}),db.products as any,true).length,0);
});
test("edição do pedido ajusta apenas a diferença do estoque reservado",async()=>{
  const db=fixture();await createStoreCheckout(request(),db.database);
  const previous=[{product_id:1,quantity:1,selected_options:{Tamanho:"P"}}];
  const next=[{...previous[0],quantity:2}];
  await db.database.$transaction((tx:any)=>adjustStoreCheckoutStock(tx,1,1,previous,next));
  assert.equal(db.products[0].stock_quantity,1);assert.equal(db.products[0].skus[0].stock,0);
  await assert.rejects(db.database.$transaction((tx:any)=>adjustStoreCheckoutStock(tx,1,1,next,[{...next[0],quantity:4}])));
  assert.equal(db.products[0].stock_quantity,1);
  await db.database.$transaction((tx:any)=>adjustStoreCheckoutStock(tx,1,1,next,[]));
  assert.equal(db.products[0].stock_quantity,3);assert.equal(db.products[0].skus[0].stock,2);
});
test("consulta de CEP trata formato, retorno inexistente e falha do serviço",async()=>{
  const original=globalThis.fetch;let calls=0;
  const response=()=>({code:200,body:null as any,status(code:number){this.code=code;return this;},json(body:any){this.body=body;return this;}});
  try{
    globalThis.fetch=(async(url:any)=>{calls++;assert.equal(url,"https://viacep.com.br/ws/01001000/json/");return{ok:true,json:async()=>({logradouro:"Praça da Sé",bairro:"Sé",localidade:"São Paulo",uf:"SP"})} as any;}) as any;
    const found=response();await storePostalAddress({params:{cep:"01001000"}} as any,found as any);assert.equal(found.body.city,"São Paulo");
    const invalid=response();await storePostalAddress({params:{cep:"123"}} as any,invalid as any);assert.equal(invalid.code,422);assert.equal(calls,1);
    globalThis.fetch=(async()=>({ok:true,json:async()=>({erro:true})})) as any;
    const missing=response();await storePostalAddress({params:{cep:"99999999"}} as any,missing as any);assert.equal(missing.code,404);
    globalThis.fetch=(async()=>{throw new Error("timeout");}) as any;
    const unavailable=response();await storePostalAddress({params:{cep:"88888888"}} as any,unavailable as any);assert.equal(unavailable.code,503);assert.match(unavailable.body.error,/manualmente/);
  }finally{globalThis.fetch=original;}
});
