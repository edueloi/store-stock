import { Router } from "express";

import {
  listTenants,
  getTenant,
  createTenant,
  updateTenant,
  blockTenant,
  unblockTenant,
  deleteTenant,
  listPlans,
} from "../controllers/external-api.controller";
import { requireApiKey } from "../middlewares/external-api.middleware";

const router = Router();

router.use(requireApiKey);

router.get("/tenants", listTenants);
router.get("/tenants/:id", getTenant);
router.post("/tenants", createTenant);
router.patch("/tenants/:id", updateTenant);
router.post("/tenants/:id/block", blockTenant);
router.post("/tenants/:id/unblock", unblockTenant);
router.delete("/tenants/:id", deleteTenant);

router.get("/plans", listPlans);

export default router;
