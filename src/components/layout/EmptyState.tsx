import { ReactNode } from "react";
import { cn } from "../../lib/utils";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  /** Se true usa borda tracejada (dentro de seção), se false apenas centralizado */
  bordered?: boolean;
}

export function EmptyState({ icon, title, description, action, className, bordered = true }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 py-16 px-8 text-center",
        bordered && "border-2 border-dashed border-slate-200 rounded-2xl",
        className
      )}
    >
      {icon && (
        <div className="w-16 h-16 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center text-slate-300 shadow-inner">
          {icon}
        </div>
      )}
      <div className="space-y-1">
        <p className="text-xs font-black text-slate-500 uppercase tracking-widest">{title}</p>
        {description && (
          <p className="text-[10px] text-slate-400 font-medium max-w-xs">{description}</p>
        )}
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

// ── Loading State ──────────────────────────────────────────────────────────

interface LoadingStateProps {
  text?: string;
  className?: string;
  rows?: number;
}

export function LoadingState({ text = "Carregando...", className, rows = 5 }: LoadingStateProps) {
  return (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-14 bg-slate-100 rounded-xl animate-pulse" style={{ opacity: 1 - i * 0.15 }} />
      ))}
      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest text-center pt-2">
        {text}
      </p>
    </div>
  );
}

// ── Loading Spinner inline ─────────────────────────────────────────────────

export function Spinner({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <svg
      className={cn("animate-spin text-blue-600", className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.2" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
