import type { Prisma } from "@prisma/client";
type Item={product_id:number|null;quantity:number;selected_options?:unknown};
/** Ao editar um pedido já reservado, ajusta somente a diferença de cada opção. */
export async function adjustStoreCheckoutStock(tx:Prisma.TransactionClient,tenantId:number,orderId:number,oldItems:Item[],nextItems:Item[]) {
  const changes=new Map<string,{productId:number;options:Record<string,string>;delta:number}>();
  const add=(item:Item,sign:number)=>{
    if(!item.product_id)return;
    const options=(item.selected_options || {}) as Record<string,string>;
    const key=`${item.product_id}:${JSON.stringify(Object.entries(options).sort(([a],[b])=>a.localeCompare(b)))}`;
    const previous=changes.get(key);
    changes.set(key,{productId:item.product_id,options,delta:(previous?.delta || 0)+sign*item.quantity});
  };
  oldItems.forEach(item=>add(item,1));nextItems.forEach(item=>add(item,-1));
  for(const change of [...changes.values()].sort((a,b)=>a.productId-b.productId)) {
    if(!change.delta)continue;
    const product=await tx.product.findFirst({where:{id:change.productId,tenant_id:tenantId}});
    if(product && product.track_stock===false)continue;
    if(!product || product.stock_quantity+change.delta<0)throw new Error("A quantidade solicitada não está disponível no estoque.");
    const data:any={stock_quantity:{increment:change.delta}};
    const skus=Array.isArray(product.skus)?product.skus as any[]:[];
    if(skus.length){
      const index=skus.findIndex(sku=>Object.entries(change.options).every(([key,value])=>sku.combo?.[key]===value));
      if(index<0 || Number(skus[index].stock)+change.delta<0)throw new Error("A opção escolhida não possui estoque para esta alteração.");
      data.skus=skus.map((sku,i)=>i===index?{...sku,stock:Number(sku.stock)+change.delta}:sku);
    } else if(Array.isArray(product.variations) && product.variations.length){
      const variations=product.variations as any[];
      if(variations.some(group=>!group.options.some((option:any)=>option.value===change.options[group.name] && Number(option.stock)+change.delta>=0)))throw new Error("Não há estoque suficiente para esta variação.");
      data.variations=variations.map(group=>({...group,options:group.options.map((option:any)=>option.value===change.options[group.name]?{...option,stock:Number(option.stock)+change.delta}:option)}));
    }
    await tx.product.update({where:{id:product.id},data});
    await tx.stockMovement.create({data:{tenant_id:tenantId,product_id:product.id,type:"adjustment",quantity:change.delta,reason:`Edição do pedido online #${orderId}`}});
  }
}
