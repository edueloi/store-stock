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
import { createQuoteApprovalLink } from "../controllers/quote-approval.controller";
import { authenticateToken } from "../middlewares/auth.middleware";
import { requireMenuPermission } from "../middlewares/menu-permission.middleware";

const router = Router();

router.use(authenticateToken);
router.use(requireMenuPermission("orcamentos"));

router.get("/", listQuotes);
router.get("/:id", getQuoteById);
router.post("/", createQuote);
router.put("/:id", updateQuote);
router.put("/:id/status", updateQuoteStatus);
router.post("/:id/deposit", recordQuoteDeposit);
router.post("/:id/convert", convertToOrder);
router.post("/:id/approval-link", createQuoteApprovalLink);
router.delete("/:id", deleteQuote);

export default router;
