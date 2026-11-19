import { measureInputUnitOptions, sideUnitOf, defaultMeasureUnit, type SaleUnit } from "../utils/measurePricing";
import { cn } from "../lib/utils";

interface Props {
  saleUnit: SaleUnit;
  /** Unidade cadastrada no produto (m2, cm2, kg…) — é a unidade do preço. */
  productUnit?: string | null;
  /** Unidade escolhida para digitar (null = a do próprio produto). */
  value: string | null;
  onChange: (unit: string | null) => void;
}

/** "Digitar em: m | cm | mm" — a medida é convertida sozinha para a unidade do preço do produto. */
export default function MeasureUnitPicker({ saleUnit, productUnit, value, onChange }: Props) {
  const side = sideUnitOf((productUnit || defaultMeasureUnit(saleUnit)).toLowerCase());
  const current = value ?? side;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[11px] font-semibold text-slate-500">Digitar em:</span>
      {measureInputUnitOptions(saleUnit).map(([unit, label]) => (
        <button key={unit} type="button" onClick={() => onChange(unit === side ? null : unit)}
          className={cn("h-7 min-w-[40px] rounded-md border px-2 text-[11px] font-semibold transition-colors",
            current === unit ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-500 hover:border-slate-300")}>
          {label}
        </button>
      ))}
    </div>
  );
}
