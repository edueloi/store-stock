// Peças de vidraçaria: tipos, opções e utilitários compartilhados entre o orçamento do
// painel, a solicitação da vitrine e o PDF. O desenho é feito por components/GlassDrawing.

export type PieceKind =
  | "janela_correr" | "janela_maxim" | "porta_correr" | "porta_pivotante"
  | "box_frontal" | "box_canto" | "espelho" | "tampo" | "guarda_corpo" | "fixo";

/** Formato do vidro: retangular ou um recorte (arco, redondo, triângulo...). Só para peças de uma folha. */
export type PieceShape = "retangular" | "arco" | "meia_lua" | "redondo" | "triangulo" | "trapezio" | "chanfrado" | "octogonal";

export const PIECE_SHAPES: { value: PieceShape; label: string }[] = [
  { value: "retangular", label: "Retangular" },
  { value: "arco", label: "Arco" },
  { value: "meia_lua", label: "Meia-lua" },
  { value: "redondo", label: "Redondo / oval" },
  { value: "triangulo", label: "Triângulo" },
  { value: "trapezio", label: "Trapézio" },
  { value: "chanfrado", label: "Cantos cortados" },
  { value: "octogonal", label: "Octogonal" },
];

/** Tipos de peça que aceitam formato diferente do retangular. */
export const SHAPE_KINDS: PieceKind[] = ["espelho", "tampo", "fixo"];

export const shapeLabel = (shape: string | undefined) => PIECE_SHAPES.find((s) => s.value === shape)?.label ?? "Retangular";

export interface PieceSpec {
  kind: PieceKind;
  width_mm: number;
  height_mm: number;
  leaves?: number;          // folhas (janela/porta de correr, box)
  glass?: string;           // incolor, fumê, verde, bronze...
  thickness_mm?: number;    // 6, 8, 10...
  finish?: string;          // cor da ferragem/perfil
  notes?: string;
  /** Sangria: folga descontada de CADA lado da medida do vão para chegar à medida de corte (mm). */
  gap_mm?: number;
  /** Margem de segurança sobre a área (perda de corte/quebra), em %. Entra na área cobrada. */
  waste_pct?: number;
  /** Formato do vidro (ausente = retangular). A cobrança é sempre pelo retângulo do vão (envolvente). */
  shape?: PieceShape;
}

export const PIECE_KINDS: { value: PieceKind; label: string; leaves: boolean }[] = [
  { value: "janela_correr", label: "Janela de correr", leaves: true },
  { value: "janela_maxim", label: "Janela maxim-ar", leaves: false },
  { value: "porta_correr", label: "Porta de correr", leaves: true },
  { value: "porta_pivotante", label: "Porta pivotante", leaves: false },
  { value: "box_frontal", label: "Box frontal", leaves: true },
  { value: "box_canto", label: "Box de canto", leaves: false },
  { value: "espelho", label: "Espelho", leaves: false },
  { value: "tampo", label: "Tampo de vidro", leaves: false },
  { value: "guarda_corpo", label: "Guarda-corpo", leaves: true },
  { value: "fixo", label: "Vidro fixo / vitrô", leaves: false },
];

export const GLASS_TYPES = ["Incolor", "Fumê", "Verde", "Bronze", "Fosco (jateado)", "Espelhado", "Laminado", "Canelado"];
export const GLASS_THICKNESS = [4, 6, 8, 10, 12];
export const FINISHES = ["Branco", "Preto", "Fosco natural", "Bronze", "Cromado", "Sem perfil"];

/** Listas do formulário da peça configuradas pela loja (Configurações > Vidraçaria). Vazio = padrão do sistema. */
export interface GlassOptions {
  glass_types?: string[];
  thicknesses?: number[];
  finishes?: string[];
  kinds?: string[];
}

/** Padrão de corte da loja (Configurações): vale para todas as peças, com ajuste opcional por tipo. */
export interface GlassDefaults {
  gap_mm?: number;
  waste_pct?: number;
  by_kind?: Record<string, { gap_mm?: number; waste_pct?: number }>;
}

export const pieceLabel = (kind: string) => PIECE_KINDS.find((k) => k.value === kind)?.label ?? "Peça";

