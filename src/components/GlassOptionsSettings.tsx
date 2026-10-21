import { useState } from "react";
import { X } from "lucide-react";
import { FINISHES, GLASS_THICKNESS, GLASS_TYPES, PIECE_KINDS, type GlassOptions } from "../lib/glassPieces";

// Cadastro das opções que aparecem ao lançar uma peça de vidraçaria: tipos de vidro, espessuras,
// cores de perfil/ferragem e quais tipos de peça a loja trabalha. Lista vazia = usa o padrão do sistema.

const input = "min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200";

function ChipList<T extends string | number>({
  title, hint, values, defaults, parse, suffix, placeholder, onChange,
}: {
  title: string; hint: string; values: T[]; defaults: T[]; parse: (text: string) => T | null; suffix?: string; placeholder: string; onChange: (next: T[]) => void;
}) {
  const [text, setText] = useState("");
  const custom = values.length > 0;
  const shown = custom ? values : defaults;

  const add = () => {
    const parsed = parse(text.trim());
    setText("");
    if (parsed === null || shown.includes(parsed)) return;
    // ao personalizar pela primeira vez, parte da lista padrão para não "sumir" com as opções comuns
    onChange([...shown, parsed]);
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3.5">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="text-xs font-bold text-slate-800">{title}</h4>
        {custom && <button type="button" className="text-[11px] font-semibold text-blue-600 hover:underline" onClick={() => onChange([])}>Voltar ao padrão do sistema</button>}
      </div>
      <p className="mb-2.5 text-[11px] text-slate-500">{hint}{custom ? "" : " Você ainda está usando a lista padrão — adicione ou remova para personalizar."}</p>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {shown.map((v) => (
          <span key={String(v)} className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 py-1 pl-3 pr-1.5 text-xs font-medium text-slate-700">
            {v}{suffix}
            <button type="button" aria-label={`Remover ${v}`} className="rounded-full p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
              onClick={() => onChange(shown.filter((x) => x !== v))}><X size={12} /></button>
          </span>
        ))}
        {shown.length === 0 && <span className="text-xs text-slate-400">Nenhuma opção.</span>}
      </div>
      <div className="flex gap-2">
        <input className={input} value={text} placeholder={placeholder} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
        <button type="button" onClick={add} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">Adicionar</button>
      </div>
    </div>
  );
}

export default function GlassOptionsSettings({ value, onChange }: { value: GlassOptions; onChange: (next: GlassOptions) => void }) {
  const kindsOn = value.kinds?.length ? value.kinds : PIECE_KINDS.map((k) => k.value);
  const toggleKind = (kind: string) => {
    const next = kindsOn.includes(kind) ? kindsOn.filter((k) => k !== kind) : [...kindsOn, kind];
    // todos marcados = padrão (lista vazia); impede desmarcar o último
    if (next.length === 0) return;
    onChange({ ...value, kinds: next.length === PIECE_KINDS.length ? [] : next });
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">Opções da peça de vidraçaria</h3>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          Estas são as listas que aparecem ao lançar uma peça no orçamento, na ordem de serviço e na solicitação de orçamento da loja virtual.
          Cadastre aqui os vidros, espessuras e cores de perfil que a sua vidraçaria realmente trabalha.
        </p>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <ChipList<string>
          title="Tipos de vidro" hint="Ex.: Incolor, Fumê, Temperado, Laminado." values={value.glass_types ?? []} defaults={GLASS_TYPES}
          parse={(t) => (t ? t.slice(0, 60) : null)} placeholder="Novo tipo de vidro" onChange={(next) => onChange({ ...value, glass_types: next })}
        />
        <ChipList<number>
          title="Espessuras" hint="Em milímetros." values={value.thicknesses ?? []} defaults={GLASS_THICKNESS} suffix=" mm"
          parse={(t) => { const n = Math.round(Number(t.replace(",", "."))); return n > 0 && n <= 30 ? n : null; }} placeholder="Ex.: 10"
          onChange={(next) => onChange({ ...value, thicknesses: [...next].sort((a, b) => a - b) })}
        />
        <ChipList<string>
          title="Cores de perfil / ferragem" hint="Ex.: Branco, Preto, Bronze, Cromado." values={value.finishes ?? []} defaults={FINISHES}
          parse={(t) => (t ? t.slice(0, 60) : null)} placeholder="Nova cor ou acabamento" onChange={(next) => onChange({ ...value, finishes: next })}
        />

        <div className="rounded-xl border border-slate-200 bg-white p-3.5">
          <h4 className="mb-1 text-xs font-bold text-slate-800">Tipos de peça que você trabalha</h4>
          <p className="mb-2.5 text-[11px] text-slate-500">Desmarque o que não faz para a lista ficar mais enxuta.</p>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
            {PIECE_KINDS.map((k) => (
              <label key={k.value} className="flex items-center gap-2 text-xs text-slate-700">
                <input type="checkbox" className="accent-blue-600" checked={kindsOn.includes(k.value)} onChange={() => toggleKind(k.value)} />
                {k.label}
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
