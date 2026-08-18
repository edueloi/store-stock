// Vocabulário único de etapas do fluxo de Orçamento/Ordem de Serviço, compartilhado
// entre os dois controllers e usado pela tabela StagePermission (permissão por papel).
// Estados terminais fora do fluxo principal (cancelada, cancelled, expired, converted)
// não entram aqui — não aparecem como coluna do quadro Kanban.

export const WORKFLOW_STAGES = [
  "rascunho",
  "orcamento_enviado",
  "aguardando_aprovacao",
  "aprovado",
  "aguardando_arte",
  "arte_finalizada",
  "em_producao",
  "finalizado",
  "nota_emitida",
  "entregue",
] as const;

export type WorkflowStage = (typeof WORKFLOW_STAGES)[number];

export const STAGE_LABELS: Record<WorkflowStage, string> = {
  rascunho: "Rascunho",
  orcamento_enviado: "Orçamento enviado",
  aguardando_aprovacao: "Aguardando aprovação",
  aprovado: "Aprovado",
  aguardando_arte: "Aguardando arte",
  arte_finalizada: "Arte finalizada",
  em_producao: "Em produção",
  finalizado: "Finalizado",
  nota_emitida: "Nota emitida",
  entregue: "Entregue",
};

// Papéis fixos do fluxo (além de "admin", que sempre pode tudo, e não precisa de linha
// em StagePermission). Usado para popular defaults e para a tela de administração.
export const WORKFLOW_ROLES = ["vendas", "producao", "financeiro", "entrega"] as const;
export type WorkflowRole = (typeof WORKFLOW_ROLES)[number];

export const WORKFLOW_ROLE_LABELS: Record<WorkflowRole, string> = {
  vendas: "Vendas/Atendimento",
  producao: "Produção",
  financeiro: "Financeiro/Nota",
  entrega: "Entrega",
};

// Permissões padrão sugeridas ao criar um novo tenant (aplicadas via seed/migration,
// mas totalmente editáveis depois pela tela de administração de permissões).
export const DEFAULT_STAGE_PERMISSIONS: Record<WorkflowRole, WorkflowStage[]> = {
  vendas: ["rascunho", "orcamento_enviado", "aguardando_aprovacao", "aprovado"],
  producao: ["aprovado", "em_producao", "finalizado"],
  financeiro: ["finalizado", "nota_emitida"],
  entrega: ["nota_emitida", "entregue"],
};

export function isWorkflowStage(value: string): value is WorkflowStage {
  return (WORKFLOW_STAGES as readonly string[]).includes(value);
}

export function nextStage(stage: string): WorkflowStage | null {
  const idx = WORKFLOW_STAGES.indexOf(stage as WorkflowStage);
  if (idx === -1 || idx === WORKFLOW_STAGES.length - 1) return null;
  return WORKFLOW_STAGES[idx + 1];
}
