import { Router } from "express";

import {
  assignWhatsappConversationHandler,
  closeWhatsappConversationHandler,
  connectWhatsappHandler,
  createWhatsappAgentHandler,
  createWhatsappSectorHandler,
  deleteWhatsappAgentHandler,
  deleteWhatsappSectorHandler,
  getWhatsappConnectionStatusHandler,
  getWhatsappConversationMessagesHandler,
  getWhatsappModuleOverview,
  pingWhatsappProvider,
  testWhatsappAiHandler,
  transferWhatsappConversationHandler,
  saveWhatsappWorkspace,
  sendWhatsappConversationMessageHandler,
  sendWhatsappDocumentHandler,
  sendWhatsappMenuTest,
  sendFinanceAlertsHandler,
  startWhatsappConversationHandler,
  updateWhatsappAgentHandler,
  updateWhatsappSectorHandler,
  whatsappWebhookHandler,
} from "../controllers/whatsapp.controller";
import { authenticateToken } from "../middlewares/auth.middleware";

const router = Router();

router.post("/webhook/:tenantSlug", whatsappWebhookHandler);

router.use(authenticateToken);

router.get("/overview", getWhatsappModuleOverview);
router.put("/workspace", saveWhatsappWorkspace);
router.post("/ping", pingWhatsappProvider);
router.post("/test-ai", testWhatsappAiHandler);
router.get("/connection-status", getWhatsappConnectionStatusHandler);
router.post("/connect", connectWhatsappHandler);
router.post("/test-menu", sendWhatsappMenuTest);
router.post("/send-document", sendWhatsappDocumentHandler);
router.post("/send-finance-alerts", sendFinanceAlertsHandler);

router.post("/agents", createWhatsappAgentHandler);
router.patch("/agents/:id", updateWhatsappAgentHandler);
router.delete("/agents/:id", deleteWhatsappAgentHandler);
router.post("/sectors", createWhatsappSectorHandler);
router.patch("/sectors/:id", updateWhatsappSectorHandler);
router.delete("/sectors/:id", deleteWhatsappSectorHandler);

router.post("/conversations/start", startWhatsappConversationHandler);
router.get("/conversations/:id/messages", getWhatsappConversationMessagesHandler);
router.post("/conversations/:id/assign", assignWhatsappConversationHandler);
router.post("/conversations/:id/transfer", transferWhatsappConversationHandler);
router.post("/conversations/:id/close", closeWhatsappConversationHandler);
router.post("/conversations/:id/message", sendWhatsappConversationMessageHandler);

export default router;
