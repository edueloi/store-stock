import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Building2, Check, ChevronDown, Settings2 } from "lucide-react";
import { getIssuerView, setIssuerView } from "../../lib/issuerView";

interface Item { id: number; label: string; isActive: boolean; document?: string }

const authHeaders = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}` });
const maskDoc = (v?: string) => {
  const d = String(v ?? "").replace(/\D/g, "");
  return d.length === 14 ? d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5") : d;
};

/**
 * Empresa (CNPJ) no topo do painel — só para o administrador e só quando a loja tem mais de um CNPJ.
 * Escolhe o que o painel MOSTRA: "Todos os CNPJs" soma tudo; um CNPJ mostra só as vendas, o dashboard, o caixa e o financeiro dele.
 * Não troca o certificado de ninguém: na hora de emitir uma nota o sistema pergunta de qual CNPJ.
 */
export default function IssuerSwitcher() {
  const [items, setItems] = useState<Item[]>([]);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(getIssuerView());
  const box = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  // O menu é desenhado num portal no <body>: dentro do cabeçalho ele ficava preso à camada (z-index) do cabeçalho e
  // os cards da página (ícones, gráficos) apareciam POR CIMA dele. Posição fixa calculada a partir do botão.
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/tenant/issuers/summary", { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive || !d || !Array.isArray(d.issuers)) return;
        setItems(d.issuers);
        // visão guardada de um CNPJ que não existe mais: volta para "todos"
        if (view !== "all" && !d.issuers.some((i: Item) => String(i.id) === view)) { setIssuerView("all"); setView("all"); }
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!open) return;
    const place = () => {
      const r = box.current?.getBoundingClientRect();
      if (r) setPos({ top: r.bottom + 6, right: Math.max(8, window.innerWidth - r.right) });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!box.current?.contains(t) && !menu.current?.contains(t)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); };
  }, [open]);

  if (items.length < 2) return null;
  const current = view === "all" ? null : items.find((i) => String(i.id) === view) ?? null;

  const choose = (v: string) => {
    setOpen(false);
    if (v === view) return;
    setIssuerView(v);
    window.location.reload(); // todas as telas buscam de novo já filtradas
  };

  return (
    <div ref={box} className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-haspopup="listbox" aria-expanded={open} title="Empresa (CNPJ) que o painel mostra"
        className={`inline-flex h-8 max-w-[230px] items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium hover:bg-slate-50 ${current ? "border-blue-300 bg-blue-50 text-blue-800" : "border-slate-200 bg-white text-slate-700"}`}>
        <Building2 size={14} className="shrink-0 text-blue-600" />
        <span className="hidden truncate sm:inline">{current ? current.label : "Todos os CNPJs"}</span>
        <ChevronDown size={13} className="shrink-0 text-slate-400" />
      </button>
      {open && pos && createPortal(
        <div ref={menu} role="listbox" aria-label="Empresa que o painel mostra" style={{ position: "fixed", top: pos.top, right: pos.right }} className="z-[1000] w-80 max-w-[92vw] rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
          <p className="px-2 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Mostrar vendas, caixa e financeiro de</p>
          <button type="button" role="option" aria-selected={view === "all"} onClick={() => choose("all")}
            className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition ${view === "all" ? "bg-blue-50 text-blue-800" : "text-slate-700 hover:bg-slate-50"}`}>
            <span className="font-semibold">Todos os CNPJs</span>
            {view === "all" && <Check size={14} className="shrink-0" />}
          </button>
          {items.map((i) => (
            <button key={i.id} type="button" role="option" aria-selected={String(i.id) === view} onClick={() => choose(String(i.id))}
              className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition ${String(i.id) === view ? "bg-blue-50 text-blue-800" : "text-slate-700 hover:bg-slate-50"}`}>
              <span className="min-w-0">
                <span className="block truncate font-semibold">{i.label}</span>
                {i.document && <span className="block text-[11px] text-slate-500">{maskDoc(i.document)}</span>}
              </span>
              {String(i.id) === view && <Check size={14} className="shrink-0" />}
            </button>
          ))}
          <div className="mt-1 border-t border-slate-100 px-2.5 py-2 text-[11px] leading-relaxed text-slate-500">
            Ao emitir uma nota, o sistema pergunta de qual CNPJ. Dados fiscais de cada empresa em <span className="inline-flex items-center gap-0.5 font-medium text-slate-600"><Settings2 size={11} /> Configurações → Dados Fiscais</span>.
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
