import { Router } from "express";
import {
  listCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  listDebts,
  getCustomerCredits,
  createDebt,
  payDebt,
  payDebtPartial,
  payDebtMulti,
  reverseDebtPayment,
  applyInstallmentInterest,
  deleteDebt,
  listDebtInstallments,
  updateDebtInstallments,
  createNote,
  deleteNote,
  listDebtors,
  listOpenInstallments,
} from "../controllers/customers.controller";
import { authenticateToken } from "../middlewares/auth.middleware";

const router = Router();

router.use(authenticateToken);

router.get("/",                     listCustomers);
router.get("/debtors",              listDebtors);
router.get("/debts/installments",   listOpenInstallments);
router.get("/:id",                  getCustomer);
router.post("/",                    createCustomer);
router.put("/:id",                  updateCustomer);
router.delete("/:id",               deleteCustomer);

router.get("/:id/credits",          getCustomerCredits);

// Debts (fiado)
router.get("/:id/debts",            listDebts);
router.post("/:id/debts",           createDebt);
router.post("/:id/debts/:debtId/pay", payDebt);
router.post("/:id/debts/:debtId/pay-partial", payDebtPartial);
router.post("/:id/debts/:debtId/pay-multi", payDebtMulti);
router.post("/:id/debts/:debtId/payments/:paymentId/reverse", reverseDebtPayment);
router.post("/:id/debts/:debtId/installments/:instId/apply-interest", applyInstallmentInterest);
router.delete("/:id/debts/:debtId", deleteDebt);
router.get("/:id/debts/:debtId/installments", listDebtInstallments);
router.put("/:id/debts/:debtId/installments", updateDebtInstallments);

// Notes
router.post("/:id/notes",           createNote);
router.delete("/:id/notes/:noteId", deleteNote);

export default router;
