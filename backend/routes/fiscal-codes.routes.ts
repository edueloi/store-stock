import { Router } from "express";
import { getNfseIssuerActivity, listNfseServiceCodes, lookupCnpj, searchNcmCodes } from "../controllers/fiscal-codes.controller";
import { authenticateToken } from "../middlewares/auth.middleware";

const router = Router();
router.use(authenticateToken);
router.get("/nfse-services", listNfseServiceCodes);
router.get("/nfse-issuer-activity", getNfseIssuerActivity);
router.get("/ncm", searchNcmCodes);
router.get("/cnpj/:cnpj", lookupCnpj);

export default router;
