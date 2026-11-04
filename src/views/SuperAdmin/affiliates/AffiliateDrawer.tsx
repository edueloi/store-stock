import { useState } from "react";
import { BadgeCheck, Ban, CheckCircle2, Coins, ExternalLink, Handshake, ListChecks, MessageCircle, RotateCcw, Target, UserRound, Users, XCircle } from "lucide-react";

import { Alert } from "../../../components/ui/Alert";
import { Button } from "../../../components/ui/Button";
import Drawer from "../../../components/ui/Drawer";
import { Input, Select, Textarea } from "../../../components/ui/Input";
import { Switch } from "../../../components/ui/Switch";
import { Tabs } from "../../../components/ui/Tabs";
import GoalsTab from "./GoalsTab";
import RulesEditor from "./RulesEditor";
import {
  AFFILIATE_STATUS, COMMISSION_STATUS, LEAD_STATUS, REFERRAL_STATUS, SYSTEM_LABEL, WALLET_STATUS,
  adminApi, brl, dateBR, dateTimeBR, describeRules, draftToRules, errorMessage, maskPhone, rulesToDraft, useAdminData, validateDraft, waLink,
  type Affiliate, type AffiliateCommission, type AffiliateLead, type AffiliatePlan, type AffiliateReferral, type AffiliateStats,
  type AffiliateStatus, type CommissionRule, type Notify, type WalletStatus,
} from "./lib";
import { AsyncState, KeyValue, StatusBadge } from "./ui";

interface Detail {
  affiliate: Affiliate;
  rules: CommissionRule[];
  stats: AffiliateStats;
  leads: AffiliateLead[];
  referrals: AffiliateReferral[];
  commissions: AffiliateCommission[];
}

const TABS = [
  { id: "profile", label: "Perfil", icon: UserRound },
  { id: "rules", label: "Comissão", icon: Coins },
  { id: "leads", label: "Leads", icon: ListChecks },
  { id: "clients", label: "Clientes", icon: Users },
  { id: "commissions", label: "Extrato", icon: BadgeCheck },
  { id: "goals", label: "Metas", icon: Target },
] as const;
type TabId = (typeof TABS)[number]["id"];

export default function AffiliateDrawer({ affiliateId, plans, notify, onClose, onChanged }: {
  affiliateId: number | null; plans: AffiliatePlan[]; notify: Notify; onClose: () => void; onChanged: () => void;
}) {
  return (
    <Drawer open={affiliateId !== null} onClose={onClose} title="Afiliado" subtitle="Perfil, comissão, clientes e extrato" width="min(960px, 100vw)">
      {affiliateId !== null && <DrawerBody key={affiliateId} affiliateId={affiliateId} plans={plans} notify={notify} onChanged={onChanged} />}
    </Drawer>
  );
}

function DrawerBody({ affiliateId, plans, notify, onChanged }: { affiliateId: number; plans: AffiliatePlan[]; notify: Notify; onChanged: () => void }) {
  const { data, loading, error, reload } = useAdminData<Detail>(`/affiliates/${affiliateId}`);
  const [tab, setTab] = useState<TabId>("profile");

  const refresh = () => { reload(); onChanged(); };

  return (
    <AsyncState loading={loading && !data} error={error} onRetry={reload}>
      {data && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-blue-100 bg-blue-50 text-blue-700"><Handshake size={20} /></div>
              <div className="min-w-0">
                <h2 className="truncate text-base font-semibold text-slate-950">{data.affiliate.name}</h2>
                <p className="truncate text-xs text-slate-500">Código <b className="font-mono text-slate-700">{data.affiliate.code}</b> · {data.affiliate.email}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge meta={AFFILIATE_STATUS[data.affiliate.status]} />
              <StatusBadge meta={WALLET_STATUS[data.affiliate.walletStatus]} />
            </div>
          </div>

          <Tabs<TabId> items={TABS} value={tab} onChange={setTab} label="Seções do afiliado">
            {tab === "profile" && <ProfileSection detail={data} notify={notify} onSaved={refresh} />}
            {tab === "rules" && <RulesSection detail={data} plans={plans} notify={notify} onSaved={refresh} />}
            {tab === "leads" && <LeadsSection leads={data.leads} />}
            {tab === "clients" && <ClientsSection referrals={data.referrals} />}
            {tab === "commissions" && <CommissionsSection commissions={data.commissions} stats={data.stats} />}
            {tab === "goals" && <GoalsTab notify={notify} affiliateId={affiliateId} />}
          </Tabs>
        </div>
      )}
    </AsyncState>
  );
}

