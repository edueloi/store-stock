import { type FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { ArrowLeft, CheckCircle } from "lucide-react";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      setSent(true);
    } catch {
      setError("Erro ao conectar com o servidor. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#09161f]">
      {/* Painel esquerdo — mesma identidade do Login */}
      <aside className="relative hidden w-[52%] min-w-[500px] flex-col justify-between overflow-hidden border-r border-white/10 bg-[#09161f] p-10 lg:flex xl:p-14">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(41,126,209,0.28),transparent_34%)]" />
          <div className="absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-orange-500/10 blur-[100px]" />
          <div className="absolute inset-0 opacity-[0.07] [background-image:radial-gradient(rgba(255,255,255,0.6)_1px,transparent_1px)] [background-size:32px_32px]" />
        </div>

        <div className="relative flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/10">
            <img src="/system/favicon.png" alt="Store BoxSys" className="h-10 w-10 object-contain" />
          </div>
          <p className="text-xl font-black tracking-[-0.04em]"><span className="text-[#f58d0a]">Store</span><span className="text-[#5ba9ee]"> BoxSys</span></p>
        </div>

        <div className="relative max-w-md">
          <img src="/system/favicon.png" alt="" className="mb-7 h-36 w-36 object-contain" />
          <span className="mb-6 block h-1 w-12 rounded-full bg-[#f7920c]" />
          <h1 className="text-4xl font-bold leading-[1.12] tracking-[-0.035em] text-white xl:text-5xl">
            Recupere seu acesso<br />
            <span className="text-blue-300">com segurança.</span>
          </h1>
          <p className="mt-5 max-w-sm text-base leading-7 text-slate-400">
            Enviaremos as instruções para o seu e-mail.
          </p>
        </div>

        <p className="relative text-xs text-slate-500">
          &copy; {new Date().getFullYear()} Store BoxSys
        </p>
      </aside>

      {/* Painel direito */}
      <main className="relative flex flex-1 flex-col items-center justify-center bg-[radial-gradient(circle_at_100%_0%,rgba(41,126,209,0.14),transparent_30%),#0c1926] px-6 py-10 sm:px-10">
        <div className="mb-10 flex items-center gap-3 lg:hidden">
          <img src="/system/favicon.png" alt="Store BoxSys" className="h-12 w-12 object-contain" />
          <p className="text-2xl font-black tracking-[-0.04em]"><span className="text-[#f58d0a]">Store</span><span className="text-[#297ed1]"> BoxSys</span></p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="w-full max-w-[390px]"
        >
          <Link
            to="/login"
            className="mb-9 inline-flex items-center gap-2 text-sm font-medium text-slate-400 transition-colors hover:text-white"
          >
            <ArrowLeft size={15} />
            Voltar ao login
          </Link>

          <AnimatePresence mode="wait">
            {sent ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-6 text-center"
              >
                <div className="flex justify-center">
                  <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-emerald-400/30 bg-emerald-400/10">
                    <CheckCircle size={36} className="text-emerald-500" />
                  </div>
                </div>
                <div>
                  <h2 className="text-2xl font-black tracking-[-0.02em] text-white">E-mail enviado!</h2>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">
                    Se <strong>{email}</strong> estiver cadastrado, você receberá as instruções em instantes. Verifique também a caixa de spam.
                  </p>
                </div>
                <Link
                  to="/login"
                  className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-[#297ed1] text-sm font-bold text-white transition-all hover:bg-[#1f6ebd]"
                >
                  Voltar ao login
                </Link>
              </motion.div>
            ) : (
              <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="mb-9">
                  <span className="mb-5 block h-1 w-12 rounded-full bg-[#f7920c]" />
                  <p className="mb-3 text-[11px] font-black uppercase tracking-[0.22em] text-[#f7920c]">Store BoxSys</p>
                  <h2 className="text-3xl font-bold tracking-[-0.03em] text-white sm:text-4xl">
                    Esqueceu a senha?
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    Digite seu e-mail para receber o link de redefinição.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-1.5">
                    <label className="block text-sm font-semibold text-slate-300">
                      E-mail
                    </label>
                    <div className="flex h-[54px] items-center rounded-xl border border-white/10 bg-white/[0.06] px-4 transition-all focus-within:border-[#297ed1] focus-within:bg-white/[0.09] focus-within:shadow-[0_0_0_3px_rgba(41,126,209,0.16)]">
                      <input
                        type="email"
                        autoComplete="email"
                        className="auth-input h-full w-full bg-transparent text-[15px] text-white placeholder-slate-500 outline-none"
                        placeholder="seu@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  {error && (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="flex h-[54px] w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#297ed1] text-sm font-bold text-white shadow-[0_10px_22px_rgba(41,126,209,0.28)] transition-all hover:bg-[#1f6ebd] hover:shadow-[0_12px_26px_rgba(41,126,209,0.34)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading ? (
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                      </svg>
                    ) : (
                      "Enviar link de redefinição"
                    )}
                  </button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>

          <p className="absolute bottom-6 left-0 right-0 text-center text-xs text-slate-500 lg:hidden">
            &copy; {new Date().getFullYear()} Store BoxSys
          </p>
        </motion.div>
      </main>
    </div>
  );
}
