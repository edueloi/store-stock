import fs from "fs";
import type { Request, Response } from "express";

import { prisma } from "../config/prisma";
import type { AuthenticatedRequest } from "../types/auth";
import { activeIssuerId, bumpNextNumber, fiscalTenant, issuerClause, issuerForNote } from "../utils/issuers";
import { emitirNfe, cancelarNfe } from "../services/nfe/emitir";
import { ibgeCityCode } from "../services/nfe/ibge";
import type { NfeFreight, NfeFreightMode, NfeRecipient } from "../services/nfe/xmlBuilder";
import { isValidCpfCnpj } from "../services/nfce/emitir";
import { emitToTenant } from "../services/realtime.service";

const getTenantId = (req: Request) => (req as AuthenticatedRequest).user.tenantId as number;
const digits = (v: unknown) => String(v ?? "").replace(/\D/g, "");
const text = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
const FREIGHT_MODES: NfeFreightMode[] = ["0", "1", "2", "3", "4", "9"];

/** Destinatário a partir do cadastro do cliente (sugestão que o operador confere no modal). */
async function suggestRecipient(order: { customer_id: number | null; customer_name: string | null; customer_document: string | null; customer_email: string | null; customer_phone: string | null }): Promise<NfeRecipient | null> {
  const c = order.customer_id
    ? await prisma.customer.findUnique({ where: { id: order.customer_id } })
    : null;
  const document = digits(c?.document ?? order.customer_document);
  if (!c && !document) return null;
  const ie = digits(c?.state_registration);
  const ieIndicator: "1" | "2" | "9" = c?.state_registration_exempt ? "2" : (digits(document).length === 14 && ie ? "1" : "9");
  const state = String(c?.address_state ?? "").toUpperCase();
  const ibge = await ibgeCityCode({ zip: c?.address_zip, city: c?.address_city, state });
  return {
    document,
    name: text(c?.legal_name || c?.name || order.customer_name, 60),
    ie_indicator: ieIndicator,
    ie: ie || null,
    email: text(c?.nfe_email || c?.email || order.customer_email, 60) || null,
    phone: digits(c?.phone ?? order.customer_phone) || null,
    address: {
      street: text(c?.address_street, 60), number: text(c?.address_number, 60) || "S/N", complement: text(c?.address_complement, 60) || null,
      district: text(c?.address_district, 60), city: text(ibge?.city || c?.address_city, 60), state: state || ibge?.state || "",
      zip: digits(c?.address_zip), city_code: ibge?.code ?? "",
    },
  };
}

/** Confere o destinatário e devolve a lista do que falta (nomes dos campos, em português). */
function recipientProblems(r: NfeRecipient | null | undefined): string[] {
  const p: string[] = [];
  if (!r) return ["destinatário"];
  if (!isValidCpfCnpj(r.document)) p.push("CPF/CNPJ válido");
  if (text(r.name, 60).length < 2) p.push("nome/razão social");
  if (!["1", "2", "9"].includes(r.ie_indicator)) p.push("indicador de inscrição estadual");
  if (r.ie_indicator === "1" && digits(r.ie).length < 2) p.push("inscrição estadual (cliente contribuinte)");
  const a = r.address ?? ({} as NfeRecipient["address"]);
  if (!text(a.street, 60)) p.push("rua");
  if (!text(a.number, 60)) p.push("número");
  if (!text(a.district, 60)) p.push("bairro");
  if (!text(a.city, 60)) p.push("cidade");
  if (!/^[A-Za-z]{2}$/.test(String(a.state ?? ""))) p.push("UF");
  if (digits(a.zip).length !== 8) p.push("CEP (8 dígitos)");
  if (digits(a.city_code).length !== 7) p.push("código IBGE do município");
  return p;
}

function normalizeRecipient(r: NfeRecipient): NfeRecipient {
  const doc = digits(r.document);
  return {
    document: doc,
    name: text(r.name, 60),
    ie_indicator: (["1", "2", "9"].includes(r.ie_indicator) ? r.ie_indicator : "9") as "1" | "2" | "9",
    ie: r.ie_indicator === "1" ? digits(r.ie) || null : null,
    email: text(r.email, 60) || null,
    phone: digits(r.phone) || null,
    address: {
      street: text(r.address?.street, 60), number: text(r.address?.number, 60) || "S/N", complement: text(r.address?.complement, 60) || null,
      district: text(r.address?.district, 60), city: text(r.address?.city, 60), state: text(r.address?.state, 2).toUpperCase(),
      zip: digits(r.address?.zip), city_code: digits(r.address?.city_code),
    },
  };
}

