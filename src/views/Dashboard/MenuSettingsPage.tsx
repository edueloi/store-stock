import { useState } from "react";
import { Check, Copy, Lock, Plus, SlidersHorizontal, Trash2 } from "lucide-react";
import { cn } from "../../lib/utils";
import MenuCustomizer from "./MenuCustomizer";
import MenuPreview from "./MenuPreview";
import {
  DEFAULT_PROFILE_ID,
  newId,
  resolveMenu,
  toLayout,
  type MenuGroupDef,
  type MenuItemDef,
  type MenuLayout,
  type MenuProfile,
  type MenuProfiles,
} from "./menuLayout";

type Props = {
  /** Grupos já filtrados por permissão/plano: o usuário só organiza o que já pode acessar. */
  permittedGroups: MenuGroupDef[];
  linkIcon: MenuItemDef["icon"];
  store: MenuProfiles;
  onChange: (next: MenuProfiles) => void;
};

/**
 * Tela cheia (dentro do painel, com o menu lateral visível) para montar menus: o "Padrão" do sistema
 * é fixo e nunca pode ser alterado/removido; o usuário cria quantos perfis quiser e escolhe qual usar.
 */
export default function MenuSettingsPage({ permittedGroups, linkIcon, store, onChange }: Props) {
  const [selectedId, setSelectedId] = useState(store.activeId);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const [renaming, setRenaming] = useState("");
  const [savedAt, setSavedAt] = useState(0);

  const defaults = resolveMenu(permittedGroups, null, linkIcon, true);
  const selected: MenuProfile | undefined = store.profiles.find((p) => p.id === selectedId);
  const isDefault = !selected;

  const copyOf = (layout?: MenuLayout) => layout ?? toLayout(defaults, []);

  const createProfile = (title: string, from?: MenuLayout) => {
    const label = title.trim();
    if (!label) return;
    const profile: MenuProfile = { id: newId(), name: label, layout: copyOf(from) };
    onChange({ ...store, profiles: [...store.profiles, profile] });
    setSelectedId(profile.id);
    setNaming(false);
    setName("");
  };

  const updateProfile = (id: string, patch: Partial<MenuProfile>) =>
    onChange({ ...store, profiles: store.profiles.map((p) => (p.id === id ? { ...p, ...patch } : p)) });

  const removeProfile = (id: string) => {
    onChange({ ...store, activeId: store.activeId === id ? DEFAULT_PROFILE_ID : store.activeId, profiles: store.profiles.filter((p) => p.id !== id) });
    setSelectedId(DEFAULT_PROFILE_ID);
  };

  const useProfile = (id: string) => onChange({ ...store, activeId: id });

  const tab = (id: string, label: string, locked = false) => (
    <button
      key={id}
      type="button"
      onClick={() => { setSelectedId(id); setRenaming(""); }}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition-colors",
        selectedId === id ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
      )}
    >
      {locked && <Lock size={12} />}
      {label}
      {store.activeId === id && <span className={cn("rounded-full px-1.5 py-px text-[10px]", selectedId === id ? "bg-white/20" : "bg-emerald-100 text-emerald-700")}>em uso</span>}
    </button>
  );

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-4 p-4 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold text-slate-900"><SlidersHorizontal size={18} /> Personalizar menu</h1>
          <p className="mt-0.5 max-w-3xl text-xs text-slate-500">
            O menu <strong>Padrão</strong> do sistema é fixo e nunca é removido. Crie quantos menus quiser, arraste para reordenar, mova itens entre grupos, oculte o que não usa e crie grupos e atalhos. Só aparecem os itens que o seu usuário tem permissão de acessar.
          </p>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        {tab(DEFAULT_PROFILE_ID, "Padrão", true)}
        {store.profiles.map((p) => tab(p.id, p.name))}
        {naming ? (
          <form className="flex items-center gap-1.5" onSubmit={(e) => { e.preventDefault(); createProfile(name, selected?.layout); }}>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={30} placeholder="Nome do menu" className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs outline-none focus:border-blue-500" />
            <button type="submit" className="h-9 rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-700">Criar</button>
            <button type="button" onClick={() => { setNaming(false); setName(""); }} className="h-9 rounded-lg px-2 text-xs font-semibold text-slate-500 hover:bg-slate-100">Cancelar</button>
          </form>
        ) : (
          <button type="button" onClick={() => setNaming(true)} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-dashed border-slate-300 bg-white px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50"><Plus size={13} /> Novo menu</button>
        )}
      </div>

      {isDefault ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Lock size={14} /> Menu Padrão (do sistema)</h2>
            <p className="mt-1 text-xs text-slate-500">É a organização original, atualizada automaticamente quando o sistema ganha novos módulos. Ele não pode ser editado nem removido: para mudar, crie um novo menu a partir dele.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={() => { setNaming(true); }} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-4 text-xs font-semibold text-white hover:bg-blue-700"><Copy size={13} /> Criar meu menu a partir do padrão</button>
              <button type="button" disabled={store.activeId === DEFAULT_PROFILE_ID} onClick={() => useProfile(DEFAULT_PROFILE_ID)} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><Check size={13} /> {store.activeId === DEFAULT_PROFILE_ID ? "Padrão em uso" : "Usar o menu padrão"}</button>
            </div>
          </section>
          <MenuPreview groups={defaults.groups} />
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3">
            {renaming !== "" || selected.name === "" ? (
              <input autoFocus value={renaming} onChange={(e) => setRenaming(e.target.value)} onBlur={() => { if (renaming.trim()) updateProfile(selected.id, { name: renaming.trim() }); setRenaming(""); }} onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()} maxLength={30} className="h-9 rounded-lg border border-slate-200 px-3 text-sm font-semibold outline-none focus:border-blue-500" />
            ) : (
              <button type="button" onClick={() => setRenaming(selected.name)} title="Clique para renomear" className="rounded px-1 text-sm font-semibold text-slate-900 hover:bg-slate-100">{selected.name}</button>
            )}
            <div className="ml-auto flex flex-wrap gap-2">
              <button type="button" disabled={store.activeId === selected.id} onClick={() => useProfile(selected.id)} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-4 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"><Check size={13} /> {store.activeId === selected.id ? "Menu em uso" : "Usar este menu"}</button>
              <button type="button" onClick={() => createProfile(`${selected.name} (cópia)`, selected.layout)} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"><Copy size={13} /> Duplicar</button>
              <button type="button" onClick={() => { if (window.confirm(`Excluir o menu "${selected.name}"? O menu padrão continua disponível.`)) removeProfile(selected.id); }} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 text-xs font-semibold text-rose-600 hover:bg-rose-50"><Trash2 size={13} /> Excluir</button>
            </div>
          </div>
          <MenuCustomizer
            key={`${selected.id}-${savedAt}`}
            initial={resolveMenu(permittedGroups, selected.layout, linkIcon, true)}
            defaults={defaults}
            customItems={selected.layout.customItems}
            linkIcon={linkIcon}
            onSave={(layout) => { updateProfile(selected.id, { layout }); setSavedAt(Date.now()); }}
          />
        </>
      )}
    </div>
  );
}
