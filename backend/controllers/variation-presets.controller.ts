import type { Request, Response } from "express";
import { Prisma } from "@prisma/client";

import { prisma } from "../config/prisma";
import type { AuthenticatedRequest } from "../types/auth";

function getTenantId(req: Request) {
  return (req as AuthenticatedRequest).user.tenantId;
}

interface PresetVariation { name: string; options: string[]; colors?: Record<string, string> }
interface StoredPreset { id: string; label: string; icon: string; variations: PresetVariation[] }
interface StoredPresets { presets: StoredPreset[]; hidden: string[] }

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Aceita só o formato esperado e corta tamanhos — o conteúdo vem do navegador. */
function sanitize(body: unknown): StoredPresets {
  const raw = (body && typeof body === "object" ? body : {}) as { presets?: unknown; hidden?: unknown };
  const presets: StoredPreset[] = [];
  for (const p of (Array.isArray(raw.presets) ? raw.presets : []).slice(0, 80)) {
    const label = str(p?.label, 40);
    if (!label) continue;
    const variations: PresetVariation[] = [];
    for (const v of (Array.isArray(p?.variations) ? p.variations : []).slice(0, 6)) {
      const name = str(v?.name, 40);
      const options = [...new Set((Array.isArray(v?.options) ? v.options : []).map((o: unknown) => str(o, 40)).filter(Boolean))] as string[];
      if (!name || options.length === 0) continue;
      const colors: Record<string, string> = {};
      if (v?.colors && typeof v.colors === "object") {
        for (const o of options) {
          const hex = (v.colors as Record<string, unknown>)[o];
          if (typeof hex === "string" && /^#[0-9a-fA-F]{6}$/.test(hex)) colors[o] = hex;
        }
      }
      variations.push({ name, options: options.slice(0, 60), ...(Object.keys(colors).length ? { colors } : {}) });
    }
    if (variations.length === 0) continue;
    presets.push({ id: str(p?.id, 60) || `${Date.now()}-${presets.length}`, label, icon: str(p?.icon, 8) || "🏷️", variations });
  }
  const hidden = (Array.isArray(raw.hidden) ? raw.hidden : []).map((h: unknown) => str(h, 40)).filter(Boolean).slice(0, 80) as string[];
  return { presets, hidden };
}

async function readPolicies(tenantId: number) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { policies: true } });
  return (tenant?.policies && typeof tenant.policies === "object" ? tenant.policies : {}) as Record<string, unknown>;
}

export async function getVariationPresets(req: Request, res: Response) {
  try {
    const policies = await readPolicies(getTenantId(req));
    res.json(sanitize(policies.variation_presets));
  } catch (err) {
    console.error("getVariationPresets", err);
    res.status(500).json({ error: "Falha ao carregar os modelos de variação" });
  }
}

export async function saveVariationPresets(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const clean = sanitize(req.body);
    const policies = await readPolicies(tenantId);
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { policies: { ...policies, variation_presets: clean } as unknown as Prisma.InputJsonValue },
    });
    res.json(clean);
  } catch (err) {
    console.error("saveVariationPresets", err);
    res.status(500).json({ error: "Falha ao salvar os modelos de variação" });
  }
}
