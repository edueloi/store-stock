import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ArrowUpRight, CreditCard, Gem, MessageCircle, RefreshCcw, Truck } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import HeroSlider from "../../../../components/store/HeroSlider";
import { StoreButton } from "../../../../components/store/StoreButton";
import { productRouteSegment } from "../../store-routing";
import { priceInfo, productImage, useKit, whatsappLink } from "./kit";
import { ProductCard } from "./parts";
import { useHeroMotion } from "./motion";
import "./styles.css";

export default function StoreFront() {
  const { tenant, categories, active, path, sf, hidden } = useKit();
  const page = useRef<HTMLDivElement>(null);
  useHeroMotion(page, [sf.hero_slides?.length]);
  const [preview, setPreview] = useState(0);
  const featured = [...active.filter((p) => p.is_featured), ...active.filter((p) => !p.is_featured)].slice(0, tenant.featured_limit || 8);
  const star = active.find((p) => p.is_featured) || active[0];
  const banner = tenant.banner_url || "";
  const heroImage = banner || productImage(star);
  const cats = categories.filter((c) => active.some((p) => p.category_id === c.id)).slice(0, 8);
  const about = tenant.about_text || "Peças selecionadas com o cuidado que cada detalhe merece.";
  const wa = whatsappLink(tenant.whatsapp, `Olá! Vim pela loja ${tenant.name}.`);
  const catImage = (id: number) => {
    const c = cats.find((x) => x.id === id);
    return c?.cover_url || productImage(active.find((p) => p.category_id === id));
  };
  const shownCat = cats[preview] || cats[0];
  const trust = [
    { icon: Truck, text: "Entrega combinada" },
    { icon: CreditCard, text: "Pagamento facilitado" },
    { icon: RefreshCcw, text: "Troca assegurada" },
  ];

  const fallback = (
    <section className={`lux-hero ${banner ? "has-banner" : ""}`}>
      <div className="lux-hero-art" data-parallax>
        {heroImage ? <img src={heroImage} alt={star?.name || tenant.name} /> : <Gem size={72} aria-label="Sem imagem" />}
      </div>
      <div className="lux-hero-card">
        <span className="lux-eyebrow" data-in>{sf.segment_label || "Nova coleção"}</span>
        <h1 data-in>{tenant.hero_tagline || "O raro, no tempo do essencial"}</h1>
        <div data-in>
          <StoreButton asChild className="lux-btn">
            <Link to={path("/catalogo")}>{sf.hero_button_label || "Descobrir a coleção"} <ArrowRight size={17} /></Link>
          </StoreButton>
        </div>
      </div>
      {star && (
        <Link className="lux-hero-piece" to={path(`/produto/${productRouteSegment(star)}`)}>
          <span>{star.name}</span>
          <strong>{priceInfo(star, hidden).now}</strong>
        </Link>
      )}
    </section>
  );

  return (
    <div className="lux-page" ref={page}>
      <StoreSEO title={`${tenant.name} | Coleção`} description={about} image={heroImage || tenant.logo_url} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />

      <div className="lux-wrap lux-top">
        <HeroSlider
          slides={sf.hero_slides}
          autoplaySeconds={sf.hero_autoplay_seconds ?? 6}
          resolveUrl={(u) => (u.startsWith("/") ? path(u) : u)}
          layout="banner"
          className="lux-slider"
          fallback={fallback}
        />
      </div>

      <ul className="lux-wrap lux-trust">
        {trust.map(({ icon: Icon, text }) => <li key={text}><Icon size={17} aria-hidden="true" /> {text}</li>)}
      </ul>

      {cats.length > 0 && (
        <section className="lux-wrap lux-section">
          <div className="lux-index">
            <div className="lux-index-list">
              <header className="lux-head">
                <span className="lux-eyebrow">Índice</span>
                <h2>{sf.home_categories_title || "As coleções"}</h2>
              </header>
              <ol>
                {cats.map((c, i) => (
                  <li key={c.id}>
                    <Link to={path(`/catalogo?categoria=${c.id}`)} className={i === preview ? "is-on" : ""} onMouseEnter={() => setPreview(i)} onFocus={() => setPreview(i)}>
                      <span className="lux-num">{String(i + 1).padStart(2, "0")}</span>
                      <span className="lux-index-name">{c.name}</span>
                      <ArrowUpRight size={18} aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ol>
            </div>
            <div className="lux-index-preview" aria-hidden="true">
              <div className="lux-arch">
                {shownCat && catImage(shownCat.id) ? <img key={shownCat.id} src={catImage(shownCat.id)} alt="" /> : <Gem size={48} />}
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="lux-wrap lux-section">
        <header className="lux-head lux-head-row">
          <div>
            <span className="lux-eyebrow">Seleção</span>
            <h2>{sf.home_featured_title || "Peças em destaque"}</h2>
          </div>
          <StoreButton asChild variant="outline" className="lux-btn lux-btn-line">
            <Link to={path("/catalogo")}>Ver toda a coleção <ArrowRight size={16} /></Link>
          </StoreButton>
        </header>
        {featured.length ? (
          <div className="lux-grid">{featured.map((p) => <ProductCard key={p.id} product={p} />)}</div>
        ) : (
          <p className="lux-note">Estamos preparando a seleção. Volte em breve.</p>
        )}
      </section>

      <section className="lux-wrap lux-section">
        <div className="lux-cta">
          <span className="lux-eyebrow">Atendimento</span>
          <h2>Um atendimento à altura da peça</h2>
          <p>Converse com a loja e receba uma indicação personalizada.</p>
          <StoreButton asChild size="lg" className="lux-btn lux-btn-lg">
            {wa ? <a href={wa} target="_blank" rel="noreferrer"><MessageCircle size={18} /> Falar com a loja</a> : <Link to={path("/sobre")}>Conheça a maison</Link>}
          </StoreButton>
        </div>
      </section>
    </div>
  );
}
