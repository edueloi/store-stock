import React, { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, RotateCcw, Save, Trash2, X } from "lucide-react";
import { cn } from "../../lib/utils";
import { Button, Input, Modal, ModalFooter, useToast } from "../../components/ui";
import { VARIATION_PRESETS, colorHex, isColorAttr, withColors, type PresetVariation, type VariationPreset } from "../../lib/variationPresets";

interface Stored { presets: VariationPreset[]; hidden: string[] }
interface DraftVariation { name: string; text: string; colors: Record<string, string> }
interface Draft { id?: string; label: string; icon: string; variations: DraftVariation[]; replaces?: string }

const authH = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}`, "Content-Type": "application/json" });
const splitValues = (t: string) => [...new Set(t.split(/[,;\n]+/).map((v) => v.trim()).filter(Boolean))];

const toDraft = (p: VariationPreset, replaces?: string): Draft => ({
  id: p.id, label: p.label, icon: p.icon, replaces,
  variations: p.variations.map((v) => ({ name: v.name, text: v.options.join(", "), colors: { ...(v.colors ?? {}) } })),
});

/** Modelos prontos de variação: aplica, edita, esconde e cria os da loja. `current` = variações em uso no produto. */
export default function VariationPresetsPanel({ current, onApply }: {
  current: { name: string; values: string[]; colors?: Record<string, string> }[];
  onApply: (preset: VariationPreset) => void;
}) {
  const toast = useToast();
  const [stored, setStored] = useState<Stored>({ presets: [], hidden: [] });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/products/variation-presets", { headers: authH() })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setStored({ presets: d.presets ?? [], hidden: d.hidden ?? [] }))
      .catch(() => {});
  }, []);

  const list = useMemo(() => {
    const custom = stored.presets.map(withColors);
    const overridden = new Set([...stored.hidden, ...custom.map((c) => c.label.toLowerCase())]);
    const factory = VARIATION_PRESETS.filter((p) => !overridden.has(p.label.toLowerCase()));
    return [...custom.map((p) => ({ p, custom: true })), ...factory.map((p) => ({ p, custom: false }))];
  }, [stored]);

  const persist = async (next: Stored) => {
    setSaving(true);
    try {
      const res = await fetch("/api/products/variation-presets", { method: "PUT", headers: authH(), body: JSON.stringify(next) });
      if (!res.ok) throw new Error();
      setStored(await res.json());
      return true;
    } catch {
      toast.error("Não foi possível salvar os modelos agora.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const save = async () => {
    if (!draft) return;
    const label = draft.label.trim();
    const variations: PresetVariation[] = draft.variations
      .map((v) => {
        const options = splitValues(v.text);
        const colors: Record<string, string> = {};
        if (isColorAttr(v.name)) options.forEach((o) => { const h = v.colors[o] ?? colorHex(o); if (h) colors[o] = h; });
        return { name: v.name.trim(), options, ...(Object.keys(colors).length ? { colors } : {}) };
      })
      .filter((v) => v.name && v.options.length);
    if (!label) return toast.error("Dê um nome ao modelo.");
    if (!variations.length) return toast.error("Adicione ao menos uma variação com valores.");
    const id = draft.id ?? `${Date.now()}`;
    const others = stored.presets.filter((p) => p.id !== id && p.label.toLowerCase() !== label.toLowerCase());
    const hidden = draft.replaces && draft.replaces.toLowerCase() !== label.toLowerCase() ? [...new Set([...stored.hidden, draft.replaces])] : stored.hidden;
    if (await persist({ presets: [...others, { id, label, icon: draft.icon.trim() || "🏷️", variations }], hidden })) setDraft(null);
  };

  const remove = (p: VariationPreset, custom: boolean) => {
    if (!window.confirm(`Remover o modelo "${p.label}"?`)) return;
    void persist(custom
      ? { presets: stored.presets.filter((x) => x.id !== p.id), hidden: stored.hidden }
      : { presets: stored.presets, hidden: [...new Set([...stored.hidden, p.label])] });
  };

  const isActive = (p: VariationPreset) =>
    current.length === p.variations.length && p.variations.every((pv) => current.some((a) => a.name.toLowerCase() === pv.name.toLowerCase()));

  const fromCurrent = (): Draft => ({
    label: "", icon: "🏷️",
    variations: current.map((a) => ({ name: a.name, text: a.values.join(", "), colors: { ...(a.colors ?? {}) } })),
  });

  const setVar = (i: number, patch: Partial<DraftVariation>) =>
    setDraft((d) => d && { ...d, variations: d.variations.map((v, k) => (k === i ? { ...v, ...patch } : v)) });

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-medium text-slate-500">Escolha um modelo pronto para carregar as variações (cores, tamanhos...). Passe o mouse para editar.</p>
        <div className="flex flex-wrap gap-1.5">
          {current.length > 0 && <Button type="button" size="sm" variant="outline" iconLeft={<Save size={11} />} onClick={() => setDraft(fromCurrent())}>Salvar atuais como modelo</Button>}
          {(stored.presets.length > 0 || stored.hidden.length > 0) && (
            <Button type="button" size="sm" variant="ghost" iconLeft={<RotateCcw size={11} />} loading={saving}
              onClick={() => { if (window.confirm("Voltar aos modelos originais? Os seus modelos criados e editados serão apagados.")) void persist({ presets: [], hidden: [] }); }}>
              Restaurar originais
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {list.map(({ p, custom }) => {
          const active = isActive(p);
          return (
            <div key={`${custom ? "c" : "f"}-${p.id ?? p.label}`} className="group relative">
              <button type="button" disabled={active} onClick={() => onApply(p)}
                className={cn("flex w-full flex-col items-center gap-1 rounded-lg border p-2.5 transition-all",
                  active ? "cursor-default border-blue-400 bg-blue-50" : "border-slate-200 bg-white hover:border-blue-400 hover:bg-blue-50")}>
                <span className="text-xl">{p.icon}</span>
                <span className={cn("text-center text-[11px] font-medium", active ? "text-blue-700" : "text-slate-600 group-hover:text-blue-700")}>{p.label}</span>
                {custom && !active && <span className="text-[9px] font-medium text-emerald-600">seu modelo</span>}
                {active && <span className="text-[10px] font-medium text-blue-500">Em uso</span>}
              </button>
              <div className="absolute right-1 top-1 flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                <button type="button" title="Editar modelo" onClick={() => setDraft(toDraft(p, custom ? undefined : p.label))} className="rounded bg-white/90 p-1 text-slate-500 shadow-sm hover:text-blue-600"><Pencil size={11} /></button>
                <button type="button" title="Remover modelo" onClick={() => remove(p, custom)} className="rounded bg-white/90 p-1 text-slate-500 shadow-sm hover:text-red-600"><Trash2 size={11} /></button>
              </div>
            </div>
          );
        })}
        <button type="button" onClick={() => setDraft({ label: "", icon: "🏷️", variations: [{ name: "", text: "", colors: {} }] })}
          className="flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-slate-300 p-2.5 text-slate-500 hover:border-blue-400 hover:text-blue-600">
          <Plus size={18} /><span className="text-[11px] font-medium">Novo modelo</span>
        </button>
      </div>
      <p className="mt-2 text-[11px] text-slate-400">Clicar em um modelo substitui as variações atuais. Use "Limpar" para remover tudo.</p>

      <Modal open={!!draft} onClose={() => setDraft(null)} title={draft?.id || draft?.replaces ? "Editar modelo" : "Novo modelo"} size="lg"
        footer={<ModalFooter><Button variant="outline" onClick={() => setDraft(null)}>Cancelar</Button><Button loading={saving} onClick={save}>Salvar modelo</Button></ModalFooter>}>
        {draft && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input wrapperClassName="w-20" label="Ícone" value={draft.icon} maxLength={4} onChange={(e) => setDraft({ ...draft, icon: e.target.value })} />
              <Input wrapperClassName="flex-1" label="Nome do modelo" placeholder="Ex.: Camisetas, Saias, Bolsas" value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
            </div>
            {draft.variations.map((v, i) => {
              const values = splitValues(v.text);
              return (
                <div key={i} className="space-y-2 rounded-lg border border-slate-200 p-3">
                  <div className="flex items-end gap-2">
                    <Input wrapperClassName="w-40" label="Variação" placeholder="Tamanho, Cor..." value={v.name} onChange={(e) => setVar(i, { name: e.target.value })} />
                    <Input wrapperClassName="flex-1" label="Valores (separe com vírgula)" placeholder="P, M, G, GG" value={v.text} onChange={(e) => setVar(i, { text: e.target.value })} />
                    {draft.variations.length > 1 && (
                      <button type="button" title="Remover variação" onClick={() => setDraft({ ...draft, variations: draft.variations.filter((_, k) => k !== i) })} className="mb-2 text-slate-400 hover:text-red-500"><X size={14} /></button>
                    )}
                  </div>
                  {isColorAttr(v.name) && values.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {values.map((o) => (
                        <label key={o} className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700">
                          <span className="relative h-5 w-5 overflow-hidden rounded-full border border-slate-300">
                            <span className="absolute inset-0" style={{ backgroundColor: v.colors[o] ?? colorHex(o) ?? "#cccccc" }} />
                            <input type="color" value={v.colors[o] ?? colorHex(o) ?? "#cccccc"} onChange={(e) => setVar(i, { colors: { ...v.colors, [o]: e.target.value } })} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
                          </span>
                          {o}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {draft.variations.length < 6 && (
              <Button type="button" size="sm" variant="outline" iconLeft={<Plus size={11} />}
                onClick={() => setDraft({ ...draft, variations: [...draft.variations, { name: "", text: "", colors: {} }] })}>
                Adicionar variação
              </Button>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
