import { renderToStaticMarkup } from "react-dom/server";
import GlassDrawing from "../components/GlassDrawing";
import { projectTotals, type ProjectPiece } from "../components/GlassProjectTable";
import { pieceCut, pieceLabel } from "./glassPieces";

// Ficha de corte para a oficina: uma linha por peça (vão, sangria, medida de corte, folhas,
// vidro, perfil, quantidade e observações) mais o desenho de cada uma. Abre a impressão do navegador.

const esc = (v: unknown) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

export function printCutSheet(input: { heading: string; customer?: string | null; pieces: ProjectPiece[]; storeName?: string | null }) {
  const { heading, customer, pieces, storeName } = input;
  if (pieces.length === 0) return;
  const totals = projectTotals(pieces);

  const rows = pieces.map((p, i) => {
    const cut = pieceCut(p.spec);
    const glass = [p.spec.glass, p.spec.thickness_mm ? `${p.spec.thickness_mm} mm` : ""].filter(Boolean).join(" ") || "—";
    return `<tr>
      <td>${i + 1}</td>
      <td><b>${esc(pieceLabel(p.spec.kind))}</b><br><small>${esc(p.name)}</small></td>
      <td class="m">${p.spec.width_mm} × ${p.spec.height_mm}</td>
      <td class="m">${p.spec.gap_mm ? `${p.spec.gap_mm} mm/lado` : "—"}</td>
      <td class="m"><b>${cut.cutW} × ${cut.cutH}</b>${cut.leaves > 1 ? `<br><small>${cut.leaves} folhas ≈ ${cut.leafW} mm</small>` : ""}</td>
      <td>${esc(glass)}</td>
      <td>${esc(p.spec.finish || "—")}</td>
      <td class="r"><b>${p.qty}</b></td>
      <td class="m r">${(cut.areaBilled * p.qty).toFixed(2)}${p.spec.waste_pct ? `<br><small>+${p.spec.waste_pct}%</small>` : ""}</td>
      <td>${esc(p.spec.notes || "")}</td>
    </tr>`;
  }).join("");

  const drawings = pieces.map((p, i) => `<div class="draw">
      <div class="cap">${i + 1}. ${esc(pieceLabel(p.spec.kind))} — corte ${pieceCut(p.spec).cutW} × ${pieceCut(p.spec).cutH} mm · ${p.qty} un.</div>
      ${renderToStaticMarkup(<GlassDrawing spec={p.spec} showCut />)}
    </div>`).join("");

  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Ficha de corte</title>
  <style>
    *{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#0f172a;margin:24px;font-size:12px}
    h1{font-size:18px;margin:0}.sub{color:#475569;margin:2px 0 14px}
    table{width:100%;border-collapse:collapse}th,td{border:1px solid #cbd5e1;padding:6px 7px;text-align:left;vertical-align:top}
    th{background:#f1f5f9;font-size:11px}.m{font-family:Consolas,monospace}.r{text-align:right}small{color:#64748b}
    .tot{margin:10px 0 18px;text-align:right;font-weight:700}
    .grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}.draw{border:1px solid #cbd5e1;border-radius:6px;padding:8px;break-inside:avoid}
    .draw svg{width:100%;height:auto;max-height:260px}.cap{font-weight:700;margin-bottom:4px}
    .sign{display:flex;gap:40px;margin-top:34px}.sign div{flex:1;border-top:1px solid #0f172a;padding-top:4px;text-align:center;color:#475569}
    @media print{body{margin:10mm}}
  </style></head><body>
    <h1>Ficha de corte — ${esc(heading)}</h1>
    <p class="sub">${storeName ? `${esc(storeName)} · ` : ""}${customer ? `Cliente: ${esc(customer)} · ` : ""}${new Date().toLocaleDateString("pt-BR")}</p>
    <table><thead><tr><th>#</th><th>Peça</th><th>Vão (mm)</th><th>Sangria</th><th>Corte (mm)</th><th>Vidro</th><th>Perfil</th><th class="r">Qtd.</th><th class="r">m²</th><th>Observações</th></tr></thead><tbody>${rows}</tbody></table>
    <p class="tot">${totals.count} ${totals.count === 1 ? "peça" : "peças"} · ${totals.m2.toFixed(2)} m²</p>
    <div class="grid">${drawings}</div>
    <div class="sign"><div>Cortado por</div><div>Conferido por</div><div>Data</div></div>
    <script>window.onload=function(){window.print()}</script>
  </body></html>`;

  const win = window.open("", "_blank");
  if (!win) return;
  win.document.open();
  win.document.write(html);
  win.document.close();
}
