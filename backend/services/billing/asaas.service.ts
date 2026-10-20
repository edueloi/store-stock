import axios, { type AxiosInstance } from "axios";

import { env } from "../../config/env";

const BASE_URLS: Record<"sandbox" | "production", string> = {
  sandbox: "https://api-sandbox.asaas.com/v3",
  production: "https://api.asaas.com/v3",
};

function client(): AxiosInstance {
  return axios.create({
    baseURL: BASE_URLS[env.asaasEnvironment],
    headers: { access_token: env.asaasApiKey, "Content-Type": "application/json" },
    timeout: 15000,
  });
}

// Nunca logar o corpo do erro do axios sem filtrar — pode ecoar o header access_token
// de volta (algumas respostas de erro do Asaas incluem os headers da requisição).
function asaasErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const firstError = error.response?.data?.errors?.[0]?.description;
    if (firstError) return firstError;
    const message = error.response?.data?.message; // ex.: 403 sem lista `errors`
    if (typeof message === "string" && message) return message;
    return `Asaas respondeu ${error.response?.status ?? "sem status"}`;
  }
  if (error instanceof Error) return error.message;
  return "Erro desconhecido ao chamar a API do Asaas";
}

export interface AsaasCustomerInput {
  name: string;
  cpfCnpj: string;
  email?: string;
  mobilePhone?: string;
  externalReference?: string;
}

export interface AsaasCustomer {
  id: string;
  name: string;
  cpfCnpj: string;
}

export async function createAsaasCustomer(input: AsaasCustomerInput): Promise<AsaasCustomer> {
  try {
    const { data } = await client().post("/customers", input);
    return data;
  } catch (error) {
    throw new Error(`Falha ao criar cliente no Asaas: ${asaasErrorMessage(error)}`);
  }
}

export type AsaasBillingCycle =
  | "WEEKLY"
  | "BIWEEKLY"
  | "MONTHLY"
  | "BIMONTHLY"
  | "QUARTERLY"
  | "SEMIANNUALLY"
  | "YEARLY";

export interface AsaasSubscriptionInput {
  customer: string;
  value: number;
  nextDueDate: string; // "YYYY-MM-DD"
  cycle: AsaasBillingCycle;
  description?: string;
  externalReference?: string;
}

export interface AsaasSubscription {
  id: string;
  customer: string;
  status: "ACTIVE" | "EXPIRED" | "INACTIVE";
  value: number;
  nextDueDate: string;
  cycle: AsaasBillingCycle;
}

export async function createAsaasSubscription(input: AsaasSubscriptionInput): Promise<AsaasSubscription> {
  try {
    const { data } = await client().post("/subscriptions", { ...input, billingType: "UNDEFINED" });
    return data;
  } catch (error) {
    throw new Error(`Falha ao criar assinatura no Asaas: ${asaasErrorMessage(error)}`);
  }
}

export async function getAsaasSubscription(subscriptionId: string): Promise<AsaasSubscription> {
  try {
    const { data } = await client().get(`/subscriptions/${subscriptionId}`);
    return data;
  } catch (error) {
    throw new Error(`Falha ao consultar assinatura no Asaas: ${asaasErrorMessage(error)}`);
  }
}

export interface AsaasPayment {
  id: string;
  subscription?: string;
  status: string;
  value: number;
  dueDate: string;
  paymentDate?: string | null;
  billingType?: string | null;
  invoiceUrl?: string | null;
}

export async function listAsaasSubscriptionPayments(subscriptionId: string): Promise<AsaasPayment[]> {
  try {
    const { data } = await client().get(`/subscriptions/${subscriptionId}/payments`);
    return data?.data ?? [];
  } catch (error) {
    throw new Error(`Falha ao listar cobranças da assinatura no Asaas: ${asaasErrorMessage(error)}`);
  }
}

export async function getAsaasPayment(paymentId: string): Promise<AsaasPayment> {
  try {
    const { data } = await client().get(`/payments/${paymentId}`);
    return data;
  } catch (error) {
    throw new Error(`Falha ao consultar cobrança no Asaas: ${asaasErrorMessage(error)}`);
  }
}

export async function cancelAsaasSubscription(subscriptionId: string): Promise<void> {
  try {
    await client().delete(`/subscriptions/${subscriptionId}`);
  } catch (error) {
    throw new Error(`Falha ao cancelar assinatura no Asaas: ${asaasErrorMessage(error)}`);
  }
}

// --- Subcontas (white label) e cobranças do lojista ---------------------------------
// As funções abaixo operam em nome do LOJISTA: usam a apiKey da subconta dele, nunca a
// chave raiz da plataforma (que só cria subcontas). O dinheiro cai na conta do lojista e
// a taxa da plataforma sai por `split` para o walletId da raiz.

function clientWithKey(apiKey: string): AxiosInstance {
  return axios.create({
    baseURL: BASE_URLS[env.asaasEnvironment],
    headers: { access_token: apiKey, "Content-Type": "application/json" },
    timeout: 15000,
  });
}

export interface AsaasSubaccountInput {
  name: string;
  email: string;
  cpfCnpj: string;
  birthDate?: string; // obrigatório para CPF — "YYYY-MM-DD"
  companyType?: "MEI" | "LIMITED" | "INDIVIDUAL" | "ASSOCIATION"; // obrigatório para CNPJ
  mobilePhone: string;
  incomeValue: number;
  address: string;
  addressNumber: string;
  province: string;
  postalCode: string;
}

