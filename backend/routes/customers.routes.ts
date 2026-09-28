import { Router, type Request, type Response, type NextFunction } from "express";
import multer from "multer";
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
  exportCustomers,
  importCustomers,
} from "../controllers/customers.controller";
import { authenticateToken } from "../middlewares/auth.middleware";

const router = Router();

router.use(authenticateToken);

// Memory storage — o arquivo é parseado direto do buffer (XLSX.read, que lê
// tanto .xlsx quanto .csv), nunca gravado em disco (diferente dos uploads de
// imagem em upload.controller.ts).
const uploadCustomersSheet = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const okExt = /\.(xlsx|xls|csv)$/i.test(file.originalname);
    const okMime = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "text/csv",
      "application/csv",
      "text/plain", // alguns navegadores mandam CSV como text/plain
    ].includes(file.mimetype);
    if (okExt || okMime) return cb(null, true);
    cb(new Error("Formato não suportado — envie um arquivo .xlsx ou .csv"));
  },
});

router.get("/",                     listCustomers);
router.get("/debtors",              listDebtors);
router.get("/debts/installments",   listOpenInstallments);
// Precisam vir ANTES de "/:id" — senão "export"/"import" seriam capturados
// como se fossem um :id.
router.get("/export",               exportCustomers);
router.post("/import", (req: Request, res: Response, next: NextFunction) => {
  uploadCustomersSheet.single("file")(req, res, (err: unknown) => {
    if (err) {
      const message = err instanceof multer.MulterError
        ? (err.code === "LIMIT_FILE_SIZE" ? "Arquivo maior que 10MB" : err.message)
        : err instanceof Error ? err.message : "Falha ao processar o arquivo enviado";
      res.status(400).json({ error: message });
      return;
    }
    next();
  });
}, importCustomers);
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
