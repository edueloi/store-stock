import { Router } from "express";

import { getAffiliateDetail, listAffiliates, listCommissions } from "../controllers/affiliates-admin.controller";
import {
  getSplit,
  receivePaymentEvent,
  registerReferral,
  resolveCode,
  setReferralStatus,
} from "../controllers/affiliates-external.controller";
import { requireApiKey } from "../middlewares/external-api.middleware";

// Montado em /api/external/affiliates. Usado só pela Develoi (x-api-key).
const router = Router();
router.use(requireApiKey);

router.get("/", listAffiliates);
router.get("/commissions", listCommissions);
router.get("/resolve/:code", resolveCode);
router.post("/referrals", registerReferral);
router.get("/referrals/:develoiClientId/split", getSplit);
router.patch("/referrals/:develoiClientId", setReferralStatus);
router.post("/events", receivePaymentEvent);
router.get("/:id", getAffiliateDetail);

export default router;
