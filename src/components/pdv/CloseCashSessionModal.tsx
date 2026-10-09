import React, { useState } from "react";
import { Wallet, CheckCircle2, Calculator, Pencil } from "lucide-react";
import { Button } from "../ui/Button";
import { Input, Textarea } from "../ui/Input";
import { Badge } from "../ui/Badge";
import { Alert } from "../ui/Alert";
import { Tabs } from "../ui/Tabs";
import { Modal, ModalFooter } from "../ui/Modal";
import { ClosedCashSession, CASH_DENOMINATIONS } from "../../lib/cashSession";

const MODE_TABS = [
  { id: "simple", label: "Digitar valor", icon: Pencil },
  { id: "count", label: "Contar cédulas", icon: Calculator },
] as const;
type CashMode = typeof MODE_TABS[number]["id"];

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
      <dt className="text-[10px] font-semibold text-slate-400">{label}</dt>
      <dd className={`mt-0.5 truncate font-mono text-[12px] font-semibold ${tone}`} title={value}>{value}</dd>
    </div>
  );
}

export default function CloseCashSessionModal({ onCancel, onConfirm, onFinish }: CloseCashSessionModalProps) {
  const [step, setStep] = useState<"count" | "result">("count");
  const [mode, setMode] = useState<CashMode>("simple");
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

  const isCount = step === "count";
  const pendingSync = !isCount && !!result?.pendingSync;
  const title = isCount ? "Fechar Caixa" : "Resultado do Fechamento";
  const size = isCount && mode === "count" ? "lg" : isCount ? "md" : "lg";

  const footer = isCount ? (
    <ModalFooter align="between">
      <div className="flex min-w-0 items-center gap-2">
        {mode === "count" && (
          <Badge color="info" size="md">Total contado: R$ {denomTotal.toFixed(2)}</Badge>
        )}
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" size="lg" onClick={onCancel} disabled={submitting}>Cancelar</Button>
        <Button variant="primary" size="lg" onClick={handleConfirm} disabled={submitting} loading={submitting}
          iconLeft={<Wallet size={14} />}>
          {submitting ? "Confirmando..." : "Confirmar Fechamento"}
        </Button>
      </div>
    </ModalFooter>
  ) : (
    <ModalFooter>
      <Button variant="primary" size="lg" onClick={onFinish}>Concluir</Button>
    </ModalFooter>
  );

  return (
    <Modal
      open
      onClose={isCount ? onCancel : () => {}}
      persistent={!isCount}
      hideCloseButton={!isCount}
      title={title}
      size={size}
      footer={footer}
    >
      {isCount ? (
        <div className="space-y-3">
          <p className="hidden text-[11px] leading-relaxed text-slate-500 sm:block">
            Informe o valor em dinheiro contado na gaveta. O valor esperado só será exibido
            após a confirmação — e a ação não poderá ser desfeita.
          </p>

          <Tabs<CashMode> items={MODE_TABS} value={mode} onChange={setMode} label="Forma de informar o dinheiro contado">
            {mode === "simple" ? (
              <Input
                label="Dinheiro contado"
                type="text" inputMode="numeric" autoFocus
                value={countedMoneyDisplay}
                onChange={(e) => setCountedMoneyCents(e.target.value.replace(/\D/g, ""))}
                addonLeft="R$"
                className="font-mono font-semibold"
              />
            ) : (
              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-600">Quantidade de cada cédula/moeda</p>
                <div className="grid grid-cols-2 gap-1.5 lg:grid-cols-3">
                  {CASH_DENOMINATIONS.map((d) => {
                    const qty = Number(denomCounts[d.value]) || 0;
                    return (
                      <div key={d.value} className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 transition-colors ${
                        qty > 0 ? "border-blue-200 bg-blue-50/40" : "border-slate-200 bg-white"
                      }`}>
                        <Badge size="sm" color={d.kind === "bill" ? "success" : "warning"} className="shrink-0">
                          {d.kind === "bill" ? "Nota" : "Moeda"}
                        </Badge>
                        <span className="min-w-0 flex-1 whitespace-nowrap text-[11px] font-semibold text-slate-700">{d.label}</span>
                        <Input
                          type="text" inputMode="numeric" placeholder="0"
                          aria-label={`Quantidade de ${d.label}`}
                          value={denomCounts[d.value] ?? ""}
                          onChange={(e) => setDenomCount(d.value, e.target.value)}
                          wrapperClassName="w-14 shrink-0"
                          className="px-1 text-center font-mono font-semibold"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </Tabs>

          <Textarea
            label="Observações (opcional)"
            value={closingNote}
            onChange={(e) => setClosingNote(e.target.value)}
            rows={mode === "count" ? 1 : 2}
            className="resize-none"
          />

          {error && <Alert variant="error">{error}</Alert>}

          <Alert variant="warning">Após confirmar, os valores não poderão ser alterados.</Alert>
        </div>
      ) : pendingSync ? (
        <div className="space-y-4">
          <Alert variant="warning" title="Fechamento registrado offline">
            O caixa foi encerrado neste terminal e a conferência por forma de pagamento será
            calculada assim que a internet voltar e os dados sincronizarem com o servidor.
          </Alert>
        </div>
      ) : (
        <div className="space-y-4">
          <div className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 ${
            diff === 0 ? "bg-emerald-50 border-emerald-100" : diff > 0 ? "bg-blue-50 border-blue-100" : "bg-red-50 border-red-100"
          }`}>
            <CheckCircle2 size={16} className={diff === 0 ? "text-emerald-500" : diff > 0 ? "text-blue-500" : "text-red-500"} />
            <p className={`text-[12px] font-semibold ${diff === 0 ? "text-emerald-700" : diff > 0 ? "text-blue-700" : "text-red-700"}`}>
              {diff === 0 ? "Caixa bateu certinho" : diff > 0 ? `Sobra de ${fmt(diff)}` : `Falta de ${fmt(Math.abs(diff))}`}
            </p>
          </div>

          <div className="space-y-2">
            {Object.entries(breakdown).map(([method, entry]) => {
              const differenceTone = entry.difference === undefined ? "text-slate-400" :
                entry.difference === 0 ? "text-emerald-600" : entry.difference > 0 ? "text-blue-600" : "text-rose-600";
              const differenceValue = entry.difference === undefined ? "Não informado" :
                entry.difference === 0 ? "Confere" : `${entry.difference > 0 ? "+" : ""}${fmt(entry.difference)}`;
              const differenceColor = entry.difference === undefined ? "default" :
                entry.difference === 0 ? "success" : entry.difference > 0 ? "info" : "danger";

              return (
                <section key={method} className="rounded-lg border border-slate-200 bg-white p-3 sm:p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h3 className="text-[12px] font-semibold text-slate-800">{METHOD_LABELS[method] ?? method}</h3>
                    <Badge size="sm" color={differenceColor} className="shrink-0">{differenceValue}</Badge>
                  </div>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
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
            <dl className="grid grid-cols-2 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:p-4">
              <ClosingMetric label="Total de taxas" value={`-${fmt(totalFee)}`} tone="text-amber-600" />
              <ClosingMetric label="Líquido esperado" value={fmt(Number(result?.expected_amount ?? 0) - totalFee)} />
            </dl>
          )}
        </div>
      )}
    </Modal>
  );
}
