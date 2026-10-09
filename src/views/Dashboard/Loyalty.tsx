import { useState, useEffect, useCallback, useRef } from "react";
import {
  Star, Gift, Users, TrendingUp, Award, Settings, Plus, Trash2,
  Edit2, X, Package, Percent, DollarSign, Calendar,
  AlertTriangle, ToggleLeft, ToggleRight, Clock, Search,
  Cake, ChevronDown, ChevronUp, Check, HelpCircle, Loader2,
} from "lucide-react";
import React from "react";
import { cn } from "../../lib/utils";

import { Button, IconButton, Input, Select, Switch, Modal, ModalFooter, Badge, Alert, EmptyState, ContentCard, PanelCard, DetailField, SectionTitle, StatGrid, StatCard, Tabs, FilterLine, FilterLineSection, FilterLineSearch } from "../../components/ui";
import { productHasStock } from "../../utils/productStock";
import LoyaltyPageTour, { LOYALTY_PAGE_TOUR_EVENTS, type LoyaltyPageTourHandle } from "../../components/onboarding/LoyaltyPageTour";

// ─── Types ────────────────────────────────────────────────────────────────────

interface LoyaltyReward {
  id: number;
  name: string;
  type: "discount" | "product";
  discount_value?: number;
  discount_type?: "fixed" | "percent";
  product_id?: number;
  product_qty?: number;
  points_cost: number;
  is_active: boolean;
}

interface LoyaltyProgram {
  id: number;
  is_active: boolean;
  name: string;
  spend_per_point: number;
  points_expiry_days: number;
  season_start?: string;
  season_end?: string;
  rewards: LoyaltyReward[];
}

interface TopCustomer {
  customer_id: number;
  name: string;
  phone?: string;
  balance: number;
}

interface CustomerWithPoints {
  id: number;
  name: string;
  phone?: string;
  document?: string;
  birth_date?: string;
  balance: number;
}

interface PointEntry {
  id: number;
  delta: number;
  balance_after: number;
  description?: string;
  created_at: string;
}

