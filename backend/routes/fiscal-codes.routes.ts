import { Router } from "express";
import { listNfseServiceCodes, searchNcmCodes } from "../controllers/fiscal-codes.controller";
import { authenticateToken } from "../middlewares/auth.middleware";

const router = Router();
router.use(authenticateToken);
router.get("/nfse-services", listNfseServiceCodes);
router.get("/ncm", searchNcmCodes);

export default router;
