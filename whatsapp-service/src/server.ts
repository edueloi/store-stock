import "dotenv/config";
import express from "express";

import { requireInternalToken } from "./authMiddleware";
import routes from "./routes";
import { hydrateFromDisk } from "./sessionManager";

const app = express();
// Mesmo limite do backend principal (ver backend/app.ts) — o PDF em base64 do
// comprovante do PDV passa por aqui de novo (backend principal → este serviço),
// e o limite padrão de 100kb do body-parser rejeitava com 413 nesse segundo salto.
app.use(express.json({ limit: "20mb" }));

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use(requireInternalToken, routes);

const PORT = Number(process.env.PORT ?? 3002);

app.listen(PORT, "127.0.0.1", () => {
  console.log(`store-whatsapp-service listening on 127.0.0.1:${PORT}`);
  void hydrateFromDisk();
});
