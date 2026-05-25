import path from "path";

import type { Express } from "express";
import express from "express";

import accountsPayableRoutes from "./accounts-payable.routes";
import accountsReceivableRoutes from "./accounts-receivable.routes";
import authRoutes from "./auth.routes";
import categoriesRoutes from "./categories.routes";
import customersRoutes from "./customers.routes";
import financeRoutes from "./finance.routes";
import ordersRoutes from "./orders.routes";
import productsRoutes from "./products.routes";
import publicRoutes from "./public.routes";
import salesRoutes from "./sales.routes";
import statsRoutes from "./stats.routes";
import suppliersRoutes from "./suppliers.routes";
import superAdminRoutes from "./super-admin.routes";
import tenantRoutes from "./tenant.routes";
import uploadRoutes from "./upload.routes";
import preferencesRoutes from "./preferences.routes";
import quotesRoutes from "./quotes.routes";
import sellersRoutes from "./sellers.routes";

export function registerRoutes(app: Express) {
  // Serve uploaded images
  app.use("/uploads", express.static(path.join(process.cwd(), "public", "uploads")));

  app.use("/api/public", publicRoutes);
  app.use("/api/auth", authRoutes);
  app.use("/api/products", productsRoutes);
  app.use("/api/categories", categoriesRoutes);
  app.use("/api/orders", ordersRoutes);
  app.use("/api/customers", customersRoutes);
  app.use("/api/stats", statsRoutes);
  app.use("/api/sales", salesRoutes);
  app.use("/api/suppliers", suppliersRoutes);
  app.use("/api/finance", financeRoutes);
  app.use("/api/accounts-receivable", accountsReceivableRoutes);
  app.use("/api/accounts-payable", accountsPayableRoutes);
  app.use("/api/tenant", tenantRoutes);
  app.use("/api/upload", uploadRoutes);
  app.use("/api/preferences", preferencesRoutes);
  app.use("/api/quotes",   quotesRoutes);
  app.use("/api/sellers",  sellersRoutes);
  app.use("/api/super-admin", superAdminRoutes);
}
