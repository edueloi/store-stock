import React, { ReactNode, Key } from "react";
import { Check, Minus } from "lucide-react";
import { cn } from "../../lib/utils";

// ── Checkbox ───────────────────────────────────────────────────────────────

interface CheckboxProps {
  key?: React.Key;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  indeterminate?: boolean;
  /** card = bordered card style, plain = minimal */
  variant?: "plain" | "card";
  className?: string;
}

export function Checkbox({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  indeterminate = false,
  variant = "plain",
  className,
}: CheckboxProps) {
  const boxClass = cn(
    "w-4 h-4 rounded-md border-2 flex items-center justify-center shrink-0 transition-all",
    checked || indeterminate
      ? "border-blue-500 bg-blue-500"
      : "border-slate-300 group-hover:border-blue-400 bg-white"
  );

  const box = (
    <div className={boxClass}>
      {indeterminate
        ? <Minus size={10} className="text-white stroke-[3]" />
        : checked
          ? <Check size={10} className="text-white stroke-[3]" />
          : null}
    </div>
  );

  if (variant === "card") {
    return (
      <label className={cn(
        "flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all select-none",
        checked ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:border-slate-300 bg-white",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}>
        <input type="checkbox" className="sr-only" checked={checked} disabled={disabled}
          onChange={(e) => onChange(e.target.checked)} />
        {box}
        <div className="min-w-0">
          {label && <p className={cn("text-xs font-bold leading-none", checked ? "text-blue-700" : "text-slate-800")}>{label}</p>}
          {description && <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">{description}</p>}
        </div>
      </label>
    );
  }

  return (
    <label className={cn(
      "flex items-start gap-2.5 cursor-pointer select-none group",
      disabled && "opacity-50 cursor-not-allowed",
      className
    )}>
      <input type="checkbox" className="sr-only" checked={checked} disabled={disabled}
        onChange={(e) => onChange(e.target.checked)} />
      <div className="mt-0.5">{box}</div>
      {(label || description) && (
        <div>
          {label && <p className="text-xs font-semibold text-slate-800 leading-none">{label}</p>}
          {description && <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">{description}</p>}
        </div>
      )}
    </label>
  );
}

// ── CheckboxGroup ──────────────────────────────────────────────────────────

interface CheckboxOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

interface CheckboxGroupProps {
  label?: string;
  options: CheckboxOption[];
  value: string[];
  onChange: (value: string[]) => void;
  error?: string;
  hint?: string;
  orientation?: "vertical" | "horizontal";
  variant?: "plain" | "card";
  className?: string;
}

export function CheckboxGroup({
  label,
  options,
  value,
  onChange,
  error,
  hint,
  orientation = "vertical",
  variant = "plain",
  className,
}: CheckboxGroupProps) {
  const toggle = (v: string) => {
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  };

  return (
    <fieldset className={cn("space-y-1.5", className)}>
      {label && (
        <legend className="text-[10px] font-black text-slate-600 uppercase tracking-wider block mb-2">
          {label}
        </legend>
      )}
      <div className={cn("flex gap-3", orientation === "vertical" ? "flex-col" : "flex-row flex-wrap")}>
        {options.map((opt) => (
          <Checkbox
            key={opt.value}
            checked={value.includes(opt.value)}
            onChange={() => toggle(opt.value)}
            label={opt.label}
            description={opt.description}
            disabled={opt.disabled}
            variant={variant}
          />
        ))}
      </div>
      {error && <p className="text-[10px] text-red-500 font-medium mt-1.5">{error}</p>}
      {hint && !error && <p className="text-[10px] text-slate-400 font-medium mt-1.5">{hint}</p>}
    </fieldset>
  );
}
