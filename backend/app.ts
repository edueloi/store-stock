import cors from "cors";
import express from "express";

import { registerRoutes } from "./routes";

export function createApp() {
  const app = express();

  app.set("trust proxy", true);
  app.use(cors());
  // Limite padrão do body-parser é 100kb — pequeno demais pro PDF em base64 enviado
  // pelo botão "Enviar PDF" do WhatsApp (comprovante renderizado em imagem via
  // html2canvas facilmente passa de alguns MB).
  app.use(express.json({ limit: "20mb" }));

  registerRoutes(app);

  return app;
}
