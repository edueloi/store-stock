import crypto from "crypto";

import { emitToTerminal } from "./realtime.service";

// Ponte com o app desktop que tem o certificado A3 (token/cartão) instalado: o servidor pede, o PC executa e responde.
// Só é usada por CNPJs marcados como A3. Quem usa certificado A1 (.pfx) nunca passa por aqui.

export type AgentAction = "list" | "sign" | "http";
export interface AgentResult { ok: boolean; error?: string; [key: string]: unknown }

const pending = new Map<string, { terminalUid: string; resolve: (r: AgentResult) => void; timer: NodeJS.Timeout }>();

/** Chamado quando o app responde (evento "fiscal:response" do terminal). Só aceita resposta do terminal que recebeu o pedido. */
export function resolveAgentResponse(terminalUid: string, msg: unknown) {
  const m = msg as { id?: string; result?: AgentResult } | null;
  const p = m?.id ? pending.get(m.id) : undefined;
  if (!p || p.terminalUid !== terminalUid) return;
  clearTimeout(p.timer);
  pending.delete(m!.id!);
  p.resolve(m?.result && typeof m.result === "object" ? m.result : { ok: false, error: "Resposta inválida do app." });
}

const OFFLINE = "O computador do certificado A3 está desconectado. Ligue-o, conecte o token e abra o app Store BoxSys.";
const TIMEOUT = "O computador do certificado A3 não respondeu a tempo. Confira o token e o PIN na tela dele e tente de novo.";

async function realAsk(terminalUid: string, action: AgentAction, payload: Record<string, unknown>, timeoutMs: number): Promise<AgentResult> {
  const id = crypto.randomUUID();
  return new Promise<AgentResult>((resolve) => {
    const timer = setTimeout(() => { pending.delete(id); resolve({ ok: false, error: TIMEOUT }); }, timeoutMs);
    pending.set(id, { terminalUid, resolve, timer });
    if (!emitToTerminal(terminalUid, "fiscal:requested", { id, action, payload })) {
      clearTimeout(timer); pending.delete(id); resolve({ ok: false, error: OFFLINE });
    }
  });
}

// objeto mutável só para os testes poderem trocar o transporte por um falso
export const agent = {
  ask: realAsk as (terminalUid: string, action: AgentAction, payload: Record<string, unknown>, timeoutMs?: number) => Promise<AgentResult>,
};

export function askAgent(terminalUid: string, action: AgentAction, payload: Record<string, unknown>, timeoutMs = 130_000): Promise<AgentResult> {
  return agent.ask(terminalUid, action, payload, timeoutMs);
}
