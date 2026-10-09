import { useState, useEffect, useCallback, useRef } from "react";
import {
  Wrench, Plus, Search, Edit2, Trash2, Check,
  ToggleLeft, ToggleRight, Phone, FileText, HelpCircle,
} from "lucide-react";
import { motion } from "motion/react";
import { cn } from "../../lib/utils";
import { Button, Input, Textarea, Select, Switch, Modal, ModalFooter, Badge, EmptyState, IconButton, ContentCard, SectionTitle } from "../../components/ui";
import TechniciansPageTour, { TECHNICIANS_PAGE_TOUR_EVENTS, type TechniciansPageTourHandle } from "../../components/onboarding/TechniciansPageTour";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Technician {
  id: number;
  name: string;
  phone?: string;
  document?: string;
  is_active: boolean;
  notes?: string;
  created_at: string;
  user_id?: number | null;
}

interface TeamUser {
  id: number;
  name: string;
  email: string;
  role: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const authH = () => ({
  Authorization: `Bearer ${localStorage.getItem("token")}`,
  "Content-Type": "application/json",
});

const emptyForm = (): Omit<Technician, "id" | "created_at"> => ({
  name: "", phone: "", document: "", is_active: true, notes: "", user_id: null,
});

// ─── Component ────────────────────────────────────────────────────────────────

export default function Technicians() {
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]     = useState<Technician | null>(null);
  const [form, setForm]           = useState(emptyForm());
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);

  const [teamUsers, setTeamUsers] = useState<TeamUser[]>([]);

  const techniciansPageTourRef = useRef<TechniciansPageTourHandle>(null);

  const fetchTechnicians = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/technicians", { headers: authH() });
      setTechnicians(await r.json());
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTeamUsers = useCallback(async () => {
    const r = await fetch("/api/team", { headers: authH() });
    const d = await r.json();
    setTeamUsers(Array.isArray(d) ? d : []);
  }, []);

  useEffect(() => { fetchTechnicians(); fetchTeamUsers(); }, [fetchTechnicians, fetchTeamUsers]);

  const openNew = () => { setEditing(null); setForm(emptyForm()); setShowModal(true); };

  const openEdit = (t: Technician) => {
    setEditing(t);
    setForm({
      name: t.name, phone: t.phone ?? "", document: t.document ?? "",
      is_active: t.is_active, notes: t.notes ?? "", user_id: t.user_id ?? null,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const url    = editing ? `/api/technicians/${editing.id}` : "/api/technicians";
      const method = editing ? "PUT" : "POST";
      await fetch(url, { method, headers: authH(), body: JSON.stringify(form) });
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
      setShowModal(false);
      await fetchTechnicians();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Excluir este técnico? As ordens de serviço anteriores não serão afetadas.")) return;
    await fetch(`/api/technicians/${id}`, { method: "DELETE", headers: authH() });
    fetchTechnicians();
  };

  const handleToggleActive = async (t: Technician) => {
    await fetch(`/api/technicians/${t.id}`, {
      method: "PUT", headers: authH(),
      body: JSON.stringify({ ...t, is_active: !t.is_active }),
    });
    fetchTechnicians();
  };

  const filtered = technicians.filter((t) =>
    !search || t.name.toLowerCase().includes(search.toLowerCase())
  );

  // ── Canal de comunicação do TOUR DE PÁGINA (TechniciansPageTour) ──────────
  // Abre o modal "Novo Técnico" de verdade via openNew (ou openEdit com o
  // primeiro técnico da lista, se houver) e preenche campos de exemplo via
  // setForm — nunca chama handleSave (POST/PUT real), handleDelete
  // (window.confirm) nem handleToggleActive (PUT real fora do modal). Fechar
  // sempre via setShowModal(false) (equivalente a clicar fora ou no X, que já
  // fazem isso na tela real).
  useEffect(() => {
    const onOpenNewTechnician = () => openNew();
    const onFillTechnician = (e: Event) => {
      const detail = (e as CustomEvent<Partial<typeof form>>).detail;
      if (detail) setForm((prev) => ({ ...prev, ...detail }));
    };
    const onCloseTechnicianModal = () => setShowModal(false);
    const onOpenEditTechnician = () => {
      const list = Array.isArray(technicians) ? technicians : [];
      if (list.length > 0) openEdit(list[0]);
    };

    window.addEventListener(TECHNICIANS_PAGE_TOUR_EVENTS.openNewTechnician, onOpenNewTechnician);
    window.addEventListener(TECHNICIANS_PAGE_TOUR_EVENTS.fillTechnician, onFillTechnician);
    window.addEventListener(TECHNICIANS_PAGE_TOUR_EVENTS.closeTechnicianModal, onCloseTechnicianModal);
    window.addEventListener(TECHNICIANS_PAGE_TOUR_EVENTS.openEditTechnician, onOpenEditTechnician);
    return () => {
      window.removeEventListener(TECHNICIANS_PAGE_TOUR_EVENTS.openNewTechnician, onOpenNewTechnician);
      window.removeEventListener(TECHNICIANS_PAGE_TOUR_EVENTS.fillTechnician, onFillTechnician);
      window.removeEventListener(TECHNICIANS_PAGE_TOUR_EVENTS.closeTechnicianModal, onCloseTechnicianModal);
      window.removeEventListener(TECHNICIANS_PAGE_TOUR_EVENTS.openEditTechnician, onOpenEditTechnician);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [technicians]);

  return (
    <div data-tour="technicians-page" className="space-y-4">
      <SectionTitle
        title="Técnicos"
        icon={Wrench}
        description="Cadastro de técnicos e prestadores de serviço para atribuir em Ordens de Serviço"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button data-tour="technicians-new-btn" size="sm" iconLeft={<Plus size={14} />} onClick={openNew}>
              Novo Técnico
            </Button>
            <Button
              variant="outline"
              size="sm"
              iconLeft={<HelpCircle size={14} />}
              onClick={() => techniciansPageTourRef.current?.start()}
              title="Tour guiado desta página"
            >
              <span className="sr-only sm:not-sr-only">Ajuda</span>
            </Button>
          </div>
        }
      />

      <TechniciansPageTour ref={techniciansPageTourRef} />

      {/* Search */}
      <Input
        wrapperClassName="max-w-sm"
        iconLeft={<Search size={14} />}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar técnico..."
        aria-label="Buscar técnico"
      />

      {loading ? (
        <div role="status" className="flex justify-center py-12 text-sm text-slate-500">Carregando…</div>
      ) : filtered.length === 0 ? (
        <ContentCard>
          <EmptyState
            icon={Wrench}
            title="Nenhum técnico cadastrado"
            action={<Button size="sm" onClick={openNew}>Cadastrar primeiro técnico</Button>}
          />
        </ContentCard>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((t) => (
            <motion.div key={t.id}
              initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 transition-all hover:border-blue-200"
            >
              <div className="flex items-start gap-3">
                <div className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-base font-semibold text-white",
                  t.is_active ? "bg-blue-600" : "bg-slate-300"
                )}>
                  {t.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-slate-900">{t.name}</p>
                  <Badge size="sm" dot color={t.is_active ? "success" : "default"} className="mt-0.5">
                    {t.is_active ? "Ativo" : "Inativo"}
                  </Badge>
                </div>
                <div className="flex shrink-0 gap-1">
                  <IconButton size="xs" aria-label="Editar técnico" onClick={() => openEdit(t)}>
                    <Edit2 size={13} />
                  </IconButton>
                  <IconButton size="xs" variant="danger" aria-label="Excluir técnico" onClick={() => handleDelete(t.id)}>
                    <Trash2 size={13} />
                  </IconButton>
                </div>
              </div>

              <div className="space-y-1">
                {t.phone && (
                  <div className="flex items-center gap-2 text-[11px] text-slate-500">
                    <Phone size={11} className="shrink-0" /> {t.phone}
                  </div>
                )}
                {t.document && (
                  <div className="flex items-center gap-2 text-[11px] text-slate-500">
                    <FileText size={11} className="shrink-0" /> {t.document}
                  </div>
                )}
              </div>

              {t.notes && (
                <p className="line-clamp-2 break-words rounded-lg bg-slate-50 px-2.5 py-2 text-[11px] text-slate-500">{t.notes}</p>
              )}

              <Button
                data-tour="technician-toggle-active-btn"
                variant={t.is_active ? "outline" : "success"}
                size="xs"
                fullWidth
                iconLeft={t.is_active ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                onClick={() => handleToggleActive(t)}
              >
                {t.is_active ? "Desativar" : "Ativar"}
              </Button>
            </motion.div>
          ))}
        </div>
      )}

      {/* ══════════ MODAL CADASTRO / EDIÇÃO ══════════ */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editing ? "Editar Técnico" : "Novo Técnico"}
        size="sm"
        footer={
          <ModalFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button
              onClick={handleSave}
              disabled={saving || !form.name.trim()}
              iconLeft={saved ? <Check size={14} /> : undefined}
            >
              {saved ? "Salvo!" : saving ? "Salvando…" : editing ? "Atualizar" : "Cadastrar"}
            </Button>
          </ModalFooter>
        }
      >
        <div className="space-y-4">
          <div data-tour="technician-form-name">
            <Input
              label="Nome *"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Nome completo"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="Telefone"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              placeholder="(11) 99999-9999"
            />
            <Input
              label="CPF / CNPJ"
              value={form.document}
              onChange={(e) => setForm((f) => ({ ...f, document: e.target.value }))}
              placeholder="000.000.000-00"
            />
          </div>

          <Select
            label="Vincular a um usuário do sistema"
            value={form.user_id ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, user_id: e.target.value ? Number(e.target.value) : null }))}
          >
            <option value="">Nenhum</option>
            {teamUsers.map((u) => (
              <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
            ))}
          </Select>

          <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-3">
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-slate-700">Técnico Ativo</p>
              <p className="text-[11px] text-slate-500">Pode ser selecionado na Ordem de Serviço</p>
            </div>
            <Switch
              checked={form.is_active}
              onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))}
              aria-label="Técnico ativo"
            />
          </div>

          <Textarea
            label="Observações"
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            rows={2}
            placeholder="Especialidade, região de atendimento..."
          />
        </div>
      </Modal>
    </div>
  );
}
