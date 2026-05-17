import { Router } from "express";

import {
  getOrderById,
  listOrders,
  updateOrderStatus,
} from "../controllers/orders.controller";
import { authenticateToken } from "../middlewares/auth.middleware";

const router = Router();

router.use(authenticateToken);

router.get("/", listOrders);
router.get("/:id", getOrderById);
router.put("/:id/status", updateOrderStatus);

export default router;
