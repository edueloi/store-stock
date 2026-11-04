// Verificação sem banco das regras de comissão por faixa de mês. Rode com: npx tsx scripts/verify-affiliates.ts
import assert from "node:assert/strict";

import { commissionAmount, describeRule, parseRules, ruleForSequence, splitEntry, windowMonths } from "../backend/services/affiliates/rules";

const ok = (name: string, fn: () => void) => {
  fn();
  console.log("ok  ", name);
};
const throwsMsg = (fn: () => unknown, part: string) => {
  assert.throws(fn, (e: Error) => e.message.includes(part), `esperava erro com "${part}"`);
};

const plan = parseRules([
  { from: 1, to: 1, type: "percent", value: 40 },
  { from: 2, to: 6, type: "percent", value: 20 },
  { from: 7, to: null, type: "fixed", value: 10 },
]);

ok("faixas válidas e ordenadas", () => assert.equal(plan.length, 3));
ok("1ª mensalidade", () => assert.deepEqual(ruleForSequence(plan, 1), { from: 1, to: 1, type: "percent", value: 40 }));
ok("meses 2 a 6", () => {
  for (const n of [2, 3, 6]) assert.equal(ruleForSequence(plan, n)?.value, 20);
});
ok("mês 7 em diante (sem fim)", () => {
  assert.equal(ruleForSequence(plan, 7)?.type, "fixed");
  assert.equal(ruleForSequence(plan, 120)?.value, 10);
});
ok("janela sem limite", () => assert.equal(windowMonths(plan), null));

const three = parseRules([{ from: 1, to: 1, type: "fixed", value: 50 }, { from: 2, to: 3, type: "percent", value: 15 }]);
ok("janela de 3 meses", () => assert.equal(windowMonths(three), 3));
ok("fora da janela não tem faixa", () => assert.equal(ruleForSequence(three, 4), null));
ok("sequência inválida", () => {
  assert.equal(ruleForSequence(three, 0), null);
  assert.equal(ruleForSequence(three, 1.5), null);
});

ok("aceita ordem embaralhada", () => {
  const r = parseRules([{ from: 2, to: null, type: "percent", value: 10 }, { from: 1, to: 1, type: "percent", value: 30 }]);
  assert.equal(r[0].from, 1);
});

ok("rejeita lista vazia", () => throwsMsg(() => parseRules([]), "ao menos uma faixa"));
ok("rejeita começar depois do mês 1", () => throwsMsg(() => parseRules([{ from: 2, to: null, type: "percent", value: 10 }]), "mês 1"));
ok("rejeita buraco entre faixas", () => throwsMsg(() => parseRules([{ from: 1, to: 2, type: "percent", value: 10 }, { from: 4, to: null, type: "percent", value: 10 }]), "seguidas"));
ok("rejeita faixa aberta no meio", () => throwsMsg(() => parseRules([{ from: 1, to: null, type: "percent", value: 10 }, { from: 2, to: null, type: "percent", value: 10 }]), "última faixa"));
ok("rejeita percentual acima de 100", () => throwsMsg(() => parseRules([{ from: 1, to: null, type: "percent", value: 101 }]), "máximo"));
ok("aceita 100% na primeira mensalidade e valor fixo depois (R$ 150 + 11 x R$ 30)", () => {
  const r = parseRules([{ from: 1, to: 1, type: "percent", value: 100 }, { from: 2, to: 12, type: "fixed", value: 30 }]);
  assert.equal(windowMonths(r), 12);
  assert.equal(ruleForSequence(r, 1)?.value, 100);
  assert.equal(ruleForSequence(r, 12)?.value, 30);
  assert.equal(ruleForSequence(r, 13), null);
  assert.equal(commissionAmount(r[0], 148.5), 148.5); // 100% do líquido
});
ok("rejeita valor zero ou negativo", () => throwsMsg(() => parseRules([{ from: 1, to: null, type: "fixed", value: 0 }]), "maior que zero"));
ok("rejeita mês final menor que o inicial", () => throwsMsg(() => parseRules([{ from: 3, to: 2, type: "percent", value: 10 }]), "final"));
ok("rejeita tipo desconhecido", () => throwsMsg(() => parseRules([{ from: 1, to: null, type: "x", value: 10 }]), "percentual ou valor fixo"));

ok("split percentual (formato do Asaas)", () => assert.deepEqual(splitEntry("w-1", plan[0]), { walletId: "w-1", percentualValue: 40 }));
ok("split fixo (formato do Asaas)", () => assert.deepEqual(splitEntry("w-1", plan[2]), { walletId: "w-1", fixedValue: 10 }));

ok("comissão percentual sobre o líquido", () => assert.equal(commissionAmount(plan[0], 120), 48));
ok("comissão fixa nunca passa do líquido", () => {
  assert.equal(commissionAmount(plan[2], 120), 10);
  assert.equal(commissionAmount(plan[2], 6), 6);
});
ok("arredondamento em 2 casas", () => assert.equal(commissionAmount({ from: 1, to: null, type: "percent", value: 33.3333 }, 100), 33.33));

ok("texto legível", () => {
  assert.equal(describeRule(plan[0]), "mês 1: 40%");
  assert.equal(describeRule(plan[1]), "meses 2 a 6: 20%");
  assert.equal(describeRule(plan[2]), "do mês 7 em diante: R$ 10,00");
});

console.log("\nTodas as verificações de regras passaram.");
