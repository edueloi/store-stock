import { Router } from "express";

import {
  getOrderById,
  getOrderActions,
  listOrders,
  searchOrders,
  updateOrderStatus,
  updateOrderDocument,
  cancelOrder,
  deleteOrder,
  bulkDeleteOrders,
  createOrderReturn,
  listOrderReturns,
} from "../controllers/orders.controller";
import { authenticateToken } from "../middlewares/auth.middleware";

const router = Router();

router.use(authenticateToken);

router.get("/", listOrders);
router.get("/search", searchOrders);
router.delete("/bulk", bulkDeleteOrders);
router.get("/:id/actions", getOrderActions);
router.get("/:id", getOrderById);
router.put("/:id/status", updateOrderStatus);
router.put("/:id/document", updateOrderDocument);
router.post("/:id/cancel", cancelOrder);
router.get("/:id/returns", listOrderReturns);
router.post("/:id/returns", createOrderReturn);
router.delete("/:id", deleteOrder);

export default router;
