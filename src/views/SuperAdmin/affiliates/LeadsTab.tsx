import { useMemo, useState } from "react";
import { MessageCircle } from "lucide-react";

import { Button } from "../../../components/ui/Button";
import { Select, Textarea } from "../../../components/ui/Input";
import { Modal, ModalFooter } from "../../../components/ui/Modal";
import { FilterLine, FilterLineSearch, FilterLineSection, FilterLineSegmented } from "../../../components/ui/FilterLine";
import { GridTable, type Column } from "../../../components/ui/GridTable";
import {
  LEAD_STATUS, SYSTEM_LABEL, adminApi, dateTimeBR, errorMessage, maskPhone, useAdminData, waLink,
  type AffiliateLead, type LeadStatus, type Notify,
} from "./lib";
import { AsyncState, KeyValue, StatusBadge } from "./ui";

type Filter = "all" | LeadStatus;
const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "Todos" },
  ...(Object.keys(LEAD_STATUS) as LeadStatus[]).map((s) => ({ value: s as Filter, label: LEAD_STATUS[s].label })),
];

export default function LeadsTab({ notify, onChanged }: { notify: Notify; onChanged: () => void }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<AffiliateLead | null>(null);
  const [status, setStatus] = useState<LeadStatus>("new");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const path = filter === "all" ? "/leads" : `/leads?status=${filter}`;
  const { data, loading, error, reload } = useAdminData<{ leads: AffiliateLead[] }>(path);

  const rows = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("pt-BR");
    return (data?.leads ?? []).filter((l) => !q || [l.name, l.whatsapp, l.business, l.affiliateName, l.affiliateCode].some((v) => String(v ?? "").toLocaleLowerCase("pt-BR").includes(q)));
  }, [data, search]);

  function open(lead: AffiliateLead) {
    setSelected(lead);
    setStatus(lead.status);
    setNotes(lead.adminNotes ?? "");
  }

  async function save() {
    if (!selected) return;
    setSaving(true);
    try {
      await adminApi(`/leads/${selected.id}`, { method: "PATCH", body: { status, adminNotes: notes.trim() || null } });
      notify("success", "Lead atualizado.");
      setSelected(null);
      reload();
      onChanged();
    } catch (e) { notify("error", errorMessage(e, "Não foi possível atualizar o lead.")); }
    finally { setSaving(false); }
  }

  const columns: Column<AffiliateLead>[] = [
    {
      header: "Lead",
      render: (l) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">{l.name}</p>
          <p className="truncate text-[11px] text-slate-500">{maskPhone(l.whatsapp)}{l.business ? ` · ${l.business}` : ""}</p>
        </div>
      ),
    },
    { header: "Afiliado", render: (l) => <span className="text-xs text-slate-600">{l.affiliateName ?? `#${l.affiliateId}`}{l.affiliateCode ? ` (${l.affiliateCode})` : ""}</span> },
    { header: "Interesse", render: (l) => <span className="text-xs text-slate-600">{SYSTEM_LABEL[l.system] ?? l.system}</span>, hideOnMobile: true },
    { header: "Status", render: (l) => <StatusBadge meta={LEAD_STATUS[l.status]} /> },
    { header: "Chegou em", render: (l) => <span className="text-xs text-slate-500">{dateTimeBR(l.createdAt)}</span>, hideOnMobile: true },
  ];

  return (
    <div className="space-y-4">
      <FilterLine>
        <FilterLineSection><FilterLineSegmented<Filter> value={filter} onChange={setFilter} options={FILTERS} size="sm" /></FilterLineSection>
        <FilterLineSection><div className="w-full sm:w-72"><FilterLineSearch value={search} onChange={setSearch} placeholder="Nome, WhatsApp ou afiliado" aria-label="Buscar lead" /></div></FilterLineSection>
      </FilterLine>

      <AsyncState loading={loading && !data} error={error} onRetry={reload} empty={rows.length === 0}
        emptyTitle="Nenhum lead por aqui" emptyDescription="Leads chegam pelo formulário do site (com o código do afiliado) ou cadastrados pelo próprio afiliado.">
        <GridTable<AffiliateLead> data={rows} columns={columns} keyExtractor={(l) => l.id} onRowClick={open} isLoading={loading} emptyMessage="Nenhum lead." />
      </AsyncState>

      <Modal open={!!selected} onClose={() => setSelected(null)} size="md" title={selected?.name ?? "Lead"} subtitle={selected ? `Indicado por ${selected.affiliateName ?? `#${selected.affiliateId}`}` : undefined}
        footer={<ModalFooter><Button variant="outline" onClick={() => setSelected(null)}>Fechar</Button><Button loading={saving} onClick={() => void save()}>Salvar</Button></ModalFooter>}>
        {selected && (
          <div className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <KeyValue label="WhatsApp">{maskPhone(selected.whatsapp)}</KeyValue>
              <KeyValue label="E-mail">{selected.email || "—"}</KeyValue>
              <KeyValue label="Negócio">{selected.business || "—"}</KeyValue>
              <KeyValue label="Interesse">{SYSTEM_LABEL[selected.system] ?? selected.system}</KeyValue>
            </div>
            {selected.message && <KeyValue label="Mensagem">{selected.message}</KeyValue>}
            <a href={waLink(selected.whatsapp)} target="_blank" rel="noopener noreferrer" className="inline-flex">
              <Button size="sm" variant="outline" iconLeft={<MessageCircle size={13} />}>Chamar no WhatsApp</Button>
            </a>
            <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value as LeadStatus)}
              options={(Object.keys(LEAD_STATUS) as LeadStatus[]).map((s) => ({ value: s, label: LEAD_STATUS[s].label }))} />
            <Textarea label="Anotações da equipe" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Só a equipe vê isto." />
            <p className="text-[11px] text-slate-400">"Fechou" também é marcado sozinho quando a venda é registrada na Develoi.</p>
          </div>
        )}
      </Modal>
    </div>
  );
}
