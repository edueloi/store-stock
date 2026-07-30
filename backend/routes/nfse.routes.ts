import { Router } from "express";

import {
  getNfseByServiceOrder,
  emitNfseForServiceOrder,
  retryNfse,
  downloadNfseXml,
  listNfse,
} from "../controllers/nfse.controller";
import { authenticateToken } from "../middlewares/auth.middleware";

const router = Router();

router.use(authenticateToken);

router.get("/", listNfse);
router.get("/:serviceOrderId", getNfseByServiceOrder);
router.post("/:serviceOrderId/emit", emitNfseForServiceOrder);
router.post("/:serviceOrderId/retry", retryNfse);
router.get("/:serviceOrderId/xml", downloadNfseXml);

export default router;
