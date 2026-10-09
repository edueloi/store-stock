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

const variantConfig: Record<ToastVariant, { icon: ReactNode }> = {
  success: { icon: <CheckCircle2 size={20} color="#10b981" /> },
  error: { icon: <XCircle size={20} color="#ef4444" /> },
  warning: { icon: <AlertTriangle size={20} color="#f59e0b" /> },
  info: { icon: <Info size={20} color="#60a5fa" /> },
};

// ── Provider ───────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, variant: ToastVariant = "info", duration = 3000) => {
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
      <div className="pointer-events-none fixed left-4 right-4 top-4 z-[200] flex flex-col items-end gap-2">
        <AnimatePresence initial={false}>
          {toasts.map((t) => {
            const { icon } = variantConfig[t.variant];
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 16, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.95 }}
                transition={{ type: "spring", damping: 26, stiffness: 320 }}
                role={t.variant === "error" ? "alert" : "status"}
                className="pointer-events-auto flex min-w-0 max-w-[min(350px,calc(100vw-32px))] items-center gap-2.5 rounded-lg bg-[#363636] px-2.5 py-2 text-[13px] font-semibold leading-snug text-white shadow-[0_3px_10px_rgb(0_0_0/10%),0_3px_3px_rgb(0_0_0/5%)]"
              >
                <span className="shrink-0">{icon}</span>
                <span className="min-w-0 flex-1 break-words leading-snug">{t.message}</span>
                <button
                  onClick={() => dismiss(t.id)}
                  aria-label="Fechar notificação" className="shrink-0 rounded p-1 opacity-60 transition-opacity hover:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
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
