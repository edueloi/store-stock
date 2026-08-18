import { Router } from "express";

import {
  cancelHeldSale,
  createHeldSale,
  getHeldSaleById,
  getOpenHeldSalesCount,
  listHeldSales,
  resumeHeldSale,
} from "../controllers/held-sales.controller";
import { authenticateToken } from "../middlewares/auth.middleware";

const router = Router();

router.use(authenticateToken);

router.get("/open-count", getOpenHeldSalesCount);
router.get("/", listHeldSales);
router.get("/:id", getHeldSaleById);
router.post("/", createHeldSale);
router.post("/:id/resume", resumeHeldSale);
router.post("/:id/cancel", cancelHeldSale);

export default router;
