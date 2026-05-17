import React, { useState, ReactNode } from "react";
import { Download, FileText, FileSpreadsheet, FileJson, Loader2, CheckCircle2 } from "lucide-react";
import { cn } from "../../lib/utils";
import Modal from "./Modal";
import Button from "./Button";

// ── Types ──────────────────────────────────────────────────────────────────

export type DownloadFormat = "csv" | "xlsx" | "json" | "pdf";

interface DownloadOption {
  format: DownloadFormat;
  label: string;
  description?: string;
}

interface DownloadModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  options?: DownloadOption[];
  onDownload: (format: DownloadFormat) => Promise<void>;
  /** Summary shown before download (e.g. "127 registros selecionados") */
  summary?: ReactNode;
}

// ── Icons ──────────────────────────────────────────────────────────────────

const formatIcon: Record<DownloadFormat, ReactNode> = {
  csv:  <FileText size={20} />,
  xlsx: <FileSpreadsheet size={20} />,
  json: <FileJson size={20} />,
  pdf:  <FileText size={20} />,
};

const formatColor: Record<DownloadFormat, string> = {
  csv:  "bg-emerald-50 text-emerald-600 border-emerald-200",
  xlsx: "bg-green-50 text-green-700 border-green-200",
  json: "bg-amber-50 text-amber-600 border-amber-200",
  pdf:  "bg-red-50 text-red-600 border-red-200",
};

const DEFAULT_OPTIONS: DownloadOption[] = [
  { format: "csv",  label: "CSV",  description: "Planilha universal" },
  { format: "xlsx", label: "XLSX", description: "Microsoft Excel" },
  { format: "json", label: "JSON", description: "Dados brutos" },
];

// ── Component ──────────────────────────────────────────────────────────────

export default function DownloadModal({
  open,
  onClose,
  title = "Exportar Dados",
  subtitle,
  options = DEFAULT_OPTIONS,
  onDownload,
  summary,
}: DownloadModalProps) {
  const [selected, setSelected] = useState<DownloadFormat | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleDownload = async () => {
    if (!selected) return;
    setLoading(true);
    try {
      await onDownload(selected);
      setDone(true);
      setTimeout(() => { setDone(false); onClose(); }, 1200);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={handleDownload}
            disabled={!selected || loading}
            loading={loading}
            icon={done ? <CheckCircle2 size={14} /> : <Download size={14} />}
          >
            {done ? "Exportado!" : "Exportar"}
          </Button>
        </>
      }
    >
      {summary && (
        <div className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 font-medium">
          {summary}
        </div>
      )}

      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
        Escolha o formato
      </p>

      <div className="grid grid-cols-1 gap-2">
        {options.map((opt) => (
          <button
            key={opt.format}
            onClick={() => setSelected(opt.format)}
            className={cn(
              "flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left",
              selected === opt.format
                ? "border-blue-500 bg-blue-50"
                : "border-slate-200 hover:border-slate-300 bg-white"
            )}
          >
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center border shrink-0", formatColor[opt.format])}>
              {formatIcon[opt.format]}
            </div>
            <div>
              <p className="text-xs font-black text-slate-800 uppercase tracking-tight">{opt.label}</p>
              {opt.description && (
                <p className="text-[10px] text-slate-400 font-medium">{opt.description}</p>
              )}
            </div>
            <div className="ml-auto">
              <div className={cn("w-4 h-4 rounded-full border-2 transition-all",
                selected === opt.format ? "border-blue-500 bg-blue-500" : "border-slate-300")}>
                {selected === opt.format && (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="w-1.5 h-1.5 bg-white rounded-full" />
                  </div>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
    </Modal>
  );
}
