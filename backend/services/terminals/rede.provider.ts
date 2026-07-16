import type {
  ITerminalProvider,
  TerminalChargeRequest,
  TerminalProviderConfig,
  TerminalTransaction,
} from "./terminal.interface";

// e.Rede API v1 usa Basic Auth direto (PV:Token) em todos os endpoints de transação —
// não há OAuth2/Bearer para essas chamadas (confirmado com credenciais reais de
// sandbox em 16/07/2026; a collection Postman oficial da Rede usa Basic Auth em
// /v1/transactions, não o fluxo oauth2/token, que serve a outro propósito).
const SANDBOX_BASE = "https://sandbox-erede.useredecloud.com.br";
const PROD_BASE = "https://api.userede.com.br/erede";

// Resposta da criação da transação (POST /v1/transactions) — campos no nível raiz.
interface RedeAuthorizationResponse {
  returnCode: string;
  returnMessage: string;
  tid?: string;
  nsu?: string;
  authorizationCode?: string;
  brandTid?: string;
  amount?: number;
  installments?: number;
  kind?: string;
  cardBin?: string;
  last4?: string;
  dateTime?: string;
  reference?: string;
}

// Resposta da consulta (GET /v1/transactions/:tid) — campos aninhados em "authorization".
interface RedeQueryResponse {
  requestDateTime?: string;
  authorization?: {
    returnCode: string;
    returnMessage: string;
    status?: string;
    tid?: string;
    nsu?: string;
    authorizationCode?: string;
    amount?: number;
    installments?: number;
    kind?: string;
    cardBin?: string;
    last4?: string;
    dateTime?: string;
    reference?: string;
  };
}

// Resposta do cancelamento/refund (POST /v1/transactions/:tid/refunds).
// Sucesso vem com returnCode "359" ("Refund successful"), não "00".
interface RedeRefundResponse {
  refundId?: string;
  tid?: string;
  nsu?: string;
  refundDateTime?: string;
  returnCode: string;
  returnMessage: string;
}

export class RedeProvider implements ITerminalProvider {
  readonly provider = "rede" as const;

  private clientId: string;
  private clientSecret: string;
  private sandbox: boolean;

  constructor(config: TerminalProviderConfig) {
    this.clientId = config.credentials.clientId;
    this.clientSecret = config.credentials.clientSecret;
    this.sandbox = config.sandbox;
  }

  private get baseUrl() {
    return this.sandbox ? SANDBOX_BASE : PROD_BASE;
  }

  private get basicAuthHeader(): string {
    return `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64")}`;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: this.basicAuthHeader,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const text = await res.text();
    if (!res.ok) {
      throw new Error(`Rede API ${method} ${path} → ${res.status}: ${text}`);
    }

    return (text ? JSON.parse(text) : {}) as T;
  }

  private mapBrand(cardBin?: string): string {
    // A API da Rede não devolve o nome da bandeira diretamente — deriva do prefixo do BIN.
    if (!cardBin) return "unknown";
    const prefix = cardBin.charAt(0);
    if (prefix === "4") return "visa";
    if (prefix === "5") return "mastercard";
    if (prefix === "3") return "amex";
    return "unknown";
  }

  // returnCode "00" = autorizada; "359" = estorno/cancelamento bem-sucedido.
  // Demais códigos de negação variam, mas não há uma lista pública exaustiva —
  // tratamos qualquer coisa fora dos dois casos de sucesso como "denied"/"error"
  // conforme o contexto de onde a resposta veio.
  private mapAuthorizationStatus(returnCode: string): TerminalTransaction["status"] {
    if (returnCode === "00") return "approved";
    return "denied";
  }

