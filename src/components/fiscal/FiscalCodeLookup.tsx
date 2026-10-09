import { useEffect, useState } from "react";
import { Building2, ListFilter, Loader2, Search } from "lucide-react";
import Modal from "../ui/Modal";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Alert } from "../ui/Alert";
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
  const [issuerActivity, setIssuerActivity] = useState<{ document?: string; cnae_code?: string; cnae_description?: string } | null>(null);
  const [issuerLoading, setIssuerLoading] = useState(false);
  const [issuerChecked, setIssuerChecked] = useState(false);
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

  useEffect(() => {
    if (!open || !isService || issuerChecked) return;
    setIssuerChecked(true);
    setIssuerLoading(true);
    fetch("/api/fiscal-codes/nfse-issuer-activity", { headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => response.ok ? response.json() : null)
      .then((data) => setIssuerActivity(data))
      .catch(() => setIssuerActivity(null))
      .finally(() => setIssuerLoading(false));
  }, [open, isService, issuerChecked, token]);

  const title = isService ? "Lista oficial de serviços NFS-e" : "Consultar NCM";
  const hint = isService ? "Pesquise por código ou atividade. A escolha deve corresponder ao serviço efetivamente prestado." : "Pesquise por código ou descrição do produto antes de emitir a NFC-e.";

  return <>
    <Button variant="outline" size="sm" iconLeft={<ListFilter size={14} />} onClick={() => setOpen(true)} className={cn("shrink-0", className)}>
      Consultar
    </Button>
    <Modal open={open} onClose={() => setOpen(false)} title={title} subtitle={isService ? "Fonte: Portal Nacional NFS-e · LC 116" : "Catálogo NCM vigente"} size="lg">
      <p className="text-xs leading-relaxed text-slate-500">{hint}</p>
      {isService && <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2.5">
        <div className="flex items-start gap-2"><Building2 size={15} className="mt-0.5 shrink-0 text-blue-600" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold text-blue-700">Atividade da empresa emissora</p>
            {issuerLoading ? <p className="mt-0.5 text-[11px] text-blue-600">Consultando CNPJ cadastrado...</p> : issuerActivity?.cnae_description ? <>
              <p className="mt-0.5 text-xs font-semibold text-slate-700">{issuerActivity.cnae_code} — {issuerActivity.cnae_description}</p>
              <Button variant="ghost" size="xs" onClick={() => setSearch(issuerActivity.cnae_description || "")} className="mt-1.5 text-blue-700">Usar atividade na busca</Button>
            </> : <p className="mt-0.5 text-[11px] text-slate-500">Cadastre o CNPJ e o CNAE em Configurações › Dados fiscais para receber sugestões.</p>}
          </div>
        </div>
      </div>}
      <Input autoFocus iconLeft={<Search size={16} />} value={search} onChange={(event) => setSearch(event.target.value)} placeholder={isService ? "Ex.: manutenção, 1406, informática..." : "Ex.: 8517, chocolate, cabo..."} />
      {!isService && search.trim().length < 2 && <p className="rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-500">Digite ao menos 2 caracteres para buscar no catálogo NCM.</p>}
      {loading && <div className="flex justify-center py-8"><Loader2 className="animate-spin text-blue-600" size={22} /></div>}
      {error && <Alert variant="error">{error}</Alert>}
      {!loading && !error && items.length > 0 && <div className="overflow-hidden rounded-lg border border-slate-200 divide-y divide-slate-100">
        {items.map((item) => <button key={`${item.code}-${item.description}`} type="button" onClick={() => { onSelect(item); setOpen(false); }} className="flex w-full items-start gap-3 px-3 py-3 text-left transition-colors hover:bg-blue-50">
          <span className="shrink-0 rounded-md bg-slate-100 px-2 py-1 font-mono text-[11px] font-semibold text-slate-700">{item.formatted_code || item.code}</span>
          <span className="text-xs leading-relaxed text-slate-600">{item.description}</span>
        </button>)}
      </div>}
      {!loading && !error && open && items.length === 0 && (isService || search.trim().length >= 2) && <p className="py-6 text-center text-xs text-slate-400">Nenhum código encontrado para esta busca.</p>}
    </Modal>
  </>;
}
