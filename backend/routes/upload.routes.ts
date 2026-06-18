import { Router } from "express";

import { upload, uploadLogo, uploadService, uploadProductImage, uploadProductImages, uploadLogoImage, uploadServiceImage } from "../controllers/upload.controller";
import { authenticateToken } from "../middlewares/auth.middleware";

const router = Router();

router.use(authenticateToken);

router.post("/product-image",  upload.single("image"),          uploadProductImage);
router.post("/product-images", upload.array("images", 10),      uploadProductImages);
router.post("/logo",           uploadLogo.single("image"),      uploadLogoImage);
router.post("/service-image",  uploadService.single("image"),   uploadServiceImage);

export default router;
