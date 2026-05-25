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
        slug: normalizedPublicId || undefined,
        subdomain: normalizedPublicId || undefined,
        about_text: req.body.about_text,
        footer_text: req.body.footer_text,
        logo_url: req.body.logo_url,
        banner_url: req.body.banner_url,
        instagram_url: req.body.instagram_url,
        facebook_url: req.body.facebook_url,
        address: req.body.address,
        show_address: req.body.show_address,
        template_id: req.body.template_id,
        primary_color: req.body.primary_color,
        featured_limit: req.body.featured_limit !== undefined ? Number(req.body.featured_limit) : undefined,
        bestseller_limit: req.body.bestseller_limit !== undefined ? Number(req.body.bestseller_limit) : undefined,
      },
    });

    res.json({ message: "Tenant updated" });
  } catch {
    res.status(500).json({ error: "Failed to update tenant" });
  }
}
