import { useState } from "react";
import { Banknote, CreditCard, QrCode, PlusCircle, Clock, X, User, Wallet } from "lucide-react";
import { cn } from "../lib/utils";
import { Button, IconButton } from "./ui/Button";
import { Input, Select } from "./ui/Input";
import { Tabs } from "./ui/Tabs";
import { CARD_BRANDS, CardBrand } from "../lib/payment-constants";

// Formulário de pagamento da venda — mesmo visual/regras do checkout do PDV
// (PDV.tsx, etapa "payment"), reutilizado por "Faturar OS" e "Converter orçamento
// em venda". Várias formas simultâneas (cartão crédito/débito, PIX, dinheiro,
// crediário), bandeira, parcelas com taxa, troco, desconto/acréscimo e vendedor.

export type SalePayMethod = "money" | "debit" | "credit" | "pix" | "crediario";

export interface SalePaymentEntry {
  id: string;
  method: SalePayMethod;
  cardBrand: CardBrand;
  installments: number;
  amount: string;
  crediarioInstallments: number;
  crediarioFirstDueDate: string;
}

export interface SalePaymentFormState {
  payments: SalePaymentEntry[];
  discount: string;
  discountMode: "R$" | "%";
  surcharge: string;
  surchargeMode: "R$" | "%";
  sellerId: number | "";
}

export interface SalePaymentSettings {
  cardFees: Record<string, number[]>;
  passFeeToCustomer: boolean;
  passFeeByMethod: Record<string, boolean>;
  maxInstallments: number;
  enabledBrands: Record<string, boolean>;
}

const PM_LABEL: Record<SalePayMethod, string> = {
  money: "Dinheiro", debit: "Débito", credit: "Crédito", pix: "PIX", crediario: "Crediário",
};

const FORM_TABS = [
  { id: "pagamento", label: "Pagamento", icon: CreditCard },
  { id: "resumo", label: "Resumo", icon: Wallet },
] as const;
type FormTabId = typeof FORM_TABS[number]["id"];

export function defaultCrediarioFirstDueDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function newSalePayment(amount = ""): SalePaymentEntry {
  return {
    id: Math.random().toString(36).slice(2), method: "money", cardBrand: "visa", installments: 1, amount,
    crediarioInstallments: 1, crediarioFirstDueDate: defaultCrediarioFirstDueDate(),
  };
}

export function newSalePaymentFormState(amount = ""): SalePaymentFormState {
  return {
    payments: [newSalePayment(amount)],
    discount: "", discountMode: "R$", surcharge: "", surchargeMode: "R$", sellerId: "",
  };
}

// Lê as configurações de cobrança do /api/tenant (mesmos campos que o PDV usa).
export function parseSalePaymentSettings(tenant: unknown): SalePaymentSettings {
  const t = (tenant ?? {}) as Record<string, unknown>;
  return {
    cardFees: (t.card_fees as Record<string, number[]>) ?? {},
    passFeeToCustomer: Boolean(t.pass_fee_to_customer),
    passFeeByMethod: (t.pass_fee_by_method as Record<string, boolean>) ?? {},
    maxInstallments: Number(t.max_installments) || 12,
    enabledBrands: (t.enabled_brands as Record<string, boolean>) ?? { visa: true, master: true, elo: true, amex: true, hiper: true, other: true },
  };
}

// Mesmo formato de string que o PDV envia (ex.: "credit-visa-2x:120.00|money:30.00").
export function buildSalePmString(payments: SalePaymentEntry[]): string {
  return payments
    .filter((p) => Number(p.amount) > 0)
    .map((p) => {
      const brand = (p.method === "debit" || p.method === "credit") ? `-${p.cardBrand}` : "";
      const inst = p.method === "credit" && p.installments > 1 ? `-${p.installments}x` : "";
      return `${p.method}${brand}${inst}:${Number(p.amount).toFixed(2)}`;
    })
    .join("|");
}

