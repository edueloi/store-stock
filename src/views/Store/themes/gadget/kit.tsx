import { useEffect, useMemo, useRef, useState } from "react";
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

import { HIDDEN_PRICE } from "../../../../lib/storePrice";
export const money = (value: number) =>
  value === HIDDEN_PRICE ? "Sob consulta" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

export const productImage = (p?: Product | null) => (!p ? "" : (Array.isArray(p.images) && p.images[0]) || p.image_url || "");

export const optionGroups = (p: Product) =>
  p.attributes?.length
    ? p.attributes.map((a) => ({ name: a.name, values: a.values, colors: a.colors }))
    : (p.variations || []).map((a) => ({ name: a.name, values: a.options.map((o) => o.value), colors: undefined as Record<string, string> | undefined }));

export const priceOf = (p: Product) => Number(p.discount_price ?? p.price);
export const hasDiscount = (p: Product) => p.discount_price != null && Number(p.discount_price) < Number(p.price);

export const isSoldOut = (p: Product, tenant: Tenant) => storeTracksStock(tenant) && availableUnits(p) === 0;

export const EDITORIAL_IMAGE = "/store-assets/gadget-campaign-hero-v2.jpg";

/** Aceita os links e @usuários cadastrados em Canais Sociais. */
export function socialUrl(value: string | undefined, network: "instagram" | "facebook") {
  const raw = (value || "").trim();
  if (!raw) return "";
  const domain = network === "instagram" ? "instagram.com" : "facebook.com";
  if (/^(https?:)?\/\//i.test(raw) || /^(www\.)?(instagram|facebook|fb)\.com\//i.test(raw)) {
    try {
      const url = new URL(raw.startsWith("//") ? `https:${raw}` : /^https?:/i.test(raw) ? raw : `https://${raw}`);
      const host = url.hostname.toLowerCase().replace(/^www\./, "");
      return url.protocol === "https:" || url.protocol === "http:"
        ? (host === domain || (network === "facebook" && host === "fb.com")) ? url.href : ""
        : "";
    } catch { return ""; }
  }
  const handle = raw.replace(/^@/, "").replace(/\/$/, "");
  return /^[a-zA-Z0-9._-]+$/.test(handle) ? `https://${domain}/${handle}` : "";
}

export function whatsappNumber(raw: string) {
  const digits = (raw || "").replace(/\D/g, "").replace(/^00/, "");
  return digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;
}

/** Conteúdo permanece visível sem JS e com movimento reduzido. */
export function useGadgetMotion() {
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = root.current;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!el) return;
    const shell = el.closest<HTMLElement>(".store-theme-gadget");
    if (shell) {
      const color = getComputedStyle(shell).getPropertyValue("--theme-accent").trim();
      const hex = color.replace(/^#/, "");
      const expanded = hex.length === 3 ? [...hex].map((c) => c + c).join("") : hex;
      if (/^[a-f\d]{6}$/i.test(expanded)) {
        const channels = [0, 2, 4].map((offset) => parseInt(expanded.slice(offset, offset + 2), 16) / 255).map((c) => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4);
        const luminance = channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
        shell.style.setProperty("--gd-on-accent", luminance > .179 ? "#0b0d12" : "#fff");
      }
    }
    if (reduced.matches || !window.IntersectionObserver) return;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("gd-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08 });
    el.querySelectorAll("[data-gd-reveal]").forEach((item) => observer.observe(item));
    el.classList.add("gd-motion-ready");
    const update = () => { if (reduced.matches) el.classList.remove("gd-motion-ready"); };
    reduced.addEventListener("change", update);
    return () => { observer.disconnect(); el.classList.remove("gd-motion-ready"); reduced.removeEventListener("change", update); };
  }, []);
  return root;
}

