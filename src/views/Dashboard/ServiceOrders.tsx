import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Plus, Trash2, Download, X, HelpCircle, Wrench } from "lucide-react";
import {
  Button, IconButton, Badge, SectionTitle, ContentCard, EmptyState, ConfirmModal,
  FilterLine, FilterLineSection, FilterLineItem, FilterLineSearch,
  GridTable, usePagination,
} from "../../components/ui";
import type { Column } from "../../components/ui";
import Combobox, { type ComboboxOption } from "../../components/ui/Combobox";
import { onRealtime } from "../../lib/realtime";
import ServiceOrdersPageTour, { type ServiceOrdersPageTourHandle } from "../../components/onboarding/ServiceOrdersPageTour";
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

type BadgeColor = "default" | "primary" | "success" | "warning" | "danger" | "info" | "purple" | "orange" | "teal";

const STATUS_BADGE: Record<SOStatus, BadgeColor> = {
  rascunho: "default",
  orcamento_enviado: "info",
  aguardando_aprovacao: "warning",
  aprovado: "teal",
  aguardando_arte: "purple",
  arte_finalizada: "purple",
  em_producao: "purple",
  finalizado: "teal",
  nota_emitida: "primary",
  entregue: "success",
  cancelada: "danger",
};

export default function ServiceOrders() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState(() => searchParams.get("search") ?? "");
  const [statusFilter, setStatusFilter] = useState<"all" | SOStatus>("all");

  const [deleteTarget, setDeleteTarget] = useState<ServiceOrder | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [zipping, setZipping] = useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);

  const serviceOrdersPageTourRef = useRef<ServiceOrdersPageTourHandle>(null);

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
        const reasons = data.blocked.map((b: { reason: string }) => `• ${b.reason}`).join("\n");
        alert(`${data.deleted} excluída(s). ${data.blocked.length} não puderam ser excluídas:\n${reasons}`);
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

  const pg = usePagination(filtered, 15);

  const selectedKeys = new Set(Array.from(selectedIds).map(String));

  const columns: Column<ServiceOrder>[] = [
    { header: "Número", render: (o) => <span className="font-mono text-xs font-medium text-slate-700">#{String(o.number).padStart(4, "0")}</span> },
    { header: "Cliente", render: (o) => <span className="text-xs font-medium text-slate-800">{o.customer_name || "—"}</span> },
    {
      header: "Equipamento",
      render: (o) => (
        <span className="text-xs text-slate-500">
          {o.has_equipment
            ? `${o.equipment_category}${o.equipment_brand ? ` — ${o.equipment_brand}` : ""}${o.equipment_model ? ` ${o.equipment_model}` : ""}`
            : <span className="italic text-slate-400">Sem equipamento</span>}
        </span>
      ),
    },
    { header: "Status", render: (o) => <Badge color={STATUS_BADGE[o.status]} size="sm" icon={STATUS_META[o.status].icon}>{STATUS_META[o.status].label}</Badge> },
    { header: "Responsável", render: (o) => <span className="text-xs text-slate-500">{o.technician_name || (o.seller_id ? sellers.find((s) => s.id === o.seller_id)?.name : "—") || "—"}</span> },
    { header: "Valor", className: "text-right", headerClassName: "text-right", render: (o) => <span className="text-xs font-semibold tabular-nums whitespace-nowrap text-slate-800">{fmt(o.total_amount)}</span> },
    { header: "Data", render: (o) => <span className="text-xs whitespace-nowrap text-slate-500">{new Date(o.created_at).toLocaleDateString("pt-BR")}</span> },
    {
      header: "Ações",
      className: "text-right",
      headerClassName: "text-right",
      render: (o) => !o.invoiced_order_id ? (
        <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
          <IconButton size="xs" variant="ghost" aria-label="Excluir ordem de serviço" title="Excluir ordem de serviço" onClick={() => setDeleteTarget(o)}>
            <Trash2 size={13} />
          </IconButton>
        </div>
      ) : null,
    },
  ];

  return (
    <div data-tour="service-orders-page" className="space-y-4">
      <SectionTitle
        title="Ordens de Serviço"
        description="Receba equipamentos para conserto, controle o checklist e fature"
        icon={Wrench}
        action={
          <>
            <Button
              size="sm"
              data-tour="service-orders-new-btn"
              iconLeft={<Plus size={14} />}
              onClick={() => navigate("/admin/ordens-servico/novo")}
            >
              Nova Ordem de Serviço
            </Button>
            <Button
              size="sm"
              variant="outline"
              iconLeft={<HelpCircle size={14} />}
              onClick={() => serviceOrdersPageTourRef.current?.start()}
              title="Tour guiado desta página"
            >
              <span className="sr-only sm:not-sr-only">Ajuda</span>
            </Button>
          </>
        }
      />

      <ServiceOrdersPageTour ref={serviceOrdersPageTourRef} />

      <FilterLine>
        <FilterLineSection grow>
          <FilterLineItem grow minWidth={220}>
            <FilterLineSearch
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Buscar por número, cliente, marca ou modelo..."
              aria-label="Buscar ordens de serviço"
            />
          </FilterLineItem>
          <FilterLineItem minWidth={220}>
            <Combobox
              options={statusOptions}
              value={statusFilter}
              onChange={(v) => setStatusFilter(v as "all" | SOStatus)}
            />
          </FilterLineItem>
        </FilterLineSection>
      </FilterLine>

      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
          <span className="text-xs font-medium text-blue-700">{selectedIds.size} selecionada(s)</span>
          <div className="flex-1" />
          <Button size="sm" variant="outline" loading={zipping} iconLeft={<Download size={13} />} onClick={handleDownloadZip}>
            Baixar PDFs (.zip)
          </Button>
          <Button size="sm" variant="outline" iconLeft={<Trash2 size={13} />} onClick={() => setShowBulkDeleteModal(true)}>
            Excluir selecionadas
          </Button>
          <IconButton size="sm" variant="ghost" aria-label="Limpar seleção" title="Limpar seleção" onClick={() => setSelectedIds(new Set())}>
            <X size={14} />
          </IconButton>
        </div>
      )}

      <ContentCard padding="none" data-tour="service-orders-table">
        <GridTable
          noDesktopCard
          data={pg.paginatedData}
          keyExtractor={(o) => o.id}
          isLoading={loading}
          columns={columns}
          selectedIds={selectedKeys}
          onToggleSelect={(id) => toggleSelected(Number(id))}
          onToggleSelectAll={toggleSelectAllVisible}
          onRowClick={(o) => navigate(`/admin/ordens-servico/${o.id}`)}
          emptyMessage={
            <EmptyState
              icon={Wrench}
              title="Nenhuma ordem de serviço encontrada"
              description={searchTerm || statusFilter !== "all" ? "Ajuste a busca ou o filtro." : "Crie a primeira ordem de serviço para começar."}
            />
          }
          pagination={{ total: filtered.length, page: pg.page, pageSize: pg.pageSize, onPageChange: pg.setPage, onPageSizeChange: pg.setPageSize }}
        />
      </ContentCard>

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        variant="danger"
        title="Excluir ordem de serviço?"
        confirmLabel="Excluir"
        cancelLabel="Voltar"
        message={deleteTarget && (
          <>Tem certeza que deseja excluir a OS #{String(deleteTarget.number).padStart(4, "0")}
          {deleteTarget.customer_name ? ` de ${deleteTarget.customer_name}` : ""}?
          {deleteTarget.parts.length > 0 ? " Peças já debitadas do estoque serão devolvidas." : ""} Essa ação não pode ser desfeita.</>
        )}
      />

      <ConfirmModal
        isOpen={showBulkDeleteModal}
        onClose={() => setShowBulkDeleteModal(false)}
        onConfirm={handleBulkDelete}
        loading={bulkDeleting}
        variant="danger"
        title="Excluir ordens de serviço?"
        confirmLabel={`Excluir ${selectedIds.size}`}
        cancelLabel="Voltar"
        message={`Tem certeza que deseja excluir ${selectedIds.size} ordem(ns) de serviço? Peças já debitadas do estoque serão devolvidas. Ordens já faturadas ou com NFS-e autorizada não serão excluídas — cancele-as antes. Essa ação não pode ser desfeita.`}
      />
    </div>
  );
}
