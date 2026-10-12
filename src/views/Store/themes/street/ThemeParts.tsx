import { Link } from "react-router-dom";
import { Heart, ShoppingBag, Zap } from "lucide-react";
import { productRouteSegment } from "../../store-routing";

export const streetImage = (product: { image_url?: string | null; images?: unknown }) => (Array.isArray(product.images) && typeof product.images[0] === "string" ? product.images[0] : product.image_url) || null;
export const streetMoney = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const streetHidePrices = (tenant: any) => tenant.policies?.storefront?.checkout_mode === "order_request" || tenant.policies?.storefront?.hide_prices === true;

export function StreetProductCard({ product, path, category, saved, onFavorite, onAdd, hidePrices }: any) {
  const image = streetImage(product); const price = Number(product.discount_price || product.price);
  return <article className="group relative min-w-0 overflow-hidden border border-[#222] bg-[#111] text-white transition hover:-translate-y-1 hover:border-[#bcff00]">
    <Link to={path(`/produto/${productRouteSegment(product)}`)} className="relative grid aspect-square place-items-center overflow-hidden bg-[#e7e7e3] p-4"><div className="absolute left-3 top-3 z-10 bg-[#bcff00] px-2 py-1 text-[8px] font-black uppercase tracking-[.16em] text-black">{product.is_featured ? "Drop" : "Street"}</div>{image ? <img src={image} alt={product.name} className="h-full w-full object-contain transition duration-500 group-hover:scale-110 group-hover:-rotate-2"/> : <Zap className="text-black" size={38} strokeWidth={2.5}/>}</Link>
    <button aria-label="Favoritar" onClick={onFavorite} className={`absolute right-3 top-3 z-10 grid h-8 w-8 place-items-center border ${saved ? "border-[#bcff00] bg-[#bcff00] text-black" : "border-black bg-white text-black"}`}><Heart size={15} fill={saved ? "currentColor" : "none"}/></button>
    <div className="p-4"><p className="text-[9px] font-bold uppercase tracking-[.18em] text-[#a6a6a0]">{category || "Coleção"}</p><Link to={path(`/produto/${productRouteSegment(product)}`)} className="mt-2 block min-h-10 line-clamp-2 text-[15px] font-black uppercase leading-tight tracking-[-.03em]">{product.name}</Link><div className="mt-5 flex items-center justify-between gap-2"><strong className="text-sm font-black">{hidePrices ? "Sob consulta" : streetMoney(price)}</strong><button onClick={onAdd} className="grid h-9 w-9 place-items-center bg-[#bcff00] text-black" aria-label="Adicionar"><ShoppingBag size={16}/></button></div></div>
  </article>;
}

export function StreetEmpty({ onClear }: { onClear?: () => void }) { return <div className="grid min-h-72 place-items-center border border-dashed border-[#454545] bg-[#151515] p-8 text-center text-white"><div><Zap className="mx-auto text-[#bcff00]" size={44}/><h2 className="mt-4 text-2xl font-black uppercase">Sem peças nessa busca</h2><p className="mt-2 text-sm text-[#aaa]">Troque a categoria ou pesquise outra referência.</p>{onClear && <button onClick={onClear} className="mt-5 bg-[#bcff00] px-5 py-3 text-[10px] font-black uppercase tracking-[.16em] text-black">Limpar filtro</button>}</div></div>; }
