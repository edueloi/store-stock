import { useId } from "react";
import type { ReactNode } from "react";
import type { PieceSpec } from "../lib/glassPieces";
import { pieceCut, pieceLabel } from "../lib/glassPieces";

// Desenho técnico da peça (vista frontal) em SVG puro: funciona no painel, na vitrine, no PDF e na
// impressão. A cor do vidro e do perfil seguem o que foi escolhido na peça; cada tipo tem seus
// detalhes (trilhos e puxadores, dobradiças, pivô, ferragens do guarda-corpo...) e cotas com setas.

const INK = "#334155";
const DIM = "#1d4ed8";

const TINTS: Record<string, [string, string]> = {
  Incolor: ["#eaf6fa", "#b9dcea"],
  "Fumê": ["#cfd6de", "#6b7787"],
  Verde: ["#d9f3e6", "#74cfa3"],
  Bronze: ["#f6e8d6", "#c8a37c"],
  "Fosco (jateado)": ["#f4f7fa", "#dfe6ee"],
  Espelhado: ["#f8fafc", "#a3b1c2"],
  Laminado: ["#e3f1fb", "#9ec7ee"],
  Canelado: ["#eaf6fa", "#b9dcea"],
};

const FRAMES: Record<string, { fill: string; stroke: string }> = {
  Branco: { fill: "#f8fafc", stroke: "#94a3b8" },
  Preto: { fill: "#1f2937", stroke: "#0b1220" },
  "Fosco natural": { fill: "#c6cbd1", stroke: "#8a939d" },
  Bronze: { fill: "#a77c52", stroke: "#6f4e2e" },
  Cromado: { fill: "#e5e7eb", stroke: "#9ca3af" },
};

function Dim({ x1, y1, x2, y2, label, vertical }: { x1: number; y1: number; x2: number; y2: number; label: string; vertical?: boolean }) {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const a = 6; // tamanho da seta
  const labelW = label.length * 6.6 + 10;
  return (
    <g stroke={DIM} fill={DIM} strokeWidth={1.1}>
      <line x1={x1} y1={y1} x2={x2} y2={y2} />
      {vertical ? (
        <>
          <polygon points={`${x1},${y1} ${x1 - 3},${y1 + a} ${x1 + 3},${y1 + a}`} stroke="none" />
          <polygon points={`${x2},${y2} ${x2 - 3},${y2 - a} ${x2 + 3},${y2 - a}`} stroke="none" />
          <line x1={x1 - 5} y1={y1} x2={x1 + 5} y2={y1} /><line x1={x2 - 5} y1={y2} x2={x2 + 5} y2={y2} />
          <g transform={`rotate(-90 ${mx - 2} ${my})`}>
            <rect x={mx - 2 - labelW / 2} y={my - 9} width={labelW} height={14} rx={3} fill="#fff" stroke="none" />
            <text x={mx - 2} y={my + 2} textAnchor="middle" stroke="none" fontSize={11.5} fontWeight={700}>{label}</text>
          </g>
        </>
      ) : (
        <>
          <polygon points={`${x1},${y1} ${x1 + a},${y1 - 3} ${x1 + a},${y1 + 3}`} stroke="none" />
          <polygon points={`${x2},${y2} ${x2 - a},${y2 - 3} ${x2 - a},${y2 + 3}`} stroke="none" />
          <line x1={x1} y1={y1 - 5} x2={x1} y2={y1 + 5} /><line x1={x2} y1={y2 - 5} x2={x2} y2={y2 + 5} />
          <rect x={mx - labelW / 2} y={my - 16} width={labelW} height={14} rx={3} fill="#fff" stroke="none" />
          <text x={mx} y={my - 5} textAnchor="middle" stroke="none" fontSize={11.5} fontWeight={700}>{label}</text>
        </>
      )}
    </g>
  );
}

