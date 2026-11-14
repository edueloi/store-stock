import { Router } from "express";
import { listServiceCommissions, updateServiceOrderCommission, payServiceCommissions } from "../controllers/service-commissions.controller";
import { authenticateToken } from "../middlewares/auth.middleware";

const router = Router();
router.use(authenticateToken);

router.get("/", listServiceCommissions);
router.post("/pay", payServiceCommissions);
router.put("/:id", updateServiceOrderCommission);

export default router;
