import React, { ReactNode } from "react";
import { cn } from "../../lib/utils";

// ── RadioGroup ─────────────────────────────────────────────────────────────

interface RadioGroupProps {
  label?: string;
  error?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
  orientation?: "vertical" | "horizontal";
}

export function RadioGroup({ label, error, hint, children, className, orientation = "vertical" }: RadioGroupProps) {
  return (
    <fieldset className={cn("space-y-1.5", className)}>
      {label && (
        <legend className="text-[10px] font-black text-slate-600 uppercase tracking-wider block mb-2">
          {label}
        </legend>
      )}
      <div className={cn(
        "flex gap-3",
        orientation === "vertical" ? "flex-col" : "flex-row flex-wrap"
      )}>
        {children}
      </div>
      {error && <p className="text-[10px] text-red-500 font-medium mt-1.5">{error}</p>}
      {hint && !error && <p className="text-[10px] text-slate-400 font-medium mt-1.5">{hint}</p>}
    </fieldset>
  );
}

// ── Radio ──────────────────────────────────────────────────────────────────

interface RadioProps {
  value: string;
  checked: boolean;
  onChange: (value: string) => void;
  label: string;
  description?: string;
  disabled?: boolean;
  /** card = bordered card style, plain = minimal */
  variant?: "plain" | "card";
}

export function Radio({
  value,
  checked,
  onChange,
  label,
  description,
  disabled = false,
  variant = "plain",
}: RadioProps) {
  if (variant === "card") {
    return (
      <label className={cn(
        "flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all select-none",
        checked ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:border-slate-300 bg-white",
        disabled && "opacity-50 cursor-not-allowed"
      )}>
        <input
          type="radio"
          className="sr-only"
          checked={checked}
          disabled={disabled}
          onChange={() => onChange(value)}
        />
        {/* Circle */}
        <div className={cn(
          "w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-all",
          checked ? "border-blue-500 bg-blue-500" : "border-slate-300"
        )}>
          {checked && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
        </div>
        <div className="min-w-0">
          <p className={cn("text-xs font-bold leading-none", checked ? "text-blue-700" : "text-slate-800")}>
            {label}
          </p>
          {description && (
            <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">{description}</p>
          )}
        </div>
      </label>
    );
  }

  return (
    <label className={cn(
      "flex items-center gap-2.5 cursor-pointer select-none group",
      disabled && "opacity-50 cursor-not-allowed"
    )}>
      <input
        type="radio"
        className="sr-only"
        checked={checked}
        disabled={disabled}
        onChange={() => onChange(value)}
      />
      <div className={cn(
        "w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-all",
        checked ? "border-blue-500 bg-blue-500" : "border-slate-300 group-hover:border-blue-400"
      )}>
        {checked && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
      </div>
      <div>
        <p className="text-xs font-semibold text-slate-800 leading-none">{label}</p>
        {description && (
          <p className="text-[10px] text-slate-400 mt-0.5">{description}</p>
        )}
      </div>
    </label>
  );
}
