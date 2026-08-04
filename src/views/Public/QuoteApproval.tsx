import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { motion } from "motion/react";
import { CheckCircle2, Clock, FileWarning, Loader2, ThumbsUp } from "lucide-react";

interface QuoteItem {
  id: number;
  name: string;
  quantity: number;
  unit_price: number;
  total: number;
  dimensions_label: string | null;
}

interface QuoteService {
  id: number;
  name: string;
  quantity: number;
  unit_price: number;
  total: number;
}

interface PublicQuote {
  number: number;
  customer_name: string;
  subtotal: number;
  discount_type: string;
  discount_value: number;
  total_amount: number;
  validity_days: number;
  notes: string | null;
  status: string;
  approved_by_client: boolean;
  approved_at: string | null;
  created_at: string;
  items: QuoteItem[];
  services: QuoteService[];
}

const fmt = (v: number) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function QuoteApproval() {
  const { token } = useParams<{ token: string }>();
  const [quote, setQuote] = useState<PublicQuote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [approving, setApproving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/public/quotes/${token}`);
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Link inválido ou expirado."); return; }
      setQuote(data);
    } catch {
      setError("Erro ao carregar o orçamento. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const handleApprove = async () => {
    setApproving(true);
    try {
      const res = await fetch(`/api/public/quotes/${token}/approve`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Não foi possível aprovar o orçamento."); return; }
      await load();
    } finally {
      setApproving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 size={28} className="animate-spin text-slate-300" />
      </div>
    );
  }

  if (error || !quote) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
        <div className="max-w-sm text-center space-y-3">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-50 border-2 border-red-100">
            <FileWarning size={28} className="text-red-400" />
          </div>
          <h1 className="text-lg font-black text-slate-800">Não foi possível abrir este orçamento</h1>
          <p className="text-sm text-slate-500">{error || "Link inválido."}</p>
        </div>
      </div>
    );
  }

  const canApprove = quote.status === "aguardando_aprovacao" && !quote.approved_by_client;
  const orderNum = String(quote.number).padStart(6, "0");

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mx-auto max-w-lg space-y-5"
      >
        <div className="text-center space-y-1">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-blue-500">Orçamento #{orderNum}</p>
          <h1 className="text-2xl font-black tracking-[-0.02em] text-slate-900">Olá, {quote.customer_name || "cliente"}</h1>
          <p className="text-sm text-slate-500">Confira os itens abaixo e aprove quando estiver de acordo.</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-sm">
          {quote.items.length > 0 && (
            <div className="space-y-2">
              {quote.items.map((item) => (
                <div key={`item-${item.id}`} className="flex items-center justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-700 truncate">{item.name}</p>
                    <p className="text-[11px] text-slate-400">
                      {item.dimensions_label || `Qtd: ${item.quantity} × ${fmt(item.unit_price)}`}
                    </p>
                  </div>
                  <p className="shrink-0 font-mono font-bold text-slate-700">{fmt(item.total)}</p>
                </div>
              ))}
            </div>
          )}

          {quote.services.length > 0 && (
            <div className="space-y-2 border-t border-slate-100 pt-3">
              {quote.services.map((s) => (
                <div key={`service-${s.id}`} className="flex items-center justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-700 truncate">{s.name}</p>
                    <p className="text-[11px] text-slate-400">Qtd: {s.quantity} × {fmt(s.unit_price)}</p>
                  </div>
                  <p className="shrink-0 font-mono font-bold text-slate-700">{fmt(s.total)}</p>
                </div>
              ))}
            </div>
          )}

          <div className="border-t border-slate-100 pt-3 space-y-1">
            <div className="flex justify-between text-[12px] text-slate-400">
              <span>Subtotal</span>
              <span className="font-mono">{fmt(quote.subtotal)}</span>
            </div>
            {Number(quote.discount_value) > 0 && (
              <div className="flex justify-between text-[12px] text-slate-400">
                <span>Desconto</span>
                <span className="font-mono">
                  {quote.discount_type === "percent" ? `${quote.discount_value}%` : `- ${fmt(Number(quote.discount_value))}`}
                </span>
              </div>
            )}
            <div className="flex justify-between text-base font-black text-slate-900 pt-1">
              <span>Total</span>
              <span className="font-mono">{fmt(quote.total_amount)}</span>
            </div>
          </div>

          {quote.notes && (
            <div className="border-t border-slate-100 pt-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Observações</p>
              <p className="text-sm text-slate-600 whitespace-pre-wrap">{quote.notes}</p>
            </div>
          )}

          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 border-t border-slate-100 pt-3">
            <Clock size={12} />
            Validade de {quote.validity_days} dias a partir da emissão.
          </div>
        </div>

        {quote.approved_by_client ? (
          <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3.5">
            <CheckCircle2 size={20} className="shrink-0 text-emerald-500" />
            <div>
              <p className="text-sm font-bold text-emerald-700">Orçamento aprovado!</p>
              <p className="text-[11px] text-emerald-600">
                {quote.approved_at ? `Em ${new Date(quote.approved_at).toLocaleDateString("pt-BR")}` : "Recebemos sua aprovação."} Entraremos em contato para os próximos passos.
              </p>
            </div>
          </div>
        ) : canApprove ? (
          <button
            onClick={handleApprove}
            disabled={approving}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-black uppercase tracking-wider text-white shadow-sm transition-all hover:bg-emerald-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {approving ? <Loader2 size={16} className="animate-spin" /> : <ThumbsUp size={16} />}
            Aprovar orçamento
          </button>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-center">
            <p className="text-sm font-semibold text-slate-500">
              Este orçamento não está disponível para aprovação no momento.
            </p>
          </div>
        )}

        <p className="text-center text-[11px] text-slate-300">Este é um link exclusivo para você — não compartilhe.</p>
      </motion.div>
    </div>
  );
}
