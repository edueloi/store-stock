import { Router } from "express";

import { getWorkflowBoard } from "../controllers/workflow.controller";
import { authenticateToken } from "../middlewares/auth.middleware";
import { requireMenuPermission } from "../middlewares/menu-permission.middleware";
import { requireTenantFeature } from "../middlewares/feature-flag.middleware";

const router = Router();

router.use(authenticateToken);
router.use(requireTenantFeature("fluxo_producao_enabled"));
router.use(requireMenuPermission("fluxo_producao"));

router.get("/board", getWorkflowBoard);

export default router;
