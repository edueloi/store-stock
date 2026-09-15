import { PlusCircle, X } from "lucide-react";
import { cn } from "../lib/utils";
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
}

// Editor de múltiplas formas de pagamento simultâneas (dinheiro + cartão parcelado,
// por exemplo) — extraído do bloco de checkout de venda do PDV (PDV.tsx) pra ser
// reutilizado no pagamento de dívida de crediário (3 telas: CustomerDetail, PDV
// interno, PDVStandalone). Sem opção de "crediário" aqui — pagar fiado com fiado não
// faz sentido no contexto onde este editor é usado.
export default function PaymentSegmentsEditor({
  segments, onChange, cardFees, maxInstallments, enabledBrands, totalToPay,
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
        <div key={seg.id} className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 space-y-2">
          <div className="flex items-center gap-2">
            <div className="flex bg-white border border-slate-200 rounded-lg p-0.5 gap-0.5 flex-1">
              {(["money", "pix", "debit", "credit"] as const).map((m) => (
                <button key={m} onClick={() => setMethod(seg.id, m)}
                  className={cn("flex-1 h-7 rounded-md text-[9px] font-black uppercase tracking-wide transition-all",
                    seg.method === m ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-700")}>
                  {METHOD_LABELS[m]}
                </button>
              ))}
            </div>
            <input
              type="number" min="0" step="0.01" placeholder="0,00"
              value={seg.amount}
              onChange={(e) => updateSegment(seg.id, { amount: e.target.value })}
              className="w-24 h-8 px-2 bg-white border border-slate-200 rounded-lg text-[12px] font-mono font-bold text-right focus:outline-none focus:border-blue-400"
            />
            {segments.length > 1 && (
              <button onClick={() => removeSegment(seg.id)} className="text-slate-300 hover:text-red-500 transition-colors shrink-0">
                <X size={14} />
              </button>
            )}
          </div>

          {(seg.method === "debit" || seg.method === "credit") && (() => {
            const activeB = CARD_BRANDS.filter((b) => enabledBrands[b.key] !== false);
            const cols = activeB.length <= 3 ? "grid-cols-3" : activeB.length <= 4 ? "grid-cols-4" : "grid-cols-3";
            return (
              <div className={`grid ${cols} gap-1`}>
                {activeB.map(({ key, label, color }) => (
                  <button key={key} onClick={() => updateSegment(seg.id, { cardBrand: key })}
                    className={cn("h-7 rounded-lg border text-[8px] font-black uppercase tracking-widest transition-all",
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
              <div className={`grid ${cols} gap-1`}>
                {installOpts.map((n) => {
                  const rate = cardFees[seg.cardBrand]?.[n - 1] ?? 0;
                  const isActive = seg.installments === n;
                  return (
                    <button key={n} onClick={() => updateSegment(seg.id, { installments: n })}
                      className={cn("rounded-lg border transition-all flex flex-col items-center justify-center py-1.5 px-1 gap-0.5",
                        isActive ? "bg-emerald-600 border-emerald-500 text-white shadow-sm" : "bg-white border-slate-200 text-slate-500 hover:border-slate-400")}>
                      <span className="text-[8px] font-black uppercase tracking-widest">{n === 1 ? "À vista" : `${n}×`}</span>
                      {rate > 0 && (
                        <span className={cn("text-[7px] font-bold", isActive ? "text-emerald-200" : "text-amber-500")}>+{rate}%</span>
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
        <button onClick={addSegment}
          className="h-8 px-3 bg-white border border-slate-200 rounded-lg text-[10px] font-black uppercase tracking-wide text-slate-500 hover:border-slate-400 transition-all flex items-center gap-1.5">
          <PlusCircle size={13} /> Forma de pagamento
        </button>
        {Math.abs(diff) > 0.005 && (
          <span className={cn("text-[10px] font-bold", diff > 0 ? "text-amber-600" : "text-red-600")}>
            {diff > 0 ? `Faltam R$ ${diff.toFixed(2)}` : `Excede em R$ ${Math.abs(diff).toFixed(2)}`}
          </span>
        )}
      </div>
    </div>
  );
}