function normalizeFreight(f: Partial<NfeFreight> | undefined): NfeFreight {
  const mode = FREIGHT_MODES.includes(f?.mode as NfeFreightMode) ? (f!.mode as NfeFreightMode) : "9";
  const value = mode === "9" ? 0 : Math.max(0, Math.round((Number(f?.value) || 0) * 100) / 100);
  const c = f?.carrier;
  return {
    mode, value,
    carrier: mode !== "9" && c && text(c.name, 60)
      ? { document: digits(c.document) || null, name: text(c.name, 60), ie: digits(c.ie) || null, address: text(c.address, 60) || null, city: text(c.city, 60) || null, state: text(c.state, 2).toUpperCase() || null }
      : null,
  };
}

/** GET /api/nfe/recipient/:customerId — monta o destinatário a partir de um cliente cadastrado (documento, IE, endereço e código do município). */
export async function recipientFromCustomer(req: Request, res: Response) {
  try {
    const id = Number(req.params.customerId);
    const customer = await prisma.customer.findFirst({ where: { id, tenant_id: getTenantId(req) }, select: { id: true } });
    if (!customer) { res.status(404).json({ error: "Cliente não encontrado" }); return; }
    const recipient = await suggestRecipient({ customer_id: id, customer_name: null, customer_document: null, customer_email: null, customer_phone: null });
    res.json({ recipient, problems: recipientProblems(recipient) });
  } catch (e) {
    console.error("[recipientFromCustomer]", e);
    res.status(500).json({ error: "Não foi possível carregar o cliente." });
  }
}

/** GET /api/nfe/:orderId/preview — o que o modal "Emitir NF-e" precisa para abrir já preenchido. */
export async function previewNfe(req: Request, res: Response) {
  try {
    const orderId = Number(req.params.orderId);
    const tenantId = getTenantId(req);
    const order = await prisma.order.findFirst({
      where: { id: orderId, tenant_id: tenantId },
      include: { items: { include: { product: { select: { id: true, name: true, ncm: true, cfop: true, csosn: true } } } } },
    });
    if (!order) { res.status(404).json({ error: "Pedido não encontrado" }); return; }

    const invoice = await prisma.nfeInvoice.findUnique({ where: { order_id: orderId } });
    const recipient = (invoice?.recipient as unknown as NfeRecipient | null) ?? (await suggestRecipient(order));
    const tenant = await fiscalTenant(tenantId, order.issuer_id ?? (await activeIssuerId(tenantId)));

    const warnings: string[] = [];
    if (order.items.length === 0) warnings.push("Este pedido não tem produtos: NF-e é para mercadoria. Serviço sai pela NFS-e.");
    for (const it of order.items) {
      const ncm = digits(it.product?.ncm ?? it.ncm);
      if (ncm.length !== 8) warnings.push(`"${it.product?.name ?? it.name ?? "Item"}" está sem NCM de 8 dígitos.`);
    }
    if (!tenant?.nfce_cert_path) warnings.push("Este CNPJ ainda não tem certificado digital cadastrado (Configurações > Dados Fiscais).");

    res.json({
      order: { id: order.id, total_amount: Number(order.total_amount), customer_name: order.customer_name, items_count: order.items.length, order_label: order.order_label },
      recipient,
      recipient_problems: recipientProblems(recipient),
      issuer: { document: tenant?.document ?? null, state: tenant?.address_state ?? null },
      environment: tenant?.nfce_environment === "producao" ? "producao" : "homologacao",
      series: (tenant as { nfe_series?: number | null } | null)?.nfe_series ?? 1,
      next_number: (tenant as { nfe_next_number?: number | null } | null)?.nfe_next_number ?? 1,
      defaults: {
        nature: invoice?.nature ?? "Venda de mercadoria",
        freight: (invoice?.freight as unknown as NfeFreight | null) ?? { mode: "9", value: 0, carrier: null },
        ind_pres: invoice?.ind_pres ?? "1",
        additional_info: invoice?.additional_info ?? (order.order_label ? `Obra/Ref.: ${order.order_label}` : ""),
        final_consumer: invoice?.final_consumer ?? null,
      },
      invoice,
      warnings,
    });
  } catch (e) {
    console.error("[previewNfe]", e);
    res.status(500).json({ error: "Não foi possível preparar a NF-e deste pedido." });
  }
}

interface EmitBody {
  recipient?: NfeRecipient;
  freight?: Partial<NfeFreight>;
  nature?: string;
  additional_info?: string;
  ind_pres?: string;
  final_consumer?: boolean;
}

