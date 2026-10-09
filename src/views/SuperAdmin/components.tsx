import { type ReactNode } from "react";
import { Copy } from "lucide-react";
import { Input, Select } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { Badge as UiBadge } from "../../components/ui/Badge";
import { EmptyState as UiEmptyState } from "../../components/ui/EmptyState";
import { Alert as UiAlert } from "../../components/ui/Alert";

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
    <Input
      label={label}
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      required={type !== "date"}
    />
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
    <Select
      label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled}
      options={options}
    />
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
    <div className="rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2.5">
      <div className="flex items-center gap-2 text-slate-400">
        {icon}
        <span className="text-[10px] font-semibold">
          {label}
        </span>
      </div>
      <p className="mt-2 text-sm font-medium text-slate-700">{value}</p>
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
    <div className="rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2.5">
      <p className="text-[10px] font-semibold text-slate-400">
        {label}
      </p>
      <p className="mt-2 break-all text-sm font-medium text-slate-700">
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
  return (
    <Button
      onClick={onClick}
      disabled={disabled}
      variant={variant === "primary" ? "primary" : "outline"}
    >
      {children}
    </Button>
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
    <div className="rounded-lg border border-slate-100 bg-gradient-to-br from-slate-50 to-slate-100/50 p-4">
      {icon && <div className="text-slate-400 mb-2">{icon}</div>}
      <p className="text-[11px] font-semibold text-slate-600">
        {label}
      </p>
      <p className="mt-2 text-3xl font-semibold text-slate-900">
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
  const config = {
    pending: { color: "warning", label: "Pendente" },
    used: { color: "success", label: "Usado" },
    expired: { color: "danger", label: "Expirado" },
  } as const;
  const { color, label } = config[status];
  return <UiBadge color={color}>{label}</UiBadge>;
}

export function EmptyState({ message }: { message: string }) {
  return <UiEmptyState title={message} />;
}

export function Alert({
  type,
  message,
}: {
  type: "error" | "success";
  message: string;
}) {
  return <UiAlert variant={type}>{message}</UiAlert>;
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
    <Button
      variant="outline"
      onClick={handleCopy}
      title={value}
      iconLeft={<Copy size={13} />}
      className="flex-1"
    >
      {label}
    </Button>
  );
}
