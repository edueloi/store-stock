import { Router } from "express";

import {
  assignWhatsappConversationHandler,
  closeWhatsappConversationHandler,
  connectWhatsappHandler,
  createWhatsappAgentHandler,
  deleteWhatsappAgentHandler,
  getWhatsappConnectionStatusHandler,
  getWhatsappConversationMessagesHandler,
  getWhatsappModuleOverview,
  pingWhatsappProvider,
  saveWhatsappWorkspace,
  sendWhatsappConversationMessageHandler,
  sendWhatsappMenuTest,
  updateWhatsappAgentHandler,
  whatsappWebhookHandler,
} from "../controllers/whatsapp.controller";
import { authenticateToken } from "../middlewares/auth.middleware";

const router = Router();

router.post("/webhook/:tenantSlug", whatsappWebhookHandler);

router.use(authenticateToken);

router.get("/overview", getWhatsappModuleOverview);
router.put("/workspace", saveWhatsappWorkspace);
router.post("/ping", pingWhatsappProvider);
router.get("/connection-status", getWhatsappConnectionStatusHandler);
router.post("/connect", connectWhatsappHandler);
router.post("/test-menu", sendWhatsappMenuTest);

router.post("/agents", createWhatsappAgentHandler);
router.patch("/agents/:id", updateWhatsappAgentHandler);
router.delete("/agents/:id", deleteWhatsappAgentHandler);

router.get("/conversations/:id/messages", getWhatsappConversationMessagesHandler);
router.post("/conversations/:id/assign", assignWhatsappConversationHandler);
router.post("/conversations/:id/close", closeWhatsappConversationHandler);
router.post("/conversations/:id/message", sendWhatsappConversationMessageHandler);

export default router;
