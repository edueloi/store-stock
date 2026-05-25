import { type FormEvent, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { ArrowLeft, CheckCircle, Eye, EyeOff, KeyRound, Lock } from "lucide-react";

export default function ResetPassword() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("A senha deve ter no mínimo 6 caracteres.");
      return;
    }

    if (password !== confirm) {
      setError("As senhas não coincidem.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Não foi possível redefinir a senha.");
        return;
      }

      setDone(true);
      setTimeout(() => navigate("/login"), 3000);
    } catch {
      setError("Erro ao conectar com o servidor. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Painel esquerdo */}
      <div className="relative hidden w-[55%] flex-col justify-between overflow-hidden bg-[#090e1a] p-10 lg:flex xl:p-14">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(29,78,216,0.35),transparent)]" />
          <div className="absolute bottom-0 left-0 h-80 w-80 rounded-full bg-blue-700/10 blur-[100px]" />
        </div>

        <div className="relative flex flex-col gap-1">
          <img src="/system/logo-boxsys-vazado.png" alt="BoxSys" className="h-12 w-auto object-contain" />
          <p className="text-[2.6rem] font-black leading-none tracking-[-0.03em]">
            <span className="text-white">Sto</span><span className="text-blue-400">re</span>
          </p>
        </div>

        <div className="relative space-y-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/20 border border-amber-500/30">
            <KeyRound size={24} className="text-amber-400" />
          </div>
          <h1 className="text-4xl font-black leading-tight tracking-[-0.03em] text-white xl:text-5xl">
            Crie uma<br />
            <span className="text-amber-400">nova senha</span><br />
            <span className="text-slate-400">forte e segura.</span>
          </h1>
          <p className="max-w-xs text-sm leading-relaxed text-slate-400">
            Use uma combinação de letras, números e símbolos para manter sua conta protegida.
          </p>
        </div>

        <p className="relative text-xs text-slate-600">
          &copy; {new Date().getFullYear()} BoxSys &middot; Sistema de Gestão para Lojas
        </p>
      </div>

      {/* Painel direito */}
      <div className="flex flex-1 flex-col items-center justify-center bg-white px-6 py-10 sm:px-10">
        <div className="mb-8 lg:hidden">
          <img src="/system/logo-boxsys-vazado.png" alt="BoxSys" className="h-10 w-auto object-contain" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="w-full max-w-sm"
        >
          {!done && (
            <Link
              to="/login"
              className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-slate-400 transition-colors hover:text-slate-700"
            >
              <ArrowLeft size={15} />
              Voltar ao login
            </Link>
          )}

          <AnimatePresence mode="wait">
            {done ? (
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
                  <h2 className="text-2xl font-black tracking-[-0.02em] text-slate-900">Senha redefinida!</h2>
                  <p className="mt-2 text-sm leading-relaxed text-slate-500">
                    Sua nova senha foi salva com sucesso. Redirecionando para o login...
                  </p>
                </div>
                <Link
                  to="/login"
                  className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-slate-900 text-sm font-bold text-white transition-all hover:bg-slate-800"
                >
                  Ir para o login
                </Link>
              </motion.div>
            ) : (
              <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="mb-8">
                  <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.22em] text-amber-500">
                    Nova senha
                  </p>
                  <h2 className="text-3xl font-black tracking-[-0.03em] text-slate-900">
                    Redefinir senha
                  </h2>
                  <p className="mt-1.5 text-sm text-slate-500">
                    Escolha uma nova senha para sua conta.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  {/* Nova senha */}
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                      Nova senha
                    </label>
                    <div className="flex h-12 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 transition-all focus-within:border-blue-500 focus-within:bg-white focus-within:shadow-[0_0_0_3px_rgba(59,130,246,0.12)]">
                      <Lock size={15} className="shrink-0 text-slate-400" />
                      <input
                        type={showPassword ? "text" : "password"}
                        className="h-full w-full bg-transparent text-sm text-slate-900 placeholder-slate-400 outline-none"
                        placeholder="Mínimo 6 caracteres"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="shrink-0 text-slate-400 transition-colors hover:text-slate-600"
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>

                  {/* Confirmar senha */}
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                      Confirmar senha
                    </label>
                    <div className="flex h-12 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 transition-all focus-within:border-blue-500 focus-within:bg-white focus-within:shadow-[0_0_0_3px_rgba(59,130,246,0.12)]">
                      <Lock size={15} className="shrink-0 text-slate-400" />
                      <input
                        type={showConfirm ? "text" : "password"}
                        className="h-full w-full bg-transparent text-sm text-slate-900 placeholder-slate-400 outline-none"
                        placeholder="Repita a nova senha"
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirm((v) => !v)}
                        className="shrink-0 text-slate-400 transition-colors hover:text-slate-600"
                        tabIndex={-1}
                      >
                        {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>

                  {/* Indicador de força */}
                  {password.length > 0 && (
                    <div className="space-y-1">
                      <div className="flex gap-1">
                        {[1, 2, 3, 4].map((level) => (
                          <div
                            key={level}
                            className={`h-1 flex-1 rounded-full transition-all ${
                              password.length >= level * 3
                                ? level <= 1
                                  ? "bg-red-400"
                                  : level <= 2
                                    ? "bg-amber-400"
                                    : level <= 3
                                      ? "bg-blue-400"
                                      : "bg-emerald-400"
                                : "bg-slate-200"
                            }`}
                          />
                        ))}
                      </div>
                      <p className="text-[11px] text-slate-400">
                        {password.length < 3 ? "Muito fraca" : password.length < 6 ? "Fraca" : password.length < 9 ? "Média" : "Forte"}
                      </p>
                    </div>
                  )}

                  {error && (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 text-sm font-bold text-white shadow-[0_4px_20px_rgba(15,23,42,0.2)] transition-all hover:bg-slate-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading ? (
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                      </svg>
                    ) : (
                      "Salvar nova senha"
                    )}
                  </button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>

          <p className="mt-10 text-center text-xs text-slate-400">
            &copy; {new Date().getFullYear()} BoxSys &middot; Sistema de Gestão para Lojas
          </p>
        </motion.div>
      </div>
    </div>
  );
}
