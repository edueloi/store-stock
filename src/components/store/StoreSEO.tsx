import { useEffect } from "react";

interface StoreSEOProps {
  title: string;
  description?: string;
  image?: string;
  url?: string;
  type?: "website" | "product";
  price?: string;
  siteName?: string;
  jsonLd?: object;
  keywords?: string;
}

function setMeta(property: string, content: string, useProperty = false) {
  const attr = useProperty ? "property" : "name";
  let el = document.querySelector<HTMLMetaElement>(`meta[${attr}="${property}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, property);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setJsonLd(id: string, data: object) {
  let el = document.querySelector<HTMLScriptElement>(`script[data-seo-id="${id}"]`);
  if (!el) {
    el = document.createElement("script");
    el.setAttribute("type", "application/ld+json");
    el.setAttribute("data-seo-id", id);
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
}

function removeJsonLd(id: string) {
  document.querySelector(`script[data-seo-id="${id}"]`)?.remove();
}

export default function StoreSEO({
  title,
  description,
  image,
  url,
  type = "website",
  price,
  siteName,
  jsonLd,
  keywords,
}: StoreSEOProps) {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = title;

    if (description) {
      setMeta("description", description);
      setMeta("og:description", description, true);
      setMeta("twitter:description", description);
    }

    if (keywords) setMeta("keywords", keywords);

    setMeta("og:title", title, true);
    setMeta("og:type", type === "product" ? "product" : "website", true);
    setMeta("twitter:title", title);
    setMeta("twitter:card", image ? "summary_large_image" : "summary");
    setMeta("robots", "index, follow");

    if (url) {
      setMeta("og:url", url, true);
      let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
      if (!canonical) {
        canonical = document.createElement("link");
        canonical.setAttribute("rel", "canonical");
        document.head.appendChild(canonical);
      }
      canonical.setAttribute("href", url);
    }

    if (image) {
      setMeta("og:image", image, true);
      setMeta("og:image:width", "1200", true);
      setMeta("og:image:height", "630", true);
      setMeta("twitter:image", image);
    }

    if (siteName) {
      setMeta("og:site_name", siteName, true);
      setMeta("twitter:site", siteName);
    }

    if (type === "product" && price) {
      setMeta("og:price:amount", price, true);
      setMeta("og:price:currency", "BRL", true);
      setMeta("product:price:amount", price, true);
      setMeta("product:price:currency", "BRL", true);
    }

    if (jsonLd) {
      setJsonLd("store-page", jsonLd);
    }

    return () => {
      document.title = prevTitle;
      if (jsonLd) removeJsonLd("store-page");
    };
  }, [title, description, image, url, type, price, siteName, jsonLd, keywords]);

  return null;
}
