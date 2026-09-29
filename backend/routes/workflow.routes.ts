import { Router } from "express";

import { getWorkflowBoard, getWorkflowHistory, listProductionTasks, createProductionTask, updateProductionTaskStatus, createServiceOrderFromTask } from "../controllers/workflow.controller";
import { authenticateToken } from "../middlewares/auth.middleware";
import { requireMenuPermission } from "../middlewares/menu-permission.middleware";
import { requireTenantFeature } from "../middlewares/feature-flag.middleware";

const router = Router();

router.use(authenticateToken);
router.use(requireTenantFeature("fluxo_producao_enabled"));
router.use(requireMenuPermission("fluxo_producao"));

router.get("/board", getWorkflowBoard);
router.get("/history", getWorkflowHistory);
router.get("/tasks", listProductionTasks);
router.post("/tasks", createProductionTask);
router.put("/tasks/:id/status", updateProductionTaskStatus);
router.post("/tasks/:id/create-service-order", createServiceOrderFromTask);

export default router;
