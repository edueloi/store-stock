import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Truck, Plus, Phone, MapPin, User, MessageCircle, Tag, Info,
  Edit3, Trash2, Globe, Mail, Building2, CreditCard, X,
  ExternalLink, ChevronDown, ChevronUp, Search, Package,
  Wallet, Loader2, ArrowRight, AlertCircle, HelpCircle,
} from "lucide-react";
import {
  Button, IconButton, Input, Textarea, Select, Modal, ModalFooter, Tabs,
  PageWrapper, SectionTitle, StatGrid, StatCard,
  FilterLine, FilterLineSection, FilterLineItem, FilterLineSearch, FilterLineViewToggle,
} from "../../components/ui";
import { EmptyState, LoadingState } from "../../components/layout/EmptyState";
import { Supplier } from "../../types";
import SuppliersPageTour, { SUPPLIERS_PAGE_TOUR_EVENTS, type SuppliersPageTourHandle } from "../../components/onboarding/SuppliersPageTour";

const EMPTY: Partial<Supplier> = {
  name: "", category: "", contact_person: "", phone: "", whatsapp: "",
  email: "", website: "", cnpj: "", address: "", city: "", state: "",
  payment_terms: "", notes: "",
};

const PAYMENT_OPTIONS = [
  "À vista", "30 dias", "30/60 dias", "30/60/90 dias",
  "Boleto 30 dias", "Pix à vista", "Consignado", "Outro",
];

const STATES = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

function formatCNPJ(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

function formatPhone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 10) return d.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3");
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3");
}

function whatsappHref(phone: string) {
  return `https://wa.me/55${phone.replace(/\D/g, "")}`;
}

function SupplierAvatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const sizes = { sm: "w-8 h-8 text-xs", md: "w-10 h-10 text-sm", lg: "w-14 h-14 text-lg" };
  const colors = ["bg-blue-100 text-blue-600 border-blue-200", "bg-violet-100 text-violet-600 border-violet-200",
    "bg-emerald-100 text-emerald-600 border-emerald-200", "bg-amber-100 text-amber-600 border-amber-200",
    "bg-rose-100 text-rose-600 border-rose-200", "bg-cyan-100 text-cyan-600 border-cyan-200"];
  const color = colors[name.charCodeAt(0) % colors.length];
  return (
    <div className={`${sizes[size]} ${color} border-2 rounded-lg flex items-center justify-center font-semibold shrink-0`}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function QuickContact({ supplier }: { supplier: Supplier }) {
  return (
    <div className="flex items-center gap-1">
      {supplier.whatsapp && (
        <a href={whatsappHref(supplier.whatsapp)} target="_blank" rel="noopener noreferrer"
          title="WhatsApp"
          className="w-7 h-7 flex items-center justify-center bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg transition-all border border-emerald-100">
          <MessageCircle size={13} />
        </a>
      )}
      {supplier.phone && !supplier.whatsapp && (
        <a href={`tel:${supplier.phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer"
          title="Ligar"
          className="w-7 h-7 flex items-center justify-center bg-slate-50 text-slate-500 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-all border border-slate-200">
          <Phone size={13} />
        </a>
      )}
      {supplier.email && (
        <a href={`mailto:${supplier.email}`}
          title="E-mail"
          className="w-7 h-7 flex items-center justify-center bg-slate-50 text-slate-500 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-all border border-slate-200">
          <Mail size={13} />
        </a>
      )}
      {supplier.website && (
        <a href={supplier.website.startsWith("http") ? supplier.website : `https://${supplier.website}`}
          target="_blank" rel="noopener noreferrer"
          title="Site"
          className="w-7 h-7 flex items-center justify-center bg-slate-50 text-slate-500 hover:bg-violet-50 hover:text-violet-600 rounded-lg transition-all border border-slate-200">
          <Globe size={13} />
        </a>
      )}
    </div>
  );
}

interface SupplierBill {
  id: number;
  description: string;
  amount: number;
  due_date: string;
  paid_date: string | null;
  status: string;
}
interface SupplierSummary {
  totalPending: number;
  totalPaid: number;
  billsCount: number;
  recentBills: SupplierBill[];
}
const fmtMoney = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const STATUS_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  pending:   { label: "Pendente", color: "text-amber-600", bg: "bg-amber-50 border-amber-200" },
  overdue:   { label: "Vencido",  color: "text-rose-600",  bg: "bg-rose-50 border-rose-200" },
  paid:      { label: "Pago",     color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200" },
  cancelled: { label: "Cancelado", color: "text-slate-400", bg: "bg-slate-50 border-slate-200" },
};

const detailTabs = [
  { id: "contato", label: "Contato", icon: Phone },
  { id: "contas", label: "Contas a Pagar", icon: Wallet },
  { id: "comercial", label: "Comercial", icon: CreditCard },
] as const;
type DetailTab = typeof detailTabs[number]["id"];

const formTabs = [
  { id: "geral", label: "Geral", icon: Building2 },
  { id: "contato", label: "Contato", icon: Phone },
  { id: "local", label: "Localização", icon: MapPin },
] as const;
type FormTab = typeof formTabs[number]["id"];

function SupplierDetailModal({ supplier, onClose, onEdit }: {
  supplier: Supplier; onClose: () => void; onEdit: () => void;
}) {
  const [summary, setSummary] = useState<SupplierSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [tab, setTab] = useState<DetailTab>("contato");

  useEffect(() => {
    setLoadingSummary(true);
    fetch(`/api/suppliers/${supplier.id}/summary`, { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } })
      .then(r => r.json())
      .then(setSummary)
      .catch(() => setSummary(null))
      .finally(() => setLoadingSummary(false));
  }, [supplier.id]);

  const subtitle = [supplier.category, supplier.cnpj].filter(Boolean).join(" · ");

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={supplier.name}
      subtitle={subtitle}
      footer={
        <ModalFooter align="between">
          <p className="text-[11px] text-slate-500">
            Cadastrado em {new Date(supplier.created_at).toLocaleDateString("pt-BR")}
          </p>
          <Button size="sm" iconLeft={<Edit3 size={14} />} onClick={onEdit}>Editar Fornecedor</Button>
        </ModalFooter>
      }
    >
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <SupplierAvatar name={supplier.name} size="md" />
          <QuickContact supplier={supplier} />
        </div>
        <Tabs<DetailTab> items={detailTabs} value={tab} onChange={setTab} label="Detalhes do fornecedor">
          {tab === "contato" && (
            <div className="space-y-4">
              <section>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {supplier.contact_person && (
                    <div className="flex items-center gap-2.5 bg-slate-50 rounded-lg px-3 py-2.5 border border-slate-100">
                      <User size={13} className="text-slate-400 shrink-0" />
                      <div>
                        <p className="text-[11px] text-slate-500 font-medium">Responsável</p>
                        <p className="text-xs font-medium text-slate-700">{supplier.contact_person}</p>
                      </div>
                    </div>
                  )}
                  {supplier.phone && (
                    <div className="flex items-center gap-2.5 bg-slate-50 rounded-lg px-3 py-2.5 border border-slate-100">
                      <Phone size={13} className="text-slate-400 shrink-0" />
                      <div>
                        <p className="text-[11px] text-slate-500 font-medium">Telefone</p>
                        <p className="text-xs font-medium text-slate-700">{supplier.phone}</p>
                      </div>
                    </div>
                  )}
                  {supplier.whatsapp && (
                    <a href={whatsappHref(supplier.whatsapp)} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2.5 bg-emerald-50 rounded-lg px-3 py-2.5 border border-emerald-100 hover:bg-emerald-100 transition-colors">
                      <MessageCircle size={13} className="text-emerald-500 shrink-0" />
                      <div>
                        <p className="text-[11px] text-emerald-600 font-medium">WhatsApp</p>
                        <p className="text-xs font-medium text-emerald-700">{supplier.whatsapp}</p>
                      </div>
                      <ExternalLink size={10} className="text-emerald-400 ml-auto" />
                    </a>
                  )}
                  {supplier.email && (
                    <a href={`mailto:${supplier.email}`}
                      className="flex items-center gap-2.5 bg-blue-50 rounded-lg px-3 py-2.5 border border-blue-100 hover:bg-blue-100 transition-colors">
                      <Mail size={13} className="text-blue-500 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[11px] text-blue-600 font-medium">E-mail</p>
                        <p className="text-xs font-medium text-blue-700 truncate max-w-[150px]">{supplier.email}</p>
                      </div>
                      <ExternalLink size={10} className="text-blue-400 ml-auto" />
                    </a>
                  )}
                  {supplier.website && (
                    <a href={supplier.website.startsWith("http") ? supplier.website : `https://${supplier.website}`}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2.5 bg-violet-50 rounded-lg px-3 py-2.5 border border-violet-100 hover:bg-violet-100 transition-colors">
                      <Globe size={13} className="text-violet-500 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[11px] text-violet-600 font-medium">Site</p>
                        <p className="text-xs font-medium text-violet-700 truncate max-w-[150px]">{supplier.website}</p>
                      </div>
                      <ExternalLink size={10} className="text-violet-400 ml-auto" />
                    </a>
                  )}
                </div>
              </section>

              {(supplier.address || supplier.city || supplier.state) && (
                <section>
                  <h3 className="text-xs font-semibold text-slate-800 mb-2">Localização</h3>
                  <div className="flex items-start gap-2.5 bg-slate-50 rounded-lg px-3 py-2.5 border border-slate-100">
                    <MapPin size={13} className="text-slate-400 shrink-0 mt-0.5" />
                    <div>
                      {supplier.address && <p className="text-xs font-medium text-slate-700">{supplier.address}</p>}
                      {(supplier.city || supplier.state) && (
                        <p className="text-[11px] text-slate-500">{[supplier.city, supplier.state].filter(Boolean).join(" — ")}</p>
                      )}
                    </div>
                  </div>
                </section>
              )}
            </div>
          )}

          {tab === "contas" && (
            <section>
              {/* Contas a Pagar deste fornecedor — casado por nome (sem vínculo formal ainda) */}
              {summary && summary.billsCount > 0 && (
                <div className="flex justify-end mb-2">
                  <Link
                    to={`/admin/contas-pagar?fornecedor=${encodeURIComponent(supplier.name)}`}
                    className="flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:text-blue-800"
                  >
                    Ver todas <ArrowRight size={10} />
                  </Link>
                </div>
              )}
              {loadingSummary ? (
                <div className="flex items-center justify-center py-6"><Loader2 size={16} className="animate-spin text-slate-300" /></div>
              ) : !summary || summary.billsCount === 0 ? (
                <div className="flex items-center gap-2.5 bg-slate-50 rounded-lg px-3 py-3 border border-slate-100 text-slate-500">
                  <Wallet size={13} className="shrink-0" />
                  <p className="text-[11px] font-medium">Nenhuma conta a pagar lançada para este fornecedor ainda.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="bg-amber-50 rounded-lg px-3 py-2.5 border border-amber-100">
                      <p className="text-[11px] text-amber-600 font-medium flex items-center gap-1"><AlertCircle size={10} /> Em aberto</p>
                      <p className="text-sm font-mono font-medium text-amber-700">R$ {fmtMoney(summary.totalPending)}</p>
                    </div>
                    <div className="bg-emerald-50 rounded-lg px-3 py-2.5 border border-emerald-100">
                      <p className="text-[11px] text-emerald-600 font-medium">Total pago</p>
                      <p className="text-sm font-mono font-medium text-emerald-700">R$ {fmtMoney(summary.totalPaid)}</p>
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-100 divide-y divide-slate-50 overflow-hidden">
                    {summary.recentBills.map((b) => {
                      // due_date vem como ISO completo — corta pros 10 primeiros caracteres
                      // antes de comparar (concatenar direto gera uma Date inválida).
                      const isOverdue = b.status === "pending" && new Date(b.due_date.substring(0, 10) + "T23:59:59") < new Date();
                      const st = STATUS_LABEL[isOverdue ? "overdue" : b.status] ?? STATUS_LABEL.pending;
                      return (
                        <div key={b.id} className="flex items-center justify-between gap-2 px-3 py-2 bg-white">
                          <div className="min-w-0">
                            <p className="text-[11px] font-medium text-slate-700 truncate">{b.description}</p>
                            <p className="text-[11px] text-slate-500">Venc. {new Date(b.due_date).toLocaleDateString("pt-BR")}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[11px] font-mono font-medium text-slate-700">R$ {fmtMoney(b.amount)}</span>
                            <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded-full border ${st.bg} ${st.color}`}>{st.label}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>
          )}

          {tab === "comercial" && (
            <div className="space-y-4">
              {supplier.payment_terms && (
                <section>
                  <h3 className="text-xs font-semibold text-slate-800 mb-2">Condições Comerciais</h3>
                  <div className="flex items-center gap-2.5 bg-slate-50 rounded-lg px-3 py-2.5 border border-slate-100">
                    <CreditCard size={13} className="text-slate-400 shrink-0" />
                    <div>
                      <p className="text-[11px] text-slate-500 font-medium">Prazo de Pagamento</p>
                      <p className="text-xs font-medium text-slate-700">{supplier.payment_terms}</p>
                    </div>
                  </div>
                </section>
              )}
              {supplier.notes && (
                <section>
                  <h3 className="text-xs font-semibold text-slate-800 mb-2">Notas Internas</h3>
                  <div className="flex items-start gap-2.5 bg-amber-50 rounded-lg px-3 py-2.5 border border-amber-100">
                    <Info size={13} className="text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-800 leading-relaxed whitespace-pre-wrap">{supplier.notes}</p>
                  </div>
                </section>
              )}
              {!supplier.payment_terms && !supplier.notes && (
                <p className="text-xs text-slate-500 py-2">Nenhuma condição comercial ou nota registrada.</p>
              )}
            </div>
          )}
        </Tabs>
      </div>
    </Modal>
  );
}

function SupplierCard({ supplier, onEdit, onDelete, onView, editTourTag }: {
  supplier: Supplier; onEdit: () => void; onDelete: () => void; onView: () => void; editTourTag?: string;
}) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm hover:shadow-sm hover:border-slate-300 transition-all overflow-hidden">
      {/* Top */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <button onClick={onView} className="flex items-center gap-3 text-left group flex-1 min-w-0">
            <SupplierAvatar name={supplier.name} size="md" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-900 group-hover:text-blue-600 transition-colors truncate">{supplier.name}</p>
              <div className="flex items-center gap-1 mt-0.5">
                <Tag size={9} className="text-slate-400 shrink-0" />
                <span className="text-[10px] font-semibold text-slate-400 truncate">{supplier.category}</span>
              </div>
              {supplier.contact_person && (
                <div className="flex items-center gap-1 mt-0.5">
                  <User size={9} className="text-slate-300 shrink-0" />
                  <span className="text-[10px] text-slate-400 truncate">{supplier.contact_person}</span>
                </div>
              )}
            </div>
          </button>
          <div className="flex items-center gap-1 shrink-0">
            <IconButton size="sm" aria-label="Editar fornecedor" title="Editar" {...(editTourTag ? { "data-tour": editTourTag } : {})} onClick={onEdit}>
              <Edit3 size={14} />
            </IconButton>
            <IconButton size="sm" variant="danger" aria-label="Remover fornecedor" title="Remover" onClick={onDelete}>
              <Trash2 size={14} />
            </IconButton>
          </div>
        </div>
      </div>

      {/* Quick contact bar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-100 bg-slate-50/50">
        <div className="flex items-center gap-1.5">
          {supplier.city && (
            <span className="flex items-center gap-1 text-[10px] text-slate-400 font-medium">
              <MapPin size={9} className="text-slate-300" />
              {[supplier.city, supplier.state].filter(Boolean).join(" / ")}
            </span>
          )}
          {!supplier.city && supplier.address && (
            <span className="flex items-center gap-1 text-[10px] text-slate-400">
              <MapPin size={9} className="text-slate-300" /> {supplier.address}
            </span>
          )}
          {supplier.payment_terms && !supplier.city && !supplier.address && (
            <span className="flex items-center gap-1 text-[10px] text-slate-400">
              <CreditCard size={9} className="text-slate-300" /> {supplier.payment_terms}
            </span>
          )}
        </div>
        <QuickContact supplier={supplier} />
      </div>
    </div>
  );
}

type ViewMode = "grid" | "list";

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Supplier>>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [viewing, setViewing] = useState<Supplier | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [formTab, setFormTab] = useState<FormTab>("geral");
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const suppliersPageTourRef = React.useRef<SuppliersPageTourHandle>(null);

  const authHeaders = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  });

  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/suppliers", { headers: authHeaders() });
      const data = await res.json();
      setSuppliers(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSuppliers(); }, []);

  const openNew = () => { setFormTab("geral"); setEditing(EMPTY); setIsModalOpen(true); };
  const openEdit = (s: Supplier) => { setFormTab("geral"); setViewing(null); setEditing(s); setIsModalOpen(true); };
  const closeModal = () => { setIsModalOpen(false); setEditing(EMPTY); };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const method = editing.id ? "PUT" : "POST";
      const url = editing.id ? `/api/suppliers/${editing.id}` : "/api/suppliers";
      const res = await fetch(url, { method, headers: authHeaders(), body: JSON.stringify(editing) });
      if (res.ok) { closeModal(); fetchSuppliers(); }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Remover este fornecedor?")) return;
    await fetch(`/api/suppliers/${id}`, { method: "DELETE", headers: authHeaders() });
    if (viewing?.id === id) setViewing(null);
    fetchSuppliers();
  };

  const filtered = suppliers.filter((s) =>
    [s.name, s.category, s.contact_person, s.city, s.email, s.cnpj]
      .some((v) => v?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const toggleRow = (id: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const set = (field: keyof Supplier, value: string) =>
    setEditing((prev) => ({ ...prev, [field]: value }));

  // ── Canal de comunicação do TOUR DE PÁGINA (SuppliersPageTour) ────────────
  // Suppliers.tsx não tinha nenhum canal de tour antes; este é o primeiro.
  // Abre/preenche/fecha o modal de verdade via openNew/openEdit/set/
  // closeModal — nunca handleSave (POST/PUT real em /api/suppliers) nem
  // handleDelete (DELETE real).
  useEffect(() => {
    const onOpenNewSupplier = () => openNew();
    const onFillSupplier = (e: Event) => {
      const detail = (e as CustomEvent<Partial<Supplier>>).detail;
      if (detail) setEditing((prev) => ({ ...prev, ...detail }));
    };
    const onCloseSupplierModal = () => closeModal();
    const onOpenEditSupplier = () => {
      const list = Array.isArray(suppliers) ? suppliers : [];
      if (list.length > 0) openEdit(list[0]);
    };

    window.addEventListener(SUPPLIERS_PAGE_TOUR_EVENTS.openNewSupplier, onOpenNewSupplier);
    window.addEventListener(SUPPLIERS_PAGE_TOUR_EVENTS.fillSupplier, onFillSupplier);
    window.addEventListener(SUPPLIERS_PAGE_TOUR_EVENTS.closeSupplierModal, onCloseSupplierModal);
    window.addEventListener(SUPPLIERS_PAGE_TOUR_EVENTS.openEditSupplier, onOpenEditSupplier);
    return () => {
      window.removeEventListener(SUPPLIERS_PAGE_TOUR_EVENTS.openNewSupplier, onOpenNewSupplier);
      window.removeEventListener(SUPPLIERS_PAGE_TOUR_EVENTS.fillSupplier, onFillSupplier);
      window.removeEventListener(SUPPLIERS_PAGE_TOUR_EVENTS.closeSupplierModal, onCloseSupplierModal);
      window.removeEventListener(SUPPLIERS_PAGE_TOUR_EVENTS.openEditSupplier, onOpenEditSupplier);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suppliers]);

  return (
    <PageWrapper data-tour="suppliers-page">
    <div className="space-y-4">
      <SectionTitle
        icon={Truck}
        title="Fornecedores"
        description="Cadeia de suprimentos e parceiros"
        action={
          <>
            <Button size="sm" data-tour="suppliers-new-btn" iconLeft={<Plus size={14} />} onClick={openNew}>
              Novo Fornecedor
            </Button>
            <Button
              size="sm"
              variant="outline"
              iconLeft={<HelpCircle size={14} />}
              onClick={() => suppliersPageTourRef.current?.start()}
              title="Tour guiado desta página"
            >
              <span className="sr-only sm:not-sr-only">Ajuda</span>
            </Button>
          </>
        }
      />

      <SuppliersPageTour ref={suppliersPageTourRef} />

      {/* Stats */}
      <StatGrid cols={3}>
        <StatCard title="Total" value={suppliers.length} icon={Truck} color="info" />
        <StatCard title="Filtrados" value={filtered.length} icon={Search} color="default" />
        <StatCard title="Com WhatsApp" value={suppliers.filter((s) => s.whatsapp).length} icon={MessageCircle} color="success" />
      </StatGrid>

      {/* Search + view toggle */}
      <FilterLine>
        <FilterLineSection grow>
          <FilterLineItem grow>
            <FilterLineSearch
              aria-label="Buscar fornecedores"
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Buscar por nome, categoria, cidade, CNPJ..."
            />
          </FilterLineItem>
        </FilterLineSection>
        <FilterLineSection align="right">
          <div data-tour="suppliers-view-toggle">
            <FilterLineViewToggle<ViewMode> value={viewMode} onChange={setViewMode} gridValue="grid" listValue="list" />
          </div>
        </FilterLineSection>
      </FilterLine>

      {loading ? (
        <LoadingState />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Truck size={32} strokeWidth={1} />}
          title={searchTerm ? "Nenhum fornecedor encontrado" : "Nenhum fornecedor cadastrado"}
          description="Cadastre fornecedores para gerenciar sua cadeia de suprimentos."
          action={!searchTerm && <Button icon={<Plus size={14} />} onClick={openNew}>Adicionar Fornecedor</Button>}
        />
      ) : viewMode === "grid" ? (
        /* Grid view */
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((s, idx) => (
            <SupplierCard
              key={s.id}
              supplier={s}
              onView={() => setViewing(s)}
              onEdit={() => openEdit(s)}
              onDelete={() => handleDelete(s.id)}
              editTourTag={idx === 0 ? "suppliers-edit-btn" : undefined}
            />
          ))}
        </div>
      ) : (
        /* List / accordion view */
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm divide-y divide-slate-100">
          {/* Table header */}
          <div className="hidden sm:grid grid-cols-[1fr_1fr_auto_auto] gap-4 px-5 py-2.5 bg-slate-50 border-b border-slate-200">
            <span className="text-[10px] font-semibold text-slate-400">Fornecedor</span>
            <span className="text-[10px] font-semibold text-slate-400">Contato</span>
            <span className="text-[10px] font-semibold text-slate-400">Ações Rápidas</span>
            <span />
          </div>

          {filtered.map((s, idx) => {
            const expanded = expandedRows.has(s.id);
            return (
              <div key={s.id}>
                {/* Row */}
                <div className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_1fr_auto_auto] items-center gap-4 px-5 py-3 hover:bg-slate-50/60 transition-colors">
                  {/* Fornecedor col */}
                  <button onClick={() => setViewing(s)} className="flex items-center gap-3 text-left group">
                    <SupplierAvatar name={s.name} size="sm" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-900 group-hover:text-blue-600 transition-colors truncate">{s.name}</p>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-semibold text-slate-400">{s.category}</span>
                        {(s.city || s.state) && (
                          <>
                            <span className="text-slate-200">·</span>
                            <span className="flex items-center gap-0.5 text-[10px] text-slate-400">
                              <MapPin size={8} />{[s.city, s.state].filter(Boolean).join(" / ")}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </button>

                  {/* Contact col (hidden mobile) */}
                  <div className="hidden sm:block">
                    <div className="space-y-0.5">
                      {s.contact_person && (
                        <div className="flex items-center gap-1.5">
                          <User size={10} className="text-slate-300" />
                          <span className="text-[11px] text-slate-600 font-medium">{s.contact_person}</span>
                        </div>
                      )}
                      {s.phone && (
                        <div className="flex items-center gap-1.5">
                          <Phone size={10} className="text-slate-300" />
                          <span className="text-[11px] text-slate-500 font-mono">{s.phone}</span>
                        </div>
                      )}
                      {s.payment_terms && (
                        <div className="flex items-center gap-1.5">
                          <CreditCard size={10} className="text-slate-300" />
                          <span className="text-[11px] text-slate-500">{s.payment_terms}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Quick contact col (hidden mobile) */}
                  <div className="hidden sm:flex items-center gap-1">
                    <QuickContact supplier={s} />
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <IconButton size="sm" aria-label={expanded ? "Recolher detalhes" : "Expandir detalhes"} onClick={() => toggleRow(s.id)}>
                      {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </IconButton>
                    <IconButton
                      size="sm"
                      aria-label="Editar fornecedor"
                      title="Editar"
                      {...(idx === 0 ? { "data-tour": "suppliers-edit-btn" } : {})}
                      onClick={() => openEdit(s)}>
                      <Edit3 size={14} />
                    </IconButton>
                    <IconButton size="sm" variant="danger" aria-label="Remover fornecedor" title="Remover" onClick={() => handleDelete(s.id)}>
                      <Trash2 size={14} />
                    </IconButton>
                  </div>
                </div>

                {/* Expanded detail */}
                {expanded && (
                  <div className="px-5 pb-4 bg-slate-50/60 border-t border-slate-100">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3">
                      {s.email && (
                        <a href={`mailto:${s.email}`}
                          className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border border-slate-200 hover:border-blue-200 hover:bg-blue-50 transition-all group">
                          <Mail size={12} className="text-slate-400 group-hover:text-blue-500 shrink-0" />
                          <span className="text-[11px] text-slate-600 font-medium truncate">{s.email}</span>
                        </a>
                      )}
                      {s.website && (
                        <a href={s.website.startsWith("http") ? s.website : `https://${s.website}`}
                          target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border border-slate-200 hover:border-violet-200 hover:bg-violet-50 transition-all group">
                          <Globe size={12} className="text-slate-400 group-hover:text-violet-500 shrink-0" />
                          <span className="text-[11px] text-slate-600 font-medium truncate">{s.website}</span>
                        </a>
                      )}
                      {s.cnpj && (
                        <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border border-slate-200">
                          <Building2 size={12} className="text-slate-400 shrink-0" />
                          <span className="text-[11px] text-slate-600 font-mono">{s.cnpj}</span>
                        </div>
                      )}
                      {s.notes && (
                        <div className="col-span-2 sm:col-span-4 flex items-start gap-2 bg-amber-50 rounded-lg px-3 py-2 border border-amber-100">
                          <Info size={12} className="text-amber-500 shrink-0 mt-0.5" />
                          <span className="text-[11px] text-amber-800 leading-relaxed">{s.notes}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

    </div>

      {/* Detail Modal */}
      {viewing && (
        <SupplierDetailModal
          supplier={viewing}
          onClose={() => setViewing(null)}
          onEdit={() => openEdit(viewing)}
        />
      )}

      {/* Edit / New Modal */}
      <Modal
        open={isModalOpen}
        onClose={closeModal}
        size="lg"
        title={editing.id ? "Editar Fornecedor" : "Novo Fornecedor"}
        subtitle={editing.id ? editing.name : "Preencha os dados do parceiro comercial"}
        footer={
          <ModalFooter>
            <Button variant="ghost" size="sm" onClick={closeModal}>Cancelar</Button>
            <Button size="sm" form="supplier-form" type="submit" loading={saving}>
              {editing.id ? "Atualizar" : "Cadastrar"}
            </Button>
          </ModalFooter>
        }
      >
        <form id="supplier-form" onSubmit={handleSave}>
          <Tabs<FormTab> items={formTabs} value={formTab} onChange={setFormTab} label="Dados do fornecedor">
            {/* Painéis ficam montados (só ocultos) para os campos obrigatórios continuarem validando no submit */}
            <div className={formTab === "geral" ? "space-y-4" : "hidden"}>
              <div className="space-y-3">
                <Input
                  data-tour="supplier-name-field"
                  label="Nome / Razão Social *"
                  required
                  placeholder="Nome Fantasia ou Razão Social"
                  value={editing.name || ""}
                  onChange={(e) => set("name", e.target.value)}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    data-tour="supplier-category-field"
                    label="O que fornece? *"
                    required
                    placeholder="Ex: Embalagens, Tecidos, Calçados"
                    value={editing.category || ""}
                    onChange={(e) => set("category", e.target.value)}
                  />
                  <Input
                    label="CNPJ"
                    placeholder="00.000.000/0000-00"
                    value={editing.cnpj || ""}
                    onChange={(e) => set("cnpj", formatCNPJ(e.target.value))}
                  />
                </div>
                <Select
                  label="Prazo de Pagamento"
                  value={editing.payment_terms || ""}
                  onChange={(e) => set("payment_terms", e.target.value)}
                >
                  <option value="">Selecione...</option>
                  {PAYMENT_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                </Select>
                <Textarea
                  label="Observações"
                  placeholder="Prazos de entrega, condições especiais, histórico, observações..."
                  rows={3}
                  value={editing.notes || ""}
                  onChange={(e) => set("notes", e.target.value)}
                />
              </div>
            </div>

            <div className={formTab === "contato" ? "space-y-3" : "hidden"}>
              <Input
                label="Nome do Contato / Representante"
                placeholder="Fulano da Silva"
                value={editing.contact_person || ""}
                onChange={(e) => set("contact_person", e.target.value)}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Telefone"
                  placeholder="(11) 3000-0000"
                  value={editing.phone || ""}
                  onChange={(e) => set("phone", formatPhone(e.target.value))}
                />
                <Input
                  label="WhatsApp"
                  placeholder="(11) 99999-9999"
                  value={editing.whatsapp || ""}
                  onChange={(e) => set("whatsapp", formatPhone(e.target.value))}
                  hint="Número para contato rápido"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="E-mail"
                  type="email"
                  placeholder="contato@empresa.com"
                  value={editing.email || ""}
                  onChange={(e) => set("email", e.target.value)}
                />
                <Input
                  label="Site / Instagram"
                  placeholder="www.empresa.com.br"
                  value={editing.website || ""}
                  onChange={(e) => set("website", e.target.value)}
                />
              </div>
            </div>

            <div className={formTab === "local" ? "space-y-3" : "hidden"}>
              <Input
                label="Endereço / Bairro"
                placeholder="Rua, número, bairro"
                value={editing.address || ""}
                onChange={(e) => set("address", e.target.value)}
              />
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <Input
                  wrapperClassName="col-span-2"
                  label="Cidade"
                  placeholder="São Paulo"
                  value={editing.city || ""}
                  onChange={(e) => set("city", e.target.value)}
                />
                <Select
                  label="Estado"
                  value={editing.state || ""}
                  onChange={(e) => set("state", e.target.value)}
                >
                  <option value="">UF</option>
                  {STATES.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
                </Select>
              </div>
            </div>
          </Tabs>
        </form>
      </Modal>
    </PageWrapper>
  );
}