import type {
  ITerminalProvider,
  TerminalChargeRequest,
  TerminalProviderConfig,
  TerminalTransaction,
} from "./terminal.interface";

// OAuth authentication requires V2 routes (V1 does not support OAuth)
const SANDBOX_BASE = "https://sandbox-erede.useredecloud.com.br";
const PROD_BASE = "https://api.userede.com.br/erede";
const TOKEN_URL_SANDBOX = "https://rl7-sandbox-api.useredecloud.com.br/oauth2/token";
const TOKEN_URL_PROD = "https://api.userede.com.br/redelabs/oauth2/token";

interface RedeTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

interface RedeBrand {
  name: string;
  returnCode: string;
  returnMessage: string;
  authorizationCode?: string;
}

interface RedeTransactionResponse {
  returnCode: string;
  returnMessage: string;
  tid?: string;
  nsu?: string;
  amount?: number;
  installments?: number;
  kind?: string;
  last4?: string;
  dateTime?: string;
  brand?: RedeBrand;
}

export class RedeProvider implements ITerminalProvider {
  readonly provider = "rede" as const;

  private clientId: string;
  private clientSecret: string;
  private sandbox: boolean;
  private accessToken: string | null = null;
  private tokenExpiresAt = 0;

  constructor(config: TerminalProviderConfig) {
    this.clientId = config.credentials.clientId;
    this.clientSecret = config.credentials.clientSecret;
    this.sandbox = config.sandbox;
  }

  private get baseUrl() {
    return this.sandbox ? SANDBOX_BASE : PROD_BASE;
  }

  private get tokenUrl() {
    return this.sandbox ? TOKEN_URL_SANDBOX : TOKEN_URL_PROD;
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt - 30_000) {
      return this.accessToken;
    }

    const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64");

    const res = await fetch(this.tokenUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });

    if (!res.ok) {
      throw new Error(`Rede auth failed: ${res.status} ${await res.text()}`);
    }

    const data = (await res.json()) as RedeTokenResponse;
    this.accessToken = data.access_token;
    this.tokenExpiresAt = Date.now() + data.expires_in * 1000;
    return this.accessToken;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const token = await this.getAccessToken();
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Rede API ${method} ${path} → ${res.status}: ${text}`);
    }

    return res.json() as Promise<T>;
  }

  private mapBrand(rawBrand?: string): string {
    const map: Record<string, string> = {
      VISA: "visa",
      MASTERCARD: "mastercard",
      ELO: "elo",
      AMEX: "amex",
      HIPERCARD: "hipercard",
      DINERS: "diners",
    };
    return map[(rawBrand ?? "").toUpperCase()] ?? (rawBrand?.toLowerCase() ?? "unknown");
  }

  private mapStatus(returnCode: string): TerminalTransaction["status"] {
    if (returnCode === "00") return "approved";
    if (["04", "05", "51", "54", "57"].includes(returnCode)) return "denied";
    if (returnCode === "XX") return "cancelled";
    return "error";
  }

  private toTransaction(raw: RedeTransactionResponse): TerminalTransaction {
    return {
      id: raw.tid ?? "",
      status: this.mapStatus(raw.returnCode),
      amount: (raw.amount ?? 0) / 100,
      installments: raw.installments ?? 1,
      mode: raw.kind === "DEBIT" ? "debit" : "credit",
      brand: this.mapBrand(raw.brand?.name),
      authorizationCode: raw.brand?.authorizationCode,
      nsu: raw.nsu,
      cardLastDigits: raw.last4,
      occurredAt: raw.dateTime ? new Date(raw.dateTime) : new Date(),
      rawResponse: raw,
    };
  }

  async charge(req: TerminalChargeRequest): Promise<TerminalTransaction> {
    // Amount must be sent in cents (integer)
    const amountInCents = Math.round(req.amount * 100);

    const body: Record<string, unknown> = {
      capture: true,
      kind: req.mode === "debit" ? "DEBIT" : "CREDIT",
      amount: amountInCents,
      installments: req.installments ?? 1,
      reference: req.orderId ?? `order-${Date.now()}`,
      softDescriptor: req.description?.slice(0, 22) ?? "Venda",
    };

    // Sandbox: send test card in body (production uses physical POS terminal)
    if (this.sandbox) {
      body.card = {
        number: "5448280000000007",
        holderName: "TESTE SANDBOX",
        expirationMonth: "12",
        expirationYear: "2030",
        securityCode: "123",
      };
    }

    const raw = await this.request<RedeTransactionResponse>("POST", "/v2/transactions", body);
    return this.toTransaction(raw);
  }

  async getTransaction(transactionId: string): Promise<TerminalTransaction> {
    const raw = await this.request<RedeTransactionResponse>(
      "GET",
      `/v2/transactions/${transactionId}`
    );
    return this.toTransaction(raw);
  }

  async cancel(transactionId: string, amount?: number): Promise<TerminalTransaction> {
    // Cancel/refund uses POST to /refunds endpoint (not DELETE)
    const body: Record<string, unknown> = {};
    if (amount !== undefined) {
      body.amount = Math.round(amount * 100);
    }

    const raw = await this.request<RedeTransactionResponse>(
      "POST",
      `/v2/transactions/${transactionId}/refunds`,
      body
    );
    return this.toTransaction(raw);
  }

  async ping(): Promise<boolean> {
    try {
      await this.getAccessToken();
      return true;
    } catch {
      return false;
    }
  }
}
