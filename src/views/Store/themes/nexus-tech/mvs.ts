export const MVS_ART = {
  home: "/store-assets/mvs/home-solutions-hero-v1.webp",
  work: "/store-assets/mvs/practical-tools-hero-v1.webp",
  mobile: "/store-assets/mvs/home-solutions-mobile-v1.webp",
};
export const isMvs = (tenant: { policies?: { storefront?: { brand_identity?: string } } | null }) => tenant.policies?.storefront?.brand_identity === "mvs";
export const normalizeMvsText = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
