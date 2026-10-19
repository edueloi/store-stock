import { useRef } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ChevronLeft, ChevronRight, CreditCard, Droplets, Flower2, MessageCircle, RefreshCcw, ShieldCheck, Sparkles, Truck } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import HeroSlider from "../../../../components/store/HeroSlider";
import { StoreButton } from "../../../../components/store/StoreButton";
import { productRouteSegment } from "../../store-routing";
import { priceInfo, productImage, useKit, whatsappLink } from "./kit";
import { ProductCard } from "./ThemeParts";
import { scrollRail, useHeroMotion } from "./motion";
import "./styles.css";

export default function StoreFront() {
  const { tenant, categories, active, path, sf, hidden } = useKit();
  const featured = [...active.filter((p) => p.is_featured), ...active.filter((p) => !p.is_featured)].slice(0, tenant.featured_limit || 8);
  const star = active.find((p) => p.is_featured) || active[0];
  const banner = tenant.banner_url || "";
  const heroImage = banner || productImage(star);
  const cats = categories.filter((c) => active.some((p) => p.category_id === c.id)).slice(0, 10);
  const about = tenant.about_text || "Skincare, beleza e bem-estar para transformar a sua rotina em um ritual.";
  const wa = whatsappLink(tenant.whatsapp, `Olá! Vim pela loja ${tenant.name}.`);
  const page = useRef<HTMLDivElement>(null);
  const rail = useRef<HTMLDivElement>(null);
  useHeroMotion(page, [sf.hero_slides?.length]);
  const trust = [
    { icon: Truck, text: "Entrega combinada com a loja" },
    { icon: CreditCard, text: "Pagamento facilitado" },
    { icon: RefreshCcw, text: "Troca com tranquilidade" },
  ];
  const rituals = [
    { icon: Droplets, title: "Limpar", text: "O primeiro passo para uma pele leve e confortável." },
    { icon: Flower2, title: "Tratar", text: "Fórmulas escolhidas para cada necessidade." },
    { icon: ShieldCheck, title: "Proteger", text: "Cuidado diário para manter o resultado." },
  ];

  const fallback = (
    <section className="bty-hero">
      <div className="bty-hero-copy">
        <span className="bty-eyebrow" data-in>{sf.segment_label || "Beleza & autocuidado"}</span>
        <h1 data-in>{tenant.hero_tagline || "Cuidado que revela a sua melhor pele"}</h1>
        <p data-in>{about}</p>
        <div data-in>
          <StoreButton asChild size="lg" className="bty-btn bty-btn-lg">
            <Link to={path("/catalogo")}>{sf.hero_button_label || "Conhecer os produtos"} <ArrowRight size={18} /></Link>
          </StoreButton>
        </div>
      </div>
      <div className="bty-hero-art">
        <span className="bty-arch-ring" aria-hidden="true" />
        <div className={`bty-arch ${banner ? "is-cover" : ""}`} data-parallax>
          {heroImage ? <img src={heroImage} alt={star?.name || tenant.name} /> : <Sparkles size={56} aria-label="Sem imagem" />}
        </div>
        {star && (
          <Link className="bty-float" to={path(`/produto/${productRouteSegment(star)}`)}>
            <span>Em destaque</span>
            <strong>{star.name}</strong>
            <em>{priceInfo(star, hidden).now}</em>
          </Link>
        )}
      </div>
    </section>
  );

  return (
    <div className="bty-page" ref={page}>
      <StoreSEO title={`${tenant.name} | Beleza e skincare`} description={about} image={heroImage || tenant.logo_url} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />

      <div className="bty-wrap bty-top">
        <HeroSlider
          slides={sf.hero_slides}
          autoplaySeconds={sf.hero_autoplay_seconds ?? 6}
          resolveUrl={(u) => (u.startsWith("/") ? path(u) : u)}
          layout="split"
          className="bty-slider"
          fallback={fallback}
        />
      </div>

      <ul className="bty-wrap bty-trust">
        {trust.map(({ icon: Icon, text }) => (
          <li key={text}><Icon size={18} aria-hidden="true" /> {text}</li>
        ))}
      </ul>

      {cats.length > 0 && (
        <section className="bty-wrap bty-section">
          <header className="bty-head bty-head-row">
            <div>
              <span className="bty-eyebrow">Categorias</span>
              <h2>{sf.home_categories_title || "Escolha o seu ritual"}</h2>
            </div>
            <div className="bty-arrows">
              <button type="button" aria-label="Categorias anteriores" onClick={() => scrollRail(rail.current, -1)}><ChevronLeft size={20} /></button>
              <button type="button" aria-label="Próximas categorias" onClick={() => scrollRail(rail.current, 1)}><ChevronRight size={20} /></button>
            </div>
          </header>
          <div className="bty-rail" ref={rail} tabIndex={0} aria-label="Categorias de produtos">
            {cats.map((c) => {
              const sample = active.find((p) => p.category_id === c.id);
              const img = c.cover_url || productImage(sample);
              const n = active.filter((p) => p.category_id === c.id).length;
              return (
                <Link key={c.id} className="bty-arch-card" to={path(`/catalogo?categoria=${c.id}`)}>
                  <span className="bty-arch-thumb">{img ? <img src={img} alt="" loading="lazy" /> : <Sparkles size={28} aria-hidden="true" />}</span>
                  <strong>{c.name}</strong>
                  <small>{n} {n === 1 ? "produto" : "produtos"}</small>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <section className="bty-wrap bty-section">
        <header className="bty-head bty-head-row">
          <div>
            <span className="bty-eyebrow">Seleção</span>
            <h2>{sf.home_featured_title || "Rituais para a sua rotina"}</h2>
          </div>
          <StoreButton asChild variant="outline" className="bty-btn bty-btn-line">
            <Link to={path("/catalogo")}>Ver todos <ArrowRight size={16} /></Link>
          </StoreButton>
        </header>
        {featured.length ? (
          <div className="bty-grid">
            {featured.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        ) : (
          <p className="bty-note">Estamos preparando a seleção. Volte em breve!</p>
        )}
      </section>

      <section className="bty-wrap bty-section">
        <header className="bty-head">
          <span className="bty-eyebrow">Passo a passo</span>
          <h2>Um ritual em três tempos</h2>
        </header>
        <ol className="bty-steps">
          {rituals.map(({ icon: Icon, title, text }, i) => (
            <li key={title} className={`bty-step bty-tint-${i}`}>
              <span className="bty-step-n">0{i + 1}</span>
              <Icon size={26} aria-hidden="true" />
              <h3>{title}</h3>
              <p>{text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="bty-wrap bty-section">
        <div className="bty-cta">
          <h2>Precisa de ajuda para escolher?</h2>
          <p>Fale com a loja e receba uma indicação para o seu momento.</p>
          <StoreButton asChild size="lg" className="bty-btn bty-btn-lg">
            {wa ? (
              <a href={wa} target="_blank" rel="noreferrer"><MessageCircle size={18} /> Falar com a loja</a>
            ) : (
              <Link to={path("/sobre")}>Conheça a loja</Link>
            )}
          </StoreButton>
        </div>
      </section>
    </div>
  );
}
