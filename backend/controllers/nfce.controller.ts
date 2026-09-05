import fs from "fs";
import archiver from "archiver";
import type { Request, Response } from "express";

import { prisma } from "../config/prisma";
import type { AuthenticatedRequest } from "../types/auth";
import { emitirNfce, paymentsFromOrder } from "../services/nfce/emitir";
import { cancelarNfce } from "../services/nfce/cancelar";
import { generateDanfePdf } from "../services/nfce/danfe";
import { emitToTenant } from "../services/realtime.service";

const PAYMENT_LABELS: Record<string, string> = { money: "Dinheiro", pix: "PIX", debit: "Débito", credit: "Crédito" };

/** Reconstrói o PDF do DANFE a partir dos dados já salvos (sem precisar do arquivo em disco) —
 * usado quando a nota foi autorizada em outro ambiente (ex.: produção) e este servidor não tem
 * o arquivo localmente. */
async function rebuildDanfePdf(orderId: number, tenantId: number, invoice: { access_key: string | null; number: number; series: number; authorized_at: Date | null; protocol: string | null; qrcode_url: string | null }) {
  if (!invoice.access_key || !invoice.qrcode_url) return null;
  const order = await prisma.order.findFirst({
    where: { id: orderId, tenant_id: tenantId },
    include: { items: { include: { product: true } } },
  });
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!order || !tenant) return null;

  const environment = tenant.nfce_environment === "producao" ? "producao" : "homologacao";
  const payments = paymentsFromOrder(order.payment_method);
  const paymentSummary = payments.map((p) => `${PAYMENT_LABELS[p.method] ?? p.method}: R$ ${p.amount.toFixed(2)}`).join(" + ");

  return generateDanfePdf({
    storeName: tenant.razao_social || tenant.name,
    storeDocument: `CNPJ: ${tenant.document ?? ""}`,
    storeAddress: [tenant.address_street, tenant.address_number, tenant.address_city, tenant.address_state].filter(Boolean).join(", "),
    chaveAcesso: invoice.access_key,
    numero: invoice.number,
    serie: invoice.series,
    emittedAt: invoice.authorized_at ?? new Date(),
    environment,
    protocol: invoice.protocol,
    items: order.items.map((item) => ({
      name: item.product.name,
      quantity: item.quantity,
      unit: item.product.unidade_comercial,
      unitPrice: Number(item.unit_price),
      total: Number(item.unit_price) * item.quantity,
    })),
    totalAmount: Number(order.total_amount),
    qrCodeUrl: invoice.qrcode_url,
    paymentSummary,
  });
}

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

/** Cria e emite a NFC-e somente quando o operador solicitar após a venda. */
export async function emitNfceForOrder(req: Request, res: Response) {
  try {
    const orderId = Number(req.params.orderId);
    const tenantId = getTenantId(req);
    const order = await prisma.order.findFirst({
      where: { id: orderId, tenant_id: tenantId },
      select: { id: true, customer_id: true, customer_document: true },
    });
    if (!order) { res.status(404).json({ error: "Venda não encontrada" }); return; }

    let document = order.customer_document?.trim() || "";
    if (!document && order.customer_id) {
      const customer = await prisma.customer.findFirst({ where: { id: order.customer_id, tenant_id: tenantId }, select: { document: true } });
      document = customer?.document?.trim() || "";
    }
    if (!document) {
      res.status(422).json({ error: "CPF/CNPJ do cliente é obrigatório para emitir NFC-e. Informe o documento do cliente ou emita apenas o cupom comum." });
      return;
    }

    let invoice = await prisma.nfceInvoice.findFirst({ where: { order_id: orderId, tenant_id: tenantId } });
    if (invoice?.status === "authorized") { res.status(409).json({ error: "NFC-e já autorizada" }); return; }

    if (!invoice) {
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { nfce_environment: true, nfce_series: true, nfce_next_number: true },
      });
      if (!tenant) { res.status(404).json({ error: "Loja não encontrada" }); return; }
      invoice = await prisma.$transaction(async (tx) => {
        const created = await tx.nfceInvoice.create({ data: {
          tenant_id: tenantId, order_id: orderId, status: "pending", environment: tenant.nfce_environment,
          series: tenant.nfce_series, number: tenant.nfce_next_number,
        }});
        await tx.tenant.update({ where: { id: tenantId }, data: { nfce_next_number: { increment: 1 } } });
        return created;
      });
    } else {
      invoice = await prisma.nfceInvoice.update({ where: { id: invoice.id }, data: { status: "pending" } });
    }
    emitToTenant(tenantId, "nfce:changed", { orderId });
    emitirNfce(orderId).catch((error) => console.error("[emitNfceForOrder] erro:", error));
    res.json(invoice);
  } catch {
    res.status(500).json({ error: "Não foi possível iniciar a emissão da NFC-e" });
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
    emitToTenant(tenantId, "nfce:changed", { orderId });
    emitirNfce(orderId).catch((e) => console.error("[retryNfce] erro:", e));

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to retry NFC-e" });
  }
}

/** Remove a tentativa de NFC-e (rejeitada/com erro), mantendo a venda intacta — permite
 * reemitir do zero depois. Nunca permite excluir uma nota AUTORIZADA: essa tem valor
 * fiscal e só pode ser cancelada (rota /cancel), nunca apagada do banco. */
