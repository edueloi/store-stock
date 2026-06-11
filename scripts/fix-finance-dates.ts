import { prisma } from "../backend/config/prisma";

async function main() {
  const before = await prisma.finance.count();
  console.log(`Total de registros: ${before}`);

  const sample = await prisma.finance.findMany({
    take: 5,
    orderBy: { id: "asc" },
    select: { id: true, date: true, description: true },
  });
  console.log("\nAmostra ANTES:");
  sample.forEach((r) => console.log(`  id=${r.id} | ${r.date.toISOString().split("T")[0]} | ${r.description}`));

  const result = await prisma.$executeRaw`
    UPDATE finance SET date = DATE_ADD(date, INTERVAL 1 DAY)
  `;
  console.log(`\nRegistros atualizados: ${result}`);

  const sampleAfter = await prisma.finance.findMany({
    where: { id: { in: sample.map((r) => r.id) } },
    orderBy: { id: "asc" },
    select: { id: true, date: true, description: true },
  });
  console.log("\nAmostra DEPOIS:");
  sampleAfter.forEach((r) => console.log(`  id=${r.id} | ${r.date.toISOString().split("T")[0]} | ${r.description}`));

  console.log("\nConcluído.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
