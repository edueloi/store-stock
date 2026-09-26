import { Router } from "express";
import { asaasWebhookHandler } from "../controllers/billing-webhook.controller";
import { stoneWebhookHandler } from "../controllers/stone-webhook.controller";

const router = Router();

// Rotas 100% públicas — nunca passam por authenticateToken, pois o provedor externo
// não tem sessão de usuário do nosso sistema. Cada handler valida a origem à sua
// própria maneira (ver comentário em cada controller).
router.post("/webhook/asaas", asaasWebhookHandler);
router.post("/webhook/stone", stoneWebhookHandler);

export default router;
