import { useEffect, useState } from "react";

// O Chrome/Edge dispara "beforeinstallprompt" uma vez, logo ao abrir o site, bem antes de o usuário chegar em Configurações.
// Por isso o evento é guardado aqui (módulo carregado na entrada do app) e a tela só usa o que já foi capturado.
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

let deferred: InstallEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export const isRunningAsApp = () =>
  window.matchMedia("(display-mode: standalone)").matches
  || window.matchMedia("(display-mode: window-controls-overlay)").matches
  || ("standalone" in window.navigator && (window.navigator as { standalone?: boolean }).standalone === true);

export function startPwaInstallCapture() {
  installed = isRunningAsApp();
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e as InstallEvent; notify(); });
  window.addEventListener("appinstalled", () => { deferred = null; installed = true; notify(); });
}

export function usePwaInstall() {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);

  const ua = navigator.userAgent;
  return {
    /** o navegador já liberou o botão de instalar */
    canPrompt: !!deferred,
    /** já está aberto como aplicativo (ou foi instalado agora) */
    installed: installed || isRunningAsApp(),
    isIos: /iphone|ipad|ipod/i.test(ua),
    isFirefox: /firefox/i.test(ua),
    isSafariDesktop: /^((?!chrome|android).)*safari/i.test(ua) && !/iphone|ipad|ipod/i.test(ua),
    async install(): Promise<"accepted" | "dismissed" | "unavailable"> {
      if (!deferred) return "unavailable";
      const ev = deferred;
      await ev.prompt();
      const choice = await ev.userChoice.catch(() => ({ outcome: "dismissed" as const }));
      deferred = null;
      notify();
      return choice.outcome;
    },
  };
}
