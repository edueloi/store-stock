import { Link, useParams } from "react-router-dom";
import { motion } from "motion/react";
import { MapPin, Phone, Instagram, Facebook, ArrowRight, Package, Check } from "lucide-react";
import { useStore } from "../../StoreLayout";
import StoreSEO from "../../../../components/store/StoreSEO";
import { buildStorePath, resolveStoreSlug } from "../../store-routing";

export default function StoreAbout() {
  const { slug: routeSlug } = useParams();
  const { tenant, products, style } = useStore();
  const slug = resolveStoreSlug(routeSlug);

  return (
    <div className="min-h-screen bg-white">
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

      <div className="max-w-7xl mx-auto px-4 md:px-6 py-12 space-y-20">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-[10px] font-bold uppercase text-slate-400 tracking-[0.12em]">
          <Link to={buildStorePath(slug)} className="hover:text-[#2563eb] transition-colors">Início</Link>
          <span>/</span>
          <span className="text-[#0f172a]">Sobre</span>
        </nav>

        {/* ── HERO ─────────────────────────────────────────────── */}
        <div className="grid md:grid-cols-2 gap-14 items-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-4">
              Quem somos
            </p>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight leading-tight text-[#0f172a] mb-4">
              {tenant.name}
            </h1>
            {/* Accent line */}
            <div className="h-0.5 w-14 rounded-full mb-6" style={{ backgroundColor: style.accent }} />
            <p className="text-slate-500 leading-relaxed text-sm font-medium max-w-md">
              {tenant.about_text || "Nossa loja oferece produtos selecionados com qualidade e dedicação. Priorizamos a satisfação de cada cliente, garantindo uma experiência de compra ágil e prazerosa."}
            </p>
            <div className="flex flex-wrap gap-3 mt-8">
              <Link
                to={buildStorePath(slug, "/catalogo")}
                style={{ backgroundColor: style.accent }}
                className="flex items-center gap-2 px-6 h-12 rounded-2xl text-white text-xs font-bold uppercase tracking-widest shadow-sm hover:shadow-md hover:opacity-90 transition-all"
              >
                Ver produtos <ArrowRight size={13} />
              </Link>
              {tenant.whatsapp && (
                <a
                  href={`https://wa.me/${tenant.whatsapp.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-6 h-12 rounded-2xl border border-slate-200 bg-white text-[#0f172a] text-xs font-bold uppercase tracking-widest hover:bg-slate-50 hover:border-slate-300 transition-all"
                >
                  Falar conosco
                </a>
              )}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.55, delay: 0.1 }}
            className="relative"
          >
            <div className="aspect-square relative overflow-hidden rounded-2xl border border-slate-100">
              {tenant.banner_url ? (
                <img src={tenant.banner_url} className="w-full h-full object-cover" alt="Sobre" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-slate-50 relative">
                  <span className="text-slate-200/60 font-black text-[120px] uppercase tracking-tighter select-none">
                    {tenant.name.charAt(0)}
                  </span>
                </div>
              )}
              {tenant.banner_url && (
                <div className="absolute inset-0 bg-gradient-to-t from-[#0f172a]/40 to-transparent" />
              )}
              <div className="absolute bottom-6 left-6">
                <p className="text-white font-black text-2xl drop-shadow">{tenant.name}</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="w-2 h-2 bg-emerald-400 rounded-full" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-white/70">Loja ativa</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* ── STATS ────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { value: products.filter(p => p.is_active).length, label: "Produtos ativos" },
            { value: products.filter(p => p.is_featured).length, label: "Destaques" },
            { value: products.filter(p => p.discount_price).length, label: "Em promoção" },
            { value: "100%", label: "Atendimento via WA" },
          ].map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              whileHover={{ y: -2 }}
              className="p-6 border text-center rounded-2xl bg-white border-slate-100 hover:border-slate-200 hover:shadow-sm transition-all"
            >
              <p className="text-3xl font-black" style={{ color: style.accent }}>{s.value}</p>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.12em] mt-2">{s.label}</p>
            </motion.div>
          ))}
        </div>

        {/* ── CONTACT & BENEFITS ───────────────────────────────── */}
        <div className="grid md:grid-cols-2 gap-6">

          {/* Contact card */}
          <motion.div
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="rounded-2xl border border-slate-100 overflow-hidden bg-white"
          >
            {/* Blue top bar */}
            <div className="h-0.5 w-full" style={{ backgroundColor: style.accent }} />
            <div className="p-6 space-y-5">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.15em]">
                Contato & Localização
              </p>

              {tenant.whatsapp && (
                <a
                  href={`https://wa.me/${tenant.whatsapp.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-4 group"
                >
                  <div className="w-11 h-11 bg-[#25D366] rounded-2xl flex items-center justify-center shrink-0 shadow-sm">
                    <Phone size={18} className="text-white" />
                  </div>
                  <div>
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-[0.12em]">WhatsApp</p>
                    <p className="text-sm font-bold text-[#0f172a] font-mono group-hover:text-[#25D366] transition-colors">
                      +{tenant.whatsapp}
                    </p>
                  </div>
                </a>
              )}

              {tenant.address && (
                <div className="flex items-start gap-4">
                  <div
                    className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: style.accent + "14" }}
                  >
                    <MapPin size={18} style={{ color: style.accent }} />
                  </div>
                  <div>
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-[0.12em]">Endereço</p>
                    <p className="text-sm font-medium text-[#0f172a] leading-snug">{tenant.address}</p>
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
          </motion.div>

          {/* Benefits card */}
          <motion.div
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.08 }}
            className="rounded-2xl border border-slate-100 overflow-hidden bg-white flex flex-col"
          >
            <div className="h-0.5 w-full bg-slate-200" />
            <div className="p-6 space-y-4 flex flex-col flex-1">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.15em]">
                Por que comprar conosco?
              </p>
              {[
                "Produtos com qualidade verificada",
                "Atendimento rápido via WhatsApp",
                "Pedido confirmado antes do pagamento",
                "Trocas e devoluções em até 7 dias",
              ].map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 + i * 0.07 }}
                  className="flex items-center gap-3"
                >
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                    style={{ backgroundColor: style.accent + "14" }}
                  >
                    <Check size={12} style={{ color: style.accent }} strokeWidth={3} />
                  </div>
                  <p className="text-sm font-medium text-slate-600">{item}</p>
                </motion.div>
              ))}
              <div className="mt-auto pt-4">
                <Link
                  to={buildStorePath(slug, "/catalogo")}
                  style={{ backgroundColor: style.accent }}
                  className="w-full h-11 flex items-center justify-center gap-2 text-white text-[11px] font-bold uppercase tracking-widest rounded-xl transition-all hover:shadow-md hover:opacity-90"
                >
                  <Package size={14} /> Explorar catálogo
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
