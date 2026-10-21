import { PIECE_KINDS } from "../lib/glassPieces";
import type { GlassDefaults } from "./GlassPieceFields";

// Padrão de corte da loja (vidraçaria): sangria e margem de segurança usadas ao lançar uma peça.
// Vale para toda a equipe; cada tipo de peça pode ter o seu valor. Só Tailwind básico.

const field = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200";

const toNum = (v: string): number | undefined => {
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) && n > 0 ? Math.min(n, 50) : undefined;
};

export default function GlassDefaultsSettings({ value, onChange }: { value: GlassDefaults; onChange: (next: GlassDefaults) => void }) {
  const setGlobal = (key: "gap_mm" | "waste_pct", text: string) => onChange({ ...value, [key]: toNum(text) });

  const setKind = (kind: string, key: "gap_mm" | "waste_pct", text: string) => {
    const current = { ...(value.by_kind ?? {}) };
    const merged = { ...(current[kind] ?? {}), [key]: toNum(text) };
    if (merged.gap_mm === undefined && merged.waste_pct === undefined) delete current[kind];
    else current[kind] = merged;
    onChange({ ...value, by_kind: current });
  };

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">Corte do vidro — padrões da loja</h3>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          <b>Sangria</b> é a folga descontada de cada lado do vão para chegar à medida de corte. A <b>margem de segurança</b> acrescenta uma folga na área cobrada (perda de corte, quebra).
          Estes valores já vêm preenchidos ao lançar uma peça no orçamento ou na ordem de serviço, e ainda dá para ajustar peça a peça.
        </p>
      </div>

      <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600">Sangria padrão (mm por lado)</label>
          <input className={field} inputMode="decimal" placeholder="Ex.: 3" value={value.gap_mm ?? ""} onChange={(e) => setGlobal("gap_mm", e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600">Margem de segurança padrão (%)</label>
          <input className={field} inputMode="decimal" placeholder="Ex.: 5" value={value.waste_pct ?? ""} onChange={(e) => setGlobal("waste_pct", e.target.value)} />
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold text-slate-700">Por tipo de peça <span className="font-normal text-slate-500">(em branco usa o padrão acima)</span></p>
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full min-w-[420px] text-left text-xs">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-3 py-2 font-medium">Tipo</th>
                <th className="px-3 py-2 font-medium">Sangria (mm/lado)</th>
                <th className="px-3 py-2 font-medium">Margem (%)</th>
              </tr>
            </thead>
            <tbody>
              {PIECE_KINDS.map((k) => (
                <tr key={k.value} className="border-t border-slate-100">
                  <td className="px-3 py-1.5 font-medium text-slate-700">{k.label}</td>
                  <td className="px-3 py-1.5">
                    <input className={field} inputMode="decimal" aria-label={`Sangria de ${k.label}`} placeholder={value.gap_mm ? String(value.gap_mm) : "—"} value={value.by_kind?.[k.value]?.gap_mm ?? ""} onChange={(e) => setKind(k.value, "gap_mm", e.target.value)} />
                  </td>
                  <td className="px-3 py-1.5">
                    <input className={field} inputMode="decimal" aria-label={`Margem de ${k.label}`} placeholder={value.waste_pct ? String(value.waste_pct) : "—"} value={value.by_kind?.[k.value]?.waste_pct ?? ""} onChange={(e) => setKind(k.value, "waste_pct", e.target.value)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
