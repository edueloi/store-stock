// Geração de parcelas pra recorrência em Contas a Pagar/Receber — mesmo algoritmo de
// updateDebtInstallments (customers.controller.ts, crediário), generalizado pra permitir
// intervalo em dia/semana/mês e valor variável por parcela (o crediário só tem mensal +
// valor fixo dividido igual).

export type IntervalUnit = "day" | "week" | "month";
export type ValueMode = "fixed" | "variable";

export interface RecurrenceInput {
  installments_count: number;
  interval_unit: IntervalUnit;
  interval_count?: number;
  value_mode?: ValueMode;
  // Obrigatório e já validado (soma == total) pelo frontend quando value_mode === "variable".
  amounts?: number[];
}

export interface GeneratedInstallment {
  installment_number: number;
  due_date: Date;
  amount: number;
}

// Avança uma data em N dias/semanas/meses — usado tanto pra gerar parcelas quanto pra
// calcular a próxima ocorrência de uma conta recorrente de valor variável.
export function advanceDate(date: Date, unit: IntervalUnit, count: number): Date {
  const next = new Date(date);
  if (unit === "day") next.setDate(next.getDate() + count);
  else if (unit === "week") next.setDate(next.getDate() + count * 7);
  else next.setMonth(next.getMonth() + count);
  return next;
}

export function generateInstallments(
  totalAmount: number,
  firstDueDate: Date,
  recurrence: RecurrenceInput,
): GeneratedInstallment[] {
  const count = Math.max(1, Math.floor(recurrence.installments_count));
  const intervalCount = Math.max(1, Math.floor(recurrence.interval_count ?? 1));
  const variable = recurrence.value_mode === "variable";

  if (variable && (recurrence.amounts?.length ?? 0) !== count) {
    throw new Error("Número de valores informados não bate com o número de parcelas.");
  }

  // Sobra/ajuste sempre na última parcela, pra soma bater exatamente com o total mesmo
  // quando a divisão não é exata (ex.: R$100 em 3x = 33.33 + 33.33 + 33.34).
  const baseAmount = Math.floor((totalAmount / count) * 100) / 100;
  let accumulated = 0;
  const result: GeneratedInstallment[] = [];

  for (let i = 0; i < count; i++) {
    const dueDate = advanceDate(firstDueDate, recurrence.interval_unit, i * intervalCount);

    let amount: number;
    if (variable) {
      amount = Math.round(Number(recurrence.amounts![i]) * 100) / 100;
    } else {
      const isLast = i === count - 1;
      amount = isLast ? Math.round((totalAmount - accumulated) * 100) / 100 : baseAmount;
    }
    accumulated += amount;

    result.push({ installment_number: i + 1, due_date: dueDate, amount });
  }

  return result;
}
