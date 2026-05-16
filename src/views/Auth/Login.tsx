import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { Package, Lock, Mail, Store } from "lucide-react";

export default function Login() {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  // Registration specific fields
  const [tenantName, setTenantName] = useState("");
  const [slug, setSlug] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [userName, setUserName] = useState("");

  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const endpoint = isRegister ? "/api/auth/register-tenant" : "/api/auth/login";
    const body = isRegister 
      ? { tenantName, slug, whatsapp, userName, email, password }
      : { email, password };

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await res.json();

      if (res.ok) {
        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));
        navigate("/admin");
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError("Erro ao conectar com o servidor.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-6 font-sans">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-sm bg-white rounded-xl shadow-2xl p-8 border border-slate-200 relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-blue-600"></div>
        
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-blue-600 text-white rounded flex items-center justify-center mx-auto mb-4 font-bold text-xl shadow-lg shadow-blue-100">
            N
          </div>
          <h1 className="text-lg font-bold text-slate-900 uppercase tracking-widest">Nexus ERP</h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
            {isRegister ? "Onboarding de Novo Tenant" : "Autenticação de Operador"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
               <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Nome Fantasia da Loja</label>
                  <div className="relative">
                    <Store className="absolute left-3 top-2.5 text-slate-300" size={14} />
                    <input
                      type="text"
                      className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold uppercase focus:ring-2 focus:ring-blue-500/10 outline-none"
                      value={tenantName}
                      onChange={(e) => {
                        setTenantName(e.target.value);
                        setSlug(e.target.value.toLowerCase().replace(/ /g, '-'));
                      }}
                      required
                    />
                  </div>
               </div>
               <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Identificador Slug (Fixo)</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 bg-slate-100 text-[10px] font-mono font-bold text-slate-400 rounded-lg border border-slate-200"
                    value={slug}
                    readOnly
                  />
               </div>
               <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">WhatsApp de Contato</label>
                  <input
                    type="text"
                    placeholder="Ex: 5511999999999"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold focus:ring-2 focus:ring-blue-500/10 outline-none"
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    required
                  />
               </div>
               <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Nome do Proprietário</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold uppercase focus:ring-2 focus:ring-blue-500/10 outline-none"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    required
                  />
               </div>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">E-mail Corporativo</label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 text-slate-300" size={14} />
              <input
                type="email"
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold focus:ring-2 focus:ring-blue-500/10 outline-none"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Senha de Acesso</label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 text-slate-300" size={14} />
              <input
                type="password"
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold focus:ring-2 focus:ring-blue-500/10 outline-none"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          {error && (
             <div className="bg-red-50 border border-red-100 p-2 rounded flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                <p className="text-[10px] font-bold text-red-600 uppercase tracking-tighter">{error}</p>
             </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 bg-slate-900 text-white rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 active:scale-95 disabled:opacity-50"
          >
            {loading ? "Processando Requisição..." : (isRegister ? "Confirmar Novo Registro" : "Iniciar Sessão Segura")}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-100 text-center">
          <button 
            onClick={() => setIsRegister(!isRegister)}
            className="text-[10px] font-bold text-slate-500 uppercase tracking-widest hover:text-blue-600 transition-colors"
          >
            {isRegister ? "Já possui conta? Acessar" : "Não possui registro? Solicitar acesso"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
