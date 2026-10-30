// Modelos prontos de variação (tamanhos, cores etc.). Cada loja pode editar, esconder e criar os seus
// (guardados em /api/products/variation-presets); aqui ficam os de fábrica.

export interface PresetVariation { name: string; options: string[]; colors?: Record<string, string> }
export interface VariationPreset { id?: string; label: string; icon: string; variations: PresetVariation[] }

const norm = (v: string) => v.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** Cores comuns de loja → hexadecimal, para os modelos já abrirem com as bolinhas de cor preenchidas. */
export const COLOR_HEX: Record<string, string> = {
  preto: "#111111", branco: "#ffffff", cinza: "#9ca3af", "cinza claro": "#d1d5db", "cinza escuro": "#4b5563", chumbo: "#374151",
  azul: "#2563eb", "azul marinho": "#1e3a8a", "azul claro": "#7dd3fc", "azul royal": "#1d4ed8", turquesa: "#14b8a6", "verde agua": "#6ee7b7",
  vermelho: "#dc2626", vinho: "#7f1d1d", bordo: "#7f1d1d", rosa: "#f472b6", "rosa claro": "#fbcfe8", pink: "#ec4899", rose: "#e8a0a0",
  amarelo: "#facc15", mostarda: "#ca8a04", laranja: "#f97316", coral: "#fb7185", verde: "#16a34a", "verde militar": "#4d5d3a", "verde claro": "#86efac",
  "verde escuro": "#14532d", roxo: "#7c3aed", lilas: "#c4b5fd", violeta: "#8b5cf6", marrom: "#78350f", caramelo: "#b45309", bege: "#d6c3a3",
  nude: "#e8c9b0", creme: "#fdf3d7", off: "#f5f1e8", "off white": "#f5f1e8", dourado: "#d4af37", prata: "#c0c0c0", prateado: "#c0c0c0",
  tartaruga: "#92400e", cobre: "#b87333", grafite: "#3f3f46", jeans: "#3b5a82",
};
export const colorHex = (name: string) => COLOR_HEX[norm(name)];
export const isColorAttr = (name: string) => /^(cor|cores|colou?r)(|$)/i.test(norm(name));

/** Preenche as cores de qualquer atributo "Cor" que ainda não traga as suas. */
export function withColors(p: VariationPreset): VariationPreset {
  return {
    ...p,
    variations: p.variations.map((v) => {
      if (!isColorAttr(v.name) || v.colors) return v;
      const colors: Record<string, string> = {};
      v.options.forEach((o) => { const h = colorHex(o); if (h) colors[o] = h; });
      return Object.keys(colors).length ? { ...v, colors } : v;
    }),
  };
}

