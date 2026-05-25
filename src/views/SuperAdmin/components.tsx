import { type ReactNode } from "react";
import { Copy, RefreshCcw } from "lucide-react";

export function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <label className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-600">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-900 placeholder-slate-400 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-50 disabled:text-slate-400"
        required={type !== "date"}
      />
    </div>
  );
}

export function SelectField({
  label,
  value,
  onChange,
  options,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <label className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-600">
        {label}
      </label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-900 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-50 disabled:text-slate-400"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function MiniInfo({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-2.5">
      <div className="flex items-center gap-2 text-slate-400">
        {icon}
        <span className="text-[9px] font-bold uppercase tracking-[0.18em]">
          {label}
        </span>
      </div>
      <p className="mt-2 text-sm font-semibold text-slate-700">{value}</p>
    </div>
  );
}

export function InfoLine({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-2.5">
      <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-400">
        {label}
      </p>
      <p className="mt-2 break-all text-sm font-semibold text-slate-700">
        {value}
      </p>
    </div>
  );
}

export function ActionButton({
  children,
  onClick,
  variant = "secondary",
  disabled = false,
}: {
  children: ReactNode;
  onClick: () => void;
  variant?: "primary" | "secondary";
  disabled?: boolean;
}) {
  const baseClasses =
    "inline-flex h-10 items-center gap-2 rounded-lg px-4 text-[10px] font-bold uppercase tracking-[0.18em] transition-all disabled:opacity-50 disabled:cursor-not-allowed";

  const variantClasses =
    variant === "primary"
      ? "bg-blue-600 text-white hover:bg-blue-700"
      : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50";

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${variantClasses}`}
    >
      {children}
    </button>
  );
}

export function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-gradient-to-br from-slate-50 to-slate-100/50 p-4">
      {icon && <div className="text-slate-400 mb-2">{icon}</div>}
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-600">
        {label}
      </p>
      <p className="mt-2 text-3xl font-black tracking-[-0.02em] text-slate-900">
        {value}
      </p>
    </div>
  );
}

export function Badge({
  status,
}: {
  status: "pending" | "used" | "expired";
}) {
  const statusConfig = {
    pending: {
      bg: "bg-amber-50",
      text: "text-amber-700",
      border: "border-amber-200",
    },
    used: {
      bg: "bg-emerald-50",
      text: "text-emerald-700",
      border: "border-emerald-200",
    },
    expired: {
      bg: "bg-red-50",
      text: "text-red-700",
      border: "border-red-200",
    },
  };

  const config = statusConfig[status];
  const labelMap = {
    pending: "Pendente",
    used: "Usado",
    expired: "Expirado",
  };

  return (
    <span
      className={`inline-flex rounded-lg border px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.16em] ${config.bg} ${config.text} ${config.border}`}
    >
      {labelMap[status]}
    </span>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center text-sm text-slate-500">
      {message}
    </div>
  );
}

export function Alert({
  type,
  message,
}: {
  type: "error" | "success";
  message: string;
}) {
  const config =
    type === "error"
      ? {
          bg: "bg-red-50",
          border: "border-red-200",
          text: "text-red-600",
        }
      : {
          bg: "bg-emerald-50",
          border: "border-emerald-200",
          text: "text-emerald-700",
        };

  return (
    <div
      className={`rounded-lg border px-4 py-3 text-sm font-semibold ${config.bg} ${config.border} ${config.text}`}
    >
      {message}
    </div>
  );
}

export function CopyButton({ value, label }: { value: string; label: string }) {
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <button
      onClick={handleCopy}
      title={value}
      className="group inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-600 transition-all hover:bg-slate-50"
    >
      <Copy size={13} />
      {label}
    </button>
  );
}