/** showCut: mostra também a medida de corte e a sangria (uso interno — nunca no PDF do cliente). */
export default function GlassDrawing({ spec, className, showCut = false }: { spec: PieceSpec; className?: string; showCut?: boolean }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const W = 420, H = 330;
  const margin = { l: 54, r: 22, t: 44, b: 52 };
  const areaW = W - margin.l - margin.r;
  const areaH = H - margin.t - margin.b;
  const ratio = Math.max(0.15, Math.min(6, spec.width_mm / Math.max(1, spec.height_mm)));
  let w = areaW, h = areaW / ratio;
  if (h > areaH) { h = areaH; w = areaH * ratio; }
  const x = margin.l + (areaW - w) / 2;
  const y = margin.t + (areaH - h) / 2;
  const leaves = Math.max(1, spec.leaves ?? (spec.kind === "janela_correr" || spec.kind === "porta_correr" ? 2 : 1));
  const f = Math.max(5, Math.min(10, Math.min(w, h) * 0.05)); // espessura visual do perfil

  const glassName = spec.glass && TINTS[spec.glass] ? spec.glass : "Incolor";
  const [tintA, tintB] = TINTS[glassName];
  const frameStyle = spec.finish === "Sem perfil" ? null : (FRAMES[spec.finish ?? "Branco"] ?? FRAMES.Branco);
  const hw = frameStyle?.stroke === "#0b1220" ? "#cbd5e1" : "#475569"; // cor das ferragens (puxadores, dobradiças)

  const defs = (
    <defs>
      <linearGradient id={`${uid}g`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor={tintA} /><stop offset="1" stopColor={tintB} />
      </linearGradient>
      <linearGradient id={`${uid}m`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#f8fafc" /><stop offset="0.5" stopColor="#cbd5e1" /><stop offset="1" stopColor="#eef2f7" />
      </linearGradient>
      <pattern id={`${uid}f`} width="5" height="5" patternUnits="userSpaceOnUse"><circle cx="1.2" cy="1.2" r="0.7" fill="#fff" opacity="0.9" /><circle cx="3.7" cy="3.7" r="0.6" fill="#fff" opacity="0.7" /></pattern>
      <pattern id={`${uid}k`} width="7" height="7" patternUnits="userSpaceOnUse"><line x1="3.5" y1="0" x2="3.5" y2="7" stroke="#fff" strokeWidth="1.6" opacity="0.65" /></pattern>
    </defs>
  );

  /** Vidro: degradê na cor escolhida, textura (fosco/canelado) e reflexos em faixas diagonais. */
  const pane = (px: number, py: number, pw: number, ph: number, key: string | number, mirror = false) => {
    const w2 = Math.max(2, pw), h2 = Math.max(2, ph);
    const cid = `${uid}c${key}`;
    const shift = Math.min(w2, h2) * 0.55;
    const x0 = px + w2 * 0.1, sw = w2 * 0.14, x1 = px + w2 * 0.3, sw2 = w2 * 0.05;
    return (
      <g key={key}>
        <clipPath id={cid}><rect x={px} y={py} width={w2} height={h2} /></clipPath>
        <rect x={px} y={py} width={w2} height={h2} fill={`url(#${uid}${mirror ? "m" : "g"})`} />
        {!mirror && glassName === "Fosco (jateado)" && <rect x={px} y={py} width={w2} height={h2} fill={`url(#${uid}f)`} />}
        {!mirror && glassName === "Canelado" && <rect x={px} y={py} width={w2} height={h2} fill={`url(#${uid}k)`} />}
        <g clipPath={`url(#${cid})`} opacity={mirror ? 0.7 : 0.5}>
          <polygon points={`${x0},${py + h2} ${x0 + sw},${py + h2} ${x0 + sw + shift},${py} ${x0 + shift},${py}`} fill="#fff" />
          <polygon points={`${x1},${py + h2} ${x1 + sw2},${py + h2} ${x1 + sw2 + shift},${py} ${x1 + shift},${py}`} fill="#fff" />
        </g>
        <rect x={px} y={py} width={w2} height={h2} fill="none" stroke="#64748b" strokeOpacity={0.65} strokeWidth={1} />
      </g>
    );
  };

  /** Perfil/moldura na cor escolhida (ou só um contorno fino quando "sem perfil"). */
  const frame = (fx: number, fy: number, fw: number, fh: number, t: number, key?: string) => {
    if (!frameStyle) return <rect key={key} x={fx} y={fy} width={fw} height={fh} fill="none" stroke={INK} strokeWidth={1.2} />;
    return (
      <path key={key} d={`M${fx} ${fy}h${fw}v${fh}h${-fw}z M${fx + t} ${fy + t}v${fh - 2 * t}h${fw - 2 * t}v${-(fh - 2 * t)}z`}
        fill={frameStyle.fill} fillRule="evenodd" stroke={frameStyle.stroke} strokeWidth={1} />
    );
  };

  const handle = (hx: number, hy: number, hh = 24) => <rect x={hx - 1.5} y={hy - hh / 2} width={3} height={hh} rx={1.5} fill={hw} stroke="#0f172a" strokeOpacity={0.25} strokeWidth={0.6} />;
  const hinge = (hx: number, hy: number) => <rect x={hx - 2.5} y={hy - 5} width={5} height={10} rx={1.5} fill={hw} stroke="#0f172a" strokeOpacity={0.25} strokeWidth={0.6} />;
  const arrow = (ax1: number, ax2: number, ay: number) => (
    <g stroke={INK} strokeWidth={1.2} strokeDasharray="5 4" fill={INK} opacity={0.7}>
      <line x1={ax1} y1={ay} x2={ax2} y2={ay} />
      <polygon points={`${ax2},${ay} ${ax2 + (ax2 > ax1 ? -7 : 7)},${ay - 3.5} ${ax2 + (ax2 > ax1 ? -7 : 7)},${ay + 3.5}`} stroke="none" strokeDasharray="0" />
    </g>
  );

  let body: ReactNode;
  switch (spec.kind) {
    case "janela_correr":
    case "porta_correr":
    case "box_frontal": {
      const framed = spec.kind !== "box_frontal";
      const t = framed ? f : 0;
      const ix = x + t, iy = y + t, iw = w - 2 * t, ih = h - 2 * t;
      const ov = 7; // sobreposição entre folhas
      const lw = (iw + ov * (leaves - 1)) / leaves;
      body = (
        <g>
          {framed && frame(x, y, w, h, f)}
          {/* trilhos */}
          {framed && <><line x1={ix} y1={iy + 4} x2={ix + iw} y2={iy + 4} stroke={INK} strokeOpacity={0.35} /><line x1={ix} y1={iy + ih - 4} x2={ix + iw} y2={iy + ih - 4} stroke={INK} strokeOpacity={0.35} /></>}
          {!framed && <rect x={x - 2} y={y - 5} width={w + 4} height={5} rx={1.5} fill="#cbd5e1" stroke="#94a3b8" />}
          {Array.from({ length: leaves }, (_, i) => {
            const lx = ix + i * (lw - ov);
            const inset = i % 2 === 0 ? 0 : 4; // folhas em trilhos diferentes
            const ly = iy + inset;
            const lh = ih - inset * 2;
            const left = i % 2 === 1;
            return (
              <g key={`leaf${i}`}>
                {leaves === 1 ? pane(ix + 1, iy + 1, iw - 2, ih - 2, `p${i}`) : (
                  <>
                    {frameStyle && framed && frame(lx, ly, lw, lh, 3, `lf${i}`)}
                    {pane(lx + (framed && frameStyle ? 3 : 0), ly + (framed && frameStyle ? 3 : 0), lw - (framed && frameStyle ? 6 : 0), lh - (framed && frameStyle ? 6 : 0), `p${i}`)}
                  </>
                )}
                {leaves > 1 && handle(left ? lx + 7 : lx + lw - 7, ly + lh / 2)}
                {!framed && i === leaves - 1 && <><circle cx={lx + 10} cy={y - 2.5} r={2.6} fill={hw} /><circle cx={lx + lw - 10} cy={y - 2.5} r={2.6} fill={hw} /></>}
              </g>
            );
          })}
          {leaves > 1 && <>{arrow(x + w * 0.22, x + w * 0.4, y + h * 0.5)}{arrow(x + w * 0.78, x + w * 0.6, y + h * 0.5)}</>}
        </g>
      );
      break;
    }
    case "janela_maxim":
      body = (
        <g>
          {frame(x, y, w, h, f)}
          {pane(x + f, y + f, w - 2 * f, h - 2 * f, "p")}
          <polyline points={`${x + f},${y + h - f} ${x + w / 2},${y + f} ${x + w - f},${y + h - f}`} fill="none" stroke={INK} strokeWidth={1.2} strokeDasharray="6 4" opacity={0.75} />
          {hinge(x + w * 0.25, y + f / 2)}{hinge(x + w * 0.75, y + f / 2)}
          <rect x={x + w / 2 - 12} y={y + h - f - 2} width={24} height={4} rx={2} fill={hw} />
        </g>
      );
      break;
    case "porta_pivotante":
      body = (
        <g>
          {frame(x, y, w, h, f)}
          {pane(x + f, y + f, w - 2 * f, h - 2 * f, "p")}
          <polyline points={`${x + f},${y + f} ${x + w - f},${y + h / 2} ${x + f},${y + h - f}`} fill="none" stroke={INK} strokeWidth={1.2} strokeDasharray="6 4" opacity={0.75} />
          <circle cx={x + f + 8} cy={y + f + 8} r={3.4} fill={hw} stroke="#0f172a" strokeOpacity={0.3} />
          <circle cx={x + f + 8} cy={y + h - f - 8} r={3.4} fill={hw} stroke="#0f172a" strokeOpacity={0.3} />
          {handle(x + w - f - 10, y + h / 2, Math.min(60, h * 0.28))}
        </g>
      );
      break;
    case "box_canto": {
      const half = w / 2;
      body = (
        <g>
          <line x1={x - 4} y1={y + h + 3} x2={x + w + 4} y2={y + h + 3} stroke={INK} strokeOpacity={0.4} strokeWidth={2} />
          {pane(x, y, half - 3, h, "a")}
          {pane(x + half + 3, y, half - 3, h, "b")}
          <rect x={x + half - 3} y={y} width={6} height={h} fill={frameStyle?.fill ?? "#cbd5e1"} stroke={frameStyle?.stroke ?? "#94a3b8"} />
          {[0.18, 0.5, 0.82].map((p) => <g key={p}>{hinge(x + half, y + h * p)}</g>)}
          {handle(x + w - 12, y + h * 0.5, Math.min(60, h * 0.26))}
        </g>
      );
      break;
    }
    case "guarda_corpo": {
      const n = Math.max(1, leaves);
      const gap = 6;
      const pw = (w - (n - 1) * gap) / n;
      body = (
        <g>
          <line x1={x - 4} y1={y + h + 3} x2={x + w + 4} y2={y + h + 3} stroke={INK} strokeOpacity={0.4} strokeWidth={2} />
          {Array.from({ length: n }, (_, i) => (
            <g key={`gc${i}`}>
              {pane(x + i * (pw + gap), y + 8, pw, h - 8, i)}
              <circle cx={x + i * (pw + gap) + 9} cy={y + h - 10} r={3.2} fill={hw} stroke="#0f172a" strokeOpacity={0.3} />
              <circle cx={x + i * (pw + gap) + pw - 9} cy={y + h - 10} r={3.2} fill={hw} stroke="#0f172a" strokeOpacity={0.3} />
            </g>
          ))}
          <rect x={x - 2} y={y} width={w + 4} height={7} rx={3.5} fill={frameStyle?.fill ?? "#cbd5e1"} stroke={frameStyle?.stroke ?? "#94a3b8"} />
        </g>
      );
      break;
    }
    case "espelho":
      body = (
        <g>
          <rect x={x} y={y} width={w} height={h} rx={4} fill={frameStyle?.fill ?? "#e2e8f0"} stroke={frameStyle?.stroke ?? "#94a3b8"} strokeWidth={1} />
          {pane(x + 4, y + 4, w - 8, h - 8, "m", true)}
          <rect x={x + 4} y={y + 4} width={w - 8} height={h - 8} fill="none" stroke="#fff" strokeOpacity={0.9} strokeWidth={1.4} />
        </g>
      );
      break;
    case "tampo":
      body = (
        <g>
          <rect x={x + 3} y={y + 4} width={w} height={h} rx={6} fill="#0f172a" opacity={0.08} />
          <rect x={x} y={y} width={w} height={h} rx={6} fill={`url(#${uid}g)`} stroke="#64748b" strokeOpacity={0.7} />
          <rect x={x + 5} y={y + 5} width={w - 10} height={h - 10} rx={4} fill="none" stroke="#fff" strokeOpacity={0.8} strokeWidth={1.6} />
          <polygon points={`${x + w * 0.12},${y + h} ${x + w * 0.26},${y + h} ${x + w * 0.26 + h * 0.5},${y} ${x + w * 0.12 + h * 0.5},${y}`} fill="#fff" opacity={0.35} />
        </g>
      );
      break;
    default: // fixo / vitrô
      body = (
        <g>
          {frame(x, y, w, h, f)}
          {pane(x + f, y + f, w - 2 * f, h - 2 * f, "p")}
        </g>
      );
  }

  const glassCaption = [spec.glass, spec.thickness_mm ? `${spec.thickness_mm} mm` : ""].filter(Boolean).join(" ");
  const caption = [pieceLabel(spec.kind), glassCaption, spec.leaves && spec.leaves > 1 ? `${spec.leaves} folhas` : ""].filter(Boolean).join(" · ");
  const cut = pieceCut(spec);
  const hasCut = showCut && (spec.gap_mm ?? 0) > 0;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={className} role="img" aria-label={`${pieceLabel(spec.kind)} ${spec.width_mm} por ${spec.height_mm} milímetros`} style={{ width: "100%", height: "auto", background: "#fff" }}>
      {defs}
      {/* sombra suave sob a peça */}
      <rect x={x + 3} y={y + 4} width={w} height={h} rx={3} fill="#0f172a" opacity={0.06} />
      {body}
      <Dim x1={x} y1={margin.t - 16} x2={x + w} y2={margin.t - 16} label={`${spec.width_mm} mm`} />
      <Dim x1={margin.l - 26} y1={y} x2={margin.l - 26} y2={y + h} label={`${spec.height_mm} mm`} vertical />
      <text x={W / 2} y={H - (hasCut ? 24 : 14)} textAnchor="middle" fontSize={12} fontWeight={700} fill={INK}>{caption}</text>
      {hasCut && (
        <text x={W / 2} y={H - 8} textAnchor="middle" fontSize={11} fontWeight={600} fill="#b45309">
          Corte {cut.cutW} × {cut.cutH} mm · sangria {spec.gap_mm} mm por lado
        </text>
      )}
    </svg>
  );
}