/** Cria (ou atualiza, se ainda não foi autorizada) a NF-e do pedido e inicia a emissão. */
async function createOrUpdateAndEmit(req: Request, res: Response, isRetry: boolean) {
  try {
    const orderId = Number(req.params.orderId);
    const tenantId = getTenantId(req);
    const body = (req.body ?? {}) as EmitBody;

    const order = await prisma.order.findFirst({ where: { id: orderId, tenant_id: tenantId }, select: { id: true, issuer_id: true } });
    if (!order) { res.status(404).json({ error: "Pedido não encontrado" }); return; }

    let invoice = await prisma.nfeInvoice.findUnique({ where: { order_id: orderId } });
    if (invoice?.status === "authorized") { res.status(409).json({ error: "NF-e já autorizada" }); return; }
    if (isRetry && !invoice) { res.status(404).json({ error: "NF-e não encontrada para este pedido" }); return; }

    // dados: os enviados agora; senão os guardados da tentativa anterior
    const recipient = body.recipient ? normalizeRecipient(body.recipient) : (invoice?.recipient as unknown as NfeRecipient | null);
    const problems = recipientProblems(recipient);
    if (problems.length) {
      res.status(422).json({ error: `Confira os dados do destinatário. Falta: ${problems.join(", ")}.`, fields: problems });
      return;
    }
    const freight = body.freight ? normalizeFreight(body.freight) : ((invoice?.freight as unknown as NfeFreight | null) ?? normalizeFreight(undefined));
    const data = {
      nature: text(body.nature ?? invoice?.nature ?? "Venda de mercadoria", 60) || "Venda de mercadoria",
      recipient: recipient as unknown as object,
      freight: freight as unknown as object,
      additional_info: body.additional_info !== undefined ? text(body.additional_info, 2000) || null : invoice?.additional_info ?? null,
      ind_pres: body.ind_pres === "9" ? "9" : (invoice?.ind_pres === "9" && body.ind_pres === undefined ? "9" : "1"),
      final_consumer: body.final_consumer !== undefined ? !!body.final_consumer : (invoice?.final_consumer ?? recipient!.ie_indicator === "9"),
    };

    if (!invoice) {
      const issuerPick = await issuerForNote(req, tenantId, order.issuer_id);
      if (issuerPick.needChoice) { res.status(409).json({ error: "Escolha de qual CNPJ emitir a nota.", needIssuer: true, issuers: issuerPick.needChoice }); return; }
      const tenant = await fiscalTenant(tenantId, issuerPick.id);
      if (!tenant) { res.status(404).json({ error: "Loja não encontrada" }); return; }
      const t = tenant as unknown as { nfe_series?: number | null; nfe_next_number?: number | null; nfce_environment: string };
      invoice = await prisma.$transaction(async (tx) => {
        const created = await tx.nfeInvoice.create({
          data: {
            tenant_id: tenantId, order_id: orderId, status: "pending", environment: t.nfce_environment, issuer_id: issuerPick.id ?? (await activeIssuerId(tenantId)),
            series: t.nfe_series ?? 1, number: t.nfe_next_number ?? 1, ...data,
          },
        });
        await bumpNextNumber(tx as never, tenantId, issuerPick.id, "nfe_next_number");
        return created;
      });
      if (issuerPick.id) await prisma.order.update({ where: { id: orderId }, data: { issuer_id: issuerPick.id } });
    } else {
      invoice = await prisma.nfeInvoice.update({ where: { id: invoice.id }, data: { status: "pending", ...data } });
    }

    emitToTenant(tenantId, "nfe:changed", { orderId });
    emitirNfe(orderId).catch((e) => console.error("[emitNfe] erro:", e));
    res.json(invoice);
  } catch (e) {
    console.error("[emitNfe]", e);
    res.status(500).json({ error: "Não foi possível iniciar a emissão da NF-e." });
  }
}

export const emitNfe = (req: Request, res: Response) => createOrUpdateAndEmit(req, res, false);
export const retryNfe = (req: Request, res: Response) => createOrUpdateAndEmit(req, res, true);

export async function getNfeByOrder(req: Request, res: Response) {
  try {
    const invoice = await prisma.nfeInvoice.findFirst({ where: { order_id: Number(req.params.orderId), tenant_id: getTenantId(req) } });
    if (!invoice) { res.status(404).json({ error: "NF-e não encontrada para este pedido" }); return; }
    res.json(invoice);
  } catch {
    res.status(500).json({ error: "Falha ao buscar a NF-e" });
  }
}

