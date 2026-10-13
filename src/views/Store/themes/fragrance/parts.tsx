import { Link } from "react-router-dom";
import { Droplets, Heart, ShoppingBag, Sparkles } from "lucide-react";
import { productRouteSegment } from "../../store-routing";
import type { Product } from "../../../../types";
import { money, optionGroups, productImage, useKit } from "./kit";
import { availableUnits } from "../../../../utils/storeStock";
import "./styles.css";

export const fragranceImage = (product?: Product) => productImage(product) || null;
export const fragranceMoney = money;

export function fragranceHidePrices(tenant: ReturnType<typeof useKit>["tenant"]) {
  const storefront = tenant.policies?.storefront;
  return storefront?.checkout_mode === "order_request" || storefront?.hide_prices === true;
}

type FragranceProductCardProps = {
  product: Product;
  path: (suffix?: string) => string;
  category?: string;
  saved: boolean;
  onFavorite: () => void;
  onAdd: () => void;
  hidePrices: boolean;
  index?: number;
};

export function FragranceProductCard({ product, path, category, saved, onFavorite, onAdd, hidePrices, index = 0 }: FragranceProductCardProps) {
  const image = fragranceImage(product);
  const productPath = path(`/produto/${productRouteSegment(product)}`);
  const needsOptions = optionGroups(product).length > 0;
  const { tracks, cart } = useKit();
  const units = tracks ? availableUnits(product) : null;
  const inCart = cart.filter((i) => i.id === product.id).reduce((sum, i) => sum + i.quantity, 0);
  const soldOut = tracks && units !== null && units <= inCart;
  return (
    <article className={`fr-product group relative min-w-0 border-t border-[var(--fr-line)] pt-3 `}>
      <Link to={productPath} className="fr-product-image relative grid aspect-[4/5] place-items-center overflow-hidden bg-[#f5efe7] p-5 transition duration-300 group-hover:bg-[#eee3d8]" aria-label={product.name}>
        <span className="absolute left-0 top-0 h-1 w-14 bg-[#9c7252] transition-all duration-300 group-hover:w-28" />
        {image ? <img src={image} alt="" loading="lazy" className="h-full w-full object-contain transition duration-500 group-hover:scale-105" /> : <Droplets size={42} strokeWidth={1} className="text-[#9c7252]" />}
        {product.is_featured && <span className="absolute bottom-3 left-3 border border-[#cfb49b] bg-white/90 px-2.5 py-1 text-[8px] font-bold uppercase tracking-[.14em] text-[#6e3f2c]">Destaque</span>}
      </Link>
      <button type="button" aria-label={saved ? "Remover dos favoritos" : "Salvar produto"} aria-pressed={saved} onClick={onFavorite} className={`absolute right-3 top-6 grid h-10 w-10 place-items-center rounded-full border backdrop-blur ${saved ? "border-[#6e3f2c] bg-[#6e3f2c] text-white" : "border-white/80 bg-white/85 text-[#6e3f2c]"}`}>
        <Heart size={16} fill={saved ? "currentColor" : "none"} />
      </button>
      <div className="pb-1 pt-4">
        <p className="text-[9px] font-bold uppercase tracking-[.18em] text-[#9c7252]">{category || "Coleção"}</p>
        <Link to={productPath} className="mt-2 block min-h-11 text-[15px] font-semibold leading-snug text-[#332019] transition hover:text-[#6e3f2c]">{product.name}</Link>
        <div className="mt-4 flex items-center justify-between gap-2 border-t border-[#e6d8c8] pt-3">
          <strong className="text-sm font-semibold text-[#6e3f2c]">{hidePrices ? "Sob consulta" : money(Number(product.discount_price ?? product.price))}</strong>
          {needsOptions ? (
            <Link to={productPath} className="inline-flex h-10 items-center gap-2 border border-[#9c7252] px-3 text-[9px] font-bold uppercase tracking-[.1em] text-[#6e3f2c] transition hover:bg-[#6e3f2c] hover:text-white">Ver opções</Link>
          ) : (
            <button type="button" disabled={soldOut} onClick={onAdd} className="inline-flex h-10 items-center gap-2 border border-[#9c7252] px-3 text-[9px] font-bold uppercase tracking-[.1em] text-[#6e3f2c] transition hover:bg-[#6e3f2c] hover:text-white" aria-label={soldOut ? `${product.name} indisponível` : `Adicionar ${product.name} ao pedido`}>
              <ShoppingBag size={14} /><span className="hidden sm:inline">{soldOut ? "Esgotado" : "Adicionar"}</span>
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

export function FragranceEmpty({ onClear }: { onClear?: () => void }) {
  return (
    <div className="grid min-h-72 place-items-center rounded-[2rem] border border-dashed border-[#cfb49b] bg-[#fffdfa] p-8 text-center">
      <div>
        <Droplets className="mx-auto text-[#9c7252]" size={42} strokeWidth={1} />
        <h2 className="mt-4 text-xl font-semibold text-[#332019]">Nenhum produto encontrado</h2>
        <p className="mt-2 text-sm text-[#765e50]">Ajuste a busca ou escolha outra seção da loja.</p>
        {onClear && <button type="button" onClick={onClear} className="mt-5 bg-[#6e3f2c] px-5 py-3 text-[10px] font-bold uppercase tracking-[.16em] text-white">Ver todos</button>}
      </div>
    </div>
  );
}

export function FragranceTrust() {
  const items = [
    [Sparkles, "Curadoria", "Produtos selecionados pela sua loja"],
    [ShoppingBag, "Pedido simples", "Monte sua sacola em poucos passos"],
    [Heart, "Atendimento humano", "Confirmação feita pela sua loja"],
  ] as const;
  return (
    <div className="grid gap-px overflow-hidden rounded-[1.75rem] border border-[#e7ddd0] bg-[#e7ddd0] sm:grid-cols-3">
      {items.map(([Icon, title, text]) => (
        <div key={title} className="bg-[#fffdfa] px-6 py-6">
          <Icon size={19} className="text-[#9c7252]" strokeWidth={1.5} />
          <p className="mt-4 text-sm font-semibold text-[#332019]">{title}</p>
          <p className="mt-1 text-xs leading-relaxed text-[#765e50]">{text}</p>
        </div>
      ))}
    </div>
  );
}