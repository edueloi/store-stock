import { Router } from "express";

import {
  createGoal,
  createLink,
  deleteLink,
  listLinks,
  createLead,
  deleteGoal,
  getDashboard,
  changePassword,
  getMe,
  listCommissions,
  listGoals,
  listLeads,
  listReferrals,
  updateLead,
  updateMe,
} from "../controllers/affiliates-portal.controller";
import {
  applyAffiliate,
  createPublicLead,
  getProgram,
  limitApply,
  limitAuth,
  limitClick,
  limitLead,
  limitLogin,
  loginWithPassword,
  requestLogin,
  trackClick,
  validateCode,
  verifyLogin,
} from "../controllers/affiliates-public.controller";
import { authenticateAffiliate } from "../services/affiliates/auth";

// Montado em /api/affiliates. Parte pública (site) + painel do afiliado (JWT próprio, em /me).
const router = Router();

router.get("/program", getProgram);
router.get("/validate/:code", validateCode);
router.post("/apply", limitApply, applyAffiliate);
router.post("/auth/login", limitLogin, loginWithPassword);
router.post("/auth/request", limitAuth, requestLogin);
router.post("/auth/verify", limitAuth, verifyLogin);
router.post("/click", limitClick, trackClick);
router.post("/lead", limitLead, createPublicLead);

router.use("/me", authenticateAffiliate);
router.get("/me", getMe);
router.patch("/me", updateMe);
router.patch("/me/password", changePassword);
router.get("/me/dashboard", getDashboard);
router.get("/me/leads", listLeads);
router.post("/me/leads", createLead);
router.patch("/me/leads/:id", updateLead);
router.get("/me/referrals", listReferrals);
router.get("/me/commissions", listCommissions);
router.get("/me/goals", listGoals);
router.post("/me/goals", createGoal);
router.delete("/me/goals/:id", deleteGoal);
router.get("/me/links", listLinks);
router.post("/me/links", createLink);
router.delete("/me/links/:id", deleteLink);

export default router;
