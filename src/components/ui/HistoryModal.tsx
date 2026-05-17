import React, { ReactNode } from "react";
import { Clock, User, ArrowUpCircle, ArrowDownCircle, Edit3, Plus, Trash2, AlertCircle } from "lucide-react";
import { cn } from "../../lib/utils";
import Modal from "./Modal";
import Button from "./Button";

// ── Types ──────────────────────────────────────────────────────────────────

export type HistoryEventType =
  | "create" | "update" | "delete"
  | "stock_in" | "stock_out"
  | "status_change" | "note" | "custom";

export interface HistoryEntry {
  id: string | number;
  type: HistoryEventType;
  title: string;
  description?: string;
  user?: string;
  date: string | Date;
  meta?: Record<string, string | number>;
}

interface HistoryModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  entries: HistoryEntry[];
  loading?: boolean;
}

// ── Config ─────────────────────────────────────────────────────────────────

const eventConfig: Record<HistoryEventType, { icon: ReactNode; color: string }> = {
  create:        { icon: <Plus size={13} />,            color: "bg-emerald-100 text-emerald-600 border-emerald-200" },
  update:        { icon: <Edit3 size={13} />,           color: "bg-blue-100 text-blue-600 border-blue-200" },
  delete:        { icon: <Trash2 size={13} />,          color: "bg-red-100 text-red-500 border-red-200" },
  stock_in:      { icon: <ArrowUpCircle size={13} />,   color: "bg-emerald-100 text-emerald-600 border-emerald-200" },
  stock_out:     { icon: <ArrowDownCircle size={13} />, color: "bg-amber-100 text-amber-600 border-amber-200" },
  status_change: { icon: <AlertCircle size={13} />,     color: "bg-purple-100 text-purple-600 border-purple-200" },
  note:          { icon: <Edit3 size={13} />,           color: "bg-slate-100 text-slate-500 border-slate-200" },
  custom:        { icon: <Clock size={13} />,           color: "bg-slate-100 text-slate-500 border-slate-200" },
};

function formatDate(d: string | Date) {
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// ── Component ──────────────────────────────────────────────────────────────

export default function HistoryModal({
  open,
  onClose,
  title = "Histórico",
  subtitle,
  entries,
  loading = false,
}: HistoryModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      size="md"
      footer={<Button variant="secondary" onClick={onClose}>Fechar</Button>}
    >
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex gap-3 animate-pulse">
              <div className="w-8 h-8 bg-slate-100 rounded-full shrink-0" />
              <div className="flex-1 space-y-2 pt-1">
                <div className="h-2.5 bg-slate-100 rounded w-2/3" />
                <div className="h-2 bg-slate-100 rounded w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-10 text-slate-400">
          <Clock size={32} strokeWidth={1} className="mx-auto mb-3 opacity-50" />
          <p className="text-xs font-bold uppercase tracking-wider">Nenhum registro encontrado</p>
        </div>
      ) : (
        <ol className="relative border-l border-slate-200 ml-3 space-y-6">
          {entries.map((entry, idx) => {
            const { icon, color } = eventConfig[entry.type];
            return (
              <li key={entry.id} className="ml-5">
                {/* Dot */}
                <span className={cn(
                  "absolute -left-3.5 w-7 h-7 rounded-full border flex items-center justify-center",
                  color
                )}>
                  {icon}
                </span>

                <div className={cn("p-3 bg-slate-50 border border-slate-200 rounded-xl", idx === 0 && "border-blue-200 bg-blue-50/50")}>
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <p className="text-xs font-black text-slate-800 uppercase tracking-tight leading-snug">
                      {entry.title}
                    </p>
                    <time className="text-[10px] text-slate-400 font-mono shrink-0">
                      {formatDate(entry.date)}
                    </time>
                  </div>

                  {entry.description && (
                    <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">{entry.description}</p>
                  )}

                  {entry.meta && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {Object.entries(entry.meta).map(([k, v]) => (
                        <span key={k} className="text-[9px] font-bold uppercase px-2 py-0.5 bg-white border border-slate-200 rounded-full text-slate-500">
                          {k}: {v}
                        </span>
                      ))}
                    </div>
                  )}

                  {entry.user && (
                    <div className="flex items-center gap-1 mt-2 text-[10px] text-slate-400">
                      <User size={10} />
                      <span>{entry.user}</span>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Modal>
  );
}
