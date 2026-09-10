import { Router } from "express";
import { getMyProfile, updateMyProfile, checkNicknameAvailability } from "../controllers/profile.controller";
import { authenticateToken } from "../middlewares/auth.middleware";

const router = Router();
router.use(authenticateToken);

router.get("/", getMyProfile);
router.put("/", updateMyProfile);
router.get("/check-nickname", checkNicknameAvailability);

export default router;