interface Product {
  id: number;
  name: string;
  stock_quantity: number;
  sale_unit?: "unidade" | "m2" | "linear";
  skus?: { combo: Record<string, string>; stock: number }[];
  variations?: { name: string; options: { value: string; stock: number }[] }[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const authH = () => ({
  Authorization: `Bearer ${localStorage.getItem("token")}`,
  "Content-Type": "application/json",
});

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// ─── Main ─────────────────────────────────────────────────────────────────────

type Tab = "overview" | "points" | "rewards" | "settings";

const LOYALTY_TABS = [
  { id: "overview", label: "Visão Geral", icon: TrendingUp },
  { id: "points", label: "Pontos", icon: Star },
  { id: "rewards", label: "Recompensas", icon: Gift },
  { id: "settings", label: "Configurações", icon: Settings },
] as const satisfies readonly { id: Tab; label: string; icon: React.ElementType }[];

export default function Loyalty() {
  const [tab, setTab] = useState<Tab>("overview");
  const [program, setProgram]           = useState<LoyaltyProgram | null>(null);
  const [loading, setLoading]           = useState(true);
  const [stats, setStats]               = useState({ total_points_issued: 0, total_redemptions: 0, active_customers: 0 });
  const [topCustomers, setTopCustomers] = useState<TopCustomer[]>([]);
  const [products, setProducts]         = useState<Product[]>([]);

  // reward form
  const [showRewardForm, setShowRewardForm] = useState(false);
  const [editReward, setEditReward]         = useState<LoyaltyReward | null>(null);
  const [rName, setRName]       = useState("");
  const [rType, setRType]       = useState<"discount" | "product">("discount");
  const [rDiscVal, setRDiscVal] = useState("");
  const [rDiscType, setRDiscType] = useState<"fixed" | "percent">("fixed");
  const [rProductId, setRProductId] = useState("");
  const [rProductQty, setRProductQty] = useState("1");
  const [rPoints, setRPoints]   = useState("");
  const [savingR, setSavingR]   = useState(false);

  // settings form
  const [sName, setSName]           = useState("");
  const [sSpend, setSSpend]         = useState("");
  const [sExpiry, setSExpiry]       = useState("");
  const [sSeasonStart, setSSeasonStart] = useState("");
  const [sSeasonEnd, setSSeasonEnd]   = useState("");
  const [sActive, setSActive]       = useState(true);
  const [savingS, setSavingS]       = useState(false);

  // points tab
  const [allCustomers, setAllCustomers]   = useState<CustomerWithPoints[]>([]);
  const [loadingPts, setLoadingPts]       = useState(false);
  const [ptSearch, setPtSearch]           = useState("");
  const [expandedId, setExpandedId]       = useState<number | null>(null);
  const [expandedEntries, setExpandedEntries] = useState<PointEntry[]>([]);
  const [loadingEntries, setLoadingEntries]   = useState(false);
  // manual adjust form
  const [adjId, setAdjId]       = useState<number | null>(null);
  const [adjDelta, setAdjDelta] = useState("");
  const [adjDesc, setAdjDesc]   = useState("");
  const [savingAdj, setSavingAdj] = useState(false);

  const loyaltyPageTourRef = useRef<LoyaltyPageTourHandle>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, sRes, prRes] = await Promise.all([
        fetch("/api/loyalty/program",  { headers: authH() }),
        fetch("/api/loyalty/summary",  { headers: authH() }),
        fetch("/api/products",         { headers: authH() }),
      ]);
      const p = await pRes.json();
      const s = await sRes.json();
      const pr = await prRes.json();

      setProgram(p);
      setStats(s.stats ?? { total_points_issued: 0, total_redemptions: 0, active_customers: 0 });
      setTopCustomers(s.top_customers ?? []);
      setProducts(Array.isArray(pr) ? pr : []);

      setSName(p.name ?? "");
      setSSpend(String(p.spend_per_point ?? 10));
      setSExpiry(String(p.points_expiry_days ?? 0));
      setSSeasonStart(p.season_start ? p.season_start.slice(0, 10) : "");
      setSSeasonEnd(p.season_end ? p.season_end.slice(0, 10) : "");
      setSActive(p.is_active ?? true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const fetchPointsTab = useCallback(async () => {
    setLoadingPts(true);
    try {
      // fetch all customers + their points via summary top list (limited)
      // We load all customers then fetch each balance via summary
      const [custRes, sumRes] = await Promise.all([
        fetch("/api/customers", { headers: authH() }),
        fetch("/api/loyalty/summary", { headers: authH() }),
      ]);
      const custs = await custRes.json();
      const sum   = await sumRes.json();
      const topMap = new Map<number, number>(
        (sum.top_customers ?? []).map((t: TopCustomer) => [t.customer_id, t.balance])
      );
      const enriched: CustomerWithPoints[] = (Array.isArray(custs) ? custs : []).map((c: { id: number; name: string; phone?: string; document?: string; birth_date?: string }) => ({
        id: c.id, name: c.name, phone: c.phone, document: c.document,
        birth_date: c.birth_date,
        balance: topMap.get(c.id) ?? 0,
      }));
      // sort: customers with points first, then alpha
      enriched.sort((a, b) => b.balance - a.balance || a.name.localeCompare(b.name));
      setAllCustomers(enriched);
    } finally {
      setLoadingPts(false);
    }
  }, []);

  async function handleAdjustPoints(customerId: number) {
    if (!adjDelta) return;
    setSavingAdj(true);
    try {
      await fetch(`/api/loyalty/customers/${customerId}/points`, {
        method: "POST", headers: authH(),
        body: JSON.stringify({ delta: Number(adjDelta), description: adjDesc || null }),
      });
      setAdjId(null); setAdjDelta(""); setAdjDesc("");
      fetchPointsTab();
      // refresh entries if expanded
      if (expandedId === customerId) fetchEntries(customerId);
    } finally { setSavingAdj(false); }
  }

  async function fetchEntries(customerId: number) {
    setLoadingEntries(true);
    try {
      const res = await fetch(`/api/loyalty/customers/${customerId}/points`, { headers: authH() });
      const d = await res.json();
      setExpandedEntries(d.entries ?? []);
    } finally { setLoadingEntries(false); }
  }

  function toggleExpand(id: number) {
    if (expandedId === id) { setExpandedId(null); setExpandedEntries([]); }
    else { setExpandedId(id); fetchEntries(id); }
  }

  // ── Settings save
  async function handleSaveSettings() {
    setSavingS(true);
    try {
      await fetch("/api/loyalty/program", {
        method: "PUT",
        headers: authH(),
        body: JSON.stringify({
          name: sName,
          is_active: sActive,
          spend_per_point: Number(sSpend),
          points_expiry_days: Number(sExpiry),
          season_start: sSeasonStart || null,
          season_end: sSeasonEnd || null,
        }),
      });
      await fetchAll();
    } finally {
      setSavingS(false);
    }
  }

  // ── Reward form helpers
  function openCreateReward() {
    setEditReward(null);
    setRName(""); setRType("discount"); setRDiscVal(""); setRDiscType("fixed");
    setRProductId(""); setRProductQty("1"); setRPoints("");
    setShowRewardForm(true);
  }

  function openEditReward(r: LoyaltyReward) {
    setEditReward(r);
    setRName(r.name);
    setRType(r.type);
    setRDiscVal(r.discount_value ? String(r.discount_value) : "");
    setRDiscType(r.discount_type ?? "fixed");
    setRProductId(r.product_id ? String(r.product_id) : "");
    setRProductQty(String(r.product_qty ?? 1));
    setRPoints(String(r.points_cost));
    setShowRewardForm(true);
  }

  async function handleSaveReward() {
    if (!rName.trim() || !rPoints) return;
    setSavingR(true);
    try {
      const body = {
        name: rName,
        type: rType,
        points_cost: Number(rPoints),
        ...(rType === "discount" ? {
          discount_value: Number(rDiscVal),
          discount_type: rDiscType,
        } : {
          product_id: Number(rProductId),
          product_qty: Number(rProductQty),
        }),
      };
      if (editReward) {
        await fetch(`/api/loyalty/rewards/${editReward.id}`, {
          method: "PUT", headers: authH(), body: JSON.stringify(body),
        });
      } else {
        await fetch("/api/loyalty/rewards", {
          method: "POST", headers: authH(), body: JSON.stringify(body),
        });
      }
      await fetchAll();
      setShowRewardForm(false);
    } finally {
      setSavingR(false);
    }
  }

  async function toggleReward(r: LoyaltyReward) {
    await fetch(`/api/loyalty/rewards/${r.id}`, {
      method: "PUT", headers: authH(),
      body: JSON.stringify({ is_active: !r.is_active }),
    });
    await fetchAll();
  }

  async function deleteReward(id: number) {
    if (!confirm("Excluir esta recompensa?")) return;
    await fetch(`/api/loyalty/rewards/${id}`, { method: "DELETE", headers: authH() });
    await fetchAll();
  }

  // ── Canal de comunicação do TOUR DE PÁGINA (LoyaltyPageTour) ──────────────
  // Troca de aba via setTab e, só na aba Recompensas, abre o drawer "Nova
  // Recompensa" de verdade via openCreateReward, preenchendo nome/pontos de
  // exemplo via setRName/setRPoints — nunca chama handleSaveSettings,
  // handleSaveReward, deleteReward (window.confirm), toggleReward ou
  // handleAdjustPoints. Fechar sempre via setShowRewardForm(false)
  // (equivalente a clicar fora ou no X, que já fazem isso na tela real). O
  // evento forceCloseAdjust é só defesa em profundidade: este tour nunca abre
  // o formulário de ajuste manual de pontos, mas garante que ele não fica
  // aberto por acaso ao sair do tour.
  useEffect(() => {
    const onGoOverview = () => setTab("overview");
    const onGoPoints = () => { setTab("points"); fetchPointsTab(); };
    const onGoRewards = () => setTab("rewards");
    const onGoSettings = () => setTab("settings");
    const onOpenNewReward = () => openCreateReward();
    const onFillReward = (e: Event) => {
      const detail = (e as CustomEvent<{ name?: string; points?: string }>).detail;
      if (!detail) return;
      if (detail.name !== undefined) setRName(detail.name);
      if (detail.points !== undefined) setRPoints(detail.points);
    };
    const onCloseRewardForm = () => setShowRewardForm(false);
    const onForceCloseAdjust = () => setAdjId(null);

    window.addEventListener(LOYALTY_PAGE_TOUR_EVENTS.goOverviewTab, onGoOverview);
    window.addEventListener(LOYALTY_PAGE_TOUR_EVENTS.goPointsTab, onGoPoints);
    window.addEventListener(LOYALTY_PAGE_TOUR_EVENTS.goRewardsTab, onGoRewards);
    window.addEventListener(LOYALTY_PAGE_TOUR_EVENTS.goSettingsTab, onGoSettings);
    window.addEventListener(LOYALTY_PAGE_TOUR_EVENTS.openNewReward, onOpenNewReward);
    window.addEventListener(LOYALTY_PAGE_TOUR_EVENTS.fillReward, onFillReward);
    window.addEventListener(LOYALTY_PAGE_TOUR_EVENTS.closeRewardForm, onCloseRewardForm);
    window.addEventListener(LOYALTY_PAGE_TOUR_EVENTS.forceCloseAdjust, onForceCloseAdjust);
    return () => {
      window.removeEventListener(LOYALTY_PAGE_TOUR_EVENTS.goOverviewTab, onGoOverview);
      window.removeEventListener(LOYALTY_PAGE_TOUR_EVENTS.goPointsTab, onGoPoints);
      window.removeEventListener(LOYALTY_PAGE_TOUR_EVENTS.goRewardsTab, onGoRewards);
      window.removeEventListener(LOYALTY_PAGE_TOUR_EVENTS.goSettingsTab, onGoSettings);
      window.removeEventListener(LOYALTY_PAGE_TOUR_EVENTS.openNewReward, onOpenNewReward);
      window.removeEventListener(LOYALTY_PAGE_TOUR_EVENTS.fillReward, onFillReward);
      window.removeEventListener(LOYALTY_PAGE_TOUR_EVENTS.closeRewardForm, onCloseRewardForm);
      window.removeEventListener(LOYALTY_PAGE_TOUR_EVENTS.forceCloseAdjust, onForceCloseAdjust);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div role="status" className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
        <Loader2 size={18} className="animate-spin" />Carregando fidelidade…
      </div>
    );
  }

  const allRewards = program?.rewards ?? [];

  return (
    <div data-tour="loyalty-page" className="space-y-4">
      <SectionTitle
        title="Fidelidade"
        icon={Star}
        description="Programa de pontos e recompensas para seus clientes"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Badge dot pill size="md" color={program?.is_active ? "success" : "default"}>
              {program?.is_active ? "Ativo" : "Inativo"}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              iconLeft={<HelpCircle size={14} />}
              onClick={() => loyaltyPageTourRef.current?.start()}
              title="Tour guiado desta página"
            >
              <span className="sr-only sm:not-sr-only">Ajuda</span>
            </Button>
          </div>
        }
      />

      <LoyaltyPageTour ref={loyaltyPageTourRef} />

      <Tabs<Tab>
        items={LOYALTY_TABS}
        value={tab}
        onChange={(key) => { setTab(key); if (key === "points") fetchPointsTab(); }}
        label="Seções da fidelidade"
      >
      {/* ── OVERVIEW ───────────────────────────────────────────────────────── */}
      {tab === "overview" && (
        <div className="space-y-4">
          {/* Stats */}
          <StatGrid cols={4}>
            <StatCard title="Clientes com Pontos" value={stats.active_customers} icon={Users} color="info" />
            <StatCard title="Pontos Emitidos" value={stats.total_points_issued.toLocaleString("pt-BR")} icon={Star} color="warning" />
            <StatCard title="Resgates" value={stats.total_redemptions} icon={Gift} color="purple" />
            <StatCard title="Recompensas Ativas" value={allRewards.filter((r) => r.is_active).length} icon={TrendingUp} color="success" />
          </StatGrid>

          {/* Rule summary */}
          {program && (
            <PanelCard title="Regras do programa" icon={DollarSign}>
              <dl className="grid grid-cols-1 gap-x-6 sm:grid-cols-2 xl:grid-cols-3">
                <DetailField
                  label="Regra de pontuação"
                  value={`A cada ${fmt(Number(program.spend_per_point))} gastos → 1 ponto`}
                />
                {program.points_expiry_days > 0 && (
                  <DetailField label="Validade" value={`${program.points_expiry_days} dias`} />
                )}
                {(program.season_start || program.season_end) && (
                  <DetailField
                    label="Temporada"
                    value={`${program.season_start ? new Date(program.season_start).toLocaleDateString("pt-BR") : "–"} → ${program.season_end ? new Date(program.season_end).toLocaleDateString("pt-BR") : "∞"}`}
                  />
                )}
              </dl>
            </PanelCard>
          )}

          {/* Top customers */}
          <PanelCard title="Top Clientes por Pontos" icon={Award} contentClassName="p-0">
            {topCustomers.length === 0 ? (
              <EmptyState icon={Star} title="Nenhuma pontuação registrada ainda" className="m-3" />
            ) : (
              <div className="divide-y divide-slate-100">
                {topCustomers.map((c, i) => (
                  <div key={c.customer_id} className="flex items-center gap-3 px-3 py-2.5">
                    <span className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                      i === 0 ? "bg-amber-400 text-white" :
                      i === 1 ? "bg-slate-300 text-slate-700" :
                      i === 2 ? "bg-orange-300 text-white" :
                      "bg-slate-100 text-slate-500"
                    )}>
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-slate-900">{c.name}</p>
                      {c.phone && <p className="text-[11px] text-slate-500">{c.phone}</p>}
                    </div>
                    <Badge color="warning" pill size="md" icon={<Star size={11} fill="currentColor" />}>
                      {c.balance.toLocaleString("pt-BR")} pts
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </PanelCard>
        </div>
      )}

      {/* ── POINTS ─────────────────────────────────────────────────────────── */}
      {tab === "points" && (() => {
        const today = new Date();
        const currentMonth = today.getMonth();
        const currentDay   = today.getDate();

        const birthdayThisMonth = allCustomers.filter((c) => {
          if (!c.birth_date) return false;
          const d = new Date(c.birth_date);
          return d.getUTCMonth() === currentMonth;
        }).sort((a, b) => {
          const da = new Date(a.birth_date!).getUTCDate();
          const db = new Date(b.birth_date!).getUTCDate();
          return da - db;
        });

        const filtered = allCustomers.filter((c) =>
          !ptSearch ||
          c.name.toLowerCase().includes(ptSearch.toLowerCase()) ||
          (c.phone ?? "").includes(ptSearch) ||
          (c.document ?? "").replace(/\D/g, "").includes(ptSearch.replace(/\D/g, ""))
        );

        return (
          <div className="space-y-3">

            {/* Aniversariantes do mês */}
            {birthdayThisMonth.length > 0 && (
              <PanelCard
                title={`Aniversariantes de ${today.toLocaleString("pt-BR", { month: "long" })}`}
                icon={Cake}
                action={<Badge color="danger" pill>{birthdayThisMonth.length}</Badge>}
              >
                <div className="flex flex-wrap gap-2">
                  {birthdayThisMonth.map((c) => {
                    const day = new Date(c.birth_date!).getUTCDate();
                    const isToday = day === currentDay;
                    return (
                      <Badge
                        key={c.id}
                        size="md"
                        color={isToday ? "primary" : "default"}
                        icon={<Cake size={12} />}
                      >
                        {c.name} · dia {day}
                      </Badge>
                    );
                  })}
                </div>
              </PanelCard>
            )}

            {/* Como os pontos são gerados — explicação */}
            <Alert variant="warning" title="Como os pontos são gerados">
              {program?.is_active
                ? <>A cada <strong>R$ {Number(program.spend_per_point).toFixed(2).replace(".", ",")}</strong> gastos o cliente ganha <strong>1 ponto</strong> — automaticamente ao finalizar uma venda no PDV com o cliente identificado. Você também pode adicionar pontos manualmente abaixo.</>
                : "Programa inativo. Ative nas Configurações para começar a pontuar."}
            </Alert>

            {/* Search + counter */}
            <FilterLine>
              <FilterLineSection grow>
                <FilterLineSearch
                  aria-label="Buscar cliente"
                  value={ptSearch}
                  onChange={setPtSearch}
                  placeholder="Buscar cliente…"
                />
              </FilterLineSection>
              <FilterLineSection>
                <span className="text-xs text-slate-500">
                  {allCustomers.filter((c) => c.balance > 0).length} com pontos · {allCustomers.length} total
                </span>
              </FilterLineSection>
            </FilterLine>

            {/* Customer list */}
            {loadingPts ? (
              <div role="status" className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
                <Loader2 size={18} className="animate-spin" />Carregando clientes…
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map((c) => {
                  const isExpanded = expandedId === c.id;
                  const isAdjusting = adjId === c.id;
                  const bday = c.birth_date ? new Date(c.birth_date) : null;
                  const isBirthdayToday = bday && bday.getUTCDate() === currentDay && bday.getUTCMonth() === currentMonth;

                  return (
                    <ContentCard key={c.id} padding="none" className="overflow-hidden">
                      {/* Row */}
                      <div className="flex items-center gap-3 px-3 py-2.5">
                        {/* Avatar */}
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-[13px] font-semibold text-amber-600">
                          {c.name.charAt(0).toUpperCase()}
                        </div>
                        {/* Info */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <p className="truncate text-[13px] font-medium text-slate-900">{c.name}</p>
                            {isBirthdayToday && <span title="Aniversário hoje!"><Cake size={13} className="text-pink-500" /></span>}
                          </div>
                          {c.phone && <p className="text-[11px] text-slate-500">{c.phone}</p>}
                        </div>
                        {/* Balance */}
                        <Badge color={c.balance > 0 ? "warning" : "default"} pill size="md" icon={<Star size={10} fill="currentColor" />}>
                          {c.balance.toLocaleString("pt-BR")} pts
                        </Badge>
                        {/* Actions */}
                        <div className="flex shrink-0 items-center gap-1">
                          <IconButton
                            data-tour="loyalty-adjust-points-btn"
                            size="xs"
                            variant={isAdjusting ? "primary" : "ghost"}
                            onClick={() => { setAdjId(isAdjusting ? null : c.id); setAdjDelta(""); setAdjDesc(""); }}
                            title="Adicionar/remover pontos"
                            aria-label="Adicionar ou remover pontos"
                          >
                            <Plus size={13} />
                          </IconButton>
                          <IconButton
                            size="xs"
                            onClick={() => toggleExpand(c.id)}
                            title="Ver histórico"
                            aria-label="Ver histórico de pontos"
                          >
                            {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                          </IconButton>
                        </div>
                      </div>

                      {/* Adjust form */}
                      {isAdjusting && (
                        <div className="flex flex-wrap items-end gap-2 border-t border-slate-100 bg-slate-50/60 px-3 py-3">
                          <Input
                            size="sm"
                            label="Pontos (+ ou -)"
                            type="number"
                            wrapperClassName="w-32"
                            value={adjDelta}
                            onChange={(e) => setAdjDelta(e.target.value)}
                            placeholder="Ex: 50 ou -20"
                          />
                          <Input
                            size="sm"
                            label="Motivo"
                            wrapperClassName="min-w-[160px] flex-1"
                            value={adjDesc}
                            onChange={(e) => setAdjDesc(e.target.value)}
                            placeholder="Ex: Bônus aniversário"
                          />
                          <Button
                            size="sm"
                            disabled={savingAdj || !adjDelta}
                            onClick={() => handleAdjustPoints(c.id)}
                            iconLeft={<Check size={12} />}
                          >
                            {savingAdj ? "…" : "Aplicar"}
                          </Button>
                        </div>
                      )}

                      {/* Entries history */}
                      {isExpanded && (
                        <div className="border-t border-slate-100">
                          {loadingEntries ? (
                            <div role="status" className="flex items-center justify-center py-6 text-slate-500">
                              <Loader2 size={16} className="animate-spin" />
                            </div>
                          ) : expandedEntries.length === 0 ? (
                            <p className="py-5 text-center text-xs text-slate-500">Sem movimentações</p>
                          ) : (
                            <div className="max-h-48 divide-y divide-slate-100 overflow-y-auto">
                              {expandedEntries.map((e) => (
                                <div key={e.id} className="flex items-center gap-3 px-3 py-2">
                                  <Badge color={e.delta > 0 ? "success" : "danger"} pill>
                                    {e.delta > 0 ? "+" : ""}{e.delta}
                                  </Badge>
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-xs font-medium text-slate-700">{e.description ?? "—"}</p>
                                    <p className="text-[11px] text-slate-500">{new Date(e.created_at).toLocaleDateString("pt-BR")}</p>
                                  </div>
                                  <span className="shrink-0 text-[11px] font-medium text-slate-500">{e.balance_after} pts</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </ContentCard>
                  );
                })}

                {filtered.length === 0 && (
                  <EmptyState icon={Users} title="Nenhum cliente encontrado" description={ptSearch ? "Ajuste a busca para ver outros clientes." : undefined} />
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* ── REWARDS ────────────────────────────────────────────────────────── */}
      {tab === "rewards" && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-slate-500">Configure o que os clientes podem resgatar com os pontos.</p>
            <Button size="sm" iconLeft={<Plus size={14} />} onClick={openCreateReward}>
              Nova Recompensa
            </Button>
          </div>

          {allRewards.length === 0 ? (
            <EmptyState
              icon={Gift}
              title="Nenhuma recompensa cadastrada"
              action={<Button size="sm" onClick={openCreateReward}>Criar primeira recompensa</Button>}
            />
          ) : (
            <div className="grid gap-3">
              {allRewards.map((r) => {
                const product = products.find((p) => p.id === r.product_id);
                return (
                  <ContentCard key={r.id} className={cn(
                    "flex flex-wrap items-center gap-3 transition-opacity",
                    !r.is_active && "opacity-60"
                  )}>
                    <div className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                      r.type === "discount" ? "bg-blue-50 text-blue-600" : "bg-purple-50 text-purple-600"
                    )}>
                      {r.type === "discount" ? <Percent size={18} /> : <Package size={18} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-[13px] font-medium text-slate-900">{r.name}</p>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        {r.type === "discount"
                          ? r.discount_type === "percent"
                            ? `${r.discount_value}% de desconto`
                            : `Desconto de ${fmt(Number(r.discount_value ?? 0))}`
                          : `${r.product_qty ?? 1}x ${product?.name ?? "Produto"} do estoque`}
                      </p>
                    </div>
                    <Badge color="warning" pill size="md" icon={<Star size={11} fill="currentColor" />}>
                      {r.points_cost} pts
                    </Badge>
                    <div className="flex items-center gap-1">
                      <IconButton onClick={() => toggleReward(r)} title={r.is_active ? "Desativar" : "Ativar"} aria-label={r.is_active ? "Desativar recompensa" : "Ativar recompensa"}>
                        {r.is_active ? <ToggleRight size={16} className="text-emerald-500" /> : <ToggleLeft size={16} />}
                      </IconButton>
                      <IconButton onClick={() => openEditReward(r)} aria-label="Editar recompensa">
                        <Edit2 size={14} />
                      </IconButton>
                      <IconButton variant="danger" onClick={() => deleteReward(r.id)} aria-label="Excluir recompensa">
                        <Trash2 size={14} />
                      </IconButton>
                    </div>
                  </ContentCard>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── SETTINGS ───────────────────────────────────────────────────────── */}
      {tab === "settings" && (
        <div className="max-w-lg space-y-3">
          <div data-tour="loyalty-settings-card">
            <PanelCard title="Configurações do Programa" icon={Settings}>
              <div className="space-y-4">
                {/* Active toggle */}
                <div className={cn(
                  "flex items-center justify-between rounded-lg border p-3",
                  sActive ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-50"
                )}>
                  <span className={cn("text-[13px] font-medium", sActive ? "text-emerald-700" : "text-slate-600")}>
                    {sActive ? "Programa ativo" : "Programa inativo"}
                  </span>
                  <Switch checked={sActive} onCheckedChange={setSActive} aria-label="Programa ativo" />
                </div>

                {/* Name */}
                <Input label="Nome do Programa" value={sName} onChange={(e) => setSName(e.target.value)} placeholder="Ex: Clube de Vantagens" />

                {/* Spend per point */}
                <Input
                  label="A cada quantos R$ o cliente ganha 1 ponto"
                  type="number" min={1} value={sSpend}
                  onChange={(e) => setSSpend(e.target.value)}
                  addonLeft="R$"
                  hint="Ex: 10 = a cada R$ 10,00 gastos, 1 ponto"
                />

                {/* Expiry */}
                <Input
                  label="Validade dos pontos (dias — 0 = sem validade)"
                  type="number" min={0} value={sExpiry}
                  onChange={(e) => setSExpiry(e.target.value)}
                />

                {/* Season */}
                <div>
                  <span className="ds-label mb-1.5 block">Temporada (período em que os pontos valem)</span>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <Input label="Início" type="date" value={sSeasonStart} onChange={(e) => setSSeasonStart(e.target.value)} />
                    <Input label="Fim" type="date" value={sSeasonEnd} onChange={(e) => setSSeasonEnd(e.target.value)} />
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">Deixe em branco para programa sem data de fim.</p>
                </div>

                <Button fullWidth onClick={handleSaveSettings} disabled={savingS}>
                  {savingS ? "Salvando…" : "Salvar Configurações"}
                </Button>
              </div>
            </PanelCard>
          </div>

          {/* Season reset info */}
          <Alert variant="info" title="Como funciona a temporada">
            Ao definir uma nova data de início, os pontos ganhos antes dessa data continuam no saldo do cliente.
            Use o ajuste manual de pontos no perfil do cliente para zerar saldos ao virar uma temporada.
          </Alert>
        </div>
      )}
      </Tabs>

      {/* ── REWARD FORM ────────────────────────────────────────────────────── */}
      <Modal
        open={showRewardForm}
        onClose={() => setShowRewardForm(false)}
        position="right"
        size="sm"
        title={editReward ? "Editar Recompensa" : "Nova Recompensa"}
        subtitle="Defina o que o cliente ganha ao resgatar pontos"
        footer={
          <ModalFooter>
            <Button variant="outline" onClick={() => setShowRewardForm(false)}>Cancelar</Button>
            <Button onClick={handleSaveReward} disabled={savingR || !rName.trim() || !rPoints}>
              {savingR ? "Salvando…" : editReward ? "Salvar" : "Criar Recompensa"}
            </Button>
          </ModalFooter>
        }
      >
        <div className="space-y-4">
          {/* Name */}
          <div data-tour="loyalty-reward-form-name">
            <Input label="Nome *" value={rName} onChange={(e) => setRName(e.target.value)} placeholder="Ex: 10% de desconto" />
          </div>

          {/* Type */}
          <div>
            <span className="ds-label mb-1.5 block">Tipo de Recompensa</span>
            <div className="grid grid-cols-2 gap-2">
              {([
                { v: "discount", label: "Desconto", icon: Percent },
                { v: "product",  label: "Brinde",   icon: Package },
              ] as { v: "discount" | "product"; label: string; icon: React.ElementType }[]).map(({ v, label, icon: Icon }) => (
                <button
                  type="button"
                  key={v}
                  onClick={() => setRType(v)}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border p-2.5 text-xs font-medium transition-all",
                    rType === v ? "border-blue-400 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-500 hover:border-slate-300"
                  )}
                >
                  <Icon size={14} /> {label}
                </button>
              ))}
            </div>
          </div>

          {/* Discount fields */}
          {rType === "discount" && (
            <>
              <div>
                <span className="ds-label mb-1.5 block">Tipo do Desconto</span>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { v: "fixed",   label: "Valor Fixo (R$)" },
                    { v: "percent", label: "Percentual (%)" },
                  ] as { v: "fixed" | "percent"; label: string }[]).map(({ v, label }) => (
                    <button type="button" key={v} onClick={() => setRDiscType(v)}
                      className={cn(
                        "rounded-lg border p-2 text-[11px] font-medium transition-all",
                        rDiscType === v ? "border-blue-400 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-500"
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <Input
                label={`Valor ${rDiscType === "percent" ? "(%)" : "(R$)"}`}
                type="number" min={0} value={rDiscVal} onChange={(e) => setRDiscVal(e.target.value)}
                placeholder={rDiscType === "percent" ? "10" : "5,00"}
              />
            </>
          )}

          {/* Product fields */}
          {rType === "product" && (
            <>
              <Select label="Produto do Estoque" value={rProductId} onChange={(e) => setRProductId(e.target.value)}>
                <option value="">Selecione…</option>
                {products.filter((p) => (!p.sale_unit || p.sale_unit === "unidade") && productHasStock(p)).map((p) => (
                  <option key={p.id} value={p.id}>{p.name} (estoque: {p.stock_quantity})</option>
                ))}
              </Select>
              <Input label="Quantidade" type="number" min={1} value={rProductQty} onChange={(e) => setRProductQty(e.target.value)} />
            </>
          )}

          {/* Points cost */}
          <Input
            label="Custo em Pontos *"
            type="number" min={1} value={rPoints} onChange={(e) => setRPoints(e.target.value)}
            placeholder="Ex: 100"
            iconLeft={<Star size={13} className="text-amber-400" fill="currentColor" />}
            hint="Quantos pontos o cliente precisa para resgatar esta recompensa."
          />
        </div>
      </Modal>
    </div>
  );
}
