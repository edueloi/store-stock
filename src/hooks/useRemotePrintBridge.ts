import { useEffect } from "react";

import { onRealtime } from "../lib/realtime";

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
    if (!desktop) return;

    let myTerminalUid: string | null = null;
    let cancelled = false;

    desktop.getPairingState().then((state) => {
      if (!cancelled) myTerminalUid = state.terminalUid;
    });

    return onRealtime("print:requested", (payload: { terminal_uid?: string; role?: string; text?: string }) => {
      if (cancelled) return;
      if (!payload?.terminal_uid || !myTerminalUid) return;
      if (payload.terminal_uid !== myTerminalUid) return;
      if (!payload.role || !payload.text) return;
      desktop.printByRole(payload.role, payload.text);
    });
  }, []);
}
