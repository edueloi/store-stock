import { Link } from "react-router-dom";
import { ArrowRight, Clock, Flame, GlassWater, MapPin, MessageCircle, Snowflake, Truck } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import HeroSlider from "../../../../components/store/HeroSlider";
import { FALLBACK_CHIPS, hoursLines, useKit, whatsappLink } from "./kit";
import { ProductCard } from "./parts";
import "./styles.css";

export default function StoreFront() {
  const { tenant, categories, active, path, sf } = useKit();
  const featured = [...active.filter((p) => p.is_featured), ...active.filter((p) => !p.is_featured)].slice(0, tenant.featured_limit || 8);
  const banner = tenant.banner_url || "";
  const cats = categories.filter((c) => active.some((p) => p.category_id === c.id)).slice(0, 10);
  const about = tenant.about_text || "Bebidas geladas, gelo, carvão e conveniência, na hora e na sua porta.";
  const wa = whatsappLink(tenant.whatsapp, `Olá! Vim pela loja ${tenant.name}.`);
  const hours = hoursLines(tenant.business_hours);

  const fallback = (
    <section className={`adg-hero ${banner ? "has-banner" : ""}`}>
      {banner && <img className="adg-hero-bg" src={banner} alt="" />}
      <div className="adg-hero-copy">
        <span className="adg-kicker"><Snowflake size={13} aria-hidden="true" /> {sf.segment_label || "Adega noturna"}</span>
        {tenant.logo_url && <img className="adg-hero-logo" src={tenant.logo_url} alt={tenant.name} />}
        <h1>{tenant.hero_tagline || "Gelada, na hora e na sua porta."}</h1>
        <p>{about.length > 160 ? `${about.slice(0, 157)}...` : about}</p>
        <div className="adg-hero-cta">
          <Link className="adg-btn adg-btn-lg" to={path("/catalogo")}>{sf.hero_button_label || "Ver cardápio"} <ArrowRight size={18} /></Link>
          {wa && <a className="adg-btn adg-btn-ghost adg-btn-lg" href={wa} target="_blank" rel="noreferrer"><MessageCircle size={18} /> WhatsApp</a>}
        </div>
      </div>
      <div className="adg-hero-glow" aria-hidden="true"><GlassWater size={140} strokeWidth={1} /></div>
    </section>
  );

  return (
    <div className="adg-page">
      <StoreSEO title={`${tenant.name} | Bebidas, gelo e conveniência`} description={about} image={banner || tenant.logo_url} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />

      <div className="adg-wrap adg-top">
        <HeroSlider
          slides={sf.hero_slides}
          autoplaySeconds={sf.hero_autoplay_seconds ?? 6}
          resolveUrl={(u) => (u.startsWith("/") ? path(u) : u)}
          layout="banner"
          className="adg-slider"
          fallback={fallback}
        />
      </div>

      <nav className="adg-wrap adg-chip-row" aria-label="Categorias">
        {cats.length > 0
          ? cats.map((c) => <Link key={c.id} to={path(`/catalogo?categoria=${c.id}`)}>{c.name}</Link>)
          : FALLBACK_CHIPS.map((label) => <Link key={label} to={path(`/catalogo?q=${encodeURIComponent(label)}`)}>{label}</Link>)}
      </nav>

      <section className="adg-wrap adg-section">
        <header className="adg-head">
          <div>
            <span className="adg-kicker"><Flame size={13} aria-hidden="true" /> {sf.home_categories_title || "Saindo da geladeira"}</span>
            <h2>{sf.home_featured_title || "Mais pedidos"}</h2>
          </div>
          <Link className="adg-link" to={path("/catalogo")}>Ver tudo <ArrowRight size={16} /></Link>
        </header>
        {featured.length ? (
          <div className="adg-grid">{featured.map((p) => <ProductCard key={p.id} product={p} />)}</div>
        ) : (
          <p className="adg-note">Estamos abastecendo a geladeira. Volte em breve.</p>
        )}
      </section>

      <section className="adg-wrap adg-section">
        <div className="adg-info">
          <div className="adg-info-title">
            <span className="adg-kicker"><Truck size={13} aria-hidden="true" /> Atendimento</span>
            <h2>Aberto quando a noite pede.</h2>
            <Link className="adg-btn adg-btn-ghost" to={path("/sobre")}>Conheça a adega</Link>
          </div>
          <ul>
            {tenant.show_address && tenant.address && <li><MapPin size={18} aria-hidden="true" /><span><b>Endereço</b>{tenant.address}</span></li>}
            {wa && <li><MessageCircle size={18} aria-hidden="true" /><span><b>WhatsApp</b><a href={wa} target="_blank" rel="noreferrer">{tenant.whatsapp}</a></span></li>}
            {hours.length > 0 && (
              <li><Clock size={18} aria-hidden="true" /><span><b>Horários</b>{hours.map((h) => <em key={h.day}>{h.day}: {h.text}</em>)}</span></li>
            )}
          </ul>
        </div>
      </section>
    </div>
  );
}
