import path from "path";

import express from "express";
import { createServer as createViteServer } from "vite";

import { createApp } from "./app";
import { env } from "./config/env";
import { seedDefaultTenant } from "./services/seed.service";

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
  app.use(express.static(distPath, { maxAge: "1y", immutable: true }));
  // Never serve index.html for asset requests — return 404 instead
  app.get("/assets/*", (_req, res) => {
    res.status(404).end();
  });
  app.get("*", (_req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

export async function startServer() {
  await seedDefaultTenant();

  const app = createApp();
  await attachFrontend(app);

  app.listen(env.port, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${env.port}`);
  });
}
