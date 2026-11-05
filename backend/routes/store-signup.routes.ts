import { Router } from "express";

import { limitStoreSignup, storeSignup } from "../controllers/store-signup.controller";

// Montado em /api/store-signup (público): criação de conta pela página de vendas do Store.
const router = Router();
router.post("/", limitStoreSignup, storeSignup);

export default router;
