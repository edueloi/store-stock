import { Link, useParams } from "react-router-dom";
import { MapPin, Phone, Instagram, Facebook, ArrowRight, Package } from "lucide-react";
import { cn } from "../../../../lib/utils";
import { useStore } from "../../StoreLayout";
import StoreSEO from "../../../../components/store/StoreSEO";
import { buildStorePath, resolveStoreSlug } from "../../store-routing";

export default function StoreAbout() {
  const { slug: routeSlug } = useParams();
  const { tenant, products, style } = useStore();
  const slug = resolveStoreSlug(routeSlug);

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-12 space-y-16">
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
      <nav className="flex items-center gap-2 text-[10px] font-bold uppercase text-slate-400 tracking-wider">
        <Link to={buildStorePath(slug)} className="hover:text-slate-700">Início</Link>
        <span>/</span>
        <span className="text-slate-700">Sobre</span>
      </nav>

      {/* Hero */}
      <div className="grid md:grid-cols-2 gap-12 items-center">
        <div>
          <p style={{ color: style.accent }} className="text-[11px] font-black uppercase tracking-[0.4em] mb-3">
            Quem somos
          </p>
          <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter leading-none text-slate-900 mb-6">
            {tenant.name}
          </h1>
          <p className="text-slate-500 leading-relaxed text-sm font-medium">
            {tenant.about_text || "Nossa loja oferece produtos selecionados com qualidade e dedicação. Priorizamos a satisfação de cada cliente, garantindo uma experiência de compra segura, ágil e prazerosa."}
          </p>
          <div className="flex flex-wrap gap-3 mt-8">
            <Link
              to={buildStorePath(slug, "/catalogo")}
              style={{ backgroundColor: style.accent }}
              className="flex items-center gap-2 px-6 h-11 rounded-2xl text-white text-xs font-black uppercase tracking-widest shadow-lg hover:opacity-90 transition-all"
            >
              Ver produtos <ArrowRight size={13} />
            </Link>
            {tenant.whatsapp && (
              <a
                href={`https://wa.me/${tenant.whatsapp.replace(/\D/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-6 h-11 rounded-2xl border border-slate-200 text-slate-700 text-xs font-black uppercase tracking-widest hover:bg-slate-50 transition-all"
              >
                Falar conosco
              </a>
            )}
          </div>
        </div>

        <div className={cn("aspect-square bg-slate-900 relative overflow-hidden", style.radius)}>
          {tenant.banner_url ? (
            <img src={tenant.banner_url} className="w-full h-full object-cover opacity-80" alt="Sobre" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-white/5 font-black text-[120px] uppercase tracking-tighter select-none">
                {tenant.name.charAt(0)}
              </span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent" />
          <div className="absolute bottom-6 left-6">
            <p className="text-white font-black text-2xl uppercase tracking-tighter">{tenant.name}</p>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="w-2 h-2 bg-emerald-400 rounded-full" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-white/60">Loja ativa</span>
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
          <div key={i} className={cn("p-5 border text-center", style.card, style.radius)}>
            <p className="text-3xl font-black" style={{ color: style.accent }}>{s.value}</p>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Contact & Info */}
      <div className="grid md:grid-cols-2 gap-8">
        <div className={cn("p-6 border space-y-5", style.card, style.radius)}>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Contato & Localização</p>

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

        <div className={cn("p-6 border space-y-4 flex flex-col", style.card, style.radius)}>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Por que comprar conosco?</p>
          {[
            "Produtos com qualidade verificada",
            "Atendimento rápido via WhatsApp",
            "Pedido confirmado antes do pagamento",
            "Trocas e devoluções em até 7 dias",
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-3">
              <div style={{ backgroundColor: style.accent + "20" }} className="w-7 h-7 rounded-full flex items-center justify-center shrink-0">
                <span style={{ color: style.accent }} className="text-[10px] font-black">✓</span>
              </div>
              <p className="text-sm font-medium text-slate-700">{item}</p>
            </div>
          ))}
          <div className="mt-auto pt-4">
            <Link
              to={buildStorePath(slug, "/catalogo")}
              style={{ backgroundColor: style.accent }}
              className="w-full h-10 flex items-center justify-center gap-2 text-white text-[11px] font-black uppercase tracking-widest rounded-xl transition-all hover:opacity-90"
            >
              <Package size={14} /> Explorar catálogo
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
