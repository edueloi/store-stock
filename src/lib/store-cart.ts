import type { Product } from "../types";
import { availableUnits } from "../utils/storeStock";
import { getVariationImages } from "../utils/variationImages";
export const storeCartKey = (tenantId: number) => `store_cart_v2:${tenantId}`;
export function restoreStoreCart(raw: string | null, products: Product[], tracks: boolean) {
  try {
    const saved = JSON.parse(raw || "null");
    if (!saved || !Array.isArray(saved.items) || Date.now()-saved.updated_at > 7*86400000) return [];
    const used = new Map<number,number>();
    return saved.items.slice(0,100).flatMap((entry:any)=>{
      const product = products.find(product=>product.id === entry.id && product.is_active);
      if (!product || !Number.isInteger(entry.quantity) || entry.quantity < 1) return [];
      const selected = entry.options && typeof entry.options === "object" && !Array.isArray(entry.options) ? entry.options as Record<string,string> : {};
      const groups = product.attributes?.length ? product.attributes.map(group=>({name:group.name,values:group.values})) : (product.variations || []).map(group=>({name:group.name,values:group.options.map(option=>option.value)}));
      if (groups.some(group=>!group.values.includes(selected[group.name])) || Object.keys(selected).some(key=>key !== "Observação" && !groups.some(group=>group.name===key))) return [];
      const remaining = tracks ? Math.max(0,Number(product.stock_quantity)-(used.get(product.id)||0)) : 99;
      const quantity = Math.min(99,entry.quantity,tracks ? availableUnits(product,selected) ?? 99 : 99,remaining);
      if (!quantity) return [];
      used.set(product.id,(used.get(product.id)||0)+quantity);
      const variationLabel = Object.entries(selected).map(([key,value])=>`${key}: ${value}`).join(", ");
      const images = getVariationImages(product,selected);
      return [{...product,price:Number(product.discount_price)>0 ? Number(product.discount_price) : Number(product.price),...(images.length ? {image_url:images[0],images} : {}),quantity,cartItemId:variationLabel ? `${product.id}-${variationLabel}` : `${product.id}`,selectedOptions:Object.keys(selected).length ? selected : undefined,variationLabel}];
    });
  } catch { return []; }
}
export const serializeStoreCart = (items: {id:number;quantity:number;selectedOptions?:Record<string,string>}[]) => JSON.stringify({updated_at:Date.now(),items:items.map(item=>({id:item.id,quantity:item.quantity,options:item.selectedOptions}))});
