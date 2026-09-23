import { useEffect } from "react";

import { identifyDesktopTerminal, onRealtime } from "../lib/realtime";

/**
 * Só faz sentido dentro do app desktop (Electron) já pareado — é o terminal
 * que efetivamente tem uma impressora térmica plugada. No navegador/PWA comum
 * (sem window.boxsysDesktop) o hook não assina nada.
 *
 * Todo cliente da sala do tenant recebe o evento "print:requested" (inclusive
 * celulares de vendedores); só o Electron cujo terminal_uid bate com o alvo
 * reage — os demais ignoram silenciosamente.
 */
export function useRemotePrintBridge() {
  useEffect(() => {
    const desktop = window.boxsysDesktop;
    // Apps desktop instalados antes da Fase 1 (pareamento) têm window.boxsysDesktop mas
    // sem este método no preload — checar a função em si, não só a presença do objeto,
    // senão uma versão antiga do app quebra a aplicação inteira ao tentar chamá-la.
    if (!desktop || typeof desktop.getPairingState !== "function") return;

    let cancelled = false;
    let unsubscribe = () => {};
    let subscribedTerminalUid: string | null = null;

    const registerTerminal = async () => {
      try {
        let state = await desktop.getPairingState();
        // Pode existir um terminal cadastrado no servidor enquanto o config.json
        // local ainda não recebeu a confirmação (por exemplo, se a janela de
        // pareamento foi fechada logo após digitar o código). Recupera esse estado
        // automaticamente em vez de exigir novo vínculo do operador.
        if (!state.paired?.id && typeof desktop.checkPairingStatus === "function") {
          await desktop.checkPairingStatus();
          state = await desktop.getPairingState();
        }
        // O UID existe antes do pareamento, mas só um terminal já vinculado pode
        // se registrar no servidor para receber impressões remotas.
        if (cancelled || !state.paired?.id || !state.terminalUid) return;
        identifyDesktopTerminal(state.terminalUid);
        if (subscribedTerminalUid === state.terminalUid) return;
        unsubscribe();
        unsubscribe = onRealtime("print:requested", (payload: { role?: string; text?: string }) => {
          if (cancelled || !payload?.role || !payload.text) return;
          if (typeof desktop.printByRole !== "function") return;
          void desktop.printByRole(payload.role, payload.text);
        });
        subscribedTerminalUid = state.terminalUid;
      } catch {
        // O app pode estar iniciando ou sem rede; a próxima tentativa refaz o registro.
      }
    };

    void registerTerminal();
    // Depois que o vínculo é concluído na janela auxiliar do Electron, o renderer
    // principal continua aberto na bandeja. Esta verificação o registra sem exigir
    // que o operador reinicie o PDV.
    const interval = window.setInterval(() => { void registerTerminal(); }, 15_000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      unsubscribe();
    };
  }, []);
}
