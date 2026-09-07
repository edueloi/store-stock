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
