import { CheckCircle2, CircleDollarSign, Handshake, MousePointerClick, ShoppingBag, UserPlus, Webhook } from "lucide-react";

import { Alert } from "../../../components/ui/Alert";
import { Button } from "../../../components/ui/Button";
import { StatGrid } from "../../../components/ui/PageWrapper";
import { StatCard } from "../../../components/ui/StatCard";
import { brl, type Overview } from "./lib";
import { AsyncState } from "./ui";

export default function OverviewTab({ data, loading, error, reload, onGo }: {
  data: Overview | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
  onGo: (tab: "affiliates" | "webhook" | "leads") => void;
}) {
  return (
    <AsyncState loading={loading} error={error} onRetry={reload}>
      {data && (
        <div className="space-y-4">
          {data.affiliates.pending > 0 && (
            <Alert variant="warning" title={`${data.affiliates.pending} afiliado(s) aguardando aprovação`}
              action={<Button size="sm" onClick={() => onGo("affiliates")}>Revisar agora</Button>}>
              Aprove, defina o plano de comissão e confira a carteira Asaas de cada um.
            </Alert>
          )}
          {data.webhook.failed > 0 && (
            <Alert variant="error" title="Webhook para a Develoi com falhas"
              action={<Button size="sm" variant="outline" onClick={() => onGo("webhook")}>Ver fila</Button>}>
              {data.webhook.failed} evento(s) não foram entregues. Confira a URL e o segredo configurados no servidor.
            </Alert>
          )}

          <StatGrid cols={4}>
            <StatCard title="Afiliados ativos" value={data.affiliates.active} icon={Handshake} color="success"
              description={`${data.affiliates.total} cadastrados · ${data.affiliates.suspended} suspensos`} />
            <StatCard title="Cliques (30 dias)" value={data.clicks30} icon={MousePointerClick} color="info" />
            <StatCard title="Leads" value={data.leads.total} icon={UserPlus} color="purple" description={`${data.leads.new} novos`} />
            <StatCard title="Vendas" value={data.sales.total} icon={ShoppingBag} color="default" description={`${data.sales.activeClients} clientes na janela de comissão`} />
          </StatGrid>

          <StatGrid cols={3}>
            <StatCard title="Comissões a receber" value={brl(data.commissions.pending)} icon={CircleDollarSign} color="warning" description="Pendentes e confirmadas" />
            <StatCard title="Disponíveis" value={brl(data.commissions.available)} icon={CircleDollarSign} color="info" description="Cobrança recebida, split a liquidar" />
            <StatCard title="Já repassadas" value={brl(data.commissions.paid)} icon={CheckCircle2} color="success" description="Split liquidado pelo Asaas" />
          </StatGrid>

          <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className={`flex h-9 w-9 items-center justify-center rounded-lg border ${data.webhook.failed > 0 ? "border-red-100 bg-red-50 text-red-600" : "border-emerald-100 bg-emerald-50 text-emerald-600"}`}>
                <Webhook size={16} />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">Webhook para a Develoi</p>
                <p className="text-xs text-slate-500">
                  {data.webhook.pending === 0 && data.webhook.failed === 0 ? "Tudo entregue." : `${data.webhook.pending} na fila · ${data.webhook.failed} com falha`}
                </p>
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={() => onGo("webhook")}>Abrir fila</Button>
          </div>

          {data.leads.new > 0 && (
            <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4 text-sm">
              <span className="text-slate-700"><b>{data.leads.new}</b> lead(s) novo(s) esperando contato da equipe.</span>
              <Button size="sm" variant="outline" onClick={() => onGo("leads")}>Ver leads</Button>
            </div>
          )}
        </div>
      )}
    </AsyncState>
  );
}
