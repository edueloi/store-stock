import { Router } from "express";

import { upload, uploadLogo, uploadBanner, uploadService, uploadServiceOrderPhoto, uploadCategory, uploadQuoteFile, uploadProductImage, uploadProductImages, uploadLogoImage, uploadBannerImage, uploadServiceImage, uploadServiceOrderPhotoImage, uploadCategoryImage, uploadQuoteFileHandler } from "../controllers/upload.controller";
import { authenticateToken } from "../middlewares/auth.middleware";

const router = Router();

router.use(authenticateToken);

router.post("/product-image",      upload.single("image"),                uploadProductImage);
router.post("/product-images",     upload.array("images", 10),            uploadProductImages);
router.post("/logo",               uploadLogo.single("image"),            uploadLogoImage);
router.post("/banner",             uploadBanner.single("image"),          uploadBannerImage);
router.post("/service-image",      uploadService.single("image"),         uploadServiceImage);
router.post("/service-order-photo", uploadServiceOrderPhoto.single("image"), uploadServiceOrderPhotoImage);
router.post("/category-cover",     uploadCategory.single("image"),            uploadCategoryImage);
router.post("/quote-file",         uploadQuoteFile.single("file"),            uploadQuoteFileHandler);

export default router;
