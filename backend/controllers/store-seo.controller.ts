import type { Request, Response } from "express";

import { prisma } from "../config/prisma";
import { getTenantAccessState } from "../utils/tenant-access";
import { resolveTenantLookupFromRequest } from "../utils/tenant-domain";
import { parseProductIdFromRoute } from "../utils/product-slug";
import { escapeHtml, escapeJsonForScriptTag } from "../utils/html-escape";

let cachedTemplate: string | null = null;

export function initStoreSeoTemplate(html: string) {
  cachedTemplate = html;
}

function absoluteUrl(req: Request, pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const normalized = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  return `${req.protocol}://${req.headers.host}${normalized}`;
}

function fmtPrice(value: unknown): string {
  return Number(value ?? 0).toFixed(2);
}

export async function handleProductSeo(req: Request, res: Response) {
  const fallback = () => {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(cachedTemplate ?? "");
  };

  try {
    if (!cachedTemplate) {
      fallback();
      return;
    }

    const tenantLookup = resolveTenantLookupFromRequest(req);
    if (!tenantLookup) {
      fallback();
      return;
    }

    const tenant = await prisma.tenant.findFirst({
      where: { OR: [{ slug: tenantLookup }, { subdomain: tenantLookup }] },
    });
    if (!tenant) {
      fallback();
      return;
    }

    const accessState = getTenantAccessState(tenant);
    if (!accessState.allowed) {
      fallback();
      return;
    }

    const productId = parseProductIdFromRoute(req.params.productId);
    if (productId === null) {
      fallback();
      return;
    }

    const product = await prisma.product.findFirst({
      where: { id: productId, tenant_id: tenant.id, is_active: true },
    });
    if (!product) {
      fallback();
      return;
    }

    const images = Array.isArray(product.images) ? (product.images as string[]) : [];
    const rawImage = images[0] || product.image_url || tenant.logo_url || "";
    const ogImage = rawImage ? absoluteUrl(req, rawImage) : "";

    const canonicalUrl = `${req.protocol}://${req.headers.host}${req.originalUrl}`;
    const price = fmtPrice(product.discount_price || product.price);
    const title = escapeHtml(`${product.name} — ${tenant.name}`);
    const description = escapeHtml(
      product.description ||
        `Compre ${product.name} na ${tenant.name}. R$ ${price}. Atendimento via WhatsApp.`
    );

    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "Product",
      name: product.name,
      description: product.description || product.name,
      image: ogImage ? [ogImage] : [],
      sku: product.sku || String(product.id),
      brand: { "@type": "Brand", name: tenant.name },
      offers: {
        "@type": "Offer",
        url: canonicalUrl,
        priceCurrency: "BRL",
        price,
        itemCondition: "https://schema.org/NewCondition",
        availability: "https://schema.org/InStock",
        seller: { "@type": "Organization", name: tenant.name },
      },
    };

    const metaBlock = `
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
    <meta property="og:type" content="product" />
    ${ogImage ? `<meta property="og:image" content="${escapeHtml(ogImage)}" />\n    <meta property="og:image:width" content="1200" />\n    <meta property="og:image:height" content="630" />` : ""}
    <meta property="og:price:amount" content="${price}" />
    <meta property="og:price:currency" content="BRL" />
    <meta property="product:price:amount" content="${price}" />
    <meta property="product:price:currency" content="BRL" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    ${ogImage ? `<meta name="twitter:image" content="${escapeHtml(ogImage)}" />` : ""}
    <meta name="twitter:card" content="${ogImage ? "summary_large_image" : "summary"}" />
    <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
    <script type="application/ld+json">${escapeJsonForScriptTag(JSON.stringify(jsonLd))}</script>
  `;

    let html = cachedTemplate
      .replace(/<title>.*?<\/title>/i, `<title>${title}</title>`)
      .replace(/<meta property="og:type" content="[^"]*"\s*\/?>/i, "")
      .replace(/<meta name="twitter:card" content="[^"]*"\s*\/?>/i, "");

    html = html.replace("</head>", `${metaBlock}\n  </head>`);

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=300");
    res.send(html);
  } catch {
    fallback();
  }
}
