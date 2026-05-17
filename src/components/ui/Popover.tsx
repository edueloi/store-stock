import React, { useState, useRef, ReactNode, useEffect, useCallback, Key } from "react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../../lib/utils";

type PopoverPlacement = "bottom-start" | "bottom-end" | "top-start" | "top-end" | "bottom" | "top";

interface PopoverProps {
  trigger: ReactNode;
  children: ReactNode;
  placement?: PopoverPlacement;
  className?: string;
  /** Close when clicking outside */
  closeOnOutside?: boolean;
}

const placementClasses: Record<PopoverPlacement, string> = {
  "bottom-start": "top-full left-0 mt-2",
  "bottom-end":   "top-full right-0 mt-2",
  "top-start":    "bottom-full left-0 mb-2",
  "top-end":      "bottom-full right-0 mb-2",
  bottom:         "top-full left-1/2 -translate-x-1/2 mt-2",
  top:            "bottom-full left-1/2 -translate-x-1/2 mb-2",
};

const placementInitial: Record<PopoverPlacement, object> = {
  "bottom-start": { y: -6 },
  "bottom-end":   { y: -6 },
  "top-start":    { y: 6 },
  "top-end":      { y: 6 },
  bottom:         { y: -6 },
  top:            { y: 6 },
};

export default function Popover({
  trigger,
  children,
  placement = "bottom-start",
  className,
  closeOnOutside = true,
}: PopoverProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const handleOutside = useCallback(
    (e: MouseEvent) => {
      if (closeOnOutside && ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    },
    [closeOnOutside]
  );

  useEffect(() => {
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [handleOutside]);

  return (
    <div ref={ref} className="relative inline-flex">
      <div onClick={() => setOpen((v) => !v)}>{trigger}</div>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, ...placementInitial[placement] }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, ...placementInitial[placement] }}
            transition={{ type: "spring", damping: 28, stiffness: 350 }}
            className={cn(
              "absolute z-[150] bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden",
              placementClasses[placement],
              className
            )}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── PopoverItem helper ─────────────────────────────────────────────────────

interface PopoverItemProps {
  key?: React.Key;
  icon?: ReactNode;
  children: ReactNode;
  onClick?: () => void;
  variant?: "default" | "danger";
  disabled?: boolean;
}

export function PopoverItem({ icon, children, onClick, variant = "default", disabled = false }: PopoverItemProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-2.5 text-xs font-semibold transition-colors",
        variant === "default" && "text-slate-700 hover:bg-slate-50",
        variant === "danger" && "text-red-600 hover:bg-red-50",
        disabled && "opacity-40 cursor-not-allowed pointer-events-none"
      )}
    >
      {icon && <span className="opacity-60">{icon}</span>}
      {children}
    </button>
  );
}

export function PopoverDivider() {
  return <hr className="border-slate-100" />;
}
