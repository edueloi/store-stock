import { cn } from "../../lib/utils";
import { ReactNode } from "react";

type BadgeVariant =
  | "default"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral"
  | "purple";

interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
  icon?: ReactNode;
  dot?: boolean;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  default:  "bg-slate-100 text-slate-600 border-slate-200",
  success:  "bg-emerald-50 text-emerald-700 border-emerald-200",
  warning:  "bg-amber-50 text-amber-700 border-amber-200",
  danger:   "bg-red-50 text-red-700 border-red-200",
  info:     "bg-blue-50 text-blue-700 border-blue-200",
  neutral:  "bg-slate-50 text-slate-500 border-slate-100",
  purple:   "bg-purple-50 text-purple-700 border-purple-200",
};

const dotClasses: Record<BadgeVariant, string> = {
  default:  "bg-slate-400",
  success:  "bg-emerald-500",
  warning:  "bg-amber-500",
  danger:   "bg-red-500",
  info:     "bg-blue-500",
  neutral:  "bg-slate-300",
  purple:   "bg-purple-500",
};

export default function Badge({ variant = "default", children, icon, dot, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest w-fit",
        variantClasses[variant],
        className
      )}
    >
      {dot && <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", dotClasses[variant])} />}
      {!dot && icon && <span className="shrink-0">{icon}</span>}
      {children}
    </span>
  );
}

// ── Mapeamento de status prontos ───────────────────────────────────────────

export function OrderStatusBadge({ status }: { status: string }) {
  const map: Record<string, { variant: BadgeVariant; label: string }> = {
    completed: { variant: "success", label: "Concluído" },
    pending:   { variant: "warning", label: "Pendente" },
    cancelled: { variant: "danger",  label: "Cancelado" },
  };
  const cfg = map[status] ?? { variant: "neutral", label: status };
  return <Badge variant={cfg.variant} dot>{cfg.label}</Badge>;
}

export function ActiveBadge({ active }: { active: boolean }) {
  return (
    <Badge variant={active ? "success" : "neutral"} dot>
      {active ? "Ativo" : "Inativo"}
    </Badge>
  );
}

export function FinanceTypeBadge({ type }: { type: "income" | "expense" }) {
  return (
    <Badge variant={type === "income" ? "success" : "danger"} dot>
      {type === "income" ? "Receita" : "Despesa"}
    </Badge>
  );
}
