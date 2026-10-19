import { useRef } from "react";
import { Link } from "react-router-dom";
import { useHeroMotion } from "./motion";
import { ArrowRight, Hammer, MessageCircle, PawPrint, Sprout, Tractor, Wheat } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import HeroSlider from "../../../../components/store/HeroSlider";
import { StoreButton } from "../../../../components/store/StoreButton";
import { productImage, useKit } from "./kit";
import { useShelves, whatsappLink } from "./extras";
import { Card, SectionTitle } from "./parts";

const AREAS = [
  { icon: Sprout, title: "Plantio e safra", text: "Sementes, adubos e defensivos", q: "semente" },
  { icon: PawPrint, title: "Pecuária", text: "Nutrição e cuidado do rebanho", q: "ração" },
  { icon: Hammer, title: "Ferramentas", text: "Equipamentos para o dia a dia", q: "ferramenta" },
  { icon: Tractor, title: "Máquinas e peças", text: "Reposição e manutenção", q: "peça" },
];

export default function StoreFront() {
  const { tenant, active, config, path } = useKit();
  const heroRef = useRef<HTMLDivElement>(null);
  useHeroMotion(heroRef);
  const shelves = useShelves();
  const featured = active.filter((p) => p.is_featured);
  const picks = (featured.length ? featured : active).slice(0, 8);
  const hero = tenant.banner_url || productImage(picks[0]);
  const wa = whatsappLink(tenant.whatsapp, `Olá! Vim pela loja ${tenant.name}.`);
  const fallback = (
    <section className="agro-hero">
      <div className="agro-hero-pic">{hero ? <img src={hero} alt="" /> : <Wheat size={96} aria-hidden="true" />}</div>
      <div className="agro-hero-card">
        <span className="agro-eyebrow">{config.segment_label || "Agropecuária"}</span>
        <h1>{tenant.hero_tagline || "Tudo para a sua propriedade render mais."}</h1>
        <p>{tenant.about_text || "Insumos, ferramentas e produtos selecionados para o trabalho no campo."}</p>
        <StoreButton asChild size="lg" className="agro-cta">
          <Link to={path("/catalogo")}>
            {config.hero_button_label || "Ver o catálogo"} <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </StoreButton>
      </div>
    </section>
  );
  return (
    <div className="agro-page">
      <StoreSEO title={tenant.name} description={tenant.hero_tagline || "Tudo para a sua propriedade."} image={tenant.banner_url || tenant.logo_url} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />
      <div className="agro-wrap agro-hero-wrap" ref={heroRef}>
        <HeroSlider
          slides={config.hero_slides}
          autoplaySeconds={config.hero_autoplay_seconds ?? 6}
          resolveUrl={(u) => (u.startsWith("/") ? path(u) : u)}
          layout="banner"
          className="agro-slider"
          fallback={fallback}
        />
      </div>

      <div className="agro-wrap">
        <ul className="agro-areas" aria-label="Áreas de atuação">
          {AREAS.map((a) => (
            <li key={a.title}>
              <Link to={path("/catalogo", { q: a.q })}>
                <span className="agro-area-icon"><a.icon size={24} aria-hidden="true" /></span>
                <span>
                  <strong>{a.title}</strong>
                  <small>{a.text}</small>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      {shelves.length > 0 && (
        <section className="agro-wrap agro-section" aria-labelledby="agro-depts">
          <SectionTitle eyebrow="Departamentos" title="Encontre pelo que você precisa" action={<Link className="agro-more" to={path("/catalogo")}>Ver tudo <ArrowRight size={16} aria-hidden="true" /></Link>} />
          <div className="agro-depts" id="agro-depts" role="list" tabIndex={0} aria-label="Departamentos">
            {shelves.map((c) => (
              <Link key={c.id} role="listitem" className="agro-dept" to={path("/catalogo", { cat: String(c.id) })}>
                <span className="agro-dept-img">{c.cover ? <img src={c.cover} alt="" loading="lazy" /> : <Wheat size={36} aria-hidden="true" />}</span>
                <strong>{c.name}</strong>
                <small>{c.count} {c.count === 1 ? "produto" : "produtos"}</small>
              </Link>
            ))}
          </div>
        </section>
      )}

      {picks.length > 0 && (
        <section className="agro-wrap agro-section">
          <SectionTitle eyebrow={featured.length ? "Em destaque" : "Do nosso catálogo"} title="Mais procurados na propriedade" />
          <div className="agro-grid">{picks.map((p) => <Card key={p.id} product={p} />)}</div>
          <div className="agro-center">
            <StoreButton asChild variant="outline" className="agro-ghost">
              <Link to={path("/catalogo")}>Ver o catálogo completo</Link>
            </StoreButton>
          </div>
        </section>
      )}

      <section className="agro-wrap agro-section">
        <div className="agro-band">
          <div>
            <h2>Precisa de ajuda para escolher?</h2>
            <p>Fale com quem entende do assunto e receba a indicação certa para a sua lavoura ou criação.</p>
          </div>
          {wa ? (
            <StoreButton asChild size="lg" className="agro-cta">
              <a href={wa} target="_blank" rel="noreferrer"><MessageCircle size={18} aria-hidden="true" /> Chamar no WhatsApp</a>
            </StoreButton>
          ) : (
            <StoreButton asChild size="lg" className="agro-cta">
              <Link to={path("/sobre")}>Conheça a loja</Link>
            </StoreButton>
          )}
        </div>
      </section>
    </div>
  );
}
