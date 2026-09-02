import { type FormEvent, useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { AlertCircle, Eye, EyeOff, Lock, LogIn, User, X } from "lucide-react";

import { getStoredUser, saveSession } from "../../lib/session";
import LoginLoading from "./LoginLoading";

export default function Login() {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState(() => localStorage.getItem("remembered_identifier") || "");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(() => !!localStorage.getItem("remembered_identifier"));
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showLoader, setShowLoader] = useState(false);
  const [redirectTo, setRedirectTo] = useState("");
  const [toast, setToast] = useState("");

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 4000);
  };

  useEffect(() => {
    const user = getStoredUser();
    if (user?.role === "super_admin") {
      navigate("/super-admin", { replace: true });
      return;
    }
    if (user?.role) {
      navigate("/admin", { replace: true });
    }
  }, [navigate]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setToast("");

    const trimmedIdentifier = identifier.trim();

    try {
      // Tenta sempre o login normal primeiro (aceita e-mail OU nick) — só cai pro
      // super admin se esse usuário realmente não existir e o identificador não
      // parecer um e-mail (evita quebrar login por nick, que nunca tem "@").
      let response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: trimmedIdentifier, password }),
      });
      let data = await response.json();

      if (!response.ok && !trimmedIdentifier.includes("@")) {
        response = await fetch("/api/auth/super-admin/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identifier: trimmedIdentifier, password }),
        });
        data = await response.json();
      }

      if (!response.ok) {
        showToast(data.error || "Não foi possível entrar.");
        return;
      }

      if (rememberMe) {
        localStorage.setItem("remembered_identifier", trimmedIdentifier);
      } else {
        localStorage.removeItem("remembered_identifier");
      }
      // Nunca guardamos a senha em localStorage (texto puro, legível por qualquer
      // script/extensão) — só o identificador, pra poupar de digitar o e-mail/nick de
      // novo. A senha em si fica a cargo do gerenciador de senhas do navegador.
      localStorage.removeItem("remembered_password");
      saveSession(data.token, {
        ...data.user,
        fluxo_producao_enabled: !!data.tenant?.fluxo_producao_enabled,
        grafica_enabled: !!data.tenant?.grafica_enabled,
        plan_features: Array.isArray(data.tenant?.plan_features) ? data.tenant.plan_features : null,
      });
      setRedirectTo(data.user?.role === "super_admin" ? "/super-admin" : "/admin");
      setShowLoader(true);
    } catch {
      showToast("Erro ao conectar com o servidor.");
    } finally {
      setLoading(false);
    }
  };

  const handleLoadingDone = useCallback(() => {
    navigate(redirectTo);
  }, [navigate, redirectTo]);

  return (
    <>
      <AnimatePresence>
        {showLoader && <LoginLoading onDone={handleLoadingDone} />}
      </AnimatePresence>

      {/* Toast de erro */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.25 }}
            className="fixed left-1/2 top-5 z-50 flex -translate-x-1/2 items-center gap-3 rounded-2xl border border-red-200 bg-white px-5 py-3.5 shadow-[0_8px_32px_rgba(0,0,0,0.12)] min-w-[280px] max-w-sm"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-red-100">
              <AlertCircle size={16} className="text-red-500" />
            </span>
            <p className="flex-1 text-sm font-medium text-slate-800">{toast}</p>
            <button
              type="button"
              onClick={() => setToast("")}
              className="shrink-0 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    <div className="flex min-h-screen bg-white">
      {/* ── Painel esquerdo (branding) ── */}
      <aside className="relative hidden w-[44%] min-w-[420px] flex-col justify-between overflow-hidden bg-[#081226] p-10 lg:flex xl:p-14">
        {/* Gradientes + textura de fundo */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(37,99,235,0.28),transparent_38%)]" />
          <div className="absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-blue-600/10 blur-[100px]" />
          <div
            className="absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage: "radial-gradient(rgba(255,255,255,0.6) 1px, transparent 1px)",
              backgroundSize: "32px 32px",
            }}
          />
        </div>

        {/* Logo */}
        <div className="relative">
          <img
            src="/system/logo-boxsys-vazado.png"
            alt="BoxSys"
            className="h-11 w-auto object-contain"
          />
        </div>

        {/* Headline central */}
        <div className="relative max-w-md">
          <span className="mb-6 block h-1 w-10 rounded-full bg-amber-400" />
          <h1 className="text-4xl font-bold leading-[1.12] tracking-[-0.035em] text-white xl:text-5xl">
            Gestão simples.<br />
            <span className="text-blue-300">Negócio organizado.</span>
          </h1>
          <p className="mt-5 max-w-sm text-base leading-7 text-slate-400">
            Estoque, vendas e catálogo reunidos em um só lugar.
          </p>
        </div>

        {/* Footer esquerdo */}
        <p className="relative text-xs text-slate-500">
          &copy; {new Date().getFullYear()} BoxSys
        </p>
      </aside>

      {/* ── Painel direito (formulário) ── */}
      <main className="relative flex flex-1 flex-col items-center justify-center bg-white px-6 py-10 sm:px-10">
        {/* Logo mobile */}
        <div className="mb-12 lg:hidden">
          <img
            src="/system/logo-boxsys-vazado.png"
            alt="BoxSys"
            className="h-11 w-auto object-contain"
          />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="w-full max-w-[400px]"
        >
          {/* Header */}
          <div className="mb-9">
            <h2 className="text-3xl font-bold tracking-[-0.03em] text-slate-950 sm:text-4xl">
              Acesse sua conta
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Informe seus dados para continuar.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Identifier */}
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-slate-700">
                E-mail ou usuário
              </label>
              <div className="flex h-[52px] items-center gap-3 rounded-xl border border-slate-300 bg-white px-4 transition-all focus-within:border-blue-500 focus-within:shadow-[0_0_0_3px_rgba(59,130,246,0.12)]">
                <User size={18} className="shrink-0 text-slate-400" />
                <input
                  type="text"
                  autoComplete="username"
                  className="h-full w-full bg-transparent text-[15px] text-slate-900 placeholder-slate-400 outline-none"
                  placeholder="seu@email.com ou usuário"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-semibold text-slate-700">
                  Senha
                </label>
                <Link
                  to="/forgot-password"
                  className="text-sm font-medium text-blue-600 transition-colors hover:text-blue-700"
                >
                  Esqueci a senha
                </Link>
              </div>
              <div className="flex h-[52px] items-center gap-3 rounded-xl border border-slate-300 bg-white px-4 transition-all focus-within:border-blue-500 focus-within:shadow-[0_0_0_3px_rgba(59,130,246,0.12)]">
                <Lock size={18} className="shrink-0 text-slate-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  className="h-full w-full bg-transparent text-[15px] text-slate-900 placeholder-slate-400 outline-none"
                  placeholder="••••••••"
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

            {/* Lembrar-me */}
            <label className="flex cursor-pointer items-center gap-3">
              <div className="relative">
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <div className="h-5 w-5 rounded-md border-2 border-slate-300 bg-white transition-all peer-checked:border-blue-500 peer-checked:bg-blue-500" />
                <svg
                  className="pointer-events-none absolute inset-0 m-auto h-3 w-3 text-white opacity-0 transition-opacity peer-checked:opacity-100"
                  viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                >
                  <polyline points="1.5 6 4.5 9 10.5 3" />
                </svg>
              </div>
              <span className="text-sm font-medium text-slate-600 select-none">Lembrar-me</span>
            </label>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="flex h-[52px] w-full items-center justify-center gap-2.5 rounded-xl bg-blue-600 text-sm font-bold text-white shadow-[0_8px_20px_rgba(37,99,235,0.22)] transition-all hover:bg-blue-700 hover:shadow-[0_10px_24px_rgba(37,99,235,0.28)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                  Entrando...
                </span>
              ) : (
                <>
                  Entrar
                  <LogIn size={15} />
                </>
              )}
            </button>
          </form>
        </motion.div>

        {/* Footer */}
        <p className="absolute bottom-6 text-center text-xs text-slate-400 lg:hidden">
          &copy; {new Date().getFullYear()} BoxSys
        </p>
      </main>
    </div>
    </>
  );
}
