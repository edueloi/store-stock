import React, { useState, useEffect } from "react";
import { Settings as SettingsIcon, Users, Store, Shield, Bell, Save, Palette, Loader2, Search, Check } from "lucide-react";
import { motion } from "motion/react";
import { cn } from "../../lib/utils";
import { Tenant } from "../../types";

export default function Settings() {
  const [activeTab, setActiveTab] = useState("profile");
  const [tenant, setTenant] = useState<Partial<Tenant> | null>(null);
  const [loading, setLoading] = useState(true);
  const [cepLoading, setCepLoading] = useState(false);

  useEffect(() => {
    fetch("/api/tenant", {
      headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
    })
    .then(res => res.json())
    .then(data => {
      setTenant(data);
      setLoading(false);
    });
  }, []);

  const handleLookupCEP = async () => {
    const cep = tenant?.address?.match(/\d{5}-?\d{3}/)?.[0];
    if (!cep) return;
    
    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep.replace('-', '')}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setTenant({
          ...tenant!,
          address: `${data.logradouro}, ${data.bairro}, ${data.localidade} - ${data.uf}`
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCepLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const res = await fetch("/api/tenant", {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify(tenant)
      });
      if (res.ok) alert("Configurações salvas com sucesso!");
    } catch (err) {
      console.error(err);
    }
  };

  const tabs = [
    { id: "profile", label: "Dados da Loja", icon: Store },
    { id: "theme", label: "Design & Brand", icon: Palette },
    { id: "social", label: "Canais Sociais", icon: Bell },
    { id: "users", label: "Time & Acessos", icon: Users },
    { id: "security", label: "Segurança", icon: Shield },
  ];

  if (loading) return <div className="p-8 text-center text-xs font-bold uppercase tracking-widest text-slate-400">Carregando painel...</div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 uppercase tracking-tight">Painel de Configuração Nexus</h2>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest leading-none">Arquitetura de Marca, Digital e Operacional</p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Navigation Sidebar */}
        <aside className="w-full lg:w-72 space-x-2 sm:space-x-0 sm:space-y-2 flex sm:block overflow-x-auto no-scrollbar pb-2 sm:pb-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 sm:w-full flex items-center justify-between px-5 h-14 rounded-[18px] text-[10px] font-black uppercase tracking-[0.2em] transition-all shrink-0 whitespace-nowrap active:scale-95 ${
                activeTab === tab.id 
                  ? "bg-slate-900 text-white shadow-2xl shadow-slate-300 translate-y-0" 
                  : "bg-white text-slate-400 hover:bg-slate-50 border border-slate-100 transition-colors"
              }`}
            >
              <div className="flex items-center gap-4">
                <tab.icon size={18} strokeWidth={activeTab === tab.id ? 2.5 : 2} />
                <span className={activeTab === tab.id ? "opacity-100" : "opacity-80"}>{tab.label}</span>
              </div>
              {activeTab === tab.id && <div className="hidden sm:block w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>}
            </button>
          ))}
        </aside>

        {/* Content Area */}
        <div className="flex-1">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all">
             {activeTab === "profile" && (
                <div className="p-5 sm:p-8 space-y-8">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
                      <div className="space-y-1 md:col-span-1">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">Nome da Organização</label>
                         <input 
                           type="text" 
                           className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 h-12 text-xs font-black uppercase outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all font-sans" 
                           value={tenant?.name || ""}
                           onChange={(e) => setTenant({...tenant, name: e.target.value})}
                         />
                      </div>
                      <div className="space-y-1">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">WhatsApp de Vendas</label>
                         <input 
                           type="text" 
                           className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 h-12 text-xs font-black uppercase outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all font-mono" 
                           value={tenant?.whatsapp || ""}
                           onChange={(e) => setTenant({...tenant, whatsapp: e.target.value})}
                           placeholder="5511999999999"
                         />
                      </div>
                      <div className="space-y-1">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">Identificador Público</label>
                         <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden focus-within:ring-4 focus-within:ring-blue-500/5 focus-within:border-blue-500 transition-all">
                            <span className="bg-slate-100 border-r border-slate-200 px-4 h-12 flex items-center text-[10px] font-mono text-slate-400 shrink-0">/s/</span>
                            <input 
                              type="text" 
                              className="w-full bg-slate-50 border-none px-4 h-12 text-xs font-black uppercase outline-none" 
                              value={tenant?.slug || ""}
                              onChange={(e) => setTenant({...tenant, slug: e.target.value})}
                            />
                         </div>
                      </div>
                      <div className="space-y-1 md:col-span-2">
                         <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 px-1 mb-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Endereço / Sede Administrativa</label>
                            <div className="flex items-center gap-3 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100">
                               <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Publicar no Site?</span>
                               <button 
                                 onClick={() => setTenant({...tenant!, show_address: !tenant?.show_address})}
                                 className={cn(
                                   "w-10 h-5 rounded-full transition-all relative shadow-inner",
                                   tenant?.show_address ? "bg-emerald-500" : "bg-slate-200"
                                 )}
                               >
                                  <div className={cn(
                                    "absolute top-1 w-3 h-3 bg-white rounded-full transition-all shadow-sm",
                                    tenant?.show_address ? "left-6" : "left-1"
                                  )} />
                               </button>
                            </div>
                         </div>
                         <div className="flex flex-col sm:flex-row gap-2">
                            <input 
                              type="text" 
                              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 h-12 text-xs font-bold uppercase outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all" 
                              value={tenant?.address || ""}
                              onChange={(e) => setTenant({...tenant!, address: e.target.value})}
                              placeholder="CEP OU RUA, NÚMERO..."
                            />
                            <button 
                               onClick={handleLookupCEP}
                               disabled={cepLoading}
                               className="h-12 px-6 bg-slate-900 text-white rounded-xl text-[9px] font-black uppercase tracking-[0.2em] hover:bg-slate-800 transition-all flex items-center justify-center gap-3 disabled:opacity-50 shrink-0 shadow-lg"
                            >
                               {cepLoading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} strokeWidth={3} />}
                               Buscar CEP
                            </button>
                         </div>
                      </div>
                      <div className="space-y-1 md:col-span-2">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">Manifesto da Marca (About)</label>
                         <textarea 
                           className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-xs font-medium outline-none h-40 resize-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all font-sans"
                           value={tenant?.about_text || ""}
                           onChange={(e) => setTenant({...tenant, about_text: e.target.value})}
                           placeholder="Descreva a essência do seu negócio..."
                         />
                      </div>
                   </div>

                   <div className="pt-6 border-t border-slate-100 flex justify-end">
                      <button 
                        onClick={handleSave}
                        className="w-full sm:w-auto bg-blue-600 text-white px-10 h-14 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-2xl shadow-blue-500/30 flex items-center justify-center gap-3 hover:bg-blue-700 transition-all active:scale-95"
                      >
                         <Save size={18} strokeWidth={2.5} /> Guardar Alterações
                      </button>
                   </div>
                </div>
             )}

             {activeTab === "theme" && (
                <div className="p-8 space-y-10">
                   <div className="space-y-4">
                      <h3 className="text-xs font-bold uppercase tracking-widest text-slate-900 border-l-4 border-blue-600 pl-3">Presets de Arquitetura (Templates)</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                         {[
                           { id: 'minimal', name: 'Minimalist White', desc: 'Foco total no produto' },
                           { id: 'cyber', name: 'Cyber Dark', desc: 'Estética Tech / High-Contrast' },
                           { id: 'organic', name: 'Organic Soft', desc: 'Tons pasteis e bordas suaves' },
                           { id: 'luxury', name: 'Luxury Gold', desc: 'Aura premium e tipografia serif' }
                         ].map(temp => (
                           <button 
                             key={temp.id}
                             onClick={() => setTenant({...tenant!, template_id: temp.id})}
                             className={cn(
                               "p-4 rounded-2xl border-2 text-left transition-all group relative overflow-hidden",
                               tenant?.template_id === temp.id ? "border-blue-600 bg-blue-50/30" : "border-slate-100 bg-white hover:border-slate-200"
                             )}
                           >
                              {tenant?.template_id === temp.id && (
                                <div className="absolute top-2 right-2 text-blue-600">
                                   <Check size={16} strokeWidth={3} />
                                </div>
                              )}
                              <p className="text-[10px] font-black uppercase tracking-widest mb-1 group-hover:text-blue-600">{temp.name}</p>
                              <p className="text-[9px] text-slate-400 font-bold leading-tight uppercase tracking-tighter">{temp.desc}</p>
                           </button>
                         ))}
                      </div>
                   </div>

                   <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-1">
                         <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Assinatura de Cor (Main UI)</label>
                         <div className="flex gap-4">
                            <input 
                              type="color" 
                              className="w-12 h-12 rounded-xl cursor-pointer border-2 border-slate-100 shadow-sm"
                              value={tenant?.primary_color || "#000000"} 
                              onChange={(e) => setTenant({...tenant, primary_color: e.target.value})}
                            />
                            <input 
                              type="text" 
                              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 text-xs font-mono font-bold uppercase outline-none focus:ring-2 focus:ring-blue-500/10"
                              value={tenant?.primary_color || ""}
                              onChange={(e) => setTenant({...tenant, primary_color: e.target.value})}
                            />
                         </div>
                      </div>
                      <div className="space-y-1">
                         <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Logo URL (PNG/SVG)</label>
                         <input 
                           type="text" 
                           className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 h-11 text-xs font-medium outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all"
                           value={tenant?.logo_url || ""}
                           onChange={(e) => setTenant({...tenant, logo_url: e.target.value})}
                           placeholder="https://imgur.com/link-do-logo.png"
                         />
                      </div>
                      <div className="space-y-1 col-span-2">
                         <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Banner Principal da Vitrine (URL)</label>
                         <input 
                           type="text" 
                           className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 h-11 text-xs font-medium outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all"
                           value={tenant?.banner_url || ""}
                           onChange={(e) => setTenant({...tenant, banner_url: e.target.value})}
                           placeholder="URL de imagem para o topo da loja pública"
                         />
                      </div>
                      <div className="space-y-1 col-span-2">
                         <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Assinatura de Rodapé (Copyright)</label>
                         <input 
                           type="text" 
                           className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 h-11 text-xs font-medium outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all"
                           value={tenant?.footer_text || ""}
                           onChange={(e) => setTenant({...tenant, footer_text: e.target.value})}
                           placeholder="Ex: © 2026 Nexus Brand Store. Todos os direitos reservados."
                         />
                      </div>
                   </div>
                   <div className="pt-4 border-t border-slate-100 flex justify-end">
                      <button 
                        onClick={handleSave}
                        className="bg-blue-600 text-white px-8 h-11 rounded-xl text-[10px] font-bold uppercase tracking-widest shadow-xl shadow-blue-500/20 hover:bg-blue-700 transition-all active:scale-95"
                      >
                         <Save size={14} /> Aplicar Design
                      </button>
                   </div>
                </div>
             )}

             {activeTab === "social" && (
                <div className="p-8 space-y-8">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-1">
                         <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Instagram (@usuario)</label>
                         <input 
                           type="text" 
                           className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 h-11 text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all" 
                           value={tenant?.instagram_url || ""}
                           onChange={(e) => setTenant({...tenant, instagram_url: e.target.value})}
                         />
                      </div>
                      <div className="space-y-1">
                         <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Facebook (link ou usuario)</label>
                         <input 
                           type="text" 
                           className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 h-11 text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all" 
                           value={tenant?.facebook_url || ""}
                           onChange={(e) => setTenant({...tenant, facebook_url: e.target.value})}
                         />
                      </div>
                   </div>
                   <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">Omnichannel Flow</p>
                      <h4 className="text-xs font-bold text-slate-900 uppercase mb-2">Integração Direta via WhatsApp</h4>
                      <p className="text-[10px] text-slate-500 leading-relaxed font-medium">Os pedidos realizados na loja pública dispararão automaticamente uma notificação formatada para o número configurado em "Dados da Loja". Certifique-se de usar o formato internacional (55 + DDD + Numero).</p>
                   </div>
                   <div className="pt-4 border-t border-slate-100 flex justify-end">
                      <button 
                        onClick={handleSave}
                        className="bg-blue-600 text-white px-8 h-11 rounded-xl text-[10px] font-bold uppercase tracking-widest shadow-xl shadow-blue-500/20 hover:bg-blue-700 transition-all active:scale-95"
                      >
                         <Save size={14} /> Vincular Canais
                      </button>
                   </div>
                </div>
             )}

             {activeTab === "users" && (
                <div className="p-8 space-y-6">
                   <div className="flex justify-between items-center text-center py-12">
                      <div className="mx-auto max-w-xs space-y-4">
                        <Users size={48} strokeWidth={1} className="mx-auto text-slate-200" />
                        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 leading-relaxed px-4">
                           A gestão avançada de múltiplos usuários e permissões granulares está disponível no módulo SaaS Premium.
                        </h3>
                        <button className="bg-slate-900 text-white px-8 h-10 rounded-xl text-[10px] font-bold uppercase tracking-widest shadow-xl shadow-slate-200">Explorar Upgrades</button>
                      </div>
                   </div>
                </div>
             )}

             {activeTab === "security" && (
                <div className="p-8 space-y-8">
                   <div className="max-w-sm space-y-4">
                      <div className="space-y-1">
                         <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Nova Senha Admin</label>
                         <input 
                           type="password" 
                           placeholder="••••••••"
                           className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 h-11 text-xs outline-none focus:ring-2 focus:ring-red-500/10 focus:border-red-500 transition-all" 
                         />
                      </div>
                      <div className="space-y-1">
                         <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Confirme a Senha</label>
                         <input 
                           type="password" 
                           placeholder="••••••••"
                           className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 h-11 text-xs outline-none focus:ring-2 focus:ring-red-500/10 focus:border-red-500 transition-all" 
                         />
                      </div>
                   </div>
                   <div className="pt-4 border-t border-slate-100 flex justify-end">
                      <button className="bg-red-600 text-white px-8 h-11 rounded-xl text-[10px] font-bold uppercase tracking-widest shadow-xl shadow-red-500/20 hover:bg-red-700 transition-all active:scale-95">
                         Alterar Credenciais
                      </button>
                   </div>
                </div>
             )}
          </div>
        </div>
      </div>
    </div>
  );
}
