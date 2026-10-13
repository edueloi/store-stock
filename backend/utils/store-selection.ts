/** Keep the customer's valid catalogue choices on an order item, without a schema change. */
export function storeSelectionLabel(
  product: { attributes?: unknown; variations?: unknown },
  input: unknown,
): string | null | false {
  // Older storefronts do not send this field.
  if (input === undefined || input === null) return null;
  if (typeof input !== 'object' || Array.isArray(input)) return false;
  const attributes = Array.isArray(product.attributes) && product.attributes.length
    ? product.attributes.map(a => ({ name: a.name, values: a.values }))
    : Array.isArray(product.variations)
      ? product.variations.map(a => ({ name: a.name, values: Array.isArray(a.options) ? a.options.map((o: { value: string }) => o.value) : [] }))
      : [];
  const selected = input as Record<string, unknown>;
  if (Object.keys(selected).some(key => !attributes.some(a => a.name === key))) return false;
  if (attributes.some(a => typeof selected[a.name] !== 'string' || !Array.isArray(a.values) || !a.values.includes(selected[a.name]))) return false;
  const label = attributes.map(a => `${a.name}: ${selected[a.name]}`).join(' · ');
  return label.length > 1000 ? false : label || null;
}
