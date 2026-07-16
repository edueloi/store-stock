import type {
  ITerminalProvider,
  TerminalChargeRequest,
  TerminalProviderConfig,
  TerminalTransaction,
} from "./terminal.interface";

// PagBank (ex-PagSeguro) usa um token de API único (Bearer) — sem OAuth2 nem client
// secret separado. A API de Pedidos (Orders) é o caminho recomendado para cobrança
// com maquininha física vinculada à conta (charges dentro de um order).
const SANDBOX_BASE = "https://sandbox.api.pagseguro.com";
const PROD_BASE = "https://api.pagseguro.com";

interface PagBankChargeResponse {
  id: string;
  status: string;
  amount?: { value?: number };
  payment_response?: {
    code?: string;
    message?: string;
  };
  payment_method?: {
    type?: string;
    installments?: number;
    card?: {
      brand?: string;
      last_digits?: string;
    };
  };
  paid_at?: string;
}

interface PagBankOrderResponse {
  id: string;
  charges?: PagBankChargeResponse[];
}

export class PagBankProvider implements ITerminalProvider {
  readonly provider = "pagseguro" as const;

  private token: string;
  private sandbox: boolean;

  constructor(config: TerminalProviderConfig) {
    this.token = config.credentials.token;
    this.sandbox = config.sandbox;
  }

  private get baseUrl() {
    return this.sandbox ? SANDBOX_BASE : PROD_BASE;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const text = await res.text();
    if (!res.ok) {
      throw new Error(`PagBank API ${method} ${path} → ${res.status}: ${text}`);
    }

    return (text ? JSON.parse(text) : {}) as T;
  }

  private mapStatus(status?: string): TerminalTransaction["status"] {
    switch (status) {
      case "PAID":
      case "AUTHORIZED":
        return "approved";
      case "DECLINED":
        return "denied";
      case "CANCELED":
        return "cancelled";
      case "WAITING":
      case "IN_ANALYSIS":
        return "pending";
      default:
        return "error";
    }
  }

  private toTransaction(order: PagBankOrderResponse): TerminalTransaction {
    const charge = order.charges?.[0];
    return {
      id: charge?.id ?? order.id,
      status: this.mapStatus(charge?.status),
      amount: (charge?.amount?.value ?? 0) / 100,
      installments: charge?.payment_method?.installments ?? 1,
      mode: charge?.payment_method?.type === "DEBIT_CARD" ? "debit" : "credit",
      brand: charge?.payment_method?.card?.brand?.toLowerCase() ?? "unknown",
      cardLastDigits: charge?.payment_method?.card?.last_digits,
      occurredAt: charge?.paid_at ? new Date(charge.paid_at) : new Date(),
      rawResponse: order,
    };
  }

  async charge(req: TerminalChargeRequest): Promise<TerminalTransaction> {
    const amountInCents = Math.round(req.amount * 100);

    const body = {
      reference_id: req.orderId ?? `order-${Date.now()}`,
      description: req.description?.slice(0, 60) ?? "Venda",
      charges: [
        {
          amount: { value: amountInCents, currency: "BRL" },
          payment_method: {
            type: req.mode === "debit" ? "DEBIT_CARD" : "CREDIT_CARD",
            installments: req.installments ?? 1,
            capture: true,
          },
        },
      ],
    };

    const raw = await this.request<PagBankOrderResponse>("POST", "/orders", body);
    return this.toTransaction(raw);
  }

  async getTransaction(transactionId: string): Promise<TerminalTransaction> {
    const raw = await this.request<PagBankOrderResponse>("GET", `/orders/${transactionId}`);
    return this.toTransaction(raw);
  }

  async cancel(transactionId: string, amount?: number): Promise<TerminalTransaction> {
    const body: Record<string, unknown> = {};
    if (amount !== undefined) {
      body.amount = { value: Math.round(amount * 100) };
    }

    const raw = await this.request<PagBankChargeResponse>(
      "POST",
      `/charges/${transactionId}/cancel`,
      body,
    );

    return {
      id: raw.id ?? transactionId,
      status: this.mapStatus(raw.status) === "approved" ? "cancelled" : this.mapStatus(raw.status),
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
      const res = await fetch(`${this.baseUrl}/orders?reference_id=ping-check`, {
        headers: { Authorization: `Bearer ${this.token}` },
      });
      return res.status !== 401 && res.status !== 403;
    } catch {
      return false;
    }
  }
}
