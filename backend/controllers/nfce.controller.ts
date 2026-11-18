import fs from "fs";
import { activeIssuerId, issuerFilter, issuerForNote, fiscalTenant, bumpNextNumber } from "../utils/issuers";
import path from "path";
import archiver from "archiver";
import type { Request, Response } from "express";

import { prisma } from "../config/prisma";
import type { AuthenticatedRequest } from "../types/auth";
import { emitirNfce, paymentsFromOrder } from "../services/nfce/emitir";
import { cancelarNfce } from "../services/nfce/cancelar";
import { generateDanfeA4Pdf, generateDanfePdf, formatCpfCnpjDanfe, buildCupomText, type DanfeInput } from "../services/nfce/danfe";
import { emitToTenant } from "../services/realtime.service";
import { sendWhatsappDocument } from "../services/whatsapp.service";
import { getReceiptFooter, isReceiptLogoEnabled } from "../../shared/receiptFooter";

const PAYMENT_LABELS: Record<string, string> = { money: "Dinheiro", pix: "PIX", debit: "Débito", credit: "Crédito", crediario: "Crediário" };

/** Reconstrói o PDF do DANFE A4 a partir dos dados já salvos (sem precisar do arquivo em disco) —
 * usado quando a nota foi autorizada em outro ambiente (ex.: produção) e este servidor não tem
 * o arquivo localmente. */
type DanfeInvoiceRef = { access_key: string | null; number: number; series: number; authorized_at: Date | null; protocol: string | null; qrcode_url: string | null };

async function buildDanfeInput(orderId: number, tenantId: number, invoice: DanfeInvoiceRef): Promise<DanfeInput | null> {
  if (!invoice.access_key || !invoice.qrcode_url) return null;
  const order = await prisma.order.findFirst({
    where: { id: orderId, tenant_id: tenantId },
    include: { items: { include: { product: true } } },
  });
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!order || !tenant) return null;

  const environment = tenant.nfce_environment === "producao" ? "producao" : "homologacao";
  const payments = paymentsFromOrder(order.payment_method, Number(order.total_amount), Number(order.change_amount) || 0);
  const paymentSummary = payments.map((p) => `${PAYMENT_LABELS[p.method] ?? p.method}: R$ ${p.amount.toFixed(2)}`).join(" + ");

  // Mesma prioridade usada em emitir.ts: documento avulso da venda primeiro, com
  // fallback pro documento cadastrado no cliente vinculado — sem isso, um pedido
  // com CNPJ só no Customer (não digitado avulso na venda) exibia "CONSUMIDOR NÃO
  // IDENTIFICADO" no PDF reconstruído mesmo o XML já enviado à SEFAZ tendo o CNPJ
  // certo (ele vem do mesmo fallback em emitir.ts, então diverge só aqui).
  let customerName: string | undefined;
  let customerDocument = order.customer_document ?? undefined;
  if (order.customer_id) {
    const customer = await prisma.customer.findUnique({ where: { id: order.customer_id }, select: { name: true, legal_name: true, document: true } });
    // Preferir a razão social (preenchida ao buscar o CNPJ na Receita) sobre o
    // nome/apelido cadastrado manualmente, que pode estar incompleto.
    customerName = customer?.legal_name || customer?.name || undefined;
    if (!customerDocument) customerDocument = customer?.document ?? undefined;
  }
  const customerLabel = customerDocument
    ? `CONSUMIDOR: ${customerName ?? ""} ${formatCpfCnpjDanfe(customerDocument)}`.trim()
    : "CONSUMIDOR NÃO IDENTIFICADO";

  let logoBuffer: Buffer | null = null;
  if (tenant.logo_url?.startsWith("/uploads/")) {
    try {
      logoBuffer = fs.readFileSync(path.join(process.cwd(), "public", tenant.logo_url));
    } catch {
      logoBuffer = null;
    }
  }

  return {
    receiptFooter: getReceiptFooter(tenant.policies),
    storeName: tenant.razao_social || tenant.name,
    storeDocument: `CNPJ: ${tenant.document ?? ""}`,
    storeStateRegistration: tenant.inscricao_estadual,
    logoBuffer,
    receiptLogo: isReceiptLogoEnabled(tenant.policies),
    storeAddress: [tenant.address_street, tenant.address_number, tenant.address_city, tenant.address_state].filter(Boolean).join(", "),
    chaveAcesso: invoice.access_key,
    numero: invoice.number,
    serie: invoice.series,
    emittedAt: invoice.authorized_at ?? new Date(),
    environment,
    protocol: invoice.protocol,
    // Item avulso (venda rápida sem cadastro no catálogo) não tem Product real — mesmo
    // fallback sintético usado na emissão original (ver emitir.ts).
    items: order.items.map((item) => {
      const product = item.product ?? {
        name: item.name || "Item avulso", sku: null, barcode: null, unidade_comercial: "UN",
      };
      return {
        code: product.barcode || product.sku || null,
        name: product.name,
        quantity: item.quantity,
        unit: product.unidade_comercial,
        unitPrice: Number(item.unit_price),
        total: Number(item.unit_price) * item.quantity,
      };
    }),
    totalAmount: Number(order.total_amount),
    // Mesma lógica de fallback usada em emitir.ts.
    surchargeAmount: order.surcharge_amount != null
      ? Number(order.surcharge_amount)
      : Math.max(0, Math.round((Number(order.total_amount) - (Number(order.gross_amount ?? order.total_amount) - Number(order.discount_amount ?? 0))) * 100) / 100),
    // Recalculado da diferença real entre pagamentos e total — mesma lógica de
    // emitir.ts, não depende só de order.change_amount (pode estar null).
    changeAmount: (() => {
      const paidTotal = payments.reduce((sum, p) => sum + p.amount, 0);
      const change = Math.round((paidTotal - Number(order.total_amount)) * 100) / 100;
      return change > 0 ? change : (order.change_amount ? Number(order.change_amount) : null);
    })(),
    qrCodeUrl: invoice.qrcode_url,
    paymentSummary,
    customerLabel,
  };
}

