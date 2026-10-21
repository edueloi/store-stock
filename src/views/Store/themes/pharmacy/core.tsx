import { useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { useStore } from "../../StoreLayout";
import { buildStorePath, resolveStoreSlug } from "../../store-routing";
import { getVariationImages } from "../../../../utils/variationImages";
import { availableUnits, storeTracksStock } from "../../../../utils/storeStock";
import type { Product, Tenant } from "../../../../types";

import { HIDDEN_PRICE } from "../../../../lib/storePrice";
export const money = (value: number) =>
  value === HIDDEN_PRICE ? "Sob consulta" : Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const productImage = (p?: Product) => (p?.images && p.images[0]) || p?.image_url || "";

export const optionGroups = (p: Product) =>
  Array.isArray(p.attributes) && p.attributes.length
    ? p.attributes.map((a) => ({ name: a.name, values: a.values, colors: a.colors }))
    : (p.variations || []).map((v) => ({
        name: v.name,
        values: v.options.filter((o) => o.stock > 0).map((o) => o.value),
        colors: undefined as Record<string, string> | undefined,
      }));

export const normalize = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Dados comuns a todas as páginas do tema: caminhos com previewTheme, preços ocultos, produtos ativos. */
export function useShop() {
  const store = useStore();
  const { slug } = useParams();
  const { search } = useLocation();
  const preview = new URLSearchParams(search).get("previewTheme");
  const path = (part = "") => {
    const base = buildStorePath(resolveStoreSlug(slug), part);
    return preview ? `${base}${base.includes("?") ? "&" : "?"}previewTheme=${encodeURIComponent(preview)}` : base;
  };
  const config = store.tenant.policies?.storefront || {};
  const hidden = config.hide_prices === true || config.checkout_mode === "order_request";
  const active = useMemo(
    () => store.products.filter((p) => p.is_active && p.type !== "internal"),
    [store.products],
  );
  const count = store.cart.reduce((sum, item) => sum + item.quantity, 0);
  return { ...store, path, preview, config, hidden, active, count, tracks: storeTracksStock(store.tenant) };
}

export function priceOf(product: Product, hidden: boolean) {
  const hasDiscount = product.discount_price != null && Number(product.discount_price) < Number(product.price);
  return {
    now: hidden ? "Sob consulta" : money(Number(product.discount_price ?? product.price)),
    old: !hidden && hasDiscount ? money(Number(product.price)) : "",
    saving: !hidden && hasDiscount ? money(Number(product.price) - Number(product.discount_price)) : "",
    pct: !hidden && hasDiscount && Number(product.price) > 0 ? Math.round((1 - Number(product.discount_price) / Number(product.price)) * 100) : 0,
  };
}

/** Estado de compra de um produto: opções obrigatórias, galeria, quantidade limitada ao saldo. */
export function useBuy(product?: Product) {
  const { addToCart, cart, tenant } = useStore();
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [qty, setQty] = useState(1);
  const [photo, setPhoto] = useState(0);
  const choices = product ? optionGroups(product) : [];
  const ready = choices.every((c) => selected[c.name]);
  const variationPhotos = product ? getVariationImages(product, selected) : [];
  const base = product ? (product.images && product.images.length ? product.images : product.image_url ? [product.image_url] : []) : [];
  const gallery = variationPhotos.length ? variationPhotos : base;
  const tracks = storeTracksStock(tenant);
  const units = product && tracks ? availableUnits(product, ready && choices.length ? selected : undefined) : null;
  const already = product
    ? cart
        .filter((i) => i.id === product.id && choices.every((c) => i.selectedOptions?.[c.name] === selected[c.name]))
        .reduce((sum, i) => sum + i.quantity, 0)
    : 0;
  const maximum = units === null ? 999 : Math.max(0, units - already);
  const soldOut = units !== null && (ready || !choices.length) && maximum <= 0;
  const canAdd = ready && !soldOut && qty >= 1 && qty <= maximum;
  useEffect(() => {
    setPhoto(0);
    setQty(1);
  }, [selected, product?.id]);
  useEffect(() => {
    if (qty > maximum && maximum >= 1) setQty(maximum);
  }, [maximum, qty]);
  const pick = (name: string, value: string) => setSelected((cur) => ({ ...cur, [name]: value }));
  const add = () => {
    if (!product || !canAdd) return;
    for (let i = 0; i < qty; i += 1) addToCart(product, choices.length ? selected : undefined);
  };
  return { selected, pick, qty, setQty, photo, setPhoto, choices, ready, gallery, maximum, soldOut, canAdd, add };
}

const DAY_ORDER = ["segunda", "terca", "quarta", "quinta", "sexta", "sabado", "domingo"];
const DAY_EN = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const DAY_LABEL = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];

export function hoursRows(tenant: Tenant) {
  const hours = tenant.business_hours;
  if (!hours) return [];
  return Object.entries(hours)
    .map(([key, v]) => {
      const k = normalize(key).replace(/-feira$/, "").trim();
      let i = DAY_ORDER.indexOf(k);
      if (i < 0) i = DAY_EN.indexOf(k);
      if (i < 0) i = DAY_ORDER.findIndex((d) => k.startsWith(d.slice(0, 3)));
      if (i < 0) i = DAY_EN.findIndex((d) => k.startsWith(d.slice(0, 3)));
      return {
        order: i < 0 ? 99 : i,
        day: i < 0 ? key.charAt(0).toUpperCase() + key.slice(1) : DAY_LABEL[i],
        text: !v || v.closed ? "Fechado" : `${v.open} às ${v.close}`,
        closed: !v || v.closed,
      };
    })
    .sort((a, b) => a.order - b.order);
}

export const whatsappLink = (tenant: Tenant, text?: string) =>
  `https://wa.me/${(tenant.whatsapp || "").replace(/\D/g, "")}${text ? `?text=${encodeURIComponent(text)}` : ""}`;

export const pageUrl = () => (typeof window !== "undefined" ? window.location.href : "");
