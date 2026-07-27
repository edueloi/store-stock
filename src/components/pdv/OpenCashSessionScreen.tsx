import React, { useState } from "react";
import { Wallet, Loader2 } from "lucide-react";

interface OpenCashSessionScreenProps {
  operatorName?: string;
  onOpen: (openingAmount: number, openingNote?: string) => Promise<void>;
  disabled?: boolean;
  disabledMessage?: string;
}

export default function OpenCashSessionScreen({
  operatorName, onOpen, disabled, disabledMessage,
}: OpenCashSessionScreenProps) {
  const [openingAmount, setOpeningAmount] = useState("0");
  const [openingNote, setOpeningNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (submitting || disabled) return;
    setSubmitting(true);
    setError(null);
    try {
      await onOpen(Number(openingAmount) || 0, openingNote || undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao abrir caixa");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="h-full w-full flex items-center justify-center bg-slate-100 font-sans">
      <div className="w-full max-w-sm bg-white rounded-2xl border border-slate-200 shadow-xl p-6 space-y-5">
        <div className="flex flex-col items-center text-center gap-2">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow"
            style={{ background: "linear-gradient(135deg, #3b82f6, #1d4ed8)" }}>
            <Wallet size={22} />
          </div>
          <p className="text-[14px] font-black text-slate-800">Caixa Fechado</p>
          <p className="text-[11px] text-slate-400 font-medium leading-relaxed">
            Abra o caixa informando o valor inicial em dinheiro para começar a vender.
          </p>
          {operatorName && (
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">
              Operador: {operatorName}
            </p>
          )}
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block mb-1">
              Valor inicial em dinheiro
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] font-bold text-slate-400">R$</span>
              <input
                type="number" step="0.01" min="0"
                value={openingAmount}
                onChange={(e) => setOpeningAmount(e.target.value)}
                className="w-full h-11 pl-9 pr-3 rounded-xl border border-slate-200 text-[15px] font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
              />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block mb-1">
              Observação (opcional)
            </label>
            <textarea
              value={openingNote}
              onChange={(e) => setOpeningNote(e.target.value)}
              rows={2}
              placeholder="Ex: Troco padrão do dia"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-[12px] font-medium text-slate-700 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
            />
          </div>
        </div>

        {error && (
          <p className="text-[11px] font-semibold text-red-500 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
            {error}
          </p>
        )}

        {disabled && disabledMessage && (
          <p className="text-[11px] font-semibold text-amber-600 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
            {disabledMessage}
          </p>
        )}

        <button
          onClick={handleSubmit}
          disabled={submitting || disabled}
          className="w-full h-11 rounded-xl bg-slate-900 text-white text-[12px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-slate-800 transition-all disabled:opacity-40"
        >
          {submitting ? <Loader2 size={14} className="animate-spin" /> : <Wallet size={14} />}
          {submitting ? "Abrindo..." : "Abrir Caixa"}
        </button>
      </div>
    </div>
  );
}
