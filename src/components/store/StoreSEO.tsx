import { useEffect } from "react";

interface StoreSEOProps {
  title: string;
  description?: string;
  image?: string;
  url?: string;
  type?: "website" | "product";
  price?: string;
  siteName?: string;
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

export default function StoreSEO({
  title,
  description,
  image,
  url,
  type = "website",
  price,
  siteName,
}: StoreSEOProps) {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = title;

    if (description) {
      setMeta("description", description);
      setMeta("og:description", description, true);
      setMeta("twitter:description", description);
    }

    setMeta("og:title", title, true);
    setMeta("og:type", type, true);
    setMeta("twitter:title", title);
    setMeta("twitter:card", image ? "summary_large_image" : "summary");

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

    if (siteName) setMeta("og:site_name", siteName, true);

    if (type === "product" && price) {
      setMeta("og:price:amount", price, true);
      setMeta("og:price:currency", "BRL", true);
      setMeta("product:price:amount", price, true);
      setMeta("product:price:currency", "BRL", true);
    }

    return () => {
      document.title = prevTitle;
    };
  }, [title, description, image, url, type, price, siteName]);

  return null;
}
