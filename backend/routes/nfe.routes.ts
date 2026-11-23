import { Router } from "express";

import {
  cancelNfe,
  deleteNfe,
  downloadNfeDanfe,
  downloadNfeXml,
  emitNfe,
  getNfeByOrder,
  listNfe,
  lookupIbge,
  previewNfe,
  recipientFromCustomer,
  retryNfe,
  sendNfeEmail,
  sendNfeWhatsapp,
} from "../controllers/nfe.controller";
import { authenticateToken } from "../middlewares/auth.middleware";

const router = Router();

router.use(authenticateToken);

router.get("/", listNfe);
router.get("/ibge", lookupIbge);
router.get("/recipient/:customerId", recipientFromCustomer);
router.get("/:orderId/preview", previewNfe);
router.get("/:orderId", getNfeByOrder);
router.post("/:orderId/emit", emitNfe);
router.post("/:orderId/retry", retryNfe);
router.post("/:orderId/cancel", cancelNfe);
router.post("/:orderId/send-whatsapp", sendNfeWhatsapp);
router.post("/:orderId/send-email", sendNfeEmail);
router.delete("/:orderId", deleteNfe);
router.get("/:orderId/danfe", downloadNfeDanfe);
router.get("/:orderId/xml", downloadNfeXml);

export default router;
