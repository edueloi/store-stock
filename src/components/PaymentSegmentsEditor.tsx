import { PlusCircle, X } from "lucide-react";
import { cn } from "../lib/utils";
import { Button, IconButton } from "./ui/Button";
import { Input } from "./ui/Input";
import { CARD_BRANDS, CardBrand } from "../lib/payment-constants";

export interface PaymentSegment {
  id: string;
  method: "money" | "pix" | "debit" | "credit";
  cardBrand: CardBrand;
  installments: number;
  amount: string; // valor digitado, string pra permitir campo vazio durante a edição
}

const METHOD_LABELS: Record<PaymentSegment["method"], string> = {
  money: "Dinheiro", pix: "PIX", debit: "Débito", credit: "Crédito",
};

const METHOD_COLORS: Record<PaymentSegment["method"], { bg: string; border: string; text: string }> = {
  money: { bg: "bg-emerald-600", border: "border-emerald-500", text: "text-emerald-600" },
  pix: { bg: "bg-cyan-600", border: "border-cyan-500", text: "text-cyan-600" },
  debit: { bg: "bg-blue-600", border: "border-blue-500", text: "text-blue-600" },
  credit: { bg: "bg-violet-600", border: "border-violet-500", text: "text-violet-600" },
};

export function newPaymentSegment(amount = ""): PaymentSegment {
  return { id: crypto.randomUUID(), method: "money", cardBrand: "other", installments: 1, amount };
}

interface PaymentSegmentsEditorProps {
  segments: PaymentSegment[];
  onChange: (segments: PaymentSegment[]) => void;
  cardFees: Record<string, number[]>;
  maxInstallments: number;
  enabledBrands: Record<string, boolean>;
  // Valor total que precisa ser coberto pela soma dos segmentos (saldo devedor da
  // dívida/parcela) — usado só pra mostrar a diferença visualmente, não bloqueia
  // digitação.
  totalToPay: number;
  // No crediário, a diferença positiva é um saldo que continuará em aberto,
  // não um impedimento para registrar o pagamento parcial.
  allowPartial?: boolean;
}

// Editor de múltiplas formas de pagamento simultâneas (dinheiro + cartão parcelado,
// por exemplo) — extraído do bloco de checkout de venda do PDV (PDV.tsx) pra ser
// reutilizado no pagamento de dívida de crediário (3 telas: CustomerDetail, PDV
// interno, PDVStandalone). Sem opção de "crediário" aqui — pagar fiado com fiado não
// faz sentido no contexto onde este editor é usado.
export default function PaymentSegmentsEditor({
  segments, onChange, cardFees, maxInstallments, enabledBrands, totalToPay, allowPartial = false,
}: PaymentSegmentsEditorProps) {
  const updateSegment = (id: string, patch: Partial<PaymentSegment>) => {
    onChange(segments.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };
  const setMethod = (id: string, method: PaymentSegment["method"]) => {
    updateSegment(id, { method, ...(method !== "credit" ? { installments: 1 } : {}) });
  };
  const addSegment = () => onChange([...segments, newPaymentSegment()]);
  const removeSegment = (id: string) => onChange(segments.filter((s) => s.id !== id));

  const sum = segments.reduce((s, seg) => s + (Number(seg.amount) || 0), 0);
  const diff = Math.round((totalToPay - sum) * 100) / 100;

  return (
    <div className="space-y-3">
      {segments.map((seg) => (
        <div key={seg.id} className="bg-white border border-slate-200 rounded-lg p-3 space-y-2.5">
          <div className="flex items-center gap-2">
            <div className="flex bg-slate-100 border border-slate-200 rounded-lg p-0.5 gap-0.5 flex-1">
              {(["money", "pix", "debit", "credit"] as const).map((m) => {
                const colors = METHOD_COLORS[m];
                return (
                  <button key={m} onClick={() => setMethod(seg.id, m)}
                    className={cn("flex-1 h-8 rounded-lg text-[10px] font-semibold transition-all cursor-pointer",
                      seg.method === m ? `${colors.bg} text-white shadow-sm` : "text-slate-500 hover:text-slate-700 hover:bg-white")}>
                    {METHOD_LABELS[m]}
                  </button>
                );
              })}
            </div>
            <Input
              type="number" min="0" step="0.01" placeholder="0,00"
              value={seg.amount}
              onChange={(e) => updateSegment(seg.id, { amount: e.target.value })}
              wrapperClassName="w-24 shrink-0"
              className="font-mono text-right"
            />
            {segments.length > 1 && (
              <IconButton variant="ghost" size="sm" aria-label="Remover forma de pagamento" onClick={() => removeSegment(seg.id)}>
                <X size={13} />
              </IconButton>
            )}
          </div>

          {(seg.method === "debit" || seg.method === "credit") && (() => {
            const activeB = CARD_BRANDS.filter((b) => enabledBrands[b.key] !== false);
            const cols = activeB.length <= 3 ? "grid-cols-3" : activeB.length <= 4 ? "grid-cols-4" : "grid-cols-3";
            return (
              <div className={`grid ${cols} gap-1.5`}>
                {activeB.map(({ key, label, color }) => (
                  <button key={key} onClick={() => updateSegment(seg.id, { cardBrand: key })}
                    className={cn("h-8 rounded-lg border text-[10px] font-semibold transition-all cursor-pointer",
                      seg.cardBrand === key ? "text-white border-transparent shadow-sm" : "bg-white border-slate-200 text-slate-500 hover:border-slate-400")}
                    style={seg.cardBrand === key ? { backgroundColor: color } : {}}>
                    {label}
                  </button>
                ))}
              </div>
            );
          })()}

          {seg.method === "credit" && (() => {
            const installOpts = Array.from({ length: maxInstallments }, (_, i) => i + 1);
            const cols = installOpts.length <= 4 ? "grid-cols-4" : installOpts.length <= 6 ? "grid-cols-3 sm:grid-cols-6" : "grid-cols-4";
            return (
              <div className={`grid ${cols} gap-1.5`}>
                {installOpts.map((n) => {
                  const rate = cardFees[seg.cardBrand]?.[n - 1] ?? 0;
                  const isActive = seg.installments === n;
                  return (
                    <button key={n} onClick={() => updateSegment(seg.id, { installments: n })}
                      className={cn("rounded-lg border transition-all flex flex-col items-center justify-center py-2 px-1 gap-0.5 cursor-pointer",
                        isActive ? "bg-emerald-600 border-emerald-500 text-white shadow-sm" : "bg-white border-slate-200 text-slate-500 hover:border-emerald-300 hover:bg-emerald-50")}>
                      <span className="text-[10px] font-semibold">{n === 1 ? "À vista" : `${n}×`}</span>
                      {rate > 0 && (
                        <span className={cn("text-[7px] font-semibold", isActive ? "text-emerald-200" : "text-amber-500")}>+{rate}%</span>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })()}
        </div>
      ))}

      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" size="md" iconLeft={<PlusCircle size={14} />} onClick={addSegment}>
          Forma de pagamento
        </Button>
        {Math.abs(diff) > 0.005 && (
          <span className={cn("text-[11px] font-semibold", diff > 0 ? "text-amber-600" : "text-red-600")}>
            {diff > 0
              ? allowPartial
                ? `Pagamento parcial: R$ ${diff.toFixed(2)} permanecerá em aberto`
                : `Faltam R$ ${diff.toFixed(2)}`
              : `Excede em R$ ${Math.abs(diff).toFixed(2)}`}
          </span>
        )}
      </div>
    </div>
  );
}
