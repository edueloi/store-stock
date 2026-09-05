import fs from "fs";
import type { Request, Response } from "express";

import { prisma } from "../config/prisma";
import type { AuthenticatedRequest } from "../types/auth";
import { emitirNfse } from "../services/nfse/emitir";
import { cancelarNfse } from "../services/nfse/cancelar";
import type { MotivoCancelamentoNfse } from "../services/nfse/eventoXmlBuilder";
import { emitToTenant } from "../services/realtime.service";

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
      select: { id: true, status: true, service_value: true, equipment_type: true, equipment_category: true },
    });
    if (!serviceOrder) { res.status(404).json({ error: "Ordem de serviço não encontrada" }); return; }
    if (serviceOrder.status !== "finalizado" && serviceOrder.status !== "nota_emitida") {
      res.status(400).json({ error: "Só é possível emitir a NFS-e de uma ordem de serviço finalizada" });
      return;
    }

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

    const descricao = descricao_servico
      || `${serviceOrder.equipment_category ?? "Serviço"}${serviceOrder.equipment_type ? ` — ${serviceOrder.equipment_type}` : ""}`;

    // Guarda os dados desta tentativa — sem persistir isso, reemitir depois de um erro
    // exigiria que o operador digitasse tudo de novo (retryNfse não tem outro lugar pra
    // recuperar código de tributação/descrição/valor).
    const retryData = { codigo_tributacao_nacional, descricao_servico: descricao, valor_servico: valorServico };

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
          ...retryData,
        }});
        await tx.tenant.update({ where: { id: tenantId }, data: { nfse_next_number: { increment: 1 } } });
        return created;
      });
    } else {
      invoice = await prisma.nfseInvoice.update({ where: { id: invoice.id }, data: { status: "pending", ...retryData } });
    }

    emitToTenant(tenantId, "nfse:changed", { serviceOrderId });
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

// Emite uma NFS-e de teste em homologação, sem precisar de uma Ordem de Serviço real —
// cria uma OS-âncora só pra satisfazer o vínculo obrigatório, valida certificado A1 e
// código do município antes de tentar, e força homologação mesmo que o tenant já
// tenha configurado "produção" (nunca testa contra o ambiente real por engano).
export async function testNfseEmission(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) { res.status(404).json({ error: "Loja não encontrada" }); return; }
    if (!tenant.nfce_cert_path || !tenant.nfce_cert_password) {
      res.status(422).json({ error: "Envie o certificado digital A1 antes de testar (Configurações > Dados Fiscais)." });
      return;
    }
    if (!tenant.nfse_codigo_municipio) {
      res.status(422).json({ error: "Informe o código do município (IBGE) antes de testar (Configurações > Dados Fiscais)." });
      return;
    }

    const last = await prisma.serviceOrder.findFirst({
      where: { tenant_id: tenantId },
      orderBy: { number: "desc" },
      select: { number: true },
    });

    const { invoiceId, serviceOrderId } = await prisma.$transaction(async (tx) => {
      const testOrder = await tx.serviceOrder.create({
        data: {
          tenant_id: tenantId,
          number: (last?.number ?? 0) + 1,
          status: "finalizado",
          customer_name: "TESTE DE EMISSÃO NFS-e (HOMOLOGAÇÃO)",
          has_equipment: false,
          reported_issue: "Ordem de serviço gerada automaticamente para testar a emissão de NFS-e em homologação — pode ser excluída.",
          service_value: 1,
          subtotal: 1,
          total_amount: 1,
        },
      });
      const invoice = await tx.nfseInvoice.create({
        data: {
          tenant_id: tenantId,
          service_order_id: testOrder.id,
          status: "pending",
          environment: "homologacao",
          serie: tenant.nfse_serie,
          numero: tenant.nfse_next_number,
          codigo_tributacao_nacional: "140101",
          descricao_servico: "Teste de emissão NFS-e (homologação)",
          valor_servico: 1,
        },
      });
      await tx.tenant.update({ where: { id: tenantId }, data: { nfse_next_number: { increment: 1 } } });
      return { invoiceId: invoice.id, serviceOrderId: testOrder.id };
    });

    await emitirNfse({
      serviceOrderId,
      // cTribNac exige 6 dígitos: Item(2) + Subitem(2) + Desdobro Nacional(2) da tabela do
      // Sistema Nacional NFS-e — "1401" (item+subitem só, sem o desdobro) é rejeitado pelo
      // XSD (TSCodTribNac). 140101 = subitem 14.01 (manutenção), desdobro 01.
      codigoTributacaoNacional: "140101",
      descricaoServico: "Teste de emissão NFS-e (homologação)",
      valorServico: 1,
      forceEnvironment: "homologacao",
    });

    const invoice = await prisma.nfseInvoice.findUnique({ where: { id: invoiceId } });
    res.json({
      success: invoice?.status === "authorized",
      status: invoice?.status,
      rejection_reason: invoice?.rejection_reason,
      chave_acesso: invoice?.chave_acesso,
      service_order_id: serviceOrderId,
    });
  } catch (err) {
    console.error("[testNfseEmission] error:", err);
    res.status(500).json({ error: "Erro ao testar emissão em homologação" });
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

    // Reaproveita os dados da tentativa original (salvos em emitNfseForServiceOrder) quando
    // o chamador não manda nada — permite reemitir com 1 clique, sem redigitar tudo.
    const codigoTributacao = codigo_tributacao_nacional || invoice.codigo_tributacao_nacional;
    const descricao = descricao_servico || invoice.descricao_servico;
    const valorServico = valor_servico ?? (invoice.valor_servico ? Number(invoice.valor_servico) : undefined);
    if (!codigoTributacao || !valorServico) {
      res.status(422).json({ error: "Informe código de tributação e valor do serviço" });
      return;
    }

    await prisma.nfseInvoice.update({
      where: { id: invoice.id },
      data: {
        status: "pending",
        codigo_tributacao_nacional: codigoTributacao,
        descricao_servico: descricao,
        valor_servico: valorServico,
      },
    });
    emitToTenant(tenantId, "nfse:changed", { serviceOrderId });
    emitirNfse({
      serviceOrderId,
      codigoTributacaoNacional: codigoTributacao,
      descricaoServico: descricao || "Serviço prestado",
      valorServico,
    }).catch((e) => console.error("[retryNfse] erro:", e));

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to retry NFS-e" });
  }
}

