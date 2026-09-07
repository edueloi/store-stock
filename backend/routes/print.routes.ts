import { Router } from "express";
import { authenticateToken } from "../middlewares/auth.middleware";
import { requestRemotePrint } from "../controllers/print.controller";

const router = Router();
router.use(authenticateToken);

router.post("/remote", requestRemotePrint);

export default router;