// ─── Perfil ────────────────────────────────────────────────────────────────
function ProfileSection({ detail, notify, onSaved }: { detail: Detail; notify: Notify; onSaved: () => void }) {
  const a = detail.affiliate;
  const [form, setForm] = useState({
    name: a.name, whatsapp: a.whatsapp, asaasWalletId: a.asaasWalletId ?? "", walletStatus: a.walletStatus as WalletStatus, adminNotes: a.adminNotes ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<AffiliateStatus | null>(null);
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }));

  const walletMissing = form.asaasWalletId.trim() === "";
  const noRules = detail.rules.length === 0;

  async function patch(body: Record<string, unknown>, ok: string) {
    await adminApi(`/affiliates/${a.id}`, { method: "PATCH", body });
    notify("success", ok);
    onSaved();
  }

  async function save() {
    setSaving(true);
    try {
      await patch({
        name: form.name.trim(), whatsapp: form.whatsapp.replace(/\D/g, ""), asaasWalletId: form.asaasWalletId.trim() || null,
        walletStatus: walletMissing ? "pending" : form.walletStatus, adminNotes: form.adminNotes.trim() || null,
      }, "Perfil salvo.");
    } catch (e) { notify("error", errorMessage(e, "Não foi possível salvar.")); }
    finally { setSaving(false); }
  }

  async function setStatus(status: AffiliateStatus) {
    if (status === "active" && a.status === "pending" && !window.confirm("Aprovar este afiliado? Ele recebe um e-mail com o link de acesso ao painel.")) return;
    setBusy(status);
    try {
      await patch({ status }, status === "active" ? "Afiliado ativo." : status === "suspended" ? "Afiliado suspenso." : "Situação atualizada.");
    } catch (e) { notify("error", errorMessage(e, "Não foi possível mudar a situação.")); }
    finally { setBusy(null); }
  }

  return (
    <div className="space-y-4">
      {a.status === "pending" && (
        <Alert variant="warning" title="Aguardando aprovação">
          Confira os dados, o plano de comissão e a carteira Asaas antes de aprovar. Ao aprovar, ele recebe o link de acesso por e-mail.
        </Alert>
      )}
      {a.status === "active" && noRules && (
        <Alert variant="error" title="Sem regras de comissão">Este afiliado não tem plano nem plano padrão ativo: ele não vai ganhar nada. Defina na aba Comissão.</Alert>
      )}
      {a.status === "active" && walletMissing && (
        <Alert variant="warning" title="Sem carteira Asaas">Sem o walletId, o split não é aplicado nas cobranças dos clientes dele.</Alert>
      )}

      <div className="flex flex-wrap gap-2">
        {a.status !== "active" && <Button size="sm" variant="success" loading={busy === "active"} iconLeft={<CheckCircle2 size={13} />} onClick={() => void setStatus("active")}>{a.status === "pending" ? "Aprovar" : "Reativar"}</Button>}
        {a.status === "pending" && <Button size="sm" variant="outline" loading={busy === "rejected"} iconLeft={<XCircle size={13} />} onClick={() => void setStatus("rejected")}>Recusar</Button>}
        {a.status === "active" && <Button size="sm" variant="danger" loading={busy === "suspended"} iconLeft={<Ban size={13} />} onClick={() => void setStatus("suspended")}>Suspender</Button>}
        {a.status === "rejected" && <Button size="sm" variant="outline" loading={busy === "pending"} iconLeft={<RotateCcw size={13} />} onClick={() => void setStatus("pending")}>Voltar para análise</Button>}
        <a href={waLink(a.whatsapp)} target="_blank" rel="noopener noreferrer"><Button size="sm" variant="outline" iconLeft={<MessageCircle size={13} />}>WhatsApp</Button></a>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <KeyValue label="Cadastro">{dateBR(a.createdAt)}</KeyValue>
        <KeyValue label="Aprovado em">{dateBR(a.approvedAt)}</KeyValue>
        <KeyValue label="Último acesso">{dateTimeBR(a.lastLoginAt)}</KeyValue>
        <KeyValue label="CPF/CNPJ">{a.document || "—"}</KeyValue>
      </div>
      {a.pitch && <KeyValue label="Como pretende divulgar">{a.pitch}</KeyValue>}

      <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Nome" value={form.name} onChange={(e) => set("name", e.target.value)} />
          <Input label="WhatsApp" value={maskPhone(form.whatsapp)} onChange={(e) => set("whatsapp", e.target.value)} />
        </div>
        <Input label="WalletId do Asaas" value={form.asaasWalletId} onChange={(e) => set("asaasWalletId", e.target.value)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
          hint="É o identificador da conta Asaas do afiliado, que ele informa no cadastro. Só recebe o split depois de o Split estar habilitado na conta principal (Integrações > Segurança > Habilitar Split)." />
        <div className="flex items-center justify-between rounded-lg border border-slate-200 p-3 text-xs font-medium text-slate-700">
          <span>Carteira validada (conferida com o afiliado)</span>
          <Switch checked={form.walletStatus === "verified" && !walletMissing} disabled={walletMissing} aria-label="Carteira validada"
            onCheckedChange={(v) => set("walletStatus", v ? "verified" : "pending")} />
        </div>
        <Textarea label="Anotações da equipe" value={form.adminNotes} onChange={(e) => set("adminNotes", e.target.value)} rows={3} placeholder="Só a equipe vê isto." />
        <div className="flex justify-end"><Button loading={saving} onClick={() => void save()} iconLeft={<BadgeCheck size={14} />}>Salvar perfil</Button></div>
      </div>
    </div>
  );
}

