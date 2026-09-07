import { useEffect, useState } from "react";
import PageHeader from "../../components/layout/PageHeader";
import { cn } from "../../lib/utils";
import {
  Loader2, CheckCircle2, AlertTriangle, Ban, ExternalLink, Calendar, Receipt,
} from "lucide-react";

interface PlatformInvoice {
  id: number;
  asaas_payment_id: string;
  status: string;
  value: number;
  due_date: string;
  payment_date: string | null;
  billing_type: string | null;
  invoice_url: string | null;
}

interface PlatformSubscription {
  id: number;
  status: string; // active | overdue | suspended | cancelled
  value: number;
  next_due_date: string | null;
  grace_period_days: number;
  suspended_at: string | null;
  invoices: PlatformInvoice[];
}

const STATUS_META: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  active:    { label: "Em dia",     color: "text-emerald-600", bg: "bg-emerald-50", icon: <CheckCircle2 size={14} /> },
  overdue:   { label: "Em atraso",  color: "text-amber-600",   bg: "bg-amber-50",   icon: <AlertTriangle size={14} /> },
  suspended: { label: "Suspensa",   color: "text-rose-600",    bg: "bg-rose-50",    icon: <Ban size={14} /> },
  cancelled: { label: "Cancelada",  color: "text-slate-500",   bg: "bg-slate-100",  icon: <Ban size={14} /> },
};

const INVOICE_STATUS_LABEL: Record<string, string> = {
  pending: "Aguardando pagamento",
  confirmed: "Confirmado",
  received: "Pago",
  overdue: "Vencido",
  refunded: "Estornado",
};

function fmt(value: number) {
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDateBR(date: string | null) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("pt-BR");
}

export default function Assinatura() {
  const [subscription, setSubscription] = useState<PlatformSubscription | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/tenant/billing", { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } })
      .then((r) => r.json())
      .then((data) => setSubscription(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-slate-300" />
      </div>
    );
  }

  const meta = subscription ? STATUS_META[subscription.status] ?? STATUS_META.active : null;
  const pendingInvoice = subscription?.invoices.find((inv) => inv.status === "pending" || inv.status === "overdue");

  return (
    <div className="space-y-6">
      <PageHeader title="Assinatura" subtitle="Sua mensalidade do Box Sys — vencimentos e pagamentos" />

      {!subscription && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center">
          <p className="text-sm font-bold text-slate-600">Nenhuma cobrança configurada ainda.</p>
          <p className="text-xs text-slate-400 mt-1">Fale com o suporte do Box Sys se isso não for esperado.</p>
        </div>
      )}

      {subscription && meta && (
        <>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Status da assinatura</p>
                <span className={cn(
                  "mt-1 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wide",
                  meta.bg, meta.color,
                )}>
                  {meta.icon} {meta.label}
                </span>
              </div>
              <div className="text-right">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Valor mensal</p>
                <p className="text-2xl font-mono font-black text-slate-900">R$ {fmt(subscription.value)}</p>
              </div>
            </div>

            {subscription.status === "overdue" && subscription.next_due_date && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-2.5">
                <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs font-medium text-amber-700 leading-relaxed">
                  Pagamento em atraso desde {formatDateBR(subscription.next_due_date)}. Você tem{" "}
                  <strong>{subscription.grace_period_days} dias</strong> de carência antes do acesso ser suspenso.
                  Regularize assim que possível.
                </p>
              </div>
            )}

            {subscription.status === "suspended" && (
              <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 flex items-start gap-2.5">
                <Ban size={16} className="text-rose-600 shrink-0 mt-0.5" />
                <p className="text-xs font-medium text-rose-700 leading-relaxed">
                  Acesso suspenso por falta de pagamento. Regularize a fatura pendente abaixo para reativar.
                </p>
              </div>
            )}

            {subscription.next_due_date && subscription.status === "active" && (
              <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                <Calendar size={14} className="text-slate-400" />
                Próximo vencimento: <strong className="text-slate-700">{formatDateBR(subscription.next_due_date)}</strong>
              </div>
            )}

            {pendingInvoice?.invoice_url && (
              <a
                href={pendingInvoice.invoice_url}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 h-11 px-5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all"
              >
                <ExternalLink size={14} /> Pagar fatura pendente
              </a>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="px-5 sm:px-6 py-4 border-b border-slate-100">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-700 flex items-center gap-2">
                <Receipt size={14} className="text-slate-400" /> Histórico de faturas
              </p>
            </div>
            <div className="divide-y divide-slate-100">
              {subscription.invoices.length === 0 && (
                <div className="px-5 sm:px-6 py-10 text-center text-xs text-slate-400 font-bold uppercase tracking-widest">
                  Nenhuma fatura ainda
                </div>
              )}
              {subscription.invoices.map((inv) => (
                <div key={inv.id} className="px-5 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-700">
                      Vencimento {formatDateBR(inv.due_date)}
                    </p>
                    <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                      {INVOICE_STATUS_LABEL[inv.status] ?? inv.status}
                      {inv.payment_date && ` · pago em ${formatDateBR(inv.payment_date)}`}
                      {inv.billing_type && inv.billing_type !== "UNDEFINED" && ` · ${inv.billing_type}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-mono font-black text-sm text-slate-900">R$ {fmt(inv.value)}</span>
                    {inv.invoice_url && (
                      <a
                        href={inv.invoice_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="h-8 px-3 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-600 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-all"
                      >
                        <ExternalLink size={12} /> Ver
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
