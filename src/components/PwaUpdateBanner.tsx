import { useEffect, useRef, useState } from "react";
// @ts-expect-error -- virtual module provided by vite-plugin-pwa at build time
import { useRegisterSW } from "virtual:pwa-register/react";

// Banner discreto de atualização do PWA. Em vez de recarregar a página assim que uma
// versão nova é detectada (o padrão do plugin, que causa reload no meio de uma venda),
// segura o reload até um momento seguro: a aba ficar em background, ou o usuário
// confirmar manualmente.
export default function PwaUpdateBanner() {
  const [visible, setVisible] = useState(false);
  const pendingReload = useRef(false);

  const { updateServiceWorker } = useRegisterSW({
    onNeedReload() {
      pendingReload.current = true;
      setVisible(true);
    },
  });

  const applyUpdate = () => {
    setVisible(false);
    updateServiceWorker(true);
  };

  // Aplica sozinho assim que a aba deixa de estar em foco (troca de janela, minimizar,
  // fim do expediente) — não interrompe o operador no meio do que estiver fazendo.
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.hidden && pendingReload.current) {
        pendingReload.current = false;
        updateServiceWorker(true);
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // O gatilho acima (perda de foco) nunca dispara no app desktop (Electron): é uma
  // única janela maximizada, sempre em primeiro plano, que nunca perde foco — clientes
  // ficavam presos indefinidamente em versões antigas, precisando de limpeza manual de
  // cache (que o app nem oferece). Nesse ambiente, aplica sozinho depois de um período
  // sem nenhuma interação do operador (clique/tecla/toque) — ausência de interação é o
  // proxy mais seguro de "não há venda em andamento" que temos sem acoplar este
  // componente genérico ao estado interno do PDV.
  useEffect(() => {
    const isDesktopApp = !!(window as any).boxsysDesktop?.isDesktop;
    if (!isDesktopApp) return;

    const IDLE_MS = 3 * 60 * 1000;
    let idleTimer: ReturnType<typeof setTimeout> | null = null;

    const applyIfPending = () => {
      if (pendingReload.current) {
        pendingReload.current = false;
        updateServiceWorker(true);
      }
    };

    const resetIdleTimer = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(applyIfPending, IDLE_MS);
    };

    const events = ["click", "keydown", "pointerdown", "touchstart"] as const;
    events.forEach((evt) => window.addEventListener(evt, resetIdleTimer));
    resetIdleTimer();

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, resetIdleTimer));
      if (idleTimer) clearTimeout(idleTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Um F5 comum não força o navegador a rebuscar sw.js no servidor — ele usa o
  // cache HTTP normal e só reverifica sozinho depois de várias horas. Forçar
  // registration.update() sempre que a aba ganha foco de novo é o que faz o
  // aviso de "nova versão" aparecer rápido, sem depender de Ctrl+Shift+R.
  // useRegisterSW não expõe a registration em si, então pega direto da API
  // nativa do navegador (mesmo objeto que o plugin registrou por baixo).
  useEffect(() => {
    const checkForUpdate = () => {
      navigator.serviceWorker?.getRegistration().then((reg) => reg?.update()).catch(() => {});
    };
    const onVisibilityChange = () => { if (!document.hidden) checkForUpdate(); };
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", checkForUpdate);
    // Além do foco/visibilidade, verifica a cada 15 min mesmo com a aba parada
    // em primeiro plano o dia inteiro (PDV fixo numa tela de loja, por
    // exemplo) — sem isso, quem nunca troca de janela só atualizava se o
    // navegador decidisse revalidar sw.js sozinho por conta própria.
    const interval = setInterval(checkForUpdate, 15 * 60 * 1000);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", checkForUpdate);
      clearInterval(interval);
    };
  }, []);

  if (!visible) return null;

  const isDesktopApp = !!(window as any).boxsysDesktop?.isDesktop;

  return (
    <div className="fixed bottom-4 left-4 z-[300] flex items-center gap-3 bg-slate-900 text-white rounded-2xl shadow-xl px-4 py-3 max-w-sm">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-black uppercase tracking-wide">Nova versão disponível</p>
        <p className="text-[11px] text-slate-300 mt-0.5">
          {isDesktopApp
            ? "Será aplicada sozinha assim que o caixa ficar parado por alguns minutos."
            : "Será aplicada automaticamente assim que você trocar de tela."}
        </p>
      </div>
      <button
        onClick={applyUpdate}
        className="shrink-0 h-9 px-3 bg-blue-600 hover:bg-blue-700 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors"
      >
        Atualizar agora
      </button>
    </div>
  );
}
