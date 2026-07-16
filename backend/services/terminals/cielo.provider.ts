import type {
  ITerminalProvider,
  TerminalChargeRequest,
  TerminalProviderConfig,
  TerminalTransaction,
} from "./terminal.interface";

// Cielo e-commerce API usa MerchantId/MerchantKey como headers fixos (sem OAuth).
// APIs de consulta/cancelamento usam host separado (queryconsole) das de criação.
const SANDBOX_API_BASE = "https://apisandbox.cieloecommerce.cielo.com.br";
const SANDBOX_QUERY_BASE = "https://apiquerysandbox.cieloecommerce.cielo.com.br";
const PROD_API_BASE = "https://api.cieloecommerce.cielo.com.br";
const PROD_QUERY_BASE = "https://apiquery.cieloecommerce.cielo.com.br";

interface CieloPaymentResponse {
  Payment?: {
    PaymentId?: string;
    Status?: number;
    Type?: string;
    Amount?: number;
    Installments?: number;
    Tid?: string;
    AuthorizationCode?: string;
    ProofOfSale?: string;
    CreditCard?: {
      Brand?: string;
      LastFourDigits?: string;
    };
    ReceivedDate?: string;
  };
}

export class CieloProvider implements ITerminalProvider {
  readonly provider = "cielo" as const;

  private merchantId: string;
  private merchantKey: string;
  private sandbox: boolean;

  constructor(config: TerminalProviderConfig) {
    this.merchantId = config.credentials.merchantId;
    this.merchantKey = config.credentials.merchantKey;
    this.sandbox = config.sandbox;
  }

  private get apiBase() {
    return this.sandbox ? SANDBOX_API_BASE : PROD_API_BASE;
  }

  private get queryBase() {
    return this.sandbox ? SANDBOX_QUERY_BASE : PROD_QUERY_BASE;
  }

  private get headers(): Record<string, string> {
    return {
      MerchantId: this.merchantId,
      MerchantKey: this.merchantKey,
      "Content-Type": "application/json",
    };
  }

  private async request<T>(baseUrl: string, method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers: this.headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const text = await res.text();
    if (!res.ok) {
      throw new Error(`Cielo API ${method} ${path} → ${res.status}: ${text}`);
    }

    return (text ? JSON.parse(text) : {}) as T;
  }

  // 0=NotFinished 1=Authorized 2=PaymentConfirmed(capturado) 3=Denied 10=Voided 11=Refunded 12=Pending 13=Aborted
  private mapStatus(status?: number): TerminalTransaction["status"] {
    switch (status) {
      case 1:
      case 2:
        return "approved";
      case 3:
        return "denied";
      case 10:
      case 11:
        return "cancelled";
      case 0:
      case 12:
        return "pending";
      default:
        return "error";
    }
  }

  private toTransaction(raw: CieloPaymentResponse): TerminalTransaction {
    const p = raw.Payment;
    return {
      id: p?.PaymentId ?? "",
      status: this.mapStatus(p?.Status),
      amount: (p?.Amount ?? 0) / 100,
      installments: p?.Installments ?? 1,
      mode: p?.Type?.toLowerCase().includes("debit") ? "debit" : "credit",
      brand: p?.CreditCard?.Brand?.toLowerCase() ?? "unknown",
      authorizationCode: p?.AuthorizationCode,
      nsu: p?.ProofOfSale,
      cardLastDigits: p?.CreditCard?.LastFourDigits,
      occurredAt: p?.ReceivedDate ? new Date(p.ReceivedDate) : new Date(),
      rawResponse: raw,
    };
  }

  async charge(req: TerminalChargeRequest): Promise<TerminalTransaction> {
    const amountInCents = Math.round(req.amount * 100);

    const body: Record<string, unknown> = {
      MerchantOrderId: req.orderId ?? `order-${Date.now()}`,
      Payment: {
        Type: req.mode === "debit" ? "DebitCard" : "CreditCard",
        Amount: amountInCents,
        Installments: req.installments ?? 1,
        Capture: true,
        SoftDescriptor: req.description?.slice(0, 13) ?? "Venda",
      },
    };

    if (this.sandbox) {
      Object.assign(body.Payment as Record<string, unknown>, {
        CreditCard: {
          CardNumber: "4551870000000183",
          Holder: "TESTE SANDBOX",
          ExpirationDate: "12/2030",
          SecurityCode: "123",
          Brand: "Visa",
        },
      });
    }

    const raw = await this.request<CieloPaymentResponse>(this.apiBase, "POST", "/1/sales/", body);
    return this.toTransaction(raw);
  }

  async getTransaction(transactionId: string): Promise<TerminalTransaction> {
    const raw = await this.request<CieloPaymentResponse>(
      this.queryBase,
      "GET",
      `/1/sales/${transactionId}`,
    );
    return this.toTransaction(raw);
  }

  async cancel(transactionId: string, amount?: number): Promise<TerminalTransaction> {
    const query = amount !== undefined ? `?amount=${Math.round(amount * 100)}` : "";
    const raw = await this.request<CieloPaymentResponse>(
      this.apiBase,
      "PUT",
      `/1/sales/${transactionId}/void${query}`,
    );
    return {
      id: raw.Payment?.PaymentId ?? transactionId,
      status: this.mapStatus(raw.Payment?.Status) === "approved" ? "cancelled" : this.mapStatus(raw.Payment?.Status),
      amount: amount ?? 0,
      installments: 1,
      mode: "credit",
      brand: "unknown",
      occurredAt: new Date(),
      rawResponse: raw,
    };
  }

  async ping(): Promise<boolean> {
    try {
      const res = await fetch(`${this.queryBase}/1/sales/00000000-0000-0000-0000-000000000000`, {
        headers: this.headers,
      });
      return res.status !== 401 && res.status !== 403;
    } catch {
      return false;
    }
  }
}
