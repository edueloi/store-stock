import { Router } from "express";
import {
  listServiceOrders,
  getServiceOrderById,
  createServiceOrder,
  updateServiceOrder,
  updateChecklist,
  updateServiceOrderStatus,
  addServiceOrderPart,
  updateServiceOrderPart,
  removeServiceOrderPart,
  attachServiceOrderPhoto,
  deleteServiceOrderPhoto,
  invoiceServiceOrder,
  createServiceOrderReceivable,
  deleteServiceOrder,
  bulkDeleteServiceOrders,
} from "../controllers/service-orders.controller";
import { authenticateToken } from "../middlewares/auth.middleware";
import { requireMenuPermission } from "../middlewares/menu-permission.middleware";

const router = Router();

router.use(authenticateToken);
router.use(requireMenuPermission("ordens_servico"));

router.get("/", listServiceOrders);
router.get("/:id", getServiceOrderById);
router.post("/", createServiceOrder);
router.put("/:id", updateServiceOrder);
router.put("/:id/checklist", updateChecklist);
router.put("/:id/status", updateServiceOrderStatus);
router.post("/:id/parts", addServiceOrderPart);
router.put("/:id/parts/:partId", updateServiceOrderPart);
router.delete("/:id/parts/:partId", removeServiceOrderPart);
router.post("/:id/photos", attachServiceOrderPhoto);
router.delete("/:id/photos/:photoId", deleteServiceOrderPhoto);
router.post("/:id/faturar", invoiceServiceOrder);
router.post("/:id/receivable", createServiceOrderReceivable);
router.delete("/bulk", bulkDeleteServiceOrders);
router.delete("/:id", deleteServiceOrder);

export default router;
