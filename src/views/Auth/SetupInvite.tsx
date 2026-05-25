import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "motion/react";
import { CalendarClock, CreditCard, Lock, Mail, UserRound } from "lucide-react";

import { saveSession } from "../../lib/session";

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

export default function SetupInvite() {
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const [invite, setInvite] = useState<InvitePayload | null>(null);
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [password, setPassword] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/auth/setup/${token}`)
      .then(async (response) => {
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Não foi possível validar o convite.");
        }

        setInvite(data);
        setOwnerName(data.owner_name || "");
        setOwnerEmail(data.owner_email || "");
        setWhatsapp(data.whatsapp || "");
      })
      .catch((requestError: Error) => {
        setError(requestError.message);
      })
      .finally(() => setLoading(false));
  }, [token]);

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
          whatsapp,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Não foi possível concluir a ativação.");
        return;
      }

      saveSession(data.token, data.user);

      if (data.tenant?.public_url && !String(data.tenant.public_url).includes("/s/")) {
        window.location.href = `${String(data.tenant.public_url).replace(/\/+$/, "")}/admin`;
        return;
      }

      navigate("/admin", { replace: true });
    } catch {
      setError("Erro ao ativar a conta.");
    } finally {
      setSubmitting(false);
    }
  };

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
    <div className="min-h-screen bg-[linear-gradient(145deg,_#020617_0%,_#0f172a_40%,_#111827_100%)] px-5 py-8 text-white md:px-8">
      <div className="mx-auto grid max-w-6xl gap-6 xl:grid-cols-[1.02fr_0.98fr]">
        <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6 sm:p-8 md:p-10">
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-sky-300">Ativação da loja</p>
              <h1 className="mt-3 text-4xl font-black tracking-[-0.04em] sm:text-5xl">{invite.store_name}</h1>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-300 sm:text-base">
                Este acesso foi provisionado para o subdomínio <strong className="text-white">{invite.access_url}</strong>.
                Finalize o cadastro do administrador para liberar o painel da loja.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-[1.5rem] border border-white/10 bg-slate-950/30 p-4">
                <CalendarClock size={18} className="text-sky-300" />
                <p className="mt-3 text-[11px] font-black uppercase tracking-[0.22em] text-white">Trial</p>
                <p className="mt-2 text-sm text-slate-300">{invite.trial_days} dias de uso inicial</p>
              </div>
              <div className="rounded-[1.5rem] border border-white/10 bg-slate-950/30 p-4">
                <CreditCard size={18} className="text-sky-300" />
                <p className="mt-3 text-[11px] font-black uppercase tracking-[0.22em] text-white">Assinatura</p>
                <p className="mt-2 text-sm text-slate-300">R$ {invite.subscription_amount.toFixed(2)} / mês</p>
              </div>
              <div className="rounded-[1.5rem] border border-white/10 bg-slate-950/30 p-4">
                <Lock size={18} className="text-sky-300" />
                <p className="mt-3 text-[11px] font-black uppercase tracking-[0.22em] text-white">Validade</p>
                <p className="mt-2 text-sm text-slate-300">
                  até {new Date(invite.invite_expires_at).toLocaleDateString("pt-BR")}
                </p>
              </div>
            </div>
          </motion.div>
        </section>

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
              icon={<UserRound size={16} className="text-slate-400" />}
              label="WhatsApp"
              value={whatsapp}
              onChange={setWhatsapp}
              placeholder="5511999999999"
            />

            <Field
              icon={<Lock size={16} className="text-slate-400" />}
              label="Senha inicial"
              value={password}
              onChange={setPassword}
              placeholder="Crie uma senha forte"
              type="password"
            />

            {error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="flex h-12 w-full items-center justify-center rounded-2xl bg-blue-600 text-[11px] font-black uppercase tracking-[0.24em] text-white shadow-[0_20px_40px_rgba(37,99,235,0.28)] transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Criando painel..." : "Concluir ativação"}
            </button>
          </form>
        </section>
      </div>
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
}: {
  icon: ReactNode;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
}) {
  return (
    <div className="space-y-2">
      <label className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">{label}</label>
      <div className="flex h-12 items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 focus-within:border-blue-500 focus-within:bg-white">
        {icon}
        <input
          type={type}
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
