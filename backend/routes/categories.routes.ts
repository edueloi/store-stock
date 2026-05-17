import { Router } from "express";

import {
  createCategory,
  deleteCategory,
  listCategories,
  updateCategory,
} from "../controllers/categories.controller";
import { authenticateToken } from "../middlewares/auth.middleware";

const router = Router();

router.use(authenticateToken);

router.get("/", listCategories);
router.post("/", createCategory);
router.put("/:id", updateCategory);
router.delete("/:id", deleteCategory);

export default router;
