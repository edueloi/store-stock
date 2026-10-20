import {test} from "node:test";
import assert from "node:assert/strict";
import {mkdir,writeFile} from "node:fs/promises";
import path from "node:path";
import {createShippingLabelPdf,loadShippingLabel,shippingLabelInput,type ShippingLabelData} from "../backend/services/order-shipping-label.service";
const sample:ShippingLabelData={orderId:123,tenantId:7,method:"delivery",recipient:"João da Conceição",phone:"(11) 99999-1234",address:"Rua da Ação, 157 - Apartamento 42\nBairro São José - São Paulo/SP",cep:"01001000",sender:"Strid Sports - Moda e Ação",senderAddress:"Avenida São João, 100 - Centro - São Paulo/SP - CEP 01035-000",senderPhone:"(11) 3333-4444",units:3,format:"100x150",volumes:1};
test("etiqueta mantém identidade do pedido e valida opções de impressão",()=>{
 const data=shippingLabelInput(sample,{orderId:999,tenantId:99,recipient:"Maria da Ação",cep:"01001-000",volumes:2,format:"a4"});
 assert.equal(data.orderId,123);assert.equal(data.tenantId,7);assert.equal(data.cep,"01001000");assert.equal(data.recipient,"Maria da Ação");
 for(const override of [{volumes:0},{volumes:21},{volumes:1.5},{format:"a3"},{recipient:""},{cep:"123"},{address:""},{method:"other"}])assert.throws(()=>shippingLabelInput(sample,override));
 assert.equal(shippingLabelInput({...sample,address:"",cep:"",method:"pickup"},{}).method,"pickup");
});
test("consulta exige pedido da própria loja e bloqueia cancelado",async()=>{
 let cancelled=false;
 const database:any={order:{findFirst:async({where}:any)=>where.id===123&&where.tenant_id===7&&where.sales_channel==="storefront"?{id:123,status:cancelled?"cancelled":"pending",delivery_method:"delivery",customer_name:sample.recipient,customer_phone:sample.phone,customer_address:sample.address+" · CEP 01001-000",tenant:{name:sample.sender,whatsapp:sample.senderPhone,address:sample.senderAddress},items:[{quantity:2},{quantity:1}]}:null}};
 const data=await loadShippingLabel(7,123,database);assert.equal(data.cep,"01001000");assert.equal(data.units,3);assert.ok(!data.address.includes("CEP"));
 await assert.rejects(loadShippingLabel(8,123,database),{status:404});await assert.rejects(loadShippingLabel(undefined as any,123,database),{status:404});cancelled=true;await assert.rejects(loadShippingLabel(7,123,database),{status:409});
});
test("PDF térmico e A4 gerados com acentos e volumes",async()=>{
 const thermal=await createShippingLabelPdf(sample);
 const a4=await createShippingLabelPdf({...sample,format:"a4",volumes:2,method:"pickup"});
 assert.equal(thermal.subarray(0,4).toString(),"%PDF");assert.ok(thermal.length>3000);assert.ok(a4.length>thermal.length);
 if(process.env.LABEL_PDF_FIXTURES){await mkdir(process.env.LABEL_PDF_FIXTURES,{recursive:true});await writeFile(path.join(process.env.LABEL_PDF_FIXTURES,"etiqueta-termica.pdf"),thermal);await writeFile(path.join(process.env.LABEL_PDF_FIXTURES,"etiqueta-a4.pdf"),a4);}
});
test("endereço extenso não é cortado silenciosamente",async()=>{
 await assert.rejects(createShippingLabelPdf({...sample,address:Array(35).fill("Rua São João, bloco 123, complemento muito extenso").join("\n")}),/não cabe na etiqueta/);
});
