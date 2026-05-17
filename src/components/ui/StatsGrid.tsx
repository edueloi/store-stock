import React, { ReactNode, Key } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "../../lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────

type Accent = "blue" | "emerald" | "amber" | "red" | "purple" | "slate";

interface StatItem {
  key?: React.Key;
  label: string;
  value: string | number;
  icon?: ReactNode;
  accent?: Accent;
  trend?: number;
  trendLabel?: string;
  prefix?: string;
  suffix?: string;
  loading?: boolean;
}

interface StatsGridProps {
  stats: StatItem[];
  columns?: 2 | 3 | 4;
  className?: string;
}

// ── Config ─────────────────────────────────────────────────────────────────

const accentConfig: Record<Accent, { icon: string; value: string; badge: string }> = {
  blue:    { icon: "bg-blue-50 text-blue-600",    value: "text-blue-700",    badge: "bg-blue-50 text-blue-600 border-blue-200" },
  emerald: { icon: "bg-emerald-50 text-emerald-600", value: "text-emerald-700", badge: "bg-emerald-50 text-emerald-600 border-emerald-200" },
  amber:   { icon: "bg-amber-50 text-amber-600",  value: "text-amber-700",   badge: "bg-amber-50 text-amber-600 border-amber-200" },
  red:     { icon: "bg-red-50 text-red-600",      value: "text-red-700",     badge: "bg-red-50 text-red-600 border-red-200" },
  purple:  { icon: "bg-purple-50 text-purple-600", value: "text-purple-700", badge: "bg-purple-50 text-purple-600 border-purple-200" },
  slate:   { icon: "bg-slate-100 text-slate-500",  value: "text-slate-700",  badge: "bg-slate-50 text-slate-500 border-slate-200" },
};

const colClasses: Record<2 | 3 | 4, string> = {
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-2 lg:grid-cols-4",
};

// ── StatCard ───────────────────────────────────────────────────────────────

function StatCard({ label, value, icon, accent = "slate", trend, trendLabel, prefix, suffix, loading }: StatItem) {
  const cfg = accentConfig[accent];

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
          {label}
        </p>
        {icon && (
          <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center [&>svg]:w-4 [&>svg]:h-4", cfg.icon)}>
            {icon}
          </div>
        )}
      </div>

      {loading ? (
        <div className="h-7 w-24 bg-slate-100 animate-pulse rounded-lg" />
      ) : (
        <p className={cn("text-2xl font-black tracking-tight leading-none", cfg.value)}>
          {prefix && <span className="text-base font-bold opacity-70 mr-0.5">{prefix}</span>}
          {value}
          {suffix && <span className="text-base font-bold opacity-70 ml-0.5">{suffix}</span>}
        </p>
      )}

      {trend !== undefined && !loading && (
        <div className={cn(
          "inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold",
          trend > 0 ? "bg-emerald-50 text-emerald-600 border-emerald-200" :
          trend < 0 ? "bg-red-50 text-red-500 border-red-200" :
          "bg-slate-50 text-slate-500 border-slate-200"
        )}>
          {trend > 0 ? <TrendingUp size={10} /> : trend < 0 ? <TrendingDown size={10} /> : <Minus size={10} />}
          <span>{trend > 0 ? "+" : ""}{trend}%</span>
          {trendLabel && <span className="opacity-70">{trendLabel}</span>}
        </div>
      )}
    </div>
  );
}

// ── StatsGrid ──────────────────────────────────────────────────────────────

export default function StatsGrid({ stats, columns = 4, className }: StatsGridProps) {
  return (
    <div className={cn("grid gap-4", colClasses[columns], className)}>
      {stats.map((s, i) => (
        <StatCard
          key={i}
          label={s.label}
          value={s.value}
          icon={s.icon}
          accent={s.accent}
          trend={s.trend}
          trendLabel={s.trendLabel}
          prefix={s.prefix}
          suffix={s.suffix}
          loading={s.loading}
        />
      ))}
    </div>
  );
}

export { StatCard as StatsCard };
