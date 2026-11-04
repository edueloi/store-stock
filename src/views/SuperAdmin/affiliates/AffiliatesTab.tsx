import { useMemo, useState, type FormEvent } from "react";
import { UserPlus } from "lucide-react";

import { Button } from "../../../components/ui/Button";
import { Input, Select } from "../../../components/ui/Input";
import { Modal, ModalFooter } from "../../../components/ui/Modal";
import { FilterLine, FilterLineSearch, FilterLineSection, FilterLineSegmented } from "../../../components/ui/FilterLine";
import { GridTable, type Column } from "../../../components/ui/GridTable";
import AffiliateDrawer from "./AffiliateDrawer";
import {
  AFFILIATE_STATUS, WALLET_STATUS, adminApi, brl, dateBR, errorMessage, maskPhone, useAdminData,
  type AffiliatePlan, type AffiliateRow, type AffiliateStatus, type Notify,
} from "./lib";
import { AsyncState, StatusBadge } from "./ui";

type StatusFilter = "all" | AffiliateStatus;

const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "pending", label: "Aguardando" },
  { value: "active", label: "Ativos" },
  { value: "suspended", label: "Suspensos" },
  { value: "rejected", label: "Recusados" },
];

export default function AffiliatesTab({ plans, notify, onChanged }: { plans: AffiliatePlan[]; notify: Notify; onChanged: () => void }) {
  const [status, setStatus] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (status !== "all") params.set("status", status);
    if (search.trim()) params.set("q", search.trim());
    const qs = params.toString();
    return `/affiliates${qs ? `?${qs}` : ""}`;
  }, [status, search]);

  const { data, loading, error, reload } = useAdminData<{ affiliates: AffiliateRow[] }>(query);
  const rows = data?.affiliates ?? [];

  const columns: Column<AffiliateRow>[] = [
    {
      header: "Afiliado",
      render: (a) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">{a.name}</p>
          <p className="truncate text-[11px] text-slate-500">{a.code} · {a.email}</p>
        </div>
      ),
    },
    { header: "Situação", render: (a) => <div className="flex flex-col items-start gap-1"><StatusBadge meta={AFFILIATE_STATUS[a.status]} /><StatusBadge meta={WALLET_STATUS[a.walletStatus]} /></div> },
    { header: "Plano", render: (a) => <span className="text-xs text-slate-600">{a.planName ?? "Padrão"}</span>, hideOnMobile: true },
    { header: "Cliques", render: (a) => <span className="text-xs tabular-nums">{a.stats?.clicks.total ?? 0}</span>, hideOnMobile: true },
    { header: "Leads", render: (a) => <span className="text-xs tabular-nums">{a.stats?.leads.total ?? 0}</span>, hideOnMobile: true },
    { header: "Vendas", render: (a) => <span className="text-xs tabular-nums">{a.stats?.sales.total ?? 0}</span> },
    { header: "Clientes ativos", render: (a) => <span className="text-xs tabular-nums">{a.stats?.sales.activeClients ?? 0}</span>, hideOnMobile: true },
    {
      header: "Comissões",
      render: (a) => (
        <div className="text-[11px] leading-snug tabular-nums text-slate-600">
          <p>A receber <b className="text-amber-700">{brl(a.stats?.commissions.pending)}</b></p>
          <p>Disponível <b className="text-sky-700">{brl(a.stats?.commissions.available)}</b></p>
          <p>Paga <b className="text-emerald-700">{brl(a.stats?.commissions.paid)}</b></p>
        </div>
      ),
    },
    { header: "Cadastro", render: (a) => <span className="text-xs text-slate-500">{dateBR(a.createdAt)}</span>, hideOnMobile: true },
  ];

  return (
    <div className="space-y-4">
      <FilterLine>
        <FilterLineSection>
          <FilterLineSegmented<StatusFilter> value={status} onChange={setStatus} options={FILTERS} size="sm" />
        </FilterLineSection>
        <FilterLineSection>
          <div className="w-full sm:w-72"><FilterLineSearch value={search} onChange={setSearch} placeholder="Nome, e-mail, código ou WhatsApp" aria-label="Buscar afiliado" /></div>
          <Button size="sm" iconLeft={<UserPlus size={14} />} onClick={() => setCreating(true)}>Novo afiliado</Button>
        </FilterLineSection>
      </FilterLine>

      <AsyncState loading={loading && !data} error={error} onRetry={reload} empty={rows.length === 0}
        emptyTitle="Nenhum afiliado encontrado" emptyDescription="Quando alguém se cadastrar pela página de afiliados, aparece aqui para aprovação.">
        <GridTable<AffiliateRow>
          data={rows} columns={columns} keyExtractor={(a) => a.id}
          onRowClick={(a) => setOpenId(a.id)} isLoading={loading} emptyMessage="Nenhum afiliado encontrado."
        />
      </AsyncState>

      <AffiliateDrawer affiliateId={openId} plans={plans} notify={notify} onClose={() => setOpenId(null)} onChanged={() => { reload(); onChanged(); }} />
      <CreateAffiliateModal open={creating} plans={plans} notify={notify} onClose={() => setCreating(false)} onCreated={(id) => { setCreating(false); reload(); onChanged(); setOpenId(id); }} />
    </div>
  );
}

