import { Router } from "express";

import { upload, uploadProductImage } from "../controllers/upload.controller";
import { authenticateToken } from "../middlewares/auth.middleware";

const router = Router();

router.use(authenticateToken);

router.post("/product-image", upload.single("image"), uploadProductImage);

export default router;
