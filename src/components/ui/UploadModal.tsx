import React, { useState, useRef, DragEvent, ChangeEvent, ReactNode } from "react";
import { Upload, File, X, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../../lib/utils";
import Modal from "./Modal";
import Button from "./Button";

// ── Types ──────────────────────────────────────────────────────────────────

interface UploadFile {
  id: string;
  file: File;
  status: "pending" | "uploading" | "done" | "error";
  progress: number;
  error?: string;
}

interface UploadModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  /** Called with each accepted File; resolve to confirm, reject with message to show error */
  onUpload: (file: File) => Promise<void>;
  accept?: string;
  maxSizeMB?: number;
  multiple?: boolean;
  hint?: ReactNode;
}

// ── Component ──────────────────────────────────────────────────────────────

export default function UploadModal({
  open,
  onClose,
  title = "Upload de Arquivo",
  subtitle,
  onUpload,
  accept,
  maxSizeMB = 10,
  multiple = false,
  hint,
}: UploadModalProps) {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = (raw: FileList | null) => {
    if (!raw) return;
    const maxBytes = maxSizeMB * 1024 * 1024;
    const entries: UploadFile[] = Array.from(raw).map((f) => ({
      id: Math.random().toString(36).slice(2),
      file: f,
      status: f.size > maxBytes ? "error" : "pending",
      progress: 0,
      error: f.size > maxBytes ? `Arquivo muito grande (máx ${maxSizeMB}MB)` : undefined,
    }));
    setFiles((prev) => (multiple ? [...prev, ...entries] : entries));
  };

  const remove = (id: string) => setFiles((prev) => prev.filter((f) => f.id !== id));

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  };

  const uploadAll = async () => {
    for (const entry of files) {
      if (entry.status !== "pending") continue;
      setFiles((prev) => prev.map((f) => f.id === entry.id ? { ...f, status: "uploading", progress: 30 } : f));
      try {
        await onUpload(entry.file);
        setFiles((prev) => prev.map((f) => f.id === entry.id ? { ...f, status: "done", progress: 100 } : f));
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Erro no upload";
        setFiles((prev) => prev.map((f) => f.id === entry.id ? { ...f, status: "error", error: msg } : f));
      }
    }
  };

  const pendingCount = files.filter((f) => f.status === "pending").length;
  const allDone = files.length > 0 && files.every((f) => f.status === "done");

  const handleClose = () => {
    setFiles([]);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={title}
      subtitle={subtitle}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose}>
            {allDone ? "Fechar" : "Cancelar"}
          </Button>
          {!allDone && (
            <Button
              onClick={uploadAll}
              disabled={pendingCount === 0}
              icon={<Upload size={14} />}
            >
              Enviar {pendingCount > 0 ? `(${pendingCount})` : ""}
            </Button>
          )}
        </>
      }
    >
      {/* Drop Zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all",
          dragging
            ? "border-blue-400 bg-blue-50 text-blue-600"
            : "border-slate-200 hover:border-blue-300 hover:bg-slate-50 text-slate-400"
        )}
      >
        <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center transition-colors",
          dragging ? "bg-blue-100" : "bg-slate-100")}>
          <Upload size={22} strokeWidth={1.5} />
        </div>
        <div className="text-center">
          <p className="text-xs font-black uppercase tracking-wider text-slate-700">
            {dragging ? "Solte aqui" : "Arraste ou clique para selecionar"}
          </p>
          {hint && <p className="text-[10px] text-slate-400 mt-1">{hint}</p>}
          {accept && (
            <p className="text-[10px] text-slate-400 mt-0.5 uppercase">{accept} · máx {maxSizeMB}MB</p>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept={accept}
          multiple={multiple}
          onChange={(e: ChangeEvent<HTMLInputElement>) => addFiles(e.target.files)}
        />
      </div>

      {/* File List */}
      <AnimatePresence initial={false}>
        {files.map((f) => (
          <motion.div
            key={f.id}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl mt-2">
              <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                f.status === "done" ? "bg-emerald-100 text-emerald-600" :
                f.status === "error" ? "bg-red-100 text-red-500" : "bg-slate-200 text-slate-500")}>
                {f.status === "done" ? <CheckCircle2 size={15} /> :
                 f.status === "error" ? <AlertCircle size={15} /> :
                 f.status === "uploading" ? <Loader2 size={15} className="animate-spin" /> :
                 <File size={15} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold text-slate-800 truncate">{f.file.name}</p>
                {f.error ? (
                  <p className="text-[10px] text-red-500">{f.error}</p>
                ) : (
                  <p className="text-[10px] text-slate-400">
                    {(f.file.size / 1024).toFixed(0)} KB · {f.status === "done" ? "Concluído" : f.status === "uploading" ? "Enviando..." : "Aguardando"}
                  </p>
                )}
              </div>
              {f.status === "pending" && (
                <button onClick={() => remove(f.id)} className="text-slate-400 hover:text-red-500 transition-colors">
                  <X size={14} />
                </button>
              )}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </Modal>
  );
}
