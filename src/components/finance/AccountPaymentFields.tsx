import { Input, Select, Textarea } from "../ui";

export const ACCOUNT_PAYMENT_METHODS = [
  ["pix", "PIX"], ["cash", "Dinheiro"], ["credit_card", "Cartão de crédito"], ["debit_card", "Cartão de débito"],
  ["boleto", "Boleto"], ["bank_transfer", "Transferência bancária"], ["check", "Cheque"], ["other", "Outro"],
] as const;
export interface AccountPaymentData { payment_method: string; document_number: string; cost_center: string; payment_details: string; }
export function AccountPaymentMethod({ value, onChange, label = "Forma de pagamento" }: { value: string; onChange: (value: string) => void; label?: string }) {
  return <Select label={label} value={value} onChange={event => onChange(event.target.value)}><option value="">Não informada</option>{value && !ACCOUNT_PAYMENT_METHODS.some(([key]) => key === value) && <option value={value}>{value}</option>}{ACCOUNT_PAYMENT_METHODS.map(([key, name]) => <option key={key} value={key}>{name}</option>)}</Select>;
}
export default function AccountPaymentFields({ kind, value, onChange }: { kind: "payable" | "receivable"; value: AccountPaymentData; onChange: (patch: Partial<AccountPaymentData>) => void }) {
  return <div className="space-y-4"><p className="text-xs leading-relaxed text-slate-500">Organize como esta conta será {kind === "payable" ? "paga" : "recebida"}. Todos estes campos são opcionais.</p><div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
    <AccountPaymentMethod label={kind === "payable" ? "Forma prevista de pagamento" : "Forma prevista de recebimento"} value={value.payment_method} onChange={payment_method => onChange({ payment_method })} />
    <Input label="Número do documento" maxLength={191} placeholder="Nota fiscal, fatura, contrato..." value={value.document_number} onChange={event => onChange({ document_number: event.target.value })} />
    <Input label="Centro de custo" maxLength={191} placeholder="Ex.: Loja, escritório, oficina..." value={value.cost_center} onChange={event => onChange({ cost_center: event.target.value })} />
  </div><Textarea label={value.payment_method === "pix" ? "Chave PIX ou instruções" : value.payment_method === "boleto" ? "Linha digitável ou dados do boleto" : "Dados de cobrança ou instruções"} rows={3} maxLength={10000} placeholder="Informe os dados que ajudam a identificar e conferir a cobrança." value={value.payment_details} onChange={event => onChange({ payment_details: event.target.value })} /><p className="rounded-lg bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-500">O cadastro organiza o controle financeiro. A baixa continua sendo feita pelo botão de pagar ou receber.</p></div>;
}
