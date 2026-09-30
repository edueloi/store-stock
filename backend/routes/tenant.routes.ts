import { Router } from "express";

import { getTenant, updateTenant, uploadNfceCert, uploadNfceCertificate, deleteNfceCertificate, getMyBilling, sendReportNowHandler, listAutomatedMessageLogs, testEmailConnection, getStorePaymentGateways, saveStorePaymentGateway } from "../controllers/tenant.controller";
import { authenticateToken } from "../middlewares/auth.middleware";

const router = Router();

router.use(authenticateToken);

router.get("/", getTenant);
router.put("/", updateTenant);
router.get("/payment-gateways", getStorePaymentGateways);
router.put("/payment-gateways/:provider", saveStorePaymentGateway);
router.get("/billing", getMyBilling);
router.post("/nfce-certificate", uploadNfceCert.single("certificate"), uploadNfceCertificate);
router.delete("/nfce-certificate", deleteNfceCertificate);
router.post("/send-report-now", sendReportNowHandler);
router.post("/email-connection/test", testEmailConnection);
router.get("/automated-message-logs", listAutomatedMessageLogs);

export default router;
