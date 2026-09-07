import { Router } from "express";

import { getTenant, updateTenant, uploadNfceCert, uploadNfceCertificate, deleteNfceCertificate, getMyBilling } from "../controllers/tenant.controller";
import { authenticateToken } from "../middlewares/auth.middleware";

const router = Router();

router.use(authenticateToken);

router.get("/", getTenant);
router.put("/", updateTenant);
router.get("/billing", getMyBilling);
router.post("/nfce-certificate", uploadNfceCert.single("certificate"), uploadNfceCertificate);
router.delete("/nfce-certificate", deleteNfceCertificate);

export default router;
