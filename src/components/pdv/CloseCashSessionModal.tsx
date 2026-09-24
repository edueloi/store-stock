import React, { useState } from "react";
import { X, Wallet, Loader2, AlertTriangle, CheckCircle2, Calculator, Pencil } from "lucide-react";
import { ClosedCashSession, CASH_DENOMINATIONS } from "../../lib/cashSession";

interface CloseCashSessionModalProps {
  // Cancela a operação sem fechar o caixa de verdade — só fecha o modal, o
  // caixa continua aberto normalmente. Só disponível antes de confirmar
  // (step "count"): depois de confirmado, o fechamento já aconteceu de
  // verdade no backend e não há mais o que cancelar.
  onCancel: () => void;
  onConfirm: (countedAmount: number, countedBreakdown?: Record<string, number>, closingNote?: string) => Promise<ClosedCashSession>;
  // Chamado só depois que o fechamento já foi confirmado com sucesso — aí sim
  // é seguro limpar a sessão de caixa do estado local (e deslogar, se configurado).
  onFinish: () => void;
}

const METHOD_LABELS: Record<string, string> = {
  money: "Dinheiro", pix: "PIX", debit: "Débito", credit: "Crédito", crediario: "Crediário",
};

function fmt(v: number | string) {
  return `R$ ${Number(v).toFixed(2)}`;
}

function ClosingMetric({ label, value, tone = "text-slate-800" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[9px] font-black uppercase tracking-wider text-slate-400">{label}</dt>
      <dd className={`mt-0.5 truncate font-mono text-[12px] font-bold ${tone}`} title={value}>{value}</dd>
    </div>
  );
}