async function rebuildDanfePdf(orderId: number, tenantId: number, invoice: DanfeInvoiceRef, format: "a4" | "cupom" = "a4") {
  const input = await buildDanfeInput(orderId, tenantId, invoice);
  if (!input) return null;
  return (format === "cupom" ? generateDanfePdf : generateDanfeA4Pdf)(input);
}

/** Lojas que configuraram o rodapé recebem a versão atual também nas reimpressões.
 * A configuração desativada continua exigindo reconstrução para remover avisos antigos. */
async function hasReceiptFooterSettings(tenantId: number): Promise<boolean> {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { policies: true } });
  const policies = tenant?.policies as Record<string, unknown> | null | undefined;
  return Boolean(policies && typeof policies === "object" && policies.receipt_footer && typeof policies.receipt_footer === "object");
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

/** Produtos do pedido que ainda não têm dados fiscais completos (NCM de 8 dígitos, CFOP e CSOSN/CST) — a SEFAZ rejeita a nota sem eles. */
export async function fiscalCheckForOrder(req: Request, res: Response) {
  try {
    const orderId = Number(req.params.orderId);
    const tenantId = getTenantId(req);
    const order = await prisma.order.findFirst({
      where: { id: orderId, tenant_id: tenantId },
      select: { items: { select: { product: { select: { id: true, name: true, sku: true, ncm: true, cest: true, cfop: true, csosn: true, origem: true, unidade_comercial: true } } } } },
    });
    if (!order) { res.status(404).json({ error: "Venda não encontrada" }); return; }
    const seen = new Set<number>();
    const missing = [];
    for (const it of order.items) {
      const p = it.product;
      if (!p || seen.has(p.id)) continue;
      seen.add(p.id);
      const ncmOk = String(p.ncm ?? "").replace(/D/g, "").length === 8;
      if (!ncmOk || !p.cfop || !p.csosn) missing.push(p);
    }
    res.json({ products: missing });
  } catch {
    res.status(500).json({ error: "Não foi possível conferir os dados fiscais dos produtos" });
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

    // CPF/CNPJ do cliente é opcional na NFC-e (SEFAZ aceita "consumidor não
    // identificado" normalmente) — não bloquear a emissão por falta de documento.

    let invoice = await prisma.nfceInvoice.findFirst({ where: { order_id: orderId, tenant_id: tenantId } });
    if (invoice?.status === "authorized") { res.status(409).json({ error: "NFC-e já autorizada" }); return; }

    if (!invoice) {
      const issuerPick = await issuerForNote(req, tenantId); // várias empresas: pergunta de qual CNPJ emitir
      if (issuerPick.needChoice) { res.status(409).json({ error: "Escolha de qual CNPJ emitir a nota.", needIssuer: true, issuers: issuerPick.needChoice }); return; }
      const tenant = await fiscalTenant(tenantId, issuerPick.id);
      if (!tenant) { res.status(404).json({ error: "Loja não encontrada" }); return; }
      invoice = await prisma.$transaction(async (tx) => {
        const created = await tx.nfceInvoice.create({ data: {
          tenant_id: tenantId, order_id: orderId, status: "pending", environment: tenant.nfce_environment, issuer_id: issuerPick.id ?? (await activeIssuerId(tenantId)),
          series: tenant.nfce_series, number: tenant.nfce_next_number,
        }});
        await bumpNextNumber(tx as any, tenantId, issuerPick.id, "nfce_next_number");
        return created;
      });
      // a venda passa a ser do CNPJ que emitiu a nota (lucro e fluxo de caixa por CNPJ)
      if (issuerPick.id) {
        await prisma.order.update({ where: { id: orderId }, data: { issuer_id: issuerPick.id } });
        await prisma.finance.updateMany({ where: { order_id: orderId, tenant_id: tenantId }, data: { issuer_id: issuerPick.id } });
      }
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

/** Emite uma NFC-e de PRODUÇÃO (com valor fiscal real) pro mesmo pedido de uma nota que
 * hoje está autorizada em HOMOLOGAÇÃO (sem valor fiscal, por definição da própria SEFAZ).
 * Só age nesse caso específico — pra qualquer outro status, o fluxo normal (emit/retry)
 * já resolve. Guarda um snapshot da nota de homologação em `superseded_homologacao` antes
 * de sobrescrever o registro, preservando o rastro de que aquele teste existiu (o
 * `@unique` em order_id impede ter duas linhas — ver schema.prisma). Exige que o tenant já
 * esteja configurado para produção (não força a config por baixo dos panos numa ação tão
 * sensível — evita emitir em produção sem o certificado/CSC de produção estarem prontos). */
export async function emitNfceAsProduction(req: Request, res: Response) {
  try {
    const orderId = Number(req.params.orderId);
    const tenantId = getTenantId(req);

    const noteIssuer = (await prisma.nfceInvoice.findFirst({ where: { order_id: orderId, tenant_id: tenantId }, select: { issuer_id: true } }))?.issuer_id ?? null;
    const tenant = await fiscalTenant(tenantId, noteIssuer);
    if (!tenant) { res.status(404).json({ error: "Loja não encontrada" }); return; }
    if (tenant.nfce_environment !== "producao") {
      res.status(422).json({ error: "Configure o ambiente da loja para Produção (Configurações > Dados Fiscais) antes de emitir a nota de produção." });
      return;
    }

    const invoice = await prisma.nfceInvoice.findFirst({ where: { order_id: orderId, tenant_id: tenantId } });
    if (!invoice) { res.status(404).json({ error: "Nota fiscal não encontrada para este pedido" }); return; }
    if (invoice.status !== "authorized" || invoice.environment !== "homologacao") {
      res.status(409).json({ error: "Essa ação só se aplica a uma nota já autorizada em ambiente de Homologação." });
      return;
    }

    const homologacaoSnapshot = {
      access_key: invoice.access_key,
      protocol: invoice.protocol,
      authorized_at: invoice.authorized_at,
      series: invoice.series,
      number: invoice.number,
      xml_path: invoice.xml_path,
      danfe_path: invoice.danfe_path,
      qrcode_url: invoice.qrcode_url,
      superseded_at: new Date().toISOString(),
    };

    await prisma.$transaction(async (tx) => {
      await tx.nfceInvoice.update({
        where: { id: invoice.id },
        data: {
          status: "pending",
          environment: "producao",
          series: tenant.nfce_series,
          number: tenant.nfce_next_number,
          access_key: null,
          protocol: null,
          authorized_at: null,
          rejection_code: null,
          rejection_reason: null,
          xml_path: null,
          danfe_path: null,
          qrcode_url: null,
          attempts: 0,
          superseded_homologacao: homologacaoSnapshot,
        },
      });
      await bumpNextNumber(tx as any, tenantId, noteIssuer, "nfce_next_number");
    });

    emitToTenant(tenantId, "nfce:changed", { orderId });
    emitirNfce(orderId).catch((error) => console.error("[emitNfceAsProduction] erro:", error));
    res.json({ success: true });
  } catch (err) {
    console.error("emitNfceAsProduction error:", err);
    res.status(500).json({ error: "Falha ao emitir NFC-e de produção" });
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
    const freshFooter = await hasReceiptFooterSettings(tenantId);

    for (const invoice of invoices) {
      if (freshFooter) {
        const rebuilt = await rebuildDanfePdf(invoice.order_id, tenantId, invoice, "cupom");
        if (rebuilt) archive.append(rebuilt, { name: `danfe-${invoice.access_key ?? invoice.order_id}.pdf` });
      } else if (invoice.danfe_path && fs.existsSync(invoice.danfe_path)) {
        archive.file(invoice.danfe_path, { name: `danfe-${invoice.access_key ?? invoice.order_id}.pdf` });
      }
    }

    await archive.finalize();
  } catch {
    res.status(500).json({ error: "Failed to build DANFE batch" });
  }
}

// Cupom fiscal: a mesma NFC-e no formato estreito de impressora térmica (80 mm), gerado junto
// com o DANFE A4 na autorização. Se o arquivo não existir neste servidor, reconstrói do banco.
// Cupom fiscal em TEXTO (com marcador de QR Code) para o PDV imprimir direto na térmica. ?cols= = colunas do papel (padrão 42).
export async function getCupomText(req: Request, res: Response) {
  try {
    const orderId = Number(req.params.orderId);
    const tenantId = getTenantId(req);
    const invoice = await prisma.nfceInvoice.findFirst({ where: { order_id: orderId, tenant_id: tenantId } });
    if (!invoice) { res.status(404).json({ error: "Nota fiscal não encontrada para este pedido" }); return; }
    if (invoice.status !== "authorized") {
      res.status(409).json({ error: `Cupom indisponível — a NFC-e deste pedido ainda não foi autorizada (status atual: ${invoice.status}).` });
      return;
    }
    const input = await buildDanfeInput(orderId, tenantId, invoice);
    if (!input) { res.status(404).json({ error: "Não há dados suficientes para montar o cupom." }); return; }
    res.json({ text: buildCupomText(input, Number(req.query.cols) || 42) });
  } catch {
    res.status(500).json({ error: "Falha ao montar o cupom fiscal" });
  }
}

export async function downloadCupom(req: Request, res: Response) {
  try {
    const orderId = Number(req.params.orderId);
    const tenantId = getTenantId(req);
    const invoice = await prisma.nfceInvoice.findFirst({ where: { order_id: orderId, tenant_id: tenantId } });
    if (!invoice) {
      res.status(404).json({ error: "Nota fiscal não encontrada para este pedido" });
      return;
    }
    if (invoice.status !== "authorized") {
      res.status(409).json({ error: `Cupom indisponível — a NFC-e deste pedido ainda não foi autorizada (status atual: ${invoice.status}).` });
      return;
    }
    if (invoice.danfe_path && fs.existsSync(invoice.danfe_path) && !(await hasReceiptFooterSettings(tenantId))) {
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="cupom-${invoice.access_key ?? orderId}.pdf"`);
      fs.createReadStream(invoice.danfe_path).pipe(res);
      return;
    }
    const rebuilt = await rebuildDanfePdf(orderId, tenantId, invoice, "cupom");
    if (!rebuilt) {
      res.status(404).json({ error: "O cupom não está disponível neste servidor e não há dados suficientes para reconstruí-lo." });
      return;
    }
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="cupom-${invoice.access_key ?? orderId}.pdf"`);
    res.send(rebuilt);
  } catch {
    res.status(500).json({ error: "Falha ao gerar o cupom fiscal" });
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
    if (invoice.danfe_a4_path && fs.existsSync(invoice.danfe_a4_path) && !(await hasReceiptFooterSettings(tenantId))) {
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="danfe-${invoice.access_key ?? orderId}.pdf"`);
      fs.createReadStream(invoice.danfe_a4_path).pipe(res);
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

// Manda o DANFE já autorizado pro cliente pelo bot WhatsApp — mesmo PDF do botão
// "DANFE" (do disco, ou reconstruído se o arquivo não estiver neste servidor),
// só que enviado como documento em vez de baixado. O frontend só mostra esse
// botão quando o bot está conectado (GET /api/whatsapp/connection-status).
export async function sendNfceWhatsapp(req: Request, res: Response) {
  try {
    const orderId = Number(req.params.orderId);
    const tenantId = getTenantId(req);
    const { number } = req.body as { number?: string };

    const invoice = await prisma.nfceInvoice.findFirst({
      where: { order_id: orderId, tenant_id: tenantId },
    });
    if (!invoice) {
      res.status(404).json({ error: "Nota fiscal não encontrada para este pedido" });
      return;
    }
    if (invoice.status !== "authorized") {
      res.status(409).json({ error: `NFC-e ainda não autorizada (status atual: ${invoice.status}).` });
      return;
    }

    const order = await prisma.order.findFirst({
      where: { id: orderId, tenant_id: tenantId },
      select: { customer_phone: true },
    });
    const targetNumber = number || order?.customer_phone;
    if (!targetNumber) {
      res.status(422).json({ error: "Informe um número de WhatsApp — este pedido não tem telefone de cliente cadastrado." });
      return;
    }

    let pdfBuffer: Buffer;
    if (invoice.danfe_a4_path && fs.existsSync(invoice.danfe_a4_path) && !(await hasReceiptFooterSettings(tenantId))) {
      pdfBuffer = fs.readFileSync(invoice.danfe_a4_path);
    } else {
      const rebuilt = await rebuildDanfePdf(orderId, tenantId, invoice);
      if (!rebuilt) {
        res.status(404).json({ error: "O arquivo do DANFE não está disponível e não há dados suficientes para reconstruí-lo." });
        return;
      }
      pdfBuffer = rebuilt;
    }

    await sendWhatsappDocument(
      tenantId,
      targetNumber,
      pdfBuffer.toString("base64"),
      `danfe-${invoice.access_key ?? orderId}.pdf`,
      `Segue o DANFE da sua compra — NFC-e nº ${invoice.number}/${invoice.series}.`,
    );

    res.json({ success: true });
  } catch (err) {
    console.error("sendNfceWhatsapp error:", err);
    const message = err instanceof Error ? err.message : "Falha ao enviar NFC-e pelo WhatsApp";
    res.status(500).json({ error: message });
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
        where: { tenant_id: tenantId, ...(await issuerFilter(tenantId)) },
        include: { order: { select: { customer_name: true, total_amount: true } } },
        orderBy: { created_at: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.nfceInvoice.count({ where: { tenant_id: tenantId, ...(await issuerFilter(tenantId)) } }),
    ]);

    res.json({ invoices, total, page, pageSize });
  } catch {
    res.status(500).json({ error: "Failed to list NFC-e invoices" });
  }
}
