import { useStore } from "../../StoreLayout";
import { availableUnits, storeTracksStock } from "../../../../utils/storeStock";
import type { Product } from "../../../../types";
import { groups, productImage, useKit } from "./kit";

/** Adição rápida pela vitrine: só para produtos sem opções e com saldo. */
export function useQuickAdd() {
  const { cart, tenant, addToCart } = useStore();
  const tracks = storeTracksStock(tenant);
  return (p: Product) => {
    const hasOptions = groups(p).length > 0;
    const units = tracks ? availableUnits(p) : null;
    const inCart = cart.filter((i) => i.id === p.id).reduce((s, i) => s + i.quantity, 0);
    const soldOut = units !== null && units - inCart <= 0;
    return { hasOptions, soldOut, add: () => !hasOptions && !soldOut && addToCart(p) };
  };
}

export const whatsappLink = (n?: string, text?: string) =>
  n ? `https://wa.me/${n.replace(/\D/g, "")}${text ? `?text=${encodeURIComponent(text)}` : ""}` : "";

/** Categorias com produto ativo, já com os itens, a contagem e uma foto de capa. */
export function useShelves() {
  const { categories, active } = useKit();
  return categories
    .map((c) => {
      const items = active.filter((p) => p.category_id === c.id);
      return { ...c, items, count: items.length, cover: c.cover_url || productImage(items.find((p) => productImage(p))) };
    })
    .filter((c) => c.count > 0);
}
