import React, { useState } from "react";
import { Wallet, Calculator, Pencil } from "lucide-react";
import { Button } from "../ui/Button";
import { Input, Textarea } from "../ui/Input";
import { Tabs } from "../ui/Tabs";
import { Badge } from "../ui/Badge";
import { CASH_DENOMINATIONS as DENOMINATIONS } from "../../lib/cashSession";

const MODE_TABS = [
  { id: "simple", label: "Digitar valor", icon: Pencil },
  { id: "count", label: "Contar cédulas", icon: Calculator },
] as const;
type CashMode = typeof MODE_TABS[number]["id"];

interface OpenCashSessionScreenProps {
  operatorName?: string;
  onOpen: (openingAmount: number, openingNote?: string) => Promise<void>;
  disabled?: boolean;
  disabledMessage?: string;
}

export default function OpenCashSessionScreen({
  operatorName, onOpen, disabled, disabledMessage,
}: OpenCashSessionScreenProps) {
  const [mode, setMode] = useState<CashMode>("simple");
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
      <div className={`w-full bg-white rounded-lg border border-slate-200 shadow-sm p-6 space-y-5 my-auto transition-all ${
        mode === "count" ? "max-w-4xl" : "max-w-sm"
      }`}>
        <div className="flex flex-col items-center text-center gap-2">
          <div className="w-12 h-12 rounded-lg flex items-center justify-center text-white shadow"
            style={{ background: "linear-gradient(135deg, #3b82f6, #1d4ed8)" }}>
            <Wallet size={22} />
          </div>
          <p className="text-[14px] font-semibold text-slate-800">Caixa Fechado</p>
          <p className="text-[11px] text-slate-400 font-medium leading-relaxed">
            Abra o caixa informando o valor inicial em dinheiro para começar a vender.
          </p>
          {operatorName && (
            <p className="text-[11px] font-semibold text-slate-400 mt-1">
              Operador: {operatorName}
            </p>
          )}
        </div>

        <Tabs<CashMode> items={MODE_TABS} value={mode} onChange={setMode} label="Forma de informar o valor inicial">
        <div className="space-y-3">
          {mode === "simple" ? (
            <Input
              label="Valor inicial em dinheiro"
              type="number" step="0.01" min="0"
              value={openingAmount}
              onChange={(e) => setOpeningAmount(e.target.value)}
              addonLeft="R$"
              className="font-mono font-semibold"
            />
          ) : (
            <div className="space-y-3">
              <label className="text-[11px] font-semibold text-slate-500 block">
                Quantidade de cada cédula/moeda
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[50vh] sm:max-h-80 overflow-y-auto pr-0.5">
                {DENOMINATIONS.map((d) => {
                  const qty = Number(counts[d.value]) || 0;
                  const subtotal = qty * d.value;
                  return (
                    <div key={d.value} className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                      qty > 0 ? "border-blue-200 bg-blue-50/40" : "border-slate-200 bg-white"
                    }`}>
                      <Badge size="sm" color={d.kind === "bill" ? "success" : "warning"} className="shrink-0">
                        {d.kind === "bill" ? "Nota" : "Moeda"}
                      </Badge>
                      <span className="text-[12px] font-semibold text-slate-700 flex-1 min-w-0 whitespace-nowrap">{d.label}</span>
                      <Input
                        type="text" inputMode="numeric" placeholder="0"
                        aria-label={`Quantidade de ${d.label}`}
                        value={counts[d.value] ?? ""}
                        onChange={(e) => setCount(d.value, e.target.value)}
                        wrapperClassName="w-16 shrink-0"
                        className="text-center font-mono font-semibold"
                      />
                      <span className="text-[11px] font-mono font-semibold text-slate-400 w-16 text-right shrink-0 hidden sm:block">
                        {subtotal > 0 ? `R$ ${subtotal.toFixed(2)}` : "—"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <div className={mode === "count" ? "grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end" : ""}>
            <Textarea
              label="Observação (opcional)"
              value={openingNote}
              onChange={(e) => setOpeningNote(e.target.value)}
              rows={2}
              placeholder="Ex: Troco padrão do dia"
              className="resize-none"
            />
            {mode === "count" && (
              <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-1 px-4 py-2.5 rounded-lg bg-blue-50 border border-blue-100 sm:h-[62px]">
                <span className="text-[10px] font-semibold text-blue-600 whitespace-nowrap">Total contado</span>
                <span className="text-[18px] font-mono font-semibold text-blue-700 whitespace-nowrap">R$ {countedTotal.toFixed(2)}</span>
              </div>
            )}
          </div>
        </div>
        </Tabs>

        {error && (
          <p className="text-[11px] font-semibold text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {disabled && disabledMessage && (
          <p className="text-[11px] font-semibold text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
            {disabledMessage}
          </p>
        )}

        <Button
          variant="primary" size="lg" fullWidth
          onClick={handleSubmit}
          disabled={submitting || disabled}
          loading={submitting}
          iconLeft={<Wallet size={14} />}
          className="h-11"
        >
          {submitting ? "Abrindo..." : `Abrir Caixa · R$ ${finalAmount.toFixed(2)}`}
        </Button>
      </div>
    </div>
  );
}
