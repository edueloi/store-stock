import { useMemo } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useStore } from "../../StoreLayout";
import { buildStorePath, productRouteSegment, resolveStoreSlug } from "../../store-routing";
import type { Category, Product, Tenant } from "../../../../types";
import { availableUnits, storeTracksStock } from "../../../../utils/storeStock";

import { HIDDEN_PRICE } from "../../../../lib/storePrice";
export const money = (value: number) =>
  value === HIDDEN_PRICE ? "Sob consulta" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value) || 0);

/** Hook base do tema: loja, caminhos (preservando previewTheme) e flags de preço. */
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
  const hidePrices = sf.hide_prices === true || sf.checkout_mode === "order_request";
  const active = useMemo(
    () => store.products.filter((p) => p.is_active && p.type !== "internal"),
    [store.products],
  );
  const tracks = storeTracksStock(store.tenant);
  return { ...store, slug, path, preview, sf, hidePrices, active, tracks };
}

export const productHref = (path: (s?: string) => string, p: Product) => path(`/produto/${productRouteSegment(p)}`);
export const imageOf = (p: Product) => p.images?.[0] || p.image_url || "";

export function priceInfo(p: Product) {
  const base = Number(p.price) || 0;
  const disc = p.discount_price != null ? Number(p.discount_price) : 0;
  const hasDiscount = disc > 0 && disc < base;
  const price = hasDiscount ? disc : base;
  return { price, full: base, hasDiscount, pct: hasDiscount ? Math.round((1 - disc / base) * 100) : 0 };
}

export function inStock(p: Product, tenant: Tenant) {
  if (!storeTracksStock(tenant)) return true;
  const units = availableUnits(p);
  return units === null ? true : units > 0;
}

export type VariationGroup = { name: string; options: { value: string; color?: string; stock: number | null }[] };
export function variationGroups(p: Product): VariationGroup[] {
  if (p.attributes?.length) {
    const skus = Array.isArray(p.skus) ? p.skus : [];
    return p.attributes.map((a) => ({
      name: a.name,
      options: a.values.map((v) => ({
        value: v,
        color: a.colors?.[v],
        stock: skus.length ? skus.filter((s) => s.combo?.[a.name] === v).reduce((n, s) => n + (Number(s.stock) || 0), 0) : null,
      })),
    }));
  }
  return (p.variations || []).map((v) => ({
    name: v.name,
    options: v.options.map((o) => ({ value: o.value, color: undefined, stock: typeof o.stock === "number" ? o.stock : null })),
  }));
}

/** Limite de quantidade: saldo da opção escolhida quando a loja controla estoque. */
export function maxQuantity(p: Product, tenant: Tenant, selected: Record<string, string>, ready: boolean) {
  if (!storeTracksStock(tenant)) return 99;
  const units = availableUnits(p, ready && Object.keys(selected).length ? selected : undefined);
  return units === null ? 99 : Math.max(0, units);
}

export function cartCount(cart: { quantity: number }[]) {
  return cart.reduce((n, i) => n + i.quantity, 0);
}

export function whatsappLink(tenant: Tenant, text?: string) {
  const digits = (tenant.whatsapp || "").replace(/\D/g, "");
  if (!digits) return "";
  return `https://wa.me/${digits.length <= 11 ? `55${digits}` : digits}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

const DAY_ORDER: Record<string, [number, string]> = {
  monday: [0, "Segunda"], segunda: [0, "Segunda"], seg: [0, "Segunda"], mon: [0, "Segunda"],
  tuesday: [1, "Terça"], terca: [1, "Terça"], terça: [1, "Terça"], ter: [1, "Terça"], tue: [1, "Terça"],
  wednesday: [2, "Quarta"], quarta: [2, "Quarta"], qua: [2, "Quarta"], wed: [2, "Quarta"],
  thursday: [3, "Quinta"], quinta: [3, "Quinta"], qui: [3, "Quinta"], thu: [3, "Quinta"],
  friday: [4, "Sexta"], sexta: [4, "Sexta"], sex: [4, "Sexta"], fri: [4, "Sexta"],
  saturday: [5, "Sábado"], sabado: [5, "Sábado"], sábado: [5, "Sábado"], sab: [5, "Sábado"], sat: [5, "Sábado"],
  sunday: [6, "Domingo"], domingo: [6, "Domingo"], dom: [6, "Domingo"], sun: [6, "Domingo"],
};
export function hoursList(tenant: Tenant) {
  return Object.entries(tenant.business_hours || {})
    .sort(([a], [b]) => (DAY_ORDER[a.toLowerCase()]?.[0] ?? 99) - (DAY_ORDER[b.toLowerCase()]?.[0] ?? 99))
    .map(([k, v]) => ({ day: DAY_ORDER[k.toLowerCase()]?.[1] || k, text: v?.closed ? "Fechado" : `${v?.open} às ${v?.close}` }));
}

/** Categoria vinda da URL: aceita ?cat= / ?categoria= com id ou nome. */
export function categoryFromParams(params: URLSearchParams, categories: Category[]): number | null {
  const raw = params.get("categoria") ?? params.get("cat");
  if (!raw) return null;
  if (/^\d+$/.test(raw)) return Number(raw);
  const found = categories.find((c) => c.name.toLowerCase() === raw.toLowerCase());
  return found ? found.id : null;
}
export function withCategory(params: URLSearchParams, id: number | null) {
  const next = new URLSearchParams(params);
  next.delete("categoria");
  if (id) next.set("cat", String(id)); else next.delete("cat");
  return next;
}

export async function shareLink(title: string) {
  const url = window.location.href;
  try {
    if (navigator.share) { await navigator.share({ title, url }); return "Compartilhado"; }
    await navigator.clipboard.writeText(url);
    return "Link copiado";
  } catch {
    return "";
  }
}
