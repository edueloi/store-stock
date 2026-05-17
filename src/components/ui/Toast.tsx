import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { motion, AnimatePresence } from "motion/react";
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from "lucide-react";
import { cn } from "../../lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────

type ToastVariant = "success" | "error" | "warning" | "info";

interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
  duration?: number;
}

interface ToastContextValue {
  toast: (message: string, variant?: ToastVariant, duration?: number) => void;
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
}

// ── Context ────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

// ── Config ─────────────────────────────────────────────────────────────────

const variantConfig: Record<ToastVariant, { icon: ReactNode; classes: string }> = {
  success: {
    icon: <CheckCircle2 size={15} />,
    classes: "bg-emerald-50 border-emerald-200 text-emerald-800",
  },
  error: {
    icon: <XCircle size={15} />,
    classes: "bg-red-50 border-red-200 text-red-800",
  },
  warning: {
    icon: <AlertTriangle size={15} />,
    classes: "bg-amber-50 border-amber-200 text-amber-800",
  },
  info: {
    icon: <Info size={15} />,
    classes: "bg-blue-50 border-blue-200 text-blue-800",
  },
};

// ── Provider ───────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, variant: ToastVariant = "info", duration = 4000) => {
      const id = Math.random().toString(36).slice(2);
      setToasts((prev) => [...prev, { id, message, variant, duration }]);
      setTimeout(() => dismiss(id), duration);
    },
    [dismiss]
  );

  const value: ToastContextValue = {
    toast,
    success: (m, d) => toast(m, "success", d),
    error: (m, d) => toast(m, "error", d),
    warning: (m, d) => toast(m, "warning", d),
    info: (m, d) => toast(m, "info", d),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Container */}
      <div className="fixed bottom-4 right-4 z-[200] flex flex-col gap-2 pointer-events-none">
        <AnimatePresence initial={false}>
          {toasts.map((t) => {
            const { icon, classes } = variantConfig[t.variant];
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 16, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.95 }}
                transition={{ type: "spring", damping: 26, stiffness: 320 }}
                className={cn(
                  "pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg",
                  "text-xs font-semibold min-w-[220px] max-w-[360px]",
                  classes
                )}
              >
                <span className="shrink-0">{icon}</span>
                <span className="flex-1 leading-snug">{t.message}</span>
                <button
                  onClick={() => dismiss(t.id)}
                  className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
                >
                  <X size={13} />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
