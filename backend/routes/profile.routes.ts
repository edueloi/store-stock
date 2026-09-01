import { Router } from "express";
import { getMyProfile, updateMyProfile } from "../controllers/profile.controller";
import { authenticateToken } from "../middlewares/auth.middleware";

const router = Router();
router.use(authenticateToken);

router.get("/", getMyProfile);
router.put("/", updateMyProfile);

export default router;
