const RESERVED_SUBDOMAINS = new Set([
  "www",
  "api",
  "admin",
  "app",
  (import.meta.env.VITE_PRIMARY_SUBDOMAIN as string | undefined) || "store",
]);

function getConfiguredDomain() {
  return (import.meta.env.VITE_APP_DOMAIN as string | undefined)?.toLowerCase() || "boxsys.com.br";
}

function isLocalHost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname.endsWith(".localhost");
}

export function getTenantSubdomainFromHost(hostname = window.location.hostname) {
  const normalizedHost = hostname.toLowerCase();

  if (isLocalHost(normalizedHost) || /^\d+\.\d+\.\d+\.\d+$/.test(normalizedHost)) {
    return null;
  }

  const configuredDomain = getConfiguredDomain();

  if (configuredDomain && normalizedHost.endsWith(`.${configuredDomain}`)) {
    const subdomain = normalizedHost.slice(0, -(`.${configuredDomain}`).length).split(".")[0];

    if (!subdomain || RESERVED_SUBDOMAINS.has(subdomain)) {
      return null;
    }

    return subdomain;
  }

  const parts = normalizedHost.split(".");
  if (parts.length >= 4 && !RESERVED_SUBDOMAINS.has(parts[0])) {
    return parts[0];
  }

  return null;
}

export function isTenantSubdomainHost(hostname = window.location.hostname) {
  return !!getTenantSubdomainFromHost(hostname);
}

export function resolveStoreSlug(routeSlug?: string | null) {
  return routeSlug || getTenantSubdomainFromHost() || "";
}

export function buildStorePath(routeSlug: string | undefined | null, suffix = "") {
  const slug = resolveStoreSlug(routeSlug);
  const normalizedSuffix = suffix ? (suffix.startsWith("/") ? suffix : `/${suffix}`) : "";

  if (isTenantSubdomainHost()) {
    return normalizedSuffix || "/";
  }

  return slug ? `/s/${slug}${normalizedSuffix}` : normalizedSuffix || "/";
}
