import { Router } from "express";

import {
  adjustProductStock,
  createProduct,
  deleteProduct,
  getProduct,
  getProductByBarcode,
  getProductHistory,
  listProductMovements,
  listProducts,
  updateProduct,
} from "../controllers/products.controller";
import { authenticateToken } from "../middlewares/auth.middleware";

const router = Router();

router.use(authenticateToken);

router.get("/", listProducts);
router.post("/", createProduct);
router.post("/stock-adjustment", adjustProductStock);
router.get("/movements", listProductMovements);
router.get("/by-barcode/:code", getProductByBarcode);
router.get("/:id/history", getProductHistory);
router.get("/:id", getProduct);
router.put("/:id", updateProduct);
router.delete("/:id", deleteProduct);

export default router;
