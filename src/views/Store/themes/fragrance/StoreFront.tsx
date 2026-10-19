import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CreditCard, Droplets, Flower2, MessageCircle, RefreshCcw, Sparkles, Truck, Wind } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import HeroSlider from "../../../../components/store/HeroSlider";
import { StoreButton } from "../../../../components/store/StoreButton";
import { productRouteSegment } from "../../store-routing";
import { priceInfo, productImage, useKit, whatsappLink } from "./kit";
import { ProductCard } from "./parts";
import { useHeroMotion } from "./motion";
import "./styles.css";

const WORDS = ["Cítrico", "Floral", "Amadeirado", "Oriental", "Fresco", "Almiscarado", "Frutado"];

export default function StoreFront() {
  const { tenant, categories, active, path, sf, hidden } = useKit();
  const page = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState(0);
  useHeroMotion(page, [sf.hero_slides?.length]);
  const star = active.find((p) => p.is_featured) || active[0];
  const banner = tenant.banner_url || "";
  const heroImage = banner || productImage(star);
  const cats = categories.filter((c) => active.some((p) => p.category_id === c.id)).slice(0, 8);
  const about = tenant.about_text || "Fragrâncias escolhidas a dedo para marcar presença em cada momento.";
  const wa = whatsappLink(tenant.whatsapp, `Olá! Vim pela loja ${tenant.name}.`);
  const limit = tenant.featured_limit || 8;
  const pool = [...active.filter((p) => p.is_featured), ...active.filter((p) => !p.is_featured)];
  const shown = (tab ? pool.filter((p) => p.category_id === tab) : pool).slice(0, limit);
  const marquee = cats.length ? cats.map((c) => c.name) : WORDS;
  const trust = [
    { icon: Truck, text: "Entrega combinada com a loja" },
    { icon: CreditCard, text: "Pagamento facilitado" },
    { icon: RefreshCcw, text: "Troca com tranquilidade" },
  ];
  const pyramid = [
    { icon: Wind, title: "Notas de topo", text: "A primeira impressão: frescas e leves, surgem nos primeiros minutos." },
    { icon: Flower2, title: "Notas de coração", text: "O caráter da fragrância, que aparece conforme ela assenta na pele." },
    { icon: Droplets, title: "Notas de fundo", text: "A assinatura que permanece por horas e fica na memória." },
  ];

  const fallback = (
    <section className="frg-hero">
      <div className="frg-hero-copy">
        <span className="frg-eyebrow" data-in>{sf.segment_label || "Perfumaria"}</span>
        <h1 data-in>{tenant.hero_tagline || "A fragrância que conta a sua história"}</h1>
        <p data-in>{about}</p>
        <div className="frg-hero-actions" data-in>
          <StoreButton asChild size="lg" className="frg-btn frg-btn-lg">
            <Link to={path("/catalogo")}>{sf.hero_button_label || "Explorar fragrâncias"} <ArrowRight size={18} /></Link>
          </StoreButton>
          {wa && (
            <StoreButton asChild variant="outline" size="lg" className="frg-btn frg-btn-line frg-btn-lg">
              <a href={wa} target="_blank" rel="noreferrer"><MessageCircle size={18} /> Pedir indicação</a>
            </StoreButton>
          )}
        </div>
      </div>
      <div className="frg-hero-art">
        <div className={`frg-hero-stage ${banner ? "is-cover" : ""}`} data-parallax>
          <span className="frg-stage-disc" aria-hidden="true" />
          {heroImage ? <img src={heroImage} alt={star?.name || tenant.name} /> : <Droplets size={64} aria-label="Sem imagem" />}
          <span className="frg-stage-shadow" aria-hidden="true" />
        </div>
        {cats.slice(0, 3).map((c, i) => (
          <Link key={c.id} className={`frg-chip frg-chip-${i}`} to={path(`/catalogo?categoria=${c.id}`)}>{c.name}</Link>
        ))}
        {star && (
          <Link className="frg-float" to={path(`/produto/${productRouteSegment(star)}`)}>
            <span>Em destaque</span>
            <strong>{star.name}</strong>
            <em>{priceInfo(star, hidden).now}</em>
          </Link>
        )}
      </div>
    </section>
  );

  return (
    <div className="frg-page" ref={page}>
      <StoreSEO title={`${tenant.name} | Perfumaria`} description={about} image={heroImage || tenant.logo_url} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />

      <div className="frg-wrap frg-top">
        <HeroSlider
          slides={sf.hero_slides}
          autoplaySeconds={sf.hero_autoplay_seconds ?? 6}
          resolveUrl={(u) => (u.startsWith("/") ? path(u) : u)}
          layout="banner"
          className="frg-slider"
          fallback={fallback}
        />
      </div>

      <div className="frg-marquee" data-no-fx aria-hidden="true">
        <div className="frg-marquee-track">
          {[0, 1].map((k) => (
            <ul key={k}>
              {[...marquee, ...marquee].map((w, i) => <li key={`${k}-${i}`}>{w}</li>)}
            </ul>
          ))}
        </div>
      </div>

      <section className="frg-wrap frg-section">
        <header className="frg-head">
          <span className="frg-eyebrow">Vitrine</span>
          <h2>{sf.home_featured_title || "Frascos para descobrir"}</h2>
        </header>
        {cats.length > 0 && (
          <div className="frg-tabs" role="tablist" aria-label="Famílias olfativas">
            <button type="button" role="tab" aria-selected={tab === 0} onClick={() => setTab(0)}>Todas</button>
            {cats.map((c) => (
              <button key={c.id} type="button" role="tab" aria-selected={tab === c.id} onClick={() => setTab(c.id)}>{c.name}</button>
            ))}
          </div>
        )}
        {shown.length ? (
          <div className="frg-grid">{shown.map((p) => <ProductCard key={p.id} product={p} />)}</div>
        ) : (
          <p className="frg-note-box">Nenhuma fragrância nesta família por enquanto.</p>
        )}
        <div className="frg-center">
          <StoreButton asChild variant="outline" size="lg" className="frg-btn frg-btn-line frg-btn-lg">
            <Link to={path(tab ? `/catalogo?categoria=${tab}` : "/catalogo")}>Ver coleção completa <ArrowRight size={17} /></Link>
          </StoreButton>
        </div>
      </section>

      <ul className="frg-wrap frg-trust">
        {trust.map(({ icon: Icon, text }) => <li key={text}><Icon size={20} aria-hidden="true" /> {text}</li>)}
      </ul>

      <section className="frg-wrap frg-section">
        <header className="frg-head">
          <span className="frg-eyebrow">Guia olfativo</span>
          <h2>A pirâmide de uma fragrância</h2>
        </header>
        <ol className="frg-pyramid">
          {pyramid.map(({ icon: Icon, title, text }, i) => (
            <li key={title} className={`frg-layer frg-layer-${i}`}>
              <span className="frg-layer-icon"><Icon size={22} aria-hidden="true" /></span>
              <h3>{title}</h3>
              <p>{text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="frg-wrap frg-section">
        <div className="frg-cta">
          <Sparkles size={26} aria-hidden="true" />
          <h2>Presente ou assinatura pessoal?</h2>
          <p>Conte para a loja o que você procura e receba uma indicação sob medida.</p>
          <StoreButton asChild size="lg" className="frg-btn frg-btn-lg">
            {wa ? <a href={wa} target="_blank" rel="noreferrer"><MessageCircle size={18} /> Falar com a loja</a> : <Link to={path("/sobre")}>Conheça a loja</Link>}
          </StoreButton>
        </div>
      </section>
    </div>
  );
}
