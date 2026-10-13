import { useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import type { Product, Tenant } from "../../../../types";
import { useStore } from "../../StoreLayout";
import {
  buildStorePath,
  parseProductIdFromRoute,
  productRouteSegment,
  resolveStoreSlug,
} from "../../store-routing";
import { availableUnits, storeTracksStock } from "../../../../utils/storeStock";
import { getVariationImages } from "../../../../utils/variationImages";

export const money = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

export const productImage = (p: Product) => (Array.isArray(p.images) && p.images[0]) || p.image_url || "";

export const optionGroups = (p: Product) =>
  p.attributes?.length
    ? p.attributes.map((a) => ({ name: a.name, values: a.values, colors: a.colors }))
    : (p.variations || []).map((a) => ({ name: a.name, values: a.options.map((o) => o.value), colors: undefined as Record<string, string> | undefined }));

export const priceOf = (p: Product) => Number(p.discount_price ?? p.price);
export const hasDiscount = (p: Product) => p.discount_price != null && Number(p.discount_price) < Number(p.price);

export const isSoldOut = (p: Product, tenant: Tenant) => storeTracksStock(tenant) && availableUnits(p) === 0;

export const DAY_LABELS: Record<string, string> = { seg: "Segunda", ter: "Terça", qua: "Quarta", qui: "Quinta", sex: "Sexta", sab: "Sábado", dom: "Domingo" };
const DAY_ORDER = ["seg", "ter", "qua", "qui", "sex", "sab", "dom"];
export function hoursRows(tenant: Tenant) {
  const hours = tenant.business_hours;
  if (!hours) return [];
  return Object.entries(hours)
    .map(([key, v]) => {
      const k = key.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").slice(0, 3);
      const i = DAY_ORDER.indexOf(k);
      return {
        order: i < 0 ? 99 : i,
        day: DAY_LABELS[k] || key,
        text: !v || v.closed ? "Fechado" : `${v.open} às ${v.close}`,
      };
    })
    .sort((a, b) => a.order - b.order);
}

/** Dados comuns do tema: caminhos (preservando previewTheme), preços ocultos e produtos ativos. */
export function useKit() {
  const store = useStore();
  const { slug: routeSlug } = useParams();
  const [params] = useSearchParams();
  const preview = params.get("previewTheme");
  const slug = resolveStoreSlug(routeSlug);
  const path = (suffix = "") => {
    const base = buildStorePath(slug, suffix);
    return preview ? `${base}${base.includes("?") ? "&" : "?"}previewTheme=${encodeURIComponent(preview)}` : base;
  };
  const sf = store.tenant.policies?.storefront || {};
  const hidden = sf.hide_prices === true || sf.checkout_mode === "order_request";
  const active = useMemo(() => store.products.filter((p) => p.is_active), [store.products]);
  const productPath = (p: Product) => path(`/produto/${productRouteSegment(p)}`);
  const waLink = (text?: string) =>
    store.tenant.whatsapp ? `https://wa.me/${store.tenant.whatsapp.replace(/\D/g, "")}${text ? `?text=${encodeURIComponent(text)}` : ""}` : "";
  return { ...store, slug, path, sf, hidden, active, productPath, preview, waLink, cartCount: store.cart.reduce((s, i) => s + i.quantity, 0) };
}

/** Estado completo da página de produto (opções, galeria, quantidade, limite de estoque). */
export function useProductState() {
  const kit = useKit();
  const { productId } = useParams();
  const { products, tenant, addToCart, openCart } = kit;
  const product = products.find((p) => p.id === parseProductIdFromRoute(productId) && p.is_active);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [activeImage, setActiveImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const groups = product ? optionGroups(product) : [];
  const ready = groups.every((g) => selected[g.name]);
  const base = product ? (Array.isArray(product.images) && product.images.length ? product.images : product.image_url ? [product.image_url] : []) : [];
  const variant = product ? getVariationImages(product, selected) : [];
  const images = variant.length ? variant : base;
  const tracks = storeTracksStock(tenant);
  const units = product && tracks ? availableUnits(product, selected) : null;
  const maxQty = units === null ? 99 : Math.max(0, units);
  const soldOut = Boolean(product && tracks && availableUnits(product, ready ? selected : undefined) === 0);
  const qty = Math.min(Math.max(1, quantity), Math.max(1, maxQty));
  const choose = (name: string, value: string) => {
    setSelected((c) => ({ ...c, [name]: value }));
    setActiveImage(0);
    setQuantity(1);
  };
  const canAdd = Boolean(product && ready && !soldOut && maxQty > 0);
  const add = () => {
    if (!product || !canAdd) return;
    for (let i = 0; i < qty; i += 1) addToCart(product, groups.length ? selected : undefined);
    openCart();
  };
  return { ...kit, product, selected, choose, groups, ready, images, activeImage, setActiveImage: (n: number) => setActiveImage(n), qty, setQuantity, maxQty, soldOut, canAdd, add };
}

/** Lê categoria da URL (?categoria= ou ?cat=) e busca (?q=). */
export function useCatalogQuery() {
  const [params, setParams] = useSearchParams();
  const raw = params.get("categoria") || params.get("cat");
  const category = raw ? Number(raw) : null;
  const q = params.get("q") || "";
  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    next.delete("cat");
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    setParams(next, { replace: true });
  };
  return { category: Number.isFinite(category) ? category : null, q, update };
}
