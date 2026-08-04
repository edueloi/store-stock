import { Router } from "express";

import { checkout, getPublicStore } from "../controllers/public.controller";
import { approveQuoteByToken, getQuoteByApprovalToken } from "../controllers/quote-approval.controller";

const router = Router();

router.get("/store", getPublicStore);
router.get("/store/:slug", getPublicStore);
router.post("/checkout", checkout);

router.get("/quotes/:token", getQuoteByApprovalToken);
router.post("/quotes/:token/approve", approveQuoteByToken);

export default router;
