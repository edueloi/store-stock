import { Link, useParams, useSearchParams } from "react-router-dom";
import { Heart, PackagePlus, ShoppingBag, Store } from "lucide-react";
import { StoreButton } from "../../../../components/store/StoreButton";
import { useStore } from "../../StoreLayout";
import { buildStorePath, productRouteSegment, resolveStoreSlug } from "../../store-routing";
import { availableUnits, storeTracksStock } from "../../../../utils/storeStock";
import type { Product } from "../../../../types";

export const varietyImage = (product?: { image_url?: string | null; images?: unknown }) =>
  (Array.isArray(product?.images) && typeof product.images[0] === "string" ? product.images[0] : product?.image_url) || null;

export const varietyMoney = (value: number) => Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Grupos de opções obrigatórias do produto (variações legadas ou atributos). */
export const varietyChoices = (product?: Product) => {
  if (!product) return [] as Array<{ name: string; options: Array<{ value: string }> }>;
  if (Array.isArray(product.variations) && product.variations.length) {
    return product.variations.map((v) => ({ name: v.name, options: v.options.map((o) => ({ value: o.value })) }));
  }
  if (Array.isArray(product.attributes)) {
    return product.attributes.map((a) => ({ name: a.name, options: (a.values || []).map((value: string) => ({ value })) }));
  }
  return [];
};

/** Dados comuns do tema: caminhos preservando previewTheme, preços ocultos e estoque. */
export function useVariety() {
  const store = useStore();
  const { slug: routeSlug } = useParams();
  const [params] = useSearchParams();
  const preview = params.get("previewTheme");
  const slug = resolveStoreSlug(routeSlug);
  const path = (part = "") => {
    const base = buildStorePath(slug, part);
    return preview ? `${base}${base.includes("?") ? "&" : "?"}previewTheme=${encodeURIComponent(preview)}` : base;
  };
  const sf = store.tenant.policies?.storefront || {};
  const hidden = sf.hide_prices === true || sf.checkout_mode === "order_request";
  const tracks = storeTracksStock(store.tenant);
  const active = store.products.filter((p) => p.is_active);
  const cartCount = store.cart.reduce((sum, item) => sum + item.quantity, 0);
  const catName = (p: Product) => store.categories.find((c) => c.id === p.category_id)?.name || p.category_name || "";
  const usedCategories = store.categories.filter((c) => active.some((p) => p.category_id === c.id));
  const whatsapp = store.tenant.whatsapp?.replace(/\D/g, "") || "";
  return { ...store, slug, path, sf, hidden, tracks, active, cartCount, catName, usedCategories, whatsapp, preview };
}

export function varietyPrice(p: Product, hidden: boolean) {
  if (hidden) return { now: "Sob consulta", old: null as string | null, off: false };
  const base = Number(p.price);
  const sale = p.discount_price != null && Number(p.discount_price) > 0 ? Number(p.discount_price) : null;
  const off = sale != null && sale < base;
  return { now: varietyMoney(sale ?? base), old: off ? varietyMoney(base) : null, off };
}

export function VarietyProductCard({ product }: { product: Product }) {
  const { path, hidden, wishlist, toggleWishlist, catName, cart, tracks, addToCart } = useVariety();
  const image = varietyImage(product);
  const price = varietyPrice(product, hidden);
  const href = path(`/produto/${productRouteSegment(product)}`);
  const hasOptions = varietyChoices(product).length > 0;
  const units = tracks ? availableUnits(product) : null;
  const inCart = cart.filter((i) => i.id === product.id).reduce((s, i) => s + i.quantity, 0);
  const soldOut = units !== null && units - inCart <= 0;
  const saved = wishlist.includes(product.id);

  return (
    <article className="variety-card">
      <Link to={href} className="variety-card-media" aria-label={product.name}>
        {image ? <img src={image} alt={product.name} loading="lazy" /> : <Store size={38} aria-hidden="true" />}
        {soldOut ? (
          <span className="variety-tag variety-tag-off">Esgotado</span>
        ) : price.off ? (
          <span className="variety-tag variety-tag-sale">Oferta</span>
        ) : product.is_featured ? (
          <span className="variety-tag">Destaque</span>
        ) : null}
      </Link>
      <button
        type="button"
        className={`variety-fav ${saved ? "is-on" : ""}`}
        aria-label={saved ? `Remover ${product.name} dos favoritos` : `Favoritar ${product.name}`}
        aria-pressed={saved}
        onClick={() => toggleWishlist(product.id)}
      >
        <Heart size={16} fill={saved ? "currentColor" : "none"} />
      </button>
      <div className="variety-card-body">
        {catName(product) && <span className="variety-card-cat">{catName(product)}</span>}
        <Link to={href} className="variety-card-name">
          {product.name}
        </Link>
        <div className="variety-price">
          <strong>{price.now}</strong>
          {price.old && <s>{price.old}</s>}
        </div>
        {hasOptions || soldOut ? (
          <StoreButton asChild variant="outline" size="sm" className="variety-card-btn variety-btn-outline">
            <Link to={href}>{soldOut ? "Ver produto" : "Escolher opções"}</Link>
          </StoreButton>
        ) : (
          <StoreButton size="sm" className="variety-card-btn variety-btn-solid" onClick={() => addToCart(product)}>
            <ShoppingBag size={15} /> {hidden ? "Incluir no pedido" : "Adicionar"}
          </StoreButton>
        )}
      </div>
    </article>
  );
}

export function VarietyEmpty({ onClear }: { onClear?: () => void }) {
  return (
    <div className="variety-empty">
      <PackagePlus size={42} aria-hidden="true" />
      <h2>Não encontramos esse item</h2>
      <p>Tente outra categoria ou termo de busca.</p>
      {onClear && (
        <StoreButton className="variety-btn-solid" onClick={onClear}>
          Ver todos os produtos
        </StoreButton>
      )}
    </div>
  );
}
