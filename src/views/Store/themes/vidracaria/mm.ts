export const isMmGlass = (tenant: { policies?: { storefront?: { brand_identity?: string } } | null }) => tenant.policies?.storefront?.brand_identity === "mm-glass";

/** Contato brasileiro sem alterar o número salvo pela loja. */
export function mmContactNumber(raw?: string | null) {
  const digits = (raw || "").replace(/\D/g, "");
  return digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;
}
