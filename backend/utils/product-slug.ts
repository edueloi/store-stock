export function parseProductIdFromRoute(productId: string | undefined | null): number | null {
  if (!productId) return null;
  const match = productId.match(/(\d+)$/);
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isFinite(id) ? id : null;
}
