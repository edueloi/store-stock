import { Plus, Trash2 } from "lucide-react";
import { EXTRA_MODES, type ExtraMode, type GlassExtra } from "../lib/glassPieces";

// Cadastro dos adicionais cobrados numa peça de vidraçaria (furos, lapidação, puxador, instalação…).
// Na hora de lançar a peça a equipe marca os que se aplicam e o valor é somado ao do vidro.

const input = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200";

const newId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10));

export default function GlassExtrasSettings({ value, onChange }: { value: GlassExtra[]; onChange: (next: GlassExtra[]) => void }) {
  const update = (id: string, patch: Partial<GlassExtra>) => onChange(value.map((e) => (e.id === id ? { ...e, ...patch } : e)));

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">Adicionais da peça</h3>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          Serviços cobrados à parte numa peça: furos, lapidação, polimento, puxador, ferragens, instalação. Ao lançar a peça no orçamento
          ou na ordem de serviço, é só marcar os que se aplicam — o valor é somado ao do vidro.
        </p>
      </div>

      <div className="space-y-2">
        {value.length === 0 && <p className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-xs text-slate-400">Nenhum adicional cadastrado ainda.</p>}
        {value.map((e) => (
          <div key={e.id} className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-[1.4fr_1.2fr_0.7fr_auto] sm:items-end">
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-slate-500">Nome</label>
              <input className={input} value={e.name} maxLength={60} placeholder="Ex.: Furo, Lapidação, Instalação" onChange={(ev) => update(e.id, { name: ev.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-slate-500">Como cobrar</label>
              <select className={input} value={e.mode} onChange={(ev) => update(e.id, { mode: ev.target.value as ExtraMode })}>
                {EXTRA_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-slate-500">Valor (R$)</label>
              <input className={input} inputMode="decimal" value={e.price || ""} placeholder="0,00"
                onChange={(ev) => update(e.id, { price: Number(ev.target.value.replace(",", ".").replace(/[^\d.]/g, "")) || 0 })} />
            </div>
            <button type="button" aria-label={`Remover ${e.name || "adicional"}`} className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"
              onClick={() => onChange(value.filter((x) => x.id !== e.id))}><Trash2 size={16} /></button>
          </div>
        ))}
      </div>

      <button type="button" onClick={() => onChange([...value, { id: newId(), name: "", mode: "fixed", price: 0 }])}
        className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
        <Plus size={14} /> Adicionar adicional
      </button>
    </div>
  );
}
