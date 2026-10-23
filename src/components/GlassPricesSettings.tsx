import { Plus, Trash2, Wand2 } from "lucide-react";
import { resolveGlassOptions, type GlassOptions, type GlassPriceRow } from "../lib/glassPieces";

// Tabela de preços do m² por tipo de vidro e espessura. Ao lançar uma peça, o orçamento e a ordem de
// serviço usam o preço desta tabela; se não houver linha para o vidro escolhido, vale o preço por m² do serviço.

const input = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200";

export default function GlassPricesSettings({ value, options, onChange }: { value: GlassPriceRow[]; options?: GlassOptions; onChange: (next: GlassPriceRow[]) => void }) {
  const lists = resolveGlassOptions(options);
  const update = (index: number, patch: Partial<GlassPriceRow>) => onChange(value.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  const keyOf = (r: Pick<GlassPriceRow, "glass" | "thickness_mm">) => `${r.glass.toLowerCase()}|${r.thickness_mm ?? ""}`;

  // Cria as linhas que faltam (todos os vidros × todas as espessuras) para só preencher os valores.
  const fillMissing = () => {
    const have = new Set(value.map(keyOf));
    const extra: GlassPriceRow[] = [];
    for (const glass of lists.glassTypes) for (const thickness_mm of lists.thicknesses) {
      if (!have.has(keyOf({ glass, thickness_mm }))) extra.push({ glass, thickness_mm, price_m2: 0 });
    }
    onChange([...value, ...extra]);
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">Tabela de preços do vidro</h3>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          Preço do m² por tipo de vidro e espessura. Ao lançar uma peça, o valor é calculado por esta tabela. Se não houver linha para o vidro
          escolhido, vale o preço por m² do serviço. Linha com espessura &quot;qualquer&quot; serve para todas as espessuras daquele vidro que não tiverem preço próprio.
        </p>
      </div>

      <div className="space-y-2">
        {value.length === 0 && <p className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-xs text-slate-400">Nenhum preço na tabela — os orçamentos usam o preço por m² de cada serviço.</p>}
        {value.map((r, i) => (
          <div key={i} className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-[1.3fr_1fr_0.9fr_auto] sm:items-end">
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-slate-500">Tipo de vidro</label>
              <select className={input} value={r.glass} onChange={(e) => update(i, { glass: e.target.value })}>
                {(lists.glassTypes.includes(r.glass) ? lists.glassTypes : [r.glass, ...lists.glassTypes]).map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-slate-500">Espessura</label>
              <select className={input} value={r.thickness_mm ?? ""} onChange={(e) => update(i, { thickness_mm: e.target.value ? Number(e.target.value) : null })}>
                <option value="">Qualquer espessura</option>
                {(r.thickness_mm && !lists.thicknesses.includes(r.thickness_mm) ? [r.thickness_mm, ...lists.thicknesses] : lists.thicknesses).map((t) => <option key={t} value={t}>{t} mm</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-slate-500">Preço do m² (R$)</label>
              <input className={input} inputMode="decimal" placeholder="0,00" value={r.price_m2 || ""}
                onChange={(e) => update(i, { price_m2: Number(e.target.value.replace(",", ".").replace(/[^\d.]/g, "")) || 0 })} />
            </div>
            <button type="button" aria-label="Remover linha" className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"
              onClick={() => onChange(value.filter((_, j) => j !== i))}><Trash2 size={16} /></button>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => onChange([...value, { glass: lists.glassTypes[0] ?? "Incolor", thickness_mm: lists.thicknesses[0] ?? null, price_m2: 0 }])}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"><Plus size={14} /> Adicionar preço</button>
        <button type="button" onClick={fillMissing}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"><Wand2 size={14} /> Criar todas as combinações</button>
      </div>
    </div>
  );
}
