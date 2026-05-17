import React, { ReactNode } from "react";
import { AlertTriangle, Trash2, LogOut, AlertCircle } from "lucide-react";
import { cn } from "../../lib/utils";
import Modal from "./Modal";
import Button from "./Button";

// ── Types ──────────────────────────────────────────────────────────────────

type ConfirmVariant = "danger" | "warning" | "info";

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
  loading?: boolean;
}

// ── Config ─────────────────────────────────────────────────────────────────

const variantConfig: Record<ConfirmVariant, {
  icon: ReactNode;
  iconBg: string;
  confirmVariant: "danger" | "secondary";
}> = {
  danger: {
    icon: <Trash2 size={20} />,
    iconBg: "bg-red-100 text-red-600",
    confirmVariant: "danger",
  },
  warning: {
    icon: <AlertTriangle size={20} />,
    iconBg: "bg-amber-100 text-amber-600",
    confirmVariant: "danger",
  },
  info: {
    icon: <AlertCircle size={20} />,
    iconBg: "bg-blue-100 text-blue-600",
    confirmVariant: "secondary",
  },
};

// ── Component ──────────────────────────────────────────────────────────────

export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  variant = "danger",
  loading = false,
}: ConfirmDialogProps) {
  const { icon, iconBg, confirmVariant } = variantConfig[variant];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title=""
      size="sm"
      persistent={loading}
      footer={
        <div className="flex gap-3 w-full">
          <Button variant="secondary" onClick={onClose} className="flex-1" disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant={confirmVariant}
            onClick={onConfirm}
            loading={loading}
            className="flex-1"
          >
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col items-center text-center gap-4 pt-2 pb-2">
        <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center", iconBg)}>
          {icon}
        </div>
        <div>
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">{title}</h3>
          {description && (
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">{description}</p>
          )}
        </div>
      </div>
    </Modal>
  );
}