const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/** Texto único usado em PDFs/listas: "Janela de correr · 1500 × 1000 mm · 2 folhas · Incolor 8 mm". */
export function pieceSummary(spec: PieceSpec | null | undefined): string {
  if (!spec) return "";
  const parts = [`${pieceLabel(spec.kind)} · ${num(spec.width_mm)} × ${num(spec.height_mm)} mm`];
  if (spec.leaves && spec.leaves > 1) parts.push(`${spec.leaves} folhas`);
  if (spec.shape && spec.shape !== "retangular") parts.push(`formato ${shapeLabel(spec.shape).toLowerCase()}`);
  const glass = [spec.glass, spec.thickness_mm ? `${spec.thickness_mm} mm` : ""].filter(Boolean).join(" ");
  if (glass) parts.push(glass);
  if (num(spec.gap_mm) > 0) {
    const cut = pieceCut(spec);
    parts.push(`corte ${cut.cutW} × ${cut.cutH} mm (sangria ${num(spec.gap_mm)} mm/lado)`);
  }
  if (num(spec.waste_pct) > 0) parts.push(`margem ${num(spec.waste_pct)}%`);
  if (spec.finish) parts.push(`perfil ${spec.finish.toLowerCase()}`);
  return parts.join(" · ");
}

/** Valida e limpa o que veio do cliente (usado no backend também — mantém espelho em backend/utils). */
export function sanitizePieceSpec(raw: any): PieceSpec | null {
  if (!raw || typeof raw !== "object") return null;
  const kind = PIECE_KINDS.find((k) => k.value === raw.kind)?.value;
  const width_mm = Math.round(num(raw.width_mm));
  const height_mm = Math.round(num(raw.height_mm));
  if (!kind || width_mm < 50 || height_mm < 50 || width_mm > 10000 || height_mm > 10000) return null;
  const str = (v: unknown, max = 60) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined);
  const leaves = Math.min(6, Math.max(1, Math.round(num(raw.leaves)) || 1));
  const thickness = Math.round(num(raw.thickness_mm));
  const gap = Math.min(50, Math.max(0, num(raw.gap_mm)));
  const waste = Math.min(50, Math.max(0, num(raw.waste_pct)));
  const shape = PIECE_SHAPES.find((s) => s.value === raw.shape)?.value;
  return {
    kind, width_mm, height_mm,
    ...(leaves > 1 ? { leaves } : {}),
    ...(str(raw.glass) ? { glass: str(raw.glass) } : {}),
    ...(thickness > 0 && thickness <= 30 ? { thickness_mm: thickness } : {}),
    ...(str(raw.finish) ? { finish: str(raw.finish) } : {}),
    ...(str(raw.notes, 300) ? { notes: str(raw.notes, 300) } : {}),
    ...(gap > 0 ? { gap_mm: Math.round(gap * 10) / 10 } : {}),
    ...(waste > 0 ? { waste_pct: Math.round(waste * 10) / 10 } : {}),
    ...(shape && shape !== "retangular" && SHAPE_KINDS.includes(kind) ? { shape } : {}),
  };
}

/**
 * Medida de corte da peça: vão menos a sangria dos dois lados. A área cobrada é a área de corte
 * acrescida da margem de segurança. Sem sangria nem margem, tudo coincide com o vão informado.
 */
export function pieceCut(spec: Pick<PieceSpec, "width_mm" | "height_mm" | "leaves" | "gap_mm" | "waste_pct">) {
  const gap = Math.max(0, num(spec.gap_mm));
  const cutW = Math.max(0, Math.round(num(spec.width_mm) - 2 * gap));
  const cutH = Math.max(0, Math.round(num(spec.height_mm) - 2 * gap));
  const leaves = Math.max(1, Math.round(num(spec.leaves)) || 1);
  const areaCut = (cutW / 1000) * (cutH / 1000);
  const waste = Math.max(0, num(spec.waste_pct));
  return { cutW, cutH, leaves, leafW: Math.round(cutW / leaves), areaCut, areaBilled: areaCut * (1 + waste / 100) };
}

/** Área cobrada em m² considerando sangria e margem de segurança. */
export const pieceBilledAreaM2 = (spec: Pick<PieceSpec, "width_mm" | "height_mm" | "leaves" | "gap_mm" | "waste_pct">) => pieceCut(spec).areaBilled;

/** Área cobrada em m² (largura × altura). */
export const pieceAreaM2 = (spec: Pick<PieceSpec, "width_mm" | "height_mm">) => (num(spec.width_mm) / 1000) * (num(spec.height_mm) / 1000);

/** Listas finais do formulário: o que a loja configurou ou, se vazio, o padrão do sistema. */
export function resolveGlassOptions(options?: GlassOptions | null) {
  const pick = <T,>(list: T[] | undefined, fallback: T[]) => (Array.isArray(list) && list.length ? list : fallback);
  return {
    glassTypes: pick(options?.glass_types, GLASS_TYPES),
    thicknesses: pick(options?.thicknesses, GLASS_THICKNESS),
    finishes: pick(options?.finishes, FINISHES),
    kinds: PIECE_KINDS.filter((k) => !options?.kinds?.length || options.kinds.includes(k.value)),
  };
}
