import { Router } from "express";
import { asaasWebhookHandler } from "../controllers/billing-webhook.controller";

const router = Router();

// Rota 100% pública — validada dentro do handler via header asaas-access-token,
// nunca por authenticateToken (o Asaas não tem sessão de usuário do nosso sistema).
router.post("/webhook/asaas", asaasWebhookHandler);

export default router;
