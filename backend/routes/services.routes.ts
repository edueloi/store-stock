import { Router } from "express";
import { listServices, createService, updateService, deleteService } from "../controllers/services.controller";
import { authenticateToken } from "../middlewares/auth.middleware";

const router = Router();
router.use(authenticateToken);
router.get("/",    listServices);
router.post("/",   createService);
router.put("/:id", updateService);
router.delete("/:id", deleteService);
export default router;
