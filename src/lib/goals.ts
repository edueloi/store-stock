import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  FileText,
  Users,
  Percent,
} from "lucide-react";

export const GOAL_TYPES = [
  { value: "revenue",           label: "Faturamento Bruto",        icon: DollarSign,   unit: "currency", color: "text-emerald-600", bg: "bg-emerald-50",  border: "border-emerald-200" },
  { value: "income",            label: "Entradas (Caixa)",          icon: TrendingUp,   unit: "currency", color: "text-blue-600",    bg: "bg-blue-50",     border: "border-blue-200" },
  { value: "expense_reduction", label: "Redução de Despesas",       icon: TrendingDown, unit: "currency", color: "text-orange-600",  bg: "bg-orange-50",   border: "border-orange-200" },
  { value: "orders_count",      label: "Nº de Vendas",              icon: ShoppingCart, unit: "number",   color: "text-violet-600",  bg: "bg-violet-50",   border: "border-violet-200" },
  { value: "avg_ticket",        label: "Ticket Médio",              icon: Percent,      unit: "currency", color: "text-fuchsia-600", bg: "bg-fuchsia-50",  border: "border-fuchsia-200" },
  { value: "quotes_converted",  label: "Orçamentos Convertidos",    icon: FileText,     unit: "number",   color: "text-cyan-600",    bg: "bg-cyan-50",     border: "border-cyan-200" },
  { value: "new_customers",     label: "Novos Clientes",            icon: Users,        unit: "number",   color: "text-pink-600",    bg: "bg-pink-50",     border: "border-pink-200" },
];

// Tipos de meta que fazem sentido calcular por vendedor individual
export const SELLER_GOAL_TYPES = GOAL_TYPES.filter((t) =>
  ["revenue", "orders_count", "avg_ticket", "new_customers"].includes(t.value)
);

export const PERIODS = [
  { value: "daily",     label: "Diária" },
  { value: "weekly",    label: "Semanal" },
  { value: "monthly",   label: "Mensal" },
  { value: "quarterly", label: "Trimestral" },
  { value: "biannual",  label: "Semestral" },
  { value: "annual",    label: "Anual" },
  { value: "custom",    label: "Personalizado" },
];

export const fmtCurrency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const fmtNumber = (v: number) => v.toLocaleString("pt-BR");

export function fmtValue(v: number, unit: string) {
  return unit === "currency" ? fmtCurrency(v) : fmtNumber(Math.round(v));
}

export function getTypeConfig(type: string) {
  return GOAL_TYPES.find((t) => t.value === type) ?? GOAL_TYPES[0];
}

export function getPeriodLabel(period: string) {
  return PERIODS.find((p) => p.value === period)?.label ?? period;
}

export function progressColor(pct: number) {
  if (pct >= 100) return "bg-emerald-500";
  if (pct >= 75)  return "bg-blue-500";
  if (pct >= 50)  return "bg-amber-400";
  if (pct >= 25)  return "bg-orange-400";
  return "bg-red-400";
}

export function daysLeft(endDate: string) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);
  return Math.ceil((end.getTime() - now.getTime()) / 86400000);
}

// Computes default date range for a given period
export function defaultDates(period: string): { start: string; end: string } {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  switch (period) {
    case "daily":
      return { start: fmt(now), end: fmt(now) };
    case "weekly": {
      const start = new Date(now);
      start.setDate(now.getDate() - now.getDay());
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return { start: fmt(start), end: fmt(end) };
    }
    case "monthly": {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { start: fmt(start), end: fmt(end) };
    }
    case "quarterly": {
      const q = Math.floor(now.getMonth() / 3);
      const start = new Date(now.getFullYear(), q * 3, 1);
      const end = new Date(now.getFullYear(), q * 3 + 3, 0);
      return { start: fmt(start), end: fmt(end) };
    }
    case "biannual": {
      const half = now.getMonth() < 6 ? 0 : 1;
      const start = new Date(now.getFullYear(), half * 6, 1);
      const end = new Date(now.getFullYear(), half * 6 + 6, 0);
      return { start: fmt(start), end: fmt(end) };
    }
    case "annual": {
      return {
        start: `${now.getFullYear()}-01-01`,
        end:   `${now.getFullYear()}-12-31`,
      };
    }
    default:
      return { start: fmt(now), end: fmt(now) };
  }
}
