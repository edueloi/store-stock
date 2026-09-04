// Migração pontual: criptografa nfce_cert_password e nfce_csc_token que ainda
// estão em texto puro no banco (gravados antes da introdução de secretCrypto).
// Idempotente — só reescreve valores que ainda não têm o prefixo "v1:", então
// pode ser rodado mais de uma vez sem dano.
//
// Uso: npx tsx scripts/encrypt-fiscal-secrets.ts

import { prisma } from "../backend/config/prisma";
import { encryptSecret } from "../backend/utils/secretCrypto";

async function main() {
  const tenants = await prisma.tenant.findMany({
    where: {
      OR: [
        { nfce_cert_password: { not: null } },
        { nfce_csc_token: { not: null } },
      ],
    },
    select: { id: true, name: true, nfce_cert_password: true, nfce_csc_token: true },
  });

  let updated = 0;
  for (const t of tenants) {
    const data: { nfce_cert_password?: string; nfce_csc_token?: string } = {};

    if (t.nfce_cert_password && !t.nfce_cert_password.startsWith("v1:")) {
      data.nfce_cert_password = encryptSecret(t.nfce_cert_password);
    }
    if (t.nfce_csc_token && !t.nfce_csc_token.startsWith("v1:")) {
      data.nfce_csc_token = encryptSecret(t.nfce_csc_token);
    }

    if (Object.keys(data).length > 0) {
      await prisma.tenant.update({ where: { id: t.id }, data });
      console.log(`  tenant ${t.id} (${t.name}): ${Object.keys(data).join(", ")} criptografado(s)`);
      updated++;
    }
  }

  console.log(`\nConcluído: ${updated} tenant(s) atualizado(s) de ${tenants.length} com segredo fiscal configurado.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
