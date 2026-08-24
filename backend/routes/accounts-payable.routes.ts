import { Router } from "express";
import {
  listAccountsPayable,
  createAccountPayable,
  updateAccountPayable,
  deleteAccountPayable,
  payAccount,
  applyInterestPayable,
  bulkPayAccountsPayable,
  importAccountsPayable,
} from "../controllers/accounts-payable.controller";
import { authenticateToken } from "../middlewares/auth.middleware";

const router = Router();
router.use(authenticateToken);

router.get("/", listAccountsPayable);
router.post("/", createAccountPayable);
router.post("/bulk-pay", bulkPayAccountsPayable);
router.post("/import", importAccountsPayable);
router.put("/:id", updateAccountPayable);
router.delete("/:id", deleteAccountPayable);
router.post("/:id/pay", payAccount);
router.post("/:id/apply-interest", applyInterestPayable);

export default router;
