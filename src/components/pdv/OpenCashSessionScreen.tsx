import React, { useState } from "react";
import { Wallet, Loader2, Calculator, Pencil } from "lucide-react";
import { CASH_DENOMINATIONS as DENOMINATIONS } from "../../lib/cashSession";

interface OpenCashSessionScreenProps {
  operatorName?: string;
  onOpen: (openingAmount: number, openingNote?: string) => Promise<void>;
  disabled?: boolean;
  disabledMessage?: string;
}

export default function OpenCashSessionScreen({
  operatorName, onOpen, disabled, disabledMessage,
}: OpenCashSessionScreenProps) {
  const [mode, setMode] = useState<"simple" | "count">("simple");
  const [openingAmount, setOpeningAmount] = useState("0");
  const [counts, setCounts] = useState<Record<number, string>>({});
  const [openingNote, setOpeningNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const countedTotal = DENOMINATIONS.reduce(
    (sum, d) => sum + d.value * (Number(counts[d.value]) || 0), 0,
  );

  const finalAmount = mode === "count" ? countedTotal : Number(openingAmount) || 0;

  const setCount = (value: number, qty: string) => {
    setCounts((prev) => ({ ...prev, [value]: qty.replace(/\D/g, "") }));
  };

  const handleSubmit = async () => {
    if (submitting || disabled) return;
    setSubmitting(true);
    setError(null);
    try {
      await onOpen(finalAmount, openingNote || undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao abrir caixa");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="h-full w-full flex items-center justify-center bg-slate-100 font-sans overflow-y-auto py-6 px-4">
      <div className={`w-full bg-white rounded-2xl border border-slate-200 shadow-xl p-6 space-y-5 my-auto transition-all ${
        mode === "count" ? "max-w-4xl" : "max-w-sm"
      }`}>
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

        <div className="flex bg-slate-100 border border-slate-200 rounded-xl p-1 gap-1 max-w-sm mx-auto">
          <button
            onClick={() => setMode("simple")}
            className={`flex-1 h-8 rounded-lg text-[10px] font-black uppercase tracking-wide flex items-center justify-center gap-1.5 transition-all ${
              mode === "simple" ? "bg-white text-slate-800 shadow" : "text-slate-400"
            }`}
          >
            <Pencil size={12} /> Digitar valor
          </button>
          <button
            onClick={() => setMode("count")}
            className={`flex-1 h-8 rounded-lg text-[10px] font-black uppercase tracking-wide flex items-center justify-center gap-1.5 transition-all ${
              mode === "count" ? "bg-white text-slate-800 shadow" : "text-slate-400"
            }`}
          >
            <Calculator size={12} /> Contar cédulas
          </button>
        </div>

        <div className="space-y-3">
          {mode === "simple" ? (
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
          ) : (
            <div className="space-y-3">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block">
                Quantidade de cada cédula/moeda
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[50vh] sm:max-h-80 overflow-y-auto pr-0.5">
                {DENOMINATIONS.map((d) => {
                  const qty = Number(counts[d.value]) || 0;
                  const subtotal = qty * d.value;
                  return (
                    <div key={d.value} className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-colors ${
                      qty > 0 ? "border-blue-200 bg-blue-50/40" : "border-slate-200 bg-white"
                    }`}>
                      <span className={`text-[9px] font-black uppercase tracking-wide px-1.5 py-1 rounded shrink-0 ${
                        d.kind === "bill" ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                      }`}>
                        {d.kind === "bill" ? "Nota" : "Moeda"}
                      </span>
                      <span className="text-[12px] font-bold text-slate-700 flex-1 min-w-0 whitespace-nowrap">{d.label}</span>
                      <input
                        type="text" inputMode="numeric" placeholder="0"
                        value={counts[d.value] ?? ""}
                        onChange={(e) => setCount(d.value, e.target.value)}
                        className="w-14 h-9 px-2 rounded-lg border border-slate-200 text-[13px] font-mono font-bold text-center text-slate-800 shrink-0 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                      />
                      <span className="text-[10px] font-mono font-bold text-slate-400 w-16 text-right shrink-0 hidden sm:block">
                        {subtotal > 0 ? `R$ ${subtotal.toFixed(2)}` : "—"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <div className={mode === "count" ? "grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end" : ""}>
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
            {mode === "count" && (
              <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-1 px-4 py-2.5 rounded-xl bg-blue-50 border border-blue-100 sm:h-[62px]">
                <span className="text-[9px] font-black uppercase tracking-widest text-blue-600 whitespace-nowrap">Total contado</span>
                <span className="text-[18px] font-mono font-black text-blue-700 whitespace-nowrap">R$ {countedTotal.toFixed(2)}</span>
              </div>
            )}
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
          {submitting ? "Abrindo..." : `Abrir Caixa · R$ ${finalAmount.toFixed(2)}`}
        </button>
      </div>
    </div>
  );
}
