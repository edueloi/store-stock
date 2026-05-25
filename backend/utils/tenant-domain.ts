import type { Request } from "express";

import { env } from "../config/env";

const RESERVED_SUBDOMAINS = new Set([
  "www",
  "api",
  "admin",
  "app",
  "localhost",
  env.primarySubdomain.toLowerCase(),
]);

function isLocalHost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname.endsWith(".localhost");
}

export function normalizeSubdomain(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function isReservedSubdomain(subdomain: string) {
  return RESERVED_SUBDOMAINS.has(subdomain.toLowerCase());
}

export function extractTenantSubdomain(hostHeader?: string | null) {
  if (!hostHeader) {
    return null;
  }

  const hostname = hostHeader.split(":")[0].toLowerCase();

  if (isLocalHost(hostname) || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    return null;
  }

  if (env.appDomain && hostname.endsWith(`.${env.appDomain}`)) {
    const raw = hostname.slice(0, -(`.${env.appDomain}`).length);
    const [subdomain] = raw.split(".");

    if (!subdomain || isReservedSubdomain(subdomain)) {
      return null;
    }

    return subdomain;
  }

  const parts = hostname.split(".");

  if (parts.length >= 4) {
    const subdomain = parts[0];
    return isReservedSubdomain(subdomain) ? null : subdomain;
  }

  return null;
}

export function resolveTenantLookupFromRequest(req: Request) {
  return req.params.slug || extractTenantSubdomain(req.headers.host);
}

export function buildTenantAccessUrl(subdomain: string) {
  const baseUrl = env.appBaseUrl.replace(/\/+$/, "");

  try {
    const parsed = new URL(baseUrl);

    if (isLocalHost(parsed.hostname) || /^\d+\.\d+\.\d+\.\d+$/.test(parsed.hostname)) {
      return `${baseUrl}/s/${subdomain}`;
    }

    return `${parsed.protocol}//${subdomain}.${env.appDomain}`;
  } catch {
    return `${baseUrl}/s/${subdomain}`;
  }
}
