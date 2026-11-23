import { useState } from "react";
import { CheckCircle2, Download, MonitorSmartphone } from "lucide-react";

import { usePwaInstall } from "../lib/pwaInstall";
import { useToast } from "./ui/Toast";

/**
 * "Instalar como aplicativo" para quem usa o Chrome/Edge no computador: cria o atalho (área de trabalho / menu Iniciar)
 * que abre o sistema em janela própria, sem barra de endereço. Alternativa leve ao instalador .exe do PDV.
 */
export default function PwaInstallCard() {
  const toast = useToast();
  const pwa = usePwaInstall();
  const [busy, setBusy] = useState(false);

  const install = async () => {
    setBusy(true);
    try {
      const r = await pwa.install();
      if (r === "accepted") toast.success("Pronto! O atalho foi criado no seu computador.");
      else if (r === "unavailable") toast.info("O navegador ainda não liberou a instalação. Veja o passo a passo abaixo.");
    } finally { setBusy(false); }
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50">
          <MonitorSmartphone size={18} className="text-blue-600" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-slate-900">Atalho do sistema no computador (Chrome ou Edge)</p>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
            Sem baixar nada: o sistema abre em janela própria, como um aplicativo, com ícone na área de trabalho e no menu Iniciar.
            Funciona em qualquer computador que use o Chrome ou o Edge.
          </p>

          {pwa.installed ? (
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-[11px] font-semibold text-emerald-700">
              <CheckCircle2 size={13} /> Você já está usando o sistema como aplicativo.
            </p>
          ) : pwa.canPrompt ? (
            <button type="button" onClick={install} disabled={busy}
              className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-lg bg-slate-900 px-4 text-[11px] font-semibold text-white transition-colors hover:bg-blue-600 disabled:opacity-60">
              <Download size={12} /> Criar atalho no computador
            </button>
          ) : pwa.isFirefox || pwa.isSafariDesktop || pwa.isIos ? (
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-800">
              {pwa.isIos
                ? "No iPhone/iPad: toque em Compartilhar e depois em “Adicionar à Tela de Início”."
                : pwa.isSafariDesktop
                  ? "No Safari (Mac): menu Arquivo → “Adicionar ao Dock”. No Chrome ou Edge o botão de instalar aparece aqui."
                  : "O Firefox não instala aplicativos web. Abra o sistema no Chrome ou no Edge para criar o atalho."}
            </p>
          ) : (
            <div className="mt-3 space-y-2">
              <p className="text-[11px] leading-relaxed text-slate-600">
                O botão aparece aqui assim que o navegador liberar. Se não aparecer, faça manualmente (leva 10 segundos):
              </p>
              <ol className="list-inside list-decimal space-y-1 text-[11px] text-slate-600">
                <li>Clique no ícone de <span className="font-semibold">instalar</span> (um monitor com seta) no fim da barra de endereço, <b>ou</b> nos três pontinhos ⋮ do navegador.</li>
                <li>Escolha <span className="font-semibold">“Instalar Store BoxSys”</span> (no Chrome: ⋮ → Transmitir, salvar e compartilhar → Instalar página como app).</li>
                <li>Confirme em <span className="font-semibold">Instalar</span>. O atalho aparece na área de trabalho e no menu Iniciar.</li>
              </ol>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
