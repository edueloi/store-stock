import { Router } from "express";

import { upload, uploadLogo, uploadProductImage, uploadProductImages, uploadLogoImage } from "../controllers/upload.controller";
import { authenticateToken } from "../middlewares/auth.middleware";

const router = Router();

router.use(authenticateToken);

router.post("/product-image",  upload.single("image"),     uploadProductImage);
router.post("/product-images", upload.array("images", 10), uploadProductImages);
router.post("/logo",           uploadLogo.single("image"), uploadLogoImage);

export default router;
