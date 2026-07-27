import React, { useState } from "react";
import { X, Wallet, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { ClosedCashSession } from "../../lib/cashSession";

interface CloseCashSessionModalProps {
  onClose: () => void;
  onConfirm: (countedAmount: number, countedBreakdown?: Record<string, number>, closingNote?: string) => Promise<ClosedCashSession>;
}

const METHOD_LABELS: Record<string, string> = {
  money: "Dinheiro", pix: "PIX", debit: "Débito", credit: "Crédito", crediario: "Crediário",
};

function fmt(v: number | string) {
  return `R$ ${Number(v).toFixed(2)}`;
}

export default function CloseCashSessionModal({ onClose, onConfirm }: CloseCashSessionModalProps) {
  const [step, setStep] = useState<"count" | "result">("count");
  const [countedMoney, setCountedMoney] = useState("");
  const [closingNote, setClosingNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ClosedCashSession | null>(null);

  const handleConfirm = async () => {
    if (submitting) return;
    if (countedMoney === "") {
      setError("Informe o valor contado em dinheiro");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const session = await onConfirm(Number(countedMoney) || 0, undefined, closingNote || undefined);
      setResult(session);
      setStep("result");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao fechar caixa");
    } finally {
      setSubmitting(false);
    }
  };

  const breakdown = result?.payment_breakdown ?? {};
  const diff = result ? Number(result.difference_amount) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 h-14 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Wallet size={16} className="text-slate-500" />
            <p className="text-[13px] font-black text-slate-800">
              {step === "count" ? "Fechar Caixa" : "Resultado do Fechamento"}
            </p>
          </div>
          {step === "count" && (
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-400">
              <X size={16} />
            </button>
          )}
        </div>

        {step === "count" ? (
          <div className="p-5 space-y-4">
            <p className="text-[11px] text-slate-400 font-medium leading-relaxed">
              Informe o valor em dinheiro contado na gaveta. O valor esperado só será exibido
              após a confirmação — e a ação não poderá ser desfeita.
            </p>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block mb-1">
                Dinheiro contado
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] font-bold text-slate-400">R$</span>
                <input
                  type="number" step="0.01" min="0" autoFocus
                  value={countedMoney}
                  onChange={(e) => setCountedMoney(e.target.value)}
                  className="w-full h-11 pl-9 pr-3 rounded-xl border border-slate-200 text-[15px] font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block mb-1">
                Observações (opcional)
              </label>
              <textarea
                value={closingNote}
                onChange={(e) => setClosingNote(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-[12px] font-medium text-slate-700 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
              />
            </div>

            {error && (
              <p className="text-[11px] font-semibold text-red-500 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                {error}
              </p>
            )}

            <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
              <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
              <p className="text-[10px] font-semibold text-amber-700 leading-relaxed">
                Após confirmar, os valores não poderão ser alterados.
              </p>
            </div>

            <button
              onClick={handleConfirm}
              disabled={submitting}
              className="w-full h-11 rounded-xl bg-slate-900 text-white text-[12px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-slate-800 transition-all disabled:opacity-40"
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <Wallet size={14} />}
              {submitting ? "Confirmando..." : "Confirmar Fechamento"}
            </button>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            <div className={`flex items-center gap-2 rounded-xl px-3 py-2.5 border ${
              diff === 0 ? "bg-emerald-50 border-emerald-100" : diff > 0 ? "bg-blue-50 border-blue-100" : "bg-red-50 border-red-100"
            }`}>
              <CheckCircle2 size={16} className={diff === 0 ? "text-emerald-500" : diff > 0 ? "text-blue-500" : "text-red-500"} />
              <p className={`text-[12px] font-black ${diff === 0 ? "text-emerald-700" : diff > 0 ? "text-blue-700" : "text-red-700"}`}>
                {diff === 0 ? "Caixa bateu certinho" : diff > 0 ? `Sobra de ${fmt(diff)}` : `Falta de ${fmt(Math.abs(diff))}`}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-[11px]">
                <thead className="bg-slate-50 text-slate-400 uppercase tracking-widest text-[9px] font-bold">
                  <tr>
                    <td className="px-3 py-2">Forma</td>
                    <td className="px-3 py-2 text-right">Esperado</td>
                    <td className="px-3 py-2 text-right">Contado</td>
                    <td className="px-3 py-2 text-right">Diferença</td>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(breakdown).map(([method, entry]) => (
                    <tr key={method} className="border-t border-slate-100">
                      <td className="px-3 py-2 font-bold text-slate-700">{METHOD_LABELS[method] ?? method}</td>
                      <td className="px-3 py-2 text-right font-mono text-slate-600">{fmt(entry.expected)}</td>
                      <td className="px-3 py-2 text-right font-mono text-slate-600">
                        {entry.counted !== undefined ? fmt(entry.counted) : "—"}
                      </td>
                      <td className={`px-3 py-2 text-right font-mono font-bold ${
                        entry.difference === undefined ? "text-slate-300" :
                        entry.difference === 0 ? "text-slate-500" : entry.difference > 0 ? "text-blue-600" : "text-red-500"
                      }`}>
                        {entry.difference !== undefined ? fmt(entry.difference) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button
              onClick={onClose}
              className="w-full h-11 rounded-xl bg-slate-900 text-white text-[12px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all"
            >
              Concluir
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
