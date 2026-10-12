import { Link } from "react-router-dom";
import { Droplets, Heart, ShoppingBag, Sparkles } from "lucide-react";
import { productRouteSegment } from "../../store-routing";

export const fragranceImage = (product: { image_url?: string | null; images?: unknown }) =>
  (Array.isArray(product.images) && typeof product.images[0] === "string" ? product.images[0] : product.image_url) || null;

export const fragranceMoney = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const fragranceStorefront = (tenant: any) => tenant.policies?.storefront || {};
export const fragranceIsRequest = (tenant: any) => tenant.policies?.storefront?.checkout_mode === "order_request";
export const fragranceHidePrices = (tenant: any) => fragranceIsRequest(tenant) || tenant.policies?.storefront?.hide_prices === true;

export function FragranceProductCard({ product, path, category, saved, onFavorite, onAdd, hidePrices }: any) {
  const image = fragranceImage(product);
  const price = Number(product.discount_price || product.price);
  return <article className="group relative flex min-w-0 flex-col overflow-hidden rounded-[1.75rem] border border-[#e7ddd0] bg-[#fffdfa] p-3 shadow-[0_18px_40px_rgba(75,45,30,.06)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_25px_50px_rgba(75,45,30,.13)]">
    <Link to={path(`/produto/${productRouteSegment(product)}`)} className="relative grid aspect-[4/4.6] place-items-center overflow-hidden rounded-[1.3rem] bg-[radial-gradient(circle_at_55%_20%,#fff_0%,#f5ede3_50%,#e9dbca_100%)] p-5">
      {image ? <img src={image} alt={product.name} className="h-full w-full object-contain transition duration-500 group-hover:scale-105" /> : <Droplets size={42} strokeWidth={1} className="text-[#b78457]" />}
      {product.is_featured && <span className="absolute left-3 top-3 rounded-full bg-[#40251d] px-3 py-1.5 text-[8px] font-bold uppercase tracking-[.16em] text-[#fff7ed]">Seleção</span>}
    </Link>
    <button aria-label="Salvar produto" onClick={onFavorite} className={`absolute right-5 top-5 grid h-8 w-8 place-items-center rounded-full backdrop-blur ${saved ? "bg-[#40251d] text-white" : "bg-white/80 text-[#694c3b]"}`}><Heart size={15} fill={saved ? "currentColor" : "none"} /></button>
    <div className="px-1 pb-1 pt-4"><p className="text-[9px] font-bold uppercase tracking-[.2em] text-[#9c7252]">{category || "Perfumaria"}</p><Link to={path(`/produto/${productRouteSegment(product)}`)} className="mt-1 block line-clamp-2 min-h-11 text-[15px] font-semibold leading-snug text-[#332019]">{product.name}</Link><div className="mt-4 flex items-center justify-between gap-2"><strong className="text-sm font-semibold text-[#6e3f2c]">{hidePrices ? "Sob consulta" : fragranceMoney(price)}</strong><button onClick={onAdd} className="grid h-9 w-9 place-items-center rounded-full bg-[#40251d] text-white transition hover:bg-[#79513c]" aria-label="Adicionar ao pedido"><ShoppingBag size={15} /></button></div></div>
  </article>;
}

export function FragranceEmpty({ onClear }: { onClear?: () => void }) {
  return <div className="grid min-h-72 place-items-center rounded-[2rem] border border-dashed border-[#dbc8b6] bg-[#fffdfa] p-8 text-center"><div><Droplets className="mx-auto text-[#af835e]" size={42} strokeWidth={1} /><h2 className="mt-4 text-xl font-semibold text-[#38251d]">Nenhuma essência encontrada</h2><p className="mt-2 text-sm text-[#80695a]">Ajuste sua busca ou escolha outra família olfativa.</p>{onClear && <button onClick={onClear} className="mt-5 rounded-full bg-[#40251d] px-5 py-3 text-[10px] font-bold uppercase tracking-[.16em] text-white">Ver todos</button>}</div></div>;
}

export function FragranceTrust() {
  return <div className="grid gap-px overflow-hidden rounded-[1.75rem] border border-[#e7ddd0] bg-[#e7ddd0] sm:grid-cols-3">{[[Sparkles, "Curadoria", "Marcas e essências selecionadas"], [ShoppingBag, "Pedido simples", "Monte sua sacola em poucos passos"], [Heart, "Atendimento humano", "Confirmação pela sua loja"]].map(([Icon, title, text]: any) => <div key={title} className="bg-[#fffdfa] px-6 py-6"><Icon size={19} className="text-[#9c7252]" strokeWidth={1.5} /><p className="mt-4 text-sm font-semibold text-[#38251d]">{title}</p><p className="mt-1 text-xs leading-relaxed text-[#80695a]">{text}</p></div>)}</div>;
}
