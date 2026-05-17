import React, { ReactNode } from "react";
import { motion } from "motion/react";
import { cn } from "../../lib/utils";

// ── Switch ─────────────────────────────────────────────────────────────────

type SwitchSize = "sm" | "md" | "lg";

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  size?: SwitchSize;
  /** Color when on */
  accent?: "blue" | "emerald" | "amber" | "red" | "purple";
  className?: string;
}

const sizeConfig: Record<SwitchSize, { track: string; thumb: string; thumbOn: string }> = {
  sm: { track: "w-7 h-4",   thumb: "w-2.5 h-2.5", thumbOn: "translate-x-3.5" },
  md: { track: "w-10 h-6",  thumb: "w-4 h-4",      thumbOn: "translate-x-[18px]" },
  lg: { track: "w-12 h-7",  thumb: "w-5 h-5",      thumbOn: "translate-x-[22px]" },
};

const accentOn: Record<string, string> = {
  blue:    "bg-blue-500",
  emerald: "bg-emerald-500",
  amber:   "bg-amber-500",
  red:     "bg-red-500",
  purple:  "bg-purple-500",
};

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  size = "md",
  accent = "blue",
  className,
}: SwitchProps) {
  const { track, thumb, thumbOn } = sizeConfig[size];

  return (
    <label className={cn(
      "flex items-center gap-3 cursor-pointer select-none group",
      disabled && "opacity-50 cursor-not-allowed",
      className
    )}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative inline-flex items-center shrink-0 rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2",
          track,
          checked ? accentOn[accent] : "bg-slate-200 group-hover:bg-slate-300"
        )}
      >
        <motion.span
          layout
          className={cn(
            "absolute left-[3px] inline-block rounded-full bg-white shadow-sm",
            thumb
          )}
          animate={{ x: checked ? parseInt(thumbOn.replace("translate-x-[", "").replace("px]", "").replace("translate-x-", "")) - 3 : 0 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
        />
      </button>

      {(label || description) && (
        <div>
          {label && (
            <p className="text-xs font-semibold text-slate-800 leading-none">{label}</p>
          )}
          {description && (
            <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">{description}</p>
          )}
        </div>
      )}
    </label>
  );
}

// ── SwitchGroup ────────────────────────────────────────────────────────────

interface SwitchGroupProps {
  label?: string;
  children: ReactNode;
  className?: string;
}

export function SwitchGroup({ label, children, className }: SwitchGroupProps) {
  return (
    <div className={cn("space-y-3", className)}>
      {label && (
        <p className="text-[10px] font-black text-slate-600 uppercase tracking-wider">{label}</p>
      )}
      <div className="space-y-3 divide-y divide-slate-100">
        {React.Children.map(children, (child, i) => (
          <div className={cn(i > 0 && "pt-3")}>{child}</div>
        ))}
      </div>
    </div>
  );
}
