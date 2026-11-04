import { useMemo, useState } from "react";
import { CircleDollarSign } from "lucide-react";

import { Alert } from "../../../components/ui/Alert";
import { Select } from "../../../components/ui/Input";
import { FilterLine, FilterLineSearch, FilterLineSection } from "../../../components/ui/FilterLine";
import { GridTable, type Column } from "../../../components/ui/GridTable";
import { StatGrid } from "../../../components/ui/PageWrapper";
import { StatCard } from "../../../components/ui/StatCard";
import {
  COMMISSION_STATUS, adminApi, brl, dateBR, errorMessage, useAdminData,
  type AffiliateCommission, type AffiliateRow, type CommissionStatus, type CommissionTotals, type Notify,
} from "./lib";
import { AsyncState, StatusBadge } from "./ui";

const ruleText = (c: AffiliateCommission) => (c.ruleType === "percent" ? `${String(c.ruleValue).replace(".", ",")}%` : brl(c.ruleValue));

export default function CommissionsTab({ notify, onChanged }: { notify: Notify; onChanged: () => void }) {
  const [status, setStatus] = useState("");
  const [affiliateId, setAffiliateId] = useState("");
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);

  const path = useMemo(() => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (affiliateId) params.set("affiliateId", affiliateId);
    const qs = params.toString();
    return `/commissions${qs ? `?${qs}` : ""}`;
  }, [status, affiliateId]);

  const { data, loading, error, reload } = useAdminData<{ commissions: AffiliateCommission[]; totals: CommissionTotals }>(path);
  const affiliates = useAdminData<{ affiliates: AffiliateRow[] }>("/affiliates");

  const rows = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("pt-BR");
    return (data?.commissions ?? []).filter((c) => !q || [c.customerName, c.affiliateName, c.affiliateCode].some((v) => String(v ?? "").toLocaleLowerCase("pt-BR").includes(q)));
  }, [data, search]);

  async function change(commission: AffiliateCommission, next: CommissionStatus) {
    if (next === commission.status) return;
    if (!window.confirm(`Mudar a comissão de ${commission.customerName} (mês ${commission.sequence}) para "${COMMISSION_STATUS[next].label}"?\nIsso só muda o controle aqui; o split no Asaas continua automático.`)) return;
    setBusyId(commission.id);
    try {
      await adminApi(`/commissions/${commission.id}`, { method: "PATCH", body: { status: next } });
      notify("success", "Comissão atualizada.");
      reload();
      onChanged();
    } catch (e) { notify("error", errorMessage(e, "Não foi possível atualizar a comissão.")); }
    finally { setBusyId(null); }
  }

  const columns: Column<AffiliateCommission>[] = [
    {
      header: "Afiliado",
      render: (c) => <span className="text-xs font-semibold text-slate-800">{c.affiliateName ?? `#${c.affiliateId}`}{c.affiliateCode ? <span className="font-normal text-slate-500"> ({c.affiliateCode})</span> : null}</span>,
    },
    { header: "Cliente", render: (c) => <span className="text-xs text-slate-700">{c.customerName}</span> },
    { header: "Mês", render: (c) => <span className="text-xs tabular-nums">{c.sequence}º</span> },
    { header: "Regra", render: (c) => <span className="text-xs text-slate-600">{ruleText(c)}</span>, hideOnMobile: true },
    { header: "Cobrança", render: (c) => <span className="text-xs tabular-nums text-slate-600">{brl(c.grossValue)}{c.netValue != null ? <span className="text-slate-400"> · líq. {brl(c.netValue)}</span> : null}</span>, hideOnMobile: true },
    { header: "Comissão", render: (c) => <span className="text-sm font-semibold tabular-nums text-slate-900">{brl(c.commissionValue)}</span> },
    { header: "Vence / pago", render: (c) => <span className="text-xs text-slate-500">{c.paidAt ? `pago ${dateBR(c.paidAt)}` : dateBR(c.dueDate)}</span>, hideOnMobile: true },
    {
      header: "Situação",
      render: (c) => (
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <StatusBadge meta={COMMISSION_STATUS[c.status]} />
          <Select size="sm" aria-label="Alterar situação" value={c.status} disabled={busyId === c.id} onChange={(e) => void change(c, e.target.value as CommissionStatus)}
            options={(Object.keys(COMMISSION_STATUS) as CommissionStatus[]).map((s) => ({ value: s, label: COMMISSION_STATUS[s].label }))} />
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <StatGrid cols={3}>
        <StatCard title="A receber" value={brl(data?.totals.pending)} icon={CircleDollarSign} color="warning" description="Cobrança ainda não recebida" />
        <StatCard title="Disponíveis" value={brl(data?.totals.available)} icon={CircleDollarSign} color="info" description="Recebida, split a liquidar" />
        <StatCard title="Repassadas" value={brl(data?.totals.paid)} icon={CircleDollarSign} color="success" description="Split liquidado" />
      </StatGrid>

      <Alert variant="info">
        O repasse é feito pelo Asaas (split) na própria cobrança. Esta tela acompanha o que o Asaas informa; mudar a situação aqui só corrige o controle interno.
      </Alert>

      <FilterLine>
        <FilterLineSection>
          <Select size="sm" aria-label="Filtrar por situação" wrapperClassName="min-w-44" value={status} onChange={(e) => setStatus(e.target.value)}
            options={[{ value: "", label: "Todas as situações" }, ...(Object.keys(COMMISSION_STATUS) as CommissionStatus[]).map((s) => ({ value: s, label: COMMISSION_STATUS[s].label }))]} />
          <Select size="sm" aria-label="Filtrar por afiliado" wrapperClassName="min-w-52" value={affiliateId} onChange={(e) => setAffiliateId(e.target.value)}
            options={[{ value: "", label: "Todos os afiliados" }, ...(affiliates.data?.affiliates ?? []).map((a) => ({ value: a.id, label: `${a.name} (${a.code})` }))]} />
        </FilterLineSection>
        <FilterLineSection><div className="w-full sm:w-64"><FilterLineSearch value={search} onChange={setSearch} placeholder="Cliente ou afiliado" aria-label="Buscar comissão" /></div></FilterLineSection>
      </FilterLine>

      <AsyncState loading={loading && !data} error={error} onRetry={reload} empty={rows.length === 0}
        emptyTitle="Nenhuma comissão ainda" emptyDescription="Cada cobrança paga de um cliente indicado gera uma comissão enquanto estiver na janela do plano.">
        <GridTable<AffiliateCommission> data={rows} columns={columns} keyExtractor={(c) => c.id} isLoading={loading} emptyMessage="Nenhuma comissão." />
      </AsyncState>
    </div>
  );
}
