import { Router } from "express";
import {
  listServices, createService, updateService, deleteService,
  listServiceCategories, createServiceCategory, updateServiceCategory, deleteServiceCategory,
} from "../controllers/services.controller";
import { authenticateToken } from "../middlewares/auth.middleware";

const router = Router();
router.use(authenticateToken);

// Rotas de categoria ANTES de "/:id" — senão Express trata "categories" como
// valor de :id (mesma armadilha já vista em outras telas deste projeto).
router.get("/categories",     listServiceCategories);
router.post("/categories",    createServiceCategory);
router.put("/categories/:id", updateServiceCategory);
router.delete("/categories/:id", deleteServiceCategory);

router.get("/",    listServices);
router.post("/",   createService);
router.put("/:id", updateService);
router.delete("/:id", deleteService);
export default router;
