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
  Percent,
  DollarSign,
  Palette,
  FileCheck2,
  FileText,
  ExternalLink,
  Mail,
  Send,
  Wrench,
  Camera as CameraIcon,
  History as HistoryIcon,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../../lib/utils";
import Modal from "../../components/ui/Modal";
import Combobox from "../../components/ui/Combobox";
import { useToast } from "../../components/ui/Toast";
import { computeMeasuredPrice } from "../../utils/measurePricing";
import { onRealtimeAny } from "../../lib/realtime";
import FiscalCodeLookup from "../../components/fiscal/FiscalCodeLookup";
import {
  ServiceOrder,
  ChecklistItem,
  Product,
  CatalogService,
  Customer,
  Seller,
  Technician,
  Tenant,
  fmt,
  maskPhone,
  maskDoc,
  authHeader,
  authHeaderNoJson,
  STATUS_META,
  getStatusOrderForTenant,
  downloadServiceOrderPdf,
  NfseInvoice,
} from "./serviceOrders.shared";
import SalePaymentForm, { SalePaymentFormState, newSalePaymentFormState, parseSalePaymentSettings, computeSalePayment, buildSalePayload } from "../../components/SalePaymentForm";
import { ContentCard, Button, IconButton, Input, Textarea, Badge, Tabs, EmptyState } from "../../components/ui";

type BadgeColor = "default" | "primary" | "success" | "warning" | "danger" | "info" | "purple" | "orange" | "teal";

