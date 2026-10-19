import { useRef } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Droplets, Leaf, Sprout, Sun } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import HeroSlider from "../../../../components/store/HeroSlider";
import { StoreButton } from "../../../../components/store/StoreButton";
import { productImage, useKit } from "./kit";
import { useShelves } from "./extras";
import { useHeroMotion } from "./motion";
import { Card, LeafArt, SectionTitle } from "./parts";

const CARE = [
  { icon: Sun, title: "Luz certa", text: "Plantas para sol e sombra" },
  { icon: Droplets, title: "Rega fácil", text: "Do regador ao substrato" },
  { icon: Sprout, title: "Para começar", text: "Mudas e sementes" },
];

export default function StoreFront() {
  const { tenant, active, config, path } = useKit();
  const shelves = useShelves();
  const heroRef = useRef<HTMLDivElement>(null);
  useHeroMotion(heroRef);
  const featured = active.filter((p) => p.is_featured);
  const picks = (featured.length ? featured : active).slice(0, 8);
  const withImg = picks.filter((p) => productImage(p));
  const imgs = [tenant.banner_url || productImage(withImg[0]), productImage(withImg[1]), productImage(withImg[2])];
  const fallback = (
    <section className="garden-hero">
      <LeafArt className="garden-leaf-float garden-leaf-1" />
      <LeafArt className="garden-leaf-float garden-leaf-2" />
      <div className="garden-hero-copy">
        <span className="garden-eyebrow"><Leaf size={14} aria-hidden="true" /> {config.segment_label || "Jardinagem"}</span>
        <h1>{tenant.hero_tagline || "Faça o seu cantinho florescer."}</h1>
        <p>{tenant.about_text || "Plantas, vasos, substratos e ferramentas escolhidos com carinho para o seu jardim."}</p>
        <StoreButton asChild size="lg" className="garden-cta">
          <Link to={path("/catalogo")}>{config.hero_button_label || "Explorar o jardim"} <ArrowRight size={18} aria-hidden="true" /></Link>
        </StoreButton>
      </div>
      <div className="garden-mosaic" aria-hidden="true">
        {imgs.map((src, i) => (
          <span key={i} className={`garden-blob garden-blob-${"abc"[i]}`}>{src ? <img src={src} alt="" /> : <Sprout size={44} />}</span>
        ))}
      </div>
    </section>
  );
  return (
    <div className="garden-page">
      <StoreSEO title={tenant.name} description={tenant.hero_tagline || "Plantas e jardinagem."} image={tenant.banner_url || tenant.logo_url} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />
      <div className="garden-wrap garden-hero-wrap" ref={heroRef}>
        <HeroSlider
          slides={config.hero_slides}
          autoplaySeconds={config.hero_autoplay_seconds ?? 6}
          resolveUrl={(u) => (u.startsWith("/") ? path(u) : u)}
          layout="banner"
          className="garden-slider"
          fallback={fallback}
        />
      </div>

      <div className="garden-wrap">
        <ul className="garden-care" aria-label="Dicas de cultivo">
          {CARE.map((c) => (
            <li key={c.title}><span><c.icon size={22} aria-hidden="true" /></span><div><strong>{c.title}</strong><small>{c.text}</small></div></li>
          ))}
        </ul>
      </div>

      {shelves.length > 0 && (
        <section className="garden-wrap garden-section">
          <SectionTitle eyebrow="Categorias" title="Explore o jardim" text="Escolha um canto e comece a cultivar." />
          <div className="garden-circles" role="list">
            {shelves.slice(0, 10).map((c) => (
              <Link key={c.id} role="listitem" className="garden-circle" to={path("/catalogo", { cat: String(c.id) })}>
                <span>{c.cover ? <img src={c.cover} alt="" loading="lazy" /> : <Leaf size={32} aria-hidden="true" />}</span>
                <strong>{c.name}</strong>
                <small>{c.count} {c.count === 1 ? "item" : "itens"}</small>
              </Link>
            ))}
          </div>
        </section>
      )}

      {picks.length > 0 && (
        <section className="garden-wrap garden-section">
          <SectionTitle eyebrow={featured.length ? "Em destaque" : "Do nosso viveiro"} title="Para levar para casa" />
          <div className="garden-grid">{picks.map((p) => <Card key={p.id} product={p} />)}</div>
          <div className="garden-center">
            <StoreButton asChild variant="outline" className="garden-ghost"><Link to={path("/catalogo")}>Ver o catálogo completo</Link></StoreButton>
          </div>
        </section>
      )}
    </div>
  );
}
