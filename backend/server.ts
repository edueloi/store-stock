import fs from "fs";
import http from "http";
import path from "path";

import express from "express";
import { createServer as createViteServer } from "vite";

import { createApp } from "./app";
import { env } from "./config/env";
import { seedDefaultTenant } from "./services/seed.service";
import { startWhatsappMaintenanceLoop, startFinanceAlertsLoop } from "./services/whatsapp.service";
import { startPointsReminderLoop } from "./services/loyalty-notifications.service";
import { startPushNotificationsLoop } from "./services/push-notifications.service";
import { startPlatformBillingSuspensionLoop } from "./services/billing/platform-billing-suspension.service";
import { startEmailReportsCron } from "./services/email-reports.service";
import { startQuoteExpirationLoop } from "./controllers/quotes.controller";
import { initStoreSeoTemplate, handleProductSeo } from "./controllers/store-seo.controller";
import { initRealtime } from "./services/realtime.service";

async function attachFrontend(app: express.Express) {
  if (env.nodeEnv !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });

    app.use(vite.middlewares);
    return;
  }

  const distPath = path.join(process.cwd(), "dist");
  // O SW e toda página HTML precisam ser sempre revalidados — 1 ano de cache
  // imutável nesses arquivos
  // é o que fazia o Safari (e às vezes outros navegadores) nunca buscar a
  // versão nova do Service Worker mesmo com registration.update() forçado no
  // foco da aba: o cache HTTP intercepta o request antes de chegar no
  // servidor. setHeaders roda pra CADA arquivo servido pelo static, então dá
  // pra sobrescrever seletivamente sem duplicar a config em duas rotas.
  app.use(express.static(distPath, {
    maxAge: "1y",
    immutable: true,
    setHeaders: (res, filePath) => {
      if (/\.html$/.test(filePath) || /(^|\/)(sw\.js|sw\.mjs|app-manifest\.json|pdv-manifest\.json|manifest\.webmanifest|registerSW\.js)$/.test(filePath)) {
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      }
    },
  }));
  // Never serve index.html for asset requests — return 404 instead
  app.get("/assets/*", (_req, res) => {
    res.status(404).end();
  });

  const indexHtmlPath = path.join(distPath, "index.html");
  initStoreSeoTemplate(fs.readFileSync(indexHtmlPath, "utf-8"));
  app.get("/produto/:productId", handleProductSeo);
  app.get("/s/:slug/produto/:productId", handleProductSeo);

  app.get("*", (_req, res) => {
    // index.html referencia os assets com hash do build atual — nunca pode
    // ficar em cache, senão o navegador reabre uma versão antiga que aponta
    // pra arquivos JS/CSS que o deploy seguinte já apagou.
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.sendFile(indexHtmlPath);
  });
}

export async function startServer() {
  await seedDefaultTenant();
  startWhatsappMaintenanceLoop();
  startFinanceAlertsLoop();
  startPointsReminderLoop();
  startQuoteExpirationLoop();
  startPushNotificationsLoop();
  startPlatformBillingSuspensionLoop();
  startEmailReportsCron();

  const app = createApp();
  await attachFrontend(app);

  const httpServer = http.createServer(app);
  initRealtime(httpServer);

  httpServer.listen(env.port, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${env.port}`);
  });
}
