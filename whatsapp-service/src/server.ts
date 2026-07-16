import "dotenv/config";
import express from "express";

import { requireInternalToken } from "./authMiddleware";
import routes from "./routes";
import { hydrateFromDisk } from "./sessionManager";

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use(requireInternalToken, routes);

const PORT = Number(process.env.PORT ?? 3002);

app.listen(PORT, "127.0.0.1", () => {
  console.log(`store-whatsapp-service listening on 127.0.0.1:${PORT}`);
  void hydrateFromDisk();
});
