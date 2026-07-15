import fs from "fs";
import type { Request, Response } from "express";

import { prisma } from "../config/prisma";
import type { AuthenticatedRequest } from "../types/auth";
import { emitirNfce } from "../services/nfce/emitir";
import { cancelarNfce } from "../services/nfce/cancelar";

function getTenantId(req: Request) {
  return (req as AuthenticatedRequest).user.tenantId;
}

export async function getNfceByOrder(req: Request, res: Response) {
  try {
    const orderId = Number(req.params.orderId);
    const tenantId = getTenantId(req);
    const invoice = await prisma.nfceInvoice.findFirst({
      where: { order_id: orderId, tenant_id: tenantId },
    });
    if (!invoice) {
      res.status(404).json({ error: "Nota fiscal não encontrada para este pedido" });
      return;
    }
    res.json(invoice);
  } catch {
    res.status(500).json({ error: "Failed to fetch NFC-e" });
  }
}

export async function retryNfce(req: Request, res: Response) {
  try {
    const orderId = Number(req.params.orderId);
    const tenantId = getTenantId(req);
    const invoice = await prisma.nfceInvoice.findFirst({
      where: { order_id: orderId, tenant_id: tenantId },
    });
    if (!invoice) {
      res.status(404).json({ error: "Nota fiscal não encontrada para este pedido" });
      return;
    }
    if (invoice.status === "authorized") {
      res.status(409).json({ error: "Nota já autorizada" });
      return;
    }

    await prisma.nfceInvoice.update({
      where: { id: invoice.id },
      data: { status: "pending" },
    });
    emitirNfce(orderId).catch((e) => console.error("[retryNfce] erro:", e));

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to retry NFC-e" });
  }
}

export async function cancelNfce(req: Request, res: Response) {
  try {
    const orderId = Number(req.params.orderId);
    const tenantId = getTenantId(req);
    const { reason } = req.body as { reason?: string };

    const invoice = await prisma.nfceInvoice.findFirst({
      where: { order_id: orderId, tenant_id: tenantId },
    });
    if (!invoice) {
      res.status(404).json({ error: "Nota fiscal não encontrada para este pedido" });
      return;
    }

    const result = await cancelarNfce(orderId, reason || "");
    if (!result.success) {
      res.status(422).json({ error: result.error });
      return;
    }

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to cancel NFC-e" });
  }
}

export async function downloadDanfe(req: Request, res: Response) {
  try {
    const orderId = Number(req.params.orderId);
    const tenantId = getTenantId(req);
    const invoice = await prisma.nfceInvoice.findFirst({
      where: { order_id: orderId, tenant_id: tenantId },
    });
    if (!invoice?.danfe_path || !fs.existsSync(invoice.danfe_path)) {
      res.status(404).json({ error: "DANFE não disponível" });
      return;
    }
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="danfe-${invoice.access_key ?? orderId}.pdf"`);
    fs.createReadStream(invoice.danfe_path).pipe(res);
  } catch {
    res.status(500).json({ error: "Failed to fetch DANFE" });
  }
}

export async function downloadNfceXml(req: Request, res: Response) {
  try {
    const orderId = Number(req.params.orderId);
    const tenantId = getTenantId(req);
    const invoice = await prisma.nfceInvoice.findFirst({
      where: { order_id: orderId, tenant_id: tenantId },
    });
    if (!invoice?.xml_path || !fs.existsSync(invoice.xml_path)) {
      res.status(404).json({ error: "XML não disponível" });
      return;
    }
    res.setHeader("Content-Type", "application/xml");
    res.setHeader("Content-Disposition", `attachment; filename="nfce-${invoice.access_key ?? orderId}.xml"`);
    fs.createReadStream(invoice.xml_path).pipe(res);
  } catch {
    res.status(500).json({ error: "Failed to fetch NFC-e XML" });
  }
}

export async function listNfce(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(200, Math.max(1, Number(req.query.pageSize) || 50));

    const [invoices, total] = await Promise.all([
      prisma.nfceInvoice.findMany({
        where: { tenant_id: tenantId },
        include: { order: { select: { customer_name: true, total_amount: true } } },
        orderBy: { created_at: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.nfceInvoice.count({ where: { tenant_id: tenantId } }),
    ]);

    res.json({ invoices, total, page, pageSize });
  } catch {
    res.status(500).json({ error: "Failed to list NFC-e invoices" });
  }
}
