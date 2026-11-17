import { useMemo, useState } from "react";
import { Copy, CheckCircle2, Pencil, Trash2, Power } from "lucide-react";
import { useToast } from "./index";
import { Modal, ModalFooter, Button, Badge } from "./index";
import { cn } from "../../lib/utils";
import type { Product } from "../../types";

type Kind = "name" | "sku" | "barcode";
interface Group { kind: Kind; key: string; label: string; items: Product[] }

const KIND_LABEL: Record<Kind, string> = { name: "Mesmo nome", sku: "Mesmo código (SKU)", barcode: "Mesmo código de barras" };
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const brl = (n: number) => Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Agrupa produtos repetidos pelo nome, pelo código (SKU) e pelo código de barras. Só olha o que já está carregado no catálogo. */
export function findDuplicateGroups(products: Product[]): Group[] {
  const maps: Record<Kind, Map<string, Product[]>> = { name: new Map(), sku: new Map(), barcode: new Map() };
  for (const p of products) {
    const entries: [Kind, string][] = [["name", norm(p.name ?? "")], ["sku", norm(p.sku ?? "")], ["barcode", (p.barcode ?? "").replace(/\s+/g, "")]];
    for (const [kind, key] of entries) {
      if (!key) continue;
      const list = maps[kind].get(key) ?? [];
      list.push(p);
      maps[kind].set(key, list);
    }
  }
  const groups: Group[] = [];
  (Object.keys(maps) as Kind[]).forEach((kind) => {
    for (const [key, items] of maps[kind]) {
      if (items.length > 1) groups.push({ kind, key, label: kind === "name" ? items[0].name : key, items });
    }
  });
  return groups.sort((a, b) => b.items.length - a.items.length || a.label.localeCompare(b.label, "pt-BR"));
}

export default function DuplicateProductsModal({ open, products, onClose, onEdit, onChanged }: { open: boolean; products: Product[]; onClose: () => void; onEdit: (p: Product) => void; onChanged: () => void }) {
  const toast = useToast();
  const [busyId, setBusyId] = useState<number | null>(null);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const auth = { Authorization: `Bearer ${localStorage.getItem("token")}`, "Content-Type": "application/json" };
  const toggle = async (p: Product) => {
    setBusyId(p.id);
    try {
      const r = await fetch(`/api/products/${p.id}/active`, { method: "PATCH", headers: auth, body: JSON.stringify({ is_active: !p.is_active }) });
      if (!r.ok) throw new Error();
      toast.success(p.is_active ? "Produto inativado." : "Produto ativado.");
      onChanged();
    } catch { toast.error("Não foi possível alterar o produto."); } finally { setBusyId(null); }
  };
  const remove = async (p: Product) => {
    setBusyId(p.id);
    try {
      const r = await fetch(`/api/products/${p.id}`, { method: "DELETE", headers: auth });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Não foi possível excluir.");
      toast.success("Produto excluído.");
      setConfirmId(null);
      onChanged();
    } catch (e) { toast.error((e as Error).message || "Não foi possível excluir."); } finally { setBusyId(null); }
  };
  const groups = useMemo(() => findDuplicateGroups(products), [products]);
  const [filter, setFilter] = useState<"all" | Kind>("all");
  const shown = filter === "all" ? groups : groups.filter((g) => g.kind === filter);
  const count = (k: Kind) => groups.filter((g) => g.kind === k).length;

  return (
    <Modal open={open} onClose={onClose} title="Produtos duplicados" size="xl" footer={<ModalFooter><Button onClick={onClose}>Fechar</Button></ModalFooter>}>
      <div className="space-y-3">
        <p className="text-xs text-slate-500">Produtos com o mesmo nome, o mesmo código (SKU) ou o mesmo código de barras. Para cada par, edite o código, inative ou exclua o repetido aqui mesmo. Se o produto já teve vendas, a exclusão pode ser recusada: nesse caso, inative.</p>
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Tipo de conflito">
          {([["all", `Todos (${groups.length})`], ["name", `Mesmo nome (${count("name")})`], ["sku", `Mesmo código (${count("sku")})`], ["barcode", `Código de barras (${count("barcode")})`]] as const).map(([v, label]) => (
            <button key={v} type="button" role="tab" aria-selected={filter === v} onClick={() => setFilter(v)}
              className={cn("rounded-full border px-3 py-1 text-xs font-medium", filter === v ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50")}>{label}</button>
          ))}
        </div>

        {shown.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 py-8 text-center">
            <CheckCircle2 className="text-emerald-600" size={28} />
            <p className="text-sm font-medium text-emerald-800">Nenhum conflito encontrado</p>
            <p className="text-xs text-emerald-700">Entre {products.length.toLocaleString("pt-BR")} produtos, nenhum repete nome, código ou código de barras.</p>
          </div>
        ) : (
          <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
            {shown.map((g) => (
              <div key={`${g.kind}:${g.key}`} className="rounded-lg border border-slate-200">
                <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2">
                  <Copy size={13} className="text-amber-600" />
                  <Badge size="sm" color="orange">{KIND_LABEL[g.kind]}</Badge>
                  <span className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-800">{g.label}</span>
                  <span className="text-[11px] text-slate-500">{g.items.length} produtos</span>
                </div>
                <ul className="divide-y divide-slate-100">
                  {g.items.map((p) => (
                    <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
                      <div className="min-w-0 flex-1 basis-56">
                        <p className="truncate text-[13px] text-slate-800">{p.name}</p>
                        <p className="truncate text-[11px] text-slate-500">
                          {[p.sku ? `SKU ${p.sku}` : "sem SKU", p.barcode ? `Barras ${p.barcode}` : "", p.category_name ?? ""].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      <span className="text-xs font-semibold tabular-nums text-slate-700">{brl(p.price)}</span>
                      <span className="text-[11px] text-slate-500">Estoque {p.stock_quantity}</span>
                      <Badge size="sm" color={p.is_active ? "success" : "default"}>{p.is_active ? "Ativo" : "Inativo"}</Badge>
                      {confirmId === p.id ? (
                        <span className="flex items-center gap-1.5">
                          <span className="text-[11px] font-medium text-red-600">Excluir mesmo?</span>
                          <Button size="sm" variant="danger" loading={busyId === p.id} onClick={() => void remove(p)}>Sim, excluir</Button>
                          <Button size="sm" variant="ghost" onClick={() => setConfirmId(null)}>Não</Button>
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <Button size="sm" variant="outline" icon={<Pencil size={12} />} onClick={() => { onClose(); onEdit(p); }}>Editar</Button>
                          <Button size="sm" variant="outline" icon={<Power size={12} />} loading={busyId === p.id} onClick={() => void toggle(p)}>{p.is_active ? "Inativar" : "Ativar"}</Button>
                          <Button size="sm" variant="ghost" icon={<Trash2 size={12} className="text-red-600" />} aria-label={`Excluir ${p.name}`} onClick={() => setConfirmId(p.id)}>Excluir</Button>
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