const BASE_PRESETS: VariationPreset[] = [
  {
    label: "Roupas", icon: "👕",
    variations: [
      { name: "Tamanho", options: ["PP", "P", "M", "G", "GG", "XGG"] },
      { name: "Cor", options: ["Preto", "Branco", "Cinza", "Azul", "Vermelho"] },
    ],
  },
  {
    label: "Calçados", icon: "👟",
    variations: [
      { name: "Número", options: ["34", "35", "36", "37", "38", "39", "40", "41", "42", "43", "44"] },
      { name: "Cor", options: ["Preto", "Branco", "Marrom", "Bege"] },
    ],
  },
  {
    label: "Eletrônicos", icon: "🔌",
    variations: [
      { name: "Voltagem", options: ["110V", "220V", "Bivolt"] },
      { name: "Cor", options: ["Preto", "Branco", "Prata"] },
    ],
  },
  {
    label: "Acessórios", icon: "💍",
    variations: [
      { name: "Tamanho", options: ["P", "M", "G", "Único"] },
      { name: "Material", options: ["Ouro", "Prata", "Aço", "Couro"] },
    ],
  },
  {
    label: "Moda íntima", icon: "🩲",
    variations: [
      { name: "Tamanho", options: ["PP", "P", "M", "G", "GG", "XGG"] },
      { name: "Cor", options: ["Preto", "Branco", "Nude", "Vermelho"] },
    ],
  },
  {
    label: "Moda infantil", icon: "🧒",
    variations: [
      { name: "Idade", options: ["0–3 meses", "3–6 meses", "1 ano", "2 anos", "4 anos", "6 anos", "8 anos"] },
      { name: "Cor", options: ["Azul", "Rosa", "Amarelo", "Verde"] },
    ],
  },
  {
    label: "Jeans", icon: "👖",
    variations: [
      { name: "Tamanho", options: ["34", "36", "38", "40", "42", "44", "46", "48"] },
      { name: "Lavagem", options: ["Claro", "Médio", "Escuro"] },
    ],
  },
  {
    label: "Bolsas", icon: "👜",
    variations: [
      { name: "Cor", options: ["Preto", "Caramelo", "Marrom", "Bege", "Vinho"] },
      { name: "Material", options: ["Couro", "Sintético", "Lona"] },
    ],
  },
  {
    label: "Joias", icon: "💎",
    variations: [
      { name: "Banho", options: ["Dourado", "Prateado", "Rosé"] },
      { name: "Tamanho", options: ["P", "M", "G", "Único"] },
    ],
  },
  {
    label: "Óculos", icon: "🕶️",
    variations: [
      { name: "Cor da armação", options: ["Preto", "Tartaruga", "Dourado", "Prata"] },
      { name: "Lente", options: ["Preta", "Marrom", "Degradê"] },
    ],
  },
  {
    label: "Relógios", icon: "⌚",
    variations: [
      { name: "Cor", options: ["Preto", "Prata", "Dourado", "Rosé"] },
      { name: "Pulseira", options: ["Metal", "Couro", "Silicone"] },
    ],
  },
  {
    label: "Perfumaria", icon: "🌸",
    variations: [
      { name: "Volume", options: ["30ml", "50ml", "75ml", "100ml", "150ml"] },
    ],
  },
  {
    label: "Alimentos", icon: "🥩",
    variations: [
      { name: "Peso", options: ["250g", "500g", "1kg", "2kg", "5kg"] },
      { name: "Sabor", options: ["Natural", "Com Sal", "Sem Sal"] },
    ],
  },
  {
    label: "Doceria", icon: "🍬",
    variations: [
      { name: "Apresentação", options: ["A granel", "Pote", "Caixa"] },
      { name: "Peso", options: ["500g", "800g", "1kg", "1,1kg", "1,2kg", "1,5kg"] },
    ],
  },
  {
    label: "Agro", icon: "🌱",
    variations: [
      { name: "Embalagem", options: ["1L", "5L", "10L", "20L", "50L"] },
      { name: "Formulação", options: ["Líquido", "Pó", "Grânulo"] },
    ],
  },
  {
    label: "Higiene", icon: "🧴",
    variations: [
      { name: "Volume", options: ["200ml", "400ml", "1L"] },
      { name: "Tipo", options: ["Normal", "Seco", "Oleoso", "Misto"] },
    ],
  },
  {
    label: "Cosméticos", icon: "💄",
    variations: [
      { name: "Cor", options: ["Claro", "Médio", "Escuro", "Vermelho", "Rosa"] },
      { name: "Volume", options: ["10ml", "30ml", "50ml"] },
    ],
  },
  {
    label: "Casa & decoração", icon: "🏠",
    variations: [
      { name: "Tamanho", options: ["P", "M", "G", "Único"] },
      { name: "Cor", options: ["Branco", "Preto", "Bege", "Cinza"] },
    ],
  },
  {
    label: "Pet", icon: "🐾",
    variations: [
      { name: "Porte", options: ["Pequeno", "Médio", "Grande"] },
      { name: "Cor", options: ["Azul", "Rosa", "Preto", "Vermelho"] },
    ],
  },
  {
    label: "Ferramentas", icon: "🛠️",
    variations: [
      { name: "Voltagem", options: ["110V", "220V", "Bivolt"] },
      { name: "Kit", options: ["Individual", "Kit 2", "Kit 5"] },
    ],
  },
  {
    label: "Games", icon: "🎮",
    variations: [
      { name: "Plataforma", options: ["PS5", "Xbox", "Nintendo", "PC"] },
      { name: "Edição", options: ["Padrão", "Deluxe", "Colecionador"] },
    ],
  },
  {
    label: "Papelaria", icon: "✏️",
    variations: [
      { name: "Formato", options: ["A4", "A5", "Universitário"] },
      { name: "Cor", options: ["Azul", "Rosa", "Preto", "Verde"] },
    ],
  },
];


