import React, { useState, useEffect } from "react";
import { Users, UserPlus, Mail, Phone, MapPin, ChevronRight } from "lucide-react";
import { motion } from "motion/react";
import Button from "../../components/ui/Button";
import { Input, Textarea } from "../../components/ui/Input";
import Modal from "../../components/ui/Modal";
import PageHeader from "../../components/layout/PageHeader";
import SearchBar from "../../components/layout/SearchBar";
import { EmptyState, LoadingState } from "../../components/layout/EmptyState";
import { StatCard } from "../../components/ui/Card";

interface Customer {
  id: number;
  name: string;
  email: string;
  phone: string;
  document: string;
  address: string;
  notes: string;
  created_at: string;
}

const EMPTY: Partial<Customer> = { name: "", email: "", phone: "", document: "", address: "", notes: "" };

export default function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState<Partial<Customer>>(EMPTY);
  const [saving, setSaving] = useState(false);

  const headers = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  });

  const fetchCustomers = async () => {
    try {
      const res = await fetch("/api/customers", { headers: headers() });
      const data = await res.json();
      setCustomers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCustomers(); }, []);

  const openNew = () => { setForm(EMPTY); setIsModalOpen(true); };
  const closeModal = () => { setIsModalOpen(false); setForm(EMPTY); };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: headers(),
        body: JSON.stringify(form),
      });
      if (res.ok) { closeModal(); fetchCustomers(); }
    } finally {
      setSaving(false);
    }
  };

  const filtered = customers.filter((c) =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.email && c.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (c.phone && c.phone.includes(searchTerm))
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader
        title="CRM / Clientes"
        subtitle="Gestão de relacionamento e fidelização"
        action={
          <Button icon={<UserPlus size={15} />} onClick={openNew}>
            Novo Cliente
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <StatCard
          label="Total de Clientes"
          value={customers.length}
          icon={<Users />}
          accent="blue"
        />
        <StatCard
          label="Resultado da Busca"
          value={filtered.length}
          icon={<Users />}
          accent="slate"
        />
      </div>

      <SearchBar
        value={searchTerm}
        onChange={setSearchTerm}
        placeholder="Buscar por nome, e-mail ou telefone..."
      />

      {/* Content */}
      {loading ? (
        <LoadingState rows={6} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Users size={32} strokeWidth={1} />}
          title={searchTerm ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado"}
          description={searchTerm ? `Sem resultados para "${searchTerm}"` : "Cadastre seu primeiro cliente para começar."}
          action={!searchTerm && <Button icon={<UserPlus size={14} />} onClick={openNew}>Novo Cliente</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
          {filtered.map((customer) => (
            <motion.div
              whileHover={{ y: -3 }}
              key={customer.id}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-xl transition-all group cursor-pointer"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="w-11 h-11 bg-blue-50 border border-blue-100 rounded-2xl flex items-center justify-center text-blue-600 font-black text-lg uppercase shrink-0">
                  {customer.name[0]}
                </div>
                <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">
                  #{String(customer.id).padStart(4, "0")}
                </span>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight line-clamp-1">
                  {customer.name}
                </h3>

                <div className="space-y-1.5">
                  {customer.email && (
                    <div className="flex items-center gap-2 text-slate-500">
                      <Mail size={12} className="shrink-0 text-slate-400" />
                      <span className="text-[10px] font-mono truncate">{customer.email}</span>
                    </div>
                  )}
                  {customer.phone && (
                    <div className="flex items-center gap-2 text-slate-500">
                      <Phone size={12} className="shrink-0 text-slate-400" />
                      <span className="text-[10px] font-mono">{customer.phone}</span>
                    </div>
                  )}
                  {customer.address && (
                    <div className="flex items-center gap-2 text-slate-500">
                      <MapPin size={12} className="shrink-0 text-slate-400" />
                      <span className="text-[10px] line-clamp-1 truncate">{customer.address}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[9px] font-bold text-slate-300 uppercase">
                  {new Date(customer.created_at).toLocaleDateString("pt-BR")}
                </span>
                <span className="text-[10px] font-bold text-blue-600 uppercase flex items-center gap-0.5 group-hover:gap-1.5 transition-all">
                  Ver Ficha <ChevronRight size={13} />
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Modal */}
      <Modal
        open={isModalOpen}
        onClose={closeModal}
        title="Novo Cliente"
        subtitle="Cadastro CRM"
        footer={
          <>
            <Button variant="secondary" onClick={closeModal}>Cancelar</Button>
            <Button form="customer-form" type="submit" loading={saving} icon={<UserPlus size={14} />}>
              Confirmar
            </Button>
          </>
        }
      >
        <form id="customer-form" onSubmit={handleSave} className="space-y-4">
          <Input
            label="Nome Completo / Razão Social *"
            required
            placeholder="Nome do cliente"
            value={form.name || ""}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="E-mail"
              type="email"
              placeholder="email@exemplo.com"
              value={form.email || ""}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <Input
              label="Telefone / WhatsApp"
              placeholder="(11) 99999-9999"
              value={form.phone || ""}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="CPF / CNPJ"
              placeholder="000.000.000-00"
              value={form.document || ""}
              onChange={(e) => setForm({ ...form, document: e.target.value })}
            />
            <Input
              label="Endereço"
              placeholder="Rua, Cidade - UF"
              value={form.address || ""}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </div>
          <Textarea
            label="Observações"
            placeholder="Preferências, histórico, notas..."
            rows={3}
            value={form.notes || ""}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </form>
      </Modal>
    </div>
  );
}
