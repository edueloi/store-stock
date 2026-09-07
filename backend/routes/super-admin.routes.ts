import { Router } from "express";

import {
  createSetupInvite,
  getSuperAdminOverview,
  regenerateInvite,
  updateManagedTenant,
  updateSetupInvite,
  updateTenantUser,
  listSubscriptionPlans,
  createSubscriptionPlan,
  updateSubscriptionPlan,
  archiveSubscriptionPlan,
  createTenantBillingSubscription,
  getTenantBilling,
  getTenantBillingInvoices,
  getBillingOverview,
  cancelTenantBillingSubscription,
} from "../controllers/super-admin.controller";
import { authenticateToken, requireSuperAdmin } from "../middlewares/auth.middleware";

const router = Router();

router.use(authenticateToken, requireSuperAdmin);

router.get("/overview", getSuperAdminOverview);
router.get("/plans", listSubscriptionPlans);
router.post("/plans", createSubscriptionPlan);
router.patch("/plans/:planId", updateSubscriptionPlan);
router.delete("/plans/:planId", archiveSubscriptionPlan);
router.post("/invites", createSetupInvite);
router.post("/invites/:inviteId/regenerate", regenerateInvite);
router.patch("/invites/:inviteId", updateSetupInvite);
router.patch("/tenants/:tenantId", updateManagedTenant);
router.patch("/tenants/:tenantId/users/:userId", updateTenantUser);

router.get("/billing/overview", getBillingOverview);
router.get("/tenants/:tenantId/billing", getTenantBilling);
router.get("/tenants/:tenantId/billing/invoices", getTenantBillingInvoices);
router.post("/tenants/:tenantId/billing/create-subscription", createTenantBillingSubscription);
router.post("/tenants/:tenantId/billing/cancel-subscription", cancelTenantBillingSubscription);

export default router;
