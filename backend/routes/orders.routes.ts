import { Router } from "express";

import {
  getOrderById,
  listOrders,
  updateOrderStatus,
  cancelOrder,
  deleteOrder,
  bulkDeleteOrders,
} from "../controllers/orders.controller";
import { authenticateToken } from "../middlewares/auth.middleware";

const router = Router();

router.use(authenticateToken);

router.get("/", listOrders);
router.delete("/bulk", bulkDeleteOrders);
router.get("/:id", getOrderById);
router.put("/:id/status", updateOrderStatus);
router.post("/:id/cancel", cancelOrder);
router.delete("/:id", deleteOrder);

export default router;