// ─── Comissão ──────────────────────────────────────────────────────────────
function RulesSection({ detail, plans, notify, onSaved }: { detail: Detail; plans: AffiliatePlan[]; notify: Notify; onSaved: () => void }) {
  const a = detail.affiliate;
  const [planId, setPlanId] = useState(a.planId ? String(a.planId) : "");
  const [override, setOverride] = useState(!!a.rulesOverride && a.rulesOverride.length > 0);
  const [draft, setDraft] = useState(() => rulesToDraft(a.rulesOverride ?? detail.rules));
  const [saving, setSaving] = useState(false);

  const validation = validateDraft(draft);
  const overrideValid = !override || (validation.general === null && Object.keys(validation.rows).length === 0);

  async function save() {
    setSaving(true);
    try {
      await adminApi(`/affiliates/${a.id}`, {
        method: "PATCH",
        body: { planId: planId ? Number(planId) : null, rulesOverride: override ? draftToRules(draft) : null },
      });
      notify("success", "Regras de comissão salvas. Valem para as próximas vendas.");
      onSaved();
    } catch (e) { notify("error", errorMessage(e, "Não foi possível salvar.")); }
    finally { setSaving(false); }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Regras em vigor para novas vendas</p>
        <p className="mt-1 text-sm font-medium text-slate-800">{describeRules(detail.rules)}</p>
      </div>

      <Select label="Plano de comissão" value={planId} onChange={(e) => setPlanId(e.target.value)}
        hint="Sem plano próprio, vale o plano padrão ativo."
        options={[{ value: "", label: "Plano padrão" }, ...plans.filter((p) => p.isActive).map((p) => ({ value: p.id, label: `${p.name} — ${describeRules(p.rules)}` }))]} />

      <div className="flex items-center justify-between rounded-lg border border-slate-200 p-3 text-xs font-medium text-slate-700">
        <span>Usar regras só deste afiliado (ignora o plano)</span>
        <Switch checked={override} aria-label="Regras individuais" onCheckedChange={setOverride} />
      </div>
      {override && <RulesEditor value={draft} onChange={setDraft} />}

      <Alert variant="info">Vendas já feitas guardam as regras do dia da venda e não mudam. Só as próximas indicações usam as regras novas.</Alert>
      <div className="flex justify-end"><Button loading={saving} disabled={!overrideValid} onClick={() => void save()}>Salvar comissão</Button></div>
    </div>
  );
}

