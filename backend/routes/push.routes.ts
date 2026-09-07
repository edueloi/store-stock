import { Router } from "express";
import { authenticateToken } from "../middlewares/auth.middleware";
import { getVapidPublicKey, subscribe, unsubscribe } from "../controllers/push.controller";

const router = Router();

router.get("/vapid-public-key", getVapidPublicKey);
router.use(authenticateToken);
router.post("/subscribe", subscribe);
router.post("/unsubscribe", unsubscribe);

export default router;
