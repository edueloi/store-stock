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
  issueTerminalToken,
  getMyTerminal,
  getTerminalSnapshot,
} from "../controllers/desktop-terminals.controller";
import { authenticateTerminal } from "../utils/terminal-auth";

const router = Router();

// Sem auth — chamadas feitas pelo Electron ANTES de haver usuário logado nele.
router.post("/pairing-code", requestPairingCode);
router.get("/pairing-status/:terminal_uid", getPairingStatus);

// Credencial do próprio terminal (headers x-terminal-uid / x-terminal-token), sem usuário.
router.get("/me", authenticateTerminal, getMyTerminal);
router.get("/me/snapshot", authenticateTerminal, getTerminalSnapshot);
router.post("/token", authenticateToken, issueTerminalToken);

// Com auth — chamadas pelo painel web, usuário já logado.
router.post("/pair", authenticateToken, pairTerminal);
router.get("/", authenticateToken, listTerminals);
router.delete("/:id", authenticateToken, deleteTerminal);

router.post("/:terminalId/printers", authenticateToken, createPrinter);
router.put("/:terminalId/printers/:printerId", authenticateToken, updatePrinter);
router.delete("/:terminalId/printers/:printerId", authenticateToken, deletePrinter);

export default router;
