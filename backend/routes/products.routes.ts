import { Router, type Request, type Response, type NextFunction } from "express";
import multer from "multer";

import {
  adjustProductStock,
  createProduct,
  deleteProduct,
  exportProducts,
  getLowStockCount,
  getProduct,
  getProductByBarcode,
  getProductHistory,
  listProductMovements,
  listProducts,
  updateProduct,
} from "../controllers/products.controller";
import { importProducts } from "../controllers/products-import.controller";
import { authenticateToken } from "../middlewares/auth.middleware";

const uploadSheet = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const router = Router();

router.use(authenticateToken);

router.get("/export", exportProducts);
router.post("/import", (req: Request, res: Response, next: NextFunction) => {
  uploadSheet.single("file")(req, res, (err: unknown) => {
    if (err) return res.status(400).json({ error: err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE" ? "Arquivo maior que 10MB" : "Falha ao processar o arquivo enviado" });
    next();
  });
}, importProducts);
router.get("/", listProducts);
router.post("/", createProduct);
router.post("/stock-adjustment", adjustProductStock);
router.get("/movements", listProductMovements);
router.get("/low-stock-count", getLowStockCount);
router.get("/by-barcode/:code", getProductByBarcode);
router.get("/:id/history", getProductHistory);
router.get("/:id", getProduct);
router.put("/:id", updateProduct);
router.delete("/:id", deleteProduct);

export default router;
