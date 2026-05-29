import { Link, useParams } from "react-router-dom";
import { motion } from "motion/react";
import { MapPin, Phone, Instagram, Facebook, ArrowRight, Package, Leaf, Check } from "lucide-react";
import { cn } from "../../../../lib/utils";
import { useStore } from "../../StoreLayout";
import StoreSEO from "../../../../components/store/StoreSEO";
import { buildStorePath, resolveStoreSlug } from "../../store-routing";

function DotTexture({ className }: { className?: string }) {
  return (
    <div
      className={cn("absolute inset-0 pointer-events-none", className)}
      style={{
        backgroundImage: "radial-gradient(circle, #d9770618 1px, transparent 1px)",
        backgroundSize: "24px 24px",
      }}
    />
  );
}

export default function StoreAbout() {
  const { slug: routeSlug } = useParams();
  const { tenant, products, style } = useStore();
  const slug = resolveStoreSlug(routeSlug);

  return (
    <div className="min-h-screen bg-[#fefaf6]">
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

      <div className="max-w-7xl mx-auto px-4 md:px-6 py-12 space-y-16">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-[10px] font-bold uppercase text-stone-400 tracking-wider">
          <Link to={buildStorePath(slug)} className="hover:text-amber-700 transition-colors">Início</Link>
          <span>/</span>
          <span className="text-stone-700">Sobre</span>
        </nav>

        {/* ── HERO ─────────────────────────────────────────────── */}
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
          >
            <div className="flex items-center gap-3 mb-4">
              <svg viewBox="0 0 60 60" className="w-10 h-10 text-amber-300/70" fill="currentColor">
                <path d="M30 5 C10 15 5 35 30 55 C55 35 50 15 30 5Z" />
              </svg>
              <p style={{ color: style.accent }} className="text-[11px] font-black uppercase tracking-[0.4em]">
                Quem somos
              </p>
            </div>
            <h1 className="text-4xl md:text-5xl font-serif font-bold tracking-tight leading-tight text-stone-800 mb-6">
              {tenant.name}
            </h1>
            <p className="text-stone-500 leading-relaxed text-sm font-medium">
              {tenant.about_text || "Nossa loja oferece produtos naturais e artesanais selecionados com qualidade e dedicação. Priorizamos a satisfação de cada cliente, garantindo uma experiência de compra calorosa, ágil e prazerosa."}
            </p>
            <div className="flex flex-wrap gap-3 mt-8">
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                <Link
                  to={buildStorePath(slug, "/catalogo")}
                  style={{ backgroundColor: style.accent }}
                  className="flex items-center gap-2 px-6 h-12 rounded-2xl text-white text-xs font-bold uppercase tracking-widest shadow-[0_4px_18px_rgba(217,119,6,0.35)] hover:shadow-[0_6px_26px_rgba(217,119,6,0.5)] transition-all"
                >
                  Ver produtos <ArrowRight size={13} />
                </Link>
              </motion.div>
              {tenant.whatsapp && (
                <a
                  href={`https://wa.me/${tenant.whatsapp.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-6 h-12 rounded-2xl border border-amber-200 bg-white text-stone-700 text-xs font-bold uppercase tracking-widest hover:bg-amber-50 hover:border-amber-300 transition-all"
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
            {/* Blob decorations */}
            <div className="absolute -top-8 -right-8 w-48 h-48 rounded-full bg-amber-100/50 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-8 -left-8 w-36 h-36 rounded-full bg-orange-100/40 blur-3xl pointer-events-none" />

            <div className={cn("aspect-square relative overflow-hidden rounded-2xl border border-[#f0e6d3]")}>
              {tenant.banner_url ? (
                <img src={tenant.banner_url} className="w-full h-full object-cover" alt="Sobre" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-[#fdf7ef] relative">
                  <DotTexture />
                  <span className="text-amber-200/40 font-serif font-bold text-[120px] uppercase tracking-tighter select-none relative z-10">
                    {tenant.name.charAt(0)}
                  </span>
                </div>
              )}
              {tenant.banner_url && (
                <div className="absolute inset-0 bg-gradient-to-t from-stone-900/50 to-transparent" />
              )}
              <div className="absolute bottom-6 left-6">
                <p className="text-white font-serif font-bold text-2xl drop-shadow-lg">{tenant.name}</p>
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
            { value: products.filter(p => p.is_active).length, label: "Produtos ativos", icon: "🌿" },
            { value: products.filter(p => p.is_featured).length, label: "Destaques", icon: "⭐" },
            { value: products.filter(p => p.discount_price).length, label: "Em promoção", icon: "🏷️" },
            { value: "100%", label: "Atendimento via WA", icon: "💬" },
          ].map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              whileHover={{ y: -3 }}
              className="p-5 border text-center rounded-2xl bg-[#fffbf5] border-[#f0e6d3] hover:border-amber-200 hover:shadow-[0_6px_24px_rgba(217,119,6,0.1)] transition-all"
            >
              <div className="text-2xl mb-2">{s.icon}</div>
              <p className="text-3xl font-serif font-bold" style={{ color: style.accent }}>{s.value}</p>
              <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mt-1">{s.label}</p>
            </motion.div>
          ))}
        </div>

        {/* ── CONTACT & BENEFITS ───────────────────────────────── */}
        <div className="grid md:grid-cols-2 gap-8">

          {/* Contact card */}
          <motion.div
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="rounded-2xl border border-[#f0e6d3] overflow-hidden bg-[#fffbf5]"
          >
            {/* Amber top bar */}
            <div className="h-1.5 w-full" style={{ backgroundColor: style.accent }} />
            <div className="p-6 space-y-5">
              <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest flex items-center gap-1.5">
                <Leaf size={11} className="text-amber-400" /> Contato & Localização
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
                    <p className="text-[10px] text-stone-400 font-bold uppercase tracking-wider">WhatsApp</p>
                    <p className="text-sm font-bold text-stone-800 font-mono group-hover:text-emerald-600 transition-colors">
                      +{tenant.whatsapp}
                    </p>
                  </div>
                </a>
              )}

              {tenant.address && (
                <div className="flex items-start gap-4">
                  <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: style.accent + "18" }}>
                    <MapPin size={18} style={{ color: style.accent }} />
                  </div>
                  <div>
                    <p className="text-[10px] text-stone-400 font-bold uppercase tracking-wider">Endereço</p>
                    <p className="text-sm font-medium text-stone-700 leading-snug">{tenant.address}</p>
                  </div>
                </div>
              )}

              {(tenant.instagram_url || tenant.facebook_url) && (
                <div className="flex items-center gap-3 pt-2 border-t border-amber-100">
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
            className="rounded-2xl border border-[#f0e6d3] overflow-hidden bg-[#fffbf5] flex flex-col"
          >
            <div className="h-1.5 w-full" style={{ backgroundColor: "#c2713a" }} />
            <div className="p-6 space-y-4 flex flex-col flex-1">
              <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest flex items-center gap-1.5">
                <Leaf size={11} className="text-amber-400" /> Por que comprar conosco?
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
                    style={{ backgroundColor: style.accent + "20" }}
                    className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                  >
                    <Check size={12} style={{ color: style.accent }} strokeWidth={3} />
                  </div>
                  <p className="text-sm font-medium text-stone-700">{item}</p>
                </motion.div>
              ))}
              <div className="mt-auto pt-4">
                <Link
                  to={buildStorePath(slug, "/catalogo")}
                  style={{ backgroundColor: style.accent }}
                  className="w-full h-11 flex items-center justify-center gap-2 text-white text-[11px] font-bold uppercase tracking-widest rounded-xl transition-all hover:shadow-[0_4px_16px_rgba(217,119,6,0.35)] hover:opacity-90"
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
