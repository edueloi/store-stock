import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, Trash2, Loader2 } from "lucide-react";
import { cn } from "../../lib/utils";
import PageHeader from "../../components/layout/PageHeader";
import Modal from "../../components/ui/Modal";
import {
  ServiceOrder,
  Seller,
  Tenant,
  fmt,
  authHeader,
  authHeaderNoJson,
  STATUS_META,
  STATUS_ORDER,
  SOStatus,
} from "./serviceOrders.shared";

export default function ServiceOrders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | SOStatus>("all");

  const [deleteTarget, setDeleteTarget] = useState<ServiceOrder | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchAll = useCallback(async () => {
    const h = authHeaderNoJson();
    try {
      const [oRes, sRes, tRes] = await Promise.all([
        fetch("/api/service-orders", { headers: h }),
        fetch("/api/sellers", { headers: h }),
        fetch("/api/tenant", { headers: h }),
      ]);
      const [oData, sData, tData] = await Promise.all([oRes.json(), sRes.json(), tRes.json()]);
      setOrders(Array.isArray(oData) ? oData : []);
      setSellers(Array.isArray(sData) ? sData.filter((s: Seller) => s.is_active !== false) : []);
      setTenant(tData ?? null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/service-orders/${deleteTarget.id}`, { method: "DELETE", headers: authHeader() });
      if (res.ok) {
        setDeleteTarget(null);
        await fetchAll();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Falha ao excluir ordem de serviço");
      }
    } finally {
      setDeleting(false);
    }
  };

  const filtered = orders.filter((o) => {
    const matchStatus = statusFilter === "all" || o.status === statusFilter;
    const matchSearch =
      !searchTerm ||
      o.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(o.number).includes(searchTerm) ||
      (o.equipment_brand ?? "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (o.equipment_model ?? "").toLowerCase().includes(searchTerm.toLowerCase());
    return matchStatus && matchSearch;
  });

  const statusCounts = STATUS_ORDER.reduce((acc, s) => {
    acc[s] = orders.filter((o) => o.status === s).length;
    return acc;
  }, {} as Record<SOStatus, number>);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Ordens de Serviço"
        subtitle="Receba equipamentos para conserto, controle o checklist e fature"
        action={
          <button
            onClick={() => navigate("/admin/ordens-servico/novo")}
            className="h-9 px-4 bg-blue-600 text-white rounded-lg flex items-center gap-2 text-[12px] font-bold hover:bg-blue-700 transition-all shadow-md shadow-blue-500/20"
          >
            <Plus size={15} /> Nova Ordem de Serviço
          </button>
        }
      />

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
        <input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar por número, cliente, marca ou modelo..."
          className="w-full pl-9 pr-4 h-10 bg-white rounded-xl text-[12px] font-medium border border-slate-200 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
        />
      </div>

      {/* Status tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        <button
          onClick={() => setStatusFilter("all")}
          className={cn(
            "shrink-0 h-8 px-3 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all",
            statusFilter === "all" ? "bg-slate-900 border-slate-900 text-white" : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
          )}
        >
          Todas ({orders.length})
        </button>
        {STATUS_ORDER.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={cn(
              "shrink-0 h-8 px-3 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all flex items-center gap-1.5",
              statusFilter === s ? "bg-slate-900 border-slate-900 text-white" : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
            )}
          >
            {STATUS_META[s].icon} {STATUS_META[s].label} ({statusCounts[s]})
          </button>
        ))}
      </div>

      {/* List */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-slate-400 text-[12px] font-bold">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-slate-400 text-[12px] font-bold">Nenhuma ordem de serviço encontrada</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-slate-100 text-left text-[9px] font-black uppercase tracking-widest text-slate-400">
                  <th className="px-4 py-3">Número</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Equipamento</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Responsável</th>
                  <th className="px-4 py-3 text-right">Valor</th>
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((o) => (
                  <tr
                    key={o.id}
                    onClick={() => navigate(`/admin/ordens-servico/${o.id}`)}
                    className="border-b border-slate-50 last:border-0 hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 font-mono font-bold text-slate-700">#{String(o.number).padStart(4, "0")}</td>
                    <td className="px-4 py-3 font-semibold text-slate-700">{o.customer_name || "—"}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {o.equipment_category}{o.equipment_brand ? ` — ${o.equipment_brand}` : ""}{o.equipment_model ? ` ${o.equipment_model}` : ""}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider", STATUS_META[o.status].color)}>
                        {STATUS_META[o.status].icon} {STATUS_META[o.status].label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{o.technician_name || (o.seller_id ? sellers.find((s) => s.id === o.seller_id)?.name : "—") || "—"}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-slate-700">{fmt(o.total_amount)}</td>
                    <td className="px-4 py-3 text-slate-400">{new Date(o.created_at).toLocaleDateString("pt-BR")}</td>
                    <td className="px-4 py-3 text-right">
                      {!o.invoiced_order_id && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeleteTarget(o); }}
                          className="w-7 h-7 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-colors ml-auto"
                          title="Excluir ordem de serviço"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Excluir Ordem de Serviço"
        subtitle="Essa ação não pode ser desfeita"
        footer={
          <>
            <button onClick={() => setDeleteTarget(null)} className="flex-1 h-11 rounded-xl border border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 transition-colors">
              Voltar
            </button>
            <button onClick={handleDelete} disabled={deleting}
              className="flex-1 h-11 bg-red-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
              {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              Excluir
            </button>
          </>
        }
      >
        <p className="text-[12px] text-slate-600">
          {deleteTarget && (
            <>Tem certeza que deseja excluir a OS #{String(deleteTarget.number).padStart(4, "0")}
            {deleteTarget.customer_name ? ` de ${deleteTarget.customer_name}` : ""}?
            {deleteTarget.parts.length > 0 ? " Peças já debitadas do estoque serão devolvidas." : ""}</>
          )}
        </p>
      </Modal>
    </div>
  );
}
