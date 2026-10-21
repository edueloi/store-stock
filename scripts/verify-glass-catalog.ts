import { test } from "node:test";
import assert from "node:assert/strict";
import { glassMeasurements, glassOptions, glassPrice } from "../shared/glassCatalog";
import { prepareGlassQuote, saveGlassQuote } from "../backend/services/glass-quote.service";
import { glassSpecFromOptions } from "../src/lib/glassQuote";
import { prisma } from "../backend/config/prisma";
import { getQuoteRequestCatalog } from "../backend/controllers/quote-request.controller";
import { skuMatchesSelection } from "../backend/utils/stock-adjust";

const product = { id: 1, name: "ESPELHO SOB MEDIDA", sale_unit: "m2", measure_unit: "m2", price: 20, price_per_measure: 150, min_billable_quantity: .5, attributes: [{ name: "Espessura", values: ["4 mm", "6 mm"] }], storefront_details: { measurements: { enabled: true, kind: "espelho" } } };
const spec = { kind: "espelho", width_mm: 1200, height_mm: 1000 };
const request = () => ({ request_id: "12345678-1234-1234-1234-123456789abc", customer: { name: "João da Ação", phone: "(11) 99999-9999", email: "joao@example.test", address: "Rua São José, 10" }, pieces: [{ product_id: 1, quantity: 2, spec, selected_options: { Espessura: "4 mm" }, unit_price: .01 }], notes: "Instalação no lavabo", installation: true });
test("preço usa mm, mínimo faturável e unidade cadastrada", () => {
  assert.equal(glassPrice(product,1200,1000,2).total,360);
  assert.equal(glassPrice(product,200,300,2).total,150);
  assert.equal(glassPrice({ ...product, measure_unit: "cm2", price_per_measure: .015, min_billable_quantity: 0 },1200,1000).total,180);
  assert.equal(glassPrice({ ...product, sale_unit: "linear", measure_unit: "cm", price_per_measure: 2, min_billable_quantity: 0 },1200,1000).total,240);
});
test("somente opções cadastradas; preço enviado pelo cliente é ignorado", () => {
  assert.deepEqual(glassOptions({ id: 2, name: "Kit" }), []);
  const data = prepareGlassQuote(request(), [product], []);
  assert.equal(data.total,360); assert.equal(data.items[0].selected_options.Espessura,"4 mm");
  assert.equal(data.items[0].selected_options["Largura (mm)"],"1200");
  assert.equal(glassSpecFromOptions(data.items[0].selected_options)?.kind,"espelho");
  assert.match(data.notes,/Rua São José/); assert.match(data.notes,/instalação/);
  const invalid = request(); invalid.pieces[0].selected_options.Espessura="10 mm (+ R$ 120)";
  assert.throws(() => prepareGlassQuote(invalid,[product],[]),/Selecione Espessura/);
});
test("produtos comuns não ganham medidas nem especificações inventadas", () => {
  const kit = { id: 2, name: "KIT 01 AL", sale_unit: "unidade", price: 95.77 };
  assert.equal(glassMeasurements(kit).enabled,false);
  const body:any=request(); body.pieces=[{ product_id: 2, quantity: 2, spec: null }];
  const data=prepareGlassQuote(body,[kit],[]);
  assert.equal(data.total,191.54); assert.equal(data.items[0].dimensions_label,null); assert.deepEqual(data.items[0].selected_options,{});
});
test("metadados das medidas não impedem a baixa da variação correta ao converter", () => {
  assert.equal(skuMatchesSelection({Cor:"Branco"},{Cor:"Branco","Largura (mm)":"1200","Observações da peça":"Lavabo"}),true);
  assert.equal(skuMatchesSelection({Cor:"Preto"},{Cor:"Branco","Largura (mm)":"1200"}),false);
  assert.equal(skuMatchesSelection({Cor:"Branco"},{"Observações da peça":"Lavabo"}),false);
});
test("validação de medidas, quantidade e item da própria loja", () => {
  assert.throws(() => prepareGlassQuote(request(),[],[]),/Confira o produto/);
  for (const quantity of [0,-1,1.5,100,NaN]) { const body=request(); body.pieces[0].quantity=quantity; assert.throws(() => prepareGlassQuote(body,[product],[])); }
  const body=request(); body.pieces[0].spec={...spec,width_mm:10001}; assert.throws(() => prepareGlassQuote(body,[product],[]));
  const unknown:any=request(); unknown.pieces[0].spec=null; unknown.pieces[0].measure_later=true;
  const data=prepareGlassQuote(unknown,[product],[]); assert.equal(data.publicTotal,false); assert.equal(data.total,0);
  assert.throws(() => prepareGlassQuote(unknown,[{...product,storefront_details:{measurements:{enabled:true,allow_measure_later:false}}}],[]));
});
test("preços ocultos preservam cálculo interno sem divulgar total", () => {
  const data=prepareGlassQuote(request(),[{...product,hide_price_on_site:true}],[]);
  assert.equal(data.total,360); assert.equal(data.publicTotal,false);
  assert.equal(prepareGlassQuote(request(),[product],[],true).publicTotal,false);
});
test("solicitação é um rascunho; reenvio não duplica nem cria venda", async () => {
  let saved:any, action:any, creates=0; let enabled=true;
  const database:any={$transaction:async(fn:any)=>fn({$queryRaw:async()=>[],tenant:{findUniqueOrThrow:async()=>({policies:{storefront:{glass_quote_enabled:enabled}}})},product:{findMany:async({where}:any)=>{assert.equal(where.tenant_id,7);assert.equal(where.is_active,true);return[product];}},service:{findMany:async()=>[]},quote:{findFirst:async()=>null,create:async({data}:any)=>{creates++;saved={id:123,...data};return saved;}},quoteAction:{findFirst:async()=>action?{...action,quote:saved}:null,create:async({data}:any)=>{action=data;}}})};
  const first=await saveGlassQuote(7,request(),database); const second=await saveGlassQuote(7,request(),database);
  assert.equal(first.number,1); assert.equal(second.duplicate,true); assert.equal(creates,1);
  assert.equal(saved.source,"vitrine"); assert.equal(saved.status,"rascunho"); assert.equal(saved.items.create[0].product_id,1);
  const changed=request(); changed.notes="Alteração"; await assert.rejects(saveGlassQuote(7,changed,database),{status:409});
  action=null;enabled=false; await assert.rejects(saveGlassQuote(7,request(),database),{status:404});
});
test("catálogo público oculta preços e fica indisponível quando desabilitado",async()=>{
  const methods=[prisma.tenant.findFirst,prisma.product.findMany,prisma.service.findMany]; let enabled=true;
  try{
    (prisma.tenant as any).findFirst=async()=>({id:7,name:"Vidros Ação",status:"active",policies:{storefront:{glass_quote_enabled:enabled}}});
    (prisma.product as any).findMany=async()=>[{...product,hide_price_on_site:true}]; (prisma.service as any).findMany=async()=>[];
    let status=200,result:any; const response:any={setHeader(){},status(code:number){status=code;return this;},json(data:any){result=data;return this;}};
    await getQuoteRequestCatalog({params:{slug:"vidros"}} as any,response);
    assert.equal(status,200); for(const key of ["price","discount_price","price_per_measure"])assert.equal(result.products[0][key],null);
    enabled=false; await getQuoteRequestCatalog({params:{slug:"vidros"}} as any,response); assert.equal(status,404);
  }finally{(prisma.tenant as any).findFirst=methods[0];(prisma.product as any).findMany=methods[1];(prisma.service as any).findMany=methods[2];}
});
test("numeração tenta novamente em colisão com orçamento criado no painel", async()=>{
  let attempts=0;
  const database:any={$transaction:async()=>{ attempts++; if(attempts===1)throw Object.assign(new Error("Número ocupado"),{code:"P2002"}); return { number:2,total:100,duplicate:false,id:10 }; }};
  const result=await saveGlassQuote(7,request(),database);assert.equal(attempts,2);assert.equal(result.number,2);
});
