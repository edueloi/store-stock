import { Router } from "express";
import {
  listConsignments,
  getOverdueCount,
  getConsignmentById,
  createConsignment,
  updateConsignment,
  addConsignmentItem,
  removeConsignmentItem,
  resolveConsignment,
  cancelConsignment,
  reopenConsignment,
} from "../controllers/consignments.controller";
import { authenticateToken } from "../middlewares/auth.middleware";
import { requireMenuPermission } from "../middlewares/menu-permission.middleware";

const router = Router();

router.use(authenticateToken);

// Leitura fica liberada pra qualquer usuário autenticado — o PDV (F8 "Consultar Consignado")
// usa essas mesmas rotas GET pra qualquer operador, independente de ter a permissão do menu
// administrativo "Consignação". Só as ações de gestão (criar/editar/resolver/cancelar/reabrir)
// exigem a permissão do menu, mesmo padrão de service-orders.routes.ts/quotes.routes.ts.
router.get("/overdue-count", getOverdueCount);
router.get("/", listConsignments);
router.get("/:id", getConsignmentById);

router.post("/", requireMenuPermission("consignacoes"), createConsignment);
router.put("/:id", requireMenuPermission("consignacoes"), updateConsignment);
router.post("/:id/items", requireMenuPermission("consignacoes"), addConsignmentItem);
router.delete("/:id/items/:itemId", requireMenuPermission("consignacoes"), removeConsignmentItem);
router.post("/:id/resolve", requireMenuPermission("consignacoes"), resolveConsignment);
router.post("/:id/cancel", requireMenuPermission("consignacoes"), cancelConsignment);
router.post("/:id/reopen", requireMenuPermission("consignacoes"), reopenConsignment);

export default router;