export async function deleteNfce(req: Request, res: Response) {
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
      res.status(400).json({ error: "NFC-e autorizada não pode ser excluída — cancele-a em vez disso." });
      return;
    }

    await prisma.nfceInvoice.delete({ where: { id: invoice.id } });
    emitToTenant(tenantId, "nfce:changed", { orderId });

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to delete NFC-e" });
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

    emitToTenant(tenantId, "nfce:changed", { orderId });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to cancel NFC-e" });
  }
}

function parseIdsParam(raw: unknown): number[] {
  const str = typeof raw === "string" ? raw : "";
  return str.split(",").map((s) => Number(s.trim())).filter((n) => Number.isInteger(n) && n > 0);
}

/** Reemite (ou emite pela primeira vez) várias NFC-e de uma vez — usado pelo botão "Reemitir selecionadas". */
export async function retryNfceBatch(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const { order_ids } = req.body as { order_ids?: number[] };
    const orderIds = Array.isArray(order_ids) ? order_ids.map(Number).filter((n) => Number.isInteger(n) && n > 0) : [];
    if (orderIds.length === 0) { res.status(422).json({ error: "Informe ao menos um pedido" }); return; }

    const invoices = await prisma.nfceInvoice.findMany({
      where: { order_id: { in: orderIds }, tenant_id: tenantId, status: { not: "authorized" } },
    });

    await prisma.nfceInvoice.updateMany({
      where: { id: { in: invoices.map((i) => i.id) } },
      data: { status: "pending" },
    });

    for (const invoice of invoices) {
      emitToTenant(tenantId, "nfce:changed", { orderId: invoice.order_id });
      emitirNfce(invoice.order_id).catch((e) => console.error("[retryNfceBatch] erro:", e));
    }

    res.json({ success: true, count: invoices.length });
  } catch {
    res.status(500).json({ error: "Failed to retry NFC-e batch" });
  }
}

/** Baixa os XMLs autorizados de várias notas compactados em um único .zip. */
export async function downloadNfceXmlBatch(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const orderIds = parseIdsParam(req.query.ids);
    if (orderIds.length === 0) { res.status(422).json({ error: "Informe ao menos uma nota" }); return; }

    const invoices = await prisma.nfceInvoice.findMany({
      where: { order_id: { in: orderIds }, tenant_id: tenantId, status: "authorized" },
    });

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="nfce-xml-${Date.now()}.zip"`);

    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.on("error", (err) => { console.error("[downloadNfceXmlBatch] erro:", err); res.end(); });
    archive.pipe(res);

    for (const invoice of invoices) {
      if (invoice.xml_path && fs.existsSync(invoice.xml_path)) {
        archive.file(invoice.xml_path, { name: `nfce-${invoice.access_key ?? invoice.order_id}.xml` });
      }
    }

    await archive.finalize();
  } catch {
    res.status(500).json({ error: "Failed to build NFC-e XML batch" });
  }
}

/** Baixa os DANFEs (PDF) autorizados de várias notas compactados em um único .zip. */
export async function downloadDanfeBatch(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const orderIds = parseIdsParam(req.query.ids);
    if (orderIds.length === 0) { res.status(422).json({ error: "Informe ao menos uma nota" }); return; }

    const invoices = await prisma.nfceInvoice.findMany({
      where: { order_id: { in: orderIds }, tenant_id: tenantId, status: "authorized" },
    });

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="danfe-${Date.now()}.zip"`);

    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.on("error", (err) => { console.error("[downloadDanfeBatch] erro:", err); res.end(); });
    archive.pipe(res);

    for (const invoice of invoices) {
      if (invoice.danfe_path && fs.existsSync(invoice.danfe_path)) {
        archive.file(invoice.danfe_path, { name: `danfe-${invoice.access_key ?? invoice.order_id}.pdf` });
      }
    }

    await archive.finalize();
  } catch {
    res.status(500).json({ error: "Failed to build DANFE batch" });
  }
}

export async function downloadDanfe(req: Request, res: Response) {
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
    if (invoice.status !== "authorized") {
      res.status(409).json({ error: `DANFE indisponível — a NFC-e deste pedido ainda não foi autorizada (status atual: ${invoice.status}).` });
      return;
    }
    if (invoice.danfe_path && fs.existsSync(invoice.danfe_path)) {
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="danfe-${invoice.access_key ?? orderId}.pdf"`);
      fs.createReadStream(invoice.danfe_path).pipe(res);
      return;
    }

    // Arquivo não existe neste servidor (comum quando a nota foi autorizada em outro
    // ambiente, ex.: produção) — reconstrói o PDF a partir dos dados já salvos no banco.
    const rebuilt = await rebuildDanfePdf(orderId, tenantId, invoice);
    if (!rebuilt) {
      res.status(404).json({ error: "O arquivo do DANFE não está disponível neste servidor e não há dados suficientes para reconstruí-lo." });
      return;
    }
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="danfe-${invoice.access_key ?? orderId}.pdf"`);
    res.send(rebuilt);
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
    if (!invoice) {
      res.status(404).json({ error: "Nota fiscal não encontrada para este pedido" });
      return;
    }
    if (invoice.status !== "authorized") {
      res.status(409).json({ error: `XML indisponível — a NFC-e deste pedido ainda não foi autorizada (status atual: ${invoice.status}).` });
      return;
    }
    if (!invoice.xml_path || !fs.existsSync(invoice.xml_path)) {
      res.status(404).json({ error: "O arquivo XML não está disponível neste servidor (a nota pode ter sido autorizada em outro ambiente, ex.: produção) e não pode ser reconstruído — o XML assinado só existe onde foi originalmente salvo." });
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
