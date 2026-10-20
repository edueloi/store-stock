import { cn } from "../../lib/utils";
import type { MenuGroupDef } from "./menuLayout";

/** Miniatura do menu lateral como ele ficará (fundo escuro, grupos e itens na ordem escolhida). */
export default function MenuPreview({ groups, className }: { groups: MenuGroupDef[]; className?: string }) {
  const visible = groups.filter((g) => g.items.length > 0);
  return (
    <section className={cn("rounded-xl border border-slate-200 bg-white p-3", className)} aria-label="Prévia do menu">
      <h3 className="mb-2 text-xs font-semibold text-slate-600">Prévia do menu</h3>
      <div className="max-h-[520px] space-y-3 overflow-y-auto rounded-lg bg-[#0b1327] p-2.5">
        {visible.map((group) => (
          <div key={group.id}>
            <p className="mb-1 px-1.5 text-[10px] font-semibold text-slate-500">{group.label}</p>
            {group.items.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.path} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[12px] text-slate-400">
                  <Icon size={13} className="shrink-0" />
                  <span className="truncate">{item.label}</span>
                </div>
              );
            })}
          </div>
        ))}
        {visible.length === 0 && <p className="px-2 py-4 text-center text-[11px] text-slate-500">Nenhum item visível</p>}
      </div>
    </section>
  );
}
