import { Router } from "express";

import {
  getNfceByOrder,
  emitNfceForOrder,
  retryNfce,
  retryNfceBatch,
  deleteNfce,
  cancelNfce,
  downloadDanfe,
  downloadNfceXml,
  downloadNfceXmlBatch,
  downloadDanfeBatch,
  listNfce,
  sendNfceWhatsapp,
  emitNfceAsProduction,
} from "../controllers/nfce.controller";
import { authenticateToken } from "../middlewares/auth.middleware";

const router = Router();

router.use(authenticateToken);

router.get("/", listNfce);
router.post("/retry-batch", retryNfceBatch);
router.get("/xml-batch", downloadNfceXmlBatch);
router.get("/danfe-batch", downloadDanfeBatch);
router.get("/:orderId", getNfceByOrder);
router.post("/:orderId/emit", emitNfceForOrder);
router.post("/:orderId/retry", retryNfce);
router.post("/:orderId/cancel", cancelNfce);
router.delete("/:orderId", deleteNfce);
router.get("/:orderId/danfe", downloadDanfe);
router.get("/:orderId/xml", downloadNfceXml);
router.post("/:orderId/send-whatsapp", sendNfceWhatsapp);
router.post("/:orderId/emit-production", emitNfceAsProduction);

export default router;
