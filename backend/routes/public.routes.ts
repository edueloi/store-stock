import { Router } from "express";

import { checkout, getPublicStore } from "../controllers/public.controller";

const router = Router();

router.get("/store", getPublicStore);
router.get("/store/:slug", getPublicStore);
router.post("/checkout", checkout);

export default router;
