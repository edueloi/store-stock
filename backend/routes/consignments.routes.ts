import { Router } from "express";
import {
  listConsignments,
  getOverdueCount,
  getConsignmentById,
  createConsignment,
  updateConsignment,
  addConsignmentItem,
  removeConsignmentItem,
  resolveConsignment,
  cancelConsignment,
} from "../controllers/consignments.controller";
import { authenticateToken } from "../middlewares/auth.middleware";

const router = Router();

router.use(authenticateToken);

router.get("/overdue-count", getOverdueCount);
router.get("/", listConsignments);
router.get("/:id", getConsignmentById);
router.post("/", createConsignment);
router.put("/:id", updateConsignment);
router.post("/:id/items", addConsignmentItem);
router.delete("/:id/items/:itemId", removeConsignmentItem);
router.post("/:id/resolve", resolveConsignment);
router.post("/:id/cancel", cancelConsignment);

export default router;
