import { MercadoPagoConfig, Payment, Point } from "mercadopago";

import type {
  ITerminalProvider,
  TerminalChargeRequest,
  TerminalProviderConfig,
  TerminalTransaction,
} from "./terminal.interface";

// Mercado Pago Point é assíncrono por natureza: charge() cria uma "intenção de
// pagamento" (payment intent) vinculada a um aparelho físico (device_id) e retorna
// imediatamente com status "pending" — o cliente ainda precisa aproximar o cartão
// na maquininha. getTransaction() faz o polling real: consulta o estado da intent
// e, quando finalizada, busca os detalhes completos do pagamento (NSU, código de
// autorização, bandeira) via Payment.search() usando o id da intent como
// external_reference.
export class MercadoPagoProvider implements ITerminalProvider {
  readonly provider = "mercadopago" as const;

  private client: MercadoPagoConfig;
  private pointApi: Point;
  private paymentApi: Payment;
  private deviceId: string;

  constructor(config: TerminalProviderConfig) {
    const accessToken = config.credentials.accessToken;
    this.deviceId = config.credentials.deviceId ?? "";
    this.client = new MercadoPagoConfig({ accessToken });
    this.pointApi = new Point(this.client);
    this.paymentApi = new Payment(this.client);
  }

  private mapIntentState(state?: string): TerminalTransaction["status"] {
    if (state === "FINISHED") return "approved"; // confirmado via Payment.search() se necessário
    if (state === "CANCELED") return "cancelled";
    if (state === "ERROR") return "error";
    return "pending"; // OPEN ou qualquer outro estado intermediário
  }

  private mapPaymentBrand(paymentMethodId?: string): string {
    if (!paymentMethodId) return "unknown";
    const id = paymentMethodId.toLowerCase();
    if (id.includes("visa")) return "visa";
    if (id.includes("master")) return "mastercard";
    if (id.includes("amex")) return "amex";
    if (id.includes("elo")) return "elo";
    return paymentMethodId;
  }

  async charge(req: TerminalChargeRequest): Promise<TerminalTransaction> {
    const deviceId = req.deviceId || this.deviceId;
    if (!deviceId) {
      throw new Error("Nenhum aparelho Point configurado (device_id ausente). Configure o Device ID nas configurações da maquininha.");
    }

    const amountInCents = Math.round(req.amount * 100);
    const reference = req.orderId ?? `order-${Date.now()}`;

    const intent = await this.pointApi.createPaymentIntent({
      device_id: deviceId,
      request: {
        amount: amountInCents,
        description: req.description?.slice(0, 60) ?? "Venda",
        additional_info: {
          external_reference: reference,
          print_on_terminal: false,
        },
        payment: {
          installments: req.installments ?? 1,
          type: req.mode === "debit" ? "debit_card" : "credit_card",
        },
      },
    });

    return {
      id: intent.id ?? "",
      status: this.mapIntentState(intent.state),
      amount: req.amount,
      installments: req.installments ?? 1,
      mode: req.mode,
      brand: "unknown", // só é conhecida depois que o cliente aproxima o cartão
      occurredAt: new Date(),
      rawResponse: intent,
    };
  }

  async getTransaction(transactionId: string): Promise<TerminalTransaction> {
    const intentStatus = await this.pointApi.getPaymentIntentStatus({ payment_intent_id: transactionId });
    const state = intentStatus.status;
    const status = this.mapIntentState(state);

    // Ainda não finalizada — devolve o status intermediário sem consultar o pagamento.
    if (status === "pending") {
      return {
        id: transactionId,
        status: "pending",
        amount: 0,
        installments: 1,
        mode: "credit",
        brand: "unknown",
        occurredAt: intentStatus.created_on ? new Date(intentStatus.created_on) : new Date(),
        rawResponse: intentStatus,
      };
    }

    // Finalizada (aprovada/cancelada/erro) — busca os detalhes reais do pagamento.
    const search = await this.paymentApi.search({
      options: { external_reference: transactionId },
    });
    const payment = search.results?.[0];

    return {
      id: transactionId,
      status: payment?.status === "approved" ? "approved" : status,
      amount: payment?.transaction_amount ?? 0,
      installments: payment?.installments ?? 1,
      mode: payment?.payment_method_id?.includes("debit") ? "debit" : "credit",
      brand: this.mapPaymentBrand(payment?.payment_method_id),
      authorizationCode: payment?.authorization_code,
      nsu: payment?.id ? String(payment.id) : undefined,
      cardLastDigits: payment?.card?.last_four_digits,
      occurredAt: payment?.date_approved ? new Date(payment.date_approved) : new Date(),
      rawResponse: { intentStatus, payment },
    };
  }

  async cancel(transactionId: string): Promise<TerminalTransaction> {
    if (!this.deviceId) {
      throw new Error("Nenhum aparelho Point configurado (device_id ausente). Configure o Device ID nas configurações da maquininha.");
    }
    const result = await this.pointApi.cancelPaymentIntent({
      device_id: this.deviceId,
      payment_intent_id: transactionId,
    });
    return {
      id: result.id ?? transactionId,
      status: "cancelled",
      amount: 0,
      installments: 1,
      mode: "credit",
      brand: "unknown",
      occurredAt: new Date(),
      rawResponse: result,
    };
  }

  async ping(): Promise<boolean> {
    try {
      // Lista os aparelhos da conta — chamada leve que só funciona com token válido.
      await this.pointApi.getDevices({ request: {} });
      return true;
    } catch {
      return false;
    }
  }
}
