import { prisma } from "../config/prisma";

const DEFAULT_LOW_STOCK_THRESHOLD = 5;

// Lê o limiar de "estoque baixo" configurado pelo usuário em Configurações
// (Preferências do Painel). É uma preferência por usuário, não por tenant —
// mesma dono da chave "low_stock_alert" usada em Settings.tsx.
export async function getLowStockThreshold(userId: number): Promise<number> {
  const pref = await prisma.userPreference.findUnique({
    where: { user_id_pref_key: { user_id: userId, pref_key: "low_stock_alert" } },
  });
  const value = Number(pref?.value);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_LOW_STOCK_THRESHOLD;
}
