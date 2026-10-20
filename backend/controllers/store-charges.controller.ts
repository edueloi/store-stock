import type { Request, Response } from "express";

import { prisma } from "../config/prisma";
import { createAsaasSubaccountPixTransfer, getAsaasSubaccountBalance, getAsaasSubaccountDocumentsLink, getAsaasSubaccountStatus } from "../services/billing/asaas.service";
import { createStoreCharge, ensureStoreWebhook, getStoreAsaasKey, onboardStoreAsaas, processStoreAsaasWebhook, type StoreChargeRules } from "../services/billing/store-charges.service";
import type { AuthenticatedRequest } from "../types/auth";

const tenantIdOf = (req: Request) => (req as AuthenticatedRequest).user.tenantId;
const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/** Abre a conta de recebimento (subconta Asaas) do lojista. A taxa da plataforma não é editável aqui. */
export async function onboardAsaas(req: Request, res: Response) {
  const b = req.body ?? {};
  const required = ["name", "email", "cpfCnpj", "mobilePhone", "address", "addressNumber", "province", "postalCode"];
  if (required.some((k) => typeof b[k] !== "string" || !b[k].trim()) || !(num(b.incomeValue) > 0)) {
    res.status(422).json({ error: "Preencha todos os dados cadastrais, incluindo renda/faturamento mensal." });
    return;
  }
  const isCpf = String(b.cpfCnpj).replace(/\D/g, "").length <= 11;
  if (isCpf && !b.birthDate) { res.status(422).json({ error: "Informe a data de nascimento." }); return; }
  if (!isCpf && !b.companyType) { res.status(422).json({ error: "Informe o tipo da empresa." }); return; }
  try {
    const out = await onboardStoreAsaas(tenantIdOf(req), {
      name: b.name, email: b.email, cpfCnpj: String(b.cpfCnpj).replace(/\D/g, ""),
      birthDate: b.birthDate, companyType: b.companyType, mobilePhone: String(b.mobilePhone).replace(/\D/g, ""),
      incomeValue: num(b.incomeValue), address: b.address, addressNumber: b.addressNumber,
      province: b.province, postalCode: String(b.postalCode).replace(/\D/g, ""),
    });
    res.json({ success: true, ...out });
  } catch (error) {
    res.status(502).json({ error: error instanceof Error ? error.message : "Não foi possível abrir a conta de recebimento." });
  }
}

/** Regras padrão (desconto, juros, multa) aplicadas às cobranças novas da loja. */
export async function saveChargeRules(req: Request, res: Response) {
  const b = req.body ?? {};
  const rules: StoreChargeRules = {
    discount: num(b.discount?.value) > 0 ? {
      value: num(b.discount.value), type: b.discount.type === "FIXED" ? "FIXED" : "PERCENTAGE",
      days: Math.max(0, Math.floor(num(b.discount.days))),
    } : undefined,
    interest: num(b.interest?.percent) > 0 ? { percent: Math.min(num(b.interest.percent), 1) } : undefined,
    fine: num(b.fine?.percent) > 0 ? { percent: Math.min(num(b.fine.percent), 2) } : undefined,
  };
  const out = await prisma.storePaymentGateway.updateMany({
    where: { tenant_id: tenantIdOf(req), provider: "asaas" },
    data: { rules: rules as object },
  });
  if (!out.count) { res.status(404).json({ error: "Conta de recebimento não configurada." }); return; }
  res.json({ success: true, rules });
}

/** Gera um link de pagamento (venda por link) a partir do PDV/painel. */
export async function createChargeLink(req: Request, res: Response) {
  const b = req.body ?? {};
  if (!b.customerName || !b.customerCpfCnpj) {
    res.status(422).json({ error: "Informe nome e CPF/CNPJ do cliente." });
    return;
  }
  try {
    const charge = await createStoreCharge({
      tenantId: tenantIdOf(req), value: num(b.value), customerName: String(b.customerName),
      customerCpfCnpj: String(b.customerCpfCnpj), customerEmail: b.customerEmail, customerPhone: b.customerPhone,
      description: b.description, dueDate: b.dueDate,
    });
    res.json(charge);
  } catch (error) {
    res.status(422).json({ error: error instanceof Error ? error.message : "Não foi possível gerar o link." });
  }
}

export async function listCharges(req: Request, res: Response) {
  const charges = await prisma.storeCharge.findMany({
    where: { tenant_id: tenantIdOf(req) }, orderBy: { created_at: "desc" }, take: 100,
  });
  res.json(charges);
}

/** Webhook público das subcontas — autenticado pelo authToken individual de cada loja. */
export async function storeAsaasWebhookHandler(req: Request, res: Response) {
  const tenantId = Number(req.params.tenantId);
  if (!Number.isInteger(tenantId)) { res.sendStatus(404); return; }
  try {
    const ok = await processStoreAsaasWebhook(tenantId, req.headers["asaas-access-token"], req.body);
    res.sendStatus(ok ? 200 : 401);
  } catch (error) {
    console.error("storeAsaasWebhookHandler error:", error);
    res.sendStatus(500);
  }
}

/** Situação do cadastro, saldo e link de documentos da conta de recebimento do lojista. */
export async function getAsaasAccountOverview(req: Request, res: Response) {
  try {
    const apiKey = await getStoreAsaasKey(tenantIdOf(req));
    await ensureStoreWebhook(tenantIdOf(req)).catch(() => {}); // tenta de novo se o webhook ficou pendente
    const [status, balance, documentsUrl] = await Promise.all([
      getAsaasSubaccountStatus(apiKey).catch(() => null),
      getAsaasSubaccountBalance(apiKey).catch(() => null),
      getAsaasSubaccountDocumentsLink(apiKey),
    ]);
    res.json({ status, balance, documentsUrl });
  } catch (error) {
    res.status(404).json({ error: error instanceof Error ? error.message : "Conta de recebimento indisponível." });
  }
}

const PIX_KEY_TYPES = ["CPF", "CNPJ", "EMAIL", "PHONE", "EVP"] as const;

/** Saque do saldo Asaas para uma chave Pix. Só o administrador da loja pode sacar. */
export async function withdrawAsaasBalance(req: Request, res: Response) {
  if ((req as AuthenticatedRequest).user.role !== "admin") {
    res.status(403).json({ error: "Somente o administrador da loja pode sacar." });
    return;
  }
  const b = req.body ?? {};
  const value = num(b.value);
  const type = PIX_KEY_TYPES.find((t) => t === b.pixKeyType);
  const key = typeof b.pixKey === "string" ? b.pixKey.trim() : "";
  if (!(value > 0) || !type || !key) {
    res.status(422).json({ error: "Informe o valor, o tipo e a chave Pix." });
    return;
  }
  try {
    const apiKey = await getStoreAsaasKey(tenantIdOf(req));
    const out = await createAsaasSubaccountPixTransfer(apiKey, {
      value: Math.round(value * 100) / 100, pixAddressKey: key, pixAddressKeyType: type, description: "Saque Box Sys",
    });
    res.json({ success: true, ...out });
  } catch (error) {
    res.status(422).json({ error: error instanceof Error ? error.message : "Não foi possível sacar." });
  }
}
