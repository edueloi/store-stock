import { Router } from "express";

import {
  getDashboardStats,
  getTopSellingProducts,
} from "../controllers/stats.controller";
import { authenticateToken } from "../middlewares/auth.middleware";

const router = Router();

router.use(authenticateToken);

router.get("/top-selling", getTopSellingProducts);
router.get("/", getDashboardStats);

export default router;
