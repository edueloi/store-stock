import bcrypt from "bcryptjs";

import { prisma } from "../config/prisma";

export async function seedDefaultTenant() {
  const demoTenant = await prisma.tenant.findUnique({
    where: { slug: "demo" },
  });

  if (demoTenant) {
    return;
  }

  const tenant = await prisma.tenant.create({
    data: {
      name: "Nexus Demo",
      slug: "demo",
      whatsapp: "5511999999999",
    },
  });

  await prisma.category.createMany({
    data: [
      { tenant_id: tenant.id, name: "Eletrônicos" },
      { tenant_id: tenant.id, name: "Vestuário" },
      { tenant_id: tenant.id, name: "Cosméticos" },
      { tenant_id: tenant.id, name: "Acessórios" },
    ],
  });

  const hashedPassword = await bcrypt.hash("admin123", 10);

  await prisma.user.create({
    data: {
      tenant_id: tenant.id,
      name: "Demo Admin",
      email: "admin@nexus.com",
      password: hashedPassword,
      role: "admin",
    },
  });
}
