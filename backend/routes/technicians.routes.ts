import { Router } from "express";
import {
  listTechnicians,
  createTechnician,
  updateTechnician,
  deleteTechnician,
} from "../controllers/technicians.controller";
import { authenticateToken } from "../middlewares/auth.middleware";

const router = Router();
router.use(authenticateToken);

router.get("/",       listTechnicians);
router.post("/",       createTechnician);
router.put("/:id",     updateTechnician);
router.delete("/:id",  deleteTechnician);

export default router;
