import { Link, useParams } from "react-router-dom";
import { MapPin, Phone, Instagram, Facebook, ArrowRight, Package } from "lucide-react";
import { cn } from "../../../lib/utils";
import { useStore } from "../StoreLayout";
import StoreSEO from "../../../components/store/StoreSEO";
import { buildStorePath, resolveStoreSlug } from "../store-routing";

export default function StoreAbout() {
  const { slug: routeSlug } = useParams();
  const { tenant, products, style } = useStore();
  const slug = resolveStoreSlug(routeSlug);
  const isFashion = style.font === "font-editorial";
  const isTechNova = style.font === "font-tech";

  return (
    <div className={cn("max-w-7xl mx-auto px-4 md:px-6 py-12 space-y-16", (isFashion || isTechNova) && "space-y-12")}>
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
      <nav className={cn("flex items-center gap-2 text-[10px] font-bold uppercase", isFashion ? "tracking-[0.24em] text-[#9c7b72]" : isTechNova ? "tracking-[0.22em] text-[#7c96b8]" : "text-slate-400 tracking-wider")}>
        <Link to={buildStorePath(slug)} className="hover:text-slate-700">Início</Link>
        <span>/</span>
        <span className={cn(isTechNova ? "text-[#071426]" : "text-slate-700")}>Sobre</span>
      </nav>

      {/* Hero */}
      <div className="grid md:grid-cols-2 gap-12 items-center">
        <div className={cn(isFashion ? "fashion-panel rounded-[2rem] border border-[#ead9ce] bg-white/78 p-5 sm:p-6 md:p-8" : isTechNova ? "tech-panel rounded-[2rem] border border-[#dbe6ff] bg-white/82 p-5 sm:p-6 md:p-8" : "")}>
          <p style={{ color: style.accent }} className={cn(isFashion ? "store-kicker text-[10px] font-semibold mb-3" : isTechNova ? "store-kicker text-[10px] font-semibold mb-3" : "text-[11px] font-black uppercase tracking-[0.4em] mb-3")}>
            Quem somos
          </p>
          <h1 className={cn(isFashion ? "store-display text-[3.2rem] sm:text-5xl md:text-6xl leading-[0.9] text-[#2d221f] mb-6" : isTechNova ? "store-display text-[3rem] sm:text-5xl md:text-6xl leading-[0.92] text-[#071426] mb-6" : "text-4xl md:text-5xl font-black uppercase tracking-tighter leading-none text-slate-900 mb-6")}>
            {tenant.name}
          </h1>
          <p className={cn(isFashion ? "text-[#6b5149] leading-relaxed text-base" : isTechNova ? "text-[#5d789a] leading-relaxed text-base" : "text-slate-500 leading-relaxed text-sm font-medium")}>
            {tenant.about_text || "Nossa loja oferece produtos selecionados com qualidade e dedicação. Priorizamos a satisfação de cada cliente, garantindo uma experiência de compra segura, ágil e prazerosa."}
          </p>
          <div className="flex flex-wrap gap-3 mt-8">
            <Link
              to={buildStorePath(slug, "/catalogo")}
              style={{ backgroundColor: style.accent }}
              className={cn(isFashion ? "flex items-center gap-2 px-6 h-11 rounded-full text-white text-xs font-semibold uppercase tracking-[0.24em] shadow-lg hover:opacity-90 transition-all" : isTechNova ? "flex items-center gap-2 px-6 h-11 rounded-full text-white text-xs font-semibold uppercase tracking-[0.18em] shadow-[0_18px_34px_rgba(37,99,235,0.22)] hover:opacity-90 transition-all" : "flex items-center gap-2 px-6 h-11 rounded-2xl text-white text-xs font-black uppercase tracking-widest shadow-lg hover:opacity-90 transition-all")}
            >
              Ver produtos <ArrowRight size={13} />
            </Link>
            {tenant.whatsapp && (
              <a
                href={`https://wa.me/${tenant.whatsapp.replace(/\D/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(isFashion ? "flex items-center gap-2 px-6 h-11 rounded-full border border-[#ead9ce] text-[#6b5149] text-xs font-semibold uppercase tracking-[0.24em] hover:bg-[#fff7f1] transition-all" : isTechNova ? "flex items-center gap-2 px-6 h-11 rounded-full border border-[#dbe6ff] bg-white text-[#5d789a] text-xs font-semibold uppercase tracking-[0.18em] hover:border-[#bfd2ff] transition-all" : "flex items-center gap-2 px-6 h-11 rounded-2xl border border-slate-200 text-slate-700 text-xs font-black uppercase tracking-widest hover:bg-slate-50 transition-all")}
              >
                Falar conosco
              </a>
            )}
          </div>
        </div>

        <div className={cn(isFashion ? "aspect-[4/5] min-h-[320px] bg-[#f1e3d8] relative overflow-hidden fashion-panel border border-[#ead9ce]" : isTechNova ? "aspect-square tech-panel tech-grid bg-[linear-gradient(160deg,#eff6ff_0%,#f8fbff_100%)] relative overflow-hidden border border-[#dbe6ff]" : "aspect-square bg-slate-900 relative overflow-hidden", style.radius)}>
          {tenant.banner_url ? (
            <img src={tenant.banner_url} className="w-full h-full object-cover opacity-80" alt="Sobre" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-white/5 font-black text-[120px] uppercase tracking-tighter select-none">
                {tenant.name.charAt(0)}
              </span>
            </div>
          )}
          <div className={cn("absolute inset-0", isTechNova ? "bg-[linear-gradient(180deg,rgba(7,20,38,0.02)_0%,rgba(7,20,38,0.08)_44%,rgba(7,20,38,0.72)_100%)]" : "bg-gradient-to-t from-slate-900/60 to-transparent")} />
          <div className="absolute bottom-6 left-6">
            <p className={cn(isFashion ? "store-display text-4xl font-semibold text-white" : isTechNova ? "store-display text-4xl font-semibold text-white" : "text-white font-black text-2xl uppercase tracking-tighter")}>{tenant.name}</p>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="w-2 h-2 bg-emerald-400 rounded-full" />
              <span className={cn("text-[11px] font-bold uppercase", isTechNova ? "tracking-[0.18em] text-white/68" : "tracking-wider text-white/60")}>Loja ativa</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { value: products.filter(p => p.is_active).length, label: "Produtos ativos" },
          { value: products.filter(p => p.is_featured).length, label: "Destaques" },
          { value: products.filter(p => p.discount_price).length, label: "Em promoção" },
          { value: "100%", label: "Atendimento via WA" },
        ].map((s, i) => (
          <div key={i} className={cn(isFashion ? "fashion-panel p-5 border text-center" : isTechNova ? "tech-panel p-5 border text-center" : "p-5 border text-center", style.card, style.radius)}>
            <p className={cn(isFashion || isTechNova ? "store-display text-5xl leading-none" : "text-3xl font-black")} style={{ color: style.accent }}>{s.value}</p>
            <p className={cn(isFashion ? "text-[10px] font-semibold text-[#8c6c63] uppercase tracking-[0.24em] mt-2" : isTechNova ? "text-[10px] font-semibold text-[#6f89ad] uppercase tracking-[0.2em] mt-2" : "text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1")}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Contact & Info */}
      <div className="grid md:grid-cols-2 gap-8">
        <div className={cn(isFashion ? "fashion-panel p-6 border space-y-5" : isTechNova ? "tech-panel p-6 border space-y-5" : "p-6 border space-y-5", style.card, style.radius)}>
          <p className={cn(isFashion ? "text-[10px] font-semibold text-[#8c6c63] uppercase tracking-[0.24em]" : isTechNova ? "store-kicker text-[10px] font-semibold text-[#6f89ad]" : "text-[10px] font-black text-slate-400 uppercase tracking-widest")}>Contato & Localização</p>

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
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">WhatsApp</p>
                <p className="text-sm font-black text-slate-800 font-mono group-hover:text-emerald-600 transition-colors">
                  +{tenant.whatsapp}
                </p>
              </div>
            </a>
          )}

          {tenant.address && (
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 bg-slate-100 rounded-2xl flex items-center justify-center shrink-0">
                <MapPin size={18} className="text-slate-500" />
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

        <div className={cn(isFashion ? "fashion-panel p-6 border space-y-4 flex flex-col" : isTechNova ? "tech-panel p-6 border space-y-4 flex flex-col" : "p-6 border space-y-4 flex flex-col", style.card, style.radius)}>
          <p className={cn(isFashion ? "text-[10px] font-semibold text-[#8c6c63] uppercase tracking-[0.24em]" : isTechNova ? "store-kicker text-[10px] font-semibold text-[#6f89ad]" : "text-[10px] font-black text-slate-400 uppercase tracking-widest")}>Por que comprar conosco?</p>
          {(isTechNova
            ? [
                "Curadoria pensada para eletrônicos, games e informática",
                "Atendimento rápido via WhatsApp antes da compra",
                "Vitrine clara para destacar preço, modelo e variações",
                "Promoções e destaques prontos para alta conversão",
              ]
            : [
                "Produtos com qualidade verificada",
                "Atendimento rápido via WhatsApp",
                "Pedido confirmado antes do pagamento",
                "Trocas e devoluções em até 7 dias",
              ]).map((item, i) => (
            <div key={i} className="flex items-center gap-3">
              <div style={{ backgroundColor: style.accent + "20" }} className="w-7 h-7 rounded-full flex items-center justify-center shrink-0">
                <span style={{ color: style.accent }} className="text-[10px] font-black">✓</span>
              </div>
              <p className={cn(isFashion ? "text-sm font-medium text-[#6b5149]" : isTechNova ? "text-sm font-medium text-[#5d789a]" : "text-sm font-medium text-slate-700")}>{item}</p>
            </div>
          ))}
          <div className="mt-auto pt-4">
            <Link
              to={buildStorePath(slug, "/catalogo")}
              style={{ backgroundColor: style.accent }}
              className={cn(isFashion ? "w-full h-11 flex items-center justify-center gap-2 text-white text-[11px] font-semibold uppercase tracking-[0.24em] rounded-full transition-all hover:opacity-90" : isTechNova ? "w-full h-11 flex items-center justify-center gap-2 text-white text-[11px] font-semibold uppercase tracking-[0.18em] rounded-full transition-all hover:opacity-90 shadow-[0_18px_34px_rgba(37,99,235,0.22)]" : "w-full h-10 flex items-center justify-center gap-2 text-white text-[11px] font-black uppercase tracking-widest rounded-xl transition-all hover:opacity-90")}
            >
              <Package size={14} /> Explorar catálogo
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
