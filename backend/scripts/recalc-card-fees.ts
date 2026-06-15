/**
 * Recalcula fee_amount (e o net `amount` em Finance) das vendas JÁ registradas
 * usando as taxas ATUAIS por bandeira (card_fees do tenant).
 *
 * Por que existe: a taxa da maquininha é congelada no momento da venda
 * (sales.controller.ts). Se as taxas por bandeira foram corrigidas depois
 * (ex.: ELO débito 0.8% -> 1.6%), vendas antigas continuam com o valor antigo.
 * Este script reaplica a regra de cálculo do backend sobre os dados existentes.
 *
 * Uso:
 *   npx tsx backend/scripts/recalc-card-fees.ts <tenantId>            # dry-run (só mostra)
 *   npx tsx backend/scripts/recalc-card-fees.ts <tenantId> --apply    # grava as mudanças
 *
 * A regra replica sales.controller.ts:
 *   - credit: rate = card_fees[brand][installments-1]
 *   - debit:  rate = card_fees["debit_" + brand][0]
 *   - pix:    rate = card_fees["pix"][0]
 *   - fee     = soma(amount * rate/100), arredondado a 2 casas
 *   - net     = total_amount - feeAbsorvida
 *
 * Vendas com taxa REPASSADA ao cliente (descrição da Finance contém
 * "taxa repassada") têm o net = total_amount (loja não absorve). Para essas,
 * só atualizamos o fee_amount informativo, sem mexer no net.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function parsePaymentMethod(pm: string) {
  return pm.split("|").map((seg) => {
    const [methodPart, amountStr] = seg.split(":");
    const tokens = methodPart.split("-");
    return {
      method:       tokens[0] ?? "money",
      brand:        tokens[1] ?? "other",
      installments: tokens[2] ? parseInt(tokens[2].replace("x", ""), 10) : 1,
      amount:       parseFloat(amountStr ?? "0") || 0,
    };
  });
}

function rateFor(seg: ReturnType<typeof parsePaymentMethod>[number], cardFees: Record<string, number[]>) {
  if (seg.method === "credit") return cardFees[seg.brand]?.[seg.installments - 1] ?? 0;
  if (seg.method === "debit")  return cardFees[`debit_${seg.brand}`]?.[0] ?? 0;
  if (seg.method === "pix")    return cardFees["pix"]?.[0] ?? 0;
  return 0;
}

function computeFee(pm: string, cardFees: Record<string, number[]>) {
  const fee = parsePaymentMethod(pm).reduce((sum, seg) => {
    if (seg.amount <= 0) return sum;
    return sum + seg.amount * (rateFor(seg, cardFees) / 100);
  }, 0);
  return Math.round(fee * 100) / 100;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

async function main() {
  const tenantId = Number(process.argv[2]);
  const apply    = process.argv.includes("--apply");
  if (!tenantId) {
    console.error("Uso: npx tsx backend/scripts/recalc-card-fees.ts <tenantId> [--apply]");
    process.exit(1);
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, name: true, card_fees: true },
  });
  if (!tenant) { console.error(`Tenant ${tenantId} não encontrado.`); process.exit(1); }

  const cardFees = (tenant.card_fees ?? {}) as Record<string, number[]>;
  console.log(`\nTenant: ${tenant.name} (#${tenant.id})  —  modo: ${apply ? "APLICAR" : "DRY-RUN"}`);
  console.log("Taxas débito atuais:",
    Object.fromEntries(Object.entries(cardFees).filter(([k]) => k.startsWith("debit_"))));
  console.log("");

  const orders = await prisma.order.findMany({
    where: { tenant_id: tenantId, status: "completed", payment_method: { not: null } },
    select: { id: true, total_amount: true, fee_amount: true, payment_method: true },
    orderBy: { id: "asc" },
  });

  let changed = 0;
  for (const o of orders) {
    const pm = o.payment_method!;
    // pula vendas só em dinheiro
    if (!/credit|debit|pix/.test(pm)) continue;

    const newFee = computeFee(pm, cardFees);
    const oldFee = o.fee_amount != null ? Number(o.fee_amount) : 0;
    if (round2(newFee) === round2(oldFee)) continue;

    // descobre se a taxa foi repassada ao cliente (Finance descreve isso)
    const fin = await prisma.finance.findFirst({
      where: { tenant_id: tenantId, description: { contains: `Venda PDV #${o.id} ` } },
      select: { id: true, amount: true, description: true, fee_amount: true },
    });
    const passed = !!fin?.description?.includes("taxa repassada");

    // net da loja: se repassada, loja absorve 0; senão absorve o fee novo
    const total       = Number(o.total_amount);
    const absorbedFee = passed ? 0 : newFee;
    const newNet      = round2(total - absorbedFee);

    changed++;
    console.log(
      `#${o.id}  ${pm}\n` +
      `   fee: R$ ${oldFee.toFixed(2)} -> R$ ${newFee.toFixed(2)}` +
      (passed ? "  (repassada — net inalterado)" : `   |   net: R$ ${Number(fin?.amount ?? 0).toFixed(2)} -> R$ ${newNet.toFixed(2)}`),
    );

    if (apply) {
      await prisma.order.update({
        where: { id: o.id },
        data: { fee_amount: newFee > 0 ? newFee : null },
      });
      if (fin) {
        await prisma.finance.update({
          where: { id: fin.id },
          data: {
            fee_amount: newFee > 0 ? newFee : null,
            ...(passed ? {} : { amount: newNet }),
          },
        });
      }
    }
  }

  console.log(`\n${changed} venda(s) ${apply ? "atualizada(s)" : "seriam atualizadas"}.`);
  if (!apply && changed > 0) console.log("Rode novamente com --apply para gravar.");
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
