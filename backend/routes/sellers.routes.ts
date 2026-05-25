import { Router } from "express";
import {
  listSellers,
  createSeller,
  updateSeller,
  deleteSeller,
  getSellerStats,
} from "../controllers/sellers.controller";
import { authenticateToken } from "../middlewares/auth.middleware";

const router = Router();
router.use(authenticateToken);

router.get("/",        listSellers);
router.get("/stats",   getSellerStats);
router.post("/",       createSeller);
router.put("/:id",     updateSeller);
router.delete("/:id",  deleteSeller);

export default router;
