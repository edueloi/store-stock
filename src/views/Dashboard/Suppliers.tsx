import React, { useState, useEffect } from "react";
import { Truck, Plus, Phone, MapPin, User, MessageCircle, Tag, Info, Edit3, Trash2 } from "lucide-react";
import Button from "../../components/ui/Button";
import { Input, Textarea } from "../../components/ui/Input";
import Modal from "../../components/ui/Modal";
import PageHeader from "../../components/layout/PageHeader";
import SearchBar from "../../components/layout/SearchBar";
import { EmptyState, LoadingState } from "../../components/layout/EmptyState";
import { Table, TableHead, TableBody, Th, Tr, Td, RowActions, ActionButton } from "../../components/ui/Table";
import { StatCard } from "../../components/ui/Card";
import { Supplier } from "../../types";

const EMPTY: Partial<Supplier> = { name: "", category: "", contact_person: "", phone: "", address: "", notes: "" };

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Supplier>>(EMPTY);
  const [saving, setSaving] = useState(false);

  const headers = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  });

  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/suppliers", { headers: headers() });
      const data = await res.json();
      setSuppliers(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSuppliers(); }, []);

  const openNew = () => { setEditing(EMPTY); setIsModalOpen(true); };
  const openEdit = (s: Supplier) => { setEditing(s); setIsModalOpen(true); };
  const closeModal = () => { setIsModalOpen(false); setEditing(EMPTY); };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const method = editing.id ? "PUT" : "POST";
      const url = editing.id ? `/api/suppliers/${editing.id}` : "/api/suppliers";
      const res = await fetch(url, { method, headers: headers(), body: JSON.stringify(editing) });
      if (res.ok) { closeModal(); fetchSuppliers(); }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Remover este fornecedor?")) return;
    await fetch(`/api/suppliers/${id}`, { method: "DELETE", headers: headers() });
    fetchSuppliers();
  };

  const filtered = suppliers.filter((s) =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.contact_person?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 ">
      <PageHeader
        title="Fornecedores"
        subtitle="Cadeia de suprimentos e parceiros"
        action={
          <Button icon={<Plus size={15} />} onClick={openNew}>
            Novo Fornecedor
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-4">
        <StatCard label="Total de Fornecedores" value={suppliers.length} icon={<Truck />} accent="blue" />
        <StatCard label="Filtrados" value={filtered.length} icon={<Truck />} accent="slate" />
      </div>

      <SearchBar
        value={searchTerm}
        onChange={setSearchTerm}
        placeholder="Buscar por nome, categoria ou contato..."
      />

      {loading ? (
        <LoadingState />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Truck size={32} strokeWidth={1} />}
          title={searchTerm ? "Nenhum fornecedor encontrado" : "Nenhum fornecedor cadastrado"}
          description="Cadastre fornecedores para gerenciar sua cadeia de suprimentos."
          action={!searchTerm && <Button icon={<Plus size={14} />} onClick={openNew}>Adicionar Fornecedor</Button>}
        />
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden lg:block">
            <Table>
              <TableHead>
                <Th>Fornecedor / Categoria</Th>
                <Th>Contato Direto</Th>
                <Th>Localização</Th>
                <Th>Notas</Th>
                <Th align="right" />
              </TableHead>
              <TableBody>
                {filtered.map((s) => (
                  <Tr key={s.id}>
                    <Td>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-center text-blue-600 font-black text-sm shrink-0">
                          {s.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-xs font-black text-slate-900 uppercase tracking-tight">{s.name}</p>
                          <div className="flex items-center gap-1 mt-0.5">
                            <Tag size={9} className="text-slate-400" />
                            <span className="text-[9px] font-bold text-slate-400 uppercase">{s.category}</span>
                          </div>
                        </div>
                      </div>
                    </Td>
                    <Td>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <User size={11} className="text-slate-400" />
                          <span className="text-[10px] font-bold text-slate-600 uppercase">{s.contact_person || "—"}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Phone size={11} className="text-slate-400" />
                          <span className="text-[10px] font-bold text-slate-600">{s.phone || "—"}</span>
                          {s.phone && (
                            <a href={`https://wa.me/${s.phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer"
                              className="p-0.5 text-emerald-500 hover:bg-emerald-50 rounded transition-colors">
                              <MessageCircle size={11} />
                            </a>
                          )}
                        </div>
                      </div>
                    </Td>
                    <Td>
                      <div className="flex items-start gap-2 max-w-[180px]">
                        <MapPin size={11} className="text-slate-400 shrink-0 mt-0.5" />
                        <span className="text-[10px] font-medium text-slate-500 uppercase leading-snug">{s.address || "—"}</span>
                      </div>
                    </Td>
                    <Td>
                      {s.notes ? (
                        <div className="flex items-center gap-2 text-slate-400">
                          <Info size={11} />
                          <span className="text-[9px] font-bold uppercase truncate max-w-[140px]">{s.notes}</span>
                        </div>
                      ) : (
                        <span className="text-[9px] text-slate-300 italic">Sem notas</span>
                      )}
                    </Td>
                    <RowActions>
                      <ActionButton variant="edit" icon={<Edit3 size={13} />} title="Editar" onClick={() => openEdit(s)} />
                      <ActionButton variant="delete" icon={<Trash2 size={13} />} title="Excluir" onClick={() => handleDelete(s.id)} />
                    </RowActions>
                  </Tr>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Cards */}
          <div className="lg:hidden space-y-3">
            {filtered.map((s) => (
              <div key={s.id} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-center text-blue-600 font-black shrink-0">
                      {s.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-xs font-black text-slate-900 uppercase tracking-tight">{s.name}</p>
                      <span className="text-[9px] font-bold text-slate-400 uppercase">{s.category}</span>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(s)} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all">
                      <Edit3 size={13} />
                    </button>
                    <button onClick={() => handleDelete(s.id)} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3 pt-2 border-t border-slate-100">
                  {s.phone && (
                    <div className="flex items-center gap-1.5 text-slate-500">
                      <Phone size={11} className="text-slate-400" />
                      <span className="text-[10px] font-mono">{s.phone}</span>
                    </div>
                  )}
                  {s.address && (
                    <div className="flex items-center gap-1.5 text-slate-500">
                      <MapPin size={11} className="text-slate-400" />
                      <span className="text-[10px]">{s.address}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Modal */}
      <Modal
        open={isModalOpen}
        onClose={closeModal}
        title={editing.id ? "Editar Fornecedor" : "Novo Fornecedor"}
        subtitle="Cadastro de parceiro comercial"
        footer={
          <>
            <Button variant="secondary" onClick={closeModal}>Cancelar</Button>
            <Button form="supplier-form" type="submit" loading={saving}>
              {editing.id ? "Atualizar" : "Cadastrar"}
            </Button>
          </>
        }
      >
        <form id="supplier-form" onSubmit={handleSave} className="space-y-4">
          <Input label="Nome Fantasia / Empresa *" required placeholder="Razão Social" value={editing.name || ""}
            onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="O que fornece? *" required placeholder="Ex: Embalagens, Tecidos" value={editing.category || ""}
              onChange={(e) => setEditing({ ...editing, category: e.target.value })} />
            <Input label="Nome do Contato" placeholder="Representante" value={editing.contact_person || ""}
              onChange={(e) => setEditing({ ...editing, contact_person: e.target.value })} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="WhatsApp / Telefone" placeholder="5511999999999" value={editing.phone || ""}
              onChange={(e) => setEditing({ ...editing, phone: e.target.value })}
              hint="Inclua o 55 antes do DDD" />
            <Input label="Endereço / Sede" placeholder="Cidade - UF" value={editing.address || ""}
              onChange={(e) => setEditing({ ...editing, address: e.target.value })} />
          </div>
          <Textarea label="Notas Internas" placeholder="Prazos, condições de pagamento, observações..." rows={3}
            value={editing.notes || ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} />
        </form>
      </Modal>
    </div>
  );
}
