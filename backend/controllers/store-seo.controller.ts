import type { Request, Response } from "express";

import { prisma } from "../config/prisma";
import { getTenantAccessState } from "../utils/tenant-access";
import { resolveTenantLookupFromRequest } from "../utils/tenant-domain";
import { parseProductIdFromRoute } from "../utils/product-slug";
import { escapeHtml, escapeJsonForScriptTag } from "../utils/html-escape";

let cachedTemplate: string | null = null;

type SeoPage = "home" | "catalog" | "about";

export function initStoreSeoTemplate(html: string) {
  cachedTemplate = html;
}

function baseUrl(req: Request) {
  // Na VPS o Node recebe a conexão interna em HTTP, mas o visitante acessa HTTPS
  // pelo proxy. Usar o header evita sitemap/canonical com protocolo incorreto.
  const forwarded = req.headers["x-forwarded-proto"];
  const forwardedProtocol = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(",")[0]?.trim();
  const protocol = forwardedProtocol === "https" || req.protocol === "https" ? "https" : req.protocol;
  return `${protocol}://${req.headers.host}`;
}

function storePath(req: Request, suffix = "") {
  const slug = typeof req.params.slug === "string" ? req.params.slug : "";
  return `${baseUrl(req)}${slug ? `/s/${encodeURIComponent(slug)}` : ""}${suffix}`;
}

function absoluteUrl(req: Request, pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const normalized = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  return `${baseUrl(req)}${normalized}`;
}

function fmtPrice(value: unknown): string {
  return Number(value ?? 0).toFixed(2);
}

function asImageList(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((value): value is string => typeof value === "string" && value.length > 0) : [];
}

function fallback(req: Request, res: Response) {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  // O HTML base é o painel/SPA. Ele não deve competir com as lojas públicas nos buscadores.
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  res.send(cachedTemplate ?? "");
}

async function findPublicTenant(req: Request) {
  const tenantLookup = resolveTenantLookupFromRequest(req);
  if (!tenantLookup) return null;

  const tenant = await prisma.tenant.findFirst({
    where: { OR: [{ slug: tenantLookup }, { subdomain: tenantLookup }] },
  });
  if (!tenant || !getTenantAccessState(tenant).allowed) return null;
  return tenant;
}

function renderSeoPage(res: Response, options: {
  title: string;
  description: string;
  canonicalUrl: string;
  siteName: string;
  image?: string;
  type?: "website" | "product";
  jsonLd: object;
  price?: string;
}) {
  if (!cachedTemplate) {
    res.status(503).send("Serviço temporariamente indisponível.");
    return;
  }

  const image = options.image || "";
  const title = escapeHtml(options.title);
  const description = escapeHtml(options.description.slice(0, 300));
  const canonicalUrl = escapeHtml(options.canonicalUrl);
  const type = options.type ?? "website";
  const priceTags = type === "product" && options.price
    ? `<meta property="product:price:amount" content="${options.price}" />
    <meta property="product:price:currency" content="BRL" />`
    : "";
  const imageTags = image
    ? `<meta property="og:image" content="${escapeHtml(image)}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:image" content="${escapeHtml(image)}" />`
    : "";
  const metaBlock = `
    <meta name="description" content="${description}" />
    <meta name="robots" content="index, follow, max-image-preview:large" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:url" content="${canonicalUrl}" />
    <meta property="og:type" content="${type}" />
    <meta property="og:site_name" content="${escapeHtml(options.siteName)}" />
    <meta property="og:locale" content="pt_BR" />
    ${imageTags}
    ${priceTags}
    <meta name="twitter:card" content="${image ? "summary_large_image" : "summary"}" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <link rel="canonical" href="${canonicalUrl}" />
    <script type="application/ld+json">${escapeJsonForScriptTag(JSON.stringify(options.jsonLd))}</script>`;

  const html = cachedTemplate
    .replace(/<title>.*?<\/title>/i, `<title>${title}</title>`)
    .replace(/<meta name="robots" content="[^"]*"\s*\/?>/i, "")
    .replace(/<meta property="og:type" content="[^"]*"\s*\/?>/i, "")
    .replace(/<meta name="twitter:card" content="[^"]*"\s*\/?>/i, "")
    .replace("</head>", `${metaBlock}\n  </head>`);

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  // A página pública aponta para arquivos JS/CSS com hash do build atual.
  // Cachear o HTML aqui faz o cliente abrir uma vitrine antiga mesmo depois do deploy.
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.send(html);
}

function productSeoUrl(req: Request) {
  const slug = typeof req.params.slug === "string" ? req.params.slug : "";
  return `${baseUrl(req)}${slug ? `/s/${encodeURIComponent(slug)}` : ""}/produto/${encodeURIComponent(req.params.productId)}`;
}

function productSegment(product: { id: number; name: string }) {
  const name = product.name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return name ? `${name}-${product.id}` : String(product.id);
}

