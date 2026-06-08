import type { Request, Response } from "express";

import { prisma } from "../config/prisma";
import type { AuthenticatedRequest } from "../types/auth";
import { buildTenantAccessUrl, normalizeSubdomain } from "../utils/tenant-domain";

function getTenantId(req: Request) {
  return (req as AuthenticatedRequest).user.tenantId;
}

export async function getTenant(req: Request, res: Response) {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: getTenantId(req) },
    });

    if (!tenant) {
      res.status(404).json({ error: "Tenant not found" });
      return;
    }

    res.json({
      ...tenant,
      public_url: buildTenantAccessUrl(tenant.subdomain || tenant.slug),
    });
  } catch {
    res.status(500).json({ error: "Failed to fetch tenant" });
  }
}

export async function updateTenant(req: Request, res: Response) {
  try {
    const b = req.body;

    // Build update payload with only the fields present in the request body
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: Record<string, any> = {};

    if (b.name !== undefined)               data.name               = b.name;
    if (b.whatsapp !== undefined)           data.whatsapp           = b.whatsapp;
    if (b.document !== undefined)           data.document           = b.document;
    if (b.about_text !== undefined)         data.about_text         = b.about_text;
    if (b.footer_text !== undefined)        data.footer_text        = b.footer_text;
    if (b.logo_url !== undefined)           data.logo_url           = b.logo_url;
    if (b.banner_url !== undefined)         data.banner_url         = b.banner_url;
    if (b.instagram_url !== undefined)      data.instagram_url      = b.instagram_url;
    if (b.facebook_url !== undefined)       data.facebook_url       = b.facebook_url;
    if (b.address !== undefined)            data.address            = b.address;
    if (b.address_street !== undefined)     data.address_street     = b.address_street;
    if (b.address_number !== undefined)     data.address_number     = b.address_number;
    if (b.address_complement !== undefined) data.address_complement = b.address_complement;
    if (b.address_district !== undefined)   data.address_district   = b.address_district;
    if (b.address_city !== undefined)       data.address_city       = b.address_city;
    if (b.address_state !== undefined)      data.address_state      = b.address_state;
    if (b.address_zip !== undefined)        data.address_zip        = b.address_zip;
    if (b.show_address !== undefined)       data.show_address       = b.show_address;
    if (b.template_id !== undefined)        data.template_id        = b.template_id;
    if (b.primary_color !== undefined)      data.primary_color      = b.primary_color;
    if (b.featured_limit !== undefined)     data.featured_limit     = Number(b.featured_limit);
    if (b.bestseller_limit !== undefined)   data.bestseller_limit   = Number(b.bestseller_limit);
    if (b.business_hours !== undefined)     data.business_hours     = b.business_hours;
    if (b.payment_methods !== undefined)    data.payment_methods    = b.payment_methods;
    if (b.policies !== undefined)           data.policies           = b.policies;
    if (b.card_fees !== undefined)          data.card_fees          = b.card_fees;
    if (b.pass_fee_to_customer !== undefined) data.pass_fee_to_customer = Boolean(b.pass_fee_to_customer);
    if (b.max_installments !== undefined)   data.max_installments   = Number(b.max_installments);
    if (b.enabled_brands !== undefined)     data.enabled_brands     = b.enabled_brands;
    if (b.pass_fee_by_method !== undefined) data.pass_fee_by_method = b.pass_fee_by_method;

    // Only update slug/subdomain if explicitly provided and non-empty
    if (b.subdomain || b.slug) {
      const normalizedPublicId = normalizeSubdomain(b.subdomain || b.slug);
      if (normalizedPublicId) {
        data.slug      = normalizedPublicId;
        data.subdomain = normalizedPublicId;
      }
    }

    await prisma.tenant.update({
      where: { id: getTenantId(req) },
      data,
    });

    res.json({ message: "Tenant updated" });
  } catch (err) {
    console.error("updateTenant error:", err);
    res.status(500).json({ error: "Failed to update tenant" });
  }
}