export interface AsaasSubaccount {
  id: string;
  apiKey: string; // devolvida UMA única vez, na criação — gravar cifrada
  walletId: string;
}

export async function createAsaasSubaccount(input: AsaasSubaccountInput): Promise<AsaasSubaccount> {
  try {
    const { data } = await client().post("/accounts", input);
    return data;
  } catch (error) {
    throw new Error(`Falha ao criar subconta no Asaas: ${asaasErrorMessage(error)}`);
  }
}

/** walletId da conta raiz da plataforma — destino do split. */
export async function getPlatformWalletId(): Promise<string> {
  try {
    const { data } = await client().get("/wallets/");
    const id = data?.data?.[0]?.id;
    if (!id) throw new Error("nenhuma carteira retornada");
    return id;
  } catch (error) {
    throw new Error(`Falha ao consultar carteira da plataforma no Asaas: ${asaasErrorMessage(error)}`);
  }
}

export async function configureSubaccountWebhook(apiKey: string, url: string, authToken: string, email: string): Promise<void> {
  try {
    await clientWithKey(apiKey).post("/webhooks", {
      name: "Box Sys - cobranças da loja",
      url,
      email, // o Asaas avisa por e-mail se a fila de webhooks for pausada
      enabled: true,
      interrupted: false,
      apiVersion: 3,
      authToken,
      sendType: "SEQUENTIALLY",
      events: ["PAYMENT_CONFIRMED", "PAYMENT_RECEIVED", "PAYMENT_OVERDUE", "PAYMENT_REFUNDED", "PAYMENT_DELETED"],
    });
  } catch (error) {
    throw new Error(`Falha ao configurar webhook da subconta no Asaas: ${asaasErrorMessage(error)}`);
  }
}

export async function createAsaasSubaccountCustomer(apiKey: string, input: AsaasCustomerInput): Promise<AsaasCustomer> {
  try {
    const { data } = await clientWithKey(apiKey).post("/customers", input);
    return data;
  } catch (error) {
    throw new Error(`Falha ao criar cliente no Asaas: ${asaasErrorMessage(error)}`);
  }
}

export interface AsaasChargeInput {
  customer: string;
  value: number;
  dueDate: string; // "YYYY-MM-DD"
  billingType?: "UNDEFINED" | "PIX" | "BOLETO" | "CREDIT_CARD";
  description?: string;
  externalReference?: string;
  discount?: { value: number; dueDateLimitDays: number; type: "FIXED" | "PERCENTAGE" };
  interest?: { value: number }; // % ao mês
  fine?: { value: number }; // % sobre o valor
  split?: Array<{ walletId: string; percentualValue?: number; fixedValue?: number }>;
}

export async function createAsaasSubaccountCharge(apiKey: string, input: AsaasChargeInput): Promise<AsaasPayment> {
  try {
    const { data } = await clientWithKey(apiKey).post("/payments", { billingType: "UNDEFINED", ...input });
    return data;
  } catch (error) {
    throw new Error(`Falha ao criar cobrança no Asaas: ${asaasErrorMessage(error)}`);
  }
}

export async function cancelAsaasSubaccountCharge(apiKey: string, paymentId: string): Promise<void> {
  try {
    await clientWithKey(apiKey).delete(`/payments/${paymentId}`);
  } catch (error) {
    throw new Error(`Falha ao cancelar cobrança no Asaas: ${asaasErrorMessage(error)}`);
  }
}

// --- Conta do lojista: saldo, situação cadastral e saque ----------------------------

export async function getAsaasSubaccountBalance(apiKey: string): Promise<number> {
  try {
    const { data } = await clientWithKey(apiKey).get("/finance/balance");
    return Number(data?.balance ?? 0);
  } catch (error) {
    throw new Error(`Falha ao consultar saldo no Asaas: ${asaasErrorMessage(error)}`);
  }
}

export interface AsaasAccountStatus {
  general?: string;
  commercialInfo?: string;
  bankAccountInfo?: string;
  documentation?: string;
}

export async function getAsaasSubaccountStatus(apiKey: string): Promise<AsaasAccountStatus> {
  try {
    const { data } = await clientWithKey(apiKey).get("/myAccount/status");
    return data ?? {};
  } catch (error) {
    throw new Error(`Falha ao consultar situação da conta no Asaas: ${asaasErrorMessage(error)}`);
  }
}

/** Link (onboardingUrl) para o lojista enviar os documentos pendentes, quando houver. */
export async function getAsaasSubaccountDocumentsLink(apiKey: string): Promise<string | null> {
  try {
    const { data } = await clientWithKey(apiKey).get("/myAccount/documents");
    const pending = (data?.data ?? []).find((d: { onboardingUrl?: string; status?: string }) => d.onboardingUrl && d.status !== "APPROVED");
    return pending?.onboardingUrl ?? null;
  } catch {
    return null; // informativo: a ausência do link não deve derrubar a tela
  }
}

export type AsaasPixKeyType = "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "EVP";

export async function createAsaasSubaccountPixTransfer(
  apiKey: string,
  input: { value: number; pixAddressKey: string; pixAddressKeyType: AsaasPixKeyType; description?: string },
): Promise<{ id: string; status: string }> {
  try {
    const { data } = await clientWithKey(apiKey).post("/transfers", { ...input, operationType: "PIX" });
    return { id: data.id, status: data.status };
  } catch (error) {
    throw new Error(`Falha ao solicitar saque no Asaas: ${asaasErrorMessage(error)}`);
  }
}
