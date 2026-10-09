import { useEffect, useState } from "react";
import {
  Loader2, CheckCircle2, AlertTriangle, Ban, ExternalLink, Calendar, Receipt, CreditCard,
} from "lucide-react";
import { Alert, Badge, Button, ContentCard, EmptyState, PageWrapper, PanelCard, SectionTitle, StatCard, StatGrid } from "../../components/ui";

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

type BadgeTone = "success" | "warning" | "danger" | "default";

const STATUS_META: Record<string, { label: string; color: BadgeTone; icon: React.ReactNode }> = {
  active:    { label: "Em dia",     color: "success", icon: <CheckCircle2 size={12} /> },
  overdue:   { label: "Em atraso",  color: "warning", icon: <AlertTriangle size={12} /> },
  suspended: { label: "Suspensa",   color: "danger",  icon: <Ban size={12} /> },
  cancelled: { label: "Cancelada",  color: "default", icon: <Ban size={12} /> },
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
      <div role="status" className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
        <Loader2 size={18} className="animate-spin" />Carregando assinatura…
      </div>
    );
  }

  const meta = subscription ? STATUS_META[subscription.status] ?? STATUS_META.active : null;
  const pendingInvoice = subscription?.invoices.find((inv) => inv.status === "pending" || inv.status === "overdue");

  return (
    <PageWrapper>
      <div className="space-y-4">
        <SectionTitle icon={CreditCard} title="Assinatura" description="Sua mensalidade do Box Sys — vencimentos e pagamentos" />

        {!subscription && (
          <ContentCard>
            <EmptyState icon={CreditCard} title="Nenhuma cobrança configurada ainda."
              description="Fale com o suporte do Box Sys se isso não for esperado." />
          </ContentCard>
        )}

        {subscription && meta && (
          <>
            <StatGrid cols={3}>
              <ContentCard className="flex flex-col justify-center gap-1">
                <p className="text-[11px] font-medium text-slate-500">Status da assinatura</p>
                <div><Badge color={meta.color} icon={meta.icon}>{meta.label}</Badge></div>
              </ContentCard>
              <StatCard title="Valor mensal" value={`R$ ${fmt(subscription.value)}`} icon={CreditCard} color="info" />
              {subscription.next_due_date && subscription.status === "active" && (
                <StatCard title="Próximo vencimento" value={formatDateBR(subscription.next_due_date)} icon={Calendar} color="success" />
              )}
            </StatGrid>

            {subscription.status === "overdue" && subscription.next_due_date && (
              <Alert variant="warning">
                Pagamento em atraso desde {formatDateBR(subscription.next_due_date)}. Você tem{" "}
                <strong>{subscription.grace_period_days} dias</strong> de carência antes do acesso ser suspenso.
                Regularize assim que possível.
              </Alert>
            )}

            {subscription.status === "suspended" && (
              <Alert variant="error">
                Acesso suspenso por falta de pagamento. Regularize a fatura pendente abaixo para reativar.
              </Alert>
            )}

            {pendingInvoice?.invoice_url && (
              <a
                href={pendingInvoice.invoice_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex"
              >
                <Button size="sm" iconLeft={<ExternalLink size={14} />}>Pagar fatura pendente</Button>
              </a>
            )}

            <PanelCard icon={Receipt} title="Histórico de faturas" contentClassName="p-0">
              {subscription.invoices.length === 0 ? (
                <div className="p-3"><EmptyState title="Nenhuma fatura ainda" /></div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {subscription.invoices.map((inv) => (
                    <li key={inv.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-slate-800">Vencimento {formatDateBR(inv.due_date)}</p>
                        <p className="mt-0.5 text-[11px] text-slate-500">
                          {INVOICE_STATUS_LABEL[inv.status] ?? inv.status}
                          {inv.payment_date && ` · pago em ${formatDateBR(inv.payment_date)}`}
                          {inv.billing_type && inv.billing_type !== "UNDEFINED" && ` · ${inv.billing_type}`}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span className="text-xs font-semibold tabular-nums text-slate-900">R$ {fmt(inv.value)}</span>
                        {inv.invoice_url && (
                          <a href={inv.invoice_url} target="_blank" rel="noopener noreferrer">
                            <Button variant="outline" size="xs" iconLeft={<ExternalLink size={12} />}>Ver</Button>
                          </a>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </PanelCard>
          </>
        )}
      </div>
    </PageWrapper>
  );
}
