import { useMemo, useState, type FormEvent } from "react";
import { Plus } from "lucide-react";

import { Button } from "../../../components/ui/Button";
import { Input, Select } from "../../../components/ui/Input";
import { Modal, ModalFooter } from "../../../components/ui/Modal";
import { FilterLine, FilterLineSearch, FilterLineSection, FilterLineSegmented } from "../../../components/ui/FilterLine";
import { GridTable, type Column } from "../../../components/ui/GridTable";
import {
  REFERRAL_STATUS, adminApi, brl, dateBR, errorMessage, useAdminData,
  type AffiliateReferral, type AffiliateRow, type Notify, type ReferralStatus,
} from "./lib";
import { AsyncState, StatusBadge } from "./ui";

type Filter = "all" | ReferralStatus;
const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "Todas" },
  ...(Object.keys(REFERRAL_STATUS) as ReferralStatus[]).map((s) => ({ value: s as Filter, label: REFERRAL_STATUS[s].label })),
];

const progress = (r: AffiliateReferral) =>
  r.totalMonths === undefined ? "—" : r.totalMonths === null ? `${r.countedMonths ?? 0} mês(es) · sem limite` : `${r.countedMonths ?? 0} de ${r.totalMonths}`;

export default function ReferralsTab({ notify, onChanged }: { notify: Notify; onChanged: () => void }) {
  const { data, loading, error, reload } = useAdminData<{ referrals: AffiliateReferral[] }>("/referrals");
  const affiliates = useAdminData<{ affiliates: AffiliateRow[] }>("/affiliates");
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [form, setForm] = useState({ code: "", customerName: "", planValue: "", develoiClientId: "", tenantId: "" });

  const rows = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("pt-BR");
    return (data?.referrals ?? []).filter((r) => (filter === "all" || r.status === filter)
      && (!q || [r.customerName, r.affiliateName, r.affiliateCode].some((v) => String(v ?? "").toLocaleLowerCase("pt-BR").includes(q))));
  }, [data, filter, search]);

  const activeAffiliates = (affiliates.data?.affiliates ?? []).filter((a) => a.status === "active");
  const set = (key: keyof typeof form, value: string) => setForm((f) => ({ ...f, [key]: value }));
  const valid = form.code !== "" && form.customerName.trim().length > 1 && Number(form.planValue) >= 0 && form.planValue !== "";

  async function create(event: FormEvent) {
    event.preventDefault();
    if (!valid) return;
    setSaving(true);
    try {
      await adminApi("/referrals", {
        method: "POST",
        body: {
          code: form.code, customerName: form.customerName.trim(), planValue: Number(form.planValue),
          develoiClientId: form.develoiClientId.trim() || undefined, tenantId: form.tenantId ? Number(form.tenantId) : undefined,
        },
      });
      notify("success", "Indicação registrada.");
      setCreating(false);
      setForm({ code: "", customerName: "", planValue: "", develoiClientId: "", tenantId: "" });
      reload();
      onChanged();
    } catch (e) { notify("error", errorMessage(e, "Não foi possível registrar a indicação.")); }
    finally { setSaving(false); }
  }

  async function changeStatus(referral: AffiliateReferral, status: ReferralStatus) {
    setBusyId(referral.id);
    try {
      await adminApi(`/referrals/${referral.id}`, { method: "PATCH", body: { status } });
      notify("success", "Situação atualizada.");
      reload();
      onChanged();
    } catch (e) { notify("error", errorMessage(e, "Não foi possível atualizar.")); }
    finally { setBusyId(null); }
  }

  const columns: Column<AffiliateReferral>[] = [
    {
      header: "Cliente",
      render: (r) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">{r.customerName}</p>
          <p className="truncate text-[11px] text-slate-500">{r.develoiClientId ? `Develoi ${r.develoiClientId}` : "Sem vínculo com a Develoi"}</p>
        </div>
      ),
    },
    { header: "Afiliado", render: (r) => <span className="text-xs text-slate-600">{r.affiliateName ?? `#${r.affiliateId}`}{r.affiliateCode ? ` (${r.affiliateCode})` : ""}</span> },
    { header: "Mensalidade", render: (r) => <span className="text-xs tabular-nums">{brl(r.planValue)}</span>, hideOnMobile: true },
    { header: "Meses de comissão", render: (r) => <span className="text-xs text-slate-600">{progress(r)}</span>, hideOnMobile: true },
    { header: "Desde", render: (r) => <span className="text-xs text-slate-500">{dateBR(r.startedAt)}</span>, hideOnMobile: true },
    {
      header: "Situação",
      render: (r) => (
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <StatusBadge meta={REFERRAL_STATUS[r.status]} />
          <Select size="sm" aria-label={`Situação de ${r.customerName}`} value={r.status} disabled={busyId === r.id}
            onChange={(e) => void changeStatus(r, e.target.value as ReferralStatus)}
            options={(Object.keys(REFERRAL_STATUS) as ReferralStatus[]).map((s) => ({ value: s, label: REFERRAL_STATUS[s].label }))} />
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <FilterLine>
        <FilterLineSection><FilterLineSegmented<Filter> value={filter} onChange={setFilter} options={FILTERS} size="sm" /></FilterLineSection>
        <FilterLineSection>
          <div className="w-full sm:w-64"><FilterLineSearch value={search} onChange={setSearch} placeholder="Cliente ou afiliado" aria-label="Buscar indicação" /></div>
          <Button size="sm" iconLeft={<Plus size={14} />} onClick={() => setCreating(true)}>Registrar indicação</Button>
        </FilterLineSection>
      </FilterLine>

      <AsyncState loading={loading && !data} error={error} onRetry={reload} empty={rows.length === 0}
        emptyTitle="Nenhuma indicação" emptyDescription="Indicações são criadas pela Develoi ao fechar uma venda com código de afiliado, ou manualmente aqui.">
        <GridTable<AffiliateReferral> data={rows} columns={columns} keyExtractor={(r) => r.id} isLoading={loading} emptyMessage="Nenhuma indicação." />
      </AsyncState>

      <Modal open={creating} onClose={() => setCreating(false)} size="md" title="Registrar indicação" subtitle="Use quando a venda não passou pela Develoi (a Develoi registra sozinha as que passam)."
        footer={<ModalFooter><Button variant="outline" onClick={() => setCreating(false)}>Cancelar</Button><Button type="submit" form="aff-ref-form" loading={saving} disabled={!valid}>Registrar</Button></ModalFooter>}>
        <form id="aff-ref-form" onSubmit={create} className="space-y-3">
          <Select label="Afiliado" required value={form.code} onChange={(e) => set("code", e.target.value)}
            options={[{ value: "", label: "Escolha um afiliado ativo" }, ...activeAffiliates.map((a) => ({ value: a.code, label: `${a.name} (${a.code})` }))]} />
          <Input label="Nome do cliente" required value={form.customerName} onChange={(e) => set("customerName", e.target.value)} />
          <Input label="Mensalidade (R$)" type="number" min="0" step="0.01" required value={form.planValue} onChange={(e) => set("planValue", e.target.value)} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="ID do cliente na Develoi (opcional)" value={form.develoiClientId} onChange={(e) => set("develoiClientId", e.target.value)} hint="Liga os pagamentos do Asaas a esta indicação." />
            <Input label="ID da loja no Store (opcional)" type="number" value={form.tenantId} onChange={(e) => set("tenantId", e.target.value)} />
          </div>
        </form>
      </Modal>
    </div>
  );
}
