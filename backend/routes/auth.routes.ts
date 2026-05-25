import { Router } from "express";

import {
  changePassword,
  claimSetupInvite,
  getSetupInvite,
  login,
  registerTenant,
  superAdminLogin,
} from "../controllers/auth.controller";
import { authenticateToken, requireSuperAdmin } from "../middlewares/auth.middleware";

const router = Router();

router.post("/login", login);
router.post("/super-admin/login", superAdminLogin);
router.get("/setup/:token", getSetupInvite);
router.post("/claim-setup", claimSetupInvite);
router.post("/change-password", authenticateToken, changePassword);
router.post("/register-tenant", authenticateToken, requireSuperAdmin, registerTenant);

export default router;
