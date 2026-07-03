import { Router } from "express";
import {
  listServiceOrders,
  getServiceOrderById,
  createServiceOrder,
  updateServiceOrder,
  updateChecklist,
  updateServiceOrderStatus,
  addServiceOrderPart,
  removeServiceOrderPart,
  attachServiceOrderPhoto,
  deleteServiceOrderPhoto,
  invoiceServiceOrder,
  deleteServiceOrder,
} from "../controllers/service-orders.controller";
import { authenticateToken } from "../middlewares/auth.middleware";

const router = Router();

router.use(authenticateToken);

router.get("/", listServiceOrders);
router.get("/:id", getServiceOrderById);
router.post("/", createServiceOrder);
router.put("/:id", updateServiceOrder);
router.put("/:id/checklist", updateChecklist);
router.put("/:id/status", updateServiceOrderStatus);
router.post("/:id/parts", addServiceOrderPart);
router.delete("/:id/parts/:partId", removeServiceOrderPart);
router.post("/:id/photos", attachServiceOrderPhoto);
router.delete("/:id/photos/:photoId", deleteServiceOrderPhoto);
router.post("/:id/faturar", invoiceServiceOrder);
router.delete("/:id", deleteServiceOrder);

export default router;