const STATUS_BADGE: Record<string, BadgeColor> = {
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

const OS_TABS = [
  { id: "atendimento", label: "Atendimento", icon: Wrench },
  { id: "itens", label: "Itens", icon: Receipt },
  { id: "arquivos", label: "Fotos e arquivos", icon: CameraIcon },
  { id: "historico", label: "Histórico", icon: HistoryIcon },
] as const;
type OsTabId = typeof OS_TABS[number]["id"];

export default function ServiceOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<OsTabId>("atendimento");
  const orderId = Number(id);

  const [selected, setSelected] = useState<ServiceOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [products, setProducts] = useState<Product[]>([]);
  const [catalogServices, setCatalogServices] = useState<CatalogService[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [tenant, setTenant] = useState<Tenant | null>(null);

  const [savingField, setSavingField] = useState<string | null>(null);
  const [savedPulse, setSavedPulse] = useState(false);

  const [customerName, setCustomerName] = useState("");
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [customerPhone, setCustomerPhone] = useState("");
  // Nem todo atendimento envolve um aparelho (ex.: reparo de piso/calçada) — quando
  // false, os campos de equipamento abaixo não são exigidos pra iniciar o atendimento.
  const [hasEquipment, setHasEquipment] = useState(true);
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
  const [serviceDescription, setServiceDescription] = useState("");
  const [discountType, setDiscountType] = useState<"percent" | "fixed">("percent");
  const [discountValue, setDiscountValue] = useState(0);
  const [nfseInvoice, setNfseInvoice] = useState<NfseInvoice | null>(null);
  const [nfseCodigoServico, setNfseCodigoServico] = useState("140601");
  const [nfseDescricao, setNfseDescricao] = useState("");
  const [nfseEmitting, setNfseEmitting] = useState(false);
  const [nfseError, setNfseError] = useState<string | null>(null);
  const [warrantyDays, setWarrantyDays] = useState("");
  const [warrantyTerms, setWarrantyTerms] = useState("");
  const [observations, setObservations] = useState("");
  const [linkedQuote, setLinkedQuote] = useState<{
    id: number; number: number; total_amount: number; discount_type: string; discount_value: number;
    items: { id: number; name: string; quantity: number; unit_price: number; total: number; dimensions_label: string | null }[];
    services: { id: number; name: string; unit_price: number; quantity: number; total: number; dimensions_label: string | null }[];
  } | null>(null);

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

  // ── Modal unificado de adicionar item (catálogo / serviços / livre) ───────
  const [showAddPartModal, setShowAddPartModal] = useState(false);
  const [addPartTab, setAddPartTab] = useState<"catalog" | "services" | "free">("catalog");
  const [partSearch, setPartSearch] = useState("");
  const [partSelectedProduct, setPartSelectedProduct] = useState<Product | null>(null);
  const [partSelectedService, setPartSelectedService] = useState<CatalogService | null>(null);
  const [partQty, setPartQty] = useState(1);
  const [partNoCharge, setPartNoCharge] = useState(false);
  const [partDiscountType, setPartDiscountType] = useState<"percent" | "fixed">("percent");
  const [partDiscountValue, setPartDiscountValue] = useState("");
  const [measureHeight, setMeasureHeight] = useState("");
  const [measureWidth, setMeasureWidth] = useState("");
  const [addingPart, setAddingPart] = useState(false);
  const [freePartName, setFreePartName] = useState("");
  const [freePartUnit, setFreePartUnit] = useState("UN");
  const [freePartPrice, setFreePartPrice] = useState("");

  // Edição de desconto de um item já existente
  const [editingDiscountPartId, setEditingDiscountPartId] = useState<number | null>(null);
  const [editDiscountType, setEditDiscountType] = useState<"percent" | "fixed">("percent");
  const [editDiscountValue, setEditDiscountValue] = useState("");
  const [savingItemDiscount, setSavingItemDiscount] = useState(false);

  const [photoUploading, setPhotoUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const arteInputRef = useRef<HTMLInputElement>(null);
  const provaInputRef = useRef<HTMLInputElement>(null);

  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState<SalePaymentFormState>(() => newSalePaymentFormState());
  const [invoicing, setInvoicing] = useState(false);
  const [showReceivableModal, setShowReceivableModal] = useState(false);
  const [receivableDueDate, setReceivableDueDate] = useState("");
  const [launchingReceivable, setLaunchingReceivable] = useState(false);

  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [emailDelivery, setEmailDelivery] = useState<{ sent: boolean; recipient: string | null; sent_at: string | null; attempts: number } | null>(null);
  const [sendingEmail, setSendingEmail] = useState(false);

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
    setHasEquipment(so.has_equipment ?? true);
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
    setServiceDescription(so.service_description ?? "");
    // Pré-preenche a descrição da NFS-e com a Descrição do Serviço já digitada na OS — só na
    // primeira carga (não sobrescreve se o usuário já tiver customizado o campo da nota).
    setNfseDescricao((current) => current || so.service_description || "");
    setDiscountType(so.discount_type ?? "percent");
    setDiscountValue(Number(so.discount_value) || 0);
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

  // OS nascida de um Orçamento de gráfica (ver Tenant.grafica_enabled): busca o
  // orçamento vinculado sob demanda só pra exibir a proposta/preço, somente leitura.
  useEffect(() => {
    if (!selected?.quote_id) { setLinkedQuote(null); return; }
    (async () => {
      const res = await fetch(`/api/quotes/${selected.quote_id}`, { headers: authHeaderNoJson() });
      setLinkedQuote(res.ok ? await res.json() : null);
    })();
  }, [selected?.quote_id]);

  useEffect(() => {
    (async () => {
      const h = authHeaderNoJson();
      const [pRes, svcRes, cRes, sRes, tcRes, tRes] = await Promise.all([
        fetch("/api/products", { headers: h }),
        fetch("/api/services", { headers: h }),
        fetch("/api/customers", { headers: h }),
        fetch("/api/sellers", { headers: h }),
        fetch("/api/technicians", { headers: h }),
        fetch("/api/tenant", { headers: h }),
      ]);
      const [pData, svcData, cData, sData, tcData, tData] = await Promise.all([pRes.json(), svcRes.json(), cRes.json(), sRes.json(), tcRes.json(), tRes.json()]);
      setProducts(Array.isArray(pData) ? pData.filter((p: Product) => p.is_active !== false) : []);
      setCatalogServices(Array.isArray(svcData) ? svcData.filter((s: CatalogService) => s.is_active !== false) : []);
      setCustomers(Array.isArray(cData) ? cData : []);
      setSellers(Array.isArray(sData) ? sData.filter((s: Seller) => s.is_active !== false) : []);
      setTechnicians(Array.isArray(tcData) ? tcData.filter((t: Technician) => t.is_active !== false) : []);
      setTenant(tData ?? null);
    })();
    fetchOrder();
  }, [fetchOrder]);

  // Reflete sozinho mudanças feitas por outro usuário/tela nesta mesma OS
  // (status, faturamento, NFS-e), sem apagar o que está sendo digitado agora.
  useEffect(() => onRealtimeAny(["service-order:changed", "nfse:changed"], (payload) => {
    if (payload?.id === orderId || payload?.serviceOrderId === orderId) fetchOrder(true);
  }), [orderId, fetchOrder]);

  useEffect(() => {
    if (!selected?.id) return;
    fetch(`/api/service-orders/${selected.id}/email-status`, { headers: authHeaderNoJson() })
      .then((res) => res.ok ? res.json() : null)
      .then((data) => setEmailDelivery(data))
      .catch(() => setEmailDelivery(null));
  }, [selected?.id]);

  const handleSendServiceOrderEmail = async () => {
    if (!selected) return;
    setSendingEmail(true);
    try {
      const res = await fetch(`/api/service-orders/${selected.id}/send-email`, { method: "POST", headers: authHeader() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(data?.error || "Não foi possível enviar a ordem de serviço por e-mail."); return; }
      setEmailDelivery((current) => ({ sent: true, recipient: data.recipient, sent_at: data.sent_at, attempts: (current?.attempts || 0) + 1 }));
      await fetchOrder(true);
      toast.success(`Ordem de serviço enviada para ${data.recipient}.`);
    } finally { setSendingEmail(false); }
  };

  const checklistTemplates = tenant?.policies?.service_order_checklists ?? {};
  const categoryOptions = Object.keys(checklistTemplates).map((cat) => ({ value: cat, label: cat }));
  const isDraft = selected?.status === "rascunho";
  // Loja sem o módulo Gráfica não vê/avança pelas etapas de arte (ver Tenant.grafica_enabled).
  const statusOrderForTenant = getStatusOrderForTenant(tenant?.grafica_enabled);
  const customerEmail = customers.find((customer) => customer.id === selected?.customer_id)?.email;

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
      toast.error(err.error || "Falha ao atualizar status");
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
        toast.error(err.error || "Falha ao excluir ordem de serviço");
        setShowDiscardModal(false);
      }
    } finally {
      setDiscarding(false);
    }
  };

  const canStartService = !!customerName && (!hasEquipment || !!equipmentCategory) && !!reportedIssue;

  // ── Parts ───────────────────────────────────────────────────────────────
  const isMeasuredProduct = !!partSelectedProduct?.sale_unit && partSelectedProduct.sale_unit !== "unidade";
  const isMeasuredService = !!partSelectedService?.sale_unit && partSelectedService.sale_unit !== "unidade";
  const isMeasuredSelection = addPartTab === "services" ? isMeasuredService : isMeasuredProduct;

  const openAddPartModal = () => {
    setAddPartTab("catalog");
    setPartSearch("");
    setPartSelectedProduct(null);
    setPartSelectedService(null);
    setPartQty(1);
    setPartNoCharge(false);
    setPartDiscountType("percent");
    setPartDiscountValue("");
    setMeasureHeight("");
    setMeasureWidth("");
    setFreePartName("");
    setFreePartUnit("UN");
    setFreePartPrice("");
    setShowAddPartModal(true);
  };

  // Aplica desconto sobre um valor, mesmo cálculo do backend (applyDiscount em
  // service-orders.controller.ts) — só para preview em tempo real no modal.
  const previewWithDiscount = (amount: number, discountType: "percent" | "fixed", discountValue: number) => {
    const value = Math.max(0, discountValue || 0);
    const discountAmt = discountType === "percent" ? (amount * value) / 100 : Math.min(value, amount);
    return Math.max(0, Math.round((amount - discountAmt) * 100) / 100);
  };

  const measurePreview = isMeasuredProduct && partSelectedProduct
    ? computeMeasuredPrice(
        (partSelectedProduct.sale_unit as "m2" | "linear") ?? "m2",
        Number(partSelectedProduct.price_per_measure) || 0,
        partSelectedProduct.min_billable_quantity ?? null,
        Number(measureHeight) || 0,
        Number(measureWidth) || 0,
      )
    : isMeasuredService && partSelectedService
    ? computeMeasuredPrice(
        (partSelectedService.sale_unit as "m2" | "linear") ?? "m2",
        Number(partSelectedService.price_per_measure) || 0,
        partSelectedService.min_billable_quantity ?? null,
        Number(measureHeight) || 0,
        Number(measureWidth) || 0,
      )
    : null;

  // Preço bruto (antes do desconto do item) do item sendo montado no modal, conforme a aba/modo ativo.
  const addPartRawTotal = partNoCharge ? 0
    : addPartTab === "free" ? Math.max(0, Number(freePartPrice) || 0) * Math.max(1, partQty)
    : isMeasuredSelection ? (measurePreview?.total ?? 0)
    : addPartTab === "services" ? (partSelectedService ? Number(partSelectedService.price) * Math.max(1, partQty) : 0)
    : partSelectedProduct ? Number(partSelectedProduct.price) * Math.max(1, partQty)
    : 0;
  const addPartFinalTotal = partNoCharge ? 0 : previewWithDiscount(addPartRawTotal, partDiscountType, Number(partDiscountValue) || 0);

  const handleAddPartSubmit = async () => {
    if (!selected) return;
    const commonDiscount = { discount_type: partDiscountType, discount_value: Math.max(0, Number(partDiscountValue) || 0) };

    let body: Record<string, unknown>;
    if (addPartTab === "free") {
      if (!freePartName.trim()) return;
      body = {
        name: freePartName.trim(),
        unit: freePartUnit.trim() || "UN",
        quantity: partQty,
        unit_price: Number(freePartPrice) || 0,
        no_charge: partNoCharge,
        ...commonDiscount,
      };
    } else if (addPartTab === "services" && isMeasuredService && partSelectedService) {
      body = {
        service_id: partSelectedService.id,
        height: Number(measureHeight) || 0,
        width: Number(measureWidth) || 0,
        no_charge: partNoCharge,
        ...commonDiscount,
      };
    } else if (addPartTab === "services" && partSelectedService) {
      body = { service_id: partSelectedService.id, quantity: partQty, no_charge: partNoCharge, ...commonDiscount };
    } else if (isMeasuredProduct && partSelectedProduct) {
      body = {
        product_id: partSelectedProduct.id,
        height: Number(measureHeight) || 0,
        width: Number(measureWidth) || 0,
        no_charge: partNoCharge,
        ...commonDiscount,
      };
    } else if (partSelectedProduct) {
      body = { product_id: partSelectedProduct.id, quantity: partQty, no_charge: partNoCharge, ...commonDiscount };
    } else {
      return;
    }

    setAddingPart(true);
    try {
      const res = await fetch(`/api/service-orders/${selected.id}/parts`, {
        method: "POST",
        headers: authHeader(),
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setShowAddPartModal(false);
        await fetchOrder(true);
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Falha ao adicionar item");
      }
    } finally {
      setAddingPart(false);
    }
  };

  const openEditDiscount = (part: ServiceOrder["parts"][number]) => {
    setEditingDiscountPartId(part.id);
    setEditDiscountType(part.discount_type ?? "percent");
    setEditDiscountValue(part.discount_value ? String(part.discount_value) : "");
  };

  const handleSaveItemDiscount = async () => {
    if (!selected || editingDiscountPartId == null) return;
    setSavingItemDiscount(true);
    try {
      const res = await fetch(`/api/service-orders/${selected.id}/parts/${editingDiscountPartId}`, {
        method: "PUT",
        headers: authHeader(),
        body: JSON.stringify({ discount_type: editDiscountType, discount_value: Math.max(0, Number(editDiscountValue) || 0) }),
      });
      if (res.ok) {
        setEditingDiscountPartId(null);
        await fetchOrder(true);
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Falha ao salvar desconto");
      }
    } finally {
      setSavingItemDiscount(false);
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
  const handlePhotoFile = async (file: File, kind: "intake" | "damage" | "arte" | "prova") => {
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
  const invoiceSettings = parseSalePaymentSettings(tenant);
  const invoiceBase = selected ? Number(selected.total_amount) : 0;
  const invoiceCalc = computeSalePayment(invoiceBase, invoiceForm, invoiceSettings);
  const invoiceHasCrediarioWithoutCustomer = invoiceForm.payments.some((p) => p.method === "crediario") && !selected?.customer_id;

  const openInvoiceModal = () => {
    setInvoiceForm(newSalePaymentFormState(invoiceBase > 0 ? invoiceBase.toFixed(2) : ""));
    setShowInvoiceModal(true);
  };

  const handleInvoice = async () => {
    if (!selected) return;
    setInvoicing(true);
    try {
      const res = await fetch(`/api/service-orders/${selected.id}/faturar`, {
        method: "POST",
        headers: authHeader(),
        body: JSON.stringify(buildSalePayload(invoiceBase, invoiceForm, invoiceSettings)),
      });
      if (res.ok) {
        setShowInvoiceModal(false);
        setInvoiceForm(newSalePaymentFormState());
        await fetchOrder(true);
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Falha ao faturar");
      }
    } finally {
      setInvoicing(false);
    }
  };

  const receivable = selected?.accounts_receivable?.[0] || null;

  const formatDueDate = (iso: string) => {
    const [y, m, d] = iso.substring(0, 10).split("-");
    return `${d}/${m}/${y}`;
  };

  const defaultReceivableDueDate = () => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().substring(0, 10);
  };

  const handleLaunchReceivable = async () => {
    if (!selected || !receivableDueDate) return;
    setLaunchingReceivable(true);
    try {
      const res = await fetch(`/api/service-orders/${selected.id}/receivable`, {
        method: "POST",
        headers: authHeader(),
        body: JSON.stringify({ due_date: receivableDueDate }),
      });
      if (res.ok) {
        setShowReceivableModal(false);
        await fetchOrder(true);
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Falha ao lançar em Contas a Receber");
      }
    } finally {
      setLaunchingReceivable(false);
    }
  };

  const filteredParts = products.filter(
    (p) => partSearch && p.name.toLowerCase().includes(partSearch.toLowerCase()) &&
      (p.stock_quantity > 0 || (!!p.sale_unit && p.sale_unit !== "unidade"))
  );

  if (loading) {
    return (
      <div role="status" className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
        <Loader2 size={18} className="animate-spin" />Carregando ordem de serviço…
      </div>
    );
  }
  if (notFound || !selected) {
    return (
      <ContentCard>
        <EmptyState
          icon={AlertTriangle}
          title="Ordem de serviço não encontrada"
          description="A ordem pode ter sido removida."
          action={<Button variant="outline" onClick={() => navigate("/admin/ordens-servico")}>Voltar para ordens de serviço</Button>}
        />
      </ContentCard>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" size="sm" iconLeft={<ChevronLeft size={14} />} onClick={() => navigate("/admin/ordens-servico")}>
          Voltar para ordens de serviço
        </Button>
        <div className="text-[11px] text-slate-500" role="status">
          {savingField && <span>Salvando…</span>}
          {!savingField && savedPulse && (
            <span className="flex items-center gap-1 text-emerald-600"><CheckCircle2 size={12} /> Salvo</span>
          )}
        </div>
      </div>

      <ContentCard padding="md">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-blue-100 bg-blue-50 text-blue-700">
            <Wrench size={22} />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-semibold text-slate-900 sm:text-lg">
              {isDraft ? "Nova ordem de serviço (rascunho)" : `OS #${String(selected.number).padStart(4, "0")}`}
            </h1>
            <p className="mt-0.5 text-xs text-slate-500">
              {[
                selected.customer_name,
                new Date(selected.created_at).toLocaleDateString("pt-BR"),
                isDraft ? "Preencha os dados abaixo — tudo é salvo automaticamente" : "",
              ].filter(Boolean).join(" · ")}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <Badge color={STATUS_BADGE[selected.status] ?? "default"} size="sm" dot>{STATUS_META[selected.status].label}</Badge>
              {selected.priority === "urgente" && <Badge color="danger" size="sm" icon={<AlertTriangle size={11} />}>Urgente</Badge>}
              {selected.invoiced_order_id && (
                <span className="text-xs text-emerald-700">Faturada — Pedido #{selected.invoiced_order_id}</span>
              )}
            </div>
          </div>
          <div className="text-right">
            <p className="text-[11px] text-slate-500">Total</p>
            <p className="text-base font-semibold tabular-nums text-slate-900">{fmt(selected.total_amount)}</p>
          </div>
        </div>
      </ContentCard>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:items-start">
        <div className="min-w-0 lg:col-span-2">
          <Tabs<OsTabId> items={OS_TABS} value={activeTab} onChange={setActiveTab} label="Detalhes da ordem de serviço">
            {activeTab === "atendimento" && (
              <div className="space-y-3">
          {/* Status */}
          <ContentCard padding="md">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-medium text-slate-700">Andamento da ordem</p>
              {selected.invoiced_order_id && (
                <span className="text-[11px] font-semibold text-emerald-600">Faturada — Pedido #{selected.invoiced_order_id}</span>
              )}
            </div>

            {selected.status === "cancelada" ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-2">
                <p className="text-[11px] font-semibold text-red-600 flex items-center gap-1.5"><Ban size={13} /> Ordem Cancelada</p>
                {selected.cancel_reason && <p className="text-[11px] text-red-500 mt-1">Motivo: {selected.cancel_reason}</p>}
                <Button variant="ghost" size="sm" onClick={() => setShowDiscardModal(true)}>
                  Excluir Ordem de Serviço
                </Button>
              </div>
            ) : isDraft ? (
              <div className="flex items-center gap-2 flex-wrap">
                <Button variant="primary" size="sm" onClick={() => changeStatus("orcamento_enviado")}
                  disabled={!canStartService}>
                  Marcar Orçamento como Enviado <ArrowRight size={13} />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShowDiscardModal(true)}>
                  Descartar rascunho
                </Button>
                {!canStartService && (
                  <span className="text-[11px] text-slate-400">
                    {hasEquipment ? "Preencha cliente, categoria e detalhes do atendimento" : "Preencha cliente e detalhes do atendimento"}
                  </span>
                )}
              </div>
            ) : (
              <>
                <div className="flex items-center gap-1 mb-3">
                  {statusOrderForTenant.filter((s) => s !== "rascunho" && s !== "cancelada").map((s) => {
                    const currentIdx = statusOrderForTenant.indexOf(selected.status);
                    const idx = statusOrderForTenant.indexOf(s);
                    const isDone = idx <= currentIdx;
                    return (
                      <div key={s} className="flex-1 flex items-center gap-1">
                        <div className={cn("flex-1 h-1.5 rounded-full transition-all", isDone ? "bg-blue-500" : "bg-slate-200")} />
                      </div>
                    );
                  })}
                </div>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {statusOrderForTenant.filter((s) => s !== "rascunho" && s !== "cancelada").map((s) => {
                    const currentIdx = statusOrderForTenant.indexOf(selected.status);
                    const idx = statusOrderForTenant.indexOf(s);
                    const isCurrent = idx === currentIdx;
                    const isDone = idx < currentIdx;
                    return (
                      <span key={s} className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded",
                        isCurrent ? "bg-blue-100 text-blue-700" : isDone ? "text-emerald-600" : "text-slate-300")}>
                        {STATUS_META[s].label}
                      </span>
                    );
                  })}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {(() => {
                    const currentIdx = statusOrderForTenant.indexOf(selected.status);
                    const next = statusOrderForTenant[currentIdx + 1];
                    // Faturada só pode seguir para "entregue" — as demais ações (cancelar/excluir/pular etapa) ficam bloqueadas.
                    if (selected.invoiced_order_id) {
                      return next === "entregue" ? (
                        <Button variant="primary" size="sm" onClick={() => changeStatus(next)}>
                          Avançar para: {STATUS_META[next].label} <ArrowRight size={13} />
                        </Button>
                      ) : (
                        <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1"><CheckCircle2 size={13} /> Concluída</span>
                      );
                    }
                    return next && next !== "cancelada" ? (
                      <>
                        <Button variant="primary" size="sm" onClick={() => changeStatus(next)} className="shrink-0">
                          Avançar para: {STATUS_META[next].label} <ArrowRight size={13} />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setShowCancelModal(true)}>
                          Cancelar Ordem
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setShowDiscardModal(true)}>
                          Excluir Ordem de Serviço
                        </Button>
                      </>
                    ) : (
                      <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1"><CheckCircle2 size={13} /> Concluída</span>
                    );
                  })()}
                </div>
              </>
            )}
          </ContentCard>

          {/* Cliente */}
          <ContentCard padding="md" className="space-y-3">
            <p className="text-[10px] font-semibold text-slate-400">Cliente</p>
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
              <IconButton variant="outline" size="sm" type="button"
                onClick={() => { setNcName(""); setNcPhone(""); setNcDoc(""); setNcEmail(""); setShowNewCustomer(true); }}
                
                title="Cadastrar novo cliente" className="justify-center shrink-0" aria-label="Cadastrar novo cliente">
                <UserPlus size={15} />
              </IconButton>
            </div>
            <Input value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              onBlur={() => autosaveField({ customer_phone: customerPhone || null }, "customer_phone")}
              placeholder="Telefone" />
          </ContentCard>

          {/* Equipamento */}
          <ContentCard padding="md" className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-semibold text-slate-400">
                {hasEquipment ? "Equipamento" : "Detalhes do Atendimento"}
              </p>
              <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
                {([
                  { v: true, label: "Tem equipamento" },
                  { v: false, label: "Sem equipamento" },
                ] as const).map(({ v, label }) => (
                  <button
                    key={String(v)}
                    type="button"
                    onClick={() => {
                      setHasEquipment(v);
                      autosaveField({ has_equipment: v }, "has_equipment");
                    }}
                    className={cn(
                      "h-6 px-2 rounded-md text-[10px] font-semibold transition-all",
                      hasEquipment === v ? "bg-slate-900 text-white shadow-sm" : "text-slate-500 hover:text-slate-700"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {hasEquipment && (
              <>
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
                  <IconButton variant="outline" size="sm" type="button"
                    onClick={() => { setNcatName(""); setNcatItems([""]); setShowNewCategory(true); }}
                    
                    title="Criar nova categoria" className="justify-center shrink-0" aria-label="Criar nova categoria">
                    <PlusCircle size={15} />
                  </IconButton>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Input value={equipmentType} onChange={(e) => setEquipmentType(e.target.value)} onBlur={() => autosaveField({ equipment_type: equipmentType || null }, "equipment_type")} placeholder="Tipo (ex: Notebook Gamer)" />
                  <Input value={equipmentBrand} onChange={(e) => setEquipmentBrand(e.target.value)} onBlur={() => autosaveField({ equipment_brand: equipmentBrand || null }, "equipment_brand")} placeholder="Marca" />
                  <Input value={equipmentModel} onChange={(e) => setEquipmentModel(e.target.value)} onBlur={() => autosaveField({ equipment_model: equipmentModel || null }, "equipment_model")} placeholder="Modelo" />
                  <Input value={equipmentSerial} onChange={(e) => setEquipmentSerial(e.target.value)} onBlur={() => autosaveField({ equipment_serial: equipmentSerial || null }, "equipment_serial")} placeholder="Série / IMEI" />
                </div>
                <Textarea value={equipmentAccessories}
                  onChange={(e) => setEquipmentAccessories(e.target.value)}
                  onBlur={() => autosaveField({ equipment_accessories: equipmentAccessories || null }, "equipment_accessories")}
                  placeholder="Acessórios entregues junto (carregador, capa, etc.)"
                  rows={2} />
              </>
            )}

            <div>
              <label className="text-[10px] font-semibold text-amber-500 mb-1.5 block">Detalhes do Atendimento</label>
              <Textarea value={reportedIssue}
                onChange={(e) => setReportedIssue(e.target.value)}
                onBlur={() => autosaveField({ reported_issue: reportedIssue || null }, "reported_issue")}
                placeholder="Descreva a solicitação, observações ou detalhes informados pelo cliente..."
                rows={2} />
            </div>
          </ContentCard>

          {/* Checklist */}
          {selected.checklist_items.length > 0 && (
            <ContentCard padding="md">
              <p className="text-[10px] font-semibold text-slate-400 mb-2">Checklist de Entrada</p>
              <div className="space-y-2">
                {selected.checklist_items.sort((a, b) => a.position - b.position).map((item) => (
                  <div key={item.id} className="bg-slate-50 rounded-lg border border-slate-200 p-3">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <p className="text-[12px] font-semibold text-slate-700 flex-1">{item.label}</p>
                      <div className="flex bg-slate-100 border border-slate-200 rounded-lg p-0.5 gap-0.5 shrink-0">
                        {(["sim", "nao", "na"] as const).map((a) => (
                          <button key={a} onClick={() => updateChecklistItem(item.id, { answer: a })}
                            className={cn("h-6 px-2 rounded-md text-[10px] font-semibold transition-all",
                              item.answer === a
                                ? a === "sim" ? "bg-emerald-600 text-white" : a === "nao" ? "bg-red-500 text-white" : "bg-slate-500 text-white"
                                : "text-slate-400")}>
                            {a === "sim" ? "Sim" : a === "nao" ? "Não" : "N/A"}
                          </button>
                        ))}
                      </div>
                    </div>
                    <Input value={item.observation ?? ""}
                      onChange={(e) => updateChecklistItem(item.id, { observation: e.target.value })}
                      placeholder="Observação (opcional)" />
                  </div>
                ))}
              </div>
              <Button variant="outline" size="sm" onClick={saveChecklist} className="mt-2">
                Salvar Checklist
              </Button>
            </ContentCard>
          )}

              </div>
            )}
            {activeTab === "itens" && (
              <div className="space-y-3">
          {/* Orçamento vinculado */}
          {linkedQuote && (
            <ContentCard padding="md">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <p className="text-[10px] font-semibold text-slate-400">
                  Orçamento vinculado #{String(linkedQuote.number).padStart(4, "0")}
                </p>
                <Button variant="outline" size="xs" onClick={() => navigate(`/admin/orcamentos/${linkedQuote.id}`)}>
                  Ver orçamento completo <ExternalLink size={11} />
                </Button>
              </div>
              <div className="flex flex-col gap-1.5">
                {linkedQuote.items.map((item) => (
                  <div key={`item-${item.id}`} className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-600 truncate">{item.name} {item.dimensions_label && <span className="text-blue-400 font-mono">{item.dimensions_label}</span>} × {item.quantity}</span>
                    <span className="font-mono font-semibold text-slate-700 shrink-0 ml-2">{fmt(item.total)}</span>
                  </div>
                ))}
                {linkedQuote.services.map((svc) => (
                  <div key={`svc-${svc.id}`} className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-600 truncate">{svc.name} {svc.dimensions_label && <span className="text-blue-400 font-mono">{svc.dimensions_label}</span>} × {svc.quantity}</span>
                    <span className="font-mono font-semibold text-slate-700 shrink-0 ml-2">{fmt(svc.total)}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
                <span className="text-[11px] font-semibold text-slate-400">Total do orçamento</span>
                <span className="font-mono font-semibold text-slate-900">{fmt(linkedQuote.total_amount)}</span>
              </div>
            </ContentCard>
          )}

          {/* Peças */}
          <ContentCard padding="md">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-semibold text-slate-400">Peças / Itens / Serviços</p>
              {!selected.invoiced_order_id && (
                <Button variant="primary" size="sm" onClick={openAddPartModal}>
                  <Plus size={13} /> Adicionar item
                </Button>
              )}
            </div>
            {selected.parts.length === 0 ? (
              <p className="text-[11px] text-slate-400">Nenhum item adicionado</p>
            ) : (
              <div className="space-y-1.5">
                {selected.parts.map((part) => {
                  const hasDiscount = !part.no_charge && Number(part.discount_value) > 0 && Number(part.total) < Number(part.total_before_discount);
                  return (
                    <div key={part.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2 border border-slate-200">
                      <div className="min-w-0">
                        <p className="text-[12px] font-semibold text-slate-700 truncate">{part.name}</p>
                        {part.dimensions_label ? (
                          <p className="text-[11px] text-blue-500 font-mono">{part.dimensions_label}</p>
                        ) : (
                          <p className="text-[11px] text-slate-400">{part.quantity} {part.unit} × {fmt(part.unit_price)}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {part.no_charge ? (
                          <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">Sem cobrança</span>
                        ) : hasDiscount ? (
                          <div className="flex flex-col items-end">
                            <span className="text-[10px] font-mono text-slate-400 line-through">{fmt(part.total_before_discount)}</span>
                            <span className="text-[12px] font-mono font-semibold text-emerald-600">{fmt(part.total)}</span>
                          </div>
                        ) : (
                          <span className="text-[12px] font-mono font-semibold text-slate-700">{fmt(part.total)}</span>
                        )}
                        {!selected.invoiced_order_id && (
                          <>
                            <IconButton variant="ghost" size="sm" onClick={() => openEditDiscount(part)} title="Desconto" aria-label="Desconto">
                              <Percent size={13} />
                            </IconButton>
                            <IconButton variant="ghost" size="sm" onClick={() => handleRemovePart(part.id)} aria-label="Remover item">
                              <Trash2 size={13} />
                            </IconButton>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ContentCard>

              </div>
            )}
            {activeTab === "arquivos" && (
              <div className="space-y-3">
          {/* Fotos / Anexos */}
          <ContentCard padding="md">
            <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
              <p className="text-[10px] font-semibold text-slate-400">
                {tenant?.grafica_enabled ? "Fotos e Arquivos" : "Fotos"}
              </p>
              <div className="flex gap-1.5 flex-wrap">
                <Button variant="outline" size="xs" onClick={() => fileInputRef.current?.click()} disabled={photoUploading}>
                  <ImagePlus size={11} /> Galeria
                </Button>
                <Button variant="outline" size="xs" onClick={() => cameraInputRef.current?.click()} disabled={photoUploading}>
                  <Camera size={11} /> Câmera
                </Button>
                {tenant?.grafica_enabled && (
                  <>
                    <Button variant="outline" size="xs" onClick={() => arteInputRef.current?.click()} disabled={photoUploading}>
                      <Palette size={11} /> Arte final
                    </Button>
                    <Button variant="outline" size="xs" onClick={() => provaInputRef.current?.click()} disabled={photoUploading}>
                      <FileCheck2 size={11} /> Prova
                    </Button>
                  </>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden"
                onChange={(e) => { const files = e.target.files; if (files) Array.from(files).forEach((f) => handlePhotoFile(f, "intake")); e.target.value = ""; }} />
              <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhotoFile(f, "intake"); e.target.value = ""; }} />
              <input ref={arteInputRef} type="file" accept="image/*,application/pdf" multiple className="hidden"
                onChange={(e) => { const files = e.target.files; if (files) Array.from(files).forEach((f) => handlePhotoFile(f, "arte")); e.target.value = ""; }} />
              <input ref={provaInputRef} type="file" accept="image/*,application/pdf" multiple className="hidden"
                onChange={(e) => { const files = e.target.files; if (files) Array.from(files).forEach((f) => handlePhotoFile(f, "prova")); e.target.value = ""; }} />
            </div>
            {photoUploading && <p className="text-[11px] text-slate-400 mb-2">Enviando arquivo...</p>}
            {selected.photos.length === 0 ? (
              <p className="text-[11px] text-slate-400">Nenhum arquivo anexado</p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {selected.photos.map((photo) => {
                  const isPdf = photo.url.toLowerCase().endsWith(".pdf");
                  const kindMeta: Record<string, { label: string; className: string }> = {
                    intake: { label: "Entrada", className: "bg-blue-500 text-white" },
                    damage: { label: "Avaria", className: "bg-red-500 text-white" },
                    arte: { label: "Arte", className: "bg-violet-500 text-white" },
                    prova: { label: "Prova", className: "bg-emerald-500 text-white" },
                  };
                  const meta = kindMeta[photo.kind] ?? kindMeta.intake;
                  return (
                    <a key={photo.id} href={photo.url} target="_blank" rel="noreferrer"
                      className="relative group rounded-lg overflow-hidden border border-slate-200 aspect-square block">
                      {isPdf ? (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-1 bg-slate-50 text-slate-400">
                          <FileText size={22} />
                          <span className="text-[10px] font-semibold">PDF</span>
                        </div>
                      ) : (
                        <img src={photo.url} alt={photo.caption ?? ""} className="w-full h-full object-cover" />
                      )}
                      <span className={cn("absolute top-1 left-1 px-1.5 py-0.5 rounded text-[10px] font-semibold", meta.className)}>
                        {meta.label}
                      </span>
                      <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleRemovePhoto(photo.id); }}
                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <X size={10} />
                      </button>
                    </a>
                  );
                })}
              </div>
            )}
          </ContentCard>

              </div>
            )}
            {activeTab === "historico" && (
              <div className="space-y-3">
          {selected.actions && selected.actions.length > 0 ? (
            <ContentCard padding="md">
              <p className="text-[10px] font-semibold text-slate-400 mb-2">Histórico</p>
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
                      <p className="text-slate-400 text-[11px]">{a.actor ?? "Sistema"} · {new Date(a.created_at).toLocaleString("pt-BR")}</p>
                    </div>
                  </div>
                ))}
              </div>
            </ContentCard>
          ) : (
            <ContentCard><EmptyState icon={HistoryIcon} title="Nenhum registro no histórico" /></ContentCard>
          )}
              </div>
            )}
          </Tabs>
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          {/* Responsável / Prioridade / Previsão */}
          <ContentCard padding="md" className="space-y-3">
            <p className="text-[10px] font-semibold text-slate-400">Responsável</p>
            <div className="flex bg-slate-100 border border-slate-200 rounded-lg p-0.5 gap-0.5 w-fit">
              {(["seller", "technician", "external"] as const).map((m) => (
                <button key={m} onClick={() => {
                  setResponsibleMode(m);
                  if (m === "seller") autosaveField({ technician_id: null, technician_name: null }, "responsible");
                  else if (m === "technician") autosaveField({ seller_id: null, technician_name: null }, "responsible");
                  else autosaveField({ seller_id: null, technician_id: null }, "responsible");
                }}
                  className={cn("h-8 px-3 rounded-lg text-[11px] font-semibold transition-all", responsibleMode === m ? "bg-blue-600 text-white" : "text-slate-500")}>
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
              <Input value={technicianName}
                onChange={(e) => setTechnicianName(e.target.value)}
                onBlur={() => autosaveField({ technician_name: technicianName || null }, "technician_name")}
                placeholder="Nome do técnico/prestador externo" />
            )}

            <p className="text-[10px] font-semibold text-slate-400 pt-2">Prioridade</p>
            <div className="flex bg-slate-100 border border-slate-200 rounded-lg p-0.5 gap-0.5">
              {(["normal", "urgente"] as const).map((p) => (
                <button key={p} type="button" onClick={() => { setPriority(p); autosaveField({ priority: p }, "priority"); }}
                  className={cn("flex-1 h-9 rounded-lg text-[11px] font-semibold transition-all flex items-center justify-center gap-1",
                    priority === p ? (p === "urgente" ? "bg-red-500 text-white" : "bg-blue-600 text-white") : "text-slate-500")}>
                  {p === "urgente" && <AlertTriangle size={11} />}
                  {p === "normal" ? "Normal" : "Urgente"}
                </button>
              ))}
            </div>

            <p className="text-[10px] font-semibold text-slate-400 pt-2">Previsão de Entrega</p>
            <div className="relative">
              <CalendarClock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input
                type="date"
                value={promisedAt}
                onChange={(e) => setPromisedAt(e.target.value)}
                onBlur={() => autosaveField({ promised_at: promisedAt || null }, "promised_at")}
                className="w-full pl-9 pr-3 h-10 rounded-lg border border-slate-200 text-[12px] font-medium focus:outline-none focus:border-blue-400"
              />
            </div>
          </ContentCard>

          {/* Valor / total */}
          <ContentCard padding="md" className="space-y-3">
            <p className="text-[10px] font-semibold text-slate-400">Valor da Mão de Obra</p>
            <div className="relative">
              <Banknote className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input
                type="number" min="0" step="0.01"
                value={serviceValue}
                onChange={(e) => setServiceValue(e.target.value)}
                onBlur={() => autosaveField({ service_value: Number(serviceValue) || 0 }, "service_value")}
                placeholder="0,00"
                disabled={!!selected.invoiced_order_id}
                className="w-full pl-9 pr-3 h-10 rounded-lg border border-slate-200 text-[13px] font-mono font-semibold focus:outline-none focus:border-blue-400 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none disabled:bg-slate-50 disabled:text-slate-400"
              />
            </div>

            <div>
              <label className="text-[10px] font-semibold text-slate-400 mb-1.5 block">Descrição do Serviço</label>
              <Textarea value={serviceDescription}
                onChange={(e) => setServiceDescription(e.target.value)}
                onBlur={() => autosaveField({ service_description: serviceDescription || null }, "service_description")}
                placeholder="O que foi feito — ex.: troca de tela, limpeza interna, revisão elétrica..."
                rows={2}
                disabled={!!selected.invoiced_order_id} />
            </div>

            <div>
              <label className="text-[10px] font-semibold text-slate-400 mb-1.5 block">Desconto total da OS</label>
              <div className="flex gap-1">
                <button disabled={!!selected.invoiced_order_id} onClick={() => { setDiscountType("percent"); autosaveField({ discount_type: "percent" }, "discount"); }}
                  className={cn("h-9 w-9 rounded-lg border flex items-center justify-center transition-all disabled:opacity-40",
                    discountType === "percent" ? "bg-blue-600 text-white border-blue-600" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50")}>
                  <Percent size={14} />
                </button>
                <button disabled={!!selected.invoiced_order_id} onClick={() => { setDiscountType("fixed"); autosaveField({ discount_type: "fixed" }, "discount"); }}
                  className={cn("h-9 w-9 rounded-lg border flex items-center justify-center transition-all disabled:opacity-40",
                    discountType === "fixed" ? "bg-blue-600 text-white border-blue-600" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50")}>
                  <DollarSign size={14} />
                </button>
                <Input type="number" min={0} value={discountValue || ""}
                  onChange={(e) => setDiscountValue(Number(e.target.value))}
                  onBlur={() => autosaveField({ discount_value: discountValue }, "discount")}
                  placeholder={discountType === "percent" ? "%" : "R$"}
                  disabled={!!selected.invoiced_order_id} wrapperClassName="flex-1" className="font-mono" />
              </div>
            </div>

            <div className="bg-slate-900 rounded-lg p-4 space-y-1.5">
              {linkedQuote && (
                <div className="flex justify-between text-[11px] font-semibold text-blue-300">
                  <span>Orçamento #{String(linkedQuote.number).padStart(4, "0")}</span>
                  <span className="font-mono">{fmt(linkedQuote.total_amount)}</span>
                </div>
              )}
              <div className="flex justify-between text-[11px] font-semibold text-slate-400">
                <span>Mão de obra</span>
                <span className="font-mono text-slate-200">{fmt(selected.service_value)}</span>
              </div>
              <div className="flex justify-between text-[11px] font-semibold text-slate-400">
                <span>Peças adicionais</span>
                <span className="font-mono text-slate-200">{fmt(selected.parts_total)}</span>
              </div>
              {Number(selected.discount_value) > 0 && (
                <div className="flex justify-between text-[11px] font-semibold text-amber-400">
                  <span>Desconto</span>
                  <span className="font-mono">
                    {selected.discount_type === "percent" ? `-${selected.discount_value}%` : `-${fmt(selected.discount_value)}`}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-[13px] font-semibold text-white pt-1.5 border-t border-slate-700">
                <span>Total</span>
                <span className="font-mono">{fmt(selected.total_amount)}</span>
              </div>
            </div>
          </ContentCard>

          {/* NFS-e — emitida sobre a mão de obra (peças já geram NFC-e na venda) */}
          {Number(selected.service_value) > 0 && (
            <ContentCard padding="md" className="space-y-3">
              <p className="text-[10px] font-semibold text-slate-400">NFS-e (Serviço)</p>
              {nfseInvoice?.status === "authorized" ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 rounded-lg px-3 py-2.5">
                    <CheckCircle2 size={14} />
                    <span className="text-[11px] font-semibold">
                      NFS-e autorizada — Série {nfseInvoice.serie}/{nfseInvoice.numero}
                    </span>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleOpenNfsePdf} className="w-full">
                    Ver PDF da NFS-e
                  </Button>
                </div>
              ) : selected.status !== "finalizado" && selected.status !== "nota_emitida" ? (
                <p className="text-[11px] font-semibold text-slate-400">Disponível quando a ordem estiver finalizada.</p>
              ) : (
                <>
                  {nfseInvoice && (nfseInvoice.status === "pending" || nfseInvoice.status === "processing") && (
                    <div className="flex items-center gap-2 text-amber-600 bg-amber-50 rounded-lg px-3 py-2.5">
                      <Loader2 size={14} className="animate-spin" />
                      <span className="text-[11px] font-semibold">Processando emissão…</span>
                    </div>
                  )}
                  {nfseInvoice?.status === "rejected" || nfseInvoice?.status === "error" ? (
                    <p className="text-[11px] font-semibold text-red-600">{nfseInvoice.rejection_reason || "Falha na emissão"}</p>
                  ) : null}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-semibold text-slate-400 block mb-1">Cód. Serviço</label>
                      <Input value={nfseCodigoServico} onChange={(e) => setNfseCodigoServico(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        placeholder="140601" className="font-mono" />
                      <div className="mt-1.5">
                        <FiscalCodeLookup kind="nfse-service" token={localStorage.getItem("token")} onSelect={(item) => { setNfseCodigoServico(item.code); setNfseDescricao((current) => current || item.description); }} />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-slate-400 block mb-1">Descrição do Serviço</label>
                      <Input value={nfseDescricao} onChange={(e) => setNfseDescricao(e.target.value)}
                        placeholder="O que foi feito — obrigatório para a prefeitura" />
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={handleEmitNfse} disabled={nfseEmitting || !nfseCodigoServico || !nfseDescricao.trim()} className="w-full justify-center">
                    {nfseEmitting ? <Loader2 size={13} className="animate-spin" /> : null}
                    {nfseEmitting ? "Emitindo…" : "Emitir NFS-e"}
                  </Button>
                  {nfseError && <p className="text-[11px] font-semibold text-red-600">{nfseError}</p>}
                </>
              )}
            </ContentCard>
          )}

          {/* Garantia */}
          <ContentCard padding="md" className="space-y-3">
            <p className="text-[10px] font-semibold text-slate-400">Termo de Garantia (opcional)</p>
            <div className="flex gap-2">
              <div className="relative w-24 shrink-0">
                <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input
                  type="number" min="0"
                  value={warrantyDays}
                  onChange={(e) => setWarrantyDays(e.target.value)}
                  onBlur={() => autosaveField({ warranty_days: warrantyDays ? Number(warrantyDays) : null }, "warranty_days")}
                  placeholder="Dias"
                  className="w-full pl-8 pr-2 h-10 rounded-lg border border-slate-200 text-[12px] font-mono font-semibold focus:outline-none focus:border-blue-400 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
              <Input value={warrantyTerms}
                onChange={(e) => setWarrantyTerms(e.target.value)}
                onBlur={() => autosaveField({ warranty_terms: warrantyTerms || null }, "warranty_terms")}
                placeholder="Condições da garantia" wrapperClassName="flex-1" />
            </div>
          </ContentCard>

          {/* Observações */}
          <ContentCard padding="md" className="space-y-2">
            <p className="text-[10px] font-semibold text-slate-400">Observações Internas do Técnico</p>
            <Textarea value={observations}
              onChange={(e) => setObservations(e.target.value)}
              onBlur={() => autosaveField({ observations: observations || null }, "observations")}
              placeholder="Anotações internas, diagnóstico, etc."
              rows={3} />
          </ContentCard>

          {/* Ações */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Button variant="outline" size="md" onClick={handleGeneratePdf} disabled={generatingPdf} className="justify-center">
              {generatingPdf ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />} Gerar PDF
            </Button>
            {customerEmail ? (
              <Button variant="primary" size="md" onClick={handleSendServiceOrderEmail} loading={sendingEmail} iconLeft={emailDelivery?.sent ? <Send size={14} /> : <Mail size={14} />} className="justify-center">
                {emailDelivery?.sent ? "Reenviar por E-mail" : "Enviar por E-mail"}
              </Button>
            ) : (
              <div className="flex items-center justify-center rounded-lg border border-amber-200 bg-amber-50 px-3 text-center text-[10px] font-semibold text-amber-700">Cadastre o e-mail do cliente para enviar a OS.</div>
            )}
            {!selected.invoiced_order_id && (selected.status === "finalizado" || selected.status === "nota_emitida") && (
              <Button variant="success" size="md" onClick={openInvoiceModal} className="justify-center">
                <Receipt size={14} /> Faturar
              </Button>
            )}
          </div>
          {emailDelivery?.sent && emailDelivery.sent_at && <p className="text-center text-[10px] font-semibold text-emerald-600">Enviado para {emailDelivery.recipient} em {new Date(emailDelivery.sent_at).toLocaleString("pt-BR")}</p>}

          {!selected.invoiced_order_id && (selected.status === "finalizado" || selected.status === "nota_emitida") && (
            receivable ? (
              <div className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-amber-50 border border-amber-200">
                <CalendarClock size={13} className="text-amber-600" />
                <span className="text-[11px] font-semibold text-amber-700">
                  A receber — vence em {formatDueDate(receivable.due_date)}
                </span>
              </div>
            ) : (
              <Button variant="ghost" size="md" onClick={() => { setReceivableDueDate(defaultReceivableDueDate()); setShowReceivableModal(true); }} className="w-full justify-center">
                <CalendarClock size={14} /> Lançar a Receber
              </Button>
            )
          )}
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
            <Button variant="outline" size="sm" onClick={() => setShowNewCustomer(false)} className="flex-1">
              Cancelar
            </Button>
            <Button variant="primary" size="sm" disabled={savingNC || !ncName.trim()}
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
              }} className="flex-1">
              {savingNC ? "Cadastrando…" : "Criar Cliente"}
            </Button>
          </>
        }
      >
        <div>
          <label className="text-[11px] font-semibold text-slate-500 block mb-1">Nome *</label>
          <Input value={ncName} onChange={(e) => setNcName(e.target.value)} placeholder="Nome completo" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[11px] font-semibold text-slate-500 block mb-1">Telefone</label>
            <Input value={ncPhone} onChange={(e) => setNcPhone(maskPhone(e.target.value))} inputMode="numeric"
              placeholder="(11) 99999-9999" />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-slate-500 block mb-1">CPF/CNPJ</label>
            <Input value={ncDoc} onChange={(e) => setNcDoc(maskDoc(e.target.value))} inputMode="numeric"
              placeholder="000.000.000-00" />
          </div>
        </div>
        <div>
          <label className="text-[11px] font-semibold text-slate-500 block mb-1">E-mail</label>
          <Input type="email" value={ncEmail} onChange={(e) => setNcEmail(e.target.value)} placeholder="email@exemplo.com" />
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
            <Button variant="outline" size="md" onClick={() => setShowNewCategory(false)} className="flex-1">
              Cancelar
            </Button>
            <Button variant="primary" size="md" onClick={handleCreateCategory}
              disabled={savingCategory || !ncatName.trim()} className="flex-1 justify-center">
              {savingCategory ? <Loader2 size={14} className="animate-spin" /> : <PlusCircle size={14} />}
              Criar Categoria
            </Button>
          </>
        }
      >
        <div>
          <label className="text-[10px] font-semibold text-slate-400 mb-1.5 block">Nome da Categoria</label>
          <Input value={ncatName}
            onChange={(e) => setNcatName(e.target.value)}
            placeholder="Ex: Notebook, Som, Celular..." />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[10px] font-semibold text-slate-400">Itens do Checklist (opcional)</label>
            <Button variant="outline" size="xs" onClick={() => setNcatItems((prev) => [...prev, ""])}>
              <PlusCircle size={10} /> Item
            </Button>
          </div>
          <div className="space-y-2">
            {ncatItems.map((item, idx) => (
              <div key={idx} className="flex gap-2 items-center">
                <div className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px] font-semibold shrink-0">
                  {idx + 1}
                </div>
                <Input value={item}
                  onChange={(e) => setNcatItems((prev) => prev.map((v, i) => (i === idx ? e.target.value : v)))}
                  placeholder="Ex: Liga, Tela sem trincos..." wrapperClassName="flex-1" />
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
          <p className="text-[11px] text-slate-400 mt-2">Você pode adicionar ou ajustar itens depois em Configurações → Checklists de OS.</p>
        </div>
      </Modal>

      {/* ── ADD PART MODAL (catálogo / medida / item livre + desconto) ─────── */}
      <Modal
        open={showAddPartModal}
        onClose={() => setShowAddPartModal(false)}
        title="Adicionar item"
        subtitle={isMeasuredSelection ? `Venda por ${(addPartTab === "services" ? partSelectedService!.sale_unit : partSelectedProduct!.sale_unit) === "m2" ? "m²" : "metro linear"}` : undefined}
        size="lg"
        footer={
          <>
            <Button variant="outline" size="md" onClick={() => setShowAddPartModal(false)} className="flex-1">
              Cancelar
            </Button>
            <Button variant="primary" size="md" onClick={handleAddPartSubmit}
              disabled={
                addingPart ||
                (addPartTab === "free" ? !freePartName.trim() :
                  isMeasuredSelection ? !measurePreview || measurePreview.rawQuantity <= 0 :
                  addPartTab === "services" ? !partSelectedService :
                  !partSelectedProduct)
              } className="flex-1 justify-center">
              {addingPart ? <Loader2 size={14} className="animate-spin" /> : <PlusCircle size={14} />}
              Adicionar
            </Button>
          </>
        }
      >
        {/* Abas */}
        <div className="flex gap-1.5 p-1 bg-slate-100 rounded-lg">
          <button onClick={() => { setAddPartTab("catalog"); setFreePartName(""); setPartSelectedService(null); }}
            className={cn("flex-1 h-8 rounded-lg text-[11px] font-semibold transition-all",
              addPartTab === "catalog" ? "bg-white text-blue-600 shadow-sm" : "text-slate-400 hover:text-slate-600")}>
            Catálogo
          </button>
          <button onClick={() => { setAddPartTab("services"); setPartSelectedProduct(null); setFreePartName(""); setMeasureHeight(""); setMeasureWidth(""); }}
            className={cn("flex-1 h-8 rounded-lg text-[11px] font-semibold transition-all",
              addPartTab === "services" ? "bg-white text-blue-600 shadow-sm" : "text-slate-400 hover:text-slate-600")}>
            Serviços
          </button>
          <button onClick={() => { setAddPartTab("free"); setPartSelectedProduct(null); setPartSelectedService(null); }}
            className={cn("flex-1 h-8 rounded-lg text-[11px] font-semibold transition-all",
              addPartTab === "free" ? "bg-white text-blue-600 shadow-sm" : "text-slate-400 hover:text-slate-600")}>
            Item Livre
          </button>
        </div>

        {addPartTab === "services" ? (
          <div className="space-y-3">
            <Combobox
              placeholder="Buscar serviço no catálogo..."
              searchPlaceholder="Nome do serviço..."
              value={partSelectedService ? String(partSelectedService.id) : ""}
              onChange={(v) => {
                const service = catalogServices.find((s) => String(s.id) === v);
                setPartSelectedService(service ?? null);
                setMeasureHeight("");
                setMeasureWidth("");
              }}
              options={catalogServices.map((s) => ({
                value: String(s.id),
                label: s.name,
                description: s.sale_unit && s.sale_unit !== "unidade"
                  ? `${fmt(s.price_per_measure ?? 0)}/${s.sale_unit === "m2" ? "m²" : "m"}`
                  : fmt(s.price),
              }))}
            />

            {partSelectedService && isMeasuredService && (
              partSelectedService.sale_unit === "m2" ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-semibold text-slate-400 mb-1.5 block">Altura (m)</label>
                    <Input type="number" min="0" step="0.01" autoFocus value={measureHeight}
                      onChange={(e) => setMeasureHeight(e.target.value)}
                      placeholder="0,00" className="font-mono text-center" />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-slate-400 mb-1.5 block">Largura (m)</label>
                    <Input type="number" min="0" step="0.01" value={measureWidth}
                      onChange={(e) => setMeasureWidth(e.target.value)}
                      placeholder="0,00" className="font-mono text-center" />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="text-[10px] font-semibold text-slate-400 mb-1.5 block">Comprimento (m)</label>
                  <Input type="number" min="0" step="0.01" autoFocus value={measureHeight}
                    onChange={(e) => setMeasureHeight(e.target.value)}
                    placeholder="0,00" className="font-mono text-center" />
                </div>
              )
            )}

            {partSelectedService && !isMeasuredService && (
              <div>
                <label className="text-[10px] font-semibold text-slate-400 mb-1.5 block">Quantidade</label>
                <Input type="number" min="1" value={partQty} onChange={(e) => setPartQty(Math.max(1, Number(e.target.value) || 1))} wrapperClassName="w-24" className="font-mono text-center" />
              </div>
            )}

            {measurePreview && isMeasuredService && measurePreview.rawQuantity > 0 && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1">
                <div className="flex justify-between text-[11px] font-semibold text-slate-400">
                  <span>{partSelectedService!.sale_unit === "m2" ? "Área" : "Comprimento"}</span>
                  <span className="font-mono text-slate-600">{measurePreview.label}</span>
                </div>
                {measurePreview.minimumApplied && (
                  <p className="text-[11px] font-semibold text-amber-600">
                    Cobrando o mínimo de {Number(partSelectedService!.min_billable_quantity).toFixed(2)}{partSelectedService!.sale_unit === "m2" ? "m²" : "m"}
                  </p>
                )}
              </div>
            )}
          </div>
        ) : addPartTab === "catalog" ? (
          <div className="space-y-3">
            <Combobox
              placeholder="Buscar produto ou serviço no catálogo..."
              searchPlaceholder="Nome do produto..."
              value={partSelectedProduct ? String(partSelectedProduct.id) : ""}
              onChange={(v) => {
                const product = products.find((p) => String(p.id) === v);
                setPartSelectedProduct(product ?? null);
                setMeasureHeight("");
                setMeasureWidth("");
              }}
              options={filteredParts.length > 0 ? filteredParts.map((p) => ({ value: String(p.id), label: p.name, description: `${fmt(p.price)} · estoque ${p.stock_quantity}` }))
                : products.filter((p) => p.stock_quantity > 0 || (!!p.sale_unit && p.sale_unit !== "unidade")).slice(0, 20).map((p) => ({ value: String(p.id), label: p.name, description: p.sale_unit && p.sale_unit !== "unidade" ? `${fmt(p.price_per_measure ?? 0)}/${p.sale_unit === "m2" ? "m²" : "m"}`:`${fmt(p.price)} · estoque ${p.stock_quantity}` }))}
            />

            {partSelectedProduct && isMeasuredProduct && (
              partSelectedProduct.sale_unit === "m2" ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-semibold text-slate-400 mb-1.5 block">Altura (m)</label>
                    <Input type="number" min="0" step="0.01" autoFocus value={measureHeight}
                      onChange={(e) => setMeasureHeight(e.target.value)}
                      placeholder="0,00" className="font-mono text-center" />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-slate-400 mb-1.5 block">Largura (m)</label>
                    <Input type="number" min="0" step="0.01" value={measureWidth}
                      onChange={(e) => setMeasureWidth(e.target.value)}
                      placeholder="0,00" className="font-mono text-center" />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="text-[10px] font-semibold text-slate-400 mb-1.5 block">Comprimento (m)</label>
                  <Input type="number" min="0" step="0.01" autoFocus value={measureHeight}
                    onChange={(e) => setMeasureHeight(e.target.value)}
                    placeholder="0,00" className="font-mono text-center" />
                </div>
              )
            )}

            {partSelectedProduct && !isMeasuredProduct && (
              <div>
                <label className="text-[10px] font-semibold text-slate-400 mb-1.5 block">Quantidade</label>
                <Input type="number" min="1" value={partQty} onChange={(e) => setPartQty(Math.max(1, Number(e.target.value) || 1))} wrapperClassName="w-24" className="font-mono text-center" />
              </div>
            )}

            {measurePreview && isMeasuredProduct && measurePreview.rawQuantity > 0 && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1">
                <div className="flex justify-between text-[11px] font-semibold text-slate-400">
                  <span>{partSelectedProduct!.sale_unit === "m2" ? "Área" : "Comprimento"}</span>
                  <span className="font-mono text-slate-600">{measurePreview.label}</span>
                </div>
                {measurePreview.minimumApplied && (
                  <p className="text-[11px] font-semibold text-amber-600">
                    Cobrando o mínimo de {Number(partSelectedProduct!.min_billable_quantity).toFixed(2)}{partSelectedProduct!.sale_unit === "m2" ? "m²" : "m"}
                  </p>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <Input value={freePartName} onChange={(e) => setFreePartName(e.target.value)} placeholder="Descrição (ex: Corte de vidro, Mão de obra extra)" />
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] font-semibold text-slate-400 mb-1.5 block">Unidade</label>
                <Input value={freePartUnit} onChange={(e) => setFreePartUnit(e.target.value.toUpperCase().slice(0, 10))} placeholder="Un" className="text-center" />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-400 mb-1.5 block">Qtd.</label>
                <Input type="number" min="1" value={partQty} onChange={(e) => setPartQty(Math.max(1, Number(e.target.value) || 1))} className="text-center" />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-400 mb-1.5 block">Valor unit.</label>
                <Input type="number" min="0" step="0.01" value={freePartPrice} onChange={(e) => setFreePartPrice(e.target.value)}
                  placeholder="0,00" disabled={partNoCharge} className="font-mono" />
              </div>
            </div>
          </div>
        )}

        {/* Desconto do item + cortesia — comum às três abas */}
        {(partSelectedProduct || partSelectedService || addPartTab === "free") && (
          <div className="border-t border-slate-100 pt-3 space-y-3">
            <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 cursor-pointer">
              <input type="checkbox" checked={partNoCharge} onChange={(e) => setPartNoCharge(e.target.checked)} className="w-3.5 h-3.5 accent-blue-600" />
              Sem cobrança (cortesia)
            </label>

            {!partNoCharge && (
              <div>
                <label className="text-[10px] font-semibold text-slate-400 mb-1.5 block">Desconto neste item</label>
                <div className="flex gap-2">
                  <div className="flex bg-slate-100 rounded-lg p-1 shrink-0">
                    <button onClick={() => setPartDiscountType("percent")}
                      className={cn("h-9 w-9 rounded-lg flex items-center justify-center transition-all", partDiscountType === "percent" ? "bg-white text-blue-600 shadow-sm" : "text-slate-400")}>
                      <Percent size={14} />
                    </button>
                    <button onClick={() => setPartDiscountType("fixed")}
                      className={cn("h-9 w-9 rounded-lg flex items-center justify-center transition-all", partDiscountType === "fixed" ? "bg-white text-blue-600 shadow-sm" : "text-slate-400")}>
                      <DollarSign size={14} />
                    </button>
                  </div>
                  <Input type="number" min="0" step="0.01" value={partDiscountValue} onChange={(e) => setPartDiscountValue(e.target.value)}
                    placeholder={partDiscountType === "percent" ? "0%" : "R$ 0,00"} wrapperClassName="flex-1" className="font-mono" />
                </div>
              </div>
            )}

            {/* Preview do valor final */}
            <div className="bg-slate-900 rounded-lg p-4 space-y-1.5">
              {!partNoCharge && Number(partDiscountValue) > 0 && (
                <div className="flex justify-between text-[11px] font-semibold text-slate-400">
                  <span>Antes do desconto</span>
                  <span className="font-mono text-slate-400 line-through">{fmt(addPartRawTotal)}</span>
                </div>
              )}
              <div className="flex justify-between text-[13px] font-semibold text-white pt-1.5 border-t border-slate-700">
                <span>Total do item</span>
                <span className="font-mono">{fmt(addPartFinalTotal)}</span>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* ── EDIT ITEM DISCOUNT MODAL ────────────────────────────────────────── */}
      <Modal
        open={editingDiscountPartId != null}
        onClose={() => setEditingDiscountPartId(null)}
        title="Desconto do item"
        size="sm"
        footer={
          <>
            <Button variant="outline" size="md" onClick={() => setEditingDiscountPartId(null)} className="flex-1">
              Cancelar
            </Button>
            <Button variant="primary" size="md" onClick={handleSaveItemDiscount} disabled={savingItemDiscount} className="flex-1 justify-center">
              {savingItemDiscount ? <Loader2 size={14} className="animate-spin" /> : null}
              Salvar
            </Button>
          </>
        }
      >
        <div className="flex gap-2">
          <div className="flex bg-slate-100 rounded-lg p-1 shrink-0">
            <button onClick={() => setEditDiscountType("percent")}
              className={cn("h-9 w-9 rounded-lg flex items-center justify-center transition-all", editDiscountType === "percent" ? "bg-white text-blue-600 shadow-sm" : "text-slate-400")}>
              <Percent size={14} />
            </button>
            <button onClick={() => setEditDiscountType("fixed")}
              className={cn("h-9 w-9 rounded-lg flex items-center justify-center transition-all", editDiscountType === "fixed" ? "bg-white text-blue-600 shadow-sm" : "text-slate-400")}>
              <DollarSign size={14} />
            </button>
          </div>
          <Input type="number" min="0" step="0.01" autoFocus value={editDiscountValue} onChange={(e) => setEditDiscountValue(e.target.value)}
            placeholder={editDiscountType === "percent" ? "0%" : "R$ 0,00"} wrapperClassName="flex-1" className="font-mono" />
        </div>
      </Modal>

      {/* ── INVOICE MODAL ────────────────────────────────────────────────── */}
      <Modal
        open={showInvoiceModal}
        onClose={() => setShowInvoiceModal(false)}
        size="md"
        title={`Faturar OS #${String(selected.number).padStart(4, "0")}`}
        subtitle={selected.customer_name || undefined}
        footer={
          <>
            <Button variant="outline" size="md" onClick={() => setShowInvoiceModal(false)} className="flex-1">
              Cancelar
            </Button>
            <Button variant="success" size="md" onClick={handleInvoice} loading={invoicing}
              disabled={invoicing || invoiceCalc.paidAmount <= 0 || invoiceHasCrediarioWithoutCustomer}
              iconLeft={<CheckCircle2 size={14} />} className="flex-1 justify-center">
              Confirmar Faturamento
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <span className="text-[11px] text-slate-500">Total da OS</span>
            <span className="font-mono text-base font-semibold text-slate-900">{fmt(invoiceBase)}</span>
          </div>
          <SalePaymentForm
            state={invoiceForm}
            onChange={setInvoiceForm}
            settings={invoiceSettings}
            baseAmount={invoiceBase}
            baseLabel="Total da OS"
            sellers={sellers}
            hasCustomer={!!selected.customer_id}
          />
        </div>
      </Modal>

      {/* ── LANÇAR A RECEBER MODAL ───────────────────────────────────────── */}
      <Modal
        open={showReceivableModal}
        onClose={() => setShowReceivableModal(false)}
        title={`Lançar a Receber — OS #${String(selected.number).padStart(4, "0")}`}
        subtitle="O cliente ainda não pagou, mas a OS já foi finalizada"
        footer={
          <>
            <Button variant="outline" size="md" onClick={() => setShowReceivableModal(false)} className="flex-1">
              Cancelar
            </Button>
            <Button variant="ghost" size="md" onClick={handleLaunchReceivable} disabled={launchingReceivable || !receivableDueDate} className="flex-1 justify-center">
              {launchingReceivable ? <Loader2 size={14} className="animate-spin" /> : <CalendarClock size={14} />}
              Lançar a Receber
            </Button>
          </>
        }
      >
        <div>
          <label className="text-[10px] font-semibold text-slate-400 mb-1.5 block">Data prevista de recebimento</label>
          <Input type="date" autoFocus value={receivableDueDate} onChange={(e) => setReceivableDueDate(e.target.value)} />
        </div>
        <div className="bg-slate-50 rounded-lg p-3 space-y-1.5">
          <div className="flex justify-between text-[11px] font-semibold text-slate-500">
            <span>Valor</span>
            <span className="font-mono text-slate-800">{fmt(selected.total_amount)}</span>
          </div>
          <div className="flex justify-between text-[11px] font-semibold text-slate-500">
            <span>Cliente</span>
            <span className="text-slate-800">{selected.customer_name}</span>
          </div>
        </div>
        <p className="text-[11px] text-slate-400">
          Isso cria um lançamento em Contas a Receber com a categoria "Serviço". Se você faturar essa OS depois com pagamento imediato, este lançamento é removido automaticamente.
        </p>
      </Modal>

      {/* ── CANCELAR MODAL ───────────────────────────────────────────────── */}
      <Modal
        open={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        title="Cancelar Ordem de Serviço"
        subtitle="Essa ação não pode ser desfeita"
        footer={
          <>
            <Button variant="outline" size="md" onClick={() => setShowCancelModal(false)} className="flex-1">
              Voltar
            </Button>
            <Button variant="danger" size="md" onClick={handleConfirmCancel} disabled={cancelling} className="flex-1 justify-center">
              {cancelling ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
              Confirmar Cancelamento
            </Button>
          </>
        }
      >
        <div>
          <label className="text-[10px] font-semibold text-slate-400 mb-1.5 block">Motivo (opcional)</label>
          <Textarea value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Descreva o motivo do cancelamento..."
            rows={3} />
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
            <Button variant="outline" size="md" onClick={() => setShowDiscardModal(false)} className="flex-1">
              Voltar
            </Button>
            <Button variant="danger" size="md" onClick={handleDelete} disabled={discarding} className="flex-1 justify-center">
              {discarding ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              {isDraft ? "Descartar" : "Excluir"}
            </Button>
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
