import { Banknote, CreditCard, Landmark, Plus, QrCode, Trash2, Wallet } from "lucide-react";
import { cn } from "../../lib/utils";
import { Alert, Button } from "../../components/ui";

export type PayMethod = "money" | "pix" | "debit" | "credit" | "crediario";

export interface PayLine {
  id: string;
  method: PayMethod;
  amount: string; // só editável quando há mais de uma forma; com uma só vale o total devido
  brand: string;
  installments: number;
  received: string; // dinheiro: valor entregue pelo cliente (para calcular o troco)
}

const METHODS: { key: PayMethod; label: string; icon: typeof Banknote }[] = [
  { key: "money", label: "Dinheiro", icon: Banknote },
  { key: "pix", label: "PIX", icon: QrCode },
  { key: "debit", label: "Débito", icon: CreditCard },
  { key: "credit", label: "Crédito", icon: CreditCard },
  { key: "crediario", label: "Crediário", icon: Landmark },
];

const BRANDS = [
  { key: "visa", label: "Visa" }, { key: "master", label: "Mastercard" }, { key: "elo", label: "Elo" },
  { key: "amex", label: "Amex" }, { key: "hiper", label: "Hipercard" }, { key: "other", label: "Outra" },
];

export const newPayLine = (method: PayMethod = "money"): PayLine => ({
  id: Math.random().toString(36).slice(2), method, amount: "", brand: "visa", installments: 1, received: "",
});

const toNum = (v: string) => {
  const n = Number(String(v).replace(/\./g, "").replace(",", "."));
  const direct = Number(String(v).replace(",", "."));
  // "12.50" digitado com ponto decimal vale 12.5; "1.250,00" vale 1250
  return Number.isFinite(direct) && !String(v).includes(",") ? direct : Number.isFinite(n) ? n : 0;
};
const money = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;
const round2 = (v: number) => Math.round(v * 100) / 100;

export function lineAmount(lines: PayLine[], index: number, due: number) {
  return lines.length === 1 ? due : round2(toNum(lines[index].amount));
}

export interface PayCheck {
  paid: number;
  remaining: number;
  change: number;
  crediarioInstallments: number;
  ok: boolean;
  problem: string | null;
}

export function checkPayLines(lines: PayLine[], due: number, hasCustomer: boolean): PayCheck {
  let paid = 0, change = 0, crediarioInstallments = 1;
  let problem: string | null = null;
  lines.forEach((l, i) => {
    const amt = lineAmount(lines, i, due);
    paid += amt;
    if (l.method === "money" && l.received.trim()) {
      const rec = toNum(l.received);
      if (rec + 0.005 < amt) problem = "O valor recebido em dinheiro é menor que o valor da forma de pagamento";
      else change += round2(rec - amt);
    }
    if (l.method === "crediario") {
      crediarioInstallments = l.installments;
      if (!hasCustomer) problem = "Crediário exige cliente identificado — escolha outra forma";
    }
  });
  paid = round2(paid);
  const remaining = round2(due - paid);
  if (!problem && Math.abs(remaining) > 0.009) {
    problem = remaining > 0 ? `Faltam ${money(remaining)} para fechar a diferença` : `Os pagamentos passam ${money(Math.abs(remaining))} da diferença`;
  }
  return { paid, remaining, change: round2(change), crediarioInstallments, ok: !problem, problem };
}

export function payLinesPayload(lines: PayLine[], due: number) {
  return lines.map((l, i) => ({
    method: l.method,
    amount: lineAmount(lines, i, due),
    brand: l.method === "debit" || l.method === "credit" ? l.brand : undefined,
    installments: l.method === "credit" ? l.installments : undefined,
  }));
}

interface Props {
  due: number;
  hasCustomer: boolean;
  lines: PayLine[];
  onChange: (lines: PayLine[]) => void;
}

