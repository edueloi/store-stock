import React, { useEffect, useRef, useState } from "react";
import PageHeader from "../../components/layout/PageHeader";
import { AtSign, BadgeCheck, CalendarDays, CheckCircle2, CircleUserRound, Eye, EyeOff, Info, KeyRound, Loader2, Lock, Mail, Phone, Save, Shield, ShieldCheck, ShoppingCart, User, XCircle } from "lucide-react";
import { useToast } from "../../components/ui/Toast";

const ROLE_META: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  admin: { label: "Administrador", color: "#2563eb", bg: "#eff6ff", icon: <Shield size={12} /> },
  staff: { label: "Atendente", color: "#059669", bg: "#ecfdf5", icon: <User size={12} /> },
  pdv: { label: "Operador PDV", color: "#d97706", bg: "#fffbeb", icon: <ShoppingCart size={12} /> },
  seller: { label: "Vendedor", color: "#7c3aed", bg: "#f5f3ff", icon: <User size={12} /> },
  super_admin: { label: "Super Admin", color: "#dc2626", bg: "#fef2f2", icon: <Shield size={12} /> },
};

interface Profile { id: number; name: string; email: string; phone: string | null; nickname: string | null; role: string; created_at: string }
const token = () => localStorage.getItem("token");
const fieldClass = "h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-[#297ed1] focus:bg-white focus:ring-4 focus:ring-[#297ed1]/10";
const joined = (date: string) => { const value = new Date(date); return Number.isNaN(value.getTime()) ? "Conta ativa" : `Desde ${new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(value)}`; };