function CreateAffiliateModal({ open, plans, notify, onClose, onCreated }: {
  open: boolean; plans: AffiliatePlan[]; notify: Notify; onClose: () => void; onCreated: (id: number) => void;
}) {
  const [form, setForm] = useState({ name: "", email: "", whatsapp: "", document: "", asaasWalletId: "", planId: "" });
  const [saving, setSaving] = useState(false);
  const set = (key: keyof typeof form, value: string) => setForm((f) => ({ ...f, [key]: value }));
  const ok = form.name.trim().length > 1 && /.+@.+\..+/.test(form.email) && form.whatsapp.replace(/\D/g, "").length >= 10;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!ok) return;
    setSaving(true);
    try {
      const { affiliate } = await adminApi<{ affiliate: { id: number } }>("/affiliates", {
        method: "POST",
        body: {
          name: form.name.trim(), email: form.email.trim().toLowerCase(), whatsapp: form.whatsapp.replace(/\D/g, ""),
          document: form.document.replace(/\D/g, "") || undefined, asaasWalletId: form.asaasWalletId.trim() || undefined,
          planId: form.planId ? Number(form.planId) : undefined,
        },
      });
      notify("success", "Afiliado criado e já ativo.");
      setForm({ name: "", email: "", whatsapp: "", document: "", asaasWalletId: "", planId: "" });
      onCreated(affiliate.id);
    } catch (e) { notify("error", errorMessage(e, "Não foi possível criar o afiliado.")); }
    finally { setSaving(false); }
  }

  return (
    <Modal open={open} onClose={onClose} size="md" title="Novo afiliado" subtitle="Cadastro feito pela equipe: o afiliado já nasce ativo."
      footer={<ModalFooter><Button variant="outline" onClick={onClose}>Cancelar</Button><Button type="submit" form="aff-create-form" loading={saving} disabled={!ok}>Criar afiliado</Button></ModalFooter>}>
      <form id="aff-create-form" onSubmit={submit} className="space-y-3">
        <Input label="Nome" required value={form.name} onChange={(e) => set("name", e.target.value)} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="E-mail" type="email" required value={form.email} onChange={(e) => set("email", e.target.value)} />
          <Input label="WhatsApp" required value={maskPhone(form.whatsapp)} onChange={(e) => set("whatsapp", e.target.value)} placeholder="(00) 00000-0000" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="CPF/CNPJ (opcional)" value={form.document} onChange={(e) => set("document", e.target.value)} />
          <Select label="Plano de comissão" value={form.planId} onChange={(e) => set("planId", e.target.value)}
            options={[{ value: "", label: "Plano padrão" }, ...plans.filter((p) => p.isActive).map((p) => ({ value: p.id, label: p.name }))]} />
        </div>
        <Input label="WalletId do Asaas (opcional)" value={form.asaasWalletId} onChange={(e) => set("asaasWalletId", e.target.value)}
          hint="Sem a carteira o afiliado não recebe o split. Pode ser preenchida depois." />
      </form>
    </Modal>
  );
}
