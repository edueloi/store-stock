import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ChevronLeft,
  Plus,
  Trash2,
  X,
  ChevronDown,
  UserPlus,
  PlusCircle,
  Camera,
  ImagePlus,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  CalendarClock,
  ShieldCheck,
  ArrowRight,
  Ban,
  Banknote,
  CreditCard,
  QrCode,
  FileDown,
  Receipt,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../../lib/utils";
import PageHeader from "../../components/layout/PageHeader";
import Modal from "../../components/ui/Modal";
import Combobox from "../../components/ui/Combobox";
import { computeMeasuredPrice } from "../../utils/measurePricing";
import {
  ServiceOrder,
  ChecklistItem,
  Product,
  Customer,
  Seller,
  Technician,
  Tenant,
  InvoicePayment,
  PayMethod,
  PM_LABEL,
  CARD_BRANDS,
  fmt,
  maskPhone,
  maskDoc,
  authHeader,
  authHeaderNoJson,
  STATUS_META,
  STATUS_ORDER,
  downloadServiceOrderPdf,
  newPayment,
  buildPmString,
  NfseInvoice,
} from "./serviceOrders.shared";

export default function ServiceOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const orderId = Number(id);

  const [selected, setSelected] = useState<ServiceOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [tenant, setTenant] = useState<Tenant | null>(null);

  const [savingField, setSavingField] = useState<string | null>(null);
  const [savedPulse, setSavedPulse] = useState(false);

  const [customerName, setCustomerName] = useState("");
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [customerPhone, setCustomerPhone] = useState("");
  const [equipmentCategory, setEquipmentCategory] = useState("");
  const [equipmentType, setEquipmentType] = useState("");
  const [equipmentBrand, setEquipmentBrand] = useState("");
  const [equipmentModel, setEquipmentModel] = useState("");
  const [equipmentSerial, setEquipmentSerial] = useState("");
  const [equipmentAccessories, setEquipmentAccessories] = useState("");
  const [reportedIssue, setReportedIssue] = useState("");
  const [responsibleMode, setResponsibleMode] = useState<"seller" | "technician" | "external">("seller");
  const [sellerId, setSellerId] = useState<number | null>(null);
  const [technicianId, setTechnicianId] = useState<number | null>(null);
  const [technicianName, setTechnicianName] = useState("");
  const [priority, setPriority] = useState<"normal" | "urgente">("normal");
  const [promisedAt, setPromisedAt] = useState("");
  const [serviceValue, setServiceValue] = useState("");
  const [nfseInvoice, setNfseInvoice] = useState<NfseInvoice | null>(null);
  const [nfseCodigoServico, setNfseCodigoServico] = useState("70602");
  const [nfseDescricao, setNfseDescricao] = useState("");
  const [nfseEmitting, setNfseEmitting] = useState(false);
  const [nfseError, setNfseError] = useState<string | null>(null);
  const [warrantyDays, setWarrantyDays] = useState("");
  const [warrantyTerms, setWarrantyTerms] = useState("");
  const [observations, setObservations] = useState("");

  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [ncName, setNcName] = useState("");
  const [ncPhone, setNcPhone] = useState("");
  const [ncDoc, setNcDoc] = useState("");
  const [ncEmail, setNcEmail] = useState("");
  const [savingNC, setSavingNC] = useState(false);

  const [showNewCategory, setShowNewCategory] = useState(false);
  const [ncatName, setNcatName] = useState("");
  const [ncatItems, setNcatItems] = useState<string[]>([""]);
  const [savingCategory, setSavingCategory] = useState(false);

  const [partSearch, setPartSearch] = useState("");
  const [partQty, setPartQty] = useState(1);
  const [partNoCharge, setPartNoCharge] = useState(false);
  const [measureProduct, setMeasureProduct] = useState<Product | null>(null);
  const [measureHeight, setMeasureHeight] = useState("");
  const [measureWidth, setMeasureWidth] = useState("");
  const [addingPart, setAddingPart] = useState(false);
  const [showFreePartForm, setShowFreePartForm] = useState(false);
  const [freePartName, setFreePartName] = useState("");
  const [freePartUnit, setFreePartUnit] = useState("UN");
  const [freePartPrice, setFreePartPrice] = useState("");

  const [photoUploading, setPhotoUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoicePayments, setInvoicePayments] = useState<InvoicePayment[]>([newPayment()]);
  const [invoiceSellerId, setInvoiceSellerId] = useState<number | "">("");
  const [invoicing, setInvoicing] = useState(false);

  const [generatingPdf, setGeneratingPdf] = useState(false);

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);

  const [showDiscardModal, setShowDiscardModal] = useState(false);
  const [discarding, setDiscarding] = useState(false);

  // ── Load ────────────────────────────────────────────────────────────────
  // Sincroniza os campos do formulário a partir do servidor — só usado na carga
  // inicial. Em recarregamentos após autosave, os campos já refletem a digitação
  // do usuário e não devem ser sobrescritos (ex: alternar Vendedor/Técnico externo
  // não pode "voltar" ao ler technician_name ainda vazio logo após a troca).
  const applyFormFields = useCallback((so: ServiceOrder) => {
    setCustomerName(so.customer_name);
    setCustomerId(so.customer_id);
    setCustomerPhone(so.customer_phone ?? "");
    setEquipmentCategory(so.equipment_category);
    setEquipmentType(so.equipment_type ?? "");
    setEquipmentBrand(so.equipment_brand ?? "");
    setEquipmentModel(so.equipment_model ?? "");
    setEquipmentSerial(so.equipment_serial ?? "");
    setEquipmentAccessories(so.equipment_accessories ?? "");
    setReportedIssue(so.reported_issue ?? "");
    setResponsibleMode(so.technician_name ? "external" : so.technician_id ? "technician" : "seller");
    setSellerId(so.seller_id);
    setTechnicianId(so.technician_id);
    setTechnicianName(so.technician_name ?? "");
    setPriority(so.priority);
    setPromisedAt(so.promised_at ? so.promised_at.slice(0, 10) : "");
    setServiceValue(so.service_value ? String(so.service_value) : "");
    setWarrantyDays(so.warranty_days ? String(so.warranty_days) : "");
    setWarrantyTerms(so.warranty_terms ?? "");
    setObservations(so.observations ?? "");
  }, []);

  const fetchOrder = useCallback(async (silent?: boolean) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`/api/service-orders/${orderId}`, { headers: authHeaderNoJson() });
      if (!res.ok) {
        setNotFound(true);
        return;
      }
      const so: ServiceOrder = await res.json();
      setSelected(so);
      if (!silent) applyFormFields(so);

      const nfseRes = await fetch(`/api/nfse/${orderId}`, { headers: authHeaderNoJson() });
      setNfseInvoice(nfseRes.ok ? await nfseRes.json() : null);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [orderId, applyFormFields]);

  useEffect(() => {
    (async () => {
      const h = authHeaderNoJson();
      const [pRes, cRes, sRes, tcRes, tRes] = await Promise.all([
        fetch("/api/products", { headers: h }),
        fetch("/api/customers", { headers: h }),
        fetch("/api/sellers", { headers: h }),
        fetch("/api/technicians", { headers: h }),
        fetch("/api/tenant", { headers: h }),
      ]);
      const [pData, cData, sData, tcData, tData] = await Promise.all([pRes.json(), cRes.json(), sRes.json(), tcRes.json(), tRes.json()]);
      setProducts(Array.isArray(pData) ? pData.filter((p: Product) => p.is_active !== false) : []);
      setCustomers(Array.isArray(cData) ? cData : []);
      setSellers(Array.isArray(sData) ? sData.filter((s: Seller) => s.is_active !== false) : []);
      setTechnicians(Array.isArray(tcData) ? tcData.filter((t: Technician) => t.is_active !== false) : []);
      setTenant(tData ?? null);
    })();
    fetchOrder();
  }, [fetchOrder]);

  const checklistTemplates = tenant?.policies?.service_order_checklists ?? {};
  const categoryOptions = Object.keys(checklistTemplates).map((cat) => ({ value: cat, label: cat }));
  const isDraft = selected?.status === "rascunho";

  // ── Autosave ────────────────────────────────────────────────────────────
  const autosaveField = useCallback(async (patch: Record<string, unknown>, fieldKey: string) => {
    if (!selected) return;
    setSavingField(fieldKey);
    try {
      const res = await fetch(`/api/service-orders/${selected.id}`, {
        method: "PUT",
        headers: authHeader(),
        body: JSON.stringify(patch),
      });
      if (res.ok) {
        await fetchOrder(true);
        setSavedPulse(true);
        setTimeout(() => setSavedPulse(false), 1500);
      }
    } finally {
      setSavingField(null);
    }
  }, [selected, fetchOrder]);

  // ── Category (checklist template) quick-create ─────────────────────────
  const handleCreateCategory = async () => {
    const name = ncatName.trim();
    if (!name || checklistTemplates[name]) return;
    setSavingCategory(true);
    try {
      const items = ncatItems.map((l) => l.trim()).filter(Boolean).map((label) => ({ label }));
      const nextChecklists = { ...checklistTemplates, [name]: items };
      const nextPolicies = { ...(tenant?.policies ?? {}), service_order_checklists: nextChecklists };
      const res = await fetch("/api/tenant", {
        method: "PUT",
        headers: authHeader(),
        body: JSON.stringify({ policies: nextPolicies }),
      });
      if (res.ok) {
        setTenant((t) => (t ? { ...t, policies: nextPolicies } : t));
        setEquipmentCategory(name);
        await autosaveField({ equipment_category: name }, "equipment_category");
        setShowNewCategory(false);
        setNcatName("");
        setNcatItems([""]);
      }
    } finally {
      setSavingCategory(false);
    }
  };

  // ── Checklist ───────────────────────────────────────────────────────────
  const updateChecklistItem = (itemId: number, patch: Partial<ChecklistItem>) => {
    if (!selected) return;
    setSelected({
      ...selected,
      checklist_items: selected.checklist_items.map((i) => (i.id === itemId ? { ...i, ...patch } : i)),
    });
  };

  const saveChecklist = async () => {
    if (!selected) return;
    await fetch(`/api/service-orders/${selected.id}/checklist`, {
      method: "PUT",
      headers: authHeader(),
      body: JSON.stringify({
        items: selected.checklist_items.map((i) => ({ id: i.id, answer: i.answer, observation: i.observation })),
      }),
    });
    await fetchOrder(true);
  };

  // ── Status ──────────────────────────────────────────────────────────────
  const changeStatus = async (status: string, opts?: { cancel_reason?: string }) => {
    if (!selected) return;
    const res = await fetch(`/api/service-orders/${selected.id}/status`, {
      method: "PUT",
      headers: authHeader(),
      body: JSON.stringify({ status, cancel_reason: opts?.cancel_reason }),
    });
    if (res.ok) {
      await fetchOrder(true);
    } else {
      const err = await res.json().catch(() => ({}));
      alert(err.error || "Falha ao atualizar status");
    }
  };

  const handleConfirmCancel = async () => {
    setCancelling(true);
    try {
      await changeStatus("cancelada", { cancel_reason: cancelReason || undefined });
      setShowCancelModal(false);
      setCancelReason("");
    } finally {
      setCancelling(false);
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    setDiscarding(true);
    try {
      const res = await fetch(`/api/service-orders/${selected.id}`, { method: "DELETE", headers: authHeaderNoJson() });
      if (res.ok) {
        navigate("/admin/ordens-servico");
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Falha ao excluir ordem de serviço");
        setShowDiscardModal(false);
      }
    } finally {
      setDiscarding(false);
    }
  };

  const canStartService = !!customerName && !!equipmentCategory && !!reportedIssue;

  // ── Parts ───────────────────────────────────────────────────────────────
  const handleAddPart = async (product: Product) => {
    if (!selected) return;
    if (product.sale_unit && product.sale_unit !== "unidade") {
      setMeasureProduct(product);
      setMeasureHeight("");
      setMeasureWidth("");
      setPartSearch("");
      return;
    }
    setAddingPart(true);
    try {
      const res = await fetch(`/api/service-orders/${selected.id}/parts`, {
        method: "POST",
        headers: authHeader(),
        body: JSON.stringify({ product_id: product.id, quantity: partQty, no_charge: partNoCharge }),
      });
      if (res.ok) {
        setPartSearch("");
        setPartQty(1);
        setPartNoCharge(false);
        await fetchOrder(true);
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Falha ao adicionar peça");
      }
    } finally {
      setAddingPart(false);
    }
  };

  const handleAddFreePart = async () => {
    if (!selected || !freePartName.trim()) return;
    setAddingPart(true);
    try {
      const res = await fetch(`/api/service-orders/${selected.id}/parts`, {
        method: "POST",
        headers: authHeader(),
        body: JSON.stringify({
          name: freePartName.trim(),
          unit: freePartUnit.trim() || "UN",
          quantity: partQty,
          unit_price: Number(freePartPrice) || 0,
          no_charge: partNoCharge,
        }),
      });
      if (res.ok) {
        setFreePartName("");
        setFreePartUnit("UN");
        setFreePartPrice("");
        setPartQty(1);
        setPartNoCharge(false);
        setShowFreePartForm(false);
        await fetchOrder(true);
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Falha ao adicionar item");
      }
    } finally {
      setAddingPart(false);
    }
  };

  const measurePreview = measureProduct
    ? computeMeasuredPrice(
        (measureProduct.sale_unit as "m2" | "linear") ?? "m2",
        Number(measureProduct.price_per_measure) || 0,
        measureProduct.min_billable_quantity,
        Number(measureHeight) || 0,
        Number(measureWidth) || 0,
      )
    : null;

  const handleAddMeasuredPart = async () => {
    if (!selected || !measureProduct) return;
    setAddingPart(true);
    try {
      const res = await fetch(`/api/service-orders/${selected.id}/parts`, {
        method: "POST",
        headers: authHeader(),
        body: JSON.stringify({
          product_id: measureProduct.id,
          height: Number(measureHeight) || 0,
          width: Number(measureWidth) || 0,
        }),
      });
      if (res.ok) {
        setMeasureProduct(null);
        setMeasureHeight("");
        setMeasureWidth("");
        await fetchOrder(true);
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Falha ao adicionar peça");
      }
    } finally {
      setAddingPart(false);
    }
  };

  const handleRemovePart = async (partId: number) => {
    if (!selected) return;
    await fetch(`/api/service-orders/${selected.id}/parts/${partId}`, {
      method: "DELETE",
      headers: authHeaderNoJson(),
    });
    await fetchOrder(true);
  };

  // ── Photos ──────────────────────────────────────────────────────────────
  const handlePhotoFile = async (file: File, kind: "intake" | "damage") => {
    if (!selected) return;
    setPhotoUploading(true);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const upRes = await fetch("/api/upload/service-order-photo", {
        method: "POST",
        headers: authHeaderNoJson(),
        body: fd,
      });
      if (!upRes.ok) return;
      const { url } = await upRes.json();
      await fetch(`/api/service-orders/${selected.id}/photos`, {
        method: "POST",
        headers: authHeader(),
        body: JSON.stringify({ url, kind }),
      });
      await fetchOrder(true);
    } finally {
      setPhotoUploading(false);
    }
  };

  const handleRemovePhoto = async (photoId: number) => {
    if (!selected) return;
    await fetch(`/api/service-orders/${selected.id}/photos/${photoId}`, {
      method: "DELETE",
      headers: authHeaderNoJson(),
    });
    await fetchOrder(true);
  };

  // ── PDF ─────────────────────────────────────────────────────────────────
  const handleGeneratePdf = async () => {
    if (!selected) return;
    setGeneratingPdf(true);
    try {
      await downloadServiceOrderPdf(selected, tenant);
    } finally {
      setGeneratingPdf(false);
    }
  };

  // ── NFS-e ────────────────────────────────────────────────────────────────
  const handleOpenNfsePdf = async () => {
    if (!selected) return;
    try {
      const res = await fetch(`/api/nfse/${selected.id}/pdf`, { headers: authHeaderNoJson() });
      if (!res.ok) return;
      const blob = await res.blob();
      window.open(URL.createObjectURL(blob), "_blank");
    } catch {
      // silencioso: botão só abre o PDF, sem estado de erro dedicado
    }
  };

  const handleEmitNfse = async () => {
    if (!selected) return;
    setNfseEmitting(true);
    setNfseError(null);
    try {
      const res = await fetch(`/api/nfse/${selected.id}/emit`, {
        method: "POST",
        headers: authHeader(),
        body: JSON.stringify({
          codigo_tributacao_nacional: nfseCodigoServico,
          descricao_servico: nfseDescricao || undefined,
          valor_servico: Number(serviceValue) || Number(selected.service_value),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setNfseError(data.error ?? "Falha ao emitir NFS-e");
        return;
      }
      setNfseInvoice(data);
      // Emissão é assíncrona no backend — reconsulta em alguns segundos para pegar o resultado final
      setTimeout(() => fetchOrder(true), 4000);
    } catch {
      setNfseError("Falha de conexão ao emitir NFS-e");
    } finally {
      setNfseEmitting(false);
    }
  };

  // ── Invoice ("Faturar") ────────────────────────────────────────────────
  const paidTotal = invoicePayments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const remaining = selected ? Math.max(0, Number(selected.total_amount) - paidTotal) : 0;

  const updateInvoicePayment = (id: string, patch: Partial<InvoicePayment>) => {
    setInvoicePayments((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };
  const addInvoicePayment = () => setInvoicePayments((prev) => [...prev, newPayment()]);
  const removeInvoicePayment = (id: string) => setInvoicePayments((prev) => prev.filter((p) => p.id !== id));

  const handleInvoice = async () => {
    if (!selected) return;
    setInvoicing(true);
    try {
      const pmString = buildPmString(invoicePayments) || "money";
      const res = await fetch(`/api/service-orders/${selected.id}/faturar`, {
        method: "POST",
        headers: authHeader(),
        body: JSON.stringify({ payment_method: pmString, seller_id: invoiceSellerId || undefined }),
      });
      if (res.ok) {
        setShowInvoiceModal(false);
        setInvoicePayments([newPayment()]);
        setInvoiceSellerId("");
        await fetchOrder(true);
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Falha ao faturar");
      }
    } finally {
      setInvoicing(false);
    }
  };

  const filteredParts = products.filter(
    (p) => partSearch && p.name.toLowerCase().includes(partSearch.toLowerCase()) &&
      (p.stock_quantity > 0 || (!!p.sale_unit && p.sale_unit !== "unidade"))
  );

  if (loading) {
    return <div className="p-10 text-center text-slate-400 text-[12px] font-bold">Carregando...</div>;
  }
  if (notFound || !selected) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24">
        <AlertTriangle className="text-red-500" size={28} />
        <p className="text-[12px] font-bold text-slate-600">Ordem de serviço não encontrada</p>
        <button onClick={() => navigate("/admin/ordens-servico")} className="h-9 px-4 bg-slate-900 text-white rounded-lg text-[11px] font-black uppercase tracking-wider hover:bg-slate-800 transition-all">
          Voltar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-10">
      <PageHeader
        title={isDraft ? "Nova Ordem de Serviço (Rascunho)" : `OS #${String(selected.number).padStart(4, "0")} — ${selected.customer_name}`}
        subtitle={isDraft ? "Preencha os dados abaixo — tudo é salvo automaticamente" : "Ordem de Serviço"}
        action={
          <button
            onClick={() => navigate("/admin/ordens-servico")}
            className="h-9 px-4 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-2 text-[12px] font-bold text-slate-600 transition-all"
          >
            <ChevronLeft size={15} /> Voltar
          </button>
        }
      />

      {savingField && (
        <p className="text-[10px] font-bold text-slate-400">Salvando…</p>
      )}
      {!savingField && savedPulse && (
        <p className="text-[10px] font-bold text-emerald-500 flex items-center gap-1"><CheckCircle2 size={12} /> Salvo</p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          {/* Status */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className={cn("inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider", STATUS_META[selected.status].color)}>
                  {STATUS_META[selected.status].icon} {STATUS_META[selected.status].label}
                </span>
                {selected.priority === "urgente" && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider bg-red-50 text-red-600">
                    <AlertTriangle size={12} /> Urgente
                  </span>
                )}
              </div>
              {selected.invoiced_order_id && (
                <span className="text-[10px] font-bold text-emerald-600">Faturada — Pedido #{selected.invoiced_order_id}</span>
              )}
            </div>

            {selected.status === "cancelada" ? (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-3 space-y-2">
                <p className="text-[11px] font-black text-red-600 uppercase tracking-wider flex items-center gap-1.5"><Ban size={13} /> Ordem Cancelada</p>
                {selected.cancel_reason && <p className="text-[11px] text-red-500 mt-1">Motivo: {selected.cancel_reason}</p>}
                <button onClick={() => setShowDiscardModal(true)} className="text-[10px] font-bold text-red-400 hover:text-red-600 transition-colors">
                  Excluir Ordem de Serviço
                </button>
              </div>
            ) : isDraft ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => changeStatus("orcamento_enviado")}
                  disabled={!canStartService}
                  className="h-9 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all"
                >
                  Iniciar Atendimento <ArrowRight size={13} />
                </button>
                <button onClick={() => setShowDiscardModal(true)} className="text-[10px] font-bold text-slate-400 hover:text-red-500 transition-colors">
                  Descartar rascunho
                </button>
                {!canStartService && (
                  <span className="text-[10px] text-slate-400">Preencha cliente, categoria e defeito relatado</span>
                )}
              </div>
            ) : (
              <>
                <div className="flex items-center gap-1 mb-3">
                  {STATUS_ORDER.filter((s) => s !== "rascunho" && s !== "cancelada").map((s) => {
                    const currentIdx = STATUS_ORDER.indexOf(selected.status);
                    const idx = STATUS_ORDER.indexOf(s);
                    const isDone = idx <= currentIdx;
                    return (
                      <div key={s} className="flex-1 flex items-center gap-1">
                        <div className={cn("flex-1 h-1.5 rounded-full transition-all", isDone ? "bg-blue-500" : "bg-slate-200")} />
                      </div>
                    );
                  })}
                </div>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {STATUS_ORDER.filter((s) => s !== "rascunho" && s !== "cancelada").map((s) => {
                    const currentIdx = STATUS_ORDER.indexOf(selected.status);
                    const idx = STATUS_ORDER.indexOf(s);
                    const isCurrent = idx === currentIdx;
                    const isDone = idx < currentIdx;
                    return (
                      <span key={s} className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded",
                        isCurrent ? "bg-blue-100 text-blue-700" : isDone ? "text-emerald-600" : "text-slate-300")}>
                        {STATUS_META[s].label}
                      </span>
                    );
                  })}
                </div>
                <div className="flex items-center gap-2">
                  {(() => {
                    const currentIdx = STATUS_ORDER.indexOf(selected.status);
                    const next = STATUS_ORDER[currentIdx + 1];
                    // Faturada só pode seguir para "entregue" — as demais ações (cancelar/excluir/pular etapa) ficam bloqueadas.
                    if (selected.invoiced_order_id) {
                      return next === "entregue" ? (
                        <button onClick={() => changeStatus(next)}
                          className="h-9 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all">
                          Avançar para: {STATUS_META[next].label} <ArrowRight size={13} />
                        </button>
                      ) : (
                        <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1"><CheckCircle2 size={13} /> Concluída</span>
                      );
                    }
                    return next && next !== "cancelada" ? (
                      <>
                        <button onClick={() => changeStatus(next)}
                          className="h-9 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all">
                          Avançar para: {STATUS_META[next].label} <ArrowRight size={13} />
                        </button>
                        <button onClick={() => setShowCancelModal(true)}
                          className="text-[10px] font-bold text-slate-400 hover:text-red-500 transition-colors">
                          Cancelar Ordem
                        </button>
                        <button onClick={() => setShowDiscardModal(true)}
                          className="text-[10px] font-bold text-slate-400 hover:text-red-500 transition-colors">
                          Excluir Ordem de Serviço
                        </button>
                      </>
                    ) : (
                      <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1"><CheckCircle2 size={13} /> Concluída</span>
                    );
                  })()}
                </div>
              </>
            )}
          </div>

          {/* Cliente */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Cliente</p>
            <div className="flex gap-2">
              <div className="flex-1 min-w-0">
                <Combobox
                  placeholder="Buscar por nome ou telefone..."
                  searchPlaceholder="Nome ou telefone..."
                  clearable
                  freeInput
                  value={customerId !== null ? String(customerId) : customerName}
                  onChange={(v) => {
                    if (!v) {
                      setCustomerId(null);
                      setCustomerName("");
                      autosaveField({ customer_id: null, customer_name: "" }, "customer_name");
                      return;
                    }
                    const cust = customers.find((c) => String(c.id) === v);
                    if (cust) {
                      setCustomerId(cust.id);
                      setCustomerName(cust.name);
                      setCustomerPhone(cust.phone ?? customerPhone);
                      autosaveField({ customer_id: cust.id, customer_name: cust.name, customer_phone: cust.phone ?? customerPhone }, "customer_name");
                    } else {
                      setCustomerId(null);
                      setCustomerName(v);
                      autosaveField({ customer_id: null, customer_name: v }, "customer_name");
                    }
                  }}
                  options={customers.map((c) => ({ value: String(c.id), label: c.name, description: c.phone }))}
                  onAddNew={(q) => {
                    setNcName(q); setNcPhone(""); setNcDoc(""); setNcEmail("");
                    setShowNewCustomer(true);
                  }}
                />
              </div>
              <button
                type="button"
                onClick={() => { setNcName(""); setNcPhone(""); setNcDoc(""); setNcEmail(""); setShowNewCustomer(true); }}
                className="h-10 w-10 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 hover:bg-blue-100 flex items-center justify-center shrink-0 transition-colors"
                title="Cadastrar novo cliente"
              >
                <UserPlus size={15} />
              </button>
            </div>
            <input
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              onBlur={() => autosaveField({ customer_phone: customerPhone || null }, "customer_phone")}
              placeholder="Telefone"
              className="w-full h-10 px-3 rounded-xl border border-slate-200 text-[12px] font-medium focus:outline-none focus:border-blue-400"
            />
          </div>

          {/* Equipamento */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Equipamento</p>
            <div className="flex gap-2">
              <div className="flex-1 min-w-0">
                <Combobox
                  placeholder="Selecionar categoria..."
                  searchPlaceholder="Buscar categoria..."
                  value={equipmentCategory}
                  onChange={(v) => {
                    setEquipmentCategory(v);
                    autosaveField({ equipment_category: v }, "equipment_category");
                  }}
                  options={categoryOptions}
                  hint={categoryOptions.length === 0 ? "Nenhuma categoria ainda — clique em + para criar" : undefined}
                />
              </div>
              <button
                type="button"
                onClick={() => { setNcatName(""); setNcatItems([""]); setShowNewCategory(true); }}
                className="h-10 w-10 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 hover:bg-blue-100 flex items-center justify-center shrink-0 transition-colors"
                title="Criar nova categoria"
              >
                <PlusCircle size={15} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input value={equipmentType} onChange={(e) => setEquipmentType(e.target.value)} onBlur={() => autosaveField({ equipment_type: equipmentType || null }, "equipment_type")} placeholder="Tipo (ex: Notebook Gamer)" className="h-10 px-3 rounded-xl border border-slate-200 text-[12px] font-medium focus:outline-none focus:border-blue-400" />
              <input value={equipmentBrand} onChange={(e) => setEquipmentBrand(e.target.value)} onBlur={() => autosaveField({ equipment_brand: equipmentBrand || null }, "equipment_brand")} placeholder="Marca" className="h-10 px-3 rounded-xl border border-slate-200 text-[12px] font-medium focus:outline-none focus:border-blue-400" />
              <input value={equipmentModel} onChange={(e) => setEquipmentModel(e.target.value)} onBlur={() => autosaveField({ equipment_model: equipmentModel || null }, "equipment_model")} placeholder="Modelo" className="h-10 px-3 rounded-xl border border-slate-200 text-[12px] font-medium focus:outline-none focus:border-blue-400" />
              <input value={equipmentSerial} onChange={(e) => setEquipmentSerial(e.target.value)} onBlur={() => autosaveField({ equipment_serial: equipmentSerial || null }, "equipment_serial")} placeholder="Série / IMEI" className="h-10 px-3 rounded-xl border border-slate-200 text-[12px] font-medium focus:outline-none focus:border-blue-400" />
            </div>
            <textarea
              value={equipmentAccessories}
              onChange={(e) => setEquipmentAccessories(e.target.value)}
              onBlur={() => autosaveField({ equipment_accessories: equipmentAccessories || null }, "equipment_accessories")}
              placeholder="Acessórios entregues junto (carregador, capa, etc.)"
              rows={2}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-[12px] font-medium focus:outline-none focus:border-blue-400 resize-none"
            />

            <div>
              <label className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-500 mb-1.5 block">Defeito Relatado pelo Cliente</label>
              <textarea
                value={reportedIssue}
                onChange={(e) => setReportedIssue(e.target.value)}
                onBlur={() => autosaveField({ reported_issue: reportedIssue || null }, "reported_issue")}
                placeholder="O que o cliente relatou como problema..."
                rows={2}
                className="w-full px-3 py-2 rounded-xl border border-amber-200 bg-amber-50/50 text-[12px] font-medium focus:outline-none focus:border-amber-400 resize-none"
              />
            </div>
          </div>

          {/* Checklist */}
          {selected.checklist_items.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Checklist de Entrada</p>
              <div className="space-y-2">
                {selected.checklist_items.sort((a, b) => a.position - b.position).map((item) => (
                  <div key={item.id} className="bg-slate-50 rounded-xl border border-slate-200 p-3">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <p className="text-[12px] font-semibold text-slate-700 flex-1">{item.label}</p>
                      <div className="flex bg-slate-100 border border-slate-200 rounded-lg p-0.5 gap-0.5 shrink-0">
                        {(["sim", "nao", "na"] as const).map((a) => (
                          <button key={a} onClick={() => updateChecklistItem(item.id, { answer: a })}
                            className={cn("h-6 px-2 rounded-md text-[9px] font-black transition-all",
                              item.answer === a
                                ? a === "sim" ? "bg-emerald-600 text-white" : a === "nao" ? "bg-red-500 text-white" : "bg-slate-500 text-white"
                                : "text-slate-400")}>
                            {a === "sim" ? "Sim" : a === "nao" ? "Não" : "N/A"}
                          </button>
                        ))}
                      </div>
                    </div>
                    <input
                      value={item.observation ?? ""}
                      onChange={(e) => updateChecklistItem(item.id, { observation: e.target.value })}
                      placeholder="Observação (opcional)"
                      className="w-full h-8 px-2 rounded-lg border border-slate-200 text-[11px] focus:outline-none focus:border-blue-400"
                    />
                  </div>
                ))}
              </div>
              <button onClick={saveChecklist} className="mt-2 h-8 px-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-600 text-[10px] font-black uppercase tracking-wider hover:bg-blue-100 transition-all">
                Salvar Checklist
              </button>
            </div>
          )}

          {/* Fotos */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Fotos</p>
              <div className="flex gap-1.5">
                <button onClick={() => fileInputRef.current?.click()} disabled={photoUploading}
                  className="h-7 px-2.5 rounded-lg bg-slate-100 text-slate-600 text-[9px] font-black uppercase tracking-wider flex items-center gap-1 hover:bg-slate-200 transition-all disabled:opacity-50">
                  <ImagePlus size={11} /> Galeria
                </button>
                <button onClick={() => cameraInputRef.current?.click()} disabled={photoUploading}
                  className="h-7 px-2.5 rounded-lg bg-blue-50 text-blue-600 text-[9px] font-black uppercase tracking-wider flex items-center gap-1 hover:bg-blue-100 transition-all disabled:opacity-50">
                  <Camera size={11} /> Câmera
                </button>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden"
                onChange={(e) => { const files = e.target.files; if (files) Array.from(files).forEach((f) => handlePhotoFile(f, "intake")); e.target.value = ""; }} />
              <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhotoFile(f, "intake"); e.target.value = ""; }} />
            </div>
            {photoUploading && <p className="text-[10px] text-slate-400 mb-2">Enviando foto...</p>}
            {selected.photos.length === 0 ? (
              <p className="text-[11px] text-slate-400">Nenhuma foto anexada</p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {selected.photos.map((photo) => (
                  <div key={photo.id} className="relative group rounded-xl overflow-hidden border border-slate-200 aspect-square">
                    <img src={photo.url} alt={photo.caption ?? ""} className="w-full h-full object-cover" />
                    <span className={cn("absolute top-1 left-1 px-1.5 py-0.5 rounded text-[8px] font-black uppercase",
                      photo.kind === "damage" ? "bg-red-500 text-white" : "bg-blue-500 text-white")}>
                      {photo.kind === "damage" ? "Avaria" : "Entrada"}
                    </span>
                    <button onClick={() => handleRemovePhoto(photo.id)}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <X size={10} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Peças */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Peças / Itens</p>
            {!selected.invoiced_order_id && (
              <div className="space-y-2 mb-2">
                {!showFreePartForm ? (
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Combobox
                        placeholder="Buscar peça no estoque..."
                        searchPlaceholder="Nome do produto..."
                        value=""
                        onChange={(v) => {
                          const product = products.find((p) => String(p.id) === v);
                          if (product) handleAddPart(product);
                        }}
                        options={filteredParts.length > 0 ? filteredParts.map((p) => ({ value: String(p.id), label: p.name, description: `${fmt(p.price)} · estoque ${p.stock_quantity}` }))
                          : products.filter((p) => p.stock_quantity > 0 || (!!p.sale_unit && p.sale_unit !== "unidade")).slice(0, 20).map((p) => ({ value: String(p.id), label: p.name, description: p.sale_unit && p.sale_unit !== "unidade" ? `${fmt(p.price_per_measure ?? 0)}/${p.sale_unit === "m2" ? "m²" : "m"}` : `${fmt(p.price)} · estoque ${p.stock_quantity}` }))}
                      />
                    </div>
                    <input type="number" min="1" value={partQty} onChange={(e) => setPartQty(Math.max(1, Number(e.target.value) || 1))}
                      className="w-16 h-10 px-2 rounded-xl border border-slate-200 text-[12px] font-bold text-center focus:outline-none focus:border-blue-400" />
                  </div>
                ) : (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
                    <input value={freePartName} onChange={(e) => setFreePartName(e.target.value)} placeholder="Descrição do item (ex: Mão de obra extra)"
                      className="w-full h-9 px-3 rounded-lg border border-slate-200 text-[12px] focus:outline-none focus:border-blue-400" />
                    <div className="flex gap-2">
                      <input value={freePartUnit} onChange={(e) => setFreePartUnit(e.target.value.toUpperCase().slice(0, 10))} placeholder="Un"
                        className="w-16 h-9 px-2 rounded-lg border border-slate-200 text-[12px] text-center font-bold focus:outline-none focus:border-blue-400" />
                      <input type="number" min="1" value={partQty} onChange={(e) => setPartQty(Math.max(1, Number(e.target.value) || 1))}
                        className="w-16 h-9 px-2 rounded-lg border border-slate-200 text-[12px] font-bold text-center focus:outline-none focus:border-blue-400" />
                      <input type="number" min="0" step="0.01" value={freePartPrice} onChange={(e) => setFreePartPrice(e.target.value)}
                        placeholder="Valor unit." disabled={partNoCharge}
                        className="flex-1 h-9 px-3 rounded-lg border border-slate-200 text-[12px] font-mono focus:outline-none focus:border-blue-400 disabled:opacity-50" />
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 cursor-pointer">
                    <input type="checkbox" checked={partNoCharge} onChange={(e) => setPartNoCharge(e.target.checked)} className="w-3.5 h-3.5 accent-blue-600" />
                    Sem cobrança (cortesia)
                  </label>
                  {showFreePartForm ? (
                    <div className="flex gap-2">
                      <button onClick={() => setShowFreePartForm(false)} className="h-8 px-3 rounded-lg text-[10px] font-black uppercase tracking-wide text-slate-500 hover:bg-slate-100 transition-all">
                        Cancelar
                      </button>
                      <button onClick={handleAddFreePart} disabled={addingPart || !freePartName.trim()}
                        className="h-8 px-3 rounded-lg bg-blue-600 text-white text-[10px] font-black uppercase tracking-wide hover:bg-blue-700 transition-all disabled:opacity-50">
                        Adicionar
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => setShowFreePartForm(true)} className="text-[10px] font-black uppercase tracking-wide text-blue-600 hover:text-blue-700 transition-all">
                      + Item livre (sem produto)
                    </button>
                  )}
                </div>
              </div>
            )}
            {addingPart && <p className="text-[10px] text-slate-400 mb-2">Adicionando item...</p>}
            {selected.parts.length === 0 ? (
              <p className="text-[11px] text-slate-400">Nenhum item adicionado</p>
            ) : (
              <div className="space-y-1.5">
                {selected.parts.map((part) => (
                  <div key={part.id} className="flex items-center justify-between bg-slate-50 rounded-xl px-3 py-2 border border-slate-200">
                    <div className="min-w-0">
                      <p className="text-[12px] font-semibold text-slate-700 truncate">{part.name}</p>
                      {part.dimensions_label ? (
                        <p className="text-[10px] text-blue-500 font-mono">{part.dimensions_label}</p>
                      ) : (
                        <p className="text-[10px] text-slate-400">{part.quantity} {part.unit} × {fmt(part.unit_price)}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {part.no_charge ? (
                        <span className="text-[9px] font-black uppercase tracking-wide text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">Sem cobrança</span>
                      ) : (
                        <span className="text-[12px] font-mono font-bold text-slate-700">{fmt(part.total)}</span>
                      )}
                      {!selected.invoiced_order_id && (
                        <button onClick={() => handleRemovePart(part.id)} className="text-slate-300 hover:text-red-500 transition-colors">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {selected.actions && selected.actions.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Histórico</p>
              <div className="space-y-2">
                {selected.actions.map((a) => (
                  <div key={a.id} className="flex items-start gap-2 text-[11px]">
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-300 mt-1.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-slate-600">
                        {a.action === "status_changed" && a.to_status ? `Status alterado para ${STATUS_META[a.to_status as keyof typeof STATUS_META]?.label ?? a.to_status}` :
                         a.action === "created" ? "Ordem de serviço criada" :
                         a.action === "part_added" ? `Peça adicionada${a.note ? `: ${a.note}` : ""}` :
                         a.action === "part_removed" ? `Peça removida${a.note ? `: ${a.note}` : ""}` :
                         a.action === "invoiced" ? "Ordem de serviço faturada" : a.action}
                      </p>
                      <p className="text-slate-400 text-[10px]">{a.actor ?? "Sistema"} · {new Date(a.created_at).toLocaleString("pt-BR")}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          {/* Responsável / Prioridade / Previsão */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Responsável</p>
            <div className="flex bg-slate-100 border border-slate-200 rounded-xl p-0.5 gap-0.5 w-fit">
              {(["seller", "technician", "external"] as const).map((m) => (
                <button key={m} onClick={() => {
                  setResponsibleMode(m);
                  if (m === "seller") autosaveField({ technician_id: null, technician_name: null }, "responsible");
                  else if (m === "technician") autosaveField({ seller_id: null, technician_name: null }, "responsible");
                  else autosaveField({ seller_id: null, technician_id: null }, "responsible");
                }}
                  className={cn("h-8 px-3 rounded-lg text-[10px] font-black transition-all", responsibleMode === m ? "bg-blue-600 text-white" : "text-slate-500")}>
                  {m === "seller" ? "Vendedor" : m === "technician" ? "Técnico" : "Externo"}
                </button>
              ))}
            </div>
            {responsibleMode === "seller" ? (
              <Combobox
                placeholder="Selecionar vendedor..."
                searchPlaceholder="Buscar vendedor..."
                clearable
                value={sellerId !== null ? String(sellerId) : ""}
                onChange={(v) => {
                  const val = v ? Number(v) : null;
                  setSellerId(val);
                  autosaveField({ seller_id: val }, "seller_id");
                }}
                options={sellers.map((s) => ({ value: String(s.id), label: s.name }))}
              />
            ) : responsibleMode === "technician" ? (
              <Combobox
                placeholder="Selecionar técnico..."
                searchPlaceholder="Buscar técnico..."
                clearable
                value={technicianId !== null ? String(technicianId) : ""}
                onChange={(v) => {
                  const val = v ? Number(v) : null;
                  setTechnicianId(val);
                  autosaveField({ technician_id: val }, "technician_id");
                }}
                options={technicians.map((t) => ({ value: String(t.id), label: t.name }))}
              />
            ) : (
              <input
                value={technicianName}
                onChange={(e) => setTechnicianName(e.target.value)}
                onBlur={() => autosaveField({ technician_name: technicianName || null }, "technician_name")}
                placeholder="Nome do técnico/prestador externo"
                className="w-full h-10 px-3 rounded-xl border border-slate-200 text-[12px] font-medium focus:outline-none focus:border-blue-400"
              />
            )}

            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 pt-2">Prioridade</p>
            <div className="flex bg-slate-100 border border-slate-200 rounded-xl p-0.5 gap-0.5">
              {(["normal", "urgente"] as const).map((p) => (
                <button key={p} type="button" onClick={() => { setPriority(p); autosaveField({ priority: p }, "priority"); }}
                  className={cn("flex-1 h-9 rounded-lg text-[10px] font-black transition-all flex items-center justify-center gap-1",
                    priority === p ? (p === "urgente" ? "bg-red-500 text-white" : "bg-blue-600 text-white") : "text-slate-500")}>
                  {p === "urgente" && <AlertTriangle size={11} />}
                  {p === "normal" ? "Normal" : "Urgente"}
                </button>
              ))}
            </div>

            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 pt-2">Previsão de Entrega</p>
            <div className="relative">
              <CalendarClock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input
                type="date"
                value={promisedAt}
                onChange={(e) => setPromisedAt(e.target.value)}
                onBlur={() => autosaveField({ promised_at: promisedAt || null }, "promised_at")}
                className="w-full pl-9 pr-3 h-10 rounded-xl border border-slate-200 text-[12px] font-medium focus:outline-none focus:border-blue-400"
              />
            </div>
          </div>

          {/* Valor / total */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Valor da Mão de Obra</p>
            <div className="relative">
              <Banknote className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input
                type="number" min="0" step="0.01"
                value={serviceValue}
                onChange={(e) => setServiceValue(e.target.value)}
                onBlur={() => autosaveField({ service_value: Number(serviceValue) || 0 }, "service_value")}
                placeholder="0,00"
                className="w-full pl-9 pr-3 h-10 rounded-xl border border-slate-200 text-[13px] font-mono font-bold focus:outline-none focus:border-blue-400 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>

            <div className="bg-slate-900 rounded-2xl p-4 space-y-1.5">
              <div className="flex justify-between text-[10px] font-bold uppercase text-slate-400">
                <span>Mão de obra</span>
                <span className="font-mono text-slate-200">{fmt(selected.service_value)}</span>
              </div>
              <div className="flex justify-between text-[10px] font-bold uppercase text-slate-400">
                <span>Peças</span>
                <span className="font-mono text-slate-200">{fmt(selected.parts_total)}</span>
              </div>
              <div className="flex justify-between text-[13px] font-black uppercase text-white pt-1.5 border-t border-slate-700">
                <span>Total</span>
                <span className="font-mono">{fmt(selected.total_amount)}</span>
              </div>
            </div>
          </div>

          {/* NFS-e — emitida sobre a mão de obra (peças já geram NFC-e na venda) */}
          {Number(selected.service_value) > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">NFS-e (Serviço)</p>
              {nfseInvoice?.status === "authorized" ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 rounded-xl px-3 py-2.5">
                    <CheckCircle2 size={14} />
                    <span className="text-[11px] font-bold">
                      NFS-e autorizada — Série {nfseInvoice.serie}/{nfseInvoice.numero}
                    </span>
                  </div>
                  <button onClick={handleOpenNfsePdf}
                    className="w-full h-9 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
                    Ver PDF da NFS-e
                  </button>
                </div>
              ) : selected.status !== "finalizado" && selected.status !== "nota_emitida" ? (
                <p className="text-[10px] font-bold text-slate-400">Disponível quando a ordem estiver finalizada.</p>
              ) : (
                <>
                  {nfseInvoice && (nfseInvoice.status === "pending" || nfseInvoice.status === "processing") && (
                    <div className="flex items-center gap-2 text-amber-600 bg-amber-50 rounded-xl px-3 py-2.5">
                      <Loader2 size={14} className="animate-spin" />
                      <span className="text-[11px] font-bold">Processando emissão…</span>
                    </div>
                  )}
                  {nfseInvoice?.status === "rejected" || nfseInvoice?.status === "error" ? (
                    <p className="text-[10px] font-bold text-red-600">{nfseInvoice.rejection_reason || "Falha na emissão"}</p>
                  ) : null}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-wide block mb-1">Cód. Serviço</label>
                      <input value={nfseCodigoServico} onChange={(e) => setNfseCodigoServico(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        placeholder="70602"
                        className="w-full h-9 px-2 rounded-lg border border-slate-200 text-[12px] font-mono focus:outline-none focus:border-blue-400" />
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-wide block mb-1">Descrição (opcional)</label>
                      <input value={nfseDescricao} onChange={(e) => setNfseDescricao(e.target.value)}
                        placeholder="Instalação de vidro/box"
                        className="w-full h-9 px-2 rounded-lg border border-slate-200 text-[12px] focus:outline-none focus:border-blue-400" />
                    </div>
                  </div>
                  <button onClick={handleEmitNfse} disabled={nfseEmitting || !nfseCodigoServico}
                    className="w-full h-10 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                    {nfseEmitting ? <Loader2 size={13} className="animate-spin" /> : null}
                    {nfseEmitting ? "Emitindo…" : "Emitir NFS-e"}
                  </button>
                  {nfseError && <p className="text-[10px] font-bold text-red-600">{nfseError}</p>}
                </>
              )}
            </div>
          )}

          {/* Garantia */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Termo de Garantia (opcional)</p>
            <div className="flex gap-2">
              <div className="relative w-24 shrink-0">
                <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input
                  type="number" min="0"
                  value={warrantyDays}
                  onChange={(e) => setWarrantyDays(e.target.value)}
                  onBlur={() => autosaveField({ warranty_days: warrantyDays ? Number(warrantyDays) : null }, "warranty_days")}
                  placeholder="Dias"
                  className="w-full pl-8 pr-2 h-10 rounded-xl border border-slate-200 text-[12px] font-mono font-bold focus:outline-none focus:border-blue-400 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
              <input
                value={warrantyTerms}
                onChange={(e) => setWarrantyTerms(e.target.value)}
                onBlur={() => autosaveField({ warranty_terms: warrantyTerms || null }, "warranty_terms")}
                placeholder="Condições da garantia"
                className="flex-1 h-10 px-3 rounded-xl border border-slate-200 text-[12px] font-medium focus:outline-none focus:border-blue-400"
              />
            </div>
          </div>

          {/* Observações */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-2">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Observações Internas do Técnico</p>
            <textarea
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              onBlur={() => autosaveField({ observations: observations || null }, "observations")}
              placeholder="Anotações internas, diagnóstico, etc."
              rows={3}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-[12px] font-medium focus:outline-none focus:border-blue-400 resize-none"
            />
          </div>

          {/* Ações */}
          <div className="grid grid-cols-2 gap-2">
            <button onClick={handleGeneratePdf} disabled={generatingPdf}
              className="h-11 bg-slate-100 hover:bg-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 text-slate-700 transition-all disabled:opacity-60">
              {generatingPdf ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />} Gerar PDF
            </button>
            {!selected.invoiced_order_id && (selected.status === "finalizado" || selected.status === "nota_emitida") && (
              <button onClick={() => setShowInvoiceModal(true)}
                className="h-11 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all">
                <Receipt size={14} /> Faturar
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── NOVO CLIENTE MODAL ───────────────────────────────────────────── */}
      <Modal
        open={showNewCustomer}
        onClose={() => setShowNewCustomer(false)}
        title="Novo Cliente"
        subtitle="Cadastro CRM"
        footer={
          <>
            <button onClick={() => setShowNewCustomer(false)} className="flex-1 h-9 rounded-lg border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-100">
              Cancelar
            </button>
            <button
              disabled={savingNC || !ncName.trim()}
              onClick={async () => {
                if (!ncName.trim()) return;
                setSavingNC(true);
                try {
                  const res = await fetch("/api/customers", {
                    method: "POST",
                    headers: authHeader(),
                    body: JSON.stringify({
                      name: ncName,
                      phone: ncPhone.replace(/\D/g, "") || null,
                      document: ncDoc.replace(/\D/g, "") || null,
                      email: ncEmail || null,
                    }),
                  });
                  const newCust = await res.json();
                  const cRes = await fetch("/api/customers", { headers: authHeaderNoJson() });
                  const cData = await cRes.json();
                  setCustomers(Array.isArray(cData) ? cData : []);
                  setCustomerId(newCust.id);
                  setCustomerName(newCust.name);
                  setCustomerPhone(newCust.phone ?? customerPhone);
                  await autosaveField({ customer_id: newCust.id, customer_name: newCust.name, customer_phone: newCust.phone ?? customerPhone }, "customer_name");
                  setShowNewCustomer(false);
                } finally {
                  setSavingNC(false);
                }
              }}
              className="flex-1 h-9 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 disabled:opacity-50 transition-all"
            >
              {savingNC ? "Cadastrando…" : "Criar Cliente"}
            </button>
          </>
        }
      >
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Nome *</label>
          <input value={ncName} onChange={(e) => setNcName(e.target.value)} placeholder="Nome completo"
            className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Telefone</label>
            <input value={ncPhone} onChange={(e) => setNcPhone(maskPhone(e.target.value))} inputMode="numeric"
              placeholder="(11) 99999-9999"
              className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">CPF/CNPJ</label>
            <input value={ncDoc} onChange={(e) => setNcDoc(maskDoc(e.target.value))} inputMode="numeric"
              placeholder="000.000.000-00"
              className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">E-mail</label>
          <input type="email" value={ncEmail} onChange={(e) => setNcEmail(e.target.value)} placeholder="email@exemplo.com"
            className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </Modal>

      {/* ── NOVA CATEGORIA MODAL ─────────────────────────────────────────── */}
      <Modal
        open={showNewCategory}
        onClose={() => setShowNewCategory(false)}
        title="Nova Categoria de Equipamento"
        subtitle="Define o checklist de entrada usado nessa categoria"
        footer={
          <>
            <button onClick={() => setShowNewCategory(false)} className="flex-1 h-11 rounded-xl border border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 transition-colors">
              Cancelar
            </button>
            <button
              onClick={handleCreateCategory}
              disabled={savingCategory || !ncatName.trim()}
              className="flex-1 h-11 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {savingCategory ? <Loader2 size={14} className="animate-spin" /> : <PlusCircle size={14} />}
              Criar Categoria
            </button>
          </>
        }
      >
        <div>
          <label className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1.5 block">Nome da Categoria</label>
          <input
            value={ncatName}
            onChange={(e) => setNcatName(e.target.value)}
            placeholder="Ex: Notebook, Som, Celular..."
            className="w-full h-10 px-3 rounded-xl border border-slate-200 text-[12px] font-medium focus:outline-none focus:border-blue-400"
          />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Itens do Checklist (opcional)</label>
            <button
              onClick={() => setNcatItems((prev) => [...prev, ""])}
              className="flex items-center gap-1 h-6 px-2 bg-blue-50 border border-blue-200 rounded-lg text-[9px] font-black text-blue-600 uppercase tracking-widest hover:bg-blue-100 transition-all"
            >
              <PlusCircle size={10} /> Item
            </button>
          </div>
          <div className="space-y-2">
            {ncatItems.map((item, idx) => (
              <div key={idx} className="flex gap-2 items-center">
                <div className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center text-[8px] font-black shrink-0">
                  {idx + 1}
                </div>
                <input
                  value={item}
                  onChange={(e) => setNcatItems((prev) => prev.map((v, i) => (i === idx ? e.target.value : v)))}
                  placeholder="Ex: Liga, Tela sem trincos..."
                  className="flex-1 h-9 px-3 rounded-xl border border-slate-200 text-[12px] font-medium focus:outline-none focus:border-blue-400"
                />
                {ncatItems.length > 1 && (
                  <button
                    onClick={() => setNcatItems((prev) => prev.filter((_, i) => i !== idx))}
                    className="w-6 h-6 rounded-full bg-rose-50 text-rose-400 flex items-center justify-center hover:bg-rose-100 hover:text-rose-600 transition-colors shrink-0"
                  >
                    <X size={10} strokeWidth={3} />
                  </button>
                )}
              </div>
            ))}
          </div>
          <p className="text-[10px] text-slate-400 mt-2">Você pode adicionar ou ajustar itens depois em Configurações → Checklists de OS.</p>
        </div>
      </Modal>

      {/* ── MEASURE (m²/linear) MODAL ───────────────────────────────────────── */}
      <Modal
        open={!!measureProduct}
        onClose={() => setMeasureProduct(null)}
        title={measureProduct ? measureProduct.name : ""}
        subtitle={measureProduct ? `Venda por ${measureProduct.sale_unit === "m2" ? "m²" : "metro linear"}` : undefined}
        footer={
          <>
            <button onClick={() => setMeasureProduct(null)} className="flex-1 h-11 rounded-xl border border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 transition-colors">
              Cancelar
            </button>
            <button onClick={handleAddMeasuredPart}
              disabled={addingPart || !measurePreview || measurePreview.rawQuantity <= 0}
              className="flex-1 h-11 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
              {addingPart ? <Loader2 size={14} className="animate-spin" /> : <PlusCircle size={14} />}
              Adicionar
            </button>
          </>
        }
      >
        {measureProduct && (
          <>
            {measureProduct.sale_unit === "m2" ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1.5 block">Altura (m)</label>
                  <input type="number" min="0" step="0.01" autoFocus value={measureHeight}
                    onChange={(e) => setMeasureHeight(e.target.value)}
                    placeholder="0,00"
                    className="w-full h-11 px-3 rounded-xl border border-slate-200 text-sm font-mono font-bold text-center focus:outline-none focus:border-blue-400" />
                </div>
                <div>
                  <label className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1.5 block">Largura (m)</label>
                  <input type="number" min="0" step="0.01" value={measureWidth}
                    onChange={(e) => setMeasureWidth(e.target.value)}
                    placeholder="0,00"
                    className="w-full h-11 px-3 rounded-xl border border-slate-200 text-sm font-mono font-bold text-center focus:outline-none focus:border-blue-400" />
                </div>
              </div>
            ) : (
              <div>
                <label className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1.5 block">Comprimento (m)</label>
                <input type="number" min="0" step="0.01" autoFocus value={measureHeight}
                  onChange={(e) => setMeasureHeight(e.target.value)}
                  placeholder="0,00"
                  className="w-full h-11 px-3 rounded-xl border border-slate-200 text-sm font-mono font-bold text-center focus:outline-none focus:border-blue-400" />
              </div>
            )}

            {measurePreview && measurePreview.rawQuantity > 0 && (
              <div className="bg-slate-900 rounded-2xl p-4 space-y-1.5">
                <div className="flex justify-between text-[10px] font-bold uppercase text-slate-400">
                  <span>{measureProduct.sale_unit === "m2" ? "Área" : "Comprimento"}</span>
                  <span className="font-mono text-slate-200">{measurePreview.label}</span>
                </div>
                {measurePreview.minimumApplied && (
                  <p className="text-[10px] font-bold text-amber-400">
                    Cobrando o mínimo de {Number(measureProduct.min_billable_quantity).toFixed(2)}{measureProduct.sale_unit === "m2" ? "m²" : "m"}
                  </p>
                )}
                <div className="flex justify-between text-[13px] font-black uppercase text-white pt-1.5 border-t border-slate-700">
                  <span>Total</span>
                  <span className="font-mono">R$ {measurePreview.total.toFixed(2)}</span>
                </div>
              </div>
            )}
          </>
        )}
      </Modal>

      {/* ── INVOICE MODAL ────────────────────────────────────────────────── */}
      <Modal
        open={showInvoiceModal}
        onClose={() => setShowInvoiceModal(false)}
        title={`Faturar OS #${String(selected.number).padStart(4, "0")}`}
        footer={
          <>
            <button onClick={() => setShowInvoiceModal(false)} className="flex-1 h-11 rounded-xl border border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 transition-colors">
              Cancelar
            </button>
            <button onClick={handleInvoice} disabled={invoicing || paidTotal <= 0}
              className="flex-1 h-11 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              {invoicing ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              Confirmar Faturamento
            </button>
          </>
        }
      >
        <div>
          <label className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1.5 block">Vendedor</label>
          <div className="relative">
            <select value={invoiceSellerId} onChange={(e) => setInvoiceSellerId(e.target.value === "" ? "" : Number(e.target.value))}
              className="w-full pl-3 pr-8 h-10 rounded-xl border border-slate-200 text-[11px] font-bold appearance-none focus:outline-none focus:border-blue-400 bg-white">
              <option value="">Sem vendedor</option>
              {sellers.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
            </select>
            <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Formas de Pagamento</p>
            <button onClick={addInvoicePayment} className="flex items-center gap-1 h-6 px-2 bg-blue-50 border border-blue-200 rounded-lg text-[9px] font-black text-blue-600 uppercase tracking-widest hover:bg-blue-100 transition-all">
              <PlusCircle size={10} /> Adicionar
            </button>
          </div>
          <div className="space-y-2.5">
            {invoicePayments.map((p, idx) => {
              const cardFees = tenant?.card_fees ?? {};
              const feeRate = p.method === "credit" ? (cardFees[p.cardBrand]?.[p.installments - 1] ?? 0) : 0;
              const pAmt = Number(p.amount) || 0;
              const pFee = feeRate > 0 && pAmt > 0 ? pAmt * (feeRate / 100) : 0;
              return (
                <div key={p.id} className="bg-slate-50 rounded-2xl border border-slate-200 p-3 space-y-2.5">
                  <div className="flex items-center gap-2">
                    {invoicePayments.length > 1 && (
                      <span className="w-5 h-5 bg-slate-200 rounded-full flex items-center justify-center text-[9px] font-black text-slate-600 shrink-0">{idx + 1}</span>
                    )}
                    <div className="grid grid-cols-4 gap-1.5 flex-1">
                      {(["money", "debit", "credit", "pix"] as PayMethod[]).map((key) => (
                        <button key={key} onClick={() => updateInvoicePayment(p.id, { method: key, installments: 1 })}
                          className={cn("h-9 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all flex flex-col items-center justify-center gap-0.5",
                            p.method === key ? key === "credit" ? "bg-emerald-600 border-emerald-500 text-white" : "bg-blue-600 border-blue-500 text-white" : "bg-white border-slate-200 text-slate-500 hover:border-slate-400")}>
                          {key === "money" && <Banknote size={12} />}
                          {key === "debit" && <CreditCard size={12} />}
                          {key === "credit" && <CreditCard size={12} />}
                          {key === "pix" && <QrCode size={12} />}
                          {PM_LABEL[key]}
                        </button>
                      ))}
                    </div>
                    {invoicePayments.length > 1 && (
                      <button onClick={() => removeInvoicePayment(p.id)} className="text-slate-300 hover:text-red-500 transition-colors shrink-0">
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  {(p.method === "debit" || p.method === "credit") && (
                    <div className="grid grid-cols-3 gap-1">
                      {CARD_BRANDS.map(({ key, label, color }) => (
                        <button key={key} onClick={() => updateInvoicePayment(p.id, { cardBrand: key })}
                          className={cn("h-7 rounded-lg border text-[8px] font-black uppercase tracking-widest transition-all", p.cardBrand === key ? "text-white border-transparent" : "bg-white border-slate-200 text-slate-500 hover:border-slate-400")}
                          style={p.cardBrand === key ? { backgroundColor: color } : {}}>
                          {label}
                        </button>
                      ))}
                    </div>
                  )}

                  {p.method === "credit" && (
                    <div className="grid grid-cols-4 gap-1">
                      {[1, 2, 3, 4, 5, 6, 10, 12].map((n) => {
                        const rate = cardFees[p.cardBrand]?.[n - 1] ?? 0;
                        const isActive = p.installments === n;
                        return (
                          <button key={n} onClick={() => updateInvoicePayment(p.id, { installments: n })}
                            className={cn("rounded-lg border transition-all flex flex-col items-center justify-center py-1.5 px-1 gap-0.5", isActive ? "bg-emerald-600 border-emerald-500 text-white" : "bg-white border-slate-200 text-slate-500 hover:border-slate-400")}>
                            <span className="text-[8px] font-black uppercase">{n === 1 ? "Vista" : `${n}×`}</span>
                            {rate > 0 && <span className={cn("text-[7px] font-bold", isActive ? "text-emerald-200" : "text-amber-500")}>+{rate}%</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Banknote className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                      <input type="number" min="0" step="0.01"
                        placeholder={idx === 0 && remaining > 0 ? `R$ ${remaining.toFixed(2)}` : "Valor (R$)"}
                        className="w-full pl-9 pr-3 h-10 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 text-[11px] font-medium text-slate-800 placeholder:text-slate-400 transition-all [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                        value={p.amount} onChange={(e) => updateInvoicePayment(p.id, { amount: e.target.value })} />
                    </div>
                    {pFee > 0.005 && (
                      <div className="flex flex-col items-end gap-0.5 bg-amber-50 border border-amber-200 rounded-xl px-3 py-1.5 shrink-0">
                        <span className="text-[8px] font-black text-amber-600 uppercase">Taxa {feeRate}%</span>
                        <span className="text-[10px] font-mono font-black text-amber-700">− R$ {pFee.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-slate-900 rounded-2xl p-4 space-y-2">
          <div className="flex justify-between text-[10px] font-bold uppercase text-slate-500">
            <span>Total OS</span>
            <span className="font-mono">{fmt(selected.total_amount)}</span>
          </div>
          <div className="flex justify-between text-[10px] font-bold uppercase text-slate-400">
            <span>Pago</span>
            <span className="font-mono text-emerald-400">{fmt(paidTotal)}</span>
          </div>
          {remaining > 0.005 ? (
            <div className="flex justify-between text-[10px] font-black uppercase text-rose-400 pt-1 border-t border-slate-700">
              <span>Restante</span>
              <span className="font-mono">{fmt(remaining)}</span>
            </div>
          ) : (
            <div className="flex justify-between text-[10px] font-black uppercase text-emerald-400 pt-1 border-t border-slate-700">
              <span>Pagamento OK</span>
              <span className="font-mono">✓</span>
            </div>
          )}
        </div>
      </Modal>

      {/* ── CANCELAR MODAL ───────────────────────────────────────────────── */}
      <Modal
        open={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        title="Cancelar Ordem de Serviço"
        subtitle="Essa ação não pode ser desfeita"
        footer={
          <>
            <button onClick={() => setShowCancelModal(false)} className="flex-1 h-11 rounded-xl border border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 transition-colors">
              Voltar
            </button>
            <button onClick={handleConfirmCancel} disabled={cancelling}
              className="flex-1 h-11 bg-red-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
              {cancelling ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
              Confirmar Cancelamento
            </button>
          </>
        }
      >
        <div>
          <label className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1.5 block">Motivo (opcional)</label>
          <textarea
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Descreva o motivo do cancelamento..."
            rows={3}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-[12px] font-medium focus:outline-none focus:border-blue-400 resize-none"
          />
        </div>
      </Modal>

      {/* ── EXCLUIR / DESCARTAR MODAL ────────────────────────────────────── */}
      <Modal
        open={showDiscardModal}
        onClose={() => setShowDiscardModal(false)}
        title={isDraft ? "Descartar Rascunho" : "Excluir Ordem de Serviço"}
        subtitle="Essa ação não pode ser desfeita"
        footer={
          <>
            <button onClick={() => setShowDiscardModal(false)} className="flex-1 h-11 rounded-xl border border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 transition-colors">
              Voltar
            </button>
            <button onClick={handleDelete} disabled={discarding}
              className="flex-1 h-11 bg-red-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
              {discarding ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              {isDraft ? "Descartar" : "Excluir"}
            </button>
          </>
        }
      >
        <p className="text-[12px] text-slate-600">
          {isDraft
            ? "Tem certeza que deseja descartar este rascunho de ordem de serviço? Os dados preenchidos serão perdidos."
            : "Tem certeza que deseja excluir esta ordem de serviço? Peças já debitadas do estoque serão devolvidas. Essa ação não pode ser desfeita."}
        </p>
      </Modal>
    </div>
  );
}
