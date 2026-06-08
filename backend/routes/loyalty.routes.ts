import { Router } from "express";
import {
  getProgram,
  updateProgram,
  listRewards,
  createReward,
  updateReward,
  deleteReward,
  getCustomerPoints,
  adjustPoints,
  redeemReward,
  loyaltySummary,
} from "../controllers/loyalty.controller";
import { authenticateToken } from "../middlewares/auth.middleware";

const router = Router();

router.use(authenticateToken);

// Program settings
router.get("/program",        getProgram);
router.put("/program",        updateProgram);

// Rewards
router.get("/rewards",                    listRewards);
router.post("/rewards",                   createReward);
router.put("/rewards/:rewardId",          updateReward);
router.delete("/rewards/:rewardId",       deleteReward);

// Summary dashboard
router.get("/summary",        loyaltySummary);

// Customer points
router.get("/customers/:customerId/points",   getCustomerPoints);
router.post("/customers/:customerId/points",  adjustPoints);
router.post("/customers/:customerId/redeem",  redeemReward);

export default router;
