import { PIECE_KINDS, sanitizePieceSpec, type PieceSpec } from "./glassPieces";
/** As medidas ficam nas opções do item e acompanham sua conversão em venda. */
export function glassSpecFromOptions(options: Record<string, string> | null | undefined): PieceSpec | null {
  if (!options) return null;
  const kind = PIECE_KINDS.find(k => k.label === options["Modelo da peça"])?.value;
  return sanitizePieceSpec({ kind, width_mm: options["Largura (mm)"], height_mm: options["Altura (mm)"], leaves: options.Folhas, notes: options["Observações da peça"] });
}
