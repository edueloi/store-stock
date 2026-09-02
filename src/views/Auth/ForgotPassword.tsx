import { type FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { ArrowLeft, CheckCircle, Mail } from "lucide-react";

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
    <div className="flex min-h-screen bg-white">
      {/* Painel esquerdo — mesma identidade do Login */}
      <aside className="relative hidden w-[44%] min-w-[420px] flex-col justify-between overflow-hidden bg-[#081226] p-10 lg:flex xl:p-14">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(37,99,235,0.28),transparent_38%)]" />
          <div className="absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-blue-600/10 blur-[100px]" />
          <div className="absolute inset-0 opacity-[0.07] [background-image:radial-gradient(rgba(255,255,255,0.6)_1px,transparent_1px)] [background-size:32px_32px]" />
        </div>

        <div className="relative">
          <img src="/system/logo-boxsys-vazado.png" alt="BoxSys" className="h-11 w-auto object-contain" />
        </div>

        <div className="relative max-w-md">
          <span className="mb-6 block h-1 w-10 rounded-full bg-amber-400" />
          <h1 className="text-4xl font-bold leading-[1.12] tracking-[-0.035em] text-white xl:text-5xl">
            Recupere seu acesso<br />
            <span className="text-blue-300">com segurança.</span>
          </h1>
          <p className="mt-5 max-w-sm text-base leading-7 text-slate-400">
            Enviaremos as instruções para o seu e-mail.
          </p>
        </div>

        <p className="relative text-xs text-slate-500">
          &copy; {new Date().getFullYear()} BoxSys
        </p>
      </aside>

      {/* Painel direito */}
      <main className="relative flex flex-1 flex-col items-center justify-center bg-white px-6 py-10 sm:px-10">
        <div className="mb-12 lg:hidden">
          <img src="/system/logo-boxsys-vazado.png" alt="BoxSys" className="h-11 w-auto object-contain" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="w-full max-w-[400px]"
        >
          <Link
            to="/login"
            className="mb-9 inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-slate-800"
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
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 border-2 border-emerald-200">
                    <CheckCircle size={36} className="text-emerald-500" />
                  </div>
                </div>
                <div>
                  <h2 className="text-2xl font-black tracking-[-0.02em] text-slate-900">E-mail enviado!</h2>
                  <p className="mt-2 text-sm leading-relaxed text-slate-500">
                    Se <strong>{email}</strong> estiver cadastrado, você receberá as instruções em instantes. Verifique também a caixa de spam.
                  </p>
                </div>
                <Link
                  to="/login"
                  className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-slate-900 text-sm font-bold text-white transition-all hover:bg-slate-800"
                >
                  Voltar ao login
                </Link>
              </motion.div>
            ) : (
              <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="mb-9">
                  <h2 className="text-3xl font-bold tracking-[-0.03em] text-slate-950 sm:text-4xl">
                    Esqueceu a senha?
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Digite seu e-mail para receber o link de redefinição.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-1.5">
                    <label className="block text-sm font-semibold text-slate-700">
                      E-mail
                    </label>
                    <div className="flex h-[52px] items-center gap-3 rounded-xl border border-slate-300 bg-white px-4 transition-all focus-within:border-blue-500 focus-within:shadow-[0_0_0_3px_rgba(59,130,246,0.12)]">
                      <Mail size={18} className="shrink-0 text-slate-400" />
                      <input
                        type="email"
                        autoComplete="email"
                        className="h-full w-full bg-transparent text-[15px] text-slate-900 placeholder-slate-400 outline-none"
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
                    className="flex h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-blue-600 text-sm font-bold text-white shadow-[0_8px_20px_rgba(37,99,235,0.22)] transition-all hover:bg-blue-700 hover:shadow-[0_10px_24px_rgba(37,99,235,0.28)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
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

          <p className="absolute bottom-6 left-0 right-0 text-center text-xs text-slate-400 lg:hidden">
            &copy; {new Date().getFullYear()} BoxSys
          </p>
        </motion.div>
      </main>
    </div>
  );
}
