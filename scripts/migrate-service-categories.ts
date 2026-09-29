// Passo 2 do plano de migração "categoria de serviço string -> FK":
//   1) migration 20260929170000_add_service_categories já rodou (adiciona
//      ServiceCategory + services.category_id, mantendo services.category antigo).
//   2) ESTE SCRIPT: para cada tenant, cria uma ServiceCategory por valor distinto
//      de services.category já usado por aquele tenant (reaproveitando ícone/cor
//      das 6 categorias fixas do frontend antigo quando o nome bate) e aponta
//      services.category_id para a categoria criada.
//   3) SÓ DEPOIS de confirmar que este script rodou bem em produção: mover
//      prisma/migrations-pending/20260929180000_drop_service_category_string/
//      de volta para prisma/migrations/ e rodar `prisma migrate deploy` —
//      essa migration remove a coluna antiga `services.category`.
//
// Rodar com: npx tsx scripts/migrate-service-categories.ts
import { prisma } from "../backend/config/prisma";

// Mesmo mapeamento de ícone/cor que existia hardcoded em SERVICE_CATEGORIES
// (src/views/Dashboard/Services.tsx) antes desta migração — usado aqui só para
// que as categorias herdadas mantenham a mesma aparência visual que tinham.
const KNOWN_CATEGORY_META: Record<string, { icon: string; color: string }> = {
  "Vidros":                { icon: "layout-panel-top", color: "#2563eb" }, // blue
  "Placas / Sinalização":  { icon: "tag",              color: "#7c3aed" }, // violet
  "Corte / Gravação":      { icon: "scissors",         color: "#d97706" }, // amber
  "Instalação":            { icon: "hammer",           color: "#ea580c" }, // orange
  "Acabamento":            { icon: "wrench",           color: "#059669" }, // emerald
  "Geral":                 { icon: "package",          color: "#64748b" }, // slate
};
const DEFAULT_META = { icon: "wrench", color: "#2563eb" };

async function main() {
  const services = await prisma.service.findMany({
    select: { id: true, tenant_id: true, category: true },
  });

  console.log(`Total de serviços encontrados: ${services.length}`);

  // Agrupa por tenant -> Set de nomes de categoria distintos (string antiga)
  const byTenant = new Map<number, Set<string>>();
  for (const s of services) {
    const catName = (s.category || "Geral").trim() || "Geral";
    if (!byTenant.has(s.tenant_id)) byTenant.set(s.tenant_id, new Set());
    byTenant.get(s.tenant_id)!.add(catName);
  }

  let categoriesCreated = 0;
  let servicesUpdated = 0;

  for (const [tenantId, categoryNames] of byTenant) {
    // Categorias já existentes para este tenant (idempotência — permite rodar
    // o script mais de uma vez sem duplicar).
    const existing = await prisma.serviceCategory.findMany({
      where: { tenant_id: tenantId },
      select: { id: true, name: true },
    });
    const existingByName = new Map(existing.map((c) => [c.name, c.id]));

    for (const name of categoryNames) {
      let categoryId = existingByName.get(name);
      if (!categoryId) {
        const meta = KNOWN_CATEGORY_META[name] ?? DEFAULT_META;
        const created = await prisma.serviceCategory.create({
          data: { tenant_id: tenantId, name, icon: meta.icon, color: meta.color },
        });
        categoryId = created.id;
        existingByName.set(name, categoryId);
        categoriesCreated++;
        console.log(`  [tenant ${tenantId}] categoria criada: "${name}" (id=${categoryId})`);
      }

      const result = await prisma.service.updateMany({
        where: { tenant_id: tenantId, category: name, category_id: null },
        data: { category_id: categoryId },
      });
      servicesUpdated += result.count;
    }
  }

  console.log(`\nCategorias criadas: ${categoriesCreated}`);
  console.log(`Serviços atualizados (category_id preenchido): ${servicesUpdated}`);

  const stillNull = await prisma.service.count({ where: { category_id: null } });
  console.log(`Serviços ainda com category_id nulo: ${stillNull}`);
  if (stillNull > 0) {
    console.warn("ATENÇÃO: existem serviços sem category_id — verifique antes de aplicar a migration de DROP COLUMN.");
  } else {
    console.log("Todos os serviços têm category_id preenchido — seguro aplicar a migration de limpeza (remover coluna `category`).");
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
