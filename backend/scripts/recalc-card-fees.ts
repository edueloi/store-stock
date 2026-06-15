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
 *   - base    = gross_amount - discount_amount (valor efetivamente pago)
 *   - fee     = base * rate/100, arredondado a 2 casas
 *   - net     = gross - desconto - fee
 *
 * Atualiza fee_amount e total_amount (orders) e fee_amount/amount (finance).
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

const round2 = (n: number) => Math.round(n * 100) / 100;

// Taxa sobre o valor PAGO (gross - desconto). Usa o seg.amount embutido se
// houver; senão rateia a base entre os segmentos (a maioria tem 1 só).
function computeFee(pm: string, gross: number, discount: number, cardFees: Record<string, number[]>) {
  const segs = parsePaymentMethod(pm);
  const factor = gross > 0 ? Math.max(0, (gross - discount) / gross) : 1;
  const totalSeg = segs.reduce((s, x) => s + x.amount, 0);
  const fee = segs.reduce((sum, seg) => {
    const rawBase = seg.amount > 0 ? seg.amount : (totalSeg <= 0 ? gross : 0);
    return sum + rawBase * factor * (rateFor(seg, cardFees) / 100);
  }, 0);
  return round2(fee);
}

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
    select: { id: true, total_amount: true, gross_amount: true, discount_amount: true, fee_amount: true, payment_method: true },
    orderBy: { id: "asc" },
  });

  let changed = 0;
  for (const o of orders) {
    const pm = o.payment_method!;
    // pula vendas só em dinheiro
    if (!/credit|debit|pix/.test(pm)) continue;

    // base = gross - desconto (o que o cliente efetivamente pagou)
    const gross    = o.gross_amount != null ? Number(o.gross_amount) : Number(o.total_amount);
    const discount = o.discount_amount != null ? Number(o.discount_amount) : 0;

    const newFee = computeFee(pm, gross, discount, cardFees);
    const oldFee = o.fee_amount != null ? Number(o.fee_amount) : 0;

    // net correto = gross - desconto - taxa
    const newNet = round2(gross - discount - newFee);

    const fin = await prisma.finance.findFirst({
      where: { tenant_id: tenantId, description: { contains: `Venda PDV #${o.id} ` } },
      select: { id: true, amount: true, description: true, fee_amount: true },
    });
    const oldNet = fin ? Number(fin.amount) : Number(o.total_amount);

    // pula se já está tudo correto
    if (round2(newFee) === round2(oldFee) && round2(newNet) === round2(oldNet)) continue;

    changed++;
    console.log(
      `#${o.id}  ${pm}  (gross ${gross.toFixed(2)} - desc ${discount.toFixed(2)})\n` +
      `   fee: R$ ${oldFee.toFixed(2)} -> R$ ${newFee.toFixed(2)}` +
      `   |   net: R$ ${oldNet.toFixed(2)} -> R$ ${newNet.toFixed(2)}`,
    );

    if (apply) {
      await prisma.order.update({
        where: { id: o.id },
        data: { fee_amount: newFee > 0 ? newFee : null, total_amount: newNet },
      });
      if (fin) {
        await prisma.finance.update({
          where: { id: fin.id },
          data: { fee_amount: newFee > 0 ? newFee : null, amount: newNet },
        });
      }
    }
  }

  console.log(`\n${changed} venda(s) ${apply ? "atualizada(s)" : "seriam atualizadas"}.`);
  if (!apply && changed > 0) console.log("Rode novamente com --apply para gravar.");
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
