import React, { useState, useEffect, useCallback } from "react";
import {
  Store, Palette, Share2, Clock, CreditCard, Shield, Settings2,
  Users, Save, Loader2, Search, Check, ChevronRight, Globe,
  Bell, Sun, Moon, Package, AlertTriangle, Lock,
} from "lucide-react";
import PageHeader from "../../components/layout/PageHeader";
import { cn } from "../../lib/utils";
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

const DEFAULT_POLICIES: StorePolicies = { returns: "", shipping: "", exchange: "" };

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
    ],
  },
  {
    group: "Sistema",
    desc: "Configurações do painel admin",
    color: "text-slate-400",
    items: [
      { id: "preferences", icon: Settings2, label: "Preferências do Painel" },
      { id: "security", icon: Shield, label: "Segurança" },
      { id: "users", icon: Users, label: "Time & Acessos" },
    ],
  },
];

// ─── main component ──────────────────────────────────────────────────────────

export default function Settings() {
  const [active, setActive] = useState("identity");
  const [tenant, setTenant] = useState<Partial<Tenant> | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);

  // system prefs (stored in UserPreference)
  const [panelTheme, setPanelTheme] = useState<"light" | "dark">("light");
  const [lowStockAlert, setLowStockAlert] = useState(5);
  const [panelLang, setPanelLang] = useState("pt-BR");

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

  useEffect(() => {
    fetch("/api/tenant", { headers: API_HEADERS() })
      .then((r) => r.json())
      .then((d) => {
        setTenant(d);
        if (d?.card_fees) setCardFees(d.card_fees);
        setLoading(false);
      });

    // load panel prefs
    Promise.all([
      fetch("/api/preferences/panel_theme", { headers: API_HEADERS() }).then((r) => r.json()),
      fetch("/api/preferences/low_stock_alert", { headers: API_HEADERS() }).then((r) => r.json()),
      fetch("/api/preferences/panel_lang", { headers: API_HEADERS() }).then((r) => r.json()),
    ]).then(([theme, alert, lang]) => {
      if (theme) setPanelTheme(theme as "light" | "dark");
      if (alert !== null) setLowStockAlert(Number(alert));
      if (lang) setPanelLang(lang as string);
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

  const handleLookupCEP = async () => {
    const cep = tenant?.address?.match(/\d{5}-?\d{3}/)?.[0];
    if (!cep) return;
    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep.replace("-", "")}/json/`);
      const d = await res.json();
      if (!d.erro) setT({ address: `${d.logradouro}, ${d.bairro}, ${d.localidade} - ${d.uf}` });
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
        body: JSON.stringify({ ...tenant, card_fees: cardFees }),
      });
      if (res.ok) showSaved();
    } finally {
      setSaving(false);
    }
  };

  const setFeeRate = (brand: string, installmentIdx: number, value: number) => {
    setCardFees((prev) => {
      const arr = [...(prev[brand] ?? Array(12).fill(0))];
      arr[installmentIdx] = value;
      return { ...prev, [brand]: arr };
    });
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
              <div className="space-y-6">
                <SectionHeader
                  title="Identidade & Dados"
                  subtitle="Informações básicas da sua loja exibidas para os clientes"
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <Field label="Nome da Organização">
                    <TextInput value={tenant?.name ?? ""} onChange={(v) => setT({ name: v })} />
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
                  <div className="md:col-span-2 space-y-1.5">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 px-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.18em]">
                        Endereço / Sede
                      </label>
                      <div className="flex items-center gap-3 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Exibir no Site</span>
                        <Toggle
                          checked={tenant?.show_address ?? true}
                          onChange={(v) => setT({ show_address: v })}
                        />
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <TextInput
                        value={tenant?.address ?? ""}
                        onChange={(v) => setT({ address: v })}
                        placeholder="CEP ou Rua, Número..."
                        className="flex-1"
                      />
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
                  <div className="md:col-span-2">
                    <Field label="Manifesto da Marca (About)" hint="Texto exibido na página Sobre da loja pública">
                      <textarea
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-xs font-medium outline-none h-36 resize-none focus:ring-4 focus:ring-blue-500/8 focus:border-blue-500 transition-all"
                        value={tenant?.about_text ?? ""}
                        onChange={(e) => setT({ about_text: e.target.value })}
                        placeholder="Descreva a essência do seu negócio..."
                      />
                    </Field>
                  </div>
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
                  <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2 sm:grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 sm:overflow-visible sm:pb-0">
                    {[
                      { id: "minimal", name: "Minimalista", desc: "Visual limpo para destacar seus produtos e imagens.", color: "#2563eb", bg: "#f8fafc" },
                      { id: "cyber",   name: "Neon Escuro", desc: "Estilo marcante com alto contraste, ideal para tecnologia e games.", color: "#00ff7f", bg: "#000" },
                      { id: "organic", name: "Orgânico",    desc: "Cores suaves e acolhedoras para marcas naturais, leves e artesanais.", color: "#d97706", bg: "#fefaf6" },
                      { id: "luxury",  name: "Luxo Dourado", desc: "Aparência sofisticada para catálogos premium e produtos exclusivos.", color: "#c5a059", bg: "#0a0a0a" },
                      { id: "tech",    name: "Tecnologia Pro", desc: "Layout moderno e profissional para eletrônicos, inovação e desempenho.", color: "#0ea5e9", bg: "#f4f6fb" },
                      { id: "nexus_tech", name: "Nexus Tech", desc: "Tema claro, vibrante e premium para eletrônicos, informática, games e casa inteligente.", color: "#2563eb", bg: "#eef4ff" },
                      { id: "atelier", name: "Ateliê Chic", desc: "Editorial claro e elegante para lojas de roupas, moda e acessórios.", color: "#a26157", bg: "#fff6ef" },
                    ].map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setT({ template_id: t.id })}
                        className={cn(
                          "min-w-[240px] sm:min-w-0 p-4 sm:p-4 rounded-2xl border-2 text-left transition-all relative overflow-hidden group shrink-0",
                          tenant?.template_id === t.id
                            ? "border-blue-600 bg-blue-50/40 shadow-lg shadow-blue-500/8"
                            : "border-slate-100 hover:border-slate-200 bg-white hover:shadow-md",
                        )}
                      >
                        {tenant?.template_id === t.id && (
                          <div className="absolute top-2 right-2 text-blue-600">
                            <Check size={14} strokeWidth={3} />
                          </div>
                        )}
                        <div
                          className="w-full h-9 rounded-xl mb-3 flex items-center justify-center"
                          style={{ backgroundColor: t.bg, border: `1px solid ${t.color}30` }}
                        >
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: t.color, boxShadow: `0 0 8px ${t.color}` }} />
                        </div>
                        <p className="text-[11px] font-black uppercase tracking-wider text-slate-800 group-hover:text-blue-600 transition-colors">{t.name}</p>
                        <p className="text-[10px] text-slate-500 mt-1 font-medium leading-relaxed">{t.desc}</p>
                      </button>
                    ))}
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
                    ] as { policyKey: keyof StorePolicies; label: string; placeholder: string }[]
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
            {active === "card_fees" && (
              <div className="space-y-8">
                <SectionHeader
                  title="Maquininha & Taxas"
                  subtitle="Configure as taxas por bandeira e parcelamento. Estes valores são aplicados automaticamente no PDV ao calcular o total."
                />

                {/* info box */}
                <div className="flex gap-3 p-4 bg-amber-50 border border-amber-100 rounded-xl">
                  <CreditCard size={16} className="text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-amber-800 font-medium leading-relaxed">
                    Informe a taxa (%) que sua maquininha cobra por parcela. Deixe <strong>0</strong> para parcelas não disponíveis. O PDV calculará e exibirá o acréscimo automaticamente ao selecionar crédito parcelado.
                  </p>
                </div>

                {/* table per brand */}
                {([
                  { key: "visa",   label: "Visa",       color: "#1A1F71" },
                  { key: "master", label: "Mastercard", color: "#EB001B" },
                  { key: "elo",    label: "Elo",        color: "#00A4E0" },
                  { key: "amex",   label: "American Express", color: "#2E77BC" },
                  { key: "hiper",  label: "Hipercard",  color: "#B22222" },
                  { key: "other",  label: "Outras Bandeiras", color: "#64748b" },
                ] as { key: string; label: string; color: string }[]).map(({ key, label, color }) => {
                  const fees = cardFees[key] ?? Array(12).fill(0);
                  return (
                    <div key={key} className="border border-slate-100 rounded-2xl overflow-hidden">
                      {/* brand header */}
                      <div
                        className="flex items-center gap-3 px-5 py-3"
                        style={{ backgroundColor: color + "15", borderBottom: `2px solid ${color}30` }}
                      >
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                        <span className="text-[10px] font-black uppercase tracking-widest" style={{ color }}>
                          {label}
                        </span>
                      </div>

                      {/* installment grid */}
                      <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {[1,2,3,4,5,6,7,8,9,10,11,12].map((n, idx) => (
                          <div key={n} className="space-y-1">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1 block">
                              {n === 1 ? "À Vista" : `${n}× parcelas`}
                            </label>
                            <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-blue-500/10 focus-within:border-blue-500 bg-slate-50 transition-all">
                              <input
                                type="number"
                                min="0"
                                max="30"
                                step="0.1"
                                value={fees[idx] ?? 0}
                                onChange={(e) => setFeeRate(key, idx, parseFloat(e.target.value) || 0)}
                                className="flex-1 bg-transparent px-2 h-9 text-xs font-mono font-bold outline-none w-0 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                              />
                              <span className="bg-slate-100 border-l border-slate-200 px-2 h-9 flex items-center text-[10px] font-black text-slate-400 shrink-0">%</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}

                <SaveButton onClick={handleSaveCardFees} label="Salvar Taxas" />
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
            {active === "users" && (
              <div className="space-y-6">
                <SectionHeader
                  title="Time & Acessos"
                  subtitle="Gestão de usuários e permissões"
                />
                <div className="flex flex-col items-center justify-center py-16 gap-5">
                  <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center">
                    <Users size={28} strokeWidth={1.5} className="text-slate-300" />
                  </div>
                  <div className="text-center max-w-xs space-y-2">
                    <h4 className="text-xs font-black uppercase tracking-widest text-slate-500">
                      Módulo Multi-Usuário
                    </h4>
                    <p className="text-[10px] text-slate-400 font-medium leading-relaxed">
                      Gestão avançada de permissões granulares, convite de colaboradores e logs de auditoria estão disponíveis no plano SaaS Premium.
                    </p>
                  </div>
                  <button className="bg-slate-900 text-white px-8 h-10 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg hover:bg-slate-800 transition-all active:scale-95">
                    Explorar Upgrades
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
