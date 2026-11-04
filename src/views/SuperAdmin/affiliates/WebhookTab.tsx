import { useState } from "react";
import { RefreshCcw } from "lucide-react";

import { Alert } from "../../../components/ui/Alert";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { FilterLine, FilterLineSection, FilterLineSegmented } from "../../../components/ui/FilterLine";
import { GridTable, type Column } from "../../../components/ui/GridTable";
import { adminApi, dateTimeBR, errorMessage, useAdminData, type AffiliateEvent, type Notify } from "./lib";
import { AsyncState } from "./ui";

type Filter = "all" | "pending";

function eventState(event: AffiliateEvent) {
  if (event.deliveredAt) return <Badge color="success" pill dot>Entregue</Badge>;
  if (event.attempts === 0) return <Badge color="info" pill dot>Na fila</Badge>;
  return <Badge color="danger" pill dot>Falhou ({event.attempts}x)</Badge>;
}

export default function WebhookTab({ notify, onChanged }: { notify: Notify; onChanged: () => void }) {
  const [filter, setFilter] = useState<Filter>("pending");
  const { data, loading, error, reload } = useAdminData<{ events: AffiliateEvent[] }>(filter === "pending" ? "/events?pending=1" : "/events");
  const [busyId, setBusyId] = useState<number | null>(null);

  async function retry(event: AffiliateEvent) {
    setBusyId(event.id);
    try {
      await adminApi(`/events/${event.id}/retry`, { method: "POST" });
      notify("success", "Evento recolocado na fila. A entrega é tentada em instantes.");
      reload();
      onChanged();
    } catch (e) { notify("error", errorMessage(e, "Não foi possível reenviar.")); }
    finally { setBusyId(null); }
  }

  const columns: Column<AffiliateEvent>[] = [
    { header: "Evento", render: (e) => <span className="font-mono text-xs font-semibold text-slate-800">{e.type}</span> },
    { header: "Situação", render: (e) => eventState(e) },
    { header: "Tentativas", render: (e) => <span className="text-xs tabular-nums">{e.attempts}</span>, hideOnMobile: true },
    { header: "Criado em", render: (e) => <span className="text-xs text-slate-500">{dateTimeBR(e.createdAt)}</span>, hideOnMobile: true },
    { header: "Próxima tentativa", render: (e) => <span className="text-xs text-slate-500">{e.deliveredAt ? "—" : dateTimeBR(e.nextTryAt)}</span>, hideOnMobile: true },
    { header: "Último erro", render: (e) => <span className="line-clamp-2 max-w-[260px] text-[11px] text-red-600">{e.lastError || "—"}</span> },
    {
      header: "",
      render: (e) => (e.deliveredAt ? null : (
        <Button size="sm" variant="outline" loading={busyId === e.id} iconLeft={<RefreshCcw size={12} />} onClick={() => void retry(e)}>Reenviar</Button>
      )),
    },
  ];

  const events = data?.events ?? [];

  return (
    <div className="space-y-4">
      <Alert variant="info" title="Como funciona">
        Cada mudança do programa (afiliado novo, lead, indicação, comissão) vira um evento assinado enviado à Develoi, com novas tentativas automáticas
        (1 min, 5 min, 15 min, 1 h, 6 h, 12 h, 24 h). Se a URL ou o segredo não estiverem configurados no servidor, os eventos esperam aqui.
      </Alert>

      <FilterLine>
        <FilterLineSection>
          <FilterLineSegmented<Filter> value={filter} onChange={setFilter} size="sm"
            options={[{ value: "pending", label: "Pendentes e com falha" }, { value: "all", label: "Todos" }]} />
        </FilterLineSection>
        <FilterLineSection><Button size="sm" variant="outline" iconLeft={<RefreshCcw size={13} />} onClick={reload}>Atualizar</Button></FilterLineSection>
      </FilterLine>

      <AsyncState loading={loading && !data} error={error} onRetry={reload} empty={events.length === 0}
        emptyTitle={filter === "pending" ? "Nada pendente" : "Nenhum evento ainda"} emptyDescription={filter === "pending" ? "Todos os eventos foram entregues à Develoi." : undefined}>
        <GridTable<AffiliateEvent> data={events} columns={columns} keyExtractor={(e) => e.id} isLoading={loading} emptyMessage="Nenhum evento." />
      </AsyncState>
    </div>
  );
}
