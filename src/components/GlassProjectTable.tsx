import { Printer } from "lucide-react";
import { pieceCut, pieceLabel, type PieceSpec } from "../lib/glassPieces";

// Quadro "Projeto — peças e medidas" (vão, sangria, corte, vidro, quantidade e m² cobrados).
// Usado no orçamento e na ordem de serviço; só Tailwind básico para servir aos dois.

export interface ProjectPiece {
  name: string;
  spec: PieceSpec;
  qty: number;
}

export function projectTotals(pieces: ProjectPiece[]) {
  return {
    count: pieces.reduce((sum, p) => sum + p.qty, 0),
    m2: pieces.reduce((sum, p) => sum + pieceCut(p.spec).areaBilled * p.qty, 0),
  };
}

export default function GlassProjectTable({ pieces, onPrint }: { pieces: ProjectPiece[]; onPrint?: () => void }) {
  if (pieces.length === 0) return null;
  const totals = projectTotals(pieces);

  return (
    <div className="p-3">
      {onPrint && (
        <div className="mb-2 flex justify-end">
          <button
            type="button"
            onClick={onPrint}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Printer size={13} /> Imprimir ficha de corte
          </button>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-[11px]">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500">
              <th className="py-1.5 pr-2 font-medium">Peça</th>
              <th className="px-2 py-1.5 font-medium">Vão (mm)</th>
              <th className="px-2 py-1.5 font-medium">Sangria</th>
              <th className="px-2 py-1.5 font-medium">Corte (mm)</th>
              <th className="px-2 py-1.5 font-medium">Vidro</th>
              <th className="px-2 py-1.5 text-right font-medium">Qtd.</th>
              <th className="py-1.5 pl-2 text-right font-medium">m² cobrados</th>
            </tr>
          </thead>
          <tbody>
            {pieces.map((p, i) => {
              const cut = pieceCut(p.spec);
              return (
                <tr key={i} className="border-b border-slate-100 text-slate-700">
                  <td className="py-1.5 pr-2 font-medium">{pieceLabel(p.spec.kind)}<span className="block font-normal text-slate-400">{p.name}</span></td>
                  <td className="px-2 py-1.5 font-mono">{p.spec.width_mm} × {p.spec.height_mm}</td>
                  <td className="px-2 py-1.5 font-mono">{p.spec.gap_mm ? `${p.spec.gap_mm} mm/lado` : "—"}</td>
                  <td className="px-2 py-1.5 font-mono">
                    {cut.cutW} × {cut.cutH}
                    {cut.leaves > 1 ? <span className="block font-sans text-slate-400">{cut.leaves} folhas ≈ {cut.leafW} mm</span> : null}
                  </td>
                  <td className="px-2 py-1.5">{[p.spec.glass, p.spec.thickness_mm ? `${p.spec.thickness_mm} mm` : ""].filter(Boolean).join(" ") || "—"}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{p.qty}</td>
                  <td className="py-1.5 pl-2 text-right font-mono tabular-nums">
                    {(cut.areaBilled * p.qty).toFixed(2)}
                    {p.spec.waste_pct ? <span className="block font-sans text-slate-400">+{p.spec.waste_pct}% margem</span> : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-right text-xs font-semibold text-slate-800">
        {totals.count} {totals.count === 1 ? "peça" : "peças"} · {totals.m2.toFixed(2)} m² cobrados
      </p>
    </div>
  );
}
