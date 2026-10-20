import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useStore } from "../../StoreLayout";
import { buildStorePath, resolveStoreSlug } from "../../store-routing";
import { getVariationImages } from "../../../../utils/variationImages";
import { availableUnits, storeTracksStock } from "../../../../utils/storeStock";
import type { Product } from "../../../../types";

/** Utilitários do tema (sem visual): dados, regras de compra e filtros. */
export const money = (value: number) =>
  Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const productImage = (p?: Product) => (p?.images && p.images[0]) || p?.image_url || "";
export const priceOf = (p: Product) => Number(p.discount_price) > 0 ? Number(p.discount_price) : Number(p.price);
export const onSale = (p: Product) => p.discount_price != null && Number(p.discount_price) > 0 && Number(p.discount_price) < Number(p.price);
export const normalize = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export const groups = (p: Product): { name: string; values: string[]; colors?: Record<string, string> }[] =>
  p.attributes?.length
    ? p.attributes.map((a) => ({ name: a.name, values: a.values, colors: a.colors }))
    : (p.variations || []).map((v) => ({ name: v.name, values: v.options.map((o) => o.value) }));

export function useKit() {
  const store = useStore();
  const { slug: routeSlug } = useParams();
  const [params] = useSearchParams();
  const preview = params.get("previewTheme");
  const slug = resolveStoreSlug(routeSlug);
  const path = (part = "", query?: Record<string, string>) => {
    const base = buildStorePath(slug, part);
    const qs = new URLSearchParams(query || {});
    if (preview) qs.set("previewTheme", preview);
    const s = qs.toString();
    return s ? `${base}${base.includes("?") ? "&" : "?"}${s}` : base;
  };
  const config = store.tenant.policies?.storefront || {};
  const hidden = config.hide_prices === true || config.checkout_mode === "order_request";
  const active = useMemo(() => store.products.filter((p) => p.is_active && p.type !== "internal"), [store.products]);
  return { ...store, slug, preview, path, config, hidden, active };
}

const DAYS: [string, string][] = [["seg", "Seg"], ["ter", "Ter"], ["qua", "Qua"], ["qui", "Qui"], ["sex", "Sex"], ["sab", "Sáb"], ["dom", "Dom"]];
export function hoursLines(hours?: Record<string, { open: string; close: string; closed: boolean }>) {
  if (!hours) return [];
  return DAYS.filter(([k]) => hours[k]).map(([k, label]) => ({
    label,
    text: hours[k].closed ? "Fechado" : `${hours[k].open} às ${hours[k].close}`,
  }));
}

export function useBuy(product?: Product) {
  const { tenant, cart, addToCart } = useStore();
  const choices = useMemo(() => (product ? groups(product) : []), [product]);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const [qty, setQty] = useState(1);
  const [photo, setPhoto] = useState(0);
  const [added, setAdded] = useState(false);
  useEffect(() => { setSelected({}); setNote(""); setQty(1); setPhoto(0); setAdded(false); }, [product?.id]);
  const ready = choices.every((c) => selected[c.name]);
  const variantPhotos = product ? getVariationImages(product, selected) : [];
  const base = product ? (product.images?.length ? product.images : product.image_url ? [product.image_url] : []) : [];
  const gallery = variantPhotos.length ? variantPhotos : base;
  const tracks = storeTracksStock(tenant);
  const units = product && tracks && (ready || !choices.length) ? availableUnits(product, choices.length ? selected : undefined) : null;
  const already = product
    ? cart.filter((i) => i.id === product.id && choices.every((c) => i.selectedOptions?.[c.name] === selected[c.name])).reduce((s, i) => s + i.quantity, 0)
    : 0;
  const max = units === null ? 999 : Math.max(0, units - already);
  const soldOut = units !== null && max === 0;
  const quantity = Math.min(qty, Math.max(1, max));
  const canAdd = Boolean(product) && ready && !soldOut;
  const choose = (name: string, value: string) => { setSelected((c) => ({ ...c, [name]: value })); setPhoto(0); setAdded(false); };
  const add = () => {
    if (!product || !canAdd) return;
    const options = { ...selected, ...(note.trim() ? { Observação: note.trim() } : {}) };
    for (let i = 0; i < quantity; i++) addToCart(product, Object.keys(options).length ? options : undefined);
    setAdded(true);
  };
  return {
    choices, selected, choose, note, setNote: (v: string) => setNote(v.slice(0, 250)), qty: quantity,
    inc: () => setQty(Math.min(max || 1, quantity + 1)), dec: () => setQty(Math.max(1, quantity - 1)),
    photo, setPhoto, gallery, ready, canAdd, soldOut, max, add, added,
  };
}

export function useCatalog(pageSize = 12) {
  const { active, hidden } = useKit();
  const [params, setParams] = useSearchParams();
  const q = params.get("q") || "";
  const cat = params.get("cat") || params.get("categoria") || "";
  const sort = params.get("sort") || "featured";
  const [limit, setLimit] = useState(pageSize);
  useEffect(() => setLimit(pageSize), [q, cat, sort, pageSize]);
  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (key === "cat") next.delete("categoria");
    if (value) next.set(key, value); else next.delete(key);
    setParams(next, { replace: key === "q" });
  };
  const list = useMemo(() => {
    const nq = normalize(q);
    return active
      .filter((p) => (!cat || String(p.category_id) === cat) && normalize(`${p.name} ${p.sku || ""} ${p.description || ""}`).includes(nq))
      .sort((a, b) =>
        sort === "name" ? a.name.localeCompare(b.name, "pt-BR")
          : !hidden && sort === "price_up" ? priceOf(a) - priceOf(b)
          : !hidden && sort === "price_down" ? priceOf(b) - priceOf(a)
          : Number(b.is_featured) - Number(a.is_featured));
  }, [active, q, cat, sort, hidden]);
  return { q, cat, sort, setParam, list, shown: list.slice(0, limit), hasMore: list.length > limit, more: () => setLimit((l) => l + pageSize), clear: () => setParams(new URLSearchParams(params.get("previewTheme") ? { previewTheme: params.get("previewTheme")! } : {})) };
}