export const DAY_LABELS: Record<string, string> = { seg: "Segunda", ter: "Terça", qua: "Quarta", qui: "Quinta", sex: "Sexta", sab: "Sábado", dom: "Domingo" };
const DAY_ORDER = ["seg", "ter", "qua", "qui", "sex", "sab", "dom"];
export function hoursRows(tenant: Tenant) {
  const hours = tenant.business_hours;
  if (!hours) return [];
  return Object.entries(hours)
    .map(([key, v]) => {
      const normalized = key.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const english: Record<string, string> = { monday: "seg", tuesday: "ter", wednesday: "qua", thursday: "qui", friday: "sex", saturday: "sab", sunday: "dom" };
      const k = english[normalized] || normalized.slice(0, 3);
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
  const active = useMemo(() => store.products.filter((p) => p.is_active && p.type !== "internal"), [store.products]);
  const productPath = (p: Product) => path(`/produto/${productRouteSegment(p)}`);
  const waLink = (text?: string) =>
    store.tenant.whatsapp ? `https://wa.me/${whatsappNumber(store.tenant.whatsapp)}${text ? `?text=${encodeURIComponent(text)}` : ""}` : "";
  return { ...store, slug, path, sf, hidden, active, productPath, preview, waLink, cartCount: store.cart.reduce((s, i) => s + i.quantity, 0) };
}

/** Estado completo da página de produto (opções, galeria, quantidade, limite de estoque). */
export function useProductState() {
  const kit = useKit();
  const { productId } = useParams();
  const { active, tenant, addToCart, openCart } = kit;
  const product = active.find((p) => p.id === parseProductIdFromRoute(productId));
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

/** Categorias que realmente têm produtos ativos (com contagem), na ordem original. */
export function useUsedCategories() {
  const { categories, active } = useKit();
  return useMemo(
    () =>
      categories
        .map((c) => ({ ...c, count: active.filter((p) => p.category_id === c.id).length }))
        .filter((c) => c.count > 0),
    [categories, active],
  );
}

/** Primeira imagem disponível para ilustrar uma categoria (capa ou foto de um produto dela). */
export function categoryImage(cat: { id: number; cover_url?: string | null }, products: Product[]) {
  if (cat.cover_url) return cat.cover_url;
  const sample = products.find((p) => p.category_id === cat.id && productImage(p));
  return sample ? productImage(sample) : "";
}

/** Banners do carrossel configurados pelo lojista e função que resolve os links internos. */
export function useHero() {
  const { sf, path } = useKit();
  return {
    slides: sf.hero_slides,
    autoplay: sf.hero_autoplay_seconds ?? 6,
    resolveUrl: (u: string) => (u.startsWith("/") ? path(u) : u),
  };
}

export type SortKey = "destaques" | "menor" | "maior" | "nome";

/** Lista do catálogo: busca (?q=), categoria (?categoria=), ordenação (?sort=) e "mostrar mais". */
export function useCatalogList(pageSize = 12) {
  const kit = useKit();
  const query = useCatalogQuery();
  const [params, setParams] = useSearchParams();
  const sort = (params.get("sort") as SortKey) || "destaques";
  const [visible, setVisible] = useState(pageSize);
  useEffect(() => setVisible(pageSize), [query.q, query.category, sort, pageSize]);
  const setSort = (value: SortKey) => {
    const next = new URLSearchParams(params);
    if (value === "destaques") next.delete("sort");
    else next.set("sort", value);
    setParams(next, { replace: true });
  };
  const list = useMemo(() => {
    const term = query.q.trim().toLowerCase();
    const out = kit.active.filter(
      (p) => (!query.category || p.category_id === query.category) && (!term || `${p.name} ${p.sku || ""} ${p.description || ""}`.toLowerCase().includes(term)),
    );
    if (!kit.hidden && sort === "menor") out.sort((a, b) => priceOf(a) - priceOf(b));
    else if (!kit.hidden && sort === "maior") out.sort((a, b) => priceOf(b) - priceOf(a));
    else if (sort === "nome") out.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    else out.sort((a, b) => Number(b.is_featured) - Number(a.is_featured));
    return out;
  }, [kit.active, kit.hidden, query.q, query.category, sort]);
  return { ...kit, ...query, sort, setSort, list, shown: list.slice(0, visible), more: () => setVisible((v) => v + pageSize), hasMore: list.length > visible };
}

export function formatPhone(raw: string) {
  const d = String(raw || "").replace(/\D/g, "").replace(/^00/, "").replace(/^55(?=\d{10,11}$)/, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return raw;
}

export function shorten(text: string, max: number) {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const stop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  return stop > max * 0.5 ? cut.slice(0, stop + 1) : `${cut.slice(0, cut.lastIndexOf(" "))}…`;
}

export const discountPct = (p: Product) => (hasDiscount(p) ? Math.round((1 - priceOf(p) / Number(p.price)) * 100) : 0);

/** Ranking por unidades vendidas; só exibe produtos com vendas concluídas. */
export function useBestsellers(limit?: number) {
  const { active, tenant } = useKit();
  return useMemo(() => {
    const size = limit || tenant.bestseller_limit || 8;
    const sold = active.filter((p) => (p.sold_count || 0) > 0).sort((a, b) => (b.sold_count || 0) - (a.sold_count || 0));
    return { items: sold.slice(0, size), ranked: sold.length > 0 };
  }, [active, tenant.bestseller_limit, limit]);
}

/** Ficha técnica: linhas "Chave: valor" viram tabela; o que não tiver ":" fica como texto livre. */
export function parseSpecs(text?: string | null) {
  const rows: { key: string; value: string }[] = [];
  const notes: string[] = [];
  for (const raw of String(text || "").split(/\n+/)) {
    const line = raw.replace(/^[\s•\-–*]+/, "").trim();
    if (!line) continue;
    const i = line.indexOf(":");
    if (i > 0 && i < 40 && line.slice(i + 1).trim()) rows.push({ key: line.slice(0, i).trim(), value: line.slice(i + 1).trim() });
    else notes.push(line);
  }
  return { rows, notes };
}
