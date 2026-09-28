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

// Orçamento usa cancelled|expired|converted como estados terminais; OS usa cancelada.
// Ao sincronizar Orçamento -> OS, "cancelled"/"expired" viram "cancelada" do lado da OS;
// "converted" não sincroniza (a OS de produção continua seu próprio fluxo independente
// da venda gerada pelo orçamento).
function mapQuoteStatusToServiceOrder(status: string): string | null {
  if (status === "cancelled" || status === "expired") return "cancelada";
  if (status === "converted") return null;
  return status;
}

// Mapeamento inverso: só existe "cancelada" do lado da OS que precise virar algo do
// lado do Orçamento — os demais estágios (rascunho..entregue) têm o mesmo nome dos dois lados.
function mapServiceOrderStatusToQuote(status: string): string {
  return status === "cancelada" ? "cancelled" : status;
}

// Espelha a mudança de status já validada (permissão + sequência já checadas por quem
// chamou) no registro irmão ligado por ServiceOrder.quote_id — só chamado quando o
// tenant tem grafica_enabled (único caso em que o vínculo existe, ver
// createLinkedServiceOrder em quotes.controller.ts). Roda DEPOIS da atualização
// principal já commitada, nunca re-chama updateQuoteStatus/updateServiceOrderStatus
// (evita recursão e evita barrar a sincronização por permissão que o usuário só tem
// de um dos dois lados).
export async function syncLinkedStatus(
  tenantId: number,
  source: "quote" | "service_order",
  sourceId: number,
  toStatus: string,
  opts: { actor: string; cancelReason?: string | null },
) {
  try {
    if (source === "quote") {
      const serviceOrder = await prisma.serviceOrder.findFirst({
        where: { quote_id: sourceId, tenant_id: tenantId },
        include: { parts: true },
      });
      if (!serviceOrder) return;
      // Já entregue ou faturada: o orçamento não deve mais mexer na OS, que seguiu
      // seu próprio caminho depois de concluída/vendida.
      if (serviceOrder.status === "entregue" || serviceOrder.invoiced_order_id) return;

      const mapped = mapQuoteStatusToServiceOrder(toStatus);
      if (!mapped || mapped === serviceOrder.status) return;

      if (mapped === "cancelada") {
        const { applyServiceOrderCancellation } = await import("../controllers/service-orders.controller");
        const { data } = await applyServiceOrderCancellation(tenantId, serviceOrder, opts.actor, opts.cancelReason);
        await prisma.serviceOrder.update({ where: { id: serviceOrder.id }, data });
      } else {
        await prisma.serviceOrder.update({ where: { id: serviceOrder.id }, data: { status: mapped } });
      }

      await prisma.serviceOrderAction.create({
        data: {
          tenant_id: tenantId,
          service_order_id: serviceOrder.id,
          action: "status_synced",
          from_status: serviceOrder.status,
          to_status: mapped,
          actor: opts.actor,
          meta: { synced_from: "quote" },
        },
      });
      return;
    }

    // source === "service_order"
    const order = await prisma.serviceOrder.findFirst({ where: { id: sourceId, tenant_id: tenantId }, select: { quote_id: true } });
    if (!order?.quote_id) return;

    const quote = await prisma.quote.findFirst({ where: { id: order.quote_id, tenant_id: tenantId } });
    if (!quote) return;
    // Orçamento já convertido em venda: segue seu próprio caminho, não sincroniza mais.
    if (quote.status === "converted") return;

    const mapped = mapServiceOrderStatusToQuote(toStatus);
    if (mapped === quote.status) return;

    await prisma.quote.update({ where: { id: quote.id }, data: { status: mapped } });
    await prisma.quoteAction.create({
      data: {
        tenant_id: tenantId,
        quote_id: quote.id,
        action: "status_synced",
        from_status: quote.status,
        to_status: mapped,
        actor: opts.actor,
        meta: { synced_from: "service_order" },
      },
    });
  } catch (err) {
    // Sincronização é um efeito colateral de segundo plano — um erro aqui não pode
    // derrubar a resposta da transição principal, que já foi commitada com sucesso.
    console.error("[syncLinkedStatus] error:", err);
  }
}
