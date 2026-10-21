import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { CheckCircle2, Loader2, Plus, Trash2 } from "lucide-react";
import GlassDrawing from "../../../components/GlassDrawing";
import GlassPieceFields, { draftToSpec, emptyPieceDraft, type PieceDraft } from "../../../components/GlassPieceFields";
import { pieceAreaM2, pieceSummary, type PieceSpec } from "../../../lib/glassPieces";
import { resolveStoreSlug } from "../store-routing";

interface CatalogService { id: number; name: string; description: string | null; price_per_measure: number; min_billable_quantity: number | null }
interface CartPiece { service: CatalogService; spec: PieceSpec; quantity: number }

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const field = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200";

const estimate = (p: CartPiece) =>
  Math.max(pieceAreaM2(p.spec), p.service.min_billable_quantity ?? 0) * p.service.price_per_measure * p.quantity;

/** Solicitação de orçamento pela vitrine: o cliente desenha a peça, vê o preço estimado e envia para a loja. */
export default function StoreQuoteRequest() {
  const { slug: routeSlug } = useParams();
  const slug = resolveStoreSlug(routeSlug);
  const [services, setServices] = useState<CatalogService[] | null>(null);
  const [serviceId, setServiceId] = useState<number | null>(null);
  const [draft, setDraft] = useState<PieceDraft>(emptyPieceDraft());
  const [quantity, setQuantity] = useState(1);
  const [pieces, setPieces] = useState<CartPiece[]>([]);
  const [customer, setCustomer] = useState({ name: "", phone: "", email: "" });
  const [notes, setNotes] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<number | null>(null);

  useEffect(() => {
    fetch(`/api/public/store/${encodeURIComponent(slug)}/quote-catalog`)
      .then((r) => r.json())
      .then((d) => { const list: CatalogService[] = d.services ?? []; setServices(list); setServiceId(list[0]?.id ?? null); })
      .catch(() => setServices([]));
  }, [slug]);

  const service = services?.find((s) => s.id === serviceId) ?? null;
  const spec = draftToSpec(draft);
  const specReady = spec.width_mm >= 50 && spec.height_mm >= 50;
  const total = useMemo(() => pieces.reduce((sum, p) => sum + estimate(p), 0), [pieces]);

  const addPiece = () => {
    if (!service || !specReady) return;
    setPieces((prev) => [...prev, { service, spec, quantity }]);
    setDraft(emptyPieceDraft());
    setQuantity(1);
  };

  const send = async () => {
    setError("");
    if (!pieces.length) return setError("Adicione ao menos uma peça.");
    if (!customer.name.trim() || customer.phone.replace(/\D/g, "").length < 10) return setError("Informe seu nome e WhatsApp com DDD.");
    setSending(true);
    try {
      const res = await fetch(`/api/public/store/${encodeURIComponent(slug)}/quote-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer, notes, pieces: pieces.map((p) => ({ service_id: p.service.id, quantity: p.quantity, spec: p.spec })) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return setError(data.error || "Não foi possível enviar a solicitação.");
      setDone(data.number);
    } catch {
      setError("Falha de conexão. Tente novamente.");
    } finally {
      setSending(false);
    }
  };

  if (services === null) return <div className="flex justify-center py-24"><Loader2 className="animate-spin text-slate-400" /></div>;

  if (done !== null) {
    return (
      <div className="mx-auto max-w-lg px-6 py-24 text-center">
        <CheckCircle2 size={48} className="mx-auto text-emerald-500" />
        <h1 className="mt-4 text-2xl font-semibold">Solicitação enviada!</h1>
        <p className="mt-2 text-slate-600">Recebemos seu pedido nº {String(done).padStart(6, "0")}. Em breve entraremos em contato pelo WhatsApp informado com o orçamento final.</p>
      </div>
    );
  }

  if (!services.length) {
    return <div className="mx-auto max-w-lg px-6 py-24 text-center text-slate-600">Esta loja ainda não habilitou a solicitação de orçamento online.</div>;
  }

  return (
    <div className="mx-auto max-w-5xl px-5 py-10">
      <h1 className="text-3xl font-semibold">Solicite seu orçamento</h1>
      <p className="mt-1 text-slate-600">Escolha o tipo de peça, informe as medidas e veja o desenho. O valor é uma estimativa — a loja confirma após conferir as medidas.</p>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-6">
        <label className="mb-1 block text-xs font-semibold text-slate-600">Serviço</label>
        <select className={`${field} mb-4`} value={serviceId ?? ""} onChange={(e) => setServiceId(Number(e.target.value))}>
          {services.map((s) => <option key={s.id} value={s.id}>{s.name} — {brl(s.price_per_measure)}/m²</option>)}
        </select>
        <GlassPieceFields draft={draft} onChange={setDraft} />
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div className="w-28">
            <label className="mb-1 block text-xs font-semibold text-slate-600">Quantidade</label>
            <input className={field} type="number" min={1} max={99} value={quantity} onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))} />
          </div>
          {service && specReady && (
            <p className="pb-2 text-sm text-slate-700">Estimativa: <strong>{brl(estimate({ service, spec, quantity }))}</strong> · {pieceAreaM2(spec).toFixed(2)} m²</p>
          )}
          <button type="button" onClick={addPiece} disabled={!specReady || !service} className="ml-auto inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
            <Plus size={16} /> Adicionar peça
          </button>
        </div>
      </section>

      {pieces.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">Suas peças</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {pieces.map((p, i) => (
              <div key={i} className="flex gap-3 rounded-xl border border-slate-200 bg-white p-3">
                <div className="w-32 shrink-0"><GlassDrawing spec={p.spec} /></div>
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-semibold">{p.service.name} × {p.quantity}</p>
                  <p className="text-xs text-slate-500">{pieceSummary(p.spec)}</p>
                  <p className="mt-1 font-semibold">{brl(estimate(p))}</p>
                </div>
                <button type="button" aria-label="Remover peça" onClick={() => setPieces((prev) => prev.filter((_, j) => j !== i))} className="self-start text-slate-400 hover:text-red-600"><Trash2 size={16} /></button>
              </div>
            ))}
          </div>
          <p className="mt-3 text-right text-lg font-semibold">Total estimado: {brl(total)}</p>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <input className={field} placeholder="Seu nome" value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} />
            <input className={field} placeholder="WhatsApp com DDD" inputMode="tel" value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} />
            <input className={field} placeholder="E-mail (opcional)" type="email" value={customer.email} onChange={(e) => setCustomer({ ...customer, email: e.target.value })} />
          </div>
          <textarea className={`${field} mt-3`} rows={2} maxLength={500} placeholder="Observações gerais (endereço, prazo desejado...)" value={notes} onChange={(e) => setNotes(e.target.value)} />
          {error && <p className="mt-3 text-sm text-red-600" role="alert">{error}</p>}
          <button type="button" onClick={send} disabled={sending} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-3 text-sm font-semibold text-white disabled:opacity-50">
            {sending && <Loader2 size={16} className="animate-spin" />} Enviar solicitação de orçamento
          </button>
        </section>
      )}
    </div>
  );
}
