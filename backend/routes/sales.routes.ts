import { Router } from "express";

import { createSale } from "../controllers/sales.controller";
import { authenticateToken } from "../middlewares/auth.middleware";

const router = Router();

router.use(authenticateToken);

router.post("/", createSale);

export default router;
