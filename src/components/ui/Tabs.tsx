import React, { createContext, useContext, useState, ReactNode } from "react";
import { motion } from "motion/react";
import { cn } from "../../lib/utils";

// ── Context ────────────────────────────────────────────────────────────────

interface TabsContextValue {
  active: string;
  setActive: (id: string) => void;
}
const TabsContext = createContext<TabsContextValue>({ active: "", setActive: () => {} });

// ── Tabs ───────────────────────────────────────────────────────────────────

interface TabsProps {
  defaultTab: string;
  children: ReactNode;
  onChange?: (id: string) => void;
  className?: string;
}

export function Tabs({ defaultTab, children, onChange, className }: TabsProps) {
  const [active, setActiveState] = useState(defaultTab);

  const setActive = (id: string) => {
    setActiveState(id);
    onChange?.(id);
  };

  return (
    <TabsContext.Provider value={{ active, setActive }}>
      <div className={cn("space-y-4", className)}>{children}</div>
    </TabsContext.Provider>
  );
}

// ── TabList ────────────────────────────────────────────────────────────────

interface TabListProps {
  children: ReactNode;
  className?: string;
  /** pill = rounded full, underline = bottom border */
  variant?: "pill" | "underline";
}

export function TabList({ children, className, variant = "pill" }: TabListProps) {
  return (
    <div
      role="tablist"
      className={cn(
        "flex gap-1",
        variant === "pill" && "bg-slate-100 p-1 rounded-xl w-fit",
        variant === "underline" && "border-b border-slate-200 gap-0",
        className
      )}
    >
      {children}
    </div>
  );
}

// ── Tab ────────────────────────────────────────────────────────────────────

interface TabProps {
  id: string;
  children: ReactNode;
  icon?: ReactNode;
  badge?: string | number;
  disabled?: boolean;
}

export function Tab({ id, children, icon, badge, disabled = false }: TabProps) {
  const { active, setActive } = useContext(TabsContext);
  const isActive = active === id;

  return (
    <button
      role="tab"
      aria-selected={isActive}
      disabled={disabled}
      onClick={() => !disabled && setActive(id)}
      className={cn(
        "relative flex items-center gap-2 px-4 py-2 text-[11px] font-black uppercase tracking-wider rounded-lg transition-colors",
        isActive
          ? "text-blue-600"
          : "text-slate-500 hover:text-slate-800",
        disabled && "opacity-40 cursor-not-allowed"
      )}
    >
      {isActive && (
        <motion.span
          layoutId="tab-indicator"
          className="absolute inset-0 bg-white rounded-lg shadow-sm border border-slate-200"
          style={{ zIndex: 0 }}
          transition={{ type: "spring", damping: 26, stiffness: 400 }}
        />
      )}
      <span className="relative z-10 flex items-center gap-2">
        {icon && <span>{icon}</span>}
        {children}
        {badge !== undefined && (
          <span className={cn(
            "px-1.5 py-0.5 rounded-full text-[9px] font-black",
            isActive ? "bg-blue-100 text-blue-700" : "bg-slate-200 text-slate-500"
          )}>
            {badge}
          </span>
        )}
      </span>
    </button>
  );
}

// ── TabPanel ───────────────────────────────────────────────────────────────

interface TabPanelProps {
  id: string;
  children: ReactNode;
}

export function TabPanel({ id, children }: TabPanelProps) {
  const { active } = useContext(TabsContext);
  if (active !== id) return null;
  return <div role="tabpanel">{children}</div>;
}
