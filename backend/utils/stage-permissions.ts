import { prisma } from "../config/prisma";
import { isWorkflowStage } from "./workflow-stages";

// Ao emitir a NFS-e (mão de obra) ou faturar a NFC-e (peças) de uma OS finalizada —
// o que acontecer primeiro — a etapa avança para "nota_emitida" automaticamente.
// Chamado tanto pelo serviço assíncrono de emissão da NFS-e (services/nfse/emitir.ts)
// quanto pelo invoiceServiceOrder do controller de OS.
export async function advanceServiceOrderToNotaEmitida(serviceOrderId: number, actor: string) {
  const order = await prisma.serviceOrder.findUnique({
    where: { id: serviceOrderId },
    select: { tenant_id: true, status: true },
  });
  if (!order) return;
  if (order.status !== "finalizado") return; // já avançou (ou ainda não chegou lá) — não regride nem pula

  await prisma.serviceOrder.update({
    where: { id: serviceOrderId },
    data: { status: "nota_emitida" },
  });
  await prisma.serviceOrderAction.create({
    data: {
      tenant_id: order.tenant_id,
      service_order_id: serviceOrderId,
      action: "status_changed",
      from_status: "finalizado",
      to_status: "nota_emitida",
      actor,
      note: "Avanço automático ao emitir nota",
    },
  });
}

// "admin" sempre pode mover para qualquer etapa, sem precisar de linha em UserStagePermission.
// Demais usuários só podem mover PARA uma etapa se houver uma linha (user_id, stage)
// autorizando aquele destino especificamente para eles.
export async function canMoveToStage(userId: number, role: string, stage: string): Promise<boolean> {
  if (role === "admin") return true;
  if (!isWorkflowStage(stage)) return true; // estados terminais (cancelada/cancelled/expired/converted) não são restritos por etapa

  const permission = await prisma.userStagePermission.findUnique({
    where: { user_id_stage: { user_id: userId, stage } },
  });
  return !!permission;
}