export async function listNfe(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(200, Math.max(1, Number(req.query.pageSize) || 50));
    const where = { tenant_id: tenantId, AND: await issuerClause(req, tenantId) };
    const [invoices, total] = await Promise.all([
      prisma.nfeInvoice.findMany({
        where, orderBy: { created_at: "desc" }, skip: (page - 1) * pageSize, take: pageSize,
        include: { order: { select: { customer_name: true, total_amount: true, order_label: true } } },
      }),
      prisma.nfeInvoice.count({ where }),
    ]);
    res.json({ invoices, total, page, pageSize });
  } catch {
    res.status(500).json({ error: "Falha ao listar as NF-e" });
  }
}

export async function downloadNfeDanfe(req: Request, res: Response) {
  try {
    const invoice = await prisma.nfeInvoice.findFirst({ where: { order_id: Number(req.params.orderId), tenant_id: getTenantId(req) } });
    if (!invoice) { res.status(404).json({ error: "NF-e não encontrada para este pedido" }); return; }
    if (invoice.status !== "authorized" && invoice.status !== "cancelled") { res.status(409).json({ error: `DANFE indisponível: a NF-e ainda não foi autorizada (status: ${invoice.status}).` }); return; }
    if (!invoice.danfe_path || !fs.existsSync(invoice.danfe_path)) { res.status(404).json({ error: "O arquivo do DANFE não foi encontrado neste servidor." }); return; }
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="danfe-${invoice.access_key ?? invoice.order_id}.pdf"`);
    fs.createReadStream(invoice.danfe_path).pipe(res);
  } catch {
    res.status(500).json({ error: "Falha ao baixar o DANFE" });
  }
}

export async function downloadNfeXml(req: Request, res: Response) {
  try {
    const invoice = await prisma.nfeInvoice.findFirst({ where: { order_id: Number(req.params.orderId), tenant_id: getTenantId(req) } });
    if (!invoice) { res.status(404).json({ error: "NF-e não encontrada para este pedido" }); return; }
    if (!invoice.xml_path || !fs.existsSync(invoice.xml_path)) { res.status(404).json({ error: "O XML da NF-e não foi encontrado neste servidor." }); return; }
    res.setHeader("Content-Type", "application/xml");
    res.setHeader("Content-Disposition", `attachment; filename="nfe-${invoice.access_key ?? invoice.order_id}.xml"`);
    fs.createReadStream(invoice.xml_path).pipe(res);
  } catch {
    res.status(500).json({ error: "Falha ao baixar o XML" });
  }
}

export async function cancelNfe(req: Request, res: Response) {
  try {
    const orderId = Number(req.params.orderId);
    const tenantId = getTenantId(req);
    const invoice = await prisma.nfeInvoice.findFirst({ where: { order_id: orderId, tenant_id: tenantId } });
    if (!invoice) { res.status(404).json({ error: "NF-e não encontrada para este pedido" }); return; }
    const reason = String((req.body as { reason?: string })?.reason ?? "");
    const result = await cancelarNfe(orderId, reason);
    if (!result.success) { res.status(422).json({ error: result.error }); return; }
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Falha ao cancelar a NF-e" });
  }
}

export async function deleteNfe(req: Request, res: Response) {
  try {
    const orderId = Number(req.params.orderId);
    const tenantId = getTenantId(req);
    const invoice = await prisma.nfeInvoice.findFirst({ where: { order_id: orderId, tenant_id: tenantId } });
    if (!invoice) { res.status(404).json({ error: "NF-e não encontrada para este pedido" }); return; }
    if (invoice.status === "authorized") { res.status(400).json({ error: "NF-e autorizada não pode ser excluída. Cancele-a." }); return; }
    await prisma.nfeInvoice.delete({ where: { id: invoice.id } });
    emitToTenant(tenantId, "nfe:changed", { orderId });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Falha ao excluir a NF-e" });
  }
}

/** GET /api/nfe/ibge?zip=&city=&uf= — código IBGE do município (cMun do destinatário). */
export async function lookupIbge(req: Request, res: Response) {
  try {
    const found = await ibgeCityCode({ zip: String(req.query.zip ?? ""), city: String(req.query.city ?? ""), state: String(req.query.uf ?? "") });
    if (!found) { res.status(404).json({ error: "Não achei o código do município. Confira o CEP, a cidade e a UF." }); return; }
    res.json(found);
  } catch {
    res.status(500).json({ error: "Falha ao consultar o município" });
  }
}
