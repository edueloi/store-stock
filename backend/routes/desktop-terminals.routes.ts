import { Router } from "express";
import { authenticateToken } from "../middlewares/auth.middleware";
import {
  requestPairingCode,
  getPairingStatus,
  pairTerminal,
  listTerminals,
  deleteTerminal,
  createPrinter,
  updatePrinter,
  deletePrinter,
} from "../controllers/desktop-terminals.controller";

const router = Router();

// Sem auth — chamadas feitas pelo Electron ANTES de haver usuário logado nele.
router.post("/pairing-code", requestPairingCode);
router.get("/pairing-status/:terminal_uid", getPairingStatus);

// Com auth — chamadas pelo painel web, usuário já logado.
router.post("/pair", authenticateToken, pairTerminal);
router.get("/", authenticateToken, listTerminals);
router.delete("/:id", authenticateToken, deleteTerminal);

router.post("/:terminalId/printers", authenticateToken, createPrinter);
router.put("/:terminalId/printers/:printerId", authenticateToken, updatePrinter);
router.delete("/:terminalId/printers/:printerId", authenticateToken, deletePrinter);

export default router;
