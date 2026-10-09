// Textos dos e-mails de documentos enviados aos clientes (orçamento, ordem de serviço,
// NFS-e e crediário). Somente texto puro, formal e humanizado — funções puras, sem
// acesso a banco ou rede, para facilitar testes e manter o tom em um único lugar.

export type StoreSignatureInput = {
  /** Nome de quem está enviando (usuário logado). */
  senderName?: string | null;
  storeName: string;
  phone?: string | null;
  document?: string | null;
  email?: string | null;
  address?: string | null;
};

export type TenantContactSource = {
  name?: string | null;
  whatsapp?: string | null;
  document?: string | null;
  address?: string | null;
  address_street?: string | null;
  address_number?: string | null;
  address_district?: string | null;
  address_city?: string | null;
  address_state?: string | null;
  address_zip?: string | null;
};

export type DocumentEmail = { subject: string; text: string };

const clean = (value?: string | null) => (value ?? "").toString().trim();

export function formatBRL(value: unknown): string {
  return Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatDateBR(value: Date | string | null | undefined): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  // Datas de vencimento/prazo são @db.Date (meia-noite UTC): formata em UTC para não recuar um dia.
  return date.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

export function padDocumentNumber(value: number | string): string {
  return String(value).padStart(4, "0");
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/** Monta a assinatura com os dados de contato da loja, omitindo linhas vazias. */
export function buildSignature(input: StoreSignatureInput): string {
  const lines = ["Atenciosamente,"];
  const sender = clean(input.senderName);
  if (sender) lines.push(sender);
  lines.push(clean(input.storeName) || "Loja");
  const phone = clean(input.phone);
  if (phone) lines.push(`Telefone: ${phone}`);
  const document = clean(input.document);
  if (document) lines.push(`CNPJ: ${document}`);
  const email = clean(input.email);
  if (email) lines.push(`E-mail: ${email}`);
  const address = clean(input.address);
  if (address) lines.push(address);
  return lines.join("\n");
}

/** Endereço em uma linha a partir dos campos do Tenant (usa o campo livre se não houver estruturado). */
export function formatTenantAddress(tenant: TenantContactSource): string {
  const street = [clean(tenant.address_street), clean(tenant.address_number)].filter(Boolean).join(", ");
  const cityState = [clean(tenant.address_city), clean(tenant.address_state)].filter(Boolean).join("/");
  const structured = [street, clean(tenant.address_district), cityState, clean(tenant.address_zip)].filter(Boolean).join(" - ");
  return structured || clean(tenant.address);
}

export function buildSignatureFromTenant(
  tenant: TenantContactSource,
  senderName?: string | null,
  contactEmail?: string | null,
): StoreSignatureInput {
  return {
    senderName,
    storeName: clean(tenant.name) || "Loja",
    phone: tenant.whatsapp,
    document: tenant.document,
    email: contactEmail,
    address: formatTenantAddress(tenant),
  };
}

function greeting(customerName?: string | null): string {
  const name = clean(customerName);
  return name ? `Prezado(a) ${name},` : "Prezado(a),";
}

function compose(parts: { customerName?: string | null; paragraphs: string[]; signature: StoreSignatureInput }): string {
  return [greeting(parts.customerName), ...parts.paragraphs.filter(Boolean), buildSignature(parts.signature)].join("\n\n");
}

const CONTACT_INVITE = (storeName: string) =>
  `Permanecemos à disposição para esclarecer qualquer dúvida. Basta responder a este e-mail ou entrar em contato com a ${clean(storeName) || "loja"}.`;

export const SERVICE_ORDER_STATUS_LABELS: Record<string, string> = {
  rascunho: "em elaboração",
  orcamento_enviado: "orçamento enviado",
  aguardando_aprovacao: "aguardando aprovação",
  aprovado: "aprovada",
  em_producao: "em execução",
  finalizado: "finalizada",
  nota_emitida: "finalizada, com nota fiscal emitida",
  entregue: "entregue",
  cancelada: "cancelada",
};

// ── Orçamento ────────────────────────────────────────────────────────────────
export function buildQuoteEmail(data: {
  customerName?: string | null;
  number: number | string;
  total: unknown;
  validityDays?: number | null;
  notes?: string | null;
  signature: StoreSignatureInput;
}): DocumentEmail {
  const number = padDocumentNumber(data.number);
  const storeName = clean(data.signature.storeName) || "Loja";
  const validity = Number(data.validityDays) > 0
    ? ` O orçamento tem validade de ${data.validityDays} ${Number(data.validityDays) === 1 ? "dia" : "dias"}.`
    : "";
  const notes = clean(data.notes);
  return {
    subject: `Orçamento nº ${number} — ${storeName}`,
    text: compose({
      customerName: data.customerName,
      signature: data.signature,
      paragraphs: [
        `Conforme solicitado, encaminhamos o orçamento nº ${number}, no valor total de ${formatBRL(data.total)}.${validity}`,
        notes ? `Observações:\n${notes}` : "",
        `${CONTACT_INVITE(storeName)} Caso o orçamento esteja de acordo, ficamos no aguardo da sua confirmação para darmos andamento.`,
      ],
    }),
  };
}

// ── Ordem de serviço ─────────────────────────────────────────────────────────
export function buildServiceOrderEmail(data: {
  customerName?: string | null;
  number: number | string;
  total: unknown;
  status?: string | null;
  promisedAt?: Date | string | null;
  serviceDescription?: string | null;
  observations?: string | null;
  signature: StoreSignatureInput;
}): DocumentEmail {
  const number = padDocumentNumber(data.number);
  const storeName = clean(data.signature.storeName) || "Loja";
  const statusLabel = data.status ? SERVICE_ORDER_STATUS_LABELS[data.status] ?? data.status.replace(/_/g, " ") : "";
  const promised = formatDateBR(data.promisedAt);
  const service = clean(data.serviceDescription);
  const observations = clean(data.observations);

  const details = [
    `Encaminhamos as informações da ordem de serviço nº ${number}, no valor total de ${formatBRL(data.total)}.`,
    statusLabel ? `No momento, a ordem de serviço encontra-se ${statusLabel}.` : "",
    promised ? `A previsão de conclusão é ${promised}.` : "",
  ].filter(Boolean).join(" ");

  return {
    subject: `Ordem de serviço nº ${number} — ${storeName}`,
    text: compose({
      customerName: data.customerName,
      signature: data.signature,
      paragraphs: [
        details,
        service ? `Serviço: ${service}` : "",
        observations ? `Observações:\n${observations}` : "",
        CONTACT_INVITE(storeName),
      ],
    }),
  };
}

// ── NFS-e ────────────────────────────────────────────────────────────────────
export function buildNfseEmail(data: {
  customerName?: string | null;
  numero: number | string;
  serie?: number | string | null;
  value?: unknown;
  signature: StoreSignatureInput;
}): DocumentEmail {
  const storeName = clean(data.signature.storeName) || "Loja";
  const serie = data.serie !== undefined && data.serie !== null && String(data.serie) !== "" ? `, série ${data.serie}` : "";
  const value = data.value !== undefined && data.value !== null && Number(data.value) > 0
    ? `, referente ao valor de ${formatBRL(data.value)}`
    : "";
  return {
    subject: `NFS-e nº ${data.numero} — ${storeName}`,
    text: compose({
      customerName: data.customerName,
      signature: data.signature,
      paragraphs: [
        `Encaminhamos a Nota Fiscal de Serviço Eletrônica (NFS-e) nº ${data.numero}${serie}${value}. O arquivo em PDF segue em anexo a esta mensagem.`,
        `Recomendamos guardar o documento para seus registros. ${CONTACT_INVITE(storeName)}`,
      ],
    }),
  };
}

// ── Crediário ────────────────────────────────────────────────────────────────
export type CrediarioEmailInstallment = {
  number: number;
  dueDate: Date | string;
  amount: unknown;
  paid: boolean;
};

export function buildCrediarioEmail(data: {
  customerName?: string | null;
  description?: string | null;
  total: unknown;
  paid: unknown;
  remaining: unknown;
  installments?: CrediarioEmailInstallment[];
  /** Quando o envio é o comprovante de um pagamento específico. */
  payment?: { amount: unknown; paidAt: Date | string; method?: string | null } | null;
  signature: StoreSignatureInput;
}): DocumentEmail {
  const storeName = clean(data.signature.storeName) || "Loja";
  const description = clean(data.description) || "Crediário";
  const remaining = Number(data.remaining) || 0;

  const intro = data.payment
    ? `Confirmamos o recebimento do pagamento de ${formatBRL(data.payment.amount)}${data.payment.method ? ` (${data.payment.method})` : ""}, realizado em ${formatDateBR(data.payment.paidAt)}, referente ao crediário "${description}".`
    : `Encaminhamos o extrato do seu crediário "${description}".`;
  const balance = remaining > 0
    ? `Valor total: ${formatBRL(data.total)}. Total pago: ${formatBRL(data.paid)}. Saldo em aberto: ${formatBRL(remaining)}.`
    : `Valor total: ${formatBRL(data.total)}. O crediário encontra-se quitado. Agradecemos a confiança.`;

  const rows = (data.installments ?? []).map((inst) =>
    `${String(inst.number).padStart(2, "0")}) vencimento ${formatDateBR(inst.dueDate)} — ${formatBRL(inst.amount)} — ${inst.paid ? "paga" : "em aberto"}`,
  );

  return {
    subject: `${data.payment ? "Comprovante de pagamento" : "Extrato do crediário"} — ${storeName}`,
    text: compose({
      customerName: data.customerName,
      signature: data.signature,
      paragraphs: [
        intro,
        balance,
        rows.length ? `Parcelas:\n${rows.join("\n")}` : "",
        CONTACT_INVITE(storeName),
      ],
    }),
  };
}
