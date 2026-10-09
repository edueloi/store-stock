import React, { useEffect, useRef, useState } from "react";
import { AtSign, BadgeCheck, CalendarDays, CheckCircle2, CircleUserRound, Eye, EyeOff, Info, KeyRound, Loader2, Lock, Mail, Phone, Save, Shield, ShieldCheck, ShoppingCart, User, XCircle } from "lucide-react";
import { useToast, Button, Input, PageWrapper, SectionTitle, PanelCard, Badge, Alert } from "../../components/ui";

const ROLE_META: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  admin: { label: "Administrador", color: "#2563eb", bg: "#eff6ff", icon: <Shield size={12} /> },
  staff: { label: "Atendente", color: "#059669", bg: "#ecfdf5", icon: <User size={12} /> },
  pdv: { label: "Operador PDV", color: "#d97706", bg: "#fffbeb", icon: <ShoppingCart size={12} /> },
  seller: { label: "Vendedor", color: "#7c3aed", bg: "#f5f3ff", icon: <User size={12} /> },
  super_admin: { label: "Super Admin", color: "#dc2626", bg: "#fef2f2", icon: <Shield size={12} /> },
};

interface Profile { id: number; name: string; email: string; phone: string | null; nickname: string | null; role: string; created_at: string }
const token = () => localStorage.getItem("token");
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

  if (loading) return <div role="status" className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500"><Loader2 size={18} className="animate-spin" />Carregando perfil…</div>;
  if (!profile) return null;
  const role = ROLE_META[profile.role] ?? { label: profile.role, color: "#64748b", bg: "#f8fafc", icon: <User size={12} /> };
  const initials = profile.name.split(" ").filter(Boolean).slice(0, 2).map(item => item[0]).join("").toUpperCase() || "U";
  const statusIcon = nicknameStatus === "checking" ? <Loader2 size={16} className="animate-spin text-slate-400" /> : nicknameStatus === "available" ? <CheckCircle2 size={16} className="text-emerald-500" /> : nicknameStatus === "taken" ? <XCircle size={16} className="text-red-500" /> : null;

  return <PageWrapper>
    <div className="space-y-4">
      <SectionTitle icon={CircleUserRound} title="Meu Perfil" description="Gerencie seus dados, login e segurança de acesso" />
      <form onSubmit={handleSave} className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <aside className="xl:col-span-4 2xl:col-span-3">
          <section className="rounded-lg border border-slate-200 bg-white p-3 xl:sticky xl:top-5">
            <div className="mb-3 flex items-center justify-between"><Badge color="primary" icon={<BadgeCheck size={12} />}>Conta verificada</Badge></div>
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-blue-100 bg-blue-50 text-base font-medium text-blue-700">{initials}</div>
              <div className="min-w-0">
                <h2 className="truncate text-base font-medium text-slate-900">{profile.name}</h2>
                <p className="truncate text-xs text-slate-500">{profile.email}</p>
                <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-medium" style={{ color: role.color, background: role.bg }}>{role.icon} {role.label}</span>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
              <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-2.5"><CalendarDays size={14} className="mb-1.5 text-blue-600" /><p className="text-[11px] text-slate-500">Membro</p><p className="mt-0.5 text-xs font-medium text-slate-800">{joined(profile.created_at)}</p></div>
              <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-2.5"><ShieldCheck size={14} className="mb-1.5 text-emerald-600" /><p className="text-[11px] text-slate-500">Acesso</p><p className="mt-0.5 text-xs font-medium text-slate-800">Protegido</p></div>
            </div>
          </section>
        </aside>

        <div className="space-y-4 xl:col-span-8 2xl:col-span-9">
          <PanelCard icon={Mail} title="Dados de contato" description="Informações usadas para identificação e acesso." action={<Badge color="success" dot>Perfil ativo</Badge>}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input label="Telefone" iconLeft={<Phone size={14} />} type="text" placeholder="(00) 00000-0000" value={phone} onChange={e => setPhone(e.target.value)} />
              <Input label="Login alternativo" iconLeft={<AtSign size={14} />} iconRight={statusIcon} type="text" placeholder="Ex.: eduardo" autoComplete="off" value={nickname} onChange={e => setNickname(e.target.value)}
                error={nicknameStatus === "taken" ? "Esse login já está em uso." : undefined}
                hint="Use-o no lugar do e-mail ao entrar." />
              <div className="sm:col-span-2">
                <Input label="E-mail da conta" iconLeft={<Mail size={14} />} type="text" value={profile.email} readOnly disabled hint="Não editável" />
              </div>
            </div>
          </PanelCard>

          <PanelCard icon={KeyRound} title="Segurança da conta" description="Altere sua senha quando precisar." action={<span className="flex items-center gap-1.5 text-xs text-slate-500"><Info size={14} /> Opcional</span>}>
            <div className="space-y-3">
              <Alert variant="warning">Para definir uma nova senha, informe sua senha atual. Deixe os campos vazios se não desejar alterá-la.</Alert>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <Password label="Senha atual" value={currentPassword} onChange={setCurrentPassword} show={showPass} onToggle={() => setShowPass(value => !value)} />
                <Password label="Nova senha" value={newPassword} onChange={setNewPassword} show={showPass} onToggle={() => setShowPass(value => !value)} />
                <Password label="Confirmar nova senha" value={confirmPassword} onChange={setConfirmPassword} show={showPass} onToggle={() => setShowPass(value => !value)} />
              </div>
            </div>
          </PanelCard>

          <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-center text-xs text-slate-500 sm:text-left">Suas alterações serão aplicadas imediatamente.</p>
            <Button type="submit" size="sm" loading={saving} disabled={nicknameStatus === "taken" || nicknameStatus === "checking"} iconLeft={<Save size={14} />} className="w-full sm:w-auto">Salvar alterações</Button>
          </div>
        </div>
      </form>
    </div>
  </PageWrapper>;
}

function Password({ label, value, onChange, show, onToggle }: { label: string; value: string; onChange: (value: string) => void; show: boolean; onToggle: () => void }) {
  return <Input label={label} iconLeft={<Lock size={14} />} type={show ? "text" : "password"} value={value} onChange={event => onChange(event.target.value)}
    iconRight={<button type="button" onClick={onToggle} aria-label={show ? "Ocultar senha" : "Mostrar senha"} className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-blue-600">{show ? <EyeOff size={15} /> : <Eye size={15} />}</button>} />;
}
