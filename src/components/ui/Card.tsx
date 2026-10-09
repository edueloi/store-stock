import { ReactNode } from "react";
import { cn } from "../../lib/utils";
import { TrendingUp, TrendingDown } from "lucide-react";

// ── Card Base ──────────────────────────────────────────────────────────────

interface CardProps {
  children: ReactNode;
  className?: string;
  /** Borda colorida na esquerda */
  accent?: "blue" | "emerald" | "amber" | "red" | "purple" | "slate";
  hover?: boolean;
  padding?: "none" | "sm" | "md" | "lg";
}

const accentBorder: Record<NonNullable<CardProps["accent"]>, string> = {
  blue:    "border-l-4 border-l-blue-500",
  emerald: "border-l-4 border-l-emerald-500",
  amber:   "border-l-4 border-l-amber-500",
  red:     "border-l-4 border-l-red-500",
  purple:  "border-l-4 border-l-purple-500",
  slate:   "border-l-4 border-l-slate-400",
};

const paddingClasses: Record<NonNullable<CardProps["padding"]>, string> = {
  none: "",
  sm:   "p-3",
  md:   "p-3",
  lg:   "p-4",
};

export function Card({ children, className, accent, hover = false, padding = "md" }: CardProps) {
  return (
    <div
      className={cn(
        "bg-white rounded-lg border border-slate-200 transition-all duration-200",
        hover && "hover:border-slate-300 cursor-pointer",
        accent && accentBorder[accent],
        paddingClasses[padding],
        className
      )}
    >
      {children}
    </div>
  );
}

// ── StatCard ──────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  trend?: number;        // positivo = alta, negativo = queda
  trendLabel?: string;
  accent?: CardProps["accent"];
  mono?: boolean;
  className?: string;
}

export function StatCard({
  label,
  value,
  icon,
  trend,
  trendLabel,
  accent,
  mono = true,
  className,
}: StatCardProps) {
  const isPositive = trend !== undefined && trend >= 0;

  return (
    <Card accent={accent} className={cn("relative group overflow-hidden", className)}>
      {/* Ícone de fundo decorativo */}
      {icon && (
        <div className="absolute right-4 top-4 text-slate-100 group-hover:text-slate-200 transition-colors">
          <span className="[&>*]:w-12 [&>*]:h-12">{icon}</span>
        </div>
      )}

      <div className="relative z-10">
        <p className="text-[11px] font-semibold text-slate-400 mb-2">
          {label}
        </p>
        <p
          className={cn(
            "text-base font-medium leading-none",
            mono && "font-mono",
            accent === "emerald" ? "text-emerald-600"
              : accent === "red" ? "text-red-600"
              : accent === "amber" ? "text-amber-600"
              : "text-slate-900"
          )}
        >
          {value}
        </p>

        {trend !== undefined && (
          <div
            className={cn(
              "flex items-center gap-1 mt-3 text-[11px] font-semibold",
              isPositive ? "text-emerald-600" : "text-red-500"
            )}
          >
            {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            <span>
              {isPositive ? "+" : ""}{trend}% {trendLabel}
            </span>
          </div>
        )}
      </div>
    </Card>
  );
}
