const headingKeys = [
  "catalog_title", "home_categories_title", "home_featured_title", "glass_hero_title",
  "about_title", "cart_title", "hero_button_label", "segment_label",
];
const glassHeadingKeys = [
  "hero_eyebrow", "hero_catalog_button", "hero_project_button", "intro_title", "intro_button",
  "categories_eyebrow", "featured_eyebrow", "process_eyebrow", "process_title",
  "gallery_title", "gallery_eyebrow", "closing_eyebrow", "closing_title", "closing_button",
  "footer_tagline",
];
const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const isEmail = (value: unknown) => typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

function cleanHeadings(record: Record<string, unknown>, keys: string[]) {
  let result = record;
  for (const key of keys) {
    if (!isEmail(record[key])) continue;
    if (result === record) result = { ...record };
    delete result[key];
  }
  return result;
}

/** Discards standalone email addresses accidentally saved as storefront headings.
 * Contact emails and prose are intentional content and remain unchanged.
 * Removing the key restores the theme default; explicit empty text stays empty.
 */
export function sanitizeStorefrontHeadings<T>(policies: T): T {
  if (!isRecord(policies) || !isRecord(policies.storefront)) return policies;
  const original = policies.storefront;
  let storefront = cleanHeadings(original, headingKeys);
  if (isRecord(original.glass_content)) {
    const content = cleanHeadings(original.glass_content, glassHeadingKeys);
    if (content !== original.glass_content) storefront = { ...storefront, glass_content: content };
  }
  return storefront === original ? policies : { ...policies, storefront };
}