export async function handleProductSeo(req: Request, res: Response) {
  try {
    const tenant = await findPublicTenant(req);
    const productId = parseProductIdFromRoute(req.params.productId);
    if (!tenant || productId === null) { fallback(req, res); return; }

    const product = await prisma.product.findFirst({
      where: { id: productId, tenant_id: tenant.id, is_active: true },
      include: { category: { select: { name: true } } },
    });
    if (!product) { fallback(req, res); return; }

    const rawImage = asImageList(product.images)[0] || product.image_url || tenant.banner_url || tenant.logo_url || "";
    const image = rawImage ? absoluteUrl(req, rawImage) : "";
    const canonicalUrl = productSeoUrl(req);
    const price = fmtPrice(product.discount_price || product.price);
    const description = product.description || `Compre ${product.name} na ${tenant.name}. Produto disponível com atendimento direto.`;
    const inStock = tenant.sell_without_stock_control || Number(product.stock_quantity) > 0;

    renderSeoPage(res, {
      title: `${product.name} | ${tenant.name}`,
      description,
      canonicalUrl,
      siteName: tenant.name,
      image,
      type: "product",
      price,
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "Product",
        name: product.name,
        description,
        image: image ? [image] : [],
        sku: product.sku || String(product.id),
        ...(product.category ? { category: product.category.name } : {}),
        brand: { "@type": "Brand", name: tenant.name },
        offers: {
          "@type": "Offer",
          url: canonicalUrl,
          priceCurrency: "BRL",
          price,
          itemCondition: "https://schema.org/NewCondition",
          availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
          seller: { "@type": "Organization", name: tenant.name },
        },
      },
    });
  } catch {
    fallback(req, res);
  }
}

function getPage(req: Request): SeoPage {
  const path = req.path.replace(/\/+$/, "") || "/";
  if (path.endsWith("/catalogo") || path === "/catalogo") return "catalog";
  if (path.endsWith("/sobre") || path === "/sobre") return "about";
  return "home";
}

export async function handleStoreSeo(req: Request, res: Response) {
  try {
    const tenant = await findPublicTenant(req);
    if (!tenant) { fallback(req, res); return; }

    const page = getPage(req);
    const categories = await prisma.category.findMany({
      where: { tenant_id: tenant.id }, orderBy: { name: "asc" }, select: { name: true }, take: 12,
    });
    const categoryNames = categories.map((category) => category.name).join(", ");
    const canonicalUrl = storePath(req, page === "catalog" ? "/catalogo" : page === "about" ? "/sobre" : "");
    const defaultDescription = categoryNames
      ? `${tenant.name}: ${categoryNames}. Confira produtos, novidades e atendimento direto.`
      : `Loja online ${tenant.name}. Confira produtos, novidades e atendimento direto.`;
    const details: Record<SeoPage, { title: string; description: string; type: string }> = {
      home: {
        title: `${tenant.name} | Loja online`,
        description: tenant.hero_tagline || tenant.about_text || defaultDescription,
        type: "Store",
      },
      catalog: {
        title: `Catálogo | ${tenant.name}`,
        description: `Catálogo da ${tenant.name}. ${categoryNames ? `Explore: ${categoryNames}.` : "Veja todos os produtos disponíveis."}`,
        type: "CollectionPage",
      },
      about: {
        title: `Sobre a ${tenant.name}`,
        description: tenant.about_text || `Conheça a ${tenant.name}, seus produtos e formas de atendimento.`,
        type: "AboutPage",
      },
    };
    const current = details[page];
    const rawImage = tenant.banner_url || tenant.logo_url || "";
    const image = rawImage ? absoluteUrl(req, rawImage) : "";
    const socialProfiles = [
      tenant.instagram_url ? `https://instagram.com/${tenant.instagram_url.replace("@", "")}` : undefined,
      tenant.facebook_url ? `https://facebook.com/${tenant.facebook_url}` : undefined,
    ].filter(Boolean);

    const schema: Record<string, unknown> = {
      "@context": "https://schema.org",
      "@type": current.type,
      name: tenant.name,
      description: current.description,
      url: canonicalUrl,
      ...(image ? { image } : {}),
      ...(tenant.whatsapp ? { telephone: `+${tenant.whatsapp.replace(/\D/g, "")}` } : {}),
      ...(tenant.address ? { address: { "@type": "PostalAddress", streetAddress: tenant.address } } : {}),
      ...(socialProfiles.length ? { sameAs: socialProfiles } : {}),
    };
    if (page === "home") {
      schema.potentialAction = {
        "@type": "SearchAction",
        target: `${storePath(req, "/catalogo")}?q={search_term_string}`,
        "query-input": "required name=search_term_string",
      };
    }

    renderSeoPage(res, {
      title: current.title,
      description: current.description,
      canonicalUrl,
      siteName: tenant.name,
      image,
      jsonLd: schema,
    });
  } catch {
    fallback(req, res);
  }
}

export async function handleStoreSitemap(req: Request, res: Response) {
  try {
    const tenant = await findPublicTenant(req);
    if (!tenant) { res.status(404).type("text").send("Loja não encontrada"); return; }

    const products = await prisma.product.findMany({
      where: { tenant_id: tenant.id, is_active: true },
      select: { id: true, name: true, updated_at: true },
      orderBy: { updated_at: "desc" },
      take: 10_000,
    });
    const urls = [
      { loc: storePath(req), lastmod: undefined },
      { loc: storePath(req, "/catalogo"), lastmod: undefined },
      { loc: storePath(req, "/sobre"), lastmod: undefined },
      ...products.map((product) => ({
        loc: storePath(req, `/produto/${productSegment(product)}`),
        lastmod: product.updated_at.toISOString().slice(0, 10),
      })),
    ];
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((url) => `  <url><loc>${escapeHtml(url.loc)}</loc>${url.lastmod ? `<lastmod>${url.lastmod}</lastmod>` : ""}</url>`).join("\n")}\n</urlset>`;
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=900");
    res.send(xml);
  } catch {
    res.status(500).type("text").send("Não foi possível gerar o sitemap");
  }
}

export async function handleStoreRobots(req: Request, res: Response) {
  try {
    const tenant = await findPublicTenant(req);
    if (!tenant) { res.status(404).type("text").send("User-agent: *\nDisallow: /"); return; }
    res.type("text/plain").send(`User-agent: *\nAllow: /\n\nSitemap: ${storePath(req, "/sitemap.xml")}\n`);
  } catch {
    res.status(500).type("text").send("User-agent: *\nDisallow: /");
  }
}