export function computeSalePayment(baseAmount: number, state: SalePaymentFormState, settings: SalePaymentSettings) {
  const { payments } = state;
  const discountRaw = Number(state.discount) || 0;
  const discountValue = state.discountMode === "%"
    ? Math.min(baseAmount * discountRaw / 100, baseAmount)
    : Math.min(discountRaw, baseAmount);
  const surchargeRaw = Number(state.surcharge) || 0;
  const surchargeValue = state.surchargeMode === "%" ? baseAmount * surchargeRaw / 100 : surchargeRaw;
  const baseTotal = baseAmount - discountValue + surchargeValue;

  const getFeeRate = (p: SalePaymentEntry) => {
    if (p.method === "credit") return settings.cardFees[p.cardBrand]?.[p.installments - 1] ?? 0;
    if (p.method === "debit") return settings.cardFees[`debit_${p.cardBrand}`]?.[0] ?? 0;
    if (p.method === "pix") return settings.cardFees["pix"]?.[0] ?? 0;
    return 0;
  };
  const isPassFee = (p: SalePaymentEntry) => !!(settings.passFeeByMethod[p.method] ?? settings.passFeeToCustomer);

  const feeOf = (p: SalePaymentEntry) => {
    const rate = getFeeRate(p);
    if (!rate) return 0;
    const pAmt = Number(p.amount) || 0;
    return (pAmt > 0 ? pAmt : baseTotal) * (rate / 100);
  };
  const feeAmount = payments.reduce((s, p) => s + feeOf(p), 0);
  const passedFeeAmount = payments.reduce((s, p) => (isPassFee(p) ? s + feeOf(p) : s), 0);

  const total = Math.round((baseTotal + passedFeeAmount) * 100) / 100;
  const paidAmount = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const remaining = Math.max(0, total - paidAmount);
  const moneyAmt = Number(payments.find((p) => p.method === "money")?.amount) || 0;
  const change = moneyAmt > 0 && paidAmount >= total ? moneyAmt - (total - (paidAmount - moneyAmt)) : 0;

  return { discountValue, surchargeValue, baseTotal, feeAmount, passedFeeAmount, total, paidAmount, remaining, change, getFeeRate };
}

// Corpo do payload comum aos endpoints /service-orders/:id/faturar e /quotes/:id/convert.
export function buildSalePayload(baseAmount: number, state: SalePaymentFormState, settings: SalePaymentSettings) {
  const calc = computeSalePayment(baseAmount, state, settings);
  const crediario = state.payments.find((p) => p.method === "crediario");
  return {
    payment_method: buildSalePmString(state.payments) || "money",
    seller_id: state.sellerId || undefined,
    discount: calc.discountValue > 0 ? calc.discountValue : undefined,
    surcharge: calc.surchargeValue > 0 ? calc.surchargeValue : undefined,
    change_amount: calc.change > 0 ? calc.change : undefined,
    crediario_installments: crediario?.crediarioInstallments,
    crediario_first_due_date: crediario?.crediarioFirstDueDate,
  };
}

const fmtBRL = (v: number) => `R$ ${v.toFixed(2)}`;

const moneyQuickAmounts = (dueAmount: number): number[] => {
  if (dueAmount <= 0) return [];
  const roundUpTo = (v: number, step: number) => Math.ceil(v / step) * step;
  const candidates = [
    Math.round(dueAmount * 100) / 100,
    roundUpTo(dueAmount, 5), roundUpTo(dueAmount, 10), roundUpTo(dueAmount, 50), roundUpTo(dueAmount, 100),
  ];
  return Array.from(new Set(candidates.map((v) => Math.round(v * 100) / 100))).filter((v) => v > 0).slice(0, 5);
};

