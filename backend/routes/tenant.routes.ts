import { Router } from "express";

import { graficaSso, getTenant, updateTenant, uploadNfceCert, uploadNfceCertificate, getNfceCertificateInfo, deleteNfceCertificate, listA3Certificates, selectA3Certificate, getMyBilling, sendReportNowHandler, listAutomatedMessageLogs, testEmailConnection, getStorePaymentGateways, saveStorePaymentGateway } from "../controllers/tenant.controller";
import { onboardAsaas, saveChargeRules, createChargeLink, listCharges, getAsaasAccountOverview, withdrawAsaasBalance } from "../controllers/store-charges.controller";
import { listIssuers, issuersSummary, createIssuer, updateIssuer, activateIssuer, deleteIssuer } from "../controllers/issuers.controller";
import { authenticateToken } from "../middlewares/auth.middleware";

const router = Router();

router.use(authenticateToken);

router.get("/", getTenant);
router.post("/grafica-sso", graficaSso);
router.put("/", updateTenant);
router.get("/payment-gateways", getStorePaymentGateways);
router.put("/payment-gateways/:provider", saveStorePaymentGateway);
router.post("/payment-gateways/asaas/onboard", onboardAsaas);
router.put("/payment-gateways/asaas/rules", saveChargeRules);
router.get("/payment-gateways/asaas/account", getAsaasAccountOverview);
router.post("/payment-gateways/asaas/withdraw", withdrawAsaasBalance);
router.post("/charges", createChargeLink);
router.get("/charges", listCharges);
router.get("/issuers", listIssuers);
router.get("/issuers/summary", issuersSummary);
router.post("/issuers", createIssuer);
router.put("/issuers/:id", updateIssuer);
router.post("/issuers/:id/activate", activateIssuer);
router.delete("/issuers/:id", deleteIssuer);
router.get("/billing", getMyBilling);
router.get("/nfce-certificate", getNfceCertificateInfo);
router.post("/nfce-certificate", uploadNfceCert.single("certificate"), uploadNfceCertificate);
router.delete("/nfce-certificate", deleteNfceCertificate);
router.post("/a3/certificates", listA3Certificates);
router.post("/a3/select", selectA3Certificate);
router.post("/send-report-now", sendReportNowHandler);
router.post("/email-connection/test", testEmailConnection);
router.get("/automated-message-logs", listAutomatedMessageLogs);

export default router;
