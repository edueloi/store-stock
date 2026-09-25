import { useEffect, useRef, useState } from "react";
// @ts-expect-error -- virtual module provided by vite-plugin-pwa at build time
import { useRegisterSW } from "virtual:pwa-register/react";

// Catálogos públicos recebem a versão nova automaticamente. Painel e PDV mostram
// este banner e só recarregam após a confirmação explícita do operador.
export default function PwaUpdateBanner() {
  const [visible, setVisible] = useState(false);
  const reloadAfterUpdate = useRef(false);
  const host = window.location.hostname.toLowerCase();
  const isCatalogStore = window.location.pathname.startsWith("/s/")
    || (!host.includes("localhost") && host !== "127.0.0.1" && host !== "store.boxsys.com.br");

  const { updateServiceWorker } = useRegisterSW({
    onNeedReload() {
      // Catálogos são páginas públicas sem operação de caixa ou formulário de
      // gestão: podem receber a versão nova diretamente. O painel e o PDV
      // continuam aguardando a decisão explícita do operador.
      if (isCatalogStore) {
        reloadAfterUpdate.current = true;
        updateServiceWorker(true);
        return;
      }
      setVisible(true);
    },
  });

  const applyUpdate = () => {
    reloadAfterUpdate.current = true;
    setVisible(false);
    updateServiceWorker(true);
  };


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
    // Verifica também na abertura. Isso atende principalmente o Electron, que
    // pode abrir sempre na mesma janela e não disparar foco/visibilidade.
    checkForUpdate();
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

  // Quando a versão nova assume o controle, recarrega usando os assets atuais
  // sem exigir Ctrl+Shift+R ou limpeza manual de cache.
  useEffect(() => {
    let reloading = false;
    const reloadForNewController = () => {
      if (reloading || !reloadAfterUpdate.current) return;
      reloading = true;
      window.location.reload();
    };
    navigator.serviceWorker?.addEventListener("controllerchange", reloadForNewController);
    return () => navigator.serviceWorker?.removeEventListener("controllerchange", reloadForNewController);
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-4 z-[300] flex items-center gap-3 bg-slate-900 text-white rounded-2xl shadow-xl px-4 py-3 max-w-sm">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-black uppercase tracking-wide">Nova versão disponível</p>
        <p className="text-[11px] text-slate-300 mt-0.5">
          Atualize quando concluir a operação atual. Nenhum dado em andamento será interrompido.
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
