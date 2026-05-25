import { Router } from "express";
import {
  listAccountsPayable,
  createAccountPayable,
  updateAccountPayable,
  deleteAccountPayable,
  payAccount,
} from "../controllers/accounts-payable.controller";
import { authenticateToken } from "../middlewares/auth.middleware";

const router = Router();
router.use(authenticateToken);

router.get("/", listAccountsPayable);
router.post("/", createAccountPayable);
router.put("/:id", updateAccountPayable);
router.delete("/:id", deleteAccountPayable);
router.post("/:id/pay", payAccount);

export default router;
