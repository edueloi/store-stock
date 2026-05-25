import React, { useState, useEffect, useMemo } from "react";
import PageHeader from "../../components/layout/PageHeader";
import {
  Plus,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  ChevronDown,
  Loader2,
  X,
  Calendar,
  User,
  FileText,
  Tag,
  DollarSign,
  TrendingUp,
  Edit2,
  Trash2,
  StickyNote,
} from "lucide-react";
import { AccountReceivable, AccountStatus } from "../../types";
import { cn } from "../../lib/utils";
import { useToast } from "../../components/ui/Toast";

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const today = () => new Date().toISOString().split("T")[0];

function formatDateBR(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d + (d.length === 10 ? "T12:00:00" : "")).toLocaleDateString("pt-BR");
}

function isOverdue(due: string, status: AccountStatus) {
  if (status !== "pending") return false;
  return new Date(due + "T23:59:59") < new Date();
}

const STATUS_CONFIG: Record<AccountStatus, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  pending:   { label: "Pendente",   color: "text-amber-600",   bg: "bg-amber-50 border-amber-200",   icon: <Clock size={12} /> },
  received:  { label: "Recebido",   color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200", icon: <CheckCircle2 size={12} /> },
  paid:      { label: "Pago",       color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200", icon: <CheckCircle2 size={12} /> },
  overdue:   { label: "Vencido",    color: "text-rose-600",    bg: "bg-rose-50 border-rose-200",     icon: <AlertCircle size={12} /> },
  cancelled: { label: "Cancelado",  color: "text-slate-400",   bg: "bg-slate-50 border-slate-200",   icon: <XCircle size={12} /> },
};

const CATEGORIES = ["Venda", "Serviço", "Aluguel", "Comissão", "Empréstimo", "Outro"];

type ModalMode = "create" | "edit" | "receive" | "delete" | null;

interface FormData {
  description: string;
  amount: string;
  due_date: string;
  customer_name: string;
  category: string;
  notes: string;
}

const EMPTY_FORM: FormData = {
  description: "",
  amount: "",
  due_date: today(),
  customer_name: "",
  category: "",
  notes: "",
};

export default function ContasReceber() {
  const { success, error: toastError } = useToast();
  const [items, setItems] = useState<AccountReceivable[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selected, setSelected] = useState<AccountReceivable | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [receiveDate, setReceiveDate] = useState(today());

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<AccountStatus | "all">("all");

  const token = () => localStorage.getItem("token");

  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/accounts-receivable", {
        headers: { Authorization: `Bearer ${token()}` },
      });
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchItems(); }, []);

  const openCreate = () => {
    setSelected(null);
    setForm(EMPTY_FORM);
    setModalMode("create");
  };

  const openEdit = (item: AccountReceivable) => {
    setSelected(item);
    setForm({
      description: item.description,
      amount: String(item.amount),
      due_date: item.due_date.substring(0, 10),
      customer_name: item.customer_name || "",
      category: item.category || "",
      notes: item.notes || "",
    });
    setModalMode("edit");
  };

  const openReceive = (item: AccountReceivable) => {
    setSelected(item);
    setReceiveDate(today());
    setModalMode("receive");
  };

  const openDelete = (item: AccountReceivable) => {
    setSelected(item);
    setModalMode("delete");
  };

  const closeModal = () => { setModalMode(null); setSelected(null); };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body = {
        description: form.description,
        amount: Number(form.amount),
        due_date: form.due_date,
        customer_name: form.customer_name || null,
        category: form.category || null,
        notes: form.notes || null,
      };
      const url = modalMode === "edit" ? `/api/accounts-receivable/${selected!.id}` : "/api/accounts-receivable";
      const method = modalMode === "edit" ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        success(modalMode === "edit" ? "Conta atualizada com sucesso!" : "Conta cadastrada com sucesso!");
        closeModal();
        fetchItems();
      } else {
        const data = await res.json().catch(() => ({}));
        toastError(data.error || "Erro ao salvar conta. Tente novamente.");
      }
    } catch {
      toastError("Erro de conexão. Verifique sua internet.");
    }
    setSaving(false);
  };

  const handleReceive = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/accounts-receivable/${selected!.id}/receive`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ received_date: receiveDate }),
      });
      if (res.ok) {
        success("Recebimento confirmado!");
        closeModal();
        fetchItems();
      } else {
        const data = await res.json().catch(() => ({}));
        toastError(data.error || "Erro ao confirmar recebimento.");
      }
    } catch {
      toastError("Erro de conexão. Verifique sua internet.");
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/accounts-receivable/${selected!.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (res.ok) {
        success("Conta excluída.");
        closeModal();
        fetchItems();
      } else {
        const data = await res.json().catch(() => ({}));
        toastError(data.error || "Erro ao excluir conta.");
      }
    } catch {
      toastError("Erro de conexão. Verifique sua internet.");
    }
    setSaving(false);
  };

  const filtered = useMemo(() => {
    return items
      .map(item => ({
        ...item,
        status: isOverdue(item.due_date, item.status as AccountStatus) ? "overdue" as AccountStatus : item.status as AccountStatus,
      }))
      .filter(item => {
        if (statusFilter !== "all" && item.status !== statusFilter) return false;
        if (search && !item.description.toLowerCase().includes(search.toLowerCase()) &&
            !(item.customer_name || "").toLowerCase().includes(search.toLowerCase())) return false;
        return true;
      });
  }, [items, statusFilter, search]);

  const totalPending  = items.filter(i => i.status === "pending" && !isOverdue(i.due_date, i.status as AccountStatus)).reduce((a, i) => a + Number(i.amount), 0);
  const totalOverdue  = items.filter(i => isOverdue(i.due_date, i.status as AccountStatus)).reduce((a, i) => a + Number(i.amount), 0);
  const totalReceived = items.filter(i => i.status === "received").reduce((a, i) => a + Number(i.amount), 0);

  const isFormModal = modalMode === "create" || modalMode === "edit";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contas a Receber"
        subtitle="Controle de recebimentos e vencimentos"
        action={
          <button
            onClick={openCreate}
            className="h-9 px-4 bg-emerald-600 text-white rounded-xl flex items-center gap-2 text-[10px] font-black uppercase tracking-widest hover:bg-emerald-500 transition-all active:scale-95"
          >
            <Plus size={13} strokeWidth={3} /> Nova Conta
          </button>
        }
      />

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">A Receber</div>
          <div className="text-2xl font-mono font-black text-amber-600">R$ {fmt(totalPending)}</div>
          <div className="mt-1 text-[9px] font-bold text-slate-400 uppercase">
            {items.filter(i => i.status === "pending" && !isOverdue(i.due_date, i.status as AccountStatus)).length} contas pendentes
          </div>
          <div className="absolute right-4 top-4 w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-400">
            <Clock size={20} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Vencidas</div>
          <div className="text-2xl font-mono font-black text-rose-600">R$ {fmt(totalOverdue)}</div>
          <div className="mt-1 text-[9px] font-bold text-slate-400 uppercase">
            {items.filter(i => isOverdue(i.due_date, i.status as AccountStatus)).length} contas vencidas
          </div>
          <div className="absolute right-4 top-4 w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center text-rose-400">
            <AlertCircle size={20} />
          </div>
        </div>

        <div className="bg-slate-900 p-5 rounded-2xl shadow-xl relative overflow-hidden">
          <div className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2">Recebido</div>
          <div className="text-2xl font-mono font-black text-emerald-400">R$ {fmt(totalReceived)}</div>
          <div className="mt-1 text-[9px] font-bold text-slate-600 uppercase">
            {items.filter(i => i.status === "received").length} contas recebidas
          </div>
          <div className="absolute right-4 top-4 w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-emerald-600">
            <TrendingUp size={20} />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Toolbar */}
        <div className="px-5 py-3 border-b border-slate-100 flex flex-col gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
              <input
                type="text"
                placeholder="Buscar por descrição ou cliente..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 h-9 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-bold uppercase tracking-widest placeholder:text-slate-300 focus:outline-none focus:border-blue-400 transition-all"
              />
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {([["all","Todos"], ["pending","Pendentes"], ["overdue","Vencidos"], ["received","Recebidos"], ["cancelled","Cancelados"]] as const).map(([k, l]) => (
                <button
                  key={k}
                  onClick={() => setStatusFilter(k)}
                  className={cn(
                    "h-9 px-3 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all",
                    statusFilter === k
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white text-slate-400 border-slate-200 hover:border-slate-400"
                  )}
                >{l}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Desktop table */}
        <div className="hidden sm:block overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={22} className="animate-spin text-slate-300" />
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100">
                  <th className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Descrição</th>
                  <th className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Cliente</th>
                  <th className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Vencimento</th>
                  <th className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Recebimento</th>
                  <th className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                  <th className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Valor</th>
                  <th className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item, idx) => {
                  const st = STATUS_CONFIG[item.status];
                  return (
                    <tr key={item.id} className={cn("border-b border-slate-50 hover:bg-slate-50/50 transition-colors", idx % 2 !== 0 && "bg-slate-50/20")}>
                      <td className="px-5 py-3">
                        <span className="text-[11px] font-bold text-slate-800 uppercase">{item.description}</span>
                        {item.category && (
                          <span className="ml-2 text-[9px] font-black uppercase tracking-widest text-indigo-500 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded">
                            {item.category}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-[10px] text-slate-500 font-bold">{item.customer_name || "—"}</td>
                      <td className="px-5 py-3">
                        <span className={cn(
                          "text-[10px] font-mono font-bold px-2 py-0.5 rounded-md",
                          item.status === "overdue" ? "bg-rose-50 text-rose-600" : "bg-slate-100 text-slate-500"
                        )}>
                          {formatDateBR(item.due_date)}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md">
                          {formatDateBR(item.received_date)}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className={cn("inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg border", st.bg, st.color)}>
                          {st.icon}{st.label}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span className="font-mono font-black text-sm text-emerald-600">R$ {fmt(Number(item.amount))}</span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-center gap-1">
                          {item.status === "pending" || item.status === "overdue" ? (
                            <button
                              onClick={() => openReceive(item)}
                              className="h-7 px-2.5 bg-emerald-600 text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-emerald-500 transition-all flex items-center gap-1"
                            >
                              <CheckCircle2 size={11} /> Receber
                            </button>
                          ) : null}
                          <button onClick={() => openEdit(item)} className="h-7 w-7 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 transition-all">
                            <Edit2 size={13} />
                          </button>
                          <button onClick={() => openDelete(item)} className="h-7 w-7 flex items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-all">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-14 text-center text-[10px] font-black uppercase tracking-widest text-slate-300">
                      Nenhuma conta encontrada
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Mobile list */}
        <div className="sm:hidden divide-y divide-slate-50">
          {loading ? (
            <div className="flex items-center justify-center py-10"><Loader2 size={20} className="animate-spin text-slate-300" /></div>
          ) : filtered.length === 0 ? (
            <div className="px-4 py-12 text-center text-[10px] font-black uppercase tracking-widest text-slate-300">Nenhuma conta</div>
          ) : filtered.map(item => {
            const st = STATUS_CONFIG[item.status];
            return (
              <div key={item.id} className="px-4 py-3.5 flex items-center gap-3">
                <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0", item.status === "received" ? "bg-emerald-100 text-emerald-600" : item.status === "overdue" ? "bg-rose-100 text-rose-600" : "bg-amber-100 text-amber-600")}>
                  {st.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-bold text-slate-900 uppercase truncate">{item.description}</p>
                  <p className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">
                    Vence: {formatDateBR(item.due_date)} · {item.customer_name || "Sem cliente"}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-mono font-black text-emerald-600">R$ {fmt(Number(item.amount))}</p>
                  {(item.status === "pending" || item.status === "overdue") && (
                    <button onClick={() => openReceive(item)} className="text-[9px] font-black text-emerald-600 uppercase mt-0.5">Receber</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─────────────────────── MODALS ─────────────────────────────── */}

      {/* Create / Edit Modal */}
      {isFormModal && (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center sm:p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative w-full sm:max-w-lg bg-white sm:rounded-2xl rounded-t-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h2 className="text-[13px] font-black uppercase tracking-widest text-slate-900">
                  {modalMode === "create" ? "Nova Conta a Receber" : "Editar Conta"}
                </h2>
                <p className="text-[10px] text-slate-400 mt-0.5">Preencha os dados da conta</p>
              </div>
              <button onClick={closeModal} className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-all">
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <form id="ar-form" onSubmit={handleSave} className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
              {/* Descrição */}
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-[9px] font-black text-slate-400 uppercase tracking-[0.18em]">
                  <FileText size={10} /> Descrição *
                </label>
                <input
                  type="text" required placeholder="Ex: Venda para cliente, serviço prestado..."
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 h-11 text-xs font-bold focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-400 outline-none transition-all"
                />
              </div>

              {/* Valor + Vencimento */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-[9px] font-black text-slate-400 uppercase tracking-[0.18em]">
                    <DollarSign size={10} /> Valor (R$) *
                  </label>
                  <input
                    type="number" step="0.01" min="0.01" required placeholder="0,00"
                    value={form.amount}
                    onChange={e => setForm({ ...form, amount: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 h-11 text-sm font-mono font-bold focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-400 outline-none transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-[9px] font-black text-slate-400 uppercase tracking-[0.18em]">
                    <Calendar size={10} /> Vencimento *
                  </label>
                  <input
                    type="date" required
                    value={form.due_date}
                    onChange={e => setForm({ ...form, due_date: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 h-11 text-xs font-bold focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-400 outline-none transition-all"
                  />
                </div>
              </div>

              {/* Cliente + Categoria */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-[9px] font-black text-slate-400 uppercase tracking-[0.18em]">
                    <User size={10} /> Cliente
                  </label>
                  <input
                    type="text" placeholder="Nome do cliente"
                    value={form.customer_name}
                    onChange={e => setForm({ ...form, customer_name: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 h-11 text-xs font-bold focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-400 outline-none transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-[9px] font-black text-slate-400 uppercase tracking-[0.18em]">
                    <Tag size={10} /> Categoria
                  </label>
                  <select
                    value={form.category}
                    onChange={e => setForm({ ...form, category: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 h-11 text-xs font-bold focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-400 outline-none transition-all appearance-none"
                  >
                    <option value="">Selecionar...</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              {/* Observações */}
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-[9px] font-black text-slate-400 uppercase tracking-[0.18em]">
                  <StickyNote size={10} /> Observações
                </label>
                <textarea
                  placeholder="Observações adicionais..."
                  rows={2}
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-400 outline-none transition-all resize-none"
                />
              </div>
            </form>

            {/* Footer */}
            <div className="px-6 pb-5 flex gap-3">
              <button
                type="button" onClick={closeModal}
                className="flex-1 h-11 border border-slate-200 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                form="ar-form" type="submit" disabled={saving}
                className="flex-1 h-11 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-emerald-200 flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : modalMode === "create" ? "Cadastrar" : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receive Modal */}
      {modalMode === "receive" && selected && (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center sm:p-4">
          <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative w-full sm:max-w-md bg-[#0f172a] sm:rounded-2xl rounded-t-2xl shadow-2xl overflow-hidden border border-white/10 max-h-[92vh] flex flex-col">
            {/* Header dark */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Confirmar Recebimento</p>
                <h2 className="text-[15px] font-black uppercase tracking-wider text-white mt-0.5">Baixar Conta</h2>
              </div>
              <button onClick={closeModal} className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-500 hover:bg-white/10 transition-all">
                <X size={16} />
              </button>
            </div>

            {/* Resumo */}
            <div className="px-6 py-5 space-y-3 overflow-y-auto flex-1">
              <div className="bg-white/5 rounded-xl p-4 space-y-2">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Conta</span>
                  <span className="text-[11px] font-bold text-white text-right max-w-[200px]">{selected.description}</span>
                </div>
                {selected.customer_name && (
                  <div className="flex justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Cliente</span>
                    <span className="text-[11px] font-bold text-slate-300">{selected.customer_name}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Vencimento</span>
                  <span className={cn("text-[11px] font-bold", selected.status === "overdue" ? "text-rose-400" : "text-slate-300")}>
                    {formatDateBR(selected.due_date)}
                  </span>
                </div>
              </div>

              {/* Valor em destaque */}
              <div className="bg-emerald-600/20 border border-emerald-500/30 rounded-xl p-4 text-center">
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-400/70 mb-1">Valor Recebido</p>
                <p className="text-3xl font-mono font-black text-emerald-400">R$ {fmt(Number(selected.amount))}</p>
              </div>

              {/* Data recebimento */}
              <form id="receive-form" onSubmit={handleReceive}>
                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-[9px] font-black text-slate-400 uppercase tracking-[0.18em]">
                    <Calendar size={10} /> Data do Recebimento
                  </label>
                  <input
                    type="date" value={receiveDate}
                    onChange={e => setReceiveDate(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 h-11 text-xs font-bold text-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/50 outline-none transition-all"
                  />
                </div>
              </form>
            </div>

            {/* Footer */}
            <div className="px-6 pb-6 flex gap-3">
              <button
                type="button" onClick={closeModal}
                className="flex-1 h-12 border border-white/10 text-[10px] font-black uppercase tracking-widest rounded-xl text-slate-400 hover:bg-white/5 transition-colors"
              >
                Cancelar
              </button>
              <button
                form="receive-form" type="submit" disabled={saving}
                className="flex-1 h-12 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/50"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <><CheckCircle2 size={14} /> Confirmar Recebimento</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {modalMode === "delete" && selected && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-6 py-5 text-center">
              <div className="w-14 h-14 bg-rose-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Trash2 size={24} className="text-rose-500" />
              </div>
              <h2 className="text-[13px] font-black uppercase tracking-widest text-slate-900 mb-1">Excluir Conta?</h2>
              <p className="text-xs text-slate-500">{selected.description}</p>
              <p className="text-sm font-mono font-black text-rose-600 mt-1">R$ {fmt(Number(selected.amount))}</p>
            </div>
            <div className="px-6 pb-5 flex gap-3">
              <button onClick={closeModal} className="flex-1 h-11 border border-slate-200 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-slate-50 transition-colors">
                Cancelar
              </button>
              <button
                onClick={handleDelete} disabled={saving}
                className="flex-1 h-11 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : "Excluir"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
