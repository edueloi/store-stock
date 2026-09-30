import { Router } from "express";

import { getStorefrontDashboard } from "../controllers/store-dashboard.controller";
import { authenticateToken } from "../middlewares/auth.middleware";

const router = Router();
router.use(authenticateToken);
router.get("/", getStorefrontDashboard);

export default router;
