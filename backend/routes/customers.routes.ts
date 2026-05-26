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
  deleteDebt,
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
router.delete("/:id/debts/:debtId", deleteDebt);

// Notes
router.post("/:id/notes",           createNote);
router.delete("/:id/notes/:noteId", deleteNote);

export default router;
