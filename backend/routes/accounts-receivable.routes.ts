import { Router } from "express";
import {
  listAccountsReceivable,
  createAccountReceivable,
  updateAccountReceivable,
  deleteAccountReceivable,
  receiveAccount,
  applyInterestReceivable,
  bulkReceiveAccountsReceivable,
} from "../controllers/accounts-receivable.controller";
import { authenticateToken } from "../middlewares/auth.middleware";

const router = Router();
router.use(authenticateToken);

router.get("/", listAccountsReceivable);
router.post("/", createAccountReceivable);
router.post("/bulk-receive", bulkReceiveAccountsReceivable);
router.put("/:id", updateAccountReceivable);
router.delete("/:id", deleteAccountReceivable);
router.post("/:id/receive", receiveAccount);
router.post("/:id/apply-interest", applyInterestReceivable);

export default router;
