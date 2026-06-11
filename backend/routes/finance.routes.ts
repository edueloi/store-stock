import { Router } from "express";

import {
  createFinanceEntry,
  listFinanceEntries,
  updateFinanceEntry,
  deleteFinanceEntry,
  deleteManyFinanceEntries,
} from "../controllers/finance.controller";
import { authenticateToken } from "../middlewares/auth.middleware";

const router = Router();

router.use(authenticateToken);

router.get("/", listFinanceEntries);
router.post("/", createFinanceEntry);
router.put("/:id", updateFinanceEntry);
router.delete("/bulk", deleteManyFinanceEntries);
router.delete("/:id", deleteFinanceEntry);

export default router;
