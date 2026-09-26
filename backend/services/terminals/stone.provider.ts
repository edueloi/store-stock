import type {
  ITerminalProvider,
  TerminalChargeRequest,
  TerminalProviderConfig,
  TerminalTransaction,
} from "./terminal.interface";

// A API Connect Stone é construída sobre a API Pagar.me v5 (mesma base de
// autenticação e recursos), acrescida do bloco poi_payment_settings para rotear
// o pedido a uma maquininha física por número de série. Autenticação é Basic Auth
// com a Secret Key (SK) do parceiro como usuário e senha vazia.
// Doc: https://connect-stone.stone.com.br/reference/criar-pedido
const API_BASE = "https://api.pagar.me/core/v5";

// charge() é assíncrono por natureza aqui: o pedido só é criado (status "pending"),
// o pagamento real acontece quando o cliente aproxima o cartão na maquininha.
// getTransaction() faz o polling via GET /orders/:id — a Stone recomenda webhook
// como fonte primária de confirmação (ver backend/controllers/stone-webhook.controller.ts),
// mas a doc permite consulta direta "em fluxos de resiliência", que é o mesmo padrão
// de polling já usado para o Mercado Pago Point neste projeto.
interface StoneOrderResponse {
  id: string;
  code: string;
  amount: number;
  currency: string;
  closed: boolean;
  status: string; // "pending" | "paid" | "canceled" | "failed" | ...
  customer?: { id?: string; name?: string; email?: string };
  charges?: Array<{
    id: string;
    status: string;
    amount: number;
    payment_method?: string;
    metadata?: {
      scheme_name?: string; // bandeira do cartão
      authorization_code?: string;
      terminal_serial_number?: string;
      account_funding_source?: string; // "Credit" | "Debit"
      transaction_timestamp?: string;
    };
    last_transaction?: {
      card?: { last_four_digits?: string };
      installments?: number;
      acquirer_nsu?: string;
    };
  }>;
  poi_payment_settings?: {
    visible?: boolean;
    display_name?: string;
    devices_serial_number?: string[];
  };
  created_at?: string;
  updated_at?: string;
  closed_at?: string;
}

export class StoneProvider implements ITerminalProvider {
  readonly provider = "stone" as const;

  private secretKey: string;
  private serviceRefererName: string;
  private deviceSerialNumber: string;

  constructor(config: TerminalProviderConfig) {
    this.secretKey = config.credentials.secretKey;
    this.serviceRefererName = config.credentials.serviceRefererName;
    this.deviceSerialNumber = config.credentials.deviceSerialNumber ?? "";
  }

  private get authHeader(): string {
    // Basic Auth: SK como usuário, sem senha (padrão Pagar.me/Stone Connect).
    return `Basic ${Buffer.from(`${this.secretKey}:`).toString("base64")}`;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        Authorization: this.authHeader,
        ServiceRefererName: this.serviceRefererName,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const text = await res.text();
    if (!res.ok) {
      throw new Error(`Stone Connect API ${method} ${path} → ${res.status}: ${text}`);
    }

    return (text ? JSON.parse(text) : {}) as T;
  }

  private mapOrderStatus(status: string): TerminalTransaction["status"] {
    if (status === "paid") return "approved";
    if (status === "canceled" || status === "failed") return status === "canceled" ? "cancelled" : "error";
    return "pending";
  }

  private toTransaction(order: StoneOrderResponse): TerminalTransaction {
    const charge = order.charges?.[0];
    return {
      id: order.id,
      status: this.mapOrderStatus(order.status),
      amount: (order.amount ?? 0) / 100,
      installments: charge?.last_transaction?.installments ?? 1,
      mode: charge?.metadata?.account_funding_source?.toLowerCase() === "debit" ? "debit" : "credit",
      brand: charge?.metadata?.scheme_name?.toLowerCase() ?? "unknown",
      authorizationCode: charge?.metadata?.authorization_code,
      nsu: charge?.last_transaction?.acquirer_nsu ?? charge?.id,
      cardLastDigits: charge?.last_transaction?.card?.last_four_digits,
      occurredAt: charge?.metadata?.transaction_timestamp
        ? new Date(charge.metadata.transaction_timestamp)
        : order.updated_at
          ? new Date(order.updated_at)
          : new Date(),
      rawResponse: order,
    };
  }

  async charge(req: TerminalChargeRequest): Promise<TerminalTransaction> {
    const serial = req.deviceId || this.deviceSerialNumber;
    if (!serial) {
      throw new Error("Nenhuma maquininha configurada (número de série ausente). Cadastre o serial da maquininha nas configurações.");
    }

    const amountInCents = Math.round(req.amount * 100);

    const body = {
      customer: { name: "Cliente", email: "cliente@venda.local" },
      items: [
        {
          amount: amountInCents,
          description: (req.description ?? "Venda").slice(0, 64),
          quantity: 1,
          code: req.orderId ?? `order-${Date.now()}`,
        },
      ],
      closed: false,
      poi_payment_settings: {
        type: req.mode === "debit" ? "debit" : "credit",
        installments: req.installments ?? 1,
        installment_type: "merchant",
        devices_serial_number: [serial],
      },
    };

    const order = await this.request<StoneOrderResponse>("POST", "/orders/", body);
    return this.toTransaction(order);
  }

  async getTransaction(transactionId: string): Promise<TerminalTransaction> {
    // Consulta direta — a Stone recomenda webhook (charge.paid/charge.refunded) como
    // fonte primária; este método serve o polling do PDV e como fallback de resiliência.
    const order = await this.request<StoneOrderResponse>("GET", `/orders/${transactionId}`);
    return this.toTransaction(order);
  }

  async cancel(transactionId: string, amount?: number): Promise<TerminalTransaction> {
    // Fechamento do pedido como "failed"/"canceled" — usado tanto para cancelar um
    // pedido ainda pendente quanto para registrar um estorno já tratado via webhook.
    // A Stone não documenta estorno parcial neste endpoint; amount é ignorado aqui
    // e mantido na assinatura só por compatibilidade com a interface comum.
    void amount;
    const order = await this.request<StoneOrderResponse>(
      "PATCH",
      `/orders/${transactionId}/closed`,
      { status: "canceled" },
    );
    return this.toTransaction(order);
  }

  async ping(): Promise<boolean> {
    // Não há endpoint de "status do serviço" documentado — usamos uma consulta a um
    // pedido inexistente como teste de credenciais: 401/403 = credenciais inválidas;
    // qualquer outro status (mesmo 404) confirma que a autenticação passou.
    try {
      const res = await fetch(`${API_BASE}/orders/ping-check`, {
        headers: { Authorization: this.authHeader, ServiceRefererName: this.serviceRefererName },
      });
      return res.status !== 401 && res.status !== 403;
    } catch {
      return false;
    }
  }
}
