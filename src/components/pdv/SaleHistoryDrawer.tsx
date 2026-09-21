import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Loader2, Printer, Search, X } from "lucide-react";

import { buildOrderReceiptText, printThermalText, type OrderReceiptTenant } from "../../lib/thermalReceipt";
import { useToast } from "../ui/Toast";

interface SaleHistoryItem {
  id: number;
  created_at: string;
  customer_name?: string | null;
  total_amount: number | string;
  payment_method?: string | null;
  items: { product_name: string; quantity: number }[];
}

interface SaleHistoryDrawerProps {
  open: boolean;
  onClose: () => void;
  token: string;
  tenant: OrderReceiptTenant | null | undefined;
  isOnline?: boolean;
}

export default function SaleHistoryDrawer({ open, onClose, token, tenant, isOnline = true }: SaleHistoryDrawerProps) {
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SaleHistoryItem[]>([]);
  const [printingId, setPrintingId] = useState<number | null>(null);
  const toast = useToast();

  useEffect(() => {
    if (open) { setSearch(""); setResults([]); }
  }, [open]);

  useEffect(() => {
    const q = search.trim();
    if (!q) { setResults([]); return; }
    const handle = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/orders/search?q=${encodeURIComponent(q)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setResults(res.ok ? await res.json() : []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => clearTimeout(handle);
  }, [search, token]);

  async function handleReprint(orderId: number) {
    setPrintingId(orderId);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      const order = await res.json();
      await printThermalText(buildOrderReceiptText(tenant, order), "Comprovante");
    } catch {
      toast.error("Não foi possível reimprimir esta venda.");
    } finally {
      setPrintingId(null);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[500]" />
          <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 26, stiffness: 200 }}
            className="fixed inset-y-0 right-0 w-full max-w-sm bg-white z-[510] shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 shrink-0">
              <div>
                <h2 className="font-black text-slate-900 text-[15px]">Histórico de Vendas</h2>
                <p className="text-[11px] text-slate-500">Busque uma venda e reimprima o cupom</p>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500"><X size={18} /></button>
            </div>

            {!isOnline ? (
              <div className="flex-1 flex items-center justify-center p-6">
                <p className="text-[11px] font-bold text-amber-600 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-center">
                  Sem conexão — a busca de vendas antigas exige internet.
                </p>
              </div>
            ) : (
              <>
                <div className="p-4 border-b border-slate-100 shrink-0">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                    <input value={search} onChange={(e) => setSearch(e.target.value)}
                      placeholder="Nº do pedido, cliente ou produto..." autoFocus
                      className="w-full pl-9 pr-3 h-10 rounded-xl border border-slate-200 text-[12px] font-medium focus:outline-none focus:border-blue-400" />
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {loading ? (
                    <div className="flex items-center justify-center h-32"><Loader2 size={20} className="animate-spin text-slate-300" /></div>
                  ) : !search.trim() ? (
                    <div className="text-center py-10 text-[11px] font-bold text-slate-400">Digite para buscar uma venda</div>
                  ) : results.length === 0 ? (
                    <div className="text-center py-10 text-[11px] font-bold text-slate-400">Nenhuma venda encontrada</div>
                  ) : (
                    results.map((o) => {
                      const isPrinting = printingId === o.id;
                      return (
                        <div key={o.id} className="rounded-xl border border-slate-200 px-3 py-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-[12px] font-bold text-slate-700 truncate">
                                #{String(o.id).padStart(6, "0")} · {o.customer_name || "Sem cliente"}
                              </p>
                              <p className="text-[10px] text-slate-400">
                                {new Date(o.created_at).toLocaleString("pt-BR")} · R$ {Number(o.total_amount).toFixed(2)}
                              </p>
                              <p className="text-[10px] text-slate-400 truncate mt-0.5">
                                {o.items.map((it) => `${it.product_name} ×${it.quantity}`).join(", ")}
                              </p>
                            </div>
                            <button onClick={() => handleReprint(o.id)} disabled={isPrinting}
                              title="Reimprimir cupom"
                              className="h-8 px-2.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-all flex items-center gap-1.5 shrink-0">
                              {isPrinting ? <Loader2 size={13} className="animate-spin" /> : <Printer size={13} />}
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
