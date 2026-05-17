import React, { ReactNode } from "react";
import { Info } from "lucide-react";
import { cn } from "../../lib/utils";
import Tooltip from "./Tooltip";

// ── Types ──────────────────────────────────────────────────────────────────

export interface SplitterButton {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  disabledText?: string;
  color?: "blue" | "emerald" | "amber" | "red" | "slate" | "purple";
  variant?: "solid" | "outline" | "ghost";
}

export interface SplitterSwitchOption {
  value: string;
  label: string;
}

interface SplitterLineProps {
  /** Title shown à esquerda */
  title?: string;
  /** Menor e cinza, fica recuado */
  subtitle?: boolean;
  /** Ícone à esquerda do título */
  icon?: ReactNode;
  /** Texto de info tooltip */
  info?: string;
  /** Botões à esquerda da linha */
  buttons?: SplitterButton[];
  /** Botões à direita da linha */
  rightButtons?: SplitterButton[];
  /** Switch de abas entre title e linha */
  switchOptions?: SplitterSwitchOption[];
  selectedSwitch?: string;
  onSwitchSelect?: (value: string) => void;
  /** Campo de busca inline */
  search?: boolean;
  onSearch?: (value: string) => void;
  /** Ação avulsa à direita (aceita qualquer ReactNode) */
  rightAction?: ReactNode;
  className?: string;
}

// ── Button color map ───────────────────────────────────────────────────────

const btnColors: Record<string, { solid: string; outline: string; ghost: string }> = {
  blue:    { solid: "bg-blue-600 text-white hover:bg-blue-700",       outline: "border border-blue-500 text-blue-600 hover:bg-blue-50",    ghost: "text-blue-600 hover:bg-blue-50" },
  emerald: { solid: "bg-emerald-600 text-white hover:bg-emerald-700", outline: "border border-emerald-500 text-emerald-600 hover:bg-emerald-50", ghost: "text-emerald-600 hover:bg-emerald-50" },
  amber:   { solid: "bg-amber-500 text-white hover:bg-amber-600",     outline: "border border-amber-400 text-amber-600 hover:bg-amber-50",  ghost: "text-amber-600 hover:bg-amber-50" },
  red:     { solid: "bg-red-600 text-white hover:bg-red-700",         outline: "border border-red-500 text-red-600 hover:bg-red-50",       ghost: "text-red-600 hover:bg-red-50" },
  slate:   { solid: "bg-slate-600 text-white hover:bg-slate-700",     outline: "border border-slate-300 text-slate-600 hover:bg-slate-50", ghost: "text-slate-600 hover:bg-slate-100" },
  purple:  { solid: "bg-purple-600 text-white hover:bg-purple-700",   outline: "border border-purple-400 text-purple-600 hover:bg-purple-50", ghost: "text-purple-600 hover:bg-purple-50" },
};

function SplitBtn({ btn }: { key?: React.Key; btn: SplitterButton }) {
  const color = btn.color ?? "slate";
  const variant = btn.variant ?? "solid";
  const colorClass = btnColors[color]?.[variant] ?? btnColors.slate.solid;

  const button = (
    <button
      onClick={btn.onClick}
      disabled={btn.disabled}
      className={cn(
        "flex items-center gap-1.5 px-3 h-7 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all",
        colorClass,
        btn.disabled && "opacity-40 cursor-not-allowed"
      )}
    >
      {btn.icon && <span>{btn.icon}</span>}
      {btn.label}
    </button>
  );

  if (btn.disabled && btn.disabledText) {
    return <Tooltip content={btn.disabledText}>{button}</Tooltip>;
  }
  return button;
}

// ── Component ──────────────────────────────────────────────────────────────

export default function SplitterLine({
  title,
  subtitle = false,
  icon,
  info,
  buttons = [],
  rightButtons = [],
  switchOptions,
  selectedSwitch,
  onSwitchSelect,
  search = false,
  onSearch,
  rightAction,
  className,
}: SplitterLineProps) {
  return (
    <div className={cn("flex items-center gap-3 w-full min-h-[28px]", className)}>
      {/* Title */}
      {title && (
        <span className={cn(
          "shrink-0 font-bold leading-none whitespace-nowrap",
          subtitle
            ? "text-[11px] text-slate-400 uppercase tracking-wider ml-2"
            : "text-[13px] text-blue-900 uppercase tracking-tight"
        )}>
          {icon && <span className="inline-flex items-center mr-1.5 align-middle opacity-70">{icon}</span>}
          {title}
        </span>
      )}

      {/* Left Buttons */}
      {buttons.length > 0 && (
        <div className="flex items-center gap-1 shrink-0">
          {buttons.map((btn, i) => <SplitBtn key={i} btn={btn} />)}
        </div>
      )}

      {/* Inline Search */}
      {search && (
        <div className="shrink-0">
          <input
            type="text"
            placeholder="Buscar..."
            onChange={(e) => onSearch?.(e.target.value)}
            className="h-7 px-3 rounded-lg border border-slate-200 bg-white text-xs placeholder:text-slate-400 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all w-44"
          />
        </div>
      )}

      {/* Switch Tabs */}
      {switchOptions && switchOptions.length > 0 && (
        <div className="flex items-center bg-slate-100 rounded-lg p-0.5 gap-0.5 shrink-0">
          {switchOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onSwitchSelect?.(opt.value)}
              className={cn(
                "px-3 h-6 rounded-md text-[10px] font-black uppercase tracking-wider transition-all",
                selectedSwitch === opt.value
                  ? "bg-white text-blue-700 shadow-sm border border-slate-200"
                  : "text-slate-500 hover:text-slate-800"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {/* Divider Line */}
      <div className="flex-1 h-px bg-slate-200 min-w-[16px]" />

      {/* Info */}
      {info && (
        <Tooltip content={info} placement="top">
          <div className="shrink-0 w-5 h-5 rounded-full bg-slate-300 hover:bg-slate-400 flex items-center justify-center cursor-default transition-colors">
            <span className="text-white text-[10px] font-bold leading-none">i</span>
          </div>
        </Tooltip>
      )}

      {/* Right Action */}
      {rightAction && <div className="shrink-0">{rightAction}</div>}

      {/* Right Buttons */}
      {rightButtons.length > 0 && (
        <div className="flex items-center gap-1 shrink-0">
          {rightButtons.map((btn, i) => <SplitBtn key={i} btn={btn} />)}
        </div>
      )}
    </div>
  );
}
