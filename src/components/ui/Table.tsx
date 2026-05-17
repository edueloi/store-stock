import React, { ReactNode } from "react";
import { cn } from "../../lib/utils";

// ── Table ─────────────────────────────────────────────────────────────────

interface TableProps {
  children: ReactNode;
  className?: string;
}

export function Table({ children, className }: TableProps) {
  return (
    <div className={cn("bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden", className)}>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">{children}</table>
      </div>
    </div>
  );
}

// ── TableHead ─────────────────────────────────────────────────────────────

export function TableHead({ children }: { children: ReactNode }) {
  return (
    <thead>
      <tr className="bg-slate-50 border-b border-slate-200">{children}</tr>
    </thead>
  );
}

// ── Th ────────────────────────────────────────────────────────────────────

interface ThProps {
  children?: ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
}

export function Th({ children, className, align = "left" }: ThProps) {
  return (
    <th
      className={cn(
        "px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className
      )}
    >
      {children}
    </th>
  );
}

// ── TableBody ─────────────────────────────────────────────────────────────

export function TableBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-slate-100">{children}</tbody>;
}

// ── Tr ────────────────────────────────────────────────────────────────────

interface TrProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  key?: React.Key;
}

export function Tr({ children, className, onClick }: TrProps) {
  return (
    <tr
      onClick={onClick}
      className={cn(
        "hover:bg-slate-50/60 transition-colors group",
        onClick && "cursor-pointer",
        className
      )}
    >
      {children}
    </tr>
  );
}

// ── Td ────────────────────────────────────────────────────────────────────

interface TdProps {
  children?: ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
  mono?: boolean;
}

export function Td({ children, className, align = "left", mono = false }: TdProps) {
  return (
    <td
      className={cn(
        "px-5 py-4 text-xs text-slate-700",
        mono && "font-mono font-bold",
        !mono && "font-medium",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className
      )}
    >
      {children}
    </td>
  );
}

// ── RowActions ────────────────────────────────────────────────────────────

interface RowActionsProps {
  children: ReactNode;
  /** Se true, ações ficam invisíveis até hover na row (group) */
  revealOnHover?: boolean;
}

export function RowActions({ children, revealOnHover = true }: RowActionsProps) {
  return (
    <Td align="right">
      <div
        className={cn(
          "flex items-center justify-end gap-1",
          revealOnHover && "opacity-0 group-hover:opacity-100 transition-opacity"
        )}
      >
        {children}
      </div>
    </Td>
  );
}

// ── ActionButton ──────────────────────────────────────────────────────────

interface ActionButtonProps {
  onClick?: (e: React.MouseEvent) => void;
  icon: ReactNode;
  variant?: "edit" | "delete" | "view" | "neutral";
  title?: string;
}

const actionVariant = {
  edit:    "text-slate-400 hover:text-blue-600 hover:bg-blue-50 hover:border-blue-200",
  delete:  "text-slate-400 hover:text-red-600 hover:bg-red-50 hover:border-red-200",
  view:    "text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 hover:border-emerald-200",
  neutral: "text-slate-400 hover:text-slate-700 hover:bg-slate-100",
};

export function ActionButton({ onClick, icon, variant = "neutral", title }: ActionButtonProps) {
  return (
    <button
      title={title}
      onClick={(e) => { e.stopPropagation(); onClick?.(e); }}
      className={cn(
        "w-8 h-8 flex items-center justify-center rounded-xl border border-transparent transition-all",
        actionVariant[variant]
      )}
    >
      {icon}
    </button>
  );
}