export default function CloseCashSessionModal({ onCancel, onConfirm, onFinish }: CloseCashSessionModalProps) {
  const [step, setStep] = useState<"count" | "result">("count");
  const [mode, setMode] = useState<"simple" | "count">("simple");
  // Guarda os dígitos como centavos (ex.: "9795" = R$ 97,95) e formata na
  // exibição — mesma máscara monetária usada no valor de item avulso do PDV.
  const [countedMoneyCents, setCountedMoneyCents] = useState("");
  const countedMoney = countedMoneyCents ? Number(countedMoneyCents) / 100 : 0;
  const countedMoneyDisplay = countedMoney.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const [denomCounts, setDenomCounts] = useState<Record<number, string>>({});
  const denomTotal = CASH_DENOMINATIONS.reduce(
    (sum, d) => sum + d.value * (Number(denomCounts[d.value]) || 0), 0,
  );
  const setDenomCount = (value: number, qty: string) => {
    setDenomCounts((prev) => ({ ...prev, [value]: qty.replace(/\D/g, "") }));
  };
  const finalCountedMoney = mode === "count" ? denomTotal : countedMoney;
  const [closingNote, setClosingNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ClosedCashSession | null>(null);

  const handleConfirm = async () => {
    if (submitting) return;
    if (mode === "simple" && countedMoneyCents === "") {
      setError("Informe o valor contado em dinheiro");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const session = await onConfirm(finalCountedMoney, undefined, closingNote || undefined);
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
  const totalFee = Object.values(breakdown).reduce((sum, entry) => sum + (entry.fee ?? 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className={`w-full bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden transition-all max-h-[90vh] flex flex-col ${
        step === "count" && mode === "count" ? "max-w-2xl" : step === "result" ? "max-w-lg" : "max-w-md"
      }`}>
        <div className="flex items-center justify-between px-5 h-12 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2">
            <Wallet size={16} className="text-slate-500" />
            <p className="text-[13px] font-black text-slate-800">
              {step === "count" ? "Fechar Caixa" : "Resultado do Fechamento"}
            </p>
          </div>
          {step === "count" && (
            <button onClick={onCancel} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-400">
              <X size={16} />
            </button>
          )}
        </div>

        {step === "count" ? (
          <div className="flex flex-col min-h-0 flex-1">
            <div className="px-5 pt-4 pb-3 space-y-3 shrink-0">
              <p className="text-[11px] text-slate-400 font-medium leading-relaxed hidden sm:block">
                Informe o valor em dinheiro contado na gaveta. O valor esperado só será exibido
                após a confirmação — e a ação não poderá ser desfeita.
              </p>

              <div className="flex bg-slate-100 border border-slate-200 rounded-xl p-1 gap-1 max-w-sm">
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
            </div>

            <div className="px-5 space-y-3 overflow-y-auto min-h-0 flex-1">
              {mode === "simple" ? (
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block mb-1">
                    Dinheiro contado
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] font-bold text-slate-400">R$</span>
                    <input
                      type="text" inputMode="numeric" autoFocus
                      value={countedMoneyDisplay}
                      onChange={(e) => setCountedMoneyCents(e.target.value.replace(/\D/g, ""))}
                      className="w-full h-11 pl-9 pr-3 rounded-xl border border-slate-200 text-[15px] font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block">
                    Quantidade de cada cédula/moeda
                  </label>
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-1.5">
                    {CASH_DENOMINATIONS.map((d) => {
                      const qty = Number(denomCounts[d.value]) || 0;
                      return (
                        <div key={d.value} className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border transition-colors ${
                          qty > 0 ? "border-blue-200 bg-blue-50/40" : "border-slate-200 bg-white"
                        }`}>
                          <span className={`text-[8px] font-black uppercase tracking-wide px-1 py-0.5 rounded shrink-0 ${
                            d.kind === "bill" ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                          }`}>
                            {d.kind === "bill" ? "Nota" : "Moeda"}
                          </span>
                          <span className="text-[11px] font-bold text-slate-700 flex-1 min-w-0 whitespace-nowrap">{d.label}</span>
                          <input
                            type="text" inputMode="numeric" placeholder="0"
                            value={denomCounts[d.value] ?? ""}
                            onChange={(e) => setDenomCount(d.value, e.target.value)}
                            className="w-12 h-8 px-1 rounded-md border border-slate-200 text-[12px] font-mono font-bold text-center text-slate-800 shrink-0 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block mb-1">
                  Observações (opcional)
                </label>
                <textarea
                  value={closingNote}
                  onChange={(e) => setClosingNote(e.target.value)}
                  rows={mode === "count" ? 1 : 2}
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
            </div>

            <div className="px-5 pb-5 pt-3 shrink-0 space-y-2">
              {mode === "count" && (
                <div className="flex items-center justify-between gap-2 px-4 py-2 rounded-xl bg-blue-50 border border-blue-100">
                  <span className="text-[9px] font-black uppercase tracking-widest text-blue-600 whitespace-nowrap">Total contado</span>
                  <span className="text-[16px] font-mono font-black text-blue-700 whitespace-nowrap">R$ {denomTotal.toFixed(2)}</span>
                </div>
              )}
              <button
                onClick={handleConfirm}
                disabled={submitting}
                className="w-full h-11 rounded-xl bg-slate-900 text-white text-[12px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-slate-800 transition-all disabled:opacity-40"
              >
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <Wallet size={14} />}
                {submitting ? "Confirmando..." : "Confirmar Fechamento"}
              </button>
            </div>
          </div>
        ) : result?.pendingSync ? (
          <div className="p-4 sm:p-5 space-y-4 overflow-y-auto min-h-0">
            <div className="flex items-center gap-2 rounded-xl px-3 py-2.5 border bg-amber-50 border-amber-100">
              <AlertTriangle size={16} className="text-amber-500" />
              <p className="text-[12px] font-black text-amber-700">Fechamento registrado offline</p>
            </div>
            <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
              O caixa foi encerrado neste terminal e a conferência por forma de pagamento será
              calculada assim que a internet voltar e os dados sincronizarem com o servidor.
            </p>
            <button
              onClick={onFinish}
              className="w-full h-11 rounded-xl bg-slate-900 text-white text-[12px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all"
            >
              Concluir
            </button>
          </div>
        ) : (
          <div className="p-4 sm:p-5 space-y-4 overflow-y-auto min-h-0">
            <div className={`flex items-center gap-2 rounded-xl px-3 py-2.5 border ${
              diff === 0 ? "bg-emerald-50 border-emerald-100" : diff > 0 ? "bg-blue-50 border-blue-100" : "bg-red-50 border-red-100"
            }`}>
              <CheckCircle2 size={16} className={diff === 0 ? "text-emerald-500" : diff > 0 ? "text-blue-500" : "text-red-500"} />
              <p className={`text-[12px] font-black ${diff === 0 ? "text-emerald-700" : diff > 0 ? "text-blue-700" : "text-red-700"}`}>
                {diff === 0 ? "Caixa bateu certinho" : diff > 0 ? `Sobra de ${fmt(diff)}` : `Falta de ${fmt(Math.abs(diff))}`}
              </p>
            </div>

            <div className="space-y-2">
              {Object.entries(breakdown).map(([method, entry]) => {
                const differenceTone = entry.difference === undefined ? "text-slate-400" :
                  entry.difference === 0 ? "text-emerald-600" : entry.difference > 0 ? "text-blue-600" : "text-rose-600";
                const differenceValue = entry.difference === undefined ? "Não informado" :
                  entry.difference === 0 ? "Confere" : `${entry.difference > 0 ? "+" : ""}${fmt(entry.difference)}`;

                return (
                  <section key={method} className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <h3 className="text-[12px] font-black text-slate-800">{METHOD_LABELS[method] ?? method}</h3>
                      <span className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-wide ${
                        entry.difference === undefined ? "bg-slate-100 text-slate-500" :
                        entry.difference === 0 ? "bg-emerald-50 text-emerald-700" : entry.difference > 0 ? "bg-blue-50 text-blue-700" : "bg-rose-50 text-rose-700"
                      }`}>
                        {differenceValue}
                      </span>
                    </div>
                    <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3">
                      <ClosingMetric label="Esperado" value={fmt(entry.expected)} />
                      <ClosingMetric label="Taxa" value={entry.fee ? `-${fmt(entry.fee)}` : "Sem taxa"} tone={entry.fee ? "text-amber-600" : "text-slate-500"} />
                      <ClosingMetric label="Líquido" value={entry.net !== undefined ? fmt(entry.net) : "—"} />
                      <ClosingMetric label="Contado" value={entry.counted !== undefined ? fmt(entry.counted) : "Não contado"} />
                      <ClosingMetric label="Diferença" value={differenceValue} tone={differenceTone} />
                    </dl>
                  </section>
                );
              })}
            </div>

            {totalFee > 0 && (
              <dl className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
                <ClosingMetric label="Total de taxas" value={`-${fmt(totalFee)}`} tone="text-amber-600" />
                <ClosingMetric label="Líquido esperado" value={fmt(Number(result?.expected_amount ?? 0) - totalFee)} />
              </dl>
            )}

            <button
              onClick={onFinish}
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
