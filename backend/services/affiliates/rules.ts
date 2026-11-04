// Regras de comissão por faixa de mês.
//   [{ from: 1, to: 1, type: "percent", value: 40 }, { from: 2, to: 6, type: "percent", value: 20 }, { from: 7, to: null, type: "fixed", value: 10 }]
// `to: null` (só na última faixa) = o afiliado recebe enquanto o cliente continuar pagando.
// O Asaas calcula o percentual sobre o valor líquido da cobrança (depois das taxas), e o fixo é em reais.

export type RuleType = "percent" | "fixed";

export interface CommissionRule {
  from: number;
  to: number | null;
  type: RuleType;
  value: number;
}

export interface SplitEntry {
  walletId: string;
  percentualValue?: number;
  fixedValue?: number;
}

const MAX_RULES = 12;
const MAX_PERCENT = 100; // 100% = a cobrança inteira (o Asaas calcula sobre o líquido e nunca passa dele)
const MAX_FIXED = 100_000;

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Valida e normaliza as faixas. Lança Error com mensagem em português quando algo não fecha. */
export function parseRules(input: unknown): CommissionRule[] {
  if (!Array.isArray(input) || input.length === 0) throw new Error("Informe ao menos uma faixa de comissão.");
  if (input.length > MAX_RULES) throw new Error(`No máximo ${MAX_RULES} faixas por plano.`);

  const rules: CommissionRule[] = input.map((raw, i) => {
    const r = (raw ?? {}) as Record<string, unknown>;
    const from = Number(r.from);
    const to = r.to === null || r.to === undefined || r.to === "" ? null : Number(r.to);
    const type = r.type === "fixed" ? "fixed" : r.type === "percent" ? "percent" : null;
    const value = Number(r.value);

    if (!Number.isInteger(from) || from < 1) throw new Error(`Faixa ${i + 1}: o mês inicial precisa ser um número inteiro a partir de 1.`);
    if (to !== null && (!Number.isInteger(to) || to < from)) throw new Error(`Faixa ${i + 1}: o mês final precisa ser igual ou maior que o inicial.`);
    if (!type) throw new Error(`Faixa ${i + 1}: escolha percentual ou valor fixo.`);
    if (!Number.isFinite(value) || value <= 0) throw new Error(`Faixa ${i + 1}: informe um valor maior que zero.`);
    if (type === "percent" && value > MAX_PERCENT) throw new Error(`Faixa ${i + 1}: o percentual máximo é ${MAX_PERCENT}%.`);
    if (type === "fixed" && value > MAX_FIXED) throw new Error(`Faixa ${i + 1}: valor fixo alto demais.`);

    return { from, to, type, value: type === "percent" ? Math.round(value * 10000) / 10000 : round2(value) };
  });

  rules.sort((a, b) => a.from - b.from);

  if (rules[0].from !== 1) throw new Error("A primeira faixa precisa começar no mês 1.");
  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i];
    const next = rules[i + 1];
    if (rule.to === null && next) throw new Error("Só a última faixa pode ficar sem mês final (comissão enquanto o cliente pagar).");
    if (next && next.from !== (rule.to as number) + 1) {
      throw new Error(`As faixas precisam ser seguidas: depois do mês ${rule.to} a próxima começa no mês ${(rule.to as number) + 1}.`);
    }
  }

  return rules;
}

/** Faixa que vale para a n-ésima cobrança (1 = primeira mensalidade). `null` fora da vigência. */
export function ruleForSequence(rules: CommissionRule[], sequence: number): CommissionRule | null {
  if (!Number.isInteger(sequence) || sequence < 1) return null;
  return rules.find((r) => sequence >= r.from && (r.to === null || sequence <= r.to)) ?? null;
}

/** Quantos meses o afiliado recebe. `null` = sem limite; 0 = sem regras. */
export function windowMonths(rules: CommissionRule[]): number | null {
  if (rules.length === 0) return 0;
  const last = rules[rules.length - 1];
  return last.to;
}

export function splitEntry(walletId: string, rule: CommissionRule): SplitEntry {
  return rule.type === "percent" ? { walletId, percentualValue: rule.value } : { walletId, fixedValue: rule.value };
}

/** Quanto a faixa rende numa cobrança com esse valor líquido (ou bruto, se o líquido ainda não existe). */
export function commissionAmount(rule: CommissionRule, base: number): number {
  return rule.type === "percent" ? round2((base * rule.value) / 100) : round2(Math.min(rule.value, base));
}

/** Texto curto de uma faixa, para telas e e-mails. */
export function describeRule(rule: CommissionRule): string {
  const months = rule.to === null ? `do mês ${rule.from} em diante` : rule.from === rule.to ? `mês ${rule.from}` : `meses ${rule.from} a ${rule.to}`;
  const amount = rule.type === "percent" ? `${String(rule.value).replace(".", ",")}%` : `R$ ${rule.value.toFixed(2).replace(".", ",")}`;
  return `${months}: ${amount}`;
}
