import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";

import { Alert } from "../../../components/ui/Alert";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { EmptyState } from "../../../components/ui/EmptyState";
import type { StatusMeta } from "./lib";

export function StatusBadge({ meta }: { meta: StatusMeta | undefined }) {
  if (!meta) return null;
  return <Badge color={meta.color} pill dot>{meta.label}</Badge>;
}

/** Estados de carregamento / erro / vazio de uma tela de lista. */
export function AsyncState({ loading, error, onRetry, empty, emptyTitle, emptyDescription, children }: {
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  empty?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  children: ReactNode;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white p-10 text-xs text-slate-500">
        <Loader2 size={15} className="animate-spin" /> Carregando…
      </div>
    );
  }
  if (error) {
    return (
      <Alert variant="error" title="Não foi possível carregar" action={<Button size="sm" variant="outline" onClick={onRetry}>Tentar de novo</Button>}>
        {error}
      </Alert>
    );
  }
  if (empty) return <EmptyState title={emptyTitle ?? "Nada por aqui ainda"} description={emptyDescription} />;
  return <>{children}</>;
}

export function Panel({ title, description, action, children }: { title?: string; description?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      {(title || action) && (
        <div className="flex flex-col gap-2 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {title && <h3 className="text-sm font-semibold text-slate-900">{title}</h3>}
            {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function KeyValue({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2.5">
      <p className="text-[10px] font-semibold text-slate-400">{label}</p>
      <div className="mt-1.5 break-words text-sm font-medium text-slate-700">{children}</div>
    </div>
  );
}
