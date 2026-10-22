import { prisma } from "../config/prisma";
import { agentAttendanceHours, describeBusinessHours } from "../../shared/businessHours";

export async function loadHumanAttendance(workspaceId: number, department?: string, agentId?: number, now = new Date()) {
  const [workspace, agents] = await Promise.all([
    prisma.whatsappWorkspace.findUnique({ where: { id: workspaceId }, include: { tenant: { select: { business_hours: true } } } }),
    prisma.whatsappAgent.findMany({
      where: { workspace_id: workspaceId, is_active: true, can_receive_transfer: true, ...(department ? { department } : {}), ...(agentId ? { id: agentId } : {}) },
      orderBy: [{ priority: "desc" }, { name: "asc" }],
    }),
  ]);
  const storeHours = workspace?.tenant?.business_hours;
  const evaluated = agents.map(agent => ({ agent, hours: agentAttendanceHours(agent, storeHours, now) }));
  const onlineAgents = evaluated.filter(({ agent, hours }) => agent.is_online && hours.openNow !== false).map(({ agent }) => agent);
  const outsideHours = evaluated.length ? evaluated.every(({ hours }) => hours.openNow === false) : describeBusinessHours(storeHours, now).openNow === false;
  const scheduleLines = evaluated.length
    ? [...new Set(evaluated.map(({ agent, hours }) => `${agent.name}: ${hours.text}${hours.nextOpening ? ` | Próximo início previsto: ${hours.nextOpening}` : ""}`))]
    : [`Equipe: ${describeBusinessHours(storeHours, now).text}`];
  const unavailableMessage = [
    outsideHours ? "Nosso atendimento humano está fora do expediente neste momento." : "No momento, não há atendentes disponíveis para receber a transferência.",
    "Horários de atendimento humano (Brasília):",
    ...scheduleLines.slice(0, 6),
    "Posso continuar te ajudando por aqui com o catálogo e as informações da loja. Para falar com a equipe, envie uma mensagem no horário de atendimento.",
  ].join("\n\n");
  return { agents, evaluated, onlineAgents, outsideHours, scheduleLines, unavailableMessage };
}

export async function buildHumanAttendanceContext(tenantId: number): Promise<string> {
  const workspace = await prisma.whatsappWorkspace.findUnique({ where: { tenant_id: tenantId }, select: { id: true } });
  if (!workspace) return "Atendimento humano: não cadastrado.";
  const state = await loadHumanAttendance(workspace.id);
  return [
    "Atendimento HUMANO (separado do funcionamento da loja; fuso de Brasília):",
    ...state.scheduleLines,
    ...state.evaluated.map(({ agent, hours }) => `${agent.name} | setor ${agent.department} | agora: ${hours.openNow === false ? "fora do expediente" : !agent.is_online ? "offline" : hours.openNow === null ? "online, horário não cadastrado" : "online, dentro do expediente"}`),
    `Situação agora: ${state.outsideHours ? "FORA DO EXPEDIENTE" : state.onlineAgents.length ? "há atendentes online dentro do horário conhecido (sujeito à fila)" : "sem atendentes disponíveis para transferência"}.`,
    "Horário não cadastrado não confirma abertura nem expediente; nunca invente horários ou prometa retorno/transferência automática.",
  ].join("\n");
}
