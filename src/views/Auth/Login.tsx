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
    <div className="flex min-h-screen">
      {/* ── Painel esquerdo (branding) ── */}
      <div className="relative hidden w-[55%] flex-col justify-between overflow-hidden bg-[#090e1a] p-10 lg:flex xl:p-14">
        {/* Gradientes + textura de fundo */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(29,78,216,0.35),transparent)]" />
          <div className="absolute bottom-0 left-0 h-80 w-80 rounded-full bg-blue-700/10 blur-[100px]" />
          <div className="absolute right-0 top-1/2 h-64 w-64 -translate-y-1/2 rounded-full bg-sky-500/8 blur-[80px]" />
          <div
            className="absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage: "radial-gradient(rgba(255,255,255,0.6) 1px, transparent 1px)",
              backgroundSize: "28px 28px",
            }}
          />
        </div>

        {/* Logo */}
        <div className="relative">
          <img
            src="/system/logo-boxsys-vazado.png"
            alt="BoxSys"
            className="h-12 w-auto object-contain"
          />
        </div>

        {/* Headline central */}
        <div className="relative space-y-7">
          <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-300">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
            Painel Administrativo
          </p>

          <h1 className="text-5xl font-black leading-[1.08] tracking-[-0.03em] text-white xl:text-6xl">
            Seu negócio<br />
            <span className="text-amber-400">na palma</span><br />
            <span className="text-slate-400">da mão</span>
          </h1>

          <p className="max-w-xs text-sm leading-relaxed text-slate-400">
            Catálogo digital, gestão de estoque, vendas e relatórios — tudo integrado em um só lugar.
          </p>

          {/* Checklist de destaques */}
          <ul className="space-y-2.5 pt-1">
            {[
              "Catálogo digital sempre atualizado",
              "Controle de estoque em tempo real",
              "PDV, vendas e relatórios integrados",
            ].map((feat) => (
              <li key={feat} className="flex items-center gap-2.5 text-sm text-slate-300">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-400/15 text-emerald-400">
                  <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="1.5 6 4.5 9 10.5 3" />
                  </svg>
                </span>
                {feat}
              </li>
            ))}
          </ul>

          {/* Stats */}
          <div className="flex divide-x divide-white/10 rounded-2xl border border-white/10 bg-white/[0.03] py-4">
            {[
              { value: "100%", label: "Online" },
              { value: "24/7", label: "Suporte" },
              { value: "∞", label: "Produtos" },
            ].map((s) => (
              <div key={s.label} className="flex-1 px-2 text-center">
                <p className="text-xl font-black text-amber-400">{s.value}</p>
                <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer esquerdo */}
        <p className="relative text-xs text-slate-600">
          &copy; {new Date().getFullYear()} BoxSys &middot; Sistema de Gestão para Lojas
        </p>
      </div>

      {/* ── Painel direito (formulário) ── */}
      <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto bg-slate-50 px-6 py-10 sm:px-10 lg:bg-[radial-gradient(ellipse_120%_80%_at_50%_0%,rgba(59,130,246,0.06),transparent)]">
        {/* Logo mobile */}
        <div className="mb-8 lg:hidden">
          <img
            src="/system/logo-boxsys-vazado.png"
            alt="BoxSys"
            className="h-10 w-auto object-contain"
          />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-7 shadow-[0_8px_40px_rgba(15,23,42,0.08)] sm:p-9"
        >
          {/* Header */}
          <div className="mb-8">
            <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.22em] text-amber-500">
              Bem-vindo de volta
            </p>
            <h2 className="text-3xl font-black tracking-[-0.03em] text-slate-900">
              Faça seu login
            </h2>
            <p className="mt-1.5 text-sm text-slate-500">
              Entre com suas credenciais para acessar o painel.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Identifier */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                E-mail ou Nick
              </label>
              <div className="flex h-12 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 transition-all focus-within:border-blue-500 focus-within:bg-white focus-within:shadow-[0_0_0_3px_rgba(59,130,246,0.12)]">
                <User size={15} className="shrink-0 text-slate-400" />
                <input
                  type="text"
                  autoComplete="username"
                  className="h-full w-full bg-transparent text-sm text-slate-900 placeholder-slate-400 outline-none"
                  placeholder="seu@email.com.br ou seu nick"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                  Senha
                </label>
                <Link
                  to="/forgot-password"
                  className="text-[11px] font-semibold text-blue-500 hover:text-blue-700 transition-colors"
                >
                  Esqueci a senha
                </Link>
              </div>
              <div className="flex h-12 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 transition-all focus-within:border-blue-500 focus-within:bg-white focus-within:shadow-[0_0_0_3px_rgba(59,130,246,0.12)]">
                <Lock size={15} className="shrink-0 text-slate-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  className="h-full w-full bg-transparent text-sm text-slate-900 placeholder-slate-400 outline-none"
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
              className="flex h-12 w-full items-center justify-center gap-2.5 rounded-xl bg-slate-900 text-sm font-bold text-white shadow-[0_4px_20px_rgba(15,23,42,0.2)] transition-all hover:bg-slate-800 hover:shadow-[0_4px_28px_rgba(15,23,42,0.3)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
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
                  Entrar no Painel
                  <LogIn size={15} />
                </>
              )}
            </button>
          </form>
        </motion.div>

        {/* Footer */}
        <p className="mt-8 text-center text-xs text-slate-400">
          &copy; {new Date().getFullYear()} BoxSys &middot; Sistema de Gestão para Lojas
        </p>
      </div>
    </div>
    </>
  );
}
