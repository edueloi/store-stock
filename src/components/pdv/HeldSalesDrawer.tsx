import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, ChevronDown, ChevronRight, Clock, Loader2, Search, X } from "lucide-react";

import { cancelHeldSale, listHeldSales, resumeHeldSale, type HeldSale } from "../../lib/heldSales";
import { cn } from "../../lib/utils";
import Modal from "../ui/Modal";
import Button, { IconButton } from "../ui/Button";
import { Input } from "../ui/Input";
import { Badge } from "../ui/Badge";
import { useToast } from "../ui/Toast";

interface HeldSalesDrawerProps {
  open: boolean;
  onClose: () => void;
  token: string;
  onResume: (heldSale: HeldSale) => void;
}

// A partir de quanto tempo em espera destacamos a venda como "parada há muito
// tempo" (mesmo limite usado pelo toast de alerta global em AdminDashboard.tsx).
const STALE_HOURS = 24;

function elapsedLabel(createdAt: string): { text: string; hours: number } {
  const hours = (Date.now() - new Date(createdAt).getTime()) / 3_600_000;
  if (hours < 1) return { text: "há poucos minutos", hours };
  if (hours < 24) return { text: `há ${Math.floor(hours)}h`, hours };
  const days = Math.floor(hours / 24);
  return { text: `há ${days} dia${days > 1 ? "s" : ""}`, hours };
}

export default function HeldSalesDrawer({ open, onClose, token, onResume }: HeldSalesDrawerProps) {
  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState<HeldSale[]>([]);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [cancelTarget, setCancelTarget] = useState<HeldSale | null>(null);
  const toast = useToast();

  const load = () => {
    setLoading(true);
    listHeldSales(token)
      .then(setSales)
      .catch(() => setSales([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (open) { setSearch(""); setExpandedId(null); load(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const q = search.trim().toLowerCase();
  const filtered = sales.filter((s) =>
    !q ||
    (s.customer_name ?? "").toLowerCase().includes(q) ||
    String(s.number).includes(q)
  );

  async function handleResume(s: HeldSale) {
    setBusyId(s.id);
    try {
      const updated = await resumeHeldSale(token, s.id);
      onResume(updated);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao retomar a venda em espera.");
      load();
    } finally {
      setBusyId(null);
    }
  }

  async function confirmCancel() {
    if (!cancelTarget) return;
    const s = cancelTarget;
    setBusyId(s.id);
    try {
      await cancelHeldSale(token, s.id);
      setSales((prev) => prev.filter((x) => x.id !== s.id));
      setCancelTarget(null);
      toast.success(`Venda em espera #${String(s.number).padStart(4, "0")} cancelada — estoque devolvido.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao cancelar a venda em espera.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[500]" />
          <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 26, stiffness: 200 }}
            className="fixed inset-y-0 right-0 w-full max-w-sm bg-white z-[510] shadow-sm flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 shrink-0">
              <div>
                <h2 className="font-semibold text-slate-900 text-[15px]">Vendas Abertas</h2>
                <p className="text-[11px] text-slate-500">Retome ou cancele uma venda em espera</p>
              </div>
              <IconButton variant="ghost" size="md" onClick={onClose} aria-label="Fechar" className="h-9 w-9"><X size={18} /></IconButton>
            </div>
            <div className="p-4 border-b border-slate-100 shrink-0">
              <Input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por cliente ou número..." autoFocus
                aria-label="Buscar venda em espera"
                iconLeft={<Search size={13} />} />
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {loading ? (
                <div className="flex items-center justify-center h-32"><Loader2 size={20} className="animate-spin text-slate-300" /></div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-10 text-[11px] font-semibold text-slate-400">Nenhuma venda em espera</div>
              ) : (
                filtered.map((s) => {
                  const isExpanded = expandedId === s.id;
                  const total = s.items.reduce((acc, it) => acc + Number(it.unit_price) * it.quantity, 0);
                  const isBusy = busyId === s.id;
                  const elapsed = elapsedLabel(s.created_at);
                  const isStale = elapsed.hours >= STALE_HOURS;
                  return (
                    <div key={s.id} className={cn("rounded-lg border overflow-hidden", isStale ? "border-amber-300" : "border-slate-200")}>
                      <button onClick={() => setExpandedId(isExpanded ? null : s.id)}
                        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 hover:bg-slate-50 transition-colors text-left">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {isExpanded ? <ChevronDown size={13} className="text-slate-400 shrink-0" /> : <ChevronRight size={13} className="text-slate-400 shrink-0" />}
                          <div className="min-w-0">
                            <p className="text-[12px] font-semibold text-slate-700 truncate">
                              #{String(s.number).padStart(4, "0")} · {s.customer_name || "Sem cliente"}
                            </p>
                            <p className="text-[11px] text-slate-400 flex items-center gap-1">
                              {s.items.length} {s.items.length === 1 ? "item" : "itens"} · R$ {total.toFixed(2)}
                            </p>
                            <p className={cn("text-[10px] font-semibold flex items-center gap-1 mt-0.5", isStale ? "text-amber-600" : "text-slate-400")}>
                              {isStale ? <AlertTriangle size={10} /> : <Clock size={10} />} {elapsed.text}
                            </p>
                          </div>
                        </div>
                        <Badge size="sm" color={s.status === "resumed" ? "warning" : "info"} className="shrink-0">
                          {s.status === "resumed" ? "Retomada" : "Em espera"}
                        </Badge>
                      </button>
                      {isExpanded && (
                        <div className="px-3 pb-3 pt-0 space-y-1 bg-slate-50 border-t border-slate-100">
                          {s.items.map((it) => (
                            <div key={it.id} className="flex justify-between text-[11px] text-slate-600 pt-2">
                              <span>{it.name} × {it.quantity}</span>
                              <span className="font-mono">R$ {(Number(it.unit_price) * it.quantity).toFixed(2)}</span>
                            </div>
                          ))}
                          {s.resumed_by && (
                            <p className="text-[10px] text-amber-600 pt-1">Também retomada por {s.resumed_by}</p>
                          )}
                          <div className="flex gap-2 pt-2">
                            <Button size="lg" className="flex-1" onClick={() => handleResume(s)} disabled={isBusy} loading={isBusy}>Retomar</Button>
                            <Button size="lg" variant="danger" onClick={() => setCancelTarget(s)} disabled={isBusy}>Cancelar</Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>

    <Modal
      open={!!cancelTarget}
      onClose={() => { if (busyId === null) setCancelTarget(null); }}
      title="Cancelar venda em espera"
      subtitle={cancelTarget ? `#${String(cancelTarget.number).padStart(4, "0")} · ${cancelTarget.customer_name || "Sem cliente"}` : undefined}
      size="sm"
      zIndex={520}
      footer={
        <>
          <Button variant="secondary" onClick={() => setCancelTarget(null)} disabled={busyId !== null}>Voltar</Button>
          <Button variant="danger" onClick={confirmCancel} loading={busyId !== null}>Cancelar Venda</Button>
        </>
      }
    >
      <p className="text-xs text-slate-600 leading-relaxed">
        O estoque reservado para esta venda em espera será devolvido ao catálogo. Essa ação não pode ser desfeita.
      </p>
    </Modal>
    </>
  );
}
