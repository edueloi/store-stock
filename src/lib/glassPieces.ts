// Peças de vidraçaria: tipos, opções e utilitários compartilhados entre o orçamento do
// painel, a solicitação da vitrine e o PDF. O desenho é feito por components/GlassDrawing.

export type PieceKind =
  | "janela_correr" | "janela_maxim" | "porta_correr" | "porta_pivotante"
  | "box_frontal" | "box_canto" | "espelho" | "tampo" | "guarda_corpo" | "fixo";

export interface PieceSpec {
  kind: PieceKind;
  width_mm: number;
  height_mm: number;
  leaves?: number;          // folhas (janela/porta de correr, box)
  glass?: string;           // incolor, fumê, verde, bronze...
  thickness_mm?: number;    // 6, 8, 10...
  finish?: string;          // cor da ferragem/perfil
  notes?: string;
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

export const pieceLabel = (kind: string) => PIECE_KINDS.find((k) => k.value === kind)?.label ?? "Peça";

const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/** Texto único usado em PDFs/listas: "Janela de correr · 1500 × 1000 mm · 2 folhas · Incolor 8 mm". */
export function pieceSummary(spec: PieceSpec | null | undefined): string {
  if (!spec) return "";
  const parts = [`${pieceLabel(spec.kind)} · ${num(spec.width_mm)} × ${num(spec.height_mm)} mm`];
  if (spec.leaves && spec.leaves > 1) parts.push(`${spec.leaves} folhas`);
  const glass = [spec.glass, spec.thickness_mm ? `${spec.thickness_mm} mm` : ""].filter(Boolean).join(" ");
  if (glass) parts.push(glass);
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
  return {
    kind, width_mm, height_mm,
    ...(leaves > 1 ? { leaves } : {}),
    ...(str(raw.glass) ? { glass: str(raw.glass) } : {}),
    ...(thickness > 0 && thickness <= 30 ? { thickness_mm: thickness } : {}),
    ...(str(raw.finish) ? { finish: str(raw.finish) } : {}),
    ...(str(raw.notes, 300) ? { notes: str(raw.notes, 300) } : {}),
  };
}

/** Área cobrada em m² (largura × altura). */
export const pieceAreaM2 = (spec: Pick<PieceSpec, "width_mm" | "height_mm">) => (num(spec.width_mm) / 1000) * (num(spec.height_mm) / 1000);
