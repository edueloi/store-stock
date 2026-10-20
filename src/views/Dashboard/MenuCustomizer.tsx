import { useRef, useState, type DragEvent } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, GripVertical, Link2, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { cn } from "../../lib/utils";
import {
  HIDDEN_GROUP_ID,
  PROTECTED_PATHS,
  customPath,
  isInternalUrl,
  newId,
  toLayout,
  type CustomMenuItem,
  type MenuGroupDef,
  type MenuItemDef,
  type MenuLayout,
  type ResolvedMenu,
} from "./menuLayout";

type Props = {
  /** Estado atual do menu (com grupos vazios e itens ocultos), já filtrado por permissão. */
  initial: ResolvedMenu;
  customItems: CustomMenuItem[];
  linkIcon: MenuItemDef["icon"];
  onSave: (layout: MenuLayout) => void;
  onReset: () => void;
  onClose: () => void;
};

type Drag = { kind: "item"; path: string } | { kind: "group"; id: string } | null;

/**
 * Editor do menu lateral: arrastar para reordenar itens e grupos, mover itens entre grupos,
 * ocultar/mostrar, renomear/criar grupos e criar atalhos. Só mostra o que o usuário tem permissão de ver.
 */
export default function MenuCustomizer({ initial, customItems, linkIcon, onSave, onReset, onClose }: Props) {
  const [groups, setGroups] = useState<MenuGroupDef[]>(initial.groups);
  const [hidden, setHidden] = useState<MenuItemDef[]>(initial.hidden);
  const [custom, setCustom] = useState<CustomMenuItem[]>(customItems);
  const [newGroup, setNewGroup] = useState("");
  const [shortcut, setShortcut] = useState({ label: "", url: "", groupId: initial.groups[0]?.id || "" });
  const [error, setError] = useState("");
  const [over, setOver] = useState<string | null>(null);
  const drag = useRef<Drag>(null);

  const findItem = (path: string) => groups.flatMap((g) => g.items).concat(hidden).find((i) => i.path === path);

  const moveItem = (path: string, toGroupId: string, beforePath: string | null) => {
    const item = findItem(path);
    if (!item || path === beforePath) return;
    if (toGroupId === HIDDEN_GROUP_ID && PROTECTED_PATHS.includes(path)) return;
    const strip = (list: MenuItemDef[]) => list.filter((i) => i.path !== path);
    const insert = (list: MenuItemDef[]) => {
      const next = strip(list);
      const at = beforePath ? next.findIndex((i) => i.path === beforePath) : -1;
      next.splice(at < 0 ? next.length : at, 0, item);
      return next;
    };
    setGroups((current) => current.map((g) => (g.id === toGroupId ? { ...g, items: insert(g.items) } : { ...g, items: strip(g.items) })));
    setHidden((current) => (toGroupId === HIDDEN_GROUP_ID ? insert(current) : strip(current)));
  };

  const moveGroup = (id: string, beforeId: string | null) => {
    if (id === beforeId) return;
    setGroups((current) => {
      const moving = current.find((g) => g.id === id);
      if (!moving) return current;
      const next = current.filter((g) => g.id !== id);
      const at = beforeId ? next.findIndex((g) => g.id === beforeId) : -1;
      next.splice(at < 0 ? next.length : at, 0, moving);
      return next;
    });
  };

  const nudgeItem = (groupId: string, index: number, dir: -1 | 1) =>
    setGroups((current) =>
      current.map((g) => {
        if (g.id !== groupId) return g;
        const items = [...g.items];
        const to = index + dir;
        if (to < 0 || to >= items.length) return g;
        [items[index], items[to]] = [items[to], items[index]];
        return { ...g, items };
      }),
    );

  const nudgeGroup = (index: number, dir: -1 | 1) =>
    setGroups((current) => {
      const next = [...current];
      const to = index + dir;
      if (to < 0 || to >= next.length) return current;
      [next[index], next[to]] = [next[to], next[index]];
      return next;
    });

  const renameGroup = (id: string, label: string) => setGroups((current) => current.map((g) => (g.id === id ? { ...g, label } : g)));

  const removeGroup = (id: string) => {
    const index = groups.findIndex((g) => g.id === id);
    const target = groups[index];
    if (!target || groups.length < 2) return;
    const receiver = groups[index === 0 ? 1 : index - 1];
    setGroups((current) =>
      current.filter((g) => g.id !== id).map((g) => (g.id === receiver.id ? { ...g, items: [...g.items, ...target.items] } : g)),
    );
  };

  const addGroup = () => {
    const label = newGroup.trim();
    if (!label) return;
    const id = `g-${newId()}`;
    setGroups((current) => [...current, { id, label, items: [] }]);
    setShortcut((s) => ({ ...s, groupId: s.groupId || id }));
    setNewGroup("");
  };

  const addShortcut = () => {
    const label = shortcut.label.trim();
    const url = shortcut.url.trim();
    if (!label || !url) return setError("Informe o nome e o endereço do atalho.");
    if (!isInternalUrl(url) && !/^https?:\/\//i.test(url)) return setError("Use um caminho do sistema (/admin/...) ou um link começando com https://");
    if (!groups.length) return setError("Crie um grupo antes de adicionar o atalho.");
    setError("");
    const id = newId();
    const item: MenuItemDef = { icon: linkIcon, label, path: customPath(id), key: "custom", href: url };
    setCustom((current) => [...current, { id, label, url }]);
    const target = groups.some((g) => g.id === shortcut.groupId) ? shortcut.groupId : groups[0].id;
    setGroups((current) => current.map((g) => (g.id === target ? { ...g, items: [...g.items, item] } : g)));
    setShortcut((s) => ({ ...s, label: "", url: "" }));
  };

  const deleteShortcut = (path: string) => {
    setGroups((current) => current.map((g) => ({ ...g, items: g.items.filter((i) => i.path !== path) })));
    setHidden((current) => current.filter((i) => i.path !== path));
    setCustom((current) => current.filter((c) => customPath(c.id) !== path));
  };

  const startDrag = (event: DragEvent, value: Drag) => {
    drag.current = value;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", "menu");
    const card = (event.currentTarget as HTMLElement).closest<HTMLElement>("[data-drag-card]");
    if (card) event.dataTransfer.setDragImage(card, 16, 16);
  };
  const endDrag = () => {
    drag.current = null;
    setOver(null);
  };
  const allowDrop = (event: DragEvent, key: string) => {
    if (!drag.current) return;
    event.preventDefault();
    event.stopPropagation();
    setOver(key);
  };

  const save = () => {
    const clean = groups.map((g) => ({ ...g, label: g.label.trim() || "Sem nome" }));
    onSave(toLayout({ groups: clean, hidden }, custom));
  };

  const renderItem = (item: MenuItemDef, groupId: string, index: number, total: number) => {
    const Icon = item.icon;
    const isHidden = groupId === HIDDEN_GROUP_ID;
    const protectedItem = PROTECTED_PATHS.includes(item.path);
    return (
      <li
        key={item.path}
        data-drag-card
        draggable
        onDragStart={(e) => { e.stopPropagation(); startDrag(e, { kind: "item", path: item.path }); }}
        onDragEnd={endDrag}
        onDragOver={(e) => allowDrop(e, `item:${item.path}`)}
        onDrop={(e) => {
          if (drag.current?.kind !== "item") return;
          e.preventDefault();
          e.stopPropagation();
          moveItem(drag.current.path, groupId, item.path);
          endDrag();
        }}
        className={cn(
          "flex items-center gap-2 rounded-lg border bg-white px-2 py-1.5 text-[13px] transition-colors",
          over === `item:${item.path}` ? "border-blue-400 bg-blue-50" : "border-slate-200",
          isHidden && "opacity-70",
        )}
      >
        <GripVertical size={14} className="shrink-0 cursor-grab text-slate-300" aria-hidden />
        <Icon size={14} className="shrink-0 text-slate-500" />
        <span className="min-w-0 flex-1 truncate text-slate-700">{item.label}</span>
        <select
          aria-label={`Mover ${item.label} para outro grupo`}
          value={groupId}
          onChange={(e) => moveItem(item.path, e.target.value, null)}
          className="h-7 max-w-[110px] rounded border border-slate-200 bg-white px-1 text-[11px] text-slate-500 lg:hidden"
        >
          {groups.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
          {!protectedItem && <option value={HIDDEN_GROUP_ID}>Oculto</option>}
        </select>
        {!isHidden && (
          <>
            <button type="button" aria-label="Mover para cima" disabled={index === 0} onClick={() => nudgeItem(groupId, index, -1)} className="grid h-6 w-6 place-items-center rounded text-slate-400 hover:bg-slate-100 disabled:opacity-30"><ArrowUp size={13} /></button>
            <button type="button" aria-label="Mover para baixo" disabled={index === total - 1} onClick={() => nudgeItem(groupId, index, 1)} className="grid h-6 w-6 place-items-center rounded text-slate-400 hover:bg-slate-100 disabled:opacity-30"><ArrowDown size={13} /></button>
          </>
        )}
        {item.key === "custom" && (
          <button type="button" aria-label={`Excluir atalho ${item.label}`} onClick={() => deleteShortcut(item.path)} className="grid h-6 w-6 place-items-center rounded text-rose-400 hover:bg-rose-50"><Trash2 size={13} /></button>
        )}
        {isHidden ? (
          <button type="button" aria-label={`Mostrar ${item.label}`} onClick={() => moveItem(item.path, groups[0]?.id || HIDDEN_GROUP_ID, null)} className="grid h-6 w-6 place-items-center rounded text-slate-500 hover:bg-slate-100"><Eye size={14} /></button>
        ) : (
          <button type="button" aria-label={`Ocultar ${item.label}`} disabled={protectedItem} title={protectedItem ? "Este item não pode ser ocultado" : "Ocultar do menu"} onClick={() => moveItem(item.path, HIDDEN_GROUP_ID, null)} className="grid h-6 w-6 place-items-center rounded text-slate-400 hover:bg-slate-100 disabled:opacity-30"><EyeOff size={14} /></button>
        )}
      </li>
    );
  };

  const inputClass = "h-9 rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-800 outline-none focus:border-blue-500";

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center bg-slate-900/60 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Personalizar menu">
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-2xl bg-slate-50 shadow-2xl sm:rounded-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Personalizar menu</h2>
            <p className="mt-0.5 text-xs text-slate-500">Arraste para reordenar, mova itens entre grupos, oculte o que não usa e crie grupos e atalhos. Só aparecem os itens que o seu usuário tem permissão de acessar.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"><X size={18} /></button>
        </header>

        <div className="grid flex-1 gap-4 overflow-y-auto p-5 lg:grid-cols-[1fr_300px]">
          <div className="space-y-3">
            {groups.map((group, gi) => (
              <section
                key={group.id}
                data-drag-card
                onDragOver={(e) => allowDrop(e, `group:${group.id}`)}
                onDrop={(e) => {
                  if (!drag.current) return;
                  e.preventDefault();
                  if (drag.current.kind === "group") moveGroup(drag.current.id, group.id);
                  else moveItem(drag.current.path, group.id, null);
                  endDrag();
                }}
                className={cn("rounded-xl border bg-white p-3 transition-colors", over === `group:${group.id}` ? "border-blue-400" : "border-slate-200")}
              >
                <div className="mb-2 flex items-center gap-1.5">
                  <span
                    draggable
                    onDragStart={(e) => startDrag(e, { kind: "group", id: group.id })}
                    onDragEnd={endDrag}
                    className="grid h-7 w-6 shrink-0 cursor-grab place-items-center text-slate-400"
                    aria-hidden
                  ><GripVertical size={16} /></span>
                  <input value={group.label} onChange={(e) => renameGroup(group.id, e.target.value)} aria-label="Nome do grupo" maxLength={40} className={cn(inputClass, "h-8 min-w-0 flex-1 font-semibold")} />
                  <button type="button" aria-label="Subir grupo" disabled={gi === 0} onClick={() => nudgeGroup(gi, -1)} className="grid h-7 w-7 place-items-center rounded text-slate-400 hover:bg-slate-100 disabled:opacity-30"><ArrowUp size={14} /></button>
                  <button type="button" aria-label="Descer grupo" disabled={gi === groups.length - 1} onClick={() => nudgeGroup(gi, 1)} className="grid h-7 w-7 place-items-center rounded text-slate-400 hover:bg-slate-100 disabled:opacity-30"><ArrowDown size={14} /></button>
                  <button type="button" aria-label={`Excluir grupo ${group.label}`} disabled={groups.length < 2} onClick={() => removeGroup(group.id)} className="grid h-7 w-7 place-items-center rounded text-rose-400 hover:bg-rose-50 disabled:opacity-30"><Trash2 size={14} /></button>
                </div>
                <ul className="space-y-1">
                  {group.items.map((item, index) => renderItem(item, group.id, index, group.items.length))}
                </ul>
                {group.items.length === 0 && <p className="rounded-lg border border-dashed border-slate-200 px-3 py-3 text-center text-xs text-slate-400">Arraste itens para este grupo</p>}
              </section>
            ))}
          </div>

          <aside className="space-y-3">
            <section
              onDragOver={(e) => allowDrop(e, "hidden")}
              onDrop={(e) => {
                if (drag.current?.kind !== "item") return;
                e.preventDefault();
                moveItem(drag.current.path, HIDDEN_GROUP_ID, null);
                endDrag();
              }}
              className={cn("rounded-xl border bg-white p-3", over === "hidden" ? "border-blue-400" : "border-slate-200")}
            >
              <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-600"><EyeOff size={13} /> Ocultos</h3>
              <ul className="space-y-1">{hidden.map((item, index) => renderItem(item, HIDDEN_GROUP_ID, index, hidden.length))}</ul>
              {hidden.length === 0 && <p className="text-xs text-slate-400">Arraste aqui o que você não quer ver no menu.</p>}
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-3">
              <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-600"><Plus size={13} /> Novo grupo</h3>
              <div className="flex gap-2">
                <input value={newGroup} onChange={(e) => setNewGroup(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addGroup()} placeholder="Ex.: Favoritos" maxLength={40} className={cn(inputClass, "min-w-0 flex-1")} />
                <button type="button" onClick={addGroup} className="h-9 rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-700">Criar</button>
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-3">
              <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-600"><Link2 size={13} /> Novo atalho</h3>
              <div className="space-y-2">
                <input value={shortcut.label} onChange={(e) => setShortcut((s) => ({ ...s, label: e.target.value }))} placeholder="Nome do atalho" maxLength={30} className={cn(inputClass, "w-full")} />
                <input value={shortcut.url} onChange={(e) => setShortcut((s) => ({ ...s, url: e.target.value }))} placeholder="/admin/orders ou https://..." className={cn(inputClass, "w-full")} />
                <select value={shortcut.groupId} onChange={(e) => setShortcut((s) => ({ ...s, groupId: e.target.value }))} className={cn(inputClass, "w-full")}>
                  {groups.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
                </select>
                {error && <p className="text-[11px] font-medium text-rose-600">{error}</p>}
                <button type="button" onClick={addShortcut} className="h-9 w-full rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50">Adicionar atalho</button>
              </div>
            </section>
          </aside>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-white px-5 py-3">
          <button type="button" onClick={onReset} className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-slate-600 hover:bg-slate-100"><RotateCcw size={14} /> Restaurar padrão</button>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="h-9 rounded-lg border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 hover:bg-slate-50">Cancelar</button>
            <button type="button" onClick={save} className="h-9 rounded-lg bg-blue-600 px-5 text-xs font-semibold text-white hover:bg-blue-700">Salvar menu</button>
          </div>
        </footer>
      </div>
    </div>
  );
}
