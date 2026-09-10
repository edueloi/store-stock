import React, { useState, useEffect, useRef } from "react";
import PageHeader from "../../components/layout/PageHeader";
import { Save, Loader2, User, Shield, ShoppingCart, Phone, AtSign, Lock, Eye, EyeOff, CheckCircle2, XCircle } from "lucide-react";
import { useToast } from "../../components/ui/Toast";

const ROLE_META: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  admin:       { label: "Admin",        color: "#2563eb", bg: "#eff6ff", icon: <Shield size={12} /> },
  staff:       { label: "Atendente",    color: "#059669", bg: "#ecfdf5", icon: <User size={12} /> },
  pdv:         { label: "Operador PDV", color: "#d97706", bg: "#fffbeb", icon: <ShoppingCart size={12} /> },
  seller:      { label: "Vendedor",     color: "#7c3aed", bg: "#f5f3ff", icon: <User size={12} /> },
  super_admin: { label: "Super Admin",  color: "#dc2626", bg: "#fef2f2", icon: <Shield size={12} /> },
};

interface Profile {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  nickname: string | null;
  role: string;
  created_at: string;
}

const token = () => localStorage.getItem("token");

export default function MeuPerfil() {
  const { success, error: toastError } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [phone, setPhone] = useState("");
  const [nickname, setNickname] = useState("");
  const [nicknameStatus, setNicknameStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPass, setShowPass] = useState(false);

  const originalNickname = useRef("");

  useEffect(() => {
    fetch("/api/profile", { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => r.json())
      .then((d: Profile) => {
        setProfile(d);
        setPhone(d.phone || "");
        setNickname(d.nickname || "");
        originalNickname.current = d.nickname || "";
      })
      .finally(() => setLoading(false));
  }, []);

  // Verifica disponibilidade do nick enquanto o usuário digita (debounce 400ms) —
  // sem alterar nada ainda no servidor, só consulta.
  useEffect(() => {
    const nick = nickname.trim();
    if (!nick || nick === originalNickname.current) {
      setNicknameStatus("idle");
      return;
    }
    setNicknameStatus("checking");
    const timer = setTimeout(() => {
      fetch(`/api/profile/check-nickname?nickname=${encodeURIComponent(nick)}`, {
        headers: { Authorization: `Bearer ${token()}` },
      })
        .then(r => r.json())
        .then((d: { available: boolean }) => setNicknameStatus(d.available ? "available" : "taken"))
        .catch(() => setNicknameStatus("idle"));
    }, 400);
    return () => clearTimeout(timer);
  }, [nickname]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword && newPassword !== confirmPassword) {
      toastError("A confirmação de senha não confere.");
      return;
    }
    if (nicknameStatus === "taken") {
      toastError("Esse nick já está em uso — escolha outro.");
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = { phone, nickname };
      if (newPassword) {
        body.current_password = currentPassword;
        body.new_password = newPassword;
      }
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        setProfile(data);
        originalNickname.current = data.nickname || "";
        setNicknameStatus("idle");
        setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
        success("Perfil atualizado com sucesso!");
      } else {
        toastError(data.error || "Erro ao atualizar perfil.");
      }
    } catch {
      toastError("Erro de conexão. Verifique sua internet.");
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={24} className="animate-spin text-slate-300" />
      </div>
    );
  }

  if (!profile) return null;
  const roleMeta = ROLE_META[profile.role] ?? { label: profile.role, color: "#64748b", bg: "#f8fafc", icon: <User size={12} /> };

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader title="Meu Perfil" subtitle="Seus dados de acesso ao sistema" />

      {/* card resumo */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-black text-xl shrink-0"
          style={{ background: "linear-gradient(135deg,#3b82f6,#1d4ed8)" }}>
          {profile.name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-black text-slate-900 truncate">{profile.name}</p>
          <p className="text-xs text-slate-400 truncate">{profile.email}</p>
          <span
            className="inline-flex items-center gap-1 mt-1.5 text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg"
            style={{ color: roleMeta.color, background: roleMeta.bg }}
          >
            {roleMeta.icon} {roleMeta.label}
          </span>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        {/* Contato e login */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <AtSign size={13} />
            </div>
            <h3 className="text-[11px] font-black text-slate-700 uppercase tracking-widest">Contato e login</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-[9px] font-black text-slate-400 uppercase tracking-[0.18em]">
                <Phone size={10} /> Telefone
              </label>
              <input
                type="text" placeholder="(00) 00000-0000"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 h-11 text-xs font-bold focus:ring-2 focus:ring-blue-500/10 focus:border-blue-400 outline-none transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-[9px] font-black text-slate-400 uppercase tracking-[0.18em]">
                <AtSign size={10} /> Nick <span className="text-slate-300 normal-case font-normal">(login alternativo ao e-mail)</span>
              </label>
              <div className="relative">
                <input
                  type="text" placeholder="Ex: eduardo" autoComplete="off"
                  value={nickname}
                  onChange={e => setNickname(e.target.value)}
                  className={`w-full bg-slate-50 border rounded-xl px-4 pr-9 h-11 text-xs font-bold outline-none transition-all focus:ring-2 ${
                    nicknameStatus === "taken"
                      ? "border-red-300 focus:border-red-400 focus:ring-red-500/10"
                      : nicknameStatus === "available"
                      ? "border-emerald-300 focus:border-emerald-400 focus:ring-emerald-500/10"
                      : "border-slate-200 focus:border-blue-400 focus:ring-blue-500/10"
                  }`}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {nicknameStatus === "checking" && <Loader2 size={14} className="animate-spin text-slate-300" />}
                  {nicknameStatus === "available" && <CheckCircle2 size={14} className="text-emerald-500" />}
                  {nicknameStatus === "taken" && <XCircle size={14} className="text-red-500" />}
                </div>
              </div>
              {nicknameStatus === "taken" && (
                <p className="text-[9px] text-red-500 font-bold px-1">Esse nick já está em uso.</p>
              )}
            </div>
          </div>
        </div>

        {/* Senha */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <Lock size={13} />
            </div>
            <h3 className="text-[11px] font-black text-slate-700 uppercase tracking-widest">
              Alterar senha <span className="text-slate-300 normal-case font-normal">(opcional)</span>
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.18em] px-1 block">Senha atual</label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 pr-9 h-11 text-xs font-bold focus:ring-2 focus:ring-blue-500/10 focus:border-blue-400 outline-none transition-all"
                />
                <button type="button" onClick={() => setShowPass(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">
                  {showPass ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.18em] px-1 block">Nova senha</label>
              <input
                type={showPass ? "text" : "password"}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 h-11 text-xs font-bold focus:ring-2 focus:ring-blue-500/10 focus:border-blue-400 outline-none transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.18em] px-1 block">Confirmar nova senha</label>
              <input
                type={showPass ? "text" : "password"}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 h-11 text-xs font-bold focus:ring-2 focus:ring-blue-500/10 focus:border-blue-400 outline-none transition-all"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit" disabled={saving || nicknameStatus === "taken" || nicknameStatus === "checking"}
            className="h-11 px-6 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-blue-200 flex items-center justify-center gap-2 disabled:opacity-40"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <><Save size={14} /> Salvar Alterações</>}
          </button>
        </div>
      </form>
    </div>
  );
}