// Pagamento da diferença da troca: uma ou mais formas (dinheiro com troco, PIX, débito,
// crédito com bandeira/parcelas, crediário com parcelas — este exige cliente identificado).
export default function ExchangePaymentForm({ due, hasCustomer, lines, onChange }: Props) {
  const check = checkPayLines(lines, due, hasCustomer);
  const update = (id: string, patch: Partial<PayLine>) => onChange(lines.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const remove = (id: string) => onChange(lines.filter((l) => l.id !== id));
  const addSplit = () => {
    const first = lines.length === 1 ? { ...lines[0], amount: due.toFixed(2).replace(".", ",") } : null;
    const rest = Math.max(0, check.remaining);
    const base = first ? [first] : lines;
    onChange([...base, { ...newPayLine("pix"), amount: first ? "" : rest.toFixed(2).replace(".", ",") }]);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-lg bg-amber-100 px-3 py-2 text-sm font-semibold text-amber-900">
        <span className="inline-flex items-center gap-1.5"><Wallet size={14} />Cliente paga a diferença</span>
        <span className="tabular-nums">{money(due)}</span>
      </div>

      {lines.map((l, idx) => {
        const amt = lineAmount(lines, idx, due);
        const rec = toNum(l.received);
        return (
          <div key={l.id} className="space-y-2 rounded-lg border border-slate-200 p-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {METHODS.map(({ key, label, icon: Icon }) => (
                <button key={key} type="button" onClick={() => update(l.id, { method: key })}
                  className={cn("inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors",
                    l.method === key ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-600 hover:bg-slate-50")}>
                  <Icon size={13} />{label}
                </button>
              ))}
              {lines.length > 1 && (
                <button type="button" aria-label="Remover forma" onClick={() => remove(l.id)}
                  className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-rose-500 hover:bg-rose-50"><Trash2 size={14} /></button>
              )}
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="text-[11px] font-medium text-slate-500">Valor nesta forma</span>
                <input value={lines.length === 1 ? due.toFixed(2).replace(".", ",") : l.amount}
                  readOnly={lines.length === 1}
                  onChange={(e) => update(l.id, { amount: e.target.value })}
                  inputMode="decimal" placeholder="0,00"
                  className="h-9 w-full rounded-lg border border-slate-200 px-3 text-sm tabular-nums outline-none focus:border-blue-400 read-only:bg-slate-50" />
              </label>

              {l.method === "money" && (
                <label className="space-y-1">
                  <span className="text-[11px] font-medium text-slate-500">Valor recebido (opcional, calcula o troco)</span>
                  <input value={l.received} onChange={(e) => update(l.id, { received: e.target.value })}
                    inputMode="decimal" placeholder={amt.toFixed(2).replace(".", ",")}
                    className="h-9 w-full rounded-lg border border-slate-200 px-3 text-sm tabular-nums outline-none focus:border-blue-400" />
                </label>
              )}

              {(l.method === "debit" || l.method === "credit") && (
                <label className="space-y-1">
                  <span className="text-[11px] font-medium text-slate-500">Bandeira</span>
                  <select value={l.brand} onChange={(e) => update(l.id, { brand: e.target.value })}
                    className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm outline-none focus:border-blue-400">
                    {BRANDS.map((b) => <option key={b.key} value={b.key}>{b.label}</option>)}
                  </select>
                </label>
              )}

              {(l.method === "credit" || l.method === "crediario") && (
                <label className="space-y-1">
                  <span className="text-[11px] font-medium text-slate-500">Parcelas</span>
                  <select value={l.installments} onChange={(e) => update(l.id, { installments: Number(e.target.value) })}
                    className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm outline-none focus:border-blue-400">
                    {Array.from({ length: l.method === "credit" ? 12 : 12 }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>{n}x de {money(amt / n)}</option>
                    ))}
                  </select>
                </label>
              )}
            </div>

            {l.method === "money" && l.received.trim() && rec + 0.005 >= amt && (
              <p className="text-xs font-semibold text-emerald-700">Troco: {money(round2(rec - amt))}</p>
            )}
            {l.method === "crediario" && !hasCustomer && (
              <Alert variant="warning">Crediário exige cliente identificado — esta venda foi no balcão, sem cliente.</Alert>
            )}
          </div>
        );
      })}

      <div className="flex items-center justify-between gap-2">
        <Button size="xs" variant="outline" onClick={addSplit} iconLeft={<Plus size={12} />}>Dividir em outra forma</Button>
        <span className={cn("text-xs font-semibold", check.ok ? "text-emerald-700" : "text-amber-700")}>
          {check.ok ? "Pagamento fecha com a diferença" : check.problem}
        </span>
      </div>
    </div>
  );
}
