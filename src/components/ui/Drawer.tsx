import React, { ReactNode } from "react";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import type { TargetAndTransition } from "motion-dom";
import { cn } from "../../lib/utils";

type DrawerSide = "right" | "left" | "bottom";

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  side?: DrawerSide;
  /** Width for left/right drawers */
  width?: string;
  persistent?: boolean;
}

const sideVariants: Record<DrawerSide, { initial: TargetAndTransition; animate: TargetAndTransition; exit: TargetAndTransition; classes: string }> = {
  right: {
    initial: { x: "100%" },
    animate: { x: 0 },
    exit: { x: "100%" },
    classes: "right-0 top-0 h-full",
  },
  left: {
    initial: { x: "-100%" },
    animate: { x: 0 },
    exit: { x: "-100%" },
    classes: "left-0 top-0 h-full",
  },
  bottom: {
    initial: { y: "100%" },
    animate: { y: 0 },
    exit: { y: "100%" },
    classes: "bottom-0 left-0 right-0 rounded-t-2xl max-h-[85vh]",
  },
};

export default function Drawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  side = "right",
  width = "w-full sm:w-[420px]",
  persistent = false,
}: DrawerProps) {
  const sv = sideVariants[side];

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100]">
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={persistent ? undefined : onClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />

          {/* Panel */}
          <motion.div
            initial={sv.initial}
            animate={sv.animate}
            exit={sv.exit}
            transition={{ type: "spring", damping: 30, stiffness: 350 }}
            className={cn(
              "absolute bg-white shadow-2xl border-slate-200 flex flex-col overflow-hidden",
              side !== "bottom" && "border-l",
              side === "left" && "border-r border-l-0",
              side === "bottom" && "border-t",
              side !== "bottom" && width,
              sv.classes
            )}
          >
            {/* Header */}
            {(title || subtitle) && (
              <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
                <div>
                  {title && (
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest leading-none">
                      {title}
                    </h3>
                  )}
                  {subtitle && (
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter mt-1">
                      {subtitle}
                    </p>
                  )}
                </div>
                <button
                  onClick={onClose}
                  className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-slate-700 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            )}

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6">{children}</div>

            {/* Footer */}
            {footer && (
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3 shrink-0">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
