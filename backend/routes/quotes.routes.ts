import { Router } from "express";
import {
  listQuotes,
  getQuoteById,
  createQuote,
  updateQuote,
  updateQuoteStatus,
  recordQuoteDeposit,
  deleteQuote,
  convertToOrder,
} from "../controllers/quotes.controller";
import { authenticateToken } from "../middlewares/auth.middleware";

const router = Router();

router.use(authenticateToken);

router.get("/", listQuotes);
router.get("/:id", getQuoteById);
router.post("/", createQuote);
router.put("/:id", updateQuote);
router.put("/:id/status", updateQuoteStatus);
router.post("/:id/deposit", recordQuoteDeposit);
router.post("/:id/convert", convertToOrder);
router.delete("/:id", deleteQuote);

export default router;
