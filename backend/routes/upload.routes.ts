import { Router } from "express";

import { upload, uploadLogo, uploadService, uploadServiceOrderPhoto, uploadProductImage, uploadProductImages, uploadLogoImage, uploadServiceImage, uploadServiceOrderPhotoImage } from "../controllers/upload.controller";
import { authenticateToken } from "../middlewares/auth.middleware";

const router = Router();

router.use(authenticateToken);

router.post("/product-image",      upload.single("image"),                uploadProductImage);
router.post("/product-images",     upload.array("images", 10),            uploadProductImages);
router.post("/logo",               uploadLogo.single("image"),            uploadLogoImage);
router.post("/service-image",      uploadService.single("image"),         uploadServiceImage);
router.post("/service-order-photo", uploadServiceOrderPhoto.single("image"), uploadServiceOrderPhotoImage);

export default router;
