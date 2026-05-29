import { Link, useParams } from "react-router-dom";
import { motion } from "motion/react";
import {
  MapPin, Phone, Instagram, Facebook, ArrowRight, Package,
  Shield, Truck, Clock, Award, MessageCircle, CheckCircle2,
  Cpu, Zap,
} from "lucide-react";
import { useStore } from "../../StoreLayout";
import StoreSEO from "../../../../components/store/StoreSEO";
import { buildStorePath, resolveStoreSlug } from "../../store-routing";

const gridOverlay = {
  backgroundImage: "linear-gradient(rgba(14,165,233,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(14,165,233,0.06) 1px, transparent 1px)",
  backgroundSize: "48px 48px",
};

export default function StoreAbout() {
  const { slug: routeSlug } = useParams();
  const { tenant, products, style } = useStore();
  const slug = resolveStoreSlug(routeSlug);

  const activeProducts = products.filter(p => p.is_active);
  const featuredProducts = products.filter(p => p.is_featured);
  const onSaleProducts = products.filter(p => p.discount_price);

  return (
    <div className="min-h-screen bg-[#f4f6fb]">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-12 space-y-14">
        <StoreSEO
          title={`Sobre — ${tenant.name}`}
          description={tenant.about_text || `Conheça a ${tenant.name}: quem somos, onde estamos e como comprar. Atendimento via WhatsApp.`}
          url={typeof window !== "undefined" ? window.location.href : ""}
          siteName={tenant.name}
          image={tenant.banner_url || tenant.logo_url}
          keywords={`${tenant.name}, sobre, quem somos, contato, ${tenant.address || "loja online"}`}
          jsonLd={{
            "@context": "https://schema.org",
            "@type": "AboutPage",
            "name": `Sobre — ${tenant.name}`,
            "description": tenant.about_text || `Sobre a loja ${tenant.name}`,
            "url": typeof window !== "undefined" ? window.location.href : "",
            "mainEntity": {
              "@type": "Store",
              "name": tenant.name,
              "telephone": tenant.whatsapp ? `+${tenant.whatsapp.replace(/\D/g, "")}` : undefined,
              "address": tenant.address ? { "@type": "PostalAddress", "streetAddress": tenant.address } : undefined,
            },
          }}
        />

        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          <Link to={buildStorePath(slug)} className="hover:text-sky-500 transition-colors">Início</Link>
          <span>/</span>
          <span style={{ color: style.accent }}>Sobre</span>
        </nav>

        {/* ── Hero panel ── */}
        <div className="grid md:grid-cols-2 gap-10 items-center">
          <motion.div initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6 }}>
            <div className="inline-flex items-center gap-2.5 rounded-full border px-4 py-2 mb-6"
              style={{ borderColor: style.accent + "40", backgroundColor: style.accent + "10" }}>
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: style.accent }} />
              <span className="text-[10px] font-black uppercase tracking-[0.28em]" style={{ color: style.accent }}>Quem somos</span>
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-slate-900 leading-none tracking-tight mb-2">
              {tenant.name}
            </h1>
            <div className="h-1.5 w-16 rounded-full mb-5" style={{ backgroundColor: style.accent }} />

            <p className="text-slate-500 leading-relaxed text-sm md:text-base">
              {tenant.about_text || "Nossa loja oferece os melhores produtos de tecnologia com qualidade verificada e preços competitivos. Priorizamos a satisfação de cada cliente com atendimento ágil via WhatsApp e experiência de compra segura e transparente."}
            </p>

            <div className="flex flex-wrap gap-3 mt-8">
              <Link
                to={buildStorePath(slug, "/catalogo")}
                style={{ backgroundColor: style.accent, boxShadow: `0 4px 16px ${style.accent}40` }}
                className="flex items-center gap-2 px-6 h-11 rounded-xl text-white text-[11px] font-black uppercase tracking-widest transition-all hover:opacity-90 active:scale-95"
              >
                Ver produtos <ArrowRight size={13} />
              </Link>
              {tenant.whatsapp && (
                <a
                  href={`https://wa.me/${tenant.whatsapp.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-6 h-11 rounded-xl border border-slate-200 bg-white text-slate-600 text-[11px] font-black uppercase tracking-widest hover:border-sky-300 hover:text-sky-600 transition-all shadow-sm"
                >
                  <MessageCircle size={14} /> Falar conosco
                </a>
              )}
            </div>
          </motion.div>

          {/* Hero image / placeholder */}
          <motion.div
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="relative aspect-square bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm"
          >
            <div className="absolute inset-0 pointer-events-none" style={gridOverlay} />

            {tenant.banner_url ? (
              <img src={tenant.banner_url} className="w-full h-full object-cover" alt="Sobre" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="font-black text-[120px] uppercase tracking-tighter select-none leading-none" style={{ color: style.accent + "08" }}>
                  {tenant.name.charAt(0)}
                </span>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Cpu size={80} className="text-slate-200" strokeWidth={1} />
                </div>
              </div>
            )}

            {/* Sky blue top accent bar */}
            <div className="absolute top-0 inset-x-0 h-1" style={{ backgroundColor: style.accent }} />

            {/* Bottom info strip */}
            <div className="absolute bottom-0 inset-x-0 bg-white/90 backdrop-blur-sm border-t border-slate-100 px-6 py-4 flex items-center justify-between">
              <div>
                <p className="text-slate-900 font-black text-base tracking-tight">{tenant.name}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Loja ativa</span>
                </div>
              </div>
              <div
                className="px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-wide"
                style={{ borderColor: style.accent + "40", backgroundColor: style.accent + "12", color: style.accent }}
              >
                Online 24/7
              </div>
            </div>
          </motion.div>
        </div>

        {/* ── Stats grid ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { value: activeProducts.length, label: "Produtos ativos", icon: <Package size={20} /> },
            { value: featuredProducts.length, label: "Destaques", icon: <Zap size={20} /> },
            { value: onSaleProducts.length, label: "Em promoção", icon: <Award size={20} /> },
            { value: "100%", label: "Atendimento WA", icon: <MessageCircle size={20} /> },
          ].map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="relative overflow-hidden p-5 text-center border border-slate-200 bg-white rounded-2xl shadow-sm hover:border-sky-200 hover:shadow-md transition-all"
            >
              {/* Top accent */}
              <div className="absolute top-0 inset-x-0 h-0.5 rounded-t-2xl" style={{ backgroundColor: style.accent + "60" }} />
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-3"
                style={{ backgroundColor: style.accent + "15", color: style.accent }}
              >
                {s.icon}
              </div>
              <p className="text-3xl font-black font-mono" style={{ color: style.accent }}>{s.value}</p>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{s.label}</p>
            </motion.div>
          ))}
        </div>

        {/* ── Contact & Benefits ── */}
        <div className="grid md:grid-cols-2 gap-8">

          {/* Contact card */}
          <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 space-y-5 shadow-sm">
            <div className="absolute inset-0 pointer-events-none" style={gridOverlay} />
            <div className="absolute top-0 inset-x-0 h-1 rounded-t-2xl" style={{ backgroundColor: style.accent }} />
            <div className="relative z-10 space-y-5">
              <p className="text-[10px] font-black uppercase tracking-widest pt-1" style={{ color: style.accent }}>
                Contato & Localização
              </p>

              {tenant.whatsapp && (
                <a
                  href={`https://wa.me/${tenant.whatsapp.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-4 group"
                >
                  <div className="w-11 h-11 bg-[#25D366] rounded-xl flex items-center justify-center shrink-0 shadow-sm">
                    <Phone size={18} className="text-white" />
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">WhatsApp</p>
                    <p className="text-sm font-black text-slate-900 font-mono group-hover:text-emerald-600 transition-colors">
                      +{tenant.whatsapp}
                    </p>
                  </div>
                </a>
              )}

              {tenant.address && (
                <div className="flex items-start gap-4">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border border-slate-200 bg-slate-50">
                    <MapPin size={18} className="text-slate-400" />
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Endereço</p>
                    <p className="text-sm font-medium text-slate-700 leading-snug">{tenant.address}</p>
                  </div>
                </div>
              )}

              {(tenant.instagram_url || tenant.facebook_url) && (
                <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
                  {tenant.instagram_url && (
                    <a
                      href={`https://instagram.com/${tenant.instagram_url.replace("@", "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center text-white hover:scale-105 transition-transform shadow-sm"
                    >
                      <Instagram size={16} />
                    </a>
                  )}
                  {tenant.facebook_url && (
                    <a
                      href={`https://facebook.com/${tenant.facebook_url}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white hover:scale-105 transition-transform shadow-sm"
                    >
                      <Facebook size={16} />
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Benefits card */}
          <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 flex flex-col shadow-sm">
            <div className="absolute inset-0 pointer-events-none" style={gridOverlay} />
            <div className="absolute top-0 inset-x-0 h-1 rounded-t-2xl" style={{ backgroundColor: style.accent }} />
            <div className="relative z-10 flex flex-col flex-1">
              <p className="text-[10px] font-black uppercase tracking-widest mb-5 pt-1" style={{ color: style.accent }}>
                Por que comprar conosco?
              </p>
              <div className="space-y-4 flex-1">
                {[
                  { icon: <Shield size={15} />, text: "Produtos com qualidade verificada" },
                  { icon: <MessageCircle size={15} />, text: "Atendimento rápido via WhatsApp" },
                  { icon: <CheckCircle2 size={15} />, text: "Pedido confirmado antes do pagamento" },
                  { icon: <Truck size={15} />, text: "Envio ágil para todo o Brasil" },
                  { icon: <Clock size={15} />, text: "Trocas e devoluções em até 7 dias" },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                      style={{ backgroundColor: style.accent + "15", color: style.accent }}
                    >
                      {item.icon}
                    </div>
                    <p className="text-sm font-medium text-slate-600">{item.text}</p>
                  </div>
                ))}
              </div>
              <div className="mt-6 pt-5 border-t border-slate-100">
                <Link
                  to={buildStorePath(slug, "/catalogo")}
                  style={{ backgroundColor: style.accent }}
                  className="w-full h-11 flex items-center justify-center gap-2 text-white text-[11px] font-black uppercase tracking-widest rounded-xl transition-all hover:opacity-90 active:scale-[0.98] shadow-sm"
                >
                  <Package size={14} /> Explorar catálogo
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* ── Feature strip ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: <Shield size={22} />, title: "Compra 100% Segura", desc: "Seus dados protegidos" },
            { icon: <Truck size={22} />, title: "Entrega em Todo Brasil", desc: "Enviamos para você" },
            { icon: <Clock size={22} />, title: "Suporte Ágil", desc: "Respondemos rápido" },
            { icon: <Award size={22} />, title: "Qualidade Garantida", desc: "Produtos certificados" },
          ].map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.07 }}
              className="flex flex-col items-center gap-3 p-5 text-center rounded-2xl border border-slate-200 bg-white group hover:border-sky-300 hover:shadow-md transition-all shadow-sm"
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center transition-all"
                style={{ backgroundColor: style.accent + "15", color: style.accent }}
              >
                {item.icon}
              </div>
              <div>
                <p className="text-sm font-black text-slate-800 leading-tight">{item.title}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{item.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
