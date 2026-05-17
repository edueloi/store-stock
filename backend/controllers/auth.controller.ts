import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import { env } from "../config/env";
import { prisma } from "../config/prisma";

export async function registerTenant(req: Request, res: Response) {
  const { tenantName, slug, whatsapp, userName, email, password } = req.body;

  try {
    const existingTenant = await prisma.tenant.findUnique({
      where: { slug },
    });

    if (existingTenant) {
      res.status(400).json({ error: "Slug already exists" });
      return;
    }

    const tenant = await prisma.tenant.create({
      data: { name: tenantName, slug, whatsapp },
    });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        tenant_id: tenant.id,
        name: userName,
        email,
        password: hashedPassword,
        role: "admin",
      },
    });

    const token = jwt.sign(
      { userId: user.id, tenantId: tenant.id, role: "admin" },
      env.jwtSecret
    );

    res.json({ token, tenantId: tenant.id });
  } catch {
    res.status(500).json({ error: "Registration failed" });
  }
}

export async function login(req: Request, res: Response) {
  const { email, password } = req.body;

  try {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      res.status(400).json({ error: "User not found" });
      return;
    }

    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      res.status(400).json({ error: "Invalid password" });
      return;
    }

    const token = jwt.sign(
      { userId: user.id, tenantId: user.tenant_id, role: user.role },
      env.jwtSecret
    );

    res.json({
      token,
      user: {
        name: user.name,
        email: user.email,
        role: user.role,
        tenantId: user.tenant_id,
      },
    });
  } catch {
    res.status(500).json({ error: "Login failed" });
  }
}