  private toTransactionFromAuthorization(raw: RedeAuthorizationResponse): TerminalTransaction {
    return {
      id: raw.tid ?? "",
      status: this.mapAuthorizationStatus(raw.returnCode),
      amount: (raw.amount ?? 0) / 100,
      installments: raw.installments ?? 1,
      mode: raw.kind?.toLowerCase() === "debit" ? "debit" : "credit",
      brand: this.mapBrand(raw.cardBin),
      authorizationCode: raw.authorizationCode,
      nsu: raw.nsu,
      cardLastDigits: raw.last4,
      occurredAt: raw.dateTime ? new Date(raw.dateTime) : new Date(),
      rawResponse: raw,
    };
  }

  private toTransactionFromQuery(raw: RedeQueryResponse): TerminalTransaction {
    const a = raw.authorization;
    return {
      id: a?.tid ?? "",
      status: this.mapAuthorizationStatus(a?.returnCode ?? ""),
      amount: (a?.amount ?? 0) / 100,
      installments: a?.installments ?? 1,
      mode: a?.kind?.toLowerCase() === "debit" ? "debit" : "credit",
      brand: this.mapBrand(a?.cardBin),
      authorizationCode: a?.authorizationCode,
      nsu: a?.nsu,
      cardLastDigits: a?.last4,
      occurredAt: a?.dateTime ? new Date(a.dateTime) : new Date(),
      rawResponse: raw,
    };
  }

  private toTransactionFromRefund(raw: RedeRefundResponse, amount: number): TerminalTransaction {
    return {
      id: raw.tid ?? "",
      status: raw.returnCode === "359" ? "cancelled" : "error",
      amount,
      installments: 1,
      mode: "credit",
      brand: "unknown",
      nsu: raw.nsu,
      occurredAt: raw.refundDateTime ? new Date(raw.refundDateTime) : new Date(),
      rawResponse: raw,
    };
  }

  async charge(req: TerminalChargeRequest): Promise<TerminalTransaction> {
    const amountInCents = Math.round(req.amount * 100);

    const body: Record<string, unknown> = {
      capture: true,
      kind: req.mode === "debit" ? "debit" : "credit",
      amount: amountInCents,
      installments: req.installments ?? 1,
      reference: req.orderId ?? `order-${Date.now()}`,
      softDescriptor: req.description?.slice(0, 22) ?? "Venda",
    };

    // Sandbox: dados de cartão de teste vão soltos no corpo da requisição
    // (a API sandbox da Rede não simula captura física de cartão).
    if (this.sandbox) {
      body.cardNumber = "5448280000000007";
      body.cardholderName = "TESTE SANDBOX";
      body.expirationMonth = 12;
      body.expirationYear = 2030;
      body.securityCode = "123";
    }

    const raw = await this.request<RedeAuthorizationResponse>("POST", "/v1/transactions", body);
    return this.toTransactionFromAuthorization(raw);
  }

  async getTransaction(transactionId: string): Promise<TerminalTransaction> {
    const raw = await this.request<RedeQueryResponse>("GET", `/v1/transactions/${transactionId}`);
    return this.toTransactionFromQuery(raw);
  }

  async cancel(transactionId: string, amount?: number): Promise<TerminalTransaction> {
    const body: Record<string, unknown> = {};
    if (amount !== undefined) {
      body.amount = Math.round(amount * 100);
    }

    const raw = await this.request<RedeRefundResponse>(
      "POST",
      `/v1/transactions/${transactionId}/refunds`,
      body,
    );
    return this.toTransactionFromRefund(raw, amount ?? 0);
  }

  async ping(): Promise<boolean> {
    // Não há endpoint de "status do serviço" documentado — usamos uma consulta
    // por reference inexistente como teste de credenciais: 401/403 = credenciais
    // inválidas; qualquer outro status (mesmo 404 "não encontrado") confirma que a
    // autenticação passou.
    try {
      const res = await fetch(`${this.baseUrl}/v1/transactions?reference=ping-check`, {
        headers: { Authorization: this.basicAuthHeader },
      });
      return res.status !== 401 && res.status !== 403;
    } catch {
      return false;
    }
  }
}
