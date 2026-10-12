import { Link } from "react-router-dom";
import { Droplets, Heart, ShoppingBag, Sparkles } from "lucide-react";
import { productRouteSegment } from "../../store-routing";

export const fragranceImage = (product: { image_url?: string | null; images?: unknown }) =>
  (Array.isArray(product.images) && typeof product.images[0] === "string" ? product.images[0] : product.image_url) || null;

export const fragranceMoney = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const fragranceStorefront = (tenant: any) => tenant.policies?.storefront || {};
export const fragranceIsRequest = (tenant: any) => tenant.policies?.storefront?.checkout_mode === "order_request";
export const fragranceHidePrices = (tenant: any) => fragranceIsRequest(tenant) || tenant.policies?.storefront?.hide_prices === true;

export function FragranceProductCard({ product, path, category, saved, onFavorite, onAdd, hidePrices, index = 0 }: any) {
  const image = fragranceImage(product);
  const price = Number(product.discount_price || product.price);
  return <article className={`fragrance-product-card group relative min-w-0 border-t border-[#cbd5e1] pt-3 ${index % 3 === 1 ? "sm:mt-8" : ""}`}>
    <Link to={path(`/produto/${productRouteSegment(product)}`)} className="relative grid aspect-[4/5] place-items-center overflow-hidden bg-[#edf4ff] p-5 transition duration-300 group-hover:bg-[#e1edff]">
      <span className="absolute left-0 top-0 h-1 w-14 bg-[#2563eb] transition-all duration-300 group-hover:w-28" />
      {image ? <img src={image} alt={product.name} className="h-full w-full object-contain transition duration-500 group-hover:scale-105" /> : <Droplets size={42} strokeWidth={1} className="text-[#2563eb]" />}
      {product.is_featured && <span className="absolute bottom-3 left-3 border border-[#9ec3fa] bg-white/90 px-2.5 py-1 text-[8px] font-bold uppercase tracking-[.14em] text-[#1d4ed8]">Destaque</span>}
    </Link>
    <button aria-label="Salvar produto" onClick={onFavorite} className={`absolute right-3 top-6 grid h-8 w-8 place-items-center rounded-full border backdrop-blur ${saved ? "border-[#2563eb] bg-[#2563eb] text-white" : "border-white/80 bg-white/85 text-[#1e3a5f]"}`}><Heart size={15} fill={saved ? "currentColor" : "none"} /></button>
    <div className="pb-1 pt-4"><p className="text-[9px] font-bold uppercase tracking-[.18em] text-[#2563eb]">{category || "Coleção"}</p><Link to={path(`/produto/${productRouteSegment(product)}`)} className="mt-2 block line-clamp-2 min-h-11 text-[15px] font-semibold leading-snug text-[#0f172a] transition hover:text-[#2563eb]">{product.name}</Link><div className="mt-4 flex items-center justify-between gap-2 border-t border-[#dbe5f3] pt-3"><strong className="text-sm font-semibold text-[#163b70]">{hidePrices ? "Sob consulta" : fragranceMoney(price)}</strong><button onClick={onAdd} className="inline-flex h-9 items-center gap-2 border border-[#2563eb] px-3 text-[9px] font-bold uppercase tracking-[.1em] text-[#2563eb] transition hover:bg-[#2563eb] hover:text-white" aria-label="Adicionar ao pedido"><ShoppingBag size={14} /><span className="hidden sm:inline">Adicionar</span></button></div></div>
  </article>;
}

export function FragranceEmpty({ onClear }: { onClear?: () => void }) {
  return <div className="grid min-h-72 place-items-center rounded-[2rem] border border-dashed border-[#b9cce7] bg-white p-8 text-center"><div><Droplets className="mx-auto text-[#2563eb]" size={42} strokeWidth={1} /><h2 className="mt-4 text-xl font-semibold text-[#0f172a]">Nenhum produto encontrado</h2><p className="mt-2 text-sm text-slate-500">Ajuste a busca ou escolha outra seção da loja.</p>{onClear && <button onClick={onClear} className="mt-5 bg-[#2563eb] px-5 py-3 text-[10px] font-bold uppercase tracking-[.16em] text-white">Ver todos</button>}</div></div>;
}

export function FragranceTrust() {
  return <div className="grid gap-px overflow-hidden rounded-[1.75rem] border border-[#dbe5f3] bg-[#dbe5f3] sm:grid-cols-3">{[[Sparkles, "Curadoria", "Produtos selecionados pela sua loja"], [ShoppingBag, "Pedido simples", "Monte sua sacola em poucos passos"], [Heart, "Atendimento humano", "Confirmação pela sua loja"]].map(([Icon, title, text]: any) => <div key={title} className="bg-white px-6 py-6"><Icon size={19} className="text-[#2563eb]" strokeWidth={1.5} /><p className="mt-4 text-sm font-semibold text-[#0f172a]">{title}</p><p className="mt-1 text-xs leading-relaxed text-slate-500">{text}</p></div>)}</div>;
}
