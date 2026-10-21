import type { PieceSpec } from "../lib/glassPieces";
import { pieceLabel } from "../lib/glassPieces";

// Desenho técnico simplificado da peça (vista frontal) com cotas de largura e altura,
// feito em SVG puro — funciona no painel, na vitrine e pode ser impresso.

const GLASS = "#cfe6ee";
const FRAME = "#334155";
const DIM = "#1d4ed8";

function Dim({ x1, y1, x2, y2, label, vertical }: { x1: number; y1: number; x2: number; y2: number; label: string; vertical?: boolean }) {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  return (
    <g stroke={DIM} strokeWidth={1.2} fill={DIM}>
      <line x1={x1} y1={y1} x2={x2} y2={y2} />
      {vertical ? (
        <>
          <line x1={x1 - 5} y1={y1} x2={x1 + 5} y2={y1} /><line x1={x2 - 5} y1={y2} x2={x2 + 5} y2={y2} />
          <text x={mx - 7} y={my} transform={`rotate(-90 ${mx - 7} ${my})`} textAnchor="middle" stroke="none" fontSize={13} fontWeight={700}>{label}</text>
        </>
      ) : (
        <>
          <line x1={x1} y1={y1 - 5} x2={x1} y2={y1 + 5} /><line x1={x2} y1={y2 - 5} x2={x2} y2={y2 + 5} />
          <text x={mx} y={my - 7} textAnchor="middle" stroke="none" fontSize={13} fontWeight={700}>{label}</text>
        </>
      )}
    </g>
  );
}

function Arrow({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }) {
  return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={FRAME} strokeWidth={1.2} strokeDasharray="5 4" />;
}

export default function GlassDrawing({ spec, className }: { spec: PieceSpec; className?: string }) {
  const W = 360, H = 280;
  const margin = { l: 44, r: 16, t: 34, b: 14 };
  const areaW = W - margin.l - margin.r;
  const areaH = H - margin.t - margin.b;
  const ratio = Math.max(0.15, Math.min(6, spec.width_mm / Math.max(1, spec.height_mm)));
  let w = areaW, h = areaW / ratio;
  if (h > areaH) { h = areaH; w = areaH * ratio; }
  const x = margin.l + (areaW - w) / 2;
  const y = margin.t + (areaH - h) / 2;
  const leaves = Math.max(1, spec.leaves ?? (spec.kind === "janela_correr" || spec.kind === "porta_correr" ? 2 : 1));
  const f = 5; // espessura visual do perfil

  const pane = (px: number, py: number, pw: number, ph: number, key: string | number) => (
    <rect key={key} x={px} y={py} width={Math.max(2, pw)} height={Math.max(2, ph)} fill={GLASS} fillOpacity={0.75} stroke={FRAME} strokeWidth={1.5} />
  );

  let body: React.ReactNode;
  switch (spec.kind) {
    case "janela_correr":
    case "porta_correr":
    case "box_frontal": {
      const ow = w / leaves + f * (leaves - 1) / leaves; // folhas com leve sobreposição
      body = (
        <g>
          <rect x={x} y={y} width={w} height={h} fill="none" stroke={FRAME} strokeWidth={spec.kind === "box_frontal" ? 1 : 3} />
          {Array.from({ length: leaves }, (_, i) => {
            const px = x + (i * (w - ow)) / Math.max(1, leaves - 1);
            const inset = i % 2 === 0 ? 0 : f;
            return pane(leaves === 1 ? x + f : px + 1, y + f + inset / 2, (leaves === 1 ? w - 2 * f : ow - 2), h - 2 * f - inset, i);
          })}
          {leaves > 1 && <>
            <Arrow x1={x + w * 0.2} y1={y + h / 2} x2={x + w * 0.4} y2={y + h / 2} />
            <Arrow x1={x + w * 0.8} y1={y + h / 2} x2={x + w * 0.6} y2={y + h / 2} />
          </>}
        </g>
      );
      break;
    }
    case "janela_maxim":
      body = (
        <g>
          <rect x={x} y={y} width={w} height={h} fill="none" stroke={FRAME} strokeWidth={3} />
          {pane(x + f, y + f, w - 2 * f, h - 2 * f, "p")}
          <polyline points={`${x + f},${y + h - f} ${x + w / 2},${y + f} ${x + w - f},${y + h - f}`} fill="none" stroke={FRAME} strokeWidth={1.2} strokeDasharray="6 4" />
        </g>
      );
      break;
    case "porta_pivotante":
      body = (
        <g>
          <rect x={x} y={y} width={w} height={h} fill="none" stroke={FRAME} strokeWidth={3} />
          {pane(x + f, y + f, w - 2 * f, h - 2 * f, "p")}
          <polyline points={`${x + f},${y + f} ${x + w - f},${y + h / 2} ${x + f},${y + h - f}`} fill="none" stroke={FRAME} strokeWidth={1.2} strokeDasharray="6 4" />
          <circle cx={x + w - 14} cy={y + h / 2} r={3.5} fill={FRAME} />
        </g>
      );
      break;
    case "box_canto": {
      const half = w / 2;
      body = (
        <g>
          {pane(x, y, half - 3, h, "a")}
          {pane(x + half + 3, y, half - 3, h, "b")}
          <line x1={x + half} y1={y} x2={x + half} y2={y + h} stroke={FRAME} strokeWidth={2} />
        </g>
      );
      break;
    }
    case "guarda_corpo": {
      const n = Math.max(1, leaves);
      const pw = (w - (n - 1) * 6) / n;
      body = (
        <g>
          {Array.from({ length: n }, (_, i) => pane(x + i * (pw + 6), y + 6, pw, h - 6, i))}
          <line x1={x} y1={y + 3} x2={x + w} y2={y + 3} stroke={FRAME} strokeWidth={5} strokeLinecap="round" />
        </g>
      );
      break;
    }
    case "espelho":
      body = (
        <g>
          <rect x={x} y={y} width={w} height={h} rx={3} fill="#e8eef2" stroke={FRAME} strokeWidth={2} />
          <polygon points={`${x + w * 0.18},${y + h * 0.12} ${x + w * 0.34},${y + h * 0.12} ${x + w * 0.16},${y + h * 0.4} ${x + w * 0.1},${y + h * 0.4}`} fill="#fff" opacity={0.8} />
        </g>
      );
      break;
    default: // tampo, fixo
      body = (
        <g>
          <rect x={x} y={y} width={w} height={h} fill={GLASS} fillOpacity={0.75} stroke={FRAME} strokeWidth={spec.kind === "fixo" ? 3 : 1.5} rx={spec.kind === "tampo" ? 4 : 0} />
          <line x1={x + 10} y1={y + h - 10} x2={x + 28} y2={y + h - 28} stroke="#fff" strokeWidth={3} opacity={0.8} />
        </g>
      );
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={className} role="img" aria-label={`${pieceLabel(spec.kind)} ${spec.width_mm} por ${spec.height_mm} milímetros`} style={{ width: "100%", height: "auto", background: "#fff" }}>
      {body}
      <Dim x1={x} y1={margin.t - 14} x2={x + w} y2={margin.t - 14} label={`${spec.width_mm} mm`} />
      <Dim x1={margin.l - 22} y1={y} x2={margin.l - 22} y2={y + h} label={`${spec.height_mm} mm`} vertical />
    </svg>
  );
}
