// Paleta padrão de nomes de cor (pt-BR). Uma fonte só para o cadastro de produto (escolher a cor
// pelo nome, sem digitar errado) e para o seletor do PDV (bolinha de cor ao lado do nome).

export interface ColorOption { name: string; hex: string }

export const STANDARD_COLORS: ColorOption[] = [
  { name: "Preto", hex: "#1f2937" },
  { name: "Branco", hex: "#ffffff" },
  { name: "Off White", hex: "#f1ece0" },
  { name: "Cinza", hex: "#9ca3af" },
  { name: "Grafite", hex: "#4b5563" },
  { name: "Prata", hex: "#d1d5db" },
  { name: "Dourado", hex: "#d4af37" },
  { name: "Vermelho", hex: "#dc2626" },
  { name: "Vinho", hex: "#7f1d1d" },
  { name: "Bordô", hex: "#6d1a36" },
  { name: "Rosa", hex: "#f472b6" },
  { name: "Pink", hex: "#ec4899" },
  { name: "Salmão", hex: "#fa8072" },
  { name: "Coral", hex: "#ff7f6e" },
  { name: "Laranja", hex: "#f97316" },
  { name: "Terracota", hex: "#c2410c" },
  { name: "Amarelo", hex: "#facc15" },
  { name: "Mostarda", hex: "#ca8a04" },
  { name: "Bege", hex: "#e7d8c0" },
  { name: "Nude", hex: "#e8c9b0" },
  { name: "Creme", hex: "#f5ecd7" },
  { name: "Caramelo", hex: "#b4783c" },
  { name: "Marrom", hex: "#78350f" },
  { name: "Verde", hex: "#16a34a" },
  { name: "Verde Militar", hex: "#4d5d3a" },
  { name: "Verde Água", hex: "#7dd3c0" },
  { name: "Verde Claro", hex: "#86efac" },
  { name: "Turquesa", hex: "#14b8a6" },
  { name: "Azul", hex: "#2563eb" },
  { name: "Azul Claro", hex: "#7dd3fc" },
  { name: "Azul Royal", hex: "#1d4ed8" },
  { name: "Azul Marinho", hex: "#1e3a8a" },
  { name: "Jeans", hex: "#4a6fa5" },
  { name: "Lilás", hex: "#c4b5fd" },
  { name: "Roxo", hex: "#7c3aed" },
  { name: "Multicolorido", hex: "#d8b4fe" },
];

/** Minúsculas e sem acento — para comparar "azul-marinho", "AZUL MARINHO" e "Azul Marinho" como a mesma cor. */
export function colorKey(input: string): string {
  return input
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
}

const BY_KEY = new Map(STANDARD_COLORS.map((c) => [colorKey(c.name), c]));

/** Cor padrão correspondente ao texto digitado (ignora maiúscula, acento e hífen), ou undefined. */
export function findStandardColor(input: string): ColorOption | undefined {
  return BY_KEY.get(colorKey(input));
}

/** Nome canônico: se for uma cor padrão, devolve o nome certinho ("preto " → "Preto"); senão, Title Case. */
export function normalizeColorName(input: string): string {
  const std = findStandardColor(input);
  if (std) return std.name;
  return input.trim().replace(/\s+/g, " ").toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());
}

/** Código hexadecimal para a bolinha de cor: nome padrão, ou a primeira palavra ("Azul Piscina" → azul). */
export function colorHex(input: string): string | null {
  const exact = findStandardColor(input);
  if (exact) return exact.hex;
  const first = colorKey(input).split(" ")[0];
  return BY_KEY.get(first)?.hex ?? null;
}

/** O atributo é de cor? ("Cor", "Cores", "Color") */
export function isColorAttribute(name: string): boolean {
  return /^(cor|cores|colou?r)$/i.test(colorKey(name));
}
