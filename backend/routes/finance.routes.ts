import { Router } from "express";

import {
  createFinanceEntry,
  listFinanceEntries,
} from "../controllers/finance.controller";
import { authenticateToken } from "../middlewares/auth.middleware";

const router = Router();

router.use(authenticateToken);

router.get("/", listFinanceEntries);
router.post("/", createFinanceEntry);

export default router;
