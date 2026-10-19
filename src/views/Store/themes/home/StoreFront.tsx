import { useRef } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ChevronLeft, ChevronRight, HeartHandshake, MessageCircle, Sofa, Sparkles } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import HeroSlider from "../../../../components/store/HeroSlider";
import Card from "./Card";
import { categoryImage, hasDiscount, money, priceOf, productImage, useHero, useKit, useUsedCategories } from "./kit";
import "./styles.css";

export default function StoreFront() {
  const { tenant, active, path, sf, productPath, hidden } = useKit();
  const rooms = useUsedCategories();
  const hero = useHero();
  const track = useRef<HTMLDivElement>(null);
  const featured = active.filter((p) => p.is_featured);
  const showcase = (featured.length ? featured : active).slice(0, tenant.featured_limit || 10);
  const lead = featured[0] || active[0];
  const heroImage = tenant.banner_url || (lead ? productImage(lead) : "");
  const title = tenant.hero_tagline || "Uma casa com a sua cara, um cômodo de cada vez";
  const about = tenant.about_text ? tenant.about_text.slice(0, 150) : "Peças escolhidas com carinho para deixar cada canto mais aconchegante.";
  const scroll = (dir: number) => track.current?.scrollBy({ left: dir * (track.current.clientWidth * 0.8), behavior: "smooth" });

  const fallback = (
    <section className="hm-hero">
      <div className="hm-hero-copy">
        <span className="hm-eyebrow"><Sparkles size={14} /> {sf.segment_label || "Casa e decoração"}</span>
        <h1>{title}</h1>
        <p>{about}</p>
        <div className="hm-actions">
          <Link className="hm-btn" to={path("/catalogo")}>{sf.hero_button_label || "Explorar a loja"} <ArrowRight size={17} /></Link>
          {rooms.length > 0 && <a className="hm-btn hm-btn-soft" href="#hm-rooms">Ver cômodos</a>}
        </div>
      </div>
      <div className="hm-hero-art">
        <div className="hm-arch">{heroImage ? <img src={heroImage} alt={lead?.name || tenant.name} /> : <Sofa size={72} aria-hidden="true" />}</div>
        {lead && (
          <Link to={productPath(lead)} className="hm-hero-chip">
            <span>Destaque</span>
            <strong>{lead.name}</strong>
            {!hidden && <em>{money(priceOf(lead))}{hasDiscount(lead) && <s>{money(Number(lead.price))}</s>}</em>}
          </Link>
        )}
      </div>
    </section>
  );

  return (
    <main className="hm-page">
      <StoreSEO
        title={tenant.name}
        description={tenant.hero_tagline || tenant.about_text || `Casa e decoração — ${tenant.name}`}
        image={tenant.banner_url || tenant.logo_url}
        url={typeof window !== "undefined" ? window.location.href : ""}
        siteName={tenant.name}
      />

      <div className="hm-wrap hm-hero-wrap" data-no-fx>
        <HeroSlider slides={hero.slides} autoplaySeconds={hero.autoplay} resolveUrl={hero.resolveUrl} layout="split" className="hm-slider" fallback={fallback} />
      </div>

      <div className="hm-wrap">
        <ul className="hm-trust">
          <li><MessageCircle size={22} /><span>Atendimento próximo<small>Dúvidas direto no WhatsApp</small></span></li>
          <li><HeartHandshake size={22} /><span>Peças selecionadas<small>Curadoria feita com carinho</small></span></li>
          <li><Sofa size={22} /><span>Para cada cômodo<small>Encontre pelo ambiente</small></span></li>
        </ul>
      </div>

      {rooms.length > 0 && (
        <section className="hm-wrap hm-section" id="hm-rooms" aria-labelledby="hm-rooms-title">
          <header className="hm-head">
            <span className="hm-eyebrow">Ambientes</span>
            <h2 id="hm-rooms-title">{sf.home_categories_title || "Escolha pelo cômodo"}</h2>
          </header>
          <div className="hm-rooms">
            {rooms.slice(0, 7).map((c) => {
              const img = categoryImage(c, active);
              return (
                <Link key={c.id} to={path(`/catalogo?categoria=${c.id}`)} className="hm-room">
                  {img ? <img src={img} alt="" loading="lazy" /> : <Sofa size={44} aria-hidden="true" />}
                  <span className="hm-room-label">
                    <strong>{c.name}</strong>
                    <small>{c.count} {c.count === 1 ? "peça" : "peças"}</small>
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <section className="hm-wrap hm-section">
        <header className="hm-head hm-head-row">
          <div>
            <span className="hm-eyebrow">Seleção da casa</span>
            <h2>{sf.home_featured_title || "Peças em destaque"}</h2>
          </div>
          <div className="hm-arrows">
            <button type="button" aria-label="Anterior" onClick={() => scroll(-1)}><ChevronLeft size={20} /></button>
            <button type="button" aria-label="Próximos" onClick={() => scroll(1)}><ChevronRight size={20} /></button>
          </div>
        </header>
        {showcase.length ? (
          <div className="hm-track" ref={track} data-no-fx>
            {showcase.map((p) => (
              <div key={p.id} className="hm-slot"><Card product={p} /></div>
            ))}
          </div>
        ) : (
          <p className="hm-empty">Estamos preparando a vitrine. Volte em breve!</p>
        )}
        <div className="hm-center">
          <Link className="hm-btn hm-btn-soft" to={path("/catalogo")}>Ver todo o catálogo <ArrowRight size={17} /></Link>
        </div>
      </section>
    </main>
  );
}
