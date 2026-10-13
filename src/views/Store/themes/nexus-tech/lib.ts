import { useLocation, useParams } from "react-router-dom";
import { buildStorePath, resolveStoreSlug } from "../../store-routing";
import type { Product, Tenant } from "../../../../types";
import { storeTracksStock } from "../../../../utils/storeStock";

export const money = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

export const imageOf = (p?: Product) => (p && ((Array.isArray(p.images) && p.images[0]) || p.image_url)) || "";

export const pricesHidden = (tenant: Tenant) => {
  const c = tenant.policies?.storefront;
  return c?.hide_prices === true || c?.checkout_mode === "order_request";
};

export const unitPrice = (p: Product) => Number(p.discount_price ?? p.price);

export const waLink = (tenant: Tenant, text?: string) =>
  `https://wa.me/${(tenant.whatsapp || "").replace(/\D/g, "")}${text ? `?text=${encodeURIComponent(text)}` : ""}`;

/** Grupos de opções do produto (atributos+skus ou variações antigas). */
export function groups(p: Product): { name: string; values: string[]; colors?: Record<string, string> }[] {
  if (Array.isArray(p.attributes) && p.attributes.length)
    return p.attributes.map((a) => ({ name: a.name, values: a.values, colors: a.colors }));
  return (p.variations || []).map((v) => ({ name: v.name, values: v.options.map((o) => o.value) }));
}

/** Estoque de uma opção considerando as demais já escolhidas (null = não controlado por opção). */
export function optionStock(p: Product, selected: Record<string, string>, name: string, value: string): number | null {
  const pick = { ...selected, [name]: value };
  if (Array.isArray(p.skus) && p.skus.length) {
    return p.skus
      .filter((s) => Object.entries(pick).every(([k, v]) => !v || s.combo?.[k] === v))
      .reduce((sum, s) => sum + (Number(s.stock) || 0), 0);
  }
  const v = p.variations?.find((x) => x.name === name)?.options.find((o) => o.value === value);
  return v ? Number(v.stock) || 0 : null;
}

export const optionDisabled = (tenant: Tenant, p: Product, selected: Record<string, string>, name: string, value: string) =>
  storeTracksStock(tenant) && optionStock(p, selected, name, value) === 0;

/** Atributos técnicos que merecem destaque (bitola, voltagem...). */
export const TECH_RE = /bitola|voltagem|tens[aã]o|amper|corrente|pot[eê]ncia|watt|se[cç][aã]o|di[aâ]metro|rosca|metragem|comprimento|polegada|curva|medida/i;
export const isTech = (name: string) => TECH_RE.test(name);

const DAY_KEYS = ["seg", "ter", "qua", "qui", "sex", "sab", "dom"];
const DAY_EN = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const DAY_LABEL = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function hoursRows(tenant: Tenant) {
  const hours = tenant.business_hours;
  if (!hours) return [];
  return Object.entries(hours)
    .map(([key, v]) => {
      const k = norm(key).slice(0, 3);
      const en = DAY_EN.indexOf(k);
      const i = en >= 0 ? en : DAY_KEYS.indexOf(k);
      return {
        order: i < 0 ? 99 : i,
        day: i < 0 ? key : DAY_LABEL[i],
        text: !v || v.closed ? "Fechado" : `${v.open} às ${v.close}`,
        closed: !v || v.closed,
      };
    })
    .sort((a, b) => a.order - b.order);
}

/** Caminhos da loja preservando o previewTheme da query. */
export function useTheme() {
  const { slug } = useParams();
  const { search } = useLocation();
  const preview = new URLSearchParams(search).get("previewTheme");
  const path = (p = "") => {
    const base = buildStorePath(resolveStoreSlug(slug), p);
    return preview ? `${base}${base.includes("?") ? "&" : "?"}previewTheme=${encodeURIComponent(preview)}` : base;
  };
  return { path, preview };
}
