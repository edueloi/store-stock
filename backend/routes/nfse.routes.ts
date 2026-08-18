import { Router } from "express";

import {
  getNfseByServiceOrder,
  emitNfseForServiceOrder,
  testNfseEmission,
  retryNfse,
  downloadNfseXml,
  downloadNfsePdf,
  listNfse,
} from "../controllers/nfse.controller";
import { authenticateToken } from "../middlewares/auth.middleware";

const router = Router();

router.use(authenticateToken);

router.get("/", listNfse);
router.post("/test", testNfseEmission);
router.get("/:serviceOrderId", getNfseByServiceOrder);
router.post("/:serviceOrderId/emit", emitNfseForServiceOrder);
router.post("/:serviceOrderId/retry", retryNfse);
router.get("/:serviceOrderId/xml", downloadNfseXml);
router.get("/:serviceOrderId/pdf", downloadNfsePdf);

export default router;
