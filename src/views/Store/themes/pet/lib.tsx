import { useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useStore } from "../../StoreLayout";
import { buildStorePath, productRouteSegment, resolveStoreSlug } from "../../store-routing";
import { availableUnits, storeTracksStock } from "../../../../utils/storeStock";
import { getVariationImages } from "../../../../utils/variationImages";
import type { Product } from "../../../../types";

export const money = (v: number | string | undefined | null) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const imageOf = (p?: Product | null): string =>
  (Array.isArray(p?.images) && p!.images![0]) || p?.image_url || "";

export const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export const groups = (p: Product) =>
  p.attributes?.length
    ? p.attributes.map((a) => ({ name: a.name, values: a.values, colors: a.colors }))
    : (p.variations || []).map((a) => ({ name: a.name, values: a.options.map((o) => o.value), colors: undefined as Record<string, string> | undefined }));

/** Preço efetivo e preço cheio (quando há desconto). */
export const priceOf = (p: Product) => {
  const price = Number(p.discount_price ?? p.price) || 0;
  const full = Number(p.price) || 0;
  return { price, full, off: p.discount_price != null && Number(p.discount_price) > 0 && price < full };
};

/** Saldo total do produto (soma das combinações, quando existem). */
export const totalUnits = (p: Product): number | null => {
  if (Array.isArray(p.skus) && p.skus.length && (!p.sale_unit || p.sale_unit === "unidade"))
    return p.skus.reduce((s, k) => s + (Number(k.stock) || 0), 0);
  return availableUnits(p);
};

export function useKit() {
  const store = useStore();
  const { slug: routeSlug } = useParams();
  const [params] = useSearchParams();
  const preview = params.get("previewTheme");
  const slug = resolveStoreSlug(routeSlug);
  const path = (p = "") => {
    const base = buildStorePath(slug, p);
    return preview ? `${base}${base.includes("?") ? "&" : "?"}previewTheme=${encodeURIComponent(preview)}` : base;
  };
  const sf = store.tenant.policies?.storefront || {};
  const hidden = sf.hide_prices === true || sf.checkout_mode === "order_request";
  const active = useMemo(() => store.products.filter((p) => p.is_active), [store.products]);
  const tracks = storeTracksStock(store.tenant);
  const soldOut = (p: Product) => tracks && totalUnits(p) === 0;
  const catName = (id?: number) => store.categories.find((c) => c.id === id)?.name || "";
  const productPath = (p: Product) => path(`/produto/${productRouteSegment(p)}`);
  const countIn = (id: number) => active.filter((p) => p.category_id === id).length;
  const usedCategories = store.categories.filter((c) => countIn(c.id) > 0);
  return { ...store, slug, path, productPath, sf, hidden, active, tracks, soldOut, catName, countIn, usedCategories, preview };
}

export function useProductForm(product: Product | undefined) {
  const { tenant, cart, addToCart, openCart } = useStore();
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");
  const [active, setActive] = useState(0);
  const choices = useMemo(() => (product ? groups(product) : []), [product]);
  const ready = choices.every((g) => selected[g.name]);
  const tracks = storeTracksStock(tenant);
  const units = product && tracks ? availableUnits(product, choices.length ? selected : undefined) : null;
  const inCart = product
    ? cart
        .filter((i) => i.id === product.id && choices.every((g) => i.selectedOptions?.[g.name] === selected[g.name]))
        .reduce((s, i) => s + i.quantity, 0)
    : 0;
  const max = units === null ? 99 : Math.max(0, units - inCart);
  const quantity = Math.max(1, Math.min(qty, Math.max(1, max)));
  const canAdd = !!product && ready && (units === null || max > 0);
  const base = product ? (Array.isArray(product.images) && product.images.length ? product.images : product.image_url ? [product.image_url] : []) : [];
  const variant = getVariationImages(product, selected);
  const images = variant.length ? variant : base;
  const pick = (name: string, value: string) => {
    setSelected((c) => ({ ...c, [name]: value }));
    setActive(0);
  };
  const add = () => {
    if (!product || !canAdd) return;
    const options: Record<string, string> = { ...(choices.length ? selected : {}) };
    if (note.trim()) options["Observação"] = note.trim();
    for (let i = 0; i < quantity; i += 1) addToCart(product, Object.keys(options).length ? options : undefined);
    openCart();
  };
  return { selected, pick, qty: quantity, setQty, note, setNote, choices, ready, units, max, canAdd, add, images, active, setActive, inCart };
}
