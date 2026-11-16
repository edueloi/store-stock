import { useEffect, useState } from "react";
import { Building2 } from "lucide-react";
import type { IssuerChoice } from "../lib/issuerView";

interface Pending { issuers: IssuerChoice[]; resolve: (id: number | null) => void }

const maskDoc = (v: string) => {
  const d = v.replace(/\D/g, "");
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  return v;
};

/** Pergunta "de qual CNPJ emitir esta nota?" sempre que a loja tem mais de uma empresa. Montado uma vez na raiz do app. */
export default function IssuerChooserHost() {
  const [pending, setPending] = useState<Pending | null>(null);

  useEffect(() => {
    const onAsk = (e: Event) => setPending((e as CustomEvent<Pending>).detail);
    window.addEventListener("issuer:ask", onAsk);
    return () => window.removeEventListener("issuer:ask", onAsk);
  }, []);

  if (!pending) return null;
  const close = (id: number | null) => { pending.resolve(id); setPending(null); };

  return (
    <div className="fixed inset-0 z-[300] flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) close(null); }}>
      <div role="dialog" aria-modal="true" aria-label="Escolher o CNPJ da nota" className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl">
        <div className="mb-1 flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><Building2 size={18} /></span>
          <h2 className="text-[15px] font-semibold text-slate-900">Emitir por qual CNPJ?</h2>
        </div>
        <p className="mb-4 text-xs text-slate-500">Sua loja tem mais de uma empresa. A nota sai com o certificado, a série e a numeração do CNPJ escolhido, e a venda passa a contar no resultado dele.</p>
        <div className="space-y-2">
          {pending.issuers.map((i) => (
            <button key={i.id} type="button" onClick={() => close(i.id)}
              className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 px-3.5 py-3 text-left transition hover:border-blue-400 hover:bg-blue-50">
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-slate-900">{i.label}</span>
                {i.document && <span className="block text-xs text-slate-500">{maskDoc(i.document)}</span>}
              </span>
              <span className="shrink-0 text-xs font-semibold text-blue-600">Emitir</span>
            </button>
          ))}
        </div>
        <button type="button" onClick={() => close(null)} className="mt-3 h-10 w-full rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50">Cancelar</button>
      </div>
    </div>
  );
}
