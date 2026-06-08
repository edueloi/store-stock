import { useState, useEffect, useCallback } from "react";
import {
  Star, Gift, Users, TrendingUp, Award, Settings, Plus, Trash2,
  Edit2, X, Package, Percent, DollarSign, Calendar,
  AlertTriangle, ToggleLeft, ToggleRight, Clock, Search,
  Cake, ChevronDown, ChevronUp, Check,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../../lib/utils";
import PageHeader from "../../components/layout/PageHeader";

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const allRewards = program?.rewards ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fidelidade"
        subtitle="Programa de pontos e recompensas para seus clientes"
        action={
          <span className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold",
            program?.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
          )}>
            <span className={cn("w-1.5 h-1.5 rounded-full", program?.is_active ? "bg-emerald-500" : "bg-slate-400")} />
            {program?.is_active ? "Ativo" : "Inativo"}
          </span>
        }
      />

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit flex-wrap">
        {([
          { key: "overview", label: "Visão Geral",    icon: TrendingUp },
          { key: "points",   label: "Pontos",          icon: Star },
          { key: "rewards",  label: "Recompensas",     icon: Gift },
          { key: "settings", label: "Configurações",   icon: Settings },
        ] as { key: Tab; label: string; icon: React.ElementType }[]).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => { setTab(key); if (key === "points") fetchPointsTab(); }}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-bold transition-all",
              tab === key ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ───────────────────────────────────────────────────────── */}
      {tab === "overview" && (
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              { icon: Users,      label: "Clientes com Pontos", value: stats.active_customers, color: "bg-blue-50 text-blue-600" },
              { icon: Star,       label: "Pontos Emitidos",     value: stats.total_points_issued.toLocaleString("pt-BR"), color: "bg-amber-50 text-amber-600" },
              { icon: Gift,       label: "Resgates",            value: stats.total_redemptions,  color: "bg-purple-50 text-purple-600" },
              { icon: TrendingUp, label: "Recompensas Ativas",  value: allRewards.filter((r) => r.is_active).length, color: "bg-emerald-50 text-emerald-600" },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl ${s.color}`}>
                  <s.icon size={18} />
                </div>
                <p className="text-2xl font-black text-slate-900">{s.value}</p>
                <p className="mt-0.5 text-xs font-medium text-slate-500">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Rule summary */}
          {program && (
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-5 flex flex-wrap gap-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                  <DollarSign size={18} className="text-amber-600" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Regra de Pontuação</p>
                  <p className="text-[14px] font-black text-slate-900">
                    A cada {fmt(Number(program.spend_per_point))} gastos → <span className="text-amber-600">1 ponto</span>
                  </p>
                </div>
              </div>
              {program.points_expiry_days > 0 && (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                    <Clock size={18} className="text-amber-600" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Validade</p>
                    <p className="text-[14px] font-black text-slate-900">{program.points_expiry_days} dias</p>
                  </div>
                </div>
              )}
              {(program.season_start || program.season_end) && (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                    <Calendar size={18} className="text-amber-600" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Temporada</p>
                    <p className="text-[14px] font-black text-slate-900">
                      {program.season_start ? new Date(program.season_start).toLocaleDateString("pt-BR") : "–"}
                      {" → "}
                      {program.season_end ? new Date(program.season_end).toLocaleDateString("pt-BR") : "∞"}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Top customers */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="font-black text-slate-900 text-[14px]">Top Clientes por Pontos</h3>
            </div>
            {topCustomers.length === 0 ? (
              <div className="py-16 text-center">
                <Star size={32} className="mx-auto text-slate-200 mb-3" />
                <p className="text-sm text-slate-400">Nenhuma pontuação registrada ainda</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {topCustomers.map((c, i) => (
                  <div key={c.customer_id} className="flex items-center gap-4 px-5 py-3">
                    <span className={cn(
                      "w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black",
                      i === 0 ? "bg-amber-400 text-white" :
                      i === 1 ? "bg-slate-300 text-slate-700" :
                      i === 2 ? "bg-orange-300 text-white" :
                      "bg-slate-100 text-slate-500"
                    )}>
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold text-slate-900 truncate">{c.name}</p>
                      {c.phone && <p className="text-[11px] text-slate-400">{c.phone}</p>}
                    </div>
                    <div className="flex items-center gap-1.5 bg-amber-50 px-3 py-1.5 rounded-full">
                      <Star size={11} className="text-amber-500" fill="currentColor" />
                      <span className="text-[12px] font-black text-amber-700">{c.balance.toLocaleString("pt-BR")} pts</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
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
          <div className="space-y-5">

            {/* Aniversariantes do mês */}
            {birthdayThisMonth.length > 0 && (
              <div className="bg-gradient-to-r from-pink-50 to-rose-50 border border-pink-200 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Cake size={16} className="text-pink-500" />
                  <span className="text-[12px] font-black text-pink-700 uppercase tracking-wider">
                    Aniversariantes de {today.toLocaleString("pt-BR", { month: "long" })}
                  </span>
                  <span className="ml-auto bg-pink-200 text-pink-700 text-[10px] font-black px-2 py-0.5 rounded-full">
                    {birthdayThisMonth.length}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {birthdayThisMonth.map((c) => {
                    const day = new Date(c.birth_date!).getUTCDate();
                    const isToday = day === currentDay;
                    return (
                      <div key={c.id} className={cn(
                        "flex items-center gap-2 px-3 py-1.5 rounded-xl text-[11px] font-bold border",
                        isToday
                          ? "bg-pink-500 text-white border-pink-500"
                          : "bg-white text-pink-700 border-pink-200"
                      )}>
                        <span>{isToday ? "🎂" : "🎁"}</span>
                        <span>{c.name}</span>
                        <span className={cn("font-black", isToday ? "text-pink-100" : "text-pink-400")}>
                          dia {day}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Como os pontos são gerados — explicação */}
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3">
              <Star size={16} className="text-amber-500 mt-0.5 shrink-0" fill="currentColor" />
              <div>
                <p className="text-[12px] font-black text-amber-800">Como os pontos são gerados</p>
                <p className="text-[11px] text-amber-700 mt-1 leading-relaxed">
                  {program?.is_active
                    ? <>A cada <strong>R$ {Number(program.spend_per_point).toFixed(2).replace(".", ",")}</strong> gastos o cliente ganha <strong>1 ponto</strong> — automaticamente ao finalizar uma venda no PDV com o cliente identificado. Você também pode adicionar pontos manualmente abaixo.</>
                    : "Programa inativo. Ative nas Configurações para começar a pontuar."}
                </p>
              </div>
            </div>

            {/* Search + counter */}
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={ptSearch}
                  onChange={(e) => setPtSearch(e.target.value)}
                  placeholder="Buscar cliente…"
                  className="w-full h-9 pl-9 pr-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
              <span className="text-[11px] text-slate-400 font-medium shrink-0">
                {allCustomers.filter((c) => c.balance > 0).length} com pontos · {allCustomers.length} total
              </span>
            </div>

            {/* Customer list */}
            {loadingPts ? (
              <div className="flex items-center justify-center h-32">
                <div className="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map((c) => {
                  const isExpanded = expandedId === c.id;
                  const isAdjusting = adjId === c.id;
                  const bday = c.birth_date ? new Date(c.birth_date) : null;
                  const isBirthdayToday = bday && bday.getUTCDate() === currentDay && bday.getUTCMonth() === currentMonth;

                  return (
                    <div key={c.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                      {/* Row */}
                      <div className="flex items-center gap-3 px-4 py-3">
                        {/* Avatar */}
                        <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0 text-[13px] font-black text-amber-600">
                          {c.name.charAt(0).toUpperCase()}
                        </div>
                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-[13px] font-bold text-slate-900 truncate">{c.name}</p>
                            {isBirthdayToday && <span title="Aniversário hoje!">🎂</span>}
                          </div>
                          {c.phone && <p className="text-[10px] text-slate-400">{c.phone}</p>}
                        </div>
                        {/* Balance */}
                        <div className={cn(
                          "flex items-center gap-1 px-3 py-1.5 rounded-full shrink-0",
                          c.balance > 0 ? "bg-amber-50" : "bg-slate-50"
                        )}>
                          <Star size={10} className={c.balance > 0 ? "text-amber-500" : "text-slate-300"} fill="currentColor" />
                          <span className={cn("text-[11px] font-black", c.balance > 0 ? "text-amber-700" : "text-slate-400")}>
                            {c.balance.toLocaleString("pt-BR")} pts
                          </span>
                        </div>
                        {/* Actions */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => { setAdjId(isAdjusting ? null : c.id); setAdjDelta(""); setAdjDesc(""); }}
                            title="Adicionar/remover pontos"
                            className={cn(
                              "p-1.5 rounded-lg text-[11px] font-bold transition-colors",
                              isAdjusting ? "bg-amber-500 text-white" : "hover:bg-amber-50 text-amber-500"
                            )}
                          >
                            <Plus size={13} />
                          </button>
                          <button
                            onClick={() => toggleExpand(c.id)}
                            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors"
                            title="Ver histórico"
                          >
                            {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                          </button>
                        </div>
                      </div>

                      {/* Adjust form */}
                      {isAdjusting && (
                        <div className="border-t border-slate-100 px-4 py-3 bg-amber-50 flex items-end gap-2">
                          <div>
                            <label className="text-[9px] font-bold text-amber-700 uppercase tracking-wider block mb-1">
                              Pontos (+ ou -)
                            </label>
                            <input
                              type="number"
                              value={adjDelta}
                              onChange={(e) => setAdjDelta(e.target.value)}
                              placeholder="Ex: 50 ou -20"
                              className="h-8 w-28 px-2 rounded-lg border border-amber-200 text-[12px] focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                            />
                          </div>
                          <div className="flex-1">
                            <label className="text-[9px] font-bold text-amber-700 uppercase tracking-wider block mb-1">
                              Motivo
                            </label>
                            <input
                              value={adjDesc}
                              onChange={(e) => setAdjDesc(e.target.value)}
                              placeholder="Ex: Bônus aniversário"
                              className="h-8 w-full px-2 rounded-lg border border-amber-200 text-[12px] focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                            />
                          </div>
                          <button
                            disabled={savingAdj || !adjDelta}
                            onClick={() => handleAdjustPoints(c.id)}
                            className="h-8 px-3 bg-amber-500 text-white rounded-lg text-[11px] font-bold hover:bg-amber-600 disabled:opacity-50 flex items-center gap-1 shrink-0"
                          >
                            <Check size={11} /> {savingAdj ? "…" : "Aplicar"}
                          </button>
                        </div>
                      )}

                      {/* Entries history */}
                      {isExpanded && (
                        <div className="border-t border-slate-100">
                          {loadingEntries ? (
                            <div className="flex items-center justify-center py-6">
                              <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                            </div>
                          ) : expandedEntries.length === 0 ? (
                            <p className="text-center text-[11px] text-slate-400 py-5">Sem movimentações</p>
                          ) : (
                            <div className="divide-y divide-slate-50 max-h-48 overflow-y-auto">
                              {expandedEntries.map((e) => (
                                <div key={e.id} className="flex items-center gap-3 px-4 py-2.5">
                                  <span className={cn(
                                    "w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-black shrink-0",
                                    e.delta > 0 ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600"
                                  )}>
                                    {e.delta > 0 ? "+" : ""}{e.delta}
                                  </span>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[11px] font-medium text-slate-700 truncate">{e.description ?? "—"}</p>
                                    <p className="text-[9px] text-slate-400">{new Date(e.created_at).toLocaleDateString("pt-BR")}</p>
                                  </div>
                                  <span className="text-[10px] font-bold text-slate-500 shrink-0">{e.balance_after} pts</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {filtered.length === 0 && (
                  <div className="text-center py-16">
                    <Users size={32} className="mx-auto text-slate-200 mb-3" />
                    <p className="text-sm text-slate-400">Nenhum cliente encontrado</p>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* ── REWARDS ────────────────────────────────────────────────────────── */}
      {tab === "rewards" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-[13px] text-slate-500">Configure o que os clientes podem resgatar com os pontos.</p>
            <button
              onClick={openCreateReward}
              className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl text-[12px] font-bold transition-colors"
            >
              <Plus size={13} /> Nova Recompensa
            </button>
          </div>

          {allRewards.length === 0 ? (
            <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 py-16 text-center">
              <Gift size={32} className="mx-auto text-slate-200 mb-3" />
              <p className="text-sm text-slate-400 mb-4">Nenhuma recompensa cadastrada</p>
              <button onClick={openCreateReward} className="text-amber-600 text-[12px] font-bold hover:underline">
                + Criar primeira recompensa
              </button>
            </div>
          ) : (
            <div className="grid gap-3">
              {allRewards.map((r) => {
                const product = products.find((p) => p.id === r.product_id);
                return (
                  <div key={r.id} className={cn(
                    "bg-white rounded-2xl border shadow-sm p-4 flex items-center gap-4 transition-opacity",
                    !r.is_active && "opacity-60"
                  )}>
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                      r.type === "discount" ? "bg-blue-50 text-blue-600" : "bg-purple-50 text-purple-600"
                    )}>
                      {r.type === "discount" ? <Percent size={18} /> : <Package size={18} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold text-slate-900">{r.name}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {r.type === "discount"
                          ? r.discount_type === "percent"
                            ? `${r.discount_value}% de desconto`
                            : `Desconto de ${fmt(Number(r.discount_value ?? 0))}`
                          : `${r.product_qty ?? 1}x ${product?.name ?? "Produto"} do estoque`}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 bg-amber-50 px-3 py-1.5 rounded-full shrink-0">
                      <Star size={11} className="text-amber-500" fill="currentColor" />
                      <span className="text-[12px] font-black text-amber-700">{r.points_cost} pts</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => toggleReward(r)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors" title={r.is_active ? "Desativar" : "Ativar"}>
                        {r.is_active ? <ToggleRight size={16} className="text-emerald-500" /> : <ToggleLeft size={16} />}
                      </button>
                      <button onClick={() => openEditReward(r)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors">
                        <Edit2 size={14} />
                      </button>
                      <button onClick={() => deleteReward(r.id)} className="p-2 hover:bg-red-50 rounded-lg text-slate-300 hover:text-red-400 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── SETTINGS ───────────────────────────────────────────────────────── */}
      {tab === "settings" && (
        <div className="max-w-lg space-y-5">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <h3 className="font-black text-slate-900 text-[14px] flex items-center gap-2">
              <Settings size={15} /> Configurações do Programa
            </h3>

            {/* Active toggle */}
            <label className={cn(
              "flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-colors",
              sActive ? "bg-emerald-50 border-emerald-200" : "bg-slate-50 border-slate-200"
            )}>
              <span className={cn("text-[13px] font-bold", sActive ? "text-emerald-700" : "text-slate-600")}>
                {sActive ? "Programa ativo" : "Programa inativo"}
              </span>
              <input type="checkbox" checked={sActive} onChange={(e) => setSActive(e.target.checked)} className="accent-emerald-500 w-4 h-4" />
            </label>

            {/* Name */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Nome do Programa</label>
              <input value={sName} onChange={(e) => setSName(e.target.value)} placeholder="Ex: Clube de Vantagens" className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>

            {/* Spend per point */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                A cada quantos R$ o cliente ganha 1 ponto
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">R$</span>
                <input
                  type="number" min={1} value={sSpend}
                  onChange={(e) => setSSpend(e.target.value)}
                  className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Ex: 10 = a cada R$ 10,00 gastos, 1 ponto</p>
            </div>

            {/* Expiry */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                Validade dos pontos (dias — 0 = sem validade)
              </label>
              <input
                type="number" min={0} value={sExpiry}
                onChange={(e) => setSExpiry(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>

            {/* Season */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                Temporada (período em que os pontos valem)
              </label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] text-slate-400 block mb-0.5">Início</label>
                  <input type="date" value={sSeasonStart} onChange={(e) => setSSeasonStart(e.target.value)} className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                </div>
                <div>
                  <label className="text-[9px] text-slate-400 block mb-0.5">Fim</label>
                  <input type="date" value={sSeasonEnd} onChange={(e) => setSSeasonEnd(e.target.value)} className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                </div>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Deixe em branco para programa sem data de fim.</p>
            </div>

            <button
              onClick={handleSaveSettings}
              disabled={savingS}
              className="w-full h-10 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-[13px] font-bold transition-colors disabled:opacity-50"
            >
              {savingS ? "Salvando…" : "Salvar Configurações"}
            </button>
          </div>

          {/* Season reset info */}
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex gap-3">
            <AlertTriangle size={16} className="text-blue-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-[12px] font-bold text-blue-700">Como funciona a temporada</p>
              <p className="text-[11px] text-blue-600 mt-1 leading-relaxed">
                Ao definir uma nova data de início, os pontos ganhos antes dessa data continuam no saldo do cliente.
                Use o ajuste manual de pontos no perfil do cliente para zerar saldos ao virar uma temporada.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── REWARD FORM DRAWER ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {showRewardForm && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowRewardForm(false)}
              className="fixed inset-0 bg-slate-900/50 z-[60] backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 26, stiffness: 200 }}
              className="fixed inset-y-0 right-0 w-full max-w-sm bg-white z-[70] shadow-2xl flex flex-col"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 shrink-0">
                <div>
                  <h2 className="font-black text-slate-900 text-[15px]">
                    {editReward ? "Editar Recompensa" : "Nova Recompensa"}
                  </h2>
                  <p className="text-[11px] text-slate-500">Defina o que o cliente ganha ao resgatar pontos</p>
                </div>
                <button onClick={() => setShowRewardForm(false)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500">
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {/* Name */}
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Nome *</label>
                  <input value={rName} onChange={(e) => setRName(e.target.value)} placeholder="Ex: 10% de desconto" className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                </div>

                {/* Type */}
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-2">Tipo de Recompensa</label>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      { v: "discount", label: "Desconto", icon: Percent },
                      { v: "product",  label: "Brinde",   icon: Package },
                    ] as { v: "discount" | "product"; label: string; icon: React.ElementType }[]).map(({ v, label, icon: Icon }) => (
                      <button
                        key={v}
                        onClick={() => setRType(v)}
                        className={cn(
                          "flex items-center gap-2 p-3 rounded-xl border-2 text-[12px] font-bold transition-all",
                          rType === v ? "border-amber-400 bg-amber-50 text-amber-700" : "border-slate-200 text-slate-500 hover:border-slate-300"
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
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-2">Tipo do Desconto</label>
                      <div className="grid grid-cols-2 gap-2">
                        {([
                          { v: "fixed",   label: "Valor Fixo (R$)" },
                          { v: "percent", label: "Percentual (%)" },
                        ] as { v: "fixed" | "percent"; label: string }[]).map(({ v, label }) => (
                          <button key={v} onClick={() => setRDiscType(v)}
                            className={cn(
                              "p-2 rounded-xl border-2 text-[11px] font-bold transition-all",
                              rDiscType === v ? "border-blue-400 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-500"
                            )}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                        Valor {rDiscType === "percent" ? "(%)" : "(R$)"}
                      </label>
                      <input type="number" min={0} value={rDiscVal} onChange={(e) => setRDiscVal(e.target.value)}
                        placeholder={rDiscType === "percent" ? "10" : "5,00"}
                        className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                    </div>
                  </>
                )}

                {/* Product fields */}
                {rType === "product" && (
                  <>
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Produto do Estoque</label>
                      <select value={rProductId} onChange={(e) => setRProductId(e.target.value)}
                        className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white">
                        <option value="">Selecione…</option>
                        {products.filter((p) => p.stock_quantity > 0).map((p) => (
                          <option key={p.id} value={p.id}>{p.name} (estoque: {p.stock_quantity})</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Quantidade</label>
                      <input type="number" min={1} value={rProductQty} onChange={(e) => setRProductQty(e.target.value)}
                        className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                    </div>
                  </>
                )}

                {/* Points cost */}
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Custo em Pontos *</label>
                  <div className="relative">
                    <Star size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-400" fill="currentColor" />
                    <input type="number" min={1} value={rPoints} onChange={(e) => setRPoints(e.target.value)}
                      placeholder="Ex: 100"
                      className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">Quantos pontos o cliente precisa para resgatar esta recompensa.</p>
                </div>
              </div>

              <div className="border-t border-slate-200 px-5 py-4 shrink-0 bg-slate-50 flex gap-2">
                <button onClick={() => setShowRewardForm(false)} className="flex-1 h-9 rounded-lg border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-100">Cancelar</button>
                <button
                  onClick={handleSaveReward}
                  disabled={savingR || !rName.trim() || !rPoints}
                  className="flex-1 h-9 bg-amber-500 text-white rounded-lg text-sm font-bold hover:bg-amber-600 disabled:opacity-50 transition-all"
                >
                  {savingR ? "Salvando…" : editReward ? "Salvar" : "Criar Recompensa"}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
