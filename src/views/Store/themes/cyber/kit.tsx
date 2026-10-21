import { useEffect, useMemo, useState } from "react";
import { useLocation, useParams, useSearchParams } from "react-router-dom";
import { useStore } from "../../StoreLayout";
import { buildStorePath, resolveStoreSlug } from "../../store-routing";
import { getVariationImages } from "../../../../utils/variationImages";
import { availableUnits, storeTracksStock } from "../../../../utils/storeStock";
import type { Product, Tenant } from "../../../../types";

import { HIDDEN_PRICE } from "../../../../lib/storePrice";
export const money = (value: number) =>
  value === HIDDEN_PRICE ? "Sob consulta" : Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const imageOf = (p?: Product) => p?.images?.[0] || p?.image_url || "";
export const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
export const priceOf = (p: Product) => Number(p.discount_price ?? p.price);
export const hasDiscount = (p: Product) =>
  p.discount_price != null && Number(p.discount_price) >= 0 && Number(p.discount_price) < Number(p.price);
export const groupsOf = (p: Product): { name: string; values: string[]; colors?: Record<string, string> }[] =>
  Array.isArray(p.attributes) && p.attributes.length
    ? p.attributes.map((a) => ({ name: a.name, values: a.values, colors: a.colors }))
    : (p.variations || []).map((v) => ({ name: v.name, values: v.options.map((o) => o.value) }));
export const pad = (n: number) => String(n).padStart(2, "0");

/** Dados e regras comuns da vitrine, sem nenhuma dependência de outro tema. */
export function useShop() {
  const store = useStore();
  const { slug: routeSlug } = useParams();
  const { search } = useLocation();
  const slug = resolveStoreSlug(routeSlug);
  const preview = new URLSearchParams(search).get("previewTheme");
  const path = (part = "", query: Record<string, string | undefined> = {}) => {
    const base = buildStorePath(slug, part);
    const sp = new URLSearchParams();
    Object.entries(query).forEach(([k, v]) => v && sp.set(k, v));
    if (preview) sp.set("previewTheme", preview);
    const s = sp.toString();
    return s ? `${base}?${s}` : base;
  };
  const config = store.tenant.policies?.storefront || {};
  const hidden = config.hide_prices === true || config.checkout_mode === "order_request";
  const active = useMemo(
    () => store.products.filter((p) => p.is_active && p.type !== "internal"),
    [store.products],
  );
  const cartCount = store.cart.reduce((sum, i) => sum + i.quantity, 0);
  return { ...store, slug, preview, path, config, hidden, active, cartCount };
}

export function useCatalogParams() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") || "";
  const cat = params.get("categoria") || params.get("cat") || "";
  const sort = params.get("sort") || "featured";
  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (key === "categoria") next.delete("cat");
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: key === "q" });
  };
  return { q, cat, sort, set };
}

export function filterProducts(active: Product[], q: string, cat: string, sort: string, hidden: boolean) {
  const needle = norm(q.trim());
  return active
    .filter(
      (p) =>
        (!cat || String(p.category_id) === cat) &&
        (!needle || norm(`${p.name} ${p.sku || ""} ${p.description || ""}`).includes(needle)),
    )
    .sort((a, b) =>
      sort === "name"
        ? a.name.localeCompare(b.name, "pt-BR")
        : !hidden && sort === "price_up"
          ? priceOf(a) - priceOf(b)
          : !hidden && sort === "price_down"
            ? priceOf(b) - priceOf(a)
            : Number(b.is_featured) - Number(a.is_featured),
    );
}

const DAYS: [string, string][] = [
  ["seg", "Segunda"], ["ter", "Terça"], ["qua", "Quarta"], ["qui", "Quinta"],
  ["sex", "Sexta"], ["sab", "Sábado"], ["dom", "Domingo"],
];
export function hoursLines(tenant: Tenant): { day: string; text: string }[] {
  const hours = tenant.business_hours;
  if (!hours) return [];
  return DAYS.filter(([key]) => hours[key]).map(([key, label]) => ({
    day: label,
    text: hours[key].closed ? "Fechado" : `${hours[key].open} – ${hours[key].close}`,
  }));
}
export const whatsappHref = (tenant: Tenant, text?: string) =>
  `https://wa.me/${(tenant.whatsapp || "").replace(/\D/g, "")}${text ? `?text=${encodeURIComponent(text)}` : ""}`;

/** Seleção de opções, quantidade, galeria e limite de saldo de um produto. */
export function usePurchase(product: Product | undefined) {
  const { tenant, cart, addToCart } = useStore();
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [qty, setQty] = useState(1);
  const [photo, setPhoto] = useState(0);
  const choices = product ? groupsOf(product) : [];
  const ready = choices.every((c) => selected[c.name]);
  const variantPhotos = product ? getVariationImages(product, selected) : [];
  const base = product
    ? Array.isArray(product.images) && product.images.filter(Boolean).length
      ? product.images.filter(Boolean)
      : product.image_url ? [product.image_url] : []
    : [];
  const gallery = variantPhotos.length ? variantPhotos : base;
  const tracks = storeTracksStock(tenant);
  const units = product && tracks ? availableUnits(product, ready && choices.length ? selected : undefined) : null;
  const already = product
    ? cart
        .filter((i) => i.id === product.id && choices.every((c) => i.selectedOptions?.[c.name] === selected[c.name]))
        .reduce((sum, i) => sum + i.quantity, 0)
    : 0;
  const maximum = units === null ? 99 : Math.max(0, units - already);
  const soldOut = units !== null && (ready ? maximum <= 0 : units <= 0);
  const canAdd = !!product && ready && !soldOut && qty >= 1 && qty <= maximum;

  useEffect(() => {
    setSelected({});
    setQty(1);
    setPhoto(0);
  }, [product?.id]);
  useEffect(() => {
    setQty((q) => Math.min(Math.max(1, q), Math.max(1, maximum)));
  }, [maximum]);

  const choose = (name: string, value: string) => {
    setSelected((cur) => ({ ...cur, [name]: value }));
    setPhoto(0);
  };
  const add = () => {
    if (!product || !canAdd) return;
    for (let i = 0; i < qty; i += 1) addToCart(product, choices.length ? selected : undefined);
    setQty(1);
  };
  return { selected, choose, qty, setQty, photo, setPhoto, choices, ready, gallery, units, maximum, soldOut, canAdd, add };
}

/** Adição rápida pela vitrine: só para produtos sem opções e com saldo. */
export function useQuickAdd() {
  const { tenant, cart, addToCart } = useStore();
  const tracks = storeTracksStock(tenant);
  return (p: Product) => {
    const hasOptions = groupsOf(p).length > 0;
    const units = tracks ? availableUnits(p) : null;
    const inCart = cart.filter((i) => i.id === p.id).reduce((s, i) => s + i.quantity, 0);
    const soldOut = units !== null && units - inCart <= 0;
    return { hasOptions, soldOut, add: () => !hasOptions && !soldOut && addToCart(p) };
  };
}
