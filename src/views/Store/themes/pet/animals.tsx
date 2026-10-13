import { Bird, Bone, Cat, Dog, Fish, PawPrint, Rabbit, type LucideIcon } from "lucide-react";
import { norm } from "./lib";

export interface Animal {
  key: string;
  label: string;
  Icon: LucideIcon;
  /** fundo pastel da bolha */
  bg: string;
}

const table: { key: string; label: string; Icon: LucideIcon; bg: string; words: string[] }[] = [
  { key: "dog", label: "cães", Icon: Dog, bg: "#ffdfe0", words: ["cao", "caes", "cachorro", "cachorros", "dog", "filhote", "canino"] },
  { key: "cat", label: "gatos", Icon: Cat, bg: "#d4e9ff", words: ["gato", "gatos", "cat", "felino", "felinos"] },
  { key: "bird", label: "aves", Icon: Bird, bg: "#ffe9a8", words: ["ave", "aves", "passaro", "passaros", "bird", "calopsita", "periquito"] },
  { key: "fish", label: "peixes", Icon: Fish, bg: "#c9f1e8", words: ["peixe", "peixes", "aquario", "aquarios", "fish"] },
  { key: "small", label: "pequenos animais", Icon: Rabbit, bg: "#e6dcff", words: ["coelho", "roedor", "roedores", "hamster", "porquinho", "furao", "pequenos"] },
  { key: "snack", label: "petiscos", Icon: Bone, bg: "#ffd9b8", words: ["petisco", "petiscos", "osso", "ossos", "snack", "racao", "alimento", "alimentos"] },
];
const fallback = { key: "paw", label: "o seu pet", Icon: PawPrint, bg: "#ffdfe0" };

const palette = ["#ffdfe0", "#d4e9ff", "#ffe9a8", "#c9f1e8", "#e6dcff", "#ffd9b8"];

/** Detecta o animal a partir de textos (categoria, nome do produto). */
export function detectAnimal(...texts: (string | undefined)[]): Animal {
  const words = norm(texts.filter(Boolean).join(" ")).split(/[^a-z0-9]+/);
  for (const row of table) if (row.words.some((w) => words.includes(w))) return row;
  return fallback;
}

export const tint = (i: number) => palette[i % palette.length];
