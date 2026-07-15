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

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-4 z-[300] flex items-center gap-3 bg-slate-900 text-white rounded-2xl shadow-xl px-4 py-3 max-w-sm">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-black uppercase tracking-wide">Nova versão disponível</p>
        <p className="text-[11px] text-slate-300 mt-0.5">Será aplicada automaticamente assim que você trocar de tela.</p>
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
