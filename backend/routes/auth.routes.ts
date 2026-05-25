import { Router } from "express";

import {
  changePassword,
  claimSetupInvite,
  forgotPassword,
  getSetupInvite,
  login,
  registerTenant,
  resetPassword,
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
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

export default router;