interface SalePaymentFormProps {
  state: SalePaymentFormState;
  onChange: (state: SalePaymentFormState) => void;
  settings: SalePaymentSettings;
  /** Valor a cobrar agora, antes de desconto/acréscimo/taxa repassada. */
  baseAmount: number;
  /** Rótulo da primeira linha do resumo (ex.: "Total da OS"). */
  baseLabel: string;
  sellers: { id: number; name: string }[];
  /** Cliente identificado — necessário para vender no crediário. */
  hasCustomer: boolean;
  /** Linhas informativas extras no resumo (ex.: entrada já paga). */
  summaryExtra?: React.ReactNode;
}

export default function SalePaymentForm({
  state, onChange, settings, baseAmount, baseLabel, sellers, hasCustomer, summaryExtra,
}: SalePaymentFormProps) {
  const [tab, setTab] = useState<FormTabId>("pagamento");
  const { payments } = state;
  const calc = computeSalePayment(baseAmount, state, settings);
  const { total, paidAmount, remaining, change, feeAmount, discountValue, surchargeValue, getFeeRate } = calc;

  const patch = (p: Partial<SalePaymentFormState>) => onChange({ ...state, ...p });
  const setPayments = (fn: (ps: SalePaymentEntry[]) => SalePaymentEntry[]) => patch({ payments: fn(payments) });
  const updatePayment = (id: string, p: Partial<SalePaymentEntry>) =>
    setPayments((ps) => ps.map((x) => (x.id === id ? { ...x, ...p } : x)));
  const removePayment = (id: string) => setPayments((ps) => (ps.length > 1 ? ps.filter((x) => x.id !== id) : ps));
  const addPayment = () => {
    const rem = Math.max(0, total - paidAmount);
    setPayments((ps) => [...ps, newSalePayment(rem > 0 ? rem.toFixed(2) : "")]);
  };

  // Mesma regra do PDV: ao trocar de método (exceto dinheiro) preenche o valor restante.
  const handleMethodChange = (id: string, method: SalePayMethod) => {
    setPayments((ps) => {
      const updated = ps.map((p) => (p.id === id ? { ...p, method, installments: 1 } : p));
      if (updated.length === 1 && method !== "money" && total > 0) {
        return updated.map((p) => (p.id === id ? { ...p, amount: total.toFixed(2) } : p));
      }
      if (updated.length > 1 && method !== "money") {
        const others = updated.filter((p) => p.id !== id).reduce((s, p) => s + (Number(p.amount) || 0), 0);
        const rem = Math.max(0, total - others);
        if (rem > 0) return updated.map((p) => (p.id === id ? { ...p, amount: rem.toFixed(2) } : p));
      }
      return updated;
    });
  };

  const methodBtn = (active: boolean, activeCls: string) =>
    cn("flex h-10 flex-col items-center justify-center gap-0.5 rounded-lg border text-[11px] font-medium transition-all",
      active ? `${activeCls} text-white shadow-sm` : "border-slate-200 bg-white text-slate-500 hover:border-slate-400");

  const stepper = (label: string, value: string, mode: "R$" | "%", activeColor: string,
    onValue: (v: string) => void, onMode: (m: "R$" | "%") => void) => (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-slate-600">{label}</label>
      <div className="flex gap-1.5">
        <div className="flex shrink-0 gap-0.5 rounded-lg border border-slate-200 bg-slate-100 p-0.5">
          {(["R$", "%"] as const).map((m) => (
            <button key={m} type="button" onClick={() => onMode(m)}
              className={cn("h-7 rounded-lg px-2 text-[11px] font-medium transition-all", mode === m ? `${activeColor} text-white` : "text-slate-500")}>{m}</button>
          ))}
        </div>
        <Input type="number" min="0" step="0.01" placeholder="0,00" value={value} onChange={(e) => onValue(e.target.value)}
          wrapperClassName="min-w-0 flex-1" className="text-center font-mono" aria-label={label} />
      </div>
    </div>
  );

  return (
    <Tabs<FormTabId> items={FORM_TABS} value={tab} onChange={setTab} label="Pagamento da venda">
      {tab === "pagamento" && (
        <div className="space-y-3">
          {sellers.length > 0 && (
            <Select label="Vendedor" iconLeft={<User size={12} />} value={state.sellerId}
              onChange={(e) => patch({ sellerId: e.target.value === "" ? "" : Number(e.target.value) })}>
              <option value="">Sem vendedor</option>
              {sellers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          )}

          <div className="grid grid-cols-1 gap-2.5 rounded-lg border border-slate-200 bg-white p-3 sm:grid-cols-2">
            {stepper("Desconto", state.discount, state.discountMode, "bg-blue-600",
              (v) => patch({ discount: v }), (m) => patch({ discountMode: m, discount: "" }))}
            {stepper("Acréscimo", state.surcharge, state.surchargeMode, "bg-amber-600",
              (v) => patch({ surcharge: v }), (m) => patch({ surchargeMode: m, surcharge: "" }))}
          </div>

          {payments.map((p, idx) => {
            const feeRate = getFeeRate(p);
            const pAmt = Number(p.amount) || 0;
            const pFee = feeRate > 0 && pAmt > 0 ? pAmt * (feeRate / 100) : 0;
            const thisMoneyChange = p.method === "money" && pAmt > 0 ? Math.max(0, pAmt - Math.max(0, total - (paidAmount - pAmt))) : 0;
            const isCard = p.method === "credit" || p.method === "debit";
            const activeBrands = CARD_BRANDS.filter((b) => settings.enabledBrands[b.key] !== false);
            const brandCols = activeBrands.length <= 3 ? "grid-cols-3" : activeBrands.length <= 4 ? "grid-cols-4" : "grid-cols-3";
            const installOpts = Array.from({ length: settings.maxInstallments }, (_, i) => i + 1);
            const instCols = installOpts.length <= 4 ? "grid-cols-4" : installOpts.length <= 6 ? "grid-cols-3 sm:grid-cols-6" : "grid-cols-4";
            const dueAmount = Math.max(0, total - (paidAmount - pAmt));
            const quick = p.method === "money" ? moneyQuickAmounts(dueAmount) : [];
            return (
              <div key={p.id} className="space-y-2.5 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center gap-2">
                  {payments.length > 1 && (
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[11px] font-medium text-slate-600">{idx + 1}</span>
                  )}
                  <div className="grid flex-1 grid-cols-4 gap-1.5">
                    <button type="button" onClick={() => handleMethodChange(p.id, p.method === "debit" ? "debit" : "credit")}
                      className={methodBtn(isCard, "border-emerald-500 bg-emerald-600")}>
                      <CreditCard size={13} />Cartão
                    </button>
                    <button type="button" onClick={() => handleMethodChange(p.id, "pix")}
                      className={methodBtn(p.method === "pix", "border-blue-500 bg-blue-600")}>
                      <QrCode size={13} />{PM_LABEL.pix}
                    </button>
                    <button type="button" onClick={() => handleMethodChange(p.id, "money")}
                      className={methodBtn(p.method === "money", "border-blue-500 bg-blue-600")}>
                      <Banknote size={13} />{PM_LABEL.money}
                    </button>
                    <button type="button" disabled={!hasCustomer && p.method !== "crediario"}
                      title={!hasCustomer ? "Selecione um cliente para vender no crediário" : undefined}
                      onClick={() => handleMethodChange(p.id, "crediario")}
                      className={cn(methodBtn(p.method === "crediario", "border-amber-500 bg-amber-600"), "disabled:cursor-not-allowed disabled:opacity-40")}>
                      <Clock size={13} />{PM_LABEL.crediario}
                    </button>
                  </div>
                  {payments.length > 1 && (
                    <IconButton size="xs" variant="ghost" aria-label="Remover forma de pagamento" onClick={() => removePayment(p.id)}>
                      <X size={14} />
                    </IconButton>
                  )}
                </div>

                {isCard && (
                  <div className="flex w-fit gap-0.5 rounded-lg border border-slate-200 bg-slate-100 p-0.5">
                    {(["credit", "debit"] as const).map((m) => (
                      <button key={m} type="button" onClick={() => handleMethodChange(p.id, m)}
                        className={cn("h-7 rounded-lg px-3 text-[11px] font-medium transition-all", p.method === m ? "bg-emerald-600 text-white" : "text-slate-500")}>
                        {PM_LABEL[m]}
                      </button>
                    ))}
                  </div>
                )}

                {isCard && (
                  <div className={`grid ${brandCols} gap-1`}>
                    {activeBrands.map(({ key, label, color }) => (
                      <button key={key} type="button" onClick={() => updatePayment(p.id, { cardBrand: key })}
                        className={cn("h-8 rounded-lg border text-[11px] font-medium transition-all",
                          p.cardBrand === key ? "border-transparent text-white shadow-sm" : "border-slate-200 bg-white text-slate-500 hover:border-slate-400")}
                        style={p.cardBrand === key ? { backgroundColor: color } : {}}>
                        {label}
                      </button>
                    ))}
                  </div>
                )}

                {p.method === "credit" && (
                  <div className={`grid ${instCols} gap-1`}>
                    {installOpts.map((n) => {
                      const rate = settings.cardFees[p.cardBrand]?.[n - 1] ?? 0;
                      const totalWFee = pAmt > 0 && rate > 0 ? (settings.passFeeToCustomer ? pAmt * (1 + rate / 100) : pAmt) : pAmt;
                      const perInst = n > 1 && pAmt > 0 ? totalWFee / n : 0;
                      const isActive = p.installments === n;
                      return (
                        <button key={n} type="button" onClick={() => updatePayment(p.id, { installments: n })}
                          className={cn("flex flex-col items-center justify-center gap-0.5 rounded-lg border px-1 py-1.5 transition-all",
                            isActive ? "border-emerald-500 bg-emerald-600 text-white shadow-sm" : "border-slate-200 bg-white text-slate-500 hover:border-slate-400")}>
                          <span className="text-[11px] font-medium">{n === 1 ? "À vista" : `${n}×`}</span>
                          {rate > 0 && (
                            <span className={cn("text-[10px] font-medium", isActive ? "text-emerald-200" : settings.passFeeToCustomer ? "text-blue-600" : "text-amber-600")}>
                              {settings.passFeeToCustomer ? `c/ ${rate}%` : `+${rate}%`}
                            </span>
                          )}
                          {perInst > 0 && (
                            <span className={cn("font-mono text-[10px]", isActive ? "text-emerald-200" : "text-slate-500")}>{n}×R${perInst.toFixed(2)}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {p.method === "crediario" && (
                  <div className="grid grid-cols-2 gap-2">
                    <Input label="Nº de parcelas" type="number" min="1" max="24" step="1" className="font-mono"
                      value={p.crediarioInstallments}
                      onChange={(e) => updatePayment(p.id, { crediarioInstallments: Math.max(1, Number(e.target.value) || 1) })} />
                    <Input label="Vencimento 1ª parcela" type="date" className="font-mono"
                      value={p.crediarioFirstDueDate}
                      onChange={(e) => updatePayment(p.id, { crediarioFirstDueDate: e.target.value })} />
                    {p.crediarioInstallments > 1 && pAmt > 0 && (
                      <p className="col-span-2 text-[11px] font-medium text-amber-700">
                        {p.crediarioInstallments}x de {fmtBRL(pAmt / p.crediarioInstallments)}
                      </p>
                    )}
                  </div>
                )}

                <div className="flex gap-2">
                  <Input
                    wrapperClassName="flex-1"
                    label={p.method === "money" ? "Valor recebido" : "Valor"}
                    iconLeft={<Banknote size={13} />}
                    type="number" min="0" step="0.01"
                    placeholder={idx === 0 ? (total > 0 ? fmtBRL(total) : "0,00") : "Valor (R$)"}
                    className="font-mono"
                    value={p.amount}
                    onChange={(e) => updatePayment(p.id, { amount: e.target.value })}
                  />
                  {pFee > 0.005 && (
                    <div className="flex shrink-0 flex-col items-end justify-center gap-0.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5">
                      <span className="text-[11px] font-medium text-amber-700">Taxa {feeRate}%</span>
                      <span className="font-mono text-[11px] font-medium text-amber-800">− {fmtBRL(pFee)}</span>
                      {p.installments > 1 && pAmt > 0 && p.method === "credit" && (
                        <span className="text-[10px] text-amber-600">{p.installments}× {fmtBRL((pAmt * (1 + feeRate / 100)) / p.installments)}/parc</span>
                      )}
                    </div>
                  )}
                </div>

                {p.method === "money" && (
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-500">Troco</span>
                    <span className={cn("font-mono text-xs font-medium", thisMoneyChange > 0.005 ? "text-emerald-600" : "text-slate-400")}>
                      {fmtBRL(thisMoneyChange)}
                    </span>
                  </div>
                )}

                {quick.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {quick.map((v) => (
                      <button key={v} type="button" onClick={() => updatePayment(p.id, { amount: v.toFixed(2) })}
                        className="h-7 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-medium text-slate-600 transition-all hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600">
                        R$ {v % 1 === 0 ? v.toFixed(0) : v.toFixed(2)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          <div className="flex items-center justify-between gap-2">
            <Button variant="outline" size="md" iconLeft={<PlusCircle size={14} />} onClick={addPayment}>Forma de pagamento</Button>
            {remaining > 0.009 && <span className="text-[11px] font-medium text-amber-700">Faltam {fmtBRL(remaining)}</span>}
          </div>
        </div>
      )}

      {tab === "resumo" && (
        <div className="space-y-1.5 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
          <div className="flex justify-between text-slate-500">
            <span>{baseLabel}</span><span className="font-mono">{fmtBRL(baseAmount)}</span>
          </div>
          {summaryExtra}
          {discountValue > 0 && (
            <div className="flex justify-between text-slate-500">
              <span>Desconto</span><span className="font-mono text-emerald-600">− {fmtBRL(discountValue)}</span>
            </div>
          )}
          {surchargeValue > 0 && (
            <div className="flex justify-between text-slate-500">
              <span>Acréscimo</span><span className="font-mono text-amber-600">+ {fmtBRL(surchargeValue)}</span>
            </div>
          )}
          {feeAmount > 0 && (
            <div className="flex justify-between text-slate-500">
              <span>Juros máquina</span><span className="font-mono text-orange-600">+ {fmtBRL(feeAmount)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-slate-200 pt-1.5 text-sm font-semibold text-slate-800">
            <span>Total</span><span className="font-mono">{fmtBRL(total)}</span>
          </div>
          <div className="flex justify-between text-slate-500">
            <span>Pago agora</span><span className="font-mono text-emerald-700">{fmtBRL(paidAmount)}</span>
          </div>
          {change > 0 && (
            <div className="flex justify-between text-emerald-700">
              <span>Troco</span><span className="font-mono">{fmtBRL(change)}</span>
            </div>
          )}
          {remaining > 0.005 ? (
            <div className="flex justify-between border-t border-slate-200 pt-1.5 text-red-600">
              <span>Restante</span><span className="font-mono">{fmtBRL(remaining)}</span>
            </div>
          ) : paidAmount > 0 ? (
            <div className="flex justify-between border-t border-slate-200 pt-1.5 text-emerald-700">
              <span>Pagamento OK</span><span className="font-mono">✓</span>
            </div>
          ) : null}
        </div>
      )}
    </Tabs>
  );
}
