import { useEffect, useMemo, useState } from "react";
import { PackagePlus, RefreshCw, Merge } from "lucide-react";
import Button from "./Button";
import Modal, { ModalFooter } from "./Modal";

export interface SheetPreviewRow {
  row: number;
  action: "create" | "update" | "merge";
  name: string;
  sku: string;
  barcode: string;
  price: number | null;
  cost: number | null;
  stock: number | null;
  category: string;
}

export interface SheetRowEdit { name?: string; price?: number; cost?: number; stock?: number }

interface Props {
  open: boolean;
  fileName: string;
  rows: SheetPreviewRow[];
  errors: { row: number; message: string }[];
  loading: boolean;
  onClose: () => void;
  /** Linhas desmarcadas + campos corrigidos na tela (só o que o usuário alterou). */
  onConfirm: (skip: number[], edits: Record<string, SheetRowEdit>) => void;
}

const num = (v: string): number | undefined => {
  const t = v.trim().replace(/\s/g, "");
  if (!t) return undefined;
  const n = Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
  return Number.isFinite(n) ? n : undefined;
};

const cell = "w-full rounded border border-slate-200 bg-white px-1.5 py-1 text-xs text-slate-700 focus:border-emerald-400 focus:outline-none";

/** Prévia da planilha antes de gravar: dá para desmarcar linhas e corrigir nome/preço/custo/estoque. */
export default function SheetImportPreviewModal({ open, fileName, rows, errors, loading, onClose, onConfirm }: Props) {
  const [skipped, setSkipped] = useState<Set<number>>(new Set());
  const [edits, setEdits] = useState<Record<string, SheetRowEdit>>({});

  useEffect(() => {
    if (open) { setSkipped(new Set()); setEdits({}); }
  }, [open, rows]);

  const selected = useMemo(() => rows.filter((r) => !skipped.has(r.row)), [rows, skipped]);
  const created = selected.filter((r) => r.action === "create").length;
  const updated = selected.filter((r) => r.action !== "create").length;

  const toggle = (row: number) => setSkipped((s) => { const n = new Set(s); n.has(row) ? n.delete(row) : n.add(row); return n; });
  const setAll = (on: boolean) => setSkipped(on ? new Set() : new Set(rows.map((r) => r.row)));
  const edit = (row: number, patch: SheetRowEdit) => setEdits((e) => ({ ...e, [String(row)]: { ...e[String(row)], ...patch } }));

  const badge = (a: SheetPreviewRow["action"]) =>
    a === "create"
      ? <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600"><PackagePlus size={9} />NOVO</span>
      : a === "update"
        ? <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600"><RefreshCw size={9} />ATUALIZAR</span>
        : <span title="Aparece mais de uma vez na planilha; as linhas são unidas" className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500"><Merge size={9} />REPETIDO</span>;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Revisar planilha antes de importar"
      size="2xl"
      footer={
        <ModalFooter>
          <Button variant="secondary" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button
            loading={loading}
            disabled={selected.length === 0}
            onClick={() => onConfirm([...skipped], edits)}
          >
            Importar {selected.length} produto{selected.length === 1 ? "" : "s"}
          </Button>
        </ModalFooter>
      }
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <span className="truncate">{fileName} · {rows.length} linha{rows.length === 1 ? "" : "s"} lida{rows.length === 1 ? "" : "s"}</span>
          <span className="flex items-center gap-3">
            <button onClick={() => setAll(true)} className="font-semibold text-emerald-600 hover:underline">Todos</button>
            <button onClick={() => setAll(false)} className="font-semibold text-slate-500 hover:underline">Nenhum</button>
            <span className="font-semibold text-emerald-600">{created} novo{created === 1 ? "" : "s"}</span>
            <span className="font-semibold text-amber-600">{updated} atualizar</span>
          </span>
        </div>

        <div className="max-h-[55vh] overflow-auto rounded-lg border border-slate-100">
          <table className="w-full min-w-[720px] text-xs">
            <thead className="sticky top-0 bg-slate-50 text-[11px] font-semibold text-slate-500">
              <tr>
                <th className="w-8 px-2 py-2" />
                <th className="px-2 py-2 text-left">Produto</th>
                <th className="w-24 px-2 py-2 text-left">Código</th>
                <th className="w-24 px-2 py-2 text-right">Preço</th>
                <th className="w-24 px-2 py-2 text-right">Custo</th>
                <th className="w-20 px-2 py-2 text-right">Estoque</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rows.map((r) => {
                const off = skipped.has(r.row);
                const ed = edits[String(r.row)] ?? {};
                return (
                  <tr key={r.row} className={off ? "bg-slate-50 opacity-50" : "bg-white"}>
                    <td className="px-2 py-1.5 text-center">
                      <input type="checkbox" checked={!off} onChange={() => toggle(r.row)} className="h-3.5 w-3.5 cursor-pointer accent-emerald-500" />
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="mb-1 flex items-center gap-1.5">{badge(r.action)}<span className="text-[10px] text-slate-400">linha {r.row}{r.category ? ` · ${r.category}` : ""}</span></div>
                      <input disabled={off} className={cell} defaultValue={r.name} onChange={(e) => edit(r.row, { name: e.target.value })} />
                    </td>
                    <td className="px-2 py-1.5 font-mono text-[11px] text-slate-400">{r.sku || r.barcode || "—"}</td>
                    <td className="px-2 py-1.5"><input disabled={off} inputMode="decimal" className={`${cell} text-right`} defaultValue={r.price ?? ""} onChange={(e) => edit(r.row, { price: num(e.target.value) })} /></td>
                    <td className="px-2 py-1.5"><input disabled={off} inputMode="decimal" className={`${cell} text-right`} defaultValue={r.cost ?? ""} onChange={(e) => edit(r.row, { cost: num(e.target.value) })} /></td>
                    <td className="px-2 py-1.5"><input disabled={off} inputMode="numeric" className={`${cell} text-right`} defaultValue={r.stock ?? ""} onChange={(e) => edit(r.row, { stock: num(e.target.value) })} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {errors.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            <p className="mb-1 font-semibold">{errors.length} linha{errors.length === 1 ? "" : "s"} será{errors.length === 1 ? "" : "ão"} ignorada{errors.length === 1 ? "" : "s"}:</p>
            <ul className="max-h-24 space-y-0.5 overflow-auto">
              {errors.map((e, i) => <li key={i}>Linha {e.row}: {e.message}</li>)}
            </ul>
          </div>
        )}
        <p className="text-[11px] text-slate-400">Nada é gravado até você clicar em Importar. Produtos já cadastrados (mesmo código, código de barras ou nome) são atualizados.</p>
      </div>
    </Modal>
  );
}