/** Remove a tentativa de NFS-e (rejeitada/com erro), mantendo a ordem de serviço intacta —
 * permite reemitir do zero depois. Nunca permite excluir uma nota AUTORIZADA: essa tem
 * valor fiscal e só pode ser cancelada, nunca apagada do banco. */
export async function deleteNfse(req: Request, res: Response) {
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
    if (invoice.status === "authorized") {
      res.status(400).json({ error: "NFS-e autorizada não pode ser excluída." });
      return;
    }

    await prisma.nfseInvoice.delete({ where: { id: invoice.id } });
    emitToTenant(tenantId, "nfse:changed", { serviceOrderId });

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to delete NFS-e" });
  }
}

export async function cancelNfse(req: Request, res: Response) {
  try {
    const serviceOrderId = Number(req.params.serviceOrderId);
    const tenantId = getTenantId(req);
    const { reason, motivo } = req.body as { reason?: string; motivo?: MotivoCancelamentoNfse };

    const invoice = await prisma.nfseInvoice.findFirst({
      where: { service_order_id: serviceOrderId, tenant_id: tenantId },
    });
    if (!invoice) {
      res.status(404).json({ error: "NFS-e não encontrada para esta ordem de serviço" });
      return;
    }

    const result = await cancelarNfse(serviceOrderId, reason || "", motivo || "1");
    if (!result.success) {
      res.status(422).json({ error: result.error });
      return;
    }

    emitToTenant(tenantId, "nfse:changed", { serviceOrderId });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to cancel NFS-e" });
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

export async function downloadNfsePdf(req: Request, res: Response) {
  try {
    const serviceOrderId = Number(req.params.serviceOrderId);
    const tenantId = getTenantId(req);
    const invoice = await prisma.nfseInvoice.findFirst({
      where: { service_order_id: serviceOrderId, tenant_id: tenantId },
    });
    if (!invoice?.nfse_pdf_path || !fs.existsSync(invoice.nfse_pdf_path)) {
      res.status(404).json({ error: "PDF não disponível" });
      return;
    }
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="nfse-${invoice.chave_acesso ?? serviceOrderId}.pdf"`);
    fs.createReadStream(invoice.nfse_pdf_path).pipe(res);
  } catch {
    res.status(500).json({ error: "Failed to fetch NFS-e PDF" });
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
