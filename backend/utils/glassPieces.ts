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
  /** Adicionais cobrados nesta peça (furos, lapidação, instalação…), somados ao valor do vidro. */
  extras?: PieceExtra[];
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

/** Linha da tabela de preços da vidraçaria: preço do m² por tipo de vidro e espessura. */
export interface GlassPriceRow { glass: string; thickness_mm?: number | null; price_m2: number }

/**
 * Preço do m² da tabela para a peça: vidro e espessura exatos; senão o vidro em "qualquer espessura";
 * senão null (e o orçamento usa o preço por m² do serviço, como antes da tabela existir).
 */
export function glassTablePrice(spec: Pick<PieceSpec, "glass" | "thickness_mm">, table?: GlassPriceRow[] | null): number | null {
  if (!table?.length || !spec.glass) return null;
  const same = (a?: string, b?: string) => (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();
  const exact = table.find((r) => same(r.glass, spec.glass) && !!r.thickness_mm && Number(r.thickness_mm) === Number(spec.thickness_mm));
  const anyThickness = table.find((r) => same(r.glass, spec.glass) && !r.thickness_mm);
  const row = exact ?? anyThickness;
  const price = Number(row?.price_m2);
  return row && price > 0 ? price : null;
}

/** Como um adicional da peça é cobrado. */
export type ExtraMode = "fixed" | "per_unit" | "per_m2" | "per_meter";

export const EXTRA_MODES: { value: ExtraMode; label: string; unit: string }[] = [
  { value: "fixed", label: "Valor fixo por peça", unit: "por peça" },
  { value: "per_unit", label: "Por unidade (furo, puxador…)", unit: "por unidade" },
  { value: "per_m2", label: "Por m² da peça", unit: "por m²" },
  { value: "per_meter", label: "Por metro linear (perímetro)", unit: "por metro" },
];

/** Adicional cadastrado pela loja (Configurações > Vidraçaria): furos, lapidação, instalação… */
export interface GlassExtra { id: string; name: string; mode: ExtraMode; price: number }

/**
 * Adicional escolhido numa peça. Guarda nome, modo e preço do momento: um orçamento antigo não
 * muda se a loja alterar o cadastro depois.
 */
export interface PieceExtra extends GlassExtra { qty?: number }

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
  if (spec.shape && spec.shape !== "retangular") parts.push(`formato ${shapeLabel(spec.shape).toLowerCase()}`);
  const glass = [spec.glass, spec.thickness_mm ? `${spec.thickness_mm} mm` : ""].filter(Boolean).join(" ");
  if (glass) parts.push(glass);
  if (num(spec.gap_mm) > 0) {
    const cut = pieceCut(spec);
    parts.push(`corte ${cut.cutW} × ${cut.cutH} mm (sangria ${num(spec.gap_mm)} mm/lado)`);
  }
  if (num(spec.waste_pct) > 0) parts.push(`margem ${num(spec.waste_pct)}%`);
  if (spec.finish) parts.push(`perfil ${spec.finish.toLowerCase()}`);
  if (spec.extras?.length) {
    parts.push(`adicionais: ${spec.extras.map((e) => (e.mode === "per_unit" && (e.qty ?? 1) > 1 ? `${e.name} (${e.qty}x)` : e.name)).join(", ")}`);
  }
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
  const extras = sanitizeExtras(raw.extras);
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
    ...(extras.length ? { extras } : {}),
  };
}

/**
 * Troca nome/modo/preço dos adicionais pelos do cadastro da loja (o cliente só escolhe QUAIS e quantas
 * unidades). Adicional que não existe mais no cadastro é descartado.
 */
export function resolveExtrasFromCatalog(extras: PieceExtra[] | undefined, catalog: GlassExtra[]): PieceExtra[] {
  if (!extras?.length) return [];
  const byId = new Map(catalog.map((c) => [c.id, c]));
  const out: PieceExtra[] = [];
  for (const e of extras) {
    const c = byId.get(e.id);
    if (!c) continue;
    out.push({ id: c.id, name: c.name, mode: c.mode, price: Math.max(0, num(c.price)), ...(c.mode === "per_unit" ? { qty: e.qty ?? 1 } : {}) });
  }
  return out;
}

/** Limpa a lista de adicionais vinda do cliente (tamanhos, modos e valores dentro de limites seguros). */
export function sanitizeExtras(raw: any): PieceExtra[] {
  if (!Array.isArray(raw)) return [];
  const out: PieceExtra[] = [];
  for (const e of raw.slice(0, 20)) {
    if (!e || typeof e !== "object") continue;
    const id = typeof e.id === "string" ? e.id.trim().slice(0, 40) : "";
    const name = typeof e.name === "string" ? e.name.trim().slice(0, 60) : "";
    const mode = EXTRA_MODES.find((m) => m.value === e.mode)?.value;
    if (!id || !name || !mode) continue;
    const price = Math.round(Math.min(1_000_000, Math.max(0, num(e.price))) * 100) / 100;
    const qty = Math.min(99, Math.max(1, Math.round(num(e.qty)) || 1));
    out.push({ id, name, mode, price, ...(mode === "per_unit" ? { qty } : {}) });
  }
  return out;
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

/** Valor de UM adicional na peça, conforme o modo de cobrança. */
export function extraAmount(extra: PieceExtra, spec: Pick<PieceSpec, "width_mm" | "height_mm" | "leaves" | "gap_mm" | "waste_pct">): number {
  const price = Math.max(0, num(extra.price));
  const cut = pieceCut(spec);
  switch (extra.mode) {
    case "per_unit": return price * Math.max(1, Math.round(num(extra.qty)) || 1);
    case "per_m2": return price * cut.areaBilled;
    case "per_meter": return price * ((2 * (cut.cutW + cut.cutH)) / 1000);
    default: return price;
  }
}

/** Soma dos adicionais da peça (R$), arredondada a centavos. */
export function pieceExtrasTotal(spec: PieceSpec | null | undefined): number {
  if (!spec?.extras?.length) return 0;
  return Math.round(spec.extras.reduce((sum, e) => sum + extraAmount(e, spec), 0) * 100) / 100;
}

/** Área cobrada em m² considerando sangria e margem de segurança. */
export const pieceBilledAreaM2 = (spec: Pick<PieceSpec, "width_mm" | "height_mm" | "leaves" | "gap_mm" | "waste_pct">) => pieceCut(spec).areaBilled;

/** Área cobrada em m² (largura × altura). */
export const pieceAreaM2 = (spec: Pick<PieceSpec, "width_mm" | "height_mm">) => (num(spec.width_mm) / 1000) * (num(spec.height_mm) / 1000);
