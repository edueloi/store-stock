import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, Trash2, Loader2, Download, X } from "lucide-react";
import { cn } from "../../lib/utils";
import PageHeader from "../../components/layout/PageHeader";
import Modal from "../../components/ui/Modal";
import Combobox, { type ComboboxOption } from "../../components/ui/Combobox";
import { onRealtime } from "../../lib/realtime";
import {
  ServiceOrder,
  Seller,
  Tenant,
  fmt,
  authHeader,
  authHeaderNoJson,
  STATUS_META,
  getStatusOrderForTenant,
  buildServiceOrderIntakeHtml,
  SOStatus,
} from "./serviceOrders.shared";

export default function ServiceOrders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | SOStatus>("all");

  const [deleteTarget, setDeleteTarget] = useState<ServiceOrder | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [zipping, setZipping] = useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);

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
  useEffect(() => onRealtime("service-order:changed", () => { fetchAll(); }), [fetchAll]);

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

  const toggleSelected = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAllVisible = () => {
    setSelectedIds((prev) => {
      const allSelected = filtered.length > 0 && filtered.every((o) => prev.has(o.id));
      if (allSelected) return new Set();
      return new Set(filtered.map((o) => o.id));
    });
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setBulkDeleting(true);
    try {
      const res = await fetch(`/api/service-orders/bulk`, {
        method: "DELETE",
        headers: authHeader(),
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || "Falha ao excluir ordens de serviço");
        return;
      }
      if (Array.isArray(data.blocked) && data.blocked.length > 0) {
        alert(`${data.deleted} excluída(s). ${data.blocked.length} não puderam ser excluídas por já estarem faturadas.`);
      }
      setSelectedIds(new Set());
      setShowBulkDeleteModal(false);
      await fetchAll();
    } finally {
      setBulkDeleting(false);
    }
  };

  // Gera um PDF por OS selecionada (mesmo modelo do botão individual) e empacota
  // tudo num único .zip — pedido pra não ter que baixar/imprimir uma por vez.
  const handleDownloadZip = async () => {
    if (selectedIds.size === 0) return;
    setZipping(true);
    try {
      const [{ default: JSZip }, { htmlToPdfBase64 }] = await Promise.all([
        import("jszip"),
        import("../../lib/pdf"),
      ]);
      const zip = new JSZip();
      const selected = orders.filter((o) => selectedIds.has(o.id));
      for (const so of selected) {
        const html = buildServiceOrderIntakeHtml(so, tenant);
        const base64 = await htmlToPdfBase64(html);
        zip.file(`ordem-servico-${String(so.number).padStart(6, "0")}.pdf`, base64, { base64: true });
      }
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ordens-de-servico-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert("Falha ao gerar o arquivo .zip com os PDFs.");
    } finally {
      setZipping(false);
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

  // Loja sem o módulo Gráfica não vê "Aguardando arte"/"Arte finalizada" no filtro
  // (ver Tenant.grafica_enabled).
  const statusOrderForTenant = getStatusOrderForTenant(tenant?.grafica_enabled);

  const statusCounts = statusOrderForTenant.reduce((acc, s) => {
    acc[s] = orders.filter((o) => o.status === s).length;
    return acc;
  }, {} as Record<SOStatus, number>);

  const statusOptions: ComboboxOption[] = [
    { value: "all", label: `Todas as etapas (${orders.length})` },
    ...statusOrderForTenant.map((s) => ({
      value: s,
      label: `${STATUS_META[s].label} (${statusCounts[s]})`,
      icon: STATUS_META[s].icon,
    })),
  ];

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

      {/* Status filter */}
      <Combobox
        options={statusOptions}
        value={statusFilter}
        onChange={(v) => setStatusFilter(v as "all" | SOStatus)}
        className="max-w-xs"
      />

      {/* Bulk actions */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5">
          <span className="text-[11px] font-bold text-blue-700">{selectedIds.size} selecionada(s)</span>
          <div className="flex-1" />
          <button
            onClick={handleDownloadZip}
            disabled={zipping}
            className="h-8 px-3 rounded-lg bg-white border border-blue-200 text-blue-700 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 hover:bg-blue-100 transition-all disabled:opacity-50"
          >
            {zipping ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
            Baixar PDFs (.zip)
          </button>
          <button
            onClick={() => setShowBulkDeleteModal(true)}
            className="h-8 px-3 rounded-lg bg-white border border-red-200 text-red-600 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 hover:bg-red-50 transition-all"
          >
            <Trash2 size={13} /> Excluir selecionadas
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="w-8 h-8 rounded-lg text-blue-400 hover:text-blue-700 hover:bg-blue-100 flex items-center justify-center transition-colors"
            title="Limpar seleção"
          >
            <X size={14} />
          </button>
        </div>
      )}

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
                  <th className="px-4 py-3 w-8">
                    <input
                      type="checkbox"
                      checked={filtered.length > 0 && filtered.every((o) => selectedIds.has(o.id))}
                      onChange={toggleSelectAllVisible}
                      className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-400"
                    />
                  </th>
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
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(o.id)}
                        onChange={() => toggleSelected(o.id)}
                        className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-400"
                      />
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-slate-700">#{String(o.number).padStart(4, "0")}</td>
                    <td className="px-4 py-3 font-semibold text-slate-700">{o.customer_name || "—"}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {o.has_equipment
                        ? `${o.equipment_category}${o.equipment_brand ? ` — ${o.equipment_brand}` : ""}${o.equipment_model ? ` ${o.equipment_model}` : ""}`
                        : <span className="italic text-slate-400">Sem equipamento</span>}
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

      <Modal
        open={showBulkDeleteModal}
        onClose={() => setShowBulkDeleteModal(false)}
        title="Excluir Ordens de Serviço"
        subtitle="Essa ação não pode ser desfeita"
        footer={
          <>
            <button onClick={() => setShowBulkDeleteModal(false)} className="flex-1 h-11 rounded-xl border border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 transition-colors">
              Voltar
            </button>
            <button onClick={handleBulkDelete} disabled={bulkDeleting}
              className="flex-1 h-11 bg-red-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
              {bulkDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              Excluir {selectedIds.size}
            </button>
          </>
        }
      >
        <p className="text-[12px] text-slate-600">
          Tem certeza que deseja excluir {selectedIds.size} ordem(ns) de serviço? Peças já debitadas do estoque serão devolvidas.
          Ordens já faturadas não serão excluídas — cancele-as antes.
        </p>
      </Modal>
    </div>
  );
}
