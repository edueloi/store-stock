import { Router } from "express";
import { getYearlyFinancialReport } from "../controllers/financial-reports.controller";
import { authenticateToken } from "../middlewares/auth.middleware";

const router = Router();
router.use(authenticateToken);

router.get("/:year", getYearlyFinancialReport);

export default router;
