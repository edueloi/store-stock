import { Router } from "express";

import { login, registerTenant } from "../controllers/auth.controller";

const router = Router();

router.post("/register-tenant", registerTenant);
router.post("/login", login);

export default router;
