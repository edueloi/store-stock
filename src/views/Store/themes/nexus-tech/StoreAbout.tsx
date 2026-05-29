import { Link, useParams } from "react-router-dom";
import { motion } from "motion/react";
import {
  MapPin, Phone, Instagram, Facebook, ArrowRight, Package,
  Shield, Truck, Sparkles, Star, Check, ChevronRight, Zap,
} from "lucide-react";
import { cn } from "../../../../lib/utils";
import { useStore } from "../../StoreLayout";
import StoreSEO from "../../../../components/store/StoreSEO";
import { buildStorePath, resolveStoreSlug } from "../../store-routing";

export default function StoreAbout() {
  const { slug: routeSlug } = useParams();
  const { tenant, products, categories, style } = useStore();
  const slug = resolveStoreSlug(routeSlug);

  const activeProducts = products.filter(p => p.is_active);
  const featuredProducts = products.filter(p => p.is_featured);
  const onSaleProducts = products.filter(p => p.discount_price);

  return (
    <div className="min-h-screen bg-[linear-gradient(160deg,#f0f6ff_0%,#fafcff_50%,#eef4ff_100%)]">
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

      <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 space-y-16">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8baed0]">
          <Link to={buildStorePath(slug)} className="hover:text-[#071426] transition-colors">Início</Link>
          <ChevronRight size={10} />
          <span className="text-[#071426]">Sobre</span>
        </nav>

        {/* ═══════════════════════════════════════════════════════════════════
            HERO
        ═══════════════════════════════════════════════════════════════════ */}
        <div className="grid md:grid-cols-2 gap-8 lg:gap-14 items-center">

          {/* Copy panel */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="tech-panel relative overflow-hidden rounded-[2.2rem] border border-[#dbe6ff] bg-white/90 p-7 sm:p-10 shadow-[0_4px_40px_rgba(37,99,235,0.08)]">
              {/* Ambient */}
              <div className="absolute -top-10 right-6 w-40 h-40 rounded-full bg-[#60a5fa]/10 blur-3xl pointer-events-none" />
              <div className="absolute bottom-0 -left-6 w-36 h-36 rounded-full bg-[#818cf8]/8 blur-3xl pointer-events-none" />

              <div className="relative">
                {/* Kicker */}
                <div className="inline-flex items-center gap-2 rounded-full border border-[#d7e4ff] bg-white/80 px-4 py-1.5 mb-5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <p className="store-kicker text-[9px] font-semibold text-[#4d6990] tracking-[0.2em]">Loja ativa • Quem somos</p>
                </div>

                <h1 className="store-display text-[3rem] sm:text-5xl md:text-6xl leading-[0.9] text-[#071426] tracking-[-0.02em] mb-5">
                  {tenant.name}
                </h1>
                <p className="text-[14px] md:text-[15px] text-[#4e6c8e] leading-relaxed">
                  {tenant.about_text || "Nossa loja oferece produtos selecionados com qualidade e dedicação. Priorizamos a satisfação de cada cliente, garantindo uma experiência de compra segura, ágil e prazerosa."}
                </p>

                {/* CTAs */}
                <div className="flex flex-wrap gap-3 mt-8">
                  <Link
                    to={buildStorePath(slug, "/catalogo")}
                    style={{ backgroundColor: style.accent }}
                    className="inline-flex items-center gap-2 px-7 h-12 rounded-full text-white text-[11px] font-semibold uppercase tracking-[0.18em] shadow-[0_14px_34px_rgba(37,99,235,0.28)] hover:shadow-[0_18px_42px_rgba(37,99,235,0.38)] hover:-translate-y-0.5 transition-all"
                  >
                    Ver produtos <ArrowRight size={13} />
                  </Link>
                  {tenant.whatsapp && (
                    <a
                      href={`https://wa.me/${tenant.whatsapp.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-7 h-12 rounded-full border border-[#dbe6ff] bg-white text-[#4e6c8e] text-[11px] font-semibold uppercase tracking-[0.18em] hover:border-[#b3caff] hover:bg-[#f4f8ff] transition-all"
                    >
                      Falar conosco
                    </a>
                  )}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Banner image */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
              "aspect-square tech-panel tech-grid tech-scan relative overflow-hidden border border-[#dbe6ff] bg-[linear-gradient(160deg,#eff6ff_0%,#f8fbff_100%)] shadow-[0_4px_40px_rgba(37,99,235,0.09)]",
              style.radius
            )}
          >
            {/* Ambient orbs */}
            <div className="absolute top-1/4 right-1/4 w-48 h-48 rounded-full bg-[#3b82f6]/10 blur-3xl pointer-events-none" />
            <div className="absolute bottom-1/4 left-1/4 w-40 h-40 rounded-full bg-[#6366f1]/10 blur-3xl pointer-events-none" />

            {tenant.banner_url ? (
              <img src={tenant.banner_url} className="w-full h-full object-cover opacity-85" alt={`${tenant.name} banner`} />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="font-black text-[120px] sm:text-[160px] uppercase leading-none select-none tracking-tighter" style={{ color: style.accent + "12" }}>
                  {tenant.name.charAt(0)}
                </span>
              </div>
            )}

            {/* Overlay */}
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,20,38,0.01)_0%,rgba(7,20,38,0.05)_40%,rgba(7,20,38,0.60)_100%)]" />

            {/* Bottom info */}
            <div className="absolute bottom-0 left-0 right-0 p-7">
              <p className="store-display text-3xl font-semibold text-white">{tenant.name}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className="w-2 h-2 bg-emerald-400 rounded-full" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/70">Loja ativa</span>
              </div>
            </div>

            {/* Floating badge */}
            <div className="tech-float absolute top-5 right-5 rounded-full border border-white/40 bg-white/80 backdrop-blur-md px-4 py-2 shadow-lg">
              <p className="text-[9px] font-semibold uppercase tracking-[0.2em]" style={{ color: style.accent }}>
                Tecnologia &amp; premium
              </p>
            </div>
          </motion.div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            STATS
        ═══════════════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { value: activeProducts.length, label: "Produtos ativos", icon: <Package size={16} /> },
            { value: categories.length, label: "Categorias", icon: <Sparkles size={16} /> },
            { value: featuredProducts.length, label: "Destaques", icon: <Star size={16} /> },
            { value: onSaleProducts.length, label: "Em promoção", icon: <Zap size={16} /> },
          ].map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.07 }}
              className={cn(
                "tech-panel relative overflow-hidden border text-center p-6 shadow-[0_2px_16px_rgba(37,99,235,0.07)]",
                style.card,
                style.radius
              )}
            >
              {/* Background orb */}
              <div className="absolute -bottom-4 -right-4 w-20 h-20 rounded-full blur-2xl" style={{ background: style.accent + "10" }} />
              <div className="relative">
                <span className="w-10 h-10 flex items-center justify-center rounded-2xl border border-[#dbe6ff] bg-white mx-auto mb-3" style={{ color: style.accent }}>
                  {s.icon}
                </span>
                <p className="store-display text-[3rem] leading-none font-semibold" style={{ color: style.accent }}>{s.value}</p>
                <p className="store-kicker text-[9px] font-semibold text-[#7b9ac0] uppercase tracking-[0.2em] mt-2">{s.label}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            CONTACT + BENEFITS
        ═══════════════════════════════════════════════════════════════════ */}
        <div className="grid md:grid-cols-2 gap-6 lg:gap-8">

          {/* Contact */}
          <motion.div
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 }}
            className={cn(
              "tech-panel border p-7 sm:p-8 space-y-5 shadow-[0_2px_16px_rgba(37,99,235,0.07)]",
              style.card,
              style.radius
            )}
          >
            <div>
              <p className="store-kicker text-[10px] font-semibold text-[#7b9ac0] mb-1">Entre em contato</p>
              <h2 className="store-display text-[2rem] font-semibold text-[#071426]">Contato &amp; Localização</h2>
            </div>

            {tenant.whatsapp && (
              <a
                href={`https://wa.me/${tenant.whatsapp.replace(/\D/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-4 group p-4 rounded-[1.4rem] border border-[#dbe6ff] bg-white/70 hover:border-[#b3caff] hover:bg-white transition-all"
              >
                <div className="w-12 h-12 bg-[#25D366] rounded-2xl flex items-center justify-center shrink-0 shadow-[0_4px_16px_rgba(37,211,102,0.28)]">
                  <Phone size={18} className="text-white" />
                </div>
                <div>
                  <p className="store-kicker text-[9px] font-semibold text-[#8baed0] mb-0.5">WhatsApp</p>
                  <p className="text-[13px] font-bold text-[#071426] font-mono group-hover:text-[#25D366] transition-colors">
                    +{tenant.whatsapp}
                  </p>
                </div>
              </a>
            )}

            {tenant.address && (
              <div className="flex items-start gap-4 p-4 rounded-[1.4rem] border border-[#dbe6ff] bg-white/70">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border border-[#dbe6ff] bg-white" style={{ color: style.accent }}>
                  <MapPin size={18} />
                </div>
                <div>
                  <p className="store-kicker text-[9px] font-semibold text-[#8baed0] mb-0.5">Endereço</p>
                  <p className="text-[13px] font-medium text-[#4e6c8e] leading-snug">{tenant.address}</p>
                </div>
              </div>
            )}

            {(tenant.instagram_url || tenant.facebook_url) && (
              <div className="flex items-center gap-3 pt-2 border-t border-[#e2ecff]">
                <p className="store-kicker text-[9px] font-semibold text-[#8baed0] mr-1">Redes:</p>
                {tenant.instagram_url && (
                  <a
                    href={`https://instagram.com/${tenant.instagram_url.replace("@", "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center text-white hover:scale-110 transition-transform shadow-md"
                  >
                    <Instagram size={15} />
                  </a>
                )}
                {tenant.facebook_url && (
                  <a
                    href={`https://facebook.com/${tenant.facebook_url}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center text-white hover:scale-110 transition-transform shadow-md"
                  >
                    <Facebook size={15} />
                  </a>
                )}
              </div>
            )}
          </motion.div>

          {/* Benefits */}
          <motion.div
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className={cn(
              "tech-panel border p-7 sm:p-8 flex flex-col shadow-[0_2px_16px_rgba(37,99,235,0.07)]",
              style.card,
              style.radius
            )}
          >
            <div className="mb-6">
              <p className="store-kicker text-[10px] font-semibold text-[#7b9ac0] mb-1">Nossas vantagens</p>
              <h2 className="store-display text-[2rem] font-semibold text-[#071426]">Por que nos escolher?</h2>
            </div>

            <div className="space-y-3 flex-1">
              {[
                { icon: <Shield size={14} />, title: "Compra segura e confiável", desc: "Sua privacidade e transações protegidas em todo processo." },
                { icon: <Truck size={14} />, title: "Entrega rápida", desc: "Processamos pedidos com agilidade para você receber logo." },
                { icon: <Sparkles size={14} />, title: "Produtos premium selecionados", desc: "Curadoria de eletrônicos, games e casa inteligente." },
                { icon: <Phone size={14} />, title: "Atendimento via WhatsApp", desc: "Tire dúvidas antes e depois da compra com rapidez." },
              ].map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.25 + i * 0.07 }}
                  className="flex items-start gap-4 p-4 rounded-[1.2rem] border border-[#e2ecff] bg-white/60 hover:bg-white hover:border-[#d7e4ff] hover:shadow-sm transition-all"
                >
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: style.accent + "14", color: style.accent }}
                  >
                    {item.icon}
                  </div>
                  <div>
                    <p className="text-[12px] font-semibold text-[#071426]">{item.title}</p>
                    <p className="text-[11px] text-[#6a85a8] leading-snug mt-0.5">{item.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="mt-6 pt-5 border-t border-[#e2ecff]">
              <Link
                to={buildStorePath(slug, "/catalogo")}
                style={{ backgroundColor: style.accent }}
                className="w-full h-12 flex items-center justify-center gap-2 text-white text-[11px] font-semibold uppercase tracking-[0.18em] rounded-full shadow-[0_14px_34px_rgba(37,99,235,0.26)] hover:shadow-[0_18px_42px_rgba(37,99,235,0.36)] hover:-translate-y-0.5 transition-all"
              >
                <Package size={13} /> Explorar catálogo
              </Link>
            </div>
          </motion.div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            CTA SECTION
        ═══════════════════════════════════════════════════════════════════ */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="tech-panel relative overflow-hidden rounded-[2.2rem] border border-[#dbe6ff] bg-[linear-gradient(135deg,#eff6ff_0%,#eef4ff_50%,#f0f6ff_100%)] px-8 py-12 md:px-16 md:py-16 text-center shadow-[0_4px_40px_rgba(37,99,235,0.09)]"
        >
          {/* Orbs */}
          <div className="pointer-events-none absolute -top-10 left-1/4 w-56 h-56 rounded-full bg-[#3b82f6]/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-10 right-1/4 w-56 h-56 rounded-full bg-[#6366f1]/10 blur-3xl" />

          <div className="relative">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#d7e4ff] bg-white/80 px-4 py-1.5 mb-5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#2563eb] tech-pulse" />
              <p className="store-kicker text-[9px] font-semibold text-[#4d6990] tracking-[0.2em]">Pronto para comprar?</p>
            </div>
            <h2 className="store-display text-[2.4rem] sm:text-5xl md:text-6xl leading-[0.9] text-[#071426] mb-4">
              Explore nossa vitrine
            </h2>
            <p className="max-w-md mx-auto text-[14px] md:text-[15px] text-[#4e6c8e] leading-relaxed mb-8">
              Centenas de produtos selecionados esperando por você. Navegue, filtre e encontre o que precisa.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                to={buildStorePath(slug, "/catalogo")}
                style={{ backgroundColor: style.accent }}
                className="inline-flex items-center justify-center gap-2 h-13 px-10 rounded-full text-[11px] font-semibold uppercase tracking-[0.2em] text-white shadow-[0_16px_40px_rgba(37,99,235,0.28)] hover:shadow-[0_20px_50px_rgba(37,99,235,0.38)] hover:-translate-y-0.5 transition-all"
              >
                <Package size={14} /> Ver catálogo completo
              </Link>
              {tenant.whatsapp && (
                <a
                  href={`https://wa.me/${tenant.whatsapp.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 h-13 px-8 rounded-full border border-[#d7e4ff] bg-white text-[11px] font-semibold uppercase tracking-[0.18em] text-[#4d6990] hover:bg-[#f4f8ff] hover:border-[#b3caff] transition-all"
                >
                  Falar no WhatsApp
                </a>
              )}
            </div>
          </div>
        </motion.div>

      </div>
    </div>
  );
}
