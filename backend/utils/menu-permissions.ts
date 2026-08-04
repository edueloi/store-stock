// Catálogo de menus/telas do painel admin, usado para a permissão individual por
// usuário (UserMenuPermission). Deve espelhar as chaves de menuGroups em
// src/views/Dashboard/AdminDashboard.tsx — ao adicionar um item de menu lá, adicionar
// a chave correspondente aqui.

export const MENU_KEYS = [
  "dashboard",
  "pdv",
  "finance",
  "orders",
  "notas_fiscais",
  "maquininhas",
  "orcamentos",
  "ordens_servico",
  "fluxo_producao",
  "consignacoes",
  "catalog",
  "stock",
  "markup",
  "etiquetas",
  "categories",
  "suppliers",
  "contas_receber",
  "contas_pagar",
  "metas",
  "analytics",
  "customers",
  "vendedores",
  "tecnicos",
  "servicos",
  "loyalty",
  "whatsapp",
  "settings",
] as const;

export type MenuKey = (typeof MENU_KEYS)[number];

export const MENU_LABELS: Record<MenuKey, string> = {
  dashboard: "Visão Geral",
  pdv: "PDV — Caixa",
  finance: "Fluxo de Caixa",
  orders: "Pedidos",
  notas_fiscais: "Notas Fiscais",
  maquininhas: "Maquininhas",
  orcamentos: "Orçamentos",
  ordens_servico: "Ordens de Serviço",
  fluxo_producao: "Fluxo de Produção",
  consignacoes: "Consignação",
  catalog: "Catálogo",
  stock: "Estoque",
  markup: "Markup",
  etiquetas: "Etiquetas",
  categories: "Categorias",
  suppliers: "Fornecedores",
  contas_receber: "Contas a Receber",
  contas_pagar: "Contas a Pagar",
  metas: "Metas",
  analytics: "Relatórios",
  customers: "Clientes",
  vendedores: "Vendedores",
  tecnicos: "Técnicos",
  servicos: "Serviços",
  loyalty: "Fidelidade",
  whatsapp: "WhatsApp",
  settings: "Configurações",
};

export function isMenuKey(value: string): value is MenuKey {
  return (MENU_KEYS as readonly string[]).includes(value);
}
