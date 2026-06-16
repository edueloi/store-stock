export type TerminalProvider = "rede" | "stone" | "mercadopago" | "cielo" | "pagseguro";

export type TransactionStatus = "approved" | "denied" | "cancelled" | "pending" | "error";

export type PaymentMode = "credit" | "debit";

export interface TerminalChargeRequest {
  amount: number;
  installments: number;
  mode: PaymentMode;
  description?: string;
  orderId?: string;
}

export interface TerminalTransaction {
  id: string;
  status: TransactionStatus;
  amount: number;
  installments: number;
  mode: PaymentMode;
  brand: string;
  authorizationCode?: string;
  nsu?: string;
  cardLastDigits?: string;
  occurredAt: Date;
  rawResponse?: unknown;
}

export interface TerminalProviderConfig {
  provider: TerminalProvider;
  credentials: Record<string, string>;
  sandbox: boolean;
}

export interface ITerminalProvider {
  readonly provider: TerminalProvider;

  /**
   * Inicia uma cobrança e retorna a transação resultante.
   * A comunicação com o hardware (maquininha física) varia por provider:
   * alguns usam API REST, outros usam SDK local ou webhook de retorno.
   */
  charge(request: TerminalChargeRequest): Promise<TerminalTransaction>;

  /** Consulta o status de uma transação pelo ID retornado em charge() */
  getTransaction(transactionId: string): Promise<TerminalTransaction>;

  /** Cancela/estorna uma transação. amount em reais para estorno parcial (omitir = estorno total) */
  cancel(transactionId: string, amount?: number): Promise<TerminalTransaction>;

  /** Testa se as credenciais estão válidas */
  ping(): Promise<boolean>;
}
