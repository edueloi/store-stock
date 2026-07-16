import { Router } from "express";

import {
  getConfig,
  saveConfig,
  pingTerminal,
  charge,
  getTransaction,
  cancelTransaction,
  listTransactions,
} from "../controllers/terminal.controller";
import { authenticateToken } from "../middlewares/auth.middleware";

const router = Router();

router.use(authenticateToken);

router.get("/config", getConfig);
router.put("/config", saveConfig);
router.post("/ping", pingTerminal);
router.post("/charge", charge);
router.get("/transactions", listTransactions);
router.get("/transactions/:id", getTransaction);
router.delete("/transactions/:id", cancelTransaction);

export default router;
