import { Router } from "express";

import {
  createSupplier,
  deleteSupplier,
  listSuppliers,
  updateSupplier,
} from "../controllers/suppliers.controller";
import { authenticateToken } from "../middlewares/auth.middleware";

const router = Router();

router.use(authenticateToken);

router.get("/", listSuppliers);
router.post("/", createSupplier);
router.put("/:id", updateSupplier);
router.delete("/:id", deleteSupplier);

export default router;
