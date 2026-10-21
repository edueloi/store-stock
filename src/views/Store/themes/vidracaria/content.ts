import type { Tenant, VitraContent } from "../../../../types";

export const VITRA_BACKGROUND = "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1800&q=85";
export const VITRA_STEPS = [
  { title: "Escolha no catálogo", text: "Selecione os produtos e as opções disponíveis para cada peça." },
  { title: "Conte o que você precisa", text: "Informe as medidas nos produtos sob medida. Se precisar, solicite orientação da loja." },
  { title: "Envie para a nossa equipe", text: "Recebemos seu projeto para conferir os detalhes e preparar o orçamento." },
];

/** Ausente mantém o padrão; texto vazio oculta o texto; false oculta a seção. */
export function vitraContent(tenant: Pick<Tenant, "name" | "about_text" | "footer_text" | "hero_tagline" | "banner_url" | "policies">): Required<VitraContent> {
  const sf = tenant.policies?.storefront || {};
  const gallery = sf.glass_gallery?.filter(s => s.image) || [];
  const defaults: Required<VitraContent> = {
    show_hero: true, show_catalog_count: true,
    hero_eyebrow: tenant.hero_tagline || "Conheça nossa loja",
    hero_catalog_button: "Conhecer o catálogo", hero_project_button: "Montar meu projeto",
    show_intro: true, intro_title: "Para cada ambiente,\numa nova possibilidade.",
    intro_text: "Explore os produtos, confira os detalhes e escolha as soluções que combinam com o seu projeto.", intro_button: "Ver todos os produtos",
    show_categories: true, categories_eyebrow: "Encontre sua solução",
    show_featured: true, featured_eyebrow: "Seleção do catálogo",
    show_process: true, process_eyebrow: "Da ideia ao orçamento", process_title: "Você imagina.\nA gente começa\npelas medidas.", process_steps: VITRA_STEPS,
    show_gallery: true, gallery_title: gallery.length ? "O vidro em novas perspectivas." : "Direto do nosso catálogo.", gallery_eyebrow: gallery.length ? "Projetos e ambientes" : "Conheça de perto", gallery_use_products: true,
    show_closing: true, closing_eyebrow: tenant.name, closing_title: "Seu próximo projeto\ncomeça com\numa boa escolha.", closing_button: sf.glass_quote_enabled === true ? "Solicitar meu orçamento" : "Explorar o catálogo", closing_image: gallery[0]?.image || tenant.banner_url || VITRA_BACKGROUND,
    footer_tagline: tenant.hero_tagline || "", footer_description: tenant.footer_text || tenant.about_text || "", footer_note: "", footer_show_categories: true, footer_show_contact: true,
  };
  const saved = sf.glass_content;
  if (!saved || typeof saved !== "object") return defaults;
  const result = { ...defaults };
  for (const key of Object.keys(defaults) as Array<keyof VitraContent>) {
    const value = saved[key];
    if (key === "process_steps") {
      if (Array.isArray(value)) result.process_steps = value.slice(0, 3).filter(s => s && typeof s.title === "string" && typeof s.text === "string");
    } else if (typeof value === typeof defaults[key]) {
      (result as any)[key] = value;
    }
  }
  return result;
}
