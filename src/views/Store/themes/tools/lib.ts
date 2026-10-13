import { useEffect, useState, type CSSProperties } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useStore } from "../../StoreLayout";
import { buildStorePath, resolveStoreSlug } from "../../store-routing";
import { availableUnits, storeTracksStock } from "../../../../utils/storeStock";
import type { Product, Tenant } from "../../../../types";

export const DEFAULT_ACCENT = "#ecc434";

export const money = (value: number) =>
  Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const productImage = (p?: Product) => (p?.images && p.images[0]) || p?.image_url || "";

export const optionGroups = (p: Product): { name: string; values: string[]; colors?: Record<string, string> }[] =>
  p.attributes?.length
    ? p.attributes.map((a) => ({ name: a.name, values: a.values, colors: a.colors }))
    : (p.variations || []).map((v) => ({ name: v.name, values: v.options.map((o) => o.value) }));

/** Cor de texto legível sobre o destaque (preto ou branco). */
export function onColor(hex: string): string {
  const m = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec((hex || "").trim());
  if (!m) return "#111111";
  let h = m[1];
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.179 ? "#111111" : "#ffffff";
}

export const normalize = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function isSoldOut(tenant: Tenant, p: Product): boolean {
  if (!storeTracksStock(tenant)) return false;
  const skus = Array.isArray(p.skus) ? p.skus : [];
  if (skus.length) return skus.every((s) => !(Number(s.stock) > 0));
  const u = availableUnits(p);
  return u !== null && u <= 0;
}

export function useShop() {
  const store = useStore();
  const { slug: routeSlug } = useParams();
  const [params] = useSearchParams();
  const preview = params.get("previewTheme");
  const slug = resolveStoreSlug(routeSlug);
  const { tenant } = store;
  const sf = tenant.policies?.storefront || {};
  const path = (part = "") => {
    const base = buildStorePath(slug, part);
    return preview ? `${base}${base.includes("?") ? "&" : "?"}previewTheme=${encodeURIComponent(preview)}` : base;
  };
  const hidden = sf.hide_prices === true || sf.checkout_mode === "order_request";
  const active = store.products.filter((p) => p.is_active && p.type !== "internal");
  const accent = (preview ? "" : tenant.primary_color) || DEFAULT_ACCENT;
  const vars = { "--shop-on": onColor(accent) } as CSSProperties;
  const cartCount = store.cart.reduce((sum, i) => sum + i.quantity, 0);
  return { ...store, sf, path, hidden, active, vars, cartCount, slug, preview };
}

export const waLink = (tenant: Tenant, text?: string) =>
  tenant.whatsapp ? `https://wa.me/${tenant.whatsapp.replace(/\D/g, "")}${text ? `?text=${encodeURIComponent(text)}` : ""}` : "";

const DAYS: [string, string][] = [["seg", "Segunda"], ["ter", "Terça"], ["qua", "Quarta"], ["qui", "Quinta"], ["sex", "Sexta"], ["sab", "Sábado"], ["dom", "Domingo"]];
export function hoursList(tenant: Tenant): { day: string; text: string }[] {
  const h = tenant.business_hours;
  if (!h) return [];
  return DAYS.filter(([k]) => h[k]).map(([k, label]) => ({ day: label, text: h[k].closed ? "Fechado" : `${h[k].open} às ${h[k].close}` }));
}

export function priceOf(p: Product) {
  const price = Number(p.price);
  const current = Number(p.discount_price ?? p.price);
  return { current, full: price, discounted: p.discount_price != null && current < price };
}

export type Sort = "destaque" | "menor" | "maior" | "nome";

/** Filtros do catálogo lidos da URL: ?q=, ?cat= (ou ?categoria=) e ?sort=. */
export function useCatalogFilters(active: Product[], step = 24) {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") || "";
  const cat = params.get("cat") || params.get("categoria") || "";
  const sort = (params.get("sort") || "destaque") as Sort;
  const [limit, setLimit] = useState(step);
  useEffect(() => setLimit(step), [q, cat, sort, step]);
  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (key === "cat") next.delete("categoria");
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: key === "q" });
  };
  const clear = () => {
    const next = new URLSearchParams(params);
    ["q", "cat", "categoria", "sort"].forEach((k) => next.delete(k));
    setParams(next);
  };
  const needle = normalize(q.trim());
  const filtered = active
    .filter((p) => (!cat || String(p.category_id) === cat) && (!needle || normalize(`${p.name} ${p.sku || ""} ${p.barcode || ""} ${p.description || ""}`).includes(needle)))
    .sort((a, b) => {
      if (sort === "menor") return priceOf(a).current - priceOf(b).current;
      if (sort === "maior") return priceOf(b).current - priceOf(a).current;
      if (sort === "nome") return a.name.localeCompare(b.name, "pt-BR");
      return Number(b.is_featured) - Number(a.is_featured);
    });
  return { q, cat, sort, update, clear, filtered, visible: filtered.slice(0, limit), more: () => setLimit((n) => n + step), hasMore: filtered.length > limit };
}

/** Estado de compra de um produto: opções obrigatórias, observação, quantidade limitada ao saldo. */
export function useBuy(product: Product | undefined) {
  const { tenant, cart, addToCart } = useStore();
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");
  const choices = product ? optionGroups(product) : [];
  const ready = choices.every((c) => selected[c.name]);
  const tracks = storeTracksStock(tenant);
  const units = product && tracks ? availableUnits(product, ready && choices.length ? selected : undefined) : null;
  const already = product
    ? cart.filter((i) => i.id === product.id && choices.every((c) => i.selectedOptions?.[c.name] === selected[c.name])).reduce((s, i) => s + i.quantity, 0)
    : 0;
  const max = units === null ? 999 : Math.max(0, units - already);
  const soldOut = tracks && units !== null && (ready || !choices.length) && max <= 0;
  const quantity = Math.max(1, Math.min(qty, Math.max(1, max)));
  const canAdd = !!product && ready && !soldOut;
  const choose = (name: string, value: string) => setSelected((cur) => ({ ...cur, [name]: value }));
  const add = () => {
    if (!product || !canAdd) return false;
    const options = { ...selected, ...(note.trim() ? { Observação: note.trim() } : {}) };
    for (let i = 0; i < quantity; i += 1) addToCart(product, Object.keys(options).length ? options : undefined);
    return true;
  };
  return { selected, choose, qty: quantity, setQty, note, setNote, choices, ready, max, soldOut, canAdd, add };
}
