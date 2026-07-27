import { Router } from "express";

import { authenticateToken } from "../middlewares/auth.middleware";
import {
  getCurrentCashSession,
  openCashSession,
  closeCashSession,
  listCashSessions,
  getCashSessionDetail,
} from "../controllers/cash-sessions.controller";

const router = Router();

router.use(authenticateToken);

router.get("/current", getCurrentCashSession);
router.post("/open", openCashSession);
router.post("/:id/close", closeCashSession);
router.get("/", listCashSessions);
router.get("/:id", getCashSessionDetail);

export default router;
