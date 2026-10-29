import {
  Beer, Candy, Cookie, CupSoda, Martini, ShoppingBasket, Snowflake, UtensilsCrossed, Wine, Zap, type LucideIcon,
} from "lucide-react";

export type Route = "delivery" | "mesa" | "balcao";
export type Receive = "delivery" | "pickup";
export type PayMethod = "pix" | "money" | "card";
export type OrderMode = "delivery" | "pickup" | "mesa" | "balcao";

export interface MenuProduct {
  id: number;
  name: string;
  description?: string | null;
  price: number | string;
  discount_price?: number | string | null;
  image_url?: string | null;
  images?: unknown;
  category_id?: number | null;
  stock_quantity: number;
  track_stock?: boolean;
  is_featured?: boolean;
  sold_count?: number;
}
export interface MenuCategory { id: number; name: string }
export interface MenuConfig {
  accepts?: { mesa?: boolean; balcao?: boolean; delivery?: boolean; pickup?: boolean };
  delivery?: {
    fee_mode?: "fixed" | "neighborhood" | "distance";
    origin_cep?: string;
    tiers?: Array<{ km?: number; fee?: number }>;
    fixed_fee?: number;
    free_above?: number;
    min_order?: number;
    neighborhoods?: Array<{ name?: string; fee?: number }>;
    eta?: string;
  };
  pickup_eta?: string;
  payments?: { pix?: boolean; money?: boolean; card?: boolean };
}
export type Hours = Record<string, { open: string; close: string; closed: boolean }>;
export interface MenuTenant {
  id: number;
  name: string;
  whatsapp: string;
  logo_url?: string | null;
  banner_url?: string | null;
  hero_tagline?: string | null;
  about_text?: string | null;
  address_street?: string | null;
  address_number?: string | null;
  address_district?: string | null;
  address_city?: string | null;
  primary_color?: string | null;
  template_id?: string | null;
  business_hours?: Hours | null;
  food_enabled?: boolean;
  sell_without_stock_control?: boolean;
  policies?: { menu?: MenuConfig } | null;
}
export interface CartLine { key: string; product_id: number; name: string; price: number; qty: number; note: string }
export interface PastOrder { id: string; label: string; total: number; at: number }
export interface MenuSection { id: string; name: string; items: MenuProduct[] }

export const money = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;
export const unitPrice = (p: MenuProduct) => Number(p.discount_price ?? p.price);
export const imageOf = (p: MenuProduct): string | null => {
  if (p.image_url) return p.image_url;
  const first = Array.isArray(p.images) ? p.images[0] : null;
  return typeof first === "string" ? first : first && typeof first === "object" && "url" in (first as object) ? String((first as { url: unknown }).url) : null;
};

// Ícone e cor por tipo de categoria (adega/conveniência); o resto cai no talher.
const CAT_STYLES: { re: RegExp; icon: LucideIcon; tint: string; fg: string }[] = [
  { re: /cerveja|chopp|lager|\bipa\b/i, icon: Beer, tint: "#fdf0c8", fg: "#b7791f" },
  { re: /destilad|whisk|vodka|\bgin\b|cacha|licor|\brum\b|tequila|drink/i, icon: Martini, tint: "#fde3d3", fg: "#c2410c" },
  { re: /vinho|espumante|champ/i, icon: Wine, tint: "#fbdfe7", fg: "#be123c" },
  { re: /energ/i, icon: Zap, tint: "#e4e8ff", fg: "#4338ca" },
  { re: /refriger|suco|[áa]gua|bebida/i, icon: CupSoda, tint: "#dcf2fb", fg: "#0369a1" },
  { re: /gelo|carv/i, icon: Snowflake, tint: "#dcf5f6", fg: "#0e7490" },
  { re: /bombon|doce|choco|bala/i, icon: Candy, tint: "#fde1f0", fg: "#be185d" },
  { re: /salgad|petisc|snack/i, icon: Cookie, tint: "#fdebd0", fg: "#b45309" },
  { re: /conveni/i, icon: ShoppingBasket, tint: "#e6e9ef", fg: "#475569" },
];
export const catStyle = (name?: string | null): { icon: LucideIcon; tint: string; fg: string } =>
  CAT_STYLES.find((st) => st.re.test(name || "")) ?? { icon: UtensilsCrossed, tint: "#efeafb", fg: "#7c6bc4" };

const DAY_KEYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"];
export const DAY_ORDER = ["seg", "ter", "qua", "qui", "sex", "sab", "dom"];
export const DAY_LABEL: Record<string, string> = { seg: "Segunda", ter: "Terça", qua: "Quarta", qui: "Quinta", sex: "Sexta", sab: "Sábado", dom: "Domingo" };
const toMin = (t: string) => { const [h, m] = String(t).split(":").map(Number); return (h || 0) * 60 + (m || 0); };
export function openStatus(hours?: Hours | null): { open: boolean; text: string } | null {
  if (!hours) return null;
  const today = hours[DAY_KEYS[new Date().getDay()]];
  if (!today) return null;
  if (today.closed) return { open: false, text: "Fechado hoje" };
  const now = new Date().getHours() * 60 + new Date().getMinutes();
  const o = toMin(today.open), c = toMin(today.close);
  const open = c > o ? now >= o && now < c : now >= o || now < c;
  return { open, text: `${today.open}–${today.close}` };
}

export const sstore = {
  get: (k: string) => { try { return sessionStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { sessionStorage.setItem(k, v); } catch { /* ok */ } },
};
export const lstore = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* ok */ } },
};
