import { type FormEvent, type ReactNode, useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { CalendarClock, CreditCard, Eye, EyeOff, Lock, Mail, Phone, ShieldCheck, UserRound } from "lucide-react";

import { saveSession } from "../../lib/session";
import WelcomeScreen from "./WelcomeScreen";

type InvitePayload = {
  store_name: string;
  subdomain: string;
  whatsapp: string;
  owner_name?: string | null;
  owner_email?: string | null;
  trial_days: number;
  subscription_amount: number;
  invite_expires_at: string;
  access_url: string;
};

function maskWhatsapp(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}

function unmaskedWhatsapp(value: string) {
  return value.replace(/\D/g, "");
}

function getPasswordStrength(pw: string): { label: string; color: string; width: string } {
  if (!pw) return { label: "", color: "", width: "0%" };
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { label: "Fraca", color: "bg-red-500", width: "25%" };
  if (score === 2) return { label: "Regular", color: "bg-orange-400", width: "50%" };
  if (score === 3) return { label: "Boa", color: "bg-yellow-400", width: "75%" };
  return { label: "Forte", color: "bg-emerald-500", width: "100%" };
}

export default function SetupInvite() {
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const [invite, setInvite] = useState<InvitePayload | null>(null);
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [whatsappDisplay, setWhatsappDisplay] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showWelcome, setShowWelcome] = useState(false);
  const [redirectUrl, setRedirectUrl] = useState("");

  useEffect(() => {
    fetch(`/api/auth/setup/${token}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Não foi possível validar o convite.");
        setInvite(data);
        setOwnerName(data.owner_name || "");
        setOwnerEmail(data.owner_email || "");
        setWhatsappDisplay(maskWhatsapp(data.whatsapp || ""));
      })
      .catch((requestError: Error) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, [token]);

  const handleWhatsappChange = (value: string) => {
    setWhatsappDisplay(maskWhatsapp(value));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/auth/claim-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          ownerName,
          ownerEmail,
          password,
          whatsapp: unmaskedWhatsapp(whatsappDisplay),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Não foi possível concluir a ativação.");
        return;
      }

      saveSession(data.token, data.user);

      const url =
        data.tenant?.public_url && !String(data.tenant.public_url).includes("/s/")
          ? `${String(data.tenant.public_url).replace(/\/+$/, "")}/admin`
          : "/admin";

      setRedirectUrl(url);
      setShowWelcome(true);
    } catch {
      setError("Erro ao ativar a conta.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleWelcomeDone = useCallback(() => {
    if (redirectUrl.startsWith("http")) {
      window.location.href = redirectUrl;
    } else {
      navigate(redirectUrl, { replace: true });
    }
  }, [navigate, redirectUrl]);

  const strength = getPasswordStrength(password);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <div className="space-y-3 text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-sky-400 border-t-transparent" />
          <p className="text-sm font-semibold text-slate-300">Validando seu link de ativação...</p>
        </div>
      </div>
    );
  }

  if (!invite) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-5 text-white">
        <div className="max-w-md rounded-[2rem] border border-white/10 bg-white/5 p-8 text-center">
          <h1 className="text-3xl font-black tracking-[-0.04em]">Link indisponível</h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-300">
            {error || "Este convite expirou, já foi usado ou não existe mais."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <AnimatePresence>
        {showWelcome && (
          <WelcomeScreen
            storeName={invite?.store_name ?? ""}
            ownerName={ownerName}
            onDone={handleWelcomeDone}
          />
        )}
      </AnimatePresence>

      <div className="min-h-screen bg-[linear-gradient(145deg,_#020617_0%,_#0f172a_40%,_#111827_100%)] px-5 py-8 text-white md:px-8">
        <div className="mx-auto grid max-w-6xl gap-6 xl:grid-cols-[1.02fr_0.98fr]">

          {/* Left panel */}
          <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6 sm:p-8 md:p-10">
            <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-sky-300">Ativação da loja</p>
                <h1 className="mt-3 text-4xl font-black tracking-[-0.04em] sm:text-5xl">{invite.store_name}</h1>
                <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-300 sm:text-base">
                  Este acesso foi provisionado para o subdomínio{" "}
                  <strong className="text-white">{invite.access_url}</strong>. Finalize o cadastro do administrador
                  para liberar o painel da loja.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <InfoCard icon={<CalendarClock size={18} className="text-sky-300" />} title="Trial">
                  {invite.trial_days} dias de uso inicial
                </InfoCard>
                <InfoCard icon={<CreditCard size={18} className="text-sky-300" />} title="Assinatura">
                  R$ {invite.subscription_amount.toFixed(2)} / mês
                </InfoCard>
                <InfoCard icon={<Lock size={18} className="text-sky-300" />} title="Validade">
                  até {new Date(invite.invite_expires_at).toLocaleDateString("pt-BR")}
                </InfoCard>
              </div>

              <div className="flex items-start gap-3 rounded-2xl border border-sky-500/20 bg-sky-500/5 p-4">
                <ShieldCheck size={18} className="mt-0.5 shrink-0 text-sky-400" />
                <p className="text-sm leading-relaxed text-slate-300">
                  Seu acesso é <strong className="text-white">único e intransferível</strong>. Guarde bem sua senha —
                  ela pode ser alterada depois no painel.
                </p>
              </div>
            </motion.div>
          </section>

          {/* Right panel */}
          <section className="rounded-[2rem] border border-slate-200 bg-white p-6 text-slate-900 shadow-[0_28px_80px_rgba(15,23,42,0.2)] sm:p-8 md:p-10">
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-blue-600">Criar acesso</p>
              <h2 className="text-3xl font-black tracking-[-0.04em]">Administrador da loja</h2>
              <p className="text-sm leading-relaxed text-slate-500">
                Preencha os dados do responsável que vai acessar o painel desta loja.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="mt-8 space-y-4">
              <Field
                icon={<UserRound size={16} className="text-slate-400" />}
                label="Nome do responsável"
                value={ownerName}
                onChange={setOwnerName}
                placeholder="Ex: Eduardo Silva"
              />

              <Field
                icon={<Mail size={16} className="text-slate-400" />}
                label="E-mail de acesso"
                value={ownerEmail}
                onChange={setOwnerEmail}
                placeholder="responsavel@empresa.com.br"
                type="email"
              />

              <Field
                icon={<Phone size={16} className="text-slate-400" />}
                label="WhatsApp"
                value={whatsappDisplay}
                onChange={handleWhatsappChange}
                placeholder="(00) 00000-0000"
                inputMode="numeric"
              />

              <div className="space-y-2">
                <label className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
                  Senha inicial
                </label>
                <div className="flex h-12 items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 focus-within:border-blue-500 focus-within:bg-white">
                  <Lock size={16} className="shrink-0 text-slate-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Crie uma senha forte"
                    className="h-full w-full bg-transparent text-sm font-semibold text-slate-900 outline-none"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="shrink-0 text-slate-400 transition-colors hover:text-slate-600"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                {password && (
                  <div className="space-y-1">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${strength.color}`}
                        style={{ width: strength.width }}
                      />
                    </div>
                    <p className="text-[11px] font-semibold text-slate-400">
                      Força da senha:{" "}
                      <span
                        className={
                          strength.label === "Forte"
                            ? "text-emerald-500"
                            : strength.label === "Boa"
                              ? "text-yellow-500"
                              : strength.label === "Regular"
                                ? "text-orange-400"
                                : "text-red-500"
                        }
                      >
                        {strength.label}
                      </span>
                    </p>
                  </div>
                )}
              </div>

              {error && (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="flex h-12 w-full items-center justify-center rounded-2xl bg-blue-600 text-[11px] font-black uppercase tracking-[0.24em] text-white shadow-[0_20px_40px_rgba(37,99,235,0.28)] transition-all hover:bg-blue-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Criando painel...
                  </span>
                ) : (
                  "Concluir ativação"
                )}
              </button>
            </form>
          </section>
        </div>
      </div>
    </>
  );
}

function InfoCard({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-slate-950/30 p-4">
      {icon}
      <p className="mt-3 text-[11px] font-black uppercase tracking-[0.22em] text-white">{title}</p>
      <p className="mt-2 text-sm text-slate-300">{children}</p>
    </div>
  );
}

function Field({
  icon,
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  inputMode,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
  inputMode?: React.InputHTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  return (
    <div className="space-y-2">
      <label className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">{label}</label>
      <div className="flex h-12 items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 focus-within:border-blue-500 focus-within:bg-white">
        {icon}
        <input
          type={type}
          inputMode={inputMode}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="h-full w-full bg-transparent text-sm font-semibold text-slate-900 outline-none"
          required
        />
      </div>
    </div>
  );
}
