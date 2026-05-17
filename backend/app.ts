import cors from "cors";
import express from "express";

import { registerRoutes } from "./routes";

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  registerRoutes(app);

  return app;
}
