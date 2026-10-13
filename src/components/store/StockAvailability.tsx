import { availableUnits, storeTracksStock } from "../../utils/storeStock";
import type { Product, Tenant } from "../../types";

/** Aviso de unidades disponíveis para qualquer tema; some em lojas sem controle de estoque. */
export default function StockAvailability({ product, tenant, selected, className = "" }: {
  product: Product;
  tenant: Tenant;
  selected?: Record<string, string>;
  className?: string;
}) {
  if (!storeTracksStock(tenant)) return null;
  const units = availableUnits(product, selected);
  if (units === null) return null;
  const tone = units === 0 ? "bg-red-50 text-red-700 border-red-200" : units <= 5 ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-emerald-50 text-emerald-700 border-emerald-200";
  const label = units === 0 ? "Esgotado" : units <= 5 ? `Últimas ${units} ${units === 1 ? "unidade" : "unidades"}` : `${units} unidades disponíveis`;
  return <p role="status" className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${tone} ${className}`}>{label}</p>;
}
