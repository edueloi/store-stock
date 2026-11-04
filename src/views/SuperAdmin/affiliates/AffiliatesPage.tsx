import { useState } from "react";
import { motion } from "motion/react";
import { BadgeDollarSign, Coins, Handshake, LayoutDashboard, ListChecks, Target, UserPlus, Users, Webhook } from "lucide-react";

import { SectionTitle } from "../../../components/ui/PageWrapper";
import { Tabs } from "../../../components/ui/Tabs";
import AffiliatesTab from "./AffiliatesTab";
import CommissionsTab from "./CommissionsTab";
import GoalsTab from "./GoalsTab";
import LeadsTab from "./LeadsTab";
import OverviewTab from "./OverviewTab";
import PlansTab from "./PlansTab";
import ReferralsTab from "./ReferralsTab";
import WebhookTab from "./WebhookTab";
import { useAdminData, type AffiliatePlan, type Notify, type Overview } from "./lib";

type TabId = "overview" | "affiliates" | "plans" | "leads" | "referrals" | "commissions" | "goals" | "webhook";

/** Gestão do programa de afiliados no Super Admin. Contrato da API: docs/AFILIADOS-API.md. */
export default function AffiliatesPage({ notify }: { notify: Notify }) {
  const [tab, setTab] = useState<TabId>("overview");
  const overview = useAdminData<Overview>("/overview");
  const plans = useAdminData<{ plans: AffiliatePlan[] }>("/plans");

  const o = overview.data;
  const tabs = [
    { id: "overview", label: "Visão geral", icon: LayoutDashboard },
    { id: "affiliates", label: "Afiliados", icon: Handshake, badge: o?.affiliates.pending ? o.affiliates.pending : undefined },
    { id: "plans", label: "Planos de comissão", icon: Coins },
    { id: "leads", label: "Leads", icon: UserPlus, badge: o?.leads.new ? o.leads.new : undefined },
    { id: "referrals", label: "Clientes indicados", icon: Users },
    { id: "commissions", label: "Comissões", icon: BadgeDollarSign },
    { id: "goals", label: "Metas", icon: Target },
    { id: "webhook", label: "Webhook Develoi", icon: Webhook, badge: o?.webhook.failed ? o.webhook.failed : undefined },
  ] as const;

  const changed = () => overview.reload();

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <SectionTitle
        icon={ListChecks}
        title="Programa de afiliados"
        description="Aprove afiliados, defina quanto cada um ganha por mês de assinatura e acompanhe vendas, comissões e o webhook para a Develoi."
      />
      <Tabs<TabId> items={tabs} value={tab} onChange={setTab} label="Gestão de afiliados">
        {tab === "overview" && <OverviewTab data={overview.data} loading={overview.loading} error={overview.error} reload={overview.reload} onGo={(next) => setTab(next)} />}
        {tab === "affiliates" && <AffiliatesTab plans={plans.data?.plans ?? []} notify={notify} onChanged={changed} />}
        {tab === "plans" && <PlansTab notify={notify} onChanged={() => { plans.reload(); changed(); }} />}
        {tab === "leads" && <LeadsTab notify={notify} onChanged={changed} />}
        {tab === "referrals" && <ReferralsTab notify={notify} onChanged={changed} />}
        {tab === "commissions" && <CommissionsTab notify={notify} onChanged={changed} />}
        {tab === "goals" && <GoalsTab notify={notify} />}
        {tab === "webhook" && <WebhookTab notify={notify} onChanged={changed} />}
      </Tabs>
    </motion.div>
  );
}
