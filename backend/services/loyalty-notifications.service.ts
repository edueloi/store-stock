import { prisma } from "../config/prisma";
import {
  getWorkspaceWithTenantByTenantId,
  normalizePhone,
  parseTemplates,
  renderTemplate,
  sendTextMessage,
  type WhatsappTemplates,
} from "./whatsapp.service";

const REMINDER_INACTIVITY_DAYS = 60;
const REMINDER_INTERVAL_MS = 24 * 60 * 60 * 1000;

let reminderLoopStarted = false;

// Envia uma notificação de fidelidade por WhatsApp para um cliente, usando o template
// configurado pelo lojista. Nunca lança: se o WhatsApp do tenant não estiver ativo, o
// telefone for inválido, ou o envio falhar por qualquer motivo (sessão não pareada,
// erro de rede), só loga — pontos ganhos/resgatados/lembretes nunca podem travar a
// venda, o resgate ou o job em background que os disparou.
export async function sendLoyaltyWhatsapp(
  tenantId: number,
  phone: string | null | undefined,
  templateKey: keyof Pick<WhatsappTemplates, "points_earned" | "points_redeemed" | "points_reminder">,
  values: Record<string, string | number | undefined | null>,
) {
  try {
    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) return;

    const { tenant, workspace } = await getWorkspaceWithTenantByTenantId(tenantId);
    if (!workspace.is_enabled) return;

    const templates = parseTemplates(workspace.templates);
    const text = renderTemplate(templates[templateKey], { storeName: tenant.name, ...values });

    await sendTextMessage(workspace.id, normalizedPhone, text);
  } catch (error) {
    console.error(`Falha ao enviar notificação de fidelidade (${templateKey}) via WhatsApp:`, error);
  }
}

// Uma vez por dia, para cada tenant com WhatsApp ativo, lembra clientes que têm
// pontos parados (saldo > 0) e não compram há mais de REMINDER_INACTIVITY_DAYS dias —
// e ainda não receberam um lembrete nesse mesmo período.
export async function runPointsReminderJob() {
  const cutoff = new Date(Date.now() - REMINDER_INACTIVITY_DAYS * 24 * 60 * 60 * 1000);

  const workspaces = await prisma.whatsappWorkspace.findMany({
    where: { is_enabled: true },
    select: { tenant_id: true },
  });

  for (const { tenant_id: tenantId } of workspaces) {
    const customers = await prisma.customer.findMany({
      where: {
        tenant_id: tenantId,
        phone: { not: null },
        OR: [
          { last_points_reminder_at: null },
          { last_points_reminder_at: { lt: cutoff } },
        ],
      },
      select: { id: true, name: true, phone: true },
    });

    for (const customer of customers) {
      const lastOrder = await prisma.order.findFirst({
        where: { tenant_id: tenantId, customer_id: customer.id },
        orderBy: { created_at: "desc" },
        select: { created_at: true },
      });

      // Sem nenhuma compra registrada, ou compra recente demais — não é "inativo".
      if (!lastOrder || lastOrder.created_at >= cutoff) continue;

      const lastPoint = await prisma.customerPoint.findFirst({
        where: { tenant_id: tenantId, customer_id: customer.id },
        orderBy: { created_at: "desc" },
        select: { balance_after: true },
      });
      const balance = lastPoint?.balance_after ?? 0;
      if (balance <= 0) continue;

      await sendLoyaltyWhatsapp(tenantId, customer.phone, "points_reminder", {
        customerName: customer.name,
        balance,
      });

      await prisma.customer.update({
        where: { id: customer.id },
        data: { last_points_reminder_at: new Date() },
      });
    }
  }
}

export function startPointsReminderLoop() {
  if (reminderLoopStarted) return;
  reminderLoopStarted = true;

  const timer = setInterval(() => {
    runPointsReminderJob().catch((error) => {
      console.error("Job de lembrete de pontos falhou:", error);
    });
  }, REMINDER_INTERVAL_MS);

  timer.unref?.();
}
