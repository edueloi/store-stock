import { useEffect, useState } from "react";
import { ListFilter, Loader2, Search } from "lucide-react";
import Modal from "../ui/Modal";
import { cn } from "../../lib/utils";

type CodeItem = { code: string; formatted_code?: string; description: string };

interface FiscalCodeLookupProps {
  kind: "nfse-service" | "ncm";
  token: string | null;
  onSelect: (item: CodeItem) => void;
  className?: string;
}

export default function FiscalCodeLookup({ kind, token, onSelect, className }: FiscalCodeLookupProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<CodeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const isService = kind === "nfse-service";

  useEffect(() => {
    if (!open) return;
    const term = search.trim();
    if (!isService && term.length < 2) {
      setItems([]); setError(""); return;
    }
    const timer = window.setTimeout(async () => {
      setLoading(true); setError("");
      try {
        const endpoint = isService ? `/api/fiscal-codes/nfse-services?search=${encodeURIComponent(term)}` : `/api/fiscal-codes/ncm?search=${encodeURIComponent(term)}`;
        const response = await fetch(endpoint, { headers: { Authorization: `Bearer ${token}` } });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Não foi possível consultar os códigos.");
        setItems(Array.isArray(data.items) ? data.items : []);
      } catch (requestError) {
        setItems([]);
        setError(requestError instanceof Error ? requestError.message : "Não foi possível consultar os códigos.");
      } finally { setLoading(false); }
    }, term ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [open, search, isService, token]);

  const title = isService ? "Lista oficial de serviços NFS-e" : "Consultar NCM";
  const hint = isService ? "Pesquise por código ou atividade. A escolha deve corresponder ao serviço efetivamente prestado." : "Pesquise por código ou descrição do produto antes de emitir a NFC-e.";

  return <>
    <button type="button" onClick={() => setOpen(true)} className={cn("inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[9px] font-black uppercase tracking-wide text-slate-600 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700", className)}>
      <ListFilter size={14} /> Consultar
    </button>
    <Modal open={open} onClose={() => setOpen(false)} title={title} subtitle={isService ? "Fonte: Portal Nacional NFS-e · LC 116" : "Catálogo NCM vigente"} size="lg">
      <p className="text-xs leading-relaxed text-slate-500">{hint}</p>
      <div className="relative">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder={isService ? "Ex.: manutenção, 1406, informática..." : "Ex.: 8517, chocolate, cabo..."} className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm outline-none transition-colors focus:border-blue-400 focus:bg-white" />
      </div>
      {!isService && search.trim().length < 2 && <p className="rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-500">Digite ao menos 2 caracteres para buscar no catálogo NCM.</p>}
      {loading && <div className="flex justify-center py-8"><Loader2 className="animate-spin text-blue-600" size={22} /></div>}
      {error && <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">{error}</p>}
      {!loading && !error && items.length > 0 && <div className="overflow-hidden rounded-xl border border-slate-200 divide-y divide-slate-100">
        {items.map((item) => <button key={`${item.code}-${item.description}`} type="button" onClick={() => { onSelect(item); setOpen(false); }} className="flex w-full items-start gap-3 px-3 py-3 text-left transition-colors hover:bg-blue-50">
          <span className="shrink-0 rounded-md bg-slate-100 px-2 py-1 font-mono text-[11px] font-black text-slate-700">{item.formatted_code || item.code}</span>
          <span className="text-xs leading-relaxed text-slate-600">{item.description}</span>
        </button>)}
      </div>}
      {!loading && !error && open && items.length === 0 && (isService || search.trim().length >= 2) && <p className="py-6 text-center text-xs text-slate-400">Nenhum código encontrado para esta busca.</p>}
    </Modal>
  </>;
}
