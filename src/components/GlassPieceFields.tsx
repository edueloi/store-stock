import GlassDrawing from "./GlassDrawing";
import { FINISHES, GLASS_THICKNESS, GLASS_TYPES, PIECE_KINDS, type PieceKind, type PieceSpec } from "../lib/glassPieces";

// Formulário da peça de vidro + desenho ao vivo. Usado no orçamento do painel e na
// solicitação de orçamento da vitrine (por isso só Tailwind básico, sem componentes do painel).

export interface PieceDraft {
  kind: PieceKind;
  width_mm: string;
  height_mm: string;
  leaves: number;
  glass: string;
  thickness_mm: number;
  finish: string;
  notes: string;
}

export const emptyPieceDraft = (): PieceDraft => ({
  kind: "janela_correr", width_mm: "", height_mm: "", leaves: 2, glass: "Incolor", thickness_mm: 8, finish: "Branco", notes: "",
});

export function draftToSpec(d: PieceDraft): PieceSpec {
  const hasLeaves = PIECE_KINDS.find((k) => k.value === d.kind)?.leaves;
  return {
    kind: d.kind,
    width_mm: Math.round(Number(d.width_mm.replace(",", ".")) || 0),
    height_mm: Math.round(Number(d.height_mm.replace(",", ".")) || 0),
    ...(hasLeaves ? { leaves: d.leaves } : {}),
    glass: d.glass, thickness_mm: d.thickness_mm, finish: d.finish,
    ...(d.notes.trim() ? { notes: d.notes.trim() } : {}),
  };
}

const field = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200";
const label = "mb-1 block text-xs font-semibold text-slate-600";

export default function GlassPieceFields({ draft, onChange }: { draft: PieceDraft; onChange: (d: PieceDraft) => void }) {
  const set = <K extends keyof PieceDraft>(k: K, v: PieceDraft[K]) => onChange({ ...draft, [k]: v });
  const spec = draftToSpec(draft);
  const hasLeaves = PIECE_KINDS.find((k) => k.value === draft.kind)?.leaves;
  const ready = spec.width_mm >= 50 && spec.height_mm >= 50;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-3">
        <div>
          <label className={label}>Tipo de peça</label>
          <select className={field} value={draft.kind} onChange={(e) => {
            const kind = e.target.value as PieceKind;
            const leaves = PIECE_KINDS.find((k) => k.value === kind)?.leaves ? Math.max(2, draft.leaves) : 1;
            onChange({ ...draft, kind, leaves });
          }}>
            {PIECE_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>Largura (mm)</label>
            <input className={field} inputMode="numeric" placeholder="1500" value={draft.width_mm} onChange={(e) => set("width_mm", e.target.value.replace(/[^\d.,]/g, ""))} />
          </div>
          <div>
            <label className={label}>Altura (mm)</label>
            <input className={field} inputMode="numeric" placeholder="1000" value={draft.height_mm} onChange={(e) => set("height_mm", e.target.value.replace(/[^\d.,]/g, ""))} />
          </div>
        </div>
        {hasLeaves && (
          <div>
            <label className={label}>Folhas</label>
            <select className={field} value={draft.leaves} onChange={(e) => set("leaves", Number(e.target.value))}>
              {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n} {n === 1 ? "folha" : "folhas"}</option>)}
            </select>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>Vidro</label>
            <select className={field} value={draft.glass} onChange={(e) => set("glass", e.target.value)}>
              {GLASS_TYPES.map((g) => <option key={g}>{g}</option>)}
            </select>
          </div>
          <div>
            <label className={label}>Espessura</label>
            <select className={field} value={draft.thickness_mm} onChange={(e) => set("thickness_mm", Number(e.target.value))}>
              {GLASS_THICKNESS.map((t) => <option key={t} value={t}>{t} mm</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className={label}>Cor do perfil / ferragem</label>
          <select className={field} value={draft.finish} onChange={(e) => set("finish", e.target.value)}>
            {FINISHES.map((f) => <option key={f}>{f}</option>)}
          </select>
        </div>
        <div>
          <label className={label}>Observações</label>
          <textarea className={field} rows={2} maxLength={300} value={draft.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Ex.: instalação no 2º andar, com fechadura" />
        </div>
      </div>
      <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-white p-2">
        {ready
          ? <GlassDrawing spec={spec} />
          : <p className="p-6 text-center text-sm text-slate-400">Informe largura e altura para ver o desenho da peça.</p>}
      </div>
    </div>
  );
}
