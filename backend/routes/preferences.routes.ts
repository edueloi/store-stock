import { Router } from "express";
import { authenticateToken } from "../middlewares/auth.middleware";
import { getPreference, setPreference } from "../controllers/preferences.controller";

const router = Router();
router.use(authenticateToken);

router.get("/:key", getPreference);
router.put("/:key", setPreference);

export default router;
