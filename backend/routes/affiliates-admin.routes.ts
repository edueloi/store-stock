import { Router } from "express";

import {
  createAffiliate,
  createGoal,
  createManualReferral,
  createPlan,
  deleteGoal,
  deletePlan,
  getAffiliateDetail,
  listAffiliates,
  listCommissions,
  listEvents,
  listGoals,
  listLeads,
  listPlans,
  listReferrals,
  overview,
  retryEvent,
  updateAffiliate,
  updateCommission,
  updateLead,
  updatePlan,
  updateReferral,
} from "../controllers/affiliates-admin.controller";
import { authenticateToken, requireSuperAdmin } from "../middlewares/auth.middleware";

// Montado em /api/super-admin/affiliates-admin (gestão do programa de afiliados).
const router = Router();
router.use(authenticateToken, requireSuperAdmin);

router.get("/overview", overview);
router.get("/affiliates", listAffiliates);
router.post("/affiliates", createAffiliate);
router.get("/affiliates/:id", getAffiliateDetail);
router.patch("/affiliates/:id", updateAffiliate);

router.get("/plans", listPlans);
router.post("/plans", createPlan);
router.patch("/plans/:id", updatePlan);
router.delete("/plans/:id", deletePlan);

router.get("/leads", listLeads);
router.patch("/leads/:id", updateLead);

router.get("/referrals", listReferrals);
router.post("/referrals", createManualReferral);
router.patch("/referrals/:id", updateReferral);

router.get("/commissions", listCommissions);
router.patch("/commissions/:id", updateCommission);

router.get("/goals", listGoals);
router.post("/goals", createGoal);
router.delete("/goals/:id", deleteGoal);

router.get("/events", listEvents);
router.post("/events/:id/retry", retryEvent);

export default router;
