import React, { ReactNode } from "react";
import { Filter, X } from "lucide-react";
import { cn } from "../../lib/utils";

// ── FilterBar ──────────────────────────────────────────────────────────────

interface FilterBarProps {
  children: ReactNode;
  className?: string;
  /** Number of active filters */
  activeCount?: number;
  onClearAll?: () => void;
}

export function FilterBar({ children, className, activeCount = 0, onClearAll }: FilterBarProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl",
        className
      )}
    >
      <span className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest shrink-0 mr-1">
        <Filter size={11} />
        Filtros
      </span>

      {children}

      {activeCount > 0 && onClearAll && (
        <button
          onClick={onClearAll}
          className="ml-auto flex items-center gap-1 text-[10px] font-bold text-red-500 hover:text-red-700 uppercase tracking-wider transition-colors"
        >
          <X size={11} />
          Limpar ({activeCount})
        </button>
      )}
    </div>
  );
}

// ── FilterChip ─────────────────────────────────────────────────────────────

interface FilterChipProps {
  label: string;
  value?: string;
  active?: boolean;
  onClick?: () => void;
  onRemove?: () => void;
}

export function FilterChip({ label, value, active = false, onClick, onRemove }: FilterChipProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-bold uppercase tracking-wider transition-all",
        active
          ? "bg-blue-600 text-white border-blue-600 shadow-sm"
          : "bg-white text-slate-500 border-slate-200 hover:border-blue-300 hover:text-blue-600"
      )}
    >
      {label}
      {value && (
        <span className={cn("font-black", active ? "text-blue-100" : "text-slate-400")}>
          {value}
        </span>
      )}
      {active && onRemove && (
        <span
          role="button"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="opacity-70 hover:opacity-100"
        >
          <X size={10} />
        </span>
      )}
    </button>
  );
}

// ── FilterSelect ───────────────────────────────────────────────────────────

interface FilterSelectProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
}

export function FilterSelect({ label, value, onChange, options, placeholder = "Todos" }: FilterSelectProps) {
  const active = value !== "";
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider hidden sm:inline">
        {label}:
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "h-7 pl-2 pr-6 rounded-lg border text-[10px] font-bold uppercase bg-white appearance-none cursor-pointer transition-all outline-none",
          active
            ? "border-blue-400 text-blue-700 bg-blue-50"
            : "border-slate-200 text-slate-600 hover:border-slate-300"
        )}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}