export default function MeuPerfil() {
  const { success, error: toastError } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false);
  const [phone, setPhone] = useState(""); const [nickname, setNickname] = useState("");
  const [nicknameStatus, setNicknameStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const [currentPassword, setCurrentPassword] = useState(""); const [newPassword, setNewPassword] = useState(""); const [confirmPassword, setConfirmPassword] = useState(""); const [showPass, setShowPass] = useState(false);
  const originalNickname = useRef("");

  useEffect(() => { fetch("/api/profile", { headers: { Authorization: `Bearer ${token()}` } }).then(r => r.json()).then((data: Profile) => { setProfile(data); setPhone(data.phone || ""); setNickname(data.nickname || ""); originalNickname.current = data.nickname || ""; }).finally(() => setLoading(false)); }, []);
  useEffect(() => {
    const nick = nickname.trim();
    if (!nick || nick === originalNickname.current) { setNicknameStatus("idle"); return; }
    setNicknameStatus("checking");
    const timer = setTimeout(() => fetch(`/api/profile/check-nickname?nickname=${encodeURIComponent(nick)}`, { headers: { Authorization: `Bearer ${token()}` } }).then(r => r.json()).then((data: { available: boolean }) => setNicknameStatus(data.available ? "available" : "taken")).catch(() => setNicknameStatus("idle")), 400);
    return () => clearTimeout(timer);
  }, [nickname]);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (newPassword && newPassword !== confirmPassword) { toastError("A confirmação de senha não confere."); return; }
    if (nicknameStatus === "taken") { toastError("Esse login já está em uso — escolha outro."); return; }
    setSaving(true);
    try {
      const body: Record<string, unknown> = { phone, nickname };
      if (newPassword) { body.current_password = currentPassword; body.new_password = newPassword; }
      const response = await fetch("/api/profile", { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` }, body: JSON.stringify(body) });
      const data = await response.json();
      if (response.ok) { setProfile(data); originalNickname.current = data.nickname || ""; setNicknameStatus("idle"); setCurrentPassword(""); setNewPassword(""); setConfirmPassword(""); success("Perfil atualizado com sucesso!"); }
      else toastError(data.error || "Erro ao atualizar perfil.");
    } catch { toastError("Erro de conexão. Verifique sua internet."); }
    setSaving(false);
  };

  if (loading) return <div className="flex items-center justify-center py-24"><Loader2 size={24} className="animate-spin text-[#297ed1]" /></div>;
  if (!profile) return null;
  const role = ROLE_META[profile.role] ?? { label: profile.role, color: "#64748b", bg: "#f8fafc", icon: <User size={12} /> };
  const initials = profile.name.split(" ").filter(Boolean).slice(0, 2).map(item => item[0]).join("").toUpperCase() || "U";
  const statusIcon = nicknameStatus === "checking" ? <Loader2 size={16} className="animate-spin text-slate-400" /> : nicknameStatus === "available" ? <CheckCircle2 size={16} className="text-emerald-500" /> : nicknameStatus === "taken" ? <XCircle size={16} className="text-red-500" /> : null;

  return <div className="mx-auto w-full max-w-[1500px] space-y-4 sm:space-y-6">
    <PageHeader title="Meu Perfil" subtitle="Gerencie seus dados, login e segurança de acesso" />
    <form onSubmit={handleSave} className="grid grid-cols-1 gap-4 sm:gap-6 xl:grid-cols-12">
      <aside className="xl:col-span-4 2xl:col-span-3"><section className="relative overflow-hidden rounded-2xl border border-[#132845] bg-[#0b1728] p-5 text-white shadow-xl shadow-slate-900/10 sm:p-6 xl:sticky xl:top-5">
        <div className="absolute -right-16 -top-16 h-44 w-44 rounded-full bg-[#297ed1]/20 blur-3xl" /><div className="absolute -bottom-20 -left-12 h-36 w-36 rounded-full bg-[#f7920c]/15 blur-3xl" />
        <div className="relative"><div className="mb-5 flex items-center justify-between"><span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-slate-300"><BadgeCheck size={13} className="text-[#f7a414]" /> Conta verificada</span><CircleUserRound size={21} className="text-[#77b5ee]" /></div>
          <div className="flex items-center gap-4"><div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-gradient-to-br from-[#3b91e4] to-[#1757c9] text-xl font-black shadow-lg shadow-blue-950/40">{initials}</div><div className="min-w-0"><h2 className="truncate text-lg font-black tracking-tight">{profile.name}</h2><p className="truncate text-sm text-slate-300">{profile.email}</p><span className="mt-2 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px] font-black uppercase tracking-wider" style={{ color: role.color, background: role.bg }}>{role.icon} {role.label}</span></div></div>
          <div className="mt-6 grid grid-cols-2 gap-2 border-t border-white/10 pt-5"><div className="rounded-xl border border-white/8 bg-white/5 p-3"><CalendarDays size={15} className="mb-2 text-[#f7a414]" /><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Membro</p><p className="mt-0.5 text-xs font-bold text-slate-100">{joined(profile.created_at)}</p></div><div className="rounded-xl border border-white/8 bg-white/5 p-3"><ShieldCheck size={15} className="mb-2 text-emerald-400" /><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Acesso</p><p className="mt-0.5 text-xs font-bold text-slate-100">Protegido</p></div></div>
        </div></section></aside>

      <div className="space-y-4 sm:space-y-6 xl:col-span-8 2xl:col-span-9">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><SectionHeader icon={<Mail size={19} />} iconClass="bg-blue-50 text-[#297ed1]" title="Dados de contato" description="Informações usadas para identificação e acesso." side={<span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-emerald-700"><CheckCircle2 size={13} /> Perfil ativo</span>} />
          <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 sm:p-6"><Field label="Telefone" icon={<Phone size={13} />}><input type="text" placeholder="(00) 00000-0000" value={phone} onChange={e => setPhone(e.target.value)} className={fieldClass} /></Field><Field label="Login alternativo" icon={<AtSign size={13} />}><div className="relative"><input type="text" placeholder="Ex.: eduardo" autoComplete="off" value={nickname} onChange={e => setNickname(e.target.value)} className={`${fieldClass} pr-11 ${nicknameStatus === "taken" ? "border-red-300 focus:border-red-400 focus:ring-red-500/10" : nicknameStatus === "available" ? "border-emerald-300 focus:border-emerald-400 focus:ring-emerald-500/10" : ""}`} /><div className="absolute right-4 top-1/2 -translate-y-1/2">{statusIcon}</div></div><p className={`text-xs ${nicknameStatus === "taken" ? "font-semibold text-red-600" : "text-slate-400"}`}>{nicknameStatus === "taken" ? "Esse login já está em uso." : "Use-o no lugar do e-mail ao entrar."}</p></Field><div className="space-y-2 sm:col-span-2"><label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500"><Mail size={13} className="text-[#297ed1]" /> E-mail da conta</label><div className="flex h-12 items-center rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-500"><span className="truncate">{profile.email}</span><span className="ml-auto pl-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Não editável</span></div></div></div>
        </section>
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><SectionHeader icon={<KeyRound size={19} />} iconClass="bg-amber-50 text-[#e88905]" title="Segurança da conta" description="Altere sua senha quando precisar." side={<span className="flex items-center gap-1.5 text-xs font-semibold text-slate-400"><Info size={14} /> Opcional</span>} />
          <div className="p-4 sm:p-6"><div className="mb-5 flex gap-3 rounded-xl border border-amber-100 bg-amber-50/70 p-3 text-xs leading-relaxed text-amber-800"><ShieldCheck size={17} className="mt-0.5 shrink-0 text-[#e88905]" />Para definir uma nova senha, informe sua senha atual. Deixe os campos vazios se não desejar alterá-la.</div><div className="grid grid-cols-1 gap-4 md:grid-cols-3"><Password label="Senha atual" value={currentPassword} onChange={setCurrentPassword} show={showPass} onToggle={() => setShowPass(value => !value)} /><Password label="Nova senha" value={newPassword} onChange={setNewPassword} show={showPass} onToggle={() => setShowPass(value => !value)} /><Password label="Confirmar nova senha" value={confirmPassword} onChange={setConfirmPassword} show={showPass} onToggle={() => setShowPass(value => !value)} /></div></div>
        </section>
        <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-center text-xs text-slate-400 sm:text-left">Suas alterações serão aplicadas imediatamente.</p><button type="submit" disabled={saving || nicknameStatus === "taken" || nicknameStatus === "checking"} className="flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#297ed1] px-6 text-[11px] font-black uppercase tracking-wider text-white shadow-lg shadow-blue-200 transition-all hover:-translate-y-0.5 hover:bg-[#176fc4] hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto">{saving ? <Loader2 size={16} className="animate-spin" /> : <><Save size={16} /> Salvar alterações</>}</button></div>
      </div>
    </form>
  </div>;
}

function SectionHeader({ icon, iconClass, title, description, side }: { icon: React.ReactNode; iconClass: string; title: string; description: string; side: React.ReactNode }) { return <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"><div className="flex items-center gap-3"><div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconClass}`}>{icon}</div><div><h3 className="text-sm font-black text-slate-800">{title}</h3><p className="text-xs text-slate-500">{description}</p></div></div>{side}</div>; }
function Field({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) { return <div className="space-y-2"><label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500"><span className="text-[#297ed1]">{icon}</span>{label}</label>{children}</div>; }
function Password({ label, value, onChange, show, onToggle }: { label: string; value: string; onChange: (value: string) => void; show: boolean; onToggle: () => void }) { return <Field label={label} icon={<Lock size={13} />}><div className="relative"><input type={show ? "text" : "password"} value={value} onChange={event => onChange(event.target.value)} className={`${fieldClass} pr-11`} /><button type="button" onClick={onToggle} aria-label={show ? "Ocultar senha" : "Mostrar senha"} className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-[#297ed1]">{show ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></Field>; }
