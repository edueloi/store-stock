import React, { useState, useEffect } from "react";
import {
  Truck, Plus, Phone, MapPin, User, MessageCircle, Tag, Info,
  Edit3, Trash2, Globe, Mail, Building2, CreditCard, X,
  ExternalLink, ChevronDown, ChevronUp, Search, Package,
} from "lucide-react";
import Button from "../../components/ui/Button";
import { Input, Textarea } from "../../components/ui/Input";
import Modal from "../../components/ui/Modal";
import PageHeader from "../../components/layout/PageHeader";
import { EmptyState, LoadingState } from "../../components/layout/EmptyState";
import { StatCard } from "../../components/ui/Card";
import { Supplier } from "../../types";

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
    <div className={`${sizes[size]} ${color} border-2 rounded-2xl flex items-center justify-center font-black shrink-0`}>
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

function SupplierDetailModal({ supplier, onClose, onEdit }: {
  supplier: Supplier; onClose: () => void; onEdit: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full sm:max-w-2xl sm:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-200">
        {/* Header */}
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 px-6 pt-6 pb-8">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <SupplierAvatar name={supplier.name} size="lg" />
              <div>
                <h2 className="text-lg font-black text-white uppercase tracking-tight">{supplier.name}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-white/10 rounded-full text-[10px] font-bold text-white/80 uppercase">
                    <Package size={9} /> {supplier.category}
                  </span>
                  {supplier.cnpj && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-white/10 rounded-full text-[10px] font-mono text-white/70">
                      {supplier.cnpj}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 rounded-xl transition-all">
              <X size={16} />
            </button>
          </div>
          <div className="flex items-center gap-2 mt-4">
            <QuickContact supplier={supplier} />
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 max-h-[60vh] overflow-y-auto">
          {/* Contato */}
          <section>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Contato</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {supplier.contact_person && (
                <div className="flex items-center gap-2.5 bg-slate-50 rounded-xl px-3 py-2.5 border border-slate-100">
                  <User size={13} className="text-slate-400 shrink-0" />
                  <div>
                    <p className="text-[9px] text-slate-400 font-bold uppercase">Responsável</p>
                    <p className="text-xs font-bold text-slate-700">{supplier.contact_person}</p>
                  </div>
                </div>
              )}
              {supplier.phone && (
                <div className="flex items-center gap-2.5 bg-slate-50 rounded-xl px-3 py-2.5 border border-slate-100">
                  <Phone size={13} className="text-slate-400 shrink-0" />
                  <div>
                    <p className="text-[9px] text-slate-400 font-bold uppercase">Telefone</p>
                    <p className="text-xs font-bold text-slate-700">{supplier.phone}</p>
                  </div>
                </div>
              )}
              {supplier.whatsapp && (
                <a href={whatsappHref(supplier.whatsapp)} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2.5 bg-emerald-50 rounded-xl px-3 py-2.5 border border-emerald-100 hover:bg-emerald-100 transition-colors">
                  <MessageCircle size={13} className="text-emerald-500 shrink-0" />
                  <div>
                    <p className="text-[9px] text-emerald-600 font-bold uppercase">WhatsApp</p>
                    <p className="text-xs font-bold text-emerald-700">{supplier.whatsapp}</p>
                  </div>
                  <ExternalLink size={10} className="text-emerald-400 ml-auto" />
                </a>
              )}
              {supplier.email && (
                <a href={`mailto:${supplier.email}`}
                  className="flex items-center gap-2.5 bg-blue-50 rounded-xl px-3 py-2.5 border border-blue-100 hover:bg-blue-100 transition-colors">
                  <Mail size={13} className="text-blue-500 shrink-0" />
                  <div>
                    <p className="text-[9px] text-blue-600 font-bold uppercase">E-mail</p>
                    <p className="text-xs font-bold text-blue-700 truncate max-w-[150px]">{supplier.email}</p>
                  </div>
                  <ExternalLink size={10} className="text-blue-400 ml-auto" />
                </a>
              )}
              {supplier.website && (
                <a href={supplier.website.startsWith("http") ? supplier.website : `https://${supplier.website}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2.5 bg-violet-50 rounded-xl px-3 py-2.5 border border-violet-100 hover:bg-violet-100 transition-colors">
                  <Globe size={13} className="text-violet-500 shrink-0" />
                  <div>
                    <p className="text-[9px] text-violet-600 font-bold uppercase">Site</p>
                    <p className="text-xs font-bold text-violet-700 truncate max-w-[150px]">{supplier.website}</p>
                  </div>
                  <ExternalLink size={10} className="text-violet-400 ml-auto" />
                </a>
              )}
            </div>
          </section>

          {/* Localização */}
          {(supplier.address || supplier.city || supplier.state) && (
            <section>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Localização</p>
              <div className="flex items-start gap-2.5 bg-slate-50 rounded-xl px-3 py-2.5 border border-slate-100">
                <MapPin size={13} className="text-slate-400 shrink-0 mt-0.5" />
                <div>
                  {supplier.address && <p className="text-xs font-medium text-slate-700">{supplier.address}</p>}
                  {(supplier.city || supplier.state) && (
                    <p className="text-[10px] text-slate-500">{[supplier.city, supplier.state].filter(Boolean).join(" — ")}</p>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* Comercial */}
          {supplier.payment_terms && (
            <section>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Condições Comerciais</p>
              <div className="flex items-center gap-2.5 bg-slate-50 rounded-xl px-3 py-2.5 border border-slate-100">
                <CreditCard size={13} className="text-slate-400 shrink-0" />
                <div>
                  <p className="text-[9px] text-slate-400 font-bold uppercase">Prazo de Pagamento</p>
                  <p className="text-xs font-bold text-slate-700">{supplier.payment_terms}</p>
                </div>
              </div>
            </section>
          )}

          {/* Notas */}
          {supplier.notes && (
            <section>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Notas Internas</p>
              <div className="flex items-start gap-2.5 bg-amber-50 rounded-xl px-3 py-2.5 border border-amber-100">
                <Info size={13} className="text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800 leading-relaxed whitespace-pre-wrap">{supplier.notes}</p>
              </div>
            </section>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex justify-between items-center bg-slate-50/60">
          <p className="text-[9px] text-slate-400 font-medium">
            Cadastrado em {new Date(supplier.created_at).toLocaleDateString("pt-BR")}
          </p>
          <button onClick={onEdit}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-slate-700 transition-all">
            <Edit3 size={12} /> Editar Fornecedor
          </button>
        </div>
      </div>
    </div>
  );
}

function SupplierCard({ supplier, onEdit, onDelete, onView }: {
  supplier: Supplier; onEdit: () => void; onDelete: () => void; onView: () => void;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300 transition-all overflow-hidden">
      {/* Top */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <button onClick={onView} className="flex items-center gap-3 text-left group flex-1 min-w-0">
            <SupplierAvatar name={supplier.name} size="md" />
            <div className="min-w-0">
              <p className="text-xs font-black text-slate-900 uppercase tracking-tight group-hover:text-blue-600 transition-colors truncate">{supplier.name}</p>
              <div className="flex items-center gap-1 mt-0.5">
                <Tag size={9} className="text-slate-400 shrink-0" />
                <span className="text-[9px] font-bold text-slate-400 uppercase truncate">{supplier.category}</span>
              </div>
              {supplier.contact_person && (
                <div className="flex items-center gap-1 mt-0.5">
                  <User size={9} className="text-slate-300 shrink-0" />
                  <span className="text-[9px] text-slate-400 truncate">{supplier.contact_person}</span>
                </div>
              )}
            </div>
          </button>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={onEdit} className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all">
              <Edit3 size={12} />
            </button>
            <button onClick={onDelete} className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all">
              <Trash2 size={12} />
            </button>
          </div>
        </div>
      </div>

      {/* Quick contact bar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-100 bg-slate-50/50">
        <div className="flex items-center gap-1.5">
          {supplier.city && (
            <span className="flex items-center gap-1 text-[9px] text-slate-400 font-medium">
              <MapPin size={9} className="text-slate-300" />
              {[supplier.city, supplier.state].filter(Boolean).join(" / ")}
            </span>
          )}
          {!supplier.city && supplier.address && (
            <span className="flex items-center gap-1 text-[9px] text-slate-400">
              <MapPin size={9} className="text-slate-300" /> {supplier.address}
            </span>
          )}
          {supplier.payment_terms && !supplier.city && !supplier.address && (
            <span className="flex items-center gap-1 text-[9px] text-slate-400">
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
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

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

  const openNew = () => { setEditing(EMPTY); setIsModalOpen(true); };
  const openEdit = (s: Supplier) => { setViewing(null); setEditing(s); setIsModalOpen(true); };
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fornecedores"
        subtitle="Cadeia de suprimentos e parceiros"
        action={
          <Button icon={<Plus size={15} />} onClick={openNew}>
            Novo Fornecedor
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard label="Total" value={suppliers.length} icon={<Truck />} accent="blue" />
        <StatCard label="Filtrados" value={filtered.length} icon={<Search />} accent="slate" />
        <div className="hidden sm:block">
          <StatCard label="Com WhatsApp" value={suppliers.filter((s) => s.whatsapp).length} icon={<MessageCircle />} accent="blue" />
        </div>
      </div>

      {/* Search + view toggle */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nome, categoria, cidade, CNPJ..."
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X size={14} />
            </button>
          )}
        </div>
        <div className="flex border border-slate-200 rounded-xl overflow-hidden bg-white shrink-0">
          <button
            onClick={() => setViewMode("grid")}
            className={`px-3 py-2.5 text-xs font-bold transition-all ${viewMode === "grid" ? "bg-slate-900 text-white" : "text-slate-400 hover:text-slate-600"}`}
          >
            Grade
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`px-3 py-2.5 text-xs font-bold transition-all ${viewMode === "list" ? "bg-slate-900 text-white" : "text-slate-400 hover:text-slate-600"}`}
          >
            Lista
          </button>
        </div>
      </div>

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
          {filtered.map((s) => (
            <SupplierCard
              key={s.id}
              supplier={s}
              onView={() => setViewing(s)}
              onEdit={() => openEdit(s)}
              onDelete={() => handleDelete(s.id)}
            />
          ))}
        </div>
      ) : (
        /* List / accordion view */
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm divide-y divide-slate-100">
          {/* Table header */}
          <div className="hidden sm:grid grid-cols-[1fr_1fr_auto_auto] gap-4 px-5 py-2.5 bg-slate-50 border-b border-slate-200">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Fornecedor</span>
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Contato</span>
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Ações Rápidas</span>
            <span />
          </div>

          {filtered.map((s) => {
            const expanded = expandedRows.has(s.id);
            return (
              <div key={s.id}>
                {/* Row */}
                <div className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_1fr_auto_auto] items-center gap-4 px-5 py-3 hover:bg-slate-50/60 transition-colors">
                  {/* Fornecedor col */}
                  <button onClick={() => setViewing(s)} className="flex items-center gap-3 text-left group">
                    <SupplierAvatar name={s.name} size="sm" />
                    <div className="min-w-0">
                      <p className="text-xs font-black text-slate-900 uppercase tracking-tight group-hover:text-blue-600 transition-colors truncate">{s.name}</p>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-bold text-slate-400 uppercase">{s.category}</span>
                        {(s.city || s.state) && (
                          <>
                            <span className="text-slate-200">·</span>
                            <span className="flex items-center gap-0.5 text-[9px] text-slate-400">
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
                          <span className="text-[10px] text-slate-600 font-medium">{s.contact_person}</span>
                        </div>
                      )}
                      {s.phone && (
                        <div className="flex items-center gap-1.5">
                          <Phone size={10} className="text-slate-300" />
                          <span className="text-[10px] text-slate-500 font-mono">{s.phone}</span>
                        </div>
                      )}
                      {s.payment_terms && (
                        <div className="flex items-center gap-1.5">
                          <CreditCard size={10} className="text-slate-300" />
                          <span className="text-[10px] text-slate-500">{s.payment_terms}</span>
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
                    <button onClick={() => toggleRow(s.id)}
                      className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-all">
                      {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </button>
                    <button onClick={() => openEdit(s)}
                      className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all">
                      <Edit3 size={12} />
                    </button>
                    <button onClick={() => handleDelete(s.id)}
                      className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>

                {/* Expanded detail */}
                {expanded && (
                  <div className="px-5 pb-4 bg-slate-50/60 border-t border-slate-100">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3">
                      {s.email && (
                        <a href={`mailto:${s.email}`}
                          className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 border border-slate-200 hover:border-blue-200 hover:bg-blue-50 transition-all group">
                          <Mail size={12} className="text-slate-400 group-hover:text-blue-500 shrink-0" />
                          <span className="text-[10px] text-slate-600 font-medium truncate">{s.email}</span>
                        </a>
                      )}
                      {s.website && (
                        <a href={s.website.startsWith("http") ? s.website : `https://${s.website}`}
                          target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 border border-slate-200 hover:border-violet-200 hover:bg-violet-50 transition-all group">
                          <Globe size={12} className="text-slate-400 group-hover:text-violet-500 shrink-0" />
                          <span className="text-[10px] text-slate-600 font-medium truncate">{s.website}</span>
                        </a>
                      )}
                      {s.cnpj && (
                        <div className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 border border-slate-200">
                          <Building2 size={12} className="text-slate-400 shrink-0" />
                          <span className="text-[10px] text-slate-600 font-mono">{s.cnpj}</span>
                        </div>
                      )}
                      {s.notes && (
                        <div className="col-span-2 sm:col-span-4 flex items-start gap-2 bg-amber-50 rounded-xl px-3 py-2 border border-amber-100">
                          <Info size={12} className="text-amber-500 shrink-0 mt-0.5" />
                          <span className="text-[10px] text-amber-800 leading-relaxed">{s.notes}</span>
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
        title={editing.id ? "Editar Fornecedor" : "Novo Fornecedor"}
        subtitle={editing.id ? editing.name : "Preencha os dados do parceiro comercial"}
        footer={
          <>
            <Button variant="secondary" onClick={closeModal}>Cancelar</Button>
            <Button form="supplier-form" type="submit" loading={saving}>
              {editing.id ? "Atualizar" : "Cadastrar"}
            </Button>
          </>
        }
      >
        <form id="supplier-form" onSubmit={handleSave} className="space-y-5">
          {/* Identificação */}
          <div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2.5">Identificação</p>
            <div className="space-y-3">
              <Input
                label="Nome / Razão Social *"
                required
                placeholder="Nome Fantasia ou Razão Social"
                value={editing.name || ""}
                onChange={(e) => set("name", e.target.value)}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
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
            </div>
          </div>

          {/* Contato */}
          <div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2.5">Contato</p>
            <div className="space-y-3">
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
          </div>

          {/* Localização */}
          <div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2.5">Localização</p>
            <div className="space-y-3">
              <Input
                label="Endereço / Bairro"
                placeholder="Rua, número, bairro"
                value={editing.address || ""}
                onChange={(e) => set("address", e.target.value)}
              />
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="col-span-2 sm:col-span-2">
                  <Input
                    label="Cidade"
                    placeholder="São Paulo"
                    value={editing.city || ""}
                    onChange={(e) => set("city", e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Estado</label>
                  <select
                    value={editing.state || ""}
                    onChange={(e) => set("state", e.target.value)}
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all text-slate-700"
                  >
                    <option value="">UF</option>
                    {STATES.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Comercial */}
          <div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2.5">Condições Comerciais</p>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Prazo de Pagamento</label>
              <select
                value={editing.payment_terms || ""}
                onChange={(e) => set("payment_terms", e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all text-slate-700"
              >
                <option value="">Selecione...</option>
                {PAYMENT_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>
          </div>

          {/* Notas */}
          <div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2.5">Observações</p>
            <Textarea
              label=""
              placeholder="Prazos de entrega, condições especiais, histórico, observações..."
              rows={3}
              value={editing.notes || ""}
              onChange={(e) => set("notes", e.target.value)}
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
