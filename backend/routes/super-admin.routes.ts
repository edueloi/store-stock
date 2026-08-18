import { Router } from "express";

import {
  createSetupInvite,
  getSuperAdminOverview,
  regenerateInvite,
  updateManagedTenant,
  updateSetupInvite,
  updateTenantUser,
} from "../controllers/super-admin.controller";
import { authenticateToken, requireSuperAdmin } from "../middlewares/auth.middleware";

const router = Router();

router.use(authenticateToken, requireSuperAdmin);

router.get("/overview", getSuperAdminOverview);
router.post("/invites", createSetupInvite);
router.post("/invites/:inviteId/regenerate", regenerateInvite);
router.patch("/invites/:inviteId", updateSetupInvite);
router.patch("/tenants/:tenantId", updateManagedTenant);
router.patch("/tenants/:tenantId/users/:userId", updateTenantUser);

export default router;
