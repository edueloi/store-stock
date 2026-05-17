import { Router } from "express";

import { getTenant, updateTenant } from "../controllers/tenant.controller";
import { authenticateToken } from "../middlewares/auth.middleware";

const router = Router();

router.use(authenticateToken);

router.get("/", getTenant);
router.put("/", updateTenant);

export default router;
