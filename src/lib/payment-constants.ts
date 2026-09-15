export type CardBrand = "visa" | "master" | "elo" | "amex" | "hiper" | "other";

export const CARD_BRANDS: { key: CardBrand; label: string; color: string }[] = [
  { key: "visa",   label: "Visa",       color: "#1A1F71" },
  { key: "master", label: "Mastercard", color: "#EB001B" },
  { key: "elo",    label: "Elo",        color: "#00A4E0" },
  { key: "amex",   label: "Amex",       color: "#2E77BC" },
  { key: "hiper",  label: "Hipercard",  color: "#B22222" },
  { key: "other",  label: "Outra",      color: "#64748b" },
];
