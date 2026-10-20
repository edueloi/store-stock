import { Router } from "express";

import { getTenant, updateTenant, uploadNfceCert, uploadNfceCertificate, deleteNfceCertificate, getMyBilling, sendReportNowHandler, listAutomatedMessageLogs, testEmailConnection, getStorePaymentGateways, saveStorePaymentGateway } from "../controllers/tenant.controller";
import { onboardAsaas, saveChargeRules, createChargeLink, listCharges } from "../controllers/store-charges.controller";
import { authenticateToken } from "../middlewares/auth.middleware";

const router = Router();

router.use(authenticateToken);

router.get("/", getTenant);
router.put("/", updateTenant);
router.get("/payment-gateways", getStorePaymentGateways);
router.put("/payment-gateways/:provider", saveStorePaymentGateway);
router.post("/payment-gateways/asaas/onboard", onboardAsaas);
router.put("/payment-gateways/asaas/rules", saveChargeRules);
router.post("/charges", createChargeLink);
router.get("/charges", listCharges);
router.get("/billing", getMyBilling);
router.post("/nfce-certificate", uploadNfceCert.single("certificate"), uploadNfceCertificate);
router.delete("/nfce-certificate", deleteNfceCertificate);
router.post("/send-report-now", sendReportNowHandler);
router.post("/email-connection/test", testEmailConnection);
router.get("/automated-message-logs", listAutomatedMessageLogs);

export default router;
