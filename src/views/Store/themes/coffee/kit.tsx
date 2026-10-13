import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useStore } from "../../StoreLayout";
import { buildStorePath, resolveStoreSlug } from "../../store-routing";
import { availableUnits, storeTracksStock } from "../../../../utils/storeStock";
import { getVariationImages } from "../../../../utils/variationImages";
import type { Product } from "../../../../types";

export const money = (v: number) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const productImage = (p?: Product) =>
  (Array.isArray(p?.images) && p!.images![0]) || p?.image_url || "";

export const optionGroups = (p: Product) =>
  p.attributes?.length
    ? p.attributes.map((a) => ({ name: a.name, values: a.values }))
    : (p.variations || []).map((a) => ({ name: a.name, values: a.options.map((o) => o.value) }));

/** Dados comuns do tema: caminhos com previewTheme, regras de preço e de estoque. */
export function useKit() {
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
  const active = useMemo(
    () =>
      store.products.filter((p) => {
        if (!p.is_active) return false;
        if (!tracks) return true;
        const u = availableUnits(p);
        return u === null || u > 0;
      }),
    [store.products, tracks],
  );
  const cartCount = store.cart.reduce((s, i) => s + i.quantity, 0);
  return { ...store, slug, path, sf, hidden, tracks, active, preview, cartCount };
}

export function priceInfo(p: Product, hidden: boolean) {
  if (hidden) return { now: "Sob consulta", old: null as string | null, off: false };
  const base = Number(p.price);
  const sale = p.discount_price != null && Number(p.discount_price) > 0 && Number(p.discount_price) < base ? Number(p.discount_price) : null;
  const now = sale ?? base;
  return { now: money(now), old: sale != null && sale < base ? money(base) : null, off: sale != null && sale < base };
}

/** Escolha de opções, quantidade, galeria e limite de estoque da página de produto. */
export function useBuy(product: Product | undefined) {
  const { addToCart, cart, tenant, tracks, openCart } = useKit();
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [qty, setQty] = useState(1);
  const [photo, setPhoto] = useState(0);
  const groups = product ? optionGroups(product) : [];
  const ready = groups.every((g) => selected[g.name]);
  const base = product ? (Array.isArray(product.images) && product.images.length ? product.images : product.image_url ? [product.image_url] : []) : [];
  const vi = getVariationImages(product, selected);
  const gallery = vi.length ? vi : base;
  const units = product && tracks ? availableUnits(product, ready ? selected : undefined) : null;
  const inCart = product
    ? cart.filter((i) => i.id === product.id && groups.every((g) => i.selectedOptions?.[g.name] === selected[g.name])).reduce((s, i) => s + i.quantity, 0)
    : 0;
  const maxQty = units === null ? 99 : Math.max(0, units - (ready ? inCart : 0));
  useEffect(() => {
    setPhoto(0);
    setQty((q) => Math.max(1, Math.min(q, maxQty || 1)));
  }, [selected]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    setSelected({});
    setQty(1);
    setPhoto(0);
  }, [product?.id]);
  const soldOut = tracks && units !== null && ready && maxQty <= 0;
  const canAdd = !!product && ready && !soldOut && maxQty >= qty && qty >= 1;
  const add = () => {
    if (!product || !canAdd) return;
    for (let i = 0; i < qty; i++) addToCart(product, groups.length ? selected : undefined);
    openCart();
  };
  return { tenant, selected, setSelected, qty, setQty, photo, setPhoto, groups, ready, gallery, maxQty, canAdd, soldOut, add, units };
}

/** Busca, categoria, ordenação e "ver mais" do catálogo, guardados na query. */
export function useCatalog(pageSize = 12) {
  const kit = useKit();
  const [params, setParams] = useSearchParams();
  const q = params.get("q") || "";
  const cat = Number(params.get("cat") || params.get("categoria") || 0) || null;
  const sort = params.get("sort") || "featured";
  const [visible, setVisible] = useState(pageSize);
  useEffect(() => setVisible(pageSize), [q, cat, sort, pageSize]);
  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (key === "cat") next.delete("categoria");
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };
  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    const out = kit.active.filter(
      (p) =>
        (!cat || p.category_id === cat) &&
        (!term || p.name.toLowerCase().includes(term) || (p.sku || "").toLowerCase().includes(term) || (p.description || "").toLowerCase().includes(term)),
    );
    const val = (p: Product) => Number(p.discount_price ?? p.price);
    if (sort === "menor") out.sort((a, b) => val(a) - val(b));
    else if (sort === "maior") out.sort((a, b) => val(b) - val(a));
    else if (sort === "nome") out.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    else out.sort((a, b) => Number(b.is_featured) - Number(a.is_featured));
    return out;
  }, [kit.active, q, cat, sort]);
  return { ...kit, q, cat, sort, setParam, list, shown: list.slice(0, visible), more: () => setVisible((v) => v + pageSize), hasMore: list.length > visible };
}

const DAYS: Record<string, [number, string]> = {
  monday: [0, "Segunda"], segunda: [0, "Segunda"], seg: [0, "Segunda"], mon: [0, "Segunda"],
  tuesday: [1, "Terça"], terca: [1, "Terça"], terça: [1, "Terça"], ter: [1, "Terça"], tue: [1, "Terça"],
  wednesday: [2, "Quarta"], quarta: [2, "Quarta"], qua: [2, "Quarta"], wed: [2, "Quarta"],
  thursday: [3, "Quinta"], quinta: [3, "Quinta"], qui: [3, "Quinta"], thu: [3, "Quinta"],
  friday: [4, "Sexta"], sexta: [4, "Sexta"], sex: [4, "Sexta"], fri: [4, "Sexta"],
  saturday: [5, "Sábado"], sabado: [5, "Sábado"], sábado: [5, "Sábado"], sab: [5, "Sábado"], sat: [5, "Sábado"],
  sunday: [6, "Domingo"], domingo: [6, "Domingo"], dom: [6, "Domingo"], sun: [6, "Domingo"],
};
/** Horários de funcionamento já formatados em pt-BR. */
export function hoursLines(hours?: Record<string, { open: string; close: string; closed: boolean }>) {
  if (!hours) return [] as { day: string; text: string }[];
  return Object.entries(hours)
    .filter(([, v]) => v && typeof v === "object")
    .sort(([a], [b]) => (DAYS[a.toLowerCase()]?.[0] ?? 99) - (DAYS[b.toLowerCase()]?.[0] ?? 99))
    .map(([k, v]) => ({ day: DAYS[k.toLowerCase()]?.[1] || k, text: v.closed ? "Fechado" : `${v.open} às ${v.close}` }));
}

export const whatsappLink = (n?: string, text?: string) =>
  n ? `https://wa.me/${n.replace(/\D/g, "")}${text ? `?text=${encodeURIComponent(text)}` : ""}` : "";

export const initials = (s: string) => (s.trim()[0] || "?").toUpperCase();
