import { Plus, Trash2 } from "lucide-react";

import { Button, IconButton } from "../../../components/ui/Button";
import { Input, Select } from "../../../components/ui/Input";
import { MAX_PERCENT, MAX_RULES, describeRules, draftToRules, validateDraft, type RuleDraft } from "./lib";

/**
 * Editor visual das faixas de comissão por mês.
 * O mês inicial de cada faixa é automático (fim da anterior + 1), então as faixas nunca ficam com buraco.
 * Deixar o "até o mês" da última faixa em branco = comissão enquanto o cliente pagar.
 */
export default function RulesEditor({ value, onChange }: { value: RuleDraft[]; onChange: (next: RuleDraft[]) => void }) {
  const { rows, general } = validateDraft(value);
  const rules = draftToRules(value);
  const valid = general === null && Object.keys(rows).length === 0;

  const update = (index: number, patch: Partial<RuleDraft>) => onChange(value.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  function addBand() {
    const last = value[value.length - 1];
    // a última faixa estava "sem fim": ela passa a durar só o mês inicial (editável) para abrir espaço à nova
    const closed = last && last.to.trim() === ""
      ? [...value.slice(0, -1), { ...last, to: String(rules[rules.length - 1]?.from ?? 1) }]
      : value;
    onChange([...closed, { to: "", type: "percent", value: "" }]);
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {value.map((row, index) => {
          const rule = rules[index];
          const isLast = index === value.length - 1;
          return (
            <div key={index} className="rounded-lg border border-slate-200 p-3">
              <div className="grid grid-cols-2 items-end gap-2 sm:grid-cols-[88px_1fr_1fr_1fr_auto]">
                <div className="flex flex-col gap-1">
                  <span className="ds-label">Do mês</span>
                  <div className="flex h-[34px] items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-600">{rule.from}</div>
                </div>
                <Input
                  label={isLast ? "Até o mês (vazio = sempre)" : "Até o mês"}
                  type="number" min={rule.from} step={1} inputMode="numeric"
                  placeholder={isLast ? "enquanto pagar" : String(rule.from)}
                  value={row.to} onChange={(e) => update(index, { to: e.target.value })}
                  error={rows[index] && /mês final|final/.test(rows[index]) ? rows[index] : undefined}
                />
                <Select label="Tipo" value={row.type} onChange={(e) => update(index, { type: e.target.value as RuleDraft["type"] })}
                  options={[{ value: "percent", label: "Percentual (%)" }, { value: "fixed", label: "Valor fixo (R$)" }]} />
                <Input
                  label={row.type === "percent" ? "Percentual" : "Valor em R$"}
                  type="number" min="0" step={row.type === "percent" ? "0.5" : "0.01"} inputMode="decimal"
                  max={row.type === "percent" ? MAX_PERCENT : undefined}
                  placeholder={row.type === "percent" ? "30" : "50,00"}
                  value={row.value} onChange={(e) => update(index, { value: e.target.value })}
                  error={rows[index] && !/mês final|final/.test(rows[index]) ? rows[index] : undefined}
                />
                <IconButton variant="outline" aria-label="Remover faixa" title="Remover faixa" disabled={value.length === 1}
                  onClick={() => onChange(value.filter((_, i) => i !== index))}>
                  <Trash2 size={14} />
                </IconButton>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button size="sm" variant="outline" iconLeft={<Plus size={13} />} onClick={addBand} disabled={value.length >= MAX_RULES}>Adicionar faixa</Button>
        {general && <p className="text-xs font-medium text-red-600">{general}</p>}
      </div>

      <div className={`rounded-lg border px-3 py-2.5 text-xs ${valid ? "border-emerald-200 bg-emerald-50/60 text-emerald-800" : "border-slate-200 bg-slate-50 text-slate-500"}`}>
        <p className="text-[10px] font-semibold uppercase tracking-wide opacity-70">Como o afiliado vai ler</p>
        <p className="mt-1 font-medium">{valid ? describeRules(rules) : "Corrija as faixas acima para ver o resumo."}</p>
        {valid && rules[rules.length - 1].to === null && <p className="mt-1 opacity-80">Sem limite de meses: ele recebe enquanto o cliente continuar pagando.</p>}
      </div>
    </div>
  );
}