// ─── Listas (somente leitura) ──────────────────────────────────────────────
function Simple({ empty, children }: { empty: boolean; children: React.ReactNode }) {
  if (empty) return <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center text-xs text-slate-500">Nada por aqui ainda.</div>;
  return <div className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-white">{children}</div>;
}

function LeadsSection({ leads }: { leads: AffiliateLead[] }) {
  return (
    <Simple empty={leads.length === 0}>
      {leads.map((l) => (
        <div key={l.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">{l.name}</p>
            <p className="truncate text-[11px] text-slate-500">{maskPhone(l.whatsapp)}{l.business ? ` · ${l.business}` : ""} · {SYSTEM_LABEL[l.system] ?? l.system} · {dateTimeBR(l.createdAt)}</p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge meta={LEAD_STATUS[l.status]} />
            <a href={waLink(l.whatsapp)} target="_blank" rel="noopener noreferrer" aria-label="Abrir WhatsApp" className="text-slate-400 hover:text-emerald-600"><ExternalLink size={14} /></a>
          </div>
        </div>
      ))}
    </Simple>
  );
}

function ClientsSection({ referrals }: { referrals: AffiliateReferral[] }) {
  return (
    <Simple empty={referrals.length === 0}>
      {referrals.map((r) => (
        <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">{r.customerName}</p>
            <p className="text-[11px] text-slate-500">
              {brl(r.planValue)}/mês · desde {dateBR(r.startedAt)}
              {r.totalMonths !== undefined && ` · ${r.countedMonths ?? 0}${r.totalMonths === null ? " mês(es) pagos" : ` de ${r.totalMonths} meses de comissão`}`}
            </p>
          </div>
          <StatusBadge meta={REFERRAL_STATUS[r.status]} />
        </div>
      ))}
    </Simple>
  );
}

function CommissionsSection({ commissions, stats }: { commissions: AffiliateCommission[]; stats: AffiliateStats }) {
  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-3">
        <KeyValue label="A receber">{brl(stats.commissions.pending)}</KeyValue>
        <KeyValue label="Disponível">{brl(stats.commissions.available)}</KeyValue>
        <KeyValue label="Repassado">{brl(stats.commissions.paid)}</KeyValue>
      </div>
      <Simple empty={commissions.length === 0}>
        {commissions.map((c) => (
          <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">{c.customerName} · {c.sequence}º mês</p>
              <p className="text-[11px] text-slate-500">Cobrança {brl(c.grossValue)} · {c.ruleType === "percent" ? `${String(c.ruleValue).replace(".", ",")}%` : `fixo ${brl(c.ruleValue)}`} · {c.paidAt ? `pago ${dateBR(c.paidAt)}` : `vence ${dateBR(c.dueDate)}`}</p>
            </div>
            <div className="flex items-center gap-3">
              <b className="text-sm tabular-nums text-slate-900">{brl(c.commissionValue)}</b>
              <StatusBadge meta={COMMISSION_STATUS[c.status]} />
            </div>
          </div>
        ))}
      </Simple>
    </div>
  );
}
