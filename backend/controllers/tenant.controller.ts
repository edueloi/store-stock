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
    const normalizedPublicId = normalizeSubdomain(req.body.subdomain || req.body.slug || "");

    await prisma.tenant.update({
      where: { id: getTenantId(req) },
      data: {
        name: req.body.name,
        whatsapp: req.body.whatsapp,
        document: req.body.document,
        slug: normalizedPublicId || undefined,
        subdomain: normalizedPublicId || undefined,
        about_text: req.body.about_text,
        footer_text: req.body.footer_text,
        logo_url: req.body.logo_url,
        banner_url: req.body.banner_url,
        instagram_url: req.body.instagram_url,
        facebook_url: req.body.facebook_url,
        address: req.body.address,
        address_street: req.body.address_street,
        address_number: req.body.address_number,
        address_complement: req.body.address_complement,
        address_district: req.body.address_district,
        address_city: req.body.address_city,
        address_state: req.body.address_state,
        address_zip: req.body.address_zip,
        show_address: req.body.show_address,
        template_id: req.body.template_id,
        primary_color: req.body.primary_color,
        featured_limit: req.body.featured_limit !== undefined ? Number(req.body.featured_limit) : undefined,
        bestseller_limit: req.body.bestseller_limit !== undefined ? Number(req.body.bestseller_limit) : undefined,
        business_hours: req.body.business_hours !== undefined ? req.body.business_hours : undefined,
        payment_methods: req.body.payment_methods !== undefined ? req.body.payment_methods : undefined,
        policies: req.body.policies !== undefined ? req.body.policies : undefined,
        card_fees: req.body.card_fees !== undefined ? req.body.card_fees : undefined,
      },
    });

    res.json({ message: "Tenant updated" });
  } catch {
    res.status(500).json({ error: "Failed to update tenant" });
  }
}
