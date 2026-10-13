import { lazy, type ComponentType, type LazyExoticComponent } from "react";

/**
 * Temas com identidade própria: cada pasta em `themes/<id-com-hifen>/` pode ter
 * StoreFront/StoreCatalog/StoreProduct/StoreAbout e, opcionalmente, Chrome.tsx
 * (exporta `Header` e `Footer`). O que existir na pasta passa a ser usado no lugar
 * do layout compartilhado; o que não existir segue no fallback antigo.
 */
const pageLoaders = import.meta.glob("./*/Store{Front,Catalog,Product,About}.tsx") as Record<string, () => Promise<{ default: ComponentType }>>;
const chromeLoaders = import.meta.glob("./*/Chrome.tsx") as Record<string, () => Promise<{ Header?: ComponentType; Footer?: ComponentType }>>;

export const themeFolder = (templateId: string) => templateId.replace(/_/g, "-");

export type OwnPages = Partial<Record<"Front" | "Catalog" | "Product" | "About", LazyExoticComponent<ComponentType>>>;

/** Páginas próprias do tema (apenas as que existem na pasta). */
export function ownPages(templateId: string): OwnPages {
  const folder = themeFolder(templateId);
  const out: OwnPages = {};
  for (const [key, file] of [["Front", "StoreFront"], ["Catalog", "StoreCatalog"], ["Product", "StoreProduct"], ["About", "StoreAbout"]] as const) {
    const loader = pageLoaders[`./${folder}/${file}.tsx`];
    if (loader) out[key] = lazy(loader);
  }
  return out;
}

/** Cabeçalho e rodapé próprios do tema, quando existir `Chrome.tsx`. */
export function ownChrome(templateId: string) {
  const loader = chromeLoaders[`./${themeFolder(templateId)}/Chrome.tsx`];
  if (!loader) return null;
  return {
    Header: lazy(() => loader().then((m) => ({ default: m.Header || (() => null) }))),
    Footer: lazy(() => loader().then((m) => ({ default: m.Footer || (() => null) }))),
  };
}