const SIZES_LETTER = ["PP", "P", "M", "G", "GG", "XGG"];
const SIZES_NUM = ["34", "36", "38", "40", "42", "44", "46", "48"];
const COLORS_FASHION = ["Preto", "Branco", "Cinza", "Azul Marinho", "Azul", "Vermelho", "Vinho", "Rosa", "Verde", "Bege", "Marrom"];

const EXTRA_PRESETS: VariationPreset[] = [
  { label: "Cores básicas", icon: "🎨", variations: [{ name: "Cor", options: ["Preto", "Branco", "Cinza", "Azul", "Vermelho", "Verde", "Amarelo", "Rosa", "Marrom", "Bege"] }] },
  { label: "Cores completas", icon: "🌈", variations: [{ name: "Cor", options: ["Preto", "Branco", "Cinza Claro", "Cinza Escuro", "Azul Marinho", "Azul Royal", "Azul Claro", "Turquesa", "Verde", "Verde Militar", "Verde Claro", "Amarelo", "Mostarda", "Laranja", "Coral", "Vermelho", "Vinho", "Rosa", "Pink", "Lilás", "Roxo", "Marrom", "Caramelo", "Bege", "Nude", "Off White", "Dourado", "Prata"] }] },
  { label: "Camisetas", icon: "👕", variations: [{ name: "Tamanho", options: SIZES_LETTER }, { name: "Cor", options: COLORS_FASHION }] },
  { label: "Camisas e blusas", icon: "👔", variations: [{ name: "Tamanho", options: ["P", "M", "G", "GG", "XGG"] }, { name: "Cor", options: ["Branco", "Preto", "Azul", "Azul Claro", "Rosa", "Verde", "Bege"] }] },
  { label: "Shorts e bermudas", icon: "🩳", variations: [{ name: "Tamanho", options: SIZES_NUM }, { name: "Cor", options: ["Preto", "Branco", "Azul Marinho", "Cinza", "Bege", "Verde Militar", "Jeans"] }] },
  { label: "Calças", icon: "👖", variations: [{ name: "Tamanho", options: SIZES_NUM }, { name: "Cor", options: ["Preto", "Azul Marinho", "Cinza", "Bege", "Verde Militar", "Jeans"] }] },
  { label: "Saias", icon: "💃", variations: [{ name: "Tamanho", options: ["PP", "P", "M", "G", "GG"] }, { name: "Cor", options: ["Preto", "Branco", "Vermelho", "Rosa", "Azul", "Bege", "Estampada"] }] },
  { label: "Vestidos", icon: "👗", variations: [{ name: "Tamanho", options: SIZES_LETTER }, { name: "Cor", options: ["Preto", "Branco", "Vermelho", "Vinho", "Rosa", "Azul", "Verde", "Nude", "Estampado"] }] },
  { label: "Bolsas e mochilas", icon: "👜", variations: [{ name: "Tamanho", options: ["Mini", "Pequena", "Média", "Grande"] }, { name: "Cor", options: ["Preto", "Caramelo", "Marrom", "Bege", "Vinho", "Branco", "Rosa"] }] },
  { label: "Cintos e bonés", icon: "🧢", variations: [{ name: "Tamanho", options: ["P", "M", "G", "Único"] }, { name: "Cor", options: ["Preto", "Marrom", "Branco", "Azul Marinho", "Bege"] }] },
  { label: "Meias", icon: "🧦", variations: [{ name: "Tamanho", options: ["34-37", "38-41", "42-44"] }, { name: "Cor", options: ["Preto", "Branco", "Cinza", "Azul Marinho"] }] },
  { label: "Lençóis e cama", icon: "🛏️", variations: [{ name: "Tamanho", options: ["Solteiro", "Casal", "Queen", "King"] }, { name: "Cor", options: ["Branco", "Cinza", "Bege", "Azul", "Rosa"] }] },
];

/** Modelos de fábrica: os novos vêm primeiro, depois os de segmento que já existiam. */
export const VARIATION_PRESETS: VariationPreset[] = [...EXTRA_PRESETS, ...BASE_PRESETS].map(withColors);
