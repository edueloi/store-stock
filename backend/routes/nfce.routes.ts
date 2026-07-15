import { Router } from "express";

import {
  getNfceByOrder,
  retryNfce,
  cancelNfce,
  downloadDanfe,
  downloadNfceXml,
  listNfce,
} from "../controllers/nfce.controller";
import { authenticateToken } from "../middlewares/auth.middleware";

const router = Router();

router.use(authenticateToken);

router.get("/", listNfce);
router.get("/:orderId", getNfceByOrder);
router.post("/:orderId/retry", retryNfce);
router.post("/:orderId/cancel", cancelNfce);
router.get("/:orderId/danfe", downloadDanfe);
router.get("/:orderId/xml", downloadNfceXml);

export default router;
