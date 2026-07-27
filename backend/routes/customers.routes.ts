import { Router } from "express";
import {
  listCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  listDebts,
  createDebt,
  payDebt,
  payDebtPartial,
  deleteDebt,
  listDebtInstallments,
  updateDebtInstallments,
  createNote,
  deleteNote,
  listDebtors,
} from "../controllers/customers.controller";
import { authenticateToken } from "../middlewares/auth.middleware";

const router = Router();

router.use(authenticateToken);

router.get("/",                     listCustomers);
router.get("/debtors",              listDebtors);
router.get("/:id",                  getCustomer);
router.post("/",                    createCustomer);
router.put("/:id",                  updateCustomer);
router.delete("/:id",               deleteCustomer);

// Debts (fiado)
router.get("/:id/debts",            listDebts);
router.post("/:id/debts",           createDebt);
router.post("/:id/debts/:debtId/pay", payDebt);
router.post("/:id/debts/:debtId/pay-partial", payDebtPartial);
router.delete("/:id/debts/:debtId", deleteDebt);
router.get("/:id/debts/:debtId/installments", listDebtInstallments);
router.put("/:id/debts/:debtId/installments", updateDebtInstallments);

// Notes
router.post("/:id/notes",           createNote);
router.delete("/:id/notes/:noteId", deleteNote);

export default router;
