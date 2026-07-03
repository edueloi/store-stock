import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Store, Palette, Share2, Clock, CreditCard, Shield, Settings2,
  Users, Save, Loader2, Search, Check, ChevronRight, Globe,
  Bell, Sun, Moon, Package, AlertTriangle, Lock, Image, Upload, X, FileCheck,
  Smartphone, Zap, UserPlus, Trash2, Edit2, Eye, EyeOff, ShoppingCart, User,
  Monitor, Download, WifiOff, Terminal, CheckCircle2, XCircle, ClipboardList,
} from "lucide-react";
import PageHeader from "../../components/layout/PageHeader";
import { cn } from "../../lib/utils";
import { useToast } from "../../components/ui/Toast";
import type { Tenant, BusinessHours, PaymentMethods, StorePolicies, CardFees } from "../../types";

// ─── helpers ────────────────────────────────────────────────────────────────

const API_HEADERS = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${localStorage.getItem("token")}`,
});

const DAYS: { key: string; label: string }[] = [
  { key: "seg", label: "Segunda" },
  { key: "ter", label: "Terça" },
  { key: "qua", label: "Quarta" },
  { key: "qui", label: "Quinta" },
  { key: "sex", label: "Sexta" },
  { key: "sab", label: "Sábado" },
  { key: "dom", label: "Domingo" },
];

const DEFAULT_HOURS: BusinessHours = Object.fromEntries(
  DAYS.map(({ key }) => [key, { open: "09:00", close: "18:00", closed: key === "dom" }])
);

const DEFAULT_PAYMENTS: PaymentMethods = {
  pix: true, credit_card: true, debit_card: true, cash: true, boleto: false,
};

const DEFAULT_POLICIES: StorePolicies = {
  returns: "",
  shipping: "",
  exchange: "",
  warranty_days: 90,
  warranty_resolution_days: 30,
  warranty_title: "Termos e Condições de Garantia",
  warranty_clauses: [
    "A garantia cobre defeitos de fabricação pelo período estabelecido a partir da data de emissão deste termo, conforme art. 26 do Código de Defesa do Consumidor (Lei 8.078/90).",
    "Para acionar a garantia, o cliente deverá apresentar este documento juntamente com comprovante de compra e identificação pessoal.",
    "A garantia não cobre danos causados por uso inadequado, queda, umidade, mau uso, tentativa de conserto por terceiros não autorizados ou desgaste natural do produto.",
    "O produto defeituoso será reparado, substituído por outro de mesma espécie, ou o valor será devolvido, a critério do fornecedor e conforme disponibilidade de estoque.",
    "Esta garantia é intransferível e válida somente para o comprador original identificado neste documento.",
  ],
};

// ─── sub-components ──────────────────────────────────────────────────────────

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="pb-4 border-b border-slate-100 mb-6">
      <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">{title}</h3>
      {subtitle && <p className="text-[10px] text-slate-400 font-medium mt-1">{subtitle}</p>}
    </div>
  );
}

function Field({
  label, hint, children,
}: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.18em] px-1 block">
        {label}
      </label>
      {children}
      {hint && <p className="text-[9px] text-slate-400 font-medium px-1">{hint}</p>}
    </div>
  );
}

function TextInput({
  value, onChange, placeholder, type = "text", mono = false, className = "",
}: {
  value: string; onChange: (v: string) => void; placeholder?: string;
  type?: string; mono?: boolean; className?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn(
        "w-full bg-slate-50 border border-slate-200 rounded-xl px-4 h-11 text-xs font-bold outline-none",
        "focus:ring-4 focus:ring-blue-500/8 focus:border-blue-500 transition-all",
        mono ? "font-mono" : "font-sans",
        className,
      )}
    />
  );
}

function Toggle({
  checked, onChange, label,
}: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() => onChange(!checked)}
        className={cn(
          "w-10 h-5 rounded-full transition-all relative shadow-inner shrink-0",
          checked ? "bg-emerald-500" : "bg-slate-200",
        )}
      >
        <div className={cn(
          "absolute top-1 w-3 h-3 bg-white rounded-full transition-all shadow-sm",
          checked ? "left-6" : "left-1",
        )} />
      </button>
      {label && <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">{label}</span>}
    </div>
  );
}

function SaveButton({ onClick, label = "Guardar Alterações", className = "" }: {
  onClick: () => void; label?: string; className?: string;
}) {
  return (
    <div className={cn("pt-6 border-t border-slate-100 flex justify-end", className)}>
      <button
        onClick={onClick}
        className="bg-blue-600 text-white px-8 h-12 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-blue-500/20 flex items-center gap-3 hover:bg-blue-700 transition-all active:scale-95"
      >
        <Save size={15} strokeWidth={2.5} /> {label}
      </button>
    </div>
  );
}

// ─── nav groups ──────────────────────────────────────────────────────────────

const NAV = [
  {
    group: "Loja Pública",
    desc: "Visível para os seus clientes",
    color: "text-blue-600",
    items: [
      { id: "identity", icon: Store, label: "Identidade & Dados" },
      { id: "design", icon: Palette, label: "Design e Modelos" },
      { id: "social", icon: Share2, label: "Canais Sociais" },
      { id: "hours", icon: Clock, label: "Horário de Funcionamento" },
      { id: "payments", icon: CreditCard, label: "Pagamentos & Políticas" },
      { id: "card_fees", icon: CreditCard, label: "Maquininha & Taxas" },
      { id: "warranty", icon: FileCheck, label: "Termos de Garantia" },
      { id: "service_checklists", icon: ClipboardList, label: "Checklists de OS" },
    ],
  },
  {
    group: "Sistema",
    desc: "Configurações do painel admin",
    color: "text-slate-400",
    items: [
      { id: "terminal", icon: Terminal, label: "Maquininha (API)" },
      { id: "preferences", icon: Settings2, label: "Preferências do Painel" },
      { id: "security", icon: Shield, label: "Segurança" },
      { id: "users", icon: Users, label: "Time & Acessos" },
      { id: "desktop", icon: Monitor, label: "App Desktop PDV" },
    ],
  },
];

// ─── TeamSection ─────────────────────────────────────────────────────────────

type TeamMember = { id: number; name: string; email: string; role: string; created_at: string };
type MemberForm = { name: string; email: string; password: string; role: string; showPass: boolean };

const ROLE_META: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode; desc: string }> = {
  admin: { label: "Admin",       color: "#2563eb", bg: "#eff6ff", icon: <Shield size={12} />,      desc: "Acesso total ao painel" },
  staff: { label: "Atendente",   color: "#059669", bg: "#ecfdf5", icon: <User size={12} />,         desc: "Pedidos, clientes, catálogo, estoque e categorias" },
  pdv:   { label: "Operador PDV",color: "#d97706", bg: "#fffbeb", icon: <ShoppingCart size={12} />, desc: "Acesso somente ao PDV" },
};

function TeamSection() {
  const toast = useToast();
  const [members, setMembers]     = useState<TeamMember[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [saving, setSaving]       = useState(false);
  const [editId, setEditId]       = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [form, setForm]           = useState<MemberForm>({ name: "", email: "", password: "", role: "staff", showPass: false });

  const token = localStorage.getItem("token");
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/team", { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setMembers(await res.json());
    } finally { setLoading(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditId(null);
    setForm({ name: "", email: "", password: "", role: "staff", showPass: false });
    setShowForm(true);
  };

  const openEdit = (m: TeamMember) => {
    setEditId(m.id);
    setForm({ name: m.name, email: m.email, password: "", role: m.role, showPass: false });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.email.trim()) { toast.error("Nome e e-mail são obrigatórios."); return; }
    if (!editId && !form.password) { toast.error("Senha é obrigatória para novo membro."); return; }

    setSaving(true);
    try {
      const body: Record<string, string> = { name: form.name, email: form.email, role: form.role };
      if (form.password) body.password = form.password;

      const res = await fetch(editId ? `/api/team/${editId}` : "/api/team", {
        method: editId ? "PATCH" : "POST",
        headers,
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(editId ? "Membro atualizado!" : "Membro criado com sucesso!");
        setShowForm(false);
        load();
      } else {
        toast.error(data.error || "Erro ao salvar.");
      }
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/team/${id}`, { method: "DELETE", headers });
      if (res.ok) {
        toast.success("Membro removido.");
        setMembers(ms => ms.filter(m => m.id !== id));
      } else {
        const data = await res.json();
        toast.error(data.error || "Erro ao remover.");
      }
    } finally { setDeletingId(null); }
  };

  return (
    <div className="space-y-6">
      <SectionHeader title="Time & Acessos" subtitle="Gerencie quem tem acesso ao painel e ao PDV" />

      {/* Role legend */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {Object.entries(ROLE_META).map(([key, meta]) => (
          <div key={key} className="flex items-start gap-3 p-4 rounded-2xl border border-slate-100 bg-white">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: meta.bg, color: meta.color }}>
              {meta.icon}
            </div>
            <div>
              <p className="text-[11px] font-black uppercase tracking-wider" style={{ color: meta.color }}>{meta.label}</p>
              <p className="text-[10px] text-slate-400 mt-0.5 font-medium leading-relaxed">{meta.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Members list */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Users size={15} className="text-slate-400" />
            <p className="text-[11px] font-black uppercase tracking-widest text-slate-700">Membros</p>
            <span className="bg-slate-100 text-slate-500 text-[9px] font-black px-2 py-0.5 rounded-full">{members.length}</span>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 h-8 px-4 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all active:scale-95 shadow-sm shadow-blue-500/25"
          >
            <UserPlus size={12} /> Adicionar
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={20} className="animate-spin text-slate-300" />
          </div>
        ) : members.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2 text-slate-300">
            <Users size={32} strokeWidth={1} />
            <p className="text-[10px] font-black uppercase tracking-wider">Nenhum membro cadastrado</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {members.map(m => {
              const meta = ROLE_META[m.role] ?? ROLE_META.staff;
              return (
                <div key={m.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50/60 transition-colors">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-sm font-black"
                    style={{ backgroundColor: meta.bg, color: meta.color }}
                  >
                    {m.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-bold text-slate-800 leading-tight truncate">{m.name}</p>
                    <p className="text-[10px] text-slate-400 font-medium truncate">{m.email}</p>
                  </div>
                  <span
                    className="shrink-0 inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full"
                    style={{ backgroundColor: meta.bg, color: meta.color }}
                  >
                    {meta.icon} {meta.label}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => openEdit(m)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      onClick={() => handleDelete(m.id)}
                      disabled={deletingId === m.id}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all disabled:opacity-40"
                    >
                      {deletingId === m.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* PDV info banner */}
      <div className="flex items-start gap-3 p-4 rounded-2xl border border-amber-200 bg-amber-50">
        <ShoppingCart size={16} className="text-amber-600 mt-0.5 shrink-0" />
        <div>
          <p className="text-[11px] font-black text-amber-700 uppercase tracking-wider">Operadores PDV</p>
          <p className="text-[10px] text-amber-600 font-medium leading-relaxed mt-0.5">
            Usuários com perfil <strong>Operador PDV</strong> são direcionados automaticamente para o terminal de vendas ao fazer login.
            Eles não têm acesso ao painel administrativo.
          </p>
        </div>
      </div>

      {/* Modal form */}
      {showForm && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-100 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  {editId ? "Editar membro" : "Novo membro"}
                </p>
                <h3 className="text-sm font-black text-slate-800 mt-0.5">
                  {editId ? "Atualizar dados de acesso" : "Adicionar ao time"}
                </h3>
              </div>
              <button onClick={() => setShowForm(false)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all">
                <X size={16} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Name */}
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1.5">Nome</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Nome completo"
                  className="w-full h-10 px-3 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 placeholder:text-slate-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                />
              </div>

              {/* Email */}
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1.5">E-mail</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="email@exemplo.com"
                  className="w-full h-10 px-3 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 placeholder:text-slate-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                />
              </div>

              {/* Password */}
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1.5">
                  Senha {editId && <span className="normal-case font-medium text-slate-400">(deixe em branco para manter)</span>}
                </label>
                <div className="relative">
                  <input
                    type={form.showPass ? "text" : "password"}
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    placeholder={editId ? "Nova senha (opcional)" : "Senha de acesso"}
                    className="w-full h-10 px-3 pr-10 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 placeholder:text-slate-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, showPass: !f.showPass }))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                  >
                    {form.showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              {/* Role */}
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-2">Perfil de acesso</label>
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(ROLE_META).map(([key, meta]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, role: key }))}
                      className={cn(
                        "flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-center",
                        form.role === key
                          ? "border-current shadow-sm"
                          : "border-slate-100 hover:border-slate-200 bg-white"
                      )}
                      style={form.role === key ? { borderColor: meta.color, backgroundColor: meta.bg } : {}}
                    >
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: meta.bg, color: meta.color }}>
                        {meta.icon}
                      </div>
                      <p className="text-[9px] font-black uppercase tracking-wider leading-tight" style={{ color: form.role === key ? meta.color : undefined }}>
                        {meta.label}
                      </p>
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-slate-400 mt-2 font-medium">{ROLE_META[form.role]?.desc}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 px-6 pb-6">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 h-10 border border-slate-200 rounded-xl text-[11px] font-black uppercase tracking-wider text-slate-500 hover:bg-slate-50 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 h-10 bg-blue-600 text-white rounded-xl text-[11px] font-black uppercase tracking-wider hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {editId ? "Salvar" : "Criar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── main component ──────────────────────────────────────────────────────────

export default function Settings() {
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  // tab ativa sincronizada com ?tab=xxx na URL
  const active = searchParams.get("tab") ?? "identity";
  const setActive = useCallback((id: string) => {
    setSearchParams((prev) => { const n = new URLSearchParams(prev); n.set("tab", id); return n; }, { replace: true });
  }, [setSearchParams]);

  // sub-tab de maquininha sincronizada com ?payType=xxx
  const activePayType = (searchParams.get("payType") ?? "credit") as "credit" | "debit" | "pix";
  const setActivePayType = useCallback((id: "credit" | "debit" | "pix") => {
    setSearchParams((prev) => { const n = new URLSearchParams(prev); n.set("payType", id); return n; }, { replace: true });
  }, [setSearchParams]);

  const [tenant, setTenant] = useState<Partial<Tenant> | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  // system prefs (stored in UserPreference)
  const [panelTheme, setPanelTheme] = useState<"light" | "dark">("light");
  const [lowStockAlert, setLowStockAlert] = useState(5);
  const [panelLang, setPanelLang] = useState("pt-BR");
  const [printerSize, setPrinterSize] = useState<"58mm" | "80mm" | "A4">("58mm");

  // password fields
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");

  // card fees state
  const DEFAULT_CARD_FEES: CardFees = {
    visa:   [2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 0, 0, 0, 0, 0, 0],
    master: [2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 0, 0, 0, 0, 0, 0],
    elo:    [2.8, 3.3, 3.8, 4.3, 4.8, 5.3, 0, 0, 0, 0, 0, 0],
    amex:   [3.0, 3.5, 4.0, 4.5, 5.0, 5.5, 0, 0, 0, 0, 0, 0],
    hiper:  [2.7, 3.2, 3.7, 4.2, 4.7, 5.2, 0, 0, 0, 0, 0, 0],
    other:  [2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 0, 0, 0, 0, 0, 0],
  };
  const [cardFees, setCardFees] = useState<CardFees>(DEFAULT_CARD_FEES);
  const [passFeeToCustomer, setPassFeeToCustomer] = useState(false);
  const [maxInstallments, setMaxInstallments] = useState(12);
  // Bandeiras habilitadas: { visa: true, master: true, ... }
  const [enabledBrands, setEnabledBrands] = useState<Record<string, boolean>>({
    visa: true, master: true, elo: true, amex: true, hiper: true, other: true,
  });
  // Repasse de taxa por método: { credit: false, debit: false, pix: false }
  const [passFeeByMethod, setPassFeeByMethod] = useState<Record<string, boolean>>({
    credit: false, debit: false, pix: false,
  });

  // ── Terminal (maquininha API) ────────────────────────────────────────────────
  type TerminalProvider = "rede" | "stone" | "mercadopago" | "cielo" | "pagseguro";
  const TERMINAL_PROVIDERS: { id: TerminalProvider; label: string; color: string }[] = [
    { id: "rede",        label: "Rede (Itaú)",        color: "#FF6200" },
    { id: "stone",       label: "Stone",               color: "#00A868" },
    { id: "mercadopago", label: "Mercado Pago",        color: "#009EE3" },
    { id: "cielo",       label: "Cielo",               color: "#00AEEF" },
    { id: "pagseguro",   label: "PagSeguro",           color: "#F7971C" },
  ];
  const [terminalProvider, setTerminalProvider] = useState<TerminalProvider>("rede");
  const [terminalSandbox, setTerminalSandbox] = useState(true);
  const [terminalClientId, setTerminalClientId] = useState("");
  const [terminalClientSecret, setTerminalClientSecret] = useState("");
  const [terminalPingStatus, setTerminalPingStatus] = useState<"idle" | "loading" | "ok" | "fail">("idle");
  const [terminalSaving, setTerminalSaving] = useState(false);

  useEffect(() => {
    fetch("/api/tenant", { headers: API_HEADERS() })
      .then((r) => r.json())
      .then((d) => {
        setTenant(d);
        if (d?.card_fees) setCardFees(d.card_fees);
        if (d?.pass_fee_to_customer !== undefined) setPassFeeToCustomer(Boolean(d.pass_fee_to_customer));
        if (d?.max_installments) setMaxInstallments(Number(d.max_installments));
        if (d?.enabled_brands) setEnabledBrands(d.enabled_brands as Record<string, boolean>);
        if (d?.pass_fee_by_method) setPassFeeByMethod(d.pass_fee_by_method as Record<string, boolean>);
        setLoading(false);
      });

    fetch("/api/terminals/config", { headers: API_HEADERS() })
      .then((r) => r.json())
      .then((cfg) => {
        if (!cfg) return;
        if (cfg.provider) setTerminalProvider(cfg.provider as TerminalProvider);
        if (cfg.sandbox !== undefined) setTerminalSandbox(Boolean(cfg.sandbox));
        if (cfg.credentials?.clientId) setTerminalClientId(cfg.credentials.clientId);
        if (cfg.credentials?.clientSecret) setTerminalClientSecret(cfg.credentials.clientSecret);
      })
      .catch(() => { /* terminal config optional */ });

    // load panel prefs
    Promise.all([
      fetch("/api/preferences/panel_theme", { headers: API_HEADERS() }).then((r) => r.json()),
      fetch("/api/preferences/low_stock_alert", { headers: API_HEADERS() }).then((r) => r.json()),
      fetch("/api/preferences/panel_lang", { headers: API_HEADERS() }).then((r) => r.json()),
      fetch("/api/preferences/receipt_printer_size", { headers: API_HEADERS() }).then((r) => r.json()).catch(() => null),
    ]).then(([theme, alert, lang, printer]) => {
      if (theme) setPanelTheme(theme as "light" | "dark");
      if (alert !== null) setLowStockAlert(Number(alert));
      if (lang) setPanelLang(lang as string);
      if (printer) setPrinterSize(printer as "58mm" | "80mm" | "A4");
    }).catch(() => { /* prefs optional */ });
  }, []);

  const setT = useCallback(
    (patch: Partial<Tenant>) => setTenant((prev) => ({ ...prev, ...patch })),
    [],
  );

  const hours = (tenant?.business_hours ?? DEFAULT_HOURS) as BusinessHours;
  const payments = (tenant?.payment_methods ?? DEFAULT_PAYMENTS) as PaymentMethods;
  const policies = (tenant?.policies ?? DEFAULT_POLICIES) as StorePolicies;

  const showSaved = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleSaveTenant = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/tenant", {
        method: "PUT",
        headers: API_HEADERS(),
        body: JSON.stringify(tenant),
      });
      if (res.ok) showSaved();
    } finally {
      setSaving(false);
    }
  };

  const handleSavePrefs = async () => {
    setSaving(true);
    try {
      await Promise.all([
        fetch("/api/preferences/panel_theme", {
          method: "PUT", headers: API_HEADERS(),
          body: JSON.stringify({ value: panelTheme }),
        }),
        fetch("/api/preferences/low_stock_alert", {
          method: "PUT", headers: API_HEADERS(),
          body: JSON.stringify({ value: lowStockAlert }),
        }),
        fetch("/api/preferences/panel_lang", {
          method: "PUT", headers: API_HEADERS(),
          body: JSON.stringify({ value: panelLang }),
        }),
        fetch("/api/preferences/receipt_printer_size", {
          method: "PUT", headers: API_HEADERS(),
          body: JSON.stringify({ value: printerSize }),
        }),
      ]);
      showSaved();
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!newPass || newPass !== confirmPass) {
      alert("As senhas não coincidem ou estão vazias.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST", headers: API_HEADERS(),
        body: JSON.stringify({ password: newPass }),
      });
      if (res.ok) { showSaved(); setNewPass(""); setConfirmPass(""); }
      else alert("Erro ao alterar senha.");
    } finally {
      setSaving(false);
    }
  };

  const maskDocument = (raw: string) => {
    const d = raw.replace(/\D/g, "").slice(0, 14);
    if (d.length <= 11) {
      // CPF: 000.000.000-00
      return d
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    }
    // CNPJ: 00.000.000/0001-00
    return d
      .replace(/(\d{2})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1/$2")
      .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
  };

  const handleLogoUpload = async (file: File) => {
    setLogoUploading(true);
    try {
      const form = new FormData();
      form.append("image", file);
      const res = await fetch("/api/upload/logo", {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        body: form,
      });
      if (res.ok) {
        const { url } = await res.json();
        // Atualiza state e persiste imediatamente no banco
        setTenant((prev) => {
          const updated = { ...prev, logo_url: url };
          fetch("/api/tenant", {
            method: "PUT",
            headers: API_HEADERS(),
            body: JSON.stringify(updated),
          }).then(() => showSaved()).catch(() => {});
          return updated;
        });
      }
    } finally {
      setLogoUploading(false);
    }
  };

  const handleLookupCEP = async () => {
    const raw = (tenant?.address_zip ?? "").replace(/\D/g, "");
    if (raw.length !== 8) return;
    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${raw}/json/`);
      const d = await res.json();
      if (!d.erro) {
        setT({
          address_street:   d.logradouro ?? "",
          address_district: d.bairro ?? "",
          address_city:     d.localidade ?? "",
          address_state:    d.uf ?? "",
          address_zip:      raw,
        });
      }
    } catch {
      // silent
    } finally {
      setCepLoading(false);
    }
  };

  const handleSaveCardFees = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/tenant", {
        method: "PUT",
        headers: API_HEADERS(),
        body: JSON.stringify({
          card_fees: cardFees,
          pass_fee_to_customer: passFeeToCustomer,
          max_installments: maxInstallments,
          enabled_brands: enabledBrands,
          pass_fee_by_method: passFeeByMethod,
        }),
      });
      if (res.ok) {
        toast.success("Taxas salvas com sucesso!");
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error("Erro ao salvar: " + (err?.error ?? res.status));
      }
    } catch {
      toast.error("Erro de conexão ao salvar taxas.");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveTerminal = async () => {
    if (!terminalClientId || !terminalClientSecret) {
      toast.error("Preencha o Client ID e o Client Secret.");
      return;
    }
    setTerminalSaving(true);
    try {
      const res = await fetch("/api/terminals/config", {
        method: "PUT",
        headers: API_HEADERS(),
        body: JSON.stringify({
          provider: terminalProvider,
          sandbox: terminalSandbox,
          credentials: { clientId: terminalClientId, clientSecret: terminalClientSecret },
        }),
      });
      if (res.ok) toast.success("Configuração de maquininha salva!");
      else toast.error("Erro ao salvar configuração.");
    } catch {
      toast.error("Erro de conexão.");
    } finally {
      setTerminalSaving(false);
    }
  };

  const handlePingTerminal = async () => {
    setTerminalPingStatus("loading");
    try {
      const res = await fetch("/api/terminals/ping", {
        method: "POST",
        headers: API_HEADERS(),
        body: JSON.stringify({
          provider: terminalProvider,
          sandbox: terminalSandbox,
          credentials: { clientId: terminalClientId, clientSecret: terminalClientSecret },
        }),
      });
      const data = await res.json();
      setTerminalPingStatus(data.ok ? "ok" : "fail");
    } catch {
      setTerminalPingStatus("fail");
    }
  };

  const setFeeRate = (brand: string, installmentIdx: number, value: number) => {
    setCardFees((prev) => {
      const existing = prev[brand] ?? [];
      // expande o array se necessário
      const arr = [...existing];
      while (arr.length <= installmentIdx) arr.push(0);
      arr[installmentIdx] = value;
      return { ...prev, [brand]: arr };
    });
  };

  const setDebitRate = (brand: string, value: number) => {
    setCardFees((prev) => ({ ...prev, [`debit_${brand}`]: [value] }));
  };

  const setPixRate = (value: number) => {
    setCardFees((prev) => ({ ...prev, pix: [value] }));
  };

  const setHours = (day: string, patch: Partial<{ open: string; close: string; closed: boolean }>) =>
    setT({ business_hours: { ...hours, [day]: { ...hours[day], ...patch } } });

  const setPayment = (key: keyof PaymentMethods, val: boolean) =>
    setT({ payment_methods: { ...payments, [key]: val } });

  const setPolicies = (patch: Partial<StorePolicies>) =>
    setT({ policies: { ...policies, ...patch } });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-slate-300" size={28} />
      </div>
    );
  }

  // find active item label
  const allItems = NAV.flatMap((g) => g.items);
  const activeItem = allItems.find((i) => i.id === active);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Configurações"
        subtitle="Loja pública e sistema interno"
        action={saved ? (
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest">
            <Check size={13} strokeWidth={3} /> Salvo com sucesso
          </div>
        ) : undefined}
      />

      <div className="flex flex-col lg:flex-row gap-5">
        {/* ── Sidebar ──────────────────────────────────────────────────── */}
        <aside className="w-full lg:w-64 shrink-0">
          {/* mobile: horizontal scroll */}
          <div className="flex lg:hidden gap-2 overflow-x-auto no-scrollbar pb-2">
            {allItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActive(item.id)}
                className={cn(
                  "flex items-center gap-2 px-4 h-10 rounded-xl text-[9px] font-black uppercase tracking-widest whitespace-nowrap shrink-0 transition-all",
                  active === item.id
                    ? "bg-slate-900 text-white shadow-lg"
                    : "bg-white border border-slate-100 text-slate-400 hover:border-slate-200",
                )}
              >
                <item.icon size={13} />
                {item.label}
              </button>
            ))}
          </div>

          {/* desktop: stacked sidebar */}
          <div className="hidden lg:flex flex-col gap-1">
            {NAV.map((group) => (
              <div key={group.group} className="mb-3">
                <div className="px-3 pb-1.5 flex items-center gap-2">
                  <Globe size={10} className={group.color} />
                  <span className={cn("text-[9px] font-black uppercase tracking-[0.2em]", group.color)}>
                    {group.group}
                  </span>
                </div>
                <div className="space-y-0.5">
                  {group.items.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setActive(item.id)}
                      className={cn(
                        "w-full flex items-center justify-between px-3 h-10 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all group",
                        active === item.id
                          ? "bg-slate-900 text-white shadow-lg shadow-slate-200"
                          : "text-slate-500 hover:bg-slate-50 hover:text-slate-800",
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <item.icon size={14} strokeWidth={active === item.id ? 2.5 : 2} />
                        {item.label}
                      </div>
                      <ChevronRight
                        size={12}
                        className={cn(
                          "transition-opacity",
                          active === item.id ? "opacity-60" : "opacity-0 group-hover:opacity-30",
                        )}
                      />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* ── Content ──────────────────────────────────────────────────── */}
        <div className="flex-1 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {/* breadcrumb strip */}
          <div className="px-6 py-3 border-b border-slate-50 flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-slate-300">
            <Settings2 size={10} />
            <span>Configurações</span>
            <ChevronRight size={9} />
            <span className="text-slate-600">{activeItem?.label}</span>
          </div>

          <div className="p-6 sm:p-8">
            {/* ── Identidade & Dados ──────────────────────────────────── */}
            {active === "identity" && (
              <div className="space-y-8">
                <SectionHeader
                  title="Identidade & Dados"
                  subtitle="Informações básicas da sua loja exibidas para os clientes e usadas nas notas"
                />

                {/* Logo */}
                <div className="space-y-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-700 border-l-4 border-blue-500 pl-3">
                    Logo do Estabelecimento
                  </p>
                  <div className="flex items-start gap-5">
                    {/* preview */}
                    <div
                      className="w-24 h-24 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center shrink-0 overflow-hidden cursor-pointer hover:border-blue-400 transition-colors relative group"
                      onClick={() => logoInputRef.current?.click()}
                    >
                      {tenant?.logo_url ? (
                        <>
                          <img src={tenant.logo_url} alt="Logo" className="w-full h-full object-contain p-1" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-2xl">
                            <Upload size={20} className="text-white" />
                          </div>
                        </>
                      ) : (
                        <div className="flex flex-col items-center gap-1 text-slate-300">
                          {logoUploading
                            ? <Loader2 size={24} className="animate-spin" />
                            : <><Image size={24} /><span className="text-[8px] font-black uppercase tracking-widest">Clique</span></>
                          }
                        </div>
                      )}
                    </div>

                    {/* ações */}
                    <div className="flex-1 space-y-3">
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.18em] px-1 mb-2">
                          Arquivo de Imagem
                        </p>
                        <button
                          onClick={() => logoInputRef.current?.click()}
                          disabled={logoUploading}
                          className="h-11 px-5 bg-slate-900 text-white rounded-xl text-[9px] font-black uppercase tracking-[0.2em] hover:bg-slate-800 transition-all flex items-center gap-2 disabled:opacity-50"
                        >
                          {logoUploading
                            ? <><Loader2 size={13} className="animate-spin" /> Enviando...</>
                            : <><Upload size={13} strokeWidth={2.5} /> Selecionar arquivo</>
                          }
                        </button>
                        <p className="text-[9px] text-slate-400 font-medium px-1 mt-1.5">
                          PNG transparente recomendado · máx. 2 MB
                        </p>
                      </div>
                      {tenant?.logo_url && (
                        <button
                          onClick={() => setT({ logo_url: "" })}
                          className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-rose-400 hover:text-rose-600 transition-colors"
                        >
                          <X size={11} /> Remover logo
                        </button>
                      )}
                    </div>

                    {/* input oculto */}
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleLogoUpload(file);
                        e.target.value = "";
                      }}
                    />
                  </div>
                </div>

                {/* Dados básicos */}
                <div className="space-y-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-700 border-l-4 border-blue-500 pl-3">
                    Dados da Empresa
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <Field label="Nome da Organização">
                      <TextInput value={tenant?.name ?? ""} onChange={(v) => setT({ name: v })} />
                    </Field>
                    <Field label="CPF / CNPJ" hint="Será exibido nas notas fiscais">
                      <TextInput
                        value={tenant?.document ?? ""}
                        onChange={(v) => setT({ document: maskDocument(v) })}
                        placeholder="00.000.000/0001-00"
                        mono
                      />
                    </Field>
                    <Field label="WhatsApp de Vendas" hint="Formato: 5511999999999">
                      <TextInput
                        value={tenant?.whatsapp ?? ""}
                        onChange={(v) => setT({ whatsapp: v })}
                        placeholder="5511999999999"
                        mono
                      />
                    </Field>
                    <Field label="Identificador Público (Slug)">
                      <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden focus-within:ring-4 focus-within:ring-blue-500/8 focus-within:border-blue-500 transition-all bg-slate-50">
                        <span className="bg-slate-100 border-r border-slate-200 px-3 h-11 flex items-center text-[10px] font-mono text-slate-400 shrink-0">/s/</span>
                        <input
                          type="text"
                          className="flex-1 bg-transparent px-4 h-11 text-xs font-bold uppercase outline-none font-mono"
                          value={tenant?.slug ?? ""}
                          onChange={(e) => setT({ slug: e.target.value })}
                        />
                      </div>
                    </Field>
                  </div>
                </div>

                {/* Endereço estruturado */}
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-700 border-l-4 border-blue-500 pl-3">
                      Endereço / Sede
                    </p>
                    <div className="flex items-center gap-3 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Exibir no Site</span>
                      <Toggle
                        checked={tenant?.show_address ?? true}
                        onChange={(v) => setT({ show_address: v })}
                      />
                    </div>
                  </div>

                  {/* CEP lookup */}
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Field label="CEP" hint="Digite o CEP para preencher o endereço automaticamente">
                        <TextInput
                          value={tenant?.address_zip ?? ""}
                          onChange={(v) => setT({ address_zip: v })}
                          placeholder="00000-000"
                          mono
                        />
                      </Field>
                    </div>
                    <div className="flex items-end pb-0.5">
                      <button
                        onClick={handleLookupCEP}
                        disabled={cepLoading}
                        className="h-11 px-5 bg-slate-900 text-white rounded-xl text-[9px] font-black uppercase tracking-[0.2em] hover:bg-slate-800 transition-all flex items-center gap-2 disabled:opacity-50 shrink-0"
                      >
                        {cepLoading ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} strokeWidth={3} />}
                        Buscar CEP
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <div className="md:col-span-2">
                      <Field label="Logradouro (Rua / Av.)">
                        <TextInput
                          value={tenant?.address_street ?? ""}
                          onChange={(v) => setT({ address_street: v })}
                          placeholder="Rua das Flores"
                        />
                      </Field>
                    </div>
                    <Field label="Número">
                      <TextInput
                        value={tenant?.address_number ?? ""}
                        onChange={(v) => setT({ address_number: v })}
                        placeholder="123"
                      />
                    </Field>
                    <Field label="Complemento">
                      <TextInput
                        value={tenant?.address_complement ?? ""}
                        onChange={(v) => setT({ address_complement: v })}
                        placeholder="Sala 4, Bloco B..."
                      />
                    </Field>
                    <Field label="Bairro">
                      <TextInput
                        value={tenant?.address_district ?? ""}
                        onChange={(v) => setT({ address_district: v })}
                        placeholder="Centro"
                      />
                    </Field>
                    <Field label="Cidade">
                      <TextInput
                        value={tenant?.address_city ?? ""}
                        onChange={(v) => setT({ address_city: v })}
                        placeholder="São Paulo"
                      />
                    </Field>
                    <Field label="Estado (UF)">
                      <select
                        value={tenant?.address_state ?? ""}
                        onChange={(e) => setT({ address_state: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 h-11 text-xs font-bold outline-none focus:ring-4 focus:ring-blue-500/8 focus:border-blue-500 transition-all appearance-none"
                      >
                        <option value="">UF</option>
                        {["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"].map((uf) => (
                          <option key={uf} value={uf}>{uf}</option>
                        ))}
                      </select>
                    </Field>
                  </div>
                </div>

                {/* About */}
                <div>
                  <Field label="Manifesto da Marca (About)" hint="Texto exibido na página Sobre da loja pública">
                    <textarea
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-xs font-medium outline-none h-36 resize-none focus:ring-4 focus:ring-blue-500/8 focus:border-blue-500 transition-all"
                      value={tenant?.about_text ?? ""}
                      onChange={(e) => setT({ about_text: e.target.value })}
                      placeholder="Descreva a essência do seu negócio..."
                    />
                  </Field>
                </div>

                <SaveButton onClick={handleSaveTenant} />
              </div>
            )}

            {/* ── Design e modelos ───────────────────────────────────── */}
            {active === "design" && (
              <div className="space-y-8">
                <SectionHeader
                  title="Design e Modelos"
                  subtitle="Escolha um visual pronto e personalize a aparência da sua loja pública"
                />

                {/* templates */}
                <div className="space-y-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-700 border-l-4 border-blue-500 pl-3">
                    Aplicar Modelo Pronto
                  </p>
                  <p className="text-xs text-slate-500">
                    Selecione um modelo visual para definir o estilo da vitrine, das cores e da sensação da sua loja.
                  </p>
                  <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2 sm:grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 sm:overflow-visible sm:pb-0">
                    {([
                      {
                        id: "minimal", name: "Minimalista", tag: "Clean & Moderno",
                        desc: "Visual limpo para destacar seus produtos e imagens.",
                        color: "#2563eb", bg: "#f8fafc", cardBg: "#fff", textColor: "#1e293b",
                        badge: { bg: "#eff6ff", text: "#2563eb" },
                      },
                      {
                        id: "cyber", name: "Neon Escuro", tag: "Bold & Contrastante",
                        desc: "Estilo marcante com alto contraste, ideal para tecnologia e games.",
                        color: "#00ff7f", bg: "#000", cardBg: "#0d1117", textColor: "#e2e8f0",
                        badge: { bg: "#00ff7f22", text: "#00ff7f" },
                      },
                      {
                        id: "organic", name: "Orgânico", tag: "Natural & Artesanal",
                        desc: "Cores suaves e acolhedoras para marcas naturais, leves e artesanais.",
                        color: "#d97706", bg: "#fefaf6", cardBg: "#fff8f0", textColor: "#78350f",
                        badge: { bg: "#fef3c7", text: "#b45309" },
                      },
                      {
                        id: "luxury", name: "Luxo Dourado", tag: "Premium & Exclusivo",
                        desc: "Aparência sofisticada para catálogos premium e produtos exclusivos.",
                        color: "#c5a059", bg: "#0a0a0a", cardBg: "#111", textColor: "#e5c98a",
                        badge: { bg: "#c5a05922", text: "#c5a059" },
                      },
                      {
                        id: "tech", name: "Tecnologia Pro", tag: "Profissional & Leve",
                        desc: "Layout moderno e profissional para eletrônicos, inovação e desempenho.",
                        color: "#0ea5e9", bg: "#f4f6fb", cardBg: "#fff", textColor: "#0f172a",
                        badge: { bg: "#e0f2fe", text: "#0284c7" },
                      },
                      {
                        id: "nexus_tech", name: "Nexus Tech", tag: "Vibrante & Premium",
                        desc: "Tema claro e sofisticado com tipografia forte para qualquer nicho.",
                        color: "#2563eb", bg: "#eef4ff", cardBg: "#fff", textColor: "#071426",
                        badge: { bg: "#dbeafe", text: "#1d4ed8" },
                      },
                      {
                        id: "atelier", name: "Ateliê Chic", tag: "Editorial & Elegante",
                        desc: "Editorial claro e elegante para lojas de roupas, moda e acessórios.",
                        color: "#a26157", bg: "#fff6ef", cardBg: "#fff", textColor: "#44201a",
                        badge: { bg: "#fde8e0", text: "#9f4132" },
                      },
                    ] as const).map((t) => {
                      const isActive = tenant?.template_id === t.id;
                      return (
                        <button
                          key={t.id}
                          onClick={() => setT({ template_id: t.id })}
                          className={cn(
                            "min-w-[200px] sm:min-w-0 rounded-2xl border-2 text-left transition-all relative overflow-hidden group shrink-0 flex flex-col",
                            isActive
                              ? "border-blue-600 shadow-lg shadow-blue-500/10 ring-2 ring-blue-200"
                              : "border-slate-100 hover:border-slate-300 hover:shadow-lg bg-white",
                          )}
                        >
                          {/* Mini storefront preview */}
                          <div className="relative w-full h-28 overflow-hidden rounded-t-[14px] flex flex-col" style={{ backgroundColor: t.bg }}>
                            {/* Fake nav bar */}
                            <div className="flex items-center justify-between px-3 py-2" style={{ backgroundColor: t.bg }}>
                              <div className="w-8 h-1.5 rounded-full opacity-60" style={{ backgroundColor: t.color }} />
                              <div className="flex gap-1">
                                <div className="w-4 h-1 rounded-full opacity-30" style={{ backgroundColor: t.textColor }} />
                                <div className="w-4 h-1 rounded-full opacity-30" style={{ backgroundColor: t.textColor }} />
                                <div className="w-4 h-1 rounded-full opacity-30" style={{ backgroundColor: t.textColor }} />
                              </div>
                            </div>
                            {/* Fake hero */}
                            <div className="flex-1 flex items-center px-3 gap-2">
                              <div className="flex flex-col gap-1 flex-1">
                                <div className="h-1.5 w-14 rounded-full" style={{ backgroundColor: t.color, opacity: 0.9 }} />
                                <div className="h-2.5 w-20 rounded-sm" style={{ backgroundColor: t.textColor, opacity: 0.85 }} />
                                <div className="h-1 w-16 rounded-full mt-0.5" style={{ backgroundColor: t.textColor, opacity: 0.25 }} />
                                <div className="h-1 w-12 rounded-full" style={{ backgroundColor: t.textColor, opacity: 0.18 }} />
                                <div className="mt-1.5 h-4 w-14 rounded-lg flex items-center justify-center" style={{ backgroundColor: t.color }}>
                                  <div className="w-8 h-0.5 rounded-full bg-white/80" />
                                </div>
                              </div>
                              {/* Fake product card */}
                              <div className="w-14 h-16 rounded-xl overflow-hidden border shrink-0 flex flex-col" style={{ backgroundColor: t.cardBg, borderColor: t.color + "30" }}>
                                <div className="flex-1" style={{ backgroundColor: t.color + "18" }} />
                                <div className="px-1.5 py-1 space-y-0.5">
                                  <div className="h-1 rounded-full w-full" style={{ backgroundColor: t.textColor, opacity: 0.35 }} />
                                  <div className="h-1.5 rounded-full w-8" style={{ backgroundColor: t.color, opacity: 0.8 }} />
                                </div>
                              </div>
                            </div>
                            {/* Active glow */}
                            {isActive && (
                              <div className="absolute inset-0 ring-2 ring-inset ring-blue-400/40 rounded-t-[14px] pointer-events-none" />
                            )}
                          </div>

                          {/* Card footer */}
                          <div className="p-3 flex flex-col gap-1 bg-white flex-1">
                            <div className="flex items-center justify-between">
                              <p className="text-[11px] font-black uppercase tracking-wider text-slate-800 group-hover:text-blue-600 transition-colors leading-none">{t.name}</p>
                              {isActive && <Check size={12} strokeWidth={3} className="text-blue-600 shrink-0" />}
                            </div>
                            <span
                              className="inline-block self-start text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full"
                              style={{ backgroundColor: t.badge.bg, color: t.badge.text }}
                            >
                              {t.tag}
                            </span>
                            <p className="text-[10px] text-slate-400 leading-relaxed mt-0.5">{t.desc}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* color + urls */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Field label="Cor Principal da Marca">
                    <div className="flex gap-3">
                      <input
                        type="color"
                        className="w-11 h-11 rounded-xl cursor-pointer border-2 border-slate-100 shadow-sm shrink-0"
                        value={tenant?.primary_color ?? "#000000"}
                        onChange={(e) => setT({ primary_color: e.target.value })}
                      />
                      <TextInput
                        value={tenant?.primary_color ?? ""}
                        onChange={(v) => setT({ primary_color: v })}
                        mono
                      />
                    </div>
                  </Field>
                  <Field label="URL do Logo (PNG/SVG)">
                    <TextInput
                      value={tenant?.logo_url ?? ""}
                      onChange={(v) => setT({ logo_url: v })}
                      placeholder="https://..."
                    />
                  </Field>
                  <div className="md:col-span-2">
                    <Field label="Banner Principal (URL da Imagem)">
                      <TextInput
                        value={tenant?.banner_url ?? ""}
                        onChange={(v) => setT({ banner_url: v })}
                        placeholder="URL de imagem para o topo da vitrine"
                      />
                    </Field>
                  </div>
                  <div className="md:col-span-2">
                    <Field label="Texto do Rodapé">
                      <TextInput
                        value={tenant?.footer_text ?? ""}
                        onChange={(v) => setT({ footer_text: v })}
                        placeholder="© 2026 Minha Loja. Todos os direitos reservados."
                      />
                    </Field>
                  </div>
                </div>

                {/* vitrine sliders */}
                <div className="space-y-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-700 border-l-4 border-blue-500 pl-3">
                    Vitrine — Limites de Exibição
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[
                      { key: "featured_limit" as const, label: "Seção Destaques", min: 1, max: 12, desc: "Produtos marcados como destaque" },
                      { key: "bestseller_limit" as const, label: "Mais Vendidos", min: 2, max: 20, desc: "Gerado automaticamente por popularidade" },
                    ].map(({ key, label, min, max, desc }) => (
                      <div key={key} className="bg-slate-50 border border-slate-100 rounded-2xl p-5 space-y-3">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-700">{label}</p>
                          <p className="text-[9px] text-slate-400 mt-0.5 font-medium">{desc}</p>
                        </div>
                        <div className="flex items-center gap-4">
                          <input
                            type="range"
                            min={min} max={max}
                            value={(tenant?.[key] as number) ?? (key === "featured_limit" ? 4 : 8)}
                            onChange={(e) => setT({ [key]: Number(e.target.value) })}
                            className="flex-1 accent-blue-600"
                          />
                          <span className="text-xl font-black text-slate-900 w-8 text-center tabular-nums">
                            {(tenant?.[key] as number) ?? (key === "featured_limit" ? 4 : 8)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <SaveButton onClick={handleSaveTenant} label="Aplicar Design" />
              </div>
            )}

            {/* ── Canais Sociais ──────────────────────────────────────── */}
            {active === "social" && (
              <div className="space-y-6">
                <SectionHeader
                  title="Canais Sociais"
                  subtitle="Redes sociais exibidas na loja pública"
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <Field label="Instagram (@usuario)">
                    <TextInput
                      value={tenant?.instagram_url ?? ""}
                      onChange={(v) => setT({ instagram_url: v })}
                      placeholder="@minhaloja"
                    />
                  </Field>
                  <Field label="Facebook (link ou @usuario)">
                    <TextInput
                      value={tenant?.facebook_url ?? ""}
                      onChange={(v) => setT({ facebook_url: v })}
                      placeholder="facebook.com/minhaloja"
                    />
                  </Field>
                </div>

                <div className="p-5 bg-blue-50 border border-blue-100 rounded-2xl space-y-2">
                  <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest">
                    Integração WhatsApp
                  </p>
                  <p className="text-[10px] text-blue-800 leading-relaxed font-medium">
                    Pedidos realizados na loja pública disparam notificação automática para o número configurado em{" "}
                    <button
                      onClick={() => setActive("identity")}
                      className="underline font-black hover:no-underline"
                    >
                      Identidade &amp; Dados
                    </button>
                    . Use o formato internacional: <span className="font-mono font-bold">55 + DDD + Número</span>.
                  </p>
                </div>
                <SaveButton onClick={handleSaveTenant} label="Vincular Canais" />
              </div>
            )}

            {/* ── Horário de Funcionamento ────────────────────────────── */}
            {active === "hours" && (
              <div className="space-y-6">
                <SectionHeader
                  title="Horário de Funcionamento"
                  subtitle="Exibido na página da loja para os clientes"
                />
                <div className="space-y-2">
                  {DAYS.map(({ key, label }) => {
                    const day = hours[key] ?? { open: "09:00", close: "18:00", closed: false };
                    return (
                      <div
                        key={key}
                        className={cn(
                          "flex flex-col sm:flex-row items-start sm:items-center gap-3 p-4 rounded-xl border transition-all",
                          day.closed ? "bg-slate-50 border-slate-100" : "bg-white border-slate-100",
                        )}
                      >
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-700 w-20 shrink-0">
                          {label}
                        </span>
                        {day.closed ? (
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex-1">
                            Fechado
                          </span>
                        ) : (
                          <div className="flex items-center gap-2 flex-1">
                            <input
                              type="time"
                              value={day.open}
                              onChange={(e) => setHours(key, { open: e.target.value })}
                              className="bg-slate-50 border border-slate-200 rounded-lg px-3 h-9 text-xs font-mono font-bold outline-none focus:border-blue-500 transition-all"
                            />
                            <span className="text-[10px] text-slate-300 font-bold">até</span>
                            <input
                              type="time"
                              value={day.close}
                              onChange={(e) => setHours(key, { close: e.target.value })}
                              className="bg-slate-50 border border-slate-200 rounded-lg px-3 h-9 text-xs font-mono font-bold outline-none focus:border-blue-500 transition-all"
                            />
                          </div>
                        )}
                        <Toggle
                          checked={!day.closed}
                          onChange={(v) => setHours(key, { closed: !v })}
                          label={day.closed ? "Abrir" : "Aberto"}
                        />
                      </div>
                    );
                  })}
                </div>
                <SaveButton onClick={handleSaveTenant} label="Salvar Horários" />
              </div>
            )}

            {/* ── Pagamentos & Políticas ──────────────────────────────── */}
            {active === "payments" && (
              <div className="space-y-8">
                <SectionHeader
                  title="Pagamentos & Políticas"
                  subtitle="Métodos aceitos e textos de política exibidos no checkout"
                />

                {/* payment methods */}
                <div className="space-y-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-700 border-l-4 border-blue-500 pl-3">
                    Métodos de Pagamento Aceitos
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                    {(
                      [
                        { key: "pix", label: "PIX", emoji: "⚡" },
                        { key: "credit_card", label: "Crédito", emoji: "💳" },
                        { key: "debit_card", label: "Débito", emoji: "🏧" },
                        { key: "cash", label: "Dinheiro", emoji: "💵" },
                        { key: "boleto", label: "Boleto", emoji: "📄" },
                      ] as { key: keyof PaymentMethods; label: string; emoji: string }[]
                    ).map(({ key, label, emoji }) => (
                      <button
                        key={key}
                        onClick={() => setPayment(key, !payments[key])}
                        className={cn(
                          "flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border-2 transition-all",
                          payments[key]
                            ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                            : "border-slate-100 bg-white text-slate-400 hover:border-slate-200",
                        )}
                      >
                        <span className="text-xl">{emoji}</span>
                        <span className="text-[9px] font-black uppercase tracking-widest">{label}</span>
                        {payments[key] && <Check size={12} strokeWidth={3} className="text-emerald-600" />}
                      </button>
                    ))}
                  </div>
                </div>

                {/* policies */}
                <div className="space-y-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-700 border-l-4 border-blue-500 pl-3">
                    Políticas da Loja
                  </p>
                  {(
                    [
                      { policyKey: "returns" as const, label: "Política de Devolução", placeholder: "Ex: Devoluções aceitas em até 7 dias após a entrega..." },
                      { policyKey: "exchange" as const, label: "Política de Troca", placeholder: "Ex: Trocas em até 30 dias mediante apresentação da nota..." },
                      { policyKey: "shipping" as const, label: "Política de Frete", placeholder: "Ex: Frete grátis para compras acima de R$ 150..." },
                    ] as { policyKey: "returns" | "exchange" | "shipping"; label: string; placeholder: string }[]
                  ).map(({ policyKey, label, placeholder }) => (
                    <div key={policyKey}>
                      <Field label={label}>
                        <textarea
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-medium outline-none h-24 resize-none focus:ring-4 focus:ring-blue-500/8 focus:border-blue-500 transition-all"
                          value={policies[policyKey]}
                          onChange={(e) => setPolicies({ [policyKey]: e.target.value })}
                          placeholder={placeholder}
                        />
                      </Field>
                    </div>
                  ))}
                </div>

                <SaveButton onClick={handleSaveTenant} label="Salvar Políticas" />
              </div>
            )}

            {/* ── Maquininha & Taxas ──────────────────────────────────── */}
            {active === "card_fees" && (() => {
              const BRANDS = [
                { key: "visa",   label: "Visa",             color: "#1A1F71" },
                { key: "master", label: "Mastercard",       color: "#EB001B" },
                { key: "elo",    label: "Elo",              color: "#00A4E0" },
                { key: "amex",   label: "American Express", color: "#2E77BC" },
                { key: "hiper",  label: "Hipercard",        color: "#B22222" },
                { key: "other",  label: "Outras Bandeiras", color: "#64748b" },
              ] as { key: string; label: string; color: string }[];

              const activeBrands = BRANDS.filter((b) => enabledBrands[b.key] !== false);

              const toggleBrand = (key: string) =>
                setEnabledBrands((prev) => ({ ...prev, [key]: !prev[key] }));

              const togglePassFee = (method: string) =>
                setPassFeeByMethod((prev) => ({ ...prev, [method]: !prev[method] }));

              // toggle component reutilizável
              const Toggle = ({ on, onChange }: { on: boolean; onChange: () => void }) => (
                <button onClick={onChange}
                  className={`relative shrink-0 flex items-center rounded-full transition-all duration-200 border ${on ? "bg-blue-600 border-blue-600" : "bg-white border-slate-300"}`}
                  style={{ width: 72, height: 32 }}>
                  {/* label Não */}
                  <span className={`absolute right-2 text-[9px] font-black uppercase tracking-wider transition-opacity duration-150 ${on ? "opacity-0" : "opacity-100 text-slate-400"}`}>Não</span>
                  {/* label Sim */}
                  <span className={`absolute left-2 text-[9px] font-black uppercase tracking-wider transition-opacity duration-150 ${on ? "opacity-100 text-white" : "opacity-0"}`}>Sim</span>
                  {/* knob */}
                  <span
                    className="absolute bg-white rounded-full shadow-md transition-transform duration-200"
                    style={{
                      width: 24, height: 24,
                      top: 3,
                      left: 4,
                      transform: on ? "translateX(40px)" : "translateX(0px)",
                      boxShadow: "0 1px 4px rgba(0,0,0,0.18)",
                    }}
                  />
                </button>
              );

              return (
                <div className="space-y-6">
                  <SectionHeader
                    title="Maquininha & Taxas"
                    subtitle="Configure as taxas, bandeiras e regras de repasse por modalidade de pagamento."
                  />

                  {/* ── Bandeiras ativas ── */}
                  <div className="border border-slate-100 rounded-2xl overflow-hidden">
                    <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">Bandeiras Ativas</span>
                      <span className="text-[9px] text-slate-400 font-medium">{activeBrands.length} de {BRANDS.length} ativas</span>
                    </div>
                    <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {BRANDS.map(({ key, label, color }) => {
                        const on = enabledBrands[key] !== false;
                        return (
                          <button key={key} onClick={() => toggleBrand(key)}
                            className={cn(
                              "flex items-center gap-3 px-4 py-3 rounded-xl border transition-all",
                              on ? "border-transparent shadow-sm" : "bg-slate-50 border-slate-200 opacity-50"
                            )}
                            style={on ? { backgroundColor: color + "15", borderColor: color + "40" } : {}}>
                            <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: on ? color : "#cbd5e1" }} />
                            <span className="text-[11px] font-black uppercase tracking-widest flex-1 text-left"
                              style={{ color: on ? color : "#94a3b8" }}>{label}</span>
                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${on ? "bg-white border-white" : "bg-transparent border-slate-300"}`}
                              style={on ? { boxShadow: `0 0 0 3px ${color}40` } : {}}>
                              {on && <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Payment type tabs */}
                  <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl w-fit">
                    {([
                      { id: "credit", label: "Crédito", icon: CreditCard },
                      { id: "debit",  label: "Débito",  icon: Smartphone },
                      { id: "pix",    label: "PIX",     icon: Zap },
                    ] as { id: "credit"|"debit"|"pix"; label: string; icon: React.ElementType }[]).map(({ id, label, icon: Icon }) => (
                      <button key={id} onClick={() => setActivePayType(id)}
                        className={cn(
                          "flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all",
                          activePayType === id ? "bg-white shadow text-slate-900" : "text-slate-500 hover:text-slate-700"
                        )}>
                        <Icon size={13} />
                        {label}
                      </button>
                    ))}
                  </div>

                  {/* ── Crédito ── */}
                  {activePayType === "credit" && (
                    <div className="space-y-5">
                      {/* Repassar taxa — crédito */}
                      <div className="flex items-center justify-between gap-4 p-4 bg-amber-50 border border-amber-100 rounded-xl">
                        <div className="flex items-start gap-3">
                          <CreditCard size={16} className="text-amber-600 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-[11px] font-black text-amber-800 uppercase tracking-wider">Repassar taxa ao cliente — Crédito</p>
                            <p className="text-[10px] text-amber-700 mt-0.5 leading-relaxed">
                              Ativo: taxa somada ao total cobrado. Ex: R$ 30 + 2,5% → R$ 30,75 para o cliente.
                            </p>
                          </div>
                        </div>
                        <Toggle on={!!passFeeByMethod["credit"]} onChange={() => togglePassFee("credit")} />
                      </div>

                      {/* Máximo de parcelas */}
                      <div className="flex items-center justify-between gap-4 p-4 bg-white border border-slate-200 rounded-xl">
                        <div>
                          <p className="text-[12px] font-bold text-slate-700">Máximo de parcelas</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">Quantas opções aparecem no PDV (1 a 12).</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button onClick={() => setMaxInstallments((v) => Math.max(1, v - 1))}
                            className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 font-black text-lg flex items-center justify-center transition-all">−</button>
                          <span className="w-10 text-center font-mono font-black text-[16px] text-slate-800">{maxInstallments}×</span>
                          <button onClick={() => setMaxInstallments((v) => Math.min(24, v + 1))}
                            className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 font-black text-lg flex items-center justify-center transition-all">+</button>
                        </div>
                      </div>

                      {/* Preview das parcelas ativas */}
                      <div className="flex flex-wrap gap-2 px-1">
                        {Array.from({ length: 24 }, (_, i) => i + 1).map((n) => (
                          <span key={n}
                            className={cn("px-3 py-1 rounded-lg text-[10px] font-black border transition-all",
                              n <= maxInstallments
                                ? "bg-blue-50 border-blue-200 text-blue-700"
                                : "bg-slate-50 border-slate-200 text-slate-300 line-through"
                            )}>
                            {n === 1 ? "À vista" : `${n}×`}
                          </span>
                        ))}
                      </div>

                      {/* Taxas por bandeira */}
                      {activeBrands.map(({ key, label, color }) => {
                        const fees = cardFees[key] ?? Array(maxInstallments).fill(0);
                        return (
                          <div key={key} className="border border-slate-100 rounded-2xl overflow-hidden">
                            <div className="flex items-center gap-3 px-5 py-3"
                              style={{ backgroundColor: color + "15", borderBottom: `2px solid ${color}30` }}>
                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                              <span className="text-[10px] font-black uppercase tracking-widest" style={{ color }}>{label}</span>
                            </div>
                            <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                              {Array.from({ length: maxInstallments }, (_, i) => i + 1).map((n) => {
                                const idx = n - 1;
                                return (
                                  <div key={n} className="space-y-1">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1 block">
                                      {n === 1 ? "À Vista" : `${n}× parcelas`}
                                    </label>
                                    <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-blue-500/10 focus-within:border-blue-500 bg-slate-50 transition-all">
                                      <input type="number" min="0" max="30" step="0.1"
                                        value={fees[idx] ?? 0}
                                        onChange={(e) => setFeeRate(key, idx, parseFloat(e.target.value) || 0)}
                                        className="flex-1 bg-transparent px-2 h-9 text-xs font-mono font-bold outline-none w-0 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                                      />
                                      <span className="bg-slate-100 border-l border-slate-200 px-2 h-9 flex items-center text-[10px] font-black text-slate-400 shrink-0">%</span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* ── Débito ── */}
                  {activePayType === "debit" && (
                    <div className="space-y-5">
                      {/* Repassar taxa — débito */}
                      <div className="flex items-center justify-between gap-4 p-4 bg-blue-50 border border-blue-100 rounded-xl">
                        <div className="flex items-start gap-3">
                          <Smartphone size={16} className="text-blue-600 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-[11px] font-black text-blue-800 uppercase tracking-wider">Repassar taxa ao cliente — Débito</p>
                            <p className="text-[10px] text-blue-700 mt-0.5 leading-relaxed">
                              Ativo: taxa somada ao total cobrado no débito.
                            </p>
                          </div>
                        </div>
                        <Toggle on={!!passFeeByMethod["debit"]} onChange={() => togglePassFee("debit")} />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {activeBrands.map(({ key, label, color }) => {
                          const rate = (cardFees[`debit_${key}`] ?? [0])[0];
                          return (
                            <div key={key} className="border border-slate-100 rounded-2xl overflow-hidden">
                              <div className="flex items-center gap-3 px-5 py-3"
                                style={{ backgroundColor: color + "15", borderBottom: `2px solid ${color}30` }}>
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                                <span className="text-[10px] font-black uppercase tracking-widest" style={{ color }}>{label}</span>
                              </div>
                              <div className="p-4">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1 block mb-1">Taxa Débito</label>
                                <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-blue-500/10 focus-within:border-blue-500 bg-slate-50 transition-all">
                                  <input type="number" min="0" max="30" step="0.1"
                                    value={rate}
                                    onChange={(e) => setDebitRate(key, parseFloat(e.target.value) || 0)}
                                    className="flex-1 bg-transparent px-2 h-9 text-xs font-mono font-bold outline-none w-0 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                                  />
                                  <span className="bg-slate-100 border-l border-slate-200 px-2 h-9 flex items-center text-[10px] font-black text-slate-400 shrink-0">%</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* ── PIX ── */}
                  {activePayType === "pix" && (
                    <div className="space-y-5">
                      {/* Repassar taxa — PIX */}
                      <div className="flex items-center justify-between gap-4 p-4 bg-emerald-50 border border-emerald-100 rounded-xl">
                        <div className="flex items-start gap-3">
                          <Zap size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-[11px] font-black text-emerald-800 uppercase tracking-wider">Repassar taxa ao cliente — PIX</p>
                            <p className="text-[10px] text-emerald-700 mt-0.5 leading-relaxed">
                              Ativo: taxa PIX somada ao total cobrado. Muitas maquininhas cobram 0% no PIX.
                            </p>
                          </div>
                        </div>
                        <Toggle on={!!passFeeByMethod["pix"]} onChange={() => togglePassFee("pix")} />
                      </div>

                      <div className="border border-slate-100 rounded-2xl overflow-hidden max-w-xs">
                        <div className="flex items-center gap-3 px-5 py-3 bg-emerald-50 border-b-2 border-emerald-100">
                          <Zap size={14} className="text-emerald-600" />
                          <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Taxa PIX</span>
                        </div>
                        <div className="p-4">
                          <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-emerald-500/10 focus-within:border-emerald-500 bg-slate-50 transition-all">
                            <input type="number" min="0" max="30" step="0.01"
                              value={(cardFees["pix"] ?? [0])[0]}
                              onChange={(e) => setPixRate(parseFloat(e.target.value) || 0)}
                              className="flex-1 bg-transparent px-2 h-9 text-xs font-mono font-bold outline-none w-0 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                            />
                            <span className="bg-slate-100 border-l border-slate-200 px-2 h-9 flex items-center text-[10px] font-black text-slate-400 shrink-0">%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <SaveButton onClick={handleSaveCardFees} label="Salvar Taxas" />
                </div>
              );
            })()}

            {/* ── Termos de Garantia ──────────────────────────────────── */}
            {active === "warranty" && (() => {
              const wp = policies as StorePolicies;
              const clauses: string[] = wp.warranty_clauses ?? DEFAULT_POLICIES.warranty_clauses!;

              const setWarranty = (patch: Partial<StorePolicies>) =>
                setPolicies(patch);

              const updateClause = (idx: number, val: string) => {
                const next = [...clauses];
                next[idx] = val;
                setWarranty({ warranty_clauses: next });
              };

              const addClause = () =>
                setWarranty({ warranty_clauses: [...clauses, ""] });

              const removeClause = (idx: number) =>
                setWarranty({ warranty_clauses: clauses.filter((_, i) => i !== idx) });

              return (
                <div className="space-y-8">
                  <SectionHeader
                    title="Termos de Garantia"
                    subtitle="Configure o texto do termo de garantia impresso nos pedidos"
                  />

                  {/* Prazos */}
                  <div className="space-y-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-700 border-l-4 border-blue-500 pl-3">
                      Prazos
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 space-y-3">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-700">Prazo de Garantia</p>
                          <p className="text-[9px] text-slate-400 mt-0.5 font-medium">Em dias a partir da emissão</p>
                        </div>
                        <div className="flex items-center gap-4">
                          <input
                            type="range"
                            min={7} max={365}
                            value={wp.warranty_days ?? 90}
                            onChange={(e) => setWarranty({ warranty_days: Number(e.target.value) })}
                            className="flex-1 accent-blue-600"
                          />
                          <div className="flex items-center gap-1.5">
                            <span className="text-xl font-black text-slate-900 tabular-nums w-10 text-right">
                              {wp.warranty_days ?? 90}
                            </span>
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">dias</span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 space-y-3">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-700">Prazo de Atendimento</p>
                          <p className="text-[9px] text-slate-400 mt-0.5 font-medium">Dias corridos para resolução</p>
                        </div>
                        <div className="flex items-center gap-4">
                          <input
                            type="range"
                            min={1} max={90}
                            value={wp.warranty_resolution_days ?? 30}
                            onChange={(e) => setWarranty({ warranty_resolution_days: Number(e.target.value) })}
                            className="flex-1 accent-blue-600"
                          />
                          <div className="flex items-center gap-1.5">
                            <span className="text-xl font-black text-slate-900 tabular-nums w-10 text-right">
                              {wp.warranty_resolution_days ?? 30}
                            </span>
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">dias</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Título */}
                  <div className="space-y-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-700 border-l-4 border-blue-500 pl-3">
                      Título do Termo
                    </p>
                    <TextInput
                      value={wp.warranty_title ?? "Termos e Condições de Garantia"}
                      onChange={(v) => setWarranty({ warranty_title: v })}
                      placeholder="Termos e Condições de Garantia"
                    />
                  </div>

                  {/* Cláusulas */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-700 border-l-4 border-blue-500 pl-3">
                        Cláusulas
                      </p>
                      <button
                        onClick={addClause}
                        className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-blue-600 hover:text-blue-800 transition-colors px-3 h-8 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100"
                      >
                        + Adicionar Cláusula
                      </button>
                    </div>
                    <p className="text-[9px] text-slate-400 font-medium">
                      Use <strong className="text-slate-600">{"{{warranty_days}}"}</strong> e <strong className="text-slate-600">{"{{resolution_days}}"}</strong> para inserir os prazos automaticamente no texto.
                    </p>
                    <div className="space-y-3">
                      {clauses.map((clause, idx) => (
                        <div key={idx} className="flex gap-3 items-start">
                          <div className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center text-[9px] font-black shrink-0 mt-3">
                            {idx + 1}
                          </div>
                          <textarea
                            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-medium outline-none h-20 resize-none focus:ring-4 focus:ring-blue-500/8 focus:border-blue-500 transition-all"
                            value={clause}
                            onChange={(e) => updateClause(idx, e.target.value)}
                            placeholder={`Cláusula ${idx + 1}...`}
                          />
                          <button
                            onClick={() => removeClause(idx)}
                            className="w-6 h-6 rounded-full bg-rose-50 text-rose-400 flex items-center justify-center hover:bg-rose-100 hover:text-rose-600 transition-colors shrink-0 mt-3"
                          >
                            <X size={11} strokeWidth={3} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Preview */}
                  <div className="space-y-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-700 border-l-4 border-emerald-500 pl-3">
                      Pré-visualização
                    </p>
                    <div className="border-2 border-slate-200 rounded-2xl p-5 bg-slate-50 font-mono text-[11px] leading-relaxed text-slate-700 space-y-2">
                      <strong className="text-sm font-sans font-black text-slate-900 uppercase tracking-wide block mb-3">
                        {wp.warranty_title ?? "Termos e Condições de Garantia"}
                      </strong>
                      {clauses.map((c, i) => (
                        <div key={i} className="flex gap-2">
                          <span className="text-emerald-600 font-black shrink-0">✓</span>
                          <span>
                            {c
                              .replace(/\{\{warranty_days\}\}/g, String(wp.warranty_days ?? 90))
                              .replace(/\{\{resolution_days\}\}/g, String(wp.warranty_resolution_days ?? 30))
                            }
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <SaveButton onClick={handleSaveTenant} label="Salvar Termos" />
                </div>
              );
            })()}

            {/* ── Checklists de Ordem de Serviço ────────────────────────── */}
            {active === "service_checklists" && (() => {
              const sp = policies as StorePolicies;
              const checklists = sp.service_order_checklists ?? {};
              const categories = Object.keys(checklists);

              const setChecklists = (next: Record<string, { label: string }[]>) =>
                setPolicies({ service_order_checklists: next });

              const addCategory = () => {
                const name = window.prompt("Nome da categoria (ex: Notebook, Som, Celular):");
                if (!name || checklists[name]) return;
                setChecklists({ ...checklists, [name]: [] });
              };

              const removeCategory = (cat: string) => {
                if (!window.confirm(`Remover a categoria "${cat}" e seu checklist?`)) return;
                const next = { ...checklists };
                delete next[cat];
                setChecklists(next);
              };

              const addItem = (cat: string) =>
                setChecklists({ ...checklists, [cat]: [...(checklists[cat] ?? []), { label: "" }] });

              const updateItem = (cat: string, idx: number, label: string) => {
                const items = [...(checklists[cat] ?? [])];
                items[idx] = { label };
                setChecklists({ ...checklists, [cat]: items });
              };

              const removeItem = (cat: string, idx: number) => {
                const items = (checklists[cat] ?? []).filter((_, i) => i !== idx);
                setChecklists({ ...checklists, [cat]: items });
              };

              return (
                <div className="space-y-8">
                  <SectionHeader
                    title="Checklists de Ordem de Serviço"
                    subtitle="Configure o checklist de entrada usado em cada categoria de equipamento (notebooks, sons, celulares, etc.)"
                  />

                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-700 border-l-4 border-blue-500 pl-3">
                      Categorias
                    </p>
                    <button
                      onClick={addCategory}
                      className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-blue-600 hover:text-blue-800 transition-colors px-3 h-8 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100"
                    >
                      + Nova Categoria
                    </button>
                  </div>

                  {categories.length === 0 ? (
                    <p className="text-[11px] text-slate-400 font-medium">
                      Nenhuma categoria configurada ainda. Crie uma categoria (ex: "Notebook") para poder montar o checklist de entrada usado nas Ordens de Serviço.
                    </p>
                  ) : (
                    <div className="space-y-6">
                      {categories.map((cat) => (
                        <div key={cat} className="bg-slate-50 border border-slate-100 rounded-2xl p-5 space-y-3">
                          <div className="flex items-center justify-between">
                            <p className="text-[12px] font-black text-slate-800">{cat}</p>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => addItem(cat)}
                                className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[9px] font-black uppercase tracking-wider bg-blue-50 border border-blue-200 text-blue-600 hover:bg-blue-100 transition-all"
                              >
                                + Item
                              </button>
                              <button
                                onClick={() => removeCategory(cat)}
                                className="w-7 h-7 rounded-full bg-rose-50 text-rose-400 flex items-center justify-center hover:bg-rose-100 hover:text-rose-600 transition-colors"
                              >
                                <X size={11} strokeWidth={3} />
                              </button>
                            </div>
                          </div>
                          <div className="space-y-2">
                            {(checklists[cat] ?? []).length === 0 ? (
                              <p className="text-[10px] text-slate-400">Nenhum item — clique em "+ Item" para adicionar (ex: "Liga", "Tela sem trincos", "Carregador incluso").</p>
                            ) : (
                              (checklists[cat] ?? []).map((item, idx) => (
                                <div key={idx} className="flex gap-2 items-center">
                                  <div className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center text-[8px] font-black shrink-0">
                                    {idx + 1}
                                  </div>
                                  <TextInput
                                    value={item.label}
                                    onChange={(v) => updateItem(cat, idx, v)}
                                    placeholder={`Item ${idx + 1} do checklist...`}
                                    className="h-9"
                                  />
                                  <button
                                    onClick={() => removeItem(cat, idx)}
                                    className="w-6 h-6 rounded-full bg-rose-50 text-rose-400 flex items-center justify-center hover:bg-rose-100 hover:text-rose-600 transition-colors shrink-0"
                                  >
                                    <X size={10} strokeWidth={3} />
                                  </button>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <SaveButton onClick={handleSaveTenant} label="Salvar Checklists" />
                </div>
              );
            })()}

            {/* ── Maquininha (API) ────────────────────────────────────── */}
            {active === "terminal" && (
              <div className="space-y-8">
                <SectionHeader
                  title="Maquininha (API)"
                  subtitle="Conecte sua maquininha via API para registrar vendas automaticamente no sistema"
                />

                {/* Provider */}
                <div className="space-y-3">
                  <Field label="Provedor / Adquirente">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {TERMINAL_PROVIDERS.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => { setTerminalProvider(p.id); setTerminalPingStatus("idle"); }}
                          className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-[11px] font-bold transition-all ${
                            terminalProvider === p.id
                              ? "border-current bg-slate-50 shadow-sm"
                              : "border-slate-200 text-slate-400 hover:border-slate-300"
                          }`}
                          style={terminalProvider === p.id ? { color: p.color, borderColor: p.color } : {}}
                        >
                          <Terminal size={13} />
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </Field>
                </div>

                {/* Sandbox toggle */}
                <Field label="Ambiente" hint="Use Sandbox para testes; Produção para vendas reais">
                  <div className="flex gap-2">
                    {[
                      { val: true,  label: "Sandbox (testes)" },
                      { val: false, label: "Produção" },
                    ].map(({ val, label }) => (
                      <button
                        key={String(val)}
                        onClick={() => setTerminalSandbox(val)}
                        className={`flex-1 px-3 py-2 rounded-xl border text-[11px] font-bold transition-all ${
                          terminalSandbox === val
                            ? val
                              ? "bg-amber-50 border-amber-400 text-amber-700"
                              : "bg-emerald-50 border-emerald-400 text-emerald-700"
                            : "border-slate-200 text-slate-400 hover:border-slate-300"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </Field>

                {/* Credentials */}
                <div className="space-y-4">
                  <Field label="Client ID (PV)">
                    <input
                      type="text"
                      value={terminalClientId}
                      onChange={(e) => setTerminalClientId(e.target.value)}
                      placeholder="Ex: 48152954"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-slate-300"
                    />
                  </Field>
                  <Field label="Client Secret (Token)">
                    <input
                      type="password"
                      value={terminalClientSecret}
                      onChange={(e) => setTerminalClientSecret(e.target.value)}
                      placeholder="Cole o token gerado no portal do desenvolvedor"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-slate-300"
                    />
                  </Field>
                </div>

                {/* Ping / Test */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={handlePingTerminal}
                    disabled={terminalPingStatus === "loading" || !terminalClientId || !terminalClientSecret}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 text-[11px] font-black uppercase tracking-wide text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-all"
                  >
                    {terminalPingStatus === "loading" ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Zap size={13} />
                    )}
                    Testar Conexão
                  </button>
                  {terminalPingStatus === "ok" && (
                    <span className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-600">
                      <CheckCircle2 size={14} /> Conectado com sucesso
                    </span>
                  )}
                  {terminalPingStatus === "fail" && (
                    <span className="flex items-center gap-1.5 text-[11px] font-bold text-red-500">
                      <XCircle size={14} /> Falha na conexão — verifique as credenciais
                    </span>
                  )}
                </div>

                <SaveButton
                  onClick={handleSaveTerminal}
                  label={terminalSaving ? "Salvando..." : "Salvar Configuração"}
                />
              </div>
            )}

            {/* ── Preferências do Painel ──────────────────────────────── */}
            {active === "preferences" && (
              <div className="space-y-8">
                <SectionHeader
                  title="Preferências do Painel"
                  subtitle="Configurações pessoais do painel administrativo"
                />

                {/* theme */}
                <div className="space-y-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-700 border-l-4 border-blue-500 pl-3">
                    Tema do Painel
                  </p>
                  <div className="grid grid-cols-2 gap-3 max-w-xs">
                    {(["light", "dark"] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => setPanelTheme(t)}
                        className={cn(
                          "flex flex-col items-center gap-2 p-5 rounded-2xl border-2 transition-all",
                          panelTheme === t
                            ? "border-blue-600 bg-blue-50"
                            : "border-slate-100 hover:border-slate-200 bg-white",
                        )}
                      >
                        {t === "light" ? (
                          <Sun size={22} className={panelTheme === t ? "text-blue-600" : "text-slate-300"} />
                        ) : (
                          <Moon size={22} className={panelTheme === t ? "text-blue-600" : "text-slate-300"} />
                        )}
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-600">
                          {t === "light" ? "Claro" : "Escuro"}
                        </span>
                        {panelTheme === t && <Check size={12} strokeWidth={3} className="text-blue-600" />}
                      </button>
                    ))}
                  </div>
                  <p className="text-[9px] text-slate-400 font-medium px-1">
                    O tema escuro será aplicado no próximo login.
                  </p>
                </div>

                {/* low stock alert */}
                <div className="space-y-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-700 border-l-4 border-amber-500 pl-3">
                    Alerta de Estoque Baixo
                  </p>
                  <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 space-y-4 max-w-sm">
                    <div className="flex items-center gap-3">
                      <AlertTriangle size={16} className="text-amber-500 shrink-0" />
                      <p className="text-[10px] text-slate-600 font-medium leading-relaxed">
                        Exibir alerta no painel quando o estoque de um produto ficar abaixo de{" "}
                        <strong className="text-slate-900 font-black">{lowStockAlert}</strong> unidades.
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <Package size={14} className="text-slate-400 shrink-0" />
                      <input
                        type="range"
                        min={1} max={50}
                        value={lowStockAlert}
                        onChange={(e) => setLowStockAlert(Number(e.target.value))}
                        className="flex-1 accent-amber-500"
                      />
                      <span className="text-xl font-black text-slate-900 w-10 text-center tabular-nums">
                        {lowStockAlert}
                      </span>
                    </div>
                  </div>
                </div>

                {/* language */}
                <div className="space-y-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-700 border-l-4 border-blue-500 pl-3">
                    Idioma do Painel
                  </p>
                  <div className="flex gap-3 flex-wrap">
                    {[
                      { code: "pt-BR", label: "Português (BR)" },
                      { code: "en-US", label: "English (US)" },
                      { code: "es-ES", label: "Español" },
                    ].map(({ code, label }) => (
                      <button
                        key={code}
                        onClick={() => setPanelLang(code)}
                        className={cn(
                          "px-5 h-10 rounded-xl text-[10px] font-black uppercase tracking-widest border-2 transition-all",
                          panelLang === code
                            ? "border-blue-600 bg-blue-50 text-blue-700"
                            : "border-slate-100 text-slate-500 hover:border-slate-200 bg-white",
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <p className="text-[9px] text-slate-400 font-medium px-1">
                    Suporte multilíngue completo em breve.
                  </p>
                </div>

                {/* printer size */}
                <div className="space-y-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-700 border-l-4 border-violet-500 pl-3">
                    Impressora de Comprovantes
                  </p>
                  <p className="text-[9px] text-slate-400 font-medium px-1">
                    Selecione o modelo da sua impressora para que o comprovante seja gerado no tamanho correto.
                  </p>
                  <div className="grid grid-cols-3 gap-3 max-w-sm">
                    {([
                      { value: "58mm", label: "58mm", desc: "Térmica pequena", example: "KNUP, Bematech 55" },
                      { value: "80mm", label: "80mm", desc: "Térmica padrão", example: "Epson TM, Elgin" },
                      { value: "A4",   label: "A4",   desc: "Laser / Jato", example: "Impressora comum" },
                    ] as const).map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setPrinterSize(opt.value)}
                        className={cn(
                          "flex flex-col items-center gap-1.5 p-4 rounded-2xl border-2 transition-all text-center",
                          printerSize === opt.value
                            ? "border-violet-600 bg-violet-50"
                            : "border-slate-100 hover:border-slate-200 bg-white",
                        )}
                      >
                        {/* mini receipt icon */}
                        <div className={cn(
                          "rounded flex items-end justify-center shrink-0 border",
                          opt.value === "58mm" ? "w-5 h-7" : opt.value === "80mm" ? "w-6 h-7" : "w-7 h-7",
                          printerSize === opt.value ? "border-violet-400 bg-violet-100" : "border-slate-200 bg-slate-50",
                        )}>
                          <div className={cn("w-full mb-1 space-y-0.5 px-0.5")}>
                            <div className={cn("h-px rounded", printerSize === opt.value ? "bg-violet-400" : "bg-slate-300")} />
                            <div className={cn("h-px rounded", printerSize === opt.value ? "bg-violet-400" : "bg-slate-300")} />
                            <div className={cn("h-px rounded w-2/3", printerSize === opt.value ? "bg-violet-400" : "bg-slate-300")} />
                          </div>
                        </div>
                        <span className={cn("text-[11px] font-black", printerSize === opt.value ? "text-violet-700" : "text-slate-700")}>
                          {opt.label}
                        </span>
                        <span className="text-[8px] font-medium text-slate-400 leading-tight">{opt.desc}</span>
                        <span className="text-[7.5px] text-slate-300 leading-tight">{opt.example}</span>
                        {printerSize === opt.value && <Check size={10} strokeWidth={3} className="text-violet-600" />}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-100 rounded-xl">
                  <Bell size={14} className="text-amber-600 shrink-0" />
                  <p className="text-[10px] text-amber-800 font-medium">
                    Notificações por email para alertas de estoque e novos pedidos podem ser configuradas nas preferências avançadas.
                  </p>
                </div>

                <SaveButton onClick={handleSavePrefs} label="Salvar Preferências" />
              </div>
            )}

            {/* ── Segurança ───────────────────────────────────────────── */}
            {active === "security" && (
              <div className="space-y-6">
                <SectionHeader
                  title="Segurança"
                  subtitle="Credenciais de acesso ao painel administrativo"
                />
                <div className="max-w-sm space-y-4">
                  <Field label="Nova Senha">
                    <input
                      type="password"
                      value={newPass}
                      onChange={(e) => setNewPass(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 h-11 text-xs outline-none focus:ring-4 focus:ring-red-500/8 focus:border-red-500 transition-all"
                    />
                  </Field>
                  <Field label="Confirme a Nova Senha">
                    <input
                      type="password"
                      value={confirmPass}
                      onChange={(e) => setConfirmPass(e.target.value)}
                      placeholder="••••••••"
                      className={cn(
                        "w-full bg-slate-50 border rounded-xl px-4 h-11 text-xs outline-none focus:ring-4 transition-all",
                        confirmPass && newPass !== confirmPass
                          ? "border-red-300 focus:ring-red-500/8 focus:border-red-500"
                          : "border-slate-200 focus:ring-red-500/8 focus:border-red-500",
                      )}
                    />
                    {confirmPass && newPass !== confirmPass && (
                      <p className="text-[9px] text-red-500 font-bold px-1 mt-1">As senhas não coincidem</p>
                    )}
                  </Field>

                  <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Requisitos</p>
                    {[
                      { ok: newPass.length >= 8, label: "Mínimo 8 caracteres" },
                      { ok: /[A-Z]/.test(newPass), label: "Uma letra maiúscula" },
                      { ok: /\d/.test(newPass), label: "Um número" },
                    ].map(({ ok, label }) => (
                      <div key={label} className="flex items-center gap-2">
                        <div className={cn("w-3 h-3 rounded-full shrink-0 transition-all", ok ? "bg-emerald-500" : "bg-slate-200")} />
                        <span className={cn("text-[9px] font-bold", ok ? "text-emerald-700" : "text-slate-400")}>{label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-100 flex justify-end">
                  <button
                    onClick={handleChangePassword}
                    disabled={saving || !newPass || newPass !== confirmPass}
                    className="flex items-center gap-3 bg-red-600 text-white px-8 h-12 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-red-500/20 hover:bg-red-700 transition-all active:scale-95 disabled:opacity-40"
                  >
                    <Lock size={14} strokeWidth={2.5} />
                    {saving ? "Alterando..." : "Alterar Credenciais"}
                  </button>
                </div>
              </div>
            )}

            {/* ── Time & Acessos ──────────────────────────────────────── */}
            {active === "users" && <TeamSection />}

            {/* ── App Desktop PDV ─────────────────────────────────────── */}
            {active === "desktop" && (
              <div className="space-y-6">
                <SectionHeader
                  title="App Desktop PDV"
                  subtitle="Instale o terminal de vendas no computador do caixa — funciona até sem internet"
                />

                {/* Offline highlight */}
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                    <WifiOff size={16} className="text-amber-600" />
                  </div>
                  <div>
                    <p className="text-[11px] font-black text-amber-800 uppercase tracking-wide">Funciona Offline</p>
                    <p className="text-[11px] text-amber-700 mt-1 leading-relaxed">
                      Se a internet cair, o PDV continua vendendo normalmente. As vendas ficam salvas no
                      computador e são sincronizadas automaticamente quando a conexão voltar — sem perder
                      nenhuma venda e com a data correta no fluxo de caixa.
                    </p>
                  </div>
                </div>

                {/* Download cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {[
                    { os: "Windows", desc: "Windows 10 ou superior", file: "/downloads/BoxSysPDV-Setup.exe", ext: ".exe" },
                    { os: "macOS",   desc: "Intel e Apple Silicon",  file: "/downloads/BoxSysPDV.dmg",      ext: ".dmg" },
                    { os: "Linux",   desc: "AppImage universal",     file: "/downloads/BoxSysPDV.AppImage", ext: ".AppImage" },
                  ].map(({ os, desc, file, ext }) => (
                    <a
                      key={os}
                      href={file}
                      download
                      className="group bg-white border border-slate-200 rounded-2xl p-5 flex flex-col items-center text-center hover:border-blue-300 hover:shadow-lg hover:shadow-blue-50 transition-all"
                    >
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 group-hover:bg-blue-50 flex items-center justify-center mb-3 transition-colors">
                        <Monitor size={22} className="text-slate-400 group-hover:text-blue-600 transition-colors" />
                      </div>
                      <p className="text-[13px] font-black text-slate-900">{os}</p>
                      <p className="text-[10px] text-slate-400 font-bold mt-0.5">{desc}</p>
                      <span className="mt-4 inline-flex items-center gap-1.5 px-4 h-9 rounded-xl bg-slate-900 group-hover:bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest transition-colors">
                        <Download size={12} /> Baixar {ext}
                      </span>
                    </a>
                  ))}
                </div>

                {/* Setup instructions */}
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Como configurar</p>
                  <ol className="space-y-2 text-[12px] text-slate-600 font-medium list-decimal list-inside">
                    <li>Baixe e instale o aplicativo no computador do caixa</li>
                    <li>Na primeira abertura, informe o endereço da sua loja (ex: <span className="font-mono font-bold text-slate-800">{window.location.hostname}</span>)</li>
                    <li>Faça login com um usuário de acesso ao PDV</li>
                    <li>Pronto — o terminal está conectado e preparado para vender</li>
                  </ol>
                  <p className="text-[10px] text-slate-400 mt-4 leading-relaxed">
                    💡 No Windows, o aviso "aplicativo não reconhecido" é normal na primeira instalação —
                    clique em "Mais informações" e depois "Executar assim mesmo".
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
