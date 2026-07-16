import type {
  ITerminalProvider,
  TerminalChargeRequest,
  TerminalProvider,
  TerminalProviderConfig,
  TerminalTransaction,
} from "./terminal.interface";
import { RedeProvider } from "./rede.provider";
import { MercadoPagoProvider } from "./mercadopago.provider";
import { PagBankProvider } from "./pagbank.provider";
import { CieloProvider } from "./cielo.provider";

function buildProvider(config: TerminalProviderConfig): ITerminalProvider {
  switch (config.provider) {
    case "rede":
      return new RedeProvider(config);
    case "mercadopago":
      return new MercadoPagoProvider(config);
    case "cielo":
      return new CieloProvider(config);
    case "pagseguro":
      return new PagBankProvider(config);
    // Futuro: case "stone" — depende de homologação/parceria comercial externa.
    default:
      throw new Error(`Maquininha "${(config as TerminalProviderConfig).provider}" ainda não integrada.`);
  }
}

export class TerminalService {
  private provider: ITerminalProvider;

  constructor(config: TerminalProviderConfig) {
    this.provider = buildProvider(config);
  }

  get providerName(): TerminalProvider {
    return this.provider.provider;
  }

  charge(req: TerminalChargeRequest): Promise<TerminalTransaction> {
    return this.provider.charge(req);
  }

  getTransaction(id: string): Promise<TerminalTransaction> {
    return this.provider.getTransaction(id);
  }

  cancel(id: string, amount?: number): Promise<TerminalTransaction> {
    return this.provider.cancel(id, amount);
  }

  ping(): Promise<boolean> {
    return this.provider.ping();
  }
}

/** Cria um TerminalService a partir das configurações salvas no tenant (terminal_config JSON) */
export function terminalServiceFromConfig(terminalConfig: unknown): TerminalService | null {
  if (!terminalConfig || typeof terminalConfig !== "object") return null;

  const cfg = terminalConfig as Record<string, unknown>;
  if (!cfg.provider || !cfg.credentials) return null;

  return new TerminalService({
    provider: cfg.provider as TerminalProvider,
    credentials: cfg.credentials as Record<string, string>,
    sandbox: Boolean(cfg.sandbox ?? false),
  });
}
