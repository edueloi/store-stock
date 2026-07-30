import fs from "fs";
import type { Request, Response } from "express";

import { prisma } from "../config/prisma";
import type { AuthenticatedRequest } from "../types/auth";
import { emitirNfse } from "../services/nfse/emitir";

function getTenantId(req: Request) {
  return (req as AuthenticatedRequest).user.tenantId;
}

export async function getNfseByServiceOrder(req: Request, res: Response) {
  try {
    const serviceOrderId = Number(req.params.serviceOrderId);
    const tenantId = getTenantId(req);
    const invoice = await prisma.nfseInvoice.findFirst({
      where: { service_order_id: serviceOrderId, tenant_id: tenantId },
    });
    if (!invoice) {
      res.status(404).json({ error: "NFS-e não encontrada para esta ordem de serviço" });
      return;
    }
    res.json(invoice);
  } catch {
    res.status(500).json({ error: "Failed to fetch NFS-e" });
  }
}

/** Cria e emite a NFS-e para a mão de obra da OS somente quando o operador solicitar. */
export async function emitNfseForServiceOrder(req: Request, res: Response) {
  try {
    const serviceOrderId = Number(req.params.serviceOrderId);
    const tenantId = getTenantId(req);
    const { codigo_tributacao_nacional, descricao_servico, valor_servico } = req.body as {
      codigo_tributacao_nacional?: string;
      descricao_servico?: string;
      valor_servico?: number;
    };

    const serviceOrder = await prisma.serviceOrder.findFirst({
      where: { id: serviceOrderId, tenant_id: tenantId },
      select: { id: true, service_value: true, equipment_type: true, equipment_category: true },
    });
    if (!serviceOrder) { res.status(404).json({ error: "Ordem de serviço não encontrada" }); return; }

    const valorServico = valor_servico ?? Number(serviceOrder.service_value);
    if (!valorServico || valorServico <= 0) {
      res.status(422).json({ error: "Informe um valor de mão de obra maior que zero para emitir a NFS-e" });
      return;
    }
    if (!codigo_tributacao_nacional) {
      res.status(422).json({ error: "Informe o código de tributação nacional do serviço (subitem da lista LC 116/03)" });
      return;
    }

    let invoice = await prisma.nfseInvoice.findFirst({ where: { service_order_id: serviceOrderId, tenant_id: tenantId } });
    if (invoice?.status === "authorized") { res.status(409).json({ error: "NFS-e já autorizada" }); return; }

    if (!invoice) {
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { nfse_environment: true, nfse_serie: true, nfse_next_number: true },
      });
      if (!tenant) { res.status(404).json({ error: "Loja não encontrada" }); return; }
      invoice = await prisma.$transaction(async (tx) => {
        const created = await tx.nfseInvoice.create({ data: {
          tenant_id: tenantId, service_order_id: serviceOrderId, status: "pending",
          environment: tenant.nfse_environment, serie: tenant.nfse_serie, numero: tenant.nfse_next_number,
        }});
        await tx.tenant.update({ where: { id: tenantId }, data: { nfse_next_number: { increment: 1 } } });
        return created;
      });
    } else {
      invoice = await prisma.nfseInvoice.update({ where: { id: invoice.id }, data: { status: "pending" } });
    }

    const descricao = descricao_servico
      || `${serviceOrder.equipment_category ?? "Serviço"}${serviceOrder.equipment_type ? ` — ${serviceOrder.equipment_type}` : ""}`;

    emitirNfse({
      serviceOrderId,
      codigoTributacaoNacional: codigo_tributacao_nacional,
      descricaoServico: descricao,
      valorServico,
    }).catch((error) => console.error("[emitNfseForServiceOrder] erro:", error));

    res.json(invoice);
  } catch (err) {
    console.error("[emitNfseForServiceOrder] error:", err);
    res.status(500).json({ error: "Não foi possível iniciar a emissão da NFS-e" });
  }
}

export async function retryNfse(req: Request, res: Response) {
  try {
    const serviceOrderId = Number(req.params.serviceOrderId);
    const tenantId = getTenantId(req);
    const { codigo_tributacao_nacional, descricao_servico, valor_servico } = req.body as {
      codigo_tributacao_nacional?: string;
      descricao_servico?: string;
      valor_servico?: number;
    };

    const invoice = await prisma.nfseInvoice.findFirst({
      where: { service_order_id: serviceOrderId, tenant_id: tenantId },
    });
    if (!invoice) { res.status(404).json({ error: "NFS-e não encontrada" }); return; }
    if (invoice.status === "authorized") { res.status(409).json({ error: "NFS-e já autorizada" }); return; }
    if (!codigo_tributacao_nacional || !valor_servico) {
      res.status(422).json({ error: "Informe código de tributação e valor do serviço" });
      return;
    }

    await prisma.nfseInvoice.update({ where: { id: invoice.id }, data: { status: "pending" } });
    emitirNfse({
      serviceOrderId,
      codigoTributacaoNacional: codigo_tributacao_nacional,
      descricaoServico: descricao_servico || "Serviço prestado",
      valorServico: valor_servico,
    }).catch((e) => console.error("[retryNfse] erro:", e));

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to retry NFS-e" });
  }
}

export async function downloadNfseXml(req: Request, res: Response) {
  try {
    const serviceOrderId = Number(req.params.serviceOrderId);
    const tenantId = getTenantId(req);
    const invoice = await prisma.nfseInvoice.findFirst({
      where: { service_order_id: serviceOrderId, tenant_id: tenantId },
    });
    if (!invoice?.nfse_xml_path || !fs.existsSync(invoice.nfse_xml_path)) {
      res.status(404).json({ error: "XML não disponível" });
      return;
    }
    res.setHeader("Content-Type", "application/xml");
    res.setHeader("Content-Disposition", `attachment; filename="nfse-${invoice.chave_acesso ?? serviceOrderId}.xml"`);
    fs.createReadStream(invoice.nfse_xml_path).pipe(res);
  } catch {
    res.status(500).json({ error: "Failed to fetch NFS-e XML" });
  }
}

export async function listNfse(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(200, Math.max(1, Number(req.query.pageSize) || 50));

    const [invoices, total] = await Promise.all([
      prisma.nfseInvoice.findMany({
        where: { tenant_id: tenantId },
        include: { service_order: { select: { customer_name: true, service_value: true, number: true } } },
        orderBy: { created_at: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.nfseInvoice.count({ where: { tenant_id: tenantId } }),
    ]);

    res.json({ invoices, total, page, pageSize });
  } catch {
    res.status(500).json({ error: "Failed to list NFS-e invoices" });
  }
}
