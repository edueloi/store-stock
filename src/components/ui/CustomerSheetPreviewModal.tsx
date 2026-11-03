import { useEffect, useMemo, useState } from "react";
import { PackagePlus, RefreshCw } from "lucide-react";
import Button from "./Button";
import Modal, { ModalFooter } from "./Modal";

export interface CustomerPreviewRow {
  row: number;
  action: "create" | "update";
  name: string;
  document: string;
  phone: string;
  email: string;
  city: string;
}

export interface CustomerRowEdit { name?: string; phone?: string; email?: string; document?: string }

interface Props {
  open: boolean;
  fileName: string;
  rows: CustomerPreviewRow[];
  errors: { row: number; message: string }[];
  loading: boolean;
  onClose: () => void;
  onConfirm: (skip: number[], edits: Record<string, CustomerRowEdit>) => void;
}

const cell = "w-full rounded border border-slate-200 bg-white px-1.5 py-1 text-xs text-slate-700 focus:border-emerald-400 focus:outline-none";

/** Prévia da planilha de clientes antes de gravar: desmarcar linhas e corrigir nome/documento/telefone/e-mail. */
export default function CustomerSheetPreviewModal({ open, fileName, rows, errors, loading, onClose, onConfirm }: Props) {
  const [skipped, setSkipped] = useState<Set<number>>(new Set());
  const [edits, setEdits] = useState<Record<string, CustomerRowEdit>>({});

  useEffect(() => {
    if (open) { setSkipped(new Set()); setEdits({}); }
  }, [open, rows]);

  const selected = useMemo(() => rows.filter((r) => !skipped.has(r.row)), [rows, skipped]);
  const created = selected.filter((r) => r.action === "create").length;
  const updated = selected.length - created;

  const toggle = (row: number) => setSkipped((s) => { const n = new Set(s); n.has(row) ? n.delete(row) : n.add(row); return n; });
  const setAll = (on: boolean) => setSkipped(on ? new Set() : new Set(rows.map((r) => r.row)));
  const edit = (row: number, patch: CustomerRowEdit) => setEdits((e) => ({ ...e, [String(row)]: { ...e[String(row)], ...patch } }));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Revisar planilha antes de importar"
      size="2xl"
      footer={
        <ModalFooter>
          <Button variant="secondary" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button loading={loading} disabled={selected.length === 0} onClick={() => onConfirm([...skipped], edits)}>
            Importar {selected.length} cliente{selected.length === 1 ? "" : "s"}
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
          <table className="w-full min-w-[760px] text-xs">
            <thead className="sticky top-0 bg-slate-50 text-[11px] font-semibold text-slate-500">
              <tr>
                <th className="w-8 px-2 py-2" />
                <th className="px-2 py-2 text-left">Nome</th>
                <th className="w-36 px-2 py-2 text-left">CNPJ/CPF</th>
                <th className="w-32 px-2 py-2 text-left">Telefone</th>
                <th className="w-48 px-2 py-2 text-left">E-mail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rows.map((r) => {
                const off = skipped.has(r.row);
                return (
                  <tr key={r.row} className={off ? "bg-slate-50 opacity-50" : "bg-white"}>
                    <td className="px-2 py-1.5 text-center">
                      <input type="checkbox" checked={!off} onChange={() => toggle(r.row)} className="h-3.5 w-3.5 cursor-pointer accent-emerald-500" />
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="mb-1 flex items-center gap-1.5">
                        {r.action === "create"
                          ? <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600"><PackagePlus size={9} />NOVO</span>
                          : <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600"><RefreshCw size={9} />ATUALIZAR</span>}
                        <span className="text-[10px] text-slate-400">linha {r.row}{r.city ? ` · ${r.city}` : ""}</span>
                      </div>
                      <input disabled={off} className={cell} defaultValue={r.name} onChange={(e) => edit(r.row, { name: e.target.value })} />
                    </td>
                    <td className="px-2 py-1.5"><input disabled={off} className={cell} defaultValue={r.document} onChange={(e) => edit(r.row, { document: e.target.value })} /></td>
                    <td className="px-2 py-1.5"><input disabled={off} className={cell} defaultValue={r.phone} onChange={(e) => edit(r.row, { phone: e.target.value })} /></td>
                    <td className="px-2 py-1.5"><input disabled={off} className={cell} defaultValue={r.email} onChange={(e) => edit(r.row, { email: e.target.value })} /></td>
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
        <p className="text-[11px] text-slate-400">Nada é gravado até você clicar em Importar. Clientes já cadastrados (mesmo CNPJ/CPF ou código) são atualizados.</p>
      </div>
    </Modal>
  );
}
